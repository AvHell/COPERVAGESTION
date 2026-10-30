/* =========================================================
   ACTIVO FIJO — RENDERER CORPORATIVO · Paleta Tierra 2026
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   GRUPOS DE SUBTIPO
   ========================================================= */
const GRUPOS_SUBTIPO = [
    { valor: 'DIADEMA',         etiqueta: 'Diadema' },
    { valor: 'MOUSE',           etiqueta: 'Mouse' },
    { valor: 'TECLADO',         etiqueta: 'Teclado' },
    { valor: 'CARGADOR',        etiqueta: 'Cargador' },
    { valor: 'ADAPTADOR_VIDEO', etiqueta: 'Adaptador de Video' },
    { valor: 'ALMACENAMIENTO',  etiqueta: 'Almacenamiento' }
];

/* Requisitos mostrados como chips en la tabla de tipos */
const REQUISITOS_TIPO = [
    { key: 'RequiereResponsiva',        label: 'Responsiva' },
    { key: 'RequiereIMEI',              label: 'IMEI' },
    { key: 'RequiereTelefono',          label: 'Teléfono' },
    { key: 'RequiereSitio',             label: 'Sitio' },
    { key: 'RequiereSubtipo',           label: 'Subtipo' },
    { key: 'RequiereClasificacion',     label: 'Clasificación' },
    { key: 'RequiereTamanio',           label: 'Tamaño' },
    { key: 'RequiereCapacidad',         label: 'Capacidad' },
    { key: 'RequiereVoltaje',           label: 'Voltaje' },
    { key: 'RequiereUsuarioAsignado',   label: 'Usuario' },
    { key: 'RequierePrecio',            label: 'Precio' },
    { key: 'RequiereEspecificaciones',  label: 'Specs' },
    { key: 'RequiereAccesorios',        label: 'Accesorios' }
];

/* =========================================================
   CONFIGURACIÓN FRONTEND DE LOS 12 CATÁLOGOS
   ========================================================= */
const CATALOGOS_FRONT = {
    marcas: {
        titulo: 'Marcas',
        tituloSingular: 'marca',
        pk: 'IdMarca',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
              hint: 'Fabricante del equipo. Ej. HP, Dell, Lenovo, Apple.' }
        ]
    },
    tipos: {
        titulo: 'Tipos de Equipo',
        tituloSingular: 'tipo',
        pk: 'IdTipo',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
              hint: 'Nombre del tipo de activo. Ej. LAPTOP, MOUSE, SSD NVME.' },
            { nombre: 'GrupoSubtipo', etiqueta: 'Grupo de subtipo', tipo: 'select',
              opciones: [{ valor: '', etiqueta: '— Sin grupo —' }, ...GRUPOS_SUBTIPO],
              hint: 'Los subtipos que se ofrecerán al capturar un activo de este tipo.' },
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
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              hint: 'Condición física del activo. Ej. USO, NUEVO, VALIDAR, DAÑADO.' }
        ]
    },
    estatus: {
        titulo: 'Estatus',
        tituloSingular: 'estatus',
        pk: 'IdEstatus',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              hint: 'Situación operativa. Ej. STOCK, DISPONIBLE, ASIGNADO, BAJA.' }
        ]
    },
    carteras: {
        titulo: 'Carteras',
        tituloSingular: 'cartera',
        pk: 'IdCartera',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
              hint: 'Área o responsable del activo. Ej. SOPORTE TI, RECURSOS HUMANOS.' }
        ]
    },
    puestos: {
        titulo: 'Puestos',
        tituloSingular: 'puesto',
        pk: 'IdPuesto',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
              hint: 'Puesto del usuario asignado. Ej. GERENTE, ANALISTA.' }
        ]
    },
    sitios: {
        titulo: 'Sitios',
        tituloSingular: 'sitio',
        pk: 'IdSitio',
        campos: [
            { nombre: 'Nombre',      etiqueta: 'Nombre',      tipo: 'text', requerido: true, max: 100,
              hint: 'Ubicación física. Ej. CORPORATIVO, SUCURSAL NORTE.' },
            { nombre: 'Descripcion', etiqueta: 'Descripción', tipo: 'text', max: 200,
              hint: 'Detalle opcional (dirección, piso, referencia).' }
        ]
    },
    subtipos: {
        titulo: 'Subtipos',
        tituloSingular: 'subtipo',
        pk: 'IdSubtipo',
        campos: [
            { nombre: 'Grupo',       etiqueta: 'Grupo',       tipo: 'select', requerido: true,
              opciones: [{ valor: '', etiqueta: '— Seleccionar —' }, ...GRUPOS_SUBTIPO],
              hint: 'Grupo al que pertenece. No se puede cambiar una vez creado.',
              esGrupoInmutable: true },
            { nombre: 'Nombre',      etiqueta: 'Nombre',      tipo: 'text',   requerido: true, max: 100,
              hint: 'Nombre del subtipo. Ej. INALÁMBRICO, 8GB DDR4, 240W.' },
            { nombre: 'Descripcion', etiqueta: 'Descripción', tipo: 'text',   max: 200,
              hint: 'Detalle opcional.' }
        ]
    },
    voltajes: {
        titulo: 'Voltajes',
        tituloSingular: 'voltaje',
        pk: 'IdVoltaje',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              hint: 'Ej. 110V, 220V, 5V.' }
        ]
    },
    clasificaciones: {
        titulo: 'Clasificaciones',
        tituloSingular: 'clasificación',
        pk: 'IdClasificacion',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              hint: 'Ej. INTERNO, EXTERNO. La regla de "Usuario asignado" depende de EXTERNO.' }
        ]
    },
    tamanios: {
        titulo: 'Tamaños',
        tituloSingular: 'tamaño',
        pk: 'IdTamanio',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              hint: 'Ej. CHICO, MEDIANO, 15", 24".' }
        ]
    },
    capacidades: {
        titulo: 'Capacidades',
        tituloSingular: 'capacidad',
        pk: 'IdCapacidad',
        campos: [
            { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
              hint: 'Ej. 240 GB, 480 GB, 8 GB, 16 GB.' }
        ]
    }
};

