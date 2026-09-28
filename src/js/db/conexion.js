const sql = require('mssql/msnodesqlv8');

const connectionString =
    'Driver={ODBC Driver 17 for SQL Server};' +
    'Server=.\\SQLEXPRESS;' +
    'Database=InventarioEquipos;' +
    'Trusted_Connection=Yes;' +
    'TrustServerCertificate=Yes;';

const config = {
    driver: 'msnodesqlv8',
    connectionString: connectionString,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Pool singleton
let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config);
    }
    return poolPromise;
}

module.exports = { getPool, sql };