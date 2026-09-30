/* =========================================================
   ACTIVO FIJO — RENDERER DE CATÁLOGOS
   Maneja los 6 catálogos con tabs dinámicos.
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   CONFIGURACIÓN EN FRONTEND
   ========================================================= */
const CATALOGOS_FRONT = {
    marcas: {
        titulo: 'Marcas',
        tituloSingular: 'marca',
        pk: 'IdMarca',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100 }
        ]
    },
    tipos: {
        titulo: 'Tipos de Equipo',
        tituloSingular: 'tipo',
        pk: 'IdTipo',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100 },
            { nombre: 'RequiereResponsiva', etiqueta: 'Requiere responsiva', tipo: 'bool' },
            { nombre: 'RequiereIMEI',       etiqueta: 'Requiere IMEI',       tipo: 'bool' },
            { nombre: 'RequiereTelefono',   etiqueta: 'Requiere teléfono',   tipo: 'bool' }
        ]
    },
    estados: {
        titulo: 'Estados',
        tituloSingular: 'estado',
        pk: 'IdEstado',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50 }
        ]
    },
    estatus: {
        titulo: 'Estatus',
        tituloSingular: 'estatus',
        pk: 'IdEstatus',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50 }
        ]
    },
    carteras: {
        titulo: 'Carteras',
        tituloSingular: 'cartera',
        pk: 'IdCartera',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100 }
        ]
    },
    puestos: {
        titulo: 'Puestos',
        tituloSingular: 'puesto',
        pk: 'IdPuesto',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100 }
        ]
    }
};

/* =========================================================
   ESTADO
   ========================================================= */
let catalogoActual = 'marcas';
let registros      = [];
let modoEdicion    = false;
let idEditando     = null;
let guardando      = false;
let filtroBusqueda = '';

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabs             = document.getElementById('tabs-catalogos');
const tablaHead        = document.getElementById('tabla-head');
const tablaBody        = document.getElementById('tabla-body');
const formulario       = document.getElementById('formulario');
const camposForm       = document.getElementById('campos-form');
const mensaje          = document.getElementById('mensaje');
const btnGuardar       = document.getElementById('btn-guardar');
const btnNuevo         = document.getElementById('btn-nuevo');
const sinResultados    = document.getElementById('sin-resultados');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtro');
const modal            = document.getElementById('modal-catalogo');
const modalTitulo      = document.getElementById('modal-titulo');

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
   TABS
   ========================================================= */
tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.classList.contains('activo')) return;

    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
    btn.classList.add('activo');

    catalogoActual = btn.dataset.catalogo;
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');

    cargarCatalogo();
});

/* =========================================================
   CARGAR CATÁLOGO
   ========================================================= */
