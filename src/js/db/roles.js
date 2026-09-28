const { getPool, sql } = require('./conexion');

async function listar() {
    const pool = await getPool();
    const result = await pool.request().query(
        'SELECT IdRolEquipo, Codigo, Nombre, Descripcion FROM RolesEquipo ORDER BY Codigo'
    );
    return result.recordset;
}

async function crear(codigo, nombre, descripcion) {
    const pool = await getPool();
    await pool.request()
        .input('Codigo', sql.VarChar(10), codigo)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Descripcion', sql.NVarChar(200), descripcion)
        .query('INSERT INTO RolesEquipo (Codigo, Nombre, Descripcion) VALUES (@Codigo, @Nombre, @Descripcion)');
    return { ok: true, mensaje: 'Rol creado' };
}

async function actualizar(id, codigo, nombre, descripcion) {
    const pool = await getPool();
    await pool.request()
        .input('IdRolEquipo', sql.Int, id)
        .input('Codigo', sql.VarChar(10), codigo)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('Descripcion', sql.NVarChar(200), descripcion)
        .query('UPDATE RolesEquipo SET Codigo = @Codigo, Nombre = @Nombre, Descripcion = @Descripcion WHERE IdRolEquipo = @IdRolEquipo');
    return { ok: true, mensaje: 'Rol actualizado' };
}

async function eliminar(id) {
    const pool = await getPool();
    await pool.request()
        .input('IdRolEquipo', sql.Int, id)
        .query('DELETE FROM RolesEquipo WHERE IdRolEquipo = @IdRolEquipo');
    return { ok: true, mensaje: 'Rol eliminado' };
}

module.exports = { listar, crear, actualizar, eliminar };