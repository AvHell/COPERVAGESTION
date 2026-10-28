/* =========================================================
   ACTIVO FIJO — RENDERER DE CATÁLOGOS (12 catálogos)
   Soft delete + pestaña Eliminados + Restaurar
   + Panel de ayuda contextual + Reglas de negocio
   + Blindaje: ningún addEventListener sobre null
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
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
              tip: 'Fabricante del equipo. Ej. HP, Dell, Lenovo, Apple.' }
        ]
    },
    tipos: {
        titulo: 'Tipos de Equipo',
        tituloSingular: 'tipo',
        pk: 'IdTipo',
        campos: [
            { nombre: 'Nombre',       etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
              tip: 'Nombre del tipo de activo. Ej. LAPTOP, MOUSE, SSD NVME.' },
            { nombre: 'GrupoSubtipo', etiqueta: 'Grupo de subtipo', tipo: 'select',
              opciones: [{ valor: '', etiqueta: '— Sin grupo —' }, ...GRUPOS_SUBTIPO],
              tip: 'Los subtipos que se ofrecerán al capturar un activo de este tipo. Si no aplica, deja "Sin grupo".' },
            { nombre: 'RequiereResponsiva',      etiqueta: 'Requiere responsiva',       tipo: 'bool',
              tip: 'Si está activo, se pedirá firmar responsiva al asignar el activo.' },
            { nombre: 'RequiereIMEI',            etiqueta: 'Requiere IMEI',             tipo: 'bool',
              tip: 'Muestra los campos IMEI 1 e IMEI 2. Aplica a celulares/tablets con línea.' },
            { nombre: 'RequiereTelefono',        etiqueta: 'Requiere teléfono',         tipo: 'bool',
              tip: 'Muestra el campo No. Teléfono.' },
            { nombre: 'RequiereSitio',           etiqueta: 'Requiere sitio',            tipo: 'bool',
              tip: 'Muestra el selector de Sitio (dónde está físicamente el activo).' },
            { nombre: 'RequiereSubtipo',         etiqueta: 'Requiere subtipo',          tipo: 'bool',
              tip: 'Muestra el selector de Subtipo. Requiere que el tipo tenga "Grupo de subtipo" definido.' },
            { nombre: 'RequiereClasificacion',   etiqueta: 'Requiere clasificación',    tipo: 'bool',
              tip: 'Muestra el selector de Clasificación (Interno, Externo, etc.).' },
            { nombre: 'RequiereTamanio',         etiqueta: 'Requiere tamaño',           tipo: 'bool',
              tip: 'Muestra el selector de Tamaño (ej. pulgadas, tallas).' },
            { nombre: 'RequiereCapacidad',       etiqueta: 'Requiere capacidad',        tipo: 'bool',
              tip: 'Muestra el selector de Capacidad (ej. 240 GB, 8 GB).' },
            { nombre: 'RequiereVoltaje',         etiqueta: 'Requiere voltaje',          tipo: 'bool',
              tip: 'Muestra el selector de Voltaje (ej. 110V, 220V).' },
            { nombre: 'RequiereUsuarioAsignado', etiqueta: 'Requiere usuario asignado', tipo: 'bool',
              tip: 'Muestra el campo de usuario asignado. En tipos de almacenamiento (SSD/DISCO) solo se pide si la clasificación es EXTERNO.' },
            { nombre: 'RequierePrecio',          etiqueta: 'Requiere precio',           tipo: 'bool',
              tip: 'Muestra el campo Precio. Si lo apagas, los precios ya capturados NO se borran.' },
            { nombre: 'RequiereEspecificaciones',etiqueta: 'Requiere especificaciones', tipo: 'bool',
              tip: 'Muestra los campos Procesador, RAM, Almacenamiento y Sistema Operativo.' },
            { nombre: 'RequiereAccesorios',      etiqueta: 'Requiere accesorios',       tipo: 'bool',
              tip: 'Muestra el campo de Accesorios (cargador, cable, funda...).' }
        ]
    },
    estados: {
        titulo: 'Estados',
        tituloSingular: 'estado',
        pk: 'IdEstado',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              tip: 'Condición física del activo. Ej. USO, NUEVO, VALIDAR, DAÑADO.' }
        ]
    },
    estatus: {
        titulo: 'Estatus',
        tituloSingular: 'estatus',
        pk: 'IdEstatus',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              tip: 'Situación operativa del activo. Ej. STOCK, DISPONIBLE, ASIGNADO, BAJA.' }
        ]
    },
    carteras: {
        titulo: 'Carteras',
        tituloSingular: 'cartera',
        pk: 'IdCartera',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
              tip: 'Área o responsable del activo. Ej. SOPORTE TI, RECURSOS HUMANOS.' }
        ]
    },
    puestos: {
        titulo: 'Puestos',
        tituloSingular: 'puesto',
        pk: 'IdPuesto',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
              tip: 'Puesto del usuario asignado. Ej. GERENTE, ANALISTA.' }
        ]
    },
    sitios: {
        titulo: 'Sitios',
        tituloSingular: 'sitio',
        pk: 'IdSitio',
        campos: [
            { nombre: 'Nombre',      etiqueta: 'Nombre',      tipo: 'text', requerido: true, max: 100,
              tip: 'Ubicación física. Ej. CORPORATIVO, SUCURSAL NORTE.' },
            { nombre: 'Descripcion', etiqueta: 'Descripción', tipo: 'text', max: 200,
              tip: 'Detalle opcional (dirección, piso, referencia).' }
        ]
    },
    subtipos: {
        titulo: 'Subtipos',
        tituloSingular: 'subtipo',
        pk: 'IdSubtipo',
        campos: [
            { nombre: 'Grupo',       etiqueta: 'Grupo',       tipo: 'select', requerido: true,
              opciones: [{ valor: '', etiqueta: '— Seleccionar —' }, ...GRUPOS_SUBTIPO],
              tip: 'A qué grupo de subtipos pertenece. Solo aparecerán al capturar activos cuyo Tipo tenga este grupo.',
              esGrupoInmutable: true },
            { nombre: 'Nombre',      etiqueta: 'Nombre',      tipo: 'text',   requerido: true, max: 100,
              tip: 'Nombre del subtipo. Ej. INALÁMBRICO, 8GB DDR4, 240W.' },
            { nombre: 'Descripcion', etiqueta: 'Descripción', tipo: 'text',   max: 200,
              tip: 'Detalle opcional.' }
        ]
    },
    voltajes: {
        titulo: 'Voltajes',
        tituloSingular: 'voltaje',
        pk: 'IdVoltaje',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              tip: 'Ej. 110V, 220V, 5V.' }
        ]
    },
    clasificaciones: {
        titulo: 'Clasificaciones',
        tituloSingular: 'clasificación',
        pk: 'IdClasificacion',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              tip: 'Ej. INTERNO, EXTERNO. La regla de "Usuario asignado" para SSD/DISCO depende de EXTERNO.' }
        ]
    },
    tamanios: {
        titulo: 'Tamaños',
        tituloSingular: 'tamaño',
        pk: 'IdTamanio',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              tip: 'Ej. CHICO, MEDIANO, 15", 24".' }
        ]
    },
    capacidades: {
        titulo: 'Capacidades',
        tituloSingular: 'capacidad',
        pk: 'IdCapacidad',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              tip: 'Ej. 240 GB, 480 GB, 8 GB, 16 GB.' }
        ]
    }
};

/* =========================================================
   AYUDA CONTEXTUAL POR CATÁLOGO
   ========================================================= */
