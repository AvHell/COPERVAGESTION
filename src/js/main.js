const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PDFDocument } = require('pdf-lib');

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

/* =========================================================
   BASE DE DATOS — MÓDULO ACTIVO FIJO
   ========================================================= */
const activoFijoCatalogosDB   = require('../ActivoFijo/consultas/catalogos');
const activoFijoActivosDB     = require('../ActivoFijo/consultas/activos');
const activoFijoResponsivasDB = require('../ActivoFijo/consultas/responsivas');
const activoFijoReportesDB    = require('../ActivoFijo/consultas/reportes');
const activoFijoImportacionDB = require('../ActivoFijo/consultas/importacion');
const { title } = require('process');

/* =========================================================
   RUTAS
   ========================================================= */
const ventanas   = {};
const HTML       = path.join(__dirname, '../html');
const HTML_AF    = path.join(__dirname, '..', 'ActivoFijo', 'html');
const PRELOAD    = path.join(__dirname, 'preload.js');
const PRELOAD_AF = path.join(__dirname, '..', 'ActivoFijo', 'preload-activofijo.js');

const PLANTILLA_PDF = path.join(__dirname, '..', '..', 'Formatos', 'ResponsivaCelulares.pdf');

console.log('===========================================');
console.log('Ruta plantilla PDF:');
console.log(PLANTILLA_PDF);
console.log('¿Existe?', fs.existsSync(PLANTILLA_PDF));
console.log('===========================================');

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

    const basePath    = opciones.basePath || HTML;
    const preloadPath = opciones.preload  || PRELOAD;

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
const crearLoginWindow     = () => crearVentana('login',     'login.html',     { title:  'Iniciar Sesión' });
const crearMenuWindow      = () => crearVentana('menu',      'menu.html',      { title: 'Menú Principal' });
const crearCatalogosWindow = () => crearVentana('catalogos', 'catalogos.html', { title: 'Catálogos del Sistema' });
const crearRangosWindow    = () => crearVentana('rangos',    'rangos.html',    { title: 'Rangos IP' });
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
    if (ventanas[nombre] && !ventanas[nombre].isDestroyed()) ventanas[nombre].close();
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
ipcMain.handle('logout', () => { usuarioActual = null; return { ok: true }; });
ipcMain.handle('usuario-actual', () => usuarioActual);

/* =========================================================
   IPC: ABRIR VENTANAS DEL SISTEMA
   ========================================================= */
ipcMain.handle('abrir-menu',      () => { cerrarVentana('login'); asegurarMenuAbierto(); return { ok: true }; });
ipcMain.handle('abrir-catalogos', () => { crearCatalogosWindow(); return { ok: true }; });
ipcMain.handle('abrir-rangos',    () => { crearRangosWindow();    return { ok: true }; });
ipcMain.handle('abrir-equipos',   () => { crearEquiposWindow();   return { ok: true }; });
ipcMain.handle('abrir-plano',     () => { crearPlanoWindow();     return { ok: true }; });
ipcMain.handle('abrir-usuarios',  () => { crearUsuariosWindow();  return { ok: true }; });
ipcMain.handle('abrir-historico', () => { crearHistoricoWindow(); return { ok: true }; });

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
ipcMain.handle('abrir-activofijo-reportes',    () => { crearActivoFijoReportesWindow();    return { ok: true }; });
ipcMain.handle('abrir-activofijo-importar',    () => { crearActivoFijoImportarWindow();    return { ok: true }; });
ipcMain.handle('af-abrir-catalogos',   () => { crearActivoFijoCatalogosWindow();   return { ok: true }; });
ipcMain.handle('af-abrir-activos',     () => { crearActivoFijoActivosWindow();     return { ok: true }; });
ipcMain.handle('af-abrir-responsivas', () => { crearActivoFijoResponsivasWindow(); return { ok: true }; });
ipcMain.handle('af-abrir-reportes',    () => { crearActivoFijoReportesWindow();    return { ok: true }; });
ipcMain.handle('af-abrir-importar',    () => { crearActivoFijoImportarWindow();    return { ok: true }; });

/* =========================================================
   IPC: CATÁLOGOS DE ACTIVO FIJO
   ========================================================= */
