const form = document.getElementById('form-conexion');
const boton = document.getElementById('guardar');
const mensaje = document.getElementById('mensaje');
const pistaPassword = document.getElementById('pista-password');
const campoPassword = document.getElementById('password');

const TEXTO_BOTON = 'Probar y guardar conexión';

// Datos no sensibles de la conexión ya guardada (nunca incluye la contraseña).
let conexionGuardada = null;

function mostrarAviso(texto, tipo = 'error') {
    mensaje.textContent = texto;
    mensaje.className = `message ${tipo} visible`;
}

function limpiarAviso() {
    mensaje.className = 'message';
    mensaje.textContent = '';
}

function bloquearFormulario(bloqueado, textoBoton = TEXTO_BOTON) {
    boton.disabled = bloqueado;
    boton.textContent = textoBoton;
}

/**
 * Precarga servidor, puerto, base de datos y usuario guardados y deja la
 * contraseña en blanco para conservarla si el destino no cambia.
 */
async function precargarConexionGuardada() {
    try {
        const estado = await window.api.obtenerConexionGuardada();
        if (!estado?.ok || !estado.configurada) return;

        conexionGuardada = estado;
        form.server.value = estado.server || '';
        form.port.value = estado.port ?? '';
        form.database.value = estado.database || '';
        form.user.value = estado.user || '';
        campoPassword.value = '';

        if (estado.tienePassword) {
            campoPassword.placeholder = 'Contraseña guardada (dejar en blanco)';
            pistaPassword.textContent = 'Ya hay una contraseña guardada. Déjala en blanco para conservarla.';
            pistaPassword.classList.add('visible');
        }
    } catch (error) {
        console.warn('[Configuración DB] No se pudieron precargar los datos guardados:', error);
    }
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    bloquearFormulario(true, 'Probando conexión…');
    limpiarAviso();

    const datos = Object.fromEntries(new FormData(form).entries());

    // Normalizar: port vacío -> undefined; si viene, a número
    const portRaw = String(datos.port ?? '').trim();
    datos.port = portRaw === '' ? undefined : Number(portRaw);
    if (datos.port !== undefined && (!Number.isInteger(datos.port) || datos.port < 1 || datos.port > 65535)) {
        mostrarAviso('El puerto debe ser un número entre 1 y 65535.');
        bloquearFormulario(false);
        return;
    }

    // La contraseña puede quedar en blanco: el proceso principal reutiliza la
    // guardada cuando el servidor, puerto, base de datos y usuario no cambian.
    datos.password = String(datos.password ?? '');
    if (!datos.password && !conexionGuardada?.tienePassword) {
        mostrarAviso('Escribe la contraseña de SQL Server.');
        bloquearFormulario(false);
        return;
    }

    try {
        const resultado = await window.api.configurarConexion(datos);
        if (!resultado?.ok) {
            mostrarAviso(resultado?.mensaje || 'No se pudo validar la conexión.');
            return;
        }
        mostrarAviso('Conexión validada y guardada. Abriendo el inicio de sesión…', 'success');
    } catch (error) {
        console.error('[Configuración DB] No se pudo guardar la conexión:', error);
        mostrarAviso('Ocurrió un error al guardar la configuración.');
    } finally {
        bloquearFormulario(false);
    }
});

precargarConexionGuardada();