/* =========================================================
   AYUDA CONTEXTUAL
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
        resumen: 'Define la "plantilla" de cada tipo de activo. Los switches controlan qué campos aparecerán al capturar un activo de ese tipo.',
        tips: [
            '<b>Grupo de subtipo:</b> si lo defines, al capturar un activo se ofrecerán los Subtipos que pertenezcan a ese grupo.',
            '<b>Precio / Especificaciones / Accesorios:</b> apagarlos no borra los datos ya guardados en activos existentes.',
            '<b>Usuario Asignado:</b> en tipos SSD/DISCO solo se pide si la clasificación es EXTERNO.',
            'Dar de baja un Tipo NO afecta a los activos existentes, pero impide crear nuevos con ese tipo.'
        ]
    },
    estados: {
        resumen: 'Condición física del activo (USO, NUEVO, VALIDAR, DAÑADO).',
        tips: ['Se usa como filtro en el inventario.', 'No confundir con Estatus (situación operativa).']
    },
    estatus: {
        resumen: 'Situación operativa del activo (STOCK, DISPONIBLE, ASIGNADO, BAJA, etc.).',
        tips: [
            'El estatus <b>BAJA</b> dispara el soft delete y mueve el activo a Eliminados.',
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
        resumen: 'Sub-clasificación dentro de un grupo (MOUSE, TECLADO, ALMACENAMIENTO, etc.).',
        tips: [
            '<b>El campo Grupo NO se puede cambiar una vez creado</b> (los activos lo referencian).',
            'Para que un subtipo aparezca, el Tipo del activo debe tener el mismo "Grupo de subtipo" que el subtipo.'
        ]
    },
    voltajes: {
        resumen: 'Voltajes eléctricos posibles. Ej. 110V, 220V, 5V.',
        tips: ['El campo solo aparece al capturar activos cuyo Tipo tenga "Requiere Voltaje" activo.']
    },
    clasificaciones: {
        resumen: 'Clasificación del activo. Ej. INTERNO, EXTERNO.',
        tips: [
            'La clasificación <b>EXTERNO</b> activa la petición de "Usuario asignado" en tipos de almacenamiento.',
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
   REFERENCIAS DOM
   ========================================================= */
const $ = (id) => document.getElementById(id);

