/* =========================================================
   ACTIVO FIJO — RENDERER DE RESPONSIVAS
   Tabs: Activas / Canceladas
   Cancelar = soft delete (histórico, no se restaura)
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
let vistaActual      = 'activas';      // 'activas' | 'canceladas'
let filtros          = { idEstatus: '' };

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
        const [c, p] = await Promise.all([
            window.api.activoFijo.responsivas.listarCarteras(),
            window.api.activoFijo.responsivas.listarPuestos()
        ]);
        carteras = c;
        puestos  = p;

        selCartera.innerHTML = '<option value="">— Sin cartera —</option>' +
            carteras.map(x => `<option value="${x.IdCartera}">${escaparHTML(x.Nombre)}</option>`).join('');

        selPuestoCat.innerHTML = '<option value="">— Sin puesto —</option>' +
            puestos.map(x => `<option value="${x.IdPuesto}">${escaparHTML(x.Nombre)}</option>`).join('');
    } catch (err) {
        toastError('No se pudieron cargar los catálogos', err.message);
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
                return `<option value="${a.IdActivoFijoEQ}">[${escaparHTML(a.Tipo)}] ${escaparHTML(id)} — ${escaparHTML(serie)}</option>`;
            }).join('');
    } catch (err) {
        toastError('No se pudieron cargar los activos', err.message);
    }
}

/* =========================================================
   CARGAR RESPONSIVAS (según vista actual)
   ========================================================= */
