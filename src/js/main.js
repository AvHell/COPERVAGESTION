const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
const { autoUpdater } = require('electron-updater');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

/* =========================================================
   BASE DE DATOS — MÓDULOS EXISTENTES
   ========================================================= */
const clientesDB   = require('./db/clientes');
const rolesDB      = require('./db/roles');
const pisosDB      = require('./db/pisos');
const rangosDB     = require('./db/rangos');
const equiposDB    = require('./db/equipos');
const inventarioIPDB = require('./db/inventario-ip');
const inventarioIPImportacion = require('./importacion-inventario-ip');
const planoDB      = require('./db/plano');
const usuariosDB   = require('./db/usuarios');
const historicosDB = require('./db/historicos');
const dominiosDB   = require('./db/dominios');
const configDB     = require('./db/configuraciones');
const permisosDB   = require('./db/permisos');
const mantenimientosDB = require('./db/mantenimientos');
const documentosDB   = require('./db/documentos');
const conexionDB = require('./db/conexion');
const credencialesDB = require('./db/credenciales');

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
const PRELOAD_CONFIG = path.join(__dirname, 'preload-configuracion.js');

const PLANTILLA_PDF = app.isPackaged
  ? path.join(process.resourcesPath, 'Formatos', 'ResponsivaCelulares.pdf')
  : path.join(__dirname, '..', '..', 'Formatos', 'ResponsivaCelulares.pdf');

/* =========================================================
   ICONO
   ========================================================= */
const ICONO_APP = app.isPackaged
    ? path.join(process.resourcesPath, 'logo.ico')
    : path.join(__dirname, '..', 'img', 'logo.ico');

console.log('===========================================');
console.log('Ruta plantilla PDF:', PLANTILLA_PDF, '¿Existe?', fs.existsSync(PLANTILLA_PDF));
console.log('Ruta ícono:', ICONO_APP, '¿Existe?', fs.existsSync(ICONO_APP));
console.log('===========================================');

if (process.platform === 'win32') {
    app.setAppUserModelId('com.coperva.proyectoequipos');
}

/* =========================================================
   ESTADO GLOBAL
   ========================================================= */
let usuarioActual        = null;
let cerrandoPorLogout    = false;
let motivoLoginPendiente = null;
let actualizacionObligatoria = false;
let mostrandoErrorActualizacion = false;

/* =========================================================
   ARRANQUE
   ========================================================= */
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

/* =========================================================
   AUTO-UPDATER
   ========================================================= */
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

try {
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'info';
} catch (_) {
    autoUpdater.logger = console;
}

function bloquearVentanas(bloquear) {
    if (bloquear) Menu.setApplicationMenu(null);
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed() && typeof win.setEnabled === 'function') {
            win.setEnabled(!bloquear);
        }
    }
}

function mostrarDialogoActualizacion(opciones) {
    const ventana = BrowserWindow.getAllWindows().find(win => !win.isDestroyed());
    return ventana
        ? dialog.showMessageBox(ventana, opciones)
        : dialog.showMessageBox(opciones);
}

async function descargarActualizacion() {
    try {
        await autoUpdater.downloadUpdate();
    } catch (error) {
        console.error('[Updater] No se pudo descargar la actualización:', error);
    }
}

async function manejarErrorActualizacion(err) {
    console.error('[Updater] Error:', err);
    if (!actualizacionObligatoria) {
        dialog.showErrorBox(
            'Error de actualización',
            'No se pudo comprobar o descargar la actualización.\n\n' + (err?.message || err)
        );
        return;
    }
    if (mostrandoErrorActualizacion) return;

    mostrandoErrorActualizacion = true;
    try {
        const { response } = await mostrarDialogoActualizacion({
            type: 'error',
            title: 'No se pudo actualizar',
            message: 'La actualización obligatoria no pudo descargarse.',
            detail: `${err?.message || err}\n\nReintenta la descarga o cierra la aplicación. No podrás continuar hasta actualizar.`,
            buttons: ['Reintentar descarga', 'Salir'],
            defaultId: 0,
            cancelId: 1,
            noLink: true
        });
        if (response === 0) {
            void descargarActualizacion();
        } else {
            app.quit();
        }
    } finally {
        mostrandoErrorActualizacion = false;
    }
}

autoUpdater.on('checking-for-update', () => console.log('[Updater] Buscando actualizaciones...'));

autoUpdater.on('update-available', async (info) => {
    if (actualizacionObligatoria) return;
    console.log('[Updater] Actualización disponible:', info.version);
    actualizacionObligatoria = true;
    bloquearVentanas(true);
    const { response } = await mostrarDialogoActualizacion({
        type: 'warning',
        title: 'Actualización obligatoria',
        message: `La versión ${info.version} es obligatoria.`,
        detail: 'Debes instalarla para continuar usando el sistema. La aplicación se bloqueará durante la descarga.',
        buttons: ['Descargar e instalar', 'Salir'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });
    if (response === 0) {
        void descargarActualizacion();
    } else {
        app.quit();
    }
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
    if (!actualizacionObligatoria) return;
    const { response } = await mostrarDialogoActualizacion({
        type: 'info',
        title: 'Actualización lista',
        message: `La versión ${info.version} se descargó correctamente.`,
        detail: 'Reinicia la aplicación para aplicar la actualización.',
        buttons: ['Reiniciar ahora', 'Salir'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall());
    else app.quit();
});

autoUpdater.on('error', manejarErrorActualizacion);

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

function notificarSesionCerrada(motivo = 'sesion-cerrada') {
    for (const nombre in ventanas) {
        const w = ventanas[nombre];
        if (w && !w.isDestroyed()) {
            w.webContents.send('sesion:cerrada', { motivo });
        }
    }
}

function volverAlLogin(motivo = null) {
    motivoLoginPendiente = motivo;
    cerrandoPorLogout = true;

    if (!ventanas['login'] || ventanas['login'].isDestroyed()) {
        crearLoginWindow();
    } else {
        const w = ventanas['login'];
        if (w.isMinimized()) w.restore();
        if (!w.isVisible()) w.show();
        w.focus();

        if (motivoLoginPendiente) {
            w.webContents.send('login:motivo', motivoLoginPendiente);
            motivoLoginPendiente = null;
        }
    }

    for (const nombre in ventanas) {
        if (nombre === 'login') continue;
        const w = ventanas[nombre];
        if (w && !w.isDestroyed()) w.close();
    }

    setTimeout(() => {
        cerrandoPorLogout = false;
        console.log('[Sesión] Login restaurado. Ventanas activas:',
            Object.keys(ventanas).filter(k => ventanas[k] && !ventanas[k].isDestroyed()));
    }, 300);
}

/* =========================================================
   GATE DE PERMISOS
   ========================================================= */
function tienePermiso(clave) {
    if (!usuarioActual) return false;
    if (usuarioActual.Rol === 'ADMIN') return true;
    return !!usuarioActual.Permisos?.[clave];
}

function negarAcceso(clave) {
    console.warn(`[Permisos] Acceso denegado a "${clave}" para usuario ${usuarioActual?.NombreUsuario || '?'}`);
    return {
        ok: false,
        mensaje: `No tienes permiso para: "${clave}".`
    };
}

function requerirSesion(clave = null) {
    if (!haySesion()) {
        return { ok: false, mensaje: 'Tu sesión ha expirado. Inicia sesión nuevamente.', sinSesion: true };
    }
    if (clave && !tienePermiso(clave)) {
        return negarAcceso(clave);
    }
    return null;
}

/**
 * Igual que requerirSesion pero acepta varias claves equivalentes
 * (se usa para no romper permisos heredados de versiones anteriores).
 */
function requerirPermiso(claves, etiqueta = null) {
    const err = requerirSesion();
    if (err) return err;
    const lista = Array.isArray(claves) ? claves : [claves];
    if (lista.some(tienePermiso)) return null;
    return negarAcceso(etiqueta || lista[0]);
}

const RUTAS_MODULOS = {
    catalogos: { basePath: HTML, archivo: 'catalogos.html', permiso: 'catalogos', titulo: 'Catálogos del Sistema' },
    equipos: { basePath: HTML, archivo: 'equipos.html', permiso: 'equipos', titulo: 'Equipos' },
    inventario_ip: { basePath: HTML, archivo: 'inventario-ip.html', permiso: 'equipos', titulo: 'Control general de IP' },
    plano: { basePath: HTML, archivo: 'plano.html', permiso: 'plano', titulo: 'Plano Visual' },
    documentacion: { basePath: HTML, archivo: 'documentacion.html', permiso: 'documentos', titulo: 'Documentación' },
    historico: { basePath: HTML, archivo: 'historico.html', permiso: 'historico', titulo: 'Histórico del Plano' },
    mantenimientos: { basePath: HTML, archivo: 'mantenimientos.html', permiso: 'mantenimientos', titulo: 'Mantenimientos' },
    usuarios: { basePath: HTML, archivo: 'usuarios.html', permiso: 'usuarios', titulo: 'Usuarios' },
    roles: { basePath: HTML, archivo: 'roles.html', permiso: 'catalogos', titulo: 'Roles' },
    /* Los catálogos no tienen módulo propio: son una pestaña de activos.html
       (#catalogos) junto al inventario. */
    activofijo_activos: { basePath: HTML_AF, archivo: 'activos.html', permiso: 'activofijo_activos', titulo: 'Inventario - Activo Fijo' },
    activofijo_responsivas: { basePath: HTML_AF, archivo: 'responsivas.html', permiso: 'activofijo_responsivas', titulo: 'Responsivas - Activo Fijo' },
    activofijo_reportes: { basePath: HTML_AF, archivo: 'reportes.html', permiso: 'activofijo_reportes', titulo: 'Reportes - Activo Fijo' },
    activofijo_importar: { basePath: HTML_AF, archivo: 'importar.html', permiso: 'activofijo_importar', titulo: 'Importar Masivo - Activo Fijo' }
};

async function navegarModuloEnVentana(win, modulo) {
    const ruta = RUTAS_MODULOS[modulo];
    if (!ruta) return { ok: false, mensaje: 'El módulo solicitado no existe.' };
    const err = requerirSesion(ruta.permiso);
    if (err) return err;
    if (!win || win.isDestroyed()) return { ok: false, mensaje: 'La ventana actual ya no está disponible.' };

    win.setTitle(ruta.titulo);
    /* El hash permite abrir una vista concreta de la misma página
       (p. ej. activos.html#catalogos). */
    await win.loadFile(
        path.join(ruta.basePath, ruta.archivo),
        ruta.hash ? { hash: ruta.hash } : undefined
    );
    win.focus();
    return { ok: true };
}

/* =========================================================
   MENÚ CONTEXTUAL (clic derecho)
   Todas las ventanas comparten el mismo menú: acciones de edición
   cuando el clic cae en un campo de texto, copiar cuando hay
   selección, abrir/guardar enlaces externos y recargar la página.
   ========================================================= */
function construirMenuContextual(win, params = {}) {
    const plantilla = [];
    const agregar = item => plantilla.push(item);

    if (params.isEditable) {
        agregar({ label: 'Deshacer', role: 'undo' });
        agregar({ label: 'Rehacer', role: 'redo' });
        agregar({ type: 'separator' });
        agregar({ label: 'Cortar', role: 'cut' });
        agregar({ label: 'Copiar', role: 'copy' });
        agregar({ label: 'Pegar', role: 'paste' });
        agregar({ label: 'Seleccionar todo', role: 'selectAll' });
    } else if (params.selectionText && String(params.selectionText).trim()) {
        agregar({ label: 'Copiar', role: 'copy' });
    }

    if (params.linkURL) {
        if (plantilla.length) agregar({ type: 'separator' });
        agregar({
            label: 'Copiar dirección del enlace',
            click: () => clipboard.writeText(params.linkURL)
        });
        agregar({
            label: 'Abrir enlace en el navegador',
            click: () => { shell.openExternal(params.linkURL).catch(() => {}); }
        });
    }

    if (params.misspelledWord && params.dictionarySuggestions?.length) {
        if (plantilla.length) agregar({ type: 'separator' });
        params.dictionarySuggestions.slice(0, 5).forEach(sugerencia => agregar({
            label: sugerencia,
            click: () => win.webContents.replaceMisspelling(sugerencia)
        }));
    }

    if (plantilla.length) agregar({ type: 'separator' });
    agregar({ label: 'Recargar', click: () => { if (!win.isDestroyed()) win.webContents.reload(); } });
    if (process.env.NODE_ENV === 'development') {
        agregar({
            label: 'Inspeccionar elemento',
            click: () => {
                if (win.isDestroyed()) return;
                const wc = win.webContents;
                if (wc.isDevToolsOpened()) wc.closeDevTools();
                else wc.openDevTools({ mode: 'detach' });
            }
        });
    }

    return Menu.buildFromTemplate(plantilla);
}

function registrarMenuContextual(win) {
    win.webContents.on('context-menu', (_evento, params) => {
        if (!win || win.isDestroyed()) return;
        construirMenuContextual(win, params).popup({ window: win });
    });
}

/* =========================================================
   FÁBRICA DE VENTANAS
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
    if (actualizacionObligatoria && typeof win.setEnabled === 'function') {
        win.setEnabled(false);
    }
    win.loadFile(path.join(basePath, archivo));
    registrarMenuContextual(win);

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
   VENTANAS — SISTEMA
   ========================================================= */
const crearLoginWindow     = () => crearVentana('login',     'login.html',     { title: 'Iniciar Sesión', maximizar: true });

const crearConfiguracionDBWindow = () => crearVentana(
    'configuracion-db',
    'configurar-conexion.html',
    {
        title: 'Configurar conexión segura',
        preload: PRELOAD_CONFIG,
        width: 650,
        height: 900,
        minWidth: 420,
        minHeight: 650,
        maximizar: false
    }
);

/* =========================================================
   UTILIDADES
   ========================================================= */
function cerrarVentana(nombre) {
    const w = ventanas[nombre];
    if (w && !w.isDestroyed()) w.close();
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

            usuarioActual.Rol       = rol ? rol.Codigo : 'SIN_ROL';
            usuarioActual.RolNombre = rol ? rol.Nombre : 'Sin rol asignado';
            usuarioActual.Permisos  = permisos;

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

ipcMain.handle('login:motivo-consumir', () => {
    const m = motivoLoginPendiente;
    motivoLoginPendiente = null;
    return m;
});

ipcMain.handle('logout', async () => {
    console.log('[Sesión] Logout solicitado. Usuario previo:', usuarioActual?.NombreUsuario || '—');
    usuarioActual = null;
    notificarSesionCerrada('logout-manual');
    volverAlLogin('logout');
    return { ok: true };
});

ipcMain.handle('usuario-actual', () => usuarioActual);
ipcMain.handle('app:version', () => app.getVersion());

/** Lee las credenciales guardadas sin lanzar si el archivo no se puede descifrar. */
function leerCredencialesGuardadas() {
    try {
        return credencialesDB.cargar();
    } catch (error) {
        console.warn('[Configuración DB] No se pudieron leer las credenciales guardadas:', error.message);
        return null;
    }
}

/** ¿Los datos del formulario apuntan al mismo servidor/base/usuario que la conexión guardada? */
function mismoDestinoGuardado(guardada, datos) {
    if (!guardada) return false;
    const normalizar = valor => String(valor ?? '').trim().toLowerCase();
    const puertoGuardado = guardada.port ? Number(guardada.port) : 1433;
    const puertoNuevo = datos.port !== undefined && datos.port !== null && datos.port !== ''
        ? Number(datos.port)
        : 1433;
    return normalizar(guardada.server) === normalizar(datos.server) &&
        normalizar(guardada.database) === normalizar(datos.database) &&
        normalizar(guardada.user) === normalizar(datos.user) &&
        puertoGuardado === puertoNuevo;
}

ipcMain.handle('db-config:estado', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win !== ventanas['configuracion-db'] || win.isDestroyed()) {
        return { ok: false, mensaje: 'Consulta no disponible fuera de la ventana de configuración.' };
    }

    const guardada = leerCredencialesGuardadas();
    if (!guardada) return { ok: true, configurada: false };

    // Solo se exponen datos no sensibles; la contraseña nunca cruza al renderer.
    return {
        ok: true,
        configurada: true,
        server: guardada.server,
        port: guardada.port ?? null,
        database: guardada.database,
        user: guardada.user,
        tienePassword: !!guardada.password
    };
});

ipcMain.handle('db-config:guardar', async (event, datos) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win !== ventanas['configuracion-db'] || win.isDestroyed()) {
        return { ok: false, mensaje: 'La configuración solo puede guardarse desde la ventana de instalación.' };
    }

    let pool;
    try {
        const datosFormulario = {
            server: datos?.server,
            port: datos?.port,
            database: datos?.database,
            user: datos?.user,
            password: String(datos?.password ?? '')
        };

        // Contraseña en blanco: se conserva la guardada siempre que el destino
        // (servidor, puerto, base de datos y usuario) sea exactamente el mismo.
        if (!datosFormulario.password) {
            const guardada = leerCredencialesGuardadas();
            if (guardada && mismoDestinoGuardado(guardada, datosFormulario)) {
                datosFormulario.password = guardada.password;
            }
        }

        const configuracion = credencialesDB.validar(datosFormulario, { passwordOpcional: true });
        if (!configuracion.password) {
            return { ok: false, mensaje: 'Escribe la contraseña de SQL Server: no hay una guardada para este servidor, base de datos y usuario.' };
        }

        pool = await new conexionDB.sql.ConnectionPool(
            conexionDB.crearConfig(configuracion)
        ).connect();
        credencialesDB.guardar(configuracion);
        crearLoginWindow();
        win.close();
        return { ok: true };
    } catch (error) {
        console.error('[Configuración DB] No se pudo validar o guardar la conexión:', error.code || error.name);
        if (error.message.startsWith('Completa ') || error.message.startsWith('Uno o más campos') ||
            error.message.startsWith('Escribe la contraseña') || error.message.startsWith('El puerto debe')) {
            return { ok: false, mensaje: error.message };
        }
        if (error.message.includes('cifrado seguro') || error.message.includes('guardar la configuración cifrada')) {
            return { ok: false, mensaje: error.message };
        }
        return {
            ok: false,
            mensaje: `No se pudo conectar o guardar (${error.code || error.name}): ${error.message}`
        };
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (error) {
                console.error('[Configuración DB] No se pudo cerrar el pool de prueba:', error.code || error.name);
            }
        }
    }
});

