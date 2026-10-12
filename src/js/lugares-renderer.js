const Swal = window.Swal;

function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
        background: '#ffffff', color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-success' }
    });
}
function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false, timer: 3400, timerProgressBar: true,
        background: '#ffffff', color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-error' }
    });
}

const COLORES_CODIGO_CLIENTE = {
    'NU': 'codigo-nu', 'DIDI': 'codigo-didi', 'ADAMA': 'codigo-adama',
    'KUBO': 'codigo-kubo', 'MEGA': 'codigo-mega'
};
function claseCodigoCliente(codigo) {
    const key = String(codigo || '').trim().toUpperCase();
    return COLORES_CODIGO_CLIENTE[key] || 'codigo-def';
}

/* =========================================================
   ESTADO
   ========================================================= */
let pisos          = [];
let clientes       = [];
let modoEdicion    = false;
let idEditando     = null;
let guardando      = false;
let filtroBusqueda = '';
let clientesSeleccionados = new Set();

/* DOM */
const contenedorGrupos = document.getElementById('contenedor-grupos');
const sinResultados    = document.getElementById('sin-resultados');
const formulario       = document.getElementById('formulario');
const inputNombre      = document.getElementById('nombre');
const inputFilas       = document.getElementById('filas');
const inputColumnas    = document.getElementById('columnas');
const mensaje          = document.getElementById('mensaje');
const btnGuardar       = document.getElementById('btn-guardar');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtro');
const modalLugar       = document.getElementById('modal-lugar');
const modalTitulo      = document.getElementById('modal-lugar-titulo');
const listaClientesCheck = document.getElementById('lista-clientes-check');

function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje ' + tipo;
    mensaje.classList.remove('oculto');
}
function ocultarMensaje() { mensaje.classList.add('oculto'); }
function setGuardando(v) { guardando = v; btnGuardar.disabled = v; btnGuardar.style.opacity = v ? '0.6' : ''; }

/* =========================================================
   MODAL
   ========================================================= */
function abrirModal() { modalLugar.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function cerrarModal() {
    modalLugar.style.display = 'none';
    document.body.style.overflow = '';
    ocultarMensaje();
    modoEdicion = false;
    idEditando  = null;
    clientesSeleccionados.clear();
}
document.getElementById('modal-lugar-cerrar').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
modalLugar.addEventListener('click', (e) => { if (e.target === modalLugar) cerrarModal(); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalLugar.style.display === 'flex') cerrarModal();
});

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

/* =========================================================
   CARGA
   ========================================================= */
async function cargarClientes() {
    try {
        clientes = await window.api.clientes.listar();
    } catch (err) {
        toastError('No se pudieron cargar los clientes', err.message);
    }
}

async function cargarPisos() {
    try {
        pisos = await window.api.pisos.listar();
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los pisos', err.message);
    }
}

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
btnLimpiarFiltro.addEventListener('click', () => {
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    renderTabla();
});

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    contenedorGrupos.innerHTML = '';

    const listaFiltrada = pisos.filter(p => {
        if (!filtroBusqueda) return true;
        const texto = [
            p.Nombre,
            ...(p.clientes || []).map(c => c.Codigo + ' ' + c.Nombre)
        ].filter(Boolean).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    if (listaFiltrada.length === 0) {
        sinResultados.classList.remove('oculto');
        return;
    }
    sinResultados.classList.add('oculto');

    const tabla = document.createElement('table');
    tabla.className = 'tabla-lugares';
    tabla.style.width = '100%';
    tabla.innerHTML = `
        <thead>
            <tr>
                <th style="width:30%;">Piso</th>
                <th style="width:40%;">Clientes con acceso</th>
                <th style="width:15%;">Dimensiones</th>
                <th style="width:15%; text-align:right;">Acciones</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = tabla.querySelector('tbody');

    listaFiltrada.forEach(p => {
        const tr = document.createElement('tr');

        const chipsClientes = (p.clientes || []).map(c => {
            const clase = claseCodigoCliente(c.Codigo);
            return `<span class="badge-cliente ${clase}" style="margin-right:4px;">
                        <span class="codigo">${escaparHTML(c.Codigo)}</span>
                        <span class="nombre">${escaparHTML(c.Nombre)}</span>
                    </span>`;
        }).join('');

        tr.innerHTML = `
            <td>
                <span class="badge-piso codigo-def">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path d="M3 21h18"/>
                        <path d="M5 21V7l8-4v18"/>
                        <path d="M19 21V11l-6-4"/>
                    </svg>
                    ${escaparHTML(p.Nombre)}
                </span>
            </td>
            <td>${chipsClientes || '<span style="color:#94a3b8;font-size:0.85rem;">Sin clientes</span>'}</td>
            <td>${p.Columnas} × ${p.Filas}</td>
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
            </svg> Editar
        `;
        btnEditar.addEventListener('click', () => abrirEdicion(p.IdPiso));

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'peligro';
        btnEliminar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg> Eliminar
        `;
        btnEliminar.addEventListener('click', () => eliminarPiso(p.IdPiso, p.Nombre));

        celda.appendChild(btnEditar);
        celda.appendChild(btnEliminar);
        tbody.appendChild(tr);
    });

    contenedorGrupos.appendChild(tabla);
}

