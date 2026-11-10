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
    const result = await pool.request().query(`
        SELECT Inventario.Origen, Inventario.IdInventarioIP, Inventario.IdEquipo,
               Inventario.IP, Inventario.Hostname, Inventario.MAC, Inventario.Descripcion,
               Inventario.PuertoFortinet, Inventario.Estado, Inventario.Dispositivo,
               Inventario.TipoEquipo, Inventario.Piso, Inventario.Site, Inventario.TipoIP,
               Inventario.ClienteCodigo, Inventario.ClienteNombre, Inventario.FechaActualizacion,
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
                   I.FechaActualizacion, I.IdEstado, I.IdDispositivo, I.IdTipoEquipo,
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
                   Datos.FechaActualizacion, CAST(NULL AS INT) AS IdEstado,
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
        ) Inventario
        ORDER BY Inventario.IP, Inventario.Hostname, Inventario.Origen
    `);
    return result.recordset;
}

async function actualizarDatosEquipoCliente(idEquipo, datos) {
    const equipo = validarIdCatalogo(idEquipo);
    const mac = String(datos?.mac || '').trim() || null;
    const descripcion = String(datos?.descripcion || '').trim() || null;
    const puertoFortinet = String(datos?.puertoFortinet || '').trim() || null;
    const ids = {
        dispositivo: datos?.idDispositivo ? validarIdCatalogo(datos.idDispositivo) : null,
        tipoEquipo: datos?.idTipoEquipo ? validarIdCatalogo(datos.idTipoEquipo) : null,
        site: datos?.idSite ? validarIdCatalogo(datos.idSite) : null
    };
    if (!equipo || Object.entries(ids).some(([campo, valor]) =>
        datos?.[`id${campo[0].toUpperCase()}${campo.slice(1)}`] && !valor
    ) || (mac && mac.length > 17) || (descripcion && descripcion.length > 500) ||
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
    const mac = String(datos?.mac || '').trim() || null;
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
        (mac && mac.length > 17) ||
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
    if (tipoIP !== 'DHCP' && !ip) {
        return { ok: false, mensaje: 'Captura la IP cuando el tipo de asignación no sea DHCP.' };
    }

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

    try {
        if (idInventario) {
            request.input('IdInventarioIP', sql.Int, idInventario);
            const result = await request.query(`
                UPDATE dbo.InventarioGeneralIP
                SET IP = @IP, Hostname = @Hostname, MAC = @MAC, Descripcion = @Descripcion,
                    PuertoFortinet = @PuertoFortinet, IdEstado = @IdEstado,
                    IdDispositivo = @IdDispositivo, IdTipoEquipo = @IdTipoEquipo,
                    IdPiso = @IdPiso, IdSite = @IdSite, IdTipoIP = @IdTipoIP,
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
                 IdDispositivo, IdTipoEquipo, IdPiso, IdSite, IdTipoIP)
            VALUES
                (@IP, @Hostname, @MAC, @Descripcion, @PuertoFortinet, @IdEstado,
                 @IdDispositivo, @IdTipoEquipo, @IdPiso, @IdSite, @IdTipoIP)
        `);
        return { ok: true, mensaje: 'Registro general de IP creado.' };
    } catch (error) {
        if (error.number === 2627 || error.number === 2601) {
            return { ok: false, tipo: 'ip-duplicada', mensaje: 'La IP ya está registrada en el control general.' };
        }
        throw error;
    }
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
    eliminar
};
