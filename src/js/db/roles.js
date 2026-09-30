const { getPool, sql } = require('./conexion');

/* =========================================================
   LISTAR
   ========================================================= */
async function listar() {
    const pool = await getPool();
    const result = await pool.request().query(
        'SELECT IdRolEquipo, Codigo, Nombre, Descripcion FROM RolesEquipo ORDER BY Codigo'
    );
    return result.recordset;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(codigo, nombre, descripcion) {
    try {
        const pool = await getPool();

        // Verificación explícita de duplicado
        const dup = await pool.request()
            .input('Codigo', sql.VarChar(10), codigo)
            .query('SELECT 1 FROM RolesEquipo WHERE Codigo = @Codigo');

        if (dup.recordset.length > 0) {
            return { ok: false, mensaje: `Ya existe un rol con el código "${codigo}".` };
        }

        await pool.request()
            .input('Codigo', sql.VarChar(10), codigo)
            .input('Nombre', sql.NVarChar(100), nombre)
            .input('Descripcion', sql.NVarChar(200), descripcion)
            .query('INSERT INTO RolesEquipo (Codigo, Nombre, Descripcion) VALUES (@Codigo, @Nombre, @Descripcion)');

        return { ok: true, mensaje: 'Rol creado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: `Ya existe un rol con el código "${codigo}".` };
        }
        return { ok: false, mensaje: 'Error al crear rol: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(id, codigo, nombre, descripcion) {
    try {
        const pool = await getPool();

        // Verificar duplicado en OTRO registro
        const dup = await pool.request()
            .input('IdRolEquipo', sql.Int, id)
            .input('Codigo', sql.VarChar(10), codigo)
            .query('SELECT 1 FROM RolesEquipo WHERE Codigo = @Codigo AND IdRolEquipo <> @IdRolEquipo');

        if (dup.recordset.length > 0) {
            return { ok: false, mensaje: `Ya existe otro rol con el código "${codigo}".` };
        }

        const result = await pool.request()
            .input('IdRolEquipo', sql.Int, id)
            .input('Codigo', sql.VarChar(10), codigo)
            .input('Nombre', sql.NVarChar(100), nombre)
            .input('Descripcion', sql.NVarChar(200), descripcion)
            .query('UPDATE RolesEquipo SET Codigo = @Codigo, Nombre = @Nombre, Descripcion = @Descripcion WHERE IdRolEquipo = @IdRolEquipo');

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El rol ya no existe.' };
        }

        return { ok: true, mensaje: 'Rol actualizado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: `Ya existe un rol con el código "${codigo}".` };
        }
        return { ok: false, mensaje: 'Error al actualizar rol: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(id) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('IdRolEquipo', sql.Int, id)
            .query('DELETE FROM RolesEquipo WHERE IdRolEquipo = @IdRolEquipo');

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El rol ya no existe.' };
        }

        return { ok: true, mensaje: 'Rol eliminado correctamente.' };
    } catch (err) {
        // FK (equipos que usen este rol)
        if (err.number === 547) {
            return {
                ok: false,
                mensaje: 'No se puede eliminar: hay equipos u otros registros asociados a este rol.'
            };
        }
        return { ok: false, mensaje: 'Error al eliminar rol: ' + err.message };
    }
}

module.exports = { listar, crear, actualizar, eliminar };