ipcMain.handle('af-catalogos-listar',     async (_e, clave, filtros)   => await activoFijoCatalogosDB.listar(clave, filtros || {}));
ipcMain.handle('af-catalogos-crear',      async (_e, clave, datos)     => await activoFijoCatalogosDB.crear(clave, datos));
ipcMain.handle('af-catalogos-actualizar', async (_e, clave, id, datos) => await activoFijoCatalogosDB.actualizar(clave, id, datos));
ipcMain.handle('af-catalogos-eliminar',   async (_e, clave, id)        => await activoFijoCatalogosDB.eliminar(clave, id));
ipcMain.handle('af-catalogos-restaurar',  async (_e, clave, id)        => await activoFijoCatalogosDB.restaurar(clave, id));

/* =========================================================
   IPC: ACTIVOS
   ========================================================= */
ipcMain.handle('af-activos-listar',     async (_e, filtros)  => await activoFijoActivosDB.listar(filtros || {}));
ipcMain.handle('af-activos-obtener',    async (_e, id)       => await activoFijoActivosDB.obtener(id));
ipcMain.handle('af-activos-crear',      async (_e, datos)    => await activoFijoActivosDB.crear(datos, usuarioActual?.IdUsuario));
ipcMain.handle('af-activos-actualizar', async (_e, id, datos)=> await activoFijoActivosDB.actualizar(id, datos, usuarioActual?.IdUsuario));
ipcMain.handle('af-activos-eliminar',   async (_e, id, motivo) => await activoFijoActivosDB.eliminar(id, usuarioActual?.IdUsuario, motivo || null));
ipcMain.handle('af-activos-restaurar',  async (_e, id, motivo) => await activoFijoActivosDB.restaurar(id, usuarioActual?.IdUsuario, motivo || null));
ipcMain.handle('af-activos-historico',  async (_e, id)         => await activoFijoActivosDB.historico(id));

ipcMain.handle('af-activos-lista-tipos',    async () => await activoFijoActivosDB.listarTipos());
ipcMain.handle('af-activos-lista-marcas',   async () => await activoFijoActivosDB.listarMarcas());
ipcMain.handle('af-activos-lista-estados',  async () => await activoFijoActivosDB.listarEstados());
ipcMain.handle('af-activos-lista-estatus',  async () => await activoFijoActivosDB.listarEstatus());
ipcMain.handle('af-activos-lista-carteras', async () => await activoFijoActivosDB.listarCarteras());

ipcMain.handle('af-activos-lista-sitios',          async () => await activoFijoActivosDB.listarSitios());
ipcMain.handle('af-activos-lista-subtipos',        async () => await activoFijoActivosDB.listarSubtipos());
ipcMain.handle('af-activos-lista-voltajes',        async () => await activoFijoActivosDB.listarVoltajes());
ipcMain.handle('af-activos-lista-clasificaciones', async () => await activoFijoActivosDB.listarClasificaciones());
ipcMain.handle('af-activos-lista-tamanios',        async () => await activoFijoActivosDB.listarTamanios());
ipcMain.handle('af-activos-lista-capacidades',     async () => await activoFijoActivosDB.listarCapacidades());

/* =========================================================
   IPC: RESPONSIVAS
   ========================================================= */
ipcMain.handle('af-resp-listar',              async (_e, filtros)    => await activoFijoResponsivasDB.listar(filtros || {}));
ipcMain.handle('af-resp-obtener',             async (_e, id)         => await activoFijoResponsivasDB.obtener(id));
ipcMain.handle('af-resp-activos-disponibles', async ()               => await activoFijoResponsivasDB.activosDisponibles());
ipcMain.handle('af-resp-crear',               async (_e, datos)      => await activoFijoResponsivasDB.crear(datos, usuarioActual?.IdUsuario));
ipcMain.handle('af-resp-actualizar',          async (_e, id, datos)  => await activoFijoResponsivasDB.actualizar(id, datos, usuarioActual?.IdUsuario));
ipcMain.handle('af-resp-devolver',            async (_e, id, f, obs) => await activoFijoResponsivasDB.devolver(id, f, obs, usuarioActual?.IdUsuario));
ipcMain.handle('af-resp-eliminar',            async (_e, id, motivo) => await activoFijoResponsivasDB.eliminar(id, usuarioActual?.IdUsuario, motivo || null));
ipcMain.handle('af-resp-lista-carteras',      async ()               => await activoFijoResponsivasDB.listarCarteras());
ipcMain.handle('af-resp-lista-puestos',       async ()               => await activoFijoResponsivasDB.listarPuestos());

/* =========================================================
   IPC: REPORTES
   ========================================================= */
