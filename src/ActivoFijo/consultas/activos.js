/* =========================================================
   ACTIVO FIJO — CRUD DE EQUIPOS (inventario físico)
   Soft delete + Exportación a Excel con estilos Poppins
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');
const ExcelJS = require('exceljs');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { dialog } = require('electron');
const catalogosDB = require('./catalogos');

/* Campos que en la tabla eran texto y ahora son FK al catálogo:
   [campo del formulario, clave de catálogo, columna FK, longitud del texto] */
const CAMPOS_CATALOGO_ESPECIFICACIONES = [
    ['Modelo',           'modelos',           'IdModelo',           150],
    ['Procesador',       'procesadores',      'IdProcesador',       150],
    ['MemoriaRAM',       'memoriasRam',       'IdMemoriaRAM',       50],
    ['Almacenamiento',   'almacenamientos',   'IdAlmacenamiento',   50],
    ['SistemaOperativo', 'sistemasOperativos', 'IdSistemaOperativo', 100],
    ['UsuarioAsignado',  'usuariosAsignados', 'IdUsuarioAsignado',  200]
];

/* Accesorios es una relación N:M: un activo lleva varios conjuntos del
   catálogo, así que vive en la tabla puente ActivoFijoEquiposAccesorios
   (ver catalogos.js). La celda de texto anterior queda sólo como respaldo
   de las filas viejas. */
const CAMPO_ACCESORIOS = 'Accesorios';

/* Columnas de texto que la fase 2 de scripts/activo-fijo-3fn.sql elimina
   en cuanto su FK las respalda. Las escrituras las piden sólo si siguen
   existiendo, así el alta y la edición funcionan antes y después de la
   limpieza. */
const TEXTOS_RESPALDO_EQUIPO = new Set([
    ...CAMPOS_CATALOGO_ESPECIFICACIONES.map(c => c[0]),
    CAMPO_ACCESORIOS
]);

async function columnasTextoEquipo() {
    return catalogosDB.columnasExistentes('ActivoFijoEquipos', [...TEXTOS_RESPALDO_EQUIPO]);
}

/* JOINs y columnas para leer las especificaciones por catálogo (3FN). La
   regla "nombre del catálogo, con el texto como respaldo mientras la columna
   siga existiendo" vive en catalogos.js, que la comparte con responsivas. */