/* =========================================================
   IPC: REABRIR CONFIGURACIÓN DE BASE DE DATOS
   ========================================================= */
ipcMain.handle('db-config:abrir', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
        return { ok: false, mensaje: 'Ventana no disponible.' };
    }

    // Seguridad: solo permitir abrir el formulario si NO hay sesión activa
    // (evita que un usuario logueado fuerce reconfiguración de la BD).
    if (haySesion()) {
        return {
            ok: false,
            mensaje: 'Cierra sesión antes de reconfigurar la conexión a la base de datos.'
        };
    }

    // Si ya hay una ventana de configuración abierta, solo enfócala
    const existente = ventanas['configuracion-db'];
    if (existente && !existente.isDestroyed()) {
        if (existente.isMinimized()) existente.restore();
        if (!existente.isVisible()) existente.show();
        existente.focus();
        return { ok: true };
    }

    crearConfiguracionDBWindow();

    // Opcional: cierra la ventana desde la que se pidió (normalmente el login)
    // para que no queden dos ventanas abiertas.
    try { win.close(); } catch (_) {}

    return { ok: true };
});

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

ipcMain.handle('permisos:puedo', (_e, clave) => {
    if (!haySesion()) return { ok: false, sinSesion: true, permitido: false };
    return { ok: true, permitido: tienePermiso(clave) };
});

ipcMain.handle('permisos:catalogo', () => {
    try {
        return permisosDB.catalogoPermisos();
    } catch (err) {
        console.error('[Permisos] Error cargando catálogo:', err);
        return [];
    }
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
    const err = requerirSesion('usuarios:asignar-rol'); if (err) return err;
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
   IPC: ABRIR VENTANAS (con gate)
   ========================================================= */
ipcMain.handle('abrir-menu', async (e) => {
    if (!haySesion()) {
        volverAlLogin('expirada');
        return { ok: true };
    }

    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && ventanas['login'] && ventanas['login'].id === win.id) {
        const moduloInicial = tienePermiso('catalogos')
            ? 'catalogos'
            : Object.keys(RUTAS_MODULOS).find(modulo => tienePermiso(RUTAS_MODULOS[modulo].permiso));
        if (!moduloInicial) return negarAcceso('al menos un módulo');
        ventanas['login'] = null;
        ventanas['menu'] = win;
        const resultado = await navegarModuloEnVentana(win, moduloInicial);
        if (resultado?.ok === false) {
            ventanas['menu'] = null;
            ventanas['login'] = win;
        }
        return resultado;
    }

    return navegarModuloEnVentana(win, 'catalogos');
});

ipcMain.handle('navegar-modulo', (e, modulo) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return navegarModuloEnVentana(win, modulo);
});

ipcMain.handle('abrir-catalogos', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'catalogos'));
ipcMain.handle('abrir-equipos', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'equipos'));
ipcMain.handle('abrir-plano', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'plano'));
ipcMain.handle('abrir-documentacion', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'documentacion'));
ipcMain.handle('abrir-usuarios', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'usuarios'));
ipcMain.handle('abrir-historico', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'historico'));
ipcMain.handle('abrir-mantenimientos', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'mantenimientos'));

ipcMain.handle('volver-menu', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!haySesion()) {
        volverAlLogin('expirada');
        return { ok: true };
    }
    return navegarModuloEnVentana(win, 'catalogos');
});

ipcMain.handle('ventana:cerrar-actual', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isDestroyed()) win.close();
    return { ok: true };
});

/* =========================================================
   IPC: ACTIVO FIJO — abrir ventanas
   ========================================================= */

ipcMain.handle('abrir-activofijo-activos', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'activofijo_activos'));
ipcMain.handle('abrir-activofijo-responsivas', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'activofijo_responsivas'));
ipcMain.handle('abrir-activofijo-reportes', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'activofijo_reportes'));
ipcMain.handle('abrir-activofijo-importar', (e) => navegarModuloEnVentana(BrowserWindow.fromWebContents(e.sender), 'activofijo_importar'));

/* =========================================================
   IPC: CATÁLOGOS AF
   ========================================================= */
ipcMain.handle('af-catalogos-listar',     async (_e, clave, filtros)   => { const err = requerirSesion('af-cat:listado:ver'); if (err) return err; return await activoFijoCatalogosDB.listar(clave, filtros || {}); });
ipcMain.handle('af-catalogos-crear',      async (_e, clave, datos)     => { const err = requerirSesion('af-cat:crear');       if (err) return err; return await activoFijoCatalogosDB.crear(clave, datos); });
ipcMain.handle('af-catalogos-actualizar', async (_e, clave, id, datos) => { const err = requerirSesion('af-cat:editar');      if (err) return err; return await activoFijoCatalogosDB.actualizar(clave, id, datos); });
ipcMain.handle('af-catalogos-eliminar',   async (_e, clave, id)        => { const err = requerirSesion('af-cat:eliminar');    if (err) return err; return await activoFijoCatalogosDB.eliminar(clave, id); });
ipcMain.handle('af-catalogos-restaurar',  async (_e, clave, id)        => { const err = requerirSesion('af-cat:restaurar');   if (err) return err; return await activoFijoCatalogosDB.restaurar(clave, id); });
ipcMain.handle('af-catalogos-eliminar-definitivo', async (_e, clave, id) => { const err = requerirSesion('af-cat:eliminar');  if (err) return err; return await activoFijoCatalogosDB.eliminarDefinitivo(clave, id); });

