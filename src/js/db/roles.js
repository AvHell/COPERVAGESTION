const { getPool, sql } = require('./conexion');

/* Color oliva de la paleta: único valor por defecto de la capa de datos.
   Debe coincidir con el que muestran los formularios (roles.html). */
const COLOR_DEFECTO = '#6E7B5B';

let columnasColorPromise = null;

async function asegurarColumnaColor() {
    if (!columnasColorPromise) {
        columnasColorPromise = getPool().then(pool => pool.request().query(`
            IF COL_LENGTH(N'dbo.RolesEquipo', N'ColorHex') IS NULL
                ALTER TABLE dbo.RolesEquipo ADD ColorHex VARCHAR(7) NULL;

            /* Los roles creados antes de existir la columna (o guardados sin
               color) quedaban sin color: la tabla los pintaba en gris mientras
               el formulario mostraba el oliva por defecto. Se igualan aquí. */
            UPDATE dbo.RolesEquipo
               SET ColorHex = '${COLOR_DEFECTO}'
             WHERE ColorHex IS NULL
                OR LTRIM(RTRIM(ColorHex)) = ''
                OR LEN(LTRIM(RTRIM(ColorHex))) <> 7;
        `)).catch(error => {
            columnasColorPromise = null;
            throw error;
        });
    }
    return columnasColorPromise;
}

function validarColor(color) {
    const valor = String(color || '').trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(valor)) {
        throw new Error('El color debe ser un código hexadecimal válido de 6 dígitos.');
    }
    return valor;
}

/* =========================================================
   LISTAR
   ========================================================= */
async function listar() {
    await asegurarColumnaColor();
    const pool = await getPool();
    const result = await pool.request().query(
        'SELECT IdRolEquipo, Codigo, Nombre, Descripcion, ColorHex FROM RolesEquipo ORDER BY Codigo'
    );
    return result.recordset;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(codigo, nombre, descripcion, colorHex = COLOR_DEFECTO) {
    try {
        colorHex = validarColor(colorHex);
        await asegurarColumnaColor();
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
            .input('ColorHex', sql.VarChar(7), colorHex)
            .query('INSERT INTO RolesEquipo (Codigo, Nombre, Descripcion, ColorHex) VALUES (@Codigo, @Nombre, @Descripcion, @ColorHex)');

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
async function actualizar(id, codigo, nombre, descripcion, colorHex = COLOR_DEFECTO) {
    try {
        colorHex = validarColor(colorHex);
        await asegurarColumnaColor();
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
            .input('ColorHex', sql.VarChar(7), colorHex)
            .query('UPDATE RolesEquipo SET Codigo = @Codigo, Nombre = @Nombre, Descripcion = @Descripcion, ColorHex = @ColorHex WHERE IdRolEquipo = @IdRolEquipo');

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