async function prepararLecturaEspecificaciones() {
    return catalogosDB.prepararNombresCatalogo(
        'ActivoFijoEquipos',
        'af',
        catalogosDB.camposEspecificaciones3FN()
    );
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

/* Resuelve cada campo de catálogo a su Id.
   Devuelve { ids, textos }:
     - ids:    { IdModelo: 12, ... }  sólo las claves presentes en los datos
     - textos: { Modelo: 'HP', ... }  el texto recortado
   Si el valor no existe en el catálogo se da de alta; si estaba dado
   de baja, se reactiva. Eso es lo que permite capturar un usuario
   asignado nuevo directo en el formulario del activo, sin tener que
   ir antes a Catálogos a crearlo ni a restaurarlo. */
async function resolverEspecificaciones(datos) {
    const ids = {};
    const textos = {};

    for (const [campo, clave, fk] of CAMPOS_CATALOGO_ESPECIFICACIONES) {
        /* La UI puede mandar la FK ya resuelta (los <select> por Id, como el
           de sistemas operativos, donde el nombre puede repetirse con
           distintos builds). En ese caso manda la FK y no se busca por
           texto, para no re-apuntar el equipo a otra fila del catálogo. */
        if (datos[fk] !== undefined) {
            ids[fk] = datos[fk] === null ? null : (Number(datos[fk]) || null);
            if (datos[campo] !== undefined) {
                const textoFk = datos[campo] === null ? '' : String(datos[campo]).trim();
                textos[campo] = textoFk || null;
            }
            continue;
        }

        if (datos[campo] === undefined) continue;

        const texto = datos[campo] === null ? '' : String(datos[campo]).trim();
        textos[campo] = texto || null;

        /* El sistema operativo se identifica por Nombre + BuildSO: si el
           llamador envía el build, se usa para desambiguar. */
        const build = campo === 'SistemaOperativo' ? datos.BuildSO : undefined;
        ids[fk] = texto ? await catalogosDB.resolverId(clave, texto, build) : null;
    }

    return { ids, textos };
}

/* =========================================================
   PIEZAS CONECTADAS POR ACTIVO (modelo padre / hijo)
   ---------------------------------------------------------
   El CPU, AIO o laptop es el ACTIVO y cuenta como 1 en el
   inventario; sus monitores, discos, teclados y ratones viven en
   dbo.ActivoFijoEquiposComponentes colgados de su IdActivoFijoEQ.
   Aquí sólo se CUENTA cuántas piezas vigentes tiene cada equipo
   para poder mostrarlo en el listado, sin convertirlas en activos
   (el total del inventario no cambia). Si la tabla no existe
   (esquema viejo) devuelve un mapa vacío: el listado nunca se cae.

   Además del conteo por tipo se devuelve cada pieza con su identidad
   (Clave / Serie / Identificador + Marca y Modelo) porque el Excel del
   inventario tiene que decir QUÉ monitores, discos, teclados y ratones
   cuelgan de cada activo, no sólo cuántos.
   ========================================================= */
async function piezasPorActivo(pool) {
    const mapa = new Map();
    try {
        if (!(await catalogosDB.tablaExiste('ActivoFijoEquiposComponentes'))) return mapa;

        /* La tabla puente creció por fases (diadema, MAC, estado), así que
           sólo se piden las columnas de identidad que existen de verdad:
           una base atrasada no puede tumbar el listado. */
        const cols = await catalogosDB.columnasExistentes('ActivoFijoEquiposComponentes',
            ['TipoComponente', 'Clave', 'Marca', 'Modelo', 'Serie',
             'Identificador', 'IdentificadorTipo', 'Cantidad']);
        const col = (nombre, tipo = 'NVARCHAR(300)') =>
            cols.has(nombre) ? `cp.${nombre}` : `CAST(NULL AS ${tipo}) AS ${nombre}`;

        /* Una fila puede representar N discos idénticos (misma Clave) y el
           inventario debe contar unidades físicas, no filas: la Cantidad
           se suma aquí en vez de en SQL porque también viaja por pieza.
           Cantidad tiene DEFAULT (1). */
        const r = await pool.request().query(`
            SELECT cp.IdActivoFijoEQ,
                   ${col('TipoComponente', 'VARCHAR(40)')},
                   ${col('Clave')},
                   ${col('Marca', 'NVARCHAR(150)')},
                   ${col('Modelo', 'NVARCHAR(150)')},
                   ${col('Serie', 'NVARCHAR(150)')},
                   ${col('Identificador')},
                   ${col('IdentificadorTipo', 'VARCHAR(40)')},
                   ${cols.has('Cantidad') ? 'ISNULL(cp.Cantidad, 1)' : '1'} AS Cantidad
            FROM dbo.ActivoFijoEquiposComponentes cp
            WHERE cp.Vigente = 1
            ORDER BY cp.IdActivoFijoEQ`);

        for (const f of r.recordset || []) {
            const id = Number(f.IdActivoFijoEQ) || 0;
            if (!mapa.has(id)) mapa.set(id, { total: 0, tipos: [], piezas: [] });
            const entrada = mapa.get(id);
            const tipo = String(f.TipoComponente || 'OTRO').toUpperCase();
            const cuantas = Number(f.Cantidad) || 1;
            entrada.total += cuantas;

            entrada.piezas.push({
                TipoComponente: tipo,
                Cantidad: cuantas,
                Clave: f.Clave || null,
                Marca: f.Marca || null,
                Modelo: f.Modelo || null,
                Serie: f.Serie || null,
                Identificador: f.Identificador || null,
                IdentificadorTipo: f.IdentificadorTipo || null
            });

            /* Un solo renglón por tipo en el desglose ("2 discos duros"),
               sumando las filas que compartan TipoComponente. */
            const resumen = entrada.tipos.find(t => t.tipo === tipo);
            if (resumen) resumen.cuantas += cuantas;
            else entrada.tipos.push({ tipo, cuantas });
        }
    } catch (err) {
        /* Best-effort: el conteo de piezas no puede impedir listar el
           inventario (p. ej. permisos o tabla renombrada). */
        return new Map();
    }
    return mapa;
}

/* =========================================================
   CONTEXTO AUTOMÁTICO POR HOSTNAME
   ---------------------------------------------------------
   El hostname que deja el collector ya dice de quién es el equipo:
   el formato es {ROL}-{CODIGOCLIENTE}{numero}, así que AGT-TOY156
   es un equipo del rol AGT del cliente TOY (TOYOTA) número 156.
   Aquí se decodifica ese prefijo y se cruza con Clientes y
   ActivoFijoCarteras para deducir la cartera SIN mapa hardcodeado:
   el vínculo es el nombre (TOY → TOYOTA → cartera TOYOTA).
   Lo que no pertenece a ninguna cartera sigue siendo activo general
   y queda en el sitio por defecto (COPERVA).
   ========================================================= */
const SITIO_POR_DEFECTO = 'COPERVA';

let tablaRedCache = null;
async function tablaRedDisponible(pool) {
    if (tablaRedCache !== null) return tablaRedCache;
    try {
        const r = await pool.request().query(
            "SELECT CASE WHEN OBJECT_ID('dbo.ActivoFijoEquiposRed','U') IS NULL THEN 0 ELSE 1 END AS Existe");
        tablaRedCache = !!(r.recordset && r.recordset[0] && r.recordset[0].Existe);
    } catch (_) {
        tablaRedCache = false;
    }
    return tablaRedCache;
}

/* ¿La tabla de red tiene esta columna? El esquema del collector puede ser
   más viejo que la app: sin `Dominio` se sigue mostrando el hostname. */
let columnasRedCache = null;
async function columnaEnRed(pool, nombre) {
    if (!columnasRedCache) {
        try {
            const r = await pool.request().query(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ActivoFijoEquiposRed'");
            const set = new Set();
            for (const f of r.recordset || []) set.add(String(f.COLUMN_NAME ?? '').toUpperCase());
            if (set.size) columnasRedCache = set;
        } catch (_) { /* sin metadatos se asume el esquema mínimo */ }
    }
    return columnasRedCache ? columnasRedCache.has(String(nombre ?? '').toUpperCase()) : false;
}

/* Hostname (y dominio) del adaptador principal de cada activo. OUTER APPLY y
   no JOIN: un equipo con varias tarjetas (Ethernet + WiFi) debe salir una
   sola vez. Si la tabla de red no existe todavía, la consulta no se cae. */
function aplicarHostname(disponible, conDominio = false) {
    if (!disponible) {
        return {
            columna: conDominio
                ? 'CAST(NULL AS nvarchar(200)) AS Hostname, CAST(NULL AS nvarchar(200)) AS Dominio'
                : 'CAST(NULL AS nvarchar(200)) AS Hostname',
            join: ''
        };
    }
    return {
        columna: conDominio ? 'red.Hostname, red.Dominio' : 'red.Hostname',
        join: `OUTER APPLY (
            SELECT TOP 1 r.Hostname${conDominio ? ', r.Dominio' : ''}
            FROM ActivoFijoEquiposRed r
            WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
              AND r.Hostname IS NOT NULL
              AND LTRIM(RTRIM(r.Hostname)) <> ''
            ORDER BY r.EsPrincipal DESC, r.IdEquipoRed DESC
        ) red`
    };
}

/* Código de cliente escondido en el hostname:
   AGT-TOY156 → TOY · DANIEL-REDES → REDES · HP-AVHELL → AVHELL */
function codigoClienteDeHostname(hostname) {
    const texto = String(hostname ?? '').trim().toUpperCase();
    if (!texto) return null;
    const guion = texto.indexOf('-');
    const resto = guion === -1 ? texto : texto.slice(guion + 1);
    const letras = /^[A-Z]+/.exec(resto);
    return letras ? letras[0] : null;
}

/* Clientes + carteras + sitios en un solo viaje: es la tabla de verdad
   para decidir a qué cartera pertenece un hostname. */
async function contextoClientes(pool) {
    const mapa = { porCodigo: new Map(), codigos: [], idSitioPorDefecto: null };
    try {
        const [cli, car, sit] = await Promise.all([
            pool.request().query('SELECT Codigo, Nombre FROM Clientes'),
            pool.request().query('SELECT IdCartera, Nombre FROM ActivoFijoCarteras WHERE Activo = 1'),
            pool.request().query('SELECT IdSitio, Nombre FROM ActivoFijoSitios WHERE Activo = 1')
        ]);

        const carteraPorNombre = new Map();
        for (const c of car.recordset || []) {
            carteraPorNombre.set(String(c.Nombre ?? '').trim().toUpperCase(), c.IdCartera);
        }

        for (const c of cli.recordset || []) {
            const codigo = String(c.Codigo ?? '').trim().toUpperCase();
            if (!codigo) continue;
            mapa.porCodigo.set(codigo, {
                codigo,
                cliente: c.Nombre,
                idCartera: carteraPorNombre.get(String(c.Nombre ?? '').trim().toUpperCase()) ?? null
            });
        }

        /* Los códigos largos primero: ADAMAHP debe ganarle a ADAMA. */
        mapa.codigos = [...mapa.porCodigo.keys()].sort((a, b) => b.length - a.length);

        for (const s of sit.recordset || []) {
            if (String(s.Nombre ?? '').trim().toUpperCase() === SITIO_POR_DEFECTO) {
                mapa.idSitioPorDefecto = s.IdSitio;
                break;
            }
        }
    } catch (err) {
        /* Sin catálogos de clientes la inferencia simplemente no opina. */
        return mapa;
    }
    return mapa;
}

/* Traduce un hostname a su cliente/cartera. Devuelve nulls cuando el
   prefijo no corresponde a ningún cliente del catálogo. */
function inferirDeHostname(hostname, mapa) {
    const codigo = codigoClienteDeHostname(hostname);
    const vacio = { hostname: hostname || null, codigo: codigo, cliente: null, idCartera: null };

    if (!codigo || !mapa || !mapa.porCodigo) return vacio;

    let info = mapa.porCodigo.get(codigo) || null;
    if (!info) {
        /* Respaldo: prefijo más largo que coincida (códigos con número). */
        for (const c of mapa.codigos) {
            if (codigo.startsWith(c)) { info = mapa.porCodigo.get(c); break; }
        }
    }

    if (!info) return vacio;
    return { hostname: hostname || null, codigo: info.codigo, cliente: info.cliente, idCartera: info.idCartera };
}

/* Hostname ya guardado de un activo (para no pedirlo al usuario). */
async function hostnameDeActivo(pool, id) {
    if (!(await tablaRedDisponible(pool))) return null;
    try {
        const r = await pool.request()
            .input('Id', sql.Int, id)
            .query(`SELECT TOP 1 Hostname
                    FROM ActivoFijoEquiposRed
                    WHERE IdActivoFijoEQ = @Id
                      AND Hostname IS NOT NULL AND LTRIM(RTRIM(Hostname)) <> ''
                    ORDER BY EsPrincipal DESC, IdEquipoRed DESC`);
        return r.recordset[0]?.Hostname ?? null;
    } catch (_) {
        return null;
    }
}

/* Cartera deducida del hostname + sitio por defecto (COPERVA). Nunca
   pisa lo que el usuario capturó a mano. */
async function resolverContextoActivo(pool, datos, hostnameGuardado = null) {
    const mapa = await contextoClientes(pool);
    const hostname = datos?.Hostname || hostnameGuardado || null;
    const inferido = hostname ? inferirDeHostname(hostname, mapa) : null;
    return {
        hostname,
        inferido,
        idCartera: datos?.IdCartera || inferido?.idCartera || null,
        idSitio: datos?.IdSitio || mapa.idSitioPorDefecto || null,
        idSitioPorDefecto: mapa.idSitioPorDefecto
    };
}

/* Qué cartera / sitio / cliente sugiere el hostname ya guardado de un
   activo. Alimenta el "auto-relleno" del formulario de edición. */
async function inferirContexto(id) {
    try {
        const pool = await getPool();
        const hostname = await hostnameDeActivo(pool, id);
        const mapa = await contextoClientes(pool);
        const inf = hostname
            ? inferirDeHostname(hostname, mapa)
            : { hostname: null, codigo: null, cliente: null, idCartera: null };

        return {
            ok: true,
            hostname,
            codigo: inf.codigo,
            cliente: inf.cliente,
            idCartera: inf.idCartera,
            idSitioPorDefecto: mapa.idSitioPorDefecto,
            sitioPorDefecto: SITIO_POR_DEFECTO
        };
    } catch (err) {
        return { ok: false, mensaje: 'No se pudo inferir el contexto: ' + err.message };
    }
}

/* Relleno masivo: recorre los activos que ya tienen hostname y les pone
   la cartera deducida del prefijo y el sitio por defecto (COPERVA).
   Nunca pisa un valor capturado a mano, así que se puede correr las
   veces que haga falta: sólo toca las filas con el campo vacío. */
async function autoasignar() {
    try {
        const pool = await getPool();
        const red = aplicarHostname(await tablaRedDisponible(pool));
        if (!red.join) {
            return {
                ok: false,
                mensaje: 'Todavía no hay tabla de red (ActivoFijoEquiposRed): el collector aún no ha cargado hostnames.'
            };
        }

        const mapa = await contextoClientes(pool);
        const r = await pool.request().query(`
            SELECT af.IdActivoFijoEQ, af.IdCartera, af.IdSitio, ${red.columna}
            FROM ActivoFijoEquipos af
            ${red.join}
            WHERE red.Hostname IS NOT NULL`);

        const filas = r.recordset || [];
        let actualizados = 0;
        let sinCliente = 0;
        let conCartera = 0;

        for (const f of filas) {
            const inf = inferirDeHostname(f.Hostname, mapa);
            if (!inf.idCartera) sinCliente++;

            const idCartera = f.IdCartera || inf.idCartera || null;
            const idSitio = f.IdSitio || mapa.idSitioPorDefecto || null;

            const sets = [];
            const req = pool.request().input('Id', sql.Int, f.IdActivoFijoEQ);
            if (!f.IdCartera && idCartera) {
                req.input('IdCartera', sql.Int, idCartera);
                sets.push('IdCartera = @IdCartera');
            }
            if (!f.IdSitio && idSitio) {
                req.input('IdSitio', sql.Int, idSitio);
                sets.push('IdSitio = @IdSitio');
            }
            if (sets.length === 0) continue;

            await req.query(
                `UPDATE ActivoFijoEquipos
                 SET ${sets.join(', ')}, FechaModificacion = GETDATE()
                 WHERE IdActivoFijoEQ = @Id`);
            actualizados++;
            if (inf.idCartera) conCartera++;
        }

        return {
            ok: true,
            total: filas.length,
            actualizados,
            conCartera,
            sinCliente,
            mensaje: `Se actualizaron ${actualizados} de ${filas.length} equipos con hostname (${conCartera} con cartera, ${sinCliente} sin cliente en el prefijo).`
        };
    } catch (err) {
        return { ok: false, mensaje: 'Error al autoasignar: ' + err.message };
    }
}

/* Contexto reutilizable por la importación masiva: deduce cartera desde un
   hostname y aporta el sitio por defecto (COPERVA), con la misma tabla de
   verdad que usa el alta manual. Así el importador no duplica la lógica. */
async function contextoParaImportacion() {
    try {
        const pool = await getPool();
        const mapa = await contextoClientes(pool);
        return {
            ok: true,
            sitioPorDefecto: SITIO_POR_DEFECTO,
            idSitioPorDefecto: mapa.idSitioPorDefecto,
            inferir: hostname => inferirDeHostname(hostname, mapa)
        };
    } catch (err) {
        return {
            ok: false,
            sitioPorDefecto: SITIO_POR_DEFECTO,
            idSitioPorDefecto: null,
            inferir: hostname => ({ hostname: hostname || null, codigo: null, cliente: null, idCartera: null }),
            mensaje: err.message
        };
    }
}

/* =========================================================
   LISTAR
   ========================================================= */
async function listar(filtros = {}) {
    const pool = await getPool();
    await catalogosDB.asegurarCatalogosExtendidos();
    const request = pool.request();
    const red = aplicarHostname(await tablaRedDisponible(pool), await columnaEnRed(pool, 'Dominio'));

    let where = '1=1';
    if (filtros.idTipo)    { where += ' AND af.IdTipo = @IdTipo';        request.input('IdTipo',    sql.Int, filtros.idTipo); }
    if (filtros.idEstado)  { where += ' AND af.IdEstado = @IdEstado';    request.input('IdEstado',  sql.Int, filtros.idEstado); }
    if (filtros.idCartera) { where += ' AND af.IdCartera = @IdCartera';  request.input('IdCartera', sql.Int, filtros.idCartera); }
    if (filtros.idSitio)   { where += ' AND af.IdSitio = @IdSitio';      request.input('IdSitio',   sql.Int, filtros.idSitio); }

    if (filtros.soloEliminados) {
        where += " AND st.Nombre = 'BAJA'";
    } else if (filtros.idEstatus) {
        where += ' AND af.IdEstatus = @IdEstatus';
        request.input('IdEstatus', sql.Int, filtros.idEstatus);
    } else {
        where += " AND st.Nombre <> 'BAJA'";
    }

    const lectura = catalogosDB.unirNombresCatalogo(
        await prepararLecturaEspecificaciones(),
        await catalogosDB.prepararAccesoriosEquipo('af')
    );

    /* La compilación del SO (BuildSO) es atributo del catálogo (Nombre +
       BuildSO); se lee por la FK del equipo con el alias que arma
       prepararNombresCatalogo (catSistemaOperativo), así el listado
       distingue "Windows 10 21H2" de "Windows 10 22H2". Defensivo mientras
       el script de migración no corra. */
    const columnasSO = await catalogosDB.columnasExistentes('ActivoFijoSistemasOperativos', ['BuildSO']);
    const buildSOExpr = columnasSO.has('BuildSO')
        ? 'catSistemaOperativo.BuildSO'
        : 'CAST(NULL AS NVARCHAR(20)) AS BuildSO';

    /* Hostname con el que el colector identifica al equipo. No vive en el
       activo sino en la tabla puente de red (ActivoFijoEquiposRed), así que
       se lee por subconsulta del registro principal (EsPrincipal y, si no
       hay, la última detección). El Excel lo usa para decir de qué equipo
       cuelga cada pieza. Defensivo: si la base no tiene la tabla o las
       columnas, el listado sigue igual y el hostname sale vacío. */
    let hostnameExpr = 'CAST(NULL AS NVARCHAR(100)) AS Hostname';
    if (await catalogosDB.tablaExiste('ActivoFijoEquiposRed')) {
        const colsRed = await catalogosDB.columnasExistentes('ActivoFijoEquiposRed',
            ['Hostname', 'Vigente', 'EsPrincipal', 'UltimaDeteccion']);
        if (colsRed.has('Hostname')) {
            const orden = [
                colsRed.has('EsPrincipal')     ? 'r.EsPrincipal DESC'     : null,
                colsRed.has('UltimaDeteccion') ? 'r.UltimaDeteccion DESC' : null
            ].filter(Boolean).join(', ') || '(SELECT NULL)';
            hostnameExpr = `(SELECT TOP (1) r.Hostname
                FROM dbo.ActivoFijoEquiposRed r
                WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                  ${colsRed.has('Vigente') ? 'AND r.Vigente = 1' : ''}
                  AND NULLIF(LTRIM(RTRIM(r.Hostname)), '') IS NOT NULL
                ORDER BY ${orden}) AS Hostname`;
        }
    }

    const result = await request.query(`
        SELECT
            af.IdActivoFijoEQ,
            af.IdCartera,
            af.IdSistemaOperativo,
            c.Nombre        AS Cartera,
            af.IdMarca,
            m.Nombre        AS Marca,
            af.IdTipo,
            t.Nombre        AS Tipo,
            t.RequiereResponsiva,
            t.RequiereIMEI,
            t.RequiereTelefono,
            t.RequiereSitio,
            t.RequiereSubtipo,
            t.RequiereClasificacion,
            t.RequiereTamanio,
            t.RequiereCapacidad,
            t.RequiereVoltaje,
            t.RequiereUsuarioAsignado,
            t.RequierePrecio,
            t.RequiereEspecificaciones,
            t.RequiereAccesorios,
            t.GrupoSubtipo,
            af.NoSerie,
            ${hostnameExpr},
            af.IMEI1,
            af.IMEI2,
            af.NoTelefono,
            af.PrecioActivo,
            af.IdEstado,
            es.Nombre       AS Estado,
            af.IdEstatus,
            st.Nombre       AS Estatus,
            af.IdLugarCliente,
            af.IdSitio,
            si.Nombre       AS Sitio,
            af.IdSubtipo,
            sub.Nombre      AS Subtipo,
            sub.Grupo       AS SubtipoGrupo,
            af.IdClasificacion,
            cla.Nombre      AS Clasificacion,
            af.IdTamanio,
            tam.Nombre      AS Tamanio,
            af.IdCapacidad,
            cap.Nombre      AS Capacidad,
            af.IdVoltaje,
            vol.Nombre      AS Voltaje,
            af.Observaciones,
            af.FechaCreacion,
            af.FechaModificacion,
<<<<<<< Updated upstream
            ${buildSOExpr},
=======
            ${red.columna},
>>>>>>> Stashed changes
            ${lectura.columnas.join(',\n            ')}
        FROM ActivoFijoEquipos af
        LEFT  JOIN ActivoFijoCarteras       c   ON c.IdCartera       = af.IdCartera
        LEFT  JOIN ActivoFijoMarcas         m   ON m.IdMarca         = af.IdMarca
        INNER JOIN ActivoFijoTipos          t   ON t.IdTipo          = af.IdTipo
        INNER JOIN ActivoFijoEstados        es  ON es.IdEstado       = af.IdEstado
        INNER JOIN ActivoFijoEstatus        st  ON st.IdEstatus      = af.IdEstatus
        LEFT  JOIN ActivoFijoSitios         si  ON si.IdSitio        = af.IdSitio
        LEFT  JOIN ActivoFijoSubtipos       sub ON sub.IdSubtipo     = af.IdSubtipo
        LEFT  JOIN ActivoFijoClasificaciones cla ON cla.IdClasificacion = af.IdClasificacion
        LEFT  JOIN ActivoFijoTamanios       tam ON tam.IdTamanio     = af.IdTamanio
        LEFT  JOIN ActivoFijoCapacidades    cap ON cap.IdCapacidad   = af.IdCapacidad
        LEFT  JOIN ActivoFijoVoltajes       vol ON vol.IdVoltaje     = af.IdVoltaje
        ${lectura.joins.join('\n        ')}
        ${red.join}
        WHERE ${where}
        ORDER BY af.IdActivoFijoEQ DESC
    `);

    /* Cada activo sigue valiendo 1: las piezas sólo se cuentan para
       mostrarlas como "N piezas" en el listado y en la ficha. */
    const piezas = await piezasPorActivo(pool);

    return result.recordset.map(fila => {
        const a = lectura.aplicar(fila);
        const p = piezas.get(Number(a.IdActivoFijoEQ));
        a.Piezas = p ? p.total : 0;
        a.PiezasTipos = p ? p.tipos : [];
        /* Piezas con su identidad (monitor + serie, disco + clave, ...):
           el Excel del inventario las detalla sin abrir la ficha. */
        a.PiezasDetalle = p ? p.piezas : [];
        return a;
    });
}

/* =========================================================
   OBTENER UNO POR ID
   ========================================================= */
async function obtener(id) {
    const pool = await getPool();
    await catalogosDB.asegurarCatalogosExtendidos();
    const lectura = catalogosDB.unirNombresCatalogo(
        await prepararLecturaEspecificaciones(),
        await catalogosDB.prepararAccesoriosEquipo('af')
    );
    const red = aplicarHostname(await tablaRedDisponible(pool), await columnaEnRed(pool, 'Dominio'));
    const r = await pool.request()
        .input('Id', sql.Int, id)
        .query(`
            SELECT
                af.*,
                c.Nombre   AS Cartera,
                m.Nombre   AS Marca,
                t.Nombre   AS Tipo,
                es.Nombre  AS Estado,
                st.Nombre  AS Estatus,
                si.Nombre  AS Sitio,
                sub.Nombre AS Subtipo,
                sub.Grupo  AS SubtipoGrupo,
                cla.Nombre AS Clasificacion,
                tam.Nombre AS Tamanio,
                cap.Nombre AS Capacidad,
                vol.Nombre AS Voltaje,
                ${red.columna},
                ${lectura.columnas.join(',\n                ')}
            FROM ActivoFijoEquipos af
            LEFT  JOIN ActivoFijoCarteras       c   ON c.IdCartera       = af.IdCartera
            LEFT  JOIN ActivoFijoMarcas         m   ON m.IdMarca         = af.IdMarca
            INNER JOIN ActivoFijoTipos          t   ON t.IdTipo          = af.IdTipo
            INNER JOIN ActivoFijoEstados        es  ON es.IdEstado       = af.IdEstado
            INNER JOIN ActivoFijoEstatus        st  ON st.IdEstatus      = af.IdEstatus
            LEFT  JOIN ActivoFijoSitios         si  ON si.IdSitio        = af.IdSitio
            LEFT  JOIN ActivoFijoSubtipos       sub ON sub.IdSubtipo     = af.IdSubtipo
            LEFT  JOIN ActivoFijoClasificaciones cla ON cla.IdClasificacion = af.IdClasificacion
            LEFT  JOIN ActivoFijoTamanios       tam ON tam.IdTamanio     = af.IdTamanio
            LEFT  JOIN ActivoFijoCapacidades    cap ON cap.IdCapacidad   = af.IdCapacidad
            LEFT  JOIN ActivoFijoVoltajes       vol ON vol.IdVoltaje     = af.IdVoltaje
            ${lectura.joins.join('\n            ')}
            ${red.join}
            WHERE af.IdActivoFijoEQ = @Id
        `);
    return lectura.aplicar(r.recordset[0] ?? null);
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(datos, idUsuario) {
    try {
        const pool = await getPool();
        await catalogosDB.asegurarCatalogosExtendidos();

        /* Resuelve (y crea/reactiva si hace falta) los catálogos de
           especificaciones y del usuario asignado. */
        const { ids: idsCatalogo, textos } = await resolverEspecificaciones(datos);

        if (datos.NoSerie) {
            const dup = await pool.request()
                .input('NoSerie', sql.NVarChar(150), datos.NoSerie)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoSerie = @NoSerie');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un activo con NoSerie "${datos.NoSerie}".` };
            }
        }
        if (datos.IMEI1) {
            const dup = await pool.request()
                .input('IMEI1', sql.NVarChar(50), datos.IMEI1)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE IMEI1 = @IMEI1 OR IMEI2 = @IMEI1');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un activo con IMEI1 "${datos.IMEI1}".` };
            }
        }
        if (datos.IMEI2) {
            const dup = await pool.request()
                .input('IMEI2', sql.NVarChar(50), datos.IMEI2)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE IMEI1 = @IMEI2 OR IMEI2 = @IMEI2');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un activo con IMEI2 "${datos.IMEI2}".` };
            }
        }
        if (datos.NoTelefono) {
            const dup = await pool.request()
                .input('NoTelefono', sql.NVarChar(50), datos.NoTelefono)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoTelefono = @NoTelefono');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un activo con NoTeléfono "${datos.NoTelefono}".` };
            }
        }

        if (!datos.IdTipo) {
            return { ok: false, mensaje: 'El tipo es obligatorio.' };
        }

        let IdEstado = null;
        if (datos.IdEstado) {
            IdEstado = datos.IdEstado;
        } else if (datos.Estado) {
            IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', datos.Estado);
        }
        if (!IdEstado) {
            IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', 'VALIDAR');
        }
        if (!IdEstado) return { ok: false, mensaje: 'Agrega un estado al catálogo antes de crear activos.' };

        const IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', 'DISPONIBLE');
        if (!IdEstatus) return { ok: false, mensaje: 'No existe el estatus DISPONIBLE en el catálogo.' };

        /* Columnas de texto legado: sólo se escriben si aún existen. */
        const hayTexto = await columnasTextoEquipo();

        const request  = pool.request();
        const columnas = [];
        const valores  = [];

        const agregar = (columna, tipo, valor) => {
            if (TEXTOS_RESPALDO_EQUIPO.has(columna) && !hayTexto.has(columna)) return;
            const param = `p${columnas.length}`;
            request.input(param, tipo, valor);
            columnas.push(columna);
            valores.push('@' + param);
        };

        /* Contexto automático: cartera deducida del hostname y, cuando no
           hay cartera posible, el activo queda en el sitio por defecto
           (COPERVA). Nunca sobrescribe lo capturado a mano. */
        const contexto = await resolverContextoActivo(pool, datos);

        agregar('IdCartera',           sql.Int,           contexto.idCartera);
        agregar('IdMarca',             sql.Int,           datos.IdMarca || null);
        agregar('IdModelo',            sql.Int,           idsCatalogo.IdModelo ?? null);
        agregar('Modelo',              sql.NVarChar(150), textos.Modelo ?? null);
        agregar('IdProcesador',        sql.Int,           idsCatalogo.IdProcesador ?? null);
        agregar('Procesador',          sql.NVarChar(150), textos.Procesador ?? null);
        agregar('IdMemoriaRAM',        sql.Int,           idsCatalogo.IdMemoriaRAM ?? null);
        agregar('MemoriaRAM',          sql.NVarChar(50),  textos.MemoriaRAM ?? null);
        agregar('IdAlmacenamiento',    sql.Int,           idsCatalogo.IdAlmacenamiento ?? null);
        agregar('Almacenamiento',      sql.NVarChar(50),  textos.Almacenamiento ?? null);
        agregar('IdSistemaOperativo',  sql.Int,           idsCatalogo.IdSistemaOperativo ?? null);
        agregar('SistemaOperativo',    sql.NVarChar(100), textos.SistemaOperativo ?? null);
        agregar('IdUsuarioAsignado',   sql.Int,           idsCatalogo.IdUsuarioAsignado ?? null);
        agregar('UsuarioAsignado',     sql.NVarChar(200), textos.UsuarioAsignado ?? null);
        agregar('IdTipo',              sql.Int,           datos.IdTipo);
        agregar('NoSerie',             sql.NVarChar(150), datos.NoSerie || null);
        agregar('IMEI1',               sql.NVarChar(50),  datos.IMEI1 || null);
        agregar('IMEI2',               sql.NVarChar(50),  datos.IMEI2 || null);
        agregar('NoTelefono',          sql.NVarChar(50),  datos.NoTelefono || null);
        agregar(CAMPO_ACCESORIOS,      sql.NVarChar(300), datos.Accesorios || null);
        agregar('PrecioActivo',        sql.Decimal(18,2), datos.PrecioActivo ?? null);
        agregar('IdEstado',            sql.Int,           IdEstado);
        agregar('IdEstatus',           sql.Int,           IdEstatus);
        agregar('IdLugarCliente',      sql.Int,           datos.IdLugarCliente || null);
        agregar('IdSitio',             sql.Int,           contexto.idSitio);
        agregar('IdSubtipo',           sql.Int,           datos.IdSubtipo || null);
        agregar('IdClasificacion',     sql.Int,           datos.IdClasificacion || null);
        agregar('IdTamanio',           sql.Int,           datos.IdTamanio || null);
        agregar('IdCapacidad',         sql.Int,           datos.IdCapacidad || null);
        agregar('IdVoltaje',           sql.Int,           datos.IdVoltaje || null);
        agregar('Observaciones',       sql.NVarChar(500), datos.Observaciones || null);
        agregar('IdUsuarioCreacion',   sql.Int,           idUsuario || null);

        const result = await request.query(`
            INSERT INTO ActivoFijoEquipos (${columnas.join(', ')})
            VALUES (${valores.join(', ')});
            SELECT SCOPE_IDENTITY() AS Id;
        `);

        const idNuevo = result.recordset[0].Id;

        /* Accesorios: se guardan en la tabla puente (N:M). */
        await catalogosDB.sincronizarAccesoriosEquipo(idNuevo, datos[CAMPO_ACCESORIOS]);

        return { ok: true, mensaje: 'Activo creado correctamente.', id: idNuevo };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un activo con ese valor único.' };
        }
        return { ok: false, mensaje: 'Error al crear: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(id, datos, idUsuario) {
    try {
        const pool = await getPool();
        await catalogosDB.asegurarCatalogosExtendidos();

        const actual = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT af.IdTipo, af.IdEstado, af.IdEstatus, af.IdUsuarioAsignado,
                       st.Nombre AS Estatus,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM ActivoFijoResponsivas r
                           WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                             AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                       ) THEN 1 ELSE 0 END AS TieneResponsivaActiva
                FROM ActivoFijoEquipos af
                LEFT JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE af.IdActivoFijoEQ = @Id
            `);

        if (actual.recordset.length === 0) {
            return { ok: false, mensaje: 'El activo ya no existe.' };
        }

        const current = actual.recordset[0];

        /* Igual que en crear(): convierte lo capturado en catálogos de
           especificaciones / usuario asignado a su FK, creando o
           reactivando el registro si no existía. Devuelve además el
           texto legible que se conserva en la columna de respaldo. */
        const { ids: idsCatalogo, textos } = await resolverEspecificaciones(datos);

        if (datos.NoSerie !== undefined && datos.NoSerie) {
            const dup = await pool.request()
                .input('NoSerie', sql.NVarChar(150), datos.NoSerie)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoSerie = @NoSerie AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con NoSerie "${datos.NoSerie}".` };
            }
        }
        if (datos.IMEI1 !== undefined && datos.IMEI1) {
            const dup = await pool.request()
                .input('IMEI1', sql.NVarChar(50), datos.IMEI1)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE (IMEI1 = @IMEI1 OR IMEI2 = @IMEI1) AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con IMEI1 "${datos.IMEI1}".` };
            }
        }
        if (datos.IMEI2 !== undefined && datos.IMEI2) {
            const dup = await pool.request()
                .input('IMEI2', sql.NVarChar(50), datos.IMEI2)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE (IMEI1 = @IMEI2 OR IMEI2 = @IMEI2) AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con IMEI2 "${datos.IMEI2}".` };
            }
        }
        if (datos.NoTelefono !== undefined && datos.NoTelefono) {
            const dup = await pool.request()
                .input('NoTelefono', sql.NVarChar(50), datos.NoTelefono)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoTelefono = @NoTelefono AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con NoTeléfono "${datos.NoTelefono}".` };
            }
        }

        let IdTipo = null;
        if (datos.IdTipo) IdTipo = datos.IdTipo;
        else if (datos.Tipo) IdTipo = await getIdPorNombre(pool, 'ActivoFijoTipos', 'IdTipo', datos.Tipo);
        if (!IdTipo) IdTipo = current.IdTipo;
        if (!IdTipo) return { ok: false, mensaje: 'El tipo es obligatorio.' };

        let IdEstado = null;
        if (datos.IdEstado) IdEstado = datos.IdEstado;
        else if (datos.Estado) IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', datos.Estado);
        if (!IdEstado) IdEstado = current.IdEstado;
        if (!IdEstado) IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', 'VALIDAR');

        let IdEstatus = current.IdEstatus;
        if (datos.IdEstatus) {
            IdEstatus = Number(datos.IdEstatus);
        } else if (datos.Estatus) {
            IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', datos.Estatus);
        }
        if (!IdEstatus) return { ok: false, mensaje: 'El estatus seleccionado no existe.' };

        const estatusSolicitado = await pool.request()
            .input('IdEstatus', sql.Int, IdEstatus)
            .query('SELECT Nombre FROM ActivoFijoEstatus WHERE IdEstatus = @IdEstatus AND Activo = 1');
        const nombreEstatusSolicitado = estatusSolicitado.recordset[0]?.Nombre?.toUpperCase();
        if (!nombreEstatusSolicitado) {
            return { ok: false, mensaje: 'El estatus seleccionado no está activo en el catálogo.' };
        }
        if (nombreEstatusSolicitado === 'ASIGNADO' && !current.TieneResponsivaActiva) {
            return { ok: false, mensaje: 'El estatus ASIGNADO solo se establece al crear una responsiva activa.' };
        }
        if (current.TieneResponsivaActiva && Number(IdEstatus) !== Number(current.IdEstatus)) {
            return { ok: false, mensaje: 'No se puede cambiar el estatus mientras exista una responsiva activa. Registra primero la devolución o cancelación.' };
        }

        /* El usuario de inventario de un activo con responsiva abierta es el
           que recibe esa responsiva (lo sincroniza el trigger). Editarlo aquí
           desincroniza inventario y responsiva, así que se rechaza. */
        if (current.TieneResponsivaActiva && datos.UsuarioAsignado !== undefined) {
            const solicitado = idsCatalogo.IdUsuarioAsignado ?? null;
            const guardado   = current.IdUsuarioAsignado ?? null;
            if (Number(solicitado ?? 0) !== Number(guardado ?? 0)) {
                return {
                    ok: false,
                    mensaje: 'El usuario asignado lo controla la responsiva abierta. Cámbialo editando la responsiva o registra primero la devolución.'
                };
            }
        }

        /* Contexto automático (igual que en crear): si la cartera o el
           sitio llegan vacíos se deduce del hostname ya guardado del
           equipo y, en último caso, la cartera queda null (activo
           general) con el sitio por defecto COPERVA. */
        const contexto = await resolverContextoActivo(pool, datos, await hostnameDeActivo(pool, id));
        if (datos.IdCartera !== undefined) datos.IdCartera = datos.IdCartera || contexto.idCartera;
        if (datos.IdSitio !== undefined)   datos.IdSitio   = datos.IdSitio   || contexto.idSitio;

        /* Columnas de texto legado: sólo se actualizan si aún existen. */
        const hayTexto = await columnasTextoEquipo();

        const request = pool.request();
        request.input('Id',         sql.Int, id);
        request.input('IdTipo',     sql.Int, IdTipo);
        request.input('IdEstado',   sql.Int, IdEstado);
        request.input('IdEstatus',  sql.Int, IdEstatus);
        request.input('NombreEstatus', sql.NVarChar(50), nombreEstatusSolicitado);
        request.input('IdUsuario',  sql.Int, idUsuario || null);

        const sets = [
            'IdTipo = @IdTipo',
            'IdEstado = @IdEstado',
            'IdEstatus = @IdEstatus',
            'IdUsuarioModificacion = @IdUsuario',
            'FechaModificacion = GETDATE()'
        ];

        const camposOpcionales = [
            ['IdCartera',       'IdCartera',        sql.Int,       null],
            ['IdMarca',         'IdMarca',          sql.Int,       null],
            ['NoSerie',         'NoSerie',          sql.NVarChar,  150],
            ['IMEI1',           'IMEI1',            sql.NVarChar,  50],
            ['IMEI2',           'IMEI2',            sql.NVarChar,  50],
            ['NoTelefono',      'NoTelefono',       sql.NVarChar,  50],
            ['Accesorios',      'Accesorios',       sql.NVarChar,  300],
            ['PrecioActivo',    'PrecioActivo',     'Decimal',     null],
            ['IdLugarCliente',  'IdLugarCliente',   sql.Int,       null],
            ['IdSitio',         'IdSitio',          sql.Int,       null],
            ['IdSubtipo',       'IdSubtipo',        sql.Int,       null],
            ['IdClasificacion', 'IdClasificacion',  sql.Int,       null],
            ['IdTamanio',       'IdTamanio',        sql.Int,       null],
            ['IdCapacidad',     'IdCapacidad',      sql.Int,       null],
            ['IdVoltaje',       'IdVoltaje',        sql.Int,       null],
            ['Observaciones',   'Observaciones',    sql.NVarChar,  500]
        ];

        for (const [jsKey, colName, tipoSqlFn, longitud] of camposOpcionales) {
            if (datos[jsKey] === undefined) continue;
            if (TEXTOS_RESPALDO_EQUIPO.has(colName) && !hayTexto.has(colName)) continue;

            const paramName = 'p_' + colName;
            let sqlType;
            if (tipoSqlFn === 'Decimal')   sqlType = sql.Decimal(18, 2);
            else if (longitud !== null)    sqlType = tipoSqlFn(longitud);
            else                           sqlType = tipoSqlFn;

            request.input(paramName, sqlType, datos[jsKey]);
            sets.push(`${colName} = @${paramName}`);
        }

        /* Especificaciones y usuario asignado: se escriben el texto legible
           y su FK al catálogo (3FN). Sólo se tocan las claves enviadas, así
           que un PATCH parcial no borra el resto. */
        for (const [campo, , fk, longitud] of CAMPOS_CATALOGO_ESPECIFICACIONES) {
            if (datos[campo] === undefined) continue;

            request.input('fk_' + fk,  sql.Int,           idsCatalogo[fk] ?? null);
            request.input('p_' + campo, sql.NVarChar(longitud), textos[campo] ?? null);
            sets.push(`${fk} = @fk_${fk}`);

            /* El texto de respaldo ya no existe tras la fase 2 del script 3FN. */
            if (hayTexto.has(campo)) sets.push(`${campo} = @p_${campo}`);
        }

        const result = await request.query(
            `UPDATE ActivoFijoEquipos SET ${sets.join(', ')}
             WHERE IdActivoFijoEQ = @Id
               AND (
                   @NombreEstatus <> 'ASIGNADO'
                   OR EXISTS (
                       SELECT 1 FROM ActivoFijoResponsivas r
                       WHERE r.IdActivoFijoEQ = ActivoFijoEquipos.IdActivoFijoEQ
                         AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                   )
               )
               AND (
                   NOT EXISTS (
                       SELECT 1 FROM ActivoFijoResponsivas r
                       WHERE r.IdActivoFijoEQ = ActivoFijoEquipos.IdActivoFijoEQ
                         AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                   )
                   OR @IdEstatus = ActivoFijoEquipos.IdEstatus
               )`
        );

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'No se pudo actualizar: el activo no existe o su estatus está protegido por una responsiva activa.' };
        }

        /* Accesorios: sólo se reemplaza la tabla puente si el campo vino en
           los datos, para no borrarlos en un PATCH parcial. */
        if (datos[CAMPO_ACCESORIOS] !== undefined) {
            await catalogosDB.sincronizarAccesoriosEquipo(id, datos[CAMPO_ACCESORIOS]);
        }

        return { ok: true, mensaje: 'Activo actualizado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un activo con ese valor único.' };
        }
        return { ok: false, mensaje: 'Error al actualizar: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR (Soft delete)
   ========================================================= */
async function eliminar(id, idUsuario, motivo = null) {
    try {
        const pool = await getPool();

        const respActivas = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT COUNT(*) AS Total
                FROM ActivoFijoResponsivas
                WHERE IdActivoFijoEQ = @Id
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);

        if (respActivas.recordset[0].Total > 0) {
            return {
                ok: false,
                mensaje: 'No se puede dar de baja: el activo tiene responsivas activas. Cancélalas primero.'
            };
        }

        const result = await pool.request()
            .input('Id',     sql.Int, id)
            .input('IdUser', sql.Int, idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus             = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'BAJA'),
                    IdUsuarioModificacion = @IdUser,
                    FechaModificacion     = GETDATE()
                WHERE IdActivoFijoEQ = @Id
                  AND IdEstatus <> (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'BAJA')
                  AND NOT EXISTS (
                      SELECT 1 FROM ActivoFijoResponsivas
                      WHERE IdActivoFijoEQ = @Id
                        AND EstatusResponsiva IN ('ASIGNADO','PENDIENTE')
                  );
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El activo ya estaba dado de baja o no existe.' };
        }

        if (motivo) {
            await pool.request()
                .input('Id',     sql.Int,           id)
                .input('Motivo', sql.NVarChar(500), motivo)
                .query(`
                    UPDATE ActivoFijoHistoricos
                    SET Motivo = @Motivo
                    WHERE IdHistorico = (
                        SELECT TOP 1 IdHistorico
                        FROM ActivoFijoHistoricos
                        WHERE IdActivoFijoEQ = @Id
                          AND Accion = 'BAJA'
                        ORDER BY FechaMovimiento DESC
                    );
                `);
        }

        return { ok: true, mensaje: 'Activo dado de baja. Se conserva en la pestaña "Eliminados".' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al dar de baja: ' + err.message };
    }
}

/* =========================================================
   RESTAURAR
   ========================================================= */
async function restaurar(id, idUsuario, motivo = null) {
    try {
        await catalogosDB.asegurarCatalogosExtendidos();
        const pool = await getPool();

        const responsivasActivas = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT COUNT(*) AS Total
                FROM ActivoFijoResponsivas
                WHERE IdActivoFijoEQ = @Id
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);
        if (responsivasActivas.recordset[0].Total > 0) {
            return { ok: false, mensaje: 'No se puede restaurar: el activo tiene una responsiva activa.' };
        }

        const result = await pool.request()
            .input('Id',     sql.Int, id)
            .input('IdUser', sql.Int, idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'DISPONIBLE' AND Activo = 1),
                    IdUsuarioModificacion = @IdUser,
                    FechaModificacion     = GETDATE()
                WHERE IdActivoFijoEQ = @Id
                  AND IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'BAJA')
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El activo no está dado de baja o no existe.' };
        }

        if (motivo) {
            await pool.request()
                .input('Id',     sql.Int,           id)
                .input('Motivo', sql.NVarChar(500), motivo)
                .query(`
                    UPDATE ActivoFijoHistoricos
                    SET Motivo = @Motivo
                    WHERE IdHistorico = (
                        SELECT TOP 1 IdHistorico
                        FROM ActivoFijoHistoricos
                        WHERE IdActivoFijoEQ = @Id
                          AND Accion = 'RESTAURACION'
                        ORDER BY FechaMovimiento DESC
                    );
                `);
        }

        return { ok: true, mensaje: 'Activo restaurado. Vuelve al inventario activo.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al restaurar: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR DEFINITIVAMENTE (purga física)

   Sólo para activos que ya están en BAJA y que no tienen ninguna
   responsiva: la responsiva es un documento firmado y jamás se borra
   en cascada. Las filas hijas se descubren en el catálogo del sistema
   (sys.foreign_keys) para no quedar desfasadas si mañana se añade otra
   tabla que apunte a ActivoFijoEquipos.
   ========================================================= */
async function tablasHijasDe(tx, tabla) {
    const r = await new sql.Request(tx)
        .input('Tabla', sql.NVarChar(200), `dbo.${tabla}`)
        .query(`
            SELECT OBJECT_NAME(fk.parent_object_id)                     AS Tabla,
                   COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Columna,
                   COLUMNPROPERTY(fkc.parent_object_id,
                                  COL_NAME(fkc.parent_object_id, fkc.parent_column_id),
                                  'AllowsNull')                     AS Nulable
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc
                    ON fkc.constraint_object_id = fk.object_id
            WHERE fk.referenced_object_id = OBJECT_ID(@Tabla)
        `);
    return r.recordset;
}

/* Tablas de histórico: su referencia a la responsiva es un retrato del
   pasado. Si la fila pertenece a OTRO activo no se borra: sólo se suelta
   el vínculo, para no perder movimientos ajenos a esta purga. */
const TABLAS_HISTORIAL = new Set(['ActivoFijoHistoricos', 'ActivoFijoAsignacionesHist']);

async function eliminarDefinitivo(id, idUsuario) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        const activo = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query(`
                SELECT af.IdActivoFijoEQ, st.Nombre AS Estatus
                FROM ActivoFijoEquipos af WITH (UPDLOCK, HOLDLOCK)
                LEFT JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE af.IdActivoFijoEQ = @Id
            `);
        if (activo.recordset.length === 0) {
            await tx.rollback();
            return { ok: false, mensaje: 'El activo ya no existe.' };
        }

        const estatus = String(activo.recordset[0].Estatus || '').toUpperCase();
        if (estatus !== 'BAJA') {
            await tx.rollback();
            return { ok: false, mensaje: 'Sólo se pueden eliminar definitivamente los activos dados de baja.' };
        }

        /* Una responsiva ABIERTA bloquea la purga: es un documento vigente
           con un activo en manos de alguien. Las cerradas (devueltas o
           canceladas) son histórico del propio activo y se van con él, tal
           como avisa el diálogo de confirmación. */
        const abiertas = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query(`
                SELECT COUNT(*) AS Total
                FROM ActivoFijoResponsivas
                WHERE IdActivoFijoEQ = @Id
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);
        const totalAbiertas = abiertas.recordset[0].Total;
        if (totalAbiertas > 0) {
            await tx.rollback();
            return {
                ok: false,
                mensaje: `No se puede eliminar definitivamente: el activo tiene ${totalAbiertas} responsiva(s) activa(s). Cancélala(s) o regístrala(s) como devuelta(s) primero.`
            };
        }

        const borradas = {};
        const contar = (tabla, n) => { if (n > 0) borradas[tabla] = (borradas[tabla] || 0) + n; };

        /* Orden de borrado: primero lo que cuelga del equipo (histórico,
           accesorios, asignaciones), luego lo que cuelga de sus
           responsivas, después las responsivas cerradas y al final el
           equipo. Así ninguna FK intermedia apunta a una fila ya borrada. */
        const hijasEquipo = await tablasHijasDe(tx, 'ActivoFijoEquipos');
        for (const h of hijasEquipo) {
            if (!h.Tabla || !h.Columna || h.Tabla === 'ActivoFijoResponsivas') continue;
            const r = await new sql.Request(tx)
                .input('Id', sql.Int, id)
                .query(`
                    DELETE FROM dbo.${h.Tabla}
                    WHERE ${h.Columna} = @Id
                `);
            contar(h.Tabla, r.rowsAffected[0] || 0);
        }

        const hijasResp = await tablasHijasDe(tx, 'ActivoFijoResponsivas');
        for (const h of hijasResp) {
            if (!h.Tabla || !h.Columna) continue;
            const filtro = `
                ${h.Columna} IN (
                    SELECT IdResponsiva
                    FROM dbo.ActivoFijoResponsivas
                    WHERE IdActivoFijoEQ = @Id
                )`;
            const esHistorialNulable = TABLAS_HISTORIAL.has(h.Tabla) && h.Nulable === 1;
            const r = esHistorialNulable
                ? await new sql.Request(tx)
                    .input('Id', sql.Int, id)
                    .query(`UPDATE dbo.${h.Tabla} SET ${h.Columna} = NULL WHERE ${filtro}`)
                : await new sql.Request(tx)
                    .input('Id', sql.Int, id)
                    .query(`DELETE FROM dbo.${h.Tabla} WHERE ${filtro}`);
            contar(h.Tabla, r.rowsAffected[0] || 0);
        }

        const rResp = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query('DELETE FROM dbo.ActivoFijoResponsivas WHERE IdActivoFijoEQ = @Id');
        contar('ActivoFijoResponsivas', rResp.rowsAffected[0] || 0);

        /* Piezas conectadas del equipo (dbo.ActivoFijoEquiposComponentes).
           Esa tabla puente se creó SIN FK a propósito —el colector inserta
           antes de que exista el padre—, así que sys.foreign_keys no la
           descubre y hay que vaciarla aquí: si no, quedarían piezas
           apuntando a un IdActivoFijoEQ que ya no existe. */
        const rComp = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query(`
                IF OBJECT_ID('dbo.ActivoFijoEquiposComponentes', 'U') IS NOT NULL
                    DELETE FROM dbo.ActivoFijoEquiposComponentes
                    WHERE IdActivoFijoEQ = @Id
            `);
        contar('ActivoFijoEquiposComponentes', rComp.rowsAffected[0] || 0);

        const r = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query('DELETE FROM dbo.ActivoFijoEquipos WHERE IdActivoFijoEQ = @Id');

        if (r.rowsAffected[0] === 0) {
            await tx.rollback();
            return { ok: false, mensaje: 'El activo ya no existe.' };
        }

        await tx.commit();

        const detalle = Object.entries(borradas)
            .filter(([, n]) => n > 0)
            .map(([tabla, n]) => `${tabla}: ${n}`)
            .join(', ');
        console.log(`🗑️  Activo #${id} eliminado definitivamente` +
            (idUsuario ? ` por el usuario ${idUsuario}` : '') +
            (detalle ? ` (${detalle})` : ''));

        return { ok: true, mensaje: 'Activo eliminado definitivamente.' };
    } catch (err) {
        try { await tx.rollback(); } catch (_) { /* la transacción ya estaba cerrada */ }
        if (err.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar: hay registros asociados al activo.' };
        }
        return { ok: false, mensaje: 'Error al eliminar definitivamente: ' + err.message };
    }
}

