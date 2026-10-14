/* =========================================================
   MENÚ PRINCIPAL — RENDERER
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

        // — Guard defensivo: aunque esté oculto, si alguien forzara click —
        if (!puedeAcceder(key)) {
            mostrarToast(`No tienes permisos para acceder a este módulo.`, 'error');
            return;
        }

        // Feedback visual
        btn.classList.add('modulo-card--abriendo');
        setTimeout(() => btn.classList.remove('modulo-card--abriendo'), 320);

        try {
            const res = await fn();

            /* Si el backend rechazó por permisos → avisar */
            if (res && res.ok === false && res.mensaje) {
                mostrarToast(res.mensaje, 'error');
                // Re-consultar permisos por si cambiaron
                await aplicarPermisos();
            }
        } catch (err) {
            console.error(`Error al abrir ${key}:`, err);
            mostrarToast('No se pudo abrir el módulo.', 'error');
        }
    });
});

/* =========================================================
   PERMISOS — consulta y aplica visibilidad al menú
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

    /* Ocultar/mostrar tarjetas según permiso */
    document.querySelectorAll('.modulo-card').forEach(card => {
        const modulo = card.dataset.modulo;
        const permitido = puedeAcceder(modulo);

        if (!permitido) {
            card.style.display = 'none';
            card.setAttribute('aria-hidden', 'true');
        } else {
            card.style.display = '';
            card.removeAttribute('aria-hidden');
        }
    });

    /* Ocultar categorías que quedaron sin tarjetas visibles */
    document.querySelectorAll('.categoria').forEach(seccion => {
        const visibles = seccion.querySelectorAll('.modulo-card:not([style*="display: none"])');
        seccion.style.display = visibles.length ? '' : 'none';
    });
}

/* =========================================================
   TOAST
   ========================================================= */
function mostrarToast(mensaje, tipo = 'info') {
    // Elimina toasts previos para no apilar
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
   CERRAR SESIÓN
   ========================================================= */
document.getElementById('btn-salir')?.addEventListener('click', async () => {
    await window.api.logout();
    window.close();
});

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
        }
    } catch (err) {
        console.error('Error obteniendo usuario actual:', err);
        if (avatarEl) avatarEl.textContent = '!';
        if (nameEl)   nameEl.textContent   = 'Error';
        if (roleEl)   roleEl.textContent   = '—';
    }

    /* 🔐 Aplicar permisos al menú */
    await aplicarPermisos();
})();