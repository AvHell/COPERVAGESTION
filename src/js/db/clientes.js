const { getPool, sql } = require('./conexion');

/* Color oliva de la paleta: único valor por defecto de la capa de datos.
   Debe coincidir con el que muestran los formularios (clientes.html). */
const COLOR_DEFECTO = '#6E7B5B';

let columnasColorPromise = null;

async function asegurarColumnaColor() {
    if (!columnasColorPromise) {
        columnasColorPromise = getPool().then(pool => pool.request().query(`
            IF COL_LENGTH(N'dbo.Clientes', N'ColorHex') IS NULL
                ALTER TABLE dbo.Clientes ADD ColorHex VARCHAR(7) NULL;

            /* Los clientes creados antes de existir la columna (o guardados sin
               color) quedaban sin color: la tabla los pintaba en gris mientras
               el formulario mostraba el oliva por defecto. Se igualan aquí. */
            UPDATE dbo.Clientes
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
        'SELECT IdCliente, Codigo, Nombre, ColorHex FROM Clientes ORDER BY Codigo'
    );
    return result.recordset;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(codigo, nombre, colorHex = COLOR_DEFECTO) {
    try {
        colorHex = validarColor(colorHex);
        await asegurarColumnaColor();
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
            .input('ColorHex', sql.VarChar(7), colorHex)
            .query('INSERT INTO Clientes (Codigo, Nombre, ColorHex) VALUES (@Codigo, @Nombre, @ColorHex)');

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
async function actualizar(id, codigo, nombre, colorHex = COLOR_DEFECTO) {
    try {
        colorHex = validarColor(colorHex);
        await asegurarColumnaColor();
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
            .input('ColorHex', sql.VarChar(7), colorHex)
            .query('UPDATE Clientes SET Codigo = @Codigo, Nombre = @Nombre, ColorHex = @ColorHex WHERE IdCliente = @IdCliente');

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