/* =========================================================
   HISTÓRICO
   ========================================================= */
async function historico(idActivo, limite = 200) {
    const pool = await getPool();
    const r = await pool.request()
        .input('Id',     sql.Int, idActivo)
        .input('Limite', sql.Int, limite)
        .query(`
            SELECT TOP (@Limite)
                h.IdHistorico,
                h.IdActivoFijoEQ,
                h.Accion,
                h.Detalle,
                h.Motivo,
                h.IdEstadoAnterior,  ea.Nombre AS EstadoAnterior,
                h.IdEstadoNuevo,     en.Nombre AS EstadoNuevo,
                h.IdEstatusAnterior, sa.Nombre AS EstatusAnterior,
                h.IdEstatusNuevo,    sn.Nombre AS EstatusNuevo,
                h.IdLugarOrigen,     h.IdLugarDestino,
                h.IdSitioAnterior,   sia.Nombre  AS SitioAnterior,
                h.IdSitioNuevo,      sin_.Nombre AS SitioNuevo,
                h.UsuarioAsignadoAnterior,
                h.UsuarioAsignadoNuevo,
                h.IdUsuarioMovimiento,
                LTRIM(RTRIM(
                    ISNULL(u.Nombres, '') + ' ' + ISNULL(u.Apellidos, '')
                )) AS UsuarioMovimiento,
                u.NombreUsuario,
                h.FechaMovimiento
            FROM ActivoFijoHistoricos h
            LEFT JOIN ActivoFijoEstados  ea   ON ea.IdEstado   = h.IdEstadoAnterior
            LEFT JOIN ActivoFijoEstados  en   ON en.IdEstado   = h.IdEstadoNuevo
            LEFT JOIN ActivoFijoEstatus  sa   ON sa.IdEstatus  = h.IdEstatusAnterior
            LEFT JOIN ActivoFijoEstatus  sn   ON sn.IdEstatus  = h.IdEstatusNuevo
            LEFT JOIN ActivoFijoSitios   sia  ON sia.IdSitio   = h.IdSitioAnterior
            LEFT JOIN ActivoFijoSitios   sin_ ON sin_.IdSitio  = h.IdSitioNuevo
            LEFT JOIN Usuarios           u    ON u.IdUsuario = h.IdUsuarioMovimiento
            WHERE h.IdActivoFijoEQ = @Id
            ORDER BY h.FechaMovimiento DESC
        `);
    return r.recordset;
}

