const sql = require('mssql');

const config = {
    user:     'copervaservicios_',
    password: 'tumama22',
    server:   'sql.bsite.net',
    database: 'copervaservicios_',
    options: {
        instanceName: 'MSSQL2016',
        trustServerCertificate: true,
        encrypt: true,
        enableArithAbort: true,
        connectionTimeout: 30000,
        requestTimeout: 30000,
        // ✅ FIX: desactivar keep-alive TCP lento, usar el default
        // ✅ FIX: usar TDS 7.4 (default en mssql moderno)
        useUTC: false
    },
    pool: {
        // ✅ FIX: subir max para permitir más concurrencia (Promise.all)
        max: 20,
        min: 2,          // ✅ mantener 2 conexiones calientes para evitar cold-start
        idleTimeoutMillis: 60000,
        // ✅ FIX: forzar que las conexiones se renueven antes del timeout del server
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
    }
};

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
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

module.exports = { getPool, sql };