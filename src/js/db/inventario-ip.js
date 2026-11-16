const { getPool, sql } = require('./conexion');
const rangosDB = require('./rangos');

const TIPOS_CATALOGO = Object.freeze([
    'Estado',
    'Dispositivo',
    'TipoEquipo',
    'Piso',
    'Site',
    'TipoIP'
]);

/* Origen de una opción de catálogo: NULL = compartida (sirve al control
   general y a los equipos de los clientes). Ver scripts/control-general-ip.sql. */
const ORIGENES_CATALOGO = Object.freeze(['General', 'Cliente']);

/* Preferencias de la pantalla que se guardan en la base de datos
   (dbo.PreferenciasInventarioIP). */
const CLAVE_COLOR_GENERAL = 'color-general';
const COLOR_GENERAL_DEFECTO = '#5C6B73';

function validarIdCatalogo(id) {
    const valor = Number(id);
    return Number.isInteger(valor) && valor > 0 ? valor : null;
}

function normalizarOrigen(origen) {
    const valor = String(origen || '').trim();
    return ORIGENES_CATALOGO.includes(valor) ? valor : null;
}

/* ¿La base ya tiene la columna Origen? Si el script no se ha ejecutado, el
   módulo sigue trabajando con la estructura anterior en lugar de fallar. */
let columnaOrigenDetectada = null;
async function hayColumnaOrigen(pool) {
    if (columnaOrigenDetectada !== null) return columnaOrigenDetectada;
    const result = await pool.request().query(`
        SELECT 1 AS Existe FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.CatalogosInventarioIP') AND name = N'Origen'
    `);
    columnaOrigenDetectada = result.recordset.length > 0;
    return columnaOrigenDetectada;
}

/* =========================================================
   PROCEDENCIA DE LA IP (OrigenIP / EsConfiable)
   ---------------------------------------------------------
   No todas las IP valen lo mismo: una estática capturada a mano es
   inventario duro; una que entrega un DHCP o, peor, un controlador
   WiFi puede cambiar en la siguiente reconexión. Por eso se guarda
   de dónde salió y si es confiable.

   Reglas:
     · TipoIP "DHCP"             → OrigenIP 'DHCP',  EsConfiable 0
     · TipoIP "WiFi (controlador)"→ OrigenIP 'Wifi',  EsConfiable 0
     · cualquier otra (Estatica)  → OrigenIP 'Manual', EsConfiable 1
   El colector puede mandar `origenIP` explícito: manda en los tipos
   estáticos, pero un TipoIP volátil (DHCP/WiFi) tiene la última palabra
   para que lo guardado coincida con lo que deduce la vista unificada.
   ========================================================= */

const ORIGENES_IP = Object.freeze(['Manual', 'DHCP', 'Wifi', 'Otro']);

/** Devuelve 'Manual' | 'DHCP' | 'Wifi' | 'Otro' | null. */
function normalizarOrigenIP(origen) {
    const valor = String(origen ?? '').trim().toLowerCase();
    if (!valor) return null;
    return ORIGENES_IP.find(item => item.toLowerCase() === valor) || null;
}

/** Procedencia implícita según el nombre del catálogo TipoIP. */
function procedenciaPorTipoIP(nombreTipoIP) {
    const nombre = String(nombreTipoIP || '').trim();
    if (!nombre) return { origenIP: null, esConfiable: 1 };
    if (/^(wifi|wi-fi)/i.test(nombre)) return { origenIP: 'Wifi', esConfiable: 0 };
    if (/^(dhcp|din[aá]mic)/i.test(nombre)) return { origenIP: 'DHCP', esConfiable: 0 };
    return { origenIP: 'Manual', esConfiable: 1 };
}

/**
 * ¿El TipoIP permite guardar el registro SIN IP?
 * DHCP, "Dinámica" y "WiFi (controlador)" entregan la dirección después del
 * alta, así que la fila puede existir vacía o con una IP que cambiará. Un
 * tipo estático/manual sí la exige. La regla se deduce del mismo criterio de
 * procedencia (volátil = no confiable) para no comparar texto crudo.
 */
function permiteSinIP(nombreTipoIP) {
    return procedenciaPorTipoIP(nombreTipoIP).esConfiable === 0;
}

/**
 * Resuelve la procedencia de un registro.
 *
 * Un TipoIP volátil (DHCP / Dinámica / WiFi del controlador) SIEMPRE manda:
 * si el formulario o el colector mandan `origenIP` contradictorio (p.ej.
 * 'Manual' sobre un TipoIP WiFi) se ignora, porque la vista unificada deduce
 * 'Wifi'/'DHCP' del catálogo y quedaría un dato guardado al revés de lo que
 * se muestra. En tipos estáticos el valor explícito sí manda, para poder
 * registrar 'Otro' o corregir a mano.
 * @returns {{origenIP: ?string, esConfiable: number}}
 */
function resolverProcedencia(datos, nombreTipoIP) {
    const explicito = normalizarOrigenIP(datos?.origenIP);
    const base = procedenciaPorTipoIP(nombreTipoIP);
    const volatil = base.esConfiable === 0;
    const origenIP = volatil ? base.origenIP : (explicito || base.origenIP);
    const esConfiableExplicito = datos?.esConfiable === undefined || datos?.esConfiable === null
        ? null
        : (datos.esConfiable ? 1 : 0);
    /* Un origen volátil nunca es confiable; el resto obedece lo explícito y,
       si no viene, se deduce del origen ('Manual' = inventario duro). */
    const esConfiable = volatil
        ? 0
        : (esConfiableExplicito !== null
            ? esConfiableExplicito
            : (origenIP ? (origenIP === 'Manual' ? 1 : 0) : base.esConfiable));
    return { origenIP, esConfiable };
}

/* ¿La base ya tiene las columnas de procedencia y/o la vista unificada?
   Mismo criterio que hayColumnaOrigen: sin el script aplicado, el módulo
   trabaja con la estructura anterior en lugar de reventar. */