/* =========================================================
   EXPORTAR A EXCEL (Inventario general, una hoja por cartera)
   ---------------------------------------------------------
   Un solo Excel: hoja "Resumen" + una hoja por cartera (más
   "Sin cartera"). Los equipos con piezas conectadas suman un
   renglón por pieza física, colgado del hostname (o de la serie)
   del activo padre: el inventario sigue contando 1 por equipo,
   pero el Excel deja ver y filtrar todo lo que cuelga de cada uno.
   ========================================================= */
const SIN_CARTERA_HOJA = 'Sin cartera';
const COLOR_ENCABEZADO_EXCEL = 'FF15803D';

/* Nombre legible del Tipo de cada pieza conectada. */
const NOMBRE_TIPO_PIEZA_EXCEL = {
    MONITOR: 'Monitor',
    DISCO: 'Disco duro',
    TECLADO: 'Teclado',
    RATON: 'Ratón',
    DIADEMA: 'Diadema',
    IMPRESORA: 'Impresora',
    BOCINA: 'Bocinas',
    WEBCAM: 'Cámara web',
    OTRO: 'Otro'
};

function nombreTipoPieza(tipo) {
    const clave = String(tipo || 'OTRO').toUpperCase();
    return NOMBRE_TIPO_PIEZA_EXCEL[clave]
        || clave.charAt(0) + clave.slice(1).toLowerCase();
}

