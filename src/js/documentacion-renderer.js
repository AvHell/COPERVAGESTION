/* =========================================================
   DOCUMENTACIÓN — Renderer (Tierra / Oliva)
   ---------------------------------------------------------
   Secciones dinámicas desde dbo.Secciones, tarjetas de
   documentos, subida múltiple con drag & drop, detalle con
   versiones y papelera.

   La capa de datos vive en src/js/db/documentos.js y el binario
   del archivo se guarda en la base de datos (VARBINARY(MAX)).
   ========================================================= */

const Swal = window.Swal;
const DOC = window.api.documentos;

const LIMITE_BYTES = 60 * 1024 * 1024;

/* =========================================================
   ESTADO
   ========================================================= */
const estado = {
    secciones: [],
    documentos: [],
    clientes: [],
    seccion: 'todas',
    papelera: false,
    busqueda: '',
    cliente: '',
    categoria: ''
};

let pendientes = [];        // archivos por subir: { archivo, titulo }
let docActual = null;       // documento abierto en el modal de detalle
let subiendo = false;

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const $ = id => document.getElementById(id);

const el = {
    secciones: $('doc-secciones'),
    seccionesLista: $('doc-secciones-lista'),
    btnSeccionActual: $('btn-seccion-actual'),
    seccionIcono: $('doc-seccion-icono'),
    seccionNombre: $('doc-seccion-nombre'),
    seccionTotal: $('doc-seccion-total'),
    busqueda: $('doc-busqueda'),
    limpiarBusqueda: $('doc-limpiar-busq'),
    menuSecciones: $('menu-secciones'),
    btnMenuSecciones: $('btn-menu-secciones'),
    menuSeccionesLista: $('menu-secciones-lista'),
    btnPapelera: $('btn-papelera'),
    btnSubir: $('btn-subir'),
    btnRecargar: $('btn-recargar'),
    titulo: $('doc-titulo'),
    subtitulo: $('doc-subtitulo'),
    filtroCliente: $('doc-filtro-cliente'),
    filtroCategoria: $('doc-filtro-categoria'),
    zonaSubida: $('zona-subida'),
    inputArchivo: $('doc-archivo'),
    vacio: $('doc-vacio'),
    vacioTitulo: $('doc-vacio-titulo'),
    vacioTexto: $('doc-vacio-texto'),
    grid: $('doc-grid'),
    categorias: $('doc-categorias'),

    // Modal de subida
    modalSubida: $('modal-subida'),
    subCerrar: $('modal-subida-cerrar'),
    subLista: $('sub-lista-archivos'),
    subContador: $('sub-contador'),
    subSeccion: $('sub-seccion'),
    subCliente: $('sub-cliente'),
    subCategoria: $('sub-categoria'),
    subEtiquetas: $('sub-etiquetas'),
    subDescripcion: $('sub-descripcion'),
    subMensaje: $('sub-mensaje'),
    subGuardar: $('sub-guardar'),

    // Modal de detalle
    modalDetalle: $('modal-detalle'),
    detCerrar: $('modal-detalle-cerrar'),
    detEncabezado: $('det-encabezado'),
    detInfo: $('det-info'),
    detTitulo: $('det-titulo'),
    detSeccion: $('det-seccion'),
    detCliente: $('det-cliente'),
    detCategoria: $('det-categoria'),
    detEtiquetas: $('det-etiquetas'),
    detDescripcion: $('det-descripcion'),
    detVersiones: $('det-versiones'),
    detMensaje: $('det-mensaje'),
    detAbrir: $('det-abrir'),
    detCopia: $('det-copia'),
    detNuevaVersion: $('det-nueva-version'),
    detArchivoVersion: $('det-archivo-version'),
    detGuardar: $('det-guardar')
};

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

function fecha(valor, conHora = false) {
    const ms = Number(valor);
    if (!ms || !Number.isFinite(ms)) return '—';
    const f = new Date(ms);
    if (Number.isNaN(f.getTime())) return '—';
    return (conHora ? FORMATO_FECHA_HORA : FORMATO_FECHA).format(f);
}

function peso(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function sinExtension(nombre) {
    return String(nombre || 'Documento').replace(/\.[^.]+$/, '') || 'Documento';
}

/** Devuelve la clase y la etiqueta del icono de la tarjeta según el archivo. */
function presentacionArchivo(doc) {
    const mime = String(doc?.TipoMime || '').toLowerCase();
    const ext = String(doc?.NombreOriginal || '').toLowerCase().match(/\.([a-z0-9]{1,12})$/)?.[1] || '';

    if (mime === 'application/pdf' || ext === 'pdf') return { clase: 'tipo-pdf', etiqueta: 'PDF' };
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
        return { clase: 'tipo-imagen', etiqueta: ext === 'svg' ? 'SVG' : 'IMG' };
    }
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') {
        return { clase: 'tipo-hoja', etiqueta: ext === 'csv' ? 'CSV' : 'XLS' };
    }
    if (['doc', 'docx', 'odt', 'rtf'].includes(ext) || mime.includes('word') || mime.includes('opendocument.text')) {
        return { clase: 'tipo-hoja', etiqueta: 'DOC' };
    }
    if (['ppt', 'pptx', 'odp'].includes(ext) || mime.includes('presentation')) {
        return { clase: 'tipo-hoja', etiqueta: 'PPT' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { clase: 'tipo-zip', etiqueta: 'ZIP' };
    if (['txt', 'md', 'log', 'json', 'xml', 'sql', 'js', 'drawio','py'].includes(ext) || mime.startsWith('text/')) {
        return { clase: 'tipo-texto', etiqueta: ext ? ext.slice(0, 3).toUpperCase() : 'TXT' };
    }
    if (ext) return { clase: '', etiqueta: ext.slice(0, 3).toUpperCase() };
    return { clase: '', etiqueta: 'DOC' };
}

function nombreSeccion(id) {
    return estado.secciones.find(s => String(s.Id) === String(id))?.Nombre || 'Sin sección';
}

function nombreCliente(codigo) {
    if (!codigo) return '';
    const encontrado = estado.clientes.find(c => String(c.Codigo).toUpperCase() === String(codigo).toUpperCase());
    return encontrado?.Nombre || String(codigo);
}

/* Código del cliente normalizado: es la clave con la que PermisosUI resuelve
   el color del catálogo (Clientes.ColorHex). */
function codigoCliente(codigo) {
    return String(codigo || '').trim().toUpperCase();
}

/** Comprueba un permiso del rol en sesión (si la capa de permisos no cargó, no bloquea). */
function permite(clave) {
    const ui = window.PermisosUI;
    if (!ui || typeof ui.puede !== 'function') return true;
    return ui.puede(clave);
}

/* =========================================================
   AVISOS (mismo lenguaje visual que Catálogos)
   ========================================================= */
function limpiarResiduosSwal() {
    document.querySelectorAll('body > .swal2-container').forEach(c => {
        if (!c.querySelector('.swal2-popup') && !c.classList.contains('swal2-backdrop-show')) c.remove();
    });
    document.querySelectorAll('body > [id^="swal2-"]').forEach(nodo => {
        if (!nodo.closest('.swal2-popup')) nodo.remove();
    });
}

function toastExito(titulo) {
    limpiarResiduosSwal();
    return Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: titulo,
        showConfirmButton: false,
        timer: 2400,
        timerProgressBar: true,
        customClass: { popup: 'cl-toast cl-toast-success' }
    });
}