const AYUDA_CATALOGO = {
    marcas: {
        resumen: 'Catálogo simple de fabricantes. Cada activo puede tener una marca (opcional).',
        tips: [
            'No se puede repetir el mismo nombre entre marcas activas.',
            'Dar de baja una marca NO afecta a los activos que ya la usan.'
        ]
    },
    tipos: {
        resumen: 'Define la "plantilla" de cada tipo de activo. Los switches de abajo controlan qué campos aparecerán al capturar un activo de ese tipo.',
        tips: [
            '<b>Grupo de subtipo:</b> si lo defines, al capturar un activo se ofrecerán los Subtipos que pertenezcan a ese grupo. Si lo cambias después, los subtipos actuales dejan de mostrarse (no se borran).',
            '<b>Requiere Precio / Requiere Especificaciones / Requiere Accesorios:</b> apagarlos no borra los datos ya guardados en activos existentes.',
            '<b>Requiere Usuario Asignado:</b> en tipos SSD NVME y DISCO MECÁNICO solo se pide si la clasificación del activo es EXTERNO.',
            'Dar de baja un Tipo NO afecta a los activos que ya lo usan, pero impide crear nuevos con ese tipo.'
        ]
    },
    estados: {
        resumen: 'Condición física del activo (USO, NUEVO, VALIDAR, DAÑADO).',
        tips: ['Se usa como filtro en el inventario.', 'No confundir con Estatus (que es la situación operativa).']
    },
    estatus: {
        resumen: 'Situación operativa del activo (STOCK, DISPONIBLE, ASIGNADO, BAJA, etc.).',
        tips: [
            'El estatus <b>BAJA</b> es el que dispara el "soft delete" y mueve el activo a la pestaña Eliminados.',
            'El estatus <b>STOCK / DISPONIBLE</b> es al que vuelve un activo al restaurarse.'
        ]
    },
    carteras: {
        resumen: 'Área o responsable del activo. Ej. SOPORTE TI, RECURSOS HUMANOS.',
        tips: ['Es un filtro transversal del inventario.', 'Un activo puede no tener cartera.']
    },
    puestos: {
        resumen: 'Puesto del usuario al que se asigna un activo.',
        tips: ['Informativo. No bloquea nada del inventario.']
    },
    sitios: {
        resumen: 'Ubicaciones físicas donde puede estar un activo.',
        tips: ['El campo solo aparece al capturar activos cuyo Tipo tenga "Requiere Sitio" activo.']
    },
    subtipos: {
        resumen: 'Sub-clasificación dentro de un grupo (MOUSE, TECLADO, ALMACENAMIENTO, etc.). Se muestran al capturar un activo cuyo Tipo tenga ese Grupo de subtipo.',
        tips: [
            '<b>El campo Grupo NO se puede cambiar una vez creado</b> (los activos lo referencian). Si necesitas mover un subtipo a otro grupo, créalo de nuevo y da de baja el anterior.',
            'Para que un subtipo aparezca en el inventario, el Tipo del activo debe tener el mismo "Grupo de subtipo" que el subtipo.'
        ]
    },
    voltajes: {
        resumen: 'Voltajes eléctricos posibles. Ej. 110V, 220V, 5V.',
        tips: ['El campo solo aparece al capturar activos cuyo Tipo tenga "Requiere Voltaje" activo.']
    },
    clasificaciones: {
        resumen: 'Clasificación del activo. Ej. INTERNO, EXTERNO.',
        tips: [
            'La clasificación <b>EXTERNO</b> activa la petición de "Usuario asignado" en tipos de almacenamiento (SSD NVME, DISCO MECÁNICO).',
            'Si renombras "EXTERNO" a otra cosa, esa regla dejará de aplicar.'
        ]
    },
    tamanios: {
        resumen: 'Tamaños posibles. Ej. CHICO, MEDIANO, 15", 24".',
        tips: ['El campo solo aparece al capturar activos cuyo Tipo tenga "Requiere Tamaño" activo.']
    },
    capacidades: {
        resumen: 'Capacidades posibles. Ej. 240 GB, 480 GB, 8 GB, 16 GB.',
        tips: ['El campo solo aparece al capturar activos cuyo Tipo tenga "Requiere Capacidad" activo.']
    }
};

