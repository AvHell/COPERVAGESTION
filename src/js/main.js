const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PDFDocument } = require('pdf-lib');
const { autoUpdater } = require('electron-updater');

/* =========================================================
   BASE DE DATOS — MÓDULOS EXISTENTES
   ========================================================= */
const clientesDB   = require('./db/clientes');
const rolesDB      = require('./db/roles');
const pisosDB      = require('./db/pisos');
const rangosDB     = require('./db/rangos');
const equiposDB    = require('./db/equipos');
const planoDB      = require('./db/plano');
const usuariosDB   = require('./db/usuarios');
const historicosDB = require('./db/historicos');
const dominiosDB   = require('./db/dominios');
const configDB     = require('./db/configuraciones');
const permisosDB   = require('./db/permisos');

/* =========================================================
   BASE DE DATOS — MÓDULO ACTIVO FIJO
   ========================================================= */
const activoFijoCatalogosDB   = require('../ActivoFijo/consultas/catalogos');
const activoFijoActivosDB     = require('../ActivoFijo/consultas/activos');
const activoFijoResponsivasDB = require('../ActivoFijo/consultas/responsivas');
const activoFijoReportesDB    = require('../ActivoFijo/consultas/reportes');
const activoFijoImportacionDB = require('../ActivoFijo/consultas/importacion');

/* =========================================================
   RUTAS
   ========================================================= */
const ventanas   = {};
const HTML       = path.join(__dirname, '../html');
const HTML_AF    = path.join(__dirname, '..', 'ActivoFijo', 'html');
const PRELOAD    = path.join(__dirname, 'preload.js');
const PRELOAD_AF = path.join(__dirname, '..', 'ActivoFijo', 'preload-activofijo.js');

const PLANTILLA_PDF = path.join(__dirname, '..', '..', 'Formatos', 'ResponsivaCelulares.pdf');

/* =========================================================
   ICONO DE LA APLICACIÓN
   ---------------------------------------------------------
   En desarrollo: src/img/logo.ico (relativo a src/js/main.js)
   En producción: process.resourcesPath/logo.ico (vía extraResources)
   ========================================================= */
const ICONO_APP = app.isPackaged
    ? path.join(process.resourcesPath, 'logo.ico')
    : path.join(__dirname, '..', 'img', 'logo.ico');

console.log('===========================================');
console.log('Ruta plantilla PDF:');
console.log(PLANTILLA_PDF);
console.log('¿Existe?', fs.existsSync(PLANTILLA_PDF));
console.log('-------------------------------------------');
console.log('Ruta ícono:');
console.log(ICONO_APP);
console.log('¿Existe?', fs.existsSync(ICONO_APP));
console.log('===========================================');

/* =========================================================
   APP USER MODEL ID (Windows — barra de tareas)
   ========================================================= */
if (process.platform === 'win32') {
    app.setAppUserModelId('com.coperva.proyectoequipos.v2'); 
}

/* =========================================================
   ESTADO GLOBAL
   ========================================================= */
let usuarioActual       = null;
let cerrandoPorLogout   = false;   // bandera para no matar la app durante transiciones
let motivoLoginPendiente = null;   // 'logout' | 'expirada' | null

/* =========================================================
   OPCIONES DE ARRANQUE
   ========================================================= */
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

/* =========================================================
   AUTO-UPDATER — CONFIGURACIÓN
   ========================================================= */
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

try {
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'info';
} catch (_) {
    autoUpdater.logger = console;
}

/* ---------------------------------------------------------
   Funciones auxiliares para mostrar diálogos
   --------------------------------------------------------- */
async function preguntarDescargar(info) {
    const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Actualización disponible',
        message: `Hay una nueva versión disponible (${info.version}).`,
        detail: '¿Deseas descargarla ahora? La aplicación seguirá funcionando normalmente mientras se descarga.',
        buttons: ['Sí, descargar', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
    });
    return response === 0;
}

async function preguntarInstalar(info) {
    const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: `La versión ${info.version} se ha descargado correctamente.`,
        detail: 'La aplicación se reiniciará para aplicar la actualización. ¿Deseas reiniciar ahora?',
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
    });
    return response === 0;
}

/* ---------------------------------------------------------
   Eventos del autoUpdater
   --------------------------------------------------------- */
autoUpdater.on('checking-for-update', () => console.log('[Updater] Buscando actualizaciones...'));

autoUpdater.on('update-available', async (info) => {
    console.log('[Updater] Actualización disponible:', info.version);
    const quiere = await preguntarDescargar(info);
    if (quiere) autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] No hay actualizaciones disponibles.', info?.version || '');
});

autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    console.log(`[Updater] Descargando: ${pct}% (${progress.bytesPerSecond} B/s)`);
});

autoUpdater.on('update-downloaded', async (info) => {
    console.log('[Updater] Actualización descargada:', info.version);
    const reiniciar = await preguntarInstalar(info);
    if (reiniciar) setImmediate(() => autoUpdater.quitAndInstall());
});

autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err);
    dialog.showErrorBox(
        'Error de actualización',
        'No se pudo comprobar o descargar la actualización.\n\n' + (err?.message || err)
    );
});

function verificarActualizaciones(manual = false) {
    if (!app.isPackaged) {
        if (manual) {
            dialog.showMessageBox({
                type: 'info',
                title: 'Modo desarrollo',
                message: 'Las actualizaciones automáticas solo funcionan en la versión empaquetada (instalada).'
            });
        }
        return;
    }
    autoUpdater.checkForUpdates().catch(err => {
        console.error('[Updater] Error al verificar:', err);
        if (manual) dialog.showErrorBox('Error', 'No se pudo verificar si hay actualizaciones.');
    });
}

/* =========================================================
   MENÚ DE LA APLICACIÓN
   ========================================================= */
