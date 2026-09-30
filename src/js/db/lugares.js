const { getPool, sql } = require('./conexion');

/* =========================================================
   LISTAR
   ========================================================= */
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

/* =========================================================
   CREAR
   ========================================================= */
async function crear(idCliente, nombre) {
    try {
        const pool = await getPool();

        // Verificar que el cliente exista
        const cli = await pool.request()
            .input('IdCliente', sql.Int, idCliente)
            .query('SELECT 1 FROM Clientes WHERE IdCliente = @IdCliente');

        if (cli.recordset.length === 0) {
            return { ok: false, mensaje: 'El cliente seleccionado no existe.' };
        }

        // Verificar duplicado (mismo cliente, mismo nombre)
        const dup = await pool.request()
            .input('IdCliente', sql.Int, idCliente)
            .input('Nombre', sql.NVarChar(100), nombre)
            .query('SELECT 1 FROM LugaresClientes WHERE IdCliente = @IdCliente AND Nombre = @Nombre');

        if (dup.recordset.length > 0) {
            return { ok: false, mensaje: `Ya existe un lugar con el nombre "${nombre}" para este cliente.` };
        }

        await pool.request()
            .input('IdCliente', sql.Int, idCliente)
            .input('Nombre', sql.NVarChar(100), nombre)
            .query('INSERT INTO LugaresClientes (IdCliente, Nombre) VALUES (@IdCliente, @Nombre)');

        return { ok: true, mensaje: 'Lugar creado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un lugar con ese nombre para este cliente.' };
        }
        return { ok: false, mensaje: 'Error al crear lugar: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(id, idCliente, nombre) {
    try {
        const pool = await getPool();

        // Verificar cliente
        const cli = await pool.request()
            .input('IdCliente', sql.Int, idCliente)
            .query('SELECT 1 FROM Clientes WHERE IdCliente = @IdCliente');

        if (cli.recordset.length === 0) {
            return { ok: false, mensaje: 'El cliente seleccionado no existe.' };
        }

        // Verificar duplicado en OTRO lugar
        const dup = await pool.request()
            .input('IdLugarCliente', sql.Int, id)
            .input('IdCliente', sql.Int, idCliente)
            .input('Nombre', sql.NVarChar(100), nombre)
            .query(`SELECT 1 FROM LugaresClientes
                    WHERE IdCliente = @IdCliente
                      AND Nombre = @Nombre
                      AND IdLugarCliente <> @IdLugarCliente`);

        if (dup.recordset.length > 0) {
            return { ok: false, mensaje: `Ya existe otro lugar con el nombre "${nombre}" para este cliente.` };
        }

        const result = await pool.request()
            .input('IdLugarCliente', sql.Int, id)
            .input('IdCliente', sql.Int, idCliente)
            .input('Nombre', sql.NVarChar(100), nombre)
            .query('UPDATE LugaresClientes SET IdCliente = @IdCliente, Nombre = @Nombre WHERE IdLugarCliente = @IdLugarCliente');

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El lugar ya no existe.' };
        }

        return { ok: true, mensaje: 'Lugar actualizado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un lugar con ese nombre para este cliente.' };
        }
        return { ok: false, mensaje: 'Error al actualizar lugar: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(id) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('IdLugarCliente', sql.Int, id)
            .query('DELETE FROM LugaresClientes WHERE IdLugarCliente = @IdLugarCliente');

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El lugar ya no existe.' };
        }

        return { ok: true, mensaje: 'Lugar eliminado correctamente.' };
    } catch (err) {
        if (err.number === 547) {
            return {
                ok: false,
                mensaje: 'No se puede eliminar: hay rangos, equipos o planos asociados a este lugar.'
            };
        }
        return { ok: false, mensaje: 'Error al eliminar lugar: ' + err.message };
    }
}

module.exports = { listar, crear, actualizar, eliminar };