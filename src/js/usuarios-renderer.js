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
let usuarios    = [];
let modoEdicion = false;
let idEditando  = null;
let guardando   = false;

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabla           = document.getElementById('tabla-usuarios');
const formulario      = document.getElementById('formulario');
const mensaje         = document.getElementById('mensaje');
const btnGuardar      = document.getElementById('btn-guardar');
const sinResultados   = document.getElementById('sin-resultados');

const inputNombres    = document.getElementById('nombres');
const inputApellidos  = document.getElementById('apellidos');
const inputUsuario    = document.getElementById('nombreUsuario');
const inputPassword   = document.getElementById('password');
const ayudaPassword   = document.getElementById('ayuda-password');

const modalUsuario    = document.getElementById('modal-usuario');
const modalTitulo     = document.getElementById('modal-usuario-titulo');

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

function buscarUsuarioPorId(id) {
    const idNum = Number(id);
    return usuarios.find(x => Number(x.IdUsuario) === idNum);
}

/* Icono SVG para badge de usuario */
function iconoUsuarioSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>`;
}

/* Icono SVG para badge de estado activo */
function iconoCheckSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`;
}

/* Icono SVG para badge de estado inactivo */
function iconoXSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>`;
}

/* =========================================================
   MODAL
   ========================================================= */
function abrirModal() {
    modalUsuario.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarModal() {
    modalUsuario.style.display = 'none';
    document.body.style.overflow = '';
    ocultarMensaje();
    modoEdicion = false;
    idEditando  = null;
}

document.getElementById('modal-usuario-cerrar').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
modalUsuario.addEventListener('click', (e) => {
    if (e.target === modalUsuario) cerrarModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalUsuario.style.display === 'flex') {
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
async function cargar() {
    try {
        usuarios = await window.api.usuarios.listar();
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los usuarios', err.message);
    }
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    tabla.innerHTML = '';

    if (!usuarios || usuarios.length === 0) {
        sinResultados.classList.remove('oculto');
        return;
    }

    sinResultados.classList.add('oculto');

    usuarios.forEach(u => {
        const tr = document.createElement('tr');

        const estadoHTML = u.Activo
            ? `<span class="badge-estado activo">${iconoCheckSVG()} Activo</span>`
            : `<span class="badge-estado inactivo">${iconoXSVG()} Inactivo</span>`;

        tr.innerHTML = `
            <td>
                <span class="badge-usuario">
                    ${iconoUsuarioSVG()}
                    ${escaparHTML(u.NombreUsuario)}
                </span>
            </td>
            <td><span class="texto-plano">${escaparHTML(u.Nombres)}</span></td>
            <td><span class="texto-plano">${escaparHTML(u.Apellidos)}</span></td>
            <td>${estadoHTML}</td>
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
        btnEditar.addEventListener('click', () => abrirEdicion(u.IdUsuario));

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'peligro';
        btnEliminar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            Desactivar
        `;
        btnEliminar.addEventListener('click', () => desactivar(u.IdUsuario));

        celda.appendChild(btnEditar);
        celda.appendChild(btnEliminar);
        tabla.appendChild(tr);
    });
}

/* =========================================================
   CREAR
   ========================================================= */
document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando  = null;
    modalTitulo.textContent = 'Nuevo usuario';

    inputNombres.value = '';
    inputApellidos.value = '';
    inputUsuario.value = '';
    inputPassword.value = '';
    ayudaPassword.textContent = '(obligatoria al crear)';

    ocultarMensaje();
    abrirModal();
    inputNombres.focus();
});

/* =========================================================
   EDITAR
   ========================================================= */
function abrirEdicion(id) {
    const u = buscarUsuarioPorId(id);

    if (!u) {
        toastError('Usuario no encontrado');
        cargar();
        return;
    }

    modoEdicion = true;
    idEditando  = u.IdUsuario;
    modalTitulo.textContent = 'Editar usuario';

    inputNombres.value = u.Nombres ?? '';
    inputApellidos.value = u.Apellidos ?? '';
    inputUsuario.value = u.NombreUsuario ?? '';
    inputPassword.value = '';
    ayudaPassword.textContent = '(dejar vacío para no cambiar)';

    ocultarMensaje();
    abrirModal();
    inputNombres.focus();
    inputNombres.select();
}

/* =========================================================
   GUARDAR
   ========================================================= */
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    const datos = {
        nombres:       inputNombres.value.trim(),
        apellidos:     inputApellidos.value.trim(),
        nombreUsuario: inputUsuario.value.trim(),
        password:      inputPassword.value,
        activo:        true
    };

    if (!datos.nombres || !datos.apellidos || !datos.nombreUsuario) {
        mostrarMensaje('Nombres, apellidos y nombre de usuario son obligatorios.', 'error');
        return;
    }
    if (datos.nombres.length > 100 || datos.apellidos.length > 100) {
        mostrarMensaje('Nombres y apellidos no pueden superar 100 caracteres.', 'error');
        return;
    }
    if (datos.nombreUsuario.length > 50) {
        mostrarMensaje('El nombre de usuario no puede superar 50 caracteres.', 'error');
        return;
    }
    if (!modoEdicion && !datos.password) {
        mostrarMensaje('La contraseña es obligatoria al crear.', 'error');
        return;
    }

    setGuardando(true);
    try {
        let res;
        if (modoEdicion && idEditando !== null && idEditando !== undefined) {
            res = await window.api.usuarios.actualizar(idEditando, datos);
        } else {
            res = await window.api.usuarios.crear(datos);
        }

        if (res && res.ok) {
            cerrarModal();
            await cargar();
            toastExito(res.mensaje || 'Operación exitosa');
        } else {
            mostrarMensaje(res?.mensaje || 'No se pudo guardar el usuario.', 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    } finally {
        setGuardando(false);
    }
});

/* =========================================================
   DESACTIVAR
   ========================================================= */
async function desactivar(id) {
    const u = buscarUsuarioPorId(id);
    const nombreMostrar = u ? `${u.NombreUsuario} (${u.Nombres} ${u.Apellidos})` : `#${id}`;

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Desactivar usuario?',
        html: `Se desactivará <strong>${escaparHTML(nombreMostrar)}</strong>.<br>
               El usuario ya no podrá iniciar sesión.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, desactivar',
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
        const res = await window.api.usuarios.eliminar(id);
        if (res && res.ok) {
            await cargar();
            toastExito(res.mensaje || 'Usuario desactivado');
        } else {
            toastError('No se pudo desactivar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al desactivar', err.message);
    }
}

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    await cargar();
    limpiarResiduosSwal();
})();