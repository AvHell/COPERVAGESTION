/* =========================================================
   ACTIVO FIJO — DETALLE DEL ACTIVO (red, cuentas, programas)
   ---------------------------------------------------------
   Capa de datos del módulo "Activo Fijo — Detalle".

   Sólo lectura sobre lo que deja la app A (colector):
     dbo.vw_ActivoFijoEquipoInline   → maestro + ficha
     dbo.ActivoFijoEquiposRed        → adaptadores
     dbo.ActivoFijoEquiposCuentas    → cuentas locales / dominio
     dbo.ActivoFijoEquiposProgramas  → software instalado
     dbo.ActivoFijoEquiposComponentes → piezas conectadas al equipo
                                        (monitor externo, disco, teclado,
                                        ratón). NO son activos sueltos:
                                        cuelgan del activo padre por
                                        IdActivoFijoEQ + NoSerie del CPU.

   Reglas que aplica:
     · Sólo se devuelve lo vigente (Vigente = 1).
     · Paginado en el servidor (OFFSET/FETCH): nunca se traen
       los ~500 activos ni los 200+ programas de golpe.
     · Listas de columnas explícitas: sin SELECT * en las vistas
       ni en las tablas puente.

   Las vistas/tablas las crea scripts/activo-fijo-detalle.sql. Si
   todavía no se aplicó, cada función responde con
   `fuenteDisponible: false` en lugar de reventar: la página
   muestra un estado vacío explicando qué falta.
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');
const catalogosDB = require('./catalogos');

/* Objetos que debe haber creado el script de detalle. */
const TABLA_RED       = 'ActivoFijoEquiposRed';
const TABLA_CUENTAS   = 'ActivoFijoEquiposCuentas';
const TABLA_PROGRAMAS = 'ActivoFijoEquiposProgramas';
const TABLA_COMPONENTES = 'ActivoFijoEquiposComponentes';
const VISTA_MAESTRO   = 'vw_ActivoFijoEquipoInline';

const SCRIPT = 'scripts/activo-fijo-detalle.sql';
const TAMANO_MAX  = 200;
const TAMANO_DEF  = 50;

/* =========================================================
   MENSAJES DE ERROR
   ---------------------------------------------------------
   Igual que en documentos.js: el error crudo de SQL Server no le
   dice nada al usuario. Los tres casos que de verdad se dan en
   esta base se traducen a una instrucción concreta.
   ========================================================= */
function mensajeBD(err) {
    const numero = err && (err.number || (err.originalError && err.originalError.info && err.originalError.info.number));
    switch (numero) {
        case 208:   // Invalid object name
            return `Las tablas del colector todavía no están en la base. Ejecuta ${SCRIPT} y vuelve a intentar.`;
        case 9002:  // The transaction log for database ... is full
            return 'El registro de transacciones de la base está lleno. Ejecuta scripts/liberar-log-transacciones.sql y vuelve a intentar.';
        case 1105:
            return 'La base de datos se quedó sin espacio en disco.';
        case 701:
            return 'La base de datos se quedó sin memoria disponible.';
        default:
            return (err && err.message) || 'Error de base de datos.';
    }
}

function respuestaError(err, contexto) {
    console.error(`[Detalle AF] ${contexto}:`, err);
    return { ok: false, mensaje: mensajeBD(err), error: err && err.number ? err.number : null };
}

/* =========================================================
   ¿EXISTE EL OBJETO?  (tablas Y vistas)
   ---------------------------------------------------------
   catalogosDB.tablaExiste() sólo reconoce tablas (OBJECT_ID 'U')
   y las dos fuentes principales son vistas, así que aquí se
   consulta sin filtrar tipo. Se recuerda por sesión: el esquema
   no cambia con la app abierta.
   ========================================================= */
const cacheObjetos = new Map();

async function existeObjeto(nombre) {
    if (cacheObjetos.has(nombre)) return cacheObjetos.get(nombre);
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('Nombre', sql.NVarChar(200), `dbo.${nombre}`)
            .query('SELECT OBJECT_ID(@Nombre) AS IdObjeto');
        const existe = r.recordset[0] && r.recordset[0].IdObjeto != null;
        cacheObjetos.set(nombre, !!existe);
        return !!existe;
    } catch (err) {
        console.error('[Detalle AF] No se pudo verificar', nombre, err.message);
        return false;
    }
}

/* =========================================================
   COLUMNAS REALES DE UN OBJETO
   ---------------------------------------------------------
   Las dos vistas las escribe el script, pero son tablas de otra
   app: la base puede tener una versión anterior (sin TotalRed,
   por ejemplo) y entonces la consulta revienta con "Invalid
   column name" y la página queda en blanco. Aquí se leen las
   columnas que de verdad tiene el objeto y cada consulta se
   arma sólo con ellas: lo que falte se calcula aquí contra las
   tablas puente, o se devuelve NULL, en lugar de romper.
   Se recuerda por sesión: el esquema no cambia con la app abierta.
   ========================================================= */
const cacheColumnas = new Map();