ipcMain.handle('af-rep-resumen-general',       async ()               => await activoFijoReportesDB.resumenGeneral());
ipcMain.handle('af-rep-resumen-tipo',          async ()               => await activoFijoReportesDB.resumenPorTipo());
ipcMain.handle('af-rep-resumen-cartera',       async ()               => await activoFijoReportesDB.resumenPorCartera());
ipcMain.handle('af-rep-inventario',            async (_e, filtros)    => await activoFijoReportesDB.inventario(filtros || {}));
ipcMain.handle('af-rep-responsivas-activas',   async ()               => await activoFijoReportesDB.responsivasActivas());
ipcMain.handle('af-rep-asignaciones-persona',  async ()               => await activoFijoReportesDB.asignacionesPorPersona());
ipcMain.handle('af-rep-por-ticket',            async ()               => await activoFijoReportesDB.porTicket());
ipcMain.handle('af-rep-historial-asignaciones',async (_e, filtros)    => await activoFijoReportesDB.historialAsignaciones(filtros || {}));
ipcMain.handle('af-rep-historial-activo',      async (_e, id)         => await activoFijoReportesDB.historialActivo(id));
ipcMain.handle('af-rep-celulares',             async ()               => await activoFijoReportesDB.celulares());
ipcMain.handle('af-rep-laptops',               async ()               => await activoFijoReportesDB.laptops());

ipcMain.handle('af-rep-tipos',                 async ()               => await activoFijoReportesDB.tiposParaFiltro());
ipcMain.handle('af-rep-estados',               async ()               => await activoFijoReportesDB.estadosParaFiltro());
ipcMain.handle('af-rep-estatus',               async ()               => await activoFijoReportesDB.estatusParaFiltro());
ipcMain.handle('af-rep-carteras',              async ()               => await activoFijoReportesDB.carterasParaFiltro());

/* =========================================================
   IPC: IMPORTACIÓN MASIVA
   ========================================================= */
ipcMain.handle('af-import-layouts',  async () => activoFijoImportacionDB.listarLayouts());
ipcMain.handle('af-import-layout',   async (_e, clave) => activoFijoImportacionDB.obtenerLayout(clave));
ipcMain.handle('af-import-procesar', async (_e, datos) => await activoFijoImportacionDB.importar(datos, usuarioActual?.IdUsuario));

/* =========================================================
   IPC: GENERAR PDF DE RESPONSIVA (pdf-lib)
   ========================================================= */
ipcMain.handle('af-resp-generar-pdf', async (_e, idResponsiva) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');

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
ipcMain.handle('clientes:listar',     async () => await clientesDB.listar());
ipcMain.handle('clientes:crear',      async (_e, codigo, nombre) => await clientesDB.crear(codigo, nombre));
ipcMain.handle('clientes:actualizar', async (_e, id, codigo, nombre) => await clientesDB.actualizar(id, codigo, nombre));
ipcMain.handle('clientes:eliminar',   async (_e, id) => await clientesDB.eliminar(id));

ipcMain.handle('roles:listar',     async () => await rolesDB.listar());
ipcMain.handle('roles:crear',      async (_e, codigo, nombre, descripcion) => await rolesDB.crear(codigo, nombre, descripcion));
ipcMain.handle('roles:actualizar', async (_e, id, codigo, nombre, descripcion) => await rolesDB.actualizar(id, codigo, nombre, descripcion));
ipcMain.handle('roles:eliminar',   async (_e, id) => await rolesDB.eliminar(id));

/* =========================================================
   IPC: PISOS
   ========================================================= */
ipcMain.handle('pisos:listar',                async ()                              => await pisosDB.listar());
ipcMain.handle('pisos:obtener',               async (_e, id)                        => await pisosDB.obtener(id));
ipcMain.handle('pisos:listarPorCliente',      async (_e, idCliente)                 => await pisosDB.listarPorCliente(idCliente));
ipcMain.handle('pisos:clientesDePiso',        async (_e, idPiso)                    => await pisosDB.clientesDePiso(idPiso));
ipcMain.handle('pisos:crear',                 async (_e, nombre, filas, cols, ids)  => await pisosDB.crear(nombre, filas, cols, ids));
ipcMain.handle('pisos:actualizarConClientes', async (_e, id, nombre, filas, cols, ids) => await pisosDB.actualizarConClientes(id, nombre, filas, cols, ids));
ipcMain.handle('pisos:eliminar',              async (_e, id)                        => await pisosDB.eliminar(id));

/* =========================================================
   IPC: RANGOS
   ========================================================= */
ipcMain.handle('rangos:listar',     async () => await rangosDB.listar());
ipcMain.handle('rangos:crear',      async (_e, idCliente, idPiso, nombre, ipInicio, ipFin, desc) => await rangosDB.crear(idCliente, idPiso, nombre, ipInicio, ipFin, desc));
ipcMain.handle('rangos:actualizar', async (_e, id, idCliente, idPiso, nombre, ipInicio, ipFin, desc) => await rangosDB.actualizar(id, idCliente, idPiso, nombre, ipInicio, ipFin, desc));
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

ipcMain.handle('historicos:listarPorPiso', async (_e, idPiso) => await historicosDB.listarPorPiso(idPiso));
ipcMain.handle('historicos:listar',        async (_e, idCliente, idPiso) => await historicosDB.listar(idCliente, idPiso));

/* =========================================================
   IPC: PLANO
   ========================================================= */
ipcMain.handle('plano:dimensiones', async (_e, idPiso) => await planoDB.obtenerDimensiones(idPiso));

ipcMain.handle('plano:actualizarDim', async (_e, idPiso, filas, columnas) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.actualizarDimensiones(usuarioActual.IdUsuario, idPiso, filas, columnas);
});