/* =========================================================
   IPC: ACTIVOS AF
   ========================================================= */
ipcMain.handle('af-activos-listar',     async (_e, filtros)   => { const err = requerirSesion('af-act:listado:ver'); if (err) return err; return await activoFijoActivosDB.listar(filtros || {}); });
ipcMain.handle('af-activos-obtener',    async (_e, id)        => { const err = requerirSesion('af-act:listado:ver'); if (err) return err; return await activoFijoActivosDB.obtener(id); });
ipcMain.handle('af-activos-crear',      async (_e, datos)     => { const err = requerirSesion('af-act:crear');       if (err) return err; return await activoFijoActivosDB.crear(datos, usuarioActual?.IdUsuario); });
ipcMain.handle('af-activos-actualizar', async (_e, id, datos) => { const err = requerirSesion('af-act:editar');      if (err) return err; return await activoFijoActivosDB.actualizar(id, datos, usuarioActual?.IdUsuario); });
ipcMain.handle('af-activos-eliminar',   async (_e, id, motivo)=> { const err = requerirSesion('af-act:eliminar');    if (err) return err; return await activoFijoActivosDB.eliminar(id, usuarioActual?.IdUsuario, motivo || null); });
ipcMain.handle('af-activos-restaurar',  async (_e, id, motivo)=> { const err = requerirSesion('af-act:restaurar');   if (err) return err; return await activoFijoActivosDB.restaurar(id, usuarioActual?.IdUsuario, motivo || null); });
/* Purga física: sólo activos en BAJA y sin responsivas (lo valida el módulo). */
ipcMain.handle('af-activos-eliminar-definitivo', async (_e, id) => { const err = requerirSesion('af-act:eliminar'); if (err) return err; return await activoFijoActivosDB.eliminarDefinitivo(id, usuarioActual?.IdUsuario); });
ipcMain.handle('af-activos-historico',  async (_e, id)        => { const err = requerirSesion('af-act:listado:ver'); if (err) return err; return await activoFijoActivosDB.historico(id); });

/* --- NUEVO: Exportar Excel Activos --- */
ipcMain.handle('af-activos-exportar-excel', async (_e, payload) => {
    const err = requerirSesion('af-act:listado:ver');
    if (err) return err;
    try {
        return await activoFijoActivosDB.exportarExcel(payload);
    } catch (e) {
        console.error('[Activos] Error exportarExcel:', e);
        return { ok: false, mensaje: e.message };
    }
});

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
ipcMain.handle('af-activos-lista-catalogos-especificaciones', async () => { const err = requerirSesion('activofijo_activos'); if (err) return err; return await activoFijoActivosDB.listarCatalogosExtendidos(); });

/* =========================================================
   IPC: RESPONSIVAS AF
   ========================================================= */
ipcMain.handle('af-resp-listar',              async (_e, filtros)    => { const err = requerirSesion('af-resp:listado:ver'); if (err) return err; return await activoFijoResponsivasDB.listar(filtros || {}); });
ipcMain.handle('af-resp-obtener',             async (_e, id)         => { const err = requerirSesion('af-resp:listado:ver'); if (err) return err; return await activoFijoResponsivasDB.obtener(id); });
ipcMain.handle('af-resp-activos-disponibles', async ()               => { const err = requerirSesion('af-resp:crear');       if (err) return err; return await activoFijoResponsivasDB.activosDisponibles(); });
ipcMain.handle('af-resp-crear',               async (_e, datos)      => { const err = requerirSesion('af-resp:crear');       if (err) return err; return await activoFijoResponsivasDB.crear(datos, usuarioActual?.IdUsuario); });
ipcMain.handle('af-resp-actualizar',          async (_e, id, datos)  => { const err = requerirSesion('af-resp:editar');      if (err) return err; return await activoFijoResponsivasDB.actualizar(id, datos, usuarioActual?.IdUsuario); });
ipcMain.handle('af-resp-devolver',            async (_e, id, f, obs) => { const err = requerirSesion('af-resp:devolver');    if (err) return err; return await activoFijoResponsivasDB.devolver(id, f, obs, usuarioActual?.IdUsuario); });
ipcMain.handle('af-resp-eliminar',            async (_e, id, motivo) => { const err = requerirSesion('af-resp:eliminar');    if (err) return err; return await activoFijoResponsivasDB.eliminar(id, usuarioActual?.IdUsuario, motivo || null); });
ipcMain.handle('af-resp-eliminar-definitivo', async (_e, id)         => { const err = requerirSesion('af-resp:eliminar');    if (err) return err; return await activoFijoResponsivasDB.eliminarDefinitivo(id, usuarioActual?.IdUsuario); });
ipcMain.handle('af-resp-lista-carteras',      async ()               => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.listarCarteras(); });
ipcMain.handle('af-resp-lista-puestos',       async ()               => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.listarPuestos(); });
ipcMain.handle('af-resp-lista-catalogo',      async (_e, clave)      => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.listarCatalogoResponsiva(clave); });
ipcMain.handle('af-resp-catalogo-crear',      async (_e, clave, datos) => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.crearCatalogoResponsiva(clave, datos); });
ipcMain.handle('af-resp-catalogo-actualizar', async (_e, clave, id, datos) => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.actualizarCatalogoResponsiva(clave, id, datos); });
ipcMain.handle('af-resp-catalogo-eliminar',   async (_e, clave, id) => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.eliminarCatalogoResponsiva(clave, id); });
ipcMain.handle('af-resp-lista-usuarios-entrega', async ()            => { const err = requerirSesion('activofijo_responsivas'); if (err) return err; return await activoFijoResponsivasDB.listarUsuariosEntrega(); });

/* =========================================================
   IPC: REPORTES AF
   ========================================================= */
ipcMain.handle('af-rep-resumen-general',       async ()            => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.resumenGeneral(); });
ipcMain.handle('af-rep-resumen-tipo',          async ()            => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.resumenPorTipo(); });
ipcMain.handle('af-rep-resumen-cartera',       async ()            => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.resumenPorCartera(); });
ipcMain.handle('af-rep-inventario',            async (_e, filtros) => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.inventario(filtros || {}); });
ipcMain.handle('af-rep-responsivas-activas',   async ()            => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.responsivasActivas(); });
ipcMain.handle('af-rep-asignaciones-persona',  async ()            => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.asignacionesPorPersona(); });
ipcMain.handle('af-rep-por-ticket',            async ()            => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.porTicket(); });
ipcMain.handle('af-rep-historial-asignaciones',async (_e, filtros) => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.historialAsignaciones(filtros || {}); });
ipcMain.handle('af-rep-historial-activo',      async (_e, id)      => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.historialActivo(id); });
ipcMain.handle('af-rep-celulares',             async ()            => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.celulares(); });
ipcMain.handle('af-rep-laptops',               async ()            => { const err = requerirSesion('af-rep:ver'); if (err) return err; return await activoFijoReportesDB.laptops(); });

/* --- NUEVOS: endpoint consolidado + exportar a Excel --- */
ipcMain.handle('af-rep-obtener-reporte', async (_e, vista, filtros) => {
    const err = requerirSesion('af-rep:ver');
    if (err) return err;
    try {
        return await activoFijoReportesDB.obtenerReporte(vista, filtros || {});
    } catch (e) {
        console.error('[Reportes] Error obtenerReporte:', e);
        return { ok: false, mensaje: e.message, datos: [] };
    }
});

ipcMain.handle('af-rep-exportar-excel', async (_e, payload) => {
    const err = requerirSesion('af-rep:ver');
    if (err) return err;
    try {
        return await exportarReporteExcel(payload);
    } catch (e) {
        console.error('[Reportes] Error exportarExcel:', e);
        return { ok: false, mensaje: e.message };
    }
});

/* =========================================================
   HELPER: EXPORTAR REPORTE A EXCEL
   payload = { vista, titulo, columnas: [{ key, etiqueta, tipo }], filas: [{ etiqueta: valor }] }
   ========================================================= */
async function exportarReporteExcel(payload) {
    const { titulo, columnas, filas } = payload || {};

    if (!filas || filas.length === 0) {
        return { ok: false, mensaje: 'Sin datos para exportar.' };
    }
    if (!Array.isArray(columnas) || columnas.length === 0) {
        return { ok: false, mensaje: 'No se especificaron columnas.' };
    }

    const safeTitulo = (titulo || 'Reporte').replace(/[\\/:*?"<>|]/g, '_');
    const fecha = new Date().toISOString().slice(0, 10);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const defaultPath = path.join(
        fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(),
        `${safeTitulo}_${fecha}.xlsx`
    );

    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar reporte en Excel',
        defaultPath,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

    const encabezados = columnas.map(c => c.etiqueta);
    const datos = filas.map(f => columnas.map(c => {
        const v = f[c.etiqueta];
        return v === null || v === undefined ? '' : v;
    }));

    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...datos]);

    // Anchos automáticos
    ws['!cols'] = encabezados.map((_, i) => {
        const valores = [encabezados[i], ...datos.map(fila => fila[i])];
        const max = Math.max(...valores.map(v => String(v ?? '').length));
        return { wch: Math.min(Math.max(max + 2, 10), 45) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, safeTitulo.substring(0, 30) || 'Reporte');
    XLSX.writeFile(wb, filePath);

    return { ok: true, ruta: filePath };
}

/* =========================================================
   IPC: CATÁLOGOS PARA FILTROS DE REPORTES
   ========================================================= */
ipcMain.handle('af-rep-tipos',                 async () => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.tiposParaFiltro(); });
ipcMain.handle('af-rep-estados',               async () => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.estadosParaFiltro(); });
ipcMain.handle('af-rep-estatus',               async () => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.estatusParaFiltro(); });
ipcMain.handle('af-rep-carteras',              async () => { const err = requerirSesion('activofijo_reportes'); if (err) return err; return await activoFijoReportesDB.carterasParaFiltro(); });

/* =========================================================
   IPC: IMPORTACIÓN AF
   ========================================================= */
ipcMain.handle('af-import-layouts',  async ()           => { const err = requerirSesion('af-imp:ejecutar'); if (err) return err; return activoFijoImportacionDB.listarLayouts(); });
ipcMain.handle('af-import-layout',   async (_e, clave)  => { const err = requerirSesion('af-imp:ejecutar'); if (err) return err; return activoFijoImportacionDB.obtenerLayout(clave); });
ipcMain.handle('af-import-procesar', async (_e, datos)  => { const err = requerirSesion('af-imp:ejecutar'); if (err) return err; return await activoFijoImportacionDB.importar(datos, usuarioActual?.IdUsuario); });

/* =========================================================
   HELPER: CONSTRUIR PDF DE RESPONSIVA EN MEMORIA
   ========================================================= */
