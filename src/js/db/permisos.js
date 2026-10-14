/* =========================================================
   PERMISOS — roles, permisos y CRUD de roles
   ========================================================= */
const { getPool, sql } = require('./conexion');

/* =========================================================
   Obtener rol de un usuario
   ========================================================= */
async function obtenerRolDeUsuario(idUsuario) {
    const pool = await getPool();
    const result = await pool.request()
        .input('IdUsuario', sql.Int, idUsuario)
        .query(`
            SELECT r.IdRol, r.Codigo, r.Nombre, r.Descripcion
            FROM Usuarios u
            INNER JOIN RolesSistema r ON r.IdRol = u.IdRol
            WHERE u.IdUsuario = @IdUsuario AND r.Activo = 1
        `);
    return result.recordset[0] || null;
}

/* =========================================================
   Permisos de un usuario
   ========================================================= */
async function obtenerPermisosDeUsuario(idUsuario) {
    const pool = await getPool();
    const result = await pool.request()
        .input('IdUsuario', sql.Int, idUsuario)
        .query(`
            SELECT p.Modulo, p.Permitido
            FROM Usuarios u
            INNER JOIN Permisos p ON p.IdRol = u.IdRol
            WHERE u.IdUsuario = @IdUsuario
        `);

    const permisos = {};
    for (const row of result.recordset) {
        permisos[row.Modulo] = !!row.Permitido;
    }
    return permisos;
}

/* =========================================================
   Listar roles
   ========================================================= */
async function listarRoles() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT r.IdRol, r.Codigo, r.Nombre, r.Descripcion, r.Activo, r.FechaCreacion,
               (SELECT COUNT(*) FROM Usuarios u WHERE u.IdRol = r.IdRol) AS UsuariosAsignados
        FROM RolesSistema r
        ORDER BY r.IdRol
    `);
    return result.recordset;
}

/* =========================================================
   Listar permisos (matriz completa)
   ========================================================= */
async function listarPermisos() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT p.IdPermiso, p.IdRol, r.Codigo AS RolCodigo, p.Modulo, p.Permitido
        FROM Permisos p
        INNER JOIN RolesSistema r ON r.IdRol = p.IdRol
        ORDER BY r.IdRol, p.Modulo
    `);
    return result.recordset;
}

/* =========================================================
   Actualizar permiso (rol + módulo)
   ========================================================= */
async function actualizarPermiso(idRol, modulo, permitido) {
    const pool = await getPool();

    const existe = await pool.request()
        .input('IdRol',  sql.Int,          idRol)
        .input('Modulo', sql.NVarChar(50), modulo)
        .query(`SELECT IdPermiso FROM Permisos WHERE IdRol = @IdRol AND Modulo = @Modulo`);

    if (existe.recordset.length > 0) {
        await pool.request()
            .input('IdRol',     sql.Int,          idRol)
            .input('Modulo',    sql.NVarChar(50), modulo)
            .input('Permitido', sql.Bit,          permitido ? 1 : 0)
            .query(`UPDATE Permisos SET Permitido = @Permitido
                    WHERE IdRol = @IdRol AND Modulo = @Modulo`);
    } else {
        await pool.request()
            .input('IdRol',     sql.Int,          idRol)
            .input('Modulo',    sql.NVarChar(50), modulo)
            .input('Permitido', sql.Bit,          permitido ? 1 : 0)
            .query(`INSERT INTO Permisos (IdRol, Modulo, Permitido)
                    VALUES (@IdRol, @Modulo, @Permitido)`);
    }
    return { ok: true };
}

/* =========================================================
   Asignar rol a usuario
   ========================================================= */
async function asignarRolAUsuario(idUsuario, idRol) {
    const pool = await getPool();
    await pool.request()
        .input('IdUsuario', sql.Int, idUsuario)
        .input('IdRol',     sql.Int, idRol)
        .query(`UPDATE Usuarios SET IdRol = @IdRol WHERE IdUsuario = @IdUsuario`);
    return { ok: true };
}

/* =========================================================
   CREAR ROL
   ========================================================= */
