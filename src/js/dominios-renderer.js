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
let clientes = [];
let dominios = [];

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabla          = document.getElementById('tabla-dominios');
const filtroCliente  = document.getElementById('filtro-cliente');
const filtroBusqueda = document.getElementById('filtro-busqueda');

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

/* Icono SVG para badge de usuario */
function iconoUsuarioSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>`;
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

/* =========================================================
   CARGA DE DATOS
   ========================================================= */
async function cargarClientes() {
    try {
        clientes = await window.api.clientes.listar();
        filtroCliente.innerHTML = '<option value="">Todos los clientes</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.IdCliente);
            opt.textContent = `${c.Codigo} - ${c.Nombre}`;
            filtroCliente.appendChild(opt);
        });
    } catch (err) {
        toastError('No se pudieron cargar los clientes', err.message);
    }
}

async function cargarDominios() {
    try {
        const filtros = {
            idCliente: parseInt(filtroCliente.value, 10) || null,
            busqueda: filtroBusqueda.value.trim() || null
        };
        dominios = await window.api.dominios.listarTodas(filtros);
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los dominios', err.message);
    }
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    tabla.innerHTML = '';

    if (!dominios || dominios.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" class="estado-vacio">Sin dominios registrados</td>`;
        tabla.appendChild(tr);
        return;
    }

    dominios.forEach(d => {
        const tr = document.createElement('tr');
        const claseCodigo = claseCodigoCliente(d.ClienteCodigo);

        const passwordMostrada = (d.Password && d.Password.length > 0)
            ? '•'.repeat(Math.min(d.Password.length, 12))
            : '—';

        const descripcionHTML = (d.Descripcion && d.Descripcion.trim())
            ? `<span class="badge-desc">${escaparHTML(d.Descripcion)}</span>`
            : `<span class="badge-desc vacia">— sin descripción —</span>`;

        tr.innerHTML = `
            <td>
                <span class="badge-cliente ${claseCodigo}">
                    ${escaparHTML(d.ClienteCodigo)}
                </span>
            </td>
            <td>
                <span class="badge-usuario">
                    ${iconoUsuarioSVG()}
                    ${escaparHTML(d.Usuario)}
                </span>
            </td>
            <td><span class="password-celda">${passwordMostrada}</span></td>
            <td>${descripcionHTML}</td>
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
        btnEditar.addEventListener('click', () => abrirEditar(d));

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
        btnEliminar.addEventListener('click', () => eliminar(d));

        celda.appendChild(btnEditar);
        celda.appendChild(btnEliminar);
        tabla.appendChild(tr);
    });
}

/* =========================================================
   FILTROS
   ========================================================= */
filtroCliente.addEventListener('change', cargarDominios);

let debounceBusqueda = null;
filtroBusqueda.addEventListener('input', () => {
    clearTimeout(debounceBusqueda);
    debounceBusqueda = setTimeout(cargarDominios, 250);
});

/* =========================================================
   CREAR / EDITAR
   ========================================================= */
document.getElementById('btn-nuevo').addEventListener('click', abrirCrear);

async function abrirCrear() {
    if (clientes.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin clientes',
            text: 'Primero crea al menos un cliente.',
            confirmButtonText: 'Entendido',
            buttonsStyling: false,
            customClass: {
                popup:         'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled'
            }
        });
        return;
    }

    const opcionesClientes = clientes.map(c =>
        `<option value="${c.IdCliente}">${escaparHTML(c.Codigo)} - ${escaparHTML(c.Nombre)}</option>`
    ).join('');

    const { value: formValues } = await Swal.fire({
        title: 'Nuevo dominio',
        html: `
            <select id="swal-cliente" class="swal2-select">
                <option value="">-- Cliente --</option>
                ${opcionesClientes}
            </select>
            <input id="swal-usuario" class="swal2-input" placeholder="Usuario">
            <input id="swal-password" class="swal2-input" placeholder="Password">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción (opcional)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        buttonsStyling: false,
        customClass: {
            popup:         'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton:  'swal2-cancel swal2-styled'
        },
        preConfirm: () => {
            const idCliente = parseInt(document.getElementById('swal-cliente').value, 10);
            const usuario = document.getElementById('swal-usuario').value.trim();
            const password = document.getElementById('swal-password').value;
            const desc = document.getElementById('swal-desc').value.trim();
            if (!idCliente || !usuario || !password) {
                Swal.showValidationMessage('Cliente, usuario y password son obligatorios');
                return false;
            }
            return { idCliente, usuario, password, desc };
        }
    });

    if (!formValues) return;

    try {
        const res = await window.api.dominios.crear(
            formValues.idCliente,
            formValues.usuario,
            formValues.password,
            formValues.desc
        );
        if (res && res.ok) {
            await cargarDominios();
            toastExito(res.mensaje || 'Dominio creado');
        } else {
            toastError('No se pudo crear', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error', err.message);
    }
}

async function abrirEditar(d) {
    const { value: formValues } = await Swal.fire({
        title: 'Editar dominio',
        html: `
            <input id="swal-usuario" class="swal2-input" placeholder="Usuario" value="${escaparHTML(d.Usuario)}">
            <input id="swal-password" class="swal2-input" placeholder="Password" value="${escaparHTML(d.Password)}">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción" value="${escaparHTML(d.Descripcion ?? '')}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        buttonsStyling: false,
        customClass: {
            popup:         'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton:  'swal2-cancel swal2-styled'
        },
        preConfirm: () => {
            const usuario = document.getElementById('swal-usuario').value.trim();
            const password = document.getElementById('swal-password').value;
            const desc = document.getElementById('swal-desc').value.trim();
            if (!usuario || !password) {
                Swal.showValidationMessage('Usuario y password son obligatorios');
                return false;
            }
            return { usuario, password, desc };
        }
    });

    if (!formValues) return;

    try {
        const res = await window.api.dominios.actualizar(d.IdDominio, formValues.usuario, formValues.password, formValues.desc);
        if (res && res.ok) {
            await cargarDominios();
            toastExito(res.mensaje || 'Dominio actualizado');
        } else {
            toastError('No se pudo actualizar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error', err.message);
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(d) {
    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar dominio?',
        html: `Se eliminará <strong>${escaparHTML(d.Usuario)}</strong> de <strong>${escaparHTML(d.ClienteCodigo)}</strong>.<br>
               Los equipos ya guardados con este usuario no se ven afectados.`,
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
        const res = await window.api.dominios.eliminar(d.IdDominio);
        if (res && res.ok) {
            await cargarDominios();
            toastExito(res.mensaje || 'Dominio eliminado');
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
    await cargarDominios();
    limpiarResiduosSwal();
})();