const { getPool, sql } = require('./conexion');
const historicos = require('./historicos');

/* =========================================================
   DIMENSIONES
   ========================================================= */

async function obtenerDimensiones(idPiso) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query('SELECT Filas, Columnas FROM Pisos WHERE IdPiso = @IdPiso');
    return r.recordset[0] || { Filas: 8, Columnas: 12 };
}

async function actualizarDimensiones(idUsuario, idPiso, filas, columnas) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        const fueraRango = await new sql.Request(tx)
            .input('IdPiso', sql.Int, idPiso)
            .input('Filas', sql.Int, filas)
            .input('Columnas', sql.Int, columnas)
            .query(`
                SELECT E.IdEquipo, E.Hostname, P.Fila, P.Columna
                FROM PlanoUbicaciones P
                INNER JOIN Equipos E ON E.IdEquipo = P.IdEquipo
                WHERE P.IdPiso = @IdPiso
                  AND (P.Fila > @Filas OR P.Columna > @Columnas)
            `);

        const expulsados = fueraRango.recordset;

        if (expulsados.length > 0) {
            await new sql.Request(tx)
                .input('IdPiso', sql.Int, idPiso)
                .input('Filas', sql.Int, filas)
                .input('Columnas', sql.Int, columnas)
                .query(`
                    DELETE FROM PlanoUbicaciones
                    WHERE IdPiso = @IdPiso
                      AND (Fila > @Filas OR Columna > @Columnas)
                `);
        }

        await new sql.Request(tx)
            .input('IdPiso', sql.Int, idPiso)
            .input('Filas', sql.Int, filas)
            .input('Columnas', sql.Int, columnas)
            .query(`UPDATE Pisos SET Filas = @Filas, Columnas = @Columnas
                    WHERE IdPiso = @IdPiso`);

        await tx.commit();

        const detalle = expulsados.length > 0
            ? `Dimensiones cambiadas a ${filas}x${columnas}. ${expulsados.length} equipo(s) fuera de rango: ${expulsados.map(e => e.Hostname).join(', ')}`
            : `Dimensiones cambiadas a ${filas}x${columnas}`;

        await historicos.registrar(idUsuario, idPiso, null, 'Redimensionar', detalle);

        return { ok: true, mensaje: 'Dimensiones actualizadas', expulsados };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/* =========================================================
   UBICACIONES
   ========================================================= */

async function listarPorLugar(idPiso) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT P.IdUbicacion, P.IdEquipo, P.Fila, P.Columna,
                   E.Hostname, E.TipoIP, E.IP, E.IdCliente,E.IdPiso, E.IdRolEquipo,
                   E.Mascara, E.PuertaEnlace, E.DNS1, E.DNS2,
                   E.UsuarioAdmin, E.PasswordAdmin,
                   R.Codigo AS RolCodigo,
                   C.Codigo AS ClienteCodigo,
                   C.Nombre AS ClienteNombre,
                   DA.Descripcion AS DescripcionAdmin
            FROM PlanoUbicaciones P
            INNER JOIN Equipos E ON E.IdEquipo = P.IdEquipo
            INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
            INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
            LEFT JOIN DominiosAdmin DA
                   ON DA.IdCliente = E.IdCliente
                  AND DA.Usuario   = E.UsuarioAdmin
            WHERE P.IdPiso = @IdPiso
        `);
    return r.recordset;
}

async function equiposSinUbicacion(idPiso) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT E.IdEquipo, E.Hostname, E.TipoIP, E.IP, E.IdCliente, E.IdPiso, E.IdRolEquipo,
                   E.Mascara, E.PuertaEnlace, E.DNS1, E.DNS2,
                   E.UsuarioAdmin, E.PasswordAdmin,
                   C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
                   R.Codigo AS RolCodigo,
                   DA.Descripcion AS DescripcionAdmin
            FROM Equipos E
            INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
            INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
            LEFT JOIN DominiosAdmin DA
                   ON DA.IdCliente = E.IdCliente
                  AND DA.Usuario   = E.UsuarioAdmin
            WHERE E.IdPiso = @IdPiso
              AND NOT EXISTS (
                  SELECT 1 FROM PlanoUbicaciones P
                  WHERE P.IdEquipo = E.IdEquipo AND P.IdPiso = @IdPiso
              )
        `);
    return r.recordset;
}

