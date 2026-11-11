/* =========================================================
   ACTIVO FIJO — IMPORTACIÓN MASIVA DINÁMICA
   src/ActivoFijo/consultas/importacion.js
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');
const catalogosDB = require('./catalogos');

/* =========================================================
   HELPERS
   ========================================================= */
async function getIdPorNombre(pool, tabla, pk, nombre) {
    if (!nombre) return null;
    const r = await pool.request()
        .input('Nombre', sql.NVarChar(100), String(nombre).trim().toUpperCase())
        .query(`SELECT ${pk} FROM ${tabla} WHERE UPPER(Nombre) = @Nombre AND Activo = 1`);
    return r.recordset[0]?.[pk] ?? null;
}

async function getNombreCatalogo(pool, tabla, nombre) {
    if (!nombre) return null;
    const r = await pool.request()
        .input('Nombre', sql.NVarChar(300), String(nombre).trim())
        .query(`SELECT TOP 1 Nombre FROM ${tabla} WHERE UPPER(Nombre) = UPPER(@Nombre) AND Activo = 1`);
    return r.recordset[0]?.Nombre ?? null;
}

async function getIdSubtipoPorGrupoYNombre(pool, grupo, nombre) {
    if (!nombre || !grupo) return null;
    const r = await pool.request()
        .input('Grupo',  sql.NVarChar(50),  grupo)
        .input('Nombre', sql.NVarChar(100), String(nombre).trim().toUpperCase())
        .query(`SELECT IdSubtipo FROM ActivoFijoSubtipos
                WHERE UPPER(Grupo) = UPPER(@Grupo)
                  AND UPPER(Nombre) = @Nombre
                  AND Activo = 1`);
    return r.recordset[0]?.IdSubtipo ?? null;
}

/* =========================================================
   CONSTRUIR LAYOUT DINÁMICO DESDE UN TIPO DE LA BD
   ========================================================= */
