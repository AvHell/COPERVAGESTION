/* =========================================================
   ACTIVO FIJO — IMPORTACIÓN MASIVA POR PERIFÉRICO
   Layouts: Diademas, Cargadores, SSD NVMe Externo, SSD NVMe Interno
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   CONFIGURACIÓN DE LAYOUTS POR PERIFÉRICO
   ========================================================= */
const LAYOUTS = {
    diademas: {
        tipoNombre: 'DIADEMA',
        titulo: 'Diademas',
        estadoDefault: 'NUEVO',
        columnas: [
            { key: 'Marca',            etiqueta: 'Marca',            catalogo: 'marcas' },
            { key: 'Modelo',           etiqueta: 'Modelo',           catalogo: null },
            { key: 'NoSerie',          etiqueta: 'NoSerie',          catalogo: null, opcional: true },
            { key: 'Subtipo',          etiqueta: 'Tipo',             catalogo: 'subtipos', grupoSubtipo: 'DIADEMA' },
            { key: 'Sitio',            etiqueta: 'Sitio',            catalogo: 'sitios' },
            { key: 'Estatus',          etiqueta: 'Estatus',          catalogo: 'estatus' },
            { key: 'CarteraAsignado',  etiqueta: 'CarteraAsignado',  catalogo: 'carteras' }
        ],
        ejemplo: {
            Marca: 'LOGITECH',
            Modelo: 'H390',
            NoSerie: 'ABC123456',
            Subtipo: 'Alámbrico',
            Sitio: 'COPERVA',
            Estatus: 'DISPONIBLE',
            CarteraAsignado: 'NU'
        }
    },

    cargadores: {
        tipoNombre: 'CARGADOR',
        titulo: 'Cargadores',
        estadoDefault: 'NUEVO',
        columnas: [
            { key: 'Marca',            etiqueta: 'Marca',            catalogo: 'marcas' },
            { key: 'Modelo',           etiqueta: 'Modelo',           catalogo: null },
            { key: 'NoSerie',          etiqueta: 'NoSerie',          catalogo: null, opcional: true },
            { key: 'Subtipo',          etiqueta: 'Tipo',             catalogo: 'subtipos', grupoSubtipo: 'CARGADOR' },
            { key: 'Voltaje',          etiqueta: 'Voltaje',          catalogo: 'voltajes' },
            { key: 'Sitio',            etiqueta: 'Sitio',            catalogo: 'sitios' },
            { key: 'Estatus',          etiqueta: 'Estatus',          catalogo: 'estatus' },
            { key: 'CarteraAsignado',  etiqueta: 'CarteraAsignado',  catalogo: 'carteras' }
        ],
        ejemplo: {
            Marca: 'EPCOM',
            Modelo: 'POE-48V',
            NoSerie: 'CARG-001',
            Subtipo: 'Cargador Laptop',
            Voltaje: '12V 1A',
            Sitio: 'COPERVA',
            Estatus: 'DISPONIBLE',
            CarteraAsignado: 'NU'
        }
    },

    /* ===================================================
       SSD NVME EXTERNO
       - Clasificación forzada: EXTERNO
       - Se asigna a UsuarioAsignado
       - Lleva Tamaño y Capacidad (según tabla ActivoFijoTipos)
       =================================================== */
    ssd_nvme_externo: {
        tipoNombre: 'SSD NVME',
        titulo: 'SSD NVMe Externo',
        estadoDefault: 'NUEVO',
        clasificacionForzada: 'EXTERNO',
        columnas: [
            { key: 'Marca',            etiqueta: 'Marca',            catalogo: 'marcas' },
            { key: 'Modelo',           etiqueta: 'Modelo',           catalogo: null },
            { key: 'NoSerie',          etiqueta: 'NoSerie',          catalogo: null, opcional: true },
            { key: 'Tamanio',          etiqueta: 'Tamanio',          catalogo: 'tamanios' },
            { key: 'Capacidad',        etiqueta: 'Capacidad',        catalogo: 'capacidades' },
            { key: 'Sitio',            etiqueta: 'Sitio',            catalogo: 'sitios' },
            { key: 'Estatus',          etiqueta: 'Estatus',          catalogo: 'estatus' },
            { key: 'UsuarioAsignado',  etiqueta: 'UsuarioAsignado',  catalogo: null }
        ],
        ejemplo: {
            Marca: 'KINGSTON',
            Modelo: 'NV2',
            NoSerie: 'SSD-EXT-001',
            Tamanio: 'M.2 2280',
            Capacidad: '512 GB',
            Sitio: 'COPERVA',
            Estatus: 'ASIGNADO',
            UsuarioAsignado: 'Juan Pérez'
        }
    },

    /* ===================================================
       SSD NVME INTERNO
       - Clasificación forzada: INTERNO
       - Se asigna a CarteraAsignado
       - Lleva Tamaño y Capacidad (según tabla ActivoFijoTipos)
       =================================================== */
    ssd_nvme_interno: {
        tipoNombre: 'SSD NVME',
        titulo: 'SSD NVMe Interno',
        estadoDefault: 'NUEVO',
        clasificacionForzada: 'INTERNO',
        columnas: [
            { key: 'Marca',            etiqueta: 'Marca',            catalogo: 'marcas' },
            { key: 'Modelo',           etiqueta: 'Modelo',           catalogo: null },
            { key: 'NoSerie',          etiqueta: 'NoSerie',          catalogo: null, opcional: true },
            { key: 'Tamanio',          etiqueta: 'Tamanio',          catalogo: 'tamanios' },
            { key: 'Capacidad',        etiqueta: 'Capacidad',        catalogo: 'capacidades' },
            { key: 'Sitio',            etiqueta: 'Sitio',            catalogo: 'sitios' },
            { key: 'Estatus',          etiqueta: 'Estatus',          catalogo: 'estatus' },
            { key: 'CarteraAsignado',  etiqueta: 'CarteraAsignado',  catalogo: 'carteras' }
        ],
        ejemplo: {
            Marca: 'WESTERN DIGITAL',
            Modelo: 'SN570',
            NoSerie: 'SSD-INT-001',
            Tamanio: 'M.2 2280',
            Capacidad: '1 TB',
            Sitio: 'COPERVA',
            Estatus: 'STOCK',
            CarteraAsignado: 'NU'
        }
    }
};

