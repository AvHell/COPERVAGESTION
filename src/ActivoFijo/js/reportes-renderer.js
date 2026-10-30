/* =========================================================
   ACTIVO FIJO — RENDERER DE REPORTES
   Paleta Tierra / Oliva · Filtros por columna · Exportar Excel
   SIN require — todo va por window.api
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   ESTADO
   ========================================================= */
let vistaActual      = 'resumen-tipo';
let datosActuales    = [];
let datosFiltrados   = [];
let tipos            = [];
let estados          = [];
let estatus          = [];
let carteras         = [];
let filtros          = { tipo: '', estado: '', estatus: '', cartera: '' };
let filtrosColumna   = {};
let filtroBusqueda   = '';
let cargando         = false;

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabs             = document.getElementById('tabs-reportes');
const tablaHead        = document.getElementById('tabla-head');
const tablaBody        = document.getElementById('tabla-body');
const cardTabla        = document.getElementById('card-tabla');
const cargandoEl       = document.getElementById('cargando');
const sinResultados    = document.getElementById('sin-resultados');
const sinResultadosTxt = document.getElementById('sin-resultados-texto');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarTodo   = document.getElementById('btn-limpiar-todo');
const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtros');
const btnLimpiarFiltCol= document.getElementById('btn-limpiar-filtros-col');
const btnRecargar      = document.getElementById('btn-recargar');
const btnExportar      = document.getElementById('btn-exportar');
const filtrosDinamicos = document.getElementById('filtros-dinamicos');
const tablaTitulo      = document.getElementById('tabla-titulo');
const tablaCount       = document.getElementById('tabla-count');

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

