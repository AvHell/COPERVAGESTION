const { getPool, sql } = require('./conexion');

async function listarPisos() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT IdPiso, Nombre, Filas, Columnas
        FROM Pisos
        WHERE Activo = 1
        ORDER BY Nombre
    `);
    return result.recordset;
}

async function listarUsuariosActivos() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT IdUsuario, Nombres, Apellidos, NombreUsuario
        FROM Usuarios
        WHERE Activo = 1
        ORDER BY Nombres, Apellidos, NombreUsuario
    `);
    return result.recordset;
}

async function obtenerPlano(idPiso) {
    const pool = await getPool();
    const pisoResult = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT IdPiso, Nombre, Filas, Columnas
            FROM Pisos
            WHERE IdPiso = @IdPiso AND Activo = 1
        `);
    const piso = pisoResult.recordset[0];
    if (!piso) return null;

    const equiposResult = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT
                E.IdEquipo, E.Hostname, E.TipoIP, E.IP,
                P.Fila, P.Columna,
                C.Codigo AS ClienteCodigo, C.Nombre AS Cliente,
                R.Codigo AS RolCodigo, R.Nombre AS Rol,
                Ultimo.FechaMantenimiento AS UltimoMantenimiento,
                Ultimo.RealizadoPor AS UltimoRealizadoPor,
                Ultimo.SeRealizoClonacion AS UltimoFueClonacion
            FROM PlanoUbicaciones P
            INNER JOIN Equipos E ON E.IdEquipo = P.IdEquipo
            INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
            INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
            OUTER APPLY (
                SELECT TOP 1 M.FechaMantenimiento, M.RealizadoPor, M.SeRealizoClonacion
                FROM Mantenimientos M
                WHERE M.IdEquipo = E.IdEquipo
                ORDER BY M.FechaMantenimiento DESC, M.FechaRegistro DESC
            ) Ultimo
            WHERE P.IdPiso = @IdPiso
              AND E.Activo = 1
        `);

    return { ...piso, equipos: equiposResult.recordset };
}

