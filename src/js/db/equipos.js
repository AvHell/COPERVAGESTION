const { getPool, sql } = require('./conexion');

/* =========================================================
   LISTAR
   ========================================================= */
async function listar() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT E.IdEquipo, E.IdCliente, E.IdLugarCliente, E.IdRolEquipo, E.IdRangoIP,
               C.Codigo AS ClienteCodigo, C.Nombre AS ClienteNombre,
               L.Nombre AS LugarNombre,
               R.Codigo AS RolCodigo, R.Nombre AS RolNombre,
               E.TipoIP, E.Hostname, E.NumeroHost, E.IP,
               E.Mascara, E.PuertaEnlace, E.DNS1, E.DNS2,
               E.UsuarioAdmin, E.PasswordAdmin, E.Activo
        FROM Equipos E
        INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
        INNER JOIN LugaresClientes L ON L.IdLugarCliente = E.IdLugarCliente
        INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
        ORDER BY C.Codigo, L.Nombre, E.Hostname
    `);
    return result.recordset;
}

/* =========================================================
   VERIFICAR IP DUPLICADA
   ========================================================= */
async function verificarIPDuplicada(ip, idEquipoExcluir = null) {
    if (!ip) return null;
    const pool = await getPool();
    const req = pool.request().input('IP', sql.VarChar(45), ip);

    let query = `
        SELECT E.IdEquipo, E.Hostname, C.Codigo AS ClienteCodigo, L.Nombre AS LugarNombre
        FROM Equipos E
        INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
        INNER JOIN LugaresClientes L ON L.IdLugarCliente = E.IdLugarCliente
        WHERE E.TipoIP = 'Estatica' AND E.IP = @IP
    `;
    if (idEquipoExcluir) {
        query += ' AND E.IdEquipo <> @IdExcluir';
        req.input('IdExcluir', sql.Int, idEquipoExcluir);
    }

    const r = await req.query(query);
    return r.recordset[0] || null;
}

/* =========================================================
   VALIDAR UNICIDAD DE HOSTNAME
   ========================================================= */
async function verificarHostnameDuplicado(hostname, idEquipoExcluir = null) {
    if (!hostname) return null;
    const pool = await getPool();
    const req = pool.request().input('Hostname', sql.VarChar(50), hostname);

    let query = `
        SELECT E.IdEquipo, E.Hostname, C.Codigo AS ClienteCodigo, L.Nombre AS LugarNombre
        FROM Equipos E
        INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
        INNER JOIN LugaresClientes L ON L.IdLugarCliente = E.IdLugarCliente
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
   CREAR
   ========================================================= */
async function crear(datos) {
    try {
        const pool = await getPool();
        const {
            idCliente, idLugarCliente, idRolEquipo, tipoIP, hostname,
            numeroHost, ip, idRangoIP,
            mascara, puertaEnlace, dns1, dns2, usuarioAdmin, passwordAdmin
        } = datos;

        // Validar IP duplicada si es estática
        if (tipoIP === 'Estatica' && ip) {
            const choque = await verificarIPDuplicada(ip);
            if (choque) {
                return {
                    ok: false,
                    mensaje: `La IP ${ip} ya está asignada al equipo ${choque.Hostname} (${choque.ClienteCodigo} - ${choque.LugarNombre}).`,
                    tipo: 'ip-duplicada',
                    choque
                };
            }
        }

        // Validar hostname duplicado
        const dupHost = await verificarHostnameDuplicado(hostname);
        if (dupHost) {
            return {
                ok: false,
                mensaje: `El hostname "${hostname}" ya está en uso por ${dupHost.ClienteCodigo} — ${dupHost.LugarNombre}.`,
                tipo: 'hostname-duplicado',
                choque: dupHost
            };
        }

        await pool.request()
            .input('IdCliente', sql.Int, idCliente)
            .input('IdLugarCliente', sql.Int, idLugarCliente)
            .input('IdRolEquipo', sql.Int, idRolEquipo)
            .input('TipoIP', sql.VarChar(10), tipoIP)
            .input('Hostname', sql.VarChar(50), hostname)
            .input('NumeroHost', sql.Int, numeroHost)
            .input('IP', sql.VarChar(45), ip)
            .input('IdRangoIP', sql.Int, idRangoIP)
            .input('Mascara', sql.VarChar(45), mascara)
            .input('PuertaEnlace', sql.VarChar(45), puertaEnlace)
            .input('DNS1', sql.VarChar(45), dns1)
            .input('DNS2', sql.VarChar(45), dns2)
            .input('UsuarioAdmin', sql.NVarChar(100), usuarioAdmin)
            .input('PasswordAdmin', sql.NVarChar(255), passwordAdmin)
            .query(`INSERT INTO Equipos
                    (IdCliente, IdLugarCliente, IdRolEquipo, TipoIP, Hostname, NumeroHost, IP, IdRangoIP,
                     Mascara, PuertaEnlace, DNS1, DNS2, UsuarioAdmin, PasswordAdmin)
                    VALUES
                    (@IdCliente, @IdLugarCliente, @IdRolEquipo, @TipoIP, @Hostname, @NumeroHost, @IP, @IdRangoIP,
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
            idCliente, idLugarCliente, idRolEquipo, tipoIP, hostname,
            numeroHost, ip, idRangoIP,
            mascara, puertaEnlace, dns1, dns2, usuarioAdmin, passwordAdmin, activo
        } = datos;

        if (tipoIP === 'Estatica' && ip) {
            const choque = await verificarIPDuplicada(ip, id);
            if (choque) {
                return {
                    ok: false,
                    mensaje: `La IP ${ip} ya está asignada al equipo ${choque.Hostname} (${choque.ClienteCodigo} - ${choque.LugarNombre}).`,
                    tipo: 'ip-duplicada',
                    choque
                };
            }
        }

        const dupHost = await verificarHostnameDuplicado(hostname, id);
        if (dupHost) {
            return {
                ok: false,
                mensaje: `El hostname "${hostname}" ya está en uso por ${dupHost.ClienteCodigo} — ${dupHost.LugarNombre}.`,
                tipo: 'hostname-duplicado',
                choque: dupHost
            };
        }

        const result = await pool.request()
            .input('IdEquipo', sql.Int, id)
            .input('IdCliente', sql.Int, idCliente)
            .input('IdLugarCliente', sql.Int, idLugarCliente)
            .input('IdRolEquipo', sql.Int, idRolEquipo)
            .input('TipoIP', sql.VarChar(10), tipoIP)
            .input('Hostname', sql.VarChar(50), hostname)
            .input('NumeroHost', sql.Int, numeroHost)
            .input('IP', sql.VarChar(45), ip)
            .input('IdRangoIP', sql.Int, idRangoIP)
            .input('Mascara', sql.VarChar(45), mascara)
            .input('PuertaEnlace', sql.VarChar(45), puertaEnlace)
            .input('DNS1', sql.VarChar(45), dns1)
            .input('DNS2', sql.VarChar(45), dns2)
            .input('UsuarioAdmin', sql.NVarChar(100), usuarioAdmin)
            .input('PasswordAdmin', sql.NVarChar(255), passwordAdmin)
            .input('Activo', sql.Bit, activo ? 1 : 0)
            .query(`UPDATE Equipos SET IdCliente = @IdCliente, IdLugarCliente = @IdLugarCliente,
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

/* =========================================================
   ELIMINAR (transacción: quita del plano + elimina equipo)
   ========================================================= */
async function eliminar(id) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
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

module.exports = { listar, crear, actualizar, eliminar, verificarIPDuplicada };