let estadoProcedenciaCache = null;
async function estadoProcedencia(pool) {
    if (estadoProcedenciaCache) return estadoProcedenciaCache;
    const result = await pool.request().query(`
        SELECT
            CASE WHEN COL_LENGTH(N'dbo.InventarioGeneralIP', N'OrigenIP') IS NULL THEN 0 ELSE 1 END AS OrigenIP,
            CASE WHEN OBJECT_ID(N'dbo.vw_InventarioIPUnificado', N'V') IS NULL THEN 0 ELSE 1 END AS Vista,
            CASE WHEN OBJECT_ID(N'dbo.ActivoFijoEquiposRed', N'U') IS NULL THEN 0 ELSE 1 END AS Red
    `);
    const fila = (result.recordset && result.recordset[0]) || {};
    estadoProcedenciaCache = {
        columnas: !!fila.OrigenIP,
        vista: !!fila.Vista,
        /* Red que reporta el colector para cada activo fijo. Sin la tabla,
           el control general sólo puede mostrar General + Cliente. */
        red: !!fila.Red
    };
    return estadoProcedenciaCache;
}

function validarIPv4(ip) {
    const octetos = String(ip || '').trim().split('.');
    return octetos.length === 4 && octetos.every(octeto =>
        /^\d{1,3}$/.test(octeto) && Number(octeto) >= 0 && Number(octeto) <= 255
    );
}

function normalizarIPv4(ip) {
    return String(ip).trim().split('.').map(octeto => String(Number(octeto))).join('.');
}

/**
 * Normaliza una MAC al formato 00:11:22:33:44:55.
 * Acepta guiones, puntos, espacios o los 12 dígitos pegados.
 * @returns {string|null} '' si viene vacía, null si no tiene 12 hex válidos.
 */
function normalizarMAC(mac) {
    const texto = String(mac === null || mac === undefined ? '' : mac).trim();
    if (!texto) return '';
    const hex = texto.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (hex.length !== 12) return null;
    return hex.match(/.{2}/g).join(':');
}

/**
 * ¿Hay que validar la IP contra los rangos de los clientes?
 * Al editar solo se valida si la IP cambia: así un registro histórico no
 * queda bloqueado por una norma posterior.
 */
async function requiereValidarRangos(pool, idInventario, ip) {
    if (!idInventario) return true;
    const actual = await pool.request()
        .input('IdInventarioIP', sql.Int, idInventario)
        .query('SELECT IP FROM dbo.InventarioGeneralIP WHERE IdInventarioIP = @IdInventarioIP');
    const anterior = actual.recordset?.[0]?.IP;
    if (!anterior) return true;
    return normalizarIPv4(anterior) !== normalizarIPv4(ip);
}

/**
 * Lista las opciones de catálogo.
 * @param {?string} origen 'General' o 'Cliente' para incluir sólo las
 *   compartidas (Origen NULL) y las de ese origen; null = todas.
 */
async function listarCatalogos(origen = null) {
    const pool = await getPool();
    const ambito = normalizarOrigen(origen);
    if (!ambito || !(await hayColumnaOrigen(pool))) {
        const result = await pool.request().query(`
            SELECT IdCatalogoIP, TipoCatalogo, Nombre, Activo
            FROM dbo.CatalogosInventarioIP
            ORDER BY TipoCatalogo, Nombre
        `);
        return result.recordset;
    }
    const result = await pool.request()
        .input('Origen', sql.VarChar(10), ambito)
        .query(`
            SELECT IdCatalogoIP, TipoCatalogo, Nombre, Activo, Origen
            FROM dbo.CatalogosInventarioIP
            WHERE Origen IS NULL OR Origen = @Origen
            ORDER BY TipoCatalogo, Nombre
        `);
    return result.recordset;
}

async function guardarCatalogo(tipo, nombre, id = null, origen = null) {
    const categoria = String(tipo || '');
    const valor = String(nombre || '').trim();
    const idCatalogo = id === null ? null : validarIdCatalogo(id);
    if (!TIPOS_CATALOGO.includes(categoria) || !valor || valor.length > 100 ||
        (id !== null && !idCatalogo)) {
        return { ok: false, mensaje: 'La categoría o el nombre del catálogo no son válidos.' };
    }

    const pool = await getPool();
    /* Sin la columna Origen (script sin ejecutar) todo se guarda compartido. */
    const ambito = (await hayColumnaOrigen(pool)) ? normalizarOrigen(origen) : null;
    const request = pool.request()
        .input('TipoCatalogo', sql.VarChar(30), categoria)
        .input('Nombre', sql.NVarChar(100), valor);
    if (ambito) request.input('Origen', sql.VarChar(10), ambito);

    if (idCatalogo) {
        request.input('IdCatalogoIP', sql.Int, idCatalogo);
        try {
            const result = await request.query(`
                UPDATE dbo.CatalogosInventarioIP
                SET Nombre = @Nombre, Activo = 1
                    ${ambito ? ', Origen = @Origen' : ''}
                WHERE IdCatalogoIP = @IdCatalogoIP AND TipoCatalogo = @TipoCatalogo
            `);
            return result.rowsAffected[0]
                ? { ok: true, mensaje: 'Catálogo actualizado.' }
                : { ok: false, mensaje: 'El registro ya no existe en la categoría seleccionada.' };
        } catch (error) {
            if (error.number === 2627 || error.number === 2601) {
                return { ok: false, mensaje: 'Ya existe esa opción en el catálogo seleccionado.' };
            }
            throw error;
        }
    }

    try {
        await request.query(`
            INSERT INTO dbo.CatalogosInventarioIP (TipoCatalogo, Nombre${ambito ? ', Origen' : ''})
            VALUES (@TipoCatalogo, @Nombre${ambito ? ', @Origen' : ''})
        `);
        return { ok: true, mensaje: 'Catálogo agregado.' };
    } catch (error) {
        if (error.number === 2627 || error.number === 2601) {
            return { ok: false, mensaje: 'Ya existe esa opción en el catálogo seleccionado.' };
        }
        throw error;
    }
}

