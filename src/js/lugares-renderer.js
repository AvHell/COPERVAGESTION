/* =========================================================
   REFERENCIA A SWEETALERT
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   TOASTS — versión limpia
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
        customClass: { popup: 'cl-toast cl-toast-success' },
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
        customClass: { popup: 'cl-toast cl-toast-error' },
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
const COLORES_CODIGO_CLIENTE = {
    'NU':    'codigo-nu',
    'DIDI':  'codigo-didi',
    'ADAMA': 'codigo-adama',
    'KUBO':  'codigo-kubo',
    'MEGA':  'codigo-mega'
};

function claseCodigoCliente(codigo) {
    const key = String(codigo || '').trim().toUpperCase();
    return COLORES_CODIGO_CLIENTE[key] || 'codigo-def';
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
let lugares        = [];
let clientes       = [];
let modoEdicion    = false;
let idEditando     = null;
let guardando      = false;
let filtroBusqueda = '';

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const contenedorGrupos = document.getElementById('contenedor-grupos');
const sinResultados    = document.getElementById('sin-resultados');
const formulario       = document.getElementById('formulario');
const selectCli        = document.getElementById('cliente');
const inputNombre      = document.getElementById('nombre');
const mensaje          = document.getElementById('mensaje');
const btnGuardar       = document.getElementById('btn-guardar');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtro');

const modalLugar       = document.getElementById('modal-lugar');
const modalTitulo      = document.getElementById('modal-lugar-titulo');

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

function buscarLugarPorId(id) {
    const idNum = Number(id);
    return lugares.find(x => Number(x.IdLugarCliente) === idNum);
}

/* =========================================================
   MODAL
   ========================================================= */