function construirLayout(tipo) {
    const columnas = [
        { key: 'Marca',   etiqueta: 'Marca',   catalogo: 'marcas' },
        { key: 'Modelo',  etiqueta: 'Modelo',  catalogo: 'modelos' },
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
        columnas.push({ key: 'UsuarioAsignado', etiqueta: 'UsuarioAsignado', catalogo: 'usuariosAsignados' });
    }
    if (tipo.RequierePrecio) {
        columnas.push({ key: 'PrecioActivo', etiqueta: 'Precio', catalogo: null });
    }
    if (tipo.RequiereEspecificaciones) {
        columnas.push({ key: 'Procesador', etiqueta: 'Procesador', catalogo: 'procesadores' });
        columnas.push({ key: 'MemoriaRAM', etiqueta: 'RAM', catalogo: 'memoriasRam' });
        columnas.push({ key: 'Almacenamiento', etiqueta: 'Almacenamiento', catalogo: 'almacenamientos' });
        columnas.push({ key: 'SistemaOperativo', etiqueta: 'S.O.', catalogo: 'sistemasOperativos' });
    }
    if (tipo.RequiereAccesorios) {
        columnas.push({ key: 'Accesorios', etiqueta: 'Accesorios', catalogo: 'accesorios' });
    }

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
   LISTAR LAYOUTS DISPONIBLES (TIPOS ACTIVOS)
   ========================================================= */
async function listarLayouts() {
    await catalogosDB.asegurarCatalogosExtendidos();
    const pool = await getPool();
    
    const r = await pool.request().query('SELECT * FROM ActivoFijoTipos WHERE Activo = 1 ORDER BY Nombre');

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
    await catalogosDB.asegurarCatalogosExtendidos();
    const pool = await getPool();
    const r = await pool.request()
        .input('IdTipo', sql.Int, parseInt(clave, 10))
        .query('SELECT * FROM ActivoFijoTipos WHERE IdTipo = @IdTipo AND Activo = 1');

    if (r.recordset.length === 0) throw new Error(`Tipo no encontrado: ${clave}`);
    
    const tipo = r.recordset[0];
    const layout = construirLayout(tipo);
    for (const columna of layout.columnas) {
        if (!columna.catalogo) continue;
        if (columna.catalogo === 'subtipos') {
            const subtipo = await pool.request()
                .input('Grupo', sql.NVarChar(50), columna.grupoSubtipo)
                .query(`
                    SELECT TOP 1 Nombre FROM ActivoFijoSubtipos
                    WHERE Grupo = @Grupo AND Activo = 1
                    ORDER BY Nombre
                `);
            layout.ejemplo[columna.key] = subtipo.recordset[0]?.Nombre || '';
            continue;
        }
        const catalogo = catalogosDB.CATALOGOS[columna.catalogo];
        if (!catalogo) continue;
        const opcion = await pool.request().query(
            `SELECT TOP 1 Nombre FROM ${catalogo.tabla} WHERE Activo = 1 ORDER BY Nombre`
        );
        layout.ejemplo[columna.key] = opcion.recordset[0]?.Nombre || '';
    }

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
    await catalogosDB.asegurarCatalogosExtendidos();
    const IdTipo = parseInt(idTipoStr, 10);

    const layoutInfo = await obtenerLayout(idTipoStr);
    const tipoResult = await pool.request()
        .input('IdTipo', sql.Int, IdTipo)
        .query(`
            SELECT Nombre, RequiereSubtipo, RequiereClasificacion, RequiereTamanio,
                   RequiereCapacidad, RequiereVoltaje, RequierePrecio,
                   RequiereEspecificaciones, RequiereAccesorios, RequiereUsuarioAsignado
            FROM ActivoFijoTipos
            WHERE IdTipo = @IdTipo AND Activo = 1
        `);
    const tipo = tipoResult.recordset[0];
    if (!tipo) return { ok: false, mensaje: 'El tipo seleccionado ya no está activo.' };
    
    const IdEstadoDefault  = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', 'NUEVO')
        || await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', 'VALIDAR');
    const IdEstatusDefault = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', 'DISPONIBLE');
    if (!IdEstadoDefault) {
        return { ok: false, mensaje: 'Agrega un estado NUEVO o VALIDAR al catálogo antes de importar activos.' };
    }
    if (!IdEstatusDefault) {
        return { ok: false, mensaje: 'No existe el estatus DISPONIBLE en el catálogo.' };
    }

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
            let modelo          = filaNormalizada['Modelo'];
            const noSerie       = filaNormalizada['NoSerie'];
            const sitioNombre   = filaNormalizada['Sitio'];
            const carteraNombre = filaNormalizada['Cartera'] || filaNormalizada['CarteraAsignado'];
            
            const imei1           = filaNormalizada['IMEI1'];
            const imei2           = filaNormalizada['IMEI2'];
            const noTelefono      = filaNormalizada['NoTelefono'];
            const subtipoNombre   = filaNormalizada['Subtipo'] || filaNormalizada['Tipo'];
            const clasificacionNombre = filaNormalizada['Clasificacion'];
            const tamanioNombre   = filaNormalizada['Tamanio'] || filaNormalizada['Tamaño'];
            const capacidadNombre = filaNormalizada['Capacidad'];
            const voltajeNombre   = filaNormalizada['Voltaje'];
            let usuarioAsignado = filaNormalizada['UsuarioAsignado'];
            const precioStr       = filaNormalizada['Precio'];
            let procesador        = filaNormalizada['Procesador'];
            let ram               = filaNormalizada['RAM'] || filaNormalizada['MemoriaRAM'];
            let almacenamiento    = filaNormalizada['Almacenamiento'];
            let so                = filaNormalizada['S.O.'] || filaNormalizada['SistemaOperativo'];
            let accesorios        = filaNormalizada['Accesorios'];

            if (!noSerie && !imei1 && !noTelefono) {
                errores.push({ fila: numFila, mensaje: 'Captura al menos NoSerie, IMEI1 o NoTeléfono.' });
                continue;
            }
            if (tipo.RequiereSubtipo && !subtipoNombre) {
                errores.push({ fila: numFila, mensaje: 'El subtipo es obligatorio para este tipo.' });
                continue;
            }
            if (tipo.RequiereClasificacion && !clasificacionNombre) {
                errores.push({ fila: numFila, mensaje: 'La clasificación es obligatoria para este tipo.' });
                continue;
            }
            if (tipo.RequiereTamanio && !tamanioNombre) {
                errores.push({ fila: numFila, mensaje: 'El tamaño es obligatorio para este tipo.' });
                continue;
            }
            if (tipo.RequiereCapacidad && !capacidadNombre) {
                errores.push({ fila: numFila, mensaje: 'La capacidad es obligatoria para este tipo.' });
                continue;
            }
            if (tipo.RequiereVoltaje && !voltajeNombre) {
                errores.push({ fila: numFila, mensaje: 'El voltaje es obligatorio para este tipo.' });
                continue;
            }
            if (tipo.RequierePrecio && !precioStr) {
                errores.push({ fila: numFila, mensaje: 'El precio es obligatorio para este tipo.' });
                continue;
            }
            if (tipo.RequiereEspecificaciones && (!procesador || !ram || !almacenamiento || !so)) {
                errores.push({ fila: numFila, mensaje: 'Procesador, RAM, almacenamiento y sistema operativo son obligatorios.' });
                continue;
            }
            if (tipo.RequiereAccesorios && !accesorios) {
                errores.push({ fila: numFila, mensaje: 'Los accesorios son obligatorios para este tipo.' });
                continue;
            }
            const requiereUsuario = tipo.RequiereUsuarioAsignado
                && (!['SSD NVME', 'DISCO MECANICO'].includes(tipo.Nombre)
                    || (clasificacionNombre || '').toUpperCase() === 'EXTERNO');
            if (requiereUsuario && !usuarioAsignado) {
                errores.push({ fila: numFila, mensaje: 'UsuarioAsignado es obligatorio para este tipo.' });
                continue;
            }

            const IdMarca   = await getIdPorNombre(pool, 'ActivoFijoMarcas',   'IdMarca',   marcaNombre);
            const IdSitio   = await getIdPorNombre(pool, 'ActivoFijoSitios',   'IdSitio',   sitioNombre);
            const IdCartera = await getIdPorNombre(pool, 'ActivoFijoCarteras', 'IdCartera', carteraNombre);
            const IdClasificacion = await getIdPorNombre(pool, 'ActivoFijoClasificaciones', 'IdClasificacion', clasificacionNombre);
            const IdTamanio = await getIdPorNombre(pool, 'ActivoFijoTamanios', 'IdTamanio', tamanioNombre);
            const IdCapacidad = await getIdPorNombre(pool, 'ActivoFijoCapacidades', 'IdCapacidad', capacidadNombre);
            const IdVoltaje = await getIdPorNombre(pool, 'ActivoFijoVoltajes', 'IdVoltaje', voltajeNombre);

            const catalogosImportados = [
                ['Modelo', 'ActivoFijoModelos', modelo, value => { modelo = value; }],
                ['Procesador', 'ActivoFijoProcesadores', procesador, value => { procesador = value; }],
                ['RAM', 'ActivoFijoMemoriasRAM', ram, value => { ram = value; }],
                ['Almacenamiento', 'ActivoFijoAlmacenamientos', almacenamiento, value => { almacenamiento = value; }],
                ['Sistema Operativo', 'ActivoFijoSistemasOperativos', so, value => { so = value; }],
                ['Accesorios', 'ActivoFijoAccesorios', accesorios, value => { accesorios = value; }],
                ['UsuarioAsignado', 'ActivoFijoUsuariosAsignados', usuarioAsignado, value => { usuarioAsignado = value; }]
            ];
            let errorCatalogo = null;
            for (const [etiqueta, tabla, valor, asignar] of catalogosImportados) {
                if (!valor) continue;
                const nombreCatalogo = await getNombreCatalogo(pool, tabla, valor);
                if (!nombreCatalogo) {
                    errorCatalogo = `${etiqueta} "${valor}" no existe en su catálogo activo.`;
                    break;
                }
                asignar(nombreCatalogo);
            }
            if (errorCatalogo) {
                errores.push({ fila: numFila, mensaje: errorCatalogo });
                continue;
            }

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
            if (sitioNombre && !IdSitio) {
                errores.push({ fila: numFila, mensaje: `Sitio "${sitioNombre}" no existe.` });
                continue;
            }
            if (clasificacionNombre && !IdClasificacion) {
                errores.push({ fila: numFila, mensaje: `Clasificación "${clasificacionNombre}" no existe.` });
                continue;
            }
            if (tamanioNombre && !IdTamanio) {
                errores.push({ fila: numFila, mensaje: `Tamaño "${tamanioNombre}" no existe.` });
                continue;
            }
            if (capacidadNombre && !IdCapacidad) {
                errores.push({ fila: numFila, mensaje: `Capacidad "${capacidadNombre}" no existe.` });
                continue;
            }
            if (voltajeNombre && !IdVoltaje) {
                errores.push({ fila: numFila, mensaje: `Voltaje "${voltajeNombre}" no existe.` });
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
            if (imei1 && imei2 && imei1 === imei2) {
                errores.push({ fila: numFila, mensaje: 'IMEI1 e IMEI2 no pueden tener el mismo valor.' });
                continue;
            }
            let identificadorDuplicado = false;
            for (const [campo, valor] of [['IMEI', imei1], ['IMEI', imei2], ['teléfono', noTelefono]]) {
                if (!valor) continue;
                const columna = campo === 'IMEI' ? 'IMEI1 = @Valor OR IMEI2 = @Valor' : 'NoTelefono = @Valor';
                const duplicado = await pool.request()
                    .input('Valor', sql.NVarChar(50), valor)
                    .query(`SELECT 1 FROM ActivoFijoEquipos WHERE ${columna}`);
                if (duplicado.recordset.length > 0) {
                    errores.push({ fila: numFila, mensaje: `El ${campo} "${valor}" ya existe.` });
                    identificadorDuplicado = true;
                    break;
                }
            }
            if (identificadorDuplicado) continue;

            let precioNum = null;
            if (precioStr) {
                precioNum = parseFloat(precioStr.replace(/[^0-9.-]+/g, ""));
                if (!Number.isFinite(precioNum) || precioNum < 0) {
                    errores.push({ fila: numFila, mensaje: `Precio "${precioStr}" no es un número válido.` });
                    continue;
                }
            }

            /* El esquema puede estar ya en 3FN (sin las columnas de texto) o
               todavía con ellas: cada columna se escribe sólo si existe y las
               especificaciones van siempre por su FK del catálogo. */
            const existentes = await catalogosDB.columnasExistentes('ActivoFijoEquipos', [
                'IdCartera', 'IdMarca', 'IdModelo', 'Modelo', 'IdTipo', 'NoSerie',
                'IMEI1', 'IMEI2', 'NoTelefono', 'IdEstado', 'IdEstatus', 'IdSitio',
                'IdSubtipo', 'IdClasificacion', 'IdTamanio', 'IdCapacidad', 'IdVoltaje',
                'IdUsuarioAsignado', 'UsuarioAsignado', 'PrecioActivo',
                'IdProcesador', 'Procesador', 'IdMemoriaRAM', 'MemoriaRAM',
                'IdAlmacenamiento', 'Almacenamiento', 'IdSistemaOperativo',
                'SistemaOperativo', 'Accesorios', 'IdUsuarioCreacion'
            ]);
            const IdModelo          = await catalogosDB.resolverId('modelos',          modelo);
            const IdProcesador      = await catalogosDB.resolverId('procesadores',      procesador);
            const IdMemoriaRAM      = await catalogosDB.resolverId('memoriasRam',       ram);
            const IdAlmacenamiento  = await catalogosDB.resolverId('almacenamientos',   almacenamiento);
            const IdSistemaOperativo = await catalogosDB.resolverId('sistemasOperativos', so);
            const IdUsuarioAsignado = await catalogosDB.resolverId('usuariosAsignados', usuarioAsignado);

            const request  = pool.request();
            const columnas = [];
            const valores  = [];
            const agregar = (columna, tipo, valor) => {
                if (!existentes.has(columna)) return;
                const param = `p${columnas.length}`;
                request.input(param, tipo, valor);
                columnas.push(columna);
                valores.push('@' + param);
            };

            agregar('IdCartera',         sql.Int,           IdCartera              || null);
            agregar('IdMarca',           sql.Int,           IdMarca                || null);
            agregar('IdModelo',          sql.Int,           IdModelo               || null);
            agregar('Modelo',            sql.NVarChar(150), modelo                 || null);
            agregar('IdTipo',            sql.Int,           IdTipo);
            agregar('NoSerie',           sql.NVarChar(150), noSerie                || null);
            agregar('IMEI1',             sql.NVarChar(50),  imei1                  || null);
            agregar('IMEI2',             sql.NVarChar(50),  imei2                  || null);
            agregar('NoTelefono',        sql.NVarChar(50),  noTelefono             || null);
            agregar('IdEstado',          sql.Int,           IdEstadoDefault);
            agregar('IdEstatus',         sql.Int,           IdEstatusDefault);
            agregar('IdSitio',           sql.Int,           IdSitio                || null);
            agregar('IdSubtipo',         sql.Int,           IdSubtipo              || null);
            agregar('IdClasificacion',   sql.Int,           IdClasificacion        || null);
            agregar('IdTamanio',         sql.Int,           IdTamanio              || null);
            agregar('IdCapacidad',       sql.Int,           IdCapacidad            || null);
            agregar('IdVoltaje',         sql.Int,           IdVoltaje              || null);
            agregar('IdUsuarioAsignado', sql.Int,           IdUsuarioAsignado      || null);
            agregar('UsuarioAsignado',   sql.NVarChar(200), usuarioAsignado        || null);
            agregar('PrecioActivo',      sql.Decimal(18,2), precioNum);
            agregar('IdProcesador',      sql.Int,           IdProcesador           || null);
            agregar('Procesador',        sql.NVarChar(150), procesador             || null);
            agregar('IdMemoriaRAM',      sql.Int,           IdMemoriaRAM           || null);
            agregar('MemoriaRAM',        sql.NVarChar(50),  ram                    || null);
            agregar('IdAlmacenamiento',  sql.Int,           IdAlmacenamiento       || null);
            agregar('Almacenamiento',    sql.NVarChar(50),  almacenamiento         || null);
            agregar('IdSistemaOperativo', sql.Int,          IdSistemaOperativo     || null);
            agregar('SistemaOperativo',  sql.NVarChar(100), so                     || null);
            agregar('Accesorios',        sql.NVarChar(300), accesorios             || null);
            agregar('IdUsuarioCreacion', sql.Int,           idUsuario              || null);

            const result = await request.query(`
                INSERT INTO ActivoFijoEquipos (${columnas.join(', ')})
                VALUES (${valores.join(', ')});
                SELECT SCOPE_IDENTITY() AS Id;
            `);

            const idInsertado = result.recordset[0].Id;

            /* Accesorios en la tabla puente (N:M), igual que el alta manual. */
            await catalogosDB.sincronizarAccesoriosEquipo(idInsertado, accesorios);

            insertados.push({
                fila: numFila,
                id: idInsertado,
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