const tabs             = $('tabs-catalogos');
const tabsVista        = $('tabs-vista');
const tablaHead        = $('tabla-head');
const tablaBody        = $('tabla-body');
const cardTabla        = $('card-tabla');
const formulario       = $('formulario');
const camposForm       = $('campos-form');
const mensaje          = $('mensaje');
const btnGuardar       = $('btn-guardar');
const btnNuevo         = $('btn-nuevo');
const btnNuevoTexto    = $('btn-nuevo-texto');
const tituloCatalogo   = $('titulo-catalogo');
const panelTitulo      = $('panel-titulo');
const panelDescripcion = $('panel-descripcion');
const sinResultados    = $('sin-resultados');
const sinResultadosTit = $('sin-resultados-titulo');
const sinResultadosTxt = $('sin-resultados-texto');
const inputBusqueda    = $('input-busqueda');
const btnLimpiarBusq   = $('btn-limpiar-busqueda');
const btnLimpiarFiltro = $('btn-limpiar-filtro');
const modal            = $('modal-catalogo');
const modalTitulo      = $('modal-titulo');
const avisoModal       = $('aviso-modal');
const btnVolver        = $('btn-volver');
const btnModalCerrar   = $('modal-cerrar');

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
    mensaje.className = 'alert ' + tipo;
    mensaje.classList.remove('oculto');
}

function ocultarMensaje() {
    if (!mensaje) return;
    mensaje.className = 'alert oculto';
    mensaje.textContent = '';
}

function mostrarAvisoModal(html) {
    if (!avisoModal) return;
    if (!html) {
        avisoModal.classList.add('oculto');
        avisoModal.innerHTML = '';
        return;
    }
    avisoModal.innerHTML = `<div class="aviso-texto">${html}</div>`;
    avisoModal.classList.remove('oculto');
}

function setGuardando(v) {
    guardando = v;
    if (!btnGuardar) return;
    btnGuardar.disabled = v;
    const txt = btnGuardar.querySelector('.btn-text');
    const spin = btnGuardar.querySelector('.btn-spinner');
    if (txt) txt.textContent = v ? 'Guardando...' : 'Guardar';
    if (spin) spin.classList.toggle('oculto', !v);
}

function etiquetaSelect(campo, valor) {
    if (!campo || !campo.opciones) return valor ?? '';
    const op = campo.opciones.find(o => o.valor === valor);
    return op ? op.etiqueta : (valor ?? '');
}

/* =========================================================
   ALERTAS MODALES
   ========================================================= */
function alertaExito(titulo, mensaje = '') {
    return Swal.fire({
        icon: 'success',
        title: titulo,
        html: mensaje ? `<p style="margin:0;">${mensaje}</p>` : undefined,
        timer: 2100,
        timerProgressBar: true,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'cl-alert' }
    });
}

function alertaError(titulo, mensaje = '') {
    return Swal.fire({
        icon: 'error',
        title: titulo,
        html: mensaje ? `<p style="margin:0;">${mensaje}</p>` : undefined,
        confirmButtonText: 'Entendido',
        showCloseButton: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-alert',
            confirmButton: 'swal2-confirm swal2-styled'
        }
    });
}

/* =========================================================
   PANEL AYUDA
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
   ACTUALIZAR UI
   ========================================================= */
function actualizarUIDeCatalogo() {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    if (!cfg) return;

    const enEliminados = (vistaActual === 'eliminados');
    const sufijo = enEliminados ? ' · Eliminados' : '';

    if (tituloCatalogo) tituloCatalogo.textContent = `Catálogos · ${cfg.titulo}${sufijo}`;
    if (panelTitulo) panelTitulo.textContent = cfg.titulo;

    if (panelDescripcion) {
        panelDescripcion.textContent = enEliminados
            ? 'Registros dados de baja · Puedes restaurarlos individualmente'
            : `Gestiona los registros activos del catálogo`;
    }

    if (btnNuevoTexto) btnNuevoTexto.textContent = `Nuevo ${cfg.tituloSingular}`;

    if (btnNuevo) {
        btnNuevo.disabled = enEliminados;
        btnNuevo.title = enEliminados ? 'No disponible en la vista de Eliminados' : '';
    }

    renderAyuda();
    aplicarEstadoAyuda();
}

/* =========================================================
   TABS CATÁLOGO / VISTA
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
   CARGAR
   ========================================================= */
async function cargarCatalogo() {
    try {
        const filtros = { soloEliminados: vistaActual === 'eliminados' };
        registros = await window.api.activoFijo.catalogos.listar(catalogoActual, filtros);
        renderTabla();
    } catch (err) {
        alertaError('No se pudieron cargar los datos', err.message);
    }
}

