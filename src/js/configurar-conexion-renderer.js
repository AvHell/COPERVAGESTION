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
