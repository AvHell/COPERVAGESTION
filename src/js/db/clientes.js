const { getPool, sql } = require('./conexion');

async function listar() {
    const pool = await getPool();
    const result = await pool.request().query(
        'SELECT IdCliente, Codigo, Nombre FROM Clientes ORDER BY Codigo'
    );
    return result.recordset;
}

async function crear(codigo, nombre) {
    const pool = await getPool();
    await pool.request()
        .input('Codigo', sql.VarChar(10), codigo)
        .input('Nombre', sql.NVarChar(150), nombre)
        .query('INSERT INTO Clientes (Codigo, Nombre) VALUES (@Codigo, @Nombre)');
    return { ok: true, mensaje: 'Cliente creado' };
}

async function actualizar(id, codigo, nombre) {
    const pool = await getPool();
    await pool.request()
        .input('IdCliente', sql.Int, id)
        .input('Codigo', sql.VarChar(10), codigo)
        .input('Nombre', sql.NVarChar(150), nombre)
        .query('UPDATE Clientes SET Codigo = @Codigo, Nombre = @Nombre WHERE IdCliente = @IdCliente');
    return { ok: true, mensaje: 'Cliente actualizado' };
}

async function eliminar(id) {
    const pool = await getPool();
    await pool.request()
        .input('IdCliente', sql.Int, id)
        .query('DELETE FROM Clientes WHERE IdCliente = @IdCliente');
    return { ok: true, mensaje: 'Cliente eliminado' };
}

module.exports = { listar, crear, actualizar, eliminar };