async function construirPDFResponsiva(idResponsiva) {
    const d = await activoFijoResponsivasDB.obtenerParaPDF(idResponsiva);
    if (!d) return { ok: false, mensaje: 'Responsiva no encontrada.' };

    if (!fs.existsSync(PLANTILLA_PDF)) {
        return {
            ok: false,
            mensaje: `No se encontró la plantilla en:\n${PLANTILLA_PDF}\n\nVerifica que exista la carpeta "Formatos" con el archivo "ResponsivaCelulares.pdf".`
        };
    }

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
    setCampo('area_recibe',           d.Cartera);
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
    const nombreArchivo = `Responsiva-${(d.FolioTicket || 'sin-folio').replace(/[\/\\:*?"<>|]/g, '_')}.pdf`;

    return { ok: true, bytes: Buffer.from(bytesFinales), nombreArchivo };
}

/* =========================================================
   IPC: VER PDF (genera en memoria + abre temporal, NO guarda)
   ========================================================= */
ipcMain.handle('af-resp-ver-pdf', async (_e, idResponsiva) => {
    const err = requerirSesion('af-resp:pdf'); if (err) return err;

    try {
        const res = await construirPDFResponsiva(idResponsiva);
        if (!res.ok) return res;

        const tmpPath = path.join(
            os.tmpdir(),
            `af-resp-preview-${Date.now()}-${res.nombreArchivo}`
        );

        fs.writeFileSync(tmpPath, res.bytes);

        try {
            app.once('will-quit', () => { try { fs.unlinkSync(tmpPath); } catch (_) {} });
        } catch (_) {}

        const openErr = await shell.openPath(tmpPath);
        if (openErr) {
            return { ok: false, mensaje: 'No se pudo abrir el PDF: ' + openErr };
        }

        return {
            ok: true,
            mensaje: 'PDF abierto en el visor del sistema.',
            ruta: tmpPath,
            temporal: true
        };
    } catch (err) {
        console.error('Error generando PDF (ver):', err);
        return { ok: false, mensaje: 'Error al generar PDF: ' + err.message };
    }
});

/* =========================================================
   IPC: GUARDAR PDF (genera + diálogo + guarda localmente)
   ========================================================= */
ipcMain.handle('af-resp-guardar-pdf', async (_e, idResponsiva) => {
    const err = requerirSesion('af-resp:pdf'); if (err) return err;

    try {
        const res = await construirPDFResponsiva(idResponsiva);
        if (!res.ok) return res;

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Guardar PDF de responsiva',
            defaultPath: res.nombreArchivo,
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });

        if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

        fs.writeFileSync(filePath, res.bytes);

        return { ok: true, mensaje: 'PDF guardado correctamente.', ruta: filePath };
    } catch (err) {
        console.error('Error guardando PDF:', err);
        return { ok: false, mensaje: 'Error al guardar PDF: ' + err.message };
    }
});

/* =========================================================
   IPC: CLIENTES / ROLES / PISOS / RANGOS
   ========================================================= */
ipcMain.handle('clientes:listar', async () => {
    if (!tienePermiso('catalogos') && !tienePermiso('plano') && !tienePermiso('equipos')) {
        return negarAcceso('catalogos, plano o equipos');
    }
    return await clientesDB.listar();
});
ipcMain.handle('clientes:crear',      async (_e, codigo, nombre, color)  => { const err = requerirSesion('catalogos:clientes:crear');  if (err) return err; return await clientesDB.crear(codigo, nombre, color); });
ipcMain.handle('clientes:actualizar', async (_e, id, codigo, nombre, color) => { const err = requerirSesion('catalogos:clientes:editar'); if (err) return err; return await clientesDB.actualizar(id, codigo, nombre, color); });
ipcMain.handle('clientes:eliminar',   async (_e, id)              => { const err = requerirSesion('catalogos:clientes:eliminar'); if (err) return err; return await clientesDB.eliminar(id); });

ipcMain.handle('roles:listar',     async ()                                       => { const err = requerirSesion('catalogos'); if (err) return err; return await rolesDB.listar(); });
ipcMain.handle('roles:crear',      async (_e, codigo, nombre, descripcion, color)        => { const err = requerirSesion('catalogos:roles:crear'); if (err) return err; return await rolesDB.crear(codigo, nombre, descripcion, color); });
ipcMain.handle('roles:actualizar', async (_e, id, codigo, nombre, descripcion, color)    => { const err = requerirSesion('catalogos:roles:editar'); if (err) return err; return await rolesDB.actualizar(id, codigo, nombre, descripcion, color); });
ipcMain.handle('roles:eliminar',   async (_e, id)                                 => { const err = requerirSesion('catalogos:roles:eliminar'); if (err) return err; return await rolesDB.eliminar(id); });

ipcMain.handle('catalogos:colores', async () => {
    const err = requerirSesion();
    if (err) return err;
    const [clientes, roles] = await Promise.all([clientesDB.listar(), rolesDB.listar()]);
    return {
        clientes: clientes.map(({ Codigo, ColorHex }) => ({ codigo: Codigo, colorHex: ColorHex })),
        roles: roles.map(({ Codigo, ColorHex }) => ({ codigo: Codigo, colorHex: ColorHex }))
    };
});

/* =========================================================
   IPC: PISOS
   ========================================================= */
ipcMain.handle('pisos:listar', async () => {
    if (!tienePermiso('catalogos') && !tienePermiso('plano') && !tienePermiso('equipos')) {
        return negarAcceso('catalogos, plano o equipos');
    }
    return await pisosDB.listar();
});
ipcMain.handle('pisos:obtener',               async (_e, id)                        => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.obtener(id); });
ipcMain.handle('pisos:listarPorCliente',      async (_e, idCliente)                 => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.listarPorCliente(idCliente); });
ipcMain.handle('pisos:clientesDePiso',        async (_e, idPiso)                    => { const err = requerirSesion('catalogos'); if (err) return err; return await pisosDB.clientesDePiso(idPiso); });
ipcMain.handle('pisos:crear',                 async (_e, nombre, filas, cols, ids)  => { const err = requerirSesion('catalogos:pisos:crear'); if (err) return err; return await pisosDB.crear(nombre, filas, cols, ids); });
ipcMain.handle('pisos:actualizarConClientes', async (_e, id, nombre, filas, cols, ids) => { const err = requerirSesion('catalogos:pisos:editar'); if (err) return err; return await pisosDB.actualizarConClientes(id, nombre, filas, cols, ids); });
ipcMain.handle('pisos:eliminar',              async (_e, id)                        => { const err = requerirSesion('catalogos:pisos:eliminar'); if (err) return err; return await pisosDB.eliminar(id); });

/* =========================================================
   IPC: RANGOS IP POR CLIENTE (módulo Equipos)
   ========================================================= */
ipcMain.handle('rangos:listar', async (_e, idCliente = null) => {
    const err = requerirSesion('equipos');
    if (err) return err;
    return await rangosDB.listar(idCliente);
});
ipcMain.handle('rangos:crear', async (_e, datos) => {
    const err = requerirPermiso(['equipos:rangos:crear', 'catalogos:rangos:crear']);
    if (err) return err;
    return await rangosDB.crear(datos);
});
ipcMain.handle('rangos:actualizar', async (_e, id, datos) => {
    const err = requerirPermiso(['equipos:rangos:editar', 'catalogos:rangos:editar']);
    if (err) return err;
    return await rangosDB.actualizar(id, datos);
});
ipcMain.handle('rangos:eliminar', async (_e, id) => {
    const err = requerirPermiso(['equipos:rangos:eliminar', 'catalogos:rangos:eliminar']);
    if (err) return err;
    return await rangosDB.eliminar(id);
});
ipcMain.handle('rangos:auditar', async (_e, idCliente = null) => {
    const err = requerirPermiso([
        'equipos:rangos:auditar', 'catalogos:rangos:auditar',
        'catalogos:rangos:editar', 'equipos:rangos:editar', 'equipos'
    ]);
    if (err) return err;
    return await rangosDB.auditar(idCliente);
});
/* Análisis del ajuste automático: cruza Equipos + Control general de IP + Plano
   y devuelve las propuestas de rango (sin escribir en la base de datos). */
ipcMain.handle('rangos:analizar', async (_e, idCliente = null) => {
    const err = requerirPermiso([
        'equipos:rangos:auditar', 'catalogos:rangos:auditar',
        'catalogos:rangos:editar', 'equipos:rangos:editar',
        'catalogos', 'equipos'
    ]);
    if (err) return err;
    try {
        return await rangosDB.analizar(idCliente);
    } catch (error) {
        console.error('[Rangos] Error al analizar:', error);
        return { ok: false, mensaje: error.message || 'No se pudo analizar los rangos.' };
    }
});
/* Aplica el ajuste: crea/amplía rangos y devuelve lo que quedó pendiente. */
ipcMain.handle('rangos:aplicarAjuste', async (_e, idCliente = null) => {
    const err = requerirPermiso([
        'catalogos:rangos:crear', 'catalogos:rangos:editar',
        'equipos:rangos:crear', 'equipos:rangos:editar'
    ]);
    if (err) return err;
    try {
        return await rangosDB.aplicarAjuste(idCliente);
    } catch (error) {
        console.error('[Rangos] Error al aplicar el ajuste:', error);
        return { ok: false, mensaje: error.message || 'No se pudo aplicar el ajuste de rangos.' };
    }
});
ipcMain.handle('rangos:validarIP', async (_e, idCliente, idRolEquipo, ip) => {
    const err = requerirSesion('equipos');
    if (err) return err;
    return await rangosDB.validarIPEnRango(idCliente, idRolEquipo, ip);
});
/* Reserva global: ¿la IP pertenece a un rango declarado por algún cliente?
   Lo consulta el control general de IP antes de dar de alta un dispositivo. */
ipcMain.handle('rangos:reservadoIP', async (_e, ip) => {
    const err = requerirSesion('equipos');
    if (err) return err;
    return await rangosDB.rangoReservadoParaIP(ip);
});

/* =========================================================
   IPC: EQUIPOS
   ========================================================= */
