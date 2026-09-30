/* =========================================================
   REFERENCIA A SWEETALERT
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   TOASTS — versión limpia (sin !important masivos)
   Todas las personalizaciones visuales se aplican vía:
   - Opciones nativas de Swal.fire (background, color, etc.)
   - customClass que AGREGA clases sin sobreescribir swal2-toast
   - didOpen para aplicar estilos inline (los inline ganan siempre)
   ========================================================= */
function toastExito(titulo) {
    Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: titulo,
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true,
        background: '#ffffff',
        color: '#1a202c',
        customClass: {
            popup: 'cl-toast cl-toast-success'
        },
        didOpen: (toast) => {
            // Eliminar sombra y filtros como inline style
            toast.style.boxShadow = 'none';
            toast.style.webkitBoxShadow = 'none';
            toast.style.filter = 'none';
            toast.style.webkitFilter = 'none';
            // Pausar timer al hover
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false,
        timer: 3400,
        timerProgressBar: true,
        background: '#ffffff',
        color: '#1a202c',
        customClass: {
            popup: 'cl-toast cl-toast-error'
        },
        didOpen: (toast) => {
            toast.style.boxShadow = 'none';
            toast.style.webkitBoxShadow = 'none';
            toast.style.filter = 'none';
            toast.style.webkitFilter = 'none';
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   MAPA DE COLORES POR CÓDIGO DE CLIENTE
   ========================================================= */
const COLORES_CODIGO = {
    'NU':    'codigo-nu',
    'DIDI':  'codigo-didi',
    'ADAMA': 'codigo-adama',
    'KUBO':  'codigo-kubo',
    'MEGA':  'codigo-mega'
};

function claseCodigoCliente(codigo) {
    const key = String(codigo || '').trim().toUpperCase();
    return COLORES_CODIGO[key] || 'codigo-def';
}

/* =========================================================
   LIMPIEZA DE RESIDUOS DE SWEETALERT2
   ========================================================= */
function limpiarResiduosSwal() {
    document.querySelectorAll('body > .swal2-container').forEach(c => {
        if (!c.querySelector('.swal2-popup') && !c.classList.contains('swal2-backdrop-show')) {
            c.remove();
        }
    });
    const selectoresInternos = [
        'body > input.swal2-input',
        'body > input.swal2-file',
        'body > input.swal2-radio',
        'body > input.swal2-checkbox',
        'body > select.swal2-select',
        'body > textarea.swal2-textarea',
        'body > .swal2-validation-message',
        'body > .swal2-input-label',
        'body > .swal2-select-label'
    ];
    document.querySelectorAll(selectoresInternos.join(',')).forEach(el => el.remove());
    document.querySelectorAll('body > [id^="swal2-"]').forEach(el => {
        if (!el.closest('.swal2-popup')) el.remove();
    });
}

/* =========================================================
   ESTADO
   ========================================================= */
let clientes       = [];
let modoEdicion    = false;
let idEditando     = null;
let guardando      = false;
let filtroBusqueda = '';

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabla             = document.getElementById('tabla-clientes');
const formulario        = document.getElementById('formulario');
const inputCodigo       = document.getElementById('codigo');
const inputNombre       = document.getElementById('nombre');
const mensaje           = document.getElementById('mensaje');
const btnGuardar        = document.getElementById('btn-guardar');
const sinResultados     = document.getElementById('sin-resultados');
const inputBusqueda     = document.getElementById('input-busqueda');
const btnLimpiarBusq    = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarFiltro  = document.getElementById('btn-limpiar-filtro');

const modalCliente      = document.getElementById('modal-cliente');
const modalTitulo       = document.getElementById('modal-cliente-titulo');

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje ' + tipo;
    mensaje.classList.remove('oculto');
}

function ocultarMensaje() {
    mensaje.classList.add('oculto');
}

function setGuardando(valor) {
    guardando = valor;
    btnGuardar.disabled = valor;
    btnGuardar.style.opacity = valor ? '0.6' : '';
}

function buscarClientePorId(id) {
    const idNum = Number(id);
    return clientes.find(x => Number(x.IdCliente) === idNum);
}

/* =========================================================
   MODAL
   ========================================================= */
function abrirModal() {
    modalCliente.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarModal() {
    modalCliente.style.display = 'none';
    document.body.style.overflow = '';
    ocultarMensaje();
    modoEdicion = false;
    idEditando  = null;
}

document.getElementById('modal-cliente-cerrar').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
modalCliente.addEventListener('click', (e) => {
    if (e.target === modalCliente) cerrarModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalCliente.style.display === 'flex') {
        cerrarModal();
    }
});

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => {
    window.api.volverMenu();
});

/* =========================================================
   LISTAR
   ========================================================= */
async function cargarClientes() {
    try {
        clientes = await window.api.clientes.listar();
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los clientes', err.message);
    }
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    tabla.innerHTML = '';

    const listaFiltrada = clientes.filter(c => {
        if (!filtroBusqueda) return true;
        const texto = [c.Codigo, c.Nombre]
            .filter(Boolean).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    if (listaFiltrada.length === 0) {
        sinResultados.classList.remove('oculto');
        return;
    }

    sinResultados.classList.add('oculto');

    listaFiltrada.forEach(c => {
        const tr = document.createElement('tr');
        const claseCodigo = claseCodigoCliente(c.Codigo);

        tr.innerHTML = `
            <td>
                <span class="badge-codigo ${claseCodigo}">
                    ${escaparHTML(c.Codigo)}
                </span>
            </td>
            <td><span class="badge-nombre">${escaparHTML(c.Nombre)}</span></td>
            <td class="acciones-tabla"></td>
        `;
        const celda = tr.querySelector('.acciones-tabla');

        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'secundario';
        btnEditar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editar
        `;
        btnEditar.addEventListener('click', () => abrirEdicion(c.IdCliente));

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'peligro';
        btnEliminar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
            Eliminar
        `;
        btnEliminar.addEventListener('click', () => eliminarCliente(c.IdCliente));

        celda.appendChild(btnEditar);
        celda.appendChild(btnEliminar);
        tabla.appendChild(tr);
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
   CREAR / EDITAR
   ========================================================= */
document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando  = null;
    modalTitulo.textContent = 'Nuevo cliente';
    inputCodigo.value = '';
    inputNombre.value = '';
    inputCodigo.disabled = false;
    ocultarMensaje();
    abrirModal();
    inputCodigo.focus();
});

function abrirEdicion(id) {
    const c = buscarClientePorId(id);

    if (!c) {
        toastError('Cliente no encontrado');
        cargarClientes();
        return;
    }

    modoEdicion = true;
    idEditando  = c.IdCliente;
    modalTitulo.textContent = 'Editar cliente';

    inputCodigo.value = c.Codigo ?? '';
    inputNombre.value = c.Nombre ?? '';
    inputCodigo.disabled = false;

    ocultarMensaje();
    abrirModal();
    inputNombre.focus();
    inputNombre.select();
}

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    const codigo = inputCodigo.value.trim().toUpperCase();
    const nombre = inputNombre.value.trim();

    if (!codigo || !nombre) {
        mostrarMensaje('Código y nombre son obligatorios.', 'error');
        return;
    }
    if (!/^[A-Z0-9]{1,10}$/.test(codigo)) {
        mostrarMensaje('El código solo admite letras y números (máx. 10).', 'error');
        return;
    }
    if (nombre.length > 150) {
        mostrarMensaje('El nombre no puede superar 150 caracteres.', 'error');
        return;
    }

    setGuardando(true);
    try {
        let res;
        if (modoEdicion && idEditando !== null && idEditando !== undefined) {
            res = await window.api.clientes.actualizar(idEditando, codigo, nombre);
        } else {
            res = await window.api.clientes.crear(codigo, nombre);
        }

        if (res && res.ok) {
            cerrarModal();
            await cargarClientes();
            toastExito(res.mensaje || 'Operación exitosa');
        } else {
            mostrarMensaje(res?.mensaje || 'No se pudo guardar el cliente.', 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    } finally {
        setGuardando(false);
    }
});

/* =========================================================
   ELIMINAR (confirmación modal)
   ========================================================= */
async function eliminarCliente(id) {
    const c = buscarClientePorId(id);
    const nombreMostrar = c ? `${c.Codigo} — ${c.Nombre}` : `#${id}`;

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar cliente?',
        html: `Se eliminará <strong>${escaparHTML(nombreMostrar)}</strong>.<br>Esta acción no se puede deshacer.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
        customClass: {
            popup:         'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro',
            cancelButton:  'swal2-cancel swal2-styled'
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.clientes.eliminar(id);
        if (res && res.ok) {
            await cargarClientes();
            toastExito(res.mensaje || 'Cliente eliminado');
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
    limpiarResiduosSwal();
})();