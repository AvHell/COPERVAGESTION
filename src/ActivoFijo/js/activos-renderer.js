/* =========================================================
   ACTIVO FIJO — RENDERER DE INVENTARIO
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
let modoEdicion    = false;
let idEditando     = null;
let guardando      = false;
let filtroBusqueda = '';
let filtros        = { idTipo: '', idEstado: '', idEstatus: '', idCartera: '' };

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
const modal            = document.getElementById('modal-activo');
const modalTitulo      = document.getElementById('modal-titulo');

const selTipo          = document.getElementById('tipo');
const selMarca         = document.getElementById('marca');
const selEstado        = document.getElementById('estado');
const selEstatus       = document.getElementById('estatus');
const selCartera       = document.getElementById('cartera');

const inpModelo        = document.getElementById('modelo');
const inpNoSerie       = document.getElementById('noserie');
const inpIMEI1         = document.getElementById('imei1');
const inpIMEI2         = document.getElementById('imei2');
const inpNoTelefono    = document.getElementById('notelefono');
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
        const [t, m, e, s, c] = await Promise.all([
            window.api.activoFijo.activos.listarTipos(),
            window.api.activoFijo.activos.listarMarcas(),
            window.api.activoFijo.activos.listarEstados(),
            window.api.activoFijo.activos.listarEstatus(),
            window.api.activoFijo.activos.listarCarteras()
        ]);

        tipos    = t; marcas = m; estados = e; estatus = s; carteras = c;

        // Poblar selects del formulario
        selTipo.innerHTML    = '<option value="">— Seleccionar —</option>' +
            tipos.map(x => `<option value="${x.IdTipo}">${escaparHTML(x.Nombre)}</option>`).join('');
        selMarca.innerHTML   = '<option value="">— Sin marca —</option>' +
            marcas.map(x => `<option value="${x.IdMarca}">${escaparHTML(x.Nombre)}</option>`).join('');
        selEstado.innerHTML  = estados.map(x => `<option value="${x.IdEstado}">${escaparHTML(x.Nombre)}</option>`).join('');
        selEstatus.innerHTML = estatus.map(x => `<option value="${x.IdEstatus}">${escaparHTML(x.Nombre)}</option>`).join('');
        selCartera.innerHTML = '<option value="">— Sin cartera —</option>' +
            carteras.map(x => `<option value="${x.IdCartera}">${escaparHTML(x.Nombre)}</option>`).join('');

        // Poblar filtros
        filtroTipo.innerHTML    = '<option value="">Todos</option>' +
            tipos.map(x => `<option value="${x.IdTipo}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroEstado.innerHTML  = '<option value="">Todos</option>' +
            estados.map(x => `<option value="${x.IdEstado}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroEstatus.innerHTML = '<option value="">Todos</option>' +
            estatus.map(x => `<option value="${x.IdEstatus}">${escaparHTML(x.Nombre)}</option>`).join('');
        filtroCartera.innerHTML = '<option value="">Todas</option>' +
            carteras.map(x => `<option value="${x.IdCartera}">${escaparHTML(x.Nombre)}</option>`).join('');
    } catch (err) {
        toastError('No se pudieron cargar los catálogos', err.message);
    }
}

/* =========================================================
   CARGAR ACTIVOS
   ========================================================= */
