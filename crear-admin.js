const crypto = require('crypto');
const sql = require('mssql/msnodesqlv8');

function hashearPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

async function main() {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = hashearPassword('admin123', salt);

    const config = {
        driver: 'msnodesqlv8',
        connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS;Database=InventarioEquipos;Trusted_Connection=Yes;TrustServerCertificate=Yes;'
    };

    const pool = await sql.connect(config);
    await pool.request()
        .input('Nombres', sql.NVarChar(100), 'Administrador')
        .input('Apellidos', sql.NVarChar(100), 'Sistema')
        .input('NombreUsuario', sql.NVarChar(50), 'admin')
        .input('PasswordHash', sql.VarChar(200), hash)
        .input('PasswordSalt', sql.VarChar(100), salt)
        .query(`INSERT INTO Usuarios (Nombres, Apellidos, NombreUsuario, PasswordHash, PasswordSalt)
                VALUES (@Nombres, @Apellidos, @NombreUsuario, @PasswordHash, @PasswordSalt)`);

    console.log('✅ Usuario admin creado. Login: admin / admin123');
    await pool.close();
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });