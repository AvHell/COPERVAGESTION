const { getPool, sql } = require('./conexion');

/* =========================================================
   REGISTRAR (idéntico al que ya tenías)
   ========================================================= */
async function registrar(idUsuario, idPiso, idEquipo, accion, detalle,
                         idPisoOrigen = null, idPisoDestino = null) {
    const pool = await getPool();
    await pool.request()
        .input('IdUsuario',     sql.Int, idUsuario)
        .input('IdPiso',        sql.Int, idPiso)
        .input('IdPisoOrigen',  sql.Int, idPisoOrigen)
        .input('IdPisoDestino', sql.Int, idPisoDestino)
        .input('IdEquipo',      sql.Int, idEquipo)
        .input('Accion',        sql.VarChar(30), accion)
        .input('Detalle',       sql.NVarChar(500), detalle)
        .query(`
            INSERT INTO HistoricosPlano 
            (IdUsuario, IdPiso, IdPisoOrigen, IdPisoDestino, IdEquipo, Accion, Detalle)
            VALUES 
            (@IdUsuario, @IdPiso, @IdPisoOrigen, @IdPisoDestino, @IdEquipo, @Accion, @Detalle)
        `);
}

/* =========================================================
   LISTAR POR PISO (compatibilidad con lo que ya existía)
   ========================================================= */
async function listarPorPiso(idPiso) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT H.IdHistorico, H.Accion, H.Detalle, H.Fecha,
                   H.IdPiso, H.IdPisoOrigen, H.IdPisoDestino,
                   U.NombreUsuario, U.Nombres, U.Apellidos,
                   E.Hostname, E.IdCliente,
                   P.Nombre  AS NombrePisoBase,
                   PO.Nombre AS PisoOrigen,
                   PD.Nombre AS PisoDestino
            FROM HistoricosPlano H
            INNER JOIN Usuarios U ON U.IdUsuario = H.IdUsuario
            LEFT JOIN Equipos E  ON E.IdEquipo  = H.IdEquipo
            LEFT JOIN Pisos   P  ON P.IdPiso    = H.IdPiso
            LEFT JOIN Pisos   PO ON PO.IdPiso   = H.IdPisoOrigen
            LEFT JOIN Pisos   PD ON PD.IdPiso   = H.IdPisoDestino
            WHERE H.IdPiso        = @IdPiso
               OR H.IdPisoOrigen  = @IdPiso
               OR H.IdPisoDestino = @IdPiso
            ORDER BY H.Fecha DESC
        `);
    return r.recordset;
}

/* =========================================================
   LISTAR INTELIGENTE — filtra por cliente y, opcionalmente, por piso
   - idCliente: OBLIGATORIO en la práctica. Filtra por dueño del equipo.
   - idPiso: opcional. Si viene, restringe a ese piso (base / origen / destino).
   ========================================================= */
async function listar(idCliente, idPiso = null) {
    const pool = await getPool();
    const req = pool.request();

    req.input('IdCliente', sql.Int, idCliente);
    if (idPiso) req.input('IdPiso', sql.Int, idPiso);

    const filtroPiso = idPiso
        ? `AND (
                H.IdPiso        = @IdPiso
             OR H.IdPisoOrigen  = @IdPiso
             OR H.IdPisoDestino = @IdPiso
           )`
        : '';

    const r = await req.query(`
        SELECT H.IdHistorico, H.Accion, H.Detalle, H.Fecha,
               H.IdPiso, H.IdPisoOrigen, H.IdPisoDestino,
               U.NombreUsuario, U.Nombres, U.Apellidos,
               E.Hostname, E.IdCliente,
               P.Nombre  AS NombrePisoBase,
               PO.Nombre AS PisoOrigen,
               PD.Nombre AS PisoDestino
        FROM HistoricosPlano H
        INNER JOIN Usuarios U ON U.IdUsuario = H.IdUsuario
        INNER JOIN Equipos  E ON E.IdEquipo  = H.IdEquipo
        LEFT JOIN Pisos P  ON P.IdPiso  = H.IdPiso
        LEFT JOIN Pisos PO ON PO.IdPiso = H.IdPisoOrigen
        LEFT JOIN Pisos PD ON PD.IdPiso = H.IdPisoDestino
        WHERE E.IdCliente = @IdCliente
        ${filtroPiso}
        ORDER BY H.Fecha DESC
    `);
    return r.recordset;
}

module.exports = { registrar, listarPorPiso, listar };