/* =========================================================
   ESTADO
   ========================================================= */
let catalogoActual = 'marcas';
let vistaActual    = 'activos';
let registros      = [];
let modoEdicion    = false;
let idEditando     = null;
let guardando      = false;
let filtroBusqueda = '';
let ayudaAbierta   = true;

/* =========================================================
   REFERENCIAS DOM (defensivas: null si no existen)
   ========================================================= */
const $ = (id) => document.getElementById(id);

const tabs             = $('tabs-catalogos');
const tabsVista        = $('tabs-vista');
const tablaHead        = $('tabla-head');
const tablaBody        = $('tabla-body');
const formulario       = $('formulario');
const camposForm       = $('campos-form');
const mensaje          = $('mensaje');
const btnGuardar       = $('btn-guardar');
const btnNuevo         = $('btn-nuevo');
const btnNuevoTexto    = $('btn-nuevo-texto');
const tituloCatalogo   = $('titulo-catalogo');
const sinResultados    = $('sin-resultados');
const sinResultadosTxt = $('sin-resultados-texto');
const inputBusqueda    = $('input-busqueda');
const btnLimpiarBusq   = $('btn-limpiar-busqueda');
const btnLimpiarFiltro = $('btn-limpiar-filtro');
const modal            = $('modal-catalogo');
const modalTitulo      = $('modal-titulo');
const avisoModal       = $('aviso-modal');
const btnVolver        = $('btn-volver');
const btnModalCerrar   = $('modal-cerrar');
const btnModalCancelar = $('btn-cancelar');

