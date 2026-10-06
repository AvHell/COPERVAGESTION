/* =========================================================
   ACTIVO FIJO — RENDERER DE CATÁLOGOS (12 catálogos)
   Soft delete + pestaña Eliminados + Restaurar
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   OPCIONES PARA CAMPOS SELECT
   ========================================================= */
const GRUPOS_SUBTIPO = [
    { valor: 'DIADEMA',         etiqueta: 'Diadema' },
    { valor: 'MOUSE',           etiqueta: 'Mouse' },
    { valor: 'TECLADO',         etiqueta: 'Teclado' },
    { valor: 'CARGADOR',        etiqueta: 'Cargador' },
    { valor: 'ADAPTADOR_VIDEO', etiqueta: 'Adaptador de Video' },
    { valor: 'ALMACENAMIENTO',  etiqueta: 'Almacenamiento' }
];

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
            { nombre: 'Nombre',       etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100 },
            { nombre: 'GrupoSubtipo', etiqueta: 'Grupo de subtipo', tipo: 'select',
              opciones: [{ valor: '', etiqueta: '— Sin grupo —' }, ...GRUPOS_SUBTIPO] },
            { nombre: 'RequiereResponsiva',      etiqueta: 'Requiere responsiva',       tipo: 'bool' },
            { nombre: 'RequiereIMEI',            etiqueta: 'Requiere IMEI',             tipo: 'bool' },
            { nombre: 'RequiereTelefono',        etiqueta: 'Requiere teléfono',         tipo: 'bool' },
            { nombre: 'RequiereSitio',           etiqueta: 'Requiere sitio',            tipo: 'bool' },
            { nombre: 'RequiereSubtipo',         etiqueta: 'Requiere subtipo',          tipo: 'bool' },
            { nombre: 'RequiereClasificacion',   etiqueta: 'Requiere clasificación',    tipo: 'bool' },
            { nombre: 'RequiereTamanio',         etiqueta: 'Requiere tamaño',           tipo: 'bool' },
            { nombre: 'RequiereCapacidad',       etiqueta: 'Requiere capacidad',        tipo: 'bool' },
            { nombre: 'RequiereVoltaje',         etiqueta: 'Requiere voltaje',          tipo: 'bool' },
            { nombre: 'RequiereUsuarioAsignado', etiqueta: 'Requiere usuario asignado', tipo: 'bool' },
            { nombre: 'RequierePrecio',          etiqueta: 'Requiere precio',           tipo: 'bool' },
            { nombre: 'RequiereEspecificaciones',etiqueta: 'Requiere especificaciones', tipo: 'bool' },
            { nombre: 'RequiereAccesorios',      etiqueta: 'Requiere accesorios',       tipo: 'bool' }
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
    },
    sitios: {
        titulo: 'Sitios',
        tituloSingular: 'sitio',
        pk: 'IdSitio',
        campos: [
            { nombre: 'Nombre',      etiqueta: 'Nombre',      tipo: 'text', requerido: true, max: 100 },
            { nombre: 'Descripcion', etiqueta: 'Descripción', tipo: 'text', max: 200 }
        ]
    },
    subtipos: {
        titulo: 'Subtipos',
        tituloSingular: 'subtipo',
        pk: 'IdSubtipo',
        campos: [
            { nombre: 'Grupo',       etiqueta: 'Grupo',       tipo: 'select', requerido: true,
              opciones: [{ valor: '', etiqueta: '— Seleccionar —' }, ...GRUPOS_SUBTIPO] },
            { nombre: 'Nombre',      etiqueta: 'Nombre',      tipo: 'text',   requerido: true, max: 100 },
            { nombre: 'Descripcion', etiqueta: 'Descripción', tipo: 'text',   max: 200 }
        ]
    },
    voltajes: {
        titulo: 'Voltajes',
        tituloSingular: 'voltaje',
        pk: 'IdVoltaje',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50 }
        ]
    },
    clasificaciones: {
        titulo: 'Clasificaciones',
        tituloSingular: 'clasificación',
        pk: 'IdClasificacion',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50 }
        ]
    },
    tamanios: {
        titulo: 'Tamaños',
        tituloSingular: 'tamaño',
        pk: 'IdTamanio',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50 }
        ]
    },
    capacidades: {
        titulo: 'Capacidades',
        tituloSingular: 'capacidad',
        pk: 'IdCapacidad',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50 }
        ]
    }
};

/* =========================================================
   ESTADO
   ========================================================= */