/* "2 (1 monitor, 1 disco duro)": el mismo texto que muestra la tabla. */
function textoPiezasActivo(a) {
    const total = Number(a.Piezas) || 0;
    if (!total) return '—';
    const detalle = (Array.isArray(a.PiezasTipos) ? a.PiezasTipos : [])
        .map(t => `${Number(t.cuantas) || 0} ${nombreTipoPieza(t.tipo).toLowerCase()}`)
        .join(', ');
    return detalle ? `${total} (${detalle})` : String(total);
}

/* Piezas físicas vigentes por activo (detalle, no sólo el conteo).
   Si la tabla no existe devuelve un mapa vacío: el Excel nunca se cae. */
async function piezasDetalladas(pool) {
    const mapa = new Map();
    try {
        const ex = await pool.request().query(`
            SELECT CASE WHEN OBJECT_ID('dbo.ActivoFijoEquiposComponentes', 'U') IS NULL
                        THEN 0 ELSE 1 END AS Existe`);
        if (!(ex.recordset && ex.recordset[0] && ex.recordset[0].Existe)) return mapa;

        const r = await pool.request().query(`
            SELECT IdActivoFijoEQ, TipoComponente, Marca, Modelo, Serie,
                   Identificador, Cantidad
            FROM dbo.ActivoFijoEquiposComponentes
            WHERE Vigente = 1
            ORDER BY IdActivoFijoEQ, TipoComponente, Marca, Modelo, IdEquipoComponente`);

        for (const f of r.recordset || []) {
            const id = Number(f.IdActivoFijoEQ) || 0;
            if (!mapa.has(id)) mapa.set(id, []);
            mapa.get(id).push(f);
        }
    } catch (err) {
        console.error('[Inventario Excel] piezas:', err.message);
        return new Map();
    }
    return mapa;
}

