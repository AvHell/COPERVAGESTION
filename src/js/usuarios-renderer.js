/* =========================================================
   REFERENCIA A SWEETALERT
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   TOASTS
   ========================================================= */
function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
        background: '#ffffff', color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-success' },
        didOpen: (t) => {
            t.style.boxShadow = 'none'; t.style.webkitBoxShadow = 'none';
            t.style.filter = 'none'; t.style.webkitFilter = 'none';
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
        background: '#ffffff', color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-error' },
        didOpen: (t) => {
            t.style.boxShadow = 'none'; t.style.webkitBoxShadow = 'none';
            t.style.filter = 'none'; t.style.webkitFilter = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   LIMPIEZA
   ========================================================= */
function limpiarResiduosSwal() {
    document.querySelectorAll('body > .swal2-container').forEach(c => {
        if (!c.querySelector('.swal2-popup') && !c.classList.contains('swal2-backdrop-show')) c.remove();
    });
    const sel = [
        'body > input.swal2-input', 'body > input.swal2-file',
        'body > input.swal2-radio', 'body > input.swal2-checkbox',
        'body > select.swal2-select', 'body > textarea.swal2-textarea',
        'body > .swal2-validation-message', 'body > .swal2-input-label', 'body > .swal2-select-label'
    ];
    document.querySelectorAll(sel.join(',')).forEach(el => el.remove());
    document.querySelectorAll('body > [id^="swal2-"]').forEach(el => {
        if (!el.closest('.swal2-popup')) el.remove();
    });
}

/* =========================================================
   CATÁLOGO DE PERMISOS (dinámico desde el main)
   ---------------------------------------------------------
   Ya NO está hardcodeado. Se carga con:
     await window.api.permisos.catalogo()
   Formato devuelto por permisos.catalogoPermisos():
     [ { grupo: 'Equipos', items: [ { clave, etiqueta }, ... ] }, ... ]
   ========================================================= */
let CATALOGO_PERMISOS = null;   // null = aún no cargado
let filtroPermiso     = '';     // texto del buscador

async function cargarCatalogoPermisos() {
    if (CATALOGO_PERMISOS) return CATALOGO_PERMISOS;
    try {
        CATALOGO_PERMISOS = await window.api.permisos.catalogo() || [];
    } catch (err) {
        console.warn('[Permisos] No se pudo cargar el catálogo:', err);
        CATALOGO_PERMISOS = [];
    }
    return CATALOGO_PERMISOS;
}

/* =========================================================
   ESTADO
   ========================================================= */
let usuarios        = [];
let roles           = [];
let permisos        = [];
let modoEdicion     = false;
let idEditando      = null;
let guardando       = false;
let rolActivo       = null;
let rolEditandoId   = null;
let rolModoEdicion  = false;

/* =========================================================
   DOM
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
const inputIdRol      = document.getElementById('idRol');
const ayudaPassword   = document.getElementById('ayuda-password');

const modalUsuario    = document.getElementById('modal-usuario');
const modalTitulo     = document.getElementById('modal-usuario-titulo');

const modalPermisos   = document.getElementById('modal-permisos');
const permisosTabs    = document.getElementById('permisos-tabs');
const permisosTbody   = document.getElementById('permisos-tbody');
const permisosTablaWrap = document.querySelector('.permisos-tabla-wrap');

const permisosRolAcciones = document.getElementById('permisos-rol-acciones');
const btnEditarRol        = document.getElementById('btn-editar-rol');
const btnToggleRol        = document.getElementById('btn-toggle-rol');
const txtToggleRol        = document.getElementById('txt-toggle-rol');
const btnEliminarRol      = document.getElementById('btn-eliminar-rol');

const modalRol        = document.getElementById('modal-rol');
const formRol         = document.getElementById('form-rol');
const modalRolTitulo  = document.getElementById('modal-rol-titulo');
const rolCodigo       = document.getElementById('rol-codigo');
const rolNombre       = document.getElementById('rol-nombre');
const rolDescripcion  = document.getElementById('rol-descripcion');
const rolMensaje      = document.getElementById('rol-mensaje');
const btnGuardarRol   = document.getElementById('btn-guardar-rol');

/* =========================================================
   UTILIDADES
   ========================================================= */
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
function setGuardando(v) {
    guardando = v;
    btnGuardar.disabled = v;
    btnGuardar.style.opacity = v ? '0.6' : '';
}
function buscarUsuarioPorId(id) {
    return usuarios.find(x => Number(x.IdUsuario) === Number(id));
}

function iconoUsuarioSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>`;
}
function iconoCheckSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`;
}
function iconoXSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>`;
}

/* =========================================================
   MODAL USUARIO
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

/* =========================================================
   MODAL PERMISOS
   ========================================================= */
async function abrirModalPermisos() {
    modalPermisos.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    await cargarCatalogoPermisos();   // 1) traer catálogo del backend
    inyectarBuscadorPermisos();       // 2) UI buscador (solo una vez)
    renderPermisosTabs();
}
function cerrarModalPermisos() {
    modalPermisos.style.display = 'none';
    document.body.style.overflow = '';
}
document.getElementById('modal-permisos-cerrar').addEventListener('click', cerrarModalPermisos);
modalPermisos.addEventListener('click', (e) => {
    if (e.target === modalPermisos) cerrarModalPermisos();
});

/* =========================================================
   MODAL ROL (crear/editar)
   ========================================================= */
function abrirModalRol(rol = null) {
    rolModoEdicion = !!rol;
    rolEditandoId  = rol ? rol.IdRol : null;

    modalRolTitulo.textContent = rolModoEdicion ? 'Editar rol' : 'Nuevo rol';

    rolCodigo.value      = rol ? rol.Codigo : '';
    rolNombre.value      = rol ? rol.Nombre : '';
    rolDescripcion.value = rol ? (rol.Descripcion || '') : '';

    rolMensaje.classList.add('oculto');
    modalRol.style.display = 'flex';

    setTimeout(() => rolCodigo.focus(), 40);
}
function cerrarModalRol() {
    modalRol.style.display = 'none';
    rolModoEdicion = false;
    rolEditandoId  = null;
}
document.getElementById('modal-rol-cerrar').addEventListener('click', cerrarModalRol);
document.getElementById('btn-cancelar-rol').addEventListener('click', cerrarModalRol);
modalRol.addEventListener('click', (e) => {
    if (e.target === modalRol) cerrarModalRol();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (modalRol.style.display === 'flex')      { cerrarModalRol(); return; }
        if (modalUsuario.style.display === 'flex')  { cerrarModal();    return; }
        if (modalPermisos.style.display === 'flex') { cerrarModalPermisos(); }
    }
});

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => {
    window.api.volverMenu();
});

/* =========================================================
   CARGAR
   ========================================================= */
async function cargar() {
    try {
        const [listaUsuarios, listaRoles] = await Promise.all([
            window.api.usuarios.listar(),
            window.api.permisos.listarRoles()
        ]);
        usuarios = listaUsuarios || [];
        roles    = listaRoles    || [];
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los usuarios', err.message);
    }
}

async function cargarPermisos() {
    try {
        permisos = await window.api.permisos.listarTodos() || [];
    } catch (err) {
        toastError('No se pudieron cargar los permisos', err.message);
        permisos = [];
    }
}

/* =========================================================
   TABLA USUARIOS
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

        const rolHTML = u.RolNombre
            ? `<span class="badge-rol">${escaparHTML(u.RolNombre)}</span>`
            : `<span class="badge-rol badge-rol-vacio">—</span>`;

        tr.innerHTML = `
            <td>
                <span class="badge-usuario">
                    ${iconoUsuarioSVG()}
                    ${escaparHTML(u.NombreUsuario)}
                </span>
            </td>
            <td><span class="texto-plano">${escaparHTML(u.Nombres)}</span></td>
            <td><span class="texto-plano">${escaparHTML(u.Apellidos)}</span></td>
            <td>${rolHTML}</td>
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
   SELECT DE ROLES
   ========================================================= */
function cargarSelectRoles() {
    inputIdRol.innerHTML = '<option value="">— Sin rol —</option>';
    roles.filter(r => r.Activo).forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.IdRol;
        opt.textContent = `${r.Nombre} (${r.Codigo})`;
        inputIdRol.appendChild(opt);
    });
}

