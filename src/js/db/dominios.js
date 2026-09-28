const { getPool, sql } = require('./conexion');

async function listarPorCliente(idCliente) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdCliente', sql.Int, idCliente)
        .query(`SELECT IdDominio, IdCliente, Usuario, Password, Descripcion
                FROM DominiosAdmin
                WHERE IdCliente = @IdCliente AND Activo = 1
                ORDER BY Usuario`);
    return r.recordset;
}

async function listarTodas(filtros = {}) {
    const pool = await getPool();
    const req = pool.request();

    let where = 'WHERE D.Activo = 1';

    if (filtros.idCliente) {
        where += ' AND D.IdCliente = @IdCliente';
        req.input('IdCliente', sql.Int, filtros.idCliente);
    }
    if (filtros.busqueda) {
        where += ' AND (D.Usuario LIKE @Busqueda OR D.Descripcion LIKE @Busqueda)';
        req.input('Busqueda', sql.NVarChar(200), `%${filtros.busqueda}%`);
    }

    const r = await req.query(`
        SELECT D.IdDominio, D.IdCliente, D.Usuario, D.Password, D.Descripcion, D.FechaCreacion,
               C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre
        FROM DominiosAdmin D
        INNER JOIN Clientes C ON C.IdCliente = D.IdCliente
        ${where}
        ORDER BY C.Codigo, D.Usuario
    `);
    return r.recordset;
}

async function crear(idCliente, usuario, password, descripcion) {
    const pool = await getPool();
    try {
        await pool.request()
            .input('IdCliente', sql.Int, idCliente)
            .input('Usuario', sql.NVarChar(100), usuario)
            .input('Password', sql.NVarChar(255), password)
            .input('Descripcion', sql.NVarChar(200), descripcion)
            .query(`INSERT INTO DominiosAdmin (IdCliente, Usuario, Password, Descripcion)
                    VALUES (@IdCliente, @Usuario, @Password, @Descripcion)`);
        return { ok: true, mensaje: 'Dominio agregado' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ese usuario ya existe para este cliente.' };
        }
        throw err;
    }
}

async function actualizar(id, usuario, password, descripcion) {
    const pool = await getPool();
    await pool.request()
        .input('IdDominio', sql.Int, id)
        .input('Usuario', sql.NVarChar(100), usuario)
        .input('Password', sql.NVarChar(255), password)
        .input('Descripcion', sql.NVarChar(200), descripcion)
        .query(`UPDATE DominiosAdmin
                SET Usuario = @Usuario, Password = @Password, Descripcion = @Descripcion
                WHERE IdDominio = @IdDominio`);
    return { ok: true, mensaje: 'Dominio actualizado' };
}

async function eliminar(id) {
    const pool = await getPool();
    await pool.request()
        .input('IdDominio', sql.Int, id)
        .query('UPDATE DominiosAdmin SET Activo = 0 WHERE IdDominio = @IdDominio');
    return { ok: true, mensaje: 'Dominio eliminado' };
}

module.exports = { listarPorCliente, listarTodas, crear, actualizar, eliminar };