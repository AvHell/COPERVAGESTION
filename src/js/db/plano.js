const { getPool, sql } = require('./conexion');
const historicos = require('./historicos');
const rangosDB = require('./rangos');

/* Aplica la misma norma de rangos IP que la página de Equipos: una IP estática
   debe caer dentro de un rango declarado por el cliente para ese perfil (o en
   un rango general del cliente). Devuelve { ok, rango } o { ok:false, ... }
   con el detalle necesario para avisar al usuario desde el plano. */
async function validarRangoEquipo(idCliente, idRolEquipo, ip) {
    const control = await rangosDB.validarIPEnRango(idCliente, idRolEquipo, ip);
    if (!control.ok) {
        return {
            ok: false,
            mensaje: control.mensaje || 'La IP está fuera del rango autorizado para el cliente y perfil.',
            tipo: 'ip-fuera-de-rango',
            detalle: control
        };
    }
    return { ok: true, rango: control.rango || null };
}

/* Normaliza la lista de celdas {fila, columna} que manda el renderer:
   descarta valores inválidos y duplicados para que una zona nunca guarde
   dos registros sobre la misma celda. Se ordena para que el resultado sea
   siempre el mismo y los historiales sean legibles. */
function normalizarCeldas(celdas) {
    const vistas = new Set();
    const limpias = [];

    for (const celda of Array.isArray(celdas) ? celdas : []) {
        const fila = Number(celda?.fila ?? celda?.Fila);
        const columna = Number(celda?.columna ?? celda?.Columna);
        if (!Number.isInteger(fila) || !Number.isInteger(columna) || fila < 1 || columna < 1) continue;

        const clave = `${fila}:${columna}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        limpias.push({ fila, columna });
    }

    return limpias.sort((a, b) => a.fila - b.fila || a.columna - b.columna);
}


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
    /* La edición de equipo desde el plano sigue la misma línea que la página de
       Equipos: la IP estática debe estar dentro de un rango declarado por el
       cliente. Se valida ANTES de abrir la transacción para no mover el equipo
       ni dejar cambios a medias cuando la IP no está autorizada. */
    let rangoAsignado = null;
    if (nuevosDatos && nuevosDatos.tipoIP === 'Estatica' && nuevosDatos.ip) {
        const controlRango = await validarRangoEquipo(
            nuevosDatos.idCliente, nuevosDatos.idRolEquipo, nuevosDatos.ip
        );
        if (!controlRango.ok) return controlRango;
        rangoAsignado = controlRango.rango ? controlRango.rango.IdRangoIP : null;
    }

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
                .input('IdRangoIP', sql.Int, rangoAsignado)
                .query(`UPDATE Equipos SET
                        IdCliente = @IdCliente, IdPiso = @IdPiso, IdRolEquipo = @IdRolEquipo,
                        TipoIP = @TipoIP, Hostname = @Hostname, NumeroHost = @NumeroHost,
                        IP = @IP, IdRangoIP = @IdRangoIP,
                        Mascara = @Mascara, PuertaEnlace = @PuertaEnlace,
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
    const nombreLimpio = String(nombre || '').trim();
    if (!nombreLimpio) return { ok: false, mensaje: 'El texto de la zona libre es obligatorio.' };
    if (!idPiso) return { ok: false, mensaje: 'Selecciona un piso antes de guardar la zona libre.' };

    const nuevas = normalizarCeldas(celdas);
    if (!nuevas.length) return { ok: false, mensaje: 'Selecciona al menos una celda libre.' };

    const pool = await getPool();

    /* Crear no debe borrar lo existente: si ya hay un grupo con el mismo
       Nombre+Color se avisa y se edita desde el punto correspondiente. */
    const existente = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .input('Nombre', sql.NVarChar(100), nombreLimpio)
        .input('Color', sql.VarChar(20), color)
        .query(`SELECT COUNT(*) AS Total FROM PlanoZonasLibres
                WHERE IdPiso = @IdPiso AND Nombre = @Nombre AND Color = @Color`);
    if ((existente.recordset[0]?.Total || 0) > 0) {
        return {
            ok: false,
            mensaje: `Ya existe la zona libre "${nombreLimpio}" con ese color. Edítala desde la lista de zonas.`
        };
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        for (const celda of nuevas) {
            await new sql.Request(tx)
                .input('IdPiso', sql.Int, idPiso)
                .input('Nombre', sql.NVarChar(100), nombreLimpio)
                .input('Color', sql.VarChar(20), color)
                .input('Fila', sql.Int, celda.fila)
                .input('Columna', sql.Int, celda.columna)
                .query(`INSERT INTO PlanoZonasLibres (IdPiso, Nombre, Color, Fila, Columna)
                        VALUES (@IdPiso, @Nombre, @Color, @Fila, @Columna)`);
        }

        await tx.commit();
        await historicos.registrar(idUsuario, idPiso, null, 'ZonaLibre',
            `Zona libre "${nombreLimpio}" guardada con ${nuevas.length} celda(s)`);
        return { ok: true, mensaje: 'Zona libre guardada' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/* Actualiza una zona libre completa: si llegan celdas se reemplaza el grupo
   (borra el anterior y vuelve a insertar) para que renombrar, recolorear y
   mover celdas sea una sola operación coherente. Si no llegan celdas solo se
   renombra/recolorea conservando las celdas existentes. */
async function actualizarZonaLibre(idUsuario, idPiso, nombreActual, colorActual, nombre, color, celdas) {
    const nombreLimpio = String(nombre || '').trim();
    const actualLimpio = String(nombreActual || '').trim();
    if (!nombreLimpio) return { ok: false, mensaje: 'El texto de la zona libre es obligatorio.' };
    if (!idPiso) return { ok: false, mensaje: 'Selecciona un piso antes de guardar la zona libre.' };

    const sinCambioDeGrupo =
        actualLimpio === nombreLimpio &&
        String(colorActual || '').toLowerCase() === String(color || '').toLowerCase();

    const nuevas = normalizarCeldas(celdas);
    const pool = await getPool();

    /* Renombrar/recolorear hacia un grupo que ya existe lo fusionaría sin
       avisar: se valida antes de tocar la BD (mismo criterio que guardarZona). */
    if (!sinCambioDeGrupo) {
        const colision = await pool.request()
            .input('IdPiso', sql.Int, idPiso)
            .input('Nombre', sql.NVarChar(100), nombreLimpio)
            .input('Color', sql.VarChar(20), color)
            .query(`SELECT COUNT(*) AS Total FROM PlanoZonasLibres
                    WHERE IdPiso = @IdPiso AND Nombre = @Nombre AND Color = @Color`);
        if ((colision.recordset[0]?.Total || 0) > 0) {
            return {
                ok: false,
                mensaje: `Ya existe otra zona libre "${nombreLimpio}" con ese color. Usa otro nombre o color.`
            };
        }
    }

    if (nuevas.length > 0) {
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx)
                .input('IdPiso', sql.Int, idPiso)
                .input('NombreActual', sql.NVarChar(100), actualLimpio)
                .input('ColorActual', sql.VarChar(20), colorActual || null)
                .query(`DELETE FROM PlanoZonasLibres
                        WHERE IdPiso = @IdPiso
                          AND Nombre = @NombreActual
                          AND (@ColorActual IS NULL OR Color = @ColorActual OR Color IS NULL)`);

            for (const celda of nuevas) {
                await new sql.Request(tx)
                    .input('IdPiso', sql.Int, idPiso)
                    .input('Nombre', sql.NVarChar(100), nombreLimpio)
                    .input('Color', sql.VarChar(20), color)
                    .input('Fila', sql.Int, celda.fila)
                    .input('Columna', sql.Int, celda.columna)
                    .query(`INSERT INTO PlanoZonasLibres (IdPiso, Nombre, Color, Fila, Columna)
                            VALUES (@IdPiso, @Nombre, @Color, @Fila, @Columna)`);
            }

            await tx.commit();
            await historicos.registrar(idUsuario, idPiso, null, 'ZonaLibre',
                `Zona libre "${actualLimpio}" actualizada a "${nombreLimpio}" (${nuevas.length} celda(s))`);
            return { ok: true, mensaje: 'Zona libre actualizada' };
        } catch (err) {
            await tx.rollback();
            throw err;
        }
    }

    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .input('NombreActual', sql.NVarChar(100), actualLimpio)
        .input('ColorActual', sql.VarChar(20), colorActual)
        .input('Nombre', sql.NVarChar(100), nombreLimpio)
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
        `Zona libre "${actualLimpio}" actualizada a "${nombreLimpio}"`);
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

/* Guarda una zona completa a partir de las celdas marcadas en el canvas.
   Se inserta UN registro 1×1 por celda (FilaInicio = FilaFin, etc.): así la
   zona abarca exactamente lo que el usuario marcó aunque el grupo no sea un
   rectángulo, y la llave del plano se calcula con las celdas reales.
   Si se recibe {nombres, colores} de la zona anterior se reemplaza el grupo. */
async function guardarZona(idUsuario, idPiso, anterior, nombre, color, celdas) {
    const nombreLimpio = String(nombre || '').trim();
    if (!nombreLimpio) return { ok: false, mensaje: 'El nombre de la zona es obligatorio.' };

    const nuevas = normalizarCeldas(celdas);
    if (!nuevas.length) return { ok: false, mensaje: 'Selecciona al menos una celda para la zona.' };
    if (!idPiso) return { ok: false, mensaje: 'Selecciona un piso antes de guardar la zona.' };

    const pool = await getPool();

    /* Al crear no se pisa una zona existente: si ya hay un grupo con el mismo
       Nombre+Color se avisa para que se edite en lugar de fusionarse sin querer. */
    if (!anterior?.nombre) {
        const existente = await pool.request()
            .input('IdPiso', sql.Int, idPiso)
            .input('Nombre', sql.NVarChar(100), nombreLimpio)
            .input('Color', sql.VarChar(20), color)
            .query(`SELECT COUNT(*) AS Total FROM PlanoZonas
                    WHERE IdPiso = @IdPiso AND Nombre = @Nombre AND Color = @Color`);
        if ((existente.recordset[0]?.Total || 0) > 0) {
            return {
                ok: false,
                mensaje: `Ya existe la zona "${nombreLimpio}" con ese color. Edítala desde las llaves o la lista de zonas.`
            };
        }
    } else if (
        String(anterior.nombre || '').trim() !== nombreLimpio ||
        String(anterior.color || '').toLowerCase() !== String(color || '').toLowerCase()
    ) {
        /* Renombrar/recolorear hacia un grupo que ya existe lo fusionaría: se avisa. */
        const colision = await pool.request()
            .input('IdPiso', sql.Int, idPiso)
            .input('Nombre', sql.NVarChar(100), nombreLimpio)
            .input('Color', sql.VarChar(20), color)
            .query(`SELECT COUNT(*) AS Total FROM PlanoZonas
                    WHERE IdPiso = @IdPiso AND Nombre = @Nombre AND Color = @Color`);
        if ((colision.recordset[0]?.Total || 0) > 0) {
            return {
                ok: false,
                mensaje: `Ya existe otra zona "${nombreLimpio}" con ese color. Usa otro nombre o color.`
            };
        }
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        if (anterior?.nombre) {
            await new sql.Request(tx)
                .input('IdPiso', sql.Int, idPiso)
                .input('NombreAnterior', sql.NVarChar(100), anterior.nombre)
                .input('ColorAnterior', sql.VarChar(20), anterior.color || null)
                .query(`DELETE FROM PlanoZonas
                        WHERE IdPiso = @IdPiso
                          AND Nombre = @NombreAnterior
                          AND (@ColorAnterior IS NULL OR Color = @ColorAnterior OR Color IS NULL)`);
        }

        for (const celda of nuevas) {
            await new sql.Request(tx)
                .input('IdPiso', sql.Int, idPiso)
                .input('Nombre', sql.NVarChar(100), nombreLimpio)
                .input('Color', sql.VarChar(20), color)
                .input('Fila', sql.Int, celda.fila)
                .input('Columna', sql.Int, celda.columna)
                .query(`INSERT INTO PlanoZonas (IdPiso, Nombre, Color, FilaInicio, FilaFin, ColumnaInicio, ColumnaFin)
                        VALUES (@IdPiso, @Nombre, @Color, @Fila, @Fila, @Columna, @Columna)`);
        }

        await tx.commit();
    } catch (err) {
        await tx.rollback();
        throw err;
    }

    if (anterior?.nombre) {
        await historicos.registrar(idUsuario, idPiso, null, 'EditarZona',
            `Zona "${anterior.nombre}" actualizada a "${nombreLimpio}" (${nuevas.length} celda(s))`);
        return { ok: true, mensaje: 'Zona actualizada' };
    }

    await historicos.registrar(idUsuario, idPiso, null, 'CrearZona',
        `Zona "${nombreLimpio}" creada con ${nuevas.length} celda(s)`);
    return { ok: true, mensaje: 'Zona creada' };
}

async function crearZona(idUsuario, idPiso, nombre, color, celdas) {
    return guardarZona(idUsuario, idPiso, null, nombre, color, celdas);
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

async function actualizarZonasPorNombre(idUsuario, idPiso, nombreActual, colorActual, nombre, color, celdas) {
    /* Con celdas se reemplaza el grupo completo (renombrar + recolorear +
       recolocar en una sola operación). Sin celdas solo se renombra. */
    if (Array.isArray(celdas) && celdas.length > 0) {
        return guardarZona(
            idUsuario, idPiso,
            { nombre: nombreActual, color: colorActual },
            nombre, color, celdas
        );
    }

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
                   U.DatosEquipoJson,
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

async function actualizarEquipoEnEscenarioFuturo(idEscenario, idEquipo, datos) {
    const escenario = Number(idEscenario);
    const equipo = Number(idEquipo);
    const idCliente = Number(datos?.idCliente);
    const idRolEquipo = Number(datos?.idRolEquipo);
    const idPiso = datos?.idPiso == null ? null : Number(datos.idPiso);
    const tipoIP = String(datos?.tipoIP || '').trim();
    const hostname = String(datos?.hostname || '').trim();

    if (![escenario, equipo, idCliente, idRolEquipo].every(Number.isInteger) ||
        escenario <= 0 || equipo <= 0 || idCliente <= 0 || idRolEquipo <= 0 ||
        (idPiso !== null && (!Number.isInteger(idPiso) || idPiso <= 0)) ||
        !['Estatica', 'DHCP'].includes(tipoIP) || !hostname || hostname.length > 50) {
        return { ok: false, mensaje: 'Los datos del equipo o de la propuesta no son válidos.' };
    }

    const normalizarCampo = (valor, nombre, maximo, requerido = false) => {
        const texto = String(valor ?? '').trim();
        if (requerido && !texto) throw new Error(`El campo ${nombre} es obligatorio.`);
        if (texto.length > maximo) throw new Error(`El campo ${nombre} supera el máximo de ${maximo} caracteres.`);
        return texto || null;
    };

    let cambios;
    try {
        const esEstatica = tipoIP === 'Estatica';
        const numeroHost = datos.numeroHost == null || datos.numeroHost === ''
            ? null
            : Number(datos.numeroHost);
        const idRangoIP = datos.idRangoIP == null || datos.idRangoIP === ''
            ? null
            : Number(datos.idRangoIP);
        if (numeroHost !== null && (!Number.isInteger(numeroHost) || numeroHost < 0)) {
            return { ok: false, mensaje: 'El número de host no es válido.' };
        }
        if (idRangoIP !== null && (!Number.isInteger(idRangoIP) || idRangoIP <= 0)) {
            return { ok: false, mensaje: 'El rango de IP no es válido.' };
        }
        cambios = {
            idCliente,
            idPiso,
            idRolEquipo,
            tipoIP,
            hostname,
            numeroHost,
            ip: esEstatica ? normalizarCampo(datos.ip, 'IP', 45, true) : null,
            idRangoIP,
            mascara: esEstatica ? normalizarCampo(datos.mascara, 'máscara', 45, true) : null,
            puertaEnlace: esEstatica ? normalizarCampo(datos.puertaEnlace, 'puerta de enlace', 45, true) : null,
            dns1: esEstatica ? normalizarCampo(datos.dns1, 'DNS 1', 45, true) : null,
            dns2: esEstatica ? normalizarCampo(datos.dns2, 'DNS 2', 45) : null,
            usuarioAdmin: normalizarCampo(datos.usuarioAdmin, 'usuario admin', 100, true),
            passwordAdmin: normalizarCampo(datos.passwordAdmin, 'password admin', 255, true),
            activo: datos.activo !== false
        };
    } catch (error) {
        return { ok: false, mensaje: error.message };
    }

    /* La propuesta futura se aplicará más adelante sobre Equipos, así que
       también debe respetar los rangos IP declarados: es mejor avisar aquí
       que descubrir la incoherencia al aplicar el escenario. */
    if (cambios.tipoIP === 'Estatica' && cambios.ip) {
        const controlRango = await validarRangoEquipo(cambios.idCliente, cambios.idRolEquipo, cambios.ip);
        if (!controlRango.ok) return controlRango;
        cambios.idRangoIP = controlRango.rango ? controlRango.rango.IdRangoIP : null;
    } else {
        cambios.idRangoIP = null;
    }

    const pool = await getPool();
    const validacion = await pool.request()
        .input('IdCliente', sql.Int, idCliente)
        .input('IdRolEquipo', sql.Int, idRolEquipo)
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT
                CASE WHEN EXISTS (SELECT 1 FROM dbo.Clientes WHERE IdCliente = @IdCliente)
                    THEN 1 ELSE 0 END AS ClienteValido,
                CASE WHEN EXISTS (SELECT 1 FROM dbo.RolesEquipo WHERE IdRolEquipo = @IdRolEquipo)
                    THEN 1 ELSE 0 END AS RolValido,
                CASE WHEN @IdPiso IS NULL OR EXISTS (SELECT 1 FROM dbo.Pisos WHERE IdPiso = @IdPiso AND Activo = 1)
                    THEN 1 ELSE 0 END AS PisoValido
        `);
    const referencias = validacion.recordset[0];
    if (!referencias.ClienteValido || !referencias.RolValido ||
        !referencias.PisoValido) {
        return { ok: false, mensaje: 'El cliente, rol o piso seleccionado no es válido para este equipo.' };
    }

    const result = await pool.request()
        .input('IdEscenarioFuturo', sql.Int, escenario)
        .input('IdEquipo', sql.Int, equipo)
        .input('DatosEquipoJson', sql.NVarChar(sql.MAX), JSON.stringify(cambios))
        .query(`
            UPDATE U
            SET DatosEquipoJson = @DatosEquipoJson
            FROM dbo.EscenarioPlanoFuturoUbicaciones U
            WHERE U.IdEscenarioFuturo = @IdEscenarioFuturo
              AND U.IdEquipo = @IdEquipo
              AND EXISTS (
                  SELECT 1
                  FROM dbo.EscenarioPlanoFuturoOriginal O
                  WHERE O.IdEscenarioFuturo = U.IdEscenarioFuturo
                    AND O.IdEquipo = U.IdEquipo
              )
        `);
    if (result.rowsAffected[0] !== 1) {
        return { ok: false, mensaje: 'El equipo ya no forma parte de esta propuesta.' };
    }
    return { ok: true, mensaje: 'Cambios guardados únicamente en la copia futura.' };
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
    listarZonas, crearZona, guardarZona, actualizarZona, eliminarZona, eliminarZonasPorNombre,
    listarZonasLibres, guardarZonaLibre, actualizarZonaLibre, eliminarZonaLibre,
    actualizarZonasPorNombre,
    listarEscenariosFuturos, crearEscenarioFuturo, obtenerUbicacionesFuturas,
    moverEquipoEnEscenarioFuturo, actualizarEquipoEnEscenarioFuturo, eliminarEscenarioFuturo
};