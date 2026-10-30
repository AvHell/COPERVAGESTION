/* =========================================================
   MENÚ PRINCIPAL — RENDERER
   Filtro de permisos corregido para no romper la cuadrícula
   ========================================================= */

/* =========================================================
   MAPA DE MÓDULOS
   ========================================================= */
const MODULOS = {
    /* Sistema */
    catalogos: () => window.api.abrirCatalogos(),
    equipos:   () => window.api.abrirEquipos(),
    plano:     () => window.api.abrirPlano(),
    usuarios:  () => window.api.abrirUsuarios(),
    historico: () => window.api.abrirHistorico(),

    /* Activo Fijo */
    activofijo_catalogos:   () => window.api.abrirActivoFijoCatalogos(),
    activofijo_activos:     () => window.api.abrirActivoFijoActivos(),
    activofijo_responsivas: () => window.api.abrirActivoFijoResponsivas(),
    activofijo_reportes:    () => window.api.abrirActivoFijoReportes(),
    activofijo_importar:    () => window.api.abrirActivoFijoImportar()
};

/* =========================================================
   ESTADO
   ========================================================= */
let permisosUsuario = {};
let rolUsuario      = null;
let esAdmin         = false;

/* =========================================================
   CLICK EN TARJETA
   ========================================================= */
document.querySelectorAll('.modulo-card').forEach(btn => {
    btn.addEventListener('click', async () => {
        const key = btn.dataset.modulo;
        const fn  = MODULOS[key];

        if (typeof fn !== 'function') {
            console.warn(`Módulo desconocido: ${key}`);
            return;
        }

        if (!puedeAcceder(key)) {
            mostrarToast(`No tienes permisos para acceder a este módulo.`, 'error');
            return;
        }

        btn.classList.add('modulo-card--abriendo');
        setTimeout(() => btn.classList.remove('modulo-card--abriendo'), 320);

        try {
            const res = await fn();

            if (res && res.ok === false && res.mensaje) {
                mostrarToast(res.mensaje, 'error');
                await aplicarPermisos();
            }
        } catch (err) {
            console.error(`Error al abrir ${key}:`, err);
            mostrarToast('No se pudo abrir el módulo.', 'error');
        }
    });
});

/* =========================================================
   PERMISOS
   ========================================================= */
function puedeAcceder(modulo) {
    if (esAdmin) return true;
    return !!permisosUsuario[modulo];
}

async function aplicarPermisos() {
    try {
        permisosUsuario = (await window.api.permisos.mios()) || {};
        const rol = await window.api.permisos.miRol();
        rolUsuario = rol?.codigo || null;
        esAdmin    = rolUsuario === 'ADMIN';

        console.log('[Permisos] Rol:', rolUsuario, '| Permisos:', Object.keys(permisosUsuario).length);
    } catch (err) {
        console.error('[Permisos] Error consultando permisos:', err);
        permisosUsuario = {};
        rolUsuario = null;
        esAdmin = false;
    }

    document.querySelectorAll('.modulo-card').forEach(card => {
        const modulo = card.dataset.modulo;
        const permitido = puedeAcceder(modulo);

        if (!permitido) {
            card.classList.add('is-hidden');
            card.setAttribute('aria-hidden', 'true');
        } else {
            card.classList.remove('is-hidden');
            card.removeAttribute('aria-hidden');
        }
    });

    document.querySelectorAll('.categoria').forEach(seccion => {
        // Verifica si hay tarjetas visibles (que no tengan la clase is-hidden)
        const visibles = seccion.querySelectorAll('.modulo-card:not(.is-hidden)');
        if (visibles.length === 0) {
            seccion.style.display = 'none';
        } else {
            seccion.style.display = '';
        }
    });
}

/* =========================================================
   TOAST
   ========================================================= */
function mostrarToast(mensaje, tipo = 'info') {
    document.querySelectorAll('.menu-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `menu-toast menu-toast--${tipo}`;
    toast.textContent = mensaje;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 320);
    }, 3200);
}