/* =========================================================
   CREAR USUARIO
   ========================================================= */
document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando  = null;
    modalTitulo.textContent = 'Nuevo usuario';

    inputNombres.value = '';
    inputApellidos.value = '';
    inputUsuario.value = '';
    inputPassword.value = '';
    inputIdRol.value = '';
    ayudaPassword.textContent = '(obligatoria al crear)';

    cargarSelectRoles();
    ocultarMensaje();
    abrirModal();
    inputNombres.focus();
});

/* =========================================================
   EDITAR USUARIO
   ========================================================= */
function abrirEdicion(id) {
    const u = buscarUsuarioPorId(id);
    if (!u) { toastError('Usuario no encontrado'); cargar(); return; }

    modoEdicion = true;
    idEditando  = u.IdUsuario;
    modalTitulo.textContent = 'Editar usuario';

    inputNombres.value   = u.Nombres ?? '';
    inputApellidos.value = u.Apellidos ?? '';
    inputUsuario.value   = u.NombreUsuario ?? '';
    inputPassword.value  = '';
    ayudaPassword.textContent = '(dejar vacío para no cambiar)';

    cargarSelectRoles();
    inputIdRol.value = u.IdRol ?? '';

    ocultarMensaje();
    abrirModal();
    inputNombres.focus();
    inputNombres.select();
}