ipcMain.handle('equipos:listar',               async ()          => { const err = requerirSesion('equipos:listado:ver'); if (err) return err; return await equiposDB.listar(); });
ipcMain.handle('equipos:exportarExcel', async (_e, opciones = {}) => {
    const err = requerirSesion('equipos:listado:exportar');
    if (err) return err;
    try {
        const equipos = await equiposDB.listar();
        const equipoFiltrados = opciones.idCliente
            ? equipos.filter(equipo => Number(equipo.IdCliente) === Number(opciones.idCliente))
            : equipos;
        if (!equipoFiltrados.length) return { ok: false, mensaje: 'No hay equipos para exportar con ese cliente.' };

        const columnasDisponibles = [
            ['clienteNombre', 'Nombre del cliente', equipo => equipo.ClienteNombre || ''],
            ['clienteCodigo', 'Código cliente', equipo => equipo.ClienteCodigo || ''],
            ['rolNombre', 'Nombre del rol', equipo => equipo.RolNombre || ''],
            ['rolCodigo', 'Código rol', equipo => equipo.RolCodigo || ''],
            ['hostname', 'Hostname', equipo => equipo.Hostname || ''],
            ['tipoIP', 'Tipo IP', equipo => equipo.TipoIP || ''],
            ['ip', 'IP', equipo => equipo.IP || ''],
            ['piso', 'Piso', equipo => equipo.PisoNombre || ''],
            ['mascara', 'Máscara', equipo => equipo.Mascara || ''],
            ['puertaEnlace', 'Puerta de enlace', equipo => equipo.PuertaEnlace || ''],
            ['dns1', 'DNS 1', equipo => equipo.DNS1 || ''],
            ['dns2', 'DNS 2', equipo => equipo.DNS2 || ''],
            ['usuarioAdmin', 'Usuario admin', equipo => equipo.UsuarioAdmin || ''],
            ['numeroHost', 'Número host', equipo => equipo.NumeroHost ?? ''],
            ['activo', 'Activo', equipo => equipo.Activo ? 'Sí' : 'No']
        ];
        const columnasSolicitadas = Array.isArray(opciones.columnas) ? opciones.columnas : [];
        const columnas = columnasDisponibles.filter(([clave]) => columnasSolicitadas.includes(clave));
        if (!columnas.length) return { ok: false, mensaje: 'Selecciona al menos una columna para exportar.' };
        const encabezados = columnas.map(([, etiqueta]) => etiqueta);
        const filas = equipoFiltrados.map(equipo => columnas.map(([, , valor]) => valor(equipo)));
        const ahora = new Date();
        const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        const defaultPath = path.join(
            fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(),
            `Equipos_${hoy}.xlsx`
        );
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Exportar equipos a Excel',
            defaultPath,
            filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });
        if (canceled || !filePath) return { ok: false, cancelado: true };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Coperva';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Equipos', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });
        const anchosPorClave = {
            clienteNombre: 30, clienteCodigo: 18, rolNombre: 24, rolCodigo: 14,
            hostname: 24, tipoIP: 15, ip: 18, piso: 20, mascara: 18,
            puertaEnlace: 22, dns1: 18, dns2: 18, usuarioAdmin: 24,
            numeroHost: 15, activo: 12
        };
        worksheet.columns = encabezados.map((header, index) => ({
            header,
            key: `columna${index + 1}`,
            width: anchosPorClave[columnas[index][0]]
        }));
        worksheet.addTable({
            name: 'TablaEquipos',
            ref: 'A1',
            headerRow: true,
            totalsRow: false,
            style: { theme: 'TableStyleMedium4', showRowStripes: true },
            columns: encabezados.map(name => ({ name })),
            rows: filas
        });
        worksheet.getRow(1).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF55744F' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });
        worksheet.eachRow((row, rowNumber) => {
            row.height = rowNumber === 1 ? 30 : 22;
            row.alignment = { vertical: 'middle', wrapText: true };
        });
        await workbook.xlsx.writeFile(filePath);
        return { ok: true, ruta: filePath };
    } catch (error) {
        console.error('[Equipos] Error exportando Excel:', error);
        return { ok: false, mensaje: `No se pudo exportar a Excel: ${error.message}` };
    }
});
ipcMain.handle('equipos:obtenerPorId',         async (_e, id)    => { const err = requerirSesion('equipos:listado:ver'); if (err) return err; return await equiposDB.obtenerPorId(id); });
ipcMain.handle('equipos:crear',                async (_e, datos) => { const err = requerirSesion('equipos:crear');       if (err) return err; return await equiposDB.crear(datos); });
ipcMain.handle('equipos:actualizar',           async (_e, id, datos) => { const err = requerirSesion('equipos:editar');    if (err) return err; return await equiposDB.actualizar(id, datos); });
ipcMain.handle('equipos:eliminar',             async (_e, id)    => { const err = requerirSesion('equipos:eliminar');    if (err) return err; return await equiposDB.eliminar(id); });
ipcMain.handle('equipos:verificarIPDuplicada', async (_e, ip, idExcluir) => { const err = requerirSesion('equipos');      if (err) return err; return await equiposDB.verificarIPDuplicada(ip, idExcluir); });
ipcMain.handle('equipos:listarIPsAsignadasEnSegmento', async (_e, segmento, idExcluir) => { const err = requerirSesion('equipos:listado:ver'); if (err) return err; return await equiposDB.listarIPsAsignadasEnSegmento(segmento, idExcluir); });

/* =========================================================
   IPC: CONTROL GENERAL DE IP
   ========================================================= */
ipcMain.handle('inventario-ip:listar', async () => {
    const err = requerirSesion('equipos:listado:ver'); if (err) return err;
    return await inventarioIPDB.listar();
});
ipcMain.handle('inventario-ip:catalogos', async (_e, origen) => {
    const err = requerirSesion('equipos:listado:ver'); if (err) return err;
    return await inventarioIPDB.listarCatalogos(origen);
});
ipcMain.handle('inventario-ip:catalogo:crear', async (_e, tipo, nombre, origen) => {
    const err = requerirSesion('equipos:crear'); if (err) return err;
    return await inventarioIPDB.guardarCatalogo(tipo, nombre, null, origen);
});
ipcMain.handle('inventario-ip:catalogo:actualizar', async (_e, id, tipo, nombre, origen) => {
    const err = requerirSesion('equipos:editar'); if (err) return err;
    return await inventarioIPDB.guardarCatalogo(tipo, nombre, id, origen);
});
/* Preferencias de la pantalla guardadas en la base (color de los
   dispositivos del control general, etc.). */
ipcMain.handle('inventario-ip:preferencias', async () => {
    const err = requerirSesion('equipos:listado:ver'); if (err) return err;
    return await inventarioIPDB.listarPreferencias();
});
ipcMain.handle('inventario-ip:preferencia:guardar', async (_e, clave, valor) => {
    const err = requerirSesion('equipos:editar'); if (err) return err;
    return await inventarioIPDB.guardarPreferencia(clave, valor);
});
ipcMain.handle('inventario-ip:catalogo:eliminar', async (_e, id) => {
    const err = requerirSesion('equipos:eliminar'); if (err) return err;
    return await inventarioIPDB.eliminarCatalogo(id);
});
ipcMain.handle('inventario-ip:crear', async (_e, datos) => {
    const err = requerirSesion('equipos:crear'); if (err) return err;
    return await inventarioIPDB.guardar(datos);
});
ipcMain.handle('inventario-ip:actualizar', async (_e, id, datos) => {
    const err = requerirSesion('equipos:editar'); if (err) return err;
    return await inventarioIPDB.guardar(datos, id);
});
ipcMain.handle('inventario-ip:cliente:actualizar', async (_e, idEquipo, datos) => {
    const err = requerirSesion('equipos:editar'); if (err) return err;
    return await inventarioIPDB.actualizarDatosEquipoCliente(idEquipo, datos);
});
ipcMain.handle('inventario-ip:eliminar', async (_e, id) => {
    const err = requerirSesion('equipos:eliminar'); if (err) return err;
    return await inventarioIPDB.eliminar(id);
});
ipcMain.handle('inventario-ip:exportarExcel', async (_e, opciones = {}) => {
    const err = requerirSesion('equipos:listado:exportar');
    if (err) return err;
    try {
        const segmentoDe = ip => {
            const partes = String(ip || '').trim().split('.');
            const valido = partes.length === 4 &&
                partes.every(parte => /^\d{1,3}$/.test(parte) && Number(parte) <= 255);
            return valido ? partes.slice(0, 3).map(parte => String(Number(parte))).join('.') : 'Sin IP';
        };
        const ipComoNumero = ip => {
            const partes = String(ip || '').trim().split('.');
            if (partes.length !== 4 || !partes.every(parte => /^\d{1,3}$/.test(parte))) return Number.MAX_SAFE_INTEGER;
            return partes.reduce((total, parte) => total * 256 + Number(parte), 0);
        };
        const registros = await inventarioIPDB.listar();
        let filtrados = registros;
        if (opciones.segmento) {
            filtrados = filtrados.filter(registro => segmentoDe(registro.IP) === String(opciones.segmento));
        }

        /* La tabla del control general muestra el segmento completo: las IP
           registradas más las libres (1-254), que NO existen en la base de
           datos. El Excel refleja exactamente lo mismo por segmento. */
        /* Misma norma que la pantalla y que la validación al guardar: la IP
           incluida en los rangos declarados por un cliente se exporta como
           reservada, nunca como libre. Si el esquema de rangos no existe
           todavía, el control general exporta como siempre. */
        let rangosCliente = [];
        try {
            rangosCliente = await rangosDB.listar();
        } catch (_) {
            rangosCliente = [];
        }
        const rangoDeIP = ip => {
            const valor = ipComoNumero(ip);
            if (!rangosCliente.length || valor === Number.MAX_SAFE_INTEGER) return null;
            return rangosCliente.find(rango => {
                const inicio = ipComoNumero(rango.IPInicio);
                const fin = ipComoNumero(rango.IPFin);
                if (inicio === Number.MAX_SAFE_INTEGER || fin === Number.MAX_SAFE_INTEGER) return false;
                return valor >= inicio && valor <= fin;
            }) || null;
        };
        const conReserva = registro => {
            if (String(registro.Origen || '') === 'Cliente') return registro;
            const rango = rangoDeIP(registro.IP);
            if (!rango) return registro;
            return {
                ...registro,
                Reservado: true,
                Libre: false,
                Estado: registro.Origen ? registro.Estado : 'Reservado',
                Reserva: `${rango.ClienteCodigo || 'Cliente'} · ${rango.RolNombre || 'cualquier perfil'} (${rango.IPInicio} – ${rango.IPFin})`
            };
        };
        const HOST_INICIAL = 1;
        const HOST_FINAL = 254;
        const ocupadas = new Set();
        const segmentos = new Set();
        for (const registro of filtrados) {
            const segmento = segmentoDe(registro.IP);
            if (segmento === 'Sin IP') continue;
            ocupadas.add(String(registro.IP || '').trim());
            segmentos.add(segmento);
        }
        const adicionales = [];
        for (const segmento of segmentos) {
            for (let host = HOST_INICIAL; host <= HOST_FINAL; host += 1) {
                const ip = `${segmento}.${host}`;
                if (ocupadas.has(ip)) continue;
                adicionales.push(conReserva({ Origen: '', IP: ip, Estado: 'Libre', Libre: true }));
            }
        }
        filtrados = filtrados.concat(adicionales);
        filtrados = filtrados.map(conReserva);
        filtrados = filtrados.slice().sort((a, b) => {
            const porSegmento = segmentoDe(a.IP).localeCompare(segmentoDe(b.IP));
            if (porSegmento !== 0) return porSegmento;
            const porIP = ipComoNumero(a.IP) - ipComoNumero(b.IP);
            if (porIP !== 0) return porIP;
            return String(a.Origen || '').localeCompare(String(b.Origen || ''), 'es');
        });

        const columnas = [];
        const agregar = (clave, etiqueta, valor, ancho) => columnas.push({ clave, etiqueta, valor, ancho });
        const estadoVisible = registro => {
            const activo = String(registro.Estado || '').trim().toLowerCase() === 'activo';
            if (registro.Reservado) return activo ? 'Ocupada (reservada)' : 'Reservado';
            return activo ? 'Ocupado' : 'Libre';
        };
        agregar('origen', 'Origen', registro => registro.Origen || '', 14);
        agregar('estado', 'Estado', estadoVisible, 14);
        agregar('reserva', 'Reserva de cliente', registro => registro.Reserva || '', 34);
        agregar('ip', 'IP', registro => registro.IP || 'DHCP', 18);
        agregar('hostname', 'Hostname', registro => registro.Hostname || '', 26);
        agregar('mac', 'MAC', registro => registro.MAC || '', 20);
        agregar('dispositivo', 'Dispositivo', registro => registro.Dispositivo || '', 18);
        agregar('tipo', 'Tipo', registro => registro.TipoEquipo || '', 18);
        agregar('piso', 'Piso', registro => registro.Piso || '', 18);
        agregar('clienteCodigo', 'Código cliente', registro => registro.ClienteCodigo || '', 16);
        agregar('clienteNombre', 'Cliente', registro => registro.ClienteNombre || '', 28);
        agregar('switch', 'Switch', registro => registro.Site || '', 20);
        agregar('puerto', 'Puerto Fortinet', registro => registro.PuertoFortinet || '', 20);
        agregar('descripcion', 'Descripción', registro => registro.Descripcion || '', 40);

        const ahora = new Date();
        const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
        const sufijo = opciones.segmento
            ? `Segmento_${String(opciones.segmento).replace(/\./g, '-')}`
            : 'General';
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        const defaultPath = path.join(
            fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(),
            `ControlIP_${sufijo}_${hoy}.xlsx`
        );
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Exportar control general de IP a Excel',
            defaultPath,
            filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });
        if (canceled || !filePath) return { ok: false, cancelado: true };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Coperva';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Control IP', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });
        worksheet.columns = columnas.map(columna => ({
            header: columna.etiqueta,
            key: columna.clave,
            width: columna.ancho
        }));
        worksheet.addTable({
            name: 'TablaControlIP',
            ref: 'A1',
            headerRow: true,
            totalsRow: false,
            style: { theme: 'TableStyleMedium4', showRowStripes: true },
            /* filterButton:true deja visible el botón de filtro en cada
               encabezado del Excel (por defecto ExcelJS los oculta). */
            columns: columnas.map(columna => ({ name: columna.etiqueta, filterButton: true })),
            rows: filtrados.map(registro => columnas.map(columna => columna.valor(registro)))
        });
        worksheet.getRow(1).eachCell(celda => {
            celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF55744F' } };
            celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            celda.alignment = { vertical: 'middle', wrapText: true };
        });
        worksheet.eachRow((fila, numero) => {
            fila.height = numero === 1 ? 30 : 22;
            fila.alignment = { vertical: 'middle', wrapText: true };
        });
        await workbook.xlsx.writeFile(filePath);
        return { ok: true, ruta: filePath, total: filtrados.length };
    } catch (error) {
        console.error('[InventarioIP] Error exportando Excel:', error);
        return { ok: false, mensaje: `No se pudo exportar a Excel: ${error.message}` };
    }
});