function construirMenuApp() {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                { label: 'Recargar', accelerator: 'F5', click: (_i, w) => { if (w) w.reload(); } },
                { label: 'Forzar recarga', accelerator: 'Ctrl+Shift+R', click: (_i, w) => { if (w) w.webContents.reloadIgnoringCache(); } },
                { type: 'separator' },
                { label: 'Salir', accelerator: 'Alt+F4', click: () => app.quit() }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { role: 'undo', label: 'Deshacer' },
                { role: 'redo', label: 'Rehacer' },
                { type: 'separator' },
                { role: 'cut', label: 'Cortar' },
                { role: 'copy', label: 'Copiar' },
                { role: 'paste', label: 'Pegar' },
                { role: 'selectAll', label: 'Seleccionar todo' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { role: 'resetZoom', label: 'Zoom normal' },
                { role: 'zoomIn', label: 'Acercar' },
                { role: 'zoomOut', label: 'Alejar' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Pantalla completa' },
                { type: 'separator' },
                { label: 'Herramientas de desarrollo', accelerator: 'Ctrl+Shift+I', click: (_i, w) => { if (w) w.webContents.toggleDevTools(); } }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { role: 'minimize', label: 'Minimizar' },
                { role: 'close', label: 'Cerrar' }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                { label: 'Buscar actualizaciones', click: () => verificarActualizaciones(true) },
                { type: 'separator' },
                {
                    label: 'Acerca de',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Acerca de',
                            message: 'Inventario de Equipos',
                            detail: `Sistema interno de gestión de red · v${app.getVersion()}`
                        });
                    }
                }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* =========================================================
   HELPERS DE SESIÓN
   ========================================================= */
function haySesion() {
    return !!usuarioActual;
}

/**
 * Envía un mensaje a TODAS las ventanas para avisar que la sesión terminó.
 */
function notificarSesionCerrada(motivo = 'sesion-cerrada') {
    for (const nombre in ventanas) {
        const w = ventanas[nombre];
        if (w && !w.isDestroyed()) {
            w.webContents.send('sesion:cerrada', { motivo });
        }
    }
}

/**
 * Cierra TODAS las ventanas y abre el login.
 * Primero asegura el login para no quedar sin ventanas (evita window-all-closed → app.quit()).
 */
function volverAlLogin(motivo = null) {
    motivoLoginPendiente = motivo;
    cerrandoPorLogout = true;

    // 1) Crear/asegurar el login PRIMERO (así nunca hay 0 ventanas)
    if (!ventanas['login'] || ventanas['login'].isDestroyed()) {
        crearLoginWindow();
    } else {
        const w = ventanas['login'];
        if (w.isMinimized()) w.restore();
        if (!w.isVisible()) w.show();
        w.focus();

        // Si ya estaba abierto, avisarle del motivo
        if (motivoLoginPendiente) {
            w.webContents.send('login:motivo', motivoLoginPendiente);
            motivoLoginPendiente = null;
        }
    }

    // 2) Cerrar el resto de ventanas (excepto login)
    for (const nombre in ventanas) {
        if (nombre === 'login') continue;
        const w = ventanas[nombre];
        if (w && !w.isDestroyed()) w.close();
    }

    // 3) Liberar la bandera cuando ya hay login vivo
    setTimeout(() => {
        cerrandoPorLogout = false;
        console.log('[Sesión] Login restaurado. Ventanas activas:',
            Object.keys(ventanas).filter(k => ventanas[k] && !ventanas[k].isDestroyed()));
    }, 300);
}

/**
 * Cierra la ventana actual y reabre el menú si hay sesión, o el login si no.
 */
function volverAlMenu(winActual) {
    if (winActual && !winActual.isDestroyed()) winActual.close();

    if (!haySesion()) {
        volverAlLogin('expirada');
        return;
    }

    setTimeout(() => {
        if (!ventanas['menu'] || ventanas['menu'].isDestroyed()) {
            crearMenuWindow();
        } else {
            const w = ventanas['menu'];
            if (w.isMinimized()) w.restore();
            if (!w.isVisible()) w.show();
            w.focus();
        }
    }, 100);
}

/**
 * Gate maestro: valida que haya sesión y que el usuario tenga permiso.
 * Devuelve null si todo OK, o un objeto de error si no.
 */
function requerirSesion(modulo = null) {
    if (!haySesion()) {
        return { ok: false, mensaje: 'Tu sesión ha expirado. Inicia sesión nuevamente.', sinSesion: true };
    }
    if (modulo && !tienePermiso(modulo)) {
        return negarAcceso(modulo);
    }
    return null;
}

/* =========================================================
   FÁBRICA DE VENTANAS (robusta)
   ========================================================= */