async function asignar(idUsuario, idPiso, idEquipo, fila, columna) {
    const pool = await getPool();
    await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .input('IdEquipo', sql.Int, idEquipo)
        .input('Fila', sql.Int, fila)
        .input('Columna', sql.Int, columna)
        .query(`INSERT INTO PlanoUbicaciones (IdPiso, IdEquipo, Fila, Columna)
                VALUES (@IdPiso, @IdEquipo, @Fila, @Columna)`);

    await historicos.registrar(idUsuario, idPiso, idEquipo, 'Asignar',
        `Asignado en (${fila}, ${columna})`);

    return { ok: true, mensaje: 'Equipo asignado al plano' };
}

async function mover(idUsuario, idEquipo, fila, columna, filaAnterior, colAnterior, idPiso) {
    const pool = await getPool();
    await pool.request()
        .input('IdEquipo', sql.Int, idEquipo)
        .input('Fila', sql.Int, fila)
        .input('Columna', sql.Int, columna)
        .query(`UPDATE PlanoUbicaciones SET Fila = @Fila, Columna = @Columna
                WHERE IdEquipo = @IdEquipo`);

    await historicos.registrar(idUsuario, idPiso, idEquipo, 'Mover',
        `De (${filaAnterior}, ${colAnterior}) a (${fila}, ${columna})`);

    return { ok: true, mensaje: 'Equipo movido' };
}

async function quitar(idUsuario, idEquipo, idPiso, hostname) {
    const pool = await getPool();
    await pool.request()
        .input('IdEquipo', sql.Int, idEquipo)
        .query('DELETE FROM PlanoUbicaciones WHERE IdEquipo = @IdEquipo');

    await historicos.registrar(idUsuario, idPiso, idEquipo, 'Quitar',
        `Equipo ${hostname} quitado del plano`);

    return { ok: true, mensaje: 'Equipo quitado del plano' };
}

