const { getPool, sql } = require('./conexion');

async function listar() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT R.IdRangoIP, R.IdCliente, R.IdPiso,
               C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
               P.Nombre AS PisoNombre,
               R.Nombre, R.IPInicio, R.IPFin, R.Descripcion
        FROM RangosIP R
        INNER JOIN Clientes C ON C.IdCliente = R.IdCliente
        LEFT JOIN  Pisos P    ON P.IdPiso = R.IdPiso
        ORDER BY C.Codigo, P.Nombre, R.Nombre
    `);
    return result.recordset;
}

async function crear(idCliente, idPiso, nombre, ipInicio, ipFin, descripcion) {
    const pool = await getPool();
    await pool.request()
        .input('IdCliente',   sql.Int, idCliente)
        .input('IdPiso',      sql.Int, idPiso)
        .input('Nombre',      sql.NVarChar(100), nombre)
        .input('IPInicio',    sql.VarChar(45), ipInicio)
        .input('IPFin',       sql.VarChar(45), ipFin)
        .input('Descripcion', sql.NVarChar(200), descripcion)
        .query(`INSERT INTO RangosIP (IdCliente, IdPiso, Nombre, IPInicio, IPFin, Descripcion)
                VALUES (@IdCliente, @IdPiso, @Nombre, @IPInicio, @IPFin, @Descripcion)`);
    return { ok: true, mensaje: 'Rango creado' };
}

async function actualizar(id, idCliente, idPiso, nombre, ipInicio, ipFin, descripcion) {
    const pool = await getPool();
    await pool.request()
        .input('IdRangoIP',   sql.Int, id)
        .input('IdCliente',   sql.Int, idCliente)
        .input('IdPiso',      sql.Int, idPiso)
        .input('Nombre',      sql.NVarChar(100), nombre)
        .input('IPInicio',    sql.VarChar(45), ipInicio)
        .input('IPFin',       sql.VarChar(45), ipFin)
        .input('Descripcion', sql.NVarChar(200), descripcion)
        .query(`UPDATE RangosIP SET IdCliente = @IdCliente, IdPiso = @IdPiso,
                Nombre = @Nombre, IPInicio = @IPInicio, IPFin = @IPFin, Descripcion = @Descripcion
                WHERE IdRangoIP = @IdRangoIP`);
    return { ok: true, mensaje: 'Rango actualizado' };
}

async function eliminar(id) {
    const pool = await getPool();
    await pool.request()
        .input('IdRangoIP', sql.Int, id)
        .query('DELETE FROM RangosIP WHERE IdRangoIP = @IdRangoIP');
    return { ok: true, mensaje: 'Rango eliminado' };
}

module.exports = { listar, crear, actualizar, eliminar };