function crearVentana(nombre, archivo, opciones = {}) {
    const existente = ventanas[nombre];

    if (existente && !existente.isDestroyed()) {
        if (existente.isMinimized()) existente.restore();
        if (!existente.isVisible())  existente.show();
        existente.focus();
        return existente;
    }

    const basePath    = opciones.basePath || HTML;
    const preloadPath = opciones.preload  || PRELOAD;

    const win = new BrowserWindow({
        width:     opciones.width     || 1200,
        height:    opciones.height    || 800,
        minWidth:  opciones.minWidth  || 900,
        minHeight: opciones.minHeight || 600,
        title:     opciones.title     || nombre,
        icon:      ICONO_APP,
        show:      false,
        resizable: opciones.resizable !== false,
        autoHideMenuBar: false,
        backgroundColor: '#f4f6f9',
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.setMenuBarVisibility(true);
    win.loadFile(path.join(basePath, archivo));

    if (opciones.maximizar !== false) {
        win.once('ready-to-show', () => { win.maximize(); win.show(); win.focus(); });
    } else {
        win.once('ready-to-show', () => { win.show(); win.focus(); });
    }

    win.webContents.on('did-finish-load', () => {
        if (!win.isDestroyed() && win.isVisible()) win.focus();
    });

    win.on('closed', () => { ventanas[nombre] = null; });

    ventanas[nombre] = win;
    console.log(`[Ventanas] Creada ventana "${nombre}"`);
    return win;
}

/* =========================================================
   VENTANAS — SISTEMA EXISTENTE
   ========================================================= */
const crearLoginWindow     = () => crearVentana('login',     'login.html',     { title: 'Iniciar Sesión', maximizar: false });
const crearMenuWindow      = () => crearVentana('menu',      'menu.html',      { title: 'Menú Principal' });
const crearCatalogosWindow = () => crearVentana('catalogos', 'catalogos.html', { title: 'Catálogos del Sistema' });
const crearEquiposWindow   = () => crearVentana('equipos',   'equipos.html',   { title: 'Equipos' });
const crearPlanoWindow     = () => crearVentana('plano',     'plano.html',     { title: 'Plano Visual' });
const crearUsuariosWindow  = () => crearVentana('usuarios',  'usuarios.html',  { title: 'Usuarios' });
const crearHistoricoWindow = () => crearVentana('historico', 'historico.html', { title: 'Histórico del Plano' });

/* =========================================================
   VENTANAS — MÓDULO ACTIVO FIJO
   ========================================================= */
const crearActivoFijoCatalogosWindow = () => crearVentana(
    'activofijo-catalogos', 'catalogos.html',
    { title: 'Catálogos - Activo Fijo', basePath: HTML_AF, preload: PRELOAD_AF }
);
const crearActivoFijoActivosWindow = () => crearVentana(
    'activofijo-activos', 'activos.html',
    { title: 'Inventario - Activo Fijo', basePath: HTML_AF, preload: PRELOAD_AF }
);
const crearActivoFijoResponsivasWindow = () => crearVentana(
    'activofijo-responsivas', 'responsivas.html',
    { title: 'Responsivas - Activo Fijo', basePath: HTML_AF, preload: PRELOAD_AF }
);
const crearActivoFijoReportesWindow = () => crearVentana(
    'activofijo-reportes', 'reportes.html',
    { title: 'Reportes - Activo Fijo', basePath: HTML_AF, preload: PRELOAD_AF }
);
const crearActivoFijoImportarWindow = () => crearVentana(
    'activofijo-importar', 'importar.html',
    { title: 'Importar Masivo - Activo Fijo', basePath: HTML_AF, preload: PRELOAD_AF }
);

/* =========================================================
   UTILIDADES
   ========================================================= */
function cerrarVentana(nombre) {
    const w = ventanas[nombre];
    if (w && !w.isDestroyed()) w.close();
}

function asegurarMenuAbierto() {
    if (!ventanas['menu'] || ventanas['menu'].isDestroyed()) {
        crearMenuWindow();
    } else {
        const w = ventanas['menu'];
        if (w.isMinimized()) w.restore();
        if (!w.isVisible()) w.show();
        w.focus();
    }
}

/* =========================================================
   GATE DE PERMISOS
   ========================================================= */
function tienePermiso(modulo) {
    if (!usuarioActual) return false;
    if (usuarioActual.Rol === 'ADMIN') return true;
    return !!usuarioActual.Permisos?.[modulo];
}

function negarAcceso(modulo) {
    console.warn(`[Permisos] Acceso denegado a "${modulo}" para usuario ${usuarioActual?.NombreUsuario || '?'}`);
    return {
        ok: false,
        mensaje: `No tienes permisos para acceder al módulo "${modulo}".`
    };
}

/* =========================================================
   IPC: SESIÓN
   ========================================================= */
ipcMain.handle('login', async (_e, nombreUsuario, password) => {
    const res = await usuariosDB.login(nombreUsuario, password);

    if (res.ok) {
        usuarioActual = res.usuario;

        try {
            const rol = await permisosDB.obtenerRolDeUsuario(usuarioActual.IdUsuario);
            const permisos = await permisosDB.obtenerPermisosDeUsuario(usuarioActual.IdUsuario);

            usuarioActual.Rol        = rol ? rol.Codigo : 'SIN_ROL';
            usuarioActual.RolNombre  = rol ? rol.Nombre : 'Sin rol asignado';
            usuarioActual.Permisos   = permisos;

            console.log(`[Login] ${usuarioActual.NombreUsuario} → Rol: ${usuarioActual.Rol}, Permisos: ${Object.keys(permisos).length}`);
        } catch (err) {
            console.error('Error cargando permisos:', err);
            usuarioActual.Rol       = 'SIN_ROL';
            usuarioActual.RolNombre = 'Sin rol asignado';
            usuarioActual.Permisos  = {};
        }
    }

    return res;
});

ipcMain.handle('sesion:hay', () => haySesion());

/**
 * Motivo con el que se llegó al login (para que el renderer muestre SweetAlert).
 * Se consume una vez y se resetea.
 */
ipcMain.handle('login:motivo-consumir', () => {
    const m = motivoLoginPendiente;
    motivoLoginPendiente = null;
    return m;
});

/**
 * Logout: cierra todo y vuelve al login SIN diálogo nativo.
 * La confirmación la maneja el renderer con SweetAlert2.
 */
ipcMain.handle('logout', async () => {
    console.log('[Sesión] Logout solicitado. Usuario previo:', usuarioActual?.NombreUsuario || '—');

    usuarioActual = null;

    // Avisar a todas las ventanas (por si alguna quiere reaccionar)
    notificarSesionCerrada('logout-manual');

    // Cerrar TODO y abrir login (sin matar la app)
    volverAlLogin('logout');

    return { ok: true };
});

ipcMain.handle('usuario-actual', () => usuarioActual);

/* =========================================================
   IPC: PERMISOS
   ========================================================= */
ipcMain.handle('permisos:mios', () => {
    if (!usuarioActual) return {};
    return usuarioActual.Permisos || {};
});

ipcMain.handle('permisos:mi-rol', () => {
    if (!usuarioActual) return null;
    return {
        codigo: usuarioActual.Rol,
        nombre: usuarioActual.RolNombre
    };
});

ipcMain.handle('permisos:listar-roles', async () => {
    const err = requerirSesion('usuarios'); if (err) return err;
    return await permisosDB.listarRoles();
});

ipcMain.handle('permisos:listar-todos', async () => {
    const err = requerirSesion('usuarios'); if (err) return err;
    return await permisosDB.listarPermisos();
});

ipcMain.handle('permisos:actualizar', async (_e, idRol, modulo, permitido) => {
    const err = requerirSesion('usuarios'); if (err) return err;
    return await permisosDB.actualizarPermiso(idRol, modulo, permitido);
});

ipcMain.handle('permisos:asignar-rol', async (_e, idUsuario, idRol) => {
    const err = requerirSesion('usuarios'); if (err) return err;
    return await permisosDB.asignarRolAUsuario(idUsuario, idRol);
});

ipcMain.handle('permisos:crear-rol', async (_e, datos) => {
    const err = requerirSesion('usuarios'); if (err) return err;
    return await permisosDB.crearRol(datos);
});

ipcMain.handle('permisos:actualizar-rol', async (_e, idRol, datos) => {
    const err = requerirSesion('usuarios'); if (err) return err;
    return await permisosDB.actualizarRol(idRol, datos);
});

ipcMain.handle('permisos:cambiar-estado-rol', async (_e, idRol, activo) => {
    const err = requerirSesion('usuarios'); if (err) return err;
    return await permisosDB.cambiarEstadoRol(idRol, activo);
});

ipcMain.handle('permisos:eliminar-rol', async (_e, idRol) => {
    const err = requerirSesion('usuarios'); if (err) return err;
    return await permisosDB.eliminarRol(idRol);
});

/* =========================================================
   IPC: ABRIR VENTANAS DEL SISTEMA (con gate de sesión + permiso)
   ========================================================= */
ipcMain.handle('abrir-menu', async (e) => {
    if (!haySesion()) {
        volverAlLogin('expirada');
        return { ok: true };
    }

    // Crear menú ANTES de cerrar login (así nunca hay 0 ventanas)
    asegurarMenuAbierto();

    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isDestroyed()) {
        const esLogin = ventanas['login'] && ventanas['login'].id === win.id;
        if (esLogin) {
            cerrandoPorLogout = true;
            win.close();
            setTimeout(() => { cerrandoPorLogout = false; }, 200);
        } else {
            win.close();
        }
    }

    return { ok: true };
});

ipcMain.handle('abrir-catalogos', () => {
    const err = requerirSesion('catalogos'); if (err) return err;
    crearCatalogosWindow();
    return { ok: true };
});

ipcMain.handle('abrir-equipos', () => {
    const err = requerirSesion('equipos'); if (err) return err;
    crearEquiposWindow();
    return { ok: true };
});

ipcMain.handle('abrir-plano', () => {
    const err = requerirSesion('plano'); if (err) return err;
    crearPlanoWindow();
    return { ok: true };
});

ipcMain.handle('abrir-usuarios', () => {
    const err = requerirSesion('usuarios'); if (err) return err;
    crearUsuariosWindow();
    return { ok: true };
});

ipcMain.handle('abrir-historico', () => {
    const err = requerirSesion('historico'); if (err) return err;
    crearHistoricoWindow();
    return { ok: true };
});

ipcMain.handle('volver-menu', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    volverAlMenu(win);
    return { ok: true };
});

