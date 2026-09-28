const btnProbar = document.getElementById('btn-probar-conexion');
const resultado  = document.getElementById('resultado-conexion');

btnProbar.addEventListener('click', async () => {
    resultado.textContent = 'Probando conexión...';
    try {
        const respuesta = await window.api.probarConexion();
        resultado.textContent = respuesta.mensaje;
    } catch (err) {
        resultado.textContent = '❌ Error: ' + err.message;
    }
});