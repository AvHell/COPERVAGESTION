/* =========================================================
   ACTIVO FIJO — RENDERER DE RESPONSIVAS
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   ESTADO
   ========================================================= */
let responsivas      = [];
let activosDisp      = [];
let carteras         = [];
let puestos          = [];
let modoEdicion      = false;
let idEditando       = null;
let guardando        = false;
let filtroBusqueda   = '';
let vistaActual      = 'activas';
let filtros          = { idEstatus: '' };
let activoActual     = null;

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
const modal            = document.getElementById('modal-responsiva');
const modalTitulo      = document.getElementById('modal-titulo');
const filtroEstatus    = document.getElementById('filtro-estatus');
const filtroEstatusWrap= document.getElementById('filtro-estatus-wrap');
const cardTabla        = document.getElementById('card-tabla');

const selActivo        = document.getElementById('activo');
const inpFolio         = document.getElementById('folio');
const inpTipoResp      = document.getElementById('tipo-responsiva');
const inpFechaAsig     = document.getElementById('fecha-asignacion');
const inpFechaDev      = document.getElementById('fecha-devolucion');
const selEstatus       = document.getElementById('estatus');
const inpMotivo        = document.getElementById('motivo');
const inpProyecto      = document.getElementById('proyecto');
const inpDescripcion   = document.getElementById('descripcion');
const inpNombreRecibe  = document.getElementById('nombre-recibe');
const inpPuestoRecibe  = document.getElementById('puesto-recibe');
const inpAreaRecibe    = document.getElementById('area-recibe');
const inpCorreoRecibe  = document.getElementById('correo-recibe');
const selCartera       = document.getElementById('cartera');
const selPuestoCat     = document.getElementById('puesto-cat');
const inpNombreEntrega = document.getElementById('nombre-entrega');
const inpPuestoEntrega = document.getElementById('puesto-entrega');
const inpAreaEntrega   = document.getElementById('area-entrega');
const inpRutaPDF       = document.getElementById('ruta-pdf');
const inpRutaINE       = document.getElementById('ruta-ine');
const inpRutaComprob   = document.getElementById('ruta-comprobante');
const inpObservaciones = document.getElementById('observaciones');
const infoActivo       = document.getElementById('info-activo');

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fechaAInput(valor) {
    if (!valor) return '';
    if (valor instanceof Date) {
        if (isNaN(valor.getTime())) return '';
        const y = valor.getFullYear();
        const m = String(valor.getMonth() + 1).padStart(2, '0');
        const d = String(valor.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(valor);
    const soloFecha = s.split(/[T\s]/)[0];
    if (!soloFecha) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(soloFecha)) return soloFecha;
    const d2 = new Date(valor);
    if (isNaN(d2.getTime())) return '';
    return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`;
}

function formatearFecha(f) {
    if (!f) return 'N/A';
    const d = new Date(f);
    if (isNaN(d.getTime())) return 'N/A';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
}

function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'alert ' + tipo;
    mensaje.classList.remove('oculto');
}
function ocultarMensaje() { mensaje.classList.add('oculto'); }

function setGuardando(v) {
    guardando = v;
    btnGuardar.disabled = v;
    const txt = btnGuardar.querySelector('.btn-text');
    const spin = btnGuardar.querySelector('.btn-spinner');
    if (txt) txt.textContent = v ? 'Guardando...' : 'Guardar';
    if (spin) spin.classList.toggle('oculto', !v);
}

/* =========================================================
   ALERTAS MODALES
   ========================================================= */
function alertaExito(titulo, mensaje = '') {
    return Swal.fire({
        icon: 'success',
        title: titulo,
        html: mensaje ? `<p style="margin:0;">${mensaje}</p>` : undefined,
        timer: 2100,
        timerProgressBar: true,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'cl-alert' }
    });
}

function alertaError(titulo, mensaje = '') {
    return Swal.fire({
        icon: 'error',
        title: titulo,
        html: mensaje ? `<p style="margin:0;">${mensaje}</p>` : undefined,
        confirmButtonText: 'Entendido',
        showCloseButton: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-alert',
            confirmButton: 'swal2-confirm swal2-styled'
        }
    });
}

/* =========================================================
   REGLAS DE ACTIVO
   ========================================================= */
const REGLAS_TIPO = {
    celular: { etiqueta: 'Celular / Smartphone', requiereIMEI: true, requiereTelefono: true, esLaptop: false, icono: '📱' },
    laptop: { etiqueta: 'Laptop / Equipo de cómputo', requiereIMEI: false, requiereTelefono: false, esLaptop: true, icono: '💻' },
    otro: { etiqueta: 'Otro activo', requiereIMEI: false, requiereTelefono: false, esLaptop: false, icono: '📦' }
};

function detectarTipoActivo(activo) {
    if (!activo) return 'otro';
    const tipoTxt = String(activo.Tipo ?? '').toLowerCase();
    const tieneIMEI = !!activo.IMEI1;
    const tieneTelefono = !!activo.NoTelefono;
    const banderaIMEI = activo.RequiereIMEI === true || activo.RequiereIMEI === 1;
    const banderaTel  = activo.RequiereTelefono === true || activo.RequiereTelefono === 1;

    if (tipoTxt.includes('cel') || tipoTxt.includes('smart') || tipoTxt.includes('móvil') || tipoTxt.includes('movil') || tipoTxt.includes('phone')) {
        return 'celular';
    }
    if (tipoTxt.includes('laptop') || tipoTxt.includes('portátil') || tipoTxt.includes('portatil') || tipoTxt.includes('pc') || tipoTxt.includes('comput') || tipoTxt.includes('macbook') || tipoTxt.includes('notebook')) {
        return 'laptop';
    }
    if (banderaIMEI || tieneIMEI || banderaTel || tieneTelefono) {
        return 'celular';
    }
    return 'otro';
}

function obtenerReglas(activo) {
    const tipo = detectarTipoActivo(activo);
    return { tipo, ...REGLAS_TIPO[tipo] };
}

function aplicarReglasActivo(activo) {
    activoActual = activo;
    const reglas = obtenerReglas(activo);

    document.querySelectorAll('[data-campo="imei"]').forEach(el => el.classList.toggle('oculto', !reglas.requiereIMEI));
    document.querySelectorAll('[data-campo="telefono"]').forEach(el => el.classList.toggle('oculto', !reglas.requiereTelefono));
    document.querySelectorAll('[data-campo="especificaciones"]').forEach(el => el.classList.toggle('oculto', !reglas.esLaptop));

    if (activo) inpTipoResp.value = activo.Tipo || '';

    if (!reglas.requiereIMEI) {
        const inpIMEI = document.getElementById('imei-1');
        if (inpIMEI) inpIMEI.value = '';
        const inpIMEI2 = document.getElementById('imei-2');
        if (inpIMEI2) inpIMEI2.value = '';
    }
    if (!reglas.requiereTelefono) {
        const inpTel = document.getElementById('telefono-receptor');
        if (inpTel) inpTel.value = '';
    }

    inpFolio.placeholder = reglas.tipo === 'celular' ? 'INC-20260914-3500' : reglas.tipo === 'laptop' ? 'INC-20260914-3501' : 'INC-20260914-3502';
}

/* =========================================================
   CARGAR CATÁLOGOS AUXILIARES
   ========================================================= */
async function cargarCatalogos() {
    try {
        const [c, p] = await Promise.all([
            window.api.activoFijo.responsivas.listarCarteras(),
            window.api.activoFijo.responsivas.listarPuestos()
        ]);
        carteras = c;
        puestos  = p;

        selCartera.innerHTML = '<option value="">— Sin cartera —</option>' + carteras.map(x => `<option value="${x.IdCartera}">${escaparHTML(x.Nombre)}</option>`).join('');
        selPuestoCat.innerHTML = '<option value="">— Sin puesto —</option>' + puestos.map(x => `<option value="${x.IdPuesto}">${escaparHTML(x.Nombre)}</option>`).join('');
    } catch (err) {
        alertaError('No se pudieron cargar los catálogos', err.message);
    }
}

/* =========================================================
   CARGAR ACTIVOS DISPONIBLES
   ========================================================= */
async function cargarActivosDisponibles() {
    try {
        activosDisp = await window.api.activoFijo.responsivas.activosDisponibles();
        selActivo.innerHTML = '<option value="">— Seleccionar activo —</option>' +
            activosDisp.map(a => {
                const id = [a.Marca, a.Modelo].filter(Boolean).join(' ');
                const serie = a.NoSerie || a.IMEI1 || a.NoTelefono || 'sin serie';
                const reglas = obtenerReglas(a);
                return `<option value="${a.IdActivoFijoEQ}">${reglas.icono} [${escaparHTML(a.Tipo)}] ${escaparHTML(id)} — ${escaparHTML(serie)}</option>`;
            }).join('');
    } catch (err) {
        alertaError('No se pudieron cargar los activos', err.message);
    }
}

/* =========================================================
   CARGAR RESPONSIVAS
   ========================================================= */
async function cargarResponsivas() {
    try {
        const filtrosEnvio = { ...filtros };

        if (vistaActual === 'canceladas') {
            filtrosEnvio.soloCancelados = true;
            filtrosEnvio.idEstatus = '';
            filtros.idEstatus = '';
            filtroEstatus.value = '';
        }

        responsivas = await window.api.activoFijo.responsivas.listar(filtrosEnvio);
        renderTabla();
    } catch (err) {
        alertaError('No se pudieron cargar las responsivas', err.message);
    }
}

/* =========================================================
   ICONOS SVG
   ========================================================= */
function iconoOjo() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
}
function iconoGuardar() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
}
function iconoEditar() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
}
function iconoDevolver() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
}
function iconoCancelar() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;
}

/* =========================================================
   BOTONES DE ACCIÓN
   ========================================================= */
function crearBotonAccion(icono, tooltip, clase, accion) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-accion ${clase}`;
    btn.setAttribute('data-tooltip', tooltip);
    btn.innerHTML = icono;
    btn.addEventListener('click', accion);
    return btn;
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    const listaFiltrada = responsivas.filter(r => {
        if (!filtroBusqueda) return true;
        const texto = [r.FolioTicket, r.NoSerie, r.IMEI1, r.IMEI2, r.NoTelefono, r.NombreRecibe, r.Cartera, r.Tipo, r.Marca, r.Modelo].filter(Boolean).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    tablaBody.innerHTML = '';

    if (listaFiltrada.length === 0) {
        sinResultados.classList.remove('oculto');
        if (sinResultadosTxt) {
            sinResultadosTxt.textContent = vistaActual === 'canceladas'
                ? 'No hay responsivas canceladas con ese criterio.'
                : 'No se encontraron responsivas con ese criterio.';
        }
        cardTabla.style.display = 'none';
        return;
    }

    sinResultados.classList.add('oculto');
    cardTabla.style.display = '';

    const esVistaCanceladas = (vistaActual === 'canceladas');

    listaFiltrada.forEach(r => {
        const tr = document.createElement('tr');
        const reglas = obtenerReglas({ Tipo: r.Tipo, IMEI1: r.IMEI1, NoTelefono: r.NoTelefono });

        const tipoMarca = [r.Tipo, r.Marca, r.Modelo].filter(Boolean).join(' ');
        const serieHtml = r.NoSerie ? `<span class="serie">SN: ${escaparHTML(r.NoSerie)}</span>` : '';
        const imeiHtml  = (reglas.requiereIMEI && r.IMEI1) ? `<span class="extra">IMEI: ${escaparHTML(r.IMEI1)}</span>` : '';
        const telHtml   = (reglas.requiereTelefono && r.NoTelefono) ? `<span class="extra">Tel: ${escaparHTML(r.NoTelefono)}</span>` : '';

        const activoHtml = `
            <div class="activo-info">
                <span class="tipo-marca">${reglas.icono} ${escaparHTML(tipoMarca || '—')}</span>
                ${serieHtml}
                ${imeiHtml}
                ${telHtml}
            </div>`;

        const personaHtml = `
            <div class="persona-info">
                <span class="nombre">${escaparHTML(r.NombreRecibe)}</span>
                ${r.PuestoRecibe ? `<span class="puesto">${escaparHTML(r.PuestoRecibe)}</span>` : ''}
            </div>`;

        tr.innerHTML = `
            <td data-label="Folio"><span class="folio-ticket">${escaparHTML(r.FolioTicket)}</span></td>
            <td data-label="Activo">${activoHtml}</td>
            <td data-label="Persona">${personaHtml}</td>
            <td data-label="Cartera">${escaparHTML(r.Cartera ?? '—')}</td>
            <td data-label="F. Asignación"><span class="fecha">${formatearFecha(r.FechaAsignacion)}</span></td>
            <td data-label="F. Devolución"><span class="fecha">${formatearFecha(r.FechaDevolucionReal || r.FechaDevolucionProgramada)}</span></td>
            <td data-label="Estatus"><span class="badge-estatus badge-estatus-${escaparHTML(r.EstatusResponsiva)}">${escaparHTML(r.EstatusResponsiva)}</span></td>
            <td class="acciones-tabla" data-label="Acciones"></td>
        `;

        const celda = tr.querySelector('.acciones-tabla');

        if (esVistaCanceladas) {
            celda.appendChild(crearBotonAccion(iconoOjo(), 'Ver detalle', 'ver', () => verDetalle(r.IdResponsiva)));
            celda.appendChild(crearBotonAccion(iconoOjo(), 'Ver PDF', 'ver', () => verPDFResponsiva(r.IdResponsiva, r.FolioTicket)));
            celda.appendChild(crearBotonAccion(iconoGuardar(), 'Guardar PDF', 'guardar', () => guardarPDFResponsiva(r.IdResponsiva, r.FolioTicket, r.RutaPDF)));
            tablaBody.appendChild(tr);
            return;
        }

        /* ---- Vista ACTIVAS ---- */
        celda.appendChild(crearBotonAccion(iconoEditar(), 'Editar', 'editar', () => abrirEdicion(r.IdResponsiva)));
        celda.appendChild(crearBotonAccion(iconoOjo(), 'Ver PDF', 'ver', () => verPDFResponsiva(r.IdResponsiva, r.FolioTicket)));
        celda.appendChild(crearBotonAccion(iconoGuardar(), 'Guardar PDF', 'guardar', () => guardarPDFResponsiva(r.IdResponsiva, r.FolioTicket, r.RutaPDF)));

        if (r.EstatusResponsiva === 'ASIGNADO' || r.EstatusResponsiva === 'PENDIENTE') {
            celda.appendChild(crearBotonAccion(iconoDevolver(), 'Registrar devolución', 'exito', () => devolverResponsiva(r.IdResponsiva, r.NombreRecibe)));
            celda.appendChild(crearBotonAccion(iconoCancelar(), 'Cancelar responsiva', 'eliminar', () => cancelarResponsiva(r.IdResponsiva, r.FolioTicket)));
        }

        tablaBody.appendChild(tr);
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
        filtroEstatusWrap.classList.toggle('oculto', vistaActual === 'canceladas');
    }

    btnNuevo.disabled = (vistaActual === 'canceladas');
    btnNuevo.style.opacity = (vistaActual === 'canceladas') ? '0.5' : '';

    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');

    cargarResponsivas();
});

/* =========================================================
   BUSCADOR Y FILTROS
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

filtroEstatus.addEventListener('change', () => {
    filtros.idEstatus = filtroEstatus.value;
    cargarResponsivas();
});

btnLimpiarFiltro.addEventListener('click', () => {
    filtros.idEstatus = '';
    filtroEstatus.value = '';
    cargarResponsivas();
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
    activoActual = null;
    selActivo.disabled = false;
}

document.getElementById('modal-cerrar').addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') cerrarModal();
});

/* =========================================================
   INFO DEL ACTIVO
   ========================================================= */
selActivo.addEventListener('change', () => {
    const id = parseInt(selActivo.value, 10);
    const a = activosDisp.find(x => x.IdActivoFijoEQ === id);

    if (!a) {
        infoActivo.classList.add('oculto');
        infoActivo.innerHTML = '';
        inpTipoResp.value = '';
        aplicarReglasActivo(null);
        return;
    }

    aplicarReglasActivo(a);
    const reglas = obtenerReglas(a);
    const marcaModelo = [a.Marca, a.Modelo].filter(Boolean).join(' ') || '—';

    let html = `<div class="info-activo-tipo">${reglas.icono} <strong>${escaparHTML(a.Tipo)}</strong> — ${escaparHTML(marcaModelo)}</div><div class="info-activo-grid">`;
    if (a.NoSerie)    html += `<div><b>Serie:</b> ${escaparHTML(a.NoSerie)}</div>`;
    if (reglas.requiereIMEI && a.IMEI1) html += `<div><b>IMEI 1:</b> ${escaparHTML(a.IMEI1)}</div>`;
    if (reglas.requiereIMEI && a.IMEI2) html += `<div><b>IMEI 2:</b> ${escaparHTML(a.IMEI2)}</div>`;
    if (reglas.requiereTelefono && a.NoTelefono) html += `<div><b>Teléfono:</b> ${escaparHTML(a.NoTelefono)}</div>`;
    if (reglas.esLaptop) {
        if (a.Procesador)     html += `<div><b>Procesador:</b> ${escaparHTML(a.Procesador)}</div>`;
        if (a.MemoriaRAM)     html += `<div><b>RAM:</b> ${escaparHTML(a.MemoriaRAM)}</div>`;
        if (a.Almacenamiento) html += `<div><b>Almacenamiento:</b> ${escaparHTML(a.Almacenamiento)}</div>`;
    }
    if (a.PrecioActivo) html += `<div><b>Precio:</b> $${Number(a.PrecioActivo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>`;
    html += '</div>';

    infoActivo.innerHTML = html;
    infoActivo.classList.remove('oculto');
});

/* =========================================================
   LIMPIAR FORMULARIO
   ========================================================= */
function limpiarFormulario() {
    selActivo.value = '';
    inpFolio.value = '';
    inpTipoResp.value = '';
    inpFechaAsig.value = hoyISO();
    inpFechaDev.value = '';
    selEstatus.value = 'ASIGNADO';
    inpMotivo.value = '';
    inpProyecto.value = '';
    inpDescripcion.value = '';
    inpNombreRecibe.value = '';
    inpPuestoRecibe.value = '';
    inpAreaRecibe.value = '';
    inpCorreoRecibe.value = '';
    selCartera.value = '';
    selPuestoCat.value = '';
    inpObservaciones.value = '';
    inpNombreEntrega.value = '';
    inpPuestoEntrega.value = '';
    inpAreaEntrega.value = 'Sistemas';
    inpRutaPDF.value = '';
    inpRutaINE.value = '';
    inpRutaComprob.value = '';
    
    const inpIMEI = document.getElementById('imei-1');
    if (inpIMEI) inpIMEI.value = '';
    const inpIMEI2 = document.getElementById('imei-2');
    if (inpIMEI2) inpIMEI2.value = '';
    const inpTel = document.getElementById('telefono-receptor');
    if (inpTel) inpTel.value = '';

    infoActivo.classList.add('oculto');
    infoActivo.innerHTML = '';
    selActivo.disabled = false;
    aplicarReglasActivo(null);
}

/* =========================================================
   NUEVO
   ========================================================= */
btnNuevo.addEventListener('click', async () => {
    if (vistaActual === 'canceladas') return;
    modoEdicion = false;
    idEditando = null;
    modalTitulo.textContent = 'Nueva responsiva';
    await cargarActivosDisponibles();
    limpiarFormulario();
    ocultarMensaje();
    abrirModal();
    selActivo.focus();
});

/* =========================================================
   EDITAR
   ========================================================= */
async function abrirEdicion(id) {
    const r = responsivas.find(x => x.IdResponsiva === id);
    if (!r) { alertaError('Responsiva no encontrada'); return; }

    modoEdicion = true;
    idEditando = id;
    modalTitulo.textContent = 'Editar responsiva';

    await cargarActivosDisponibles();

    const existe = activosDisp.find(a => a.IdActivoFijoEQ === r.IdActivoFijoEQ);
    if (!existe) {
        const opt = document.createElement('option');
        opt.value = r.IdActivoFijoEQ;
        opt.textContent = `[${r.Tipo}] ${r.Marca ?? ''} ${r.Modelo ?? ''} — ${r.NoSerie || r.IMEI1 || ''}`;
        selActivo.appendChild(opt);
    }
    selActivo.value = r.IdActivoFijoEQ;
    selActivo.disabled = true;

    const activoParaReglas = existe || {
        Tipo: r.Tipo, Marca: r.Marca, Modelo: r.Modelo, NoSerie: r.NoSerie, IMEI1: r.IMEI1, IMEI2: r.IMEI2,
        NoTelefono: r.NoTelefono, PrecioActivo: r.PrecioActivo, RequiereIMEI: r.RequiereIMEI, RequiereTelefono: r.RequiereTelefono
    };
    aplicarReglasActivo(activoParaReglas);

    inpFolio.value         = r.FolioTicket ?? '';
    inpTipoResp.value      = r.TipoResponsiva ?? r.Tipo ?? '';
    inpFechaAsig.value     = fechaAInput(r.FechaAsignacion);
    inpFechaDev.value      = fechaAInput(r.FechaDevolucionProgramada);
    selEstatus.value       = r.EstatusResponsiva ?? 'ASIGNADO';
    inpMotivo.value        = r.MotivoSalida ?? '';
    inpProyecto.value      = r.NombreProyecto ?? '';
    inpDescripcion.value   = r.DescripcionSolicitud ?? '';
    inpNombreRecibe.value  = r.NombreRecibe ?? '';
    inpPuestoRecibe.value  = r.PuestoRecibe ?? '';
    inpAreaRecibe.value    = r.AreaRecibe ?? '';
    inpCorreoRecibe.value  = r.CorreoRecibe ?? '';
    selCartera.value       = r.IdCartera != null ? String(r.IdCartera) : '';
    selPuestoCat.value     = r.IdPuesto  != null ? String(r.IdPuesto)  : '';
    inpObservaciones.value = r.Observaciones ?? '';
    inpNombreEntrega.value = r.NombreEntrega ?? '';
    inpPuestoEntrega.value = r.PuestoEntrega ?? '';
    inpAreaEntrega.value   = r.AreaEntrega ?? 'Sistemas';
    inpRutaPDF.value       = r.RutaPDF ?? '';
    inpRutaINE.value       = r.RutaINE ?? '';
    inpRutaComprob.value   = r.RutaComprobanteDomicilio ?? '';

    const inpIMEI = document.getElementById('imei-1');
    if (inpIMEI) inpIMEI.value = r.IMEI1 ?? '';
    const inpIMEI2 = document.getElementById('imei-2');
    if (inpIMEI2) inpIMEI2.value = r.IMEI2 ?? '';
    const inpTel = document.getElementById('telefono-receptor');
    if (inpTel) inpTel.value = r.NoTelefono ?? '';

    const reglas = obtenerReglas(activoParaReglas);
    const marcaModelo = [r.Tipo, r.Marca, r.Modelo].filter(Boolean).join(' ');
    let html = `<div class="info-activo-tipo">${reglas.icono} <strong>${escaparHTML(r.Tipo)}</strong> — ${escaparHTML(marcaModelo)}</div><div class="info-activo-grid">`;
    if (r.NoSerie) html += `<div><b>Serie:</b> ${escaparHTML(r.NoSerie)}</div>`;
    if (reglas.requiereIMEI && r.IMEI1) html += `<div><b>IMEI 1:</b> ${escaparHTML(r.IMEI1)}</div>`;
    if (reglas.requiereTelefono && r.NoTelefono) html += `<div><b>Teléfono:</b> ${escaparHTML(r.NoTelefono)}</div>`;
    html += '</div>';
    infoActivo.innerHTML = html;
    infoActivo.classList.remove('oculto');

    ocultarMensaje();
    abrirModal();
}

/* =========================================================
   VER DETALLE
   ========================================================= */
async function verDetalle(id) {
    const r = responsivas.find(x => x.IdResponsiva === id);
    if (!r) { alertaError('Responsiva no encontrada'); return; }

    const reglas = obtenerReglas({ Tipo: r.Tipo, IMEI1: r.IMEI1, NoTelefono: r.NoTelefono });

    let activoHtml = `
        <div class="det-linea"><b>Tipo:</b> ${escaparHTML(r.Tipo ?? '—')}</div>
        <div class="det-linea"><b>Marca / Modelo:</b> ${escaparHTML([r.Marca, r.Modelo].filter(Boolean).join(' ') || '—')}</div>
        ${r.NoSerie ? `<div class="det-linea"><b>Serie:</b> ${escaparHTML(r.NoSerie)}</div>` : ''}
    `;
    if (reglas.requiereIMEI && r.IMEI1) activoHtml += `<div class="det-linea"><b>IMEI 1:</b> ${escaparHTML(r.IMEI1)}</div>`;
    if (reglas.requiereIMEI && r.IMEI2) activoHtml += `<div class="det-linea"><b>IMEI 2:</b> ${escaparHTML(r.IMEI2)}</div>`;
    if (reglas.requiereTelefono && r.NoTelefono) activoHtml += `<div class="det-linea"><b>Teléfono:</b> ${escaparHTML(r.NoTelefono)}</div>`;

    const html = `
        <div class="detalle-resp">
            <div class="det-seccion">
                <div class="det-titulo">Ticket</div>
                <div class="det-linea"><b>Folio:</b> ${escaparHTML(r.FolioTicket)}</div>
                <div class="det-linea"><b>Estatus:</b> ${escaparHTML(r.EstatusResponsiva)}</div>
                <div class="det-linea"><b>Tipo:</b> ${escaparHTML(r.TipoResponsiva ?? '—')}</div>
                <div class="det-linea"><b>Fecha asignación:</b> ${formatearFecha(r.FechaAsignacion)}</div>
                <div class="det-linea"><b>Fecha devolución:</b> ${formatearFecha(r.FechaDevolucionReal || r.FechaDevolucionProgramada)}</div>
            </div>
            <div class="det-seccion">
                <div class="det-titulo">Activo</div>
                ${activoHtml}
            </div>
            <div class="det-seccion">
                <div class="det-titulo">Persona</div>
                <div class="det-linea"><b>Nombre:</b> ${escaparHTML(r.NombreRecibe)}</div>
                ${r.PuestoRecibe ? `<div class="det-linea"><b>Puesto:</b> ${escaparHTML(r.PuestoRecibe)}</div>` : ''}
                ${r.AreaRecibe   ? `<div class="det-linea"><b>Área:</b> ${escaparHTML(r.AreaRecibe)}</div>` : ''}
                ${r.CorreoRecibe ? `<div class="det-linea"><b>Correo:</b> ${escaparHTML(r.CorreoRecibe)}</div>` : ''}
            </div>
            ${r.Observaciones ? `
            <div class="det-seccion">
                <div class="det-titulo">Observaciones</div>
                <div class="det-linea">${escaparHTML(r.Observaciones)}</div>
            </div>` : ''}
        </div>
    `;

    Swal.fire({
        title: `Folio ${escaparHTML(r.FolioTicket)}`,
        width: '820px',
        html,
        showCloseButton: true,
        showConfirmButton: false,
        customClass: { popup: 'cl-historico' }
    });
}

/* =========================================================
   GUARDAR
   ========================================================= */
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    if (!modoEdicion && !selActivo.value) {
        mostrarMensaje('Debes seleccionar un activo.', 'error');
        return;
    }
    if (!inpFolio.value.trim()) {
        mostrarMensaje('El folio es obligatorio.', 'error');
        return;
    }
    if (!inpFechaAsig.value) {
        mostrarMensaje('La fecha de asignación es obligatoria.', 'error');
        return;
    }
    if (!inpNombreRecibe.value.trim()) {
        mostrarMensaje('El nombre de quien recibe es obligatorio.', 'error');
        return;
    }

    const activo = activosDisp.find(a => a.IdActivoFijoEQ === parseInt(selActivo.value, 10)) || activoActual;
    const reglas = obtenerReglas(activo);

    const inpIMEI  = document.getElementById('imei-1');
    const inpIMEI2 = document.getElementById('imei-2');
    const inpTel   = document.getElementById('telefono-receptor');

    if (reglas.requiereIMEI) {
        if (inpIMEI && !inpIMEI.value.trim()) {
            mostrarMensaje('El IMEI 1 es obligatorio para este tipo de activo.', 'error');
            return;
        }
    }
    if (reglas.requiereTelefono) {
        if (inpTel && !inpTel.value.trim()) {
            mostrarMensaje('El teléfono es obligatorio para este tipo de activo.', 'error');
            return;
        }
    }

    const datos = {
        IdActivoFijoEQ:    parseInt(selActivo.value, 10),
        FolioTicket:       inpFolio.value.trim(),
        TipoResponsiva:    inpTipoResp.value.trim() || null,
        FechaAsignacion:   inpFechaAsig.value,
        FechaDevolucionProgramada: inpFechaDev.value || null,
        EstatusResponsiva: selEstatus.value,
        MotivoSalida:      inpMotivo.value.trim() || null,
        NombreProyecto:    inpProyecto.value.trim() || null,
        DescripcionSolicitud: inpDescripcion.value.trim() || null,
        Observaciones:     inpObservaciones.value.trim() || null,
        NombreRecibe:      inpNombreRecibe.value.trim(),
        PuestoRecibe:      inpPuestoRecibe.value.trim() || null,
        AreaRecibe:        inpAreaRecibe.value.trim() || null,
        CorreoRecibe:      inpCorreoRecibe.value.trim() || null,
        IdCartera:         selCartera.value ? parseInt(selCartera.value, 10) : null,
        IdPuesto:          selPuestoCat.value ? parseInt(selPuestoCat.value, 10) : null,
        NombreEntrega:     inpNombreEntrega.value.trim() || null,
        PuestoEntrega:     inpPuestoEntrega.value.trim() || null,
        AreaEntrega:       inpAreaEntrega.value.trim() || 'Sistemas',
        RutaPDF:           inpRutaPDF.value.trim() || null,
        RutaINE:           inpRutaINE.value.trim() || null,
        RutaComprobanteDomicilio: inpRutaComprob.value.trim() || null
    };

    setGuardando(true);
    try {
        let res;
        if (modoEdicion && idEditando !== null) {
            res = await window.api.activoFijo.responsivas.actualizar(idEditando, datos);
        } else {
            res = await window.api.activoFijo.responsivas.crear(datos);
        }

        if (res && res.ok) {
            cerrarModal();
            await cargarResponsivas();
            await cargarActivosDisponibles();
            await alertaExito('Guardado correctamente', res.mensaje || (modoEdicion ? 'Responsiva actualizada.' : 'Responsiva creada.'));
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
   VER PDF
   ========================================================= */
async function verPDFResponsiva(id, folio) {
    Swal.fire({
        title: 'Generando vista previa...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await window.api.activoFijo.responsivas.verPDF(id);
        Swal.close();

        if (!res || !res.ok) {
            alertaError('No se pudo generar el PDF', res?.mensaje || 'Error desconocido');
            return;
        }

        await alertaExito('PDF abierto en el visor del sistema');
    } catch (err) {
        Swal.close();
        alertaError('Error al generar PDF', err.message);
    }
}

/* =========================================================
   GUARDAR PDF
   ========================================================= */
async function guardarPDFResponsiva(id, folio, rutaExistente) {
    const yaExiste = !!rutaExistente;

    const conf = await Swal.fire({
        icon: yaExiste ? 'warning' : 'question',
        title: yaExiste ? '¿Sobrescribir PDF guardado?' : '¿Guardar PDF en disco?',
        html: yaExiste
            ? `Ya existe un PDF guardado para el folio <strong>${escaparHTML(folio)}</strong>.<br><br>
               Se te pedirá elegir una nueva ubicación. Si eliges la misma ruta, se <b>sobrescribirá</b>.<br>
               <small style="color:#64748b;">Ruta actual: ${escaparHTML(rutaExistente)}</small>`
            : `Se generará el PDF del folio <strong>${escaparHTML(folio)}</strong> y podrás elegir dónde guardarlo.`,
        showCloseButton: true,
        confirmButtonText: 'Sí, guardar',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled' + (yaExiste ? ' cl-peligro' : '')
        }
    });

    if (!conf.isConfirmed) return;

    Swal.fire({
        title: 'Generando PDF...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await window.api.activoFijo.responsivas.guardarPDF(id);
        Swal.close();

        if (res && res.ok) {
            await Swal.fire({
                icon: 'success',
                title: 'PDF guardado',
                html: `Se guardó en:<br><code style="font-size:12px;word-break:break-all;color:#0f766e;">${escaparHTML(res.ruta)}</code>`,
                showCloseButton: true,
                confirmButtonText: 'Aceptar',
                buttonsStyling: false,
                customClass: {
                    popup: 'cl-confirm',
                    confirmButton: 'swal2-confirm swal2-styled'
                }
            });
            await cargarResponsivas();
        } else if (res && res.mensaje === 'Cancelado') {
            // Cancelado por el usuario
        } else {
            alertaError('No se pudo guardar el PDF', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        Swal.close();
        alertaError('Error al guardar PDF', err.message);
    }
}

/* =========================================================
   DEVOLVER
   ========================================================= */
async function devolverResponsiva(id, nombrePersona) {
    const confirmacion = await Swal.fire({
        icon: 'question',
        title: '¿Registrar devolución?',
        html: `El activo será liberado de <strong>${escaparHTML(nombrePersona)}</strong> y volverá a estar disponible para reasignar.`,
        input: 'date',
        inputLabel: 'Fecha de devolución',
        inputValue: hoyISO(),
        inputAttributes: { required: true },
        showCloseButton: true,
        confirmButtonText: 'Sí, devolver',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled'
        },
        inputValidator: (value) => {
            if (!value) return 'La fecha es obligatoria';
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.responsivas.devolver(id, confirmacion.value, null);
        if (res && res.ok) {
            await cargarResponsivas();
            await cargarActivosDisponibles();
            await alertaExito('Devolución registrada', res.mensaje || 'El activo se liberó correctamente.');
        } else {
            alertaError('No se pudo devolver', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        alertaError('Error al devolver', err.message);
    }
}

/* =========================================================
   CANCELAR (Soft delete → histórico)
   ========================================================= */
async function cancelarResponsiva(id, folio) {
    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Cancelar responsiva?',
        html: `Se cancelará la responsiva del folio <strong>${escaparHTML(folio)}</strong>.<br><br>
               La responsiva quedará como <b>histórico</b> en la pestaña <b>Canceladas</b>.<br>
               El activo volverá a estar <b>disponible</b>.<br><br>
               <b>Nota:</b> si necesitas volver a asignar este activo, deberás crear una <b>nueva responsiva</b>.`,
        input: 'textarea',
        inputLabel: 'Motivo de la cancelación',
        inputPlaceholder: 'Ej. Error de captura, asignación duplicada, cancelación de ticket...',
        inputAttributes: { maxlength: 500, rows: 3 },
        showCloseButton: true,
        confirmButtonText: 'Sí, cancelar',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro'
        },
        inputValidator: (value) => {
            if (!value || !value.trim()) return 'El motivo es obligatorio';
            return null;
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.responsivas.eliminar(id, confirmacion.value.trim());
        if (res && res.ok) {
            await cargarResponsivas();
            await cargarActivosDisponibles();
            await alertaExito('Responsiva cancelada', res.mensaje || 'Se movió al histórico correctamente.');
        } else {
            alertaError('No se pudo cancelar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        alertaError('Error al cancelar', err.message);
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
    await cargarResponsivas();
})();