const COLUMNAS_EXCEL_INVENTARIO = [
    { header: 'No. Serie',          key: 'NoSerie',          width: 20 },
    { header: 'Hostname',           key: 'Hostname',         width: 22 },
    { header: 'Dominio',            key: 'Dominio',          width: 24 },
    { header: 'Marca',              key: 'Marca',            width: 16 },
    { header: 'Modelo',             key: 'Modelo',           width: 20 },
    { header: 'Tipo',               key: 'Tipo',             width: 16 },
    { header: 'Elemento',           key: 'Elemento',         width: 12 },
    { header: 'Activo padre',       key: 'ActivoPadre',      width: 22 },
    { header: 'Estado',             key: 'Estado',           width: 14 },
    { header: 'Estatus',            key: 'Estatus',          width: 14 },
    { header: 'Sitio',              key: 'Sitio',            width: 14 },
    { header: 'Usuario Asignado',   key: 'UsuarioAsignado',  width: 26 },
    { header: 'Piezas conectadas',  key: 'PiezasTexto',      width: 32 }
];

const COLUMNAS_EXCEL_RESUMEN = [
    { header: 'Cartera',            key: 'Cartera',          width: 26 },
    { header: 'Equipos',            key: 'Equipos',          width: 12 },
    { header: 'Con hostname',       key: 'ConHostname',      width: 14 },
    { header: 'Piezas conectadas',  key: 'Piezas',           width: 18 },
    { header: 'Filas en Excel',     key: 'Filas',            width: 16 }
];

