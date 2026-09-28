const { getPool, sql } = require('./conexion');

async function listar() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT L.IdLugarCliente, L.IdCliente, C.Codigo AS ClienteCodigo,
               C.Nombre AS ClienteNombre, L.Nombre
        FROM LugaresClientes L
        INNER JOIN Clientes C ON C.IdCliente = L.IdCliente
        ORDER BY C.Codigo, L.Nombre
    `);
    return result.recordset;
}

async function crear(idCliente, nombre) {
    const pool = await getPool();
    await pool.request()
        .input('IdCliente', sql.Int, idCliente)
        .input('Nombre', sql.NVarChar(100), nombre)
        .query('INSERT INTO LugaresClientes (IdCliente, Nombre) VALUES (@IdCliente, @Nombre)');
    return { ok: true, mensaje: 'Lugar creado' };
}

async function actualizar(id, idCliente, nombre) {
    const pool = await getPool();
    await pool.request()
        .input('IdLugarCliente', sql.Int, id)
        .input('IdCliente', sql.Int, idCliente)
        .input('Nombre', sql.NVarChar(100), nombre)
        .query('UPDATE LugaresClientes SET IdCliente = @IdCliente, Nombre = @Nombre WHERE IdLugarCliente = @IdLugarCliente');
    return { ok: true, mensaje: 'Lugar actualizado' };
}

async function eliminar(id) {
    const pool = await getPool();
    await pool.request()
        .input('IdLugarCliente', sql.Int, id)
        .query('DELETE FROM LugaresClientes WHERE IdLugarCliente = @IdLugarCliente');
    return { ok: true, mensaje: 'Lugar eliminado' };
}

module.exports = { listar, crear, actualizar, eliminar };