async function intercambiar(idUsuario, idEquipoA, idEquipoB, idPiso, hostA, hostB, filaA, colA, filaB, colB) {
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

        await historicos.registrar(idUsuario, idPiso, null, 'Intercambiar',
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

async function moverEntrePisos(idUsuario, idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos = null) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        const actual = await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipo)
            .query(`SELECT IdEquipo, IdCliente, IdPiso, IdRolEquipo, Hostname, IP, NumeroHost, TipoIP
                    FROM Equipos WHERE IdEquipo = @IdEquipo`);

        if (!actual.recordset[0]) throw new Error('Equipo no encontrado');

        if (nuevosDatos) {
            const dupH = await new sql.Request(tx)
                .input('Hostname', sql.VarChar(50), nuevosDatos.hostname)
                .input('IdEquipo', sql.Int, idEquipo)
                .query('SELECT IdEquipo FROM Equipos WHERE Hostname = @Hostname AND IdEquipo <> @IdEquipo');
            if (dupH.recordset.length > 0) {
                throw new Error(`El hostname "${nuevosDatos.hostname}" ya está registrado en otro equipo.`);
            }

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
                .input('IdPiso', sql.Int, idPisoDestino)
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
                        IdCliente = @IdCliente, IdPiso = @IdPiso, IdRolEquipo = @IdRolEquipo,
                        TipoIP = @TipoIP, Hostname = @Hostname, NumeroHost = @NumeroHost,
                        IP = @IP, Mascara = @Mascara, PuertaEnlace = @PuertaEnlace,
                        DNS1 = @DNS1, DNS2 = @DNS2,
                        UsuarioAdmin = @UsuarioAdmin, PasswordAdmin = @PasswordAdmin
                        WHERE IdEquipo = @IdEquipo`);
        } else {
            await new sql.Request(tx)
                .input('IdEquipo', sql.Int, idEquipo)
                .input('IdPiso', sql.Int, idPisoDestino)
                .query(`UPDATE Equipos SET IdPiso = @IdPiso WHERE IdEquipo = @IdEquipo`);
        }

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipo)
            .query('DELETE FROM PlanoUbicaciones WHERE IdEquipo = @IdEquipo');

        await new sql.Request(tx)
            .input('IdPiso', sql.Int, idPisoDestino)
            .input('IdEquipo', sql.Int, idEquipo)
            .input('Fila', sql.Int, fila)
            .input('Columna', sql.Int, columna)
            .query(`INSERT INTO PlanoUbicaciones (IdPiso, IdEquipo, Fila, Columna)
                    VALUES (@IdPiso, @IdEquipo, @Fila, @Columna)`);

        await tx.commit();

        const detalle = nuevosDatos
            ? `Movido y editado. De piso ${idPisoOrigen} a piso ${idPisoDestino}`
            : `Movido de piso ${idPisoOrigen} a piso ${idPisoDestino} (${fila}, ${columna})`;

        await historicos.registrar(idUsuario, idPisoDestino, idEquipo, 'CambioPiso', detalle,
            idPisoOrigen, idPisoDestino);

        return { ok: true, mensaje: 'Equipo movido a otro piso' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

async function swapEntrePisos(idUsuario, idEquipoA, idEquipoB,
                              idPisoA, filaA, colA, idPisoB, filaB, colB,
                              hostA, hostB) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoA)
            .input('IdPiso', sql.Int, idPisoB)
            .query(`UPDATE Equipos SET IdPiso = @IdPiso WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoB)
            .input('IdPiso', sql.Int, idPisoA)
            .query(`UPDATE Equipos SET IdPiso = @IdPiso WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoA)
            .query(`UPDATE PlanoUbicaciones SET Fila = -1, Columna = -1 WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoB)
            .query(`UPDATE PlanoUbicaciones SET Fila = -2, Columna = -2 WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoA)
            .input('IdPiso', sql.Int, idPisoB)
            .input('Fila', sql.Int, filaB)
            .input('Columna', sql.Int, colB)
            .query(`UPDATE PlanoUbicaciones 
                    SET IdPiso = @IdPiso, Fila = @Fila, Columna = @Columna
                    WHERE IdEquipo = @IdEquipo`);

        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipoB)
            .input('IdPiso', sql.Int, idPisoA)
            .input('Fila', sql.Int, filaA)
            .input('Columna', sql.Int, colA)
            .query(`UPDATE PlanoUbicaciones 
                    SET IdPiso = @IdPiso, Fila = @Fila, Columna = @Columna
                    WHERE IdEquipo = @IdEquipo`);

        await tx.commit();

        await historicos.registrar(idUsuario, idPisoA, idEquipoB, 'SwapPiso',
            `Intercambio con ${hostA}`, idPisoB, idPisoA);
        await historicos.registrar(idUsuario, idPisoB, idEquipoA, 'SwapPiso',
            `Intercambio con ${hostB}`, idPisoA, idPisoB);

        return { ok: true, mensaje: 'Equipos intercambiados entre pisos' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/* =========================================================
   ZONAS LIBRES
   ========================================================= */

async function listarZonasLibres(idPiso) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT IdZonaLibre, Nombre, Color, Fila, Columna
            FROM PlanoZonasLibres
            WHERE IdPiso = @IdPiso
            ORDER BY IdZonaLibre
        `);
    return r.recordset;
}

