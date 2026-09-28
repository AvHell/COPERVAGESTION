const { getPool, sql } = require('./conexion');

/* =========================================================
   LISTAR POR CLIENTE Y TIPO
   ========================================================= */

async function listarPorClienteTipo(idCliente, tipo) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdCliente', sql.Int, idCliente)
        .input('Tipo', sql.VarChar(20), tipo)
        .query(`SELECT IdConfig, Tipo, Valor, Descripcion
                FROM ConfiguracionesRed
                WHERE IdCliente = @IdCliente AND Tipo = @Tipo AND Activo = 1
                ORDER BY Valor`);
    return r.recordset;
}

/* =========================================================
   LISTAR TODAS (con filtros opcionales)
   ========================================================= */

async function listarTodas(filtros = {}) {
    const pool = await getPool();
    const req = pool.request();

    let where = 'WHERE C.Activo = 1';

    if (filtros.idCliente) {
        where += ' AND C.IdCliente = @IdCliente';
        req.input('IdCliente', sql.Int, filtros.idCliente);
    }
    if (filtros.tipo) {
        where += ' AND C.Tipo = @Tipo';
        req.input('Tipo', sql.VarChar(20), filtros.tipo);
    }
    if (filtros.busqueda) {
        where += ' AND (C.Valor LIKE @Busqueda OR C.Descripcion LIKE @Busqueda)';
        req.input('Busqueda', sql.NVarChar(200), `%${filtros.busqueda}%`);
    }

    const r = await req.query(`
        SELECT C.IdConfig, C.IdCliente, C.Tipo, C.Valor, C.Descripcion, C.FechaCreacion,
               CL.Codigo AS ClienteCodigo, CL.Nombre AS ClienteNombre
        FROM ConfiguracionesRed C
        INNER JOIN Clientes CL ON CL.IdCliente = C.IdCliente
        ${where}
        ORDER BY CL.Codigo, C.Tipo, C.Valor
    `);
    return r.recordset;
}

/* =========================================================
   CREAR
   ========================================================= */

async function crear(idCliente, tipo, valor, descripcion) {
    const pool = await getPool();
    try {
        await pool.request()
            .input('IdCliente', sql.Int, idCliente)
            .input('Tipo', sql.VarChar(20), tipo)
            .input('Valor', sql.VarChar(45), valor)
            .input('Descripcion', sql.NVarChar(200), descripcion)
            .query(`INSERT INTO ConfiguracionesRed (IdCliente, Tipo, Valor, Descripcion)
                    VALUES (@IdCliente, @Tipo, @Valor, @Descripcion)`);
        return { ok: true, mensaje: 'Configuración agregada' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ese valor ya existe para este cliente y tipo.' };
        }
        throw err;
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */

async function actualizar(id, valor, descripcion) {
    const pool = await getPool();
    await pool.request()
        .input('IdConfig', sql.Int, id)
        .input('Valor', sql.VarChar(45), valor)
        .input('Descripcion', sql.NVarChar(200), descripcion)
        .query(`UPDATE ConfiguracionesRed
                SET Valor = @Valor, Descripcion = @Descripcion
                WHERE IdConfig = @IdConfig`);
    return { ok: true, mensaje: 'Configuración actualizada' };
}

/* =========================================================
   ELIMINAR (borrado lógico)
   ========================================================= */

async function eliminar(id) {
    const pool = await getPool();
    await pool.request()
        .input('IdConfig', sql.Int, id)
        .query('UPDATE ConfiguracionesRed SET Activo = 0 WHERE IdConfig = @IdConfig');
    return { ok: true, mensaje: 'Configuración eliminada' };
}

module.exports = { listarPorClienteTipo, listarTodas, crear, actualizar, eliminar };