/* =========================================================
   CERRAR SESIÓN — SweetAlert2
   ========================================================= */
document.getElementById('btn-salir')?.addEventListener('click', async () => {
    const result = await Swal.fire({
        title: '¿Cerrar sesión?',
        html: 'Se cerrarán <b>todas las ventanas abiertas</b> y volverás a la pantalla de inicio de sesión.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        }
    });

    if (!result.isConfirmed) return;

    // Bloquear UI mientras se procesa
    Swal.fire({
        title: 'Cerrando sesión…',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        await window.api.logout();
        Swal.close();
    } catch (err) {
        Swal.fire({
            title: 'Error',
            text: 'No se pudo cerrar la sesión. Intenta de nuevo.',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
});

/* =========================================================
   ESCUCHAR CIERRE DE SESIÓN DESDE EL MAIN
   ========================================================= */
if (window.api && window.api.onSesionCerrada) {
    window.api.onSesionCerrada(({ motivo }) => {
        console.warn('[Menú] Sesión cerrada por el sistema:', motivo);
        // El main ya se encarga de cerrar esta ventana y abrir login.
    });
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function inicialesDe(nombres, apellidos, usuario) {
    const n = (nombres || '').trim();
    const a = (apellidos || '').trim();
    if (n && a) return (n[0] + a[0]).toUpperCase();
    if (n) return n.slice(0, 2).toUpperCase();
    if (usuario) return usuario.slice(0, 2).toUpperCase();
    return '?';
}

function formatearFechaHoy() {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const hoy = new Date();
    return `${dias[hoy.getDay()]}, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;
}

function obtenerSaludo() {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

/* =========================================================
   INICIO: usuario actual + fecha + permisos
   ========================================================= */
(async () => {
    const fechaEl = document.getElementById('fecha-hoy');
    if (fechaEl) fechaEl.textContent = formatearFechaHoy();

    const avatarEl = document.getElementById('user-avatar');
    const nameEl   = document.getElementById('user-name');
    const roleEl   = document.getElementById('user-role');
    const saludoEl = document.getElementById('saludo');
    const bienvEl  = document.getElementById('bienvenida');

    try {
        const u = await window.api.usuarioActual();

        if (u) {
            const nombreCompleto = `${u.Nombres ?? ''} ${u.Apellidos ?? ''}`.trim()
                || u.NombreUsuario
                || 'Usuario';

            const iniciales = inicialesDe(u.Nombres, u.Apellidos, u.NombreUsuario);

            if (avatarEl) avatarEl.textContent = iniciales;
            if (nameEl)   nameEl.textContent   = nombreCompleto;
            if (roleEl)   roleEl.textContent   = (u.RolNombre ?? u.Rol ?? u.TipoUsuario ?? 'Usuario').toString();

            if (saludoEl) saludoEl.textContent = `${obtenerSaludo()}, ${u.Nombres ?? nombreCompleto}`;
            if (bienvEl)  bienvEl.textContent  = 'Selecciona un módulo para comenzar a trabajar.';
        } else {
            if (avatarEl) avatarEl.textContent = '?';
            if (nameEl)   nameEl.textContent   = 'Invitado';
            if (roleEl)   roleEl.textContent   = 'Sin sesión';
            if (saludoEl) saludoEl.textContent = 'Bienvenido';
            if (bienvEl)  bienvEl.textContent  = 'Inicia sesión para acceder al sistema.';

            setTimeout(() => {
                window.api.volverMenu?.();
            }, 500);
            return;
        }
    } catch (err) {
        console.error('Error obteniendo usuario actual:', err);
        if (avatarEl) avatarEl.textContent = '!';
        if (nameEl)   nameEl.textContent   = 'Error';
        if (roleEl)   roleEl.textContent   = '—';
    }

    await aplicarPermisos();
})();