/* =========================================================
   RENDER TABLA
   ========================================================= */
function renderTabla() {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    if (!cfg || !tablaHead || !tablaBody) return;

    const listaFiltrada = registros.filter(r => {
        if (!filtroBusqueda) return true;
        const texto = cfg.campos
            .map(c => {
                if (c.tipo === 'select') return etiquetaSelect(c, r[c.nombre]);
                if (c.tipo === 'bool') return r[c.nombre] ? 'si yes' : 'no';
                return String(r[c.nombre] ?? '');
            })
            .join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    tablaBody.innerHTML = '';

    /* ---------- ESTADO VACÍO ---------- */
    if (listaFiltrada.length === 0) {
        const hayBusqueda = !!filtroBusqueda;
        if (sinResultados) sinResultados.classList.remove('oculto');
        if (cardTabla) cardTabla.style.display = 'none';

        if (sinResultadosTit) {
            sinResultadosTit.textContent = hayBusqueda ? 'Sin coincidencias' : 'Sin registros';
        }
        if (sinResultadosTxt) {
            if (hayBusqueda) {
                sinResultadosTxt.textContent = `Ningún registro coincide con "${inputBusqueda?.value || ''}".`;
            } else if (vistaActual === 'eliminados') {
                sinResultadosTxt.textContent = `Aún no hay ${cfg.titulo.toLowerCase()} dados de baja.`;
            } else {
                sinResultadosTxt.textContent = `Aún no hay ${cfg.titulo.toLowerCase()} registrados. Crea el primero con el botón de arriba.`;
            }
        }
        if (btnLimpiarFiltro) {
            btnLimpiarFiltro.style.display = hayBusqueda ? '' : 'none';
        }
        return;
    }

    if (sinResultados) sinResultados.classList.add('oculto');
    if (cardTabla) cardTabla.style.display = '';

    const esVistaEliminados = (vistaActual === 'eliminados');

    /* ---------- RENDER ESPECIAL: TIPOS ---------- */
    if (catalogoActual === 'tipos') {
        tablaHead.innerHTML = `
            <tr>
                <th style="width:22%;">Nombre</th>
                <th style="width:15%;">Grupo</th>
                <th>Requisitos</th>
                <th style="width:100px; text-align:right;">Acciones</th>
            </tr>
        `;

        const campoTipoGrupo = cfg.campos.find(c => c.nombre === 'GrupoSubtipo');

        listaFiltrada.forEach(r => {
            const tr = document.createElement('tr');

            const grupoLabel = r.GrupoSubtipo
                ? etiquetaSelect(campoTipoGrupo, r.GrupoSubtipo)
                : null;
            const grupoHTML = grupoLabel
                ? `<span class="badge-grupo">${escaparHTML(grupoLabel)}</span>`
                : `<span class="badge-grupo vacio">Sin grupo</span>`;

            const reqsActivos = REQUISITOS_TIPO.filter(req => r[req.key]);
            const reqsHTML = reqsActivos.length
                ? reqsActivos.map(req => `<span class="chip-requisito">${escaparHTML(req.label)}</span>`).join('')
                : `<span class="chip-requisito vacio">Sin requisitos</span>`;

            tr.innerHTML = `
                <td data-label="Nombre"><span class="badge-nombre">${escaparHTML(r.Nombre ?? '')}</span></td>
                <td data-label="Grupo">${grupoHTML}</td>
                <td data-label="Requisitos" class="celda-requisitos">
                    <div class="chips-wrap">${reqsHTML}</div>
                </td>
                <td data-label="Acciones" class="acciones-tabla"></td>
            `;

            const celda = tr.querySelector('.acciones-tabla');

            if (esVistaEliminados) {
                const btnRestaurar = document.createElement('button');
                btnRestaurar.type = 'button';
                btnRestaurar.className = 'btn-accion restaurar';
                btnRestaurar.setAttribute('data-tooltip', 'Restaurar');
                btnRestaurar.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>`;
                btnRestaurar.addEventListener('click', () => restaurarRegistro(r[cfg.pk]));
                celda.appendChild(btnRestaurar);
            } else {
                const btnEditar = document.createElement('button');
                btnEditar.type = 'button';
                btnEditar.className = 'btn-accion editar';
                btnEditar.setAttribute('data-tooltip', 'Editar');
                btnEditar.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>`;
                btnEditar.addEventListener('click', () => abrirEdicion(r[cfg.pk]));
                celda.appendChild(btnEditar);

                const btnEliminar = document.createElement('button');
                btnEliminar.type = 'button';
                btnEliminar.className = 'btn-accion eliminar';
                btnEliminar.setAttribute('data-tooltip', 'Dar de baja');
                btnEliminar.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6M14 11v6"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>`;
                btnEliminar.addEventListener('click', () => eliminarRegistro(r[cfg.pk]));
                celda.appendChild(btnEliminar);
            }

            tablaBody.appendChild(tr);
        });
        return;
    }

    /* ---------- RENDER NORMAL ---------- */
    const headers = cfg.campos.map(c => `<th>${escaparHTML(c.etiqueta)}</th>`);
    headers.push('<th style="width:100px; text-align:right;">Acciones</th>');
    tablaHead.innerHTML = `<tr>${headers.join('')}</tr>`;

    listaFiltrada.forEach(r => {
        const tr = document.createElement('tr');
        const celdas = cfg.campos.map(c => {
            const val = r[c.nombre];
            const labelAttr = `data-label="${escaparHTML(c.etiqueta)}"`;
            if (c.tipo === 'bool') {
                return `<td ${labelAttr}><span class="badge-boolean ${val ? 'si' : 'no'}">${val ? 'Sí' : 'No'}</span></td>`;
            }
            if (c.tipo === 'select') {
                return `<td ${labelAttr}><span class="badge-nombre">${escaparHTML(etiquetaSelect(c, val))}</span></td>`;
            }
            return `<td ${labelAttr}><span class="badge-nombre">${escaparHTML(val ?? '')}</span></td>`;
        });
        tr.innerHTML = celdas.join('') + `<td data-label="Acciones" class="acciones-tabla"></td>`;

        const celda = tr.querySelector('.acciones-tabla');

        if (esVistaEliminados) {
            const btnRestaurar = document.createElement('button');
            btnRestaurar.type = 'button';
            btnRestaurar.className = 'btn-accion restaurar';
            btnRestaurar.setAttribute('data-tooltip', 'Restaurar');
            btnRestaurar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                    <polyline points="1 4 1 10 7 10"></polyline>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>`;
            btnRestaurar.addEventListener('click', () => restaurarRegistro(r[cfg.pk]));
            celda.appendChild(btnRestaurar);
            tablaBody.appendChild(tr);
            return;
        }

        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'btn-accion editar';
        btnEditar.setAttribute('data-tooltip', 'Editar');
        btnEditar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>`;
        btnEditar.addEventListener('click', () => abrirEdicion(r[cfg.pk]));
        celda.appendChild(btnEditar);

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.className = 'btn-accion eliminar';
        btnEliminar.setAttribute('data-tooltip', 'Dar de baja');
        btnEliminar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>`;
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
   TOGGLE AYUDA
   ========================================================= */
if (btnToggleAyuda) {
    btnToggleAyuda.addEventListener('click', () => {
        ayudaAbierta = !ayudaAbierta;
        aplicarEstadoAyuda();
    });
}

/* =========================================================
   MODAL
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
if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') cerrarModal();
});

/* =========================================================
   CONSTRUIR FORMULARIO
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

    camposNormales.forEach(c => {
        const wrapper = document.createElement('div');
        wrapper.className = 'campo-item';
        const esFull = (c.tipo === 'select' || c.nombre === 'Descripcion');
        if (esFull) wrapper.classList.add('campo-full');

        const reqMark = c.requerido ? '<span class="req">*</span>' : '';
        const hintHTML = c.hint ? `<small class="field-hint">${escaparHTML(c.hint)}</small>` : '';

        if (c.tipo === 'select') {
            const bloqueado = (modoEdicion && c.esGrupoInmutable);
            const opcionesHtml = (c.opciones || []).map(op => {
                const sel = String(datos[c.nombre] ?? '') === String(op.valor) ? 'selected' : '';
                return `<option value="${escaparHTML(op.valor)}" ${sel}>${escaparHTML(op.etiqueta)}</option>`;
            }).join('');

            wrapper.innerHTML = `
                <label for="campo-${c.nombre}">${escaparHTML(c.etiqueta)}${reqMark}</label>
                <select id="campo-${c.nombre}" ${c.requerido ? 'required' : ''} ${bloqueado ? 'disabled' : ''}>
                    ${opcionesHtml}
                </select>
                ${bloqueado ? `<small class="campo-nota">El grupo no se puede cambiar una vez creado.</small>` : hintHTML}
            `;
        } else {
            wrapper.innerHTML = `
                <label for="campo-${c.nombre}">${escaparHTML(c.etiqueta)}${reqMark}</label>
                <input type="text" id="campo-${c.nombre}" maxlength="${c.max || ''}"
                       value="${escaparHTML(datos[c.nombre] ?? '')}"
                       ${c.requerido ? 'required' : ''}>
                ${hintHTML}
            `;
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
        subtitulo.textContent = 'Cada switch activa un campo del formulario. Apagarlo no borra datos ya capturados en activos existentes.';
        grupo.appendChild(subtitulo);

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
   NUEVO / EDITAR
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

function abrirEdicion(id) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    const r = registros.find(x => x[cfg.pk] === id);
    if (!r) { alertaError('Registro no encontrado'); return; }

    modoEdicion = true;
    idEditando = id;
    if (modalTitulo) modalTitulo.textContent = `Editar ${cfg.tituloSingular}`;
    construirFormulario(r);
    ocultarMensaje();
    mostrarAvisoModal(null);

    if (catalogoActual === 'tipos') {
        mostrarAvisoModal(`
            Si cambias el <b>Grupo de subtipo</b>, los activos actuales seguirán apuntando a sus subtipos,
            pero al crear/editar activos de este tipo ya no aparecerán esos subtipos si no coinciden con el nuevo grupo.
        `);
    } else if (catalogoActual === 'subtipos') {
        mostrarAvisoModal(`
            El campo <b>Grupo</b> no se puede cambiar una vez creado (los activos lo referencian).
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
                    el.focus();
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
                datos[c.nombre] = val || null;
            }
        }

        if (catalogoActual === 'tipos') {
            const elReqSubtipo = document.getElementById('campo-RequiereSubtipo');
            const elGrupo      = document.getElementById('campo-GrupoSubtipo');
            const reqSubtipo   = elReqSubtipo ? elReqSubtipo.checked : false;
            const grupo        = elGrupo ? elGrupo.value : '';
            if (reqSubtipo && !grupo) {
                mostrarMensaje('Si el tipo requiere subtipo, debes indicar un Grupo de subtipo.', 'error');
                if (elGrupo) {
                    elGrupo.focus();
                    elGrupo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
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
                await alertaExito('Guardado correctamente', res.mensaje || (modoEdicion ? 'Registro actualizado.' : 'Registro creado.'));
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
   ELIMINAR / RESTAURAR
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
        showCloseButton: true,
        confirmButtonText: 'Sí, dar de baja',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro'
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.catalogos.eliminar(catalogoActual, id);
        if (res && res.ok) {
            await cargarCatalogo();
            await alertaExito('Registro dado de baja', res.mensaje || 'El registro se movió a Eliminados.');
        } else {
            alertaError('No se pudo dar de baja', res?.mensaje || 'Ocurrió un error inesperado.');
        }
    } catch (err) {
        alertaError('Error al dar de baja', err.message);
    }
}

async function restaurarRegistro(id) {
    const cfg = CATALOGOS_FRONT[catalogoActual];
    const r = registros.find(x => x[cfg.pk] === id);
    const nombre = r ? (r.Nombre || `#${id}`) : `#${id}`;

    const confirmacion = await Swal.fire({
        icon: 'question',
        title: `¿Restaurar ${cfg.tituloSingular}?`,
        html: `El registro <strong>${escaparHTML(nombre)}</strong> volverá al listado activo.`,
        showCloseButton: true,
        confirmButtonText: 'Sí, restaurar',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled'
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.catalogos.restaurar(catalogoActual, id);
        if (res && res.ok) {
            await cargarCatalogo();
            await alertaExito('Registro restaurado', res.mensaje || 'El registro volvió al listado activo.');
        } else {
            alertaError('No se pudo restaurar', res?.mensaje || 'Ocurrió un error inesperado.');
        }
    } catch (err) {
        alertaError('Error al restaurar', err.message);
    }
}

/* =========================================================
   NAVEGACIÓN E INICIO
   ========================================================= */
if (btnVolver) {
    btnVolver.addEventListener('click', () => {
        window.api.volverMenu();
    });
}

(async () => {
    actualizarUIDeCatalogo();
    await cargarCatalogo();
})();