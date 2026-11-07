const { getPool, sql } = require('./conexion');

/* =========================================================
   RANGOS IP POR CLIENTE Y PERFIL
   ---------------------------------------------------------
   Regla de negocio:
   - Todo equipo estático de un cliente debe caer dentro de un
     rango IP autorizado para el perfil (rol) de ese equipo.
   - Un rango puede no tener perfil (IdRolEquipo NULL): en ese
     caso aplica a cualquier perfil del cliente (norma general).
   - Si el cliente no tiene rangos configurados, no se aplica
     restricción (permite migrar la información poco a poco).
   ========================================================= */

/* Script de base de datos que crea el esquema de rangos.
   El esquema NO se crea desde el código: vive en /scripts. */
const SCRIPT_BD = 'scripts/rangos-ip-perfiles.sql';

let esquemaVerificado = null;

/**
 * Verifica una sola vez que el esquema de rangos exista en la base de
 * datos y, si falta, devuelve un mensaje que indica qué script ejecutar.
 */
async function verificarEsquema() {
    if (!esquemaVerificado) {
        esquemaVerificado = (async () => {
            const pool = await getPool();
            const resultado = await pool.request().query(`
                SELECT
                    CASE WHEN OBJECT_ID(N'dbo.RangosIP', N'U') IS NULL THEN 0 ELSE 1 END AS Tabla,
                    CASE WHEN COL_LENGTH(N'dbo.RangosIP', N'IdRolEquipo') IS NULL THEN 0 ELSE 1 END AS ColumnaPerfil,
                    CASE WHEN COL_LENGTH(N'dbo.Equipos', N'IdRangoIP') IS NULL THEN 0 ELSE 1 END AS ColumnaEquipo
            `);
            const fila = (resultado.recordset && resultado.recordset[0]) || {};
            const faltantes = [];
            if (!fila.Tabla) faltantes.push('la tabla dbo.RangosIP');
            else if (!fila.ColumnaPerfil) faltantes.push('la columna dbo.RangosIP.IdRolEquipo');
            if (!fila.ColumnaEquipo) faltantes.push('la columna dbo.Equipos.IdRangoIP');
            if (faltantes.length) {
                throw new Error(`Falta ${faltantes.join(' y ')}. Ejecuta el script ${SCRIPT_BD} en la base de datos.`);
            }
        })().catch((err) => {
            esquemaVerificado = null;
            throw err;
        });
    }
    return esquemaVerificado;
}

/* ---------- Utilidades de IP ---------- */