async function eliminarCatalogo(id) {
    const idCatalogo = validarIdCatalogo(id);
    if (!idCatalogo) return { ok: false, mensaje: 'El catálogo seleccionado no es válido.' };

    const pool = await getPool();
    try {
        const result = await pool.request()
            .input('IdCatalogoIP', sql.Int, idCatalogo)
            .query('DELETE FROM dbo.CatalogosInventarioIP WHERE IdCatalogoIP = @IdCatalogoIP');
        return result.rowsAffected[0]
            ? { ok: true, mensaje: 'Catálogo eliminado.' }
            : { ok: false, mensaje: 'El registro del catálogo ya no existe.' };
    } catch (error) {
        if (error.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar: el catálogo está asignado a una IP.' };
        }
        throw error;
    }
}

/* =========================================================
   PREFERENCIAS DE LA PANTALLA (dbo.PreferenciasInventarioIP)
   Antes vivían sólo en localStorage, así que cada equipo tenía su propio
   color. Ahora se guardan en la base y son las mismas para todos.
   ========================================================= */

/* Validador/normalizador por preferencia conocida. */
const VALIDADORES_PREFERENCIA = Object.freeze({
    [CLAVE_COLOR_GENERAL]: valor =>
        /^#[0-9A-F]{6}$/i.test(String(valor || '').trim())
            ? String(valor).trim().toUpperCase()
            : null
});

function validarPreferencia(clave, valor) {
    const nombre = String(clave || '').trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(VALIDADORES_PREFERENCIA, nombre)) return null;
    const normalizado = VALIDADORES_PREFERENCIA[nombre](valor);
    return normalizado ? { clave: nombre, valor: normalizado } : null;
}

/** Devuelve { 'color-general': '#RRGGBB', ... }; {} si la tabla no existe. */
async function listarPreferencias() {
    const pool = await getPool();
    try {
        const result = await pool.request().query(`
            SELECT Clave, Valor FROM dbo.PreferenciasInventarioIP
        `);
        const preferencias = {};
        for (const fila of result.recordset) {
            preferencias[String(fila.Clave || '').trim().toLowerCase()] = fila.Valor;
        }
        return preferencias;
    } catch (error) {
        if (error.number === 208) return {};
        throw error;
    }
}

async function guardarPreferencia(clave, valor) {
    const preferencia = validarPreferencia(clave, valor);
    if (!preferencia) return { ok: false, mensaje: 'La preferencia enviada no es válida.' };

    const pool = await getPool();
    try {
        const request = pool.request()
            .input('Clave', sql.VarChar(60), preferencia.clave)
            .input('Valor', sql.NVarChar(200), preferencia.valor);
        const actualizado = await request.query(`
            UPDATE dbo.PreferenciasInventarioIP
            SET Valor = @Valor, FechaActualizacion = SYSDATETIME()
            WHERE Clave = @Clave
        `);
        if (!actualizado.rowsAffected[0]) {
            await request.query(`
                INSERT INTO dbo.PreferenciasInventarioIP (Clave, Valor)
                VALUES (@Clave, @Valor)
            `);
        }
        return { ok: true, mensaje: 'Preferencia guardada.', valor: preferencia.valor };
    } catch (error) {
        if (error.number === 208) {
            return {
                ok: false,
                tablaFaltante: true,
                mensaje: 'Falta ejecutar scripts/control-general-ip.sql para guardar la preferencia en la base de datos.'
            };
        }
        throw error;
    }
}

