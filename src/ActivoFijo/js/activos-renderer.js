/* =========================================================
   ACTIVO FIJO — RENDERER DE INVENTARIO
   Formulario inteligente + tabs (Activos / Eliminados)
   + Motivo de baja/restauración + Modal de Histórico + Ver
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   ESTADO
   ========================================================= */
let activos        = [];
let tipos          = [];
let marcas         = [];
let estados        = [];
let estatus        = [];
let carteras       = [];
let sitios         = [];
let subtipos       = [];
let voltajes       = [];
let clasificaciones= [];
let tamanios       = [];
let capacidades    = [];
let modoEdicion    = false;
let idEditando     = null;
let guardando      = false;
let filtroBusqueda = '';
let vistaActual    = 'activos';   // 'activos' | 'eliminados'
let filtros        = { idTipo: '', idEstado: '', idEstatus: '', idCartera: '', idSitio: '' };

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabsVista        = document.getElementById('tabs-vista');
const tablaBody        = document.getElementById('tabla-body');
const formulario       = document.getElementById('formulario');
const mensaje          = document.getElementById('mensaje');
const btnGuardar       = document.getElementById('btn-guardar');
const btnNuevo         = document.getElementById('btn-nuevo');
const sinResultados    = document.getElementById('sin-resultados');
const sinResultadosTxt = document.getElementById('sin-resultados-texto');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtros');
const btnLimpiarVacio  = document.getElementById('btn-limpiar-busqueda-vacio');
const modal            = document.getElementById('modal-activo');
const modalTitulo      = document.getElementById('modal-titulo');
const filtroEstatusWrap= document.getElementById('filtro-estatus-wrap');

const selTipo          = document.getElementById('tipo');
const selMarca         = document.getElementById('marca');
const selEstado        = document.getElementById('estado');
const selEstatus       = document.getElementById('estatus');
const selCartera       = document.getElementById('cartera');
const selSitio         = document.getElementById('sitio');
const selSubtipo       = document.getElementById('subtipo');
const selClasificacion = document.getElementById('clasificacion');
const selTamanio       = document.getElementById('tamanio');
const selCapacidad     = document.getElementById('capacidad');
const selVoltaje       = document.getElementById('voltaje');

const inpModelo        = document.getElementById('modelo');
const inpNoSerie       = document.getElementById('noserie');
const inpIMEI1         = document.getElementById('imei1');
const inpIMEI2         = document.getElementById('imei2');
const inpNoTelefono    = document.getElementById('notelefono');
const inpUsuarioAsig   = document.getElementById('usuario-asignado');
const inpProcesador    = document.getElementById('procesador');
const inpRAM           = document.getElementById('ram');
const inpAlmacenamiento= document.getElementById('almacenamiento');
const inpSO            = document.getElementById('so');
const inpAccesorios    = document.getElementById('accesorios');
const inpPrecio        = document.getElementById('precio');
const inpObservaciones = document.getElementById('observaciones');

const filtroTipo       = document.getElementById('filtro-tipo');
const filtroEstado     = document.getElementById('filtro-estado');
const filtroEstatus    = document.getElementById('filtro-estatus');
const filtroCartera    = document.getElementById('filtro-cartera');
const filtroSitio      = document.getElementById('filtro-sitio');

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatearPrecio(val) {
    if (val === null || val === undefined || val === '') return null;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
}

function formatearFecha(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje ' + tipo;
}
function ocultarMensaje() { mensaje.className = 'mensaje oculto'; }

function setGuardando(v) {
    guardando = v;
    btnGuardar.disabled = v;
    btnGuardar.style.opacity = v ? '0.6' : '';
}

