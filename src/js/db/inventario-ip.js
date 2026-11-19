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
            CASE WHEN OBJECT_ID(N'dbo.ActivoFijoEquiposRed', N'U') IS NULL THEN 0 ELSE 1 END AS Red,
            CASE WHEN OBJECT_ID(N'dbo.vw_InventarioIPMaestro', N'V') IS NULL THEN 0 ELSE 1 END AS Maestra
    `);
    const fila = (result.recordset && result.recordset[0]) || {};
    estadoProcedenciaCache = {
        columnas: !!fila.OrigenIP,
        vista: !!fila.Vista,
        /* Red que reporta el colector para cada activo fijo. Sin la tabla,
           el control general sólo puede mostrar General + Cliente. */
        red: !!fila.Red,
        /* Tabla maestra única (scripts/inventario-ip-maestro.sql): una fila por
           IP, ya fusionada de los tres orígenes. Cuando existe es la fuente
           preferida; si no, se cae a la vista/consulta de siempre. */
        maestra: !!fila.Maestra
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

/* =========================================================
   GESTIÓN DE LAS FILAS DEL COLECTOR (Origen 'Activo')
   ---------------------------------------------------------
   Esas filas las reporta el colector en dbo.ActivoFijoEquiposRed:
   traen IP, MAC y el nombre técnico del adaptador, pero nunca piso,
   cliente ni puerto del Fortinet. dbo.InventarioIPGestion
   (scripts/control-general-ip.sql) guarda SÓLO ese complemento, con
   una clave estable por adaptador.

   Regla: no se copia la IP ni se crea otra fila. La gestión se aplica
   ENCIMA de la fila que ya devuelve la vista (o el respaldo UNION), así
   la pantalla sigue mostrando un solo renglón por tarjeta de red.
   ========================================================= */

const TABLA_GESTION = 'dbo.InventarioIPGestion';

/**
 * Clave estable de una fila del colector: 'MAC:00:11:22:33:44:55' o
 * 'IP:192.168.1.10' cuando el adaptador no expone MAC.
 * @returns {?string} null si la fila no se puede identificar.
 */
function claveGestion(fila) {
    const mac = normalizarMAC(fila?.MAC);
    if (mac) return `MAC:${mac}`;
    const ip = String(fila?.IP || '').trim();
    return ip ? `IP:${normalizarIPv4(ip)}` : null;
}

/** Valida y normaliza una clave recibida de la interfaz. */
function normalizarClaveGestion(clave) {
    const texto = String(clave || '').trim();
    const separador = texto.indexOf(':');
    if (separador < 0) return null;
    const tipo = texto.slice(0, separador).toUpperCase();
    const valor = texto.slice(separador + 1).trim();
    if (!valor) return null;
    if (tipo === 'MAC') {
        const mac = normalizarMAC(valor);
        return mac ? `MAC:${mac}` : null;
    }
    if (tipo === 'IP') return validarIPv4(valor) ? `IP:${normalizarIPv4(valor)}` : null;
    return null;
}

/* ¿La base ya tiene la tabla de gestión y sus columnas de catálogo?
   - sin tabla: el módulo se comporta como antes (filas del colector de sólo
     lectura) en lugar de fallar;
   - sin IdDispositivo/IdTipoEquipo (script anterior): se siguen gestionando
     piso, cliente, puerto y descripción;
   - sin IdSite (script anterior): se siguen gestionando los demás campos;
   - sin IdPisoPlano o sin dbo.Pisos: sólo se ofrece el piso del catálogo de
     control general. */
let estadoGestionCache = null;
async function estadoGestion(pool) {
    if (estadoGestionCache) return estadoGestionCache;
    const result = await pool.request().query(`
        SELECT
            CASE WHEN OBJECT_ID(N'${TABLA_GESTION}', N'U') IS NULL THEN 0 ELSE 1 END AS Tabla,
            CASE WHEN COL_LENGTH(N'${TABLA_GESTION}', N'IdDispositivo') IS NULL THEN 0 ELSE 1 END AS Catalogos,
            CASE WHEN COL_LENGTH(N'${TABLA_GESTION}', N'IdSite') IS NULL THEN 0 ELSE 1 END AS Site,
            CASE WHEN COL_LENGTH(N'${TABLA_GESTION}', N'IdPisoPlano') IS NULL THEN 0 ELSE 1 END AS PisoPlano,
            CASE WHEN OBJECT_ID(N'dbo.Pisos', N'U') IS NULL THEN 0 ELSE 1 END AS Pisos
    `);
    const fila = (result.recordset && result.recordset[0]) || {};
    estadoGestionCache = {
        tabla: !!fila.Tabla,
        catalogos: !!fila.Catalogos,
        site: !!fila.Site,
        /* El piso del plano (dbo.Pisos) sólo se puede guardar y mostrar si
           existen la columna y la tabla: son otro vocabulario distinto del
           catálogo de control general. */
        pisoPlano: !!fila.PisoPlano && !!fila.Pisos
    };
    return estadoGestionCache;
}

async function hayTablaGestion(pool) {
    return (await estadoGestion(pool)).tabla;
}

/**
 * Mapa clave → datos gestionados, con piso, cliente, dispositivo y tipo ya
 * resueltos a nombre.
 * @returns {Promise<?Map<string, object>>} null si la tabla no existe.
 */
async function mapaGestion(pool) {
    const estado = await estadoGestion(pool);
    if (!estado.tabla) return null;
    /* Clasificación por catálogo: sólo existe si el script se volvió a
       ejecutar; si no, se devuelve NULL y el renglón muestra lo del colector. */
    const columnasCatalogo = estado.catalogos
        ? `G.IdDispositivo, Dispositivo.Nombre AS Dispositivo,
           G.IdTipoEquipo, TipoEquipo.Nombre AS TipoEquipo,`
        : `CAST(NULL AS INT) AS IdDispositivo, CAST(NULL AS NVARCHAR(150)) AS Dispositivo,
           CAST(NULL AS INT) AS IdTipoEquipo, CAST(NULL AS NVARCHAR(150)) AS TipoEquipo,`;
    const joinsCatalogo = estado.catalogos
        ? `LEFT JOIN dbo.CatalogosInventarioIP Dispositivo
               ON Dispositivo.IdCatalogoIP = G.IdDispositivo
           LEFT JOIN dbo.CatalogosInventarioIP TipoEquipo
               ON TipoEquipo.IdCatalogoIP = G.IdTipoEquipo`
        : '';
    /* Switch (Site): columna añadida después; sin ella la pantalla sigue
       funcionando y sólo se oculta ese campo del diálogo. */
    const columnasSite = estado.site
        ? 'G.IdSite, Switch.Nombre AS Site,'
        : 'CAST(NULL AS INT) AS IdSite, CAST(NULL AS NVARCHAR(150)) AS Site,';
    const joinSite = estado.site
        ? `LEFT JOIN dbo.CatalogosInventarioIP Switch
               ON Switch.IdCatalogoIP = G.IdSite`
        : '';
    /* Piso del plano (dbo.Pisos): el otro vocabulario. Sin la columna o sin la
       tabla se devuelve NULL y la pantalla sólo ofrece el de control general. */
    const columnasPisoPlano = estado.pisoPlano
        ? 'G.IdPisoPlano, PisoPlano.Nombre AS PisoPlano,'
        : 'CAST(NULL AS INT) AS IdPisoPlano, CAST(NULL AS NVARCHAR(150)) AS PisoPlano,';
    const joinPisoPlano = estado.pisoPlano
        ? `LEFT JOIN dbo.Pisos PisoPlano ON PisoPlano.IdPiso = G.IdPisoPlano`
        : '';
    const result = await pool.request().query(`
        SELECT G.IdGestion, G.Clave, ${columnasCatalogo}
               G.IdPiso, Piso.Nombre AS Piso,
               ${columnasPisoPlano}
               ${columnasSite}
               G.IdCliente, C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
               G.PuertoFortinet, G.Descripcion
        FROM dbo.InventarioIPGestion G
        ${joinsCatalogo}
        LEFT JOIN dbo.CatalogosInventarioIP Piso ON Piso.IdCatalogoIP = G.IdPiso
        ${joinPisoPlano}
        ${joinSite}
        LEFT JOIN dbo.Clientes C ON C.IdCliente = G.IdCliente
    `);
    return new Map(
        (result.recordset || []).map(fila => [String(fila.Clave || '').trim(), fila])
    );
}

/** Texto vacío o en blanco = "no manda": se conserva lo del colector. */
function textoGestionado(valor) {
    const texto = String(valor === null || valor === undefined ? '' : valor).trim();
    return texto || null;
}

/**
 * Aplica la gestión encima de las filas del colector, en sitio.
 * Nunca agrega ni quita renglones: la IP sigue apareciendo una sola vez.
 * @param {Array<object>} registros filas de listar() (vista o respaldo).
 * @param {?Map<string, object>} gestion resultado de mapaGestion().
 */
function aplicarGestion(registros, gestion) {
    if (!gestion) return registros;
    for (const registro of registros) {
        /* Cualquier renglón identificable puede llevar datos capturados a mano
           (antes sólo los del colector): con la tabla maestra toda fila tiene
           clave de MAC o de IP y ésta es la única vía de edición. */
        const clave = claveGestion(registro);
        /* Sin clave el renglón no se puede identificar (adaptador sin MAC
           ni IP): la pantalla lo deja de sólo lectura. */
        if (!clave) continue;
        registro.ClaveGestion = clave;
        const datos = gestion.get(clave);
        if (!datos) continue;
        registro.IdGestion = datos.IdGestion;
        const descripcion = textoGestionado(datos.Descripcion);
        if (descripcion) registro.Descripcion = descripcion;
        const puerto = textoGestionado(datos.PuertoFortinet);
        if (puerto) registro.PuertoFortinet = puerto;
        /* Dispositivo y Tipo los elige una persona de un catálogo; el
           colector sólo aporta el nombre técnico del adaptador («Ethernet
           2»). Lo gestionado manda y el texto del colector se conserva en
           las columnas *Colector para poder mostrarlo como referencia. */
        const dispositivo = textoGestionado(datos.Dispositivo);
        if (dispositivo) {
            if (sinDato(registro.DispositivoColector)) {
                registro.DispositivoColector = registro.Dispositivo || null;
            }
            registro.Dispositivo = dispositivo;
            registro.IdDispositivo = datos.IdDispositivo ?? null;
        }
        const tipoEquipo = textoGestionado(datos.TipoEquipo);
        if (tipoEquipo) {
            if (sinDato(registro.TipoEquipoColector)) {
                registro.TipoEquipoColector = registro.TipoEquipo || null;
            }
            registro.TipoEquipo = tipoEquipo;
            registro.IdTipoEquipo = datos.IdTipoEquipo ?? null;
        }
        /* Piso: dos catálogos excluyentes. IdPiso es el de control general
           (CatalogosInventarioIP) e IdPisoPlano el del plano (dbo.Pisos). Se
           aplica el que la persona haya elegido. */
        if (datos.IdPiso) {
            registro.IdPiso = datos.IdPiso;
            registro.IdPisoPlano = null;
            registro.Piso = datos.Piso;
        } else if (datos.IdPisoPlano) {
            registro.IdPisoPlano = datos.IdPisoPlano;
            registro.IdPiso = null;
            registro.Piso = datos.PisoPlano;
        }
        /* Switch capturado aquí: manda sobre el que se hubiera heredado de un
           renglón manual de la misma IP. */
        if (datos.IdSite && datos.Site) {
            registro.IdSite = datos.IdSite;
            registro.Site = datos.Site;
        }
        if (datos.IdCliente) {
            registro.IdCliente = datos.IdCliente;
            registro.ClienteCodigo = datos.ClienteCodigo;
            registro.ClienteNombre = datos.ClienteNombre;
        }
        /* IdPiso e IdCliente pueden venir heredados de otra fuente (el
           piso de un equipo de cliente pertenece a dbo.Pisos, no a
           CatalogosInventarioIP). Sólo estos ids son los de ESTA
           gestión y los únicos que la pantalla puede preseleccionar. */
        registro.IdPisoGestion = datos.IdPiso ?? null;
        registro.IdPisoPlanoGestion = datos.IdPisoPlano ?? null;
        registro.IdSiteGestion = datos.IdSite ?? null;
        registro.IdClienteGestion = datos.IdCliente ?? null;
        registro.IdDispositivoGestion = datos.IdDispositivo ?? null;
        registro.IdTipoEquipoGestion = datos.IdTipoEquipo ?? null;
    }
    return registros;
}

/**
 * Guarda los datos que el colector no puede saber de un adaptador
 * (dispositivo, tipo, piso, cliente, puerto del Fortinet y descripción
 * legible). Si llega todo vacío, la gestión se retira y el renglón vuelve
 * a mostrar exactamente lo que reporta el colector.
 * @param {string} clave 'MAC:...' o 'IP:...' de la fila.
 */
async function guardarGestionActivo(clave, datos = {}) {
    const claveNormalizada = normalizarClaveGestion(clave);
    if (!claveNormalizada) {
        return { ok: false, mensaje: 'No se pudo identificar el adaptador de red de esta fila.' };
    }
    const idPiso = datos.idPiso ? validarIdCatalogo(datos.idPiso) : null;
    /* Piso del plano: es el id de dbo.Pisos, NO del catálogo de control
       general, así que se valida aparte (abajo, contra su propia tabla). */
    const idPisoPlano = datos.idPisoPlano ? validarIdCatalogo(datos.idPisoPlano) : null;
    const idSite = datos.idSite ? validarIdCatalogo(datos.idSite) : null;
    const idCliente = datos.idCliente ? validarIdCatalogo(datos.idCliente) : null;
    const idDispositivo = datos.idDispositivo ? validarIdCatalogo(datos.idDispositivo) : null;
    const idTipoEquipo = datos.idTipoEquipo ? validarIdCatalogo(datos.idTipoEquipo) : null;
    const puertoFortinet = String(datos.puertoFortinet || '').trim() || null;
    const descripcion = String(datos.descripcion || '').trim() || null;
    if ((datos.idPiso && !idPiso) || (datos.idPisoPlano && !idPisoPlano) ||
        (datos.idSite && !idSite) ||
        (datos.idCliente && !idCliente) ||
        (datos.idDispositivo && !idDispositivo) || (datos.idTipoEquipo && !idTipoEquipo) ||
        (puertoFortinet && puertoFortinet.length > 100) ||
        (descripcion && descripcion.length > 500)) {
        return { ok: false, mensaje: 'Revisa los catálogos y la longitud de los campos.' };
    }
    if (!idPiso && !idPisoPlano && !idSite && !idCliente && !idDispositivo && !idTipoEquipo &&
        !puertoFortinet && !descripcion) {
        return await quitarGestionActivo(claveNormalizada);
    }

    const pool = await getPool();
    const estado = await estadoGestion(pool);
    if (!estado.tabla) {
        return {
            ok: false,
            tablaFaltante: true,
            mensaje: 'Falta ejecutar scripts/control-general-ip.sql para guardar los datos complementarios de las filas del colector.'
        };
    }
    /* Sin las columnas de catálogo (script aplicado antes de esta versión):
       se avisa en lugar de perder la clasificación en silencio. */
    if ((idDispositivo || idTipoEquipo) && !estado.catalogos) {
        return {
            ok: false,
            tablaFaltante: true,
            mensaje: 'Vuelve a ejecutar scripts/control-general-ip.sql para poder clasificar dispositivo y tipo en las filas del colector.'
        };
    }
    if (idSite && !estado.site) {
        return {
            ok: false,
            tablaFaltante: true,
            mensaje: 'Vuelve a ejecutar scripts/control-general-ip.sql para poder asignar el switch (Site) en las filas del colector.'
        };
    }
    if (idPisoPlano && !estado.pisoPlano) {
        return {
            ok: false,
            tablaFaltante: true,
            mensaje: 'Vuelve a ejecutar scripts/control-general-ip.sql para poder asignar el piso del plano en esta fila.'
        };
    }
    /* Los dos pisos son excluyentes: si llegaran los dos, manda el del
       catálogo de control general, que es el que se ofrece primero. */
    const pisoPlanoFinal = idPiso ? null : idPisoPlano;
    /* Catálogos: cada id debe existir, estar activo y ser de su categoría,
       igual que en el alta manual (guardar()). */
    const esperados = [['piso', idPiso, 'Piso'], ['dispositivo', idDispositivo, 'Dispositivo'],
        ['tipoEquipo', idTipoEquipo, 'TipoEquipo'], ['site', idSite, 'Site']]
        .filter(([, valor]) => valor);
    if (esperados.length) {
        const catalogosRequest = pool.request();
        esperados.forEach(([campo, valor]) => catalogosRequest.input(campo, sql.Int, valor));
        const catalogos = await catalogosRequest.query(`
            SELECT IdCatalogoIP, TipoCatalogo
            FROM dbo.CatalogosInventarioIP
            WHERE Activo = 1
              AND IdCatalogoIP IN (${esperados.map(([campo]) => `@${campo}`).join(', ')})
        `);
        const tipoPorId = new Map(catalogos.recordset.map(item => [item.IdCatalogoIP, item.TipoCatalogo]));
        if (esperados.some(([, valor, tipo]) => tipoPorId.get(valor) !== tipo)) {
            return { ok: false, mensaje: 'Uno o más catálogos seleccionados no existen o están inactivos.' };
        }
    }
    /* El piso del plano se valida contra SU tabla (dbo.Pisos), no contra
       CatalogosInventarioIP: son dos catálogos con ids distintos. */
    if (pisoPlanoFinal) {
        const pisoPlano = await pool.request()
            .input('IdPiso', sql.Int, pisoPlanoFinal)
            .query('SELECT 1 AS Existe FROM dbo.Pisos WHERE IdPiso = @IdPiso AND Activo = 1');
        if (!pisoPlano.recordset.length) {
            return { ok: false, mensaje: 'El piso del plano seleccionado ya no existe o está inactivo.' };
        }
    }
    if (idCliente) {
        const cliente = await pool.request()
            .input('IdCliente', sql.Int, idCliente)
            .query('SELECT 1 AS Existe FROM dbo.Clientes WHERE IdCliente = @IdCliente');
        if (!cliente.recordset.length) return { ok: false, mensaje: 'El cliente seleccionado ya no existe.' };
    }

    const request = pool.request()
        .input('Clave', sql.VarChar(60), claveNormalizada)
        .input('IdPiso', sql.Int, idPiso)
        .input('IdCliente', sql.Int, idCliente)
        .input('PuertoFortinet', sql.NVarChar(100), puertoFortinet)
        .input('Descripcion', sql.NVarChar(500), descripcion);
    /* Sólo se tocan las columnas de catálogo cuando la base ya las tiene. */
    const columnas = estado.catalogos
        ? { insertar: ', IdDispositivo, IdTipoEquipo', valores: ', @IdDispositivo, @IdTipoEquipo' }
        : { insertar: '', valores: '' };
    if (estado.catalogos) {
        request.input('IdDispositivo', sql.Int, idDispositivo)
            .input('IdTipoEquipo', sql.Int, idTipoEquipo);
    }
    if (estado.site) request.input('IdSite', sql.Int, idSite);
    if (estado.pisoPlano) request.input('IdPisoPlano', sql.Int, pisoPlanoFinal);
    /* Piso del plano: se escribe junto al de control general, pero sólo uno de
       los dos lleva valor (arriba se anula el que no se eligió). */
    const columnaPisoPlano = estado.pisoPlano ? ', IdPisoPlano' : '';
    const valorPisoPlano = estado.pisoPlano ? ', @IdPisoPlano' : '';

    try {
        await request.query(`
            MERGE dbo.InventarioIPGestion AS Destino
            USING (SELECT @Clave AS Clave) AS Origen
                ON Destino.Clave = Origen.Clave
            WHEN MATCHED THEN
                UPDATE SET IdPiso = @IdPiso, IdCliente = @IdCliente,
                    PuertoFortinet = @PuertoFortinet, Descripcion = @Descripcion
                    ${estado.site ? ', IdSite = @IdSite' : ''}
                    ${estado.pisoPlano ? ', IdPisoPlano = @IdPisoPlano' : ''}
                    ${estado.catalogos ? ', IdDispositivo = @IdDispositivo, IdTipoEquipo = @IdTipoEquipo' : ''},
                    FechaActualizacion = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (Clave, IdPiso, IdCliente, PuertoFortinet, Descripcion${columnas.insertar}${estado.site ? ', IdSite' : ''}${columnaPisoPlano})
                VALUES (@Clave, @IdPiso, @IdCliente, @PuertoFortinet, @Descripcion${columnas.valores}${estado.site ? ', @IdSite' : ''}${valorPisoPlano});
        `);
        return { ok: true, mensaje: 'Datos del adaptador guardados (el colector no los sobrescribe).' };
    } catch (error) {
        if (error.number === 208) {
            return {
                ok: false,
                tablaFaltante: true,
                mensaje: 'Falta ejecutar scripts/control-general-ip.sql para guardar los datos del adaptador.'
            };
        }
        if (error.number === 547) return { ok: false, mensaje: 'El piso, el cliente o el catálogo ya no existen.' };
        throw error;
    }
}

/** Retira la gestión de un adaptador: vuelve a mostrar lo del colector. */
async function quitarGestionActivo(clave) {
    const claveNormalizada = normalizarClaveGestion(clave);
    if (!claveNormalizada) {
        return { ok: false, mensaje: 'No se pudo identificar el adaptador de red de esta fila.' };
    }
    const pool = await getPool();
    if (!(await hayTablaGestion(pool))) {
        return { ok: true, mensaje: 'No hay datos gestionados que restablecer.' };
    }
    await pool.request()
        .input('Clave', sql.VarChar(60), claveNormalizada)
        .query('DELETE FROM dbo.InventarioIPGestion WHERE Clave = @Clave');
    return { ok: true, mensaje: 'Se restablecieron los datos que reporta el colector.' };
}

/* =========================================================
   UNA IP = UN RENGLÓN
   ---------------------------------------------------------
   La misma dirección puede llegar por dos fuentes a la vez: el
   colector la reporta en dbo.ActivoFijoEquiposRed (Origen 'Activo',
   con MAC, hostname y adaptador) y además alguien la capturó como
   equipo de un cliente (dbo.Equipos, Origen 'Cliente') o a mano en el
   control general (dbo.InventarioGeneralIP, Origen 'General').
   Mostrar los dos renglones duplicaba la IP y obligaba a editar en dos
   lugares para un solo aparato.

   Regla: la fila del colector manda —es la observación real del
   equipo— y absorbe lo que el renglón manual sí sabe: piso, cliente,
   puerto del Fortinet, descripción legible y catálogos. El renglón
   manual desaparece de la LISTA, no de la base: sigue existiendo en
   Equipos / InventarioGeneralIP, donde se administra como siempre.

   Luego aplicarGestion() escribe ENCIMA lo capturado en esta pantalla
   (dbo.InventarioIPGestion), así que lo gestionado siempre gana.
   ========================================================= */

/* Campos que el colector no puede saber y que el renglón manual de la
   misma IP sí puede aportar. */
const CAMPOS_HEREDADOS = Object.freeze([
    'Piso', 'IdPiso', 'Site', 'IdSite', 'ClienteCodigo', 'ClienteNombre',
    'PuertoFortinet'
]);

/* Textos que el renglón manual SÍ puede reemplazar aunque el colector ya
   traiga uno: su valor es un dato técnico (nombre del adaptador / del
   medio), no una clasificación. El original se guarda en `<Campo>Colector`
   para mostrarlo como referencia y para poder volver a él. */
const CAMPOS_REEMPLAZABLES = Object.freeze([
    { campo: 'Dispositivo', id: 'IdDispositivo' },
    { campo: 'TipoEquipo', id: 'IdTipoEquipo' }
]);

function sinDato(valor) {
    return valor === null || valor === undefined || String(valor).trim() === '';
}

/* El renglón del cliente manda sobre el del control general: trae piso
   y cliente, que son justo los dos datos que cuestan más trabajo. */
function prioridadComplemento(registro) {
    return String(registro?.Origen || '') === 'Cliente' ? 0 : 1;
}

/* Mismo criterio que la vista: volátil = DHCP / WiFi del controlador. */
function esConfiable(registro) {
    return !(registro?.EsConfiable === 0 || registro?.EsConfiable === false);
}

/* Pasa a `base` sólo lo que le falta; nunca pisa un dato del colector. */
function heredarDeComplemento(base, complemento) {
    for (const campo of CAMPOS_HEREDADOS) {
        if (sinDato(base[campo]) && !sinDato(complemento[campo])) {
            base[campo] = complemento[campo];
        }
    }
    /* La descripción del colector es el nombre técnico del adaptador
       ("Intel(R) Ethernet Connection (2) I219-LM"): si el renglón manual
       tiene una legible, se muestra ésa y se conserva la técnica para
       que el diálogo de edición pueda proponerla. */
    const descripcion = textoGestionado(complemento.Descripcion);
    if (descripcion) {
        if (sinDato(base.DescripcionColector)) {
            base.DescripcionColector = base.Descripcion || null;
        }
        base.Descripcion = descripcion;
    }
    /* Dispositivo y Tipo: el renglón manual trae la clasificación que alguien
       eligió del catálogo; el colector sólo el nombre técnico del adaptador
       ("Ethernet 2"). Misma regla que la descripción: manda lo manual y el
       texto del colector queda en <Campo>Colector como referencia. */
    for (const { campo, id } of CAMPOS_REEMPLAZABLES) {
        const valor = textoGestionado(complemento[campo]);
        if (!valor) continue;
        if (sinDato(base[`${campo}Colector`])) {
            base[`${campo}Colector`] = base[campo] || null;
        }
        base[campo] = valor;
        if (!sinDato(complemento[id])) base[id] = complemento[id];
    }
    base.Fusionado = true;
    base.OrigenFusionado = base.OrigenFusionado || String(complemento.Origen || '') || null;
    base.IdEquipoFusionado = base.IdEquipoFusionado ?? complemento.IdEquipo ?? null;
    base.IdInventarioFusionado = base.IdInventarioFusionado ?? complemento.IdInventarioIP ?? null;
    /* Procedencia: si el renglón manual declara la dirección como fija y el
       colector la marca volátil, manda la más confiable. Sin esto un equipo
       podría DESAPARECER de la tabla al fusionarse (el filtro de volátiles
       lo oculta), justo lo contrario de lo que se busca. */
    if (esConfiable(complemento) && !esConfiable(base)) {
        base.OrigenIP = complemento.OrigenIP;
        base.EsConfiable = complemento.EsConfiable;
        base.TipoIP = complemento.TipoIP || base.TipoIP;
    }
}

/**
 * Colapsa los renglones que comparten IP: la fila del colector se queda
 * (con los datos heredados) y los renglones manuales se retiran.
 * Si una misma IP la reportan DOS adaptadores distintos del colector no
 * se fusiona nada: ahí hay un conflicto real que debe verse.
 * @param {Array<object>} registros filas de listar().
 * @returns {Array<object>} la misma lista, sin los renglones absorbidos.
 */
function fusionarPorIP(registros = []) {
    const grupos = new Map();
    for (const registro of registros) {
        const ip = String(registro?.IP || '').trim();
        if (!ip) continue;
        const clave = validarIPv4(ip) ? normalizarIPv4(ip) : ip;
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push(registro);
    }

    const absorbidos = new Set();
    for (const filasIP of grupos.values()) {
        if (filasIP.length < 2) continue;
        const colector = filasIP.filter(fila => String(fila?.Origen || '') === 'Activo');
        if (colector.length !== 1) continue;
        const base = colector[0];
        const complementos = filasIP
            .filter(fila => fila !== base)
            .sort((a, b) => prioridadComplemento(a) - prioridadComplemento(b));
        for (const complemento of complementos) {
            heredarDeComplemento(base, complemento);
            absorbidos.add(complemento);
        }
    }

    return absorbidos.size ? registros.filter(registro => !absorbidos.has(registro)) : registros;
}

/**
 * Lectura desde la TABLA MAESTRA ÚNICA (scripts/inventario-ip-maestro.sql).
 * Una fila por dirección: los tres orígenes (control general, equipos de
 * cliente y colector) ya vienen fusionados en la base por los triggers, así
 * que aquí no hay nada que fusionar ni que duplicar. Se devuelve la misma
 * forma de fila que espera la pantalla y se marcan los ids de gestión para
 * que el diálogo "Editar datos" pueda preseleccionarlos.
 * @returns {Promise<?Array<object>>} null si la vista maestra no se puede leer.
 */
async function listarDesdeMaestro(pool) {
    try {
        const result = await pool.request().query(`
            SELECT Origen, Origenes, IdIPMaestro, IdInventarioIP, IdEquipo, IdActivoFijoEQ,
                   IP, Hostname, MAC, ClaveGestion, Descripcion, DescripcionTecnica,
                   PuertoFortinet, Estado, Dispositivo, TipoEquipo, Piso, Site, TipoIP,
                   ClienteCodigo, ClienteNombre, OrigenIP, EsConfiable, FechaActualizacion,
                   IdEstado, IdDispositivo, IdTipoEquipo, IdPiso, IdSite, IdTipoIP, IdCliente,
                   IdPisoPlano, EnGeneral, EnCliente, EnColector, GestionManual, FuenteGestion,
                   NombreAdaptador, TipoMedio, DHCP
            FROM dbo.vw_InventarioIPMaestro
            ORDER BY IP, Hostname
        `);
        return (result.recordset || []).map(fila => {
            const registro = { ...fila };
            /* Clave estable para "Editar datos": la calcula la base y coincide
               exactamente con claveGestion() (MAC si hay, si no la IP). */
            registro.ClaveGestion = fila.ClaveGestion || claveGestion(fila);
            /* Ids de ESTA gestión (los del catálogo de control general), que
               son los únicos que el diálogo puede preseleccionar. */
            registro.IdDispositivoGestion = fila.IdDispositivo ?? null;
            registro.IdTipoEquipoGestion = fila.IdTipoEquipo ?? null;
            registro.IdPisoGestion = fila.IdPiso ?? null;
            /* Piso del plano: puede venir heredado del equipo de cliente o
               haberlo elegido una persona en "Editar datos". En ambos casos es
               el id de dbo.Pisos, que es lo que el diálogo debe preseleccionar
               en su segundo desplegable. */
            registro.IdPisoPlanoGestion = fila.IdPisoPlano ?? null;
            registro.IdSiteGestion = fila.IdSite ?? null;
            registro.IdClienteGestion = fila.IdCliente ?? null;
            /* Lo que reporta el colector, para mostrarlo como referencia
               debajo de Dispositivo/Tipo cuando la persona ya los clasificó. */
            registro.DispositivoColector = fila.NombreAdaptador || null;
            registro.TipoEquipoColector = fila.TipoMedio || null;
            return registro;
        });
    } catch (error) {
        /* Vista maestra de otra versión: se sigue con la vista/consulta de
           siempre en lugar de dejar la pantalla en blanco. */
        console.warn('[InventarioIP] vw_InventarioIPMaestro no se pudo leer:', error.message);
        return null;
    }
}

/**
 * ¿Quién es el dueño actual de una dirección? Se consulta la TABLA MAESTRA,
 * que es la única fuente que conoce los TRES orígenes a la vez (control
 * general, equipos de cliente y red del colector). Es la regla de propiedad
 * de IP: una dirección que ya vive en otro origen no se vuelve a dar de alta.
 *
 * Devuelve `null` cuando no se puede opinar (IP inválida o base sin la vista
 * maestra): en ese caso el que llama aplica su respaldo de siempre.
 * Devuelve un objeto —con `ocupada:false`— cuando la dirección está libre.
 *
 * @param {string} ip
 * @param {{idInventario?:number, idEquipo?:number}} excluir Registros que se
 *   están editando: su propio renglón no cuenta como conflicto.
 * @returns {Promise<?{ocupada:boolean, enGeneral:boolean, enCliente:boolean,
 *   enColector:boolean, Hostname:?string, ClienteCodigo:?string,
 *   PisoNombre:?string, mensaje:string}>}
 */
function evaluarDuenio(fila, direccion, excluir = {}) {
    const idInventario = validarIdCatalogo(excluir.idInventario);
    const idEquipo = validarIdCatalogo(excluir.idEquipo);
    /* Un alta del control general "vacía" (sólo IP + Estado) no identifica
       ningún aparato: no representa una dirección en uso y no debe impedir
       capturarla, igual que hace el buscador de IP libres. */
    const identifica = Boolean(
        String(fila.Hostname || '').trim() ||
        String(fila.MAC || '').trim() ||
        String(fila.Descripcion || '').trim()
    );
    /* Un renglón del control general dado de baja (Estado "Inactivo") ya no
       usa su dirección: la lupa la ofrece como libre y no debe bloquear el
       alta. Es la misma regla que ya aplicaba el módulo Equipos. */
    const generalEnUso = Boolean(fila.EnGeneral) && !/^inactivo$/i.test(String(fila.Estado || '').trim());
    const enGeneral = generalEnUso && fila.IdInventarioIP !== idInventario && identifica;
    const enCliente = Boolean(fila.EnCliente) && fila.IdEquipo !== idEquipo;
    const enColector = Boolean(fila.EnColector);

    const cliente = String(fila.ClienteCodigo || fila.ClienteNombre || '').trim() || null;
    const hostname = String(fila.Hostname || '').trim() || null;
    const piso = String(fila.Piso || '').trim() || null;

    let mensaje = '';
    if (enCliente) {
        mensaje = cliente
            ? `La IP ${direccion} ya está asignada al equipo ${hostname || 'sin hostname'} del cliente ${cliente}.`
            : `La IP ${direccion} ya está asignada a un equipo de cliente.`;
    } else if (enGeneral) {
        mensaje = `La IP ${direccion} ya está registrada en el control general`
            + `${hostname ? ` (${hostname})` : ''}. Edita ese registro en lugar de crear otro.`;
    }

    return {
        ocupada: Boolean(mensaje),
        enGeneral, enCliente, enColector,
        Hostname: hostname,
        ClienteCodigo: cliente,
        PisoNombre: piso,
        mensaje
    };
}

async function duenioDeIP(ip, excluir = {}) {
    if (!validarIPv4(ip)) return null;
    const pool = await getPool();
    const estado = await estadoProcedencia(pool);
    if (!estado.maestra) return null;

    const direccion = normalizarIPv4(ip);
    const result = await pool.request()
        .input('IP', sql.VarChar(45), direccion)
        .query(`
            SELECT TOP 1 m.IP, m.Origenes, m.EnGeneral, m.EnCliente, m.EnColector,
                   m.Hostname, m.MAC, m.Descripcion, m.Piso, m.Estado,
                   m.IdInventarioIP, m.IdEquipo, m.ClienteCodigo, m.ClienteNombre
            FROM dbo.vw_InventarioIPMaestro m
            WHERE m.IP = @IP
        `);
    const fila = result.recordset[0];
    if (!fila) {
        /* La maestra tiene una fila por IP de los tres orígenes: si no está,
           la dirección está libre en todo el sistema. */
        return {
            ocupada: false, enGeneral: false, enCliente: false, enColector: false,
            Hostname: null, ClienteCodigo: null, PisoNombre: null, mensaje: ''
        };
    }
    return evaluarDuenio(fila, direccion, excluir);
}

/**
 * Igual que duenioDeIP() pero para un lote completo (importación masiva):
 * una sola consulta a la maestra en vez de una por fila. Devuelve un Map
 * IP normalizada -> fila, o null cuando la base no tiene la vista maestra
 * (en ese caso el importador se queda con su pre-validación).
 */
async function mapaDueniosDeIP() {
    const pool = await getPool();
    const estado = await estadoProcedencia(pool);
    if (!estado.maestra) return null;
    const result = await pool.request().query(`
        SELECT m.IP, m.Origenes, m.EnGeneral, m.EnCliente, m.EnColector,
               m.Hostname, m.MAC, m.Descripcion, m.Piso, m.Estado,
               m.IdInventarioIP, m.IdEquipo, m.ClienteCodigo, m.ClienteNombre
        FROM dbo.vw_InventarioIPMaestro m
        WHERE NULLIF(LTRIM(RTRIM(m.IP)), '') IS NOT NULL
    `);
    const mapa = new Map();
    for (const fila of result.recordset || []) {
        const cruda = String(fila.IP || '').trim();
        if (!cruda) continue;
        /* Las fuentes no guardan la IP con el mismo formato (192.168.005.086),
           así que la llave se normaliza igual que la del archivo. */
        mapa.set(validarIPv4(cruda) ? normalizarIPv4(cruda) : cruda, fila);
    }
    return mapa;
}

async function listar() {
    const pool = await getPool();
    const estado = await estadoProcedencia(pool);

    /* 1) Tabla maestra única: una fila por IP, ya fusionada en la base.
       La gestión (piso, cliente, switch, puerto, dispositivo, tipo y
       descripción) viaja dentro de la propia fila, así que no hace falta
       aplicarla después. */
    if (estado.maestra) {
        const filas = await listarDesdeMaestro(pool);
        if (filas) return filas;
    }

    /* Datos gestionados a mano de las filas del colector (null si la tabla
       todavía no existe: esas filas quedan como antes, de sólo lectura). */
    const gestion = await mapaGestion(pool);


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
            return aplicarGestion(fusionarPorIP(result.recordset), gestion);
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
    return aplicarGestion(fusionarPorIP(result.recordset), gestion);
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

    /* Propiedad de la IP: se pregunta a la TABLA MAESTRA, que es la única
       fuente que ve los tres orígenes. Antes sólo se miraban los equipos de
       cliente, así que una dirección que ya vivía en el control general (o en
       la red del colector) se colaba hasta que la rechazaba el índice único. */
    let duenio = null;
    if (ip) {
        duenio = await duenioDeIP(ip, { idInventario });
        if (duenio?.ocupada) {
            return {
                ok: false,
                tipo: 'ip-duplicada',
                mensaje: duenio.mensaje,
                detalle: duenio
            };
        }
        /* Sin la vista maestra (base de otra versión): respaldo de siempre,
           consultando el módulo de Equipos directamente. */
        if (!duenio) {
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

    /* La IP que reporta el colector se puede capturar aquí sin miedo: la
       tabla maestra las junta en un solo renglón. Se avisa para que nadie
       crea que acaba de duplicar el inventario. */
    const avisoColector = duenio?.enColector
        ? ' La red de esa dirección también la reporta el colector: se verá como un solo renglón.'
        : '';

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
                ? { ok: true, mensaje: `Registro de IP actualizado.${avisoColector}` }
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
        return { ok: true, mensaje: `Registro general de IP creado.${avisoColector}` };
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

/**
 * Todas las IP que ya están EN USO (control general + equipos estáticos).
 * Se aplica el mismo criterio que listarOcupacionSegmento() en db/equipos.js:
 * - un registro del control general dado de baja (Estado "Inactivo") ya no usa
 *   su dirección, así que no debe marcar la fila del archivo como duplicada;
 * - un alta vacía (sólo IP + Estado, sin hostname, MAC ni descripción) no
 *   identifica ningún aparato y tampoco ocupa la IP.
 */
async function listarIPsOcupadas() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT LTRIM(RTRIM(I.IP)) AS IP
        FROM dbo.InventarioGeneralIP I
        LEFT JOIN dbo.CatalogosInventarioIP Est
               ON Est.IdCatalogoIP = I.IdEstado
              AND Est.TipoCatalogo = 'Estado'
        WHERE NULLIF(LTRIM(RTRIM(I.IP)), '') IS NOT NULL
          AND UPPER(LTRIM(RTRIM(ISNULL(Est.Nombre, N'')))) = N'ACTIVO'
          AND (
                NULLIF(LTRIM(RTRIM(I.Hostname)), N'') IS NOT NULL
             OR NULLIF(LTRIM(RTRIM(I.MAC)), '') IS NOT NULL
             OR NULLIF(LTRIM(RTRIM(I.Descripcion)), N'') IS NOT NULL
          )
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

    /* Propiedad de la IP: la MISMA regla del alta manual (duenioDeIP), pero en
       una sola consulta porque aquí se inserta un lote. Mientras la base no
       tenga la vista maestra el mapa es null y se respeta la pre-validación
       del importador (control general + equipos estáticos). */
    const duenios = await mapaDueniosDeIP();

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

        /* Propiedad de la IP: no se da de alta una dirección que ya vive en
           otro origen (control general, equipo de cliente o red del colector).
           Es la misma regla del alta manual, aplicada fila por fila. */
        if (ip && duenios) {
            const direccion = normalizarIPv4(ip);
            const filaMaestra = duenios.get(direccion);
            const duenio = filaMaestra ? evaluarDuenio(filaMaestra, direccion) : null;
            if (duenio && duenio.ocupada) {
                errores.push(`${referencia}: ${duenio.mensaje}`);
                continue;
            }
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
    /* Complemento editable de las filas que reporta el colector
       (dbo.InventarioIPGestion): la IP no se duplica. */
    guardarGestionActivo,
    quitarGestionActivo,
    claveGestion,
    /* Propiedad de la IP: la consulta el alta del control general y la del
       módulo Equipos, para que la regla sea una sola. */
    duenioDeIP,
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