/* Nombre de hoja válido: Excel rechaza : \ / ? * [ ] y corta en 31
   caracteres; si se repite, se numera. */
function nombreHojaExcel(cartera, usados) {
    const limpio = String(cartera || '').replace(/[\\/:*?\[\]]/g, '-').trim();
    const base = (limpio || SIN_CARTERA_HOJA).slice(0, 28);
    let nombre = base;
    let n = 2;
    while (usados.has(nombre.toLowerCase())) {
        nombre = `${base.slice(0, 25)} (${n})`;
        n++;
    }
    usados.add(nombre.toLowerCase());
    return nombre;
}

/* Filas de una cartera: primero el equipo, después una fila por pieza
   física colgada de él (referenciando hostname o serie del padre). */
function filasExcelDeCartera(lista, piezas) {
    const filas = [];
    for (const a of lista) {
        filas.push({
            NoSerie: a.NoSerie || '',
            Hostname: a.Hostname || '',
            Dominio: a.Dominio || '',
            Marca: a.Marca || '',
            Modelo: a.Modelo || '',
            Tipo: a.Tipo || '',
            Elemento: 'Equipo',
            ActivoPadre: '',
            Estado: a.Estado || '',
            Estatus: a.Estatus || '',
            Sitio: a.Sitio || '',
            UsuarioAsignado: a.UsuarioAsignado || '',
            PiezasTexto: textoPiezasActivo(a)
        });

        const delEquipo = piezas.get(Number(a.IdActivoFijoEQ)) || [];
        if (delEquipo.length === 0) continue;

        /* El hostname manda porque es lo que se busca en el Excel; si el
           equipo no lo tiene, la referencia es su número de serie. */
        const referencia = String(a.Hostname || '').trim() || String(a.NoSerie || '').trim();

        for (const p of delEquipo) {
            const veces = Math.min(Math.max(Number(p.Cantidad) || 1, 1), 50);
            for (let i = 0; i < veces; i++) {
                filas.push({
                    NoSerie: p.Serie || '',
                    Hostname: a.Hostname || '',
                    Dominio: a.Dominio || '',
                    Marca: p.Marca || '',
                    Modelo: p.Modelo || '',
                    Tipo: nombreTipoPieza(p.TipoComponente),
                    Elemento: 'Pieza',
                    ActivoPadre: referencia,
                    Estado: '',
                    Estatus: '',
                    Sitio: a.Sitio || '',
                    UsuarioAsignado: '',
                    PiezasTexto: ''
                });
            }
        }
    }
    return filas;
}

/* Encabezado verde, bordes, filas alternas y filtros: mismo aspecto en
   todas las hojas. */
function estilizarHojaExcel(worksheet, totalColumnas) {
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO_EXCEL } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Poppins' };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });

    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: totalColumnas } };

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
            cell.font = { name: 'Poppins', size: 10 };
            if (rowNumber % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });
    });
}