function toastError(titulo) {
    limpiarResiduosSwal();
    return Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'error',
        title: titulo,
        showConfirmButton: false,
        timer: 3600,
        timerProgressBar: true,
        customClass: { popup: 'cl-toast cl-toast-error' }
    });
}

function alertaError(titulo, mensaje = '') {
    return Swal.fire({
        icon: 'error',
        title: titulo,
        html: mensaje ? `<p style="margin:0;">${escaparHTML(mensaje)}</p>` : undefined,
        confirmButtonText: 'Entendido'
    });
}

/* =========================================================
   MODALES PROPIOS (clase .oculto, igual que catalogos.css)
   ========================================================= */
function algunModalAbierto() {
    return [el.modalSubida, el.modalDetalle].some(m => m && !m.classList.contains('oculto'));
}

function abrirModal(modal) {
    if (!modal) return;
    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';
    const enfocable = modal.querySelector('input:not([hidden]), select, textarea, button');
    if (enfocable) setTimeout(() => enfocable.focus(), 60);
}

function cerrarModal(modal) {
    if (!modal) return;
    modal.classList.add('oculto');
    if (!algunModalAbierto()) document.body.style.overflow = '';
}

function cerrarTodosLosModales() {
    [el.modalSubida, el.modalDetalle].forEach(cerrarModal);
    ocultarMensaje(el.subMensaje);
    ocultarMensaje(el.detMensaje);
}

function mostrarMensaje(nodo, texto, tipo = 'error') {
    if (!nodo) return;
    nodo.textContent = texto;
    nodo.className = 'alert ' + tipo;
    nodo.classList.remove('oculto');
}

function ocultarMensaje(nodo) {
    if (!nodo) return;
    nodo.classList.add('oculto');
    nodo.textContent = '';
}

/* =========================================================
   CARGA DE DATOS
   ========================================================= */
async function cargarSecciones() {
    try {
        const lista = await DOC.secciones.listar();
        if (!Array.isArray(lista)) {
            estado.secciones = [];
            if (lista && lista.mensaje) toastError(lista.mensaje);
            return;
        }
        estado.secciones = lista;
    } catch (err) {
        estado.secciones = [];
        console.error('[Documentación] No se pudieron cargar las secciones:', err);
        toastError('No se pudieron cargar las secciones');
    }
}

async function cargarClientes() {
    try {
        const lista = await window.api.clientes.listar();
        estado.clientes = Array.isArray(lista) ? lista : [];
    } catch (err) {
        estado.clientes = [];
        console.warn('[Documentación] No se pudieron cargar los clientes:', err);
    }
}

async function cargarDocumentos() {
    try {
        const lista = await DOC.listar({ papelera: estado.papelera });
        if (!Array.isArray(lista)) {
            estado.documentos = [];
            if (lista && lista.mensaje) alertaError('No se pudieron cargar los documentos', lista.mensaje);
            return;
        }
        estado.documentos = lista;
    } catch (err) {
        estado.documentos = [];
        alertaError('No se pudieron cargar los documentos', err.message);
    }
}

/* =========================================================
   SELECTS
   ========================================================= */
function llenarSelectClientes(select, valorActual, etiquetaVacia = 'Todos') {
    if (!select) return;

    const opciones = estado.clientes
        .map(c => `<option value="${escaparHTML(c.Codigo)}">${escaparHTML(c.Codigo)} · ${escaparHTML(c.Nombre)}</option>`);

    /* Si el cliente guardado ya no está en el catálogo, se conserva como opción
       para no borrarlo sin querer al guardar el documento. */
    const existe = !valorActual || estado.clientes.some(
        c => String(c.Codigo).toUpperCase() === String(valorActual).toUpperCase()
    );
    if (!existe) {
        opciones.unshift(`<option value="${escaparHTML(valorActual)}">${escaparHTML(valorActual)} · (fuera del catálogo)</option>`);
    }

    select.innerHTML = `<option value="">${escaparHTML(etiquetaVacia)}</option>` + opciones.join('');
    select.value = valorActual || '';
}

/**
 * Llena un <select> de secciones.
 * En la subida sólo se ofrecen las activas; en el detalle se incluye la
 * sección actual aunque esté inactiva, para no cambiarla sin querer al guardar.
 */
function llenarSelectSecciones(select, valorActual, soloActivas = true) {
    if (!select) return;
    const lista = soloActivas
        ? estado.secciones.filter(s => s.Activa === true || Number(s.Activa) !== 0)
        : estado.secciones;
    select.innerHTML = lista
        .map(s => `<option value="${escaparHTML(s.Id)}">${escaparHTML(s.Nombre)}</option>`)
        .join('');
    if (valorActual) select.value = valorActual;
}