function abrirModal() {
    modalLugar.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarModal() {
    modalLugar.style.display = 'none';
    document.body.style.overflow = '';
    ocultarMensaje();
    modoEdicion = false;
    idEditando  = null;
}

document.getElementById('modal-lugar-cerrar').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
modalLugar.addEventListener('click', (e) => {
    if (e.target === modalLugar) cerrarModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalLugar.style.display === 'flex') {
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
   CARGA DE DATOS
   ========================================================= */
async function cargarClientes() {
    try {
        clientes = await window.api.clientes.listar();
        selectCli.innerHTML = '<option value="">-- Selecciona --</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.IdCliente);
            opt.textContent = `${c.Codigo} - ${c.Nombre}`;
            selectCli.appendChild(opt);
        });
    } catch (err) {
        toastError('No se pudieron cargar los clientes', err.message);
    }
}

async function cargarLugares() {
    try {
        lugares = await window.api.lugares.listar();
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los lugares', err.message);
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
   RENDER TABLA AGRUPADA POR CLIENTE
   Todos los grupos inician COLAPSADOS.
   ========================================================= */
function renderTabla() {
    contenedorGrupos.innerHTML = '';

    const listaFiltrada = lugares.filter(l => {
        if (!filtroBusqueda) return true;
        const texto = [l.ClienteCodigo, l.ClienteNombre, l.Nombre]
            .filter(Boolean).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    if (listaFiltrada.length === 0) {
        sinResultados.classList.remove('oculto');
        return;
    }

    sinResultados.classList.add('oculto');

    const porCliente = new Map();
    listaFiltrada.forEach(l => {
        const key = l.ClienteCodigo;
        if (!porCliente.has(key)) {
            porCliente.set(key, {
                idCliente: l.IdCliente,
                codigo: l.ClienteCodigo,
                nombre: l.ClienteNombre,
                lugares: []
            });
        }
        porCliente.get(key).lugares.push(l);
    });

    const clientesOrdenados = Array.from(porCliente.values())
        .sort((a, b) => a.codigo.localeCompare(b.codigo));

    clientesOrdenados.forEach(grupoCliente => {
        const divCliente = document.createElement('div');
        // Inician colapsados
        divCliente.className = 'grupo-cliente colapsado';

        const claseCodigo = claseCodigoCliente(grupoCliente.codigo);

        const headerCliente = document.createElement('div');
        headerCliente.className = 'grupo-cliente-header';
        headerCliente.innerHTML = `
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span class="badge-cliente ${claseCodigo}">
                <span class="codigo">${escaparHTML(grupoCliente.codigo)}</span>
                <span class="nombre">${escaparHTML(grupoCliente.nombre)}</span>
            </span>
        `;
        headerCliente.addEventListener('click', () => {
            divCliente.classList.toggle('colapsado');
        });
        divCliente.appendChild(headerCliente);

        const bodyCliente = document.createElement('div');
        bodyCliente.className = 'grupo-cliente-body';

        const tabla = document.createElement('table');
        tabla.className = 'tabla-lugares';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th style="width:60%;">Piso / Lugar</th>
                    <th style="width:25%;">Cliente</th>
                    <th style="width:15%; text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = tabla.querySelector('tbody');

        grupoCliente.lugares
            .slice()
            .sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || ''))
            .forEach(l => {
                const tr = document.createElement('tr');
                const claseCodigoLugar = claseCodigoCliente(l.ClienteCodigo);

                tr.innerHTML = `
                    <td>
                        <span class="badge-piso ${claseCodigoLugar}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                                <path d="M3 21h18"/>
                                <path d="M5 21V7l8-4v18"/>
                                <path d="M19 21V11l-6-4"/>
                            </svg>
                            ${escaparHTML(l.Nombre)}
                        </span>
                    </td>
                    <td>
                        <span class="badge-cliente ${claseCodigoLugar}">
                            <span class="codigo">${escaparHTML(l.ClienteCodigo)}</span>
                            <span class="nombre">${escaparHTML(l.ClienteNombre)}</span>
                        </span>
                    </td>
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
                btnEditar.addEventListener('click', () => abrirEdicion(l.IdLugarCliente));

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
                btnEliminar.addEventListener('click', () => eliminarLugar(l.IdLugarCliente));

                celda.appendChild(btnEditar);
                celda.appendChild(btnEliminar);
                tbody.appendChild(tr);
            });

        bodyCliente.appendChild(tabla);
        divCliente.appendChild(bodyCliente);
        contenedorGrupos.appendChild(divCliente);
    });
}

/* =========================================================
   CREAR / EDITAR (MODAL)
   ========================================================= */
document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando  = null;
    modalTitulo.textContent = 'Nuevo lugar';
    selectCli.value   = '';
    inputNombre.value = '';
    ocultarMensaje();
    abrirModal();
    selectCli.focus();
});

function abrirEdicion(id) {
    const l = buscarLugarPorId(id);

    if (!l) {
        toastError('Lugar no encontrado');
        cargarLugares();
        return;
    }

    modoEdicion = true;
    idEditando  = l.IdLugarCliente;
    modalTitulo.textContent = 'Editar lugar';

    // String() para que coincida con el value del <option>
    selectCli.value   = String(l.IdCliente);
    inputNombre.value = l.Nombre ?? '';

    ocultarMensaje();
    abrirModal();
    inputNombre.focus();
    inputNombre.select();
}

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    const idCliente = parseInt(selectCli.value, 10);
    const nombre    = inputNombre.value.trim();

    if (!idCliente || Number.isNaN(idCliente)) {
        mostrarMensaje('Debes seleccionar un cliente.', 'error');
        return;
    }
    if (!nombre) {
        mostrarMensaje('El nombre del lugar es obligatorio.', 'error');
        return;
    }
    if (nombre.length > 100) {
        mostrarMensaje('El nombre no puede superar 100 caracteres.', 'error');
        return;
    }

    setGuardando(true);
    try {
        let res;
        if (modoEdicion && idEditando !== null && idEditando !== undefined) {
            res = await window.api.lugares.actualizar(idEditando, idCliente, nombre);
        } else {
            res = await window.api.lugares.crear(idCliente, nombre);
        }

        if (res && res.ok) {
            cerrarModal();
            await cargarLugares();
            toastExito(res.mensaje || 'Operación exitosa');
        } else {
            mostrarMensaje(res?.mensaje || 'No se pudo guardar el lugar.', 'error');
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
async function eliminarLugar(id) {
    const l = buscarLugarPorId(id);
    const nombreMostrar = l
        ? `${l.ClienteCodigo} — ${l.Nombre}`
        : `#${id}`;

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar lugar?',
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
        const res = await window.api.lugares.eliminar(id);
        if (res && res.ok) {
            await cargarLugares();
            toastExito(res.mensaje || 'Lugar eliminado');
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
    await cargarLugares();
    limpiarResiduosSwal();
})();