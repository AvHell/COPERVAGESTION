const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

/* =========================================================
   BASE DE DATOS — MÓDULOS EXISTENTES
   ========================================================= */
const clientesDB   = require('./db/clientes');
const rolesDB      = require('./db/roles');
const lugaresDB    = require('./db/lugares');
const rangosDB     = require('./db/rangos');
const equiposDB    = require('./db/equipos');
const planoDB      = require('./db/plano');
const usuariosDB   = require('./db/usuarios');
const historicosDB = require('./db/historicos');
const dominiosDB   = require('./db/dominios');
const configDB     = require('./db/configuraciones');

/* =========================================================
   BASE DE DATOS — MÓDULO ACTIVO FIJO (aislado)
   ========================================================= */
const activoFijoCatalogosDB   = require('../ActivoFijo/consultas/catalogos');
const activoFijoActivosDB     = require('../ActivoFijo/consultas/activos');
const activoFijoResponsivasDB = require('../ActivoFijo/consultas/responsivas');
const activoFijoReportesDB = require('../ActivoFijo/consultas/reportes');

/* =========================================================
   RUTAS
   ========================================================= */
const ventanas   = {};
const HTML       = path.join(__dirname, '../html');
const HTML_AF    = path.join(__dirname, '..', 'ActivoFijo', 'html');
const PRELOAD    = path.join(__dirname, 'preload.js');
const PRELOAD_AF = path.join(__dirname, '..', 'ActivoFijo', 'preload-activofijo.js');

/* =========================================================
   ESTADO GLOBAL
   ========================================================= */
let usuarioActual = null;

/* =========================================================
   OPCIONES DE ARRANQUE
   ========================================================= */
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

/* =========================================================
   MENÚ DE LA APLICACIÓN
   ========================================================= */
function construirMenuApp() {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                {
                    label: 'Recargar',
                    accelerator: 'F5',
                    click: (_item, win) => { if (win) win.reload(); }
                },
                {
                    label: 'Forzar recarga',
                    accelerator: 'Ctrl+Shift+R',
                    click: (_item, win) => { if (win) win.webContents.reloadIgnoringCache(); }
                },
                { type: 'separator' },
                {
                    label: 'Salir',
                    accelerator: 'Alt+F4',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { role: 'undo',         label: 'Deshacer' },
                { role: 'redo',         label: 'Rehacer' },
                { type: 'separator' },
                { role: 'cut',          label: 'Cortar' },
                { role: 'copy',         label: 'Copiar' },
                { role: 'paste',        label: 'Pegar' },
                { role: 'selectAll',    label: 'Seleccionar todo' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { role: 'resetZoom',    label: 'Zoom normal' },
                { role: 'zoomIn',       label: 'Acercar' },
                { role: 'zoomOut',      label: 'Alejar' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Pantalla completa' },
                { type: 'separator' },
                {
                    label: 'Herramientas de desarrollo',
                    accelerator: 'Ctrl+Shift+I',
                    click: (_item, win) => { if (win) win.webContents.toggleDevTools(); }
                }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { role: 'minimize',     label: 'Minimizar' },
                { role: 'close',        label: 'Cerrar' }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Acerca de',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Acerca de',
                            message: 'Inventario de Equipos',
                            detail: 'Sistema interno de gestión de red · v1.0'
                        });
                    }
                }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* =========================================================
   FÁBRICA DE VENTANAS
   ========================================================= */