async function crearRol({ codigo, nombre, descripcion }) {
    const pool = await getPool();

    // Validar duplicado de código
    const dup = await pool.request()
        .input('Codigo', sql.NVarChar(30), codigo)
        .query(`SELECT IdRol FROM RolesSistema WHERE Codigo = @Codigo`);

    if (dup.recordset.length > 0) {
        return { ok: false, mensaje: 'Ya existe un rol con ese código.' };
    }

    const result = await pool.request()
        .input('Codigo',      sql.NVarChar(30),  codigo)
        .input('Nombre',      sql.NVarChar(80),  nombre)
        .input('Descripcion', sql.NVarChar(200), descripcion || null)
        .query(`
            INSERT INTO RolesSistema (Codigo, Nombre, Descripcion)
            OUTPUT INSERTED.IdRol
            VALUES (@Codigo, @Nombre, @Descripcion)
        `);

    const nuevoId = result.recordset[0].IdRol;

    return { ok: true, mensaje: 'Rol creado', idRol: nuevoId };
}

/* =========================================================
   ACTUALIZAR ROL
   ========================================================= */
async function actualizarRol(idRol, { codigo, nombre, descripcion }) {
    const pool = await getPool();

    // Validar que el código no esté en uso por OTRO rol
    const dup = await pool.request()
        .input('IdRol',  sql.Int,          idRol)
        .input('Codigo', sql.NVarChar(30), codigo)
        .query(`SELECT IdRol FROM RolesSistema WHERE Codigo = @Codigo AND IdRol <> @IdRol`);

    if (dup.recordset.length > 0) {
        return { ok: false, mensaje: 'Ya existe otro rol con ese código.' };
    }

    await pool.request()
        .input('IdRol',       sql.Int,           idRol)
        .input('Codigo',      sql.NVarChar(30),  codigo)
        .input('Nombre',      sql.NVarChar(80),  nombre)
        .input('Descripcion', sql.NVarChar(200), descripcion || null)
        .query(`
            UPDATE RolesSistema
            SET Codigo = @Codigo, Nombre = @Nombre, Descripcion = @Descripcion
            WHERE IdRol = @IdRol
        `);

    return { ok: true, mensaje: 'Rol actualizado' };
}

/* =========================================================
   ACTIVAR / DESACTIVAR ROL
   ========================================================= */
async function cambiarEstadoRol(idRol, activo) {
    const pool = await getPool();
    await pool.request()
        .input('IdRol',  sql.Int, idRol)
        .input('Activo', sql.Bit, activo ? 1 : 0)
        .query(`UPDATE RolesSistema SET Activo = @Activo WHERE IdRol = @IdRol`);
    return { ok: true, mensaje: activo ? 'Rol activado' : 'Rol desactivado' };
}

/* =========================================================
   ELIMINAR ROL
   ---------------------------------------------------------
   - No se permite si tiene usuarios asignados
   - Borra primero los permisos asociados (FK)
   ========================================================= */
async function eliminarRol(idRol) {
    const pool = await getPool();

    // ¿Tiene usuarios asignados?
    const uso = await pool.request()
        .input('IdRol', sql.Int, idRol)
        .query(`SELECT COUNT(*) AS Total FROM Usuarios WHERE IdRol = @IdRol`);

    const totalUsuarios = uso.recordset[0].Total;
    if (totalUsuarios > 0) {
        return {
            ok: false,
            mensaje: `No se puede eliminar: ${totalUsuarios} usuario(s) tienen este rol asignado.`
        };
    }

    // Borrar permisos asociados
    await pool.request()
        .input('IdRol', sql.Int, idRol)
        .query(`DELETE FROM Permisos WHERE IdRol = @IdRol`);

    // Borrar el rol
    await pool.request()
        .input('IdRol', sql.Int, idRol)
        .query(`DELETE FROM RolesSistema WHERE IdRol = @IdRol`);

    return { ok: true, mensaje: 'Rol eliminado' };
}

module.exports = {
    obtenerRolDeUsuario,
    obtenerPermisosDeUsuario,
    listarRoles,
    listarPermisos,
    actualizarPermiso,
    asignarRolAUsuario,
    crearRol,
    actualizarRol,
    cambiarEstadoRol,
    eliminarRol
};