/* =========================================================
   GUARDAR USUARIO
   ========================================================= */
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    const datos = {
        nombres:       inputNombres.value.trim(),
        apellidos:     inputApellidos.value.trim(),
        nombreUsuario: inputUsuario.value.trim(),
        password:      inputPassword.value,
        activo:        true,
        idRol:         inputIdRol.value ? Number(inputIdRol.value) : null
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
        if (modoEdicion && idEditando != null) {
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
   DESACTIVAR USUARIO
   ========================================================= */
async function desactivar(id) {
    const u = buscarUsuarioPorId(id);
    const nombreMostrar = u ? `${u.NombreUsuario} (${u.Nombres} ${u.Apellidos})` : `#${id}`;

    const c = await Swal.fire({
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
    if (!c.isConfirmed) return;

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
   PERMISOS — Buscador (se inyecta una sola vez)
   ========================================================= */
let buscadorInyectado = false;

function inyectarBuscadorPermisos() {
    if (buscadorInyectado || !permisosTablaWrap) return;
    buscadorInyectado = true;

    const cont = document.createElement('div');
    cont.className = 'permisos-buscador';
    cont.innerHTML = `
        <input type="search" id="permisos-filtro" placeholder="🔎 Filtrar permisos (ej. crear, equipos, plano...)" />
    `;
    permisosTablaWrap.parentNode.insertBefore(cont, permisosTablaWrap);

    const input = cont.querySelector('#permisos-filtro');
    input.addEventListener('input', () => {
        filtroPermiso = input.value.trim().toLowerCase();
        renderPermisosTabla();
    });
}

/* =========================================================
   PERMISOS — Tabs + Tabla
   ========================================================= */
function renderPermisosTabs() {
    permisosTabs.innerHTML = '';

    if (!roles.length) {
        permisosTabs.innerHTML = '<span class="permisos-vacio">No hay roles configurados.</span>';
        permisosRolAcciones.style.display = 'none';
        permisosTbody.innerHTML = '<tr><td colspan="2" class="permisos-vacio">Crea un rol para empezar.</td></tr>';
        return;
    }

    roles.forEach(r => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'permisos-tab' + (rolActivo === r.IdRol ? ' activo' : '');
        btn.dataset.idRol = r.IdRol;

        const inactivo = !r.Activo ? ' <em style="opacity:.6;">(inactivo)</em>' : '';
        btn.innerHTML = `${escaparHTML(r.Nombre)}${inactivo}`;

        btn.addEventListener('click', () => {
            rolActivo = r.IdRol;
            renderPermisosTabs();
            renderPermisosTabla();
            actualizarAccionesRol();
        });
        permisosTabs.appendChild(btn);
    });

    if (!rolActivo && roles.length) rolActivo = roles[0].IdRol;

    renderPermisosTabla();
    actualizarAccionesRol();
}

/* Compara con Number() por seguridad (SQL a veces devuelve string) */
function permisoActual(idRol, modulo) {
    const p = permisos.find(x => Number(x.IdRol) === Number(idRol) && x.Modulo === modulo);
    return p ? !!p.Permitido : false;
}

function coincideFiltro(clave, etiqueta) {
    if (!filtroPermiso) return true;
    const t = `${clave} ${etiqueta}`.toLowerCase();
    return t.includes(filtroPermiso);
}

function renderPermisosTabla() {
    permisosTbody.innerHTML = '';

    if (!rolActivo) {
        permisosTbody.innerHTML = '<tr><td colspan="2" class="permisos-vacio">Selecciona un rol arriba.</td></tr>';
        return;
    }

    if (!CATALOGO_PERMISOS || CATALOGO_PERMISOS.length === 0) {
        permisosTbody.innerHTML = '<tr><td colspan="2" class="permisos-vacio">Cargando catálogo de permisos…</td></tr>';
        return;
    }

    const rol = roles.find(r => r.IdRol === rolActivo);
    const deshabilitado = rol && !rol.Activo;

    let totalVisibles = 0;

    CATALOGO_PERMISOS.forEach(({ grupo, items }) => {
        const visibles = items.filter(it => coincideFiltro(it.clave, it.etiqueta));
        if (visibles.length === 0) return;
        totalVisibles += visibles.length;

        const trGrupo = document.createElement('tr');
        trGrupo.className = 'permisos-grupo';
        trGrupo.innerHTML = `<td colspan="2">${escaparHTML(grupo)}</td>`;
        permisosTbody.appendChild(trGrupo);

        visibles.forEach(({ clave, etiqueta }) => {
            const activo = permisoActual(rolActivo, clave);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <label class="permisos-label">
                        <span>${escaparHTML(etiqueta)}</span>
                        <code>${escaparHTML(clave)}</code>
                    </label>
                </td>
                <td style="text-align:center;">
                    <label class="switch">
                        <input type="checkbox" data-modulo="${escaparHTML(clave)}"
                               ${activo ? 'checked' : ''} ${deshabilitado ? 'disabled' : ''}>
                        <span class="slider"></span>
                    </label>
                </td>
            `;
            const cb = tr.querySelector('input[type="checkbox"]');
            cb.addEventListener('change', () => togglePermiso(rolActivo, clave, cb.checked, cb));
            permisosTbody.appendChild(tr);
        });
    });

    if (totalVisibles === 0) {
        permisosTbody.innerHTML = '<tr><td colspan="2" class="permisos-vacio">Ningún permiso coincide con el filtro.</td></tr>';
    }
}

async function togglePermiso(idRol, modulo, permitido, checkbox) {
    try {
        const res = await window.api.permisos.actualizar(idRol, modulo, permitido);
        if (res && res.ok) {
            const ex = permisos.find(x => Number(x.IdRol) === Number(idRol) && x.Modulo === modulo);
            if (ex) ex.Permitido = permitido;
            else permisos.push({ IdRol: idRol, Modulo: modulo, Permitido: permitido });
            toastExito('Permiso actualizado');
        } else {
            checkbox.checked = !permitido;
            toastError('No se pudo actualizar el permiso', res?.mensaje || '');
        }
    } catch (err) {
        checkbox.checked = !permitido;
        toastError('Error al actualizar', err.message);
    }
}

/* =========================================================
   ACCIONES DE ROL (editar/toggle/eliminar)
   ========================================================= */
function actualizarAccionesRol() {
    const rol = roles.find(r => r.IdRol === rolActivo);
    if (!rol) {
        permisosRolAcciones.style.display = 'none';
        return;
    }

    permisosRolAcciones.style.display = 'flex';
    txtToggleRol.textContent = rol.Activo ? 'Desactivar' : 'Activar';

    const esAdmin = rol.Codigo === 'ADMIN';
    btnToggleRol.disabled = esAdmin;
    btnEliminarRol.disabled = esAdmin;
    btnToggleRol.title = esAdmin ? 'El rol ADMIN no se puede desactivar' : '';
    btnEliminarRol.title = esAdmin ? 'El rol ADMIN no se puede eliminar' : '';
}

btnEditarRol.addEventListener('click', () => {
    const rol = roles.find(r => r.IdRol === rolActivo);
    if (!rol) return;
    abrirModalRol(rol);
});

btnToggleRol.addEventListener('click', async () => {
    const rol = roles.find(r => r.IdRol === rolActivo);
    if (!rol) return;

    const nuevoEstado = !rol.Activo;
    const confirmacion = await Swal.fire({
        icon: 'question',
        title: nuevoEstado ? '¿Activar rol?' : '¿Desactivar rol?',
        html: nuevoEstado
            ? `Se activará <strong>${escaparHTML(rol.Nombre)}</strong>.`
            : `Se desactivará <strong>${escaparHTML(rol.Nombre)}</strong>.<br>
               Los usuarios con este rol no podrán iniciar sesión.`,
        showCancelButton: true,
        confirmButtonText: nuevoEstado ? 'Sí, activar' : 'Sí, desactivar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
            popup:         'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton:  'swal2-cancel swal2-styled'
        }
    });
    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.permisos.cambiarEstadoRol(rol.IdRol, nuevoEstado);
        if (res && res.ok) {
            await cargar();
            renderPermisosTabs();
            actualizarAccionesRol();
            toastExito(res.mensaje);
        } else {
            toastError('No se pudo cambiar el estado', res?.mensaje || '');
        }
    } catch (err) {
        toastError('Error al cambiar estado', err.message);
    }
});

btnEliminarRol.addEventListener('click', async () => {
    const rol = roles.find(r => r.IdRol === rolActivo);
    if (!rol) return;

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar rol?',
        html: `Se eliminará permanentemente <strong>${escaparHTML(rol.Nombre)}</strong>
               y todos sus permisos configurados.<br>
               <small>Esta acción no se puede deshacer.</small>`,
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
        const res = await window.api.permisos.eliminarRol(rol.IdRol);
        if (res && res.ok) {
            rolActivo = null;
            await cargar();
            await cargarPermisos();
            renderPermisosTabs();
            toastExito(res.mensaje);
        } else {
            toastError('No se pudo eliminar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al eliminar rol', err.message);
    }
});

/* =========================================================
   NUEVO ROL (botón + submit)
   ========================================================= */
document.getElementById('btn-nuevo-rol').addEventListener('click', () => {
    abrirModalRol(null);
});

formRol.addEventListener('submit', async (e) => {
    e.preventDefault();

    const codigo      = rolCodigo.value.trim().toUpperCase();
    const nombre      = rolNombre.value.trim();
    const descripcion = rolDescripcion.value.trim();

    rolMensaje.classList.add('oculto');
    btnGuardarRol.disabled = true;

    if (!codigo || !nombre) {
        rolMensaje.textContent = 'Código y nombre son obligatorios.';
        rolMensaje.className = 'mensaje error';
        rolMensaje.classList.remove('oculto');
        btnGuardarRol.disabled = false;
        return;
    }
    if (!/^[A-Z0-9_]+$/.test(codigo)) {
        rolMensaje.textContent = 'El código solo admite letras mayúsculas, números y guion bajo.';
        rolMensaje.className = 'mensaje error';
        rolMensaje.classList.remove('oculto');
        btnGuardarRol.disabled = false;
        return;
    }

    try {
        let res;
        if (rolModoEdicion && rolEditandoId) {
            res = await window.api.permisos.actualizarRol(rolEditandoId, { codigo, nombre, descripcion });
        } else {
            res = await window.api.permisos.crearRol({ codigo, nombre, descripcion });
        }

        if (res && res.ok) {
            cerrarModalRol();
            await cargar();
            await cargarPermisos();

            if (!rolModoEdicion && res.idRol) rolActivo = res.idRol;

            renderPermisosTabs();
            toastExito(res.mensaje);
        } else {
            rolMensaje.textContent = res?.mensaje || 'No se pudo guardar el rol.';
            rolMensaje.className = 'mensaje error';
            rolMensaje.classList.remove('oculto');
        }
    } catch (err) {
        rolMensaje.textContent = 'Error: ' + err.message;
        rolMensaje.className = 'mensaje error';
        rolMensaje.classList.remove('oculto');
    } finally {
        btnGuardarRol.disabled = false;
    }
});

/* =========================================================
   ABRIR MODAL DE PERMISOS
   ========================================================= */
document.getElementById('btn-permisos').addEventListener('click', async () => {
    await cargar();
    await cargarPermisos();
    rolActivo = roles[0]?.IdRol || null;
    await abrirModalPermisos();
});

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    await cargar();
    limpiarResiduosSwal();
})();