function crearVentana(nombre, archivo, opciones = {}) {
    if (ventanas[nombre] && !ventanas[nombre].isDestroyed()) {
        ventanas[nombre].focus();
        return ventanas[nombre];
    }

    const basePath     = opciones.basePath     || HTML;
    const preloadPath  = opciones.preload      || PRELOAD;

    const win = new BrowserWindow({
        width:  opciones.width  || 1000,
        height: opciones.height || 700,
        title:  opciones.title  || nombre,
        show: false,
        resizable: opciones.resizable !== false,
        autoHideMenuBar: false,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.setMenuBarVisibility(true);

    win.loadFile(path.join(basePath, archivo));

    if (opciones.maximizar !== false) {
        win.once('ready-to-show', () => { win.maximize(); win.show(); });
    } else {
        win.once('ready-to-show', () => win.show());
    }

    ventanas[nombre] = win;
    win.on('closed', () => { ventanas[nombre] = null; });

    return win;
}

/* =========================================================
   VENTANAS — SISTEMA EXISTENTE
   ========================================================= */
const crearLoginWindow     = () => crearVentana('login',     'login.html',     { width: 420, height: 500, title: 'Iniciar sesión', maximizar: false, resizable: false });
const crearMenuWindow      = () => crearVentana('menu',      'menu.html',      { title: 'Menú Principal' });
const crearClientesWindow  = () => crearVentana('clientes',  'clientes.html',  { title: 'Clientes' });
const crearRolesWindow     = () => crearVentana('roles',     'roles.html',     { title: 'Roles de Equipo' });
const crearLugaresWindow   = () => crearVentana('lugares',   'lugares.html',   { title: 'Lugares de Clientes' });
const crearRangosWindow    = () => crearVentana('rangos',    'rangos.html',    { title: 'Rangos IP' });
const crearEquiposWindow   = () => crearVentana('equipos',   'equipos.html',   { title: 'Equipos' });
const crearPlanoWindow     = () => crearVentana('plano',     'plano.html',     { title: 'Plano Visual' });
const crearUsuariosWindow  = () => crearVentana('usuarios',  'usuarios.html',  { title: 'Usuarios' });
const crearHistoricoWindow = () => crearVentana('historico', 'historico.html', { title: 'Histórico del Plano' });
const crearDominiosWindow  = () => crearVentana('dominios',  'dominios.html',  { title: 'Dominios Admin' });
const crearConfigRedWindow = () => crearVentana('configred', 'configred.html', { title: 'Configuraciones de Red' });

/* =========================================================
   VENTANAS — MÓDULO ACTIVO FIJO
   ========================================================= */
const crearActivoFijoCatalogosWindow = () => crearVentana(
    'activofijo-catalogos',
    'catalogos.html',
    {
        title:    'Catálogos - Activo Fijo',
        basePath: HTML_AF,
        preload:  PRELOAD_AF
    }
);

const crearActivoFijoActivosWindow = () => crearVentana(
    'activofijo-activos',
    'activos.html',
    {
        title:    'Inventario - Activo Fijo',
        basePath: HTML_AF,
        preload:  PRELOAD_AF
    }
);

const crearActivoFijoResponsivasWindow = () => crearVentana(
    'activofijo-responsivas',
    'responsivas.html',
    {
        title:    'Responsivas - Activo Fijo',
        basePath: HTML_AF,
        preload:  PRELOAD_AF
    }
);

const crearActivoFijoReportesWindow = () => crearVentana(
    'activofijo-reportes',
    'reportes.html',
    {
        title:    'Reportes - Activo Fijo',
        basePath: HTML_AF,
        preload:  PRELOAD_AF
    }
);

/* =========================================================
   UTILIDADES
   ========================================================= */
function cerrarVentana(nombre) {
    if (ventanas[nombre] && !ventanas[nombre].isDestroyed()) {
        ventanas[nombre].close();
    }
}

function asegurarMenuAbierto() {
    if (!ventanas['menu'] || ventanas['menu'].isDestroyed()) {
        crearMenuWindow();
    } else {
        if (ventanas['menu'].isMinimized()) ventanas['menu'].restore();
        ventanas['menu'].focus();
    }
}

/* =========================================================
   IPC: LOGIN
   ========================================================= */
ipcMain.handle('login', async (_e, nombreUsuario, password) => {
    const res = await usuariosDB.login(nombreUsuario, password);
    if (res.ok) usuarioActual = res.usuario;
    return res;
});

ipcMain.handle('logout', () => {
    usuarioActual = null;
    return { ok: true };
});

ipcMain.handle('usuario-actual', () => usuarioActual);

/* =========================================================
   IPC: ABRIR VENTANAS DEL SISTEMA
   ========================================================= */
ipcMain.handle('abrir-menu', () => {
    cerrarVentana('login');
    asegurarMenuAbierto();
    return { ok: true };
});

ipcMain.handle('abrir-clientes',  () => { crearClientesWindow();  return { ok: true }; });
ipcMain.handle('abrir-roles',     () => { crearRolesWindow();     return { ok: true }; });
ipcMain.handle('abrir-lugares',   () => { crearLugaresWindow();   return { ok: true }; });
ipcMain.handle('abrir-rangos',    () => { crearRangosWindow();    return { ok: true }; });
ipcMain.handle('abrir-equipos',   () => { crearEquiposWindow();   return { ok: true }; });
ipcMain.handle('abrir-plano',     () => { crearPlanoWindow();     return { ok: true }; });
ipcMain.handle('abrir-usuarios',  () => { crearUsuariosWindow();  return { ok: true }; });
ipcMain.handle('abrir-historico', () => { crearHistoricoWindow(); return { ok: true }; });
ipcMain.handle('abrir-dominios',  () => { crearDominiosWindow();  return { ok: true }; });
ipcMain.handle('abrir-configred', () => { crearConfigRedWindow(); return { ok: true }; });

ipcMain.handle('volver-menu', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.close();
    asegurarMenuAbierto();
    return { ok: true };
});

/* =========================================================
   IPC: ABRIR VENTANAS DE ACTIVO FIJO
   ========================================================= */
ipcMain.handle('abrir-activofijo-catalogos',   () => { crearActivoFijoCatalogosWindow();   return { ok: true }; });
ipcMain.handle('abrir-activofijo-activos',     () => { crearActivoFijoActivosWindow();     return { ok: true }; });
ipcMain.handle('abrir-activofijo-responsivas', () => { crearActivoFijoResponsivasWindow(); return { ok: true }; });
ipcMain.handle('abrir-activofijo-reportes', () => { crearActivoFijoReportesWindow(); return { ok: true }; });

/* Alias con prefijo af-* */
ipcMain.handle('af-abrir-catalogos',   () => { crearActivoFijoCatalogosWindow();   return { ok: true }; });
ipcMain.handle('af-abrir-activos',     () => { crearActivoFijoActivosWindow();     return { ok: true }; });
ipcMain.handle('af-abrir-responsivas', () => { crearActivoFijoResponsivasWindow(); return { ok: true }; });

/* =========================================================
   IPC: CATÁLOGOS DE ACTIVO FIJO
   ========================================================= */
ipcMain.handle('af-catalogos-listar',     async (_e, clave)            => await activoFijoCatalogosDB.listar(clave));
ipcMain.handle('af-catalogos-crear',      async (_e, clave, datos)     => await activoFijoCatalogosDB.crear(clave, datos));
ipcMain.handle('af-catalogos-actualizar', async (_e, clave, id, datos) => await activoFijoCatalogosDB.actualizar(clave, id, datos));
ipcMain.handle('af-catalogos-eliminar',   async (_e, clave, id)        => await activoFijoCatalogosDB.eliminar(clave, id));

/* =========================================================
   IPC: ACTIVOS DE ACTIVO FIJO
   ========================================================= */
ipcMain.handle('af-activos-listar',     async (_e, filtros) => await activoFijoActivosDB.listar(filtros || {}));
ipcMain.handle('af-activos-obtener',    async (_e, id)      => await activoFijoActivosDB.obtener(id));
ipcMain.handle('af-activos-crear',      async (_e, datos)   => await activoFijoActivosDB.crear(datos, usuarioActual?.IdUsuario));
ipcMain.handle('af-activos-actualizar', async (_e, id, datos) => await activoFijoActivosDB.actualizar(id, datos, usuarioActual?.IdUsuario));
ipcMain.handle('af-activos-eliminar',   async (_e, id)      => await activoFijoActivosDB.eliminar(id));

ipcMain.handle('af-activos-lista-tipos',    async () => await activoFijoActivosDB.listarTipos());
ipcMain.handle('af-activos-lista-marcas',   async () => await activoFijoActivosDB.listarMarcas());
ipcMain.handle('af-activos-lista-estados',  async () => await activoFijoActivosDB.listarEstados());
ipcMain.handle('af-activos-lista-estatus',  async () => await activoFijoActivosDB.listarEstatus());
ipcMain.handle('af-activos-lista-carteras', async () => await activoFijoActivosDB.listarCarteras());

/* =========================================================
   IPC: RESPONSIVAS DE ACTIVO FIJO
   ========================================================= */
ipcMain.handle('af-resp-listar',              async (_e, filtros)      => await activoFijoResponsivasDB.listar(filtros || {}));
ipcMain.handle('af-resp-obtener',             async (_e, id)           => await activoFijoResponsivasDB.obtener(id));
ipcMain.handle('af-resp-activos-disponibles', async ()                 => await activoFijoResponsivasDB.activosDisponibles());
ipcMain.handle('af-resp-crear',               async (_e, datos)        => await activoFijoResponsivasDB.crear(datos, usuarioActual?.IdUsuario));
ipcMain.handle('af-resp-actualizar',          async (_e, id, datos)    => await activoFijoResponsivasDB.actualizar(id, datos, usuarioActual?.IdUsuario));
ipcMain.handle('af-resp-devolver',            async (_e, id, f, obs)   => await activoFijoResponsivasDB.devolver(id, f, obs, usuarioActual?.IdUsuario));
ipcMain.handle('af-resp-eliminar',            async (_e, id)           => await activoFijoResponsivasDB.eliminar(id));
ipcMain.handle('af-resp-lista-carteras',      async ()                 => await activoFijoResponsivasDB.listarCarteras());
ipcMain.handle('af-resp-lista-puestos',       async ()                 => await activoFijoResponsivasDB.listarPuestos());


/* =========================================================
   IPC: REPORTES DE ACTIVO FIJO
   ========================================================= */
ipcMain.handle('af-rep-resumen-general',       async () => await activoFijoReportesDB.resumenGeneral());
ipcMain.handle('af-rep-resumen-tipo',          async () => await activoFijoReportesDB.resumenPorTipo());
ipcMain.handle('af-rep-resumen-cartera',       async () => await activoFijoReportesDB.resumenPorCartera());
ipcMain.handle('af-rep-inventario',            async (_e, filtros) => await activoFijoReportesDB.inventario(filtros || {}));
ipcMain.handle('af-rep-responsivas-activas',   async () => await activoFijoReportesDB.responsivasActivas());
ipcMain.handle('af-rep-asignaciones-persona',  async () => await activoFijoReportesDB.asignacionesPorPersona());
ipcMain.handle('af-rep-por-ticket',            async () => await activoFijoReportesDB.porTicket());
ipcMain.handle('af-rep-historial-asignaciones',async (_e, filtros) => await activoFijoReportesDB.historialAsignaciones(filtros || {}));
ipcMain.handle('af-rep-historial-activo',      async (_e, id) => await activoFijoReportesDB.historialActivo(id));
ipcMain.handle('af-rep-celulares',             async () => await activoFijoReportesDB.celulares());
ipcMain.handle('af-rep-laptops',               async () => await activoFijoReportesDB.laptops());

ipcMain.handle('af-rep-tipos',                 async () => await activoFijoReportesDB.tiposParaFiltro());
ipcMain.handle('af-rep-estados',               async () => await activoFijoReportesDB.estadosParaFiltro());
ipcMain.handle('af-rep-estatus',               async () => await activoFijoReportesDB.estatusParaFiltro());
ipcMain.handle('af-rep-carteras',              async () => await activoFijoReportesDB.carterasParaFiltro());

ipcMain.handle('af-abrir-reportes', () => { crearActivoFijoReportesWindow(); return { ok: true }; });

/* =========================================================
   IPC: CLIENTES / ROLES / LUGARES / RANGOS
   ========================================================= */
ipcMain.handle('clientes:listar',     async () => await clientesDB.listar());
ipcMain.handle('clientes:crear',      async (_e, codigo, nombre) => await clientesDB.crear(codigo, nombre));
ipcMain.handle('clientes:actualizar', async (_e, id, codigo, nombre) => await clientesDB.actualizar(id, codigo, nombre));
ipcMain.handle('clientes:eliminar',   async (_e, id) => await clientesDB.eliminar(id));

ipcMain.handle('roles:listar',     async () => await rolesDB.listar());
ipcMain.handle('roles:crear',      async (_e, codigo, nombre, descripcion) => await rolesDB.crear(codigo, nombre, descripcion));
ipcMain.handle('roles:actualizar', async (_e, id, codigo, nombre, descripcion) => await rolesDB.actualizar(id, codigo, nombre, descripcion));
ipcMain.handle('roles:eliminar',   async (_e, id) => await rolesDB.eliminar(id));

ipcMain.handle('lugares:listar',     async () => await lugaresDB.listar());
ipcMain.handle('lugares:crear',      async (_e, idCliente, nombre) => await lugaresDB.crear(idCliente, nombre));
ipcMain.handle('lugares:actualizar', async (_e, id, idCliente, nombre) => await lugaresDB.actualizar(id, idCliente, nombre));
ipcMain.handle('lugares:eliminar',   async (_e, id) => await lugaresDB.eliminar(id));

ipcMain.handle('rangos:listar',     async () => await rangosDB.listar());
ipcMain.handle('rangos:crear',      async (_e, idCliente, idLugar, nombre, ipInicio, ipFin, desc) => await rangosDB.crear(idCliente, idLugar, nombre, ipInicio, ipFin, desc));
ipcMain.handle('rangos:actualizar', async (_e, id, idCliente, idLugar, nombre, ipInicio, ipFin, desc) => await rangosDB.actualizar(id, idCliente, idLugar, nombre, ipInicio, ipFin, desc));
ipcMain.handle('rangos:eliminar',   async (_e, id) => await rangosDB.eliminar(id));

/* =========================================================
   IPC: EQUIPOS
   ========================================================= */
ipcMain.handle('equipos:listar',               async () => await equiposDB.listar());
ipcMain.handle('equipos:crear',                async (_e, datos) => await equiposDB.crear(datos));
ipcMain.handle('equipos:actualizar',           async (_e, id, datos) => await equiposDB.actualizar(id, datos));
ipcMain.handle('equipos:eliminar',             async (_e, id) => await equiposDB.eliminar(id));
ipcMain.handle('equipos:verificarIPDuplicada', async (_e, ip, idExcluir) => await equiposDB.verificarIPDuplicada(ip, idExcluir));

/* =========================================================
   IPC: DOMINIOS
   ========================================================= */
ipcMain.handle('dominios:listarPorCliente', async (_e, idCliente) => await dominiosDB.listarPorCliente(idCliente));
ipcMain.handle('dominios:listarTodas',      async (_e, filtros) => await dominiosDB.listarTodas(filtros));
ipcMain.handle('dominios:crear',            async (_e, idCliente, u, p, d) => await dominiosDB.crear(idCliente, u, p, d));
ipcMain.handle('dominios:actualizar',       async (_e, id, u, p, d) => await dominiosDB.actualizar(id, u, p, d));
ipcMain.handle('dominios:eliminar',         async (_e, id) => await dominiosDB.eliminar(id));

/* =========================================================
   IPC: CONFIGURACIONES DE RED
   ========================================================= */
ipcMain.handle('config:listarPorClienteTipo', async (_e, idCliente, tipo) => await configDB.listarPorClienteTipo(idCliente, tipo));
ipcMain.handle('config:listarTodas',          async (_e, filtros) => await configDB.listarTodas(filtros));
ipcMain.handle('config:crear',                async (_e, idCliente, tipo, valor, desc) => await configDB.crear(idCliente, tipo, valor, desc));
ipcMain.handle('config:actualizar',           async (_e, id, valor, desc) => await configDB.actualizar(id, valor, desc));
ipcMain.handle('config:eliminar',             async (_e, id) => await configDB.eliminar(id));

/* =========================================================
   IPC: USUARIOS / HISTÓRICOS
   ========================================================= */
ipcMain.handle('usuarios:listar',     async () => await usuariosDB.listar());
ipcMain.handle('usuarios:crear',      async (_e, datos) => await usuariosDB.crear(datos));
ipcMain.handle('usuarios:actualizar', async (_e, id, datos) => await usuariosDB.actualizar(id, datos));
ipcMain.handle('usuarios:eliminar',   async (_e, id) => await usuariosDB.eliminar(id));

ipcMain.handle('historicos:listarPorLugar', async (_e, idLugar) => await historicosDB.listarPorLugar(idLugar));

/* =========================================================
   IPC: PLANO
   ========================================================= */
ipcMain.handle('plano:dimensiones', async (_e, idLugar) => await planoDB.obtenerDimensiones(idLugar));

ipcMain.handle('plano:actualizarDim', async (_e, idLugar, filas, columnas) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.actualizarDimensiones(usuarioActual.IdUsuario, idLugar, filas, columnas);
});