/* =========================================================
   HELPERS
   ========================================================= */
function getLayout(clave) {
    const layout = LAYOUTS[clave];
    if (!layout) throw new Error(`Layout desconocido: ${clave}`);
    return layout;
}

async function getIdPorNombre(pool, tabla, pk, nombre) {
    if (!nombre) return null;
    const r = await pool.request()
        .input('Nombre', sql.NVarChar(100), String(nombre).trim().toUpperCase())
        .query(`SELECT ${pk} FROM ${tabla} WHERE UPPER(Nombre) = @Nombre`);
    return r.recordset[0]?.[pk] ?? null;
}

async function getIdSubtipoPorGrupoYNombre(pool, grupo, nombre) {
    if (!nombre || !grupo) return null;
    const r = await pool.request()
        .input('Grupo',  sql.NVarChar(50),  grupo)
        .input('Nombre', sql.NVarChar(100), String(nombre).trim().toUpperCase())
        .query(`SELECT IdSubtipo FROM ActivoFijoSubtipos
                WHERE UPPER(Grupo) = UPPER(@Grupo)
                  AND UPPER(Nombre) = @Nombre`);
    return r.recordset[0]?.IdSubtipo ?? null;
}

/* =========================================================
   LISTAR LAYOUTS DISPONIBLES
   ========================================================= */
function listarLayouts() {
    return Object.entries(LAYOUTS).map(([clave, layout]) => ({
        clave,
        titulo: layout.titulo,
        tipoNombre: layout.tipoNombre,
        columnas: layout.columnas.map(c => ({
            key: c.key,
            etiqueta: c.etiqueta,
            esCatalogo: !!c.catalogo,
            opcional: !!c.opcional
        }))
    }));
}

/* =========================================================
   OBTENER LAYOUT COMPLETO
   ========================================================= */
function obtenerLayout(clave) {
    const layout = getLayout(clave);

    const ejemploPorEtiqueta = {};
    layout.columnas.forEach(col => {
        ejemploPorEtiqueta[col.etiqueta] = layout.ejemplo[col.key] ?? '';
    });

    return {
        clave,
        titulo: layout.titulo,
        tipoNombre: layout.tipoNombre,
        columnas: layout.columnas.map(c => ({
            key: c.key,
            etiqueta: c.etiqueta,
            catalogo: c.catalogo || null,
            grupoSubtipo: c.grupoSubtipo || null,
            opcional: !!c.opcional
        })),
        ejemplo: ejemploPorEtiqueta
    };
}

/* =========================================================
   PROCESAR IMPORTACIÓN MASIVA
   ========================================================= */