ipcMain.handle('ventana:cerrar-actual', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isDestroyed()) win.close();
    return { ok: true };
});

/* =========================================================
   IPC: ABRIR VENTANAS DE ACTIVO FIJO (con gate)
   ========================================================= */
ipcMain.handle('abrir-activofijo-catalogos', () => {
    const err = requerirSesion('activofijo_catalogos'); if (err) return err;
    crearActivoFijoCatalogosWindow();
    return { ok: true };
});

ipcMain.handle('abrir-activofijo-activos', () => {
    const err = requerirSesion('activofijo_activos'); if (err) return err;
    crearActivoFijoActivosWindow();
    return { ok: true };
});

ipcMain.handle('abrir-activofijo-responsivas', () => {
    const err = requerirSesion('activofijo_responsivas'); if (err) return err;
    crearActivoFijoResponsivasWindow();
    return { ok: true };
});

ipcMain.handle('abrir-activofijo-reportes', () => {
    const err = requerirSesion('activofijo_reportes'); if (err) return err;
    crearActivoFijoReportesWindow();
    return { ok: true };
});

ipcMain.handle('abrir-activofijo-importar', () => {
    const err = requerirSesion('activofijo_importar'); if (err) return err;
    crearActivoFijoImportarWindow();
    return { ok: true };
});

/* =========================================================
   IPC: CATÁLOGOS DE ACTIVO FIJO
   ========================================================= */
ipcMain.handle('af-catalogos-listar',     async (_e, clave, filtros)   => { const err = requerirSesion('activofijo_catalogos'); if (err) return err; return await activoFijoCatalogosDB.listar(clave, filtros || {}); });
ipcMain.handle('af-catalogos-crear',      async (_e, clave, datos)     => { const err = requerirSesion('activofijo_catalogos'); if (err) return err; return await activoFijoCatalogosDB.crear(clave, datos); });
ipcMain.handle('af-catalogos-actualizar', async (_e, clave, id, datos) => { const err = requerirSesion('activofijo_catalogos'); if (err) return err; return await activoFijoCatalogosDB.actualizar(clave, id, datos); });
ipcMain.handle('af-catalogos-eliminar',   async (_e, clave, id)        => { const err = requerirSesion('activofijo_catalogos'); if (err) return err; return await activoFijoCatalogosDB.eliminar(clave, id); });
ipcMain.handle('af-catalogos-restaurar',  async (_e, clave, id)        => { const err = requerirSesion('activofijo_catalogos'); if (err) return err; return await activoFijoCatalogosDB.restaurar(clave, id); });

