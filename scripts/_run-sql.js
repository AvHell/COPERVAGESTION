/* =========================================================
   RUNNER SQL (desarrollo)
   ---------------------------------------------------------
   Ejecuta un archivo .sql o una consulta suelta contra la MISMA base que
   usa la aplicación, reutilizando la configuración cifrada que guardó el
   programa (Electron safeStorage / DPAPI) o, si no existe, las variables
   DB_* o el servidor MCP de .vscode/mcp.json.

   La contraseña NUNCA se imprime ni se escribe en disco.

   Uso:
     npx electron scripts/_run-sql.js <archivo.sql>
     npx electron scripts/_run-sql.js --query "SELECT TOP 5 * FROM dbo.X"
     npx electron scripts/_run-sql.js --query-file consulta.sql

   Un archivo se parte por lotes en las líneas "GO" (igual que SSMS).
   ========================================================= */

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const sql = require('mssql');

const RAIZ = path.join(__dirname, '..');
const PKG = require(path.join(RAIZ, 'package.json'));

/* El nombre y la carpeta de datos se fijan ANTES de que Electron cargue el
   perfil: safeStorage (OSCrypt) toma la clave de "Local State" de userData, y
   si el proceso arranca como "Electron" esa carpeta no existe y el descifrado
   de db-credentials.dat falla. */
app.setName(PKG.name);
app.setPath('userData', path.join(app.getPath('appData'), PKG.name));

/** Configuración cifrada de la app (la misma que escribe Configurar conexión). */
function credencialesDeLaApp() {
    const pkg = PKG;
    const base = app.getPath('appData');
    const candidatos = [
        path.join(base, pkg.name, 'db-credentials.dat'),
        path.join(base, pkg.build?.productName || 'Inventario Equipos', 'db-credentials.dat')
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

/** Variables de entorno (DB_*) como segunda opción. */
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

/** Servidor MCP de .vscode/mcp.json (sólo si la contraseña está literal). */
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
        throw new Error('No hay credenciales: guarda la conexión desde la app (Configurar conexión) o define DB_SERVER/DB_DATABASE/DB_USER/DB_PASSWORD.');
    }
    return config;
}

/** Parte el script en lotes por las líneas "GO". */
function lotes(script) {
    return String(script)
        .split(/^\s*GO\s*;?\s*$/gim)
        .map(lote => lote.trim())
        .filter(Boolean);
}

function leerEntrada(argv) {
    const indiceQuery = argv.indexOf('--query');
    if (indiceQuery !== -1) return { tipo: 'query', texto: String(argv[indiceQuery + 1] || '') };
    const indiceArchivo = argv.indexOf('--query-file');
    if (indiceArchivo !== -1) {
        return { tipo: 'query', texto: fs.readFileSync(path.resolve(argv[indiceArchivo + 1]), 'utf8') };
    }
    const archivo = argv.find(arg => arg.toLowerCase().endsWith('.sql'));
    if (!archivo) throw new Error('Indica un archivo .sql o usa --query "SELECT ...".');
    return { tipo: 'archivo', nombre: archivo, texto: fs.readFileSync(path.resolve(archivo), 'utf8') };
}

async function main() {
    const entrada = leerEntrada(process.argv.slice(1));
    const config = resolverCredenciales();
    console.log(`Servidor ${config.server}${config.port ? `:${config.port}` : ''} · base ${config.database} · usuario ${config.user}`);

    const pool = await new sql.ConnectionPool({
        server: config.server,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
        requestTimeout: 120000,
        connectionTimeout: 30000
    }).connect();

    try {
        if (entrada.tipo === 'query') {
            const result = await pool.request().query(entrada.texto);
            const filas = (result.recordsets || []).flat();
            if (filas.length) console.log(JSON.stringify(filas, null, 2));
            else console.log(`Sin filas. rowsAffected: ${JSON.stringify(result.rowsAffected)}`);
            return;
        }

        const partes = lotes(entrada.texto);
        console.log(`${entrada.nombre}: ${partes.length} lote(s).`);
        for (let i = 0; i < partes.length; i += 1) {
            try {
                const result = await pool.request().query(partes[i]);
                const resumen = (result.recordsets || [])
                    .filter(rs => rs && rs.length)
                    .map(rs => rs.slice(0, 20));
                const afectadas = (result.rowsAffected || []).reduce((a, b) => a + (b || 0), 0);
                console.log(`  [${i + 1}/${partes.length}] ok · filas afectadas: ${afectadas}`);
                resumen.forEach(rs => console.log(JSON.stringify(rs, null, 2)));
            } catch (error) {
                console.error(`  [${i + 1}/${partes.length}] ERROR: ${error.message}`);
                throw error;
            }
        }
        console.log('Listo.');
    } finally {
        await pool.close();
    }
}

app.whenReady().then(async () => {
    try {
        await main();
        app.exit(0);
    } catch (error) {
        console.error(`Fallo: ${error.message}`);
        app.exit(1);
    }
});
