/* =========================================================
   ACTIVO FIJO — IMPORTACIÓN MASIVA DINÁMICA
   src/ActivoFijo/consultas/importacion.js
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   HELPERS
   ========================================================= */
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
   CONSTRUIR LAYOUT DINÁMICO DESDE UN TIPO DE LA BD
   ========================================================= */
function construirLayout(tipo) {
    const columnas = [
        { key: 'Marca',   etiqueta: 'Marca',   catalogo: 'marcas' },
        { key: 'Modelo',  etiqueta: 'Modelo',  catalogo: null },
        { key: 'NoSerie', etiqueta: 'NoSerie', catalogo: null, opcional: true }
    ];

    if (tipo.RequiereIMEI) {
        columnas.push({ key: 'IMEI1', etiqueta: 'IMEI1', catalogo: null });
        columnas.push({ key: 'IMEI2', etiqueta: 'IMEI2', catalogo: null, opcional: true });
    }
    if (tipo.RequiereTelefono) {
        columnas.push({ key: 'NoTelefono', etiqueta: 'NoTelefono', catalogo: null });
    }
    if (tipo.RequiereSitio) {
        columnas.push({ key: 'Sitio', etiqueta: 'Sitio', catalogo: 'sitios' });
    }
    if (tipo.RequiereSubtipo) {
        columnas.push({ key: 'Subtipo', etiqueta: 'Subtipo', catalogo: 'subtipos', grupoSubtipo: tipo.GrupoSubtipo });
    }
    if (tipo.RequiereClasificacion) {
        columnas.push({ key: 'Clasificacion', etiqueta: 'Clasificacion', catalogo: 'clasificaciones' });
    }
    if (tipo.RequiereTamanio) {
        columnas.push({ key: 'Tamanio', etiqueta: 'Tamanio', catalogo: 'tamanios' });
    }
    if (tipo.RequiereCapacidad) {
        columnas.push({ key: 'Capacidad', etiqueta: 'Capacidad', catalogo: 'capacidades' });
    }
    if (tipo.RequiereVoltaje) {
        columnas.push({ key: 'Voltaje', etiqueta: 'Voltaje', catalogo: 'voltajes' });
    }
    if (tipo.RequiereUsuarioAsignado) {
        columnas.push({ key: 'UsuarioAsignado', etiqueta: 'UsuarioAsignado', catalogo: null });
    }
    if (tipo.RequierePrecio) {
        columnas.push({ key: 'PrecioActivo', etiqueta: 'Precio', catalogo: null });
    }
    if (tipo.RequiereEspecificaciones) {
        columnas.push({ key: 'Procesador', etiqueta: 'Procesador', catalogo: null });
        columnas.push({ key: 'MemoriaRAM', etiqueta: 'RAM', catalogo: null });
        columnas.push({ key: 'Almacenamiento', etiqueta: 'Almacenamiento', catalogo: null });
        columnas.push({ key: 'SistemaOperativo', etiqueta: 'S.O.', catalogo: null });
    }
    if (tipo.RequiereAccesorios) {
        columnas.push({ key: 'Accesorios', etiqueta: 'Accesorios', catalogo: null });
    }

    columnas.push({ key: 'Estatus', etiqueta: 'Estatus', catalogo: 'estatus' });
    columnas.push({ key: 'CarteraAsignado', etiqueta: 'Cartera', catalogo: 'carteras' });

    const ejemplo = {
        Marca: 'MARCA_EJEMPLO',
        Modelo: 'MODELO_EJEMPLO',
        NoSerie: 'SERIE123456'
    };

    columnas.forEach(c => {
        if (ejemplo[c.key] !== undefined) return;
        
        if (c.key === 'IMEI1') ejemplo[c.key] = '123456789012345';
        else if (c.key === 'IMEI2') ejemplo[c.key] = '';
        else if (c.key === 'NoTelefono') ejemplo[c.key] = '5512345678';
        else if (c.key === 'Sitio') ejemplo[c.key] = 'COPERVA';
        else if (c.key === 'Subtipo') ejemplo[c.key] = 'TIPO_EJEMPLO';
        else if (c.key === 'Clasificacion') ejemplo[c.key] = 'INTERNO';
        else if (c.key === 'Tamanio') ejemplo[c.key] = 'M.2 2280';
        else if (c.key === 'Capacidad') ejemplo[c.key] = '512 GB';
        else if (c.key === 'Voltaje') ejemplo[c.key] = '12V 1A';
        else if (c.key === 'UsuarioAsignado') ejemplo[c.key] = 'Juan Pérez';
        else if (c.key === 'PrecioActivo') ejemplo[c.key] = '1500.00';
        else if (c.key === 'Procesador') ejemplo[c.key] = 'Intel Core i5';
        else if (c.key === 'MemoriaRAM') ejemplo[c.key] = '8 GB';
        else if (c.key === 'Almacenamiento') ejemplo[c.key] = '256 GB SSD';
        else if (c.key === 'SistemaOperativo') ejemplo[c.key] = 'Windows 11';
        else if (c.key === 'Accesorios') ejemplo[c.key] = 'Cargador, Cable';
        else if (c.key === 'Estatus') ejemplo[c.key] = 'DISPONIBLE';
        else if (c.key === 'CarteraAsignado') ejemplo[c.key] = 'NU';
    });

    return {
        IdTipo: tipo.IdTipo,
        titulo: tipo.Nombre,
        tipoNombre: tipo.Nombre,
        columnas,
        ejemplo
    };
}

