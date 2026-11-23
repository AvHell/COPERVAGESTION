/* =========================================================
   VERIFICACIÓN SINTÁCTICA DEL SCRIPT DE ESQUEMA  (desarrollo)
   ---------------------------------------------------------
   Lee scripts/esquema-bd-desde-cero.sql y envía cada lote a SQL
   Server con SET PARSEONLY ON: el motor SOLO analiza la sintaxis,
   no ejecuta nada. Sirve para detectar errores de escritura, GO mal
   puestos o lotes incompletos sin tocar la base.

   Uso:
     npx electron scripts/_verif-ddl-parseonly.js

   Reutiliza la resolución de credenciales de scripts/_run-sql.js.
   ANTES de analizar el script comprueba que PARSEONLY funciona de
   verdad (con una tabla sonda que no debe llegar a crearse); si no
   funcionara, aborta sin analizar nada para no ejecutar DDL real.
   ========================================================= */

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const sql = require('mssql');

const RAIZ = path.join(__dirname, '..');
const PKG = require(path.join(RAIZ, 'package.json'));
const ORIGEN = path.join(RAIZ, 'scripts', 'esquema-bd-desde-cero.sql');
const SONDA = '__zz_parseonly_probe';

app.setName(PKG.name);
app.setPath('userData', path.join(app.getPath('appData'), PKG.name));

function credencialesDeLaApp() {
    const base = app.getPath('appData');
    const candidatos = [
        path.join(base, PKG.name, 'db-credentials.dat'),
        path.join(base, PKG.build?.productName || 'Inventario Equipos', 'db-credentials.dat')
    ];
    for (const ruta of candidatos) {
        if (!fs.existsSync(ruta)) continue;
        try {
            const contenido = JSON.parse(
                safeStorage.decryptString(Buffer.from(fs.readFileSync(ruta, 'utf8'), 'base64'))
            );
            if (contenido?.config?.server) return contenido.config;
        } catch (error) {
            console.warn(`No se pudo leer ${ruta}: ${error.message}`);
        }
    }
    return null;
}

function credencialesDeEntorno() {
    const env = process.env;
    if (!env.DB_SERVER || !env.DB_DATABASE || !env.DB_USER || !env.DB_PASSWORD) return null;
    return {
        server: env.DB_SERVER,
        port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
        database: env.DB_DATABASE,
        user: env.DB_USER,
        password: env.DB_PASSWORD
    };
}

function credencialesDeMcp() {
    const ruta = path.join(RAIZ, '.vscode', 'mcp.json');
    if (!fs.existsSync(ruta)) return null;
    try {
        const crudo = fs.readFileSync(ruta, 'utf8').replace(/^\s*\/\/.*$/gm, '');
        const json = JSON.parse(crudo);
        const env = json?.servers?.['mssql-bsite']?.env || {};
        const password = String(env.SQLSERVER_PASSWORD || '');
        if (!password || password.includes('${input:')) return null;
        return {
            server: env.SQLSERVER_HOST,
            port: env.SQLSERVER_PORT ? Number(env.SQLSERVER_PORT) : undefined,
            database: env.SQLSERVER_DATABASE,
            user: env.SQLSERVER_USER,
            password
        };
    } catch {
        return null;
    }
}

function resolverCredenciales() {
    const config = credencialesDeLaApp() || credencialesDeEntorno() || credencialesDeMcp();
    if (!config) {
        throw new Error('No hay credenciales: guarda la conexión desde la app o define DB_SERVER/DB_DATABASE/DB_USER/DB_PASSWORD.');
    }
    return config;
}

/** Parte el script en lotes por las líneas "GO" (mismo criterio que _run-sql.js). */
function lotes(script) {
    return String(script)
        .split(/^\s*GO\s*;?\s*$/gim)
        .map(lote => lote.trim())
        .filter(Boolean);
}

async function main() {
    const config = resolverCredenciales();
    const texto = fs.readFileSync(ORIGEN, 'utf8');
    const partes = lotes(texto);
    console.log(`Servidor ${config.server}${config.port ? `:${config.port}` : ''} · base ${config.database}`);
    console.log(`${path.basename(ORIGEN)}: ${partes.length} lote(s), ${texto.split('\n').length} líneas.`);

    /* Un solo hueco en el pool => una sola sesión => PARSEONLY no se pierde. */
    const pool = await new sql.ConnectionPool({
        server: config.server,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
        pool: { min: 1, max: 1, idleTimeoutMillis: 30000 },
        requestTimeout: 120000,
        connectionTimeout: 30000
    }).connect();

    try {
        await pool.request().query('SET PARSEONLY ON;');

        /* Comprobación previa: con PARSEONLY activo la sonda NO debe crearse. */
        await pool.request().query(`CREATE TABLE [dbo].[${SONDA}] (a int);`);
        const existeSonda = (await pool.request().query(
            `SELECT COUNT(*) AS n FROM sys.tables WHERE name = '${SONDA}'`
        )).recordset[0].n;

        if (existeSonda) {
            await pool.request().query(`DROP TABLE [dbo].[${SONDA}];`);
            await pool.request().query('SET PARSEONLY OFF;');
            throw new Error('PARSEONLY no está en vigor en esta conexión: se aborta para no ejecutar DDL real.');
        }
        console.log('PARSEONLY confirmado (la sonda no se creó).');

        const errores = [];
        for (let i = 0; i < partes.length; i += 1) {
            try {
                await pool.request().query(partes[i]);
            } catch (error) {
                const primeras = partes[i].split('\n').slice(0, 3).join(' / ');
                errores.push({ lote: i + 1, total: partes.length, mensaje: error.message, primeras });
                console.error(`  [${i + 1}/${partes.length}] ERROR: ${error.message}`);
                console.error(`      ${primeras}`);
            }
        }

        await pool.request().query('SET PARSEONLY OFF;');

        if (errores.length) {
            console.error(`\n${errores.length} lote(s) con error de sintaxis.`);
            process.exitCode = 1;
            return;
        }
        console.log(`\nSintaxis OK: ${partes.length} lotes analizados sin errores.`);
    } finally {
        await pool.close();
    }
}

app.whenReady().then(async () => {
    try {
        await main();
        app.exit(process.exitCode || 0);
    } catch (error) {
        console.error(`Fallo: ${error.message}`);
        app.exit(1);
    }
});
