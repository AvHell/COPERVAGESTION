const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const ARCHIVO_CREDENCIALES = 'db-credentials.dat';
const VERSION_FORMATO = 1;

function obtenerRuta() {
    return path.join(app.getPath('userData'), ARCHIVO_CREDENCIALES);
}

function validar(datos) {
    const config = {
        server: String(datos?.server || '').trim(),
        port: datos?.port !== undefined && datos?.port !== null && datos?.port !== ''
            ? Number(datos.port)
            : undefined,
        instanceName: String(datos?.instanceName || '').trim(),
        database: String(datos?.database || '').trim(),
        user: String(datos?.user || '').trim(),
        password: String(datos?.password || '')
    };

    const faltantes = ['server', 'database', 'user', 'password']
        .filter(campo => !config[campo]);
    if (faltantes.length) {
        throw new Error('Completa servidor, base de datos, usuario y contraseña.');
    }

    if (config.server.length > 255 || config.database.length > 128 ||
        config.user.length > 128 || config.password.length > 1024 ||
        config.instanceName.length > 128) {
        throw new Error('Uno o más campos exceden el tamaño permitido.');
    }

    // Validar puerto (si viene)
    if (config.port !== undefined) {
        if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
            throw new Error('El puerto debe ser un número entre 1 y 65535.');
        }
    }

    // Regla para hosting compartido (sql.bsite.net, etc.):
    // si hay instanceName pero no port, tedious intentará SQL Browser (UDP 1434)
    // y fallará con EINSTLOOKUP. Forzamos a que el usuario ponga el puerto.
    if (config.instanceName && !config.port) {
        throw new Error(
            'Si indicas un nombre de instancia, también debes indicar el puerto TCP ' +
            '(por ejemplo 1433). En hosting compartido el SQL Browser no está accesible.'
        );
    }

    // Si NO hay instanceName y NO hay port, dejamos que tedious use el 1433 por defecto.
    // No es un error, pero lo dejamos documentado.

    return config;
}

function guardar(datos) {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('El cifrado seguro del sistema operativo no está disponible.');
    }

    const config = validar(datos);
    const contenido = JSON.stringify({ version: VERSION_FORMATO, config });
    const cifrado = safeStorage.encryptString(contenido).toString('base64');
    const destino = obtenerRuta();
    const temporal = `${destino}.tmp`;

    try {
        fs.writeFileSync(temporal, cifrado, { encoding: 'utf8', mode: 0o600 });
        fs.renameSync(temporal, destino);
    } catch (error) {
        if (fs.existsSync(temporal)) fs.unlinkSync(temporal);
        throw new Error(`No se pudo guardar la configuración cifrada: ${error.message}`);
    }
}

function eliminar() {
    const ruta = obtenerRuta();
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
    const temporal = `${ruta}.tmp`;
    if (fs.existsSync(temporal)) fs.unlinkSync(temporal);
}

function cargar() {
    const ruta = obtenerRuta();
    if (!fs.existsSync(ruta)) return null;
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('El cifrado seguro del sistema operativo no está disponible.');
    }

    try {
        const cifrado = fs.readFileSync(ruta, 'utf8');
        const contenido = JSON.parse(safeStorage.decryptString(Buffer.from(cifrado, 'base64')));
        if (contenido.version !== VERSION_FORMATO) {
            throw new Error('La configuración cifrada usa una versión no compatible.');
        }
        return validar(contenido.config);
    } catch (error) {
        throw new Error(`No se pudo leer la configuración cifrada de la base de datos: ${error.message}`);
    }
}

function desdeEntorno(env = process.env) {
    const requeridas = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
    if (!requeridas.every(nombre => env[nombre])) return null;
    return validar({
        server: env.DB_SERVER,
        port: env.DB_PORT,
        instanceName: env.DB_INSTANCE,
        database: env.DB_DATABASE,
        user: env.DB_USER,
        password: env.DB_PASSWORD
    });
}

module.exports = { guardar, cargar, eliminar, desdeEntorno, validar };