/* =========================================================
   IPC: ACTIVOS
   ========================================================= */
ipcMain.handle('af-activos-listar',     async (_e, filtros)  => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listar(filtros || {}); });
ipcMain.handle('af-activos-obtener',    async (_e, id)       => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.obtener(id); });
ipcMain.handle('af-activos-crear',      async (_e, datos)    => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.crear(datos, usuarioActual?.IdUsuario); });
ipcMain.handle('af-activos-actualizar', async (_e, id, datos)=> { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.actualizar(id, datos, usuarioActual?.IdUsuario); });
ipcMain.handle('af-activos-eliminar',   async (_e, id, motivo) => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.eliminar(id, usuarioActual?.IdUsuario, motivo || null); });
ipcMain.handle('af-activos-restaurar',  async (_e, id, motivo) => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.restaurar(id, usuarioActual?.IdUsuario, motivo || null); });
ipcMain.handle('af-activos-historico',  async (_e, id)         => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.historico(id); });

ipcMain.handle('af-activos-lista-tipos',    async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarTipos(); });
ipcMain.handle('af-activos-lista-marcas',   async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarMarcas(); });
ipcMain.handle('af-activos-lista-estados',  async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarEstados(); });
ipcMain.handle('af-activos-lista-estatus',  async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarEstatus(); });
ipcMain.handle('af-activos-lista-carteras', async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarCarteras(); });

ipcMain.handle('af-activos-lista-sitios',          async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarSitios(); });
ipcMain.handle('af-activos-lista-subtipos',        async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarSubtipos(); });
ipcMain.handle('af-activos-lista-voltajes',        async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarVoltajes(); });
ipcMain.handle('af-activos-lista-clasificaciones', async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarClasificaciones(); });
ipcMain.handle('af-activos-lista-tamanios',        async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarTamanios(); });
ipcMain.handle('af-activos-lista-capacidades',     async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarCapacidades(); });

/* =========================================================
   IPC: RESPONSIVAS
   ========================================================= */
ipcMain.handle('af-resp-listar',              async (_e, filtros)    => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.listar(filtros || {}); });
ipcMain.handle('af-resp-obtener',             async (_e, id)         => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.obtener(id); });
ipcMain.handle('af-resp-activos-disponibles', async ()               => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.activosDisponibles(); });
ipcMain.handle('af-resp-crear',               async (_e, datos)      => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.crear(datos, usuarioActual?.IdUsuario); });
ipcMain.handle('af-resp-actualizar',          async (_e, id, datos)  => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.actualizar(id, datos, usuarioActual?.IdUsuario); });
ipcMain.handle('af-resp-devolver',            async (_e, id, f, obs) => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.devolver(id, f, obs, usuarioActual?.IdUsuario); });
ipcMain.handle('af-resp-eliminar',            async (_e, id, motivo) => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.eliminar(id, usuarioActual?.IdUsuario, motivo || null); });
ipcMain.handle('af-resp-lista-carteras',      async ()               => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.listarCarteras(); });
ipcMain.handle('af-resp-lista-puestos',       async ()               => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.listarPuestos(); });

/* =========================================================
   IPC: REPORTES
   ========================================================= */
ipcMain.handle('af-rep-resumen-general',       async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.resumenGeneral(); });
ipcMain.handle('af-rep-resumen-tipo',          async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.resumenPorTipo(); });
ipcMain.handle('af-rep-resumen-cartera',       async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.resumenPorCartera(); });
ipcMain.handle('af-rep-inventario',            async (_e, filtros)    => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.inventario(filtros || {}); });
ipcMain.handle('af-rep-responsivas-activas',   async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.responsivasActivas(); });
ipcMain.handle('af-rep-asignaciones-persona',  async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.asignacionesPorPersona(); });
ipcMain.handle('af-rep-por-ticket',            async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.porTicket(); });
ipcMain.handle('af-rep-historial-asignaciones',async (_e, filtros)    => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.historialAsignaciones(filtros || {}); });
ipcMain.handle('af-rep-historial-activo',      async (_e, id)         => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.historialActivo(id); });
ipcMain.handle('af-rep-celulares',             async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.celulares(); });
ipcMain.handle('af-rep-laptops',               async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.laptops(); });

ipcMain.handle('af-rep-tipos',                 async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.tiposParaFiltro(); });
ipcMain.handle('af-rep-estados',               async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.estadosParaFiltro(); });
ipcMain.handle('af-rep-estatus',               async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.estatusParaFiltro(); });
ipcMain.handle('af-rep-carteras',              async ()               => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.carterasParaFiltro(); });

/* =========================================================
   IPC: IMPORTACIÓN MASIVA
   ========================================================= */
ipcMain.handle('af-import-layouts',  async () => { const err = requerirSesion('activofijo_importar'); if (err) return err; return activoFijoImportacionDB.listarLayouts(); });
ipcMain.handle('af-import-layout',   async (_e, clave) => { const err = requerirSesion('activofijo_importar'); if (err) return err; return activoFijoImportacionDB.obtenerLayout(clave); });
ipcMain.handle('af-import-procesar', async (_e, datos) => { const err = requerirSesion('activofijo_importar'); if (err) return err; return await activoFijoImportacionDB.importar(datos, usuarioActual?.IdUsuario); });

/* =========================================================
   IPC: GENERAR PDF DE RESPONSIVA (pdf-lib)
   ========================================================= */