/* Panel de ayuda */
const panelAyuda       = $('panel-ayuda');
const panelAyudaTitulo = $('panel-ayuda-titulo');
const panelAyudaBody   = $('panel-ayuda-body');
const btnToggleAyuda   = $('btn-toggle-ayuda');

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarMensaje(texto, tipo) {
    if (!mensaje) return;
    mensaje.textContent = texto;
    mensaje.className = 'mensaje ' + tipo;
}
function ocultarMensaje() {
    if (!mensaje) return;
    mensaje.className = 'mensaje oculto';
}

function mostrarAvisoModal(html) {
    if (!avisoModal) return;
    if (!html) {
        avisoModal.classList.add('oculto');
        avisoModal.innerHTML = '';
        return;
    }
    avisoModal.innerHTML = html;
    avisoModal.classList.remove('oculto');
}

function setGuardando(v) {
    guardando = v;
    if (!btnGuardar) return;
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
   PANEL DE AYUDA CONTEXTUAL
   ========================================================= */
function renderAyuda() {
    const ayuda = AYUDA_CATALOGO[catalogoActual];
    const cfg   = CATALOGOS_FRONT[catalogoActual];
    if (!ayuda || !panelAyudaBody || !panelAyudaTitulo) return;

    panelAyudaTitulo.textContent = `Cómo funciona "${cfg.titulo}"`;

    const tips = (ayuda.tips || []).map(t => `<li>${t}</li>`).join('');
    panelAyudaBody.innerHTML = `
        <p class="ayuda-resumen">${ayuda.resumen}</p>
        ${tips ? `<ul class="ayuda-tips">${tips}</ul>` : ''}
    `;

    if (panelAyuda) panelAyuda.classList.toggle('oculto', false);
}

function aplicarEstadoAyuda() {
    if (!panelAyudaBody || !panelAyuda) return;
    panelAyudaBody.style.display = ayudaAbierta ? '' : 'none';
    panelAyuda.classList.toggle('colapsado', !ayudaAbierta);
}

/* =========================================================
   ACTUALIZAR UI SEGÚN CATÁLOGO / VISTA ACTIVA
   ========================================================= */
function actualizarUIDeCatalogo() {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    if (!cfg) return;

    if (tituloCatalogo) {
        const sufijo = (vistaActual === 'eliminados') ? ' · Eliminados' : '';
        tituloCatalogo.textContent = `Catálogos · ${cfg.titulo}${sufijo}`;
    }

    if (btnNuevoTexto) {
        btnNuevoTexto.textContent = `Nuevo ${cfg.tituloSingular}`;
    }

    const enEliminados = (vistaActual === 'eliminados');
    if (btnNuevo) {
        btnNuevo.disabled = enEliminados;
        btnNuevo.style.opacity = enEliminados ? '0.5' : '';
    }

    renderAyuda();
    aplicarEstadoAyuda();
}

/* =========================================================
   TABS DE CATÁLOGO
   ========================================================= */
if (tabs) {
    tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab');
        if (!btn || btn.classList.contains('activo')) return;

        tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
        btn.classList.add('activo');

        catalogoActual = btn.dataset.catalogo;
        if (inputBusqueda) inputBusqueda.value = '';
        filtroBusqueda = '';
        if (btnLimpiarBusq) btnLimpiarBusq.classList.add('oculto');

        actualizarUIDeCatalogo();
        cargarCatalogo();
    });
}

