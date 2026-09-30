/* =========================================================
   ACTIVO FIJO — CATÁLOGOS (6 CRUDs en un solo módulo)
   Ajusta la ruta de conexion.js según tu estructura real.
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   CONFIGURACIÓN DE LOS 6 CATÁLOGOS
   Cada uno declara: tabla, PK, y columnas editables.
   ========================================================= */
const CATALOGOS = {
    marcas: {
        tabla: 'ActivoFijoMarcas',
        pk:    'IdMarca',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    },
    tipos: {
        tabla: 'ActivoFijoTipos',
        pk:    'IdTipo',
        campos: [
            { nombre: 'Nombre',              tipo: 'NVarChar', longitud: 100, requerido: true, unico: true },
            { nombre: 'RequiereResponsiva',  tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereIMEI',        tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereTelefono',    tipo: 'Bit',      default: 0 }
        ]
    },
    estados: {
        tabla: 'ActivoFijoEstados',
        pk:    'IdEstado',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    estatus: {
        tabla: 'ActivoFijoEstatus',
        pk:    'IdEstatus',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    carteras: {
        tabla: 'ActivoFijoCarteras',
        pk:    'IdCartera',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    },
    puestos: {
        tabla: 'ActivoFijoPuestos',
        pk:    'IdPuesto',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    }
};

/* =========================================================
   HELPERS INTERNOS
   ========================================================= */
function getConfig(clave) {
    const cfg = CATALOGOS[clave];
    if (!cfg) throw new Error(`Catálogo desconocido: ${clave}`);
    return cfg;
}

function tipoSql(tipo, longitud) {
    switch (tipo) {
        case 'NVarChar': return sql.NVarChar(longitud || 100);
        case 'Bit':      return sql.Bit;
        case 'Int':      return sql.Int;
        default:         throw new Error(`Tipo SQL no soportado: ${tipo}`);
    }
}

/* =========================================================
   LISTAR
   ========================================================= */
async function listar(clave) {
    const { tabla, pk } = getConfig(clave);
    const pool = await getPool();
    const result = await pool.request().query(
        `SELECT * FROM ${tabla} ORDER BY ${pk}`
    );
    return result.recordset;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(clave, datos) {
    try {
        const cfg = getConfig(clave);
        const pool = await getPool();

        // Validar duplicado en campo único
        for (const campo of cfg.campos) {
            if (campo.unico && datos[campo.nombre] !== undefined) {
                const dup = await pool.request()
                    .input('Valor', tipoSql(campo.tipo, campo.longitud), datos[campo.nombre])
                    .query(`SELECT 1 FROM ${cfg.tabla} WHERE ${campo.nombre} = @Valor`);
                if (dup.recordset.length > 0) {
                    return { ok: false, mensaje: `Ya existe un registro con ${campo.nombre} = "${datos[campo.nombre]}".` };
                }
            }
        }

        // Construir INSERT dinámico
        const columnas = [];
        const valores  = [];
        const request  = pool.request();
        cfg.campos.forEach((campo, i) => {
            const valor = datos[campo.nombre] !== undefined ? datos[campo.nombre] : campo.default;
            if (valor === undefined) return;
            const paramName = `p${i}`;
            request.input(paramName, tipoSql(campo.tipo, campo.longitud), valor);
            columnas.push(campo.nombre);
            valores.push(`@${paramName}`);
        });

        await request.query(
            `INSERT INTO ${cfg.tabla} (${columnas.join(', ')}) VALUES (${valores.join(', ')})`
        );

        return { ok: true, mensaje: 'Registro creado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un registro con ese valor único.' };
        }
        return { ok: false, mensaje: 'Error al crear: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(clave, id, datos) {
    try {
        const cfg = getConfig(clave);
        const pool = await getPool();

        // Validar duplicado en campo único (excluyendo el propio)
        for (const campo of cfg.campos) {
            if (campo.unico && datos[campo.nombre] !== undefined) {
                const dup = await pool.request()
                    .input('Valor', tipoSql(campo.tipo, campo.longitud), datos[campo.nombre])
                    .input('Id',    sql.Int, id)
                    .query(`SELECT 1 FROM ${cfg.tabla}
                            WHERE ${campo.nombre} = @Valor AND ${cfg.pk} <> @Id`);
                if (dup.recordset.length > 0) {
                    return { ok: false, mensaje: `Ya existe otro registro con ${campo.nombre} = "${datos[campo.nombre]}".` };
                }
            }
        }

        const sets     = [];
        const request  = pool.request();
        request.input('Id', sql.Int, id);

        cfg.campos.forEach((campo, i) => {
            if (datos[campo.nombre] === undefined) return;
            const paramName = `p${i}`;
            request.input(paramName, tipoSql(campo.tipo, campo.longitud), datos[campo.nombre]);
            sets.push(`${campo.nombre} = @${paramName}`);
        });

        if (sets.length === 0) {
            return { ok: false, mensaje: 'No hay campos para actualizar.' };
        }

        const result = await request.query(
            `UPDATE ${cfg.tabla} SET ${sets.join(', ')} WHERE ${cfg.pk} = @Id`
        );

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El registro ya no existe.' };
        }

        return { ok: true, mensaje: 'Registro actualizado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un registro con ese valor único.' };
        }
        return { ok: false, mensaje: 'Error al actualizar: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(clave, id) {
    try {
        const cfg = getConfig(clave);
        const pool = await getPool();
        const result = await pool.request()
            .input('Id', sql.Int, id)
            .query(`DELETE FROM ${cfg.tabla} WHERE ${cfg.pk} = @Id`);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El registro ya no existe.' };
        }

        return { ok: true, mensaje: 'Registro eliminado correctamente.' };
    } catch (err) {
        if (err.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar: el registro está siendo usado en otro módulo.' };
        }
        return { ok: false, mensaje: 'Error al eliminar: ' + err.message };
    }
}

module.exports = { listar, crear, actualizar, eliminar, CATALOGOS };