async function columnasDe(nombre) {
    if (cacheColumnas.has(nombre)) return cacheColumnas.get(nombre);
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('Nombre', sql.NVarChar(300), `dbo.${nombre}`)
            .query('SELECT c.name AS Columna FROM sys.columns c WHERE c.object_id = OBJECT_ID(@Nombre);');
        const columnas = new Set((r.recordset || []).map(f => String(f.Columna || '').trim()).filter(Boolean));
        /* Sin columnas el objeto no existe (o no hay permiso de
           metadatos): no se cachea para reintentar más adelante. */
        if (columnas.size) cacheColumnas.set(nombre, columnas);
        return columnas;
    } catch (err) {
        console.error('[Detalle AF] No se pudieron leer las columnas de', nombre, err.message);
        return new Set();
    }
}

/* =========================================================
   COLUMNAS DE DIADEMA (opcionales)
   ---------------------------------------------------------
   scripts/activo-vivo-unificado.sql agrega MAC, ConectadoA,
   EstadoConexion y Bateria a ActivoFijoEquiposComponentes para
   que el colector pueda reportar diademas con su conexión.
   Si la base todavía no corrió ese script, cada consulta pide
   NULL en su lugar: la pantalla funciona igual y sólo se ven
   vacías esas columnas.
   ========================================================= */
const COLUMNAS_DIADEMA = [
    { nombre: 'MAC',             tipo: 'VARCHAR(17)'   },
    { nombre: 'ConectadoA',      tipo: 'NVARCHAR(300)' },
    { nombre: 'EstadoConexion',  tipo: 'VARCHAR(30)'   },
    { nombre: 'Bateria',         tipo: 'TINYINT'       }
];

async function columnasDiadema(alias = 'cp') {
    const columnas = await columnasDe(TABLA_COMPONENTES);
    return COLUMNAS_DIADEMA
        .map(({ nombre, tipo }) => columnas.has(nombre)
            ? `${alias}.${nombre}`
            : `CAST(NULL AS ${tipo}) AS ${nombre}`)
        .join(', ');
}

/* Tipos de pieza que el colector puede reportar. DIADEMA lo agrega
   scripts/activo-vivo-unificado.sql al CHECK de la tabla. */
const TIPOS_COMPONENTE = ['MONITOR', 'DISCO', 'TECLADO', 'RATON', 'DIADEMA', 'OTRO'];

/* Aviso común cuando una vista quedó de una corrida anterior del script. */
function mensajeVistaIncompleta(vista, faltan) {
    return `La vista dbo.${vista} está desactualizada (le falta ${faltan.join(', ')}). Vuelve a ejecutar ${SCRIPT}.`;
}

/* Estado de las fuentes, para que la UI explique qué falta en vez
   de mostrar una tabla vacía sin motivo. */
async function estadoFuentes() {
    const [maestro, red, cuentas, programas, componentes] = await Promise.all([
        existeObjeto(VISTA_MAESTRO),
        existeObjeto(TABLA_RED),
        existeObjeto(TABLA_CUENTAS),
        existeObjeto(TABLA_PROGRAMAS),
        existeObjeto(TABLA_COMPONENTES)
    ]);
    return {
        ok: true,
        maestro, red, cuentas, programas, componentes,
        listo: maestro && red && cuentas && programas && componentes,
        script: SCRIPT
    };
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function texto(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).trim();
}

function entero(valor, defecto = null) {
    const n = Number(valor);
    return Number.isFinite(n) ? Math.trunc(n) : defecto;
}

function normalizarPaginacion(opciones = {}) {
    const tamano = Math.min(Math.max(entero(opciones.tamano, TAMANO_DEF) || TAMANO_DEF, 1), TAMANO_MAX);
    const pagina = Math.max(entero(opciones.pagina, 1) || 1, 1);
    return { pagina, tamano, offset: (pagina - 1) * tamano };
}

function like(valor) {
    const t = texto(valor);
    return t ? `%${t}%` : null;
}

/* =========================================================
   1. MAESTRO
   ---------------------------------------------------------
   Búsqueda por NoSerie / Hostname / IP / MAC, filtros por
   dominio y por "tiene programas / sin red / sin vigencia
   reciente". Paginado de 50–100 filas en el servidor.
   ========================================================= */
/* Columnas que la tabla del maestro necesita. Si la vista no las
   expone se devuelve NULL con el mismo nombre, así el renderer
   sigue pintando el renglón (con "—") en vez de fallar. */
const CAMPOS_MAESTRO = [
    'NoSerie', 'Hostname', 'Dominio', 'DominioDNS',
    'IP', 'MAC', 'Mascara', 'PuertaEnlace', 'DNS1', 'DNS2',
    'Adaptador', 'EsPrincipal', 'UltimaDeteccion'
];

/* Los cuatro conteos: se toman de la vista si los trae y, si no,
   se calculan contra su tabla puente con la misma regla (Vigente = 1).
   `Componentes` son las piezas conectadas al equipo (monitor externo,
   disco, teclado, ratón), no activos independientes. */
const CONTEOS_MAESTRO = [
    { campo: 'TotalRed',    tabla: TABLA_RED,         alias: 'cntRed'  },
    { campo: 'Programas',   tabla: TABLA_PROGRAMAS,   alias: 'cntProg' },
    { campo: 'Cuentas',     tabla: TABLA_CUENTAS,     alias: 'cntCue'  },
    /* `suma`: el conteo que ve el usuario son UNIDADES físicas, no filas
       (una fila con Cantidad = 2 son dos discos). Misma regla que la vista
       vw_ActivoFijoEquipoInline y que el listado del inventario. */
    { campo: 'Componentes', tabla: TABLA_COMPONENTES, alias: 'cntComp', suma: 'Cantidad' }
];