function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
        customClass: { popup: 'cl-toast cl-toast-success' },
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
        customClass: { popup: 'cl-toast cl-toast-error' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   CARGAR CATÁLOGOS AUXILIARES
   ========================================================= */
async function cargarCatalogos() {
    try {
        const [t, m, e, s, c, si, sub, vol, cla, tam, cap] = await Promise.all([
            window.api.activoFijo.activos.listarTipos(),
            window.api.activoFijo.activos.listarMarcas(),
            window.api.activoFijo.activos.listarEstados(),
            window.api.activoFijo.activos.listarEstatus(),
            window.api.activoFijo.activos.listarCarteras(),
            window.api.activoFijo.activos.listarSitios(),
            window.api.activoFijo.activos.listarSubtipos(),
            window.api.activoFijo.activos.listarVoltajes(),
            window.api.activoFijo.activos.listarClasificaciones(),
            window.api.activoFijo.activos.listarTamanios(),
            window.api.activoFijo.activos.listarCapacidades()
        ]);

        tipos           = t;
        marcas          = m;
        estados         = e;
        estatus         = s;
        carteras        = c;
        sitios          = si;
        subtipos        = sub;
        voltajes        = vol;
        clasificaciones = cla;
        tamanios        = tam;
        capacidades     = cap;

        selTipo.innerHTML    = '<option value="">— Seleccionar —</option>' +
            tipos.map(x => `<option value="${x.IdTipo}">${escaparHTML(x.Nombre)}</option>`).join('');
        selMarca.innerHTML   = '<option value="">— Sin marca —</option>' +
            marcas.map(x => `<option value="${x.IdMarca}">${escaparHTML(x.Nombre)}</option>`).join('');
        selEstado.innerHTML  = estados.map(x => `<option value="${x.IdEstado}">${escaparHTML(x.Nombre)}</option>`).join('');
        selEstatus.innerHTML = estatus.map(x => `<option value="${x.IdEstatus}">${escaparHTML(x.Nombre)}</option>`).join('');
        selCartera.innerHTML = '<option value="">— Sin cartera —</option>' +
            carteras.map(x => `<option value="${x.IdCartera}">${escaparHTML(x.Nombre)}</option>`).join('');
        selSitio.innerHTML   = '<option value="">— Sin sitio —</option>' +
            sitios.map(x => `<option value="${x.IdSitio}">${escaparHTML(x.Nombre)}</option>`).join('');
        selClasificacion.innerHTML = '<option value="">— Sin clasificación —</option>' +
            clasificaciones.map(x => `<option value="${x.IdClasificacion}">${escaparHTML(x.Nombre)}</option>`).join('');
        selTamanio.innerHTML = '<option value="">— Sin tamaño —</option>' +
            tamanios.map(x => `<option value="${x.IdTamanio}">${escaparHTML(x.Nombre)}</option>`).join('');
        selCapacidad.innerHTML = '<option value="">— Sin capacidad —</option>' +
            capacidades.map(x => `<option value="${x.IdCapacidad}">${escaparHTML(x.Nombre)}</option>`).join('');
        selVoltaje.innerHTML = '<option value="">— Sin voltaje —</option>' +
            voltajes.map(x => `<option value="${x.IdVoltaje}">${escaparHTML(x.Nombre)}</option>`).join('');

        filtroTipo.innerHTML    = '<option value="">Todos</option>' +
            tipos.map(x => `<option value="${x.IdTipo}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroEstado.innerHTML  = '<option value="">Todos</option>' +
            estados.map(x => `<option value="${x.IdEstado}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroEstatus.innerHTML = '<option value="">Todos</option>' +
            estatus.map(x => `<option value="${x.IdEstatus}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroCartera.innerHTML = '<option value="">Todas</option>' +
            carteras.map(x => `<option value="${x.IdCartera}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroSitio.innerHTML   = '<option value="">Todos</option>' +
            sitios.map(x => `<option value="${x.IdSitio}">${escaparHTML(x.Nombre)}</option>`).join('');
    } catch (err) {
        toastError('No se pudieron cargar los catálogos', err.message);
    }
}

/* =========================================================
   CARGAR ACTIVOS (según vista actual)
   ========================================================= */
async function cargarActivos() {
    try {
        const filtrosEnvio = { ...filtros };

        if (vistaActual === 'eliminados') {
            filtrosEnvio.soloEliminados = true;
            filtrosEnvio.idEstatus = '';
            filtros.idEstatus = '';
            filtroEstatus.value = '';
        }

        activos = await window.api.activoFijo.activos.listar(filtrosEnvio);
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los activos', err.message);
    }
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    const listaFiltrada = activos.filter(a => {
        if (!filtroBusqueda) return true;
        const texto = [
            a.NoSerie, a.IMEI1, a.IMEI2, a.NoTelefono,
            a.Marca, a.Modelo, a.Tipo, a.Cartera, a.Sitio,
            a.UsuarioAsignado, a.Observaciones,
            a.Procesador, a.MemoriaRAM, a.Almacenamiento, a.SistemaOperativo
        ].filter(Boolean).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    tablaBody.innerHTML = '';

    if (listaFiltrada.length === 0) {
        sinResultados.classList.remove('oculto');
        if (sinResultadosTxt) {
            sinResultadosTxt.textContent = vistaActual === 'eliminados'
                ? 'No hay activos dados de baja con ese criterio.'
                : 'No se encontraron activos con ese criterio.';
        }
        document.querySelector('.card-tabla').style.display = 'none';
        return;
    }

    sinResultados.classList.add('oculto');
    document.querySelector('.card-tabla').style.display = '';

    const esVistaEliminados = (vistaActual === 'eliminados');

    listaFiltrada.forEach(a => {
        const tr = document.createElement('tr');

        const identificadores = [];
        if (a.NoSerie)     identificadores.push(`<span class="principal">${escaparHTML(a.NoSerie)}</span>`);
        if (a.IMEI1)       identificadores.push(`<span class="secundario">IMEI1: ${escaparHTML(a.IMEI1)}</span>`);
        if (a.IMEI2)       identificadores.push(`<span class="secundario">IMEI2: ${escaparHTML(a.IMEI2)}</span>`);
        if (a.NoTelefono)  identificadores.push(`<span class="secundario">Tel: ${escaparHTML(a.NoTelefono)}</span>`);
        const htmlIdent = identificadores.length > 0
            ? identificadores.join('')
            : '<span class="vacio">Sin identificadores</span>';

        const precio = formatearPrecio(a.PrecioActivo);
        const htmlPrecio = precio
            ? `<span class="precio">${precio}</span>`
            : `<span class="precio vacio">—</span>`;

        const marcaModelo = [a.Marca, a.Modelo].filter(Boolean).join(' — ') || '—';

        tr.innerHTML = `
            <td><div class="identificadores">${htmlIdent}</div></td>
            <td>${escaparHTML(marcaModelo)}</td>
            <td><span class="badge badge-tipo">${escaparHTML(a.Tipo)}</span></td>
            <td><span class="badge badge-estado-${escaparHTML(a.Estado)}">${escaparHTML(a.Estado)}</span></td>
            <td><span class="badge badge-estatus-${escaparHTML(a.Estatus)}">${escaparHTML(a.Estatus)}</span></td>
            <td>${escaparHTML(a.Cartera ?? '—')}</td>
            <td>${escaparHTML(a.Sitio ?? '—')}</td>
            <td>${htmlPrecio}</td>
            <td class="acciones-tabla"></td>
        `;

        const celda = tr.querySelector('.acciones-tabla');

        /* ---- BOTÓN VER (siempre visible) ---- */
        const btnVer = document.createElement('button');
        btnVer.type = 'button';
        btnVer.className = 'secundario';
        btnVer.title = 'Ver detalle';
        btnVer.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg> Ver`;
        btnVer.addEventListener('click', () => verActivo(a.IdActivoFijoEQ));
        celda.appendChild(btnVer);

        /* ---- Vista ELIMINADOS → Historial + Restaurar ---- */
        if (esVistaEliminados) {
            const btnHistorial = document.createElement('button');
            btnHistorial.type = 'button';
            btnHistorial.className = 'secundario';
            btnHistorial.title = 'Ver histórico';
            btnHistorial.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg> Historial`;
            btnHistorial.addEventListener('click', () => verHistorico(a.IdActivoFijoEQ, a.NoSerie));
            celda.appendChild(btnHistorial);

            const btnRestaurar = document.createElement('button');
            btnRestaurar.type = 'button';
            btnRestaurar.className = 'exito';
            btnRestaurar.title = 'Restaurar activo';
            btnRestaurar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="1 4 1 10 7 10"></polyline>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg> Restaurar`;
            btnRestaurar.addEventListener('click', () => restaurarActivo(a.IdActivoFijoEQ, a.NoSerie));
            celda.appendChild(btnRestaurar);

            tablaBody.appendChild(tr);
            return;
        }

        /* ---- Vista ACTIVOS → Editar + Historial + Dar de baja ---- */
        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'secundario';
        btnEditar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg> Editar`;
        btnEditar.addEventListener('click', () => abrirEdicion(a.IdActivoFijoEQ));
        celda.appendChild(btnEditar);

        const btnHistorial = document.createElement('button');
        btnHistorial.type = 'button';
        btnHistorial.className = 'secundario';
        btnHistorial.title = 'Ver histórico';
        btnHistorial.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg> Historial`;
        btnHistorial.addEventListener('click', () => verHistorico(a.IdActivoFijoEQ, a.NoSerie));
        celda.appendChild(btnHistorial);

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'peligro';
        btnEliminar.title = 'Dar de baja';
        btnEliminar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg> Dar de baja`;
        btnEliminar.addEventListener('click', () => eliminarActivo(a.IdActivoFijoEQ));
        celda.appendChild(btnEliminar);

        tablaBody.appendChild(tr);
    });
}

/* =========================================================
   VER ACTIVO (SOLO LECTURA)
   Filtra las secciones según las banderas Requiere... del tipo
   ========================================================= */
function verActivo(id) {
    const a = activos.find(x => x.IdActivoFijoEQ === id);
    if (!a) { toastError('Activo no encontrado'); return; }

    const tipo = tipos.find(t => t.IdTipo === a.IdTipo) || {};

    const row = (etiqueta, valor) => {
        const val = (valor === null || valor === undefined || valor === '') ? '—' : valor;
        return `<div class="ver-item"><span class="ver-label">${escaparHTML(etiqueta)}</span><span class="ver-valor">${escaparHTML(val)}</span></div>`;
    };
    const rowBadge = (etiqueta, valor, claseBadge) => {
        if (!valor) return row(etiqueta, '—');
        return `<div class="ver-item"><span class="ver-label">${escaparHTML(etiqueta)}</span><span class="ver-valor"><span class="badge ${claseBadge}">${escaparHTML(valor)}</span></span></div>`;
    };

    /* ---------- SECCIÓN: Identificación (siempre visible) ---------- */
    const itemsIdent = [];
    itemsIdent.push(row('Tipo', a.Tipo));
    itemsIdent.push(row('Marca', a.Marca));
    itemsIdent.push(row('Modelo', a.Modelo));
    itemsIdent.push(row('No. Serie', a.NoSerie));

    if (tipo.RequiereIMEI) {
        if (a.IMEI1) itemsIdent.push(row('IMEI 1', a.IMEI1));
        if (a.IMEI2) itemsIdent.push(row('IMEI 2', a.IMEI2));
    }
    if (tipo.RequiereTelefono && a.NoTelefono) {
        itemsIdent.push(row('No. Teléfono', a.NoTelefono));
    }

    const seccionIdent = itemsIdent.length ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Identificación</div>
            <div class="ver-grid">${itemsIdent.join('')}</div>
        </div>
    ` : '';

    /* ---------- SECCIÓN: Ubicación y clasificación ---------- */
    const itemsUbi = [];
    if (tipo.RequiereSitio)           itemsUbi.push(row('Sitio', a.Sitio));
    if (tipo.RequiereSubtipo)         itemsUbi.push(row('Subtipo', a.Subtipo));
    if (tipo.RequiereClasificacion)   itemsUbi.push(row('Clasificación', a.Clasificacion));
    if (tipo.RequiereTamanio)         itemsUbi.push(row('Tamaño', a.Tamanio));
    if (tipo.RequiereCapacidad)       itemsUbi.push(row('Capacidad', a.Capacidad));
    if (tipo.RequiereVoltaje)         itemsUbi.push(row('Voltaje', a.Voltaje));
    if (tipo.RequiereUsuarioAsignado) itemsUbi.push(row('Usuario asignado', a.UsuarioAsignado));

    const seccionUbi = itemsUbi.length ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Ubicación y clasificación</div>
            <div class="ver-grid">${itemsUbi.join('')}</div>
        </div>
    ` : '';

    /* ---------- SECCIÓN: Situación ---------- */
    const itemsSit = [];
    itemsSit.push(rowBadge('Estado', a.Estado, 'badge-estado-' + a.Estado));
    itemsSit.push(rowBadge('Estatus', a.Estatus, 'badge-estatus-' + a.Estatus));
    itemsSit.push(row('Cartera', a.Cartera));
    if (tipo.RequierePrecio) {
        itemsSit.push(row('Precio', formatearPrecio(a.PrecioActivo) || '—'));
    }

    const seccionSit = `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Situación</div>
            <div class="ver-grid">${itemsSit.join('')}</div>
        </div>
    `;

    /* ---------- SECCIÓN: Especificaciones técnicas ---------- */
    const itemsSpec = [];
    if (tipo.RequiereEspecificaciones) {
        if (a.Procesador)       itemsSpec.push(row('Procesador', a.Procesador));
        if (a.MemoriaRAM)       itemsSpec.push(row('Memoria RAM', a.MemoriaRAM));
        if (a.Almacenamiento)   itemsSpec.push(row('Almacenamiento', a.Almacenamiento));
        if (a.SistemaOperativo) itemsSpec.push(row('Sistema Operativo', a.SistemaOperativo));
    }

    const seccionSpec = itemsSpec.length ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Especificaciones técnicas</div>
            <div class="ver-grid">${itemsSpec.join('')}</div>
        </div>
    ` : '';

    /* ---------- SECCIÓN: Accesorios ---------- */
    const seccionAcc = (tipo.RequiereAccesorios && a.Accesorios) ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Accesorios</div>
            <div class="ver-grid ver-grid-full">${row('Accesorios', a.Accesorios)}</div>
        </div>
    ` : '';

    /* ---------- SECCIÓN: Observaciones (siempre si hay) ---------- */
    const seccionObs = a.Observaciones ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Observaciones</div>
            <div class="ver-observaciones">${escaparHTML(a.Observaciones)}</div>
        </div>
    ` : '';

    /* ---------- Meta ---------- */
    const meta = `
        <div class="ver-meta">
            Creado: ${escaparHTML(formatearFecha(a.FechaCreacion))} ·
            Última modificación: ${escaparHTML(formatearFecha(a.FechaModificacion))}
        </div>
    `;

    const html = `
        <div class="ver-wrap">
            ${seccionIdent}
            ${seccionUbi}
            ${seccionSit}
            ${seccionSpec}
            ${seccionAcc}
            ${seccionObs}
            ${meta}
        </div>
    `;

    Swal.fire({
        title: `Activo #${a.IdActivoFijoEQ} — ${escaparHTML(a.NoSerie || a.IMEI1 || a.NoTelefono || '')}`,
        width: '780px',
        html,
        showCloseButton: true,
        showConfirmButton: true,
        confirmButtonText: 'Cerrar',
        customClass: { popup: 'cl-ver' }
    });
}

/* =========================================================
   TABS DE VISTA
   ========================================================= */
tabsVista.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-vista');
    if (!btn || btn.classList.contains('activo')) return;

    tabsVista.querySelectorAll('.tab-vista').forEach(t => t.classList.remove('activo'));
    btn.classList.add('activo');

    vistaActual = btn.dataset.vista;

    if (filtroEstatusWrap) {
        filtroEstatusWrap.classList.toggle('oculto', vistaActual === 'eliminados');
    }

    btnNuevo.disabled = (vistaActual === 'eliminados');
    btnNuevo.style.opacity = (vistaActual === 'eliminados') ? '0.5' : '';

    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');

    cargarActivos();
});

/* =========================================================
   BUSCADOR
   ========================================================= */
inputBusqueda.addEventListener('input', () => {
    filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
    btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
    renderTabla();
});

function limpiarBusqueda() {
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    renderTabla();
}
btnLimpiarBusq.addEventListener('click', limpiarBusqueda);
btnLimpiarVacio.addEventListener('click', limpiarBusqueda);

/* =========================================================
   FILTROS
   ========================================================= */
filtroTipo.addEventListener('change',    () => { filtros.idTipo    = filtroTipo.value;    cargarActivos(); });
filtroEstado.addEventListener('change',  () => { filtros.idEstado  = filtroEstado.value;  cargarActivos(); });
filtroEstatus.addEventListener('change', () => { filtros.idEstatus = filtroEstatus.value; cargarActivos(); });
filtroCartera.addEventListener('change', () => { filtros.idCartera = filtroCartera.value; cargarActivos(); });
filtroSitio.addEventListener('change',   () => { filtros.idSitio   = filtroSitio.value;   cargarActivos(); });

btnLimpiarFiltro.addEventListener('click', () => {
    filtros = { idTipo: '', idEstado: '', idEstatus: '', idCartera: '', idSitio: '' };
    filtroTipo.value = '';
    filtroEstado.value = '';
    filtroEstatus.value = '';
    filtroCartera.value = '';
    filtroSitio.value = '';
    cargarActivos();
});

/* =========================================================
   MODAL
   ========================================================= */
function abrirModal() {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
function cerrarModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    ocultarMensaje();
    modoEdicion = false;
    idEditando = null;
}
document.getElementById('modal-cerrar').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') cerrarModal();
});