async function guardarZonaLibre(idUsuario, idPiso, nombre, color, celdas) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        await new sql.Request(tx)
            .input('IdPiso', sql.Int, idPiso)
            .input('Nombre', sql.NVarChar(100), nombre)
            .input('Color', sql.VarChar(20), color)
            .query(`DELETE FROM PlanoZonasLibres
                    WHERE IdPiso = @IdPiso AND Nombre = @Nombre AND Color = @Color`);

        for (const celda of celdas) {
            await new sql.Request(tx)
                .input('IdPiso', sql.Int, idPiso)
                .input('Nombre', sql.NVarChar(100), nombre)
                .input('Color', sql.VarChar(20), color)
                .input('Fila', sql.Int, celda.fila)
                .input('Columna', sql.Int, celda.columna)
                .query(`INSERT INTO PlanoZonasLibres (IdPiso, Nombre, Color, Fila, Columna)
                        VALUES (@IdPiso, @Nombre, @Color, @Fila, @Columna)`);
        }

        await tx.commit();
        await historicos.registrar(idUsuario, idPiso, null, 'ZonaLibre',
            `Zona libre "${nombre}" guardada con ${celdas.length} celda(s)`);
        return { ok: true, mensaje: 'Zona libre guardada' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

async function actualizarZonaLibre(idUsuario, idPiso, nombreActual, colorActual, nombre, color) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .input('NombreActual', sql.NVarChar(100), nombreActual)
        .input('ColorActual', sql.VarChar(20), colorActual)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Color', sql.VarChar(20), color)
        .query(`UPDATE PlanoZonasLibres
                SET Nombre = @Nombre, Color = @Color
                WHERE IdPiso = @IdPiso
                  AND Nombre = @NombreActual
                  AND ((@ColorActual IS NULL AND Color IS NULL) OR Color = @ColorActual)`);

    if (r.rowsAffected[0] === 0) {
        return { ok: false, mensaje: 'No se encontró la zona libre para actualizar' };
    }

    await historicos.registrar(idUsuario, idPiso, null, 'ZonaLibre',
        `Zona libre "${nombreActual}" actualizada a "${nombre}"`);
    return { ok: true, mensaje: 'Zona libre actualizada' };
}

async function eliminarZonaLibre(idUsuario, idPiso, nombre, color) {
    const pool = await getPool();
    await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Color', sql.VarChar(20), color)
        .query(`DELETE FROM PlanoZonasLibres
                WHERE IdPiso = @IdPiso AND Nombre = @Nombre AND Color = @Color`);

    await historicos.registrar(idUsuario, idPiso, null, 'ZonaLibre',
        `Zona libre "${nombre}" eliminada`);

    return { ok: true, mensaje: 'Zona libre eliminada' };
}

/* =========================================================
   ZONAS
   ========================================================= */