/* =========================================================
   TABS DE VISTA (Activos / Eliminados)
   ========================================================= */
if (tabsVista) {
    tabsVista.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-vista');
        if (!btn || btn.classList.contains('activo')) return;

        tabsVista.querySelectorAll('.tab-vista').forEach(t => t.classList.remove('activo'));
        btn.classList.add('activo');

        vistaActual = btn.dataset.vista;

        if (inputBusqueda) inputBusqueda.value = '';
        filtroBusqueda = '';
        if (btnLimpiarBusq) btnLimpiarBusq.classList.add('oculto');

        actualizarUIDeCatalogo();
        cargarCatalogo();
    });
}

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
    if (!cfg || !tablaHead || !tablaBody) return;

    const headers = cfg.campos.map(c => `<th>${escaparHTML(c.etiqueta)}</th>`);
    headers.push('<th style="width:230px; text-align:right;">Acciones</th>');
    tablaHead.innerHTML = `<tr>${headers.join('')}</tr>`;

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
        if (sinResultados) sinResultados.classList.remove('oculto');
        if (sinResultadosTxt) {
            sinResultadosTxt.textContent = vistaActual === 'eliminados'
                ? `No hay ${cfg.titulo.toLowerCase()} dados de baja.`
                : `No se encontraron ${cfg.titulo.toLowerCase()} con ese criterio.`;
        }
        const cardTabla = document.querySelector('.card-tabla');
        if (cardTabla) cardTabla.style.display = 'none';
        return;
    }

    if (sinResultados) sinResultados.classList.add('oculto');
    const cardTabla = document.querySelector('.card-tabla');
    if (cardTabla) cardTabla.style.display = '';

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
if (inputBusqueda) {
    inputBusqueda.addEventListener('input', () => {
        filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
        if (btnLimpiarBusq) btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
        renderTabla();
    });
}

if (btnLimpiarBusq) {
    btnLimpiarBusq.addEventListener('click', () => {
        if (inputBusqueda) inputBusqueda.value = '';
        filtroBusqueda = '';
        btnLimpiarBusq.classList.add('oculto');
        renderTabla();
        if (inputBusqueda) inputBusqueda.focus();
    });
}

if (btnLimpiarFiltro) {
    btnLimpiarFiltro.addEventListener('click', () => {
        if (inputBusqueda) inputBusqueda.value = '';
        filtroBusqueda = '';
        if (btnLimpiarBusq) btnLimpiarBusq.classList.add('oculto');
        renderTabla();
    });
}

/* =========================================================
   PANEL AYUDA TOGGLE
   ========================================================= */