/* El aviso de vista desactualizada se da una sola vez por sesión. */
let avisadoVistaIncompleta = false;

/* Arma el SELECT del maestro con las columnas que la vista sí tiene. */
async function piezasMaestro() {
    /* Vista y tablas puente en paralelo: la primera vez son 4 consultas
       de metadatos, después todo sale de cacheColumnas. */
    const [columnasVista, ...columnasTablas] = await Promise.all([
        columnasDe(VISTA_MAESTRO),
        ...CONTEOS_MAESTRO.map(c => columnasDe(c.tabla))
    ]);
    const tiene = c => columnasVista.has(c);

    const seleccion = ['v.IdActivoFijoEQ'];
    const aplicaciones = [];
    const conteo = {};

    CAMPOS_MAESTRO.forEach(campo => {
        if (tiene(campo)) seleccion.push(`v.${campo}`);
        else seleccion.push(`CAST(NULL AS NVARCHAR(200)) AS ${campo}`);
    });

    const sinVista = [];
    for (let i = 0; i < CONTEOS_MAESTRO.length; i++) {
        const { campo, tabla, alias, suma } = CONTEOS_MAESTRO[i];
        if (tiene(campo)) {
            seleccion.push(`v.${campo}`);
            conteo[campo] = `v.${campo}`;
            continue;
        }
        sinVista.push(campo);

        const columnasTabla = columnasTablas[i];
        if (!columnasTabla.has('IdActivoFijoEQ')) {
            seleccion.push(`CAST(0 AS INT) AS ${campo}`);
            conteo[campo] = '0';
            continue;
        }
        const vigente = columnasTabla.has('Vigente') ? ' AND b.Vigente = 1' : '';
        /* `suma` sólo si la columna existe de verdad en la tabla puente;
           si no, se cae a COUNT(*) para no romper la consulta. */
        const expresion = (suma && columnasTabla.has(suma))
            ? `CAST(ISNULL(SUM(ISNULL(b.${suma}, 1)), 0) AS INT)`
            : 'COUNT(*)';
        aplicaciones.push(`OUTER APPLY (
        SELECT ${expresion} AS T FROM dbo.${tabla} b
        WHERE b.IdActivoFijoEQ = v.IdActivoFijoEQ${vigente}
    ) ${alias}`);
        seleccion.push(`CAST(ISNULL(${alias}.T, 0) AS INT) AS ${campo}`);
        conteo[campo] = `ISNULL(${alias}.T, 0)`;
    }

    if (sinVista.length && !avisadoVistaIncompleta) {
        avisadoVistaIncompleta = true;
        console.warn(`[Detalle AF] dbo.${VISTA_MAESTRO} no expone ${sinVista.join(', ')}: ` +
                     `se calculan contra las tablas puente. Vuelve a ejecutar ${SCRIPT} para alinear la vista.`);
    }

    return { tiene, seleccion, aplicaciones, conteo };
}

async function listarMaestro(opciones = {}) {
    if (!(await existeObjeto(VISTA_MAESTRO))) {
        return {
            ok: true, filas: [], total: 0, pagina: 1, tamano: TAMANO_DEF,
            fuenteDisponible: false,
            mensaje: `La vista dbo.${VISTA_MAESTRO} aún no existe. Ejecuta ${SCRIPT}.`
        };
    }

    const { pagina, tamano, offset } = normalizarPaginacion(opciones);
    const busqueda = like(opciones.busqueda);
    const dominio = texto(opciones.dominio);
    const filtro = texto(opciones.filtro);
    const diasSinVigencia = Math.max(entero(opciones.diasSinVigencia, 30) || 30, 1);

    try {
        const { tiene, seleccion, aplicaciones, conteo } = await piezasMaestro();

        /* Cada filtro se añade sólo si la columna que necesita existe:
           la vista es de la app A y su forma puede no ser la esperada. */
        const condiciones = [];

        const buscables = ['NoSerie', 'Hostname', 'IP', 'MAC'].filter(tiene);
        if (buscables.length) {
            condiciones.push(`(@Busqueda IS NULL
                   OR ${buscables.map(c => `v.${c} LIKE @Busqueda`).join('\n                   OR ')})`);
        }

        if (tiene('Dominio')) {
            condiciones.push(`(@Dominio IS NULL
                   OR (@Dominio = N'(sin-dominio)' AND NULLIF(v.Dominio, N'') IS NULL)
                   OR v.Dominio = @Dominio)`);
        }

        if (filtro === 'con-programas' && conteo.Programas) {
            condiciones.push(`${conteo.Programas} > 0`);
        }
        if (filtro === 'sin-red' && conteo.TotalRed) {
            condiciones.push(`${conteo.TotalRed} = 0`);
        }
        if (filtro === 'con-componentes' && conteo.Componentes) {
            condiciones.push(`${conteo.Componentes} > 0`);
        }
        if (filtro === 'sin-vigencia' && tiene('UltimaDeteccion')) {
            condiciones.push(`(v.UltimaDeteccion IS NULL
                   OR v.UltimaDeteccion < DATEADD(DAY, -@Dias, GETDATE()))`);
        }

        const orden = tiene('NoSerie') ? 'v.NoSerie, v.IdActivoFijoEQ' : 'v.IdActivoFijoEQ';

        const pool = await getPool();
        const r = await pool.request()
            .input('Busqueda', sql.NVarChar(200), busqueda)
            .input('Dominio', sql.NVarChar(150), dominio || null)
            .input('Dias', sql.Int, diasSinVigencia)
            .input('Offset', sql.Int, offset)
            .input('Tamano', sql.Int, tamano)
            .query(`
                SELECT ${seleccion.join(',\n                       ')}, COUNT(*) OVER() AS Total
                FROM dbo.${VISTA_MAESTRO} v
                ${aplicaciones.join('\n                ')}
                WHERE ${condiciones.length ? condiciones.join('\n                  AND ') : '1 = 1'}
                ORDER BY ${orden}
                OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY;
            `);

        const filas = r.recordset || [];
        return {
            ok: true,
            filas,
            total: filas.length ? Number(filas[0].Total) : 0,
            pagina, tamano,
            fuenteDisponible: true
        };
    } catch (err) {
        return { ...respuestaError(err, 'listarMaestro'), filas: [], total: 0, pagina, tamano };
    }
}