/* =========================================================
   LISTAR LAYOUTS DISPONIBLES (TODOS LOS TIPOS DE LA BD)
   ========================================================= */
async function listarLayouts() {
    const pool = await getPool();
    
    // Esta consulta trae TODOS los registros sin importar filtros
    const r = await pool.request().query('SELECT * FROM ActivoFijoTipos ORDER BY Nombre');

    // Log para que veas en la consola de Node cuántos encontró
    console.log(`[Importar] Tipos encontrados en la BD: ${r.recordset.length}`);

    return r.recordset.map(tipo => {
        const layout = construirLayout(tipo);
        return {
            clave: String(tipo.IdTipo),
            titulo: layout.titulo,
            tipoNombre: layout.tipoNombre,
            columnas: layout.columnas.map(c => ({
                key: c.key,
                etiqueta: c.etiqueta,
                esCatalogo: !!c.catalogo,
                opcional: !!c.opcional
            }))
        };
    });
}

/* =========================================================
   OBTENER LAYOUT COMPLETO
   ========================================================= */
async function obtenerLayout(clave) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdTipo', sql.Int, parseInt(clave, 10))
        .query('SELECT * FROM ActivoFijoTipos WHERE IdTipo = @IdTipo');

    if (r.recordset.length === 0) throw new Error(`Tipo no encontrado: ${clave}`);
    
    const tipo = r.recordset[0];
    const layout = construirLayout(tipo);

    const ejemploPorEtiqueta = {};
    layout.columnas.forEach(col => {
        ejemploPorEtiqueta[col.etiqueta] = layout.ejemplo[col.key] ?? '';
    });

    return {
        clave: String(tipo.IdTipo),
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
    const { layout: idTipoStr, filas } = datos;

    if (!idTipoStr) return { ok: false, mensaje: 'Falta el tipo de activo.' };
    if (!Array.isArray(filas) || filas.length === 0) return { ok: false, mensaje: 'No hay filas para importar.' };

    const pool   = await getPool();
    const IdTipo = parseInt(idTipoStr, 10);

    const layoutInfo = await obtenerLayout(idTipoStr);
    
    const IdEstadoDefault  = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', 'NUEVO');
    const IdEstatusDefault = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', 'STOCK');

    const insertados = [];
    const errores    = [];

    for (let i = 0; i < filas.length; i++) {
        const fila = filas[i];
        const numFila = i + 2;
        try {
            const filaNormalizada = {};
            Object.keys(fila).forEach(k => {
                filaNormalizada[k.trim()] = String(fila[k] ?? '').trim();
            });

            const marcaNombre   = filaNormalizada['Marca'];
            const modelo        = filaNormalizada['Modelo'];
            const noSerie       = filaNormalizada['NoSerie'];
            const sitioNombre   = filaNormalizada['Sitio'];
            const estatusNombre = filaNormalizada['Estatus'] || filaNormalizada['Estado'];
            const carteraNombre = filaNormalizada['Cartera'] || filaNormalizada['CarteraAsignado'];
            
            const imei1           = filaNormalizada['IMEI1'];
            const imei2           = filaNormalizada['IMEI2'];
            const noTelefono      = filaNormalizada['NoTelefono'];
            const subtipoNombre   = filaNormalizada['Subtipo'] || filaNormalizada['Tipo'];
            const clasificacionNombre = filaNormalizada['Clasificacion'];
            const tamanioNombre   = filaNormalizada['Tamanio'] || filaNormalizada['Tamaño'];
            const capacidadNombre = filaNormalizada['Capacidad'];
            const voltajeNombre   = filaNormalizada['Voltaje'];
            const usuarioAsignado = filaNormalizada['UsuarioAsignado'];
            const precioStr       = filaNormalizada['Precio'];
            const procesador      = filaNormalizada['Procesador'];
            const ram             = filaNormalizada['RAM'] || filaNormalizada['MemoriaRAM'];
            const almacenamiento  = filaNormalizada['Almacenamiento'];
            const so              = filaNormalizada['S.O.'] || filaNormalizada['SistemaOperativo'];
            const accesorios      = filaNormalizada['Accesorios'];

            if (!marcaNombre && !noSerie) {
                errores.push({ fila: numFila, mensaje: 'Fila sin Marca ni NoSerie.' });
                continue;
            }

            const IdMarca   = await getIdPorNombre(pool, 'ActivoFijoMarcas',   'IdMarca',   marcaNombre);
            const IdSitio   = await getIdPorNombre(pool, 'ActivoFijoSitios',   'IdSitio',   sitioNombre);
            const IdCartera = await getIdPorNombre(pool, 'ActivoFijoCarteras', 'IdCartera', carteraNombre);
            const IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus',  'IdEstatus', estatusNombre);
            const IdClasificacion = await getIdPorNombre(pool, 'ActivoFijoClasificaciones', 'IdClasificacion', clasificacionNombre);
            const IdTamanio = await getIdPorNombre(pool, 'ActivoFijoTamanios', 'IdTamanio', tamanioNombre);
            const IdCapacidad = await getIdPorNombre(pool, 'ActivoFijoCapacidades', 'IdCapacidad', capacidadNombre);
            const IdVoltaje = await getIdPorNombre(pool, 'ActivoFijoVoltajes', 'IdVoltaje', voltajeNombre);

            let IdSubtipo = null;
            const colSubtipo = layoutInfo.columnas.find(c => c.key === 'Subtipo');
            if (colSubtipo && subtipoNombre) {
                IdSubtipo = await getIdSubtipoPorGrupoYNombre(pool, colSubtipo.grupoSubtipo, subtipoNombre);
                if (!IdSubtipo) {
                    errores.push({ fila: numFila, mensaje: `Subtipo "${subtipoNombre}" no existe.` });
                    continue;
                }
            }

            if (marcaNombre && !IdMarca) {
                errores.push({ fila: numFila, mensaje: `Marca "${marcaNombre}" no existe.` });
                continue;
            }
            if (carteraNombre && !IdCartera) {
                errores.push({ fila: numFila, mensaje: `Cartera "${carteraNombre}" no existe.` });
                continue;
            }

            if (noSerie) {
                const dup = await pool.request()
                    .input('NoSerie', sql.NVarChar(150), noSerie)
                    .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoSerie = @NoSerie');
                if (dup.recordset.length > 0) {
                    errores.push({ fila: numFila, mensaje: `NoSerie "${noSerie}" ya existe.` });
                    continue;
                }
            }

            let precioNum = null;
            if (precioStr) {
                precioNum = parseFloat(precioStr.replace(/[^0-9.-]+/g, ""));
                if (isNaN(precioNum)) precioNum = null;
            }

            const result = await pool.request()
                .input('IdCartera',        sql.Int,           IdCartera              || null)
                .input('IdMarca',          sql.Int,           IdMarca                || null)
                .input('Modelo',           sql.NVarChar(150), modelo                 || null)
                .input('IdTipo',           sql.Int,           IdTipo)
                .input('NoSerie',          sql.NVarChar(150), noSerie                || null)
                .input('IMEI1',            sql.NVarChar(50),  imei1                  || null)
                .input('IMEI2',            sql.NVarChar(50),  imei2                  || null)
                .input('NoTelefono',       sql.NVarChar(50),  noTelefono             || null)
                .input('IdEstado',         sql.Int,           IdEstadoDefault)
                .input('IdEstatus',        sql.Int,           IdEstatus              || IdEstatusDefault)
                .input('IdSitio',          sql.Int,           IdSitio                || null)
                .input('IdSubtipo',        sql.Int,           IdSubtipo              || null)
                .input('IdClasificacion',  sql.Int,           IdClasificacion        || null)
                .input('IdTamanio',        sql.Int,           IdTamanio              || null)
                .input('IdCapacidad',      sql.Int,           IdCapacidad            || null)
                .input('IdVoltaje',        sql.Int,           IdVoltaje              || null)
                .input('UsuarioAsignado',  sql.NVarChar(200), usuarioAsignado        || null)
                .input('PrecioActivo',     sql.Decimal(18,2), precioNum              || null)
                .input('Procesador',       sql.NVarChar(150), procesador             || null)
                .input('MemoriaRAM',       sql.NVarChar(50),  ram                    || null)
                .input('Almacenamiento',   sql.NVarChar(50),  almacenamiento         || null)
                .input('SistemaOperativo', sql.NVarChar(100), so                     || null)
                .input('Accesorios',       sql.NVarChar(300), accesorios             || null)
                .input('IdUsuario',        sql.Int,           idUsuario              || null)
                .query(`
                    INSERT INTO ActivoFijoEquipos (
                        IdCartera, IdMarca, Modelo, IdTipo, NoSerie, IMEI1, IMEI2, NoTelefono,
                        IdEstado, IdEstatus, IdSitio, IdSubtipo, IdClasificacion, IdTamanio,
                        IdCapacidad, IdVoltaje, UsuarioAsignado, PrecioActivo, Procesador,
                        MemoriaRAM, Almacenamiento, SistemaOperativo, Accesorios, IdUsuarioCreacion
                    ) VALUES (
                        @IdCartera, @IdMarca, @Modelo, @IdTipo, @NoSerie, @IMEI1, @IMEI2, @NoTelefono,
                        @IdEstado, @IdEstatus, @IdSitio, @IdSubtipo, @IdClasificacion, @IdTamanio,
                        @IdCapacidad, @IdVoltaje, @UsuarioAsignado, @PrecioActivo, @Procesador,
                        @MemoriaRAM, @Almacenamiento, @SistemaOperativo, @Accesorios, @IdUsuario
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