async function listarZonas(idPiso) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT IdZona, Nombre, Color, FilaInicio, FilaFin, ColumnaInicio, ColumnaFin
            FROM PlanoZonas WHERE IdPiso = @IdPiso ORDER BY IdZona
        `);
    return r.recordset;
}

async function crearZona(idUsuario, idPiso, nombre, color, fi, ff, ci, cf) {
    const pool = await getPool();
    await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Color', sql.VarChar(20), color)
        .input('FilaInicio', sql.Int, fi)
        .input('FilaFin', sql.Int, ff)
        .input('ColumnaInicio', sql.Int, ci)
        .input('ColumnaFin', sql.Int, cf)
        .query(`INSERT INTO PlanoZonas (IdPiso, Nombre, Color, FilaInicio, FilaFin, ColumnaInicio, ColumnaFin)
                VALUES (@IdPiso, @Nombre, @Color, @FilaInicio, @FilaFin, @ColumnaInicio, @ColumnaFin)`);

    await historicos.registrar(idUsuario, idPiso, null, 'CrearZona',
        `Zona "${nombre}" creada`);
    return { ok: true, mensaje: 'Zona creada' };
}

async function actualizarZona(idUsuario, idPiso, idZona, nombre, color, fi, ff, ci, cf) {
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

    await historicos.registrar(idUsuario, idPiso, null, 'EditarZona',
        `Zona "${nombre}" actualizada`);
    return { ok: true, mensaje: 'Zona actualizada' };
}

async function actualizarZonasPorNombre(idUsuario, idPiso, nombreActual, colorActual, nombre, color) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .input('NombreActual', sql.NVarChar(100), nombreActual)
        .input('ColorActual', sql.VarChar(20), colorActual)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Color', sql.VarChar(20), color)
        .query(`UPDATE PlanoZonas
                SET Nombre = @Nombre, Color = @Color
                WHERE IdPiso = @IdPiso
                  AND Nombre = @NombreActual
                  AND ((@ColorActual IS NULL AND Color IS NULL) OR Color = @ColorActual)`);

    if (r.rowsAffected[0] === 0) {
        return { ok: false, mensaje: 'No se encontraron zonas para actualizar' };
    }

    await historicos.registrar(idUsuario, idPiso, null, 'EditarZona',
        `Zona "${nombreActual}" actualizada a "${nombre}" — ${r.rowsAffected[0]} registro(s)`);
    return { ok: true, mensaje: `Se actualizaron ${r.rowsAffected[0]} zonas` };
}

/* Eliminar zona por IdZona (una sola, se usa al editar una específica) */
async function eliminarZona(idUsuario, idPiso, idZona, nombre) {
    const pool = await getPool();
    await pool.request()
        .input('IdZona', sql.Int, idZona)
        .query('DELETE FROM PlanoZonas WHERE IdZona = @IdZona');

    await historicos.registrar(idUsuario, idPiso, null, 'EliminarZona',
        `Zona "${nombre}" eliminada`);
    return { ok: true, mensaje: 'Zona eliminada' };
}

/* Eliminar TODAS las zonas con el mismo Nombre+Color en un piso
   (sirve cuando se generaron varias 1×1 con el mismo nombre) */
async function eliminarZonasPorNombre(idUsuario, idPiso, nombre, color) {
    const pool = await getPool();

    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Color', sql.VarChar(20), color || null)
        .query(`
            DELETE FROM PlanoZonas
            WHERE IdPiso = @IdPiso
              AND Nombre = @Nombre
              AND (@Color IS NULL OR Color = @Color)
        `);

    await historicos.registrar(idUsuario, idPiso, null, 'EliminarZona',
        `Zona(s) "${nombre}" eliminada(s) — ${r.rowsAffected[0]} registro(s)`);

    return { ok: true, mensaje: `Se eliminaron ${r.rowsAffected[0]} zona(s)` };
}

async function listarEscenariosFuturos(idPiso) {
    const pool = await getPool();
    const result = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT E.IdEscenarioFuturo, E.Nombre, E.FechaCreacion
            FROM dbo.EscenariosPlanoFuturo E
            INNER JOIN dbo.EscenarioPlanoFuturoPisos EP
                ON EP.IdEscenarioFuturo = E.IdEscenarioFuturo
            WHERE EP.IdPiso = @IdPiso
            ORDER BY E.FechaCreacion DESC, E.Nombre
        `);
    return result.recordset;
}