async function cargarCatalogo() {
    try {
        registros = await window.api.activoFijo.catalogos.listar(catalogoActual);
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los datos', err.message);
    }
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    const cfg = CATALOGOS_FRONT[catalogoActual];

    // Encabezados dinámicos
    const headers = cfg.campos.map(c => `<th>${escaparHTML(c.etiqueta)}</th>`);
    headers.push('<th style="width:200px; text-align:right;">Acciones</th>');
    tablaHead.innerHTML = `<tr>${headers.join('')}</tr>`;

    // Filtro
    const listaFiltrada = registros.filter(r => {
        if (!filtroBusqueda) return true;
        const texto = cfg.campos
            .map(c => String(r[c.nombre] ?? ''))
            .join(' ').toLowerCase();
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
        const celdas = cfg.campos.map(c => {
            const val = r[c.nombre];
            if (c.tipo === 'bool') {
                return `<td><span class="badge-boolean ${val ? 'si' : 'no'}">${val ? 'Sí' : 'No'}</span></td>`;
            }
            return `<td><span class="badge-nombre">${escaparHTML(val ?? '')}</span></td>`;
        });
        tr.innerHTML = celdas.join('') + `<td class="acciones-tabla"></td>`;

        const celda = tr.querySelector('.acciones-tabla');

        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'secundario';
        btnEditar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg> Editar`;
        btnEditar.addEventListener('click', () => abrirEdicion(r[cfg.pk]));

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
        btnEliminar.addEventListener('click', () => eliminarRegistro(r[cfg.pk]));

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
   MODAL — ABRIR / CERRAR
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
   CONSTRUIR CAMPOS DEL FORMULARIO DINÁMICAMENTE
   Texto arriba, switches agrupados abajo.
   ========================================================= */
function construirFormulario(datos = {}) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    camposForm.innerHTML = '';

    const camposTexto = [];
    const camposBool  = [];

    cfg.campos.forEach(c => {
        if (c.tipo === 'bool') camposBool.push(c);
        else camposTexto.push(c);
    });

    // 1. Primero los campos de texto
    camposTexto.forEach(c => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <label for="campo-${c.nombre}">${escaparHTML(c.etiqueta)}${c.requerido ? ' *' : ''}</label>
            <input type="${c.tipo}" id="campo-${c.nombre}" maxlength="${c.max || ''}"
                   value="${escaparHTML(datos[c.nombre] ?? '')}"
                   ${c.requerido ? 'required' : ''}>`;
        camposForm.appendChild(wrapper);
    });

    // 2. Después los switches agrupados horizontalmente
    if (camposBool.length > 0) {
        const grupo = document.createElement('div');
        grupo.className = 'grupo-switches campo-full';

        const titulo = document.createElement('div');
        titulo.className = 'grupo-titulo';
        titulo.textContent = 'Opciones del tipo';
        grupo.appendChild(titulo);

        const fila = document.createElement('div');
        fila.className = 'fila-switches';

        camposBool.forEach(c => {
            const item = document.createElement('label');
            item.className = 'switch';
            item.innerHTML = `
                <input type="checkbox" id="campo-${c.nombre}" ${datos[c.nombre] ? 'checked' : ''}>
                <span class="slider"></span>
                <span class="label-txt">${escaparHTML(c.etiqueta)}</span>`;
            fila.appendChild(item);
        });

        grupo.appendChild(fila);
        camposForm.appendChild(grupo);
    }
}

/* =========================================================
   NUEVO
   ========================================================= */
btnNuevo.addEventListener('click', () => {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    modoEdicion = false;
    idEditando = null;
    modalTitulo.textContent = `Nuevo ${cfg.tituloSingular}`;
    construirFormulario();
    ocultarMensaje();
    abrirModal();
    const primerInput = camposForm.querySelector('input[type="text"]');
    if (primerInput) primerInput.focus();
});

/* =========================================================
   EDITAR
   ========================================================= */
function abrirEdicion(id) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    const r = registros.find(x => x[cfg.pk] === id);
    if (!r) { toastError('Registro no encontrado'); return; }

    modoEdicion = true;
    idEditando = id;
    modalTitulo.textContent = `Editar ${cfg.tituloSingular}`;
    construirFormulario(r);
    ocultarMensaje();
    abrirModal();
    const primerInput = camposForm.querySelector('input[type="text"]');
    if (primerInput) { primerInput.focus(); primerInput.select(); }
}

/* =========================================================
   GUARDAR
   ========================================================= */
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    const cfg = CATALOGOS_FRONT[catalogoActual];
    const datos = {};

    for (const c of cfg.campos) {
        const el = document.getElementById(`campo-${c.nombre}`);
        if (c.tipo === 'bool') {
            datos[c.nombre] = el.checked;
        } else {
            const val = el.value.trim();
            if (c.requerido && !val) {
                mostrarMensaje(`${c.etiqueta} es obligatorio.`, 'error');
                return;
            }
            datos[c.nombre] = val;
        }
    }

    setGuardando(true);
    try {
        let res;
        if (modoEdicion && idEditando !== null) {
            res = await window.api.activoFijo.catalogos.actualizar(catalogoActual, idEditando, datos);
        } else {
            res = await window.api.activoFijo.catalogos.crear(catalogoActual, datos);
        }

        if (res && res.ok) {
            cerrarModal();
            await cargarCatalogo();
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
async function eliminarRegistro(id) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    const r = registros.find(x => x[cfg.pk] === id);
    const nombre = r ? (r.Nombre || `#${id}`) : `#${id}`;

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: `¿Eliminar ${cfg.tituloSingular}?`,
        html: `Se eliminará <strong>${escaparHTML(nombre)}</strong>.<br>Esta acción no se puede deshacer.`,
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
        const res = await window.api.activoFijo.catalogos.eliminar(catalogoActual, id);
        if (res && res.ok) {
            await cargarCatalogo();
            toastExito(res.mensaje || 'Registro eliminado');
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
    await cargarCatalogo();
})();