let catalogoActual = 'marcas';
let vistaActual    = 'activos';   // 'activos' | 'eliminados'
let registros      = [];
let modoEdicion    = false;
let idEditando     = null;
let guardando      = false;
let filtroBusqueda = '';

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabs             = document.getElementById('tabs-catalogos');
const tabsVista        = document.getElementById('tabs-vista');
const tablaHead        = document.getElementById('tabla-head');
const tablaBody        = document.getElementById('tabla-body');
const formulario       = document.getElementById('formulario');
const camposForm       = document.getElementById('campos-form');
const mensaje          = document.getElementById('mensaje');
const btnGuardar       = document.getElementById('btn-guardar');
const btnNuevo         = document.getElementById('btn-nuevo');
const btnNuevoTexto    = document.getElementById('btn-nuevo-texto');
const tituloCatalogo   = document.getElementById('titulo-catalogo');
const sinResultados    = document.getElementById('sin-resultados');
const sinResultadosTxt = document.getElementById('sin-resultados-texto');
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

function etiquetaSelect(campo, valor) {
    if (!campo.opciones) return valor ?? '';
    const op = campo.opciones.find(o => o.valor === valor);
    return op ? op.etiqueta : (valor ?? '');
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
   ACTUALIZAR UI SEGÚN CATÁLOGO / VISTA ACTIVA
   ========================================================= */
function actualizarUIDeCatalogo() {
    const cfg = CATALOGOS_FRONT[catalogoActual];

    if (tituloCatalogo) {
        const sufijo = (vistaActual === 'eliminados') ? ' · Eliminados' : '';
        tituloCatalogo.textContent = `Catálogos · ${cfg.titulo}${sufijo}`;
    }

    if (btnNuevoTexto) {
        btnNuevoTexto.textContent = `Nuevo ${cfg.tituloSingular}`;
    }

    // En vista eliminados, "Nuevo" se deshabilita
    const enEliminados = (vistaActual === 'eliminados');
    btnNuevo.disabled = enEliminados;
    btnNuevo.style.opacity = enEliminados ? '0.5' : '';
}

/* =========================================================
   TABS DE CATÁLOGO
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

    actualizarUIDeCatalogo();
    cargarCatalogo();
});

/* =========================================================
   TABS DE VISTA (Activos / Eliminados)
   ========================================================= */
tabsVista.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-vista');
    if (!btn || btn.classList.contains('activo')) return;

    tabsVista.querySelectorAll('.tab-vista').forEach(t => t.classList.remove('activo'));
    btn.classList.add('activo');

    vistaActual = btn.dataset.vista;

    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');

    actualizarUIDeCatalogo();
    cargarCatalogo();
});

/* =========================================================
   CARGAR CATÁLOGO
   ========================================================= */