ipcMain.handle('af-resp-generar-pdf', async (_e, idResponsiva) => {
    const err = requerirSesion('activofijo_responsivas'); if (err) return err;

    const d = await activoFijoResponsivasDB.obtenerParaPDF(idResponsiva);
    if (!d) return { ok: false, mensaje: 'Responsiva no encontrada.' };

    if (!fs.existsSync(PLANTILLA_PDF)) {
        return {
            ok: false,
            mensaje: `No se encontró la plantilla en:\n${PLANTILLA_PDF}\n\nVerifica que exista la carpeta "Formatos" en la raíz del proyecto con el archivo "ResponsivaCelulares.pdf".`
        };
    }

    const nombreArchivo = `Responsiva-${(d.FolioTicket || 'sin-folio').replace(/[\/\\:*?"<>|]/g, '_')}.pdf`;
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar PDF de responsiva',
        defaultPath: nombreArchivo,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

    try {
        const fmtFecha = (f) => {
            if (!f) return 'N/A';
            const fecha = new Date(f);
            if (isNaN(fecha.getTime())) return 'N/A';
            const dia = String(fecha.getDate()).padStart(2, '0');
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            return `${dia}/${mes}/${fecha.getFullYear()}`;
        };
        const fmtPrecio = (v) => {
            if (v == null || v === '') return '';
            return '$' + Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        };

        const plantillaBytes = fs.readFileSync(PLANTILLA_PDF);
        const pdf  = await PDFDocument.load(plantillaBytes);
        const form = pdf.getForm();

        const FUENTE = 6;

        const setCampo = (nombre, valor, tamaño = null) => {
            try {
                const campo = form.getTextField(nombre);
                if (!campo) { console.warn(`[PDF] ✗ Campo no encontrado: ${nombre}`); return; }
                const sizeFinal = tamaño ?? FUENTE;
                campo.setText(String(valor ?? ''));
                campo.setFontSize(sizeFinal);
                console.log(`[PDF] ✓ ${nombre} = "${valor}" (${sizeFinal}pt)`);
            } catch (err) {
                console.warn(`[PDF] ✗ Error en campo ${nombre}: ${err.message}`);
            }
        };

        setCampo('ticket',                d.FolioTicket);
        setCampo('nombreproyecto',        d.NombreProyecto);
        setCampo('descripcion_solicitud', d.DescripcionSolicitud);
        setCampo('observaciones',         d.Observaciones);
        setCampo('fecha_asignacion',      fmtFecha(d.FechaAsignacion));
        setCampo('fecha_devolucion',      fmtFecha(d.FechaDevolucionProgramada));
        setCampo('estatus',               d.EstatusResponsiva);
        setCampo('motivo_salida',         d.MotivoSalida);
        setCampo('tipo_equipo',           d.Tipo);
        setCampo('marca',                 d.Marca);
        setCampo('modelo',                d.Modelo);
        setCampo('no_serie',              d.NoSerie);
        setCampo('precio_activo',         fmtPrecio(d.PrecioActivo));
        setCampo('procesador',            d.Procesador);
        setCampo('memoria_ram',           d.MemoriaRAM);
        setCampo('almacenamiento',        d.Almacenamiento);
        setCampo('accesorios',            d.Accesorios);
        setCampo('imei_uno',              d.IMEI1);
        setCampo('imei_dos',              d.IMEI2);
        setCampo('nombre_recibe',         d.NombreRecibe);
        setCampo('area_recibe',           d.AreaRecibe);
        setCampo('puesto_recibe',         d.PuestoRecibe, 5);
        setCampo('nombre_entrega',        d.NombreEntrega);
        setCampo('puesto_entrega',        d.PuestoEntrega);
        setCampo('area_entrega',          d.AreaEntrega);

        try {
            form.getFields().forEach(campo => {
                try { campo.enableReadOnly(); } catch (_) {}
            });
        } catch (err) { console.warn('[PDF] Error marcando read-only:', err.message); }

        try { form.flatten(); } catch (err) { console.warn('[PDF] Error aplanando formulario:', err.message); }

        const bytesFinales = await pdf.save();
        fs.writeFileSync(filePath, bytesFinales);

        await activoFijoResponsivasDB.actualizarRutaPDF(idResponsiva, filePath, usuarioActual.IdUsuario);

        return { ok: true, mensaje: 'PDF generado correctamente.', ruta: filePath };
    } catch (err) {
        console.error('Error generando PDF:', err);
        return { ok: false, mensaje: 'Error al generar PDF: ' + err.message };
    }
});

/* =========================================================
   IPC: CLIENTES / ROLES / PISOS / RANGOS
   ========================================================= */
ipcMain.handle('clientes:listar',     async () => { const err = requerirSesion('catalogos'); if (err) return err; return await clientesDB.listar(); });
ipcMain.handle('clientes:crear',      async (_e, codigo, nombre) => { const err = requerirSesion('catalogos'); if (err) return err; return await clientesDB.crear(codigo, nombre); });
ipcMain.handle('clientes:actualizar', async (_e, id, codigo, nombre) => { const err = requerirSesion('catalogos'); if (err) return err; return await clientesDB.actualizar(id, codigo, nombre); });
ipcMain.handle('clientes:eliminar',   async (_e, id) => { const err = requerirSesion('catalogos'); if (err) return err; return await clientesDB.eliminar(id); });

ipcMain.handle('roles:listar',     async () => { const err = requerirSesion('catalogos'); if (err) return err; return await rolesDB.listar(); });
ipcMain.handle('roles:crear',      async (_e, codigo, nombre, descripcion) => { const err = requerirSesion('catalogos'); if (err) return err; return await rolesDB.crear(codigo, nombre, descripcion); });
ipcMain.handle('roles:actualizar', async (_e, id, codigo, nombre, descripcion) => { const err = requerirSesion('catalogos'); if (err) return err; return await rolesDB.actualizar(id, codigo, nombre, descripcion); });
ipcMain.handle('roles:eliminar',   async (_e, id) => { const err = requerirSesion('catalogos'); if (err) return err; return await rolesDB.eliminar(id); });

/* =========================================================
   IPC: PISOS
   ========================================================= */