ipcMain.handle('plano:listarPorLugar', async (_e, idPiso) => await planoDB.listarPorLugar(idPiso));
ipcMain.handle('plano:sinUbicacion',   async (_e, idPiso) => await planoDB.equiposSinUbicacion(idPiso));

ipcMain.handle('plano:asignar', async (_e, idPiso, idEquipo, fila, col) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.asignar(usuarioActual.IdUsuario, idPiso, idEquipo, fila, col);
});

ipcMain.handle('plano:mover', async (_e, idEquipo, fila, col, filaAnt, colAnt, idPiso) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.mover(usuarioActual.IdUsuario, idEquipo, fila, col, filaAnt, colAnt, idPiso);
});

ipcMain.handle('plano:quitar', async (_e, idEquipo, idPiso, hostname) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.quitar(usuarioActual.IdUsuario, idEquipo, idPiso, hostname);
});

ipcMain.handle('plano:intercambiar', async (_e, idA, idB, idPiso, hostA, hostB, filaA, colA, filaB, colB) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.intercambiar(usuarioActual.IdUsuario, idA, idB, idPiso, hostA, hostB, filaA, colA, filaB, colB);
});

ipcMain.handle('plano:listarZonas', async (_e, idPiso) => await planoDB.listarZonas(idPiso));

ipcMain.handle('plano:crearZona', async (_e, idPiso, nombre, color, fi, ff, ci, cf) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.crearZona(usuarioActual.IdUsuario, idPiso, nombre, color, fi, ff, ci, cf);
});

ipcMain.handle('plano:actualizarZona', async (_e, idZona, nombre, color, fi, ff, ci, cf, idPiso) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.actualizarZona(usuarioActual.IdUsuario, idPiso, idZona, nombre, color, fi, ff, ci, cf);
});

ipcMain.handle('plano:eliminarZona', async (_e, idZona, idPiso, nombre) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.eliminarZona(usuarioActual.IdUsuario, idPiso, idZona, nombre);
});

ipcMain.handle('plano:moverEntrePisos', async (_e, idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.moverEntrePisos(
        usuarioActual.IdUsuario, idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos
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

ipcMain.handle('plano:listarZonasLibres', async (_e, idPiso) => await planoDB.listarZonasLibres(idPiso));

ipcMain.handle('plano:guardarZonaLibre', async (_e, idPiso, nombre, color, celdas) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.guardarZonaLibre(usuarioActual.IdUsuario, idPiso, nombre, color, celdas);
});

ipcMain.handle('plano:eliminarZonaLibre', async (_e, idPiso, nombre, color) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');
    return await planoDB.eliminarZonaLibre(usuarioActual.IdUsuario, idPiso, nombre, color);
});

/* =========================================================
   IPC: EXPORTAR PDF DEL PLANO
   ========================================================= */
ipcMain.handle('plano:exportarPDF', async (_e, opciones) => {
    if (!usuarioActual) throw new Error('Sesión no iniciada');

    const winPDF = new BrowserWindow({
        width: 1400, height: 900, show: false,
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