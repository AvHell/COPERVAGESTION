/* =========================================================
   CONEXIÓN — SQL Server remoto bsite.net
   ✅ Configuración verificada y funcional
   ========================================================= */

const sql = require('mssql');

const config = {
    user:     'copervaservicios_',
    password: 'tumama22',
    server:   'sql.bsite.net',
    database: 'copervaservicios_',
    options: {
        instanceName: 'MSSQL2016',       // ✅ SIN el sufijo "SQL"
        trustServerCertificate: true,
        encrypt: true,
        enableArithAbort: true,
        connectionTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

/* ---------------------------------------------------------
   Pool singleton
   --------------------------------------------------------- */
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
                poolPromise = null; // permite reintentos
                throw err;
            });
    }
    return poolPromise;
}

/* ---------------------------------------------------------
   Cierre limpio del pool
   --------------------------------------------------------- */
process.on('SIGINT', async () => {
    try {
        const pool = await poolPromise;
        if (pool) await pool.close();
    } catch (_) {}
    process.exit(0);
});

module.exports = { getPool, sql };