const { getPool, sql } = require('./conexion');
const historicos = require('./historicos');

/* =========================================================
   DIMENSIONES
   ========================================================= */

async function obtenerDimensiones(idLugarCliente) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdLugarCliente', sql.Int, idLugarCliente)
        .query('SELECT Filas, Columnas FROM LugaresClientes WHERE IdLugarCliente = @IdLugarCliente');
    return r.recordset[0] || { Filas: 8, Columnas: 12 };
}

async function actualizarDimensiones(idUsuario, idLugarCliente, filas, columnas) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        // Detectar equipos fuera del nuevo rango
        const fueraRango = await new sql.Request(tx)
            .input('IdLugarCliente', sql.Int, idLugarCliente)
            .input('Filas', sql.Int, filas)
            .input('Columnas', sql.Int, columnas)
            .query(`
                SELECT E.IdEquipo, E.Hostname, P.Fila, P.Columna
                FROM PlanoUbicaciones P
                INNER JOIN Equipos E ON E.IdEquipo = P.IdEquipo
                WHERE P.IdLugarCliente = @IdLugarCliente
                  AND (P.Fila > @Filas OR P.Columna > @Columnas)
            `);

        const expulsados = fueraRango.recordset;

        // Eliminar ubicaciones fuera de rango
        if (expulsados.length > 0) {
            await new sql.Request(tx)
                .input('IdLugarCliente', sql.Int, idLugarCliente)
                .input('Filas', sql.Int, filas)
                .input('Columnas', sql.Int, columnas)
                .query(`
                    DELETE FROM PlanoUbicaciones
                    WHERE IdLugarCliente = @IdLugarCliente
                      AND (Fila > @Filas OR Columna > @Columnas)
                `);
        }

        // Actualizar dimensiones
        await new sql.Request(tx)
            .input('IdLugarCliente', sql.Int, idLugarCliente)
            .input('Filas', sql.Int, filas)
            .input('Columnas', sql.Int, columnas)
            .query(`UPDATE LugaresClientes SET Filas = @Filas, Columnas = @Columnas
                    WHERE IdLugarCliente = @IdLugarCliente`);

        await tx.commit();

        // Histórico
        const detalle = expulsados.length > 0
            ? `Dimensiones cambiadas a ${filas}x${columnas}. ${expulsados.length} equipo(s) fuera de rango: ${expulsados.map(e => e.Hostname).join(', ')}`
            : `Dimensiones cambiadas a ${filas}x${columnas}`;

        await historicos.registrar(idUsuario, idLugarCliente, null, 'Redimensionar', detalle);

        return {
            ok: true,
            mensaje: 'Dimensiones actualizadas',
            expulsados
        };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/* =========================================================
   UBICACIONES
   ========================================================= */

async function listarPorLugar(idLugarCliente) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdLugarCliente', sql.Int, idLugarCliente)
        .query(`
            SELECT P.IdUbicacion, P.IdEquipo, P.Fila, P.Columna,
                   E.Hostname, E.TipoIP, E.IP, E.IdCliente,
                   R.Codigo AS RolCodigo
            FROM PlanoUbicaciones P
            INNER JOIN Equipos E ON E.IdEquipo = P.IdEquipo
            INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
            WHERE P.IdLugarCliente = @IdLugarCliente
        `);
    return r.recordset;
}

async function equiposSinUbicacion(idLugarCliente) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdLugarCliente', sql.Int, idLugarCliente)
        .query(`
            SELECT E.IdEquipo, E.Hostname, E.TipoIP, E.IP, E.IdCliente,
                   C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
                   R.Codigo AS RolCodigo
            FROM Equipos E
            INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
            INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
            WHERE E.IdLugarCliente = @IdLugarCliente
              AND E.IdEquipo NOT IN (SELECT IdEquipo FROM PlanoUbicaciones)
        `);
    return r.recordset;
}

async function asignar(idUsuario, idLugarCliente, idEquipo, fila, columna) {
    const pool = await getPool();
    await pool.request()
        .input('IdLugarCliente', sql.Int, idLugarCliente)
        .input('IdEquipo', sql.Int, idEquipo)
        .input('Fila', sql.Int, fila)
        .input('Columna', sql.Int, columna)
        .query(`INSERT INTO PlanoUbicaciones (IdLugarCliente, IdEquipo, Fila, Columna)
                VALUES (@IdLugarCliente, @IdEquipo, @Fila, @Columna)`);

    await historicos.registrar(idUsuario, idLugarCliente, idEquipo, 'Asignar',
        `Asignado en (${fila}, ${columna})`);

    return { ok: true, mensaje: 'Equipo asignado al plano' };
}