ipcMain.handle('pisos:listar',                async ()                              => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.listar(); });
ipcMain.handle('pisos:obtener',               async (_e, id)                        => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.obtener(id); });
ipcMain.handle('pisos:listarPorCliente',      async (_e, idCliente)                 => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.listarPorCliente(idCliente); });
ipcMain.handle('pisos:clientesDePiso',        async (_e, idPiso)                    => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.clientesDePiso(idPiso); });
ipcMain.handle('pisos:crear',                 async (_e, nombre, filas, cols, ids)  => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.crear(nombre, filas, cols, ids); });
ipcMain.handle('pisos:actualizarConClientes', async (_e, id, nombre, filas, cols, ids) => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.actualizarConClientes(id, nombre, filas, cols, ids); });
ipcMain.handle('pisos:eliminar',              async (_e, id)                        => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.eliminar(id); });

/* =========================================================
   IPC: RANGOS
   ========================================================= */
ipcMain.handle('rangos:listar',     async () => { const err = requerirSesion('catalogos'); if (err) return err; return await rangosDB.listar(); });
ipcMain.handle('rangos:crear',      async (_e, idCliente, idPiso, nombre, ipInicio, ipFin, desc) => { const err = requerirSesion('catalogos'); if (err) return err; return await rangosDB.crear(idCliente, idPiso, nombre, ipInicio, ipFin, desc); });
ipcMain.handle('rangos:actualizar', async (_e, id, idCliente, idPiso, nombre, ipInicio, ipFin, desc) => { const err = requerirSesion('catalogos'); if (err) return err; return await rangosDB.actualizar(id, idCliente, idPiso, nombre, ipInicio, ipFin, desc); });
ipcMain.handle('rangos:eliminar',   async (_e, id) => { const err = requerirSesion('catalogos'); if (err) return err; return await rangosDB.eliminar(id); });

/* =========================================================
   IPC: EQUIPOS
   ========================================================= */
ipcMain.handle('equipos:listar',               async () => { const err = requerirSesion('equipos'); if (err) return err; return await equiposDB.listar(); });
ipcMain.handle('equipos:crear',                async (_e, datos) => { const err = requerirSesion('equipos'); if (err) return err; return await equiposDB.crear(datos); });
ipcMain.handle('equipos:actualizar',           async (_e, id, datos) => { const err = requerirSesion('equipos'); if (err) return err; return await equiposDB.actualizar(id, datos); });
ipcMain.handle('equipos:eliminar',             async (_e, id) => { const err = requerirSesion('equipos'); if (err) return err; return await equiposDB.eliminar(id); });
ipcMain.handle('equipos:verificarIPDuplicada', async (_e, ip, idExcluir) => { const err = requerirSesion('equipos'); if (err) return err; return await equiposDB.verificarIPDuplicada(ip, idExcluir); });

/* =========================================================
   IPC: DOMINIOS
   ========================================================= */
ipcMain.handle('dominios:listarPorCliente', async (_e, idCliente) => { const err = requerirSesion('catalogos'); if (err) return err; return await dominiosDB.listarPorCliente(idCliente); });
ipcMain.handle('dominios:listarTodas',      async (_e, filtros) => { const err = requerirSesion('catalogos'); if (err) return err; return await dominiosDB.listarTodas(filtros); });
ipcMain.handle('dominios:crear',            async (_e, idCliente, u, p, d) => { const err = requerirSesion('catalogos'); if (err) return err; return await dominiosDB.crear(idCliente, u, p, d); });
ipcMain.handle('dominios:actualizar',       async (_e, id, u, p, d) => { const err = requerirSesion('catalogos'); if (err) return err; return await dominiosDB.actualizar(id, u, p, d); });
ipcMain.handle('dominios:eliminar',         async (_e, id) => { const err = requerirSesion('catalogos'); if (err) return err; return await dominiosDB.eliminar(id); });

/* =========================================================
   IPC: CONFIGURACIONES DE RED
   ========================================================= */
ipcMain.handle('config:listarPorClienteTipo', async (_e, idCliente, tipo) => { const err = requerirSesion('catalogos'); if (err) return err; return await configDB.listarPorClienteTipo(idCliente, tipo); });
ipcMain.handle('config:listarTodas',          async (_e, filtros) => { const err = requerirSesion('catalogos'); if (err) return err; return await configDB.listarTodas(filtros); });
ipcMain.handle('config:crear',                async (_e, idCliente, tipo, valor, desc) => { const err = requerirSesion('catalogos'); if (err) return err; return await configDB.crear(idCliente, tipo, valor, desc); });
ipcMain.handle('config:actualizar',           async (_e, id, valor, desc) => { const err = requerirSesion('catalogos'); if (err) return err; return await configDB.actualizar(id, valor, desc); });
ipcMain.handle('config:eliminar',             async (_e, id) => { const err = requerirSesion('catalogos'); if (err) return err; return await configDB.eliminar(id); });

/* =========================================================
   IPC: USUARIOS / HISTÓRICOS
   ========================================================= */
ipcMain.handle('usuarios:listar',     async () => { const err = requerirSesion('usuarios'); if (err) return err; return await usuariosDB.listar(); });
ipcMain.handle('usuarios:crear',      async (_e, datos) => { const err = requerirSesion('usuarios'); if (err) return err; return await usuariosDB.crear(datos); });
ipcMain.handle('usuarios:actualizar', async (_e, id, datos) => { const err = requerirSesion('usuarios'); if (err) return err; return await usuariosDB.actualizar(id, datos); });
ipcMain.handle('usuarios:eliminar',   async (_e, id) => { const err = requerirSesion('usuarios'); if (err) return err; return await usuariosDB.eliminar(id); });

ipcMain.handle('historicos:listarPorPiso', async (_e, idPiso) => { const err = requerirSesion('historico'); if (err) return err; return await historicosDB.listarPorPiso(idPiso); });
ipcMain.handle('historicos:listar',        async (_e, idCliente, idPiso) => { const err = requerirSesion('historico'); if (err) return err; return await historicosDB.listar(idCliente, idPiso); });

