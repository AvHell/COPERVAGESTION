/* =========================================================
   ACTIVO FIJO — RENDERER DE REPORTES
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   ESTADO
   ========================================================= */
let vistaActual    = 'resumen-tipo';
let datosActuales  = [];
let tipos          = [];
let estados        = [];
let estatus        = [];
let carteras       = [];
let filtros        = { tipo: '', estado: '', estatus: '', cartera: '' };
let filtroBusqueda = '';
let cargando       = false;

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabs             = document.getElementById('tabs-reportes');
const tablaHead        = document.getElementById('tabla-head');
const tablaBody        = document.getElementById('tabla-body');
const cardTabla        = document.getElementById('card-tabla');
const cargandoEl       = document.getElementById('cargando');
const sinResultados    = document.getElementById('sin-resultados');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnRecargar      = document.getElementById('btn-recargar');
const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtros');
const filtrosDinamicos = document.getElementById('filtros-dinamicos');

const filtroTipo       = document.getElementById('filtro-tipo');
const filtroEstado     = document.getElementById('filtro-estado');
const filtroEstatus    = document.getElementById('filtro-estatus');
const filtroCartera    = document.getElementById('filtro-cartera');

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatearPrecio(val) {
    if (val === null || val === undefined || val === '') return '—';
    return new Intl.NumberFormat('es-MX', {
        style: 'currency', currency: 'MXN', minimumFractionDigits: 0
    }).format(val);
}

function formatearNumero(val) {
    if (val === null || val === undefined || val === '') return '—';
    return new Intl.NumberFormat('es-MX').format(val);
}

function formatearFecha(f) {
    if (!f) return '—';
    const d = new Date(f);
    if (isNaN(d.getTime())) return '—';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
}