/* Importación inteligente: el proceso principal lee el Excel (SheetJS),
   reconoce las columnas por encabezado en todas las hojas y valida antes
   de escribir. El renderer sólo revisa el resumen y confirma. */
ipcMain.handle('inventario-ip:importarExcel', async (evento) => {
    const err = requerirSesion('equipos:crear'); if (err) return err;
    const ventana = BrowserWindow.fromWebContents(evento.sender);
    return await inventarioIPImportacion.seleccionarYAnalizar(ventana);
});
ipcMain.handle('inventario-ip:importarAplicar', async (_e, registros, opciones) => {
    const err = requerirSesion('equipos:crear'); if (err) return err;
    return await inventarioIPImportacion.aplicarImportacion(registros, opciones);
});

/* =========================================================
   IPC: DOMINIOS
   ========================================================= */
ipcMain.handle('dominios:listarPorCliente', async (_e, idCliente)       => { const err = requerirSesion('catalogos'); if (err) return err; return await dominiosDB.listarPorCliente(idCliente); });
ipcMain.handle('dominios:listarTodas',      async (_e, filtros)         => { const err = requerirSesion('catalogos'); if (err) return err; return await dominiosDB.listarTodas(filtros); });
ipcMain.handle('dominios:crear',            async (_e, idCliente, u, p, d) => { const err = requerirSesion('catalogos:dominios:gestionar'); if (err) return err; return await dominiosDB.crear(idCliente, u, p, d); });
ipcMain.handle('dominios:actualizar',       async (_e, id, u, p, d)    => { const err = requerirSesion('catalogos:dominios:gestionar'); if (err) return err; return await dominiosDB.actualizar(id, u, p, d); });
ipcMain.handle('dominios:eliminar',         async (_e, id)             => { const err = requerirSesion('catalogos:dominios:gestionar'); if (err) return err; return await dominiosDB.eliminar(id); });

/* =========================================================
   IPC: CONFIGURACIONES DE RED
   ========================================================= */
ipcMain.handle('config:listarPorClienteTipo', async (_e, idCliente, tipo)     => { const err = requerirSesion('catalogos'); if (err) return err; return await configDB.listarPorClienteTipo(idCliente, tipo); });
ipcMain.handle('config:listarTodas',          async (_e, filtros)             => { const err = requerirSesion('catalogos'); if (err) return err; return await configDB.listarTodas(filtros); });
ipcMain.handle('config:crear',                async (_e, idCliente, tipo, valor, desc) => { const err = requerirSesion('catalogos:config:gestionar'); if (err) return err; return await configDB.crear(idCliente, tipo, valor, desc); });
ipcMain.handle('config:actualizar',           async (_e, id, valor, desc)     => { const err = requerirSesion('catalogos:config:gestionar'); if (err) return err; return await configDB.actualizar(id, valor, desc); });
ipcMain.handle('config:eliminar',             async (_e, id)                  => { const err = requerirSesion('catalogos:config:gestionar'); if (err) return err; return await configDB.eliminar(id); });

/* =========================================================
   IPC: USUARIOS / HISTÓRICOS
   ========================================================= */
ipcMain.handle('usuarios:listar',     async ()          => { const err = requerirSesion('usuarios:listado:ver'); if (err) return err; return await usuariosDB.listar(); });
ipcMain.handle('usuarios:crear',      async (_e, datos) => { const err = requerirSesion('usuarios:crear');       if (err) return err; return await usuariosDB.crear(datos); });
ipcMain.handle('usuarios:actualizar', async (_e, id, datos) => { const err = requerirSesion('usuarios:editar');  if (err) return err; return await usuariosDB.actualizar(id, datos); });
ipcMain.handle('usuarios:eliminar',   async (_e, id)    => { const err = requerirSesion('usuarios:eliminar');    if (err) return err; return await usuariosDB.eliminar(id); });

ipcMain.handle('historicos:listarPorPiso', async (_e, idPiso)              => { const err = requerirSesion('historico'); if (err) return err; return await historicosDB.listarPorPiso(idPiso); });
ipcMain.handle('historicos:listar',        async (_e, idCliente, idPiso)   => { const err = requerirSesion('historico'); if (err) return err; return await historicosDB.listar(idCliente, idPiso); });

/* =========================================================
   IPC: MANTENIMIENTOS
   ========================================================= */
ipcMain.handle('mantenimientos:listarPisos', async () => {
    const err = requerirSesion('mantenimientos'); if (err) return err;
    return await mantenimientosDB.listarPisos();
});
ipcMain.handle('mantenimientos:listarUsuarios', async () => {
    const err = requerirSesion('mantenimientos'); if (err) return err;
    return await mantenimientosDB.listarUsuariosActivos();
});
ipcMain.handle('mantenimientos:obtenerPlano', async (_e, idPiso) => {
    const err = requerirSesion('mantenimientos'); if (err) return err;
    return await mantenimientosDB.obtenerPlano(idPiso);
});
ipcMain.handle('mantenimientos:listarRegistros', async (_e, idPiso) => {
    const err = requerirSesion('mantenimientos'); if (err) return err;
    return await mantenimientosDB.listarRegistros(idPiso);
});
ipcMain.handle('mantenimientos:crear', async (_e, datos) => {
    const err = requerirSesion('mantenimientos'); if (err) return err;
    const errCrear = requerirSesion('mantenimientos:crear'); if (errCrear) return errCrear;
    const ahora = new Date();
    const fechaHoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const payload = tienePermiso('mantenimientos:fecha:editar')
        ? datos
        : { ...datos, fechaMantenimiento: fechaHoy };
    return await mantenimientosDB.crear(payload);
});
ipcMain.handle('mantenimientos:exportarExcel', async (_e, idPiso) => {
    const err = requerirSesion('mantenimientos'); if (err) return err;
    try {
        return await exportarMantenimientosExcel(idPiso);
    } catch (error) {
        console.error('[Mantenimientos] Error exportando Excel:', error);
        return { ok: false, mensaje: `No se pudo exportar a Excel: ${error.message}` };
    }
});

async function exportarMantenimientosExcel(idPiso) {
    const registros = await mantenimientosDB.listarRegistros(Number(idPiso));
    if (registros?.ok === false) return registros;
    if (!registros.length) return { ok: false, mensaje: 'No hay mantenimientos para exportar en este piso.' };

    const headers = [
        'Fecha', 'Equipo', 'IP', 'Cliente', 'Rol', 'Ubicación', 'Realizado por', 'Observaciones'
    ];
    const filas = registros.map(registro => [
        registro.FechaMantenimiento instanceof Date
            ? registro.FechaMantenimiento.toISOString().slice(0, 10)
            : String(registro.FechaMantenimiento || '').slice(0, 10),
        registro.Hostname || '',
        registro.IP || '',
        registro.Cliente || '',
        registro.Rol || '',
        registro.PisoNombre || '',
        registro.RealizadoPor || '',
        registro.Observaciones || ''
    ]);

    const hoy = new Date().toISOString().slice(0, 10);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const defaultPath = path.join(
        fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(),
        `Mantenimientos_${hoy}.xlsx`
    );
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exportar mantenimientos a Excel',
        defaultPath,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Coperva';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Registros', {
        views: [{ state: 'frozen', ySplit: 1 }]
    });
    const widths = [15, 23, 18, 30, 24, 20, 38, 58];
    worksheet.columns = headers.map((_, index) => ({
        key: `columna${index + 1}`,
        width: widths[index]
    }));
    worksheet.addRow(headers);
    worksheet.addRows(filas);
    worksheet.autoFilter = {
        from: 'A1',
        to: `H${filas.length + 1}`
    };
    worksheet.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF55744F' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
    });
    worksheet.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 30 : 36;
        row.alignment = { vertical: 'top', wrapText: true };
    });
    await workbook.xlsx.writeFile(filePath);
    return { ok: true, ruta: filePath };
}

/* =========================================================
   IPC: PLANO
   ========================================================= */
ipcMain.handle('plano:dimensiones', async (_e, idPiso) => { const err = requerirSesion('plano:ver'); if (err) return err; return await planoDB.obtenerDimensiones(idPiso); });

ipcMain.handle('plano:actualizarDim', async (_e, idPiso, filas, columnas) => {
    const err = requerirSesion('plano:editar-dim'); if (err) return err;
    return await planoDB.actualizarDimensiones(usuarioActual.IdUsuario, idPiso, filas, columnas);
});

ipcMain.handle('plano:listarPorLugar', async (_e, idPiso) => { const err = requerirSesion('plano:ver'); if (err) return err; return await planoDB.listarPorLugar(idPiso); });
ipcMain.handle('plano:sinUbicacion',   async (_e, idPiso, idEscenarioFuturo = null) => {
    const err = requerirSesion('plano:ver'); if (err) return err;
    return await planoDB.equiposSinUbicacion(idPiso, idEscenarioFuturo);
});
ipcMain.handle('plano:futuros:listar', async (_e, idPiso) => { const err = requerirSesion('plano:ver'); if (err) return err; return await planoDB.listarEscenariosFuturos(idPiso); });
ipcMain.handle('plano:futuros:ubicaciones', async (_e, idEscenario, idPiso) => { const err = requerirSesion('plano:ver'); if (err) return err; return await planoDB.obtenerUbicacionesFuturas(idEscenario, idPiso); });
ipcMain.handle('plano:futuros:crear', async (_e, idPisos, nombre) => {
    const err = requerirSesion('plano:mover'); if (err) return err;
    return await planoDB.crearEscenarioFuturo(usuarioActual.IdUsuario, idPisos, nombre);
});
ipcMain.handle('plano:futuros:mover', async (_e, idEscenario, idEquipo, idPisoDestino, fila, columna) => {
    const err = requerirSesion('plano:mover'); if (err) return err;
    return await planoDB.moverEquipoEnEscenarioFuturo(idEscenario, idEquipo, idPisoDestino, fila, columna);
});
ipcMain.handle('plano:futuros:editar-equipo', async (_e, idEscenario, idEquipo, datos) => {
    const err = requerirSesion('equipos:editar'); if (err) return err;
    return await planoDB.actualizarEquipoEnEscenarioFuturo(idEscenario, idEquipo, datos);
});
ipcMain.handle('plano:futuros:quitar-equipo', async (_e, idEscenario, idEquipo) => {
    const err = requerirSesion('plano:quitar'); if (err) return err;
    return await planoDB.quitarEquipoEnEscenarioFuturo(idEscenario, idEquipo);
});
ipcMain.handle('plano:futuros:agregar-equipo', async (_e, idEscenario, idEquipo, idPiso, fila, columna) => {
    const err = requerirSesion('plano:asignar'); if (err) return err;
    return await planoDB.agregarEquipoEnEscenarioFuturo(idEscenario, idEquipo, idPiso, fila, columna);
});
ipcMain.handle('plano:futuros:eliminar', async (_e, idEscenario, idPiso) => {
    const err = requerirSesion('plano:mover'); if (err) return err;
    return await planoDB.eliminarEscenarioFuturo(idEscenario, idPiso);
});