async function cargarActivos() {
    try {
        activos = await window.api.activoFijo.activos.listar(filtros);
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
            a.Marca, a.Modelo, a.Tipo, a.Cartera
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

    listaFiltrada.forEach(a => {
        const tr = document.createElement('tr');

        // Bloque identificadores
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
            <td>${htmlPrecio}</td>
            <td class="acciones-tabla"></td>
        `;

        const celda = tr.querySelector('.acciones-tabla');

        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'secundario';
        btnEditar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg> Editar`;
        btnEditar.addEventListener('click', () => abrirEdicion(a.IdActivoFijoEQ));

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'peligro';
        btnEliminar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg> Eliminar`;
        btnEliminar.addEventListener('click', () => eliminarActivo(a.IdActivoFijoEQ));

        celda.appendChild(btnEditar);
        celda.appendChild(btnEliminar);
        tablaBody.appendChild(tr);
    });
}

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

btnLimpiarFiltro.addEventListener('click', () => {
    filtros = { idTipo: '', idEstado: '', idEstatus: '', idCartera: '' };
    filtroTipo.value = '';
    filtroEstado.value = '';
    filtroEstatus.value = '';
    filtroCartera.value = '';
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
   CAMPOS DINÁMICOS SEGÚN TIPO
   ========================================================= */
selTipo.addEventListener('change', actualizarCamposPorTipo);

function actualizarCamposPorTipo() {
    const idTipo = parseInt(selTipo.value, 10);
    const tipo = tipos.find(t => t.IdTipo === idTipo);

    const wrapIMEI1    = inpIMEI1.closest('.campo-imei1');
    const wrapIMEI2    = inpIMEI2.closest('.campo-imei2');
    const wrapTelefono = inpNoTelefono.closest('.campo-telefono');

    if (!tipo) {
        wrapIMEI1?.classList.add('oculto');
        wrapIMEI2?.classList.add('oculto');
        wrapTelefono?.classList.add('oculto');
        return;
    }

    wrapIMEI1?.classList.toggle('oculto', !tipo.RequiereIMEI);
    wrapIMEI2?.classList.toggle('oculto', !tipo.RequiereIMEI);
    wrapTelefono?.classList.toggle('oculto', !tipo.RequiereTelefono);
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
    inpModelo.value = '';
    inpNoSerie.value = '';
    inpIMEI1.value = '';
    inpIMEI2.value = '';
    inpNoTelefono.value = '';
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

    selTipo.value        = a.IdTipo ?? '';
    selMarca.value       = a.IdMarca ?? '';
    selEstado.value      = a.IdEstado ?? '';
    selEstatus.value     = a.IdEstatus ?? '';
    selCartera.value     = a.IdCartera ?? '';
    inpModelo.value      = a.Modelo ?? '';
    inpNoSerie.value     = a.NoSerie ?? '';
    inpIMEI1.value       = a.IMEI1 ?? '';
    inpIMEI2.value       = a.IMEI2 ?? '';
    inpNoTelefono.value  = a.NoTelefono ?? '';
    inpProcesador.value  = a.Procesador ?? '';
    inpRAM.value         = a.MemoriaRAM ?? '';
    inpAlmacenamiento.value = a.Almacenamiento ?? '';
    inpSO.value          = a.SistemaOperativo ?? '';
    inpAccesorios.value  = a.Accesorios ?? '';
    inpPrecio.value      = a.PrecioActivo ?? '';
    inpObservaciones.value = a.Observaciones ?? '';

    actualizarCamposPorTipo();
    ocultarMensaje();
    abrirModal();
    selTipo.focus();
}

/* =========================================================
   GUARDAR
   ========================================================= */
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    // Validaciones
    if (!selTipo.value) {
        mostrarMensaje('El tipo es obligatorio.', 'error');
        return;
    }
    if (!inpNoSerie.value.trim() && !inpIMEI1.value.trim() && !inpNoTelefono.value.trim()) {
        mostrarMensaje('Debes capturar al menos NoSerie, IMEI1 o NoTeléfono.', 'error');
        return;
    }

    const datos = {
        IdTipo:          parseInt(selTipo.value, 10),
        IdMarca:         selMarca.value ? parseInt(selMarca.value, 10) : null,
        IdCartera:       selCartera.value ? parseInt(selCartera.value, 10) : null,
        IdEstado:        selEstado.value ? parseInt(selEstado.value, 10) : null,
        IdEstatus:       selEstatus.value ? parseInt(selEstatus.value, 10) : null,
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
        PrecioActivo:    inpPrecio.value ? parseFloat(inpPrecio.value) : null,
        Observaciones:   inpObservaciones.value.trim() || null
    };

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
   ELIMINAR
   ========================================================= */
async function eliminarActivo(id) {
    const a = activos.find(x => x.IdActivoFijoEQ === id);
    const nombre = a ? (a.NoSerie || a.IMEI1 || a.NoTelefono || `#${id}`) : `#${id}`;

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar activo?',
        html: `Se eliminará el activo <strong>${escaparHTML(nombre)}</strong>.<br>Esta acción no se puede deshacer.`,
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
        const res = await window.api.activoFijo.activos.eliminar(id);
        if (res && res.ok) {
            await cargarActivos();
            toastExito(res.mensaje || 'Activo eliminado');
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
    await cargarActivos();
})();