async function importar(datos, idUsuario) {
    const { layout: claveLayout, filas } = datos;

    if (!claveLayout) return { ok: false, mensaje: 'Falta el layout.' };
    if (!Array.isArray(filas) || filas.length === 0) {
        return { ok: false, mensaje: 'No hay filas para importar.' };
    }

    const layout = getLayout(claveLayout);
    const pool   = await getPool();

    // Resolver IdTipo
    const IdTipo = await getIdPorNombre(pool, 'ActivoFijoTipos', 'IdTipo', layout.tipoNombre);
    if (!IdTipo) {
        return { ok: false, mensaje: `No existe el tipo "${layout.tipoNombre}" en el catálogo ActivoFijoTipos.` };
    }

    // Estados/estatus por defecto
    const IdEstadoDefault  = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado',  layout.estadoDefault || 'NUEVO');
    const IdEstatusDefault = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', 'STOCK');

    // Clasificación forzada (SSD Externo/Interno)
    let IdClasificacionForzada = null;
    if (layout.clasificacionForzada) {
        IdClasificacionForzada = await getIdPorNombre(
            pool,
            'ActivoFijoClasificaciones',
            'IdClasificacion',
            layout.clasificacionForzada
        );
        if (!IdClasificacionForzada) {
            return { ok: false, mensaje: `No existe la clasificación "${layout.clasificacionForzada}" en el catálogo.` };
        }
    }

    // Detectar columnas del layout
    const colSubtipo   = layout.columnas.find(c => c.key === 'Subtipo');
    const colVoltaje   = layout.columnas.find(c => c.key === 'Voltaje');
    const colTamanio   = layout.columnas.find(c => c.key === 'Tamanio');
    const colCapacidad = layout.columnas.find(c => c.key === 'Capacidad');
    const colUsuario   = layout.columnas.find(c => c.key === 'UsuarioAsignado');

    const insertados = [];
    const errores    = [];

    for (let i = 0; i < filas.length; i++) {
        const fila = filas[i];
        const numFila = i + 2;
        try {
            // Normalizar claves
            const filaNormalizada = {};
            Object.keys(fila).forEach(k => {
                filaNormalizada[k.trim()] = String(fila[k] ?? '').trim();
            });

            // Extraer valores
            const marcaNombre   = filaNormalizada['Marca'];
            const modelo        = filaNormalizada['Modelo'];
            const noSerie       = filaNormalizada['NoSerie'];
            const sitioNombre   = filaNormalizada['Sitio'];
            const estatusNombre = filaNormalizada['Estatus'] || filaNormalizada['Estado'];
            const carteraNombre = filaNormalizada['CarteraAsignado'];

            const subtipoNombre   = filaNormalizada['Tipo'] || filaNormalizada['Subtipo'];
            const voltajeNombre   = filaNormalizada['Voltaje'];
            const tamanioNombre   = filaNormalizada['Tamanio'] || filaNormalizada['Tamaño'];
            const capacidadNombre = filaNormalizada['Capacidad'];
            const usuarioAsignado = filaNormalizada['UsuarioAsignado'];

            // Validar mínimos
            if (!marcaNombre && !noSerie) {
                errores.push({ fila: numFila, mensaje: 'Fila sin Marca ni NoSerie.' });
                continue;
            }

            // Resolver FKs comunes
            const IdMarca   = await getIdPorNombre(pool, 'ActivoFijoMarcas',   'IdMarca',   marcaNombre);
            const IdSitio   = await getIdPorNombre(pool, 'ActivoFijoSitios',   'IdSitio',   sitioNombre);
            const IdCartera = await getIdPorNombre(pool, 'ActivoFijoCarteras', 'IdCartera', carteraNombre);
            const IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus',  'IdEstatus', estatusNombre);

            // Subtipo
            let IdSubtipo = null;
            if (colSubtipo) {
                IdSubtipo = await getIdSubtipoPorGrupoYNombre(pool, colSubtipo.grupoSubtipo, subtipoNombre);
                if (subtipoNombre && !IdSubtipo) {
                    errores.push({ fila: numFila, mensaje: `Subtipo "${subtipoNombre}" no existe en el grupo "${colSubtipo.grupoSubtipo}".` });
                    continue;
                }
            }

            // Voltaje
            let IdVoltaje = null;
            if (colVoltaje) {
                IdVoltaje = await getIdPorNombre(pool, 'ActivoFijoVoltajes', 'IdVoltaje', voltajeNombre);
                if (voltajeNombre && !IdVoltaje) {
                    errores.push({ fila: numFila, mensaje: `Voltaje "${voltajeNombre}" no existe en el catálogo.` });
                    continue;
                }
            }

            // Tamaño
            let IdTamanio = null;
            if (colTamanio) {
                IdTamanio = await getIdPorNombre(pool, 'ActivoFijoTamanios', 'IdTamanio', tamanioNombre);
                if (tamanioNombre && !IdTamanio) {
                    errores.push({ fila: numFila, mensaje: `Tamaño "${tamanioNombre}" no existe en el catálogo.` });
                    continue;
                }
            }

            // Capacidad
            let IdCapacidad = null;
            if (colCapacidad) {
                IdCapacidad = await getIdPorNombre(pool, 'ActivoFijoCapacidades', 'IdCapacidad', capacidadNombre);
                if (capacidadNombre && !IdCapacidad) {
                    errores.push({ fila: numFila, mensaje: `Capacidad "${capacidadNombre}" no existe en el catálogo.` });
                    continue;
                }
            }

            // Validar catálogos obligatorios
            if (marcaNombre && !IdMarca) {
                errores.push({ fila: numFila, mensaje: `Marca "${marcaNombre}" no existe en el catálogo.` });
                continue;
            }
            if (sitioNombre && !IdSitio) {
                errores.push({ fila: numFila, mensaje: `Sitio "${sitioNombre}" no existe en el catálogo.` });
                continue;
            }
            if (estatusNombre && !IdEstatus) {
                errores.push({ fila: numFila, mensaje: `Estatus "${estatusNombre}" no existe en el catálogo.` });
                continue;
            }
            if (carteraNombre && !IdCartera) {
                errores.push({ fila: numFila, mensaje: `Cartera "${carteraNombre}" no existe en el catálogo.` });
                continue;
            }

            // NoSerie duplicada
            if (noSerie) {
                const dup = await pool.request()
                    .input('NoSerie', sql.NVarChar(150), noSerie)
                    .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoSerie = @NoSerie');
                if (dup.recordset.length > 0) {
                    errores.push({ fila: numFila, mensaje: `NoSerie "${noSerie}" ya existe.` });
                    continue;
                }
            }

            // INSERT
            const result = await pool.request()
                .input('IdCartera',        sql.Int,           IdCartera              || null)
                .input('IdMarca',          sql.Int,           IdMarca                || null)
                .input('Modelo',           sql.NVarChar(150), modelo                 || null)
                .input('IdTipo',           sql.Int,           IdTipo)
                .input('NoSerie',          sql.NVarChar(150), noSerie                || null)
                .input('IdEstado',         sql.Int,           IdEstadoDefault)
                .input('IdEstatus',        sql.Int,           IdEstatus              || IdEstatusDefault)
                .input('IdSitio',          sql.Int,           IdSitio                || null)
                .input('IdSubtipo',        sql.Int,           IdSubtipo              || null)
                .input('IdVoltaje',        sql.Int,           IdVoltaje              || null)
                .input('IdTamanio',        sql.Int,           IdTamanio              || null)
                .input('IdCapacidad',      sql.Int,           IdCapacidad            || null)
                .input('IdClasificacion',  sql.Int,           IdClasificacionForzada || null)
                .input('UsuarioAsignado',  sql.NVarChar(200), usuarioAsignado        || null)
                .input('IdUsuario',        sql.Int,           idUsuario              || null)
                .query(`
                    INSERT INTO ActivoFijoEquipos (
                        IdCartera, IdMarca, Modelo, IdTipo, NoSerie,
                        IdEstado, IdEstatus, IdSitio, IdSubtipo, IdVoltaje,
                        IdTamanio, IdCapacidad, IdClasificacion, UsuarioAsignado,
                        IdUsuarioCreacion
                    ) VALUES (
                        @IdCartera, @IdMarca, @Modelo, @IdTipo, @NoSerie,
                        @IdEstado, @IdEstatus, @IdSitio, @IdSubtipo, @IdVoltaje,
                        @IdTamanio, @IdCapacidad, @IdClasificacion, @UsuarioAsignado,
                        @IdUsuario
                    );
                    SELECT SCOPE_IDENTITY() AS Id;
                `);

            insertados.push({
                fila: numFila,
                id: result.recordset[0].Id,
                noSerie,
                marca: marcaNombre
            });
        } catch (err) {
            errores.push({ fila: numFila, mensaje: err.message });
        }
    }

    return {
        ok: true,
        mensaje: `Importación finalizada. ${insertados.length} insertados, ${errores.length} errores.`,
        insertados,
        errores
    };
}

module.exports = {
    listarLayouts,
    obtenerLayout,
    importar
};