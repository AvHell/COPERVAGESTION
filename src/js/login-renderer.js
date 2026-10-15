/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const formLogin          = document.getElementById('form-login');
const inputUsuario       = document.getElementById('usuario');
const inputPassword      = document.getElementById('password');
const btnLogin           = document.getElementById('btn-login');
const btnTogglePassword  = document.getElementById('btn-toggle-password');
const mensaje            = document.getElementById('mensaje');

const iconoOjo           = btnTogglePassword.querySelector('.icono-ojo');
const iconoOjoCerrado    = btnTogglePassword.querySelector('.icono-ojo-cerrado');

/* =========================================================
   TOGGLE PASSWORD
   ========================================================= */
btnTogglePassword.addEventListener('click', () => {
    const mostrando = inputPassword.type === 'text';

    if (mostrando) {
        inputPassword.type = 'password';
        iconoOjo.classList.remove('oculto');
        iconoOjoCerrado.classList.add('oculto');
        btnTogglePassword.setAttribute('title', 'Mostrar contraseña');
        btnTogglePassword.setAttribute('aria-label', 'Mostrar contraseña');
    } else {
        inputPassword.type = 'text';
        iconoOjo.classList.add('oculto');
        iconoOjoCerrado.classList.remove('oculto');
        btnTogglePassword.setAttribute('title', 'Ocultar contraseña');
        btnTogglePassword.setAttribute('aria-label', 'Ocultar contraseña');
    }

    inputPassword.focus();
});

/* =========================================================
   MENSAJE
   ========================================================= */
function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje ' + tipo;
    mensaje.classList.remove('oculto');
}

function ocultarMensaje() {
    mensaje.classList.add('oculto');
}

/* =========================================================
   AVISO DE SESIÓN (SweetAlert2)
   ========================================================= */
function avisoSesion(motivo) {
    if (motivo === 'logout') {
        Swal.fire({
            title: 'Sesión cerrada',
            text: 'Has cerrado sesión correctamente.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            timerProgressBar: true
        });
    } else if (motivo === 'expirada') {
        Swal.fire({
            title: 'Sesión expirada',
            text: 'Tu sesión ha expirado. Inicia sesión nuevamente.',
            icon: 'warning',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#2563eb'
        });
    }
}

/* =========================================================
   LOGIN
   ========================================================= */
async function hacerLogin() {
    const usuario  = inputUsuario.value.trim();
    const password = inputPassword.value;

    if (!usuario || !password) {
        mostrarMensaje('Usuario y contraseña son obligatorios.', 'error');
        return;
    }

    btnLogin.disabled = true;
    btnLogin.querySelector('.btn-text').textContent = 'Verificando...';
    ocultarMensaje();

    try {
        const res = await window.api.login(usuario, password);

        if (res.ok) {
            const nombre = res.usuario?.Nombres || usuario || 'usuario';
            const rol    = res.usuario?.RolNombre ? ` · ${res.usuario.RolNombre}` : '';
            mostrarMensaje(`¡Bienvenido, ${nombre}${rol}!`, 'ok');

            // Esperar un poco y abrir el menú
            setTimeout(async () => {
                await window.api.abrirMenu();
                window.close();
            }, 500);
        } else {
            mostrarMensaje(res.mensaje || 'Credenciales incorrectas.', 'error');
            btnLogin.disabled = false;
            btnLogin.querySelector('.btn-text').textContent = 'Entrar';
            inputPassword.value = '';
            inputPassword.focus();
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
        btnLogin.disabled = false;
        btnLogin.querySelector('.btn-text').textContent = 'Entrar';
    }
}

/* =========================================================
   SUBMIT DEL FORMULARIO
   ========================================================= */
formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    hacerLogin();
});

/* =========================================================
   ENTER EN EL CAMPO USUARIO → salta al password
   ========================================================= */
inputUsuario.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        inputPassword.focus();
    }
});

/* =========================================================
   INICIO: mostrar aviso si venimos de logout / expiración
   ========================================================= */
(async () => {
    try {
        const motivo = await window.api.consumirMotivoLogin?.();
        if (motivo) avisoSesion(motivo);

        // Por si la ventana del login YA estaba abierta cuando se dispara el motivo
        window.api.onLoginMotivo?.((m) => avisoSesion(m));
    } catch (err) {
        console.warn('[Login] No se pudo obtener motivo de sesión:', err);
    }
})();