/* =========================================================
   CHECKBOXES DE CLIENTES
   ========================================================= */
function renderCheckboxesClientes() {
    listaClientesCheck.innerHTML = '';
    clientes.forEach(c => {
        const label = document.createElement('label');
        label.className = 'checkbox-cliente';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = String(c.IdCliente);
        chk.checked = clientesSeleccionados.has(Number(c.IdCliente));
        chk.addEventListener('change', () => {
            const id = Number(c.IdCliente);
            if (chk.checked) clientesSeleccionados.add(id);
            else clientesSeleccionados.delete(id);
        });
        label.appendChild(chk);
        label.appendChild(document.createTextNode(` ${c.Codigo} - ${c.Nombre}`));
        listaClientesCheck.appendChild(label);
    });
}

/* =========================================================
   CREAR / EDITAR
   ========================================================= */
document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando = null;
    modalTitulo.textContent = 'Nuevo piso';
    inputNombre.value = '';
    inputFilas.value = 8;
    inputColumnas.value = 12;
    clientesSeleccionados.clear();
    renderCheckboxesClientes();
    ocultarMensaje();
    abrirModal();
    inputNombre.focus();
});

function abrirEdicion(idPiso) {
    const p = pisos.find(x => Number(x.IdPiso) === Number(idPiso));
    if (!p) { toastError('Piso no encontrado'); cargarPisos(); return; }

    modoEdicion = true;
    idEditando = p.IdPiso;
    modalTitulo.textContent = 'Editar piso';
    inputNombre.value = p.Nombre;
    inputFilas.value = p.Filas;
    inputColumnas.value = p.Columnas;
    clientesSeleccionados = new Set((p.clientes || []).map(c => Number(c.IdCliente)));
    renderCheckboxesClientes();
    ocultarMensaje();
    abrirModal();
    inputNombre.focus();
}

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    const nombre   = inputNombre.value.trim();
    const filas    = parseInt(inputFilas.value, 10);
    const columnas = parseInt(inputColumnas.value, 10);
    const ids      = Array.from(clientesSeleccionados);

    if (!nombre) { mostrarMensaje('El nombre es obligatorio.', 'error'); return; }
    if (!filas || filas < 1) { mostrarMensaje('Filas debe ser mayor a 0.', 'error'); return; }
    if (!columnas || columnas < 1) { mostrarMensaje('Columnas debe ser mayor a 0.', 'error'); return; }
    if (ids.length === 0) { mostrarMensaje('Selecciona al menos un cliente.', 'error'); return; }

    setGuardando(true);
    try {
        let res;
        if (modoEdicion) {
            res = await window.api.pisos.actualizarConClientes(idEditando, nombre, filas, columnas, ids);
        } else {
            res = await window.api.pisos.crear(nombre, filas, columnas, ids);
        }

        if (res && res.ok) {
            cerrarModal();
            await cargarPisos();
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
async function eliminarPiso(id, nombre) {
    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar piso?',
        html: `Se eliminará el piso <strong>${escaparHTML(nombre)}</strong>.<br>Esta acción no se puede deshacer.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true, focusCancel: true, buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro',
            cancelButton: 'swal2-cancel swal2-styled'
        }
    });
    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.pisos.eliminar(id);
        if (res && res.ok) {
            await cargarPisos();
            toastExito(res.mensaje || 'Piso eliminado');
        } else {
            toastError('No se pudo eliminar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al eliminar', err.message);
    }
}

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    await cargarClientes();
    await cargarPisos();
})();