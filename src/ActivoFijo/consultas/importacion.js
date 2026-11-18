/* =========================================================
   ACTIVO FIJO — IMPORTACIÓN MASIVA DINÁMICA
   src/ActivoFijo/consultas/importacion.js
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');
const catalogosDB = require('./catalogos');
const activosDB = require('./activos');

/* El importador también deja de depender de las banderas del catálogo: mide
   el inventario real del tipo (perfil) y sólo usa la bandera como respaldo. */
function reglaPerfil(perfil, clave, bandera) {
    const claves = perfil && perfil.total > 0 ? (perfil.claves || {}) : {};
    const m = claves[clave];
    if (!m) return { usar: !!bandera, obligatorio: !!bandera, medido: false };
    return {
        usar: !!m.usado || !!m.requerido || !!bandera,
        obligatorio: !!m.requerido,
        medido: true,
        usos: m.usos,
        total: m.total
    };
}

function requisitosImportacion(tipo, perfil = null) {
    return {
        imei:            reglaPerfil(perfil, 'imei', tipo.RequiereIMEI),
        telefono:        reglaPerfil(perfil, 'telefono', tipo.RequiereTelefono),
        sitio:           reglaPerfil(perfil, 'sitio', tipo.RequiereSitio),
        subtipo:         reglaPerfil(perfil, 'subtipo', tipo.RequiereSubtipo),
        clasificacion:   reglaPerfil(perfil, 'clasificacion', tipo.RequiereClasificacion),
        tamanio:         reglaPerfil(perfil, 'tamanio', tipo.RequiereTamanio),
        capacidad:       reglaPerfil(perfil, 'capacidad', tipo.RequiereCapacidad),
        voltaje:         reglaPerfil(perfil, 'voltaje', tipo.RequiereVoltaje),
        usuarioAsignado: reglaPerfil(perfil, 'usuarioAsignado', tipo.RequiereUsuarioAsignado),
        precio:          reglaPerfil(perfil, 'precio', tipo.RequierePrecio),
        especificaciones: reglaPerfil(perfil, 'especificaciones', tipo.RequiereEspecificaciones),
        accesorios:      reglaPerfil(perfil, 'accesorios', tipo.RequiereAccesorios)
    };
}

/* Acepta encabezados escritos de varias formas (con acento, con espacios,
   en mayúsculas): el archivo real nunca viene perfecto. */
function valorFila(fila, ...alias) {
    for (const a of alias) {
        const clave = Object.keys(fila).find(k => normalizarClave(k) === normalizarClave(a));
        if (clave === undefined) continue;
        const valor = String(fila[clave] ?? '').trim();
        if (valor) return valor;
    }
    return '';
}