/* Un libro con N hojas: abre el diálogo una sola vez y escribe todo. */
async function guardarLibroExcel(hojas, titulo) {
    const safeTitulo = (titulo || 'Inventario').replace(/[\\/:*?"<>|]/g, '_');
    const fecha = new Date().toISOString().slice(0, 10);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const defaultPath = path.join(
        fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(),
        `${safeTitulo}_${fecha}.xlsx`
    );

    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar inventario en Excel',
        defaultPath,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

    const workbook = new ExcelJS.Workbook();
    for (const hoja of hojas) {
        const worksheet = workbook.addWorksheet(hoja.nombre);
        worksheet.columns = (hoja.columnas || []).map(col => ({
            header: col.header,
            key: col.key,
            width: col.width || 15
        }));
        worksheet.addRows(hoja.datos || []);
        estilizarHojaExcel(worksheet, (hoja.columnas || []).length);
    }

    try {
        await workbook.xlsx.writeFile(filePath);
        return { ok: true, ruta: filePath, hojas: hojas.map(h => h.nombre) };
    } catch (err) {
        console.error('[Excel Error]:', err);
        return { ok: false, mensaje: 'No se pudo escribir el archivo: ' + err.message };
    }
}

/* Inventario general: vigentes (sin BAJA), segmentado por cartera. */
async function exportarInventario() {
    const pool = await getPool();
    const activos = await listar({});

    if (!activos || activos.length === 0) {
        return { ok: false, mensaje: 'No hay activos para exportar.' };
    }

    const piezas = await piezasDetalladas(pool);

    /* Agrupa por cartera; "Sin cartera" siempre al final. */
    const grupos = new Map();
    for (const a of activos) {
        const cartera = String(a.Cartera || '').trim() || SIN_CARTERA_HOJA;
        if (!grupos.has(cartera)) grupos.set(cartera, []);
        grupos.get(cartera).push(a);
    }
    const carteras = [...grupos.keys()].sort((x, y) => {
        if (x === SIN_CARTERA_HOJA) return 1;
        if (y === SIN_CARTERA_HOJA) return -1;
        return x.localeCompare(y, 'es');
    });

    const usados = new Set(['resumen']);
    const resumen = [];
    const hojas = [];

    for (const cartera of carteras) {
        const lista = grupos.get(cartera);
        const filas = filasExcelDeCartera(lista, piezas);
        const nPiezas = filas.filter(f => f.Elemento === 'Pieza').length;

        resumen.push({
            Cartera: cartera,
            Equipos: lista.length,
            ConHostname: lista.filter(a => String(a.Hostname || '').trim()).length,
            Piezas: nPiezas,
            Filas: filas.length
        });

        hojas.push({
            nombre: nombreHojaExcel(cartera, usados),
            columnas: COLUMNAS_EXCEL_INVENTARIO,
            datos: filas
        });
    }

    const libro = [{
        nombre: 'Resumen',
        columnas: COLUMNAS_EXCEL_RESUMEN,
        datos: resumen
    }, ...hojas];

    const resultado = await guardarLibroExcel(libro, 'Inventario_General');
    if (resultado.ok) {
        resultado.hojas = libro.map(h => h.nombre);
        resultado.registros = resumen.reduce((s, r) => s + r.Filas, 0);
        resultado.carteras = resumen.length;
    }
    return resultado;
}

/* =========================================================
   CASCADA TIPO → CATÁLOGOS
   ---------------------------------------------------------
   Los catálogos crecen con todo lo que se capturó alguna vez (hoy hay
   marcas de laptops y de monitores en la misma lista), así que al
   elegir un Tipo el formulario sólo ofrece las marcas, modelos y
   especificaciones que ESE tipo de equipo realmente usa. Se deriva del
   propio inventario, sin tabla de mapeo nueva: el propio dato enseña.
   Si un tipo todavía no tiene datos en alguna categoría, la UI muestra
   el catálogo completo para no bloquear la captura.
   ========================================================= */
const CASCADA_TIPO = [
    ['marcas',             'ActivoFijoMarcas',             'IdMarca',            'IdMarca'],
    ['modelos',            'ActivoFijoModelos',            'IdModelo',           'IdModelo'],
    ['procesadores',       'ActivoFijoProcesadores',       'IdProcesador',       'IdProcesador'],
    ['memoriasRam',        'ActivoFijoMemoriasRAM',        'IdMemoriaRAM',       'IdMemoriaRAM'],
    ['almacenamientos',    'ActivoFijoAlmacenamientos',    'IdAlmacenamiento',   'IdAlmacenamiento'],
    ['sistemasOperativos', 'ActivoFijoSistemasOperativos', 'IdSistemaOperativo', 'IdSistemaOperativo'],
    ['voltajes',           'ActivoFijoVoltajes',           'IdVoltaje',          'IdVoltaje']
];

/* ---------------------------------------------------------
   PERFIL REAL DE UN TIPO
   ---------------------------------------------------------
   Las banderas "RequiereX" del catálogo se capturan a mano y se
   desfasan del inventario (CPU marca RequiereUsuarioAsignado = 0 aunque
   todas las CPU tengan usuario). Aquí se mide el inventario: cuántos
   equipos de ESE tipo tienen cada campo capturado. El formulario y el
   importador usan este perfil como fuente de verdad y dejan la bandera
   del catálogo sólo como respaldo cuando el tipo aún no tiene equipos.
   --------------------------------------------------------- */
const PERFIL_TIPO = [
    ['marca',            ['IdMarca']],
    ['modelo',           ['IdModelo', 'Modelo']],
    ['serie',            ['NoSerie']],
    ['imei',             ['IMEI1', 'IMEI2']],
    ['telefono',         ['NoTelefono']],
    ['sitio',            ['IdSitio']],
    ['subtipo',          ['IdSubtipo']],
    ['clasificacion',    ['IdClasificacion']],
    ['tamanio',          ['IdTamanio']],
    ['capacidad',        ['IdCapacidad']],
    ['voltaje',          ['IdVoltaje']],
    ['usuarioAsignado',  ['IdUsuarioAsignado', 'UsuarioAsignado']],
    ['precio',           ['PrecioActivo']],
    ['procesador',       ['IdProcesador', 'Procesador']],
    ['memoriaRam',       ['IdMemoriaRAM', 'MemoriaRAM']],
    ['almacenamiento',   ['IdAlmacenamiento', 'Almacenamiento']],
    ['sistemaOperativo', ['IdSistemaOperativo', 'SistemaOperativo']],
    ['accesorios',       ['Accesorios']]
];

/* Un campo está capturado cuando tiene texto o un id distinto de 0.
   Sirve igual para columnas de texto (esquema viejo) y para las FK. */
function expresionCapturado(columna) {
    return `CASE WHEN af.[${columna}] IS NULL THEN 0
                 WHEN CONVERT(nvarchar(100), af.[columna]) IN ('', '0') THEN 0
                 ELSE 1 END`;
}

const UMBRAL_REQUERIDO = 0.6;

async function perfilPorTipo(pool, idTipo) {
    const vacio = { total: 0, claves: {} };
    try {
        const presentes = await catalogosDB.columnasExistentes(
            'ActivoFijoEquipos',
            PERFIL_TIPO.flatMap(([, cols]) => cols)
        );

        const sumas = [];
        const claves = [];
        for (const [clave, cols] of PERFIL_TIPO) {
            const disponibles = cols.filter(c => presentes.has(c));
            if (disponibles.length === 0) continue;
            claves.push([clave, disponibles]);
            sumas.push(`SUM(CASE WHEN ${disponibles.map(expresionCapturado).join(' OR ')} THEN 1 ELSE 0 END) AS [${clave}]`);
        }
        if (sumas.length === 0) return vacio;

        const r = await pool.request()
            .input('IdTipo', sql.Int, idTipo)
            .query(`
                SELECT COUNT(*) AS total, ${sumas.join(',\n                       ')}
                FROM ActivoFijoEquipos af
                WHERE af.IdTipo = @IdTipo`);

        const fila = (r.recordset && r.recordset[0]) || {};
        const total = Number(fila.total) || 0;
        const salida = { total, claves: {} };

        for (const [clave] of claves) {
            const usos = Number(fila[clave]) || 0;
            salida.claves[clave] = {
                usos,
                total,
                /* Sin equipos capturados no opina: manda la bandera del catálogo. */
                requerido: total > 0 && (usos / total) >= UMBRAL_REQUERIDO,
                usado: usos > 0
            };
        }

        /* Especificaciones completas: las cuatro juntas, igual que las exige
           el formulario y el importador. */
        const especificaciones = ['procesador', 'memoriaRam', 'almacenamiento', 'sistemaOperativo'];
        if (especificaciones.every(k => salida.claves[k])) {
            const minimo = Math.min(...especificaciones.map(k => salida.claves[k].usos));
            salida.claves.especificaciones = {
                usos: minimo,
                total,
                requerido: total > 0 && (minimo / total) >= UMBRAL_REQUERIDO,
                usado: minimo > 0
            };
        }

        return salida;
    } catch (_) {
        return vacio;
    }
}

async function catalogoPorTipo(idTipo) {
    const id = Number(idTipo) || 0;
    const salida = { ok: true, idTipo: id, perfil: { total: 0, claves: {} } };
    for (const [clave] of CASCADA_TIPO) salida[clave] = [];
    if (!id) return salida;

    try {
        const pool = await getPool();
        salida.perfil = await perfilPorTipo(pool, id);
        const resultados = await Promise.all(CASCADA_TIPO.map(async ([clave, tabla, pk, fk]) => {
            try {
                const r = await pool.request()
                    .input('IdTipo', sql.Int, id)
                    .query(`
                        SELECT DISTINCT c.${pk} AS id, c.Nombre AS nombre
                        FROM ActivoFijoEquipos af
                        INNER JOIN dbo.${tabla} c ON c.${pk} = af.${fk}
                        WHERE af.IdTipo = @IdTipo
                        ORDER BY c.Nombre`);
                return [clave, r.recordset || []];
            } catch (_) {
                /* Catálogo o columna ausente en un esquema viejo: esa
                   categoría simplemente no filtra. */
                return [clave, []];
            }
        }));
        for (const [clave, filas] of resultados) salida[clave] = filas;
        return salida;
    } catch (err) {
        for (const [clave] of CASCADA_TIPO) salida[clave] = [];
        return { ok: false, mensaje: 'No se pudo filtrar por tipo: ' + err.message, ...salida };
    }
}

/* =========================================================
   CATÁLOGOS AUXILIARES
   ========================================================= */
async function listarTipos() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT IdTipo, Nombre, GrupoSubtipo,
               RequiereResponsiva, RequiereIMEI, RequiereTelefono,
               RequiereSitio, RequiereSubtipo, RequiereClasificacion,
               RequiereTamanio, RequiereCapacidad, RequiereVoltaje,
               RequiereUsuarioAsignado,
               RequierePrecio, RequiereEspecificaciones, RequiereAccesorios
        FROM ActivoFijoTipos
        WHERE Activo = 1
        ORDER BY Nombre
    `);
    return r.recordset;
}

async function listarMarcas() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdMarca, Nombre FROM ActivoFijoMarcas WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarEstados() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdEstado, Nombre FROM ActivoFijoEstados WHERE Activo = 1 ORDER BY IdEstado'
    );
    return r.recordset;
}

async function listarEstatus() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdEstatus, Nombre FROM ActivoFijoEstatus WHERE Activo = 1 ORDER BY IdEstatus'
    );
    return r.recordset;
}

async function listarCarteras() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdCartera, Nombre FROM ActivoFijoCarteras WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarSitios() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdSitio, Nombre FROM ActivoFijoSitios WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarSubtipos() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdSubtipo, Grupo, Nombre FROM ActivoFijoSubtipos WHERE Activo = 1 ORDER BY Grupo, Nombre'
    );
    return r.recordset;
}

async function listarVoltajes() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdVoltaje, Nombre FROM ActivoFijoVoltajes WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarClasificaciones() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdClasificacion, Nombre FROM ActivoFijoClasificaciones WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarTamanios() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdTamanio, Nombre FROM ActivoFijoTamanios WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarCapacidades() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdCapacidad, Nombre FROM ActivoFijoCapacidades WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarCatalogosExtendidos() {
    return catalogosDB.listarEspecificaciones();
}

module.exports = {
    listar, obtener, crear, actualizar, eliminar, restaurar, eliminarDefinitivo,
    historico, exportarInventario,
    /* Contexto automático por hostname (cartera / sitio COPERVA) */
    inferirContexto, autoasignar,
    /* Cascada Tipo → marca / modelo / especificaciones */
    catalogoPorTipo,
    /* Perfil real del tipo (usos/total del inventario) y contexto para el
       importador masivo: ambos derivan del propio dato. */
    perfilPorTipo, contextoParaImportacion,
    listarTipos, listarMarcas, listarEstados, listarEstatus, listarCarteras,
    listarSitios, listarSubtipos, listarVoltajes,
    listarClasificaciones, listarTamanios, listarCapacidades,
    listarCatalogosExtendidos
};