if (btnToggleAyuda) {
    btnToggleAyuda.addEventListener('click', () => {
        ayudaAbierta = !ayudaAbierta;
        aplicarEstadoAyuda();
    });
}

/* =========================================================
   MODAL — ABRIR / CERRAR
   ========================================================= */
function abrirModal() {
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
function cerrarModal() {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
    ocultarMensaje();
    mostrarAvisoModal(null);
    modoEdicion = false;
    idEditando = null;
}

if (btnModalCerrar) btnModalCerrar.addEventListener('click', cerrarModal);
if (btnModalCancelar) btnModalCancelar.addEventListener('click', cerrarModal);
if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') cerrarModal();
});

/* =========================================================
   CONSTRUIR CAMPOS DEL FORMULARIO
   ========================================================= */
function construirFormulario(datos = {}) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    if (!cfg || !camposForm) return;

    camposForm.innerHTML = '';

    const camposNormales = [];
    const camposBool     = [];

    cfg.campos.forEach(c => {
        if (c.tipo === 'bool') camposBool.push(c);
        else camposNormales.push(c);
    });

    const labelConTip = (c) => {
        const tip = c.tip
            ? `<span class="tip" title="${escaparHTML(c.tip)}">ⓘ</span>`
            : '';
        return `<label for="campo-${c.nombre}">${escaparHTML(c.etiqueta)}${c.requerido ? ' *' : ''} ${tip}</label>`;
    };

    camposNormales.forEach(c => {
        const wrapper = document.createElement('div');
        const esFull = (c.tipo === 'select' || c.nombre === 'Descripcion');
        if (esFull) wrapper.classList.add('campo-full');

        if (c.tipo === 'select') {
            const bloqueado = (modoEdicion && c.esGrupoInmutable);
            const opcionesHtml = (c.opciones || []).map(op => {
                const sel = String(datos[c.nombre] ?? '') === String(op.valor) ? 'selected' : '';
                return `<option value="${escaparHTML(op.valor)}" ${sel}>${escaparHTML(op.etiqueta)}</option>`;
            }).join('');

            wrapper.innerHTML = `
                ${labelConTip(c)}
                <select id="campo-${c.nombre}" ${c.requerido ? 'required' : ''} ${bloqueado ? 'disabled' : ''}>
                    ${opcionesHtml}
                </select>
                ${bloqueado ? `<small class="campo-nota">El grupo no se puede cambiar una vez creado.</small>` : ''}`;
        } else {
            wrapper.innerHTML = `
                ${labelConTip(c)}
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
        titulo.textContent = '¿Qué campos pedirá este tipo al capturar un activo?';
        grupo.appendChild(titulo);

        const subtitulo = document.createElement('div');
        subtitulo.className = 'grupo-subtitulo';
        subtitulo.textContent = 'Cada switch activa un campo del formulario. Apagarlo NO borra datos ya capturados en activos existentes.';
        grupo.appendChild(subtitulo);

        const fila = document.createElement('div');
        fila.className = 'fila-switches';

        camposBool.forEach(c => {
            const item = document.createElement('label');
            item.className = 'switch';
            item.title = c.tip || '';
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
if (btnNuevo) {
    btnNuevo.addEventListener('click', () => {
        if (vistaActual === 'eliminados') return;
        const cfg = CATALOGOS_FRONT[catalogoActual];
        modoEdicion = false;
        idEditando = null;
        if (modalTitulo) modalTitulo.textContent = `Nuevo ${cfg.tituloSingular}`;
        construirFormulario();
        ocultarMensaje();
        mostrarAvisoModal(null);
        abrirModal();
        const primerInput = camposForm ? camposForm.querySelector('input[type="text"], select') : null;
        if (primerInput) primerInput.focus();
    });
}

/* =========================================================
   EDITAR
   ========================================================= */
function abrirEdicion(id) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    const r = registros.find(x => x[cfg.pk] === id);
    if (!r) { toastError('Registro no encontrado'); return; }

    modoEdicion = true;
    idEditando = id;
    if (modalTitulo) modalTitulo.textContent = `Editar ${cfg.tituloSingular}`;
    construirFormulario(r);
    ocultarMensaje();
    mostrarAvisoModal(null);

    if (catalogoActual === 'tipos') {
        mostrarAvisoModal(`
            <b>Ojo:</b> si cambias el <b>Grupo de subtipo</b>, los activos actuales seguirán apuntando a sus subtipos,
            pero al crear/editar activos de este tipo ya no aparecerán esos subtipos si no coinciden con el nuevo grupo.
        `);
    } else if (catalogoActual === 'subtipos') {
        mostrarAvisoModal(`
            <b>Ojo:</b> el campo <b>Grupo</b> no se puede cambiar una vez creado (los activos lo referencian).
            Si necesitas moverlo, crea un subtipo nuevo y da de baja el anterior.
        `);
    }

    abrirModal();
    const primerInput = camposForm ? camposForm.querySelector('input[type="text"], select:not([disabled])') : null;
    if (primerInput) { primerInput.focus(); primerInput.select?.(); }
}

/* =========================================================
   GUARDAR
   ========================================================= */
if (formulario) {
    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (guardando) return;

        const cfg = CATALOGOS_FRONT[catalogoActual];
        if (!cfg) return;

        const datos = {};

        for (const c of cfg.campos) {
            const el = document.getElementById(`campo-${c.nombre}`);
            if (!el) continue;

            if (c.tipo === 'bool') {
                datos[c.nombre] = el.checked;
            } else {
                if (modoEdicion && c.esGrupoInmutable) continue;

                const val = el.value.trim();
                if (c.requerido && !val) {
                    mostrarMensaje(`${c.etiqueta} es obligatorio.`, 'error');
                    return;
                }
                datos[c.nombre] = val || null;
            }
        }

        // Validación de negocio: RequiereSubtipo exige GrupoSubtipo
        if (catalogoActual === 'tipos') {
            const elReqSubtipo = document.getElementById('campo-RequiereSubtipo');
            const elGrupo      = document.getElementById('campo-GrupoSubtipo');
            const reqSubtipo   = elReqSubtipo ? elReqSubtipo.checked : false;
            const grupo        = elGrupo ? elGrupo.value : '';
            if (reqSubtipo && !grupo) {
                mostrarMensaje('Si el tipo requiere subtipo, debes indicar un Grupo de subtipo.', 'error');
                return;
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
}

/* =========================================================
   ELIMINAR (Soft delete) — con advertencias de impacto
   ========================================================= */
async function eliminarRegistro(id) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    const r = registros.find(x => x[cfg.pk] === id);
    const nombre = r ? (r.Nombre || `#${id}`) : `#${id}`;

    let extra = '';
    if (catalogoActual === 'tipos') {
        extra = '<br><br><b>Nota:</b> los activos que ya usan este tipo seguirán funcionando, pero no podrás crear nuevos con él.';
    } else if (catalogoActual === 'estatus') {
        extra = '<br><br><b>Nota:</b> dar de baja un estatus NO mueve a los activos que lo tienen asignado.';
    } else if (catalogoActual === 'subtipos') {
        extra = '<br><br><b>Nota:</b> los activos con este subtipo lo conservan, pero ya no podrás elegirlo al capturar nuevos.';
    }

    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: `¿Dar de baja ${cfg.tituloSingular}?`,
        html: `Se dará de baja <strong>${escaparHTML(nombre)}</strong>.<br>
               Podrás verlo y restaurarlo desde la pestaña <strong>Eliminados</strong>.${extra}`,
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
if (btnVolver) {
    btnVolver.addEventListener('click', () => {
        window.api.volverMenu();
    });
}

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    actualizarUIDeCatalogo();
    await cargarCatalogo();
})();