ipcMain.handle('plano:listarPorLugar', async (_e, idLugar) => await planoDB.listarPorLugar(idLugar));
ipcMain.handle('plano:sinUbicacion',   async (_e, idLugar) => await planoDB.equiposSinUbicacion(idLugar));

ipcMain.handle('plano:asignar', async (_e, idLugar, idEquipo, fila, col) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.asignar(usuarioActual.IdUsuario, idLugar, idEquipo, fila, col);
});

ipcMain.handle('plano:mover', async (_e, idEquipo, fila, col, filaAnt, colAnt, idLugar) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.mover(usuarioActual.IdUsuario, idEquipo, fila, col, filaAnt, colAnt, idLugar);
});

ipcMain.handle('plano:quitar', async (_e, idEquipo, idLugar, hostname) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.quitar(usuarioActual.IdUsuario, idEquipo, idLugar, hostname);
});

ipcMain.handle('plano:intercambiar', async (_e, idA, idB, idLugar, hostA, hostB, filaA, colA, filaB, colB) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.intercambiar(usuarioActual.IdUsuario, idA, idB, idLugar, hostA, hostB, filaA, colA, filaB, colB);
});

ipcMain.handle('plano:listarZonas', async (_e, idLugar) => await planoDB.listarZonas(idLugar));

