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
let filtros          = { idEstatus: '' };

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tablaBody        = document.getElementById('tabla-body');
const formulario       = document.getElementById('formulario');
const mensaje          = document.getElementById('mensaje');
const btnGuardar       = document.getElementById('btn-guardar');
const btnNuevo         = document.getElementById('btn-nuevo');
const sinResultados    = document.getElementById('sin-resultados');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtros');
const btnLimpiarVacio  = document.getElementById('btn-limpiar-busqueda-vacio');
const modal            = document.getElementById('modal-responsiva');
const modalTitulo      = document.getElementById('modal-titulo');
const filtroEstatus    = document.getElementById('filtro-estatus');

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

function formatearFecha(f) {
    if (!f) return '—';
    const d = new Date(f);
    if (isNaN(d.getTime())) return '—';
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
   CARGAR ACTIVOS DISPONIBLES (para el select del modal)
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
   CARGAR RESPONSIVAS
   ========================================================= */
async function cargarResponsivas() {
    try {
        responsivas = await window.api.activoFijo.responsivas.listar(filtros);
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
        document.querySelector('.card-tabla').style.display = 'none';
        return;
    }

    sinResultados.classList.add('oculto');
    document.querySelector('.card-tabla').style.display = '';

    listaFiltrada.forEach(r => {
        const tr = document.createElement('tr');

        // Activo info
        const tipoMarca = [r.Tipo, r.Marca, r.Modelo].filter(Boolean).join(' ');
        const serieHtml = r.NoSerie ? `<span class="serie">SN: ${escaparHTML(r.NoSerie)}</span>` : '';
        const imeiHtml = r.IMEI1 ? `<span class="extra">IMEI: ${escaparHTML(r.IMEI1)}</span>` : '';
        const telHtml  = r.NoTelefono ? `<span class="extra">Tel: ${escaparHTML(r.NoTelefono)}</span>` : '';

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
            <td><span class="badge-estatus badge-estatus-${escaparHTML(r.EstatusResponsiva)}">${escaparHTML(r.EstatusResponsiva)}</span></td>
            <td class="acciones-tabla"></td>
        `;

        const celda = tr.querySelector('.acciones-tabla');

        // Editar
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

        // Devolver (solo si está ASIGNADO o PENDIENTE)
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
        }

        // Eliminar
        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'peligro';
        btnEliminar.title = 'Eliminar';
        btnEliminar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>`;
        btnEliminar.addEventListener('click', () => eliminarResponsiva(r.IdResponsiva, r.FolioTicket));
        celda.appendChild(btnEliminar);

        tablaBody.appendChild(tr);
    });
}

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

    // Guardar el nombre del tipo en el campo readonly
    inpTipoResp.value = a.Tipo;

    // Mostrar info detallada
    const marcaModelo = [a.Marca, a.Modelo].filter(Boolean).join(' ') || '—';
    infoActivo.innerHTML = `
        <strong>${escaparHTML(a.Tipo)}</strong> — ${escaparHTML(marcaModelo)}<br>
        ${a.NoSerie ? `<strong>Serie:</strong> ${escaparHTML(a.NoSerie)}<br>` : ''}
        ${a.IMEI1   ? `<strong>IMEI 1:</strong> ${escaparHTML(a.IMEI1)}<br>` : ''}
        ${a.IMEI2   ? `<strong>IMEI 2:</strong> ${escaparHTML(a.IMEI2)}<br>` : ''}
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
    inpNombreEntrega.value = '';
    inpPuestoEntrega.value = '';
    inpAreaEntrega.value = 'Sistemas';
    inpRutaPDF.value = '';
    inpRutaINE.value = '';
    inpRutaComprob.value = '';
    inpObservaciones.value = '';
    infoActivo.classList.add('oculto');
    infoActivo.innerHTML = '';
    selActivo.disabled = false;
}

/* =========================================================
   NUEVO
   ========================================================= */
btnNuevo.addEventListener('click', async () => {
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

    // Cargar el activo actual en el select y bloquearlo
    await cargarActivosDisponibles();

    // Añadir el activo actual a las opciones si no está (porque está ASIGNADO)
    const existe = activosDisp.find(a => a.IdActivoFijoEQ === r.IdActivoFijoEQ);
    if (!existe) {
        const opt = document.createElement('option');
        opt.value = r.IdActivoFijoEQ;
        opt.textContent = `[${r.Tipo}] ${r.Marca ?? ''} ${r.Modelo ?? ''} — ${r.NoSerie || r.IMEI1 || ''}`;
        selActivo.appendChild(opt);
    }
    selActivo.value = r.IdActivoFijoEQ;
    selActivo.disabled = true; // No permitir cambiar el activo en edición

    // Llenar campos
    inpFolio.value         = r.FolioTicket ?? '';
    inpTipoResp.value      = r.TipoResponsiva ?? '';
    inpFechaAsig.value     = r.FechaAsignacion ? r.FechaAsignacion.split('T')[0] : '';
    inpFechaDev.value      = r.FechaDevolucionProgramada ? r.FechaDevolucionProgramada.split('T')[0] : '';
    selEstatus.value       = r.EstatusResponsiva ?? 'ASIGNADO';
    inpMotivo.value        = r.MotivoSalida ?? '';
    inpProyecto.value      = r.NombreProyecto ?? '';
    inpDescripcion.value   = r.DescripcionSolicitud ?? '';
    inpNombreRecibe.value  = r.NombreRecibe ?? '';
    inpPuestoRecibe.value  = r.PuestoRecibe ?? '';
    inpAreaRecibe.value    = r.AreaRecibe ?? '';
    inpCorreoRecibe.value  = r.CorreoRecibe ?? '';
    selCartera.value       = r.IdCartera ?? '';
    inpNombreEntrega.value = r.NombreEntrega ?? '';
    inpPuestoEntrega.value = r.PuestoEntrega ?? '';
    inpAreaEntrega.value   = r.AreaEntrega ?? 'Sistemas';
    inpRutaPDF.value       = r.RutaPDF ?? '';
    inpRutaINE.value       = r.RutaINE ?? '';
    inpRutaComprob.value   = r.RutaComprobanteDomicilio ?? '';
    inpObservaciones.value = r.Observaciones ?? '';

    // Info del activo
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
   GUARDAR
   ========================================================= */
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    // Validaciones
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
        IdActivoFijoEQ:    modoEdicion ? idEditando && parseInt(selActivo.value, 10) : parseInt(selActivo.value, 10),
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
   ELIMINAR
   ========================================================= */
async function eliminarResponsiva(id, folio) {
    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar responsiva?',
        html: `Se eliminará la responsiva del folio <strong>${escaparHTML(folio)}</strong>.<br>Esta acción no se puede deshacer.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro',
            cancelButton: 'swal2-cancel swal2-styled'
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.responsivas.eliminar(id);
        if (res && res.ok) {
            await cargarResponsivas();
            await cargarActivosDisponibles();
            toastExito(res.mensaje || 'Responsiva eliminada');
        } else {
            toastError('No se pudo eliminar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al eliminar', err.message);
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