async function listar() {
    const pool = await getPool();
    const estado = await estadoProcedencia(pool);

    /* Con la vista aplicada (scripts/activo-vivo-vistas.sql) la unión de
       control general + equipos de clientes vive en la base: una sola
       definición, sin IP/hostnames repetidos en consultas distintas. */
    if (estado.vista) {
        try {
            const result = await pool.request().query(`
                SELECT Origen, IdInventarioIP, IdEquipo, IP, Hostname, MAC, Descripcion,
                       PuertoFortinet, Estado, Dispositivo, TipoEquipo, Piso, Site, TipoIP,
                       ClienteCodigo, ClienteNombre, OrigenIP, EsConfiable, FechaActualizacion,
                       IdEstado, IdDispositivo, IdTipoEquipo, IdPiso, IdSite, IdTipoIP
                FROM dbo.vw_InventarioIPUnificado
                ORDER BY IP, Hostname, Origen
            `);
            return result.recordset;
        } catch (error) {
            /* Vista desalineada (base de otra versión): se sigue con la
               consulta directa en lugar de dejar la pantalla en blanco. */
            console.warn('[InventarioIP] vw_InventarioIPUnificado no se pudo leer:', error.message);
        }
    }

    /* Procedencia de la IP. Se calcula exactamente igual que en
       dbo.vw_InventarioIPUnificado (scripts/activo-vivo-vistas.sql): el
       TipoIP manda sobre el dato guardado, así lo que entrega un DHCP o un
       controlador WiFi nunca cuenta como inventario duro. */
    const procedencia = estado.columnas
        ? `CASE WHEN TipoIP.Nombre LIKE N'WiFi%'       THEN 'Wifi'
                WHEN TipoIP.Nombre LIKE N'DHCP%'       THEN 'DHCP'
                WHEN TipoIP.Nombre LIKE N'Din[aá]mic%' THEN 'DHCP'
                WHEN I.OrigenIP IS NOT NULL            THEN I.OrigenIP
                ELSE 'Manual' END AS OrigenIP,
           CASE WHEN TipoIP.Nombre LIKE N'WiFi%'
                 OR TipoIP.Nombre LIKE N'DHCP%'
                 OR TipoIP.Nombre LIKE N'Din[aá]mic%' THEN CAST(0 AS BIT)
                ELSE ISNULL(I.EsConfiable, 1) END AS EsConfiable`
        : 'CAST(NULL AS VARCHAR(20)) AS OrigenIP, CAST(1 AS BIT) AS EsConfiable';
    /* Los equipos de clientes no guardan OrigenIP (no se duplica el dato):
       su procedencia se deduce del TipoIP que ya vive en dbo.Equipos. */
    const procedenciaCliente = estado.columnas
        ? `CASE WHEN E.TipoIP = N'Estatica' THEN 'Manual' ELSE 'DHCP' END AS OrigenIP,
           CASE WHEN E.TipoIP = N'Estatica' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS EsConfiable`
        : 'CAST(NULL AS VARCHAR(20)) AS OrigenIP, CAST(1 AS BIT) AS EsConfiable';
    /* Tercera fuente: la red que reporta el colector para cada activo fijo
       (dbo.ActivoFijoEquiposRed). Sin este bloque los equipos capturados
       por el colector —laptops por WiFi, DHCP, WORKGROUP— no aparecían
       nunca en el control general, porque su IP no vive en
       InventarioGeneralIP ni en Equipos. Un solo renglón por tarjeta de red
       (se agrupa por MAC, o por IP si no hay MAC) para que un equipo
       registrado dos veces no repita la misma dirección: de cada grupo se
       toma el adaptador principal vigente y, si ninguno lo está, el último
       visto.
       Si la tabla no existe (script de detalle sin aplicar) el bloque se
       omite en lugar de romper la consulta completa. */
    const bloqueActivo = estado.red
        ? `

            UNION ALL

            SELECT N'Activo' AS Origen, CAST(NULL AS INT) AS IdInventarioIP,
                   CAST(NULL AS INT) AS IdEquipo,
                   NULLIF(LTRIM(RTRIM(A.IP)), '') AS IP, A.Hostname, A.MAC,
                   COALESCE(NULLIF(LTRIM(RTRIM(A.DescripcionAdaptador)), N''),
                            NULLIF(LTRIM(RTRIM(A.NombreAdaptador)), N'')) AS Descripcion,
                   CAST(NULL AS NVARCHAR(100)) AS PuertoFortinet,
                   N'Activo' AS Estado,
                   NULLIF(LTRIM(RTRIM(A.NombreAdaptador)), N'') AS Dispositivo,
                   COALESCE(NULLIF(LTRIM(RTRIM(A.TipoMedio)), N''),
                            NULLIF(LTRIM(RTRIM(A.DescripcionAdaptador)), N'')) AS TipoEquipo,
                   CAST(NULL AS NVARCHAR(150)) AS Piso, CAST(NULL AS NVARCHAR(150)) AS Site,
                   CASE WHEN A.EsWifi = 1 THEN N'WiFi'
                        WHEN A.DHCP = 1   THEN N'DHCP'
                        ELSE N'Estatica' END AS TipoIP,
                   CAST(NULL AS NVARCHAR(10)) AS ClienteCodigo,
                   CAST(NULL AS NVARCHAR(150)) AS ClienteNombre,
                   A.UltimaDeteccion AS FechaActualizacion,
                   CASE WHEN A.EsWifi = 1 THEN 'Wifi'
                        WHEN A.DHCP = 1   THEN 'DHCP'
                        ELSE 'Manual' END AS OrigenIP,
                   CASE WHEN A.EsWifi = 1 OR A.DHCP = 1 THEN CAST(0 AS BIT)
                        ELSE CAST(1 AS BIT) END AS EsConfiable,
                   CAST(NULL AS INT) AS IdEstado, CAST(NULL AS INT) AS IdDispositivo,
                   CAST(NULL AS INT) AS IdTipoEquipo, CAST(NULL AS INT) AS IdPiso,
                   CAST(NULL AS INT) AS IdSite, CAST(NULL AS INT) AS IdTipoIP
            FROM (
                SELECT R.IdActivoFijoEQ, R.Hostname, R.MAC, R.IP, R.NombreAdaptador,
                       R.DescripcionAdaptador, R.TipoMedio, R.DHCP, R.UltimaDeteccion,
                       ROW_NUMBER() OVER (
                           /* Una tarjeta de red = una MAC (o su IP si no
                              expone MAC); así la misma IP no sale repetida
                              cuando el equipo viene registrado dos veces. */
                           PARTITION BY COALESCE(
                               NULLIF(LTRIM(RTRIM(R.MAC)), N''),
                               CONCAT(N'IP:', COALESCE(NULLIF(LTRIM(RTRIM(R.IP)), N''),
                                                       CONCAT(N'R', R.IdEquipoRed)))
                           )
                           ORDER BY CASE WHEN R.IdActivoFijoEQ IS NULL THEN 1 ELSE 0 END,
                                    R.EsPrincipal DESC, R.UltimaDeteccion DESC, R.IdEquipoRed DESC
                       ) AS Renglon,
                       CASE WHEN ISNULL(R.TipoMedio, N'') LIKE N'%Wi%Fi%'
                              OR ISNULL(R.TipoMedio, N'') LIKE N'%Wireless%'
                              OR ISNULL(R.TipoMedio, N'') LIKE N'%WLAN%'
                              OR ISNULL(R.NombreAdaptador, N'') LIKE N'%Wi%Fi%'
                              OR ISNULL(R.NombreAdaptador, N'') LIKE N'%Wireless%'
                              OR ISNULL(R.DescripcionAdaptador, N'') LIKE N'%Wi%Fi%'
                              OR ISNULL(R.DescripcionAdaptador, N'') LIKE N'%Wireless%'
                            THEN 1 ELSE 0 END AS EsWifi
                FROM dbo.ActivoFijoEquiposRed R
                WHERE R.Vigente = 1
            ) A
            WHERE A.Renglon = 1`
        : '';
    const result = await pool.request().query(`
        SELECT Inventario.Origen, Inventario.IdInventarioIP, Inventario.IdEquipo,
               Inventario.IP, Inventario.Hostname, Inventario.MAC, Inventario.Descripcion,
               Inventario.PuertoFortinet, Inventario.Estado, Inventario.Dispositivo,
               Inventario.TipoEquipo, Inventario.Piso, Inventario.Site, Inventario.TipoIP,
               Inventario.ClienteCodigo, Inventario.ClienteNombre, Inventario.FechaActualizacion,
               Inventario.OrigenIP, Inventario.EsConfiable,
               Inventario.IdEstado, Inventario.IdDispositivo, Inventario.IdTipoEquipo,
               Inventario.IdPiso, Inventario.IdSite, Inventario.IdTipoIP
        FROM (
            SELECT N'General' AS Origen, I.IdInventarioIP, CAST(NULL AS INT) AS IdEquipo,
                   I.IP, I.Hostname, I.MAC, I.Descripcion, I.PuertoFortinet,
                   Estado.Nombre AS Estado, Dispositivo.Nombre AS Dispositivo,
                   TipoEquipo.Nombre AS TipoEquipo, Piso.Nombre AS Piso, Site.Nombre AS Site,
                   TipoIP.Nombre AS TipoIP,
                   CAST(NULL AS NVARCHAR(10)) AS ClienteCodigo,
                   CAST(NULL AS NVARCHAR(150)) AS ClienteNombre,
                   I.FechaActualizacion,
                   ${procedencia},
                   I.IdEstado, I.IdDispositivo, I.IdTipoEquipo,
                   I.IdPiso, I.IdSite, I.IdTipoIP
            FROM dbo.InventarioGeneralIP I
            LEFT JOIN dbo.CatalogosInventarioIP Estado ON Estado.IdCatalogoIP = I.IdEstado
            LEFT JOIN dbo.CatalogosInventarioIP Dispositivo ON Dispositivo.IdCatalogoIP = I.IdDispositivo
            LEFT JOIN dbo.CatalogosInventarioIP TipoEquipo ON TipoEquipo.IdCatalogoIP = I.IdTipoEquipo
            LEFT JOIN dbo.CatalogosInventarioIP Piso ON Piso.IdCatalogoIP = I.IdPiso
            LEFT JOIN dbo.CatalogosInventarioIP Site ON Site.IdCatalogoIP = I.IdSite
            LEFT JOIN dbo.CatalogosInventarioIP TipoIP ON TipoIP.IdCatalogoIP = I.IdTipoIP

            UNION ALL

            SELECT N'Cliente' AS Origen, CAST(NULL AS INT) AS IdInventarioIP, E.IdEquipo,
                   LTRIM(RTRIM(E.IP)) AS IP, E.Hostname, Datos.MAC, Datos.Descripcion,
                   Datos.PuertoFortinet,
                   CASE WHEN E.Activo = 1 THEN N'Activo' ELSE N'Inactivo' END AS Estado,
                   Dispositivo.Nombre AS Dispositivo, TipoEquipo.Nombre AS TipoEquipo,
                   P.Nombre AS Piso, Site.Nombre AS Site,
                   E.TipoIP, C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
                   Datos.FechaActualizacion,
                   ${procedenciaCliente},
                   CAST(NULL AS INT) AS IdEstado,
                   Datos.IdDispositivo, Datos.IdTipoEquipo, E.IdPiso, Datos.IdSite,
                   CAST(NULL AS INT) AS IdTipoIP
            FROM dbo.Equipos E
            INNER JOIN dbo.Clientes C ON C.IdCliente = E.IdCliente
            LEFT JOIN dbo.Pisos P ON P.IdPiso = E.IdPiso
            LEFT JOIN dbo.EquiposControlGeneralIP Datos ON Datos.IdEquipo = E.IdEquipo
            LEFT JOIN dbo.CatalogosInventarioIP Dispositivo ON Dispositivo.IdCatalogoIP = Datos.IdDispositivo
            LEFT JOIN dbo.CatalogosInventarioIP TipoEquipo ON TipoEquipo.IdCatalogoIP = Datos.IdTipoEquipo
            LEFT JOIN dbo.CatalogosInventarioIP Site ON Site.IdCatalogoIP = Datos.IdSite
            WHERE E.TipoIP = 'Estatica'
              AND E.Activo = 1
              AND NULLIF(LTRIM(RTRIM(E.IP)), '') IS NOT NULL
            ${bloqueActivo}
        ) Inventario
        ORDER BY Inventario.IP, Inventario.Hostname, Inventario.Origen
    `);
    return result.recordset;
}