ipcMain.handle('plano:crearZona', async (_e, idLugar, nombre, color, fi, ff, ci, cf) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.crearZona(usuarioActual.IdUsuario, idLugar, nombre, color, fi, ff, ci, cf);
});

ipcMain.handle('plano:actualizarZona', async (_e, idZona, nombre, color, fi, ff, ci, cf, idLugar) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.actualizarZona(usuarioActual.IdUsuario, idLugar, idZona, nombre, color, fi, ff, ci, cf);
});

ipcMain.handle('plano:eliminarZona', async (_e, idZona, idLugar, nombre) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.eliminarZona(usuarioActual.IdUsuario, idLugar, idZona, nombre);
});

ipcMain.handle('plano:moverEntrePisos', async (_e, idEquipo, idLugarOrigen, idLugarDestino, fila, columna, nuevosDatos) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.moverEntrePisos(
        usuarioActual.IdUsuario, idEquipo, idLugarOrigen, idLugarDestino, fila, columna, nuevosDatos
    );
});

ipcMain.handle('plano:swapEntrePisos', async (_e, datos) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.swapEntrePisos(
        usuarioActual.IdUsuario,
        datos.idEquipoA, datos.idEquipoB,
        datos.idPisoA, datos.filaA, datos.colA,
        datos.idPisoB, datos.filaB, datos.colB,
        datos.hostA, datos.hostB
    );
});

ipcMain.handle('plano:listarZonasLibres', async (_e, idLugar) => await planoDB.listarZonasLibres(idLugar));

ipcMain.handle('plano:guardarZonaLibre', async (_e, idLugar, nombre, color, celdas) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.guardarZonaLibre(usuarioActual.IdUsuario, idLugar, nombre, color, celdas);
});

ipcMain.handle('plano:eliminarZonaLibre', async (_e, idLugar, nombre, color) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.eliminarZonaLibre(usuarioActual.IdUsuario, idLugar, nombre, color);
});

/* =========================================================
   IPC: EXPORTAR PDF
   ========================================================= */
ipcMain.handle('plano:exportarPDF', async (_e, opciones) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');

    const winPDF = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
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

        if (canceled || !filePath) {
            return { ok: false, mensaje: 'Cancelado' };
        }

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
            try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
        }
    }
});

/* =========================================================
   CICLO DE VIDA
   ========================================================= */
app.whenReady().then(() => {
    construirMenuApp();
    crearLoginWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) crearLoginWindow();
    });
});

app.on('window-all-closed', () => {
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