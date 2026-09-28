const { getPool, sql } = require('./conexion');

async function registrar(idUsuario, idLugarCliente, idEquipo, accion, detalle,
                         idLugarOrigen = null, idLugarDestino = null) {
    const pool = await getPool();
    await pool.request()
        .input('IdUsuario', sql.Int, idUsuario)
        .input('IdLugarCliente', sql.Int, idLugarCliente)
        .input('IdLugarOrigen', sql.Int, idLugarOrigen)
        .input('IdLugarDestino', sql.Int, idLugarDestino)
        .input('IdEquipo', sql.Int, idEquipo)
        .input('Accion', sql.VarChar(30), accion)
        .input('Detalle', sql.NVarChar(500), detalle)
        .query(`INSERT INTO HistoricosPlano 
                (IdUsuario, IdLugarCliente, IdLugarOrigen, IdLugarDestino, IdEquipo, Accion, Detalle)
                VALUES 
                (@IdUsuario, @IdLugarCliente, @IdLugarOrigen, @IdLugarDestino, @IdEquipo, @Accion, @Detalle)`);
}

async function listarPorLugar(idLugarCliente) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdLugarCliente', sql.Int, idLugarCliente)
        .query(`
            SELECT H.IdHistorico, H.Accion, H.Detalle, H.Fecha,
                   U.NombreUsuario, U.Nombres, U.Apellidos,
                   E.Hostname,
                   LO.Nombre AS LugarOrigen,
                   LD.Nombre AS LugarDestino
            FROM HistoricosPlano H
            INNER JOIN Usuarios U ON U.IdUsuario = H.IdUsuario
            LEFT JOIN Equipos E ON E.IdEquipo = H.IdEquipo
            LEFT JOIN LugaresClientes LO ON LO.IdLugarCliente = H.IdLugarOrigen
            LEFT JOIN LugaresClientes LD ON LD.IdLugarCliente = H.IdLugarDestino
            WHERE H.IdLugarCliente = @IdLugarCliente
               OR H.IdLugarOrigen = @IdLugarCliente
               OR H.IdLugarDestino = @IdLugarCliente
            ORDER BY H.Fecha DESC
        `);
    return r.recordset;
}

module.exports = { registrar, listarPorLugar };