async function cargarResponsivas() {
    try {
        const filtrosEnvio = { ...filtros };

        if (vistaActual === 'canceladas') {
            filtrosEnvio.soloCancelados = true;
            filtrosEnvio.idEstatus = '';
            // sincronizar también el estado local
            filtros.idEstatus = '';
            filtroEstatus.value = '';
        }

        responsivas = await window.api.activoFijo.responsivas.listar(filtrosEnvio);
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar las responsivas', err.message);
    }
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    const listaFiltrada = responsivas.filter(r => {
        if (!filtroBusqueda) return true;
        const texto = [
            r.FolioTicket, r.NoSerie, r.IMEI1, r.IMEI2, r.NoTelefono,
            r.NombreRecibe, r.Cartera, r.Tipo, r.Marca, r.Modelo
        ].filter(Boolean).join(' ').toLowerCase();
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
        document.querySelector('.card-tabla').style.display = 'none';
        return;
    }

    sinResultados.classList.add('oculto');
    document.querySelector('.card-tabla').style.display = '';

    const esVistaCanceladas = (vistaActual === 'canceladas');

    listaFiltrada.forEach(r => {
        const tr = document.createElement('tr');

        const tipoMarca = [r.Tipo, r.Marca, r.Modelo].filter(Boolean).join(' ');
        const serieHtml = r.NoSerie ? `<span class="serie">SN: ${escaparHTML(r.NoSerie)}</span>` : '';
        const imeiHtml  = r.IMEI1 ? `<span class="extra">IMEI: ${escaparHTML(r.IMEI1)}</span>` : '';
        const telHtml   = r.NoTelefono ? `<span class="extra">Tel: ${escaparHTML(r.NoTelefono)}</span>` : '';

        const activoHtml = `
            <div class="activo-info">
                <span class="tipo-marca">${escaparHTML(tipoMarca || '—')}</span>
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
            <td><span class="folio-ticket">${escaparHTML(r.FolioTicket)}</span></td>
            <td>${activoHtml}</td>
            <td>${personaHtml}</td>
            <td>${escaparHTML(r.Cartera ?? '—')}</td>
            <td><span class="fecha">${formatearFecha(r.FechaAsignacion)}</span></td>
            <td><span class="fecha">${formatearFecha(r.FechaDevolucionReal || r.FechaDevolucionProgramada)}</span></td>
            <td><span class="badge-estatus badge-estatus-${escaparHTML(r.EstatusResponsiva)}">${escaparHTML(r.EstatusResponsiva)}</span></td>
            <td class="acciones-tabla"></td>
        `;

        const celda = tr.querySelector('.acciones-tabla');

        /* ---- Vista CANCELADAS → PDF + Ver detalle ---- */
        if (esVistaCanceladas) {
            const btnVer = document.createElement('button');
            btnVer.type = 'button';
            btnVer.className = 'secundario';
            btnVer.title = 'Ver detalle';
            btnVer.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg> Ver`;
            btnVer.addEventListener('click', () => verDetalle(r.IdResponsiva));
            celda.appendChild(btnVer);

            const btnPDF = document.createElement('button');
            btnPDF.type = 'button';
            btnPDF.className = 'secundario';
            btnPDF.title = 'Generar PDF de responsiva';
            btnPDF.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg> PDF`;
            btnPDF.addEventListener('click', () => generarPDFResponsiva(r.IdResponsiva, r.FolioTicket));
            celda.appendChild(btnPDF);

            tablaBody.appendChild(tr);
            return;
        }

        /* ---- Vista ACTIVAS → Editar + PDF + (Devolver / Cancelar según estatus) ---- */
        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'secundario';
        btnEditar.title = 'Editar';
        btnEditar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>`;
        btnEditar.addEventListener('click', () => abrirEdicion(r.IdResponsiva));
        celda.appendChild(btnEditar);

        const btnPDF = document.createElement('button');
        btnPDF.type = 'button';
        btnPDF.className = 'secundario';
        btnPDF.title = 'Generar PDF de responsiva';
        btnPDF.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg> PDF`;
        btnPDF.addEventListener('click', () => generarPDFResponsiva(r.IdResponsiva, r.FolioTicket));
        celda.appendChild(btnPDF);

        if (r.EstatusResponsiva === 'ASIGNADO' || r.EstatusResponsiva === 'PENDIENTE') {
            const btnDevolver = document.createElement('button');
            btnDevolver.type = 'button';
            btnDevolver.className = 'exito';
            btnDevolver.title = 'Registrar devolución';
            btnDevolver.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg> Devolver`;
            btnDevolver.addEventListener('click', () => devolverResponsiva(r.IdResponsiva, r.NombreRecibe));
            celda.appendChild(btnDevolver);

            const btnCancelar = document.createElement('button');
            btnCancelar.type = 'button';
            btnCancelar.className = 'peligro';
            btnCancelar.title = 'Cancelar responsiva';
            btnCancelar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg> Cancelar`;
            btnCancelar.addEventListener('click', () => cancelarResponsiva(r.IdResponsiva, r.FolioTicket));
            celda.appendChild(btnCancelar);
        }

        tablaBody.appendChild(tr);
    });
}

/* =========================================================
   TABS DE VISTA (Activas / Canceladas)
   ========================================================= */
tabsVista.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-vista');
    if (!btn || btn.classList.contains('activo')) return;

    tabsVista.querySelectorAll('.tab-vista').forEach(t => t.classList.remove('activo'));
    btn.classList.add('activo');

    vistaActual = btn.dataset.vista;

    // Ocultar filtro de estatus en Canceladas
    if (filtroEstatusWrap) {
        filtroEstatusWrap.classList.toggle('oculto', vistaActual === 'canceladas');
    }

    // Deshabilitar "Nueva responsiva" en Canceladas
    btnNuevo.disabled = (vistaActual === 'canceladas');
    btnNuevo.style.opacity = (vistaActual === 'canceladas') ? '0.5' : '';

    // Limpiar búsqueda
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
}
document.getElementById('modal-cerrar').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') cerrarModal();
});

/* =========================================================
   INFO DEL ACTIVO SELECCIONADO
   ========================================================= */