async function actualizarDatosEquipoCliente(idEquipo, datos) {
    const equipo = validarIdCatalogo(idEquipo);
    const macNormalizada = normalizarMAC(datos?.mac);
    const mac = macNormalizada || null;
    const descripcion = String(datos?.descripcion || '').trim() || null;
    const puertoFortinet = String(datos?.puertoFortinet || '').trim() || null;
    const ids = {
        dispositivo: datos?.idDispositivo ? validarIdCatalogo(datos.idDispositivo) : null,
        tipoEquipo: datos?.idTipoEquipo ? validarIdCatalogo(datos.idTipoEquipo) : null,
        site: datos?.idSite ? validarIdCatalogo(datos.idSite) : null
    };
    if (!equipo || Object.entries(ids).some(([campo, valor]) =>
        datos?.[`id${campo[0].toUpperCase()}${campo.slice(1)}`] && !valor
    ) || macNormalizada === null || (descripcion && descripcion.length > 500) ||
        (puertoFortinet && puertoFortinet.length > 100)) {
        return { ok: false, mensaje: 'Revisa los catálogos y la longitud de los campos.' };
    }

    const pool = await getPool();
    const catalogosRequest = pool.request();
    Object.entries(ids).forEach(([campo, valor]) => {
        if (valor) catalogosRequest.input(campo, sql.Int, valor);
    });
    const catalogos = await catalogosRequest.query(`
        SELECT IdCatalogoIP, TipoCatalogo
        FROM dbo.CatalogosInventarioIP
        WHERE Activo = 1
          AND IdCatalogoIP IN (${Object.keys(ids).filter(campo => ids[campo]).map(campo => `@${campo}`).join(',') || 'NULL'})
    `);
    const catalogosPorId = new Map(catalogos.recordset.map(item => [item.IdCatalogoIP, item.TipoCatalogo]));
    const tiposEsperados = { dispositivo: 'Dispositivo', tipoEquipo: 'TipoEquipo', site: 'Site' };
    if (Object.entries(ids).some(([campo, valor]) =>
        valor && catalogosPorId.get(valor) !== tiposEsperados[campo]
    )) {
        return { ok: false, mensaje: 'Uno o más catálogos seleccionados no existen o están inactivos.' };
    }

    const result = await pool.request()
        .input('IdEquipo', sql.Int, equipo)
        .input('MAC', sql.VarChar(17), mac)
        .input('Descripcion', sql.NVarChar(500), descripcion)
        .input('PuertoFortinet', sql.NVarChar(100), puertoFortinet)
        .input('IdDispositivo', sql.Int, ids.dispositivo)
        .input('IdTipoEquipo', sql.Int, ids.tipoEquipo)
        .input('IdSite', sql.Int, ids.site)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM dbo.Equipos
                WHERE IdEquipo = @IdEquipo AND Activo = 1 AND TipoIP = 'Estatica'
            )
                SELECT CAST(0 AS INT) AS Actualizado;
            ELSE
            BEGIN
                MERGE dbo.EquiposControlGeneralIP AS Destino
                USING (SELECT @IdEquipo AS IdEquipo) AS Origen
                    ON Destino.IdEquipo = Origen.IdEquipo
                WHEN MATCHED THEN
                    UPDATE SET MAC = @MAC, Descripcion = @Descripcion,
                        PuertoFortinet = @PuertoFortinet, IdDispositivo = @IdDispositivo,
                        IdTipoEquipo = @IdTipoEquipo, IdSite = @IdSite,
                        FechaActualizacion = SYSDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (IdEquipo, MAC, Descripcion, PuertoFortinet, IdDispositivo,
                            IdTipoEquipo, IdSite)
                    VALUES (@IdEquipo, @MAC, @Descripcion, @PuertoFortinet, @IdDispositivo,
                            @IdTipoEquipo, @IdSite);
                SELECT CAST(1 AS INT) AS Actualizado;
            END
        `);
    return result.recordset[0]?.Actualizado
        ? { ok: true, mensaje: 'Datos complementarios del equipo actualizados.' }
        : { ok: false, mensaje: 'El equipo ya no existe, está inactivo o no tiene IP estática.' };
}

async function guardar(datos, id = null) {
    const idInventario = id === null ? null : validarIdCatalogo(id);
    let ip = String(datos?.ip || '').trim() || null;
    const hostname = String(datos?.hostname || '').trim() || null;
    /* La MAC se guarda siempre normalizada (00:11:22:33:44:55): la pantalla
       la formatea mientras se captura y aquí se valida otra vez, así una
       importación o una llamada directa no meten formatos distintos. */
    const macNormalizada = normalizarMAC(datos?.mac);
    const mac = macNormalizada || null;
    const descripcion = String(datos?.descripcion || '').trim() || null;
    const puertoFortinet = String(datos?.puertoFortinet || '').trim() || null;
    const ids = {
        estado: validarIdCatalogo(datos?.idEstado),
        dispositivo: validarIdCatalogo(datos?.idDispositivo),
        tipoEquipo: validarIdCatalogo(datos?.idTipoEquipo),
        piso: validarIdCatalogo(datos?.idPiso),
        site: validarIdCatalogo(datos?.idSite),
        tipoIP: validarIdCatalogo(datos?.idTipoIP)
    };

    if ((id !== null && !idInventario) ||
        (ip && !validarIPv4(ip)) ||
        Object.values(ids).some(valor => !valor) ||
        macNormalizada === null ||
        (hostname && hostname.length > 255) ||
        (descripcion && descripcion.length > 500) ||
        (puertoFortinet && puertoFortinet.length > 100)) {
        return { ok: false, mensaje: 'Revisa la IP, los catálogos y la longitud de los campos.' };
    }
    if (ip) ip = normalizarIPv4(ip);

    const pool = await getPool();
    const catalogosRequest = pool.request();
    Object.entries(ids).forEach(([campo, valor]) =>
        catalogosRequest.input(campo, sql.Int, valor)
    );
    const catalogos = await catalogosRequest.query(`
        SELECT IdCatalogoIP, TipoCatalogo, Nombre
        FROM dbo.CatalogosInventarioIP
        WHERE Activo = 1
          AND IdCatalogoIP IN (@estado, @dispositivo, @tipoEquipo, @piso, @site, @tipoIP)
    `);
    const catalogosPorId = new Map(catalogos.recordset.map(item => [item.IdCatalogoIP, item]));
    const tiposEsperados = {
        estado: 'Estado',
        dispositivo: 'Dispositivo',
        tipoEquipo: 'TipoEquipo',
        piso: 'Piso',
        site: 'Site',
        tipoIP: 'TipoIP'
    };
    if (Object.entries(tiposEsperados).some(([campo, tipo]) =>
        catalogosPorId.get(ids[campo])?.TipoCatalogo !== tipo
    )) {
        return { ok: false, mensaje: 'Uno o más catálogos seleccionados no existen o están inactivos.' };
    }
    const tipoIP = catalogosPorId.get(ids.tipoIP).Nombre;
    /* DHCP y el controlador WiFi asignan la IP después: pueden quedar sin
       dirección. Estático/manual sí la exigen. */
    if (!ip && !permiteSinIP(tipoIP)) {
        return {
            ok: false,
            mensaje: 'Captura la IP: sólo DHCP o WiFi (controlador) pueden quedar sin dirección.'
        };
    }

    /* Procedencia: lo que mande el formulario (o el colector) tiene
       prioridad; si no viene, se deduce del TipoIP. Sólo se guarda cuando la
       base ya tiene las columnas (scripts/activo-vivo-unificado.sql). */
    const estructura = await estadoProcedencia(pool);
    const procedenciaIP = resolverProcedencia(datos, tipoIP);

    if (ip) {
        const equipoCliente = await pool.request()
            .input('IP', sql.VarChar(45), ip)
            .query(`
                SELECT TOP 1 E.Hostname, C.Codigo AS ClienteCodigo
                FROM dbo.Equipos E
                INNER JOIN dbo.Clientes C ON C.IdCliente = E.IdCliente
                WHERE E.TipoIP = 'Estatica'
                  AND TRY_CONVERT(int, PARSENAME(E.IP, 4)) = TRY_CONVERT(int, PARSENAME(@IP, 4))
                  AND TRY_CONVERT(int, PARSENAME(E.IP, 3)) = TRY_CONVERT(int, PARSENAME(@IP, 3))
                  AND TRY_CONVERT(int, PARSENAME(E.IP, 2)) = TRY_CONVERT(int, PARSENAME(@IP, 2))
                  AND TRY_CONVERT(int, PARSENAME(E.IP, 1)) = TRY_CONVERT(int, PARSENAME(@IP, 1))
            `);
        if (equipoCliente.recordset.length) {
            return {
                ok: false,
                tipo: 'ip-duplicada',
                mensaje: `La IP ya está asignada al equipo ${equipoCliente.recordset[0].Hostname} del cliente ${equipoCliente.recordset[0].ClienteCodigo}.`
            };
        }
    }

    /* Una misma línea para clientes y general: la IP que un cliente ya
       reservó en sus rangos no puede ocuparla un dispositivo general. */
    if (ip) {
        const validar = await requiereValidarRangos(pool, idInventario, ip);
        if (validar) {
            const reservada = await rangosDB.rangoReservadoParaIP(ip);
            if (reservada.reservada) {
                return {
                    ok: false,
                    tipo: 'ip-en-rango-cliente',
                    mensaje: reservada.mensaje,
                    detalle: reservada
                };
            }
        }
    }

    const request = pool.request()
        .input('IP', sql.VarChar(45), ip)
        .input('Hostname', sql.NVarChar(255), hostname)
        .input('MAC', sql.VarChar(17), mac)
        .input('Descripcion', sql.NVarChar(500), descripcion)
        .input('PuertoFortinet', sql.NVarChar(100), puertoFortinet)
        .input('IdEstado', sql.Int, ids.estado)
        .input('IdDispositivo', sql.Int, ids.dispositivo)
        .input('IdTipoEquipo', sql.Int, ids.tipoEquipo)
        .input('IdPiso', sql.Int, ids.piso)
        .input('IdSite', sql.Int, ids.site)
        .input('IdTipoIP', sql.Int, ids.tipoIP);

    if (estructura.columnas) {
        request.input('OrigenIP', sql.VarChar(20), procedenciaIP.origenIP)
            .input('EsConfiable', sql.Bit, procedenciaIP.esConfiable);
    }

    try {
        if (idInventario) {
            request.input('IdInventarioIP', sql.Int, idInventario);
            const result = await request.query(`
                UPDATE dbo.InventarioGeneralIP
                SET IP = @IP, Hostname = @Hostname, MAC = @MAC, Descripcion = @Descripcion,
                    PuertoFortinet = @PuertoFortinet, IdEstado = @IdEstado,
                    IdDispositivo = @IdDispositivo, IdTipoEquipo = @IdTipoEquipo,
                    IdPiso = @IdPiso, IdSite = @IdSite, IdTipoIP = @IdTipoIP,
                    ${estructura.columnas ? 'OrigenIP = @OrigenIP, EsConfiable = @EsConfiable,' : ''}
                    FechaActualizacion = SYSDATETIME()
                WHERE IdInventarioIP = @IdInventarioIP
            `);
            return result.rowsAffected[0]
                ? { ok: true, mensaje: 'Registro de IP actualizado.' }
                : { ok: false, mensaje: 'El registro de IP ya no existe.' };
        }

        await request.query(`
            INSERT INTO dbo.InventarioGeneralIP
                (IP, Hostname, MAC, Descripcion, PuertoFortinet, IdEstado,
                 IdDispositivo, IdTipoEquipo, IdPiso, IdSite, IdTipoIP${estructura.columnas ? ', OrigenIP, EsConfiable' : ''})
            VALUES
                (@IP, @Hostname, @MAC, @Descripcion, @PuertoFortinet, @IdEstado,
                 @IdDispositivo, @IdTipoEquipo, @IdPiso, @IdSite, @IdTipoIP${estructura.columnas ? ', @OrigenIP, @EsConfiable' : ''})
        `);
        return { ok: true, mensaje: 'Registro general de IP creado.' };
    } catch (error) {
        if (error.number === 2627 || error.number === 2601) {
            return { ok: false, tipo: 'ip-duplicada', mensaje: 'La IP ya está registrada en el control general.' };
        }
        throw error;
    }
}

/* =========================================================
   IMPORTACIÓN MASIVA
   Se reutilizan las mismas reglas de IP/MAC que usa el alta manual,
   pero se agrupan las consultas para que un archivo de cientos de
   filas no castigue la base.
   ========================================================= */

/** Todas las IP que ya están tomadas (control general + equipos estáticos). */
async function listarIPsOcupadas() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT LTRIM(RTRIM(IP)) AS IP
        FROM dbo.InventarioGeneralIP
        WHERE NULLIF(LTRIM(RTRIM(IP)), '') IS NOT NULL
        UNION
        SELECT LTRIM(RTRIM(E.IP)) AS IP
        FROM dbo.Equipos E
        WHERE E.TipoIP = 'Estatica'
          AND E.Activo = 1
          AND NULLIF(LTRIM(RTRIM(E.IP)), '') IS NOT NULL
    `);
    return result.recordset
        .map(fila => String(fila.IP || '').trim())
        .filter(Boolean);
}

