const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

const ventanas = {};
const HTML = path.join(__dirname, '../html');

let usuarioActual = null;

/* =========================================================
   FÁBRICA DE VENTANAS
   ========================================================= */

function crearVentana(nombre, archivo, opciones = {}) {
    if (ventanas[nombre] && !ventanas[nombre].isDestroyed()) {
        ventanas[nombre].focus();
        return;
    }
    const win = new BrowserWindow({
        width: opciones.width  || 1000,
        height: opciones.height || 700,
        title: opciones.title || nombre,
        show: false,
        resizable: opciones.resizable !== false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(HTML, archivo));

    if (opciones.maximizar !== false) {
        win.once('ready-to-show', () => { win.maximize(); win.show(); });
    } else {
        win.once('ready-to-show', () => win.show());
    }

    ventanas[nombre] = win;
    win.on('closed', () => { ventanas[nombre] = null; });
}

/* =========================================================
   VENTANAS
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
   IPC: LOGIN
   ========================================================= */

ipcMain.handle('login', async (_e, nombreUsuario, password) => {
    const res = await usuariosDB.login(nombreUsuario, password);
    if (res.ok) usuarioActual = res.usuario;
    return res;
});

ipcMain.handle('logout', () => { usuarioActual = null; return { ok: true }; });
ipcMain.handle('usuario-actual', () => usuarioActual);

/* =========================================================
   IPC: ABRIR VENTANAS
   ========================================================= */

ipcMain.handle('abrir-menu',      () => crearMenuWindow());
ipcMain.handle('abrir-clientes',  () => crearClientesWindow());
ipcMain.handle('abrir-roles',     () => crearRolesWindow());
ipcMain.handle('abrir-lugares',   () => crearLugaresWindow());
ipcMain.handle('abrir-rangos',    () => crearRangosWindow());
ipcMain.handle('abrir-equipos',   () => crearEquiposWindow());
ipcMain.handle('abrir-plano',     () => crearPlanoWindow());
ipcMain.handle('abrir-usuarios',  () => crearUsuariosWindow());
ipcMain.handle('abrir-historico', () => crearHistoricoWindow());
ipcMain.handle('abrir-dominios',  () => crearDominiosWindow());
ipcMain.handle('abrir-configred', () => crearConfigRedWindow());

ipcMain.handle('volver-menu', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.close();
});

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
   IPC: DOMINIOS (por cliente)
   ========================================================= */

ipcMain.handle('dominios:listarPorCliente', async (_e, idCliente) => await dominiosDB.listarPorCliente(idCliente));
ipcMain.handle('dominios:listarTodas',      async (_e, filtros) => await dominiosDB.listarTodas(filtros));
ipcMain.handle('dominios:crear',            async (_e, idCliente, u, p, d) => await dominiosDB.crear(idCliente, u, p, d));
ipcMain.handle('dominios:actualizar',       async (_e, id, u, p, d) => await dominiosDB.actualizar(id, u, p, d));
ipcMain.handle('dominios:eliminar',         async (_e, id) => await dominiosDB.eliminar(id));

/* =========================================================
   IPC: CONFIGURACIONES DE RED (por cliente)
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

ipcMain.handle('plano:dimensiones',    async (_e, idLugar) => await planoDB.obtenerDimensiones(idLugar));

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

/* =========================================================
   IPC: EXPORTAR PDF
   ========================================================= */