/* =========================================================
   POBLAR SUBTIPOS SEGÚN EL GRUPO DEL TIPO
   ========================================================= */
function poblarSubtipos(grupo, valorSeleccionado = '') {
    if (!grupo) {
        selSubtipo.innerHTML = '<option value="">— Selecciona un tipo primero —</option>';
        selSubtipo.disabled = true;
        return;
    }

    const filtrados = subtipos.filter(s => s.Grupo === grupo);

    if (filtrados.length === 0) {
        selSubtipo.innerHTML = '<option value="">— Sin subtipos disponibles —</option>';
        selSubtipo.disabled = true;
        return;
    }

    selSubtipo.disabled = false;
    selSubtipo.innerHTML = '<option value="">— Seleccionar —</option>' +
        filtrados.map(s => {
            const sel = String(valorSeleccionado) === String(s.IdSubtipo) ? 'selected' : '';
            return `<option value="${s.IdSubtipo}" ${sel}>${escaparHTML(s.Nombre)}</option>`;
        }).join('');
}

/* =========================================================
   MOSTRAR/OCULTAR CAMPOS SEGÚN TIPO
   ========================================================= */
selTipo.addEventListener('change', actualizarCamposPorTipo);

function actualizarCamposPorTipo() {
    const idTipo = parseInt(selTipo.value, 10);
    const tipo = tipos.find(t => t.IdTipo === idTipo);

    const toggle = (selector, visible) => {
        document.querySelectorAll(selector).forEach(el => {
            el.classList.toggle('oculto', !visible);
        });
    };

    if (!tipo) {
        toggle('.campo-imei1', false);
        toggle('.campo-imei2', false);
        toggle('.campo-telefono', false);
        toggle('.campo-sitio', false);
        toggle('.campo-subtipo', false);
        toggle('.campo-clasificacion', false);
        toggle('.campo-tamanio', false);
        toggle('.campo-capacidad', false);
        toggle('.campo-voltaje', false);
        toggle('.campo-usuario-asignado', false);
        toggle('.campo-precio', false);
        toggle('.bloque-especificaciones', false);
        toggle('.campo-accesorios', false);
        poblarSubtipos(null);
        return;
    }

    toggle('.campo-imei1', !!tipo.RequiereIMEI);
    toggle('.campo-imei2', !!tipo.RequiereIMEI);
    toggle('.campo-telefono', !!tipo.RequiereTelefono);

    toggle('.campo-sitio',         !!tipo.RequiereSitio);
    toggle('.campo-subtipo',       !!tipo.RequiereSubtipo);
    toggle('.campo-clasificacion', !!tipo.RequiereClasificacion);
    toggle('.campo-tamanio',       !!tipo.RequiereTamanio);
    toggle('.campo-capacidad',     !!tipo.RequiereCapacidad);
    toggle('.campo-voltaje',       !!tipo.RequiereVoltaje);

    toggle('.campo-precio', !!tipo.RequierePrecio);
    toggle('.bloque-especificaciones', !!tipo.RequiereEspecificaciones);
    toggle('.campo-accesorios', !!tipo.RequiereAccesorios);

    if (tipo.RequiereSubtipo) {
        poblarSubtipos(tipo.GrupoSubtipo);
    } else {
        poblarSubtipos(null);
    }

    if (tipo.RequiereUsuarioAsignado) {
        const esAlmacenamiento = (tipo.Nombre === 'SSD NVME' || tipo.Nombre === 'DISCO MECANICO');
        if (esAlmacenamiento) {
            actualizarUsuarioAsignado();
        } else {
            toggle('.campo-usuario-asignado', true);
        }
    } else {
        toggle('.campo-usuario-asignado', false);
    }
}