async function mover(idUsuario, idEquipo, fila, columna, filaAnterior, colAnterior, idLugarCliente) {
    const pool = await getPool();
    await pool.request()
        .input('IdEquipo', sql.Int, idEquipo)
        .input('Fila', sql.Int, fila)
        .input('Columna', sql.Int, columna)
        .query(`UPDATE PlanoUbicaciones SET Fila = @Fila, Columna = @Columna
                WHERE IdEquipo = @IdEquipo`);

    await historicos.registrar(idUsuario, idLugarCliente, idEquipo, 'Mover',
        `De (${filaAnterior}, ${colAnterior}) a (${fila}, ${columna})`);

    return { ok: true, mensaje: 'Equipo movido' };
}

async function quitar(idUsuario, idEquipo, idLugarCliente, hostname) {
    const pool = await getPool();
    await pool.request()
        .input('IdEquipo', sql.Int, idEquipo)
        .query('DELETE FROM PlanoUbicaciones WHERE IdEquipo = @IdEquipo');

    await historicos.registrar(idUsuario, idLugarCliente, idEquipo, 'Quitar',
        `Equipo ${hostname} quitado del plano`);

    return { ok: true, mensaje: 'Equipo quitado del plano' };
}

async function intercambiar(idUsuario, idEquipoA, idEquipoB, idLugarCliente, hostA, hostB, filaA, colA, filaB, colB) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoA)
            .query(`UPDATE PlanoUbicaciones SET Fila = -1, Columna = -1 WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoB)
            .input('Fila', sql.Int, filaA)
            .input('Columna', sql.Int, colA)
            .query(`UPDATE PlanoUbicaciones SET Fila = @Fila, Columna = @Columna WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoA)
            .input('Fila', sql.Int, filaB)
            .input('Columna', sql.Int, colB)
            .query(`UPDATE PlanoUbicaciones SET Fila = @Fila, Columna = @Columna WHERE IdEquipo = @IdEquipo`);

        await tx.commit();

        await historicos.registrar(idUsuario, idLugarCliente, null, 'Intercambiar',
            `${hostA} ↔ ${hostB} (posiciones intercambiadas)`);

        return { ok: true, mensaje: 'Equipos intercambiados' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/* =========================================================
   MOVER ENTRE PISOS
   ========================================================= */

/**
 * Mueve un equipo de un piso a otro, con opción de editar sus datos.
 *
 * @param {number} idUsuario
 * @param {number} idEquipo
 * @param {number} idLugarOrigen
 * @param {number} idLugarDestino
 * @param {number} fila
 * @param {number} columna
 * @param {object|null} nuevosDatos  Si null, solo cambia de piso. Si tiene datos, actualiza el equipo.
 */
async function moverEntrePisos(idUsuario, idEquipo, idLugarOrigen, idLugarDestino, fila, columna, nuevosDatos = null) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        // Leer datos actuales del equipo
        const actual = await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipo)
            .query(`SELECT IdEquipo, IdCliente, IdLugarCliente, IdRolEquipo, Hostname, IP, NumeroHost, TipoIP
                    FROM Equipos WHERE IdEquipo = @IdEquipo`);

        if (!actual.recordset[0]) {
            throw new Error('Equipo no encontrado');
        }

        const eq = actual.recordset[0];

        // Actualizar Equipos (piso + datos opcionales)
        if (nuevosDatos) {
            // Validar hostname único (excluyendo el propio equipo)
            const dupH = await new sql.Request(tx)
                .input('Hostname', sql.VarChar(50), nuevosDatos.hostname)
                .input('IdEquipo', sql.Int, idEquipo)
                .query('SELECT IdEquipo FROM Equipos WHERE Hostname = @Hostname AND IdEquipo <> @IdEquipo');
            if (dupH.recordset.length > 0) {
                throw new Error(`El hostname "${nuevosDatos.hostname}" ya está registrado en otro equipo.`);
            }

            // Validar IP única (solo si es estática y no es null)
            if (nuevosDatos.tipoIP === 'Estatica' && nuevosDatos.ip) {
                const dupIP = await new sql.Request(tx)
                    .input('IP', sql.VarChar(45), nuevosDatos.ip)
                    .input('IdEquipo', sql.Int, idEquipo)
                    .query('SELECT IdEquipo FROM Equipos WHERE IP = @IP AND IdEquipo <> @IdEquipo');
                if (dupIP.recordset.length > 0) {
                    throw new Error(`La IP "${nuevosDatos.ip}" ya está registrada en otro equipo.`);
                }
            }

            await new sql.Request(tx)
                .input('IdEquipo', sql.Int, idEquipo)
                .input('IdCliente', sql.Int, nuevosDatos.idCliente)
                .input('IdLugarCliente', sql.Int, idLugarDestino)
                .input('IdRolEquipo', sql.Int, nuevosDatos.idRolEquipo)
                .input('TipoIP', sql.VarChar(10), nuevosDatos.tipoIP)
                .input('Hostname', sql.VarChar(50), nuevosDatos.hostname)
                .input('NumeroHost', sql.Int, nuevosDatos.numeroHost)
                .input('IP', sql.VarChar(45), nuevosDatos.ip)
                .input('Mascara', sql.VarChar(45), nuevosDatos.mascara)
                .input('PuertaEnlace', sql.VarChar(45), nuevosDatos.puertaEnlace)
                .input('DNS1', sql.VarChar(45), nuevosDatos.dns1)
                .input('DNS2', sql.VarChar(45), nuevosDatos.dns2)
                .input('UsuarioAdmin', sql.NVarChar(100), nuevosDatos.usuarioAdmin)
                .input('PasswordAdmin', sql.NVarChar(255), nuevosDatos.passwordAdmin)
                .query(`UPDATE Equipos SET
                        IdCliente = @IdCliente,
                        IdLugarCliente = @IdLugarCliente,
                        IdRolEquipo = @IdRolEquipo,
                        TipoIP = @TipoIP,
                        Hostname = @Hostname,
                        NumeroHost = @NumeroHost,
                        IP = @IP,
                        Mascara = @Mascara,
                        PuertaEnlace = @PuertaEnlace,
                        DNS1 = @DNS1,
                        DNS2 = @DNS2,
                        UsuarioAdmin = @UsuarioAdmin,
                        PasswordAdmin = @PasswordAdmin
                        WHERE IdEquipo = @IdEquipo`);
        } else {
            // Solo cambio de piso
            await new sql.Request(tx)
                .input('IdEquipo', sql.Int, idEquipo)
                .input('IdLugarCliente', sql.Int, idLugarDestino)
                .query(`UPDATE Equipos SET IdLugarCliente = @IdLugarCliente WHERE IdEquipo = @IdEquipo`);
        }

        // Actualizar PlanoUbicaciones: primero borrar ubicación previa (por si cambia de piso)
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipo)
            .query('DELETE FROM PlanoUbicaciones WHERE IdEquipo = @IdEquipo');

        // Insertar nueva ubicación
        await new sql.Request(tx)
            .input('IdLugarCliente', sql.Int, idLugarDestino)
            .input('IdEquipo', sql.Int, idEquipo)
            .input('Fila', sql.Int, fila)
            .input('Columna', sql.Int, columna)
            .query(`INSERT INTO PlanoUbicaciones (IdLugarCliente, IdEquipo, Fila, Columna)
                    VALUES (@IdLugarCliente, @IdEquipo, @Fila, @Columna)`);

        await tx.commit();

        const detalle = nuevosDatos
            ? `Movido y editado. De piso ${idLugarOrigen} (${fila}, ${columna}) a piso ${idLugarDestino}`
            : `Movido de piso ${idLugarOrigen} a piso ${idLugarDestino} (${fila}, ${columna})`;

        await historicos.registrar(
            idUsuario, idLugarDestino, idEquipo, 'CambioPiso', detalle,
            idLugarOrigen, idLugarDestino
        );

        return { ok: true, mensaje: 'Equipo movido a otro piso' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/**
 * Swap de dos equipos entre pisos distintos.
 * Mantiene los datos de ambos. Solo intercambia piso y posición.
 */
async function swapEntrePisos(idUsuario, idEquipoA, idEquipoB,
                              idPisoA, filaA, colA,
                              idPisoB, filaB, colB,
                              hostA, hostB) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        // Actualizar Equipos: A va a piso B, B va a piso A
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoA)
            .input('IdLugarCliente', sql.Int, idPisoB)
            .query(`UPDATE Equipos SET IdLugarCliente = @IdLugarCliente WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoB)
            .input('IdLugarCliente', sql.Int, idPisoA)
            .query(`UPDATE Equipos SET IdLugarCliente = @IdLugarCliente WHERE IdEquipo = @IdEquipo`);

        // Actualizar PlanoUbicaciones: primero liberamos con valores temporales
        // para no chocar con la UNIQUE (IdLugarCliente, Fila, Columna)
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoA)
            .query(`UPDATE PlanoUbicaciones SET Fila = -1, Columna = -1 WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoB)
            .query(`UPDATE PlanoUbicaciones SET Fila = -2, Columna = -2 WHERE IdEquipo = @IdEquipo`);

        // Ahora sí, ubicamos cada uno en el piso del otro
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoA)
            .input('IdLugarCliente', sql.Int, idPisoB)
            .input('Fila', sql.Int, filaB)
            .input('Columna', sql.Int, colB)
            .query(`UPDATE PlanoUbicaciones 
                    SET IdLugarCliente = @IdLugarCliente, Fila = @Fila, Columna = @Columna
                    WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoB)
            .input('IdLugarCliente', sql.Int, idPisoA)
            .input('Fila', sql.Int, filaA)
            .input('Columna', sql.Int, colA)
            .query(`UPDATE PlanoUbicaciones 
                    SET IdLugarCliente = @IdLugarCliente, Fila = @Fila, Columna = @Columna
                    WHERE IdEquipo = @IdEquipo`);

        await tx.commit();

        // Registrar 2 movimientos en histórico
        await historicos.registrar(idUsuario, idPisoA, idEquipoB, 'SwapPiso',
            `Intercambio con ${hostA}. Ahora en piso ${idPisoA} (${filaA}, ${colA})`,
            idPisoB, idPisoA);

        await historicos.registrar(idUsuario, idPisoB, idEquipoA, 'SwapPiso',
            `Intercambio con ${hostB}. Ahora en piso ${idPisoB} (${filaB}, ${colB})`,
            idPisoA, idPisoB);

        return { ok: true, mensaje: 'Equipos intercambiados entre pisos' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/* =========================================================
   ZONAS
   ========================================================= */

async function listarZonas(idLugarCliente) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdLugarCliente', sql.Int, idLugarCliente)
        .query(`
            SELECT IdZona, Nombre, Color, FilaInicio, FilaFin, ColumnaInicio, ColumnaFin
            FROM PlanoZonas
            WHERE IdLugarCliente = @IdLugarCliente
            ORDER BY IdZona
        `);
    return r.recordset;
}

async function crearZona(idUsuario, idLugarCliente, nombre, color, fi, ff, ci, cf) {
    const pool = await getPool();
    await pool.request()
        .input('IdLugarCliente', sql.Int, idLugarCliente)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Color', sql.VarChar(20), color)
        .input('FilaInicio', sql.Int, fi)
        .input('FilaFin', sql.Int, ff)
        .input('ColumnaInicio', sql.Int, ci)
        .input('ColumnaFin', sql.Int, cf)
        .query(`INSERT INTO PlanoZonas (IdLugarCliente, Nombre, Color, FilaInicio, FilaFin, ColumnaInicio, ColumnaFin)
                VALUES (@IdLugarCliente, @Nombre, @Color, @FilaInicio, @FilaFin, @ColumnaInicio, @ColumnaFin)`);

    await historicos.registrar(idUsuario, idLugarCliente, null, 'CrearZona',
        `Zona "${nombre}" creada (fila ${fi}-${ff}, col ${ci}-${cf})`);

    return { ok: true, mensaje: 'Zona creada' };
}

async function actualizarZona(idUsuario, idLugarCliente, idZona, nombre, color, fi, ff, ci, cf) {
    const pool = await getPool();
    await pool.request()
        .input('IdZona', sql.Int, idZona)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Color', sql.VarChar(20), color)
        .input('FilaInicio', sql.Int, fi)
        .input('FilaFin', sql.Int, ff)
        .input('ColumnaInicio', sql.Int, ci)
        .input('ColumnaFin', sql.Int, cf)
        .query(`UPDATE PlanoZonas
                SET Nombre = @Nombre, Color = @Color,
                    FilaInicio = @FilaInicio, FilaFin = @FilaFin,
                    ColumnaInicio = @ColumnaInicio, ColumnaFin = @ColumnaFin
                WHERE IdZona = @IdZona`);

    await historicos.registrar(idUsuario, idLugarCliente, null, 'EditarZona',
        `Zona "${nombre}" actualizada`);

    return { ok: true, mensaje: 'Zona actualizada' };
}

async function eliminarZona(idUsuario, idLugarCliente, idZona, nombre) {
    const pool = await getPool();
    await pool.request()
        .input('IdZona', sql.Int, idZona)
        .query('DELETE FROM PlanoZonas WHERE IdZona = @IdZona');

    await historicos.registrar(idUsuario, idLugarCliente, null, 'EliminarZona',
        `Zona "${nombre}" eliminada`);

    return { ok: true, mensaje: 'Zona eliminada' };
}

module.exports = {
    obtenerDimensiones, actualizarDimensiones,
    listarPorLugar, equiposSinUbicacion,
    asignar, mover, quitar, intercambiar,
    moverEntrePisos, swapEntrePisos,
    listarZonas, crearZona, actualizarZona, eliminarZona
};