async function cargarCatalogo() {
    try {
        const filtros = { soloEliminados: vistaActual === 'eliminados' };
        registros = await window.api.activoFijo.catalogos.listar(catalogoActual, filtros);
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
    headers.push('<th style="width:230px; text-align:right;">Acciones</th>');
    tablaHead.innerHTML = `<tr>${headers.join('')}</tr>`;

    // Filtro
    const listaFiltrada = registros.filter(r => {
        if (!filtroBusqueda) return true;
        const texto = cfg.campos
            .map(c => {
                if (c.tipo === 'select') return etiquetaSelect(c, r[c.nombre]);
                return String(r[c.nombre] ?? '');
            })
            .join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    tablaBody.innerHTML = '';

    if (listaFiltrada.length === 0) {
        sinResultados.classList.remove('oculto');
        if (sinResultadosTxt) {
            sinResultadosTxt.textContent = vistaActual === 'eliminados'
                ? `No hay ${cfg.titulo.toLowerCase()} dados de baja.`
                : `No se encontraron ${cfg.titulo.toLowerCase()} con ese criterio.`;
        }
        document.querySelector('.card-tabla').style.display = 'none';
        return;
    }

    sinResultados.classList.add('oculto');
    document.querySelector('.card-tabla').style.display = '';

    const esVistaEliminados = (vistaActual === 'eliminados');

    listaFiltrada.forEach(r => {
        const tr = document.createElement('tr');
        const celdas = cfg.campos.map(c => {
            const val = r[c.nombre];
            if (c.tipo === 'bool') {
                return `<td><span class="badge-boolean ${val ? 'si' : 'no'}">${val ? 'Sí' : 'No'}</span></td>`;
            }
            if (c.tipo === 'select') {
                return `<td><span class="badge-nombre">${escaparHTML(etiquetaSelect(c, val))}</span></td>`;
            }
            return `<td><span class="badge-nombre">${escaparHTML(val ?? '')}</span></td>`;
        });
        tr.innerHTML = celdas.join('') + `<td class="acciones-tabla"></td>`;

        const celda = tr.querySelector('.acciones-tabla');

        /* ---- Vista ELIMINADOS → Restaurar ---- */
        if (esVistaEliminados) {
            const btnRestaurar = document.createElement('button');
            btnRestaurar.type = 'button';
            btnRestaurar.className = 'exito';
            btnRestaurar.title = 'Restaurar registro';
            btnRestaurar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="1 4 1 10 7 10"></polyline>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg> Restaurar`;
            btnRestaurar.addEventListener('click', () => restaurarRegistro(r[cfg.pk]));
            celda.appendChild(btnRestaurar);
            tablaBody.appendChild(tr);
            return;
        }

        /* ---- Vista ACTIVOS → Editar + Dar de baja ---- */
        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'secundario';
        btnEditar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg> Editar`;
        btnEditar.addEventListener('click', () => abrirEdicion(r[cfg.pk]));
        celda.appendChild(btnEditar);

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'peligro';
        btnEliminar.title = 'Dar de baja';
        btnEliminar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg> Dar de baja`;
        btnEliminar.addEventListener('click', () => eliminarRegistro(r[cfg.pk]));
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
   CONSTRUIR CAMPOS DEL FORMULARIO
   ========================================================= */
function construirFormulario(datos = {}) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    camposForm.innerHTML = '';

    const camposNormales = [];
    const camposBool     = [];

    cfg.campos.forEach(c => {
        if (c.tipo === 'bool') camposBool.push(c);
        else camposNormales.push(c);
    });

    camposNormales.forEach(c => {
        const wrapper = document.createElement('div');
        const esFull = (c.tipo === 'select' || c.nombre === 'Descripcion');
        if (esFull) wrapper.classList.add('campo-full');

        if (c.tipo === 'select') {
            const opcionesHtml = (c.opciones || []).map(op => {
                const sel = String(datos[c.nombre] ?? '') === String(op.valor) ? 'selected' : '';
                return `<option value="${escaparHTML(op.valor)}" ${sel}>${escaparHTML(op.etiqueta)}</option>`;
            }).join('');

            wrapper.innerHTML = `
                <label for="campo-${c.nombre}">${escaparHTML(c.etiqueta)}${c.requerido ? ' *' : ''}</label>
                <select id="campo-${c.nombre}" ${c.requerido ? 'required' : ''}>
                    ${opcionesHtml}
                </select>`;
        } else {
            wrapper.innerHTML = `
                <label for="campo-${c.nombre}">${escaparHTML(c.etiqueta)}${c.requerido ? ' *' : ''}</label>
                <input type="text" id="campo-${c.nombre}" maxlength="${c.max || ''}"
                       value="${escaparHTML(datos[c.nombre] ?? '')}"
                       ${c.requerido ? 'required' : ''}>`;
        }
        camposForm.appendChild(wrapper);
    });

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
    if (vistaActual === 'eliminados') return;
    const cfg = CATALOGOS_FRONT[catalogoActual];
    modoEdicion = false;
    idEditando = null;
    modalTitulo.textContent = `Nuevo ${cfg.tituloSingular}`;
    construirFormulario();
    ocultarMensaje();
    abrirModal();
    const primerInput = camposForm.querySelector('input[type="text"], select');
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
    const primerInput = camposForm.querySelector('input[type="text"], select');
    if (primerInput) { primerInput.focus(); primerInput.select?.(); }
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
            datos[c.nombre] = val || null;
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
   ELIMINAR (Soft delete)
   ========================================================= */
async function eliminarRegistro(id) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    const r = registros.find(x => x[cfg.pk] === id);
    const nombre = r ? (r.Nombre || `#${id}`) : `#${id}`;

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: `¿Dar de baja ${cfg.tituloSingular}?`,
        html: `Se dará de baja <strong>${escaparHTML(nombre)}</strong>.<br>
               Podrás verlo y restaurarlo desde la pestaña <strong>Eliminados</strong>.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, dar de baja',
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
            toastExito(res.mensaje || 'Registro dado de baja');
        } else {
            toastError('No se pudo dar de baja', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al dar de baja', err.message);
    }
}

/* =========================================================
   RESTAURAR
   ========================================================= */
async function restaurarRegistro(id) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    const r = registros.find(x => x[cfg.pk] === id);
    const nombre = r ? (r.Nombre || `#${id}`) : `#${id}`;

    const confirmacion = await Swal.fire({
        icon: 'question',
        title: `¿Restaurar ${cfg.tituloSingular}?`,
        html: `El registro <strong>${escaparHTML(nombre)}</strong> volverá al listado activo.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, restaurar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.catalogos.restaurar(catalogoActual, id);
        if (res && res.ok) {
            await cargarCatalogo();
            toastExito(res.mensaje || 'Registro restaurado');
        } else {
            toastError('No se pudo restaurar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al restaurar', err.message);
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
    actualizarUIDeCatalogo();
    await cargarCatalogo();
})();