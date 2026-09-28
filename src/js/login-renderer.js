const inputUsuario = document.getElementById('usuario');
const inputPassword = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const mensaje = document.getElementById('mensaje');

async function hacerLogin() {
    const usuario = inputUsuario.value.trim();
    const password = inputPassword.value;

    if (!usuario || !password) {
        mostrarMensaje('Usuario y contraseña son obligatorios.', 'error');
        return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Verificando...';

    try {
        const res = await window.api.login(usuario, password);
        if (res.ok) {
            mostrarMensaje('¡Bienvenido, ' + res.usuario.Nombres + '!', 'ok');
            // Esperar un poco y abrir el menú
            setTimeout(async () => {
                await window.api.abrirMenu();
                window.close();
            }, 500);
        } else {
            mostrarMensaje(res.mensaje, 'error');
            btnLogin.disabled = false;
            btnLogin.textContent = 'Entrar';
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
        btnLogin.disabled = false;
        btnLogin.textContent = 'Entrar';
    }
}

btnLogin.addEventListener('click', hacerLogin);

inputPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') hacerLogin();
});

inputUsuario.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') inputPassword.focus();
});

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje ' + tipo;
    mensaje.style.display = 'block';
}