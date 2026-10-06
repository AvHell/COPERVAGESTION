/* =========================================================
   ACTIVO FIJO — CATÁLOGOS (12 CRUDs en un solo módulo)
   Soft delete: se marca Activo = 0, no se borra
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   CONFIGURACIÓN DE LOS CATÁLOGOS
   ========================================================= */
const CATALOGOS = {
    /* ---------------------------------------------------
       CATÁLOGOS BASE
       --------------------------------------------------- */
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
            { nombre: 'Nombre',                  tipo: 'NVarChar', longitud: 100, requerido: true, unico: true },
            { nombre: 'GrupoSubtipo',            tipo: 'NVarChar', longitud: 50 },
            { nombre: 'RequiereResponsiva',      tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereIMEI',            tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereTelefono',        tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereSitio',           tipo: 'Bit',      default: 1 },
            { nombre: 'RequiereSubtipo',         tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereClasificacion',   tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereTamanio',         tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereCapacidad',       tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereVoltaje',         tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereUsuarioAsignado', tipo: 'Bit',      default: 0 },
            { nombre: 'RequierePrecio',          tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereEspecificaciones',tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereAccesorios',      tipo: 'Bit',      default: 0 }
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
    },

    /* ---------------------------------------------------
       CATÁLOGOS NUEVOS (periféricos)
       --------------------------------------------------- */
    sitios: {
        tabla: 'ActivoFijoSitios',
        pk:    'IdSitio',
        campos: [
            { nombre: 'Nombre',      tipo: 'NVarChar', longitud: 100, requerido: true, unico: true },
            { nombre: 'Descripcion', tipo: 'NVarChar', longitud: 200 }
        ]
    },
    subtipos: {
        tabla: 'ActivoFijoSubtipos',
        pk:    'IdSubtipo',
        campos: [
            { nombre: 'Grupo',       tipo: 'NVarChar', longitud: 50,  requerido: true, unico: false },
            { nombre: 'Nombre',      tipo: 'NVarChar', longitud: 100, requerido: true, unico: false },
            { nombre: 'Descripcion', tipo: 'NVarChar', longitud: 200 }
        ]
    },
    voltajes: {
        tabla: 'ActivoFijoVoltajes',
        pk:    'IdVoltaje',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    clasificaciones: {
        tabla: 'ActivoFijoClasificaciones',
        pk:    'IdClasificacion',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    tamanios: {
        tabla: 'ActivoFijoTamanios',
        pk:    'IdTamanio',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    capacidades: {
        tabla: 'ActivoFijoCapacidades',
        pk:    'IdCapacidad',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
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
   - filtros.soloEliminados = true  → Activo = 0
   - si no                          → Activo = 1
   ========================================================= */
async function listar(clave, filtros = {}) {
    const { tabla, pk } = getConfig(clave);
    const pool = await getPool();

    const where = filtros.soloEliminados ? 'WHERE Activo = 0' : 'WHERE Activo = 1';

    const result = await pool.request().query(
        `SELECT * FROM ${tabla} ${where} ORDER BY ${pk}`
    );
    return result.recordset;
}

/* =========================================================
   CREAR (Activo = 1 por default)
   ========================================================= */
async function crear(clave, datos) {
    try {
        const cfg = getConfig(clave);
        const pool = await getPool();

        // Validar duplicado en campo único (solo entre ACTIVOS)
        for (const campo of cfg.campos) {
            if (campo.unico && datos[campo.nombre] !== undefined) {
                const dup = await pool.request()
                    .input('Valor', tipoSql(campo.tipo, campo.longitud), datos[campo.nombre])
                    .query(`SELECT 1 FROM ${cfg.tabla} WHERE ${campo.nombre} = @Valor AND Activo = 1`);
                if (dup.recordset.length > 0) {
                    return { ok: false, mensaje: `Ya existe un registro activo con ${campo.nombre} = "${datos[campo.nombre]}".` };
                }
            }
        }

        // Validación especial: subtipos (Grupo + Nombre único entre activos)
        if (clave === 'subtipos') {
            const dup = await pool.request()
                .input('Grupo',  sql.NVarChar(50),  datos.Grupo)
                .input('Nombre', sql.NVarChar(100), datos.Nombre)
                .query(`SELECT 1 FROM ActivoFijoSubtipos WHERE Grupo = @Grupo AND Nombre = @Nombre AND Activo = 1`);
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un subtipo activo "${datos.Nombre}" en el grupo "${datos.Grupo}".` };
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

        // Forzar Activo = 1 al crear
        columnas.push('Activo');
        valores.push('1');

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

        // Validar duplicado en campo único (solo entre ACTIVOS, excluyendo el propio)
        for (const campo of cfg.campos) {
            if (campo.unico && datos[campo.nombre] !== undefined) {
                const dup = await pool.request()
                    .input('Valor', tipoSql(campo.tipo, campo.longitud), datos[campo.nombre])
                    .input('Id',    sql.Int, id)
                    .query(`SELECT 1 FROM ${cfg.tabla}
                            WHERE ${campo.nombre} = @Valor AND ${cfg.pk} <> @Id AND Activo = 1`);
                if (dup.recordset.length > 0) {
                    return { ok: false, mensaje: `Ya existe otro registro activo con ${campo.nombre} = "${datos[campo.nombre]}".` };
                }
            }
        }

        // Validación especial: subtipos
        if (clave === 'subtipos') {
            const dup = await pool.request()
                .input('Grupo',  sql.NVarChar(50),  datos.Grupo)
                .input('Nombre', sql.NVarChar(100), datos.Nombre)
                .input('Id',     sql.Int, id)
                .query(`SELECT 1 FROM ActivoFijoSubtipos
                        WHERE Grupo = @Grupo AND Nombre = @Nombre AND IdSubtipo <> @Id AND Activo = 1`);
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un subtipo activo "${datos.Nombre}" en el grupo "${datos.Grupo}".` };
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
   ELIMINAR (Soft delete) — Marca Activo = 0
   Valida que no esté en uso en el módulo de activos
   ========================================================= */
async function eliminar(clave, id) {
    try {
        const cfg = getConfig(clave);
        const pool = await getPool();

        // Validación de uso: si algún activo u otra entidad lo usa, no se puede dar de baja
        // Nota: NO bloqueamos la baja si está en uso. Solo la permitimos si Activo=1.
        // Si el usuario quiere bloqueo, se puede añadir después.

        const result = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                UPDATE ${cfg.tabla}
                SET Activo = 0
                WHERE ${cfg.pk} = @Id AND Activo = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El registro ya estaba dado de baja o no existe.' };
        }

        return { ok: true, mensaje: 'Registro dado de baja. Puedes verlo en la pestaña "Eliminados".' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al dar de baja: ' + err.message };
    }
}

/* =========================================================
   RESTAURAR — Saca de baja lógica (Activo = 0 → 1)
   ========================================================= */
async function restaurar(clave, id) {
    try {
        const cfg = getConfig(clave);
        const pool = await getPool();

        const result = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                UPDATE ${cfg.tabla}
                SET Activo = 1
                WHERE ${cfg.pk} = @Id AND Activo = 0
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El registro no está dado de baja o no existe.' };
        }

        return { ok: true, mensaje: 'Registro restaurado. Vuelve al listado activo.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al restaurar: ' + err.message };
    }
}

module.exports = { listar, crear, actualizar, eliminar, restaurar, CATALOGOS };