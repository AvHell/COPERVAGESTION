const sql = require('mssql');
const credenciales = require('./credenciales');

function crearConfig(credencial = credenciales.cargar()) {
    if (!credencial) {
        throw new Error('Falta configurar la conexión a la base de datos. Ejecuta la aplicación para iniciar la configuración.');
    }
    const { instanceName, ...datosConexion } = credencial;

    return {
        ...datosConexion,
        options: {
            ...(instanceName ? { instanceName } : {}),
            trustServerCertificate: true,
            encrypt: true,
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
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(pool => {
                console.log('✅ Conectado a SQL Server remoto (' + config.server + ')');
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

process.on('SIGINT', async () => {
    try {
        const pool = await poolPromise;
        if (pool) await pool.close();
    } catch (_) {}
    process.exit(0);
});

module.exports = { getPool, sql, crearConfig };