/* =========================================================
   USUARIO ASIGNADO — Regla especial para almacenamiento
   ========================================================= */
selClasificacion.addEventListener('change', actualizarUsuarioAsignado);

function actualizarUsuarioAsignado() {
    const idTipo = parseInt(selTipo.value, 10);
    const tipo = tipos.find(t => t.IdTipo === idTipo);
    if (!tipo || !tipo.RequiereUsuarioAsignado) {
        document.querySelector('.campo-usuario-asignado')?.classList.add('oculto');
        return;
    }

    const esAlmacenamiento = (tipo.Nombre === 'SSD NVME' || tipo.Nombre === 'DISCO MECANICO');
    if (!esAlmacenamiento) {
        document.querySelector('.campo-usuario-asignado')?.classList.remove('oculto');
        return;
    }

    const idCla = parseInt(selClasificacion.value, 10);
    const cla = clasificaciones.find(c => c.IdClasificacion === idCla);
    const esExterno = cla && cla.Nombre.toUpperCase() === 'EXTERNO';

    document.querySelector('.campo-usuario-asignado')?.classList.toggle('oculto', !esExterno);
}

/* =========================================================
   LIMPIAR FORMULARIO
   ========================================================= */
function limpiarFormulario() {
    selTipo.value = '';
    selMarca.value = '';
    selEstado.value = estados[0]?.IdEstado ?? '';
    selEstatus.value = estatus[0]?.IdEstatus ?? '';
    selCartera.value = '';
    selSitio.value = '';
    selSubtipo.innerHTML = '<option value="">— Selecciona un tipo primero —</option>';
    selSubtipo.disabled = true;
    selClasificacion.value = '';
    selTamanio.value = '';
    selCapacidad.value = '';
    selVoltaje.value = '';
    inpModelo.value = '';
    inpNoSerie.value = '';
    inpIMEI1.value = '';
    inpIMEI2.value = '';
    inpNoTelefono.value = '';
    inpUsuarioAsig.value = '';
    inpProcesador.value = '';
    inpRAM.value = '';
    inpAlmacenamiento.value = '';
    inpSO.value = '';
    inpAccesorios.value = '';
    inpPrecio.value = '';
    inpObservaciones.value = '';
    actualizarCamposPorTipo();
}