/* Dominios distintos para el filtro, sin traer el maestro completo. */
async function listarDominios() {
    if (!(await existeObjeto(VISTA_MAESTRO))) return { ok: true, dominios: [], fuenteDisponible: false };
    /* Sin la columna no hay nada que listar: el filtro se queda en
       "Todos" en vez de tumbar la carga de la página. */
    if (!(await columnasDe(VISTA_MAESTRO)).has('Dominio')) {
        return { ok: true, dominios: [], fuenteDisponible: true };
    }
    try {
        const pool = await getPool();
        const r = await pool.request().query(`
            SELECT DISTINCT Dominio
            FROM dbo.${VISTA_MAESTRO}
            WHERE NULLIF(Dominio, N'') IS NOT NULL
            ORDER BY Dominio;
        `);
        return { ok: true, dominios: r.recordset.map(f => f.Dominio), fuenteDisponible: true };
    } catch (err) {
        return { ...respuestaError(err, 'listarDominios'), dominios: [] };
    }
}

/* =========================================================
   2. FICHA DEL ACTIVO
   ---------------------------------------------------------
   Cabecera con los nombres de catálogo ya resueltos (se reutiliza
   prepararNombresCatalogo de catalogos.js: la misma regla
   "nombre del catálogo con el texto como respaldo" que usa el
   resto del inventario) y las tres pestañas del detalle.
   Se carga on demand: el maestro nunca trae este volumen.
   ========================================================= */