function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false, timer: 3400, timerProgressBar: true,
        customClass: { popup: 'cl-toast cl-toast-error' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   MAPEAR TIPO DE COLUMNA → CLASE CSS
   ========================================================= */
function claseParaTipo(tipo) {
    switch (tipo) {
        case 'numero':        return 'col-numero';
        case 'precio':        return 'col-precio';
        case 'fecha':         return 'col-fecha';
        case 'folio':         return 'col-folio';
        case 'mono':          return 'col-mono';
        case 'badge-tipo':
        case 'badge-estado':
        case 'badge-estatus': return 'col-badge';
        default:              return '';
    }
}

/* =========================================================
   CONFIGURACIÓN DE VISTAS
   ========================================================= */
const VISTAS = {
    'resumen-tipo':     { titulo: 'Resumen por Tipo',         filtros: [],                                    endpoint: 'resumenPorTipo' },
    'resumen-cartera':  { titulo: 'Resumen por Cartera',      filtros: [],                                    endpoint: 'resumenPorCartera' },
    'inventario':       { titulo: 'Inventario Completo',      filtros: ['tipo','estado','estatus','cartera'], endpoint: 'inventario' },
    'responsivas':      { titulo: 'Responsivas Activas',      filtros: [],                                    endpoint: 'responsivasActivas' },
    'personas':         { titulo: 'Asignaciones por Persona', filtros: [],                                    endpoint: 'asignacionesPorPersona' },
    'tickets':          { titulo: 'Activos por Ticket',       filtros: [],                                    endpoint: 'porTicket' },
    'celulares':        { titulo: 'Celulares',                filtros: [],                                    endpoint: 'celulares' },
    'laptops':          { titulo: 'Laptops',                  filtros: [],                                    endpoint: 'laptops' }
};

/* =========================================================
   DEFINICIÓN DE COLUMNAS POR VISTA
   Tipos: texto | numero | precio | fecha |
          badge-estado | badge-estatus | badge-tipo |
          folio | mono
   ========================================================= */
const COLUMNAS = {
    'resumen-tipo': [
        { key: 'Tipo',                 etiqueta: 'Tipo',           tipo: 'badge-tipo' },
        { key: 'TotalEquipos',         etiqueta: 'Total',          tipo: 'numero' },
        { key: 'EnStock',              etiqueta: 'Stock',          tipo: 'numero' },
        { key: 'Disponibles',          etiqueta: 'Disponibles',    tipo: 'numero' },
        { key: 'Asignados',            etiqueta: 'Asignados',      tipo: 'numero' },
        { key: 'Pendientes',           etiqueta: 'Pendientes',     tipo: 'numero' },
        { key: 'Bajas',                etiqueta: 'Bajas',          tipo: 'numero' },
        { key: 'ValorTotalInventario', etiqueta: 'Valor total',    tipo: 'precio' }
    ],
    'resumen-cartera': [
        { key: 'Cartera',        etiqueta: 'Cartera',        tipo: 'texto' },
        { key: 'TotalEquipos',   etiqueta: 'Total',          tipo: 'numero' },
        { key: 'ValorStock',     etiqueta: 'Valor stock',    tipo: 'precio' },
        { key: 'ValorAsignado',  etiqueta: 'Valor asignado', tipo: 'precio' },
        { key: 'ValorBaja',      etiqueta: 'Valor baja',     tipo: 'precio' },
        { key: 'ValorTotal',     etiqueta: 'Valor total',    tipo: 'precio' }
    ],
    'inventario': [
        { key: 'NoSerie',      etiqueta: 'No. Serie',   tipo: 'mono' },
        { key: 'IMEI1',        etiqueta: 'IMEI 1',      tipo: 'mono' },
        { key: 'NoTelefono',   etiqueta: 'Teléfono',    tipo: 'mono' },
        { key: 'Marca',        etiqueta: 'Marca',       tipo: 'texto' },
        { key: 'Modelo',       etiqueta: 'Modelo',      tipo: 'texto' },
        { key: 'Tipo',         etiqueta: 'Tipo',        tipo: 'badge-tipo' },
        { key: 'Estado',       etiqueta: 'Estado',      tipo: 'badge-estado' },
        { key: 'Estatus',      etiqueta: 'Estatus',     tipo: 'badge-estatus' },
        { key: 'Cartera',      etiqueta: 'Cartera',     tipo: 'texto' },
        { key: 'PrecioActivo', etiqueta: 'Precio',      tipo: 'precio' }
    ],
    'responsivas': [
        { key: 'FolioTicket',       etiqueta: 'Folio',         tipo: 'folio' },
        { key: 'Tipo',              etiqueta: 'Tipo',          tipo: 'badge-tipo' },
        { key: 'NoSerie',           etiqueta: 'Serie',         tipo: 'mono' },
        { key: 'Marca',             etiqueta: 'Marca',         tipo: 'texto' },
        { key: 'Modelo',            etiqueta: 'Modelo',        tipo: 'texto' },
        { key: 'NombreRecibe',      etiqueta: 'Recibe',        tipo: 'texto' },
        { key: 'Cartera',           etiqueta: 'Cartera',       tipo: 'texto' },
        { key: 'FechaAsignacion',   etiqueta: 'F. Asignación', tipo: 'fecha' },
        { key: 'EstatusResponsiva', etiqueta: 'Estatus',       tipo: 'badge-estatus' }
    ],
    'personas': [
        { key: 'Persona',            etiqueta: 'Persona',        tipo: 'texto' },
        { key: 'Puesto',             etiqueta: 'Puesto',         tipo: 'texto' },
        { key: 'Area',               etiqueta: 'Área',           tipo: 'texto' },
        { key: 'Correo',             etiqueta: 'Correo',         tipo: 'mono' },
        { key: 'TotalAsignaciones',  etiqueta: 'Activos',        tipo: 'numero' },
        { key: 'ValorTotalAsignado', etiqueta: 'Valor asignado', tipo: 'precio' }
    ],
    'tickets': [
        { key: 'FolioTicket',      etiqueta: 'Ticket',        tipo: 'folio' },
        { key: 'TotalActivos',     etiqueta: 'Total activos', tipo: 'numero' },
        { key: 'Personas',         etiqueta: 'Personas',      tipo: 'texto' },
        { key: 'ValorTotalTicket', etiqueta: 'Valor total',   tipo: 'precio' },
        { key: 'FechaAsignacion',  etiqueta: 'Fecha',         tipo: 'fecha' }
    ],
    'celulares': [
        { key: 'IMEI1',           etiqueta: 'IMEI 1',   tipo: 'mono' },
        { key: 'IMEI2',           etiqueta: 'IMEI 2',   tipo: 'mono' },
        { key: 'NoTelefono',      etiqueta: 'Teléfono', tipo: 'mono' },
        { key: 'Marca',           etiqueta: 'Marca',    tipo: 'texto' },
        { key: 'Modelo',          etiqueta: 'Modelo',   tipo: 'texto' },
        { key: 'PrecioActivo',    etiqueta: 'Precio',   tipo: 'precio' },
        { key: 'Estatus',         etiqueta: 'Estatus',  tipo: 'badge-estatus' },
        { key: 'NombreRecibe',    etiqueta: 'Recibe',   tipo: 'texto' },
        { key: 'Cartera',         etiqueta: 'Cartera',  tipo: 'texto' },
        { key: 'FechaAsignacion', etiqueta: 'Fecha',    tipo: 'fecha' }
    ],
    'laptops': [
        { key: 'NoSerie',         etiqueta: 'Serie',      tipo: 'mono' },
        { key: 'Marca',           etiqueta: 'Marca',      tipo: 'texto' },
        { key: 'Modelo',          etiqueta: 'Modelo',     tipo: 'texto' },
        { key: 'Procesador',      etiqueta: 'Procesador', tipo: 'texto' },
        { key: 'MemoriaRAM',      etiqueta: 'RAM',        tipo: 'texto' },
        { key: 'Almacenamiento',  etiqueta: 'Disco',      tipo: 'texto' },
        { key: 'PrecioActivo',    etiqueta: 'Precio',     tipo: 'precio' },
        { key: 'Estatus',         etiqueta: 'Estatus',    tipo: 'badge-estatus' },
        { key: 'NombreRecibe',    etiqueta: 'Recibe',     tipo: 'texto' },
        { key: 'FechaAsignacion', etiqueta: 'Fecha',      tipo: 'fecha' }
    ]
};

/* =========================================================
   CARGAR CATÁLOGOS PARA FILTROS
   ========================================================= */
async function cargarCatalogos() {
    try {
        const [t, e, s, c] = await Promise.all([
            window.api.activoFijo.reportes.tiposParaFiltro(),
            window.api.activoFijo.reportes.estadosParaFiltro(),
            window.api.activoFijo.reportes.estatusParaFiltro(),
            window.api.activoFijo.reportes.carterasParaFiltro()
        ]);
        tipos    = t; estados = e; estatus = s; carteras = c;

        filtroTipo.innerHTML    = '<option value="">Todos</option>' +
            tipos.map(x => `<option value="${escaparHTML(x.Nombre)}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroEstado.innerHTML  = '<option value="">Todos</option>' +
            estados.map(x => `<option value="${escaparHTML(x.Nombre)}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroEstatus.innerHTML = '<option value="">Todos</option>' +
            estatus.map(x => `<option value="${escaparHTML(x.Nombre)}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroCartera.innerHTML = '<option value="">Todas</option>' +
            carteras.map(x => `<option value="${escaparHTML(x.Nombre)}">${escaparHTML(x.Nombre)}</option>`).join('');
    } catch (err) {
        toastError('No se pudieron cargar los catálogos', err.message);
    }
}

/* =========================================================
   CARGAR KPIs
   ========================================================= */
async function cargarKPIs() {
    try {
        const k = await window.api.activoFijo.reportes.resumenGeneral();
        if (!k) return;

        document.getElementById('kpi-total').textContent       = formatearNumero(k.TotalActivos);
        document.getElementById('kpi-valor').textContent       = formatearPrecio(k.ValorTotal);
        document.getElementById('kpi-stock').textContent       = formatearNumero(k.EnStock);
        document.getElementById('kpi-disponible').textContent  = formatearNumero(k.Disponibles);
        document.getElementById('kpi-asignado').textContent    = formatearNumero(k.Asignados);
        document.getElementById('kpi-pendiente').textContent   = formatearNumero(k.Pendientes);
        document.getElementById('kpi-baja').textContent        = formatearNumero(k.Bajas);
        document.getElementById('kpi-responsivas').textContent = formatearNumero(k.ResponsivasActivas);
    } catch (err) {
        toastError('No se pudieron cargar los KPIs', err.message);
    }
}

/* =========================================================
   MOSTRAR/OCULTAR CARGA
   ========================================================= */
function setCargando(v) {
    cargando = v;
    cargandoEl.classList.toggle('oculto', !v);
    if (v) {
        cardTabla.classList.add('oculto');
        sinResultados.classList.add('oculto');
    }
}

/* =========================================================
   CARGAR DATOS DE LA VISTA ACTUAL
   ========================================================= */
async function cargarVista() {
    if (cargando) return;
    setCargando(true);

    const cfg = VISTAS[vistaActual];
    if (!cfg) { setCargando(false); return; }

    try {
        const endpoint = window.api.activoFijo.reportes[cfg.endpoint];
        let data;

        if (cfg.endpoint === 'inventario') {
            data = await endpoint(filtros);
        } else {
            data = await endpoint();
        }

        datosActuales = data || [];
        renderTabla();
    } catch (err) {
        toastError('No se pudo cargar el reporte', err.message);
        datosActuales = [];
        renderTabla();
    } finally {
        setCargando(false);
    }
}

/* =========================================================
   RENDER TABLA
   Encabezados y celdas comparten la clase según tipo de columna
   ========================================================= */
function renderTabla() {
    const cols = COLUMNAS[vistaActual] || [];

    // Encabezados con clase según tipo de columna
    tablaHead.innerHTML = '<tr>' + cols.map(c => {
        const clase = claseParaTipo(c.tipo);
        return `<th class="${clase}">${escaparHTML(c.etiqueta)}</th>`;
    }).join('') + '</tr>';

    // Filtrar por búsqueda de texto
    const filtrados = datosActuales.filter(r => {
        if (!filtroBusqueda) return true;
        const texto = cols.map(c => String(r[c.key] ?? '')).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    if (filtrados.length === 0) {
        cardTabla.classList.add('oculto');
        sinResultados.classList.remove('oculto');
        tablaBody.innerHTML = '';
        return;
    }

    sinResultados.classList.add('oculto');
    cardTabla.classList.remove('oculto');

    // Filas
    tablaBody.innerHTML = '';
    filtrados.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = cols.map(c => renderCelda(r[c.key], c.tipo)).join('');
        tablaBody.appendChild(tr);
    });
}

/* =========================================================
   RENDER CELDA POR TIPO
   Cada celda lleva la misma clase que su encabezado
   ========================================================= */
function renderCelda(val, tipo) {
    const clase = claseParaTipo(tipo);

    if (val === null || val === undefined || val === '') {
        return `<td class="${clase}">—</td>`;
    }

    switch (tipo) {
        case 'numero':
            return `<td class="${clase} celda-numero">${formatearNumero(val)}</td>`;

        case 'precio':
            return `<td class="${clase} celda-precio">${formatearPrecio(val)}</td>`;

        case 'fecha':
            return `<td class="${clase} celda-fecha">${formatearFecha(val)}</td>`;

        case 'folio':
            return `<td class="${clase}"><span class="celda-folio">${escaparHTML(val)}</span></td>`;

        case 'mono':
            return `<td class="${clase} celda-mono">${escaparHTML(val)}</td>`;

        case 'badge-tipo':
            return `<td class="${clase}"><span class="badge badge-tipo">${escaparHTML(val)}</span></td>`;

        case 'badge-estado':
            return `<td class="${clase}"><span class="badge badge-estado-${escaparHTML(val)}">${escaparHTML(val)}</span></td>`;

        case 'badge-estatus':
            return `<td class="${clase}"><span class="badge badge-estatus-${escaparHTML(val)}">${escaparHTML(val)}</span></td>`;

        default:
            return `<td class="${clase}">${escaparHTML(val)}</td>`;
    }
}

/* =========================================================
   CAMBIAR DE VISTA (TABS)
   ========================================================= */
tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.classList.contains('activo')) return;

    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
    btn.classList.add('activo');

    vistaActual = btn.dataset.vista;

    const cfg = VISTAS[vistaActual];
    actualizarFiltrosVisibles(cfg.filtros);

    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');

    cargarVista();
});

/* =========================================================
   FILTROS VISIBLES
   ========================================================= */
function actualizarFiltrosVisibles(camposActivos = []) {
    const wrappers = {
        tipo:    document.getElementById('filtro-tipo-wrap'),
        estado:  document.getElementById('filtro-estado-wrap'),
        estatus: document.getElementById('filtro-estatus-wrap'),
        cartera: document.getElementById('filtro-cartera-wrap')
    };

    if (camposActivos.length === 0) {
        filtrosDinamicos.classList.add('oculto');
    } else {
        filtrosDinamicos.classList.remove('oculto');
        Object.entries(wrappers).forEach(([campo, el]) => {
            el.classList.toggle('oculto', !camposActivos.includes(campo));
        });
    }
}

/* =========================================================
   EVENTOS DE FILTROS
   ========================================================= */
filtroTipo.addEventListener('change',    () => { filtros.tipo    = filtroTipo.value;    cargarVista(); });
filtroEstado.addEventListener('change',  () => { filtros.estado  = filtroEstado.value;  cargarVista(); });
filtroEstatus.addEventListener('change', () => { filtros.estatus = filtroEstatus.value; cargarVista(); });
filtroCartera.addEventListener('change', () => { filtros.cartera = filtroCartera.value; cargarVista(); });

btnLimpiarFiltro.addEventListener('click', () => {
    filtros = { tipo: '', estado: '', estatus: '', cartera: '' };
    filtroTipo.value = '';
    filtroEstado.value = '';
    filtroEstatus.value = '';
    filtroCartera.value = '';
    cargarVista();
});

/* =========================================================
   BUSCADOR
   ========================================================= */
inputBusqueda.addEventListener('input', () => {
    filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
    btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
    renderTabla();
});

btnLimpiarBusq.addEventListener('click', () => {
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    renderTabla();
    inputBusqueda.focus();
});

/* =========================================================
   RECARGAR
   ========================================================= */
btnRecargar.addEventListener('click', async () => {
    await cargarKPIs();
    await cargarVista();
});

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => {
    window.api.volverMenu();
});

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    await cargarCatalogos();
    await cargarKPIs();
    actualizarFiltrosVisibles(VISTAS[vistaActual].filtros);
    await cargarVista();
})();