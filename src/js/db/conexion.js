const sql = require('mssql');
const credenciales = require('./credenciales');

function crearConfig(credencial = credenciales.cargar()) {
    if (!credencial) {
        throw new Error('Falta configurar la conexión a la base de datos. Ejecuta la aplicación para iniciar la configuración.');
    }

    const {
        // Las configuraciones antiguas podían guardar instanceName; ya no se usa
        // (el servidor se resuelve por host + puerto, sin SQL Browser).
        instanceName: _instanceName,
        port,
        encrypt,
        trustServerCertificate,
        ...datosConexion
    } = credencial;

    // Encrypt: prioridad -> credencial.encrypt -> env DB_ENCRYPT -> false (bsite.net)
    const encryptFinal = typeof encrypt === 'boolean'
        ? encrypt
        : String(process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true';

    // trustServerCertificate: por defecto true (hosting compartido suele tener cert no válido)
    const trustFinal = typeof trustServerCertificate === 'boolean'
        ? trustServerCertificate
        : true;

    return {
        ...datosConexion,                       // server, database, user, password
        ...(port ? { port: Number(port) } : {}), // 👈 puerto explícito → sin SQL Browser
        options: {
            trustServerCertificate: trustFinal,
            encrypt: encryptFinal,
            enableArithAbort: true,
            connectionTimeout: 30000,
            requestTimeout: 30000,
            useUTC: false
        },
        pool: {
            max: 20,
            min: 2,
            idleTimeoutMillis: 60000,
            acquireTimeoutMillis: 30000,
            createTimeoutMillis: 30000,
            destroyTimeoutMillis: 5000,
            reapIntervalMillis: 1000,
            createRetryIntervalMillis: 200
        }
    };
}

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        const config = crearConfig();
        const destino = config.port ? `${config.server}:${config.port}` : config.server;
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(pool => {
                console.log(`✅ Conectado a SQL Server remoto (${destino})`);
                return pool;
            })
            .catch(err => {
                console.error('❌ Error conectando a SQL Server:', err.message);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

async function cerrarPool() {
    if (!poolPromise) return;
    try {
        const pool = await poolPromise;
        if (pool) await pool.close();
    } catch (_) {
        /* ignorar */
    } finally {
        poolPromise = null;
    }
}

process.on('SIGINT', async () => {
    await cerrarPool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await cerrarPool();
    process.exit(0);
});

module.exports = { getPool, cerrarPool, sql, crearConfig };