function validarIPv4(ip) {
    if (typeof ip !== 'string') return false;
    const partes = ip.trim().split('.');
    if (partes.length !== 4) return false;
    return partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function normalizarIPv4(ip) {
    if (!validarIPv4(ip)) return null;
    return ip.trim().split('.').map((p) => String(Number(p))).join('.');
}

function ipAEntero(ip) {
    const normal = normalizarIPv4(ip);
    if (!normal) return null;
    const [a, b, c, d] = normal.split('.').map(Number);
    return ((a * 256 + b) * 256 + c) * 256 + d;
}

function segmentoDe(ip) {
    const normal = normalizarIPv4(ip);
    return normal ? normal.split('.').slice(0, 3).join('.') : null;
}

function validarSegmento(segmento) {
    if (typeof segmento !== 'string') return false;
    const partes = segmento.trim().replace(/\.$/, '').split('.');
    if (partes.length !== 3) return false;
    return partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function normalizarSegmento(segmento) {
    return segmento.trim().replace(/\.$/, '').split('.').map((p) => String(Number(p))).join('.');
}

/**
 * Acepta "192.168.2.60" o la forma corta "60" (se completa con el segmento).
 * Devuelve la IP normalizada o null si no es válida.
 */
function expandirIP(valor, segmento) {
    const texto = String(valor ?? '').trim();
    if (!texto) return null;
    if (/^\d{1,3}$/.test(texto)) {
        const host = Number(texto);
        if (host > 255 || !validarSegmento(segmento || '')) return null;
        return `${normalizarSegmento(segmento)}.${host}`;
    }
    return normalizarIPv4(texto);
}

/* ---------- Lectura ---------- */

async function listar(idCliente = null) {
    await verificarEsquema();
    const pool = await getPool();
    const peticion = pool.request();
    const clienteNum = Number(idCliente);
    const filtroCliente = Number.isInteger(clienteNum) && clienteNum > 0;
    if (filtroCliente) peticion.input('IdCliente', sql.Int, clienteNum);

    const resultado = await peticion.query(`
        SELECT R.IdRangoIP,
               R.IdCliente,
               R.IdPiso,
               R.IdRolEquipo,
               R.Nombre,
               R.IPInicio,
               R.IPFin,
               R.Descripcion,
               C.Codigo  AS ClienteCodigo,
               C.Nombre  AS ClienteNombre,
               P.Nombre  AS PisoNombre,
               RO.Codigo AS RolCodigo,
               RO.Nombre AS RolNombre
        FROM dbo.RangosIP R
        INNER JOIN dbo.Clientes C ON C.IdCliente = R.IdCliente
        LEFT JOIN dbo.Pisos P ON P.IdPiso = R.IdPiso
        LEFT JOIN dbo.RolesEquipo RO ON RO.IdRolEquipo = R.IdRolEquipo
        ${filtroCliente ? 'WHERE R.IdCliente = @IdCliente' : ''}
    `);

    const rangos = resultado.recordset || [];
    for (const r of rangos) {
        r.IPInicio = normalizarIPv4(r.IPInicio) || String(r.IPInicio || '').trim();
        r.IPFin = normalizarIPv4(r.IPFin) || String(r.IPFin || '').trim();
    }
    // Orden natural por cliente, perfil e IP inicial (no alfabético)
    rangos.sort((a, b) => {
        const clienteA = String(a.ClienteCodigo || '');
        const clienteB = String(b.ClienteCodigo || '');
        if (clienteA !== clienteB) return clienteA.localeCompare(clienteB);
        const iniA = ipAEntero(a.IPInicio);
        const iniB = ipAEntero(b.IPInicio);
        if (iniA !== iniB) return (iniA ?? 0) - (iniB ?? 0);
        return String(a.Nombre || '').localeCompare(String(b.Nombre || ''));
    });
    return rangos;
}

function rangosSeSolapan(rangoA, ipInicio, ipFin) {
    const aIni = ipAEntero(rangoA.IPInicio);
    const aFin = ipAEntero(rangoA.IPFin);
    const bIni = ipAEntero(ipInicio);
    const bFin = ipAEntero(ipFin);
    if (aIni === null || aFin === null || bIni === null || bFin === null) return false;
    return aIni <= bFin && bIni <= aFin;
}

/* ---------- Escritura ---------- */

async function crear(datos) {
    return guardarRango(null, datos);
}

async function actualizar(idRango, datos) {
    return guardarRango(Number(idRango), datos);
}

async function guardarRango(idRango, datos) {
    await verificarEsquema();
    const pool = await getPool();

    const idCliente = Number(datos?.idCliente);
    if (!Number.isInteger(idCliente) || idCliente <= 0) {
        return { ok: false, mensaje: 'Selecciona el cliente al que pertenece el rango.' };
    }

    const clienteRes = await pool.request()
        .input('IdCliente', sql.Int, idCliente)
        .query('SELECT IdCliente, Codigo, Nombre FROM dbo.Clientes WHERE IdCliente = @IdCliente');
    const cliente = clienteRes.recordset?.[0];
    if (!cliente) return { ok: false, mensaje: 'El cliente seleccionado no existe.' };

    let idRolEquipo = null;
    let rol = null;
    if (datos?.idRolEquipo !== null && datos?.idRolEquipo !== undefined && datos?.idRolEquipo !== '') {
        idRolEquipo = Number(datos.idRolEquipo);
        if (!Number.isInteger(idRolEquipo) || idRolEquipo <= 0) {
            return { ok: false, mensaje: 'El perfil seleccionado no es válido.' };
        }
        const rolRes = await pool.request()
            .input('IdRolEquipo', sql.Int, idRolEquipo)
            .query('SELECT IdRolEquipo, Codigo, Nombre FROM dbo.RolesEquipo WHERE IdRolEquipo = @IdRolEquipo');
        rol = rolRes.recordset?.[0];
        if (!rol) return { ok: false, mensaje: 'El perfil seleccionado no existe.' };
    }

    let idPiso = null;
    if (datos?.idPiso !== null && datos?.idPiso !== undefined && datos?.idPiso !== '') {
        idPiso = Number(datos.idPiso);
        if (!Number.isInteger(idPiso) || idPiso <= 0) idPiso = null;
    }

    const segmentoCrudo = String(datos?.segmento ?? '').trim();
    let segmento = null;
    if (segmentoCrudo) {
        if (!validarSegmento(segmentoCrudo)) {
            return { ok: false, mensaje: 'El segmento debe tener el formato 192.168.2 (tres octetos).' };
        }
        segmento = normalizarSegmento(segmentoCrudo);
    }

    const ipInicio = expandirIP(datos?.ipInicio, segmento);
    const ipFin = expandirIP(datos?.ipFin, segmento) || ipInicio;
    if (!ipInicio || !ipFin) {
        return {
            ok: false,
            mensaje: 'Captura una IP inicial y final válidas. Puedes escribir la IP completa (192.168.2.60) o solo el último octeto (60) indicando el segmento.'
        };
    }
    if (segmentoDe(ipInicio) !== segmentoDe(ipFin)) {
        return { ok: false, mensaje: 'La IP inicial y la IP final deben estar en el mismo segmento de red.' };
    }
    if (ipAEntero(ipInicio) > ipAEntero(ipFin)) {
        return { ok: false, mensaje: 'La IP inicial no puede ser mayor que la IP final.' };
    }

    // Validación de empalmes dentro del mismo cliente
    const existentes = await listar(idCliente);
    const choque = existentes.find((r) => {
        if (idRango && Number(r.IdRangoIP) === idRango) return false;
        return rangosSeSolapan(r, ipInicio, ipFin);
    });
    if (choque) {
        const perfilChoque = choque.RolNombre || 'general';
        return {
            ok: false,
            tipo: 'rango-solapado',
            mensaje: `El rango ${ipInicio} – ${ipFin} se empalma con el rango ${choque.IPInicio} – ${choque.IPFin} (${perfilChoque}) del cliente ${cliente.Codigo}.`,
            detalle: choque
        };
    }

    const nombre = String(datos?.nombre || '').trim().slice(0, 100)
        || (rol ? `Rango ${rol.Nombre}` : 'Rango general');
    const descripcion = String(datos?.descripcion || '').trim().slice(0, 200) || null;

    if (idRango) {
        const resultado = await pool.request()
            .input('IdRangoIP', sql.Int, idRango)
            .input('IdCliente', sql.Int, idCliente)
            .input('IdPiso', sql.Int, idPiso)
            .input('IdRolEquipo', sql.Int, idRolEquipo)
            .input('Nombre', sql.NVarChar(100), nombre)
            .input('IPInicio', sql.VarChar(45), ipInicio)
            .input('IPFin', sql.VarChar(45), ipFin)
            .input('Descripcion', sql.NVarChar(200), descripcion)
            .query(`
                UPDATE dbo.RangosIP
                   SET IdCliente = @IdCliente,
                       IdPiso = @IdPiso,
                       IdRolEquipo = @IdRolEquipo,
                       Nombre = @Nombre,
                       IPInicio = @IPInicio,
                       IPFin = @IPFin,
                       Descripcion = @Descripcion
                 WHERE IdRangoIP = @IdRangoIP
            `);
        if (!resultado.rowsAffected?.[0]) {
            return { ok: false, mensaje: 'El rango ya no existe. Actualiza la lista e inténtalo de nuevo.' };
        }
        return { ok: true, mensaje: 'Rango actualizado.', idRango };
    }

    const insertado = await pool.request()
        .input('IdCliente', sql.Int, idCliente)
        .input('IdPiso', sql.Int, idPiso)
        .input('IdRolEquipo', sql.Int, idRolEquipo)
        .input('Nombre', sql.NVarChar(100), nombre)
        .input('IPInicio', sql.VarChar(45), ipInicio)
        .input('IPFin', sql.VarChar(45), ipFin)
        .input('Descripcion', sql.NVarChar(200), descripcion)
        .query(`
            INSERT INTO dbo.RangosIP (IdCliente, IdPiso, IdRolEquipo, Nombre, IPInicio, IPFin, Descripcion)
            OUTPUT INSERTED.IdRangoIP
            VALUES (@IdCliente, @IdPiso, @IdRolEquipo, @Nombre, @IPInicio, @IPFin, @Descripcion)
        `);

    return {
        ok: true,
        mensaje: 'Rango agregado.',
        idRango: insertado.recordset?.[0]?.IdRangoIP || null
    };
}

async function eliminar(idRango) {
    await verificarEsquema();
    const id = Number(idRango);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Rango no válido.' };

    const pool = await getPool();
    const transaccion = new sql.Transaction(pool);
    await transaccion.begin();
    try {
        const liberar = await new sql.Request(transaccion)
            .input('IdRangoIP', sql.Int, id)
            .query(`
                UPDATE dbo.Equipos SET IdRangoIP = NULL WHERE IdRangoIP = @IdRangoIP;
                SELECT @@ROWCOUNT AS Liberados;
            `);
        const liberados = liberar.recordset?.[0]?.Liberados || 0;

        const borrado = await new sql.Request(transaccion)
            .input('IdRangoIP', sql.Int, id)
            .query('DELETE FROM dbo.RangosIP WHERE IdRangoIP = @IdRangoIP');
        if (!borrado.rowsAffected?.[0]) {
            await transaccion.rollback();
            return { ok: false, mensaje: 'El rango ya no existe.' };
        }
        await transaccion.commit();

        return {
            ok: true,
            mensaje: liberados > 0
                ? `Rango eliminado. ${liberados} equipo(s) quedaron sin rango asignado.`
                : 'Rango eliminado.'
        };
    } catch (error) {
        try { await transaccion.rollback(); } catch (_) { /* ignora */ }
        if (error?.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar el rango porque tiene información relacionada.' };
        }
        throw error;
    }
}

/* ---------- Validación / auditoría ---------- */

function evaluarRangos(rangosCliente, idRolEquipo, ip) {
    const ipNormal = normalizarIPv4(ip);
    if (!ipNormal) return { ok: true, aplica: false, rango: null };

    const lista = rangosCliente || [];
    if (!lista.length) return { ok: true, aplica: false, rango: null };

    const idRol = Number(idRolEquipo) || null;
    const aplicables = lista.filter((r) => !r.IdRolEquipo || Number(r.IdRolEquipo) === idRol);
    const valor = ipAEntero(ipNormal);

    const encontrado = aplicables.find((r) => {
        const ini = ipAEntero(r.IPInicio);
        const fin = ipAEntero(r.IPFin);
        if (ini === null || fin === null) return false;
        return valor >= ini && valor <= fin;
    });

    if (encontrado) {
        return { ok: true, aplica: true, rango: encontrado, ip: ipNormal, aplicables };
    }
    return {
        ok: false,
        aplica: true,
        motivo: aplicables.length ? 'fuera-de-rango' : 'perfil-sin-rango',
        ip: ipNormal,
        aplicables
    };
}

async function validarIPEnRango(idCliente, idRolEquipo, ip) {
    const idClienteNum = Number(idCliente);
    const ipNormal = normalizarIPv4(ip);
    if (!Number.isInteger(idClienteNum) || idClienteNum <= 0 || !ipNormal) {
        return { ok: true, aplica: false, rango: null };
    }

    const rangosCliente = await listar(idClienteNum);
    const evaluacion = evaluarRangos(rangosCliente, idRolEquipo, ipNormal);
    if (evaluacion.ok || !evaluacion.aplica) return evaluacion;

    const cliente = rangosCliente[0] || {};
    let perfil = null;
    const idRol = Number(idRolEquipo) || null;
    if (idRol) {
        const pool = await getPool();
        const rolRes = await pool.request()
            .input('IdRolEquipo', sql.Int, idRol)
            .query('SELECT IdRolEquipo, Codigo, Nombre FROM dbo.RolesEquipo WHERE IdRolEquipo = @IdRolEquipo');
        perfil = rolRes.recordset?.[0] || null;
    }

    const nombrePerfil = perfil?.Nombre || 'Sin perfil';
    const nombreCliente = cliente.ClienteCodigo || 'del cliente';
    const disponibles = (evaluacion.aplicables || [])
        .map((r) => `${r.IPInicio} – ${r.IPFin}`)
        .join(', ');

    evaluacion.cliente = { codigo: cliente.ClienteCodigo || '', nombre: cliente.ClienteNombre || '' };
    evaluacion.perfil = perfil;
    evaluacion.rangos = rangosCliente;
    evaluacion.mensaje = evaluacion.motivo === 'perfil-sin-rango'
        ? `El perfil "${nombrePerfil}" no tiene rango IP definido para ${nombreCliente}. Configura el rango antes de asignar la IP ${ipNormal}.`
        : `La IP ${ipNormal} está fuera del rango autorizado para "${nombrePerfil}" en ${nombreCliente}. Rangos permitidos: ${disponibles}.`;

    return evaluacion;
}

/**
 * Indica si una IP cae dentro de un rango declarado por CUALQUIER cliente.
 *
 * La usa el control general de IP: un dispositivo que no pertenece a ningún
 * cliente tampoco puede tomar una dirección que un cliente ya reservó, porque
 * esa IP chocaría en cuanto se diera de alta el equipo del cliente.
 *
 * Si el esquema de rangos todavía no existe, no bloquea: devuelve
 * reservada:false para que el control general siga operando.
 */
async function rangoReservadoParaIP(ip) {
    const ipNormal = normalizarIPv4(ip);
    if (!ipNormal) return { reservada: false, ip: null, rango: null, mensaje: '' };

    let lista = [];
    try {
        lista = await listar();
    } catch (_) {
        return { reservada: false, ip: ipNormal, rango: null, esquemaPendiente: true, mensaje: '' };
    }

    const valor = ipAEntero(ipNormal);
    const rango = (lista || []).find((r) => {
        const inicio = ipAEntero(r.IPInicio);
        const fin = ipAEntero(r.IPFin);
        if (inicio === null || fin === null) return false;
        return valor >= inicio && valor <= fin;
    });

    if (!rango) return { reservada: false, ip: ipNormal, rango: null, mensaje: '' };

    const perfil = rango.RolNombre ? `perfil ${rango.RolNombre}` : 'cualquier perfil';
    return {
        reservada: true,
        ip: ipNormal,
        rango,
        mensaje: `La IP ${ipNormal} está reservada para el cliente ${rango.ClienteCodigo} (${perfil}, rango ${rango.IPInicio} – ${rango.IPFin}). Registra el dispositivo general fuera de los rangos declarados por los clientes.`
    };
}

async function auditar(idCliente = null) {
    await verificarEsquema();
    const pool = await getPool();
    const clienteNum = Number(idCliente);
    const filtroCliente = Number.isInteger(clienteNum) && clienteNum > 0;

    const rangos = await listar(filtroCliente ? clienteNum : null);
    const porCliente = new Map();
    for (const r of rangos) {
        const clave = Number(r.IdCliente);
        if (!porCliente.has(clave)) porCliente.set(clave, []);
        porCliente.get(clave).push(r);
    }

    const peticion = pool.request();
    if (filtroCliente) peticion.input('IdCliente', sql.Int, clienteNum);
    const resultado = await peticion.query(`
        SELECT E.IdEquipo,
               E.Hostname,
               E.IP,
               E.IdCliente,
               E.IdRolEquipo,
               C.Codigo  AS ClienteCodigo,
               C.Nombre  AS ClienteNombre,
               RO.Codigo AS RolCodigo,
               RO.Nombre AS RolNombre
        FROM dbo.Equipos E
        INNER JOIN dbo.Clientes C ON C.IdCliente = E.IdCliente
        LEFT JOIN dbo.RolesEquipo RO ON RO.IdRolEquipo = E.IdRolEquipo
        WHERE E.TipoIP = 'Estatica'
          AND E.Activo = 1
          AND NULLIF(LTRIM(RTRIM(E.IP)), '') IS NOT NULL
          ${filtroCliente ? 'AND E.IdCliente = @IdCliente' : ''}
    `);

    const equipos = resultado.recordset || [];
    const violaciones = [];
    const sinNorma = [];

    for (const equipo of equipos) {
        const rangosCliente = porCliente.get(Number(equipo.IdCliente)) || [];
        if (!rangosCliente.length) {
            sinNorma.push({
                IdEquipo: equipo.IdEquipo,
                Hostname: equipo.Hostname,
                IP: equipo.IP,
                ClienteCodigo: equipo.ClienteCodigo
            });
            continue;
        }
        const evaluacion = evaluarRangos(rangosCliente, equipo.IdRolEquipo, equipo.IP);
        if (evaluacion.ok) continue;
        violaciones.push({
            IdEquipo: equipo.IdEquipo,
            Hostname: equipo.Hostname,
            IP: evaluacion.ip || equipo.IP,
            ClienteCodigo: equipo.ClienteCodigo,
            ClienteNombre: equipo.ClienteNombre,
            RolCodigo: equipo.RolCodigo,
            RolNombre: equipo.RolNombre,
            motivo: evaluacion.motivo,
            esperado: (evaluacion.aplicables || []).map((r) => `${r.IPInicio} – ${r.IPFin}`),
            mensaje: evaluacion.motivo === 'perfil-sin-rango'
                ? `El perfil "${equipo.RolNombre || 'Sin perfil'}" no tiene rango definido.`
                : `Fuera de rango (permitido: ${(evaluacion.aplicables || []).map((r) => `${r.IPInicio} – ${r.IPFin}`).join(', ') || 'sin rangos'}).`
        });
    }

    return {
        ok: true,
        totalEquipos: equipos.length,
        totalRangos: rangos.length,
        violaciones,
        sinNorma
    };
}

module.exports = {
    verificarEsquema,
    listar,
    crear,
    actualizar,
    eliminar,
    validarIPEnRango,
    rangoReservadoParaIP,
    auditar
};