ipcMain.handle('plano:exportarPDF', async (_e, htmlPlano, nombreArchivo) => {
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

    try {
        const htmlCompleto = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
                        margin: 0;
                        padding: 40px;
                        background: #fff;
                        color: #1e293b;
                    }
                    .encabezado {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 3px solid #1e293b;
                    }
                    .encabezado h1 {
                        margin: 0 0 8px 0;
                        font-size: 1.6rem;
                        color: #1e293b;
                    }
                    .encabezado p {
                        margin: 0;
                        color: #64748b;
                        font-size: 0.9rem;
                    }
                    .grid-plano {
                        display: grid;
                        gap: 6px;
                        background: #e2e8f0;
                        padding: 14px;
                        border-radius: 10px;
                        width: fit-content;
                        margin: 0 auto;
                        border: 2px solid #cbd5e1;
                    }
                    .celda {
                        width: 100px;
                        height: 76px;
                        background: #fff;
                        border: 2px dashed #cbd5e1;
                        border-radius: 8px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        padding: 4px;
                        position: relative;
                        overflow: hidden;
                        page-break-inside: avoid;
                    }
                    .celda.ocupada {
                        border-style: solid;
                        border-width: 2px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    }
                    .celda .hostname {
                        font-weight: 700;
                        font-size: 0.72rem;
                        line-height: 1.1;
                        word-break: break-all;
                    }
                    .celda .ip {
                        font-size: 0.65rem;
                        margin-top: 3px;
                        color: #475569;
                        font-weight: 500;
                    }
                    .celda[data-rol="AGT"] { background: #dbeafe; border-color: #3b82f6; }
                    .celda[data-rol="SPR"] { background: #dcfce7; border-color: #22c55e; }
                    .celda[data-rol="CLD"] { background: #ffedd5; border-color: #f97316; }
                    .celda[data-rol="GRN"] { background: #f3e8ff; border-color: #a855f7; }
                    .celda[data-rol="CRD"] { background: #ccfbf1; border-color: #14b8a6; }
                    .celda[data-rol="MIS"] { background: #fce7f3; border-color: #ec4899; }
                    .celda[data-rol="ADM"] { background: #e2e8f0; border-color: #475569; }
                    .celda[data-rol="AGT"] .hostname { color: #1e40af; }
                    .celda[data-rol="SPR"] .hostname { color: #166534; }
                    .celda[data-rol="CLD"] .hostname { color: #9a3412; }
                    .celda[data-rol="GRN"] .hostname { color: #6b21a8; }
                    .celda[data-rol="CRD"] .hostname { color: #115e59; }
                    .celda[data-rol="MIS"] .hostname { color: #9d174d; }
                    .celda[data-rol="ADM"] .hostname { color: #1e293b; }
                    .celda .etiqueta-zona {
                        position: absolute;
                        top: -6px;
                        left: 3px;
                        font-size: 0.55rem;
                        font-weight: 700;
                        background: #1e293b;
                        color: #fff;
                        padding: 1px 6px;
                        border-radius: 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                    }
                    .leyenda-pdf {
                        display: flex;
                        gap: 14px;
                        flex-wrap: wrap;
                        justify-content: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 2px solid #e2e8f0;
                    }
                    .leyenda-pdf .item {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 0.75rem;
                        color: #334155;
                    }
                    .leyenda-pdf .punto {
                        width: 12px;
                        height: 12px;
                        border-radius: 3px;
                    }
                    @page {
                        size: landscape;
                        margin: 12mm;
                    }
                </style>
            </head>
            <body>
                ${htmlPlano}
            </body>
            </html>
        `;

        const tmpPath = path.join(os.tmpdir(), `plano-${Date.now()}.html`);
        fs.writeFileSync(tmpPath, htmlCompleto, 'utf-8');

        await winPDF.loadFile(tmpPath);
        await new Promise(resolve => setTimeout(resolve, 500));

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Guardar plano como PDF',
            defaultPath: nombreArchivo || `Plano-${Date.now()}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });

        if (canceled || !filePath) {
            winPDF.destroy();
            fs.unlinkSync(tmpPath);
            return { ok: false, mensaje: 'Cancelado' };
        }

        const datosPDF = await winPDF.webContents.printToPDF({
            printBackground: true,
            landscape: true,
            pageSize: 'A4',
            margins: { marginType: 'default' }
        });

        fs.writeFileSync(filePath, datosPDF);

        winPDF.destroy();
        fs.unlinkSync(tmpPath);

        return { ok: true, mensaje: 'PDF generado', ruta: filePath };
    } catch (err) {
        if (!winPDF.isDestroyed()) winPDF.destroy();
        throw err;
    }
});

/* =========================================================
   CICLO DE VIDA
   ========================================================= */

app.whenReady().then(() => {
    crearLoginWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) crearLoginWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});