/* =========================================================
   IPC: PLANO
   ========================================================= */
ipcMain.handle('plano:dimensiones', async (_e, idPiso) => { const err = requerirSesion('plano'); if (err) return err; return await planoDB.obtenerDimensiones(idPiso); });

ipcMain.handle('plano:actualizarDim', async (_e, idPiso, filas, columnas) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.actualizarDimensiones(usuarioActual.IdUsuario, idPiso, filas, columnas);
});

ipcMain.handle('plano:listarPorLugar', async (_e, idPiso) => { const err = requerirSesion('plano'); if (err) return err; return await planoDB.listarPorLugar(idPiso); });
ipcMain.handle('plano:sinUbicacion',   async (_e, idPiso) => { const err = requerirSesion('plano'); if (err) return err; return await planoDB.equiposSinUbicacion(idPiso); });

ipcMain.handle('plano:asignar', async (_e, idPiso, idEquipo, fila, col) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.asignar(usuarioActual.IdUsuario, idPiso, idEquipo, fila, col);
});

ipcMain.handle('plano:mover', async (_e, idEquipo, fila, col, filaAnt, colAnt, idPiso) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.mover(usuarioActual.IdUsuario, idEquipo, fila, col, filaAnt, colAnt, idPiso);
});

ipcMain.handle('plano:quitar', async (_e, idEquipo, idPiso, hostname) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.quitar(usuarioActual.IdUsuario, idEquipo, idPiso, hostname);
});

ipcMain.handle('plano:intercambiar', async (_e, idA, idB, idPiso, hostA, hostB, filaA, colA, filaB, colB) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.intercambiar(usuarioActual.IdUsuario, idA, idB, idPiso, hostA, hostB, filaA, colA, filaB, colB);
});

ipcMain.handle('plano:listarZonas', async (_e, idPiso) => { const err = requerirSesion('plano'); if (err) return err; return await planoDB.listarZonas(idPiso); });

ipcMain.handle('plano:crearZona', async (_e, idPiso, nombre, color, fi, ff, ci, cf) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.crearZona(usuarioActual.IdUsuario, idPiso, nombre, color, fi, ff, ci, cf);
});

ipcMain.handle('plano:actualizarZona', async (_e, idZona, nombre, color, fi, ff, ci, cf, idPiso) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.actualizarZona(usuarioActual.IdUsuario, idPiso, idZona, nombre, color, fi, ff, ci, cf);
});

ipcMain.handle('plano:eliminarZona', async (_e, idZona, idPiso, nombre) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.eliminarZona(usuarioActual.IdUsuario, idPiso, idZona, nombre);
});

ipcMain.handle('plano:eliminarZonasPorNombre', async (_e, idPiso, nombre, color) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.eliminarZonasPorNombre(usuarioActual.IdUsuario, idPiso, nombre, color);
});

ipcMain.handle('plano:moverEntrePisos', async (_e, idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.moverEntrePisos(
        usuarioActual.IdUsuario, idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos
    );
});

ipcMain.handle('plano:swapEntrePisos', async (_e, datos) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.swapEntrePisos(
        usuarioActual.IdUsuario,
        datos.idEquipoA, datos.idEquipoB,
        datos.idPisoA, datos.filaA, datos.colA,
        datos.idPisoB, datos.filaB, datos.colB,
        datos.hostA, datos.hostB
    );
});

ipcMain.handle('plano:listarZonasLibres', async (_e, idPiso) => { const err = requerirSesion('plano'); if (err) return err; return await planoDB.listarZonasLibres(idPiso); });

ipcMain.handle('plano:guardarZonaLibre', async (_e, idPiso, nombre, color, celdas) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.guardarZonaLibre(usuarioActual.IdUsuario, idPiso, nombre, color, celdas);
});

ipcMain.handle('plano:eliminarZonaLibre', async (_e, idPiso, nombre, color) => {
    const err = requerirSesion('plano'); if (err) return err;
    return await planoDB.eliminarZonaLibre(usuarioActual.IdUsuario, idPiso, nombre, color);
});

/* =========================================================
   IPC: EXPORTAR PDF DEL PLANO
   ========================================================= */
ipcMain.handle('plano:exportarPDF', async (_e, opciones) => {
    const err = requerirSesion('plano'); if (err) return err;

    const winPDF = new BrowserWindow({
        width: 1400, height: 900, show: false,
        icon: ICONO_APP,
        webPreferences: { contextIsolation: true, nodeIntegration: false }
    });

    let tmpPath = null;

    try {
        tmpPath = path.join(os.tmpdir(), `plano-${Date.now()}.html`);
        fs.writeFileSync(tmpPath, opciones.html, 'utf-8');

        await winPDF.loadFile(tmpPath);
        await new Promise(resolve => setTimeout(resolve, 700));

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Guardar PDF',
            defaultPath: opciones.nombreArchivo || `Plano-${Date.now()}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });

        if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

        const datosPDF = await winPDF.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            margins: { marginType: 'none' }
        });

        fs.writeFileSync(filePath, datosPDF);
        return { ok: true, mensaje: 'PDF generado', ruta: filePath };
    } catch (err) {
        throw err;
    } finally {
        if (!winPDF.isDestroyed()) winPDF.destroy();
        if (tmpPath && fs.existsSync(tmpPath)) {
            try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
    }
});

/* =========================================================
   CICLO DE VIDA
   ========================================================= */
app.whenReady().then(() => {
    construirMenuApp();
    crearLoginWindow();

    if (app.isPackaged) {
        setTimeout(() => verificarActualizaciones(false), 3000);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) crearLoginWindow();
    });
});

app.on('window-all-closed', () => {
    // Nunca cerrar la app en medio de una transición de sesión
    if (cerrandoPorLogout) {
        console.log('[App] window-all-closed ignorado (transición de sesión).');
        return;
    }

    if (process.platform !== 'darwin') app.quit();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
            const win = wins[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });
}