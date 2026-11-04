const form = document.getElementById('form-conexion');
const boton = document.getElementById('guardar');
const mensaje = document.getElementById('mensaje');

form.addEventListener('submit', async event => {
    event.preventDefault();
    boton.disabled = true;
    boton.textContent = 'Probando conexión…';
    mensaje.className = 'message';
    mensaje.textContent = '';

    const datos = Object.fromEntries(new FormData(form).entries());

    // Normalizar: port vacío -> undefined; si viene, a número
    const portRaw = String(datos.port ?? '').trim();
    datos.port = portRaw === '' ? undefined : Number(portRaw);
    if (datos.port !== undefined && (!Number.isInteger(datos.port) || datos.port < 1 || datos.port > 65535)) {
        mensaje.textContent = 'El puerto debe ser un número entre 1 y 65535.';
        mensaje.className = 'message error visible';
        boton.disabled = false;
        boton.textContent = 'Probar y guardar conexión';
        return;
    }

    // Normalizar: instanceName vacío -> undefined (no enviar cadena vacía)
    const inst = String(datos.instanceName ?? '').trim();
    datos.instanceName = inst === '' ? undefined : inst;

    try {
        const resultado = await window.api.configurarConexion(datos);
        if (!resultado?.ok) {
            mensaje.textContent = resultado?.mensaje || 'No se pudo validar la conexión.';
            mensaje.className = 'message error visible';
            return;
        }
        mensaje.textContent = 'Conexión validada y guardada. Abriendo el inicio de sesión…';
        mensaje.className = 'message success visible';
    } catch (error) {
        console.error('[Configuración DB] No se pudo guardar la conexión:', error);
        mensaje.textContent = 'Ocurrió un error al guardar la configuración.';
        mensaje.className = 'message error visible';
    } finally {
        boton.disabled = false;
        boton.textContent = 'Probar y guardar conexión';
    }
});