/* =========================================================
   NUEVO
   ========================================================= */
btnNuevo.addEventListener('click', () => {
    if (vistaActual === 'eliminados') return;
    modoEdicion = false;
    idEditando = null;
    modalTitulo.textContent = 'Nuevo activo';
    limpiarFormulario();
    ocultarMensaje();
    abrirModal();
    selTipo.focus();
});

/* =========================================================
   EDITAR
   ========================================================= */
function abrirEdicion(id) {
    const a = activos.find(x => x.IdActivoFijoEQ === id);
    if (!a) { toastError('Activo no encontrado'); return; }

    modoEdicion = true;
    idEditando = id;
    modalTitulo.textContent = 'Editar activo';

    selTipo.value = a.IdTipo != null ? String(a.IdTipo) : '';
    actualizarCamposPorTipo();

    selMarca.value        = a.IdMarca   != null ? String(a.IdMarca)   : '';
    selEstado.value       = a.IdEstado  != null ? String(a.IdEstado)  : '';
    selEstatus.value      = a.IdEstatus != null ? String(a.IdEstatus) : '';
    selCartera.value      = a.IdCartera != null ? String(a.IdCartera) : '';
    selSitio.value        = a.IdSitio    != null ? String(a.IdSitio)    : '';
    selClasificacion.value= a.IdClasificacion != null ? String(a.IdClasificacion) : '';
    selTamanio.value      = a.IdTamanio    != null ? String(a.IdTamanio)    : '';
    selCapacidad.value    = a.IdCapacidad  != null ? String(a.IdCapacidad)  : '';
    selVoltaje.value      = a.IdVoltaje    != null ? String(a.IdVoltaje)    : '';

    const tipo = tipos.find(t => t.IdTipo === a.IdTipo);
    if (tipo && tipo.RequiereSubtipo) {
        poblarSubtipos(tipo.GrupoSubtipo, a.IdSubtipo);
    }

    actualizarUsuarioAsignado();

    inpModelo.value         = a.Modelo ?? '';
    inpNoSerie.value        = a.NoSerie ?? '';
    inpIMEI1.value          = a.IMEI1 ?? '';
    inpIMEI2.value          = a.IMEI2 ?? '';
    inpNoTelefono.value     = a.NoTelefono ?? '';
    inpUsuarioAsig.value    = a.UsuarioAsignado ?? '';
    inpProcesador.value     = a.Procesador ?? '';
    inpRAM.value            = a.MemoriaRAM ?? '';
    inpAlmacenamiento.value = a.Almacenamiento ?? '';
    inpSO.value             = a.SistemaOperativo ?? '';
    inpAccesorios.value     = a.Accesorios ?? '';
    inpPrecio.value         = a.PrecioActivo ?? '';
    inpObservaciones.value  = a.Observaciones ?? '';

    ocultarMensaje();
    abrirModal();
    selTipo.focus();
}