selActivo.addEventListener('change', () => {
    const id = parseInt(selActivo.value, 10);
    const a = activosDisp.find(x => x.IdActivoFijoEQ === id);

    if (!a) {
        infoActivo.classList.add('oculto');
        inpTipoResp.value = '';
        return;
    }

    inpTipoResp.value = a.Tipo;

    const marcaModelo = [a.Marca, a.Modelo].filter(Boolean).join(' ') || '—';
    infoActivo.innerHTML = `
        <strong>${escaparHTML(a.Tipo)}</strong> — ${escaparHTML(marcaModelo)}<br>
        ${a.NoSerie    ? `<strong>Serie:</strong> ${escaparHTML(a.NoSerie)}<br>` : ''}
        ${a.IMEI1      ? `<strong>IMEI 1:</strong> ${escaparHTML(a.IMEI1)}<br>` : ''}
        ${a.IMEI2      ? `<strong>IMEI 2:</strong> ${escaparHTML(a.IMEI2)}<br>` : ''}
        ${a.NoTelefono ? `<strong>Teléfono:</strong> ${escaparHTML(a.NoTelefono)}<br>` : ''}
        ${a.PrecioActivo ? `<strong>Precio:</strong> $${Number(a.PrecioActivo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : ''}
    `;
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
    infoActivo.classList.add('oculto');
    infoActivo.innerHTML = '';
    selActivo.disabled = false;
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
    if (!r) { toastError('Responsiva no encontrada'); return; }

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

    inpFolio.value         = r.FolioTicket ?? '';
    inpTipoResp.value      = r.TipoResponsiva ?? '';
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

    const tipoMarca = [r.Tipo, r.Marca, r.Modelo].filter(Boolean).join(' ');
    infoActivo.innerHTML = `
        <strong>${escaparHTML(r.Tipo)}</strong> — ${escaparHTML(tipoMarca)}<br>
        ${r.NoSerie ? `<strong>Serie:</strong> ${escaparHTML(r.NoSerie)}<br>` : ''}
        ${r.IMEI1 ? `<strong>IMEI 1:</strong> ${escaparHTML(r.IMEI1)}<br>` : ''}
        ${r.NoTelefono ? `<strong>Teléfono:</strong> ${escaparHTML(r.NoTelefono)}` : ''}
    `;
    infoActivo.classList.remove('oculto');

    ocultarMensaje();
    abrirModal();
}

/* =========================================================
   VER DETALLE (solo lectura, para canceladas)
   ========================================================= */
async function verDetalle(id) {
    const r = responsivas.find(x => x.IdResponsiva === id);
    if (!r) { toastError('Responsiva no encontrada'); return; }

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
                <div class="det-linea"><b>Tipo:</b> ${escaparHTML(r.Tipo ?? '—')}</div>
                <div class="det-linea"><b>Marca / Modelo:</b> ${escaparHTML([r.Marca, r.Modelo].filter(Boolean).join(' ') || '—')}</div>
                ${r.NoSerie    ? `<div class="det-linea"><b>Serie:</b> ${escaparHTML(r.NoSerie)}</div>` : ''}
                ${r.IMEI1      ? `<div class="det-linea"><b>IMEI 1:</b> ${escaparHTML(r.IMEI1)}</div>` : ''}
                ${r.IMEI2      ? `<div class="det-linea"><b>IMEI 2:</b> ${escaparHTML(r.IMEI2)}</div>` : ''}
                ${r.NoTelefono ? `<div class="det-linea"><b>Teléfono:</b> ${escaparHTML(r.NoTelefono)}</div>` : ''}
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
   GENERAR PDF
   ========================================================= */
async function generarPDFResponsiva(id, folio) {
    const conf = await Swal.fire({
        icon: 'question',
        title: '¿Generar PDF de responsiva?',
        html: `Se generará el PDF para el folio <strong>${escaparHTML(folio)}</strong>.<br>Podrás elegir dónde guardarlo.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, generar',
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
        title: 'Generando PDF...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await window.api.activoFijo.responsivas.generarPDF(id);
        Swal.close();

        if (res && res.ok) {
            await Swal.fire({
                icon: 'success',
                title: 'PDF generado',
                html: `Se guardó en:<br><code style="font-size:11px;word-break:break-all;">${escaparHTML(res.ruta)}</code>`,
                confirmButtonText: 'Aceptar',
                buttonsStyling: false,
                customClass: {
                    popup: 'cl-confirm',
                    confirmButton: 'swal2-confirm swal2-styled'
                }
            });
            await cargarResponsivas();
        } else {
            toastError('No se pudo generar el PDF', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        Swal.close();
        toastError('Error al generar PDF', err.message);
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
        showCancelButton: true,
        confirmButtonText: 'Sí, devolver',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        },
        inputValidator: (value) => {
            if (!value) return 'La fecha es obligatoria';
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.responsivas.devolver(
            id,
            confirmacion.value,
            null
        );
        if (res && res.ok) {
            await cargarResponsivas();
            await cargarActivosDisponibles();
            toastExito(res.mensaje || 'Devolución registrada');
        } else {
            toastError('No se pudo devolver', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al devolver', err.message);
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
        showCancelButton: true,
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'Volver',
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

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.responsivas.eliminar(id, confirmacion.value.trim());
        if (res && res.ok) {
            await cargarResponsivas();
            await cargarActivosDisponibles();
            toastExito(res.mensaje || 'Responsiva cancelada');
        } else {
            toastError('No se pudo cancelar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al cancelar', err.message);
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