function llenarDatalistCategorias() {
    if (!el.categorias) return;
    const categorias = [...new Set(
        estado.documentos.map(d => String(d.Categoria || '').trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es'));
    el.categorias.innerHTML = categorias
        .map(c => `<option value="${escaparHTML(c)}"></option>`)
        .join('');
}

/** Opciones del filtro de categorías (incluye el ítem de categorías del datalist). */
function actualizarFiltroCategorias() {
    if (!el.filtroCategoria) return;
    const actual = el.filtroCategoria.value;
    const categorias = [...new Set(
        estado.documentos.map(d => String(d.Categoria || '').trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es'));

    el.filtroCategoria.innerHTML = '<option value="">Todas</option>' + categorias
        .map(c => `<option value="${escaparHTML(c)}">${escaparHTML(c)}</option>`)
        .join('');

    el.filtroCategoria.value = categorias.includes(actual) ? actual : '';
    if (!categorias.includes(actual)) estado.categoria = '';
}

/* =========================================================
   RENDER — MENÚ DE SECCIONES
   ========================================================= */
/** Ítems del menú de secciones: "Todas" + cada sección activa con su total. */
function itemsSeccion() {
    const activas = estado.secciones.filter(s => s.Activa === true || Number(s.Activa) !== 0);

    return [{
        id: 'todas',
        nombre: 'Todas',
        icono: '▦',
        total: estado.documentos.length
    }, ...activas.map(s => ({
        id: String(s.Id),
        nombre: s.Nombre,
        icono: s.Icono || '▪',
        total: estado.documentos.filter(d => String(d.Seccion) === String(s.Id)).length
    }))];
}

function renderizarChips() {
    if (!el.secciones) return;

    const items = itemsSeccion();
    const activo = items.find(item => item.id === estado.seccion) || items[0];

    // Botón que muestra la sección vigente
    if (el.seccionIcono) el.seccionIcono.textContent = activo.icono;
    if (el.seccionNombre) el.seccionNombre.textContent = activo.nombre;
    if (el.seccionTotal) el.seccionTotal.textContent = activo.total;

    if (!el.seccionesLista) return;

    const html = items.map(item => `
        <button type="button" class="doc-menu-item${item.id === activo.id ? ' activo' : ''}"
                role="menuitemradio" aria-checked="${item.id === activo.id}"
                data-seccion="${escaparHTML(item.id)}">
            <span class="doc-chip-icono">${escaparHTML(item.icono)}</span>
            <span class="doc-menu-item-nombre">${escaparHTML(item.nombre)}</span>
            <span class="doc-chip-total">${item.total}</span>
        </button>`).join('');

    // Refresco en vivo: se repinta sin tocar el DOM cuando no cambió nada
    // (el menú puede estar abierto y no queremos cerrarlo).
    if (window.Vivo) window.Vivo.reemplazar(el.seccionesLista, html);
    else el.seccionesLista.innerHTML = html;
}

/** Abre o cierra el menú desplegable de secciones. */
function alternarMenuFiltro(forzar) {
    const lista = el.seccionesLista;
    const boton = el.btnSeccionActual;
    if (!lista || !boton) return;

    const abrir = typeof forzar === 'boolean' ? forzar : lista.classList.contains('oculto');
    lista.classList.toggle('oculto', !abrir);
    boton.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

/* =========================================================
   RENDER — TARJETAS
   ========================================================= */
function documentosVisibles() {
    const q = estado.busqueda;
    return estado.documentos.filter(doc => {
        if (estado.seccion !== 'todas' && String(doc.Seccion) !== String(estado.seccion)) return false;
        if (estado.cliente && String(doc.Cliente || '').toUpperCase() !== estado.cliente.toUpperCase()) return false;
        if (estado.categoria && String(doc.Categoria || '') !== estado.categoria) return false;
        if (!q) return true;

        const etiquetas = (doc.Etiquetas || []).map(e => e.nombre).join(' ');
        const texto = [
            doc.Titulo, doc.NombreOriginal, doc.Categoria, doc.Descripcion,
            doc.Cliente, nombreCliente(doc.Cliente), etiquetas, nombreSeccion(doc.Seccion)
        ].filter(Boolean).join(' ').toLowerCase();
        return texto.includes(q);
    });
}

function botonAccion(accion, clase, permiso, texto, icono, id) {
    return `
        <button type="button" class="${clase}" data-accion="${accion}" data-id="${escaparHTML(id)}"
                data-permiso="${permiso}">
            ${icono}
            <span>${texto}</span>
        </button>`;
}

function iconoAbrir() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 3h7v7M21 3l-9 9"/>
                <path d="M19 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/>
            </svg>`;
}

function iconoEditar() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14h16v-7"/>
                <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>
            </svg>`;
}

function iconoPapelera() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
            </svg>`;
}

function iconoRestaurar() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 3-6.7"/>
                <path d="M3 3v6h6"/>
            </svg>`;
}

function tarjeta(doc) {
    const icono = presentacionArchivo(doc);
    const seccion = nombreSeccion(doc.Seccion);

    const etiquetas = [];
    if (doc.Cliente) {
        /* data-color + data-color-kind: PermisosUI pinta la píldora con el
           ColorHex del catálogo de Clientes, así que el color sale de la BD y
           se actualiza en vivo cuando se cambia en Catálogos. */
        const codigo = codigoCliente(doc.Cliente);
        etiquetas.push(`<span class="doc-pill cliente" data-color="${escaparHTML(codigo)}" data-color-kind="client" title="${escaparHTML(doc.Cliente)}">${escaparHTML(nombreCliente(doc.Cliente))}</span>`);
    }
    if (doc.Categoria) etiquetas.push(`<span class="doc-pill">${escaparHTML(doc.Categoria)}</span>`);
    if (Number(doc.VersionActual) > 1) etiquetas.push(`<span class="doc-pill version">v${Number(doc.VersionActual)}</span>`);
    (doc.Etiquetas || []).forEach(et => {
        etiquetas.push(`<span class="doc-pill">#${escaparHTML(et.nombre)}</span>`);
    });

    const acciones = estado.papelera
        ? botonAccion('restaurar', 'secundario', 'documentos:eliminar', 'Restaurar', iconoRestaurar(), doc.Id)
        + botonAccion('eliminar', 'peligro', 'documentos:eliminar', 'Eliminar', iconoPapelera(), doc.Id)
        : botonAccion('abrir', 'btn-archivo', 'documentos:descargar', 'Abrir', iconoAbrir(), doc.Id)
        + botonAccion('detalle', 'secundario', 'documentos:editar', 'Detalle', iconoEditar(), doc.Id)
        + botonAccion('papelera', 'peligro', 'documentos:eliminar', 'Papelera', iconoPapelera(), doc.Id);

    return `
        <article class="tarjeta-doc" data-id="${escaparHTML(doc.Id)}">
            <div class="tarjeta-cabecera">
                <div class="tarjeta-icono ${icono.clase}">${escaparHTML(icono.etiqueta)}</div>
                <div style="min-width:0;flex:1;">
                    <div class="tarjeta-titulo" title="${escaparHTML(doc.Titulo)}">${escaparHTML(doc.Titulo)}</div>
                    <div class="tarjeta-archivo" title="${escaparHTML(doc.NombreOriginal)}">${escaparHTML(doc.NombreOriginal)}</div>
                </div>
            </div>

            ${etiquetas.length ? `<div class="tarjeta-etiquetas">${etiquetas.join('')}</div>` : ''}

            <div class="tarjeta-datos">
                <span>${escaparHTML(peso(doc.TamanoBytes))}</span>
                <span>${escaparHTML(fecha(doc.ActualizadoEn))}</span>
                <span>${escaparHTML(seccion)}</span>
            </div>

            <div class="tarjeta-acciones">${acciones}</div>
        </article>`;
}

function renderizar() {
    renderizarChips();
    actualizarFiltroCategorias();
    llenarDatalistCategorias();

    const visibles = documentosVisibles();
    // Refresco en vivo: si el HTML es idéntico no se toca el DOM y, si cambia,
    // se conserva el desplazamiento de la cuadrícula (no salta al inicio).
    if (el.grid) {
        const html = visibles.map(tarjeta).join('');
        if (window.Vivo) window.Vivo.reemplazar(el.grid, html);
        else el.grid.innerHTML = html;
    }

    if (el.vacio) {
        const sinResultados = visibles.length === 0;
        el.vacio.classList.toggle('oculto', !sinResultados);
        if (sinResultados) {
            const filtrando = !!estado.busqueda || !!estado.cliente || !!estado.categoria;
            if (estado.papelera) {
                el.vacioTitulo.textContent = 'Papelera vacía';
                el.vacioTexto.textContent = 'Los documentos que envíes aquí podrás restaurarlos o eliminarlos definitivamente.';
            } else if (filtrando) {
                el.vacioTitulo.textContent = 'Sin coincidencias';
                el.vacioTexto.textContent = 'Ajusta el buscador o los filtros para ver otros documentos.';
            } else {
                el.vacioTitulo.textContent = 'Sin documentos';
                el.vacioTexto.textContent = 'Sube el primer archivo de esta sección con el botón o arrastrándolo aquí.';
            }
        }
    }

    const seccion = estado.seccion === 'todas' ? null : estado.secciones.find(s => String(s.Id) === String(estado.seccion));
    if (el.titulo) el.titulo.textContent = estado.papelera ? 'Papelera' : (seccion?.Nombre || 'Documentos');
    if (el.subtitulo) {
        el.subtitulo.textContent = estado.papelera
            ? 'Restaura o elimina definitivamente los documentos'
            : `${visibles.length} documento${visibles.length === 1 ? '' : 's'} · Diagramas, manuales y procedimientos`;
    }

    // Estado visual de la papelera y la zona de subida
    if (el.btnPapelera) {
        el.btnPapelera.classList.toggle('activo', estado.papelera);
        el.btnPapelera.setAttribute('aria-pressed', String(estado.papelera));
    }
    if (el.zonaSubida) el.zonaSubida.classList.toggle('oculto', estado.papelera);

    // Permisos y colores de catálogo sobre las tarjetas recién creadas
    if (window.PermisosUI && typeof window.PermisosUI.aplicar === 'function' && el.grid) {
        window.PermisosUI.aplicar(el.grid);
        /* El MutationObserver ya repinta las tarjetas nuevas, pero si el color
           de un cliente se cambia en Catálogos y esta página se refresca en
           vivo, esto garantiza que la píldora tome el ColorHex actual. */
        window.PermisosUI.aplicarColores?.(el.grid);
    }
}

/* =========================================================
   MODAL DE SUBIDA
   ========================================================= */
function renderPendientes() {
    if (!el.subLista) return;

    if (!pendientes.length) {
        el.subLista.innerHTML = '<p style="margin:0;color:var(--gray-500);font-size:.82rem;">No hay archivos seleccionados.</p>';
    } else {
        el.subLista.innerHTML = pendientes.map((item, indice) => {
            const archivo = item.archivo;
            const excede = archivo.size > LIMITE_BYTES;
            return `
                <div class="doc-archivo-item" data-indice="${indice}">
                    <span class="doc-archivo-nombre" title="${escaparHTML(archivo.name)}">${escaparHTML(archivo.name)}</span>
                    <input type="text" value="${escaparHTML(item.titulo)}" maxlength="200"
                           data-titulo="${indice}" aria-label="Título de ${escaparHTML(archivo.name)}">
                    <span class="doc-archivo-peso"${excede ? ' style="color:var(--rojo-text);font-weight:700;"' : ''}>
                        ${escaparHTML(peso(archivo.size))}
                    </span>
                    <button type="button" class="doc-archivo-quitar" data-quitar="${indice}" aria-label="Quitar archivo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>`;
        }).join('');
    }

    if (el.subContador) {
        el.subContador.textContent = `${pendientes.length} archivo${pendientes.length === 1 ? '' : 's'}`;
    }
}

function abrirSubida(archivos) {
    const lista = [...(archivos || [])];
    if (!lista.length) return;

    if (!estado.secciones.length) {
        alertaError('No hay secciones disponibles', 'Crea primero una sección para poder clasificar los documentos.');
        return;
    }

    pendientes = lista.map(archivo => ({ archivo, titulo: sinExtension(archivo.name) }));
    renderPendientes();

    const activas = estado.secciones.filter(s => s.Activa === true || Number(s.Activa) !== 0);
    const seccionSugerida = estado.seccion !== 'todas' && activas.some(s => String(s.Id) === String(estado.seccion))
        ? estado.seccion
        : (activas[0]?.Id || '');

    llenarSelectSecciones(el.subSeccion, seccionSugerida);
    llenarSelectClientes(el.subCliente, estado.cliente, 'Sin cliente');
    if (el.subCategoria) el.subCategoria.value = estado.categoria || '';
    if (el.subEtiquetas) el.subEtiquetas.value = '';
    if (el.subDescripcion) el.subDescripcion.value = '';
    ocultarMensaje(el.subMensaje);

    abrirModal(el.modalSubida);
}

function setSubiendo(valor) {
    subiendo = valor;
    if (!el.subGuardar) return;
    el.subGuardar.disabled = valor;
    const texto = el.subGuardar.querySelector('.btn-text');
    const spinner = el.subGuardar.querySelector('.btn-spinner');
    if (texto) texto.textContent = valor ? 'Subiendo...' : 'Subir';
    if (spinner) spinner.classList.toggle('oculto', !valor);
}

async function ejecutarSubida() {
    if (subiendo) return;
    if (!pendientes.length) {
        mostrarMensaje(el.subMensaje, 'Selecciona al menos un archivo.');
        return;
    }

    const seccion = el.subSeccion?.value || '';
    if (!seccion) {
        mostrarMensaje(el.subMensaje, 'Selecciona una sección.');
        return;
    }

    // Recoge los títulos editados en la lista
    el.subLista?.querySelectorAll('input[data-titulo]').forEach(input => {
        const indice = Number(input.dataset.titulo);
        if (pendientes[indice]) pendientes[indice].titulo = input.value.trim() || sinExtension(pendientes[indice].archivo.name);
    });

    const comunes = {
        seccion,
        cliente: el.subCliente?.value || null,
        categoria: el.subCategoria?.value.trim() || null,
        descripcion: el.subDescripcion?.value.trim() || null,
        etiquetas: el.subEtiquetas?.value.trim() || null
    };

    setSubiendo(true);
    ocultarMensaje(el.subMensaje);

    const errores = [];
    let subidos = 0;

    for (let indice = 0; indice < pendientes.length; indice++) {
        const item = pendientes[indice];
        const archivo = item.archivo;

        if (archivo.size > LIMITE_BYTES) {
            errores.push(`${archivo.name}: supera los 60 MB.`);
            continue;
        }

        const texto = el.subGuardar?.querySelector('.btn-text');
        if (texto) texto.textContent = `Subiendo ${indice + 1}/${pendientes.length}...`;

        try {
            const datos = await archivo.arrayBuffer();
            const resultado = await DOC.subir({
                ...comunes,
                titulo: item.titulo,
                archivo: { nombre: archivo.name, mime: archivo.type, datos }
            });

            if (resultado?.ok === false) errores.push(`${archivo.name}: ${resultado.mensaje || 'error desconocido'}`);
            else subidos++;
        } catch (err) {
            errores.push(`${archivo.name}: ${err.message}`);
        }
    }

    setSubiendo(false);

    if (errores.length) {
        mostrarMensaje(el.subMensaje, errores.join(' · '));
    }

    if (subidos > 0) {
        pendientes = [];
        renderPendientes();
        cerrarModal(el.modalSubida);
        await recargar();
        toastExito(`${subidos} documento${subidos === 1 ? '' : 's'} subido${subidos === 1 ? '' : 's'}`);
    }
}

/* =========================================================
   MODAL DE DETALLE
   ========================================================= */
function renderInfoDocumento(doc) {
    if (!el.detInfo) return;
    const campos = [
        ['Archivo', doc.NombreOriginal],
        ['Tamaño', peso(doc.TamanoBytes)],
        ['Tipo', doc.TipoMime || '—'],
        ['Versión', `v${Number(doc.VersionActual) || 1}`],
        ['Creado', fecha(doc.CreadoEn, true)],
        ['Actualizado', fecha(doc.ActualizadoEn, true)],
        ['Hash', doc.Hash ? String(doc.Hash).slice(0, 16) + '…' : '—']
    ];
    el.detInfo.innerHTML = campos.map(([etiqueta, valor]) => `
        <div>
            <dt>${escaparHTML(etiqueta)}</dt>
            <dd title="${escaparHTML(valor)}">${escaparHTML(valor)}</dd>
        </div>`).join('');
}

async function cargarVersiones(id) {
    if (!el.detVersiones) return;
    el.detVersiones.innerHTML = '<p style="margin:0;color:var(--gray-500);font-size:.8rem;">Cargando versiones...</p>';

    let versiones = [];
    try {
        const lista = await DOC.versiones(id);
        versiones = Array.isArray(lista) ? lista : [];
    } catch (err) {
        el.detVersiones.innerHTML = `<p style="margin:0;color:var(--rojo-text);font-size:.8rem;">${escaparHTML(err.message)}</p>`;
        return;
    }

    const actual = Number(docActual?.VersionActual) || 1;
    const filas = [];

    // La versión vigente siempre se muestra primero, aunque no exista fila histórica
    filas.push({
        NumeroVersion: actual,
        NombreOriginal: docActual?.NombreOriginal || '',
        NombreGuardado: docActual?.NombreGuardado || '',
        CreadoEn: docActual?.ActualizadoEn,
        actual: true
    });

    versiones.forEach(v => {
        if (Number(v.NumeroVersion) === actual) return;
        filas.push({ ...v, actual: false });
    });

    el.detVersiones.innerHTML = filas.map(v => `
        <div class="doc-version-item${v.actual ? ' actual' : ''}">
            <span class="doc-version-numero">v${Number(v.NumeroVersion) || 1}</span>
            <span class="doc-version-nombre" title="${escaparHTML(v.NombreOriginal)}">${escaparHTML(v.NombreOriginal)}</span>
            <span class="doc-version-fecha">${escaparHTML(fecha(v.CreadoEn))}</span>
            <button type="button" class="secundario" data-accion="version-abrir"
                    data-archivo="${escaparHTML(v.NombreGuardado)}"
                    data-nombre="${escaparHTML(v.NombreOriginal)}">
                ${iconoAbrir()}
                <span>Abrir</span>
            </button>
            <button type="button" class="secundario" data-accion="version-copia"
                    data-archivo="${escaparHTML(v.NombreGuardado)}"
                    data-nombre="${escaparHTML(v.NombreOriginal)}">
                <span>Copia</span>
            </button>
        </div>`).join('');
}

async function abrirDetalle(id) {
    let doc = null;
    try {
        doc = await DOC.obtener(id);
    } catch (err) {
        alertaError('No se pudo abrir el documento', err.message);
        return;
    }

    if (!doc || doc.ok === false) {
        alertaError('No se pudo abrir el documento', doc?.mensaje || 'El documento ya no existe.');
        return;
    }

    docActual = doc;

    if (el.detEncabezado) el.detEncabezado.textContent = doc.Titulo || 'Detalle del documento';
    renderInfoDocumento(doc);

    if (el.detTitulo) el.detTitulo.value = doc.Titulo || '';
    llenarSelectSecciones(el.detSeccion, doc.Seccion, false);
    llenarSelectClientes(el.detCliente, doc.Cliente || '', 'Sin cliente');
    if (el.detCategoria) el.detCategoria.value = doc.Categoria || '';
    if (el.detEtiquetas) el.detEtiquetas.value = (doc.Etiquetas || []).map(e => e.nombre).join(', ');
    if (el.detDescripcion) el.detDescripcion.value = doc.Descripcion || '';

    ocultarMensaje(el.detMensaje);
    await cargarVersiones(id);
    abrirModal(el.modalDetalle);
}

function setGuardandoDetalle(valor) {
    if (!el.detGuardar) return;
    el.detGuardar.disabled = valor;
    const texto = el.detGuardar.querySelector('.btn-text');
    const spinner = el.detGuardar.querySelector('.btn-spinner');
    if (texto) texto.textContent = valor ? 'Guardando...' : 'Guardar cambios';
    if (spinner) spinner.classList.toggle('oculto', !valor);
}

async function guardarDetalle() {
    if (!docActual) return;

    const titulo = el.detTitulo?.value.trim() || '';
    const seccion = el.detSeccion?.value || '';
    if (!titulo) {
        mostrarMensaje(el.detMensaje, 'Escribe un título para el documento.');
        return;
    }
    if (!seccion) {
        mostrarMensaje(el.detMensaje, 'Selecciona una sección.');
        return;
    }

    setGuardandoDetalle(true);
    ocultarMensaje(el.detMensaje);

    try {
        const resultado = await DOC.actualizar(docActual.Id, {
            titulo,
            seccion,
            cliente: el.detCliente?.value || null,
            categoria: el.detCategoria?.value.trim() || null,
            descripcion: el.detDescripcion?.value.trim() || null,
            etiquetas: el.detEtiquetas?.value.trim() || null
        });

        if (resultado?.ok === false) {
            mostrarMensaje(el.detMensaje, resultado.mensaje || 'No se pudieron guardar los cambios.');
            return;
        }

        cerrarModal(el.modalDetalle);
        await recargar();
        toastExito('Documento actualizado');
    } catch (err) {
        mostrarMensaje(el.detMensaje, err.message);
    } finally {
        setGuardandoDetalle(false);
    }
}

async function agregarVersionDesdeArchivo(archivo) {
    if (!docActual || !archivo) return;

    if (archivo.size > LIMITE_BYTES) {
        mostrarMensaje(el.detMensaje, 'El archivo supera el límite de 60 MB.');
        return;
    }

    ocultarMensaje(el.detMensaje);
    const boton = el.detNuevaVersion;
    if (boton) boton.disabled = true;

    try {
        const datos = await archivo.arrayBuffer();
        const resultado = await DOC.agregarVersion(docActual.Id, {
            nombre: archivo.name,
            mime: archivo.type,
            datos
        });

        if (resultado?.ok === false) {
            mostrarMensaje(el.detMensaje, resultado.mensaje || 'No se pudo registrar la versión.');
            return;
        }

        await recargar();
        const actualizado = await DOC.obtener(docActual.Id);
        if (actualizado && actualizado.ok !== false) {
            docActual = actualizado;
            if (el.detEncabezado) el.detEncabezado.textContent = actualizado.Titulo || 'Detalle del documento';
            renderInfoDocumento(actualizado);
            await cargarVersiones(actualizado.Id);
        }
        toastExito(resultado.mensaje || 'Versión registrada');
    } catch (err) {
        mostrarMensaje(el.detMensaje, err.message);
    } finally {
        if (boton) boton.disabled = false;
        if (el.detArchivoVersion) el.detArchivoVersion.value = '';
    }
}

/* =========================================================
   ACCIONES SOBRE DOCUMENTOS
   ========================================================= */
async function abrirArchivo(nombreGuardado) {
    if (!permite('documentos:descargar')) return toastError('No tienes permiso para abrir archivos.');
    try {
        const resultado = await DOC.abrir(nombreGuardado);
        if (resultado?.ok === false) toastError(resultado.mensaje || 'No se pudo abrir el archivo.');
    } catch (err) {
        toastError(err.message);
    }
}

async function guardarCopia(nombreGuardado, nombreSugerido) {
    if (!permite('documentos:descargar')) return toastError('No tienes permiso para descargar archivos.');
    try {
        const resultado = await DOC.guardarComo(nombreGuardado, nombreSugerido);
        if (resultado?.ok === false) {
            if (resultado.mensaje !== 'Cancelado') toastError(resultado.mensaje || 'No se pudo guardar la copia.');
            return;
        }
        toastExito('Copia guardada correctamente');
    } catch (err) {
        toastError(err.message);
    }
}

async function moverAPapelera(id) {
    const documento = estado.documentos.find(d => String(d.Id) === String(id));
    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Mover a la papelera?',
        html: `<p style="margin:0;">El documento <b>${escaparHTML(documento?.Titulo || '')}</b> se moverá a la papelera. Podrás restaurarlo después.</p>`,
        showCancelButton: true,
        confirmButtonText: 'Mover a papelera',
        cancelButtonText: 'Cancelar'
    });
    if (!confirmacion.isConfirmed) return;

    try {
        const resultado = await DOC.papelera(id);
        if (resultado?.ok === false) return toastError(resultado.mensaje || 'No se pudo mover a la papelera.');
        await recargar();
        toastExito('Documento movido a la papelera');
    } catch (err) {
        toastError(err.message);
    }
}

async function restaurar(id) {
    try {
        const resultado = await DOC.restaurar(id);
        if (resultado?.ok === false) return toastError(resultado.mensaje || 'No se pudo restaurar el documento.');
        await recargar();
        toastExito('Documento restaurado');
    } catch (err) {
        toastError(err.message);
    }
}

async function eliminarDefinitivo(id) {
    const documento = estado.documentos.find(d => String(d.Id) === String(id));
    const confirmacion = await Swal.fire({
        icon: 'error',
        title: '¿Eliminar definitivamente?',
        html: `<p style="margin:0;">El documento <b>${escaparHTML(documento?.Titulo || '')}</b> y todas sus versiones se borrarán de la base de datos. Esta acción no se puede deshacer.</p>`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!confirmacion.isConfirmed) return;

    try {
        const resultado = await DOC.eliminar(id);
        if (resultado?.ok === false) return toastError(resultado.mensaje || 'No se pudo eliminar el documento.');
        await recargar();
        toastExito('Documento eliminado definitivamente');
    } catch (err) {
        toastError(err.message);
    }
}

/* =========================================================
   GESTIÓN DE SECCIONES
   ========================================================= */
const ICONOS_SECCION = ['▦', '▤', '▥', '▧', '▨', '▩', '▪', '◈', '◊', '◇', '▣', '▢'];

async function formularioSeccion(seccion = null) {
    const esEdicion = !!seccion;
    const iconos = ICONOS_SECCION
        .map(ic => `<option value="${ic}"${(seccion?.Icono || '▦') === ic ? ' selected' : ''}>${ic}</option>`)
        .join('');

    const respuesta = await Swal.fire({
        title: esEdicion ? 'Editar sección' : 'Nueva sección',
        html: `
            <div class="field" style="text-align:left;margin-bottom:14px;">
                <label for="sec-nombre">Nombre <span class="req">*</span></label>
                <input type="text" id="sec-nombre" maxlength="100" placeholder="Ej. Diagramas de red"
                       value="${escaparHTML(seccion?.Nombre || '')}">
            </div>
            <div class="field" style="text-align:left;">
                <label for="sec-icono">Icono</label>
                <select id="sec-icono">${iconos}</select>
            </div>`,
        showCancelButton: true,
        confirmButtonText: esEdicion ? 'Guardar' : 'Crear',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const nombre = document.getElementById('sec-nombre')?.value.trim() || '';
            if (!nombre) {
                Swal.showValidationMessage('Escribe un nombre para la sección.');
                return false;
            }
            return { nombre, icono: document.getElementById('sec-icono')?.value || '▦' };
        }
    });

    if (!respuesta.isConfirmed) return false;

    try {
        const resultado = esEdicion
            ? await DOC.secciones.actualizar(seccion.Id, {
                nombre: respuesta.value.nombre,
                icono: respuesta.value.icono,
                orden: Number(seccion.Orden) || 99,
                activa: seccion.Activa === true || Number(seccion.Activa) !== 0
            })
            : await DOC.secciones.crear({
                nombre: respuesta.value.nombre,
                icono: respuesta.value.icono,
                orden: estado.secciones.length + 1
            });

        if (resultado?.ok === false) {
            alertaError('No se pudo guardar la sección', resultado.mensaje || '');
            return false;
        }

        await cargarSecciones();
        renderizar();
        toastExito(resultado.mensaje || 'Sección guardada');
        return true;
    } catch (err) {
        alertaError('No se pudo guardar la sección', err.message);
        return false;
    }
}

/**
 * Edita la sección seleccionada en los chips. Si no hay una sección
 * concreta activa (vista "Todas"), abre el gestor para elegir cuál.
 */
async function editarSeccionActiva() {
    if (!permite('documentos:secciones:gestionar')) {
        return toastError('No tienes permiso para gestionar secciones.');
    }

    const activa = seccionActiva();
    if (activa) {
        await formularioSeccion(activa);
        return;
    }

    await gestionarSecciones();
}

/* ---------- Menú desplegable de secciones ---------- */

/**
 * Abre o cierra el menú de secciones. El menú está separado de las
 * acciones de documentos para no mezclar gestión de secciones con
 * subida, papelera, etc.
 */
function alternarMenuSecciones(forzar) {
    const lista = el.menuSeccionesLista;
    const boton = el.btnMenuSecciones;
    if (!lista || !boton) return;

    const abrir = typeof forzar === 'boolean' ? forzar : lista.classList.contains('oculto');
    lista.classList.toggle('oculto', !abrir);
    boton.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

/** Sección seleccionada en los chips, o null si la vista es "Todas". */
function seccionActiva() {
    return estado.secciones.find(s => String(s.Id) === String(estado.seccion)) || null;
}

/** Elimina una sección (con confirmación previa). Devuelve true si se eliminó. */
async function eliminarSeccion(seccion) {
    if (!seccion) return false;

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar sección?',
        html: `<p style="margin:0;">Se eliminará <b>${escaparHTML(seccion.Nombre)}</b>. Sólo es posible si ya no tiene documentos.</p>`,
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!confirmacion.isConfirmed) return false;

    try {
        const resultado = await DOC.secciones.eliminar(seccion.Id);
        if (resultado?.ok === false) {
            alertaError('No se pudo eliminar la sección', resultado.mensaje || '');
            return false;
        }
        if (String(estado.seccion) === String(seccion.Id)) estado.seccion = 'todas';
        await cargarSecciones();
        renderizar();
        toastExito(resultado.mensaje || 'Sección eliminada');
        return true;
    } catch (err) {
        alertaError('No se pudo eliminar la sección', err.message);
        return false;
    }
}

/** Elimina la sección seleccionada en los chips. */
async function eliminarSeccionActiva() {
    if (!permite('documentos:secciones:gestionar')) {
        return toastError('No tienes permiso para gestionar secciones.');
    }

    const activa = seccionActiva();
    if (!activa) return toastError('Selecciona una sección en el menú para poder eliminarla.');

    await eliminarSeccion(activa);
}

async function gestionarSecciones() {
    const activas = estado.secciones.filter(s => s.Activa === true || Number(s.Activa) !== 0);

    const html = activas.length
        ? `<div style="display:flex;flex-direction:column;gap:8px;text-align:left;max-height:320px;overflow:auto;">
            ${activas.map(s => `
                <div class="doc-archivo-item" data-sec="${escaparHTML(s.Id)}">
                    <span style="font-size:1.05rem;color:var(--tierra-oliva);">${escaparHTML(s.Icono || '▪')}</span>
                    <span class="doc-archivo-nombre">${escaparHTML(s.Nombre)}</span>
                    <span class="doc-archivo-peso">${Number(s.Total) || 0} doc.</span>
                    <button type="button" class="doc-btn-ghost" style="min-height:30px;padding:0 10px;"
                            data-accion-sec="editar" data-id="${escaparHTML(s.Id)}">Editar</button>
                    <button type="button" class="doc-archivo-quitar" data-accion-sec="eliminar" data-id="${escaparHTML(s.Id)}"
                            aria-label="Eliminar sección">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
                        </svg>
                    </button>
                </div>`).join('')}
           </div>`
        : '<p style="margin:0;">Todavía no hay secciones.</p>';

    const respuesta = await Swal.fire({
        title: 'Secciones',
        html,
        showConfirmButton: true,
        confirmButtonText: 'Nueva sección',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        didOpen: () => {
            document.querySelectorAll('[data-accion-sec]').forEach(boton => {
                boton.addEventListener('click', async () => {
                    const id = boton.dataset.id;
                    const seccion = estado.secciones.find(s => String(s.Id) === String(id));
                    if (!seccion) return;

                    if (boton.dataset.accionSec === 'editar') {
                        Swal.close();
                        if (await formularioSeccion(seccion)) gestionarSecciones();
                        return;
                    }

                    // Se cierra el gestor antes de confirmar: SweetAlert sólo
                    // permite un diálogo a la vez.
                    Swal.close();
                    if (await eliminarSeccion(seccion)) gestionarSecciones();
                });
            });
        }
    });

    if (respuesta.isConfirmed && await formularioSeccion()) {
        gestionarSecciones();
    }
}

/* =========================================================
   EVENTOS
   ========================================================= */
function conectarEventos() {
    // Navegación / cabecera
    $('btn-volver')?.addEventListener('click', () => window.api.volverMenu());

    el.btnRecargar?.addEventListener('click', async () => {
        await recargar();
        toastExito('Documentos actualizados');
    });

    // Menú desplegable de secciones: abrir / cerrar
    el.btnSeccionActual?.addEventListener('click', evento => {
        evento.stopPropagation();
        alternarMenuFiltro();
    });

    // Selección de sección desde el menú (delegación: la lista se repinta)
    el.secciones?.addEventListener('click', evento => {
        const item = evento.target.closest('[data-seccion]');
        if (!item) return;
        estado.seccion = item.dataset.seccion;
        alternarMenuFiltro(false);
        el.btnSeccionActual?.focus({ preventScroll: true });
        renderizar();
    });

    // Buscador
    el.busqueda?.addEventListener('input', () => {
        estado.busqueda = el.busqueda.value.trim().toLowerCase();
        el.limpiarBusqueda?.classList.toggle('oculto', !el.busqueda.value);
        renderizar();
    });

    el.limpiarBusqueda?.addEventListener('click', () => {
        if (el.busqueda) el.busqueda.value = '';
        estado.busqueda = '';
        el.limpiarBusqueda.classList.add('oculto');
        el.busqueda?.focus();
        renderizar();
    });

    // Filtros
    el.filtroCliente?.addEventListener('change', () => {
        estado.cliente = el.filtroCliente.value;
        renderizar();
    });

    el.filtroCategoria?.addEventListener('change', () => {
        estado.categoria = el.filtroCategoria.value;
        renderizar();
    });

    // Papelera
    el.btnPapelera?.addEventListener('click', async () => {
        estado.papelera = !estado.papelera;
        await recargar();
    });

    // Subida
    el.btnSubir?.addEventListener('click', () => el.inputArchivo?.click());
    el.zonaSubida?.addEventListener('click', () => el.inputArchivo?.click());
    el.zonaSubida?.addEventListener('keydown', evento => {
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            el.inputArchivo?.click();
        }
    });

    el.inputArchivo?.addEventListener('change', () => {
        const archivos = el.inputArchivo.files;
        if (archivos && archivos.length) abrirSubida(archivos);
        el.inputArchivo.value = '';
    });

    // Drag & drop sobre la zona de subida
    if (el.zonaSubida) {
        ['dragenter', 'dragover'].forEach(tipo => {
            el.zonaSubida.addEventListener(tipo, evento => {
                evento.preventDefault();
                evento.stopPropagation();
                el.zonaSubida.classList.add('arrastrando');
            });
        });
        ['dragleave', 'dragend'].forEach(tipo => {
            el.zonaSubida.addEventListener(tipo, evento => {
                evento.preventDefault();
                el.zonaSubida.classList.remove('arrastrando');
            });
        });
        el.zonaSubida.addEventListener('drop', evento => {
            evento.preventDefault();
            evento.stopPropagation();
            el.zonaSubida.classList.remove('arrastrando');
            const archivos = evento.dataTransfer?.files;
            if (archivos && archivos.length) abrirSubida(archivos);
        });
    }

    // Evita que soltar fuera de la zona abra el archivo en la ventana
    ['dragover', 'drop'].forEach(tipo => {
        window.addEventListener(tipo, evento => {
            if (!el.zonaSubida?.contains(evento.target)) evento.preventDefault();
        });
    });

    // Modal de subida
    el.subCerrar?.addEventListener('click', () => cerrarModal(el.modalSubida));
    el.subGuardar?.addEventListener('click', ejecutarSubida);

    el.subLista?.addEventListener('click', evento => {
        const quitar = evento.target.closest('[data-quitar]');
        if (!quitar) return;
        const indice = Number(quitar.dataset.quitar);
        pendientes.splice(indice, 1);
        if (!pendientes.length) {
            cerrarModal(el.modalSubida);
            return;
        }
        renderPendientes();
    });

    el.subLista?.addEventListener('input', evento => {
        const input = evento.target.closest('input[data-titulo]');
        if (!input) return;
        const indice = Number(input.dataset.titulo);
        if (pendientes[indice]) pendientes[indice].titulo = input.value;
    });

    // Modal de detalle
    el.detCerrar?.addEventListener('click', () => cerrarModal(el.modalDetalle));
    el.detGuardar?.addEventListener('click', guardarDetalle);

    el.detAbrir?.addEventListener('click', () => {
        if (docActual?.NombreGuardado) abrirArchivo(docActual.NombreGuardado);
    });

    el.detCopia?.addEventListener('click', () => {
        if (docActual?.NombreGuardado) guardarCopia(docActual.NombreGuardado, docActual.NombreOriginal);
    });

    el.detNuevaVersion?.addEventListener('click', () => el.detArchivoVersion?.click());
    el.detArchivoVersion?.addEventListener('change', () => {
        const archivo = el.detArchivoVersion.files?.[0];
        if (archivo) agregarVersionDesdeArchivo(archivo);
    });

    el.detVersiones?.addEventListener('click', evento => {
        const boton = evento.target.closest('[data-accion]');
        if (!boton) return;
        const archivo = boton.dataset.archivo;
        const nombre = boton.dataset.nombre;
        if (boton.dataset.accion === 'version-abrir') abrirArchivo(archivo);
        if (boton.dataset.accion === 'version-copia') guardarCopia(archivo, nombre);
    });

    // Acciones de las tarjetas (delegación)
    el.grid?.addEventListener('click', evento => {
        const boton = evento.target.closest('[data-accion]');
        if (!boton) return;
        const id = boton.dataset.id;
        switch (boton.dataset.accion) {
            case 'abrir': {
                const doc = estado.documentos.find(d => String(d.Id) === String(id));
                if (doc) abrirArchivo(doc.NombreGuardado);
                break;
            }
            case 'detalle': abrirDetalle(id); break;
            case 'papelera': moverAPapelera(id); break;
            case 'restaurar': restaurar(id); break;
            case 'eliminar': eliminarDefinitivo(id); break;
        }
    });

    // Menú desplegable de secciones (separado de las acciones de documentos)
    el.btnMenuSecciones?.addEventListener('click', evento => {
        evento.stopPropagation();
        alternarMenuSecciones();
    });

    el.menuSeccionesLista?.addEventListener('click', async evento => {
        const item = evento.target.closest('[data-menu-sec]');
        if (!item) return;

        alternarMenuSecciones(false);
        el.btnMenuSecciones?.focus({ preventScroll: true });

        switch (item.dataset.menuSec) {
            case 'nueva': await formularioSeccion(); break;
            case 'editar': await editarSeccionActiva(); break;
            case 'eliminar': await eliminarSeccionActiva(); break;
            case 'gestionar': await gestionarSecciones(); break;
        }
    });

    // Los menús se cierran al hacer clic fuera o al pulsar ESC
    document.addEventListener('click', evento => {
        if (!el.menuSecciones?.contains(evento.target)) alternarMenuSecciones(false);
        if (!el.secciones?.contains(evento.target)) alternarMenuFiltro(false);
    });

    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape') {
            alternarMenuSecciones(false);
            alternarMenuFiltro(false);
        }
    });

    // Cierre de modales con clic en el fondo
    [el.modalSubida, el.modalDetalle].forEach(modal => {
        modal?.addEventListener('click', evento => {
            if (evento.target === modal) cerrarModal(modal);
        });
    });

    // Cierre con ESC
    document.addEventListener('keydown', evento => {
        if (evento.key !== 'Escape') return;
        if (el.modalDetalle && !el.modalDetalle.classList.contains('oculto')) return cerrarModal(el.modalDetalle);
        if (el.modalSubida && !el.modalSubida.classList.contains('oculto')) return cerrarModal(el.modalSubida);
    });

    // La sesión puede expirar: limpia modales abiertos al cerrar la ventana
    window.addEventListener('beforeunload', cerrarTodosLosModales);
}

/* =========================================================
   RECARGA / ARRANQUE
   ========================================================= */
async function recargar() {
    await Promise.all([cargarSecciones(), cargarDocumentos()]);
    if (el.filtroCliente) llenarSelectClientes(el.filtroCliente, estado.cliente);
    renderizar();
}

async function iniciar() {
    conectarEventos();

    await Promise.all([cargarSecciones(), cargarClientes()]);
    if (el.filtroCliente) llenarSelectClientes(el.filtroCliente, '');
    await cargarDocumentos();
    renderizar();
    limpiarResiduosSwal();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
} else {
    iniciar();
}
