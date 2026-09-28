const crypto = require('crypto');
const { getPool, sql } = require('./conexion');

function hashearPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

async function login(nombreUsuario, password) {
    const pool = await getPool();
    const r = await pool.request()
        .input('NombreUsuario', sql.NVarChar(50), nombreUsuario)
        .query(`SELECT IdUsuario, Nombres, Apellidos, NombreUsuario,
                       PasswordHash, PasswordSalt, Activo
                FROM Usuarios
                WHERE NombreUsuario = @NombreUsuario`);

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
            IdUsuario: u.IdUsuario,
            Nombres: u.Nombres,
            Apellidos: u.Apellidos,
            NombreUsuario: u.NombreUsuario
        }
    };
}

async function listar() {
    const pool = await getPool();
    const r = await pool.request()
        .query(`SELECT IdUsuario, Nombres, Apellidos, NombreUsuario, Activo, FechaCreacion
                FROM Usuarios
                ORDER BY NombreUsuario`);
    return r.recordset;
}

async function crear(datos) {
    const pool = await getPool();
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = hashearPassword(datos.password, salt);

    await pool.request()
        .input('Nombres', sql.NVarChar(100), datos.nombres)
        .input('Apellidos', sql.NVarChar(100), datos.apellidos)
        .input('NombreUsuario', sql.NVarChar(50), datos.nombreUsuario)
        .input('PasswordHash', sql.VarChar(200), hash)
        .input('PasswordSalt', sql.VarChar(100), salt)
        .query(`INSERT INTO Usuarios (Nombres, Apellidos, NombreUsuario, PasswordHash, PasswordSalt)
                VALUES (@Nombres, @Apellidos, @NombreUsuario, @PasswordHash, @PasswordSalt)`);
    return { ok: true, mensaje: 'Usuario creado' };
}

async function actualizar(id, datos) {
    const pool = await getPool();

    if (datos.password) {
        // Cambia password también
        const salt = crypto.randomBytes(32).toString('hex');
        const hash = hashearPassword(datos.password, salt);
        await pool.request()
            .input('IdUsuario', sql.Int, id)
            .input('Nombres', sql.NVarChar(100), datos.nombres)
            .input('Apellidos', sql.NVarChar(100), datos.apellidos)
            .input('NombreUsuario', sql.NVarChar(50), datos.nombreUsuario)
            .input('PasswordHash', sql.VarChar(200), hash)
            .input('PasswordSalt', sql.VarChar(100), salt)
            .input('Activo', sql.Bit, datos.activo ? 1 : 0)
            .query(`UPDATE Usuarios
                    SET Nombres = @Nombres, Apellidos = @Apellidos, NombreUsuario = @NombreUsuario,
                        PasswordHash = @PasswordHash, PasswordSalt = @PasswordSalt, Activo = @Activo
                    WHERE IdUsuario = @IdUsuario`);
    } else {
        await pool.request()
            .input('IdUsuario', sql.Int, id)
            .input('Nombres', sql.NVarChar(100), datos.nombres)
            .input('Apellidos', sql.NVarChar(100), datos.apellidos)
            .input('NombreUsuario', sql.NVarChar(50), datos.nombreUsuario)
            .input('Activo', sql.Bit, datos.activo ? 1 : 0)
            .query(`UPDATE Usuarios
                    SET Nombres = @Nombres, Apellidos = @Apellidos, NombreUsuario = @NombreUsuario, Activo = @Activo
                    WHERE IdUsuario = @IdUsuario`);
    }
    return { ok: true, mensaje: 'Usuario actualizado' };
}

async function eliminar(id) {
    const pool = await getPool();
    // No se elimina físicamente, se desactiva
    await pool.request()
        .input('IdUsuario', sql.Int, id)
        .query('UPDATE Usuarios SET Activo = 0 WHERE IdUsuario = @IdUsuario');
    return { ok: true, mensaje: 'Usuario desactivado' };
}

module.exports = { login, listar, crear, actualizar, eliminar };