async function crearEscenarioFuturo(idUsuario, idPisos, nombre) {
    const pisos = [...new Set((Array.isArray(idPisos) ? idPisos : [idPisos]).map(Number))];
    const etiqueta = String(nombre || '').trim();
    if (!pisos.length || pisos.some(piso => !Number.isInteger(piso) || piso <= 0) ||
        !etiqueta || etiqueta.length > 100) {
        return { ok: false, mensaje: 'Selecciona uno o más pisos y captura un nombre de hasta 100 caracteres.' };
    }
    const pisoBase = pisos[0];

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const pisoResult = await new sql.Request(tx)
            .query('SELECT IdPiso FROM dbo.Pisos WHERE Activo = 1');
        const pisosActivos = new Set(pisoResult.recordset.map(row => Number(row.IdPiso)));
        if (pisos.some(piso => !pisosActivos.has(piso))) {
            await tx.rollback();
            return { ok: false, mensaje: 'Uno o más pisos seleccionados no existen o están inactivos.' };
        }

        const escenarioResult = await new sql.Request(tx)
            .input('IdPiso', sql.Int, pisoBase)
            .input('Nombre', sql.NVarChar(100), etiqueta)
            .input('IdUsuario', sql.Int, idUsuario || null)
            .query(`
                INSERT INTO dbo.EscenariosPlanoFuturo (IdPiso, Nombre, IdUsuarioCreador)
                OUTPUT INSERTED.IdEscenarioFuturo
                VALUES (@IdPiso, @Nombre, @IdUsuario)
            `);
        const idEscenario = escenarioResult.recordset[0].IdEscenarioFuturo;

        for (const piso of pisos) {
            await new sql.Request(tx)
                .input('IdEscenarioFuturo', sql.Int, idEscenario)
                .input('IdPiso', sql.Int, piso)
                .query(`
                    INSERT INTO dbo.EscenarioPlanoFuturoPisos (IdEscenarioFuturo, IdPiso)
                    VALUES (@IdEscenarioFuturo, @IdPiso);

                    INSERT INTO dbo.EscenarioPlanoFuturoOriginal
                        (IdEscenarioFuturo, IdEquipo, IdPisoOriginal, FilaOriginal, ColumnaOriginal)
                    SELECT @IdEscenarioFuturo, IdEquipo, IdPiso, Fila, Columna
                    FROM dbo.PlanoUbicaciones
                    WHERE IdPiso = @IdPiso;

                    INSERT INTO dbo.EscenarioPlanoFuturoUbicaciones
                        (IdEscenarioFuturo, IdEquipo, IdPiso, Fila, Columna)
                    SELECT IdEscenarioFuturo, IdEquipo, IdPisoOriginal, FilaOriginal, ColumnaOriginal
                    FROM dbo.EscenarioPlanoFuturoOriginal
                    WHERE IdEscenarioFuturo = @IdEscenarioFuturo
                      AND IdPisoOriginal = @IdPiso;
                `);
        }
        await tx.commit();
        return {
            ok: true,
            id: idEscenario,
            mensaje: `Copia futura creada para ${pisos.length} piso(s) desde el plano actual.`
        };
    } catch (error) {
        try {
            await tx.rollback();
        } catch (rollbackError) {
            console.error('[Plano] Error al revertir la copia futura:', rollbackError);
        }
        if (error.number === 2627 || error.number === 2601) {
            return { ok: false, mensaje: 'Ya existe una propuesta con ese nombre para el piso inicial seleccionado.' };
        }
        throw error;
    }
}