ipcMain.handle('plano:asignar', async (_e, idPiso, idEquipo, fila, col) => {
    const err = requerirSesion('plano:asignar'); if (err) return err;
    return await planoDB.asignar(usuarioActual.IdUsuario, idPiso, idEquipo, fila, col);
});

ipcMain.handle('plano:mover', async (_e, idEquipo, fila, col, filaAnt, colAnt, idPiso) => {
    const err = requerirSesion('plano:mover'); if (err) return err;
    return await planoDB.mover(usuarioActual.IdUsuario, idEquipo, fila, col, filaAnt, colAnt, idPiso);
});

ipcMain.handle('plano:quitar', async (_e, idEquipo, idPiso, hostname) => {
    const err = requerirSesion('plano:quitar'); if (err) return err;
    return await planoDB.quitar(usuarioActual.IdUsuario, idEquipo, idPiso, hostname);
});

ipcMain.handle('plano:intercambiar', async (_e, idA, idB, idPiso, hostA, hostB, filaA, colA, filaB, colB) => {
    const err = requerirSesion('plano:intercambiar'); if (err) return err;
    return await planoDB.intercambiar(usuarioActual.IdUsuario, idA, idB, idPiso, hostA, hostB, filaA, colA, filaB, colB);
});

ipcMain.handle('plano:listarZonas', async (_e, idPiso) => { const err = requerirSesion('plano:ver'); if (err) return err; return await planoDB.listarZonas(idPiso); });

ipcMain.handle('plano:guardarZona', async (_e, idPiso, anterior, nombre, color, celdas) => {
    const err = requerirSesion('plano:zonas:gestionar'); if (err) return err;
    return await planoDB.guardarZona(usuarioActual.IdUsuario, idPiso, anterior, nombre, color, celdas);
});

ipcMain.handle('plano:crearZona', async (_e, idPiso, nombre, color, celdas) => {
    const err = requerirSesion('plano:zonas:gestionar'); if (err) return err;
    return await planoDB.crearZona(usuarioActual.IdUsuario, idPiso, nombre, color, celdas);
});

ipcMain.handle('plano:actualizarZona', async (_e, idZona, nombre, color, fi, ff, ci, cf, idPiso) => {
    const err = requerirSesion('plano:zonas:gestionar'); if (err) return err;
    return await planoDB.actualizarZona(usuarioActual.IdUsuario, idPiso, idZona, nombre, color, fi, ff, ci, cf);
});

ipcMain.handle('plano:actualizarZonasPorNombre', async (_e, idPiso, nombreActual, colorActual, nombre, color, celdas) => {
    const err = requerirSesion('plano:zonas:gestionar'); if (err) return err;
    return await planoDB.actualizarZonasPorNombre(
        usuarioActual.IdUsuario, idPiso, nombreActual, colorActual, nombre, color, celdas
    );
});

ipcMain.handle('plano:eliminarZona', async (_e, idZona, idPiso, nombre) => {
    const err = requerirSesion('plano:zonas:eliminar'); if (err) return err;
    return await planoDB.eliminarZona(usuarioActual.IdUsuario, idPiso, idZona, nombre);
});

ipcMain.handle('plano:eliminarZonasPorNombre', async (_e, idPiso, nombre, color) => {
    const err = requerirSesion('plano:zonas:eliminar'); if (err) return err;
    return await planoDB.eliminarZonasPorNombre(usuarioActual.IdUsuario, idPiso, nombre, color);
});

ipcMain.handle('plano:moverEntrePisos', async (_e, idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos) => {
    const err = requerirSesion('plano:mover'); if (err) return err;
    return await planoDB.moverEntrePisos(
        usuarioActual.IdUsuario, idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos
    );
});

ipcMain.handle('plano:swapEntrePisos', async (_e, datos) => {
    const err = requerirSesion('plano:intercambiar'); if (err) return err;
    return await planoDB.swapEntrePisos(
        usuarioActual.IdUsuario,
        datos.idEquipoA, datos.idEquipoB,
        datos.idPisoA, datos.filaA, datos.colA,
        datos.idPisoB, datos.filaB, datos.colB,
        datos.hostA, datos.hostB
    );
});

ipcMain.handle('plano:listarZonasLibres', async (_e, idPiso) => { const err = requerirSesion('plano:ver'); if (err) return err; return await planoDB.listarZonasLibres(idPiso); });

ipcMain.handle('plano:guardarZonaLibre', async (_e, idPiso, nombre, color, celdas) => {
    const err = requerirSesion('plano:zonas:gestionar'); if (err) return err;
    return await planoDB.guardarZonaLibre(usuarioActual.IdUsuario, idPiso, nombre, color, celdas);
});

ipcMain.handle('plano:actualizarZonaLibre', async (_e, idPiso, nombreActual, colorActual, nombre, color, celdas) => {
    const err = requerirSesion('plano:zonas:gestionar'); if (err) return err;
    return await planoDB.actualizarZonaLibre(
        usuarioActual.IdUsuario, idPiso, nombreActual, colorActual, nombre, color, celdas
    );
});

ipcMain.handle('plano:eliminarZonaLibre', async (_e, idPiso, nombre, color) => {
    const err = requerirSesion('plano:zonas:eliminar'); if (err) return err;
    return await planoDB.eliminarZonaLibre(usuarioActual.IdUsuario, idPiso, nombre, color);
});

/* =========================================================
   IPC: EXPORTAR PDF DEL PLANO
   ========================================================= */
