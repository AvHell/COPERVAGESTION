const crypto = require('crypto');
const { getPool, sql } = require('./conexion');

/* =========================================================
   HASH
   ========================================================= */
function hashearPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

/* =========================================================
   LOGIN
   ---------------------------------------------------------
   Devuelve usuario + rol + permisos (los permisos se cargan
   en main.js para no ensuciar este módulo).
   ========================================================= */
async function login(nombreUsuario, password) {
    const pool = await getPool();
    const r = await pool.request()
        .input('NombreUsuario', sql.NVarChar(50), nombreUsuario)
        .query(`
            SELECT u.IdUsuario, u.Nombres, u.Apellidos, u.NombreUsuario,
                   u.PasswordHash, u.PasswordSalt, u.Activo,
                   u.IdRol,
                   r.Codigo AS RolCodigo,
                   r.Nombre AS RolNombre
            FROM Usuarios u
            LEFT JOIN RolesSistema r ON r.IdRol = u.IdRol
            WHERE u.NombreUsuario = @NombreUsuario
        `);

    const u = r.recordset[0];
    if (!u) return { ok: false, mensaje: 'Usuario o contraseña incorrectos' };
    if (!u.Activo) return { ok: false, mensaje: 'Usuario inactivo' };

    const hash = hashearPassword(password, u.PasswordSalt);
    if (hash !== u.PasswordHash) {
        return { ok: false, mensaje: 'Usuario o contraseña incorrectos' };
    }

    return {
        ok: true,
        usuario: {
            IdUsuario:     u.IdUsuario,
            Nombres:       u.Nombres,
            Apellidos:     u.Apellidos,
            NombreUsuario: u.NombreUsuario,
            IdRol:         u.IdRol,
            Rol:           u.RolCodigo   || null,
            RolNombre:     u.RolNombre   || null
        }
    };
}

/* =========================================================
   LISTAR
   ========================================================= */
async function listar() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT u.IdUsuario, u.Nombres, u.Apellidos, u.NombreUsuario,
               u.Activo, u.FechaCreacion,
               u.IdRol,
               r.Codigo AS RolCodigo,
               r.Nombre AS RolNombre
        FROM Usuarios u
        LEFT JOIN RolesSistema r ON r.IdRol = u.IdRol
        ORDER BY u.NombreUsuario
    `);
    return r.recordset;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(datos) {
    const pool = await getPool();
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = hashearPassword(datos.password, salt);

    await pool.request()
        .input('Nombres',       sql.NVarChar(100), datos.nombres)
        .input('Apellidos',     sql.NVarChar(100), datos.apellidos)
        .input('NombreUsuario', sql.NVarChar(50),  datos.nombreUsuario)
        .input('PasswordHash',  sql.VarChar(200),  hash)
        .input('PasswordSalt',  sql.VarChar(100),  salt)
        .input('IdRol',         sql.Int,           datos.idRol || null)
        .query(`
            INSERT INTO Usuarios
                (Nombres, Apellidos, NombreUsuario, PasswordHash, PasswordSalt, IdRol)
            VALUES
                (@Nombres, @Apellidos, @NombreUsuario, @PasswordHash, @PasswordSalt, @IdRol)
        `);
    return { ok: true, mensaje: 'Usuario creado' };
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(id, datos) {
    const pool = await getPool();

    if (datos.password) {
        const salt = crypto.randomBytes(32).toString('hex');
        const hash = hashearPassword(datos.password, salt);
        await pool.request()
            .input('IdUsuario',     sql.Int,           id)
            .input('Nombres',       sql.NVarChar(100), datos.nombres)
            .input('Apellidos',     sql.NVarChar(100), datos.apellidos)
            .input('NombreUsuario', sql.NVarChar(50),  datos.nombreUsuario)
            .input('PasswordHash',  sql.VarChar(200),  hash)
            .input('PasswordSalt',  sql.VarChar(100),  salt)
            .input('Activo',        sql.Bit,           datos.activo ? 1 : 0)
            .input('IdRol',         sql.Int,           datos.idRol || null)
            .query(`
                UPDATE Usuarios
                SET Nombres = @Nombres, Apellidos = @Apellidos, NombreUsuario = @NombreUsuario,
                    PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt,
                    Activo = @Activo, IdRol = @IdRol
                WHERE IdUsuario = @IdUsuario
            `);
    } else {
        await pool.request()
            .input('IdUsuario',     sql.Int,           id)
            .input('Nombres',       sql.NVarChar(100), datos.nombres)
            .input('Apellidos',     sql.NVarChar(100), datos.apellidos)
            .input('NombreUsuario', sql.NVarChar(50),  datos.nombreUsuario)
            .input('Activo',        sql.Bit,           datos.activo ? 1 : 0)
            .input('IdRol',         sql.Int,           datos.idRol || null)
            .query(`
                UPDATE Usuarios
                SET Nombres = @Nombres, Apellidos = @Apellidos, NombreUsuario = @NombreUsuario,
                    Activo = @Activo, IdRol = @IdRol
                WHERE IdUsuario = @IdUsuario
            `);
    }
    return { ok: true, mensaje: 'Usuario actualizado' };
}

/* =========================================================
   DESACTIVAR
   ========================================================= */
async function eliminar(id) {
    const pool = await getPool();
    await pool.request()
        .input('IdUsuario', sql.Int, id)
        .query('UPDATE Usuarios SET Activo = 0 WHERE IdUsuario = @IdUsuario');
    return { ok: true, mensaje: 'Usuario desactivado' };
}

module.exports = { login, listar, crear, actualizar, eliminar };