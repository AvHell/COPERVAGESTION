const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const ARCHIVO_CREDENCIALES = 'db-credentials.dat';
const VERSION_FORMATO = 1;

function obtenerRuta() {
    return path.join(app.getPath('userData'), ARCHIVO_CREDENCIALES);
}

/**
 * Normaliza y valida los datos de conexión.
 *
 * @param {object} datos Campos del formulario o del entorno.
 * @param {{ passwordOpcional?: boolean }} opciones
 *   passwordOpcional: permite enviar la contraseña en blanco. El llamador debe
 *   reutilizar la contraseña ya guardada antes de guardar el resultado.
 */
function validar(datos, opciones = {}) {
    const passwordOpcional = opciones.passwordOpcional === true;

    const config = {
        server: String(datos?.server || '').trim(),
        port: datos?.port !== undefined && datos?.port !== null && datos?.port !== ''
            ? Number(datos.port)
            : undefined,
        database: String(datos?.database || '').trim(),
        user: String(datos?.user || '').trim(),
        password: String(datos?.password ?? '')
    };

    const requeridos = ['server', 'database', 'user'];
    if (!passwordOpcional) requeridos.push('password');

    const faltantes = requeridos.filter(campo => !config[campo]);
    if (faltantes.length) {
        throw new Error(passwordOpcional
            ? 'Completa servidor, base de datos y usuario.'
            : 'Completa servidor, base de datos, usuario y contraseña.');
    }

    if (config.server.length > 255 || config.database.length > 128 ||
        config.user.length > 128 || config.password.length > 1024) {
        throw new Error('Uno o más campos exceden el tamaño permitido.');
    }

    // Validar puerto (si viene). Sin puerto, tedious usa el 1433 por defecto.
    if (config.port !== undefined) {
        if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
            throw new Error('El puerto debe ser un número entre 1 y 65535.');
        }
    }

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
        // Las configuraciones anteriores podían incluir instanceName; validar() ya no lo
        // captura ni lo devuelve, así que se descarta de forma transparente.
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
        database: env.DB_DATABASE,
        user: env.DB_USER,
        password: env.DB_PASSWORD
    });
}

module.exports = { guardar, cargar, eliminar, desdeEntorno, validar };