async function obtenerUbicacionesFuturas(idEscenario, idPiso) {
    const pool = await getPool();
    const result = await pool.request()
        .input('IdEscenarioFuturo', sql.Int, idEscenario)
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT U.IdEquipo, O.FilaOriginal, O.ColumnaOriginal, U.Fila, U.Columna,
                   O.IdPisoOriginal, U.IdPiso AS IdPisoPropuesto,
                   Equipo.IdCliente, Equipo.IdPiso, Equipo.IdRolEquipo, Equipo.Hostname,
                   Equipo.TipoIP, Equipo.IP, Equipo.Mascara, Equipo.PuertaEnlace,
                   Equipo.DNS1, Equipo.DNS2, Equipo.UsuarioAdmin, Equipo.PasswordAdmin,
                   C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
                   R.Codigo AS RolCodigo, R.Nombre AS RolNombre,
                   DA.Descripcion AS DescripcionAdmin
            FROM dbo.EscenarioPlanoFuturoUbicaciones U
            INNER JOIN dbo.EscenariosPlanoFuturo E
                ON E.IdEscenarioFuturo = U.IdEscenarioFuturo
            INNER JOIN dbo.EscenarioPlanoFuturoPisos EP
                ON EP.IdEscenarioFuturo = U.IdEscenarioFuturo
               AND EP.IdPiso = U.IdPiso
            INNER JOIN dbo.EscenarioPlanoFuturoOriginal O
                ON O.IdEscenarioFuturo = U.IdEscenarioFuturo
               AND O.IdEquipo = U.IdEquipo
            INNER JOIN dbo.Equipos Equipo ON Equipo.IdEquipo = U.IdEquipo
            INNER JOIN dbo.Clientes C ON C.IdCliente = Equipo.IdCliente
            INNER JOIN dbo.RolesEquipo R ON R.IdRolEquipo = Equipo.IdRolEquipo
            LEFT JOIN dbo.DominiosAdmin DA
                ON DA.IdCliente = Equipo.IdCliente
               AND DA.Usuario = Equipo.UsuarioAdmin
            WHERE U.IdEscenarioFuturo = @IdEscenarioFuturo
              AND EP.IdPiso = @IdPiso
            ORDER BY U.Fila, U.Columna
        `);
    return result.recordset;
}

async function moverEquipoEnEscenarioFuturo(idEscenario, idEquipo, idPisoDestino, fila, columna) {
    const escenario = Number(idEscenario);
    const equipo = Number(idEquipo);
    const pisoDestino = Number(idPisoDestino);
    const destinoFila = Number(fila);
    const destinoColumna = Number(columna);
    if (![escenario, equipo, pisoDestino, destinoFila, destinoColumna].every(Number.isInteger) ||
        escenario <= 0 || equipo <= 0 || pisoDestino <= 0 || destinoFila <= 0 || destinoColumna <= 0) {
        return { ok: false, mensaje: 'La propuesta o la posición seleccionada no son válidas.' };
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const validacion = await new sql.Request(tx)
            .input('IdEscenarioFuturo', sql.Int, escenario)
            .input('IdEquipo', sql.Int, equipo)
            .input('IdPisoDestino', sql.Int, pisoDestino)
            .query(`
                SELECT U.IdPiso AS IdPisoOrigen, U.Fila AS FilaOrigen,
                       U.Columna AS ColumnaOrigen, P.Filas, P.Columnas
                FROM dbo.EscenariosPlanoFuturo E WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN dbo.EscenarioPlanoFuturoUbicaciones U
                    ON U.IdEscenarioFuturo = E.IdEscenarioFuturo
                INNER JOIN dbo.EscenarioPlanoFuturoPisos EP
                    ON EP.IdEscenarioFuturo = E.IdEscenarioFuturo
                   AND EP.IdPiso = @IdPisoDestino
                INNER JOIN dbo.Pisos P ON P.IdPiso = EP.IdPiso
                WHERE E.IdEscenarioFuturo = @IdEscenarioFuturo
                  AND U.IdEquipo = @IdEquipo
            `);
        const actual = validacion.recordset[0];
        if (!actual) {
            await tx.rollback();
            return { ok: false, mensaje: 'El equipo no pertenece a esta propuesta futura.' };
        }
        if (destinoFila > actual.Filas || destinoColumna > actual.Columnas) {
            await tx.rollback();
            return { ok: false, mensaje: 'La posición destino está fuera de las dimensiones del piso.' };
        }

        const pisoOrigen = Number(actual.IdPisoOrigen);
        const destino = await new sql.Request(tx)
            .input('IdEscenarioFuturo', sql.Int, escenario)
            .input('IdPiso', sql.Int, pisoDestino)
            .input('Fila', sql.Int, destinoFila)
            .input('Columna', sql.Int, destinoColumna)
            .query(`
                SELECT IdEquipo
                FROM dbo.EscenarioPlanoFuturoUbicaciones WITH (UPDLOCK, HOLDLOCK)
                WHERE IdEscenarioFuturo = @IdEscenarioFuturo
                  AND IdPiso = @IdPiso
                  AND Fila = @Fila AND Columna = @Columna
            `);
        const equipoDestino = destino.recordset[0]?.IdEquipo;
        if (Number(equipoDestino) === equipo && pisoOrigen === pisoDestino) {
            await tx.commit();
            return { ok: true, mensaje: 'El equipo ya está en esa posición.' };
        }

        const filaTemporal = await new sql.Request(tx)
            .input('IdEscenarioFuturo', sql.Int, escenario)
            .input('IdPiso', sql.Int, pisoOrigen)
            .query(`
                SELECT ISNULL(MAX(Fila), 0) + 1 AS FilaTemporal
                FROM dbo.EscenarioPlanoFuturoUbicaciones
                WHERE IdEscenarioFuturo = @IdEscenarioFuturo AND IdPiso = @IdPiso
            `);
        const temporal = filaTemporal.recordset[0].FilaTemporal;
        await new sql.Request(tx)
            .input('IdEscenarioFuturo', sql.Int, escenario)
            .input('IdEquipo', sql.Int, equipo)
            .input('IdPiso', sql.Int, pisoOrigen)
            .input('Fila', sql.Int, temporal)
            .query(`
                UPDATE dbo.EscenarioPlanoFuturoUbicaciones
                SET IdPiso = @IdPiso, Fila = @Fila, Columna = 1
                WHERE IdEscenarioFuturo = @IdEscenarioFuturo AND IdEquipo = @IdEquipo
            `);

        if (equipoDestino) {
            await new sql.Request(tx)
                .input('IdEscenarioFuturo', sql.Int, escenario)
                .input('IdEquipo', sql.Int, equipoDestino)
                .input('IdPiso', sql.Int, pisoOrigen)
                .input('Fila', sql.Int, actual.FilaOrigen)
                .input('Columna', sql.Int, actual.ColumnaOrigen)
                .query(`
                    UPDATE dbo.EscenarioPlanoFuturoUbicaciones
                    SET IdPiso = @IdPiso, Fila = @Fila, Columna = @Columna
                    WHERE IdEscenarioFuturo = @IdEscenarioFuturo AND IdEquipo = @IdEquipo
                `);
        }

        await new sql.Request(tx)
            .input('IdEscenarioFuturo', sql.Int, escenario)
            .input('IdEquipo', sql.Int, equipo)
            .input('IdPiso', sql.Int, pisoDestino)
            .input('Fila', sql.Int, destinoFila)
            .input('Columna', sql.Int, destinoColumna)
            .query(`
                UPDATE dbo.EscenarioPlanoFuturoUbicaciones
                SET IdPiso = @IdPiso, Fila = @Fila, Columna = @Columna
                WHERE IdEscenarioFuturo = @IdEscenarioFuturo AND IdEquipo = @IdEquipo
            `);

        await tx.commit();
        return {
            ok: true,
            mensaje: pisoOrigen === pisoDestino
                ? 'Movimiento guardado en la propuesta futura.'
                : 'Cambio de piso guardado en la propuesta futura.'
        };
    } catch (error) {
        try {
            await tx.rollback();
        } catch (rollbackError) {
            console.error('[Plano] Error al revertir el movimiento futuro:', rollbackError);
        }
        throw error;
    }
}

async function eliminarEscenarioFuturo(idEscenario, idPiso) {
    const pool = await getPool();
    const result = await pool.request()
        .input('IdEscenarioFuturo', sql.Int, idEscenario)
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            DELETE FROM dbo.EscenariosPlanoFuturo
            WHERE IdEscenarioFuturo = @IdEscenarioFuturo
              AND EXISTS (
                  SELECT 1
                  FROM dbo.EscenarioPlanoFuturoPisos EP
                  WHERE EP.IdEscenarioFuturo = @IdEscenarioFuturo
                    AND EP.IdPiso = @IdPiso
              )
        `);
    return result.rowsAffected[0]
        ? { ok: true, mensaje: 'Propuesta futura eliminada.' }
        : { ok: false, mensaje: 'La propuesta no existe para el piso seleccionado.' };
}

module.exports = {
    obtenerDimensiones, actualizarDimensiones,
    listarPorLugar, equiposSinUbicacion,
    asignar, mover, quitar, intercambiar,
    moverEntrePisos, swapEntrePisos,
    listarZonas, crearZona, actualizarZona, eliminarZona, eliminarZonasPorNombre,
    listarZonasLibres, guardarZonaLibre, actualizarZonaLibre, eliminarZonaLibre,
    actualizarZonasPorNombre,
    listarEscenariosFuturos, crearEscenarioFuturo, obtenerUbicacionesFuturas,
    moverEquipoEnEscenarioFuturo, eliminarEscenarioFuturo
};