async function listarRegistros(idPiso) {
    const piso = Number(idPiso);
    if (!Number.isInteger(piso) || piso <= 0) {
        return { ok: false, mensaje: 'Selecciona un piso válido para consultar el historial.' };
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('IdPiso', sql.Int, piso);

    const result = await request.query(`
        SELECT
            m.IdMantenimiento, m.FechaMantenimiento, m.Observaciones, m.SeRealizoClonacion,
            m.Hostname, m.IP,
            COALESCE(NULLIF(C.Nombre, N''), NULLIF(m.ClienteNombre, N''), N'') AS Cliente,
            COALESCE(NULLIF(R.Nombre, N''), NULLIF(m.RolNombre, N''), N'') AS Rol,
            COALESCE(NULLIF(C.Codigo, N''), NULLIF(m.ClienteCodigo, N''), N'') AS ClienteCodigo,
            COALESCE(NULLIF(R.Codigo, N''), NULLIF(m.RolCodigo, N''), N'') AS RolCodigo,
            m.PisoNombre,
            m.RealizadoPor, m.FechaRegistro
        FROM Mantenimientos m
        LEFT JOIN Equipos E ON E.IdEquipo = m.IdEquipo
        LEFT JOIN Clientes C ON C.IdCliente = E.IdCliente
        LEFT JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
        WHERE m.IdPiso = @IdPiso
        ORDER BY m.FechaMantenimiento DESC, m.FechaRegistro DESC
    `);
    return result.recordset;
}

async function crear(datos) {
    const idEquipo = Number(datos?.idEquipo);
    const idPiso = Number(datos?.idPiso);
    const fila = Number(datos?.fila);
    const columna = Number(datos?.columna);
    const fecha = String(datos?.fechaMantenimiento || '').trim();
    const observaciones = String(datos?.observaciones || '').trim();
    const idUsuarios = [...new Set((Array.isArray(datos?.idUsuarios) ? datos.idUsuarios : [])
        .map(Number))];
    const observacionesNormalizadas = observaciones.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const seRealizoClonacion = /\bclon\w*/.test(observacionesNormalizadas);

    if (![idEquipo, idPiso, fila, columna].every(Number.isInteger) ||
        idEquipo <= 0 || idPiso <= 0 || fila <= 0 || columna <= 0 ||
        idUsuarios.length < 1 || idUsuarios.length > 2 ||
        idUsuarios.some(id => !Number.isInteger(id) || id <= 0)) {
        return { ok: false, mensaje: 'La ubicación, el equipo o el usuario seleccionado no son válidos.' };
    }
    const fechaCapturada = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
        ? new Date(`${fecha}T00:00:00Z`)
        : null;
    const fechaNormalizada = fechaCapturada && !Number.isNaN(fechaCapturada.getTime())
        ? fechaCapturada.toISOString().slice(0, 10)
        : '';
    if (!fechaNormalizada || fechaNormalizada !== fecha) {
        return { ok: false, mensaje: 'Captura una fecha de mantenimiento válida.' };
    }
    if (!observaciones) {
        return { ok: false, mensaje: 'Las observaciones del mantenimiento son obligatorias.' };
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const usuariosRequest = new sql.Request(tx)
            .input('Usuario1', sql.Int, idUsuarios[0])
            .input('Usuario2', sql.Int, idUsuarios[1] || null);
        const usuariosResult = await usuariosRequest.query(`
            SELECT IdUsuario, Nombres, Apellidos, NombreUsuario
            FROM Usuarios WITH (UPDLOCK, HOLDLOCK)
            WHERE Activo = 1
              AND IdUsuario IN (@Usuario1, @Usuario2)
        `);
        if (usuariosResult.recordset.length !== idUsuarios.length) {
            await tx.rollback();
            return { ok: false, mensaje: 'Uno o más usuarios seleccionados no existen o están inactivos. Actualiza la lista e inténtalo de nuevo.' };
        }

        const equipoResult = await new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipo)
            .input('IdPiso', sql.Int, idPiso)
            .input('Fila', sql.Int, fila)
            .input('Columna', sql.Int, columna)
            .query(`
                SELECT E.IdEquipo, E.Hostname, E.IP, P.Nombre AS PisoNombre,
                       C.Codigo AS ClienteCodigo, C.Nombre AS Cliente,
                       R.Codigo AS RolCodigo, R.Nombre AS Rol,
                       L.Fila, L.Columna
                FROM Equipos E WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN PlanoUbicaciones L ON L.IdEquipo = E.IdEquipo
                INNER JOIN Pisos P ON P.IdPiso = L.IdPiso
                INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
                INNER JOIN RolesEquipo R ON R.IdRolEquipo = E.IdRolEquipo
                WHERE E.IdEquipo = @IdEquipo
                  AND L.IdPiso = @IdPiso
                  AND L.Fila = @Fila
                  AND L.Columna = @Columna
                  AND E.Activo = 1
            `);

        if (equipoResult.recordset.length === 0) {
            await tx.rollback();
            return { ok: false, mensaje: 'El equipo ya no ocupa esa posición o está inactivo. Actualiza el mapa e inténtalo de nuevo.' };
        }

        const equipo = equipoResult.recordset[0];
        const usuariosPorId = new Map(usuariosResult.recordset.map(usuario => [usuario.IdUsuario, usuario]));
        const responsables = idUsuarios.map(id => {
            const usuario = usuariosPorId.get(id);
            const nombre = `${usuario.Nombres || ''} ${usuario.Apellidos || ''}`.trim();
            return nombre || usuario.NombreUsuario;
        });
        const realizadoPor = responsables.join(' y ');
        const insertRequest = new sql.Request(tx)
            .input('IdEquipo', sql.Int, idEquipo)
            .input('IdPiso', sql.Int, idPiso)
            .input('IdUsuario', sql.Int, idUsuarios[0])
            .input('FechaMantenimiento', sql.VarChar(10), fecha)
            .input('Observaciones', sql.NVarChar(1000), observaciones)
            .input('SeRealizoClonacion', sql.Bit, seRealizoClonacion)
            .input('Hostname', sql.NVarChar(50), equipo.Hostname)
            .input('IP', sql.VarChar(45), equipo.IP || null)
            .input('ClienteCodigo', sql.NVarChar(30), equipo.ClienteCodigo)
            .input('ClienteNombre', sql.NVarChar(100), equipo.Cliente)
            .input('RolCodigo', sql.NVarChar(30), equipo.RolCodigo)
            .input('RolNombre', sql.NVarChar(100), equipo.Rol)
            .input('PisoNombre', sql.NVarChar(100), equipo.PisoNombre)
            .input('Fila', sql.Int, equipo.Fila)
            .input('Columna', sql.Int, equipo.Columna)
            .input('RealizadoPor', sql.NVarChar(500), realizadoPor);
        const insertResult = await insertRequest.query(`
                INSERT INTO Mantenimientos (
                    IdEquipo, IdPiso, IdUsuario, FechaMantenimiento, Observaciones,
                    SeRealizoClonacion,
                    Hostname, IP, ClienteCodigo, ClienteNombre, RolCodigo, RolNombre,
                    PisoNombre, Fila, Columna, RealizadoPor
                )
                OUTPUT INSERTED.IdMantenimiento
                VALUES (
                    @IdEquipo, @IdPiso, @IdUsuario, CONVERT(date, @FechaMantenimiento, 23), @Observaciones,
                    @SeRealizoClonacion,
                    @Hostname, @IP, @ClienteCodigo, @ClienteNombre, @RolCodigo, @RolNombre,
                    @PisoNombre, @Fila, @Columna, @RealizadoPor
                )
            `);
        const idMantenimiento = insertResult.recordset[0].IdMantenimiento;

        for (const idParticipante of idUsuarios) {
            await new sql.Request(tx)
                .input('IdMantenimiento', sql.Int, idMantenimiento)
                .input('IdUsuario', sql.Int, idParticipante)
                .query(`
                    INSERT INTO MantenimientosUsuarios (IdMantenimiento, IdUsuario)
                    VALUES (@IdMantenimiento, @IdUsuario)
                `);
        }

        await tx.commit();
        return {
            ok: true,
            mensaje: `Mantenimiento de ${equipo.Hostname} registrado.`,
            id: idMantenimiento
        };
    } catch (err) {
        try {
            await tx.rollback();
        } catch (rollbackError) {
            console.error('[Mantenimientos] Error al revertir el registro:', rollbackError);
        }
        throw err;
    }
}

module.exports = { listarPisos, listarUsuariosActivos, obtenerPlano, listarRegistros, crear };