/**
 * MACs que ya existen en el sistema (control general + datos de equipos de
 * clientes). Se usan para avisar de posibles incoherencias al importar; el
 * formato varía según el origen, así que aquí sólo se devuelven crudas y el
 * importador las normaliza con normalizarMAC().
 */
async function listarMACsRegistradas() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT LTRIM(RTRIM(MAC)) AS MAC
        FROM dbo.InventarioGeneralIP
        WHERE NULLIF(LTRIM(RTRIM(MAC)), '') IS NOT NULL
        UNION
        SELECT LTRIM(RTRIM(Datos.MAC)) AS MAC
        FROM dbo.EquiposControlGeneralIP Datos
        WHERE NULLIF(LTRIM(RTRIM(Datos.MAC)), '') IS NOT NULL
    `);
    return result.recordset
        .map(fila => String(fila.MAC || '').trim())
        .filter(Boolean);
}

/**
 * Inserta registros ya validados por el importador.
 * Devuelve { insertados, errores[] } sin abortar todo el lote: una fila
 * con problemas (IP duplicada, catálogo borrado) se reporta y se sigue.
 */
async function insertarImportados(filas = []) {
    const pool = await getPool();
    let insertados = 0;
    const errores = [];

    /* Nombres de TipoIP: se usan para la misma regla del alta manual
       (una IP estática/dinámica necesita IP capturada). */
    const tiposIP = await pool.request().query(`
        SELECT IdCatalogoIP, Nombre
        FROM dbo.CatalogosInventarioIP
        WHERE TipoCatalogo = 'TipoIP'
    `);
    const nombreTipoIP = new Map(
        (tiposIP.recordset || []).map(item =>
            [Number(item.IdCatalogoIP), String(item.Nombre || '').trim().toUpperCase()])
    );

    /* Misma procedencia que el alta manual: cada fila hereda lo que diga el
       TipoIP (DHCP / WiFi = volátil) salvo que el importador lo especifique. */
    const estructura = await estadoProcedencia(pool);

    for (const fila of filas) {
        const referencia = String(fila?.hostname || fila?.ip || 'fila').trim();
        const ip = String(fila?.ip || '').trim() || null;
        const macNormalizada = normalizarMAC(fila?.mac);
        const hostname = String(fila?.hostname || '').trim() || null;
        const descripcion = String(fila?.descripcion || '').trim() || null;
        const puertoFortinet = String(fila?.puertoFortinet || '').trim() || null;
        const ids = {
            estado: validarIdCatalogo(fila?.idEstado),
            dispositivo: validarIdCatalogo(fila?.idDispositivo),
            tipoEquipo: validarIdCatalogo(fila?.idTipoEquipo),
            piso: validarIdCatalogo(fila?.idPiso),
            site: validarIdCatalogo(fila?.idSite),
            tipoIP: validarIdCatalogo(fila?.idTipoIP)
        };

        if ((ip && !validarIPv4(ip)) || macNormalizada === null ||
            Object.values(ids).some(valor => !valor) ||
            (hostname && hostname.length > 255) ||
            (descripcion && descripcion.length > 500) ||
            (puertoFortinet && puertoFortinet.length > 100)) {
            errores.push(`${referencia}: datos incompletos o con formato inválido.`);
            continue;
        }
        /* Misma regla que el alta manual: sólo los tipos volátiles
           (DHCP / WiFi controlador) pueden quedar sin IP. */
        if (!ip && !permiteSinIP(nombreTipoIP.get(ids.tipoIP))) {
            errores.push(`${referencia}: sin IP pero el tipo de asignación la exige (usa DHCP o WiFi).`);
            continue;
        }

        try {
            const procedenciaIP = resolverProcedencia(fila, nombreTipoIP.get(ids.tipoIP));
            const request = pool.request()
                .input('IP', sql.VarChar(45), ip ? normalizarIPv4(ip) : null)
                .input('Hostname', sql.NVarChar(255), hostname)
                .input('MAC', sql.VarChar(17), macNormalizada || null)
                .input('Descripcion', sql.NVarChar(500), descripcion)
                .input('PuertoFortinet', sql.NVarChar(100), puertoFortinet)
                .input('IdEstado', sql.Int, ids.estado)
                .input('IdDispositivo', sql.Int, ids.dispositivo)
                .input('IdTipoEquipo', sql.Int, ids.tipoEquipo)
                .input('IdPiso', sql.Int, ids.piso)
                .input('IdSite', sql.Int, ids.site)
                .input('IdTipoIP', sql.Int, ids.tipoIP);
            if (estructura.columnas) {
                request.input('OrigenIP', sql.VarChar(20), procedenciaIP.origenIP)
                    .input('EsConfiable', sql.Bit, procedenciaIP.esConfiable);
            }
            await request.query(`
                INSERT INTO dbo.InventarioGeneralIP
                    (IP, Hostname, MAC, Descripcion, PuertoFortinet, IdEstado,
                     IdDispositivo, IdTipoEquipo, IdPiso, IdSite, IdTipoIP${estructura.columnas ? ', OrigenIP, EsConfiable' : ''})
                VALUES
                    (@IP, @Hostname, @MAC, @Descripcion, @PuertoFortinet, @IdEstado,
                     @IdDispositivo, @IdTipoEquipo, @IdPiso, @IdSite, @IdTipoIP${estructura.columnas ? ', @OrigenIP, @EsConfiable' : ''})
            `);
            insertados += 1;
        } catch (error) {
            if (error.number === 2627 || error.number === 2601) {
                errores.push(`${referencia}: la IP ya está registrada en el control general.`);
            } else if (error.number === 547) {
                errores.push(`${referencia}: un catálogo asociado ya no existe.`);
            } else {
                errores.push(`${referencia}: ${error.message}`);
            }
        }
    }

    return { insertados, errores };
}

async function eliminar(id) {
    const idInventario = validarIdCatalogo(id);
    if (!idInventario) return { ok: false, mensaje: 'El registro seleccionado no es válido.' };
    const pool = await getPool();
    const result = await pool.request()
        .input('IdInventarioIP', sql.Int, idInventario)
        .query('DELETE FROM dbo.InventarioGeneralIP WHERE IdInventarioIP = @IdInventarioIP');
    return result.rowsAffected[0]
        ? { ok: true, mensaje: 'Registro de IP eliminado.' }
        : { ok: false, mensaje: 'El registro de IP ya no existe.' };
}

module.exports = {
    listarCatalogos,
    guardarCatalogo,
    eliminarCatalogo,
    listarPreferencias,
    guardarPreferencia,
    listar,
    actualizarDatosEquipoCliente,
    guardar,
    eliminar,
    listarIPsOcupadas,
    listarMACsRegistradas,
    insertarImportados,
    validarIPv4,
    normalizarIPv4,
    normalizarMAC,
    /* Procedencia de la IP: las usa el importador y el colector. */
    normalizarOrigenIP,
    procedenciaPorTipoIP,
    permiteSinIP,
    resolverProcedencia,
    estadoProcedencia
};