function normalizarClave(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
}

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
function construirLayout(tipo, perfil = null) {
    const req = requisitosImportacion(tipo, perfil);

    const columnas = [
        { key: 'Marca',   etiqueta: 'Marca',   catalogo: 'marcas' },
        { key: 'Modelo',  etiqueta: 'Modelo',  catalogo: 'modelos' },
        { key: 'NoSerie', etiqueta: 'NoSerie', catalogo: null, opcional: true },
        /* Con el hostname (AGT-TOY156) se deduce la cartera del cliente. */
        { key: 'Hostname', etiqueta: 'Hostname', catalogo: null, opcional: true }
    ];

    if (req.imei.usar) {
        columnas.push({ key: 'IMEI1', etiqueta: 'IMEI1', catalogo: null });
        columnas.push({ key: 'IMEI2', etiqueta: 'IMEI2', catalogo: null, opcional: true });
    }
    if (req.telefono.usar) {
        columnas.push({ key: 'NoTelefono', etiqueta: 'NoTelefono', catalogo: null });
    }
    if (req.sitio.usar) {
        columnas.push({ key: 'Sitio', etiqueta: 'Sitio', catalogo: 'sitios' });
    }
    if (req.subtipo.usar) {
        columnas.push({ key: 'Subtipo', etiqueta: 'Subtipo', catalogo: 'subtipos', grupoSubtipo: tipo.GrupoSubtipo });
    }
    if (req.clasificacion.usar) {
        columnas.push({ key: 'Clasificacion', etiqueta: 'Clasificacion', catalogo: 'clasificaciones' });
    }
    if (req.tamanio.usar) {
        columnas.push({ key: 'Tamanio', etiqueta: 'Tamanio', catalogo: 'tamanios' });
    }
    if (req.capacidad.usar) {
        columnas.push({ key: 'Capacidad', etiqueta: 'Capacidad', catalogo: 'capacidades' });
    }
    if (req.voltaje.usar) {
        columnas.push({ key: 'Voltaje', etiqueta: 'Voltaje', catalogo: 'voltajes' });
    }
    if (req.usuarioAsignado.usar) {
        columnas.push({ key: 'UsuarioAsignado', etiqueta: 'UsuarioAsignado', catalogo: 'usuariosAsignados', opcional: true });
    }
    if (req.precio.usar) {
        columnas.push({ key: 'PrecioActivo', etiqueta: 'Precio', catalogo: null });
    }
    if (req.especificaciones.usar) {
        columnas.push({ key: 'Procesador', etiqueta: 'Procesador', catalogo: 'procesadores' });
        columnas.push({ key: 'MemoriaRAM', etiqueta: 'RAM', catalogo: 'memoriasRam' });
        columnas.push({ key: 'Almacenamiento', etiqueta: 'Almacenamiento', catalogo: 'almacenamientos' });
        columnas.push({ key: 'SistemaOperativo', etiqueta: 'S.O.', catalogo: 'sistemasOperativos' });
    }
    if (req.accesorios.usar) {
        columnas.push({ key: 'Accesorios', etiqueta: 'Accesorios', catalogo: 'accesorios', opcional: true });
    }

    columnas.push({ key: 'CarteraAsignado', etiqueta: 'Cartera', catalogo: 'carteras', opcional: true });

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
        else if (c.key === 'Hostname') ejemplo[c.key] = 'AGT-TOY156';
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

    /* El perfil real de cada tipo se mide en paralelo: con él la plantilla
       ofrece exactamente las columnas que ese tipo captura. */
    const perfiles = await Promise.all(
        r.recordset.map(tipo => activosDB.perfilPorTipo(pool, tipo.IdTipo).catch(() => null))
    );

    return r.recordset.map((tipo, i) => {
        const layout = construirLayout(tipo, perfiles[i]);
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
    const perfil = await activosDB.perfilPorTipo(pool, tipo.IdTipo).catch(() => null);
    const layout = construirLayout(tipo, perfil);
    const requisitos = requisitosImportacion(tipo, perfil);
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
        ejemplo: ejemploPorEtiqueta,
        /* Perfil real del tipo + qué campos quedan obligatorios con él. */
        perfil,
        requisitos: Object.fromEntries(
            Object.entries(requisitos).map(([clave, r]) => [clave, r.obligatorio])
        )
    };
}

/* =========================================================
   PROCESAR IMPORTACIÓN MASIVA
   ========================================================= */
async function importar(datos, idUsuario) {
    const { layout: idTipoStr, filas, opciones = {} } = datos;

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

    /* Qué es obligatorio lo dice el inventario de ese tipo (perfil), no la
       bandera capturada a mano en el catálogo. */
    const req = requisitosImportacion(tipo, layoutInfo.perfil);

    /* Cartera / sitio destino + regla de "sólo esta cartera". */
    const contexto = await activosDB.contextoParaImportacion();
    const idCarteraFija = parseInt(opciones.idCartera, 10) || null;
    const idSitioFijo   = parseInt(opciones.idSitio, 10) || contexto.idSitioPorDefecto || null;
    const soloCartera   = !!opciones.soloCartera && !!idCarteraFija;
    let nombreCarteraFija = null;
    if (soloCartera) {
        const r = await pool.request()
            .input('Id', sql.Int, idCarteraFija)
            .query('SELECT Nombre FROM ActivoFijoCarteras WHERE IdCartera = @Id');
        nombreCarteraFija = r.recordset[0]?.Nombre ?? null;
    }
    const nombreSitioFijo = idSitioFijo
        ? (await pool.request()
            .input('Id', sql.Int, idSitioFijo)
            .query('SELECT Nombre FROM ActivoFijoSitios WHERE IdSitio = @Id')).recordset[0]?.Nombre ?? null
        : null;

    
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
    let omitidos     = 0;

    for (let i = 0; i < filas.length; i++) {
        const fila = filas[i];
        const numFila = i + 2;
        try {
            const filaNormalizada = {};
            Object.keys(fila).forEach(k => {
                filaNormalizada[k.trim()] = String(fila[k] ?? '').trim();
            });

            /* Lectura tolerante a encabezados: espacios, acentos, mayúsculas
               y alias habituales de cada columna. */
            const marcaNombre   = valorFila(filaNormalizada, 'Marca');
            let modelo          = valorFila(filaNormalizada, 'Modelo');
            const noSerie       = valorFila(filaNormalizada, 'NoSerie', 'No. Serie', 'Serie');
            const hostname      = valorFila(filaNormalizada, 'Hostname', 'HostName', 'Equipo', 'NombreEquipo');
            const sitioNombre   = valorFila(filaNormalizada, 'Sitio');
            const carteraNombre = valorFila(filaNormalizada, 'Cartera', 'CarteraAsignado');

            const imei1           = valorFila(filaNormalizada, 'IMEI1', 'IMEI 1');
            const imei2           = valorFila(filaNormalizada, 'IMEI2', 'IMEI 2');
            const noTelefono      = valorFila(filaNormalizada, 'NoTelefono', 'No. Telefono', 'Telefono');
            const subtipoNombre   = valorFila(filaNormalizada, 'Subtipo', 'Tipo');
            const clasificacionNombre = valorFila(filaNormalizada, 'Clasificacion');
            const tamanioNombre   = valorFila(filaNormalizada, 'Tamanio', 'Tamaño');
            const capacidadNombre = valorFila(filaNormalizada, 'Capacidad');
            const voltajeNombre   = valorFila(filaNormalizada, 'Voltaje');
            let usuarioAsignado   = valorFila(filaNormalizada, 'UsuarioAsignado', 'Usuario Asignado', 'Usuario');
            const precioStr       = valorFila(filaNormalizada, 'Precio', 'PrecioActivo');
            let procesador        = valorFila(filaNormalizada, 'Procesador');
            let ram               = valorFila(filaNormalizada, 'RAM', 'MemoriaRAM', 'Memoria RAM');
            let almacenamiento    = valorFila(filaNormalizada, 'Almacenamiento');
            let so                = valorFila(filaNormalizada, 'S.O.', 'SO', 'SistemaOperativo', 'Sistema Operativo');
            let accesorios        = valorFila(filaNormalizada, 'Accesorios');

            if (!noSerie && !imei1 && !noTelefono) {
                errores.push({ fila: numFila, mensaje: 'Captura al menos NoSerie, IMEI1 o NoTeléfono.' });
                continue;
            }
            if (req.subtipo.obligatorio && !subtipoNombre) {
                errores.push({ fila: numFila, mensaje: 'El subtipo es obligatorio para este tipo.' });
                continue;
            }
            if (req.clasificacion.obligatorio && !clasificacionNombre) {
                errores.push({ fila: numFila, mensaje: 'La clasificación es obligatoria para este tipo.' });
                continue;
            }
            if (req.tamanio.obligatorio && !tamanioNombre) {
                errores.push({ fila: numFila, mensaje: 'El tamaño es obligatorio para este tipo.' });
                continue;
            }
            if (req.capacidad.obligatorio && !capacidadNombre) {
                errores.push({ fila: numFila, mensaje: 'La capacidad es obligatoria para este tipo.' });
                continue;
            }
            if (req.voltaje.obligatorio && !voltajeNombre) {
                errores.push({ fila: numFila, mensaje: 'El voltaje es obligatorio para este tipo.' });
                continue;
            }
            if (req.precio.obligatorio && !precioStr) {
                errores.push({ fila: numFila, mensaje: 'El precio es obligatorio para este tipo.' });
                continue;
            }
            if (req.especificaciones.obligatorio && (!procesador || !ram || !almacenamiento || !so)) {
                errores.push({ fila: numFila, mensaje: 'Procesador, RAM, almacenamiento y sistema operativo son obligatorios.' });
                continue;
            }
            if (req.accesorios.obligatorio && !accesorios) {
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

            /* Cartera del renglón: la del archivo, la elegida en pantalla o la
               deducida del hostname. Con "sólo esta cartera" se omiten las
               filas que declaren otra explícitamente. */
            const inf = hostname ? contexto.inferir(hostname) : null;
            let IdCartera = await getIdPorNombre(pool, 'ActivoFijoCarteras', 'IdCartera', carteraNombre);
            if (soloCartera && carteraNombre && !IdCartera) {
                errores.push({ fila: numFila, mensaje: `Cartera "${carteraNombre}" no existe.` });
                continue;
            }
            if (soloCartera && IdCartera && IdCartera !== idCarteraFija) {
                omitidos++;
                continue;
            }
            if (!IdCartera) IdCartera = idCarteraFija || inf?.idCartera || null;

            const IdMarca   = await getIdPorNombre(pool, 'ActivoFijoMarcas',   'IdMarca',   marcaNombre);
            const IdSitio   = (await getIdPorNombre(pool, 'ActivoFijoSitios', 'IdSitio', sitioNombre)) || idSitioFijo;
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
        mensaje: `Importación finalizada. ${insertados.length} insertados, ${errores.length} errores` +
                 (omitidos ? `, ${omitidos} omitidos por cartera` : '') + '.',
        insertados,
        errores,
        omitidos,
        cartera: nombreCarteraFija,
        sitio: nombreSitioFijo
    };
}

/* =========================================================
   OPCIONES DEL IMPORTADOR (cartera / sitio destino)
   ---------------------------------------------------------
   Importar "todo de golpe" necesita decir a qué cartera y sitio va lo
   que el archivo no trae. COPERVA es el sitio por defecto y la cartera
   puede deducirse del hostname de cada fila (AGT-TOY156 → TOYOTA).
   ========================================================= */
async function listarOpciones() {
    await catalogosDB.asegurarCatalogosExtendidos();
    const pool = await getPool();

    const [carteras, sitios, contexto] = await Promise.all([
        pool.request().query('SELECT IdCartera, Nombre FROM ActivoFijoCarteras WHERE Activo = 1 ORDER BY Nombre'),
        pool.request().query('SELECT IdSitio, Nombre FROM ActivoFijoSitios WHERE Activo = 1 ORDER BY Nombre'),
        activosDB.contextoParaImportacion()
    ]);

    return {
        ok: true,
        carteras: carteras.recordset || [],
        sitios: sitios.recordset || [],
        /* idSitioPorDefecto: para preseleccionar el <select>.
           sitioPorDefecto: el nombre legible (COPERVA). */
        idSitioPorDefecto: contexto.idSitioPorDefecto || null,
        sitioPorDefecto: contexto.sitioPorDefecto || 'COPERVA'
    };
}

module.exports = {
    listarLayouts,
    listarOpciones,
    obtenerLayout,
    importar
};