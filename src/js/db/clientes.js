const { getPool, sql } = require('./conexion');

/* =========================================================
   LISTAR
   ========================================================= */
async function listar() {
    const pool = await getPool();
    const result = await pool.request().query(
        'SELECT IdCliente, Codigo, Nombre FROM Clientes ORDER BY Codigo'
    );
    return result.recordset;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(codigo, nombre) {
    try {
        const pool = await getPool();

        // Verificación explícita de duplicado (opcional pero útil)
        const dup = await pool.request()
            .input('Codigo', sql.VarChar(10), codigo)
            .query('SELECT 1 FROM Clientes WHERE Codigo = @Codigo');

        if (dup.recordset.length > 0) {
            return { ok: false, mensaje: `Ya existe un cliente con el código "${codigo}".` };
        }

        await pool.request()
            .input('Codigo', sql.VarChar(10), codigo)
            .input('Nombre', sql.NVarChar(150), nombre)
            .query('INSERT INTO Clientes (Codigo, Nombre) VALUES (@Codigo, @Nombre)');

        return { ok: true, mensaje: 'Cliente creado correctamente.' };
    } catch (err) {
        // Violación de UNIQUE (por si dos sesiones coinciden)
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: `Ya existe un cliente con el código "${codigo}".` };
        }
        return { ok: false, mensaje: 'Error al crear cliente: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(id, codigo, nombre) {
    try {
        const pool = await getPool();

        // Verificar duplicado en OTRO registro
        const dup = await pool.request()
            .input('IdCliente', sql.Int, id)
            .input('Codigo', sql.VarChar(10), codigo)
            .query('SELECT 1 FROM Clientes WHERE Codigo = @Codigo AND IdCliente <> @IdCliente');

        if (dup.recordset.length > 0) {
            return { ok: false, mensaje: `Ya existe otro cliente con el código "${codigo}".` };
        }

        const result = await pool.request()
            .input('IdCliente', sql.Int, id)
            .input('Codigo', sql.VarChar(10), codigo)
            .input('Nombre', sql.NVarChar(150), nombre)
            .query('UPDATE Clientes SET Codigo = @Codigo, Nombre = @Nombre WHERE IdCliente = @IdCliente');

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El cliente ya no existe.' };
        }

        return { ok: true, mensaje: 'Cliente actualizado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: `Ya existe un cliente con el código "${codigo}".` };
        }
        return { ok: false, mensaje: 'Error al actualizar cliente: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(id) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('IdCliente', sql.Int, id)
            .query('DELETE FROM Clientes WHERE IdCliente = @IdCliente');

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El cliente ya no existe.' };
        }

        return { ok: true, mensaje: 'Cliente eliminado correctamente.' };
    } catch (err) {
        // FK (por ejemplo si tiene pedidos asociados)
        if (err.number === 547) {
            return {
                ok: false,
                mensaje: 'No se puede eliminar: el cliente tiene registros asociados (pedidos, facturas, etc.).'
            };
        }
        return { ok: false, mensaje: 'Error al eliminar cliente: ' + err.message };
    }
}

module.exports = { listar, crear, actualizar, eliminar };