/* =========================================================
   GUARDAR — con validaciones por tipo y sin borrar campos
   que el tipo no requiere (ej. PrecioActivo).
   ========================================================= */
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    // --- Validación base ---
    if (!selTipo.value) {
        mostrarMensaje('El tipo es obligatorio.', 'error');
        return;
    }

    const idTipo = parseInt(selTipo.value, 10);
    const tipo = tipos.find(t => t.IdTipo === idTipo);
    if (!tipo) {
        mostrarMensaje('Tipo inválido.', 'error');
        return;
    }

    // --- Validación de identificadores ---
    const tieneSerie = inpNoSerie.value.trim();
    const tieneIMEI  = inpIMEI1.value.trim();
    const tieneTel   = inpNoTelefono.value.trim();

    if (!tieneSerie && !tieneIMEI && !tieneTel) {
        mostrarMensaje('Debes capturar al menos NoSerie, IMEI1 o NoTeléfono.', 'error');
        return;
    }

    // --- Validación de campos requeridos por el tipo ---
    if (tipo.RequiereSubtipo && !selSubtipo.value) {
        mostrarMensaje('El subtipo es obligatorio para este tipo.', 'error');
        return;
    }
    if (tipo.RequiereClasificacion && !selClasificacion.value) {
        mostrarMensaje('La clasificación es obligatoria para este tipo.', 'error');
        return;
    }
    if (tipo.RequiereTamanio && !selTamanio.value) {
        mostrarMensaje('El tamaño es obligatorio para este tipo.', 'error');
        return;
    }
    if (tipo.RequiereCapacidad && !selCapacidad.value) {
        mostrarMensaje('La capacidad es obligatoria para este tipo.', 'error');
        return;
    }
    if (tipo.RequiereVoltaje && !selVoltaje.value) {
        mostrarMensaje('El voltaje es obligatorio para este tipo.', 'error');
        return;
    }
    if (tipo.RequierePrecio && !inpPrecio.value.trim()) {
        mostrarMensaje('El precio es obligatorio para este tipo.', 'error');
        return;
    }

    // --- Construcción de datos ---
    const precioNum = inpPrecio.value.trim() ? parseFloat(inpPrecio.value) : null;

    const datos = {
        IdTipo:          idTipo,
        IdMarca:         selMarca.value ? parseInt(selMarca.value, 10) : null,
        IdCartera:       selCartera.value ? parseInt(selCartera.value, 10) : null,
        IdEstado:        selEstado.value ? parseInt(selEstado.value, 10) : null,
        IdEstatus:       selEstatus.value ? parseInt(selEstatus.value, 10) : null,

        IdSitio:         selSitio.value ? parseInt(selSitio.value, 10) : null,
        IdSubtipo:       selSubtipo.value ? parseInt(selSubtipo.value, 10) : null,
        IdClasificacion: selClasificacion.value ? parseInt(selClasificacion.value, 10) : null,
        IdTamanio:       selTamanio.value ? parseInt(selTamanio.value, 10) : null,
        IdCapacidad:     selCapacidad.value ? parseInt(selCapacidad.value, 10) : null,
        IdVoltaje:       selVoltaje.value ? parseInt(selVoltaje.value, 10) : null,
        UsuarioAsignado: inpUsuarioAsig.value.trim() || null,

        Modelo:          inpModelo.value.trim() || null,
        NoSerie:         inpNoSerie.value.trim() || null,
        IMEI1:           inpIMEI1.value.trim() || null,
        IMEI2:           inpIMEI2.value.trim() || null,
        NoTelefono:      inpNoTelefono.value.trim() || null,
        Procesador:      inpProcesador.value.trim() || null,
        MemoriaRAM:      inpRAM.value.trim() || null,
        Almacenamiento:  inpAlmacenamiento.value.trim() || null,
        SistemaOperativo: inpSO.value.trim() || null,
        Accesorios:      inpAccesorios.value.trim() || null,
        Observaciones:   inpObservaciones.value.trim() || null
    };

    // Precio: solo si el tipo lo requiere. Si no, NO se envía (undefined)
    // para que el backend no borre el valor existente en BD.
    if (tipo.RequierePrecio) {
        datos.PrecioActivo = Number.isFinite(precioNum) ? precioNum : null;
    }

    setGuardando(true);
    try {
        let res;
        if (modoEdicion && idEditando !== null) {
            res = await window.api.activoFijo.activos.actualizar(idEditando, datos);
        } else {
            res = await window.api.activoFijo.activos.crear(datos);
        }

        if (res && res.ok) {
            cerrarModal();
            await cargarActivos();
            toastExito(res.mensaje || 'Operación exitosa');
        } else {
            mostrarMensaje(res?.mensaje || 'No se pudo guardar.', 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    } finally {
        setGuardando(false);
    }
});