function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2400, timerProgressBar: true,
        customClass: { popup: 'cl-toast' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false, timer: 3400, timerProgressBar: true,
        customClass: { popup: 'cl-toast' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   CONFIGURACIÓN DE VISTAS
   ========================================================= */
const VISTAS = {
    'resumen-tipo':     { titulo: 'Resumen por Tipo',         filtros: [] },
    'resumen-cartera':  { titulo: 'Resumen por Cartera',      filtros: [] },
    'inventario':       { titulo: 'Inventario Completo',      filtros: ['tipo','estado','estatus','cartera'] },
    'responsivas':      { titulo: 'Responsivas Activas',      filtros: [] },
    'personas':         { titulo: 'Asignaciones por Persona', filtros: [] },
    'tickets':          { titulo: 'Activos por Ticket',       filtros: [] },
    'celulares':        { titulo: 'Celulares',                filtros: [] },
    'laptops':          { titulo: 'Laptops',                  filtros: [] }
};

/* =========================================================
   COLUMNAS POR VISTA
   ========================================================= */
const COLUMNAS = {
    'resumen-tipo': [
        { key: 'Tipo',                 etiqueta: 'Tipo',           tipo: 'badge-tipo', filtro: 'texto' },
        { key: 'TotalEquipos',         etiqueta: 'Total',          tipo: 'numero' },
        { key: 'EnStock',              etiqueta: 'Stock',          tipo: 'numero' },
        { key: 'Disponibles',          etiqueta: 'Disponibles',    tipo: 'numero' },
        { key: 'Asignados',            etiqueta: 'Asignados',      tipo: 'numero' },
        { key: 'Pendientes',           etiqueta: 'Pendientes',     tipo: 'numero' },
        { key: 'Bajas',                etiqueta: 'Bajas',          tipo: 'numero' },
        { key: 'ValorTotalInventario', etiqueta: 'Valor total',    tipo: 'precio' }
    ],
    'resumen-cartera': [
        { key: 'Cartera',        etiqueta: 'Cartera',        tipo: 'texto', filtro: 'texto' },
        { key: 'TotalEquipos',   etiqueta: 'Total',          tipo: 'numero' },
        { key: 'ValorStock',     etiqueta: 'Valor stock',    tipo: 'precio' },
        { key: 'ValorAsignado',  etiqueta: 'Valor asignado', tipo: 'precio' },
        { key: 'ValorBaja',      etiqueta: 'Valor baja',     tipo: 'precio' },
        { key: 'ValorTotal',     etiqueta: 'Valor total',    tipo: 'precio' }
    ],
    'inventario': [
        { key: 'NoSerie',      etiqueta: 'No. Serie',   tipo: 'mono',         filtro: 'texto' },
        { key: 'IMEI1',        etiqueta: 'IMEI 1',      tipo: 'mono',         filtro: 'texto' },
        { key: 'NoTelefono',   etiqueta: 'Teléfono',    tipo: 'mono',         filtro: 'texto' },
        { key: 'Marca',        etiqueta: 'Marca',       tipo: 'texto',        filtro: 'texto' },
        { key: 'Modelo',       etiqueta: 'Modelo',      tipo: 'texto',        filtro: 'texto' },
        { key: 'Tipo',         etiqueta: 'Tipo',        tipo: 'badge-tipo',   filtro: 'texto' },
        { key: 'Estado',       etiqueta: 'Estado',      tipo: 'badge-estado', filtro: 'texto' },
        { key: 'Estatus',      etiqueta: 'Estatus',     tipo: 'badge-estatus',filtro: 'texto' },
        { key: 'Cartera',      etiqueta: 'Cartera',     tipo: 'texto',        filtro: 'texto' },
        { key: 'PrecioActivo', etiqueta: 'Precio',      tipo: 'precio' }
    ],
    'responsivas': [
        { key: 'FolioTicket',       etiqueta: 'Folio',         tipo: 'folio',        filtro: 'texto' },
        { key: 'Tipo',              etiqueta: 'Tipo',          tipo: 'badge-tipo',   filtro: 'texto' },
        { key: 'NoSerie',           etiqueta: 'Serie',         tipo: 'mono',         filtro: 'texto' },
        { key: 'Marca',             etiqueta: 'Marca',         tipo: 'texto',        filtro: 'texto' },
        { key: 'Modelo',            etiqueta: 'Modelo',        tipo: 'texto',        filtro: 'texto' },
        { key: 'NombreRecibe',      etiqueta: 'Recibe',        tipo: 'texto',        filtro: 'texto' },
        { key: 'Cartera',           etiqueta: 'Cartera',       tipo: 'texto',        filtro: 'texto' },
        { key: 'FechaAsignacion',   etiqueta: 'F. Asignación', tipo: 'fecha' },
        { key: 'EstatusResponsiva', etiqueta: 'Estatus',       tipo: 'badge-estatus',filtro: 'texto' }
    ],
    'personas': [
        { key: 'Persona',            etiqueta: 'Persona',        tipo: 'texto',  filtro: 'texto' },
        { key: 'Puesto',             etiqueta: 'Puesto',         tipo: 'texto',  filtro: 'texto' },
        { key: 'Area',               etiqueta: 'Área',           tipo: 'texto',  filtro: 'texto' },
        { key: 'Correo',             etiqueta: 'Correo',         tipo: 'mono',   filtro: 'texto' },
        { key: 'TotalAsignaciones',  etiqueta: 'Activos',        tipo: 'numero' },
        { key: 'ValorTotalAsignado', etiqueta: 'Valor asignado', tipo: 'precio' }
    ],
    'tickets': [
        { key: 'FolioTicket',      etiqueta: 'Ticket',        tipo: 'folio',  filtro: 'texto' },
        { key: 'TotalActivos',     etiqueta: 'Total activos', tipo: 'numero' },
        { key: 'Personas',         etiqueta: 'Personas',      tipo: 'texto',  filtro: 'texto' },
        { key: 'ValorTotalTicket', etiqueta: 'Valor total',   tipo: 'precio' },
        { key: 'FechaAsignacion',  etiqueta: 'Fecha',         tipo: 'fecha' }
    ],
    'celulares': [
        { key: 'IMEI1',           etiqueta: 'IMEI 1',   tipo: 'mono',         filtro: 'texto' },
        { key: 'IMEI2',           etiqueta: 'IMEI 2',   tipo: 'mono',         filtro: 'texto' },
        { key: 'NoTelefono',      etiqueta: 'Teléfono', tipo: 'mono',         filtro: 'texto' },
        { key: 'Marca',           etiqueta: 'Marca',    tipo: 'texto',        filtro: 'texto' },
        { key: 'Modelo',          etiqueta: 'Modelo',   tipo: 'texto',        filtro: 'texto' },
        { key: 'PrecioActivo',    etiqueta: 'Precio',   tipo: 'precio' },
        { key: 'Estatus',         etiqueta: 'Estatus',  tipo: 'badge-estatus',filtro: 'texto' },
        { key: 'NombreRecibe',    etiqueta: 'Recibe',   tipo: 'texto',        filtro: 'texto' },
        { key: 'Cartera',         etiqueta: 'Cartera',  tipo: 'texto',        filtro: 'texto' },
        { key: 'FechaAsignacion', etiqueta: 'Fecha',    tipo: 'fecha' }
    ],
    'laptops': [
        { key: 'NoSerie',         etiqueta: 'Serie',      tipo: 'mono',         filtro: 'texto' },
        { key: 'Marca',           etiqueta: 'Marca',      tipo: 'texto',        filtro: 'texto' },
        { key: 'Modelo',          etiqueta: 'Modelo',     tipo: 'texto',        filtro: 'texto' },
        { key: 'Procesador',      etiqueta: 'Procesador', tipo: 'texto',        filtro: 'texto' },
        { key: 'MemoriaRAM',      etiqueta: 'RAM',        tipo: 'texto',        filtro: 'texto' },
        { key: 'Almacenamiento',  etiqueta: 'Disco',      tipo: 'texto',        filtro: 'texto' },
        { key: 'PrecioActivo',    etiqueta: 'Precio',     tipo: 'precio' },
        { key: 'Estatus',         etiqueta: 'Estatus',    tipo: 'badge-estatus',filtro: 'texto' },
        { key: 'NombreRecibe',    etiqueta: 'Recibe',     tipo: 'texto',        filtro: 'texto' },
        { key: 'FechaAsignacion', etiqueta: 'Fecha',      tipo: 'fecha' }
    ]
};

/* =========================================================
   MAPEAR TIPO → CLASE CSS
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
   CARGAR CATÁLOGOS
   ========================================================= */
async function cargarCatalogos() {
    try {
        const [t, e, s, c] = await Promise.all([
            window.api.activoFijo.reportes.tiposParaFiltro(),
            window.api.activoFijo.reportes.estadosParaFiltro(),
            window.api.activoFijo.reportes.estatusParaFiltro(),
            window.api.activoFijo.reportes.carterasParaFiltro()
        ]);
        tipos = t; estados = e; estatus = s; carteras = c;

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
   KPIs
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
   ESTADO DE CARGA
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
   CARGAR VISTA ACTUAL
   ========================================================= */
async function cargarVista() {
    if (cargando) return;
    setCargando(true);

    const cfg = VISTAS[vistaActual];
    if (!cfg) { setCargando(false); return; }

    try {
        let data;
        if (vistaActual === 'inventario') {
            data = await window.api.activoFijo.reportes.obtenerReporte(vistaActual, filtros);
        } else {
            data = await window.api.activoFijo.reportes.obtenerReporte(vistaActual, {});
        }

        datosActuales = data || [];
        filtrosColumna = {};
        filtroBusqueda = '';
        inputBusqueda.value = '';
        btnLimpiarBusq.classList.add('oculto');
        btnLimpiarFiltCol.classList.add('oculto');

        tablaTitulo.textContent = cfg.titulo;
        aplicarFiltrosYRender();
    } catch (err) {
        toastError('No se pudo cargar el reporte', err.message);
        datosActuales = [];
        aplicarFiltrosYRender();
    } finally {
        setCargando(false);
    }
}

/* =========================================================
   FILTRADO COMBINADO
   ========================================================= */
function aplicarFiltrosYRender() {
    const cols = COLUMNAS[vistaActual] || [];

    datosFiltrados = datosActuales.filter(r => {
        if (filtroBusqueda) {
            const texto = cols.map(c => String(r[c.key] ?? '')).join(' ').toLowerCase();
            if (!texto.includes(filtroBusqueda)) return false;
        }
        for (const [colKey, valorFiltro] of Object.entries(filtrosColumna)) {
            if (!valorFiltro) continue;
            const valorCelda = String(r[colKey] ?? '').toLowerCase();
            if (!valorCelda.includes(String(valorFiltro).toLowerCase())) return false;
        }
        return true;
    });

    renderTabla(cols);
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla(cols) {
    const hayFiltrosCol = Object.values(filtrosColumna).some(v => v && String(v).trim() !== '');

    tablaHead.innerHTML = '<tr>' + cols.map(c => {
        const clase = claseParaTipo(c.tipo);
        const filtroHTML = c.filtro === 'texto'
            ? `<div class="th-filter"><input type="text" data-col="${c.key}" placeholder="Filtrar..." value="${escaparHTML(filtrosColumna[c.key] || '')}"></div>`
            : '';
        return `<th class="${clase}">
            <div class="th-content">
                <span class="th-label">${escaparHTML(c.etiqueta)}</span>
            </div>
            ${filtroHTML}
        </th>`;
    }).join('') + '</tr>';

    tablaHead.querySelectorAll('.th-filter input').forEach(inp => {
        inp.addEventListener('input', (ev) => {
            const colKey = ev.target.getAttribute('data-col');
            const val = ev.target.value;
            if (val && val.trim()) {
                filtrosColumna[colKey] = val;
            } else {
                delete filtrosColumna[colKey];
            }
            const hay = Object.values(filtrosColumna).some(v => v && String(v).trim() !== '');
            btnLimpiarFiltCol.classList.toggle('oculto', !hay);
            renderBody(cols);
        });
    });

    btnLimpiarFiltCol.classList.toggle('oculto', !hayFiltrosCol);

    renderBody(cols);
}

/* =========================================================
   RENDER BODY
   ========================================================= */
function renderBody(cols) {
    if (datosFiltrados.length === 0) {
        cardTabla.classList.add('oculto');
        sinResultados.classList.remove('oculto');
        sinResultadosTxt.textContent = datosActuales.length === 0
            ? 'No hay datos para mostrar en este reporte.'
            : 'Ningún registro coincide con los filtros aplicados.';
        tablaCount.textContent = '0 registros';
        return;
    }

    sinResultados.classList.add('oculto');
    cardTabla.classList.remove('oculto');

    tablaBody.innerHTML = '';
    datosFiltrados.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = cols.map(c => {
            const clase = claseParaTipo(c.tipo);
            const dataLabel = `data-label="${escaparHTML(c.etiqueta)}"`;
            return renderCelda(r[c.key], c.tipo, clase, dataLabel);
        }).join('');
        tablaBody.appendChild(tr);
    });

    tablaCount.textContent = datosFiltrados.length === datosActuales.length
        ? `${datosActuales.length} registros`
        : `${datosFiltrados.length} de ${datosActuales.length} registros`;
}

/* =========================================================
   RENDER CELDA
   ========================================================= */
function renderCelda(val, tipo, clase, dataLabel) {
    if (val === null || val === undefined || val === '') {
        return `<td class="${clase}" ${dataLabel}>—</td>`;
    }

    switch (tipo) {
        case 'numero':
            return `<td class="${clase} celda-numero" ${dataLabel}>${formatearNumero(val)}</td>`;
        case 'precio':
            return `<td class="${clase} celda-precio" ${dataLabel}>${formatearPrecio(val)}</td>`;
        case 'fecha':
            return `<td class="${clase} celda-fecha" ${dataLabel}>${formatearFecha(val)}</td>`;
        case 'folio':
            return `<td class="${clase} celda-folio" ${dataLabel}>${escaparHTML(val)}</td>`;
        case 'mono':
            return `<td class="${clase} celda-mono" ${dataLabel}>${escaparHTML(val)}</td>`;
        case 'badge-tipo':
            return `<td class="${clase}" ${dataLabel}><span class="badge badge-tipo">${escaparHTML(val)}</span></td>`;
        case 'badge-estado':
            return `<td class="${clase}" ${dataLabel}><span class="badge badge-estado-${escaparHTML(val)}">${escaparHTML(val)}</span></td>`;
        case 'badge-estatus':
            return `<td class="${clase}" ${dataLabel}><span class="badge badge-estatus-${escaparHTML(val)}">${escaparHTML(val)}</span></td>`;
        default:
            return `<td class="${clase}" ${dataLabel}>${escaparHTML(val)}</td>`;
    }
}

/* =========================================================
   CAMBIAR VISTA
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
    aplicarFiltrosYRender();
});

btnLimpiarBusq.addEventListener('click', () => {
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    aplicarFiltrosYRender();
    inputBusqueda.focus();
});

/* =========================================================
   LIMPIAR FILTROS DE COLUMNA
   ========================================================= */
btnLimpiarFiltCol.addEventListener('click', () => {
    filtrosColumna = {};
    btnLimpiarFiltCol.classList.add('oculto');
    aplicarFiltrosYRender();
});

/* =========================================================
   LIMPIAR TODO
   ========================================================= */
btnLimpiarTodo.addEventListener('click', () => {
    filtrosColumna = {};
    filtroBusqueda = '';
    inputBusqueda.value = '';
    btnLimpiarBusq.classList.add('oculto');
    btnLimpiarFiltCol.classList.add('oculto');
    filtros = { tipo: '', estado: '', estatus: '', cartera: '' };
    filtroTipo.value = '';
    filtroEstado.value = '';
    filtroEstatus.value = '';
    filtroCartera.value = '';
    cargarVista();
});

/* =========================================================
   RECARGAR
   ========================================================= */
btnRecargar.addEventListener('click', async () => {
    btnRecargar.disabled = true;
    try {
        await cargarKPIs();
        await cargarVista();
        toastExito('Datos actualizados');
    } finally {
        btnRecargar.disabled = false;
    }
});

/* =========================================================
   EXPORTAR A EXCEL
   ========================================================= */
btnExportar.addEventListener('click', async () => {
    if (datosFiltrados.length === 0) {
        toastError('No hay datos para exportar', 'Aplica menos filtros o cambia de vista');
        return;
    }

    const cfg = VISTAS[vistaActual];
    const cols = COLUMNAS[vistaActual] || [];

    const filas = datosFiltrados.map(r => {
        const fila = {};
        cols.forEach(c => {
            let val = r[c.key];
            if (c.tipo === 'precio' && val != null) {
                fila[c.etiqueta] = Number(val);
            } else if (c.tipo === 'fecha' && val) {
                fila[c.etiqueta] = formatearFecha(val);
            } else {
                fila[c.etiqueta] = val ?? '';
            }
        });
        return fila;
    });

    const conf = await Swal.fire({
        icon: 'question',
        title: '¿Exportar a Excel?',
        html: `Se exportarán <strong>${filas.length}</strong> registros de <strong>${escaparHTML(cfg.titulo)}</strong>.<br>
               Los filtros aplicados en pantalla se respetarán.`,
        showCancelButton: true,
        showCloseButton: true,
        confirmButtonText: 'Sí, exportar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        }
    });

    if (!conf.isConfirmed) return;

    Swal.fire({
        title: 'Generando Excel...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await window.api.activoFijo.reportes.exportarExcel({
            vista:   vistaActual,
            titulo:  cfg.titulo,
            columnas: cols.map(c => ({ key: c.key, etiqueta: c.etiqueta, tipo: c.tipo })),
            filas
        });
        Swal.close();

        if (res && res.ok) {
            await Swal.fire({
                icon: 'success',
                title: 'Excel generado',
                html: `Se guardó en:<br><code style="background:#FFF7E8;padding:4px 8px;border-radius:6px;color:#2E3228;word-break:break-all;font-size:0.82rem;">${escaparHTML(res.ruta)}</code>`,
                showCloseButton: true,
                confirmButtonText: 'Aceptar',
                buttonsStyling: false,
                customClass: {
                    popup: 'cl-confirm',
                    confirmButton: 'swal2-confirm swal2-styled'
                }
            });
        } else if (res && res.mensaje === 'Cancelado') {
            // Cancelado por el usuario
        } else {
            toastError('No se pudo exportar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        Swal.close();
        toastError('Error al exportar', err.message);
    }
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