async function obtenerFicha(idActivoFijoEQ) {
    const id = entero(idActivoFijoEQ);
    if (!id) return { ok: false, mensaje: 'Activo inválido.' };

    /* Sólo lo vigente: el histórico (Vigente = 0) ya no se muestra en la
       ficha ni en los buscadores cruzados. */
    const ficha = { ok: true, equipo: null, red: [], cuentas: [], programas: [], componentes: [], lotes: [], fuentes: {} };

    /* --- cabecera --- */
    try {
        const esp = await catalogosDB.prepararNombresCatalogo(
            'ActivoFijoEquipos',
            'af',
            catalogosDB.camposEspecificaciones3FN()
        );
        const pool = await getPool();
        const r = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT
                    af.IdActivoFijoEQ,
                    af.NoSerie,
                    af.IdMarca,        ma.Nombre AS Marca,
                    af.IdTipo,         ti.Nombre AS Tipo,
                    af.IdEstado,       es.Nombre AS Estado,
                    af.IdEstatus,      et.Nombre AS Estatus,
                    af.IdCartera,      ca.Nombre AS Cartera,
                    af.Observaciones,
                    /* Build del sistema operativo: lo escribe el colector en
                       ActivoFijoEquipos.BuildSO (nvarchar 20). Sin esta
                       columna la ficha no puede mostrar la versión exacta
                       del SO, que es lo que se revisa al dar soporte. */
                    af.BuildSO,
                    ${esp.columnas.join(',\n                    ')}
                FROM dbo.ActivoFijoEquipos af
                LEFT JOIN dbo.ActivoFijoMarcas   ma ON ma.IdMarca   = af.IdMarca
                LEFT JOIN dbo.ActivoFijoTipos    ti ON ti.IdTipo    = af.IdTipo
                LEFT JOIN dbo.ActivoFijoEstados  es ON es.IdEstado  = af.IdEstado
                LEFT JOIN dbo.ActivoFijoEstatus  et ON et.IdEstatus = af.IdEstatus
                LEFT JOIN dbo.ActivoFijoCarteras ca ON ca.IdCartera = af.IdCartera
                ${esp.joins.join('\n                ')}
                WHERE af.IdActivoFijoEQ = @Id;
            `);
        const fila = (r.recordset || [])[0];
        if (!fila) return { ok: false, mensaje: 'El activo ya no existe en el inventario.' };
        ficha.equipo = esp.aplicar(fila);
    } catch (err) {
        return respuestaError(err, 'obtenerFicha/cabecera');
    }

    /* --- pestañas: red, cuentas, programas, componentes --- */
    const pool = await getPool();

    if (await existeObjeto(TABLA_RED)) {
        try {
            const r = await pool.request()
                .input('Id', sql.Int, id)
                .query(`
                    SELECT IdEquipoRed, Hostname, Clave, NombreAdaptador, DescripcionAdaptador,
                           TipoMedio, MAC, IP, Mascara, PrefijoRed, PuertaEnlace, DHCP,
                           DNS1, DNS2, DNSSufijo, Dominio, DominioDNS, EsPrincipal,
                           Vigente, LoteEnvio, PrimeraDeteccion, UltimaDeteccion
                    FROM dbo.${TABLA_RED}
                    WHERE IdActivoFijoEQ = @Id
                      AND Vigente = 1
                    ORDER BY Vigente DESC, EsPrincipal DESC, UltimaDeteccion DESC;
                `);
            ficha.red = r.recordset;
            ficha.fuentes.red = true;
        } catch (err) { ficha.fuentes.red = false; console.error('[Detalle AF] red:', err.message); }
    } else ficha.fuentes.red = false;

    if (await existeObjeto(TABLA_CUENTAS)) {
        try {
            const r = await pool.request()
                .input('Id', sql.Int, id)
                .query(`
                    SELECT IdEquipoCuenta, TipoCuenta, Cuenta, NombreCompleto, Descripcion,
                           Dominio, DominioDNS, SID, Habilitada, UltimoAcceso, Perfil,
                           IP, MAC, Mascara, DNS1, DNS2, EsCuentaSesion,
                           Vigente, LoteEnvio, PrimeraDeteccion, UltimaDeteccion
                    FROM dbo.${TABLA_CUENTAS}
                    WHERE IdActivoFijoEQ = @Id
                      AND Vigente = 1
                    ORDER BY Vigente DESC, EsCuentaSesion DESC, TipoCuenta, Cuenta;
                `);
            ficha.cuentas = r.recordset;
            ficha.fuentes.cuentas = true;
        } catch (err) { ficha.fuentes.cuentas = false; console.error('[Detalle AF] cuentas:', err.message); }
    } else ficha.fuentes.cuentas = false;

    if (await existeObjeto(TABLA_PROGRAMAS)) {
        try {
            const r = await pool.request()
                .input('Id', sql.Int, id)
                .query(`
                    SELECT IdEquipoPrograma, Programa, Version, Fabricante, FechaInstalacion,
                           Ubicacion, Arquitectura, Alcance, Cuenta,
                           Vigente, LoteEnvio, PrimeraDeteccion, UltimaDeteccion
                    FROM dbo.${TABLA_PROGRAMAS}
                    WHERE IdActivoFijoEQ = @Id
                      AND Vigente = 1
                    ORDER BY Vigente DESC, Programa, Version;
                `);
            ficha.programas = r.recordset;
            ficha.fuentes.programas = true;
        } catch (err) { ficha.fuentes.programas = false; console.error('[Detalle AF] programas:', err.message); }
    } else ficha.fuentes.programas = false;

    /* Piezas conectadas al equipo (monitor externo, disco, teclado, ratón).
       Una fila por pieza física vigente; el histórico se pide explícito.
       Si la tabla no existe todavía, se devuelve la lista vacía. */
    if (await existeObjeto(TABLA_COMPONENTES)) {
        try {
            const extras = await columnasDiadema();
            const r = await pool.request()
                .input('Id', sql.Int, id)
                .query(`
                    SELECT IdEquipoComponente, TipoComponente, Clave, Marca, Modelo, Serie,
                           Identificador, IdentificadorTipo, Confianza, Cantidad, Detalles,
                           Vigente, LoteEnvio, PrimeraDeteccion, UltimaDeteccion,
                           ${extras}
                    FROM dbo.${TABLA_COMPONENTES} cp
                    WHERE cp.IdActivoFijoEQ = @Id
                      AND cp.Vigente = 1
                    ORDER BY Vigente DESC, TipoComponente, Marca, Modelo, IdEquipoComponente;
                `);
            ficha.componentes = r.recordset;
            ficha.fuentes.componentes = true;
        } catch (err) { ficha.fuentes.componentes = false; console.error('[Detalle AF] componentes:', err.message); }
    } else ficha.fuentes.componentes = false;

    /* --- lotes de envío (comparación de envíos del mismo activo) --- */
    if (ficha.fuentes.red || ficha.fuentes.cuentas || ficha.fuentes.programas || ficha.fuentes.componentes) {
        try {
            ficha.lotes = await lotesDeActivo(id);
        } catch (err) { console.error('[Detalle AF] lotes:', err.message); }
    }

    return ficha;
}

/* =========================================================
   DETALLE COMPLETO DE UN ACTIVO (red, cuentas, programas y piezas)
   ---------------------------------------------------------
   El "Ver" del inventario activo necesita todo eso junto, así que se
   reutiliza obtenerFicha() para traer, con la MISMA regla Vigente = 1,
   la red (WiFi/Ethernet), las cuentas, los programas y las piezas
   conectadas. Así el modal del inventario y la ficha del módulo
   Detalle nunca pueden discrepar. */
async function detalleDeActivo(idActivoFijoEQ) {
    const ficha = await obtenerFicha(idActivoFijoEQ);
    if (!ficha || ficha.ok === false) {
        return {
            ok: false,
            mensaje: (ficha && ficha.mensaje) || 'No se pudo leer el detalle del activo.',
            equipo: null,
            red: [], cuentas: [], programas: [], componentes: [], lotes: [],
            fuentes: (ficha && ficha.fuentes) || {}
        };
    }
    return {
        ok: true,
        /* La cabecera viaja con el detalle: ahí viene lo que sólo está en
           ActivoFijoEquipos y no en el listado (BuildSO y los nombres de
           catálogo ya resueltos). Así la ficha del inventario muestra el
           build sin una segunda consulta. */
        equipo: ficha.equipo || null,
        red: ficha.red || [],
        cuentas: ficha.cuentas || [],
        programas: ficha.programas || [],
        componentes: ficha.componentes || [],
        /* Envíos del colector (agrupados por LoteEnvio): la ficha del
           inventario los usa para su página "Envíos", que responde "qué
           llegó en cada recolección y cuándo" sin abrir la tabla completa. */
        lotes: ficha.lotes || [],
        fuentes: ficha.fuentes || {}
    };
}

/* Agrupa por LoteEnvio: cuántos adaptadores, cuentas y programas
   llegaron en cada envío y en qué fechas. Es el "comparación por
   LoteEnvio" del requisito, sin traer los binarios de cada fila. */
async function lotesDeActivo(idActivoFijoEQ) {
    const pool = await getPool();
    const partes = [];
    if (await existeObjeto(TABLA_RED))
        partes.push(`SELECT LoteEnvio, 'Red' AS Tipo, COUNT(*) AS Total,
                            MIN(PrimeraDeteccion) AS Primera, MAX(UltimaDeteccion) AS Ultima
                     FROM dbo.${TABLA_RED} WHERE IdActivoFijoEQ = @Id AND LoteEnvio IS NOT NULL
                     GROUP BY LoteEnvio`);
    if (await existeObjeto(TABLA_CUENTAS))
        partes.push(`SELECT LoteEnvio, 'Cuentas' AS Tipo, COUNT(*) AS Total,
                            MIN(PrimeraDeteccion) AS Primera, MAX(UltimaDeteccion) AS Ultima
                     FROM dbo.${TABLA_CUENTAS} WHERE IdActivoFijoEQ = @Id AND LoteEnvio IS NOT NULL
                     GROUP BY LoteEnvio`);
    if (await existeObjeto(TABLA_PROGRAMAS))
        partes.push(`SELECT LoteEnvio, 'Programas' AS Tipo, COUNT(*) AS Total,
                            MIN(PrimeraDeteccion) AS Primera, MAX(UltimaDeteccion) AS Ultima
                     FROM dbo.${TABLA_PROGRAMAS} WHERE IdActivoFijoEQ = @Id AND LoteEnvio IS NOT NULL
                     GROUP BY LoteEnvio`);
    if (await existeObjeto(TABLA_COMPONENTES))
        partes.push(`SELECT LoteEnvio, 'Componentes' AS Tipo, COUNT(*) AS Total,
                            MIN(PrimeraDeteccion) AS Primera, MAX(UltimaDeteccion) AS Ultima
                     FROM dbo.${TABLA_COMPONENTES} WHERE IdActivoFijoEQ = @Id AND LoteEnvio IS NOT NULL
                     GROUP BY LoteEnvio`);
    if (partes.length === 0) return [];

    const r = await pool.request()
        .input('Id', sql.Int, entero(idActivoFijoEQ))
        .query(`
            WITH datos AS (${partes.join(' UNION ALL ')})
            SELECT LoteEnvio,
                   SUM(CASE WHEN Tipo = 'Red'         THEN Total ELSE 0 END) AS Red,
                   SUM(CASE WHEN Tipo = 'Cuentas'     THEN Total ELSE 0 END) AS Cuentas,
                   SUM(CASE WHEN Tipo = 'Programas'   THEN Total ELSE 0 END) AS Programas,
                   SUM(CASE WHEN Tipo = 'Componentes' THEN Total ELSE 0 END) AS Componentes,
                   MIN(Primera) AS PrimeraDeteccion,
                   MAX(Ultima)  AS UltimaDeteccion
            FROM datos
            GROUP BY LoteEnvio
            ORDER BY MAX(Ultima) DESC;
        `);
    return r.recordset;
}

/* =========================================================
   3. BUSCADORES CRUZADOS
   ---------------------------------------------------------
   a) ¿En qué equipos está X programa y en qué versión?
   b) ¿Qué cuentas de dominio existen y en qué equipos?
   c) ¿Qué MAC/IP tiene tal hostname?
   Todos con Vigente = 1 (el histórico no se muestra) y paginados en
   el servidor.
   ========================================================= */
async function buscarPrograma(opciones = {}) {
    const nombre = texto(opciones.programa);
    if (!nombre) return { ok: true, filas: [], total: 0, resumenVersiones: [], fuenteDisponible: true };
    if (!(await existeObjeto(TABLA_PROGRAMAS))) {
        return { ok: true, filas: [], total: 0, resumenVersiones: [], fuenteDisponible: false,
                 mensaje: `La tabla dbo.${TABLA_PROGRAMAS} aún no existe. Ejecuta ${SCRIPT}.` };
    }

    const { pagina, tamano, offset } = normalizarPaginacion(opciones);
    const patron = `%${nombre}%`;
    const soloNombre = opciones.coincidenciaExacta ? nombre : patron;
    const version = texto(opciones.version);

    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('Programa', sql.NVarChar(300), soloNombre)
            .input('Version', sql.NVarChar(100), version ? `%${version}%` : null)
            .input('Offset', sql.Int, offset)
            .input('Tamano', sql.Int, tamano)
            .query(`
                SELECT p.Programa, p.Version, p.Fabricante, p.Alcance, p.Cuenta,
                       p.IdActivoFijoEQ, p.NoSerie, p.Hostname,
                       p.Vigente, p.UltimaDeteccion, p.LoteEnvio,
                       COUNT(*) OVER() AS Total
                FROM dbo.${TABLA_PROGRAMAS} p
                WHERE p.Programa LIKE @Programa
                  AND (@Version IS NULL OR p.Version LIKE @Version)
                  AND p.Vigente = 1
                ORDER BY p.Programa, p.Version, p.NoSerie
                OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY;
            `);

        const filas = r.recordset || [];
        const total = filas.length ? Number(filas[0].Total) : 0;

        /* Resumen por versión: responde "y en qué versión" de un vistazo. */
        let resumenVersiones = [];
        if (total) {
            const rv = await pool.request()
                .input('Programa', sql.NVarChar(300), soloNombre)
                .query(`
                    SELECT TOP (30) p.Programa, ISNULL(p.Version, N'(sin versión)') AS Version,
                           COUNT(DISTINCT p.IdActivoFijoEQ) AS Equipos
                    FROM dbo.${TABLA_PROGRAMAS} p
                    WHERE p.Programa LIKE @Programa
                      AND p.Vigente = 1
                    GROUP BY p.Programa, p.Version
                    ORDER BY COUNT(DISTINCT p.IdActivoFijoEQ) DESC;
                `);
            resumenVersiones = rv.recordset;
        }

        return { ok: true, filas, total, pagina, tamano, resumenVersiones, fuenteDisponible: true };
    } catch (err) {
        return { ...respuestaError(err, 'buscarPrograma'), filas: [], total: 0, resumenVersiones: [] };
    }
}

async function buscarCuenta(opciones = {}) {
    const patron = like(opciones.cuenta);
    if (!patron) return { ok: true, filas: [], total: 0, fuenteDisponible: true };
    if (!(await existeObjeto(TABLA_CUENTAS))) {
        return { ok: true, filas: [], total: 0, fuenteDisponible: false,
                 mensaje: `La tabla dbo.${TABLA_CUENTAS} aún no existe. Ejecuta ${SCRIPT}.` };
    }

    const { pagina, tamano, offset } = normalizarPaginacion(opciones);
    const tipo = texto(opciones.tipo).toUpperCase();
    const tipoValido = tipo === 'LOCAL' || tipo === 'DOMINIO' ? tipo : null;

    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('Cuenta', sql.NVarChar(200), patron)
            .input('Tipo', sql.VarChar(10), tipoValido)
            .input('Offset', sql.Int, offset)
            .input('Tamano', sql.Int, tamano)
            .query(`
                SELECT c.IdActivoFijoEQ, c.NoSerie, c.Hostname, c.TipoCuenta, c.Cuenta,
                       c.NombreCompleto, c.Dominio, c.Habilitada, c.EsCuentaSesion,
                       c.UltimoAcceso, c.Perfil, c.Vigente, c.UltimaDeteccion,
                       COUNT(*) OVER() AS Total
                FROM dbo.${TABLA_CUENTAS} c
                WHERE (c.Cuenta LIKE @Cuenta OR c.NombreCompleto LIKE @Cuenta)
                  AND (@Tipo IS NULL OR c.TipoCuenta = @Tipo)
                  AND c.Vigente = 1
                ORDER BY c.Cuenta, c.NoSerie
                OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY;
            `);
        const filas = r.recordset || [];
        return {
            ok: true, filas,
            total: filas.length ? Number(filas[0].Total) : 0,
            pagina, tamano, fuenteDisponible: true
        };
    } catch (err) {
        return { ...respuestaError(err, 'buscarCuenta'), filas: [], total: 0 };
    }
}

async function buscarHost(opciones = {}) {
    const patron = like(opciones.hostname);
    if (!patron) return { ok: true, filas: [], total: 0, fuenteDisponible: true };
    if (!(await existeObjeto(TABLA_RED))) {
        return { ok: true, filas: [], total: 0, fuenteDisponible: false,
                 mensaje: `La tabla dbo.${TABLA_RED} aún no existe. Ejecuta ${SCRIPT}.` };
    }

    const { pagina, tamano, offset } = normalizarPaginacion(opciones);
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('Hostname', sql.NVarChar(100), patron)
            .input('Offset', sql.Int, offset)
            .input('Tamano', sql.Int, tamano)
            .query(`
                SELECT r.IdActivoFijoEQ, r.NoSerie, r.Hostname, r.IP, r.MAC, r.Mascara,
                       r.PuertaEnlace, r.DNS1, r.DNS2, r.DHCP, r.Dominio, r.DominioDNS,
                       r.NombreAdaptador, r.EsPrincipal, r.Vigente, r.UltimaDeteccion,
                       COUNT(*) OVER() AS Total
                FROM dbo.${TABLA_RED} r
                WHERE (r.Hostname LIKE @Hostname OR r.MAC LIKE @Hostname OR r.IP LIKE @Hostname)
                  AND r.Vigente = 1
                ORDER BY r.Hostname, r.EsPrincipal DESC, r.UltimaDeteccion DESC
                OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY;
            `);
        const filas = r.recordset || [];
        return {
            ok: true, filas,
            total: filas.length ? Number(filas[0].Total) : 0,
            pagina, tamano, fuenteDisponible: true
        };
    } catch (err) {
        return { ...respuestaError(err, 'buscarHost'), filas: [], total: 0 };
    }
}

/* ---------------------------------------------------------
   d) ¿A qué equipo pertenece esta pieza?  (monitor, disco,
      teclado, ratón)
   Busca por serie, identificador (VID/PID o modelo), marca,
   modelo o la clave de la pieza, y devuelve siempre el EQUIPO
   PADRE: la pieza nunca se trata como un activo suelto.
   --------------------------------------------------------- */
async function buscarComponente(opciones = {}) {
    const patron = like(opciones.componente || opciones.serie || opciones.identificador);
    if (!patron) return { ok: true, filas: [], total: 0, resumenTipos: [], fuenteDisponible: true };
    if (!(await existeObjeto(TABLA_COMPONENTES))) {
        return { ok: true, filas: [], total: 0, resumenTipos: [], fuenteDisponible: false,
                 mensaje: `La tabla dbo.${TABLA_COMPONENTES} aún no existe. Ejecuta ${SCRIPT}.` };
    }

    const { pagina, tamano, offset } = normalizarPaginacion(opciones);
    const tipo = texto(opciones.tipo).toUpperCase();
    const tipoValido = TIPOS_COMPONENTE.includes(tipo) ? tipo : null;

    try {
        const pool = await getPool();
        const extras = await columnasDiadema();
        const r = await pool.request()
            .input('Componente', sql.NVarChar(300), patron)
            .input('Tipo', sql.VarChar(20), tipoValido)
            .input('Offset', sql.Int, offset)
            .input('Tamano', sql.Int, tamano)
            .query(`
                SELECT cp.IdEquipoComponente, cp.TipoComponente, cp.Clave,
                       cp.Marca, cp.Modelo, cp.Serie, cp.Identificador,
                       cp.IdentificadorTipo, cp.Confianza, cp.Cantidad, cp.Detalles,
                       cp.IdActivoFijoEQ, cp.NoSerie, cp.Hostname,
                       cp.Vigente, cp.UltimaDeteccion, cp.LoteEnvio,
                       ${extras},
                       COUNT(*) OVER() AS Total
                FROM dbo.${TABLA_COMPONENTES} cp
                WHERE (cp.Serie LIKE @Componente
                       OR cp.Clave LIKE @Componente
                       OR cp.Identificador LIKE @Componente
                       OR cp.Modelo LIKE @Componente
                       OR cp.Marca LIKE @Componente)
                  AND (@Tipo IS NULL OR cp.TipoComponente = @Tipo)
                  AND cp.Vigente = 1
                ORDER BY cp.TipoComponente, cp.Marca, cp.Modelo, cp.NoSerie
                OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY;
            `);

        const filas = r.recordset || [];
        const total = filas.length ? Number(filas[0].Total) : 0;

        /* Resumen por tipo: "hay 300 monitores, 512 discos…". Responde de
           un vistazo qué se buscó y evita abrir la paginación para saberlo. */
        let resumenTipos = [];
        if (total) {
            const rt = await pool.request()
                .input('Componente', sql.NVarChar(300), patron)
                .query(`
                    SELECT cp.TipoComponente,
                           COUNT(*) AS Piezas,
                           COUNT(DISTINCT cp.IdActivoFijoEQ) AS Equipos
                    FROM dbo.${TABLA_COMPONENTES} cp
                    WHERE (cp.Serie LIKE @Componente
                           OR cp.Clave LIKE @Componente
                           OR cp.Identificador LIKE @Componente
                           OR cp.Modelo LIKE @Componente
                           OR cp.Marca LIKE @Componente)
                      AND cp.Vigente = 1
                    GROUP BY cp.TipoComponente
                    ORDER BY COUNT(*) DESC;
                `);
            resumenTipos = rt.recordset;
        }

        return { ok: true, filas, total, pagina, tamano, resumenTipos, fuenteDisponible: true };
    } catch (err) {
        return { ...respuestaError(err, 'buscarComponente'), filas: [], total: 0, resumenTipos: [] };
    }
}

module.exports = {
    estadoFuentes,
    listarMaestro,
    listarDominios,
    obtenerFicha,
    detalleDeActivo,
    buscarPrograma,
    buscarCuenta,
    buscarHost,
    buscarComponente,
    SCRIPT
};