/* =========================================================
   ELIMINAR (Soft delete → BAJA) — CON MOTIVO
   ========================================================= */
async function eliminarActivo(id) {
    const a = activos.find(x => x.IdActivoFijoEQ === id);
    const nombre = a ? (a.NoSerie || a.IMEI1 || a.NoTelefono || `#${id}`) : `#${id}`;

    const { value: motivo, isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: '¿Dar de baja este activo?',
        html: `Se dará de baja <strong>${escaparHTML(nombre)}</strong>.<br>
               Podrás verlo y restaurarlo desde la pestaña <strong>Eliminados (BAJA)</strong>.`,
        input: 'textarea',
        inputLabel: 'Motivo de la baja',
        inputPlaceholder: 'Ej. Robo, daño, obsolescencia, venta, fin de vida útil...',
        inputAttributes: { maxlength: 500, rows: 3 },
        showCancelButton: true,
        confirmButtonText: 'Sí, dar de baja',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro',
            cancelButton: 'swal2-cancel swal2-styled'
        },
        inputValidator: (value) => {
            if (!value || !value.trim()) return 'El motivo es obligatorio';
            return null;
        }
    });

    if (!isConfirmed) return;

    try {
        const res = await window.api.activoFijo.activos.eliminar(id, motivo.trim());
        if (res && res.ok) {
            await cargarActivos();
            toastExito(res.mensaje || 'Activo dado de baja');
        } else {
            toastError('No se pudo dar de baja', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al dar de baja', err.message);
    }
}

/* =========================================================
   RESTAURAR — CON MOTIVO
   ========================================================= */
async function restaurarActivo(id, noSerie) {
    const { value: motivo, isConfirmed } = await Swal.fire({
        icon: 'question',
        title: '¿Restaurar activo?',
        html: `El activo <strong>${escaparHTML(noSerie || ('#' + id))}</strong> volverá al inventario activo con estatus <strong>STOCK/DISPONIBLE</strong>.`,
        input: 'textarea',
        inputLabel: 'Motivo de la restauración',
        inputPlaceholder: 'Ej. Devolución, corrección de baja, error administrativo...',
        inputAttributes: { maxlength: 500, rows: 3 },
        showCancelButton: true,
        confirmButtonText: 'Sí, restaurar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        },
        inputValidator: (value) => {
            if (!value || !value.trim()) return 'El motivo es obligatorio';
            return null;
        }
    });

    if (!isConfirmed) return;

    try {
        const res = await window.api.activoFijo.activos.restaurar(id, motivo.trim());
        if (res && res.ok) {
            await cargarActivos();
            toastExito(res.mensaje || 'Activo restaurado');
        } else {
            toastError('No se pudo restaurar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al restaurar', err.message);
    }
}

/* =========================================================
   VER HISTÓRICO
   ========================================================= */
async function verHistorico(id, noSerie) {
    try {
        const movs = await window.api.activoFijo.activos.historico(id);

        if (!movs || movs.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin movimientos',
                text: 'Este activo no tiene movimientos registrados.',
                confirmButtonText: 'Cerrar'
            });
            return;
        }

        const filas = movs.map(m => {
            const fecha   = formatearFecha(m.FechaMovimiento);
            const usuario = m.UsuarioMovimiento || (m.IdUsuarioMovimiento ? `ID ${m.IdUsuarioMovimiento}` : '—');
            const accion  = (m.Accion || 'EDICION').toUpperCase();
            const detalle = m.Detalle || '—';
            const motivo  = m.Motivo
                ? `<div class="his-motivo"><b>Motivo:</b> ${escaparHTML(m.Motivo)}</div>`
                : '';
            const cambios = [];
            if (m.EstatusAnterior !== m.EstatusNuevo && (m.EstatusAnterior || m.EstatusNuevo)) {
                cambios.push(`Estatus: <b>${escaparHTML(m.EstatusAnterior ?? '—')}</b> → <b>${escaparHTML(m.EstatusNuevo ?? '—')}</b>`);
            }
            if (m.SitioAnterior !== m.SitioNuevo && (m.SitioAnterior || m.SitioNuevo)) {
                cambios.push(`Sitio: <b>${escaparHTML(m.SitioAnterior ?? '—')}</b> → <b>${escaparHTML(m.SitioNuevo ?? '—')}</b>`);
            }
            if (m.UsuarioAsignadoAnterior !== m.UsuarioAsignadoNuevo && (m.UsuarioAsignadoAnterior || m.UsuarioAsignadoNuevo)) {
                cambios.push(`Asignado: <b>${escaparHTML(m.UsuarioAsignadoAnterior ?? '—')}</b> → <b>${escaparHTML(m.UsuarioAsignadoNuevo ?? '—')}</b>`);
            }
            const bloqueCambios = cambios.length
                ? `<div class="his-cambios">${cambios.join('<br>')}</div>`
                : '';

            return `
                <tr>
                    <td class="his-fecha">${escaparHTML(fecha)}</td>
                    <td><span class="his-badge his-${escaparHTML(accion.toLowerCase())}">${escaparHTML(accion)}</span></td>
                    <td>${escaparHTML(usuario)}</td>
                    <td>
                        ${escaparHTML(detalle)}
                        ${bloqueCambios}
                        ${motivo}
                    </td>
                </tr>
            `;
        }).join('');

        Swal.fire({
            title: `Histórico — ${escaparHTML(noSerie || ('#' + id))}`,
            width: '960px',
            html: `
                <div class="his-wrap">
                    <table class="his-tabla">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Acción</th>
                                <th>Usuario</th>
                                <th>Detalle</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            `,
            showCloseButton: true,
            showConfirmButton: false,
            customClass: { popup: 'cl-historico' }
        });
    } catch (err) {
        toastError('No se pudo cargar el histórico', err.message);
    }
}

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
    await cargarActivos();
})();