const { getPool, sql } = require('./conexion');
const rangosDB = require('./rangos');

/* =========================================================
   LISTAR
   ========================================================= */

async function listar() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT E.IdEquipo, E.IdCliente, E.IdPiso, E.IdRolEquipo, E.IdRangoIP,
               C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
               P.Nombre AS PisoNombre,
               R.Codigo AS RolCodigo, R.Nombre AS RolNombre,
               E.TipoIP, E.Hostname, E.NumeroHost, E.IP,
               E.Mascara, E.PuertaEnlace, E.DNS1, E.DNS2,
               E.UsuarioAdmin, E.PasswordAdmin, E.Activo
        FROM Equipos E
        INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
        LEFT JOIN  Pisos P    ON P.IdPiso = E.IdPiso
        INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
        ORDER BY C.Codigo, P.Nombre, E.Hostname
    `);
    return result.recordset;
}

/* =========================================================
   VERIFICAR IP DUPLICADA
   ========================================================= */
async function verificarIPDuplicada(ip, idEquipoExcluir = null) {
    if (!ip) return null;
    const partes = String(ip).trim().split('.');
    if (partes.length !== 4 || partes.some(octeto =>
        !/^\d{1,3}$/.test(octeto) || Number(octeto) < 0 || Number(octeto) > 255
    )) {
        return null;
    }
    const octetos = partes.map(Number);
    const pool = await getPool();
    const req = pool.request()
        .input('IP1', sql.Int, octetos[0])
        .input('IP2', sql.Int, octetos[1])
        .input('IP3', sql.Int, octetos[2])
        .input('IP4', sql.Int, octetos[3]);

    let query = `
        SELECT TOP 1 Conflicto.IdEquipo, Conflicto.Hostname,
               Conflicto.ClienteCodigo, Conflicto.PisoNombre
        FROM (
            SELECT E.IdEquipo, E.Hostname, C.Codigo AS ClienteCodigo, P.Nombre AS PisoNombre
            FROM Equipos E
            INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
            LEFT JOIN Pisos P ON P.IdPiso = E.IdPiso
            WHERE E.Activo = 1
              AND E.TipoIP = 'Estatica'
              AND TRY_CONVERT(int, PARSENAME(E.IP, 4)) = @IP1
              AND TRY_CONVERT(int, PARSENAME(E.IP, 3)) = @IP2
              AND TRY_CONVERT(int, PARSENAME(E.IP, 2)) = @IP3
              AND TRY_CONVERT(int, PARSENAME(E.IP, 1)) = @IP4
            UNION ALL
            SELECT NULL AS IdEquipo, COALESCE(I.Hostname, N'Dispositivo general') AS Hostname,
                   N'Control general' AS ClienteCodigo, Site.Nombre AS PisoNombre
            FROM dbo.InventarioGeneralIP I
            LEFT JOIN dbo.CatalogosInventarioIP Site ON Site.IdCatalogoIP = I.IdSite
            WHERE TRY_CONVERT(int, PARSENAME(I.IP, 4)) = @IP1
              AND TRY_CONVERT(int, PARSENAME(I.IP, 3)) = @IP2
              AND TRY_CONVERT(int, PARSENAME(I.IP, 2)) = @IP3
              AND TRY_CONVERT(int, PARSENAME(I.IP, 1)) = @IP4
        ) Conflicto
    `;
    if (idEquipoExcluir) {
        query += ' WHERE Conflicto.IdEquipo IS NULL OR Conflicto.IdEquipo <> @IdExcluir';
        req.input('IdExcluir', sql.Int, idEquipoExcluir);
    }

    const r = await req.query(query);
    return r.recordset[0] || null;
}

/* =========================================================
   LISTAR IP ASIGNADAS EN UN SEGMENTO /24
   ========================================================= */
async function listarIPsAsignadasEnSegmento(segmento, idEquipoExcluir = null) {
    const octetos = String(segmento ?? '').split('.');
    const segmentoValido = octetos.length === 3 && octetos.every(octeto =>
        /^\d{1,3}$/.test(octeto) && Number(octeto) >= 0 && Number(octeto) <= 255
    );
    if (!segmentoValido) {
        throw new Error('El segmento debe tener el formato IPv4 de tres octetos.');
    }

    const pool = await getPool();
    const request = pool.request();
    const excluir = Number.isInteger(Number(idEquipoExcluir)) && Number(idEquipoExcluir) > 0;
    if (excluir) request.input('IdEquipoExcluir', sql.Int, Number(idEquipoExcluir));

    const resultado = await request.query(`
        SELECT DISTINCT LTRIM(RTRIM(IP)) AS IP
        FROM (
            SELECT E.IP, E.IdEquipo
            FROM dbo.Equipos E
            INNER JOIN dbo.Clientes C ON C.IdCliente = E.IdCliente
            WHERE E.Activo = 1
              AND E.TipoIP = 'Estatica'
              AND E.IP IS NOT NULL
            UNION ALL
            SELECT IP, NULL AS IdEquipo
            FROM dbo.InventarioGeneralIP
            WHERE IP IS NOT NULL
        ) Direcciones
        WHERE 1 = 1
        ${excluir ? 'AND (IdEquipo IS NULL OR IdEquipo <> @IdEquipoExcluir)' : ''}
    `);
    const prefijo = octetos.map(Number).join('.');
    return resultado.recordset.map(registro => String(registro.IP ?? '').trim())
        .filter(ip => {
            const partesIP = ip.split('.');
            return partesIP.length === 4 &&
                partesIP.every(octeto => /^\d{1,3}$/.test(octeto) && Number(octeto) <= 255) &&
                partesIP.slice(0, 3).map(Number).join('.') === prefijo;
        })
        .map(ip => ip.split('.').map(Number).join('.'));
}

/* =========================================================
   VERIFICAR HOSTNAME DUPLICADO
   ========================================================= */
async function verificarHostnameDuplicado(hostname, idEquipoExcluir = null) {
    if (!hostname) return null;
    const pool = await getPool();
    const req = pool.request().input('Hostname', sql.VarChar(50), hostname);

    let query = `
        SELECT E.IdEquipo, E.Hostname, C.Codigo AS ClienteCodigo, P.Nombre AS PisoNombre
        FROM Equipos E
        INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
        LEFT JOIN  Pisos P    ON P.IdPiso = E.IdPiso
        WHERE E.Hostname = @Hostname
    `;
    if (idEquipoExcluir) {
        query += ' AND E.IdEquipo <> @IdExcluir';
        req.input('IdExcluir', sql.Int, idEquipoExcluir);
    }

    const r = await req.query(query);
    return r.recordset[0] || null;
}

/* =========================================================
   VALIDAR ACCESO CLIENTE -> PISO
   (solo aplica si hay piso seleccionado)
   ========================================================= */
async function validarAccesoPiso(pool, idPiso, idCliente) {
    if (!idPiso) return true; // DHCP o sin piso => no valida
    const acceso = await pool.request()
        .input('IdPiso',    sql.Int, idPiso)
        .input('IdCliente', sql.Int, idCliente)
        .query('SELECT 1 FROM PisoClientes WHERE IdPiso = @IdPiso AND IdCliente = @IdCliente');
    return acceso.recordset.length > 0;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(datos) {
    try {
        const pool = await getPool();
        const {
            idCliente, idPiso, idRolEquipo, tipoIP, hostname,
            numeroHost, ip,
            mascara, puertaEnlace, dns1, dns2, usuarioAdmin, passwordAdmin
        } = datos;

        const esEstatica = tipoIP === 'Estatica';

        // Validar acceso cliente -> piso (solo si hay piso)
        const accesoOK = await validarAccesoPiso(pool, idPiso, idCliente);
        if (!accesoOK) {
            return { ok: false, mensaje: 'El cliente seleccionado no tiene acceso a ese piso.' };
        }

        // Solo validar IP duplicada en Estática
        if (esEstatica && ip) {
            const choque = await verificarIPDuplicada(ip);
            if (choque) {
                return {
                    ok: false,
                    mensaje: `La IP ${ip} ya está asignada al equipo ${choque.Hostname} (${choque.ClienteCodigo} - ${choque.PisoNombre}).`,
                    tipo: 'ip-duplicada',
                    choque
                };
            }
        }

        // Control por rango IP del cliente y perfil (heredado del catálogo de rangos)
        let rangoAsignado = null;
        if (esEstatica && ip) {
            const control = await rangosDB.validarIPEnRango(idCliente, idRolEquipo, ip);
            if (!control.ok) {
                return {
                    ok: false,
                    mensaje: control.mensaje,
                    tipo: 'ip-fuera-de-rango',
                    detalle: control
                };
            }
            rangoAsignado = control.rango ? control.rango.IdRangoIP : null;
        }

        // Hostname duplicado siempre
        const dupHost = await verificarHostnameDuplicado(hostname);
        if (dupHost) {
            return {
                ok: false,
                mensaje: `El hostname "${hostname}" ya está en uso por ${dupHost.ClienteCodigo} — ${dupHost.PisoNombre}.`,
                tipo: 'hostname-duplicado',
                choque: dupHost
            };
        }

        // Normalizar: en DHCP, red = null. Admin se guarda en ambos.
        const payload = {
            idCliente,
            idPiso:        idPiso || null,
            idRolEquipo,
            tipoIP,
            hostname,
            numeroHost:    esEstatica ? (numeroHost ?? null) : null,
            ip:            esEstatica ? (ip || null) : null,
            idRangoIP:     esEstatica ? (rangoAsignado || null) : null,
            mascara:       esEstatica ? (mascara || null) : null,
            puertaEnlace:  esEstatica ? (puertaEnlace || null) : null,
            dns1:          esEstatica ? (dns1 || null) : null,
            dns2:          esEstatica ? (dns2 || null) : null,
            usuarioAdmin:  usuarioAdmin || null,   // admin SIEMPRE se guarda
            passwordAdmin: passwordAdmin || null   // admin SIEMPRE se guarda
        };

        await pool.request()
            .input('IdCliente',     sql.Int, payload.idCliente)
            .input('IdPiso',        sql.Int, payload.idPiso)
            .input('IdRolEquipo',   sql.Int, payload.idRolEquipo)
            .input('TipoIP',        sql.VarChar(10), payload.tipoIP)
            .input('Hostname',      sql.VarChar(50), payload.hostname)
            .input('NumeroHost',    sql.Int, payload.numeroHost)
            .input('IP',            sql.VarChar(45), payload.ip)
            .input('IdRangoIP',     sql.Int, payload.idRangoIP)
            .input('Mascara',       sql.VarChar(45), payload.mascara)
            .input('PuertaEnlace',  sql.VarChar(45), payload.puertaEnlace)
            .input('DNS1',          sql.VarChar(45), payload.dns1)
            .input('DNS2',          sql.VarChar(45), payload.dns2)
            .input('UsuarioAdmin',  sql.NVarChar(100), payload.usuarioAdmin)
            .input('PasswordAdmin', sql.NVarChar(255), payload.passwordAdmin)
            .query(`INSERT INTO Equipos
                    (IdCliente, IdPiso, IdRolEquipo, TipoIP, Hostname, NumeroHost, IP, IdRangoIP,
                     Mascara, PuertaEnlace, DNS1, DNS2, UsuarioAdmin, PasswordAdmin)
                    VALUES
                    (@IdCliente, @IdPiso, @IdRolEquipo, @TipoIP, @Hostname, @NumeroHost, @IP, @IdRangoIP,
                     @Mascara, @PuertaEnlace, @DNS1, @DNS2, @UsuarioAdmin, @PasswordAdmin)`);

        return { ok: true, mensaje: 'Equipo creado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un equipo con esos datos únicos.' };
        }
        return { ok: false, mensaje: 'Error al crear equipo: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(id, datos) {
    try {
        const pool = await getPool();
        const {
            idCliente, idPiso, idRolEquipo, tipoIP, hostname,
            numeroHost, ip,
            mascara, puertaEnlace, dns1, dns2, usuarioAdmin, passwordAdmin, activo
        } = datos;

        const esEstatica = tipoIP === 'Estatica';

        const accesoOK = await validarAccesoPiso(pool, idPiso, idCliente);
        if (!accesoOK) {
            return { ok: false, mensaje: 'El cliente seleccionado no tiene acceso a ese piso.' };
        }

        if (esEstatica && ip) {
            const choque = await verificarIPDuplicada(ip, id);
            if (choque) {
                return {
                    ok: false,
                    mensaje: `La IP ${ip} ya está asignada al equipo ${choque.Hostname} (${choque.ClienteCodigo} - ${choque.PisoNombre}).`,
                    tipo: 'ip-duplicada',
                    choque
                };
            }
        }

        // Control por rango IP del cliente y perfil (heredado del catálogo de rangos)
        let rangoAsignado = null;
        if (esEstatica && ip) {
            const control = await rangosDB.validarIPEnRango(idCliente, idRolEquipo, ip);
            if (!control.ok) {
                return {
                    ok: false,
                    mensaje: control.mensaje,
                    tipo: 'ip-fuera-de-rango',
                    detalle: control
                };
            }
            rangoAsignado = control.rango ? control.rango.IdRangoIP : null;
        }

        const dupHost = await verificarHostnameDuplicado(hostname, id);
        if (dupHost) {
            return {
                ok: false,
                mensaje: `El hostname "${hostname}" ya está en uso por ${dupHost.ClienteCodigo} — ${dupHost.PisoNombre}.`,
                tipo: 'hostname-duplicado',
                choque: dupHost
            };
        }

        const payload = {
            idCliente,
            idPiso:        idPiso || null,
            idRolEquipo,
            tipoIP,
            hostname,
            numeroHost:    esEstatica ? (numeroHost ?? null) : null,
            ip:            esEstatica ? (ip || null) : null,
            idRangoIP:     esEstatica ? (rangoAsignado || null) : null,
            mascara:       esEstatica ? (mascara || null) : null,
            puertaEnlace:  esEstatica ? (puertaEnlace || null) : null,
            dns1:          esEstatica ? (dns1 || null) : null,
            dns2:          esEstatica ? (dns2 || null) : null,
            usuarioAdmin:  usuarioAdmin || null,
            passwordAdmin: passwordAdmin || null,
            activo:        activo ? 1 : 0
        };

        const result = await pool.request()
            .input('IdEquipo',      sql.Int, id)
            .input('IdCliente',     sql.Int, payload.idCliente)
            .input('IdPiso',        sql.Int, payload.idPiso)
            .input('IdRolEquipo',   sql.Int, payload.idRolEquipo)
            .input('TipoIP',        sql.VarChar(10), payload.tipoIP)
            .input('Hostname',      sql.VarChar(50), payload.hostname)
            .input('NumeroHost',    sql.Int, payload.numeroHost)
            .input('IP',            sql.VarChar(45), payload.ip)
            .input('IdRangoIP',     sql.Int, payload.idRangoIP)
            .input('Mascara',       sql.VarChar(45), payload.mascara)
            .input('PuertaEnlace',  sql.VarChar(45), payload.puertaEnlace)
            .input('DNS1',          sql.VarChar(45), payload.dns1)
            .input('DNS2',          sql.VarChar(45), payload.dns2)
            .input('UsuarioAdmin',  sql.NVarChar(100), payload.usuarioAdmin)
            .input('PasswordAdmin', sql.NVarChar(255), payload.passwordAdmin)
            .input('Activo',        sql.Bit, payload.activo)
            .query(`UPDATE Equipos SET IdCliente = @IdCliente, IdPiso = @IdPiso,
                    IdRolEquipo = @IdRolEquipo, TipoIP = @TipoIP, Hostname = @Hostname,
                    NumeroHost = @NumeroHost, IP = @IP, IdRangoIP = @IdRangoIP,
                    Mascara = @Mascara, PuertaEnlace = @PuertaEnlace, DNS1 = @DNS1, DNS2 = @DNS2,
                    UsuarioAdmin = @UsuarioAdmin, PasswordAdmin = @PasswordAdmin, Activo = @Activo
                    WHERE IdEquipo = @IdEquipo`);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El equipo ya no existe.' };
        }

        return { ok: true, mensaje: 'Equipo actualizado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un equipo con esos datos únicos.' };
        }
        return { ok: false, mensaje: 'Error al actualizar equipo: ' + err.message };
    }
}

/*ENDPOINT */

async function obtenerPorId(idEquipo) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdEquipo', sql.Int, idEquipo)
        .query(`
            SELECT E.IdEquipo, E.Hostname, E.TipoIP, E.IP, E.IdCliente, E.IdPiso, E.IdRolEquipo,
                   E.Mascara, E.PuertaEnlace, E.DNS1, E.DNS2,
                   E.UsuarioAdmin, E.PasswordAdmin,
                   C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
                   R.Codigo AS RolCodigo,
                   DA.Descripcion AS DescripcionAdmin
            FROM Equipos E
            INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
            INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
            LEFT JOIN DominiosAdmin DA
                   ON DA.IdCliente = E.IdCliente
                  AND DA.Usuario   = E.UsuarioAdmin
            WHERE E.IdEquipo = @IdEquipo
        `);
    return r.recordset[0] || null;
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(id) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, id)
            .query('DELETE FROM dbo.EscenarioPlanoFuturoUbicaciones WHERE IdEquipo = @IdEquipo');
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, id)
            .query('DELETE FROM dbo.EscenarioPlanoFuturoOriginal WHERE IdEquipo = @IdEquipo');
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, id)
            .query('DELETE FROM PlanoUbicaciones WHERE IdEquipo = @IdEquipo');

        const r = await new sql.Request(tx)
            .input('IdEquipo', sql.Int, id)
            .query('DELETE FROM Equipos WHERE IdEquipo = @IdEquipo');

        await tx.commit();

        if (r.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El equipo ya no existe.' };
        }

        return { ok: true, mensaje: 'Equipo eliminado correctamente.' };
    } catch (err) {
        await tx.rollback();
        if (err.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar: hay registros asociados.' };
        }
        return { ok: false, mensaje: 'Error al eliminar equipo: ' + err.message };
    }
}

module.exports = {
    listar, obtenerPorId, crear, actualizar, eliminar,
    verificarIPDuplicada, listarIPsAsignadasEnSegmento
};