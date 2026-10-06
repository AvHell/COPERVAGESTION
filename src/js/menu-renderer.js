/* =========================================================
   MENÚ PRINCIPAL — RENDERER
   ========================================================= */

/* =========================================================
   MAPA DE MÓDULOS
   ========================================================= */
const MODULOS = {
    /* Sistema existente */
    clientes:  () => window.api.abrirClientes(),
    roles:     () => window.api.abrirRoles(),
    lugares:   () => window.api.abrirLugares(),
    rangos:    () => window.api.abrirRangos(),
    equipos:   () => window.api.abrirEquipos(),
    plano:     () => window.api.abrirPlano(),
    usuarios:  () => window.api.abrirUsuarios(),
    dominios:  () => window.api.abrirDominios(),
    configred: () => window.api.abrirConfigRed(),
    historico: () => window.api.abrirHistorico(),

    /* Módulo Activo Fijo (aislado) */
    activofijo_catalogos: () => window.api.abrirActivoFijoCatalogos(),
    activofijo_activos:   () => window.api.abrirActivoFijoActivos(),
    activofijo_responsivas: () => window.api.abrirActivoFijoResponsivas(),
    activofijo_reportes: () => window.api.abrirActivoFijoReportes(),
    activofijo_importar: () => window.api.abrirActivoFijoImportar(),

};

document.querySelectorAll('.modulo-card').forEach(btn => {
    btn.addEventListener('click', () => {
        const key = btn.dataset.modulo;
        const fn = MODULOS[key];
        if (typeof fn === 'function') {
            fn();
        } else {
            console.warn(`Módulo desconocido: ${key}`);
        }
    });
});

/* =========================================================
   CERRAR SESIÓN
   ========================================================= */
document.getElementById('btn-salir').addEventListener('click', async () => {
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
   INICIO: usuario actual + fecha
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
            if (roleEl)   roleEl.textContent   = (u.Rol ?? u.TipoUsuario ?? 'Usuario').toString();

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
})();