ipcMain.handle('plano:exportarPDF', async (_e, opciones) => {
    const err = requerirSesion('plano:exportar'); if (err) return err;

    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar PDF',
        defaultPath: opciones.nombreArchivo || `Plano-${Date.now()}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

    const esLandscape = (opciones.orientacion || 'landscape') === 'landscape';

    const winPDF = new BrowserWindow({
        width:  esLandscape ? 1600 : 1120,
        height: esLandscape ? 1120 : 1600,
        show: false,
        icon: ICONO_APP,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            offscreen: false
        }
    });

    let tmpPath = null;

    try {
        tmpPath = path.join(os.tmpdir(), `plano-${Date.now()}.html`);
        fs.writeFileSync(tmpPath, opciones.html, 'utf-8');

        await new Promise((resolve, reject) => {
            winPDF.webContents.once('did-finish-load', resolve);
            winPDF.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(`did-fail-load ${code}: ${desc}`)));
            winPDF.loadFile(tmpPath);
        });

        await new Promise(r => setTimeout(r, 900));

        const datosPDF = await winPDF.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            margins: { marginType: 'none' },
            landscape: esLandscape,
            pageSize: 'A3'
        });

        fs.writeFileSync(filePath, datosPDF);
        return { ok: true, mensaje: 'PDF generado', ruta: filePath };
    } catch (err) {
        console.error('[PDF] Error al generar:', err);
        return { ok: false, mensaje: 'Error al generar PDF: ' + err.message };
    } finally {
        if (!winPDF.isDestroyed()) winPDF.destroy();
        if (tmpPath && fs.existsSync(tmpPath)) {
            try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
    }
});

/* =========================================================
   IPC: DOCUMENTACIÓN
   ---------------------------------------------------------
   El archivo se guarda DENTRO de la base de datos en la columna
   Contenido VARBINARY(MAX) (scripts/documentacion.sql).
   NombreGuardado es una clave lógica que se genera aquí, no una
   ruta: al abrir o descargar se escribe una copia temporal en
   disco sólo porque el sistema operativo necesita un archivo real.
   ========================================================= */
const LIMITE_DOCUMENTO_BYTES = 60 * 1024 * 1024;

/** Carpeta de versiones anteriores del módulo (sólo lectura de respaldo). */
function carpetaDocumentosLegado() {
    return path.join(app.getPath('userData'), 'documentos');
}

function limpiarNombreArchivo(nombre) {
    return String(nombre || 'archivo')
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200) || 'archivo';
}

function extensionArchivo(nombre) {
    const ext = path.extname(String(nombre || '')).toLowerCase();
    return /^\.[a-z0-9]{1,12}$/.test(ext) ? ext : '';
}

/** Convierte lo que llega por IPC (ArrayBuffer/Uint8Array/Buffer) en Buffer. */
function bufferDeArchivo(archivo) {
    const datos = archivo?.datos;
    if (!datos) return null;
    if (Buffer.isBuffer(datos)) return datos;
    if (datos instanceof ArrayBuffer) return Buffer.from(new Uint8Array(datos));
    if (ArrayBuffer.isView(datos)) return Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength);
    if (Array.isArray(datos)) return Buffer.from(datos);
    return null;
}

/** Clave lógica única con la que se localiza el binario en la base. */
function nombreLogicoDocumento(nombreOriginal) {
    return `doc_${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}${extensionArchivo(nombreOriginal)}`;
}

function hashDocumento(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Carpeta temporal donde se materializa el archivo para abrirlo. */
function carpetaTemporalDocumentos() {
    const base = path.join(app.getPath('temp'), 'documentos-abrir');
    fs.mkdirSync(base, { recursive: true });
    return base;
}

function limpiarTemporales(base) {
    try {
        const limite = Date.now() - 24 * 60 * 60 * 1000;
        fs.readdirSync(base).forEach(nombre => {
            const ruta = path.join(base, nombre);
            try {
                if (fs.statSync(ruta).mtimeMs < limite) fs.unlinkSync(ruta);
            } catch (_) { /* archivo en uso: se deja para la próxima */ }
        });
    } catch (_) { /* la carpeta temporal es prescindible */ }
}

/**
 * Recupera el binario del documento desde la base de datos. Si el
 * registro se subió con la versión anterior del módulo (archivo en
 * disco, Contenido = NULL), se lee desde userData/documentos.
 */
async function obtenerArchivoDocumento(nombreGuardado) {
    const nombre = path.basename(String(nombreGuardado || ''));
    if (!nombre) return { ok: false, mensaje: 'No se recibió el archivo.' };

    let registro = null;
    try {
        registro = await documentosDB.obtenerArchivo(nombre);
    } catch (e) {
        return { ok: false, mensaje: 'No se pudo leer el archivo: ' + e.message };
    }

    if (registro?.contenido) {
        return {
            ok: true,
            datos: Buffer.from(registro.contenido),
            tipoMime: registro.tipoMime,
            nombreOriginal: registro.nombreOriginal
        };
    }

    try {
        const legado = path.join(carpetaDocumentosLegado(), nombre);
        if (fs.existsSync(legado)) {
            return {
                ok: true,
                datos: fs.readFileSync(legado),
                tipoMime: '',
                nombreOriginal: registro?.nombreOriginal || nombre
            };
        }
    } catch (_) { /* sin respaldo disponible */ }

    return { ok: false, mensaje: 'El archivo ya no está disponible en la base de datos.' };
}

/* ---------- Subida ---------- */
ipcMain.handle('documentos:subir', async (_e, datos) => {
    const err = requerirSesion('documentos:subir');
    if (err) return err;

    try {
        const seccion = String(datos?.seccion || '').trim();
        if (!seccion) return { ok: false, mensaje: 'Selecciona una sección.' };

        const archivo = datos?.archivo || {};
        const buffer = bufferDeArchivo(archivo);
        if (!buffer || !buffer.length) return { ok: false, mensaje: 'No se recibió el archivo.' };
        if (buffer.length > LIMITE_DOCUMENTO_BYTES) {
            const limiteMB = Math.round(LIMITE_DOCUMENTO_BYTES / (1024 * 1024));
            return { ok: false, mensaje: `El archivo supera el límite de ${limiteMB} MB.` };
        }

        const nombreOriginal = limpiarNombreArchivo(archivo.nombre);

        return await documentosDB.crear({
            seccion,
            titulo: datos?.titulo || nombreOriginal.replace(/\.[^.]+$/, ''),
            cliente: datos?.cliente,
            categoria: datos?.categoria,
            descripcion: datos?.descripcion,
            etiquetas: datos?.etiquetas,
            nombreOriginal,
            nombreGuardado: nombreLogicoDocumento(nombreOriginal),
            tipoMime: archivo.mime,
            tamanoBytes: buffer.length,
            hash: hashDocumento(buffer),
            contenido: buffer
        });
    } catch (e) {
        console.error('[Documentos] Error al subir:', e);
        return { ok: false, mensaje: 'No se pudo guardar el documento: ' + e.message };
    }
});

/* ---------- Nueva versión ---------- */
ipcMain.handle('documentos:agregarVersion', async (_e, id, archivo) => {
    const err = requerirSesion('documentos:editar');
    if (err) return err;
    if (!id) return { ok: false, mensaje: 'No se recibió el documento.' };

    const buffer = bufferDeArchivo(archivo);
    if (!buffer || !buffer.length) return { ok: false, mensaje: 'No se recibió el archivo.' };
    if (buffer.length > LIMITE_DOCUMENTO_BYTES) {
        const limiteMB = Math.round(LIMITE_DOCUMENTO_BYTES / (1024 * 1024));
        return { ok: false, mensaje: `El archivo supera el límite de ${limiteMB} MB.` };
    }

    const nombreOriginal = limpiarNombreArchivo(archivo?.nombre);
    try {
        return await documentosDB.agregarVersion(id, {
            nombreOriginal,
            nombreGuardado: nombreLogicoDocumento(nombreOriginal),
            tipoMime: archivo?.mime,
            tamanoBytes: buffer.length,
            hash: hashDocumento(buffer),
            contenido: buffer
        });
    } catch (e) {
        return { ok: false, mensaje: 'No se pudo registrar la versión: ' + e.message };
    }
});

/* ---------- Consultas ---------- */
ipcMain.handle('documentos:listar',     async (_e, opciones) => { const err = requerirSesion('documentos:listado:ver'); if (err) return err; return await documentosDB.listar(opciones || {}); });
ipcMain.handle('documentos:obtener',    async (_e, id)       => { const err = requerirSesion('documentos:listado:ver'); if (err) return err; return await documentosDB.obtener(id); });
ipcMain.handle('documentos:versiones',  async (_e, id)       => { const err = requerirSesion('documentos:listado:ver'); if (err) return err; return await documentosDB.listarVersiones(id); });
ipcMain.handle('documentos:etiquetas',  async ()             => { const err = requerirSesion('documentos:listado:ver'); if (err) return err; return await documentosDB.listarEtiquetas(); });

ipcMain.handle('documentos:actualizar', async (_e, id, datos) => {
    const err = requerirSesion('documentos:editar');
    if (err) return err;
    return await documentosDB.actualizar(id, datos);
});

/* ---------- Abrir / guardar copia (binario desde la base) ---------- */
ipcMain.handle('documentos:abrir', async (_e, nombreGuardado) => {
    const err = requerirSesion('documentos:descargar');
    if (err) return err;

    const archivo = await obtenerArchivoDocumento(nombreGuardado);
    if (!archivo.ok) return { ok: false, mensaje: archivo.mensaje };

    try {
        const base = carpetaTemporalDocumentos();
        limpiarTemporales(base);

        const destino = path.join(
            base,
            `${Date.now().toString(36)}_${path.basename(archivo.nombreOriginal || 'documento')}`
        );
        fs.writeFileSync(destino, archivo.datos);

        const resultado = await shell.openPath(destino);
        if (resultado) return { ok: false, mensaje: 'No se pudo abrir el archivo: ' + resultado };
        return { ok: true, mensaje: 'Archivo abierto.' };
    } catch (error) {
        return { ok: false, mensaje: 'No se pudo preparar el archivo: ' + error.message };
    }
});

ipcMain.handle('documentos:guardarComo', async (e, nombreGuardado, nombreSugerido) => {
    const err = requerirSesion('documentos:descargar');
    if (err) return err;

    const archivo = await obtenerArchivoDocumento(nombreGuardado);
    if (!archivo.ok) return { ok: false, mensaje: archivo.mensaje };

    const ventana = BrowserWindow.fromWebContents(e.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(ventana, {
        title: 'Guardar copia del documento',
        defaultPath: nombreSugerido || archivo.nombreOriginal || 'documento'
    });
    if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

    try {
        fs.writeFileSync(filePath, archivo.datos);
        return { ok: true, mensaje: 'Copia guardada correctamente.', ruta: filePath };
    } catch (error) {
        return { ok: false, mensaje: 'No se pudo guardar la copia: ' + error.message };
    }
});

/* ---------- Papelera ---------- */
ipcMain.handle('documentos:papelera',  async (_e, id) => { const err = requerirSesion('documentos:eliminar'); if (err) return err; return await documentosDB.moverAPapelera(id); });
ipcMain.handle('documentos:restaurar', async (_e, id) => { const err = requerirSesion('documentos:eliminar'); if (err) return err; return await documentosDB.restaurar(id); });

ipcMain.handle('documentos:eliminar', async (_e, id) => {
    const err = requerirSesion('documentos:eliminar');
    if (err) return err;
    return await documentosDB.eliminar(id);
});

/* ---------- Secciones (menú dinámico) ---------- */
ipcMain.handle('documentos:secciones',           async ()             => { const err = requerirSesion('documentos:listado:ver'); if (err) return err; return await documentosDB.listarSecciones(); });
ipcMain.handle('documentos:seccion:crear',       async (_e, datos)    => { const err = requerirSesion('documentos:secciones:gestionar'); if (err) return err; return await documentosDB.crearSeccion(datos); });
ipcMain.handle('documentos:seccion:actualizar',  async (_e, id, datos) => { const err = requerirSesion('documentos:secciones:gestionar'); if (err) return err; return await documentosDB.actualizarSeccion(id, datos); });
ipcMain.handle('documentos:seccion:eliminar',    async (_e, id)       => { const err = requerirSesion('documentos:secciones:gestionar'); if (err) return err; return await documentosDB.eliminarSeccion(id); });

/* =========================================================
   CICLO DE VIDA
   ========================================================= */
const ARCHIVO_INSTALACION = 'instalacion.json';
const ARCHIVO_VERSION_LEGADO = 'app-version.txt';

/**
 * Origen real de la instalación en uso.
 * En builds portables el ejecutable se descomprime en una carpeta temporal
 * distinta en cada arranque, por eso se usa la carpeta del .exe portable.
 */
function origenInstalacion() {
    if (!app.isPackaged) return __dirname;
    return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
}

function usuarioWindows() {
    try {
        return String(os.userInfo().username || '').toLowerCase();
    } catch (_) {
        return String(process.env.USERNAME || process.env.USER || '').toLowerCase();
    }
}

function normalizarRuta(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    try {
        return path.resolve(texto).toLowerCase();
    } catch (_) {
        return texto.toLowerCase();
    }
}

function huellaInstalacion() {
    return {
        usuario: usuarioWindows(),
        origen: normalizarRuta(origenInstalacion())
    };
}

function leerMarcaInstalacion(ruta) {
    try {
        if (!fs.existsSync(ruta)) return null;
        const contenido = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        return contenido && typeof contenido === 'object' ? contenido : null;
    } catch (error) {
        console.warn('[Conexión] No se pudo leer la marca de instalación:', error.message);
        return null;
    }
}

/**
 * Conserva la conexión cifrada al instalar una versión nueva.
 * Solo se descarta cuando cambia el usuario de Windows o el origen de la
 * instalación (otra carpeta / otra copia portable); en ese caso se vuelve a
 * solicitar la configuración. Si todavía no existe la marca (actualización
 * desde una versión anterior), se adopta la instalación actual y se conserva
 * la conexión, que además DPAPI solo puede descifrar con el mismo usuario.
 */
function conservarConexionEntreVersiones() {
    const dataDir = app.getPath('userData');
    const rutaMarca = path.join(dataDir, ARCHIVO_INSTALACION);
    const anterior = leerMarcaInstalacion(rutaMarca);
    const actual = huellaInstalacion();

    const mismaInstalacion = !!anterior &&
        String(anterior.usuario || '').toLowerCase() === actual.usuario &&
        normalizarRuta(anterior.origen) === actual.origen &&
        actual.origen !== '';

    if (anterior && !mismaInstalacion) {
        credencialesDB.eliminar();
        console.log(
            `[Conexión] Instalación distinta (origen "${anterior.origen || '?'}", usuario "${anterior.usuario || '?'}"). ` +
            'Se solicitará la conexión de nuevo.'
        );
    } else if (!anterior) {
        console.log('[Conexión] Marca de instalación creada; se conserva la conexión guardada si existe.');
    }

    const marca = {
        usuario: actual.usuario,
        origen: actual.origen,
        version: app.getVersion(),
        actualizado: new Date().toISOString()
    };
    fs.writeFileSync(rutaMarca, JSON.stringify(marca, null, 2), { encoding: 'utf8', mode: 0o600 });

    // Archivo de control de versiones anteriores; ya no se usa.
    const rutaVersion = path.join(dataDir, ARCHIVO_VERSION_LEGADO);
    try {
        if (fs.existsSync(rutaVersion)) fs.unlinkSync(rutaVersion);
    } catch (_) { /* irrelevante */ }
}

app.whenReady().then(() => {
    if (app.isPackaged) {
        try {
            conservarConexionEntreVersiones();
        } catch (error) {
            console.error('[Conexión] No se pudo verificar el origen de la instalación:', error);
            dialog.showErrorBox(
                'No se pudo preparar la instalación',
                'No se pudo verificar el origen de la instalación para reutilizar la conexión guardada. ' +
                'La aplicación se cerrará para evitar usar datos obsoletos.\n\n' + error.message
            );
            app.quit();
            return;
        }
    }

    construirMenuApp();
    try {
        let configuracion = credencialesDB.cargar();
        if (!configuracion) {
            configuracion = credencialesDB.desdeEntorno();
            if (configuracion) credencialesDB.guardar(configuracion);
        }
        if (configuracion) crearLoginWindow();
        else crearConfiguracionDBWindow();
    } catch (error) {
        console.error('[Configuración DB] Se requiere configurar o reparar la conexión:', error.message);
        crearConfiguracionDBWindow();
    }

    if (app.isPackaged) {
        setTimeout(() => verificarActualizaciones(false), 3000);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            try {
                if (credencialesDB.cargar()) crearLoginWindow();
                else crearConfiguracionDBWindow();
            } catch (error) {
                console.error('[App] No se pudo recuperar la configuración de inicio:', error.message);
                crearConfiguracionDBWindow();
            }
        }
    });
});

app.on('window-all-closed', () => {
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