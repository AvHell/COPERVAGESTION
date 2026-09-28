const { getPool, sql } = require('./conexion');

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
   Verificar si una IP ya está en uso
   Retorna el equipo con el que choca, o null si está libre.
   Excluye el equipo que se está editando.
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

async function crear(datos) {
    const pool = await getPool();
    const {
        idCliente, idLugarCliente, idRolEquipo, tipoIP, hostname,
        numeroHost, ip, idRangoIP,
        mascara, puertaEnlace, dns1, dns2, usuarioAdmin, passwordAdmin
    } = datos;

    // Validar duplicado de IP solo si es estática
    if (tipoIP === 'Estatica' && ip) {
        const choque = await verificarIPDuplicada(ip);
        if (choque) {
            return {
                ok: false,
                mensaje: `La IP ${ip} ya está asignada al equipo ${choque.Hostname} ` +
                         `(${choque.ClienteCodigo} - ${choque.LugarNombre}).`,
                tipo: 'ip-duplicada',
                choque
            };
        }
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
    return { ok: true, mensaje: 'Equipo creado' };
}

async function actualizar(id, datos) {
    const pool = await getPool();
    const {
        idCliente, idLugarCliente, idRolEquipo, tipoIP, hostname,
        numeroHost, ip, idRangoIP,
        mascara, puertaEnlace, dns1, dns2, usuarioAdmin, passwordAdmin, activo
    } = datos;

    // Validar duplicado excluyendo el propio equipo
    if (tipoIP === 'Estatica' && ip) {
        const choque = await verificarIPDuplicada(ip, id);
        if (choque) {
            return {
                ok: false,
                mensaje: `La IP ${ip} ya está asignada al equipo ${choque.Hostname} ` +
                         `(${choque.ClienteCodigo} - ${choque.LugarNombre}).`,
                tipo: 'ip-duplicada',
                choque
            };
        }
    }

    await pool.request()
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
    return { ok: true, mensaje: 'Equipo actualizado' };
}

async function eliminar(id) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, id)
            .query('DELETE FROM PlanoUbicaciones WHERE IdEquipo = @IdEquipo');
        await new sql.Request(tx)
            .input('IdEquipo', sql.Int, id)
            .query('DELETE FROM Equipos WHERE IdEquipo = @IdEquipo');
        await tx.commit();
        return { ok: true, mensaje: 'Equipo eliminado' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

module.exports = { listar, crear, actualizar, eliminar, verificarIPDuplicada };