/* =========================================================
   ACTIVO FIJO — RENDERER DE INVENTARIO
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   ESTADO
   ========================================================= */
let activos        = [];
let tipos          = [];
let marcas         = [];
let estados        = [];
let estatus        = [];
let carteras       = [];
let sitios         = [];
let subtipos       = [];
let voltajes       = [];
let clasificaciones= [];
let tamanios       = [];
let capacidades    = [];
let catalogosEspecificaciones = {
    modelos: [],
    procesadores: [],
    memoriasRam: [],
    almacenamientos: [],
    sistemasOperativos: [],
    accesorios: [],
    usuariosAsignados: []
};
let modoEdicion    = false;
let idEditando     = null;
let estatusOriginal = null;
let guardando      = false;
let filtroBusqueda = '';
let vistaActual    = 'activos';

/* Pestaña de cartera activa: '__todas__', el id de una cartera o '__sin__'.
   Separa el parque de cada cliente sin pedir un filtro más al usuario. */
let carteraActual = '__todas__';
/* Token de la última cascada Tipo → catálogos: las respuestas que llegan
   tarde se descartan para que no pisen la selección vigente. */
let cascadaToken = 0;

let permisosUsuario = {};
let rolUsuario      = null;
let esAdmin         = false;

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const tabsVista        = document.getElementById('tabs-vista');
const tablaBody        = document.getElementById('tabla-body');
const formulario       = document.getElementById('formulario');
const mensaje          = document.getElementById('mensaje');
const btnGuardar       = document.getElementById('btn-guardar');
const btnNuevo         = document.getElementById('btn-nuevo');
const btnExportar      = document.getElementById('btn-exportar');
const sinResultados    = document.getElementById('sin-resultados');
const sinResultadosTit = document.getElementById('sin-resultados-titulo');
const sinResultadosTxt = document.getElementById('sin-resultados-texto');
const cardTabla        = document.getElementById('card-tabla');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarVacio  = document.getElementById('btn-limpiar-busqueda-vacio');
const modal            = document.getElementById('modal-activo');
const modalTitulo      = document.getElementById('modal-titulo');
<<<<<<< Updated upstream
=======

/* Segmentación del inventario por cartera y controles nuevos del formulario. */
const tabsCartera        = document.getElementById('tabs-cartera');
const btnAutoasignar     = document.getElementById('btn-autoasignar');
const chkUsuarioAsignado = document.getElementById('chk-usuario-asignado');
const usuarioPicker      = document.getElementById('usuario-picker');
const buscadorUsuario    = document.getElementById('buscador-usuario');
const btnLimpiarUsuario  = document.getElementById('btn-limpiar-usuario');
const notaContextoAuto   = document.getElementById('nota-contexto-auto');

/* Contenedores de las dos vistas que viven en esta misma página:
   el inventario y los catálogos (ya no son módulos separados). */
>>>>>>> Stashed changes
const seccionInventario  = document.getElementById('vista-inventario');
const seccionCatalogos   = document.getElementById('vista-catalogos');
const buscadorInventario = document.getElementById('buscador-inventario');
const accionesInventario = document.getElementById('acciones-inventario');
const tituloPagina       = document.getElementById('titulo-pagina');
const subtituloPagina    = document.getElementById('subtitulo-pagina');
const HERO_INVENTARIO = {
    titulo: tituloPagina ? tituloPagina.textContent : '',
    subtitulo: subtituloPagina ? subtituloPagina.textContent : ''
};

/* Paginación*/
const pagInventario = window.Paginador
    ? window.Paginador.crear(document.getElementById('paginacion-inventario'), {
        alCambiar: () => renderTabla()
    })
    : {
        recortar: lista => lista,
        reiniciar() {},
        mostrar() {},
        contenedor: null
    };

const selTipo          = document.getElementById('tipo');
const selMarca         = document.getElementById('marca');
const selEstado        = document.getElementById('estado');
const selEstatus       = document.getElementById('estatus');
const selCartera       = document.getElementById('cartera');
const selSitio         = document.getElementById('sitio');
const selSubtipo       = document.getElementById('subtipo');
const selClasificacion = document.getElementById('clasificacion');
const selTamanio       = document.getElementById('tamanio');
const selCapacidad     = document.getElementById('capacidad');
const selVoltaje       = document.getElementById('voltaje');

const inpModelo        = document.getElementById('modelo');
const inpNoSerie       = document.getElementById('noserie');
const inpIMEI1         = document.getElementById('imei1');
const inpIMEI2         = document.getElementById('imei2');
const inpNoTelefono    = document.getElementById('notelefono');
const inpUsuarioAsig   = document.getElementById('usuario-asignado');
const inpProcesador    = document.getElementById('procesador');
const inpRAM           = document.getElementById('ram');
const inpAlmacenamiento= document.getElementById('almacenamiento');
const inpSO            = document.getElementById('so');
const inpAccesorios    = document.getElementById('accesorios');
const inpPrecio        = document.getElementById('precio');
const inpObservaciones = document.getElementById('observaciones');

/* =========================================================
   UTILIDADES Y PERMISOS
   ========================================================= */
function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function puedeAcceder(clave) {
    if (esAdmin) return true;
    return !!permisosUsuario[clave];
}

function permiteInventario() {
    return puedeAcceder('af-act:listado:ver');
}

function permiteCatalogos() {
    return puedeAcceder('activofijo_catalogos');
}

async function aplicarPermisos() {
    try {
        permisosUsuario = (await window.api.permisos.mios()) || {};
        const rol = await window.api.permisos.miRol();
        rolUsuario = rol?.codigo || null;
        esAdmin    = rolUsuario === 'ADMIN';
    } catch (err) {
        console.error('[Permisos] Error:', err);
    }

    document.querySelectorAll('[data-permiso]').forEach(el => {
        const clave = el.getAttribute('data-permiso');
        if (!puedeAcceder(clave)) {
            el.classList.add('permiso-oculto');
            el.setAttribute('aria-hidden', 'true');
        } else {
            el.classList.remove('permiso-oculto');
            el.removeAttribute('aria-hidden');
        }
    });
}

function formatearPrecio(val) {
    if (val === null || val === undefined || val === '') return null;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
}

function formatearFecha(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/* =========================================================
   COPIAR AL PORTAPAPELES
   ========================================================= */
async function copiarAlPortapapeles(texto) {
    const valor = String(texto ?? '').trim();
    if (!valor) return false;
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(valor);
            return true;
        }
    } catch (_) { /* sin permiso: se intenta el método clásico */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = valor;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (_) {
        return false;
    }
}

/** Aviso de copiado */
async function copiarConAviso(el, texto) {
    if (!el) return false;
    const original = el.getAttribute('data-tooltip') || 'Copiar';
    const ok = await copiarAlPortapapeles(texto);
    el.classList.add(ok ? 'copiado' : 'copiado-error');
    el.setAttribute('data-tooltip', ok ? '¡Copiado!' : 'No se pudo copiar');
    setTimeout(() => {
        el.classList.remove('copiado', 'copiado-error');
        el.setAttribute('data-tooltip', original);
    }, 1500);
    return ok;
}

function engancharCopiables(contenedor) {
    if (!contenedor) return;
    contenedor.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-copiar-texto]');
        if (!btn) return;
        e.stopPropagation();
        copiarConAviso(btn, btn.getAttribute('data-copiar-texto'));
    });
}

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'alert ' + tipo;
    mensaje.classList.remove('oculto');
}
function ocultarMensaje() {
    mensaje.className = 'alert oculto';
    mensaje.textContent = '';
}

function setGuardando(v) {
    guardando = v;
    btnGuardar.disabled = v;
    btnGuardar.style.opacity = v ? '0.6' : '';
}

function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
        customClass: { container: 'cl-toast-container', popup: 'cl-toast cl-toast-success' },
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
        customClass: { container: 'cl-toast-container', popup: 'cl-toast cl-toast-error' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   CARGAR CATÁLOGOS AUXILIARES
   ========================================================= */
async function cargarCatalogos() {
    try {
        const extras = await window.api.activoFijo.activos.listarCatalogosExtendidos();
        const [t, m, e, s, c, si, sub, vol, cla, tam, cap] = await Promise.all([
            window.api.activoFijo.activos.listarTipos(),
            window.api.activoFijo.activos.listarMarcas(),
            window.api.activoFijo.activos.listarEstados(),
            window.api.activoFijo.activos.listarEstatus(),
            window.api.activoFijo.activos.listarCarteras(),
            window.api.activoFijo.activos.listarSitios(),
            window.api.activoFijo.activos.listarSubtipos(),
            window.api.activoFijo.activos.listarVoltajes(),
            window.api.activoFijo.activos.listarClasificaciones(),
            window.api.activoFijo.activos.listarTamanios(),
            window.api.activoFijo.activos.listarCapacidades()
        ]);

        tipos           = t;
        marcas          = m;
        estados         = e;
        estatus         = s;
        carteras        = c;
        sitios          = si;
        subtipos        = sub;
        voltajes        = vol;
        clasificaciones = cla;
        tamanios        = tam;
        capacidades     = cap;
        catalogosEspecificaciones = extras;

        selTipo.innerHTML    = '<option value="">— Seleccionar —</option>' +
            tipos.map(x => `<option value="${x.IdTipo}">${escaparHTML(x.Nombre)}</option>`).join('');
        selMarca.innerHTML   = '<option value="">— Sin marca —</option>' +
            marcas.map(x => `<option value="${x.IdMarca}">${escaparHTML(x.Nombre)}</option>`).join('');
        selEstado.innerHTML  = estados.map(x => `<option value="${x.IdEstado}">${escaparHTML(x.Nombre)}</option>`).join('');
        selEstatus.innerHTML = '<option value="">— Seleccionar estatus —</option>' +
            estatus.map(x => `<option value="${x.IdEstatus}" ${x.Nombre.toUpperCase() === 'ASIGNADO' ? 'disabled' : ''}>${escaparHTML(x.Nombre)}</option>`).join('');
        selCartera.innerHTML = '<option value="">— Sin cartera —</option>' +
            carteras.map(x => `<option value="${x.IdCartera}">${escaparHTML(x.Nombre)}</option>`).join('');
        selSitio.innerHTML   = '<option value="">— Sin sitio —</option>' +
            sitios.map(x => `<option value="${x.IdSitio}">${escaparHTML(x.Nombre)}</option>`).join('');
        selClasificacion.innerHTML = '<option value="">— Sin clasificación —</option>' +
            clasificaciones.map(x => `<option value="${x.IdClasificacion}">${escaparHTML(x.Nombre)}</option>`).join('');
        selTamanio.innerHTML = '<option value="">— Sin tamaño —</option>' +
            tamanios.map(x => `<option value="${x.IdTamanio}">${escaparHTML(x.Nombre)}</option>`).join('');
        selCapacidad.innerHTML = '<option value="">— Sin capacidad —</option>' +
            capacidades.map(x => `<option value="${x.IdCapacidad}">${escaparHTML(x.Nombre)}</option>`).join('');
        selVoltaje.innerHTML = '<option value="">— Sin voltaje —</option>' +
            voltajes.map(x => `<option value="${x.IdVoltaje}">${escaparHTML(x.Nombre)}</option>`).join('');
        poblarCatalogoTexto(inpModelo, catalogosEspecificaciones.modelos, '— Seleccionar modelo —');
        poblarCatalogoTexto(inpProcesador, catalogosEspecificaciones.procesadores, '— Seleccionar procesador —');
        poblarCatalogoTexto(inpRAM, catalogosEspecificaciones.memoriasRam, '— Seleccionar memoria —');
        poblarCatalogoTexto(inpAlmacenamiento, catalogosEspecificaciones.almacenamientos, '— Seleccionar almacenamiento —');
        poblarSistemasOperativos(catalogosEspecificaciones.sistemasOperativos);
        poblarCatalogoTexto(inpAccesorios, catalogosEspecificaciones.accesorios, '— Seleccionar accesorios —');
        poblarCatalogoTexto(inpUsuarioAsig, catalogosEspecificaciones.usuariosAsignados, '— Seleccionar usuario —');
    } catch (err) {
        toastError('No se pudieron cargar los catálogos', err.message);
    }
}

function poblarCatalogoTexto(select, registros, placeholder) {
    select.innerHTML = `<option value="">${placeholder}</option>` +
        registros.map(registro => `<option value="${escaparHTML(registro.Nombre)}">${escaparHTML(registro.Nombre)}</option>`).join('');
}

function seleccionarCatalogoTexto(select, valor) {
    const texto = String(valor ?? '');
    if (texto && !Array.from(select.options).some(option => option.value === texto)) {
        const option = new Option(`${texto} (inactivo)`, texto, true, true);
        option.disabled = true;
        select.add(option);
    }
    select.value = texto;
}

/* El SO se identifica por Nombre + BuildSO: dos filas del catálogo pueden
   compartir nombre y diferir sólo en la compilación. Por eso este <select>
   usa el Id de la fila como valor (no el nombre) y muestra el build en la
   etiqueta. Así el activo apunta a la variante exacta que trajo el colector
   y editar no re-apunta a otra fila del catálogo. */
function poblarSistemasOperativos(registros) {
    const lista = Array.isArray(registros) ? registros : [];
    inpSO.innerHTML = '<option value="">— Seleccionar sistema operativo —</option>' +
        lista.map(r => {
            const etiqueta = `${r.Nombre ?? ''}${r.BuildSO ? ' · ' + r.BuildSO : ''}`;
            return `<option value="${r.IdSistemaOperativo}">${escaparHTML(etiqueta)}</option>`;
        }).join('');
}

function seleccionarSistemaOperativo(activo) {
    const id = activo && activo.IdSistemaOperativo != null ? String(activo.IdSistemaOperativo) : '';
    if (id && !Array.from(inpSO.options).some(option => option.value === id)) {
        const etiqueta = `${activo.SistemaOperativo ?? 'Sistema operativo'}${activo.BuildSO ? ' · ' + activo.BuildSO : ''} (inactivo)`;
        const option = new Option(etiqueta, id, true, true);
        option.disabled = true;
        inpSO.add(option);
    }
    inpSO.value = id;
}

/* =========================================================
   CARGAR ACTIVOS
   ========================================================= */
async function cargarActivos() {
    try {
        const filtrosEnvio = {};
        if (vistaActual === 'eliminados') {
            filtrosEnvio.soloEliminados = true;
        }
        activos = await window.api.activoFijo.activos.listar(filtrosEnvio);
        renderTabsCartera();
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los activos', err.message);
    }
}

/* =========================================================
   PESTAÑAS POR CARTERA
   ---------------------------------------------------------
   El inventario mezcla equipos de todos los clientes con activos
   generales (los que no pertenecen a ninguna cartera). La tabla se
   segmenta con una pestaña por cartera y una extra "Sin cartera".
   Sólo se dibujan las carteras que hoy tienen equipos: veinte
   pestañas vacías no ayudan a nadie.
   ========================================================= */
function conteosPorCartera() {
    const conteos = { todas: 0, sin: 0, porCartera: new Map() };
    activos.forEach(a => {
        conteos.todas++;
        const id = Number(a.IdCartera) || 0;
        if (!id) { conteos.sin++; return; }
        conteos.porCartera.set(id, (conteos.porCartera.get(id) || 0) + 1);
    });
    return conteos;
}

function renderTabsCartera() {
    if (!tabsCartera) return;

    const { todas, sin, porCartera } = conteosPorCartera();
    const pestañas = [{ clave: '__todas__', nombre: 'Todas', total: todas }];

    carteras
        .map(c => ({
            clave: String(c.IdCartera),
            nombre: c.Nombre,
            total: porCartera.get(Number(c.IdCartera)) || 0
        }))
        .filter(c => c.total > 0 || c.clave === String(carteraActual))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'))
        .forEach(c => pestañas.push(c));

    if (sin > 0 || carteraActual === '__sin__') {
        pestañas.push({ clave: '__sin__', nombre: 'Sin cartera', total: sin, sinCartera: true });
    }

    /* La cartera activa pudo quedarse sin equipos al editar o dar de baja:
       se vuelve a "Todas" para no dejar la tabla vacía sin explicación. */
    if (!pestañas.some(p => p.clave === String(carteraActual))) carteraActual = '__todas__';

    tabsCartera.innerHTML = pestañas.map(p => {
        const activa = (p.clave === String(carteraActual));
        return `
        <button type="button"
                class="tab-cartera${activa ? ' activo' : ''}${p.sinCartera ? ' tab-sin-cartera' : ''}"
                data-cartera="${escaparHTML(p.clave)}" role="tab"
                aria-selected="${activa ? 'true' : 'false'}"
                title="${escaparHTML(p.nombre)}: ${p.total} activo(s)">
            <span class="tab-nombre">${escaparHTML(p.nombre)}</span>
            <span class="tab-conteo">${p.total}</span>
        </button>`;
    }).join('');
}

tabsCartera?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-cartera');
    if (!btn || btn.classList.contains('activo')) return;

    carteraActual = btn.dataset.cartera || '__todas__';
    pagInventario.reiniciar();
    renderTabsCartera();
    renderTabla();
});

/* ¿El activo cae en la pestaña vigente? */
function coincideCartera(a) {
    if (carteraActual === '__todas__') return true;
    const id = Number(a.IdCartera) || 0;
    if (carteraActual === '__sin__') return id === 0;
    return String(id) === String(carteraActual);
}

/* =========================================================
   RENDER TABLA
   ========================================================= */

function renderTabla() {
    if (window.Vivo && tablaBody) {
        window.Vivo.enVivo(tablaBody, pintarTabla);
        return;
    }
    pintarTabla();
}


const NOMBRE_TIPO_PIEZA = {
    MONITOR: ['monitor',    'monitores'],
    DISCO:   ['disco duro', 'discos duros'],
    TECLADO: ['teclado',    'teclados'],
    RATON:   ['ratón',      'ratones'],
    DIADEMA: ['diadema',    'diademas'],
    OTRO:    ['otro',       'otros']
};


function pluralPieza(n, tipo) {
    const par = NOMBRE_TIPO_PIEZA[String(tipo || 'OTRO').toUpperCase()];
    const nombre = par ? par[Number(n) === 1 ? 0 : 1] : String(tipo).toLowerCase();
    return `${n} ${nombre}`;
}

function detallePiezas(a) {
    return (Array.isArray(a.PiezasTipos) ? a.PiezasTipos : [])
        .map(t => pluralPieza(Number(t.cuantas) || 0, t.tipo))
        .join(', ');
}

function celdaPiezas(a) {
    const total = Number(a.Piezas) || 0;
    if (!total) return '<span class="vacio">—</span>';
    return `<span class="badge badge-piezas" title="${escaparHTML(detallePiezas(a) || 'Piezas conectadas')}">`
        + `${total} ${total === 1 ? 'pieza' : 'piezas'}</span>`;
}

<<<<<<< Updated upstream

/* --- Piezas conectadas: lo que va al Excel -------------------------
   El activo con piezas sigue contando 1 en el inventario (un monitor, un
   disco o un teclado no son activos: cuelgan de su equipo). Para el
   reporte NO se abren columnas por tipo de pieza: eso no escala (cada
   familia nueva rompería el formato del Excel). Cada pieza es una FILA
   propia, con su serie/marca/modelo en las mismas columnas de siempre, y
   dos columnas finales dicen de qué activo cuelga: su NoSerie y su
   hostname. Así "reporte de monitores" es filtrar Tipo = Monitor: cada
   monitor sale en su renglón y se ve de qué equipo es.
   Los renglones de activo llevan esas dos columnas vacías; los de pieza
   las llevan llenas, así "sólo activos" = filtrar el padre en blanco. */

const COL_PADRE_SERIE = { header: 'No. Serie del activo padre', key: 'NoSeriePadre',  width: 24 };
const COL_PADRE_HOST  = { header: 'Hostname del activo padre',  key: 'HostnamePadre', width: 24 };

/* Orden fijo de las familias de piezas (monitores → discos → teclados →
   ratones → diademas → otros) para que dos reportes se lean igual. */
const ORDEN_TIPOS_PIEZA = ['MONITOR', 'DISCO', 'TECLADO', 'RATON', 'DIADEMA', 'OTRO'];

/* --- Comparar TIPOS de fila contra el catálogo de tipos ----------------
   El reporte por tipo tiene que encontrar también las PIEZAS de ese tipo:
   un monitor no es un activo, cuelga de un equipo. Para eso se comparan
   nombres de tipo escritos por humanos ("Monitor" de la pieza contra
   "Monitores" del catálogo), sin acentos, sin distinguir mayúsculas y sin
   que importe el singular/plural. */

/** "Discos  Duros" → "discos duros" (sin acentos, minúsculas). */
function normalizarTipo(txt) {
    return String(txt || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "Discos duros" → "disco duro": lleva cada palabra al singular. */
function singularTipo(txt) {
    return normalizarTipo(txt)
        .split(' ')
        .map(palabra => palabra.replace(/es$/, '').replace(/s$/, ''))
        .join(' ')
        .trim();
}

/** ¿La fila es del tipo que se está exportando? "Monitor" (pieza) coincide
    con "Monitor" o "Monitores" del catálogo; "Disco duro" con "Discos duros". */
function tipoCoincide(tipoFila, tipoCatalogo) {
    const fila = singularTipo(tipoFila);
    return !!fila && fila === singularTipo(tipoCatalogo);
}

/** Nombre singular con mayúscula: 'MONITOR' → 'Monitor'. */
function nombreTipoPieza(tipo) {
    const par = NOMBRE_TIPO_PIEZA[String(tipo || 'OTRO').toUpperCase()];
    const nombre = par ? par[0] : String(tipo || '').toLowerCase();
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/** Identidad legible de una pieza: "Dell P2419H (serie CN0K1) ×2". */
function identidadPieza(p) {
    const marcaModelo = [p && p.Marca, p && p.Modelo].filter(Boolean).join(' ').trim();
    const ids = [];
    if (p && p.Serie)         ids.push(`serie ${p.Serie}`);
    if (p && p.Identificador) ids.push(`${p && p.IdentificadorTipo ? String(p.IdentificadorTipo).toLowerCase() : 'id'} ${p.Identificador}`);
    /* La Clave del colector es la identidad interna de la pieza: sólo se
       muestra cuando no hay serie ni identificador que la hagan legible. */
    if (ids.length === 0 && p && p.Clave) ids.push(`clave ${p.Clave}`);

    const cuantas = Number(p && p.Cantidad) || 1;
    const texto = [marcaModelo || 'sin marca/modelo',
                   ids.length ? `(${ids.join(', ')})` : ''].filter(Boolean).join(' ');
    return cuantas > 1 ? `${texto} ×${cuantas}` : texto;
}

/** "Monitores: Dell P2419H (serie CN0K1) | Discos duros: WD Blue ×2". */
function identificadoresPiezas(a) {
    const piezas = Array.isArray(a.PiezasDetalle) ? a.PiezasDetalle : [];
    if (piezas.length === 0) return '';

    const porTipo = new Map();
    for (const p of piezas) {
        const tipo = String((p && p.TipoComponente) || 'OTRO').toUpperCase();
        if (!porTipo.has(tipo)) porTipo.set(tipo, []);
        porTipo.get(tipo).push(p);
    }

    const tipos = [...porTipo.keys()].sort((x, y) => {
        const ix = ORDEN_TIPOS_PIEZA.indexOf(x), iy = ORDEN_TIPOS_PIEZA.indexOf(y);
        return (ix < 0 ? ORDEN_TIPOS_PIEZA.length : ix) - (iy < 0 ? ORDEN_TIPOS_PIEZA.length : iy);
    });

    return tipos.map(tipo => {
        const par = NOMBRE_TIPO_PIEZA[tipo];
        const plural = par ? par[1] : String(tipo).toLowerCase();
        const titulo = plural.charAt(0).toUpperCase() + plural.slice(1);
        return `${titulo}: ${porTipo.get(tipo).map(p => identidadPieza(p)).join('; ')}`;
    }).join(' | ');
}

/* Datos del activo PADRE que se copian al renglón de la pieza: en un
   reporte de monitores dicen de quién es la pieza y dónde está, sin tener
   que abrir la ficha del equipo. No se inventan columnas: sólo se llenan
   las que ya existen en el Excel de ese tipo. */
const CAMPOS_PADRE_PIEZA = ['Estado', 'Estatus', 'Cartera', 'Sitio', 'UsuarioAsignado'];

/** Una fila del reporte por cada pieza física del activo: su identidad en
    las columnas de siempre (NoSerie / Marca / Modelo / Tipo) y el activo
    dueño en las dos columnas del padre. */
function filaPiezaDeActivo(activo, pieza) {
    const p = pieza || {};
    const fila = {
        NoSerie: p.Serie || p.Identificador || p.Clave || '',
        Marca:   p.Marca || '',
        Modelo:  p.Modelo || '',
        Tipo:    nombreTipoPieza(p.TipoComponente)
    };
    for (const campo of CAMPOS_PADRE_PIEZA) {
        const valor = activo[campo];
        if (valor !== undefined && valor !== null && valor !== '') fila[campo] = valor;
    }
    fila[COL_PADRE_SERIE.key] = activo.NoSerie || '';
    fila[COL_PADRE_HOST.key]  = activo.Hostname || '';
    return fila;
}

/** Aplana el reporte: el activo en su fila y debajo una fila por pieza
    conectada. Cantidad > 1 significa N piezas idénticas y el reporte debe
    contar unidades físicas, así que se repite el renglón. */
function filasConPiezas(datos) {
    const filas = [];
    for (const a of datos) {
        filas.push({ ...a, [COL_PADRE_SERIE.key]: '', [COL_PADRE_HOST.key]: '' });
        for (const p of Array.isArray(a.PiezasDetalle) ? a.PiezasDetalle : []) {
            const unidades = Math.max(1, Number(p && p.Cantidad) || 1);
            for (let i = 0; i < unidades; i++) filas.push(filaPiezaDeActivo(a, p));
        }
    }
    return filas;
=======
/* Hostname y dominio los deja el collector: van como insignia para que se
   lean de un golpe. Sólo el hostname es copiable (se dicta por teléfono y
   se pega en otros sistemas); el dominio es informativo. */
function celdaRed(valor, opciones) {
    const { variante = 'dominio', copiable = false, tooltip = '' } = opciones || {};
    const texto = String(valor ?? '').trim();
    if (!texto) return '<span class="vacio">—</span>';

    const clase = `badge badge-${variante}${copiable ? ' copiable' : ''}`;
    if (!copiable) {
        return `<span class="${clase}" title="${escaparHTML(tooltip || texto)}">${escaparHTML(texto)}</span>`;
    }
    return `<button type="button" class="${clase}" data-copiar-texto="${escaparHTML(texto)}"`
        + ` data-tooltip="${escaparHTML(tooltip || 'Copiar')}">${escaparHTML(texto)}</button>`;
>>>>>>> Stashed changes
}


function pintarTabla() {
    const listaFiltrada = activos.filter(a => {
        if (!coincideCartera(a)) return false;
        if (!filtroBusqueda) return true;
        const texto = [
            a.NoSerie, a.IMEI1, a.IMEI2, a.NoTelefono,
            a.Marca, a.Modelo, a.Tipo,
            a.Hostname, a.Dominio,
            a.Estado, a.Estatus,
            a.Cartera, a.Sitio,
            a.UsuarioAsignado, a.Observaciones,
            a.Procesador, a.MemoriaRAM, a.Almacenamiento, a.SistemaOperativo,
            a.Accesorios, a.Subtipo, a.Clasificacion, a.Tamanio, a.Capacidad, a.Voltaje,
            /* Las piezas también se buscan: escribir "monitor" o la serie de
               un disco debe encontrar al activo al que cuelgan. */
            detallePiezas(a), identificadoresPiezas(a)
        ].filter(Boolean).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    tablaBody.innerHTML = '';

    if (listaFiltrada.length === 0) {
        pagInventario.mostrar(false);
        sinResultados.classList.remove('oculto');
        if (cardTabla) cardTabla.style.display = 'none';
        if (sinResultadosTit) sinResultadosTit.textContent = filtroBusqueda ? 'Sin coincidencias' : 'Sin registros';
        if (sinResultadosTxt) {
            if (filtroBusqueda) {
                sinResultadosTxt.textContent = `Ningún activo coincide con "${inputBusqueda?.value || ''}".`;
            } else if (carteraActual === '__sin__') {
                sinResultadosTxt.textContent = 'Todos los activos de esta vista ya tienen cartera asignada.';
            } else if (carteraActual !== '__todas__') {
                sinResultadosTxt.textContent = 'Esta cartera no tiene activos en esta vista.';
            } else if (vistaActual === 'eliminados') {
                sinResultadosTxt.textContent = 'Aún no hay activos dados de baja.';
            } else {
                sinResultadosTxt.textContent = 'Aún no hay activos registrados. Crea el primero con el botón "Nuevo activo".';
            }
        }
        return;
    }

    sinResultados.classList.add('oculto');
    if (cardTabla) cardTabla.style.display = '';

    const esVistaEliminados = (vistaActual === 'eliminados');

   
    const filasVisibles = pagInventario.recortar(listaFiltrada);
    pagInventario.mostrar(true);

    filasVisibles.forEach(a => {
        const tr = document.createElement('tr');

        const identificadores = [];
        if (a.NoSerie)    identificadores.push(`<button type="button" class="principal copiable" data-copiar-texto="${escaparHTML(a.NoSerie)}" data-tooltip="Copiar número de serie">${escaparHTML(a.NoSerie)}</button>`);
        if (a.IMEI1)      identificadores.push(`<span class="secundario">IMEI1: ${escaparHTML(a.IMEI1)}</span>`);
        if (a.IMEI2)      identificadores.push(`<span class="secundario">IMEI2: ${escaparHTML(a.IMEI2)}</span>`);
        if (a.NoTelefono) identificadores.push(`<span class="secundario">Tel: ${escaparHTML(a.NoTelefono)}</span>`);
        const htmlIdent = identificadores.length > 0
            ? identificadores.join('')
            : '<span class="vacio">Sin identificadores</span>';

        const marcaModelo = [a.Marca, a.Modelo].filter(Boolean).join(' — ') || '—';

        tr.innerHTML = `
            <td data-label="Identificación"><div class="identificadores">${htmlIdent}</div></td>
            <td data-label="Marca / Modelo">${escaparHTML(marcaModelo)}</td>
            <td data-label="Tipo"><span class="badge badge-tipo">${escaparHTML(a.Tipo)}</span></td>
            <td data-label="Hostname" class="col-red">${celdaRed(a.Hostname, { variante: 'host', copiable: true, tooltip: 'Copiar hostname' })}</td>
            <td data-label="Dominio" class="col-red">${celdaRed(a.Dominio, { variante: 'dominio', tooltip: 'Dominio del equipo' })}</td>
            <td data-label="Estado"><span class="badge badge-estado-${escaparHTML(a.Estado)}">${escaparHTML(a.Estado)}</span></td>
            <td data-label="Estatus">
                <span class="badge badge-estatus-${escaparHTML(a.Estatus)}">${escaparHTML(a.Estatus)}</span>
                ${a.UsuarioAsignado ? `<span class="usuario-inventario">Usuario de inventario: ${escaparHTML(a.UsuarioAsignado)}</span>` : ''}
            </td>
            <td data-label="Piezas" class="col-piezas">${celdaPiezas(a)}</td>
            <td data-label="Acciones" class="acciones-tabla"></td>
        `;

        const celda = tr.querySelector('.acciones-tabla');

        // Botón Ver
        const btnVer = document.createElement('button');
        btnVer.type = 'button';
        btnVer.className = 'btn-accion ver';
        btnVer.setAttribute('data-tooltip', 'Ver detalle');
        btnVer.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>`;
        btnVer.addEventListener('click', () => verActivo(a.IdActivoFijoEQ));
        celda.appendChild(btnVer);

        if (esVistaEliminados) {
            const btnHistorial = document.createElement('button');
            btnHistorial.type = 'button';
            btnHistorial.className = 'btn-accion historial';
            btnHistorial.setAttribute('data-tooltip', 'Ver histórico');
            btnHistorial.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>`;
            btnHistorial.addEventListener('click', () => verHistorico(a.IdActivoFijoEQ, a.NoSerie));
            celda.appendChild(btnHistorial);

            if (puedeAcceder('af-act:restaurar')) {
                const btnRestaurar = document.createElement('button');
                btnRestaurar.type = 'button';
                btnRestaurar.className = 'btn-accion restaurar';
                btnRestaurar.setAttribute('data-tooltip', 'Restaurar');
                btnRestaurar.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>`;
                btnRestaurar.addEventListener('click', () => restaurarActivo(a.IdActivoFijoEQ, a.NoSerie));
                celda.appendChild(btnRestaurar);
            }

            if (puedeAcceder('af-act:eliminar')) {
                const btnDefinitivo = document.createElement('button');
                btnDefinitivo.type = 'button';
                btnDefinitivo.className = 'btn-accion definitivo';
                btnDefinitivo.setAttribute('data-tooltip', 'Eliminar definitivamente');
                btnDefinitivo.setAttribute('data-permiso', 'af-act:eliminar');
                btnDefinitivo.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M14.5 9.5l-5 5M9.5 9.5l5 5"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>`;
                btnDefinitivo.addEventListener('click', () => eliminarDefinitivoActivo(a.IdActivoFijoEQ, a.NoSerie));
                celda.appendChild(btnDefinitivo);
            }


            tablaBody.appendChild(tr);
            return;
        }

        if (puedeAcceder('af-act:editar')) {
            const btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'btn-accion editar';
            btnEditar.setAttribute('data-tooltip', 'Editar');
            btnEditar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>`;
            btnEditar.addEventListener('click', () => abrirEdicion(a.IdActivoFijoEQ));
            celda.appendChild(btnEditar);
        }

        const btnHistorial = document.createElement('button');
        btnHistorial.type = 'button';
        btnHistorial.className = 'btn-accion historial';
        btnHistorial.setAttribute('data-tooltip', 'Ver histórico');
        btnHistorial.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>`;
        btnHistorial.addEventListener('click', () => verHistorico(a.IdActivoFijoEQ, a.NoSerie));
        celda.appendChild(btnHistorial);

        if (puedeAcceder('af-act:eliminar')) {
            const btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'btn-accion eliminar';
            btnEliminar.setAttribute('data-tooltip', 'Dar de baja');
            btnEliminar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                    <path d="M10 11v6M14 11v6"></path>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>`;
            btnEliminar.addEventListener('click', () => eliminarActivo(a.IdActivoFijoEQ));
            celda.appendChild(btnEliminar);
        }

        tablaBody.appendChild(tr);
    });
}

/* =========================================================
   EXPORTAR A EXCEL (inventario general por cartera)
   ---------------------------------------------------------
   Un solo libro: hoja "Resumen" + una hoja por cartera ("Sin cartera"
   incluida). Los equipos con piezas conectadas suman un renglón por
   pieza, colgado del hostname (o la serie) del activo padre, así el
   Excel se filtra igual que la tabla del inventario.
   ========================================================= */
btnExportar.addEventListener('click', async () => {
    if (!activos || activos.length === 0) {
        toastError('Sin datos', 'No hay activos para exportar.');
        return;
    }

<<<<<<< Updated upstream
    const opcionesTipo = tipos.map(t => `<option value="${t.IdTipo}">${t.Nombre}</option>`).join('');

    const { value: idTipo, isConfirmed } = await Swal.fire({
        title: 'Exportar a Excel',
        html: `
            <p style="font-size:0.9rem; color:#575347; margin-bottom:15px;">
                Selecciona el tipo de activo. El Excel se generará con las columnas exactas que necesita ese tipo.
            </p>
            <select id="swal-tipo-export" class="export-tipo-select">
                <option value="">Todos los tipos (Reporte General)</option>
                ${opcionesTipo}
            </select>
        `,
        showCloseButton: true,
        confirmButtonText: 'Generar Excel',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled'
        },
        preConfirm: () => {
            return document.getElementById('swal-tipo-export').value;
        }
    });

    if (!isConfirmed) return;

    /* Reporte aplanado: cada activo en su fila y, debajo, una fila por cada
       pieza conectada (monitor, disco, teclado...). */
    const filasInventario = filasConPiezas(activos);

    let filasExport = [];
    let columnas = [];
    let tituloReporte = 'Inventario_General';

    if (idTipo) {
        // Filtrar por tipo
        const tipoSel = tipos.find(t => t.IdTipo == idTipo);
        tituloReporte = `Inventario_${tipoSel.Nombre.replace(/\s+/g, '_')}`;

        /* El filtro es por el TIPO DE CADA FILA, no por el tipo del activo:
           un monitor (como un disco, teclado o ratón) no es un activo, cuelga
           de un equipo como pieza conectada. Filtrar sólo los activos dejaba
           el reporte de monitores casi vacío aunque los equipos tuvieran
           monitores registrados. */
        filasExport = filasInventario.filter(f => tipoCoincide(f.Tipo, tipoSel.Nombre));

        if (filasExport.length === 0) {
            toastError('Sin datos', `No hay activos ni piezas conectadas de tipo "${tipoSel.Nombre}".`);
            return;
        }

      
        columnas = [
            { header: 'No. Serie', key: 'NoSerie', width: 20 },
            { header: 'Marca', key: 'Marca', width: 15 },
            { header: 'Modelo', key: 'Modelo', width: 20 },
            { header: 'Tipo', key: 'Tipo', width: 15 },
            { header: 'Estado', key: 'Estado', width: 15 },
            { header: 'Estatus', key: 'Estatus', width: 15 }
        ];

     
        if (tipoSel.RequiereIMEI) {
            columnas.push({ header: 'IMEI 1', key: 'IMEI1', width: 20 });
            columnas.push({ header: 'IMEI 2', key: 'IMEI2', width: 20 });
        }
        if (tipoSel.RequiereTelefono) columnas.push({ header: 'Teléfono', key: 'NoTelefono', width: 15 });
        if (tipoSel.RequiereSitio) columnas.push({ header: 'Sitio', key: 'Sitio', width: 15 });
        if (tipoSel.RequiereSubtipo) columnas.push({ header: 'Subtipo', key: 'Subtipo', width: 15 });
        if (tipoSel.RequiereClasificacion) columnas.push({ header: 'Clasificación', key: 'Clasificacion', width: 15 });
        if (tipoSel.RequiereTamanio) columnas.push({ header: 'Tamaño', key: 'Tamanio', width: 15 });
        if (tipoSel.RequiereCapacidad) columnas.push({ header: 'Capacidad', key: 'Capacidad', width: 15 });
        if (tipoSel.RequiereVoltaje) columnas.push({ header: 'Voltaje', key: 'Voltaje', width: 15 });
        if (tipoSel.RequiereUsuarioAsignado) columnas.push({ header: 'Usuario Asignado', key: 'UsuarioAsignado', width: 25 });
        if (tipoSel.RequierePrecio) columnas.push({ header: 'Precio', key: 'PrecioActivo', width: 15 });
        if (tipoSel.RequiereEspecificaciones) {
            columnas.push({ header: 'Procesador', key: 'Procesador', width: 20 });
            columnas.push({ header: 'RAM', key: 'MemoriaRAM', width: 15 });
            columnas.push({ header: 'Almacenamiento', key: 'Almacenamiento', width: 20 });
            columnas.push({ header: 'S.O.', key: 'SistemaOperativo', width: 20 });
        }
        if (tipoSel.RequiereAccesorios) columnas.push({ header: 'Accesorios', key: 'Accesorios', width: 25 });

        columnas.push({ header: 'Cartera', key: 'Cartera', width: 15 });

    } else {
      
        filasExport = filasInventario;
        columnas = [
            { header: 'No. Serie', key: 'NoSerie', width: 20 },
            { header: 'Marca', key: 'Marca', width: 15 },
            { header: 'Modelo', key: 'Modelo', width: 20 },
            { header: 'Tipo', key: 'Tipo', width: 15 },
            { header: 'Estado', key: 'Estado', width: 15 },
            { header: 'Estatus', key: 'Estatus', width: 15 },
            { header: 'IMEI 1', key: 'IMEI1', width: 20 },
            { header: 'Teléfono', key: 'NoTelefono', width: 15 },
            { header: 'Cartera', key: 'Cartera', width: 15 },
            { header: 'Sitio', key: 'Sitio', width: 15 },
            { header: 'Usuario Asignado', key: 'UsuarioAsignado', width: 25 }
        ];
    }

   
    /* Las dos únicas columnas de "piezas": de qué activo cuelga cada fila.
       No se abren columnas por tipo de pieza; cada pieza va en su renglón
       con su serie, marca y modelo en las columnas normales. */
    columnas.push(COL_PADRE_SERIE, COL_PADRE_HOST);

    /* Recuento del reporte: los renglones con el padre lleno son piezas
       conectadas; el resto son activos. Así el aviso sirve tanto para el
       reporte general como para uno filtrado por tipo (que puede traer
       sólo piezas, p. ej. el de monitores). */
    const totalPiezas = filasExport.filter(f => f[COL_PADRE_SERIE.key]).length;
    const totalActivos = filasExport.length - totalPiezas;
    const resumenFilas = totalPiezas
        ? (totalActivos
            ? `<strong>${totalActivos}</strong> activo(s) más <strong>${totalPiezas}</strong> pieza(s) conectada(s)`
            : `<strong>${totalPiezas}</strong> pieza(s) conectada(s)`)
        : `<strong>${totalActivos}</strong> activo(s)`;

    const confirm = await Swal.fire({
        icon: 'question',
        title: '¿Generar Excel?',
        html: `Se exportarán ${resumenFilas} con <strong>${columnas.length}</strong> columnas.<br>`
            + `<small>Cada pieza va en su propia fila, con el No. Serie y el hostname del activo al que pertenece.</small>`,
=======
    const carteras = new Set(activos.map(a => String(a.Cartera || '').trim() || 'Sin cartera'));
    const conPiezas = activos.filter(a => Number(a.Piezas) > 0).length;

    const confirm = await Swal.fire({
        icon: 'question',
        title: 'Exportar inventario general',
        html: `
            <p style="font-size:0.9rem; color:#575347; margin-bottom:12px;">
                Un solo archivo con <strong>una hoja por cartera</strong>
                (<strong>${carteras.size}</strong>) más la hoja de resumen.
                Los <strong>${conPiezas}</strong> equipos con piezas conectadas
                incluyen un renglón extra por pieza, referenciando su hostname.
            </p>
        `,
>>>>>>> Stashed changes
        showCloseButton: true,
        confirmButtonText: 'Generar Excel',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled'
        }
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
        title: 'Generando Excel...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });

    try {
<<<<<<< Updated upstream
        const payload = {
            titulo: tituloReporte,
            columnas: columnas,
            datos: filasExport
        };

        const res = await window.api.activoFijo.activos.exportarExcel(payload);
=======
        const res = await window.api.activoFijo.activos.exportarExcel();
>>>>>>> Stashed changes
        Swal.close();

        if (res && res.ok) {
            const extra = Number(res.hojas?.length)
                ? `<br>Hojas: <strong>${res.hojas.length}</strong> · Registros: <strong>${res.registros ?? 0}</strong>`
                : '';
            await Swal.fire({
                icon: 'success',
                title: 'Excel generado',
                html: `Se guardó en:<br><code style="background:#FFF7E8;padding:4px 8px;border-radius:6px;color:#2E3228;word-break:break-all;font-size:0.82rem;">${escaparHTML(res.ruta)}</code>${extra}`,
                showCloseButton: true,
                confirmButtonText: 'Aceptar',
                buttonsStyling: false,
                customClass: {
                    popup: 'cl-confirm',
                    confirmButton: 'swal2-confirm swal2-styled'
                }
            });
        } else if (res && res.mensaje === 'Cancelado') {
            // Cancelado
        } else {
            toastError('No se pudo exportar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        Swal.close();
        toastError('Error al exportar', err.message);
    }
});

/* =========================================================
   RESTO DE FUNCIONES (Ver, Editar, Guardar, Eliminar, Restaurar)
   ========================================================= */

async function respuestaPiezas(id) {
    try {
        const res = await window.api.activoFijo.activos.componentes(id);
        if (res && res.ok !== false && Array.isArray(res.componentes)) {
         
            return Object.assign({}, res, {
                fuenteDisponible: !(res.fuentes && res.fuentes.componentes === false)
            });
        }
        return {
            ok: false,
            mensaje: (res && res.mensaje) || 'No se pudieron leer las piezas del equipo.',
            componentes: [],
            red: [], cuentas: [], programas: [], fuentes: {}
        };
    } catch (err) {
        return {
            ok: false,
            mensaje: err.message || 'No se pudieron leer las piezas.',
            componentes: [],
            red: [], cuentas: [], programas: [], fuentes: {}
        };
    }
}

const GRUPOS_PIEZA = [
    { tipo: 'MONITOR', titulo: 'Monitores' },
    { tipo: 'DISCO',   titulo: 'Discos duros' },
    { tipo: 'TECLADO', titulo: 'Teclados' },
    { tipo: 'RATON',   titulo: 'Ratones / apuntadores' }
];


function totalPiezas(piezas) {
    return (Array.isArray(piezas) ? piezas : [])
        .reduce((n, p) => n + (Number(p.Cantidad) > 0 ? Number(p.Cantidad) : 1), 0);
}


function contarPorTipo(piezas) {
    const cuenta = new Map();
    for (const p of Array.isArray(piezas) ? piezas : []) {
        const t = String(p.TipoComponente || 'OTRO').toUpperCase();
        const n = Number(p.Cantidad) > 0 ? Number(p.Cantidad) : 1;
        cuenta.set(t, (cuenta.get(t) || 0) + n);
    }
    return cuenta;
}


function resumenPiezas(piezas) {
    const cuenta = contarPorTipo(piezas);
    const partes = [];
    for (const g of GRUPOS_PIEZA) {
        const n = cuenta.get(g.tipo) || 0;
        if (n) { partes.push(pluralPieza(n, g.tipo)); cuenta.delete(g.tipo); }
    }
    for (const [tipo, n] of cuenta) partes.push(pluralPieza(n, tipo));
    return partes.join(', ');
}

function claseConfianzaPieza(valor) {
    const c = String(valor || '').toLowerCase();
    return (c === 'alta' || c === 'media') ? c : 'baja';
}


function filaPieza(p) {
    const conf = String(p.Confianza || 'baja').toLowerCase();
    return `<tr>
        <td>${escaparHTML(p.Marca || '—')}</td>
        <td>${escaparHTML(p.Modelo || '—')}</td>
        <td class="mono">${escaparHTML(p.Serie || '—')}</td>
        <td class="mono">${escaparHTML(p.Identificador || '—')}</td>
        <td><span class="conf-pieza ${claseConfianzaPieza(conf)}">${escaparHTML(conf)}</span></td>
        <td class="num">${escaparHTML(p.Cantidad === null || p.Cantidad === undefined ? 1 : p.Cantidad)}</td>
    </tr>`;
}


function seccionPiezas(resPiezas, noSerie) {
    const piezas = Array.isArray(resPiezas && resPiezas.componentes) ? resPiezas.componentes : [];
    if (!piezas.length) {
      
        if (resPiezas && resPiezas.fuenteDisponible === false) {
            return `
                <div class="ver-seccion">
                    <div class="ver-seccion-titulo">Piezas conectadas</div>
                    <div class="ver-aviso">
                        La tabla <code>dbo.ActivoFijoEquiposComponentes</code> no existe todavía,
                        así que este equipo no puede mostrar sus piezas.
                    </div>
                </div>`;
        }
        return '';
    }

    const porTipo = new Map();
    for (const p of piezas) {
        const t = String(p.TipoComponente || 'OTRO').toUpperCase();
        if (!porTipo.has(t)) porTipo.set(t, []);
        porTipo.get(t).push(p);
    }

    const bloques = [];
    const usados = new Set();

    const bloque = (titulo, lista) => `
        <div class="ver-piezas-grupo">
            <div class="ver-piezas-subtitulo">${escaparHTML(titulo)} <span class="pill-mini">${totalPiezas(lista)}</span></div>
            <table class="ver-piezas-tabla">
                <thead>
                    <tr>
                        <th>Marca</th>
                        <th>Modelo</th>
                        <th>No. Serie</th>
                        <th>Identificador</th>
                        <th>Confianza</th>
                        <th class="num">Cant.</th>
                    </tr>
                </thead>
                <tbody>${lista.map(filaPieza).join('')}</tbody>
            </table>
        </div>`;

    for (const g of GRUPOS_PIEZA) {
        const lista = porTipo.get(g.tipo) || [];
        usados.add(g.tipo);
        if (lista.length) bloques.push(bloque(g.titulo, lista));
    }

    for (const [tipo, lista] of porTipo) {
        if (usados.has(tipo)) continue;
        bloques.push(bloque('Otros componentes (' + tipo + ')', lista));
    }

    const total = totalPiezas(piezas);
    return `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Piezas conectadas (${total})</div>
            <div class="ver-aviso">
                Este equipo cuenta como <strong>1</strong> en el inventario.
                <strong>${total === 1 ? 'Su única pieza cuelga' : `Sus ${total} piezas cuelgan`}</strong>
                de él${noSerie ? ' por NoSerie <code>' + escaparHTML(noSerie) + '</code>' : ''}
                y <strong>${total === 1 ? 'no se lista' : 'no se listan'} como activo${total === 1 ? '' : 's'} aparte${total === 1 ? '' : 's'}</strong>
                (${escaparHTML(resumenPiezas(piezas))}).
            </div>
            <div class="ver-piezas">${bloques.join('')}</div>
            <div class="ver-nota">
                Sólo da de baja el equipo cuando se reemplace o se deseche: si lo borras antes,
                sus piezas quedan apuntando a un activo que ya no existe (incongruencia en la BD).
                Al desconectar una pieza, la siguiente recolección la marca como no vigente sin borrarla.
            </div>
        </div>`;
}

/* =========================================================
   RED (WiFi / Ethernet), CUENTAS Y PROGRAMAS
   ========================================================= */

const PATRON_WIFI = /wi[\s_-]*fi|wireless|wlan/i;

function esAdaptadorWifi(fila) {
    const r = fila || {};
    return PATRON_WIFI.test(String(r.TipoMedio || ''))
        || PATRON_WIFI.test(String(r.NombreAdaptador || ''))
        || PATRON_WIFI.test(String(r.DescripcionAdaptador || ''));
}

/** Celda simple: vacío se lee como raya, nunca como hueco. */
function celdaVer(valor, clase) {
    const v = (valor === null || valor === undefined || valor === '') ? '—' : valor;
    return `<td${clase ? ` class="${clase}"` : ''}>${escaparHTML(v)}</td>`;
}

/* Sí / No como insignia: el "No" también se pinta como badge tenue para que
   la columna se lea en vertical de un golpe. La raya sigue en gris. */
function celdaSiNo(valor, textoSi, textoNo, claseSi) {
    if (valor) return `<td><span class="pill-mini ${claseSi || ''}">${escaparHTML(textoSi)}</span></td>`;
    if (textoNo === '—') return `<td><span class="ver-tenue">—</span></td>`;
    return `<td><span class="pill-mini pill-mini-tenue">${escaparHTML(textoNo)}</span></td>`;
}

/** Tabla con scroll horizontal: nunca rompe las proporciones del modal. */
function tablaVer(cabeceras, filasHtml) {
    return `
        <div class="ver-tabla-scroll">
            <table class="ver-piezas-tabla">
                <thead><tr>${cabeceras.map(c => `<th${c.num ? ' class="num"' : ''}>${escaparHTML(c.titulo)}</th>`).join('')}</tr></thead>
                <tbody>${filasHtml}</tbody>
            </table>
        </div>`;
}


function prefijoAMascara(prefijo) {
    const n = Number(prefijo);
    if (!Number.isInteger(n) || n < 0 || n > 32) return '';
    const octetos = [];
    for (let i = 0; i < 4; i++) {
        const bits = Math.min(Math.max(n - i * 8, 0), 8);
        octetos.push(256 - Math.pow(2, 8 - bits));
    }
    return octetos.join('.');
}

function mascaraRed(r) {
    const fila = r || {};
    const prefijo = (fila.PrefijoRed === null || fila.PrefijoRed === undefined)
        ? ''
        : String(fila.PrefijoRed).trim();
    const decimal = fila.Mascara ? String(fila.Mascara).trim() : prefijoAMascara(prefijo);

    if (decimal && prefijo) return `${decimal} (/${prefijo})`;
    if (decimal)            return decimal;
    return prefijo ? `/${prefijo}` : '';
}

function dnsRed(r) {
    return [r.DNS1, r.DNS2].filter(Boolean).join(' · ');
}

function filaRed(r) {
    const adaptador = r.NombreAdaptador || r.DescripcionAdaptador || r.Clave || '—';
    return `<tr>
        ${celdaVer(r.Hostname, 'mono')}
        ${celdaVer(adaptador)}
        ${celdaVer(r.IP, 'mono')}
        ${celdaVer(r.MAC, 'mono')}
        ${celdaVer(mascaraRed(r), 'mono')}
        ${celdaVer(r.PuertaEnlace, 'mono')}
        ${celdaVer(dnsRed(r), 'mono')}
        ${celdaSiNo(r.DHCP, 'Sí', 'No')}
        ${celdaVer(r.Dominio)}
        ${celdaSiNo(r.EsPrincipal, 'Principal', '—', 'pill-mini-ok')}
    </tr>`;
}

const CABECERAS_RED = [
    { titulo: 'Hostname' }, { titulo: 'Adaptador' }, { titulo: 'IP' }, { titulo: 'MAC' },
    { titulo: 'Máscara' }, { titulo: 'Puerta de enlace' }, { titulo: 'DNS' },
    { titulo: 'DHCP' }, { titulo: 'Dominio' }, { titulo: 'Principal' }
];


function adaptadorPrincipal(red) {
    const lista = Array.isArray(red) ? red : [];
    return lista.find(r => r.EsPrincipal) || lista[0] || null;
}


function seccionConexion(red) {
    const p = adaptadorPrincipal(red);
    const items = [
        ['Hostname', p ? p.Hostname : ''],
        ['IP', p ? p.IP : ''],
        ['MAC', p ? p.MAC : ''],
        ['Máscara', p ? mascaraRed(p) : ''],
        ['Puerta de enlace', p ? p.PuertaEnlace : ''],
        ['DNS', p ? dnsRed(p) : ''],
        ['DHCP', p ? (p.DHCP ? 'Sí' : 'No') : ''],
        ['Dominio', p ? p.Dominio : ''],
        ['Sufijo DNS', p ? p.DNSSufijo : ''],
        ['Adaptador', p ? (p.NombreAdaptador || p.DescripcionAdaptador || p.Clave) : ''],
        ['Última detección', p ? formatearFecha(p.UltimaDeteccion) : '']
    ];

 
    const COPIABLES = new Set(['Hostname', 'IP', 'MAC', 'Máscara', 'Puerta de enlace', 'DNS', 'Dominio']);

    const filas = items.map(([etiqueta, valor]) => {
        const vacio = (valor === null || valor === undefined || valor === '');
        const texto = vacio ? '—' : String(valor);
        let contenido;

        if (etiqueta === 'DHCP') {
            contenido = vacio
                ? '<span class="ver-tenue">—</span>'
                : `<span class="pill-mini ${valor === 'Sí' ? 'pill-mini-ok' : 'pill-mini-tenue'}">${escaparHTML(texto)}</span>`;
        } else if (COPIABLES.has(etiqueta) && !vacio) {
            contenido = `<button type="button" class="copiable" data-copiar-texto="${escaparHTML(texto)}" data-tooltip="Copiar">${escaparHTML(texto)}</button>`;
        } else {
            contenido = escaparHTML(texto);
        }

        return `<div class="ver-item"><span class="ver-label">${escaparHTML(etiqueta)}</span><span class="ver-valor">${contenido}</span></div>`;
    }).join('');

    return `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Conexión principal</div>
            <div class="ver-grid">${filas}</div>
            ${p ? '' : '<div class="ver-tenue">Sin adaptador principal: el colector todavía no reporta red para este equipo.</div>'}
        </div>`;
}

function seccionRed(res) {
    const fuentes = (res && res.fuentes) || {};
    const red = Array.isArray(res && res.red) ? res.red : [];

    if (fuentes.red === false) {
        return `
            <div class="ver-seccion">
                <div class="ver-seccion-titulo">Red (WiFi y Ethernet)</div>
                <div class="ver-aviso">
                    La tabla <code>dbo.ActivoFijoEquiposRed</code> no existe todavía,
                    así que este equipo no puede mostrar sus adaptadores de red.
                </div>
            </div>`;
    }
    if (!red.length) {
        return `
            <div class="ver-seccion">
                <div class="ver-seccion-titulo">Red (WiFi y Ethernet)</div>
                <div class="ver-tenue">Sin adaptadores de red registrados para este equipo.</div>
            </div>`;
    }

    const wifi = red.filter(esAdaptadorWifi);
    const cable = red.filter(r => !esAdaptadorWifi(r));

    const grupo = (titulo, lista) => (lista.length ? `
        <div class="ver-piezas-grupo">
            <div class="ver-piezas-subtitulo">${escaparHTML(titulo)} <span class="pill-mini">${lista.length}</span></div>
            ${tablaVer(CABECERAS_RED, lista.map(filaRed).join(''))}
        </div>` : '');

    return `
        ${seccionConexion(red)}
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Adaptadores (WiFi y Ethernet)</div>
            <div class="ver-piezas">
                ${grupo('WiFi', wifi)}
                ${grupo('Ethernet / cable', cable)}
            </div>
            <div class="ver-nota">
                Datos reportados por el colector en su última recolección.
                Sólo se muestran los adaptadores vigentes.
            </div>
        </div>`;
}

function filaCuenta(c) {
    const esDominio = String(c.TipoCuenta || '').toUpperCase() === 'DOMINIO';
    return `<tr>
        ${celdaVer(c.Cuenta, 'mono')}
        <td>${esDominio
            ? '<span class="pill-mini">Dominio</span>'
            : '<span class="pill-mini pill-mini-tenue">Local</span>'}</td>
        ${celdaVer(c.NombreCompleto)}
        ${celdaSiNo(c.Habilitada, 'Sí', 'No', 'pill-mini-ok')}
        ${celdaVer(formatearFecha(c.UltimoAcceso))}
        ${celdaSiNo(c.EsCuentaSesion, 'En sesión', '—', 'pill-mini-ok')}
    </tr>`;
}

function seccionCuentas(res) {
    const fuentes = (res && res.fuentes) || {};
    const cuentas = Array.isArray(res && res.cuentas) ? res.cuentas : [];

    if (fuentes.cuentas === false) {
        return `
            <div class="ver-seccion">
                <div class="ver-seccion-titulo">Cuentas</div>
                <div class="ver-aviso">
                    La tabla <code>dbo.ActivoFijoEquiposCuentas</code> no existe todavía,
                    así que este equipo no puede mostrar sus cuentas.
                </div>
            </div>`;
    }
    if (!cuentas.length) {
        return `
            <div class="ver-seccion">
                <div class="ver-seccion-titulo">Cuentas</div>
                <div class="ver-tenue">Sin cuentas registradas para este equipo.</div>
            </div>`;
    }

    const cabeceras = [
        { titulo: 'Cuenta' }, { titulo: 'Tipo' }, { titulo: 'Nombre completo' },
        { titulo: 'Habilitada' }, { titulo: 'Último acceso' }, { titulo: 'Sesión' }
    ];
    return `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Cuentas (${cuentas.length})</div>
            ${tablaVer(cabeceras, cuentas.map(filaCuenta).join(''))}
        </div>`;
}

function filaPrograma(p) {
    const alcance = String(p.Alcance || '').toUpperCase();
  
    const buscar = [p.Programa, p.Version, p.Fabricante, p.Cuenta, alcance]
        .filter(Boolean).join(' ').toLowerCase();
    return `<tr data-buscar="${escaparHTML(buscar)}">
        ${celdaVer(p.Programa)}
        ${celdaVer(p.Version, 'mono')}
        ${celdaVer(p.Fabricante)}
        ${celdaVer(formatearFecha(p.FechaInstalacion))}
        <td>${alcance === 'USUARIO'
            ? '<span class="pill-mini pill-mini-tenue">Usuario</span>'
            : '<span class="pill-mini">Equipo</span>'}</td>
        ${celdaVer(p.Cuenta, 'mono')}
    </tr>`;
}


function seccionProgramas(res) {
    const fuentes = (res && res.fuentes) || {};
    const programas = Array.isArray(res && res.programas) ? res.programas : [];

    if (fuentes.programas === false) {
        return `
            <div class="ver-seccion">
                <div class="ver-seccion-titulo">Programas</div>
                <div class="ver-aviso">
                    La tabla <code>dbo.ActivoFijoEquiposProgramas</code> no existe todavía,
                    así que este equipo no puede mostrar su software.
                </div>
            </div>`;
    }
    if (!programas.length) {
        return `
            <div class="ver-seccion">
                <div class="ver-seccion-titulo">Programas</div>
                <div class="ver-tenue">Sin programas registrados para este equipo.</div>
            </div>`;
    }

    const cabeceras = [
        { titulo: 'Programa' }, { titulo: 'Versión' }, { titulo: 'Fabricante' },
        { titulo: 'Instalación' }, { titulo: 'Alcance' }, { titulo: 'Cuenta' }
    ];
    return `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Programas (${programas.length})</div>
            <div class="ver-buscador">
                <svg class="ver-buscador-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="search" class="ver-buscador-input"
                       data-filtro-programas
                       placeholder="Filtrar por programa, versión, fabricante o cuenta…"
                       aria-label="Filtrar programas"
                       autocomplete="off" spellcheck="false">
                <span class="pill-mini ver-buscador-cuenta" data-filtro-programas-cuenta></span>
                <button type="button" class="ver-buscador-limpiar oculto"
                        data-filtro-programas-limpiar data-tooltip="Limpiar filtro" aria-label="Limpiar filtro">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="ver-tabla-scroll ver-tabla-alta">
                <table class="ver-piezas-tabla">
                    <thead><tr>${cabeceras.map(c => `<th>${escaparHTML(c.titulo)}</th>`).join('')}</tr></thead>
                    <tbody data-filtro-programas-body>${programas.map(filaPrograma).join('')}</tbody>
                </table>
            </div>
            <div class="ver-tenue ver-buscador-vacio oculto" data-filtro-programas-vacio>
                Ningún programa coincide con el filtro.
            </div>
        </div>`;
}

/* =========================================================
   PÁGINA "ENVÍOS" 
   ========================================================= */
function seccionEnvios(res) {
    const lotes = Array.isArray(res && res.lotes) ? res.lotes : [];
    if (!lotes.length) {
        return `
            <div class="ver-seccion">
                <div class="ver-seccion-titulo">Envíos del colector</div>
                <div class="ver-tenue">Sin envíos registrados para este equipo.</div>
            </div>`;
    }

    const cabeceras = [
        { titulo: 'Lote' }, { titulo: 'Red', num: true }, { titulo: 'Cuentas', num: true },
        { titulo: 'Programas', num: true }, { titulo: 'Piezas', num: true },
        { titulo: 'Primera detección' }, { titulo: 'Última detección' }
    ];
    const numero = (valor) => `<td class="num">${escaparHTML(valor === null || valor === undefined ? 0 : valor)}</td>`;
    const filas = lotes.map(l => `<tr>
        ${celdaVer(l.LoteEnvio, 'mono')}
        ${numero(l.Red)}
        ${numero(l.Cuentas)}
        ${numero(l.Programas)}
        ${numero(l.Componentes)}
        ${celdaVer(formatearFecha(l.PrimeraDeteccion))}
        ${celdaVer(formatearFecha(l.UltimaDeteccion))}
    </tr>`).join('');

    return `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Envíos del colector (${lotes.length})</div>
            ${tablaVer(cabeceras, filas)}
            <div class="ver-nota">
                Cada envío es una recolección completa del equipo: lo que ya no aparece
                en el envío siguiente queda como no vigente, sin borrarse del histórico.
            </div>
        </div>`;
}

/* =========================================================
   FICHA TÉCNICA PAGINADA (modal "Ver")
   ========================================================= */

function htmlFichaTecnica(paginas) {
    const tabs = paginas.map((p, i) => `
        <button type="button"
                class="ver-tab${i === 0 ? ' activo' : ''}"
                data-ver-pagina="${escaparHTML(p.id)}"
                role="tab"
                aria-selected="${i === 0 ? 'true' : 'false'}">
            ${escaparHTML(p.titulo)}
            ${p.cuenta ? `<span class="pill-mini">${escaparHTML(p.cuenta)}</span>` : ''}
        </button>`).join('');

    const paneles = paginas.map((p, i) => `
        <div class="ver-pagina${i === 0 ? ' activo' : ''}"
             data-ver-panel="${escaparHTML(p.id)}"
             role="tabpanel"
             aria-label="${escaparHTML(p.titulo)}">${p.html}</div>`).join('');

    return `
        <div class="ver-ficha">
            <div class="ver-tabs" role="tablist">${tabs}</div>
            <div class="ver-paginas">${paneles}</div>
        </div>`;
}

function engancharPaginasFicha(popup) {
    if (!popup) return;
    const tabs = Array.from(popup.querySelectorAll('[data-ver-pagina]'));
    const paneles = Array.from(popup.querySelectorAll('[data-ver-panel]'));
    const contenedor = popup.querySelector('.ver-paginas');

    const mostrar = (id) => {
        tabs.forEach(t => {
            const activo = t.dataset.verPagina === id;
            t.classList.toggle('activo', activo);
            t.setAttribute('aria-selected', activo ? 'true' : 'false');
        });
        paneles.forEach(p => p.classList.toggle('activo', p.dataset.verPanel === id));
        /* Cada página arranca desde arriba: nunca hereda el scroll anterior. */
        if (contenedor) contenedor.scrollTop = 0;
    };

    tabs.forEach(t => t.addEventListener('click', () => mostrar(t.dataset.verPagina)));
}

/* =========================================================
   FILTRO RÁPIDO DE LA PÁGINA "PROGRAMAS"
   ========================================================= */
function engancharProgramasFicha(popup) {
    if (!popup) return;
    const input = popup.querySelector('[data-filtro-programas]');
    const cuerpo = popup.querySelector('[data-filtro-programas-body]');
    if (!input || !cuerpo) return;

    const filas = Array.from(cuerpo.querySelectorAll('tr'));
    const contador = popup.querySelector('[data-filtro-programas-cuenta]');
    const limpiar = popup.querySelector('[data-filtro-programas-limpiar]');
    const vacio = popup.querySelector('[data-filtro-programas-vacio]');

    const aplicar = () => {
        const q = input.value.trim().toLowerCase();
        let visibles = 0;
        filas.forEach(tr => {
            const coincide = !q || (tr.dataset.buscar || '').includes(q);
            tr.classList.toggle('oculto', !coincide);
            if (coincide) visibles++;
        });
        if (contador) {
            contador.textContent = q ? `${visibles} de ${filas.length}` : String(filas.length);
            contador.classList.toggle('oculto', filas.length === 0);
        }
        if (limpiar)  limpiar.classList.toggle('oculto', !q);
        if (vacio)    vacio.classList.toggle('oculto', visibles > 0);
    };

    input.addEventListener('input', aplicar);
    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        if (input.value) { input.value = ''; aplicar(); }
    });
    if (limpiar) {
        limpiar.addEventListener('click', () => {
            input.value = '';
            aplicar();
            input.focus();
        });
    }
    aplicar();
}

function engancharFicha(popup) {
    engancharPaginasFicha(popup);
    engancharProgramasFicha(popup);
    engancharCopiables(popup);
}

async function verActivo(id) {
    const a = activos.find(x => x.IdActivoFijoEQ === id);
    if (!a) { toastError('Activo no encontrado'); return; }

   
    Swal.fire({
        title: 'Leyendo la ficha del equipo…',
        allowOutsideClick: false,
        showConfirmButton: false,
        customClass: { popup: 'cl-ver' },
        didOpen: () => Swal.showLoading()
    });

    const resPiezas = await respuestaPiezas(id);
    const equipoFicha = (resPiezas && resPiezas.equipo) || {};
    const tipo = tipos.find(t => t.IdTipo === a.IdTipo) || {};

    const row = (etiqueta, valor) => {
        const val = (valor === null || valor === undefined || valor === '') ? '—' : valor;
        return `<div class="ver-item"><span class="ver-label">${escaparHTML(etiqueta)}</span><span class="ver-valor">${escaparHTML(val)}</span></div>`;
    };
    const rowBadge = (etiqueta, valor, claseBadge) => {
        if (!valor) return row(etiqueta, '—');
        return `<div class="ver-item"><span class="ver-label">${escaparHTML(etiqueta)}</span><span class="ver-valor"><span class="badge ${claseBadge}">${escaparHTML(valor)}</span></span></div>`;
    };

    const itemsIdent = [];
    itemsIdent.push(row('Tipo', a.Tipo));
    itemsIdent.push(row('Marca', a.Marca));
    itemsIdent.push(row('Modelo', a.Modelo));
    itemsIdent.push(row('No. Serie', a.NoSerie));
    if (tipo.RequiereIMEI) {
        if (a.IMEI1) itemsIdent.push(row('IMEI 1', a.IMEI1));
        if (a.IMEI2) itemsIdent.push(row('IMEI 2', a.IMEI2));
    }
    if (tipo.RequiereTelefono && a.NoTelefono) {
        itemsIdent.push(row('No. Teléfono', a.NoTelefono));
    }
    const seccionIdent = `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Identificación</div>
            <div class="ver-grid">${itemsIdent.join('')}</div>
        </div>
    `;

    const itemsUbi = [];
    if (tipo.RequiereSitio)           itemsUbi.push(row('Sitio', a.Sitio));
    if (tipo.RequiereSubtipo)         itemsUbi.push(row('Subtipo', a.Subtipo));
    if (tipo.RequiereClasificacion)   itemsUbi.push(row('Clasificación', a.Clasificacion));
    if (tipo.RequiereTamanio)         itemsUbi.push(row('Tamaño', a.Tamanio));
    if (tipo.RequiereCapacidad)       itemsUbi.push(row('Capacidad', a.Capacidad));
    if (tipo.RequiereVoltaje)         itemsUbi.push(row('Voltaje', a.Voltaje));
    if (tipo.RequiereUsuarioAsignado) itemsUbi.push(row('Usuario asignado', a.UsuarioAsignado));
    const seccionUbi = itemsUbi.length ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Ubicación y clasificación</div>
            <div class="ver-grid">${itemsUbi.join('')}</div>
        </div>
    ` : '';

    const itemsSit = [];
    itemsSit.push(rowBadge('Estado', a.Estado, 'badge-estado-' + a.Estado));
    itemsSit.push(rowBadge('Estatus', a.Estatus, 'badge-estatus-' + a.Estatus));
    itemsSit.push(row('Cartera', a.Cartera));
    if (tipo.RequierePrecio) itemsSit.push(row('Precio', formatearPrecio(a.PrecioActivo) || '—'));
    const seccionSit = `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Situación</div>
            <div class="ver-grid">${itemsSit.join('')}</div>
        </div>
    `;

    const itemsSpec = [];
    if (tipo.RequiereEspecificaciones) {
        if (a.Procesador)       itemsSpec.push(row('Procesador', a.Procesador));
        if (a.MemoriaRAM)       itemsSpec.push(row('Memoria RAM', a.MemoriaRAM));
        if (a.Almacenamiento)   itemsSpec.push(row('Almacenamiento', a.Almacenamiento));
    }
   
    if (a.SistemaOperativo)                  itemsSpec.push(row('Sistema Operativo', a.SistemaOperativo));
    if (equipoFicha && equipoFicha.BuildSO)  itemsSpec.push(row('Build del SO', equipoFicha.BuildSO));
    const seccionSpec = itemsSpec.length ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Especificaciones técnicas</div>
            <div class="ver-grid">${itemsSpec.join('')}</div>
        </div>
    ` : '';

    const seccionAcc = (tipo.RequiereAccesorios && a.Accesorios) ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Accesorios</div>
            <div class="ver-grid ver-grid-full">${row('Accesorios', a.Accesorios)}</div>
        </div>
    ` : '';

    const seccionObs = a.Observaciones ? `
        <div class="ver-seccion">
            <div class="ver-seccion-titulo">Observaciones</div>
            <div class="ver-observaciones">${escaparHTML(a.Observaciones)}</div>
        </div>
    ` : '';

    const meta = `
        <div class="ver-meta">
            Creado: ${escaparHTML(formatearFecha(a.FechaCreacion))} ·
            Última modificación: ${escaparHTML(formatearFecha(a.FechaModificacion))}
        </div>
    `;

   
    const seccionRedEquipo       = seccionRed(resPiezas);
    const seccionCuentasEquipo   = seccionCuentas(resPiezas);
    const seccionProgramasEquipo = seccionProgramas(resPiezas);
    const seccionPiezasEquipo = seccionPiezas(resPiezas, a.NoSerie);
    const nRed       = Array.isArray(resPiezas && resPiezas.red) ? resPiezas.red.length : 0;
    const nCuentas   = Array.isArray(resPiezas && resPiezas.cuentas) ? resPiezas.cuentas.length : 0;
    const nProgramas = Array.isArray(resPiezas && resPiezas.programas) ? resPiezas.programas.length : 0;
    const nPiezas    = totalPiezas(resPiezas && resPiezas.componentes);
    const nLotes     = Array.isArray(resPiezas && resPiezas.lotes) ? resPiezas.lotes.length : 0;

    const paginas = [
        {
            id: 'resumen',
            titulo: 'Resumen',
            cuenta: '',
            html: `${seccionIdent}${seccionUbi}${seccionSit}${seccionSpec}${seccionAcc}${seccionObs}${meta}`
        },
        { id: 'red',       titulo: 'Red',       cuenta: nRed,       html: seccionRedEquipo },
        { id: 'cuentas',   titulo: 'Cuentas',   cuenta: nCuentas,   html: seccionCuentasEquipo },
        { id: 'programas', titulo: 'Programas', cuenta: nProgramas, html: seccionProgramasEquipo }
    ];
    if (seccionPiezasEquipo) {
        paginas.push({ id: 'piezas', titulo: 'Piezas', cuenta: nPiezas, html: seccionPiezasEquipo });
    }
    if (nLotes) {
        paginas.push({ id: 'envios', titulo: 'Envíos', cuenta: nLotes, html: seccionEnvios(resPiezas) });
    }

    const tieneTablas = paginas.length > 1;

    Swal.fire({
        title: `Activo #${a.IdActivoFijoEQ} — ${escaparHTML(a.NoSerie || a.IMEI1 || a.NoTelefono || '')}`,
        html: htmlFichaTecnica(paginas),
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
            popup: tieneTablas ? 'cl-ver cl-ver-ficha cl-ver-datos' : 'cl-ver cl-ver-ficha'
        },
        didOpen: (popup) => engancharFicha(popup)
    });
}

/* =========================================================
   CAMBIO DE VISTA · INVENTARIO CATÁLOGOS
   ========================================================= */
function aplicarEstadoVista() {
    const enCatalogos = (vistaActual === 'catalogos');

    if (seccionInventario) seccionInventario.classList.toggle('oculto', enCatalogos);
    if (seccionCatalogos)  seccionCatalogos.classList.toggle('oculto', !enCatalogos);
    if (buscadorInventario) buscadorInventario.classList.toggle('oculto', enCatalogos);
    if (accionesInventario) accionesInventario.classList.toggle('oculto', enCatalogos);

    if (btnNuevo) {
        const bloqueado = (vistaActual === 'eliminados');
        btnNuevo.disabled = bloqueado;
        btnNuevo.style.opacity = bloqueado ? '0.5' : '';
    }

    tabsVista.querySelectorAll('.tab-vista').forEach(t => {
        t.classList.toggle('activo', t.dataset.vista === vistaActual);
    });
}

async function cambiarVista(vista, opciones = {}) {
    const nueva = (vista === 'catalogos') ? 'catalogos'
        : (vista === 'eliminados') ? 'eliminados'
        : 'activos';

    const saliendoDeCatalogos = (vistaActual === 'catalogos' && nueva !== 'catalogos');
    vistaActual = nueva;
    aplicarEstadoVista();

    try {
        history.replaceState(null, '', nueva === 'catalogos' ? '#catalogos' : '#inventario');
    } catch (_) { /* file:// sin historial disponible */ }

    if (nueva === 'catalogos') {
        CatalogosUI.mostrar();
        return;
    }

    CatalogosUI.ocultar();

    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    pagInventario.reiniciar();

  
    if (saliendoDeCatalogos && CatalogosUI.huboCambios()) {
        CatalogosUI.limpiarCambios();
        if (opciones.permiteInventario) await cargarCatalogos();
    }

    if (opciones.permiteInventario) await cargarActivos();
    else renderTabla();
}

tabsVista.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-vista');
    if (!btn || btn.classList.contains('activo')) return;

    cambiarVista(btn.dataset.vista, { permiteInventario: permiteInventario() });
});


engancharCopiables(tablaBody);

inputBusqueda.addEventListener('input', () => {
    filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
    btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
    pagInventario.reiniciar();
    renderTabla();
});

function limpiarBusqueda() {
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    pagInventario.reiniciar();
    renderTabla();
    inputBusqueda.focus();
}
btnLimpiarBusq.addEventListener('click', limpiarBusqueda);
btnLimpiarVacio.addEventListener('click', limpiarBusqueda);

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
modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') cerrarModal();
});

function poblarSubtipos(grupo, valorSeleccionado = '') {
    if (!grupo) {
        selSubtipo.innerHTML = '<option value="">— Selecciona un tipo primero —</option>';
        selSubtipo.disabled = true;
        return;
    }

    const filtrados = subtipos.filter(s => s.Grupo === grupo);

    if (filtrados.length === 0) {
        selSubtipo.innerHTML = '<option value="">— Sin subtipos disponibles —</option>';
        selSubtipo.disabled = true;
        return;
    }

    selSubtipo.disabled = false;
    selSubtipo.innerHTML = '<option value="">— Seleccionar —</option>' +
        filtrados.map(s => {
            const sel = String(valorSeleccionado) === String(s.IdSubtipo) ? 'selected' : '';
            return `<option value="${s.IdSubtipo}" ${sel}>${escaparHTML(s.Nombre)}</option>`;
        }).join('');
}

/* =========================================================
   CASCADA TIPO → CATÁLOGOS
   ---------------------------------------------------------
   Los catálogos se llenan con todo lo que alguna vez se capturó, así
   que la misma lista de marcas mezcla CPUs con monitores. Al elegir un
   Tipo el formulario ofrece sólo lo que ESE tipo usa de verdad, y lo
   deduce del propio inventario (backend `catalogoPorTipo`). Si un tipo
   todavía no tiene datos en una categoría se deja el catálogo completo,
   para no bloquear la captura de un equipo nuevo.
   ========================================================= */
function planCascada() {
    return [
        { clave: 'marcas',             select: selMarca,          registros: marcas, porId: true,  pk: 'IdMarca' },
        { clave: 'modelos',            select: inpModelo,         registros: catalogosEspecificaciones.modelos, porId: false },
        { clave: 'procesadores',       select: inpProcesador,     registros: catalogosEspecificaciones.procesadores, porId: false },
        { clave: 'memoriasRam',        select: inpRAM,            registros: catalogosEspecificaciones.memoriasRam, porId: false },
        { clave: 'almacenamientos',    select: inpAlmacenamiento, registros: catalogosEspecificaciones.almacenamientos, porId: false },
        { clave: 'sistemasOperativos', select: inpSO,             registros: catalogosEspecificaciones.sistemasOperativos, porId: false },
        { clave: 'voltajes',           select: selVoltaje,        registros: voltajes, porId: true,  pk: 'IdVoltaje' }
    ];
}

/* Deja el valor vigente en el select aunque el filtro ya no lo incluya:
   editar un equipo nunca debe perder su marca o su procesador. */
function restaurarSeleccion(select, valor, texto) {
    if (valor === null || valor === undefined || valor === '') {
        select.value = '';
        return;
    }
    if (!Array.from(select.options).some(o => o.value === String(valor))) {
        select.add(new Option(texto || String(valor), valor, true, true));
    }
    select.value = String(valor);
}

function aplicarCascada(res) {
    planCascada().forEach(cfg => {
        const select = cfg.select;
        const registros = cfg.registros || [];
        if (!select || registros.length === 0) return;

        const filas = (res && Array.isArray(res[cfg.clave])) ? res[cfg.clave] : [];
        const permitidos = filas.length
            ? new Set(filas.map(f => String(cfg.porId ? f.id : f.nombre).toUpperCase()))
            : null;

        const elegido = select.value;
        const elegidoTexto = select.selectedOptions && select.selectedOptions[0]
            ? select.selectedOptions[0].textContent
            : elegido;
        const vacio = select.options[0] ? select.options[0].textContent : '';

        const visibles = registros.filter(r => {
            if (!permitidos) return true;
            const clave = String(cfg.porId ? r[cfg.pk] : r.Nombre).toUpperCase();
            return permitidos.has(clave);
        });

        select.innerHTML = `<option value="">${escaparHTML(vacio)}</option>` +
            visibles.map(r => {
                const valor = cfg.porId ? r[cfg.pk] : r.Nombre;
                return `<option value="${escaparHTML(valor)}">${escaparHTML(r.Nombre)}</option>`;
            }).join('');

        restaurarSeleccion(select, elegido, elegidoTexto);
    });
}

/* Perfil real de cada tipo (cuántos de sus equipos tienen cada campo
   capturado). Lo llena la cascada desde el inventario; mientras no llegue
   o el tipo no tenga equipos, manda la bandera del catálogo. */
const perfilesTipo = new Map();

/* Requisitos efectivos de un tipo: el inventario manda y la bandera del
   catálogo sólo se usa como respaldo. Así el formulario deja de depender
   de que alguien mantenga al día las banderas de ActivoFijoTipos. */
function requisitosDeTipo(tipo) {
    const perfil = perfilesTipo.get(tipo.IdTipo);
    const claves = perfil && perfil.total > 0 ? (perfil.claves || {}) : null;

    const regla = (clave, bandera) => {
        const m = claves ? claves[clave] : null;
        if (!m) return { visible: !!bandera, obligatorio: !!bandera, medido: false };
        return {
            visible: m.usado || m.requerido || !!bandera,
            obligatorio: m.requerido,
            medido: true,
            usos: m.usos,
            total: m.total
        };
    };

    const nombre = String(tipo.Nombre ?? '').toUpperCase();

    return {
        medido: !!claves,
        marca:           regla('marca', false),
        modelo:          regla('modelo', false),
        serie:           regla('serie', false),
        imei:            regla('imei', tipo.RequiereIMEI),
        telefono:        regla('telefono', tipo.RequiereTelefono),
        sitio:           regla('sitio', tipo.RequiereSitio),
        subtipo:         regla('subtipo', tipo.RequiereSubtipo),
        clasificacion:   regla('clasificacion', tipo.RequiereClasificacion),
        tamanio:         regla('tamanio', tipo.RequiereTamanio),
        capacidad:       regla('capacidad', tipo.RequiereCapacidad),
        voltaje:         regla('voltaje', tipo.RequiereVoltaje),
        usuarioAsignado: regla('usuarioAsignado', tipo.RequiereUsuarioAsignado),
        precio:          regla('precio', tipo.RequierePrecio),
        especificaciones: regla('especificaciones', tipo.RequiereEspecificaciones),
        accesorios:      regla('accesorios', tipo.RequiereAccesorios),
        /* Caso de negocio: un disco externo sí se le entrega a alguien. */
        esAlmacenamiento: nombre === 'SSD NVME' || nombre === 'DISCO MECANICO'
    };
}

async function cargarCascadaTipo() {
    const idTipo = parseInt(selTipo.value, 10) || 0;
    const token = ++cascadaToken;

    /* Sin tipo no hay nada que filtrar: catálogos completos. */
    if (!idTipo) { aplicarCascada(null); return; }

    try {
        const res = await window.api.activoFijo.activos.cascadaTipo(idTipo);
        if (token !== cascadaToken) return; /* respuesta vieja: ya hay otro Tipo */
        aplicarCascada(res);

        /* El perfil real del tipo llega con la cascada: con él se afinan
           qué campos se muestran y cuáles son obligatorios. */
        if (res && res.perfil) {
            perfilesTipo.set(idTipo, res.perfil);
            const tipo = tipos.find(t => t.IdTipo === idTipo);
            if (tipo) aplicarRequisitos(tipo);
        }
    } catch (_) {
        /* Sin cascada se queda el catálogo completo: nunca bloquea la captura. */
    }
}

selTipo.addEventListener('change', actualizarCamposPorTipo);

function actualizarCamposPorTipo() {
    const idTipo = parseInt(selTipo.value, 10);
    const tipo = tipos.find(t => t.IdTipo === idTipo);

    const toggle = (selector, visible) => {
        document.querySelectorAll(selector).forEach(el => {
            el.classList.toggle('oculto', !visible);
        });
    };

    if (!tipo) {
        toggle('.campo-imei1', false);
        toggle('.campo-imei2', false);
        toggle('.campo-telefono', false);
        toggle('.campo-sitio', false);
        toggle('.campo-subtipo', false);
        toggle('.campo-clasificacion', false);
        toggle('.campo-tamanio', false);
        toggle('.campo-capacidad', false);
        toggle('.campo-voltaje', false);
        toggle('.campo-usuario-asignado', false);
        toggle('.campo-precio', false);
        toggle('.bloque-especificaciones', false);
        toggle('.campo-accesorios', false);
        poblarSubtipos(null);
        cargarCascadaTipo();
        return;
    }

    aplicarRequisitos(tipo);

    if (tipo.RequiereSubtipo) {
        poblarSubtipos(tipo.GrupoSubtipo);
    } else {
        poblarSubtipos(null);
    }

    /* Marca, modelo, procesador, RAM, almacenamiento, S.O. y voltaje se
       reducen a lo que este tipo realmente usa. */
    cargarCascadaTipo();
}

/* Muestra/oculta los campos del formulario con las reglas del tipo. El
   usuario asignado ya no depende de la bandera del catálogo: la casilla
   está siempre disponible (es opt-in) porque cualquier equipo puede
   entregarse a alguien. */
function aplicarRequisitos(tipo) {
    const reqs = requisitosDeTipo(tipo);

    const toggle = (selector, visible) => {
        document.querySelectorAll(selector).forEach(el => {
            el.classList.toggle('oculto', !visible);
        });
    };

    toggle('.campo-imei1', reqs.imei.visible);
    toggle('.campo-imei2', reqs.imei.visible);
    toggle('.campo-telefono', reqs.telefono.visible);
    toggle('.campo-sitio', reqs.sitio.visible);
    toggle('.campo-subtipo', reqs.subtipo.visible);
    toggle('.campo-clasificacion', reqs.clasificacion.visible);
    toggle('.campo-tamanio', reqs.tamanio.visible);
    toggle('.campo-capacidad', reqs.capacidad.visible);
    toggle('.campo-voltaje', reqs.voltaje.visible);
    toggle('.campo-precio', reqs.precio.visible);
    toggle('.bloque-especificaciones', reqs.especificaciones.visible);
    toggle('.campo-accesorios', reqs.accesorios.visible);

    /* La casilla de usuario asignado siempre se ofrece; lo que cambia es si
       el campo es obligatorio (bandera del catálogo / responsiva abierta). */
    toggle('.campo-usuario-asignado', true);
    actualizarUsuarioAsignado(tipo);

    return reqs;
}

selClasificacion.addEventListener('change', () => actualizarUsuarioAsignado());

function actualizarUsuarioAsignado(tipoActual = null) {
    const idTipo = parseInt(selTipo.value, 10);
    const tipo = tipoActual || tipos.find(t => t.IdTipo === idTipo);
    if (!tipo) return;

    /* El campo ya no se esconde: se deja disponible para cualquier tipo. */
    document.querySelector('.campo-usuario-asignado')?.classList.remove('oculto');

    const { esAlmacenamiento } = requisitosDeTipo(tipo);
    if (!esAlmacenamiento) return;

    /* En discos sólo tiene sentido entregarlo cuando es externo. */
    const idCla = parseInt(selClasificacion.value, 10);
    const cla = clasificaciones.find(c => c.IdClasificacion === idCla);
    const esExterno = !!cla && cla.Nombre.toUpperCase() === 'EXTERNO';
    if (!esExterno) {
        document.querySelector('.campo-usuario-asignado')?.classList.add('oculto');
    }
}

<<<<<<< Updated upstream

=======
/* =========================================================
   USUARIO ASIGNADO · casilla + buscador rápido
   ---------------------------------------------------------
   El catálogo de usuarios crece con cada alta, así que un <select>
   plano ya no se puede recorrer a ojo. La casilla deja el campo
   vacío por omisión (activo general) y, al marcarla, aparece el
   selector con un buscador que filtra por nombre mientras se escribe.
   ========================================================= */
function poblarUsuarios(filtro = '') {
    if (!inpUsuarioAsig) return;

    const texto = String(filtro || '').trim().toLowerCase();
    const registros = catalogosEspecificaciones.usuariosAsignados || [];
    const actual = inpUsuarioAsig.value;

    const visibles = registros.filter(u => !texto || String(u.Nombre ?? '').toLowerCase().includes(texto));

    inpUsuarioAsig.innerHTML = '<option value="">— Seleccionar usuario —</option>' +
        visibles.map(u => `<option value="${escaparHTML(u.Nombre)}">${escaparHTML(u.Nombre)}</option>`).join('');

    if (!actual) return;

    /* El usuario ya elegido no debe perderse porque el filtro no lo
       muestre: se reinserta para conservar la selección. */
    if (!visibles.some(u => String(u.Nombre) === actual)) {
        inpUsuarioAsig.add(new Option(actual, actual, true, true));
    }
    inpUsuarioAsig.value = actual;
}

/* La casilla es la única dueña de la visibilidad del selector. */
function aplicarVisibilidadUsuario() {
    const visible = !!chkUsuarioAsignado?.checked;
    if (usuarioPicker) usuarioPicker.classList.toggle('oculto', !visible);
    return visible;
}

chkUsuarioAsignado?.addEventListener('change', () => {
    if (aplicarVisibilidadUsuario()) {
        buscadorUsuario?.focus();
        return;
    }

    /* Se desmarca: el activo queda como general y sin usuario. */
    if (inpUsuarioAsig) inpUsuarioAsig.value = '';
    if (buscadorUsuario) buscadorUsuario.value = '';
    btnLimpiarUsuario?.classList.add('oculto');
    poblarUsuarios('');
});

buscadorUsuario?.addEventListener('input', () => {
    const texto = buscadorUsuario.value.trim();
    btnLimpiarUsuario?.classList.toggle('oculto', !texto);
    poblarUsuarios(texto);
});

btnLimpiarUsuario?.addEventListener('click', () => {
    if (buscadorUsuario) buscadorUsuario.value = '';
    btnLimpiarUsuario.classList.add('oculto');
    poblarUsuarios('');
    buscadorUsuario?.focus();
});

/* Un activo está "en uso" mientras tenga una responsiva abierta: su estatus
   y su usuario de inventario los mueve la responsiva (asignar / devolver),
   no el formulario. */
>>>>>>> Stashed changes
function activoEnUso(estatus) {
    const nombre = String(estatus ?? '').trim().toUpperCase();
    return nombre === 'ASIGNADO' || nombre === 'PENDIENTE';
}

<<<<<<< Updated upstream

=======
/* Candado del campo "Usuario asignado":
   - En uso: la casilla queda marcada y bloqueada, porque lo escribe la
     responsiva.
   - Activo libre: se puede desmarcar, que es la forma de devolverlo al
     inventario sin tener que borrar el activo. */
>>>>>>> Stashed changes
function aplicarEstadoUsuarioAsignado(enUso) {
    const asignado = !!String(inpUsuarioAsig?.value ?? '').trim();
    const marcado = !!enUso || asignado;

    if (chkUsuarioAsignado) {
        chkUsuarioAsignado.checked = marcado;
        chkUsuarioAsignado.disabled = !!enUso;
    }
    if (usuarioPicker) usuarioPicker.classList.toggle('oculto', !marcado);
    if (inpUsuarioAsig) inpUsuarioAsig.disabled = !!enUso;

    document.getElementById('req-usuario-asignado')?.classList.toggle('oculto', !!enUso);
    document.getElementById('nota-usuario-asignado')?.classList.toggle('oculto', !enUso);
}


function puedeCambiarEstatus() {
    return puedeAcceder('af-act:estatus');
}


function aplicarEstadoEstatus(enUso) {
    const porPermiso = !puedeCambiarEstatus();
    if (selEstatus) selEstatus.disabled = !!enUso || porPermiso;

    const nota = document.getElementById('nota-estatus');
    if (!nota) return;
    nota.classList.toggle('oculto', !(enUso || porPermiso));
    nota.textContent = enUso
        ? 'Lo controla la responsiva abierta: el activo se libera solo al registrar la devolución o al cancelarla.'
        : 'Sólo un administrador puede cambiarlo. El estatus manda el inventario disponible y el flujo de responsivas.';
}

const CONSECUENCIAS_ESTATUS = {
    ASIGNADO: 'El activo quedará <strong>bloqueado</strong> y saldrá de la lista para asignar, aunque ninguna responsiva lo respalde: el sistema creerá que alguien lo tiene.',
    PENDIENTE: 'El activo quedará <strong>bloqueado</strong> igual que con una responsiva abierta y saldrá de la lista para asignar hasta que registres una responsiva o lo liberes.',
    BAJA: 'El activo saldrá del inventario y se moverá a la pestaña <strong>Eliminados</strong>: desaparece de listados, reportes y del selector de responsivas.',
    DISPONIBLE: 'El activo volverá al inventario para asignarlo <strong>aunque exista una responsiva abierta</strong>: la responsiva quedará desincronizada del inventario.',
    STOCK: 'El activo volverá al inventario para asignarlo <strong>aunque exista una responsiva abierta</strong>: la responsiva quedará desincronizada del inventario.'
};

function nombreEstatus(id) {
    if (id === null || id === undefined || id === '') return '—';
    const encontrado = estatus.find(x => Number(x.IdEstatus) === Number(id));
    return encontrado?.Nombre ?? '—';
}


async function alertaConsecuenciasEstatus(antesId, despuesId) {
    const antes   = nombreEstatus(antesId);
    const despues = nombreEstatus(despuesId);
    const clave   = String(despues).toUpperCase();
    const detalle = CONSECUENCIAS_ESTATUS[clave]
        || 'Forzar el estatus a mano deja el activo sin el respaldo de una acción del sistema: inventario y responsivas pueden quedar desincronizados.';

    const resultado = await Swal.fire({
        icon: 'warning',
        title: 'Cambiar el estatus a mano rompe el flujo',
        html: `
            <div class="cl-aviso-cambio">
                <span class="cl-aviso-de">${escaparHTML(antes)}</span>
                <span class="cl-aviso-flecha">→</span>
                <span class="cl-aviso-a">${escaparHTML(despues)}</span>
            </div>
            <div class="cl-aviso-consecuencia">${detalle}</div>
            <div class="cl-aviso-nota">
                El estatus lo escribe el sistema al asignar, devolver o dar de baja un activo.
                Si cierras esta ventana, el activo conserva su estatus actual.
            </div>
        `,
        showCloseButton: true,
        confirmButtonText: 'Entiendo, cambiar el estatus',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm cl-confirm-peligro',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro'
        }
    });

    return resultado.isConfirmed === true;
}


selEstatus.addEventListener('change', async () => {
    if (!modoEdicion) return;
    const nuevo = selEstatus.value ? parseInt(selEstatus.value, 10) : null;
    if (Number(nuevo ?? 0) === Number(estatusOriginal ?? 0)) return;

    const aceptado = await alertaConsecuenciasEstatus(estatusOriginal, nuevo);
    if (!aceptado) {
        selEstatus.value = estatusOriginal !== null && estatusOriginal !== undefined
            ? String(estatusOriginal)
            : '';
    }
});

function limpiarFormulario() {
    selTipo.value = '';
    selMarca.value = '';
    selEstado.value = estados[0]?.IdEstado ?? '';
    const estatusDisponible = estatus.find(x => x.Nombre.toUpperCase() === 'DISPONIBLE');
    selEstatus.value = estatusDisponible?.IdEstatus ?? '';
    /* En alta el estatus lo pone el sistema (DISPONIBLE) y no se toca. */
    selEstatus.disabled = true;
    estatusOriginal = null;
    document.getElementById('nota-estatus')?.classList.add('oculto');
    selCartera.value = '';
    selSitio.value = '';
    selSubtipo.innerHTML = '<option value="">— Selecciona un tipo primero —</option>';
    selSubtipo.disabled = true;
    selClasificacion.value = '';
    selTamanio.value = '';
    selCapacidad.value = '';
    selVoltaje.value = '';
    inpModelo.value = '';
    inpNoSerie.value = '';
    inpIMEI1.value = '';
    inpIMEI2.value = '';
    inpNoTelefono.value = '';
    inpUsuarioAsig.value = '';
    if (chkUsuarioAsignado) { chkUsuarioAsignado.checked = false; chkUsuarioAsignado.disabled = false; }
    if (usuarioPicker) usuarioPicker.classList.add('oculto');
    if (buscadorUsuario) buscadorUsuario.value = '';
    btnLimpiarUsuario?.classList.add('oculto');
    poblarUsuarios('');
    if (notaContextoAuto) { notaContextoAuto.classList.add('oculto'); notaContextoAuto.textContent = ''; }
    aplicarEstadoUsuarioAsignado(false);
    inpProcesador.value = '';
    inpRAM.value = '';
    inpAlmacenamiento.value = '';
    inpSO.value = '';
    inpAccesorios.value = '';
    inpPrecio.value = '';
    inpObservaciones.value = '';
    actualizarCamposPorTipo();
}

btnNuevo.addEventListener('click', () => {
    if (vistaActual === 'eliminados') return;
    modoEdicion = false;
    idEditando = null;
    modalTitulo.textContent = 'Nuevo activo';
    limpiarFormulario();
    ocultarMensaje();
    abrirModal();
    selTipo.focus();
});

/* Relleno masivo: deduce cartera (por prefijo del hostname) y sitio
   (COPERVA) de todos los activos que aún están vacíos. Sólo toca filas con
   el campo en blanco, así que es seguro repetirlo. */
btnAutoasignar?.addEventListener('click', async () => {
    const confirm = await Swal.fire({
        icon: 'question',
        title: '¿Autoasignar cartera y sitio?',
        html: 'Se completarán la cartera (según el prefijo del hostname) y el sitio ' +
              '(COPERVA) de los activos que estén vacíos.<br><br>' +
              '<strong>No se sobrescribe</strong> lo que ya capturaste a mano.',
        showCloseButton: true,
        confirmButtonText: 'Sí, autoasignar',
        buttonsStyling: false,
        customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
    });
    if (!confirm.isConfirmed) return;

    Swal.fire({
        title: 'Autoasignando...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });

    let res;
    try {
        res = await window.api.activoFijo.activos.autoasignar();
    } catch (err) {
        res = { ok: false, mensaje: err.message };
    }

    if (!res || !res.ok) {
        Swal.fire({
            icon: 'error',
            title: 'No se pudo autoasignar',
            text: res?.mensaje || 'Error desconocido.',
            buttonsStyling: false,
            customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
        });
        return;
    }

    await Swal.fire({
        icon: 'success',
        title: 'Listo',
        text: res.mensaje || `Se actualizaron ${res.actualizados} equipos.`,
        buttonsStyling: false,
        customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
    });
    await cargarActivos();
});

async function abrirEdicion(id) {
    const a = activos.find(x => x.IdActivoFijoEQ === id);
    if (!a) { toastError('Activo no encontrado'); return; }

    modoEdicion = true;
    idEditando = id;
    modalTitulo.textContent = 'Editar activo';

    selTipo.value = a.IdTipo != null ? String(a.IdTipo) : '';
    actualizarCamposPorTipo();

    selMarca.value         = a.IdMarca   != null ? String(a.IdMarca)   : '';
    selEstado.value        = a.IdEstado  != null ? String(a.IdEstado)  : '';
    selEstatus.value       = a.IdEstatus != null ? String(a.IdEstatus) : '';
    selCartera.value       = a.IdCartera != null ? String(a.IdCartera) : '';
    selSitio.value         = a.IdSitio   != null ? String(a.IdSitio)   : '';
    selClasificacion.value = a.IdClasificacion != null ? String(a.IdClasificacion) : '';
    selTamanio.value       = a.IdTamanio    != null ? String(a.IdTamanio)    : '';
    selCapacidad.value     = a.IdCapacidad  != null ? String(a.IdCapacidad)  : '';
    selVoltaje.value       = a.IdVoltaje    != null ? String(a.IdVoltaje)    : '';

    const tipo = tipos.find(t => t.IdTipo === a.IdTipo);
    if (tipo && tipo.RequiereSubtipo) {
        poblarSubtipos(tipo.GrupoSubtipo, a.IdSubtipo);
    }

    actualizarUsuarioAsignado();

    seleccionarCatalogoTexto(inpModelo, a.Modelo);
    inpNoSerie.value        = a.NoSerie ?? '';
    inpIMEI1.value          = a.IMEI1 ?? '';
    inpIMEI2.value          = a.IMEI2 ?? '';
    inpNoTelefono.value     = a.NoTelefono ?? '';
    seleccionarCatalogoTexto(inpUsuarioAsig, a.UsuarioAsignado);
    seleccionarCatalogoTexto(inpProcesador, a.Procesador);
    seleccionarCatalogoTexto(inpRAM, a.MemoriaRAM);
    seleccionarCatalogoTexto(inpAlmacenamiento, a.Almacenamiento);
    seleccionarSistemaOperativo(a);
    seleccionarCatalogoTexto(inpAccesorios, a.Accesorios);
    inpPrecio.value         = a.PrecioActivo ?? '';
    inpObservaciones.value  = a.Observaciones ?? '';

    ocultarMensaje();
   
    const enUso = activoEnUso(a.Estatus);
    estatusOriginal = a.IdEstatus != null ? a.IdEstatus : null;
    aplicarEstadoEstatus(enUso);
    aplicarEstadoUsuarioAsignado(enUso);
    abrirModal();
    selTipo.focus();

    /* Auto-relleno por hostname: el prefijo (AGT-TOY156 → TOY) dice a qué
       cliente/cartera pertenece. Sólo completa cartera y sitio si están
       vacíos y muestra una nota con lo deducido; nunca pisa lo capturado. */
    await aplicarContextoInferido(id);
}

/* Sugiere cartera + sitio por defecto (COPERVA) a partir del hostname ya
   guardado del activo. Reutiliza el endpoint af-activos-inferir. */
async function aplicarContextoInferido(id) {
    if (notaContextoAuto) { notaContextoAuto.classList.add('oculto'); notaContextoAuto.textContent = ''; }
    if (!id || !window.api?.activoFijo?.activos?.inferir) return;

    let res;
    try { res = await window.api.activoFijo.activos.inferir(id); }
    catch (_) { return; }
    if (!res || !res.ok) return;

    let completo = false;
    if (!selCartera.value && res.idCartera) {
        const opt = [...selCartera.options].find(o => String(o.value) === String(res.idCartera));
        if (opt) { selCartera.value = String(res.idCartera); completo = true; }
    }
    if (!selSitio.value && res.idSitioPorDefecto) {
        const opt = [...selSitio.options].find(o => String(o.value) === String(res.idSitioPorDefecto));
        if (opt) { selSitio.value = String(res.idSitioPorDefecto); completo = true; }
    }

    const partes = [];
    if (res.hostname) partes.push(`hostname ${res.hostname}`);
    if (res.cliente)  partes.push(`cliente ${res.cliente}`);
    if (res.idCartera) {
        const oc = [...selCartera.options].find(o => String(o.value) === String(res.idCartera));
        if (oc) partes.push(`cartera ${oc.textContent}`);
    }
    if (res.idSitioPorDefecto) {
        const os = [...selSitio.options].find(o => String(o.value) === String(res.idSitioPorDefecto));
        if (os) partes.push(`sitio ${os.textContent}`);
    }

    if (notaContextoAuto && partes.length) {
        const prefijo = completo ? 'Asignado automáticamente' : 'Sugerido por hostname';
        notaContextoAuto.textContent = `${prefijo}: ${partes.join(' · ')}`;
        notaContextoAuto.classList.remove('oculto');
    }
}

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;

    if (!selTipo.value) {
        mostrarMensaje('El tipo es obligatorio.', 'error');
        return;
    }

    const idTipo = parseInt(selTipo.value, 10);
    const tipo = tipos.find(t => t.IdTipo === idTipo);
    if (!tipo) {
        mostrarMensaje('Tipo inválido.', 'error');
        return;
    }

    const tieneSerie = inpNoSerie.value.trim();
    const tieneIMEI  = inpIMEI1.value.trim();
    const tieneTel   = inpNoTelefono.value.trim();

    if (!tieneSerie && !tieneIMEI && !tieneTel) {
        mostrarMensaje('Debes capturar al menos NoSerie, IMEI1 o NoTeléfono.', 'error');
        return;
    }

    /* Obligatoriedad por dato, no por bandera del catálogo: se exige lo que
       el inventario de ese tipo realmente captura (>= 60% de sus equipos). */
    const reqs = requisitosDeTipo(tipo);

    if (reqs.subtipo.obligatorio && !selSubtipo.value) {
        mostrarMensaje('El subtipo es obligatorio para este tipo.', 'error'); return;
    }
    if (reqs.clasificacion.obligatorio && !selClasificacion.value) {
        mostrarMensaje('La clasificación es obligatoria para este tipo.', 'error'); return;
    }
    if (reqs.tamanio.obligatorio && !selTamanio.value) {
        mostrarMensaje('El tamaño es obligatorio para este tipo.', 'error'); return;
    }
    if (reqs.capacidad.obligatorio && !selCapacidad.value) {
        mostrarMensaje('La capacidad es obligatoria para este tipo.', 'error'); return;
    }
    if (reqs.voltaje.obligatorio && !selVoltaje.value) {
        mostrarMensaje('El voltaje es obligatorio para este tipo.', 'error'); return;
    }
    if (reqs.especificaciones.obligatorio && (!inpProcesador.value || !inpRAM.value || !inpAlmacenamiento.value || !inpSO.value)) {
        mostrarMensaje('Selecciona procesador, memoria RAM, almacenamiento y sistema operativo del catálogo.', 'error'); return;
    }
    if (reqs.accesorios.obligatorio && !inpAccesorios.value) {
        mostrarMensaje('Selecciona los accesorios del catálogo.', 'error'); return;
    }
    
    const campoUsuarioVisible = !document.querySelector('.campo-usuario-asignado')?.classList.contains('oculto');
    const activoEditando = (modoEdicion && idEditando !== null)
        ? activos.find(x => x.IdActivoFijoEQ === idEditando)
        : null;
    /* Aquí sí manda la bandera del catálogo: dar de alta un equipo en stock
       sin dueño es normal, así que el dato no lo vuelve obligatorio. */
    const usuarioObligatorio = !!tipo.RequiereUsuarioAsignado && campoUsuarioVisible &&
        (!activoEditando || activoEnUso(activoEditando.Estatus));
    if (usuarioObligatorio && !inpUsuarioAsig.value.trim()) {
        mostrarMensaje('Selecciona el usuario asignado del catálogo.', 'error'); return;
    }
    if (reqs.precio.obligatorio && !inpPrecio.value.trim()) {
        mostrarMensaje('El precio es obligatorio para este tipo.', 'error'); return;
    }

    const precioNum = inpPrecio.value.trim() ? parseFloat(inpPrecio.value) : null;

    /* El select de SO usa el Id; se recupera la fila del catálogo para
       mandar también el nombre (columna de respaldo) y la FK explícita. */
    const soSeleccionado = inpSO.value
        ? (catalogosEspecificaciones.sistemasOperativos || [])
            .find(x => String(x.IdSistemaOperativo) === inpSO.value) || null
        : null;

    const datos = {
        IdTipo:          idTipo,
        IdMarca:         selMarca.value ? parseInt(selMarca.value, 10) : null,
        IdCartera:       selCartera.value ? parseInt(selCartera.value, 10) : null,
        IdEstado:        selEstado.value ? parseInt(selEstado.value, 10) : null,
        IdEstatus:       selEstatus.value ? parseInt(selEstatus.value, 10) : null,

        IdSitio:         selSitio.value ? parseInt(selSitio.value, 10) : null,
        IdSubtipo:       selSubtipo.value ? parseInt(selSubtipo.value, 10) : null,
        IdClasificacion: selClasificacion.value ? parseInt(selClasificacion.value, 10) : null,
        IdTamanio:       selTamanio.value ? parseInt(selTamanio.value, 10) : null,
        IdCapacidad:     selCapacidad.value ? parseInt(selCapacidad.value, 10) : null,
        IdVoltaje:       selVoltaje.value ? parseInt(selVoltaje.value, 10) : null,
        UsuarioAsignado: inpUsuarioAsig.value.trim() || null,

        Modelo:          inpModelo.value.trim() || null,
        NoSerie:         inpNoSerie.value.trim() || null,
        IMEI1:           inpIMEI1.value.trim() || null,
        IMEI2:           inpIMEI2.value.trim() || null,
        NoTelefono:      inpNoTelefono.value.trim() || null,
        Procesador:      inpProcesador.value.trim() || null,
        MemoriaRAM:      inpRAM.value.trim() || null,
        Almacenamiento:  inpAlmacenamiento.value.trim() || null,
        IdSistemaOperativo: soSeleccionado ? soSeleccionado.IdSistemaOperativo : null,
        SistemaOperativo: soSeleccionado ? soSeleccionado.Nombre : null,
        Accesorios:      inpAccesorios.value.trim() || null,
        Observaciones:   inpObservaciones.value.trim() || null
    };

    if (tipo.RequierePrecio) {
        datos.PrecioActivo = Number.isFinite(precioNum) ? precioNum : null;
    }

    setGuardando(true);
    try {
        let res;
        if (modoEdicion && idEditando !== null) {
            res = await window.api.activoFijo.activos.actualizar(idEditando, datos);
        } else {
            res = await window.api.activoFijo.activos.crear(datos);
        }

        if (res && res.ok) {
            cerrarModal();
            await cargarActivos();
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

async function eliminarActivo(id) {
    const a = activos.find(x => x.IdActivoFijoEQ === id);
    const nombre = a ? (a.NoSerie || a.IMEI1 || a.NoTelefono || `#${id}`) : `#${id}`;
    const resPiezas = await respuestaPiezas(id);
    const piezas = Array.isArray(resPiezas.componentes) ? resPiezas.componentes : [];
    const cuantas = totalPiezas(piezas);
    const avisoPiezas = cuantas ? `
            <div class="ver-aviso ver-aviso-peligro">
                <strong>⚠ Este equipo tiene ${cuantas} ${cuantas === 1 ? 'pieza conectada' : 'piezas conectadas'}</strong>
                (${escaparHTML(resumenPiezas(piezas))}).
                Dar de baja el equipo <strong>no borra ni desliga sus piezas</strong>: sus registros
                seguirán colgando de este activo y el inventario contará 1 equipo menos con piezas huérfanas.
                Da de baja sólo cuando el equipo se <strong>reemplazó</strong> o se <strong>desechó</strong>,
                y reconecta/actualiza sus piezas en la siguiente recolección para no generar
                incongruencias en la BD.
            </div>` : '';

    const resultado = await Swal.fire({
        icon: 'warning',
        title: '¿Dar de baja este activo?',
        html: `
            <div>Se dará de baja <strong>${escaparHTML(nombre)}</strong>.<br>
            Podrás verlo y restaurarlo desde la pestaña <strong>Eliminados (BAJA)</strong>.</div>
            ${avisoPiezas}
            <div class="campo-motivo" id="motivo-baja-wrap">
                <label for="motivo-baja">Motivo de la baja</label>
                <textarea id="motivo-baja" maxlength="500" rows="3"
                          placeholder="Ej. Robo, daño, obsolescencia, venta, fin de vida útil..."></textarea>
                <div class="error-texto">El motivo es obligatorio.</div>
            </div>
        `,
        showCloseButton: true,
        confirmButtonText: 'Sí, dar de baja',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm cl-confirm-peligro',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro'
        },
        didOpen: () => {
            const ta = document.getElementById('motivo-baja');
            if (ta) {
                ta.focus();
                ta.addEventListener('input', () => {
                    document.getElementById('motivo-baja-wrap')?.classList.remove('error');
                });
            }
        },
        preConfirm: () => {
            const ta = document.getElementById('motivo-baja');
            const val = ta ? ta.value.trim() : '';
            if (!val) {
                document.getElementById('motivo-baja-wrap')?.classList.add('error');
                if (ta) ta.focus();
                return false;
            }
            return val;
        }
    });

    if (!resultado.isConfirmed) return;
    const motivo = resultado.value;

    try {
        const res = await window.api.activoFijo.activos.eliminar(id, motivo);
        if (res && res.ok) {
            await cargarActivos();
            toastExito(res.mensaje || 'Activo dado de baja');
        } else {
            toastError('No se pudo dar de baja', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al dar de baja', err.message);
    }
}

async function restaurarActivo(id, noSerie) {
    const resultado = await Swal.fire({
        icon: 'question',
        title: '¿Restaurar activo?',
        html: `
            <div>El activo <strong>${escaparHTML(noSerie || ('#' + id))}</strong>
            volverá al inventario activo con estatus <strong>STOCK/DISPONIBLE</strong>.</div>
            <div class="campo-motivo" id="motivo-restaurar-wrap">
                <label for="motivo-restaurar">Motivo de la restauración</label>
                <textarea id="motivo-restaurar" maxlength="500" rows="3"
                          placeholder="Ej. Devolución, corrección de baja, error administrativo..."></textarea>
                <div class="error-texto">El motivo es obligatorio.</div>
            </div>
        `,
        showCloseButton: true,
        confirmButtonText: 'Sí, restaurar',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled'
        },
        didOpen: () => {
            const ta = document.getElementById('motivo-restaurar');
            if (ta) {
                ta.focus();
                ta.addEventListener('input', () => {
                    document.getElementById('motivo-restaurar-wrap')?.classList.remove('error');
                });
            }
        },
        preConfirm: () => {
            const ta = document.getElementById('motivo-restaurar');
            const val = ta ? ta.value.trim() : '';
            if (!val) {
                document.getElementById('motivo-restaurar-wrap')?.classList.add('error');
                if (ta) ta.focus();
                return false;
            }
            return val;
        }
    });

    if (!resultado.isConfirmed) return;
    const motivo = resultado.value;

    try {
        const res = await window.api.activoFijo.activos.restaurar(id, motivo);
        if (res && res.ok) {
            await cargarActivos();
            toastExito(res.mensaje || 'Activo restaurado');
        } else {
            toastError('No se pudo restaurar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al restaurar', err.message);
    }
}


async function eliminarDefinitivoActivo(id, noSerie) {
    const nombre = noSerie || ('#' + id);
    const resPiezas = await respuestaPiezas(id);
    const piezas = Array.isArray(resPiezas.componentes) ? resPiezas.componentes : [];
    const cuantas = totalPiezas(piezas);
    const avisoPiezas = cuantas ? `
            <div class="ver-aviso ver-aviso-peligro">
                <strong>⚠ Este equipo tiene ${cuantas} ${cuantas === 1 ? 'pieza conectada' : 'piezas conectadas'}</strong>
                (${escaparHTML(resumenPiezas(piezas))}):
                también se ${cuantas === 1 ? 'borrará su registro' : 'borrarán sus registros'} en
                <code>dbo.ActivoFijoEquiposComponentes</code>.
                Pulsa eliminar sólo si el equipo se <strong>reemplazó</strong> o se
                <strong>desechó</strong> definitivamente; si no, quedará una incongruencia
                entre el hardware instalado y la BD.
            </div>` : '';

    const resultado = await Swal.fire({
        icon: 'error',
        title: '¿Eliminar definitivamente?',
        html: `
            <div>Se borrará del sistema <strong>${escaparHTML(nombre)}</strong>
            junto con su histórico, sus accesorios y sus asignaciones.</div>
            ${avisoPiezas}
            <div style="margin-top:.65rem;"><strong>Esta acción no se puede deshacer.</strong><br>
            Si sólo querías ocultarlo, cierra esta ventana y usa <em>Restaurar</em>.</div>
        `,
        showCloseButton: true,
        confirmButtonText: 'Sí, eliminar definitivamente',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm cl-confirm-peligro',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro'
        }
    });

    if (!resultado.isConfirmed) return;

    try {
        const res = await window.api.activoFijo.activos.eliminarDefinitivo(id);
        if (res && res.ok) {
            await cargarActivos();
            toastExito(res.mensaje || 'Activo eliminado definitivamente');
        } else {
            toastError('No se pudo eliminar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al eliminar', err.message);
    }
}

async function verHistorico(id, noSerie) {
    try {
        const movs = await window.api.activoFijo.activos.historico(id);

        if (!movs || movs.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin movimientos',
                text: 'Este activo no tiene movimientos registrados.',
                confirmButtonText: 'Cerrar'
            });
            return;
        }

        const filas = movs.map(m => {
            const fecha   = formatearFecha(m.FechaMovimiento);
            const usuario = m.UsuarioMovimiento || (m.IdUsuarioMovimiento ? `ID ${m.IdUsuarioMovimiento}` : '—');
            const accion  = (m.Accion || 'EDICION').toUpperCase();
            const detalle = m.Detalle || '—';
            const motivo  = m.Motivo
                ? `<div class="his-motivo"><b>Motivo:</b> ${escaparHTML(m.Motivo)}</div>`
                : '';
            const cambios = [];
            if (m.EstatusAnterior !== m.EstatusNuevo && (m.EstatusAnterior || m.EstatusNuevo)) {
                cambios.push(`Estatus: <b>${escaparHTML(m.EstatusAnterior ?? '—')}</b> → <b>${escaparHTML(m.EstatusNuevo ?? '—')}</b>`);
            }
            if (m.SitioAnterior !== m.SitioNuevo && (m.SitioAnterior || m.SitioNuevo)) {
                cambios.push(`Sitio: <b>${escaparHTML(m.SitioAnterior ?? '—')}</b> → <b>${escaparHTML(m.SitioNuevo ?? '—')}</b>`);
            }
            if (m.UsuarioAsignadoAnterior !== m.UsuarioAsignadoNuevo && (m.UsuarioAsignadoAnterior || m.UsuarioAsignadoNuevo)) {
                cambios.push(`Asignado: <b>${escaparHTML(m.UsuarioAsignadoAnterior ?? '—')}</b> → <b>${escaparHTML(m.UsuarioAsignadoNuevo ?? '—')}</b>`);
            }
            const bloqueCambios = cambios.length
                ? `<div class="his-cambios">${cambios.join('<br>')}</div>`
                : '';

            return `
                <tr>
                    <td class="his-fecha">${escaparHTML(fecha)}</td>
                    <td><span class="his-badge his-${escaparHTML(accion.toLowerCase())}">${escaparHTML(accion)}</span></td>
                    <td>${escaparHTML(usuario)}</td>
                    <td>
                        ${escaparHTML(detalle)}
                        ${bloqueCambios}
                        ${motivo}
                    </td>
                </tr>
            `;
        }).join('');

        Swal.fire({
            title: `Histórico — ${escaparHTML(noSerie || ('#' + id))}`,
            width: '960px',
            html: `
                <div class="his-wrap">
                    <table class="his-tabla">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Acción</th>
                                <th>Usuario</th>
                                <th>Detalle</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            `,
            showCloseButton: true,
            showConfirmButton: false,
            customClass: { popup: 'cl-historico' }
        });
    } catch (err) {
        toastError('No se pudo cargar el histórico', err.message);
    }
}

document.getElementById('btn-volver').addEventListener('click', () => {
    window.api.volverMenu();
});

/* =========================================================
   MÓDULO DE CATÁLOGOS (misma página, sin módulos aparte)
   ========================================================= */
const CatalogosUI = (() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

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
       CONFIGURACIÓN FRONTEND DE LOS CATÁLOGOS
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
                  hint: 'Situación operativa. Los activos nuevos inician como DISPONIBLE y ASIGNADO se controla con responsivas.' }
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
        },
        modelos: {
            titulo: 'Modelos',
            tituloSingular: 'modelo',
            pk: 'IdModelo',
            campos: [
                { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 150,
                  hint: 'Modelo comercial del equipo. Ej. ThinkPad T14, ProDesk 400 G4.' }
            ]
        },
        procesadores: {
            titulo: 'Procesadores',
            tituloSingular: 'procesador',
            pk: 'IdProcesador',
            campos: [
                { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 150,
                  hint: 'Procesadores disponibles para los equipos.' }
            ]
        },
        memoriasRam: {
            titulo: 'Memorias RAM',
            tituloSingular: 'memoria RAM',
            pk: 'IdMemoriaRAM',
            campos: [
                { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
                  hint: 'Capacidades y tipo de memoria. Ej. 8 GB DDR4.' }
            ]
        },
        almacenamientos: {
            titulo: 'Almacenamientos',
            tituloSingular: 'almacenamiento',
            pk: 'IdAlmacenamiento',
            campos: [
                { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 50,
                  hint: 'Capacidad y tipo. Ej. 512 GB SSD.' }
            ]
        },
        sistemasOperativos: {
            titulo: 'Sistemas operativos',
            tituloSingular: 'sistema operativo',
            pk: 'IdSistemaOperativo',
            campos: [
                { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 100,
                  hint: 'Ej. Windows 11 Pro, Windows 10 Pro, Ubuntu 24.04.' },
                { nombre: 'BuildSO', etiqueta: 'Build (compilación)', tipo: 'text', max: 20,
                  hint: 'Compilación del SO. Ej. 22H2, 23H2, 24H2. Puede ir vacío. Mismo nombre con distinta compilación son sistemas distintos (Windows 10 22H2 ≠ Windows 10 21H2).' }
            ]
        },
        accesorios: {
            titulo: 'Accesorios',
            tituloSingular: 'accesorio',
            pk: 'IdAccesorio',
            campos: [
                { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 300,
                  hint: 'Conjunto o accesorio frecuente. Ej. Cargador, mouse y teclado.' }
            ]
        },
        usuariosAsignados: {
            titulo: 'Usuarios asignados',
            tituloSingular: 'usuario asignado',
            pk: 'IdUsuarioAsignado',
            campos: [
                { nombre: 'Nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, max: 200,
                  hint: 'Usuarios externos o responsables reutilizados en la captura.' }
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
            resumen: 'Situación operativa del activo (DISPONIBLE, ASIGNADO, BAJA, etc.).',
            tips: [
                'El estatus <b>BAJA</b> dispara el soft delete y mueve el activo a Eliminados.',
                'Los activos creados o importados inician como DISPONIBLE.',
                'ASIGNADO se establece al crear una responsiva y se libera al devolverla o cancelarla.'
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
        },
        modelos: { resumen: 'Modelos disponibles para asociar a los activos.', tips: ['Los valores históricos fueron precargados automáticamente.'] },
        procesadores: { resumen: 'Procesadores disponibles para completar las especificaciones.', tips: ['Los valores históricos fueron precargados automáticamente.'] },
        memoriasRam: { resumen: 'Opciones de memoria RAM utilizadas en los activos.', tips: ['Los valores históricos fueron precargados automáticamente.'] },
        almacenamientos: { resumen: 'Opciones de almacenamiento disponibles.', tips: ['Los valores históricos fueron precargados automáticamente.'] },
        sistemasOperativos: { resumen: 'Sistemas operativos disponibles para los equipos.', tips: ['Los valores históricos fueron precargados automáticamente.'] },
        accesorios: { resumen: 'Conjuntos de accesorios reutilizables.', tips: ['Los valores históricos fueron precargados automáticamente.'] },
        usuariosAsignados: { resumen: 'Usuarios reutilizables para activos que no se asignan mediante responsiva.', tips: ['Los valores históricos fueron precargados automáticamente.'] }
    };

    /* =========================================================
       ESTADO PROPIO (prefijado para no chocar con el inventario)
       ========================================================= */
    let catalogoActual = 'marcas';
    let vistaCatalogo  = 'activos';   
    let registros      = [];
    let editando       = false;
    let idEditando     = null;
    let guardando      = false;
    let busqueda       = '';
    let ayudaAbierta   = true;
    let huboCambios    = false;
    let cargado        = false;

    /* =========================================================
       REFERENCIAS DOM (todas con prefijo cat-)
       ========================================================= */
    const elTabs             = $('cat-tabs');
    const elMenuToggle       = $('cat-menu-toggle');
    const elMenuDropdown     = $('cat-menu-dropdown');
    const elMenuIcono        = $('cat-menu-icon');
    const elMenuTitulo       = $('cat-menu-titulo');
    const elTabsVista        = $('cat-tabs-vista');
    const elTablaHead        = $('cat-tabla-head');
    const elTablaBody        = $('cat-tabla-body');
    const elCardTabla        = $('cat-card-tabla');
    const elPaginacionCat    = $('paginacion-catalogos');
    const elFormulario       = $('cat-formulario');
    const elCamposForm       = $('cat-campos-form');
    const elMensaje          = $('cat-mensaje');
    const elBtnGuardar       = $('cat-btn-guardar');
    const elBtnNuevo         = $('cat-btn-nuevo');
    const elBtnNuevoTexto    = $('cat-btn-nuevo-texto');
    const elPanelTitulo      = $('cat-panel-titulo');
    const elPanelDescripcion = $('cat-panel-descripcion');
    const elSinResultados    = $('cat-sin-resultados');
    const elSinResultadosTit = $('cat-sin-resultados-titulo');
    const elSinResultadosTxt = $('cat-sin-resultados-texto');
    const elInputBusqueda    = $('cat-input-busqueda');
    const elBtnLimpiarBusq   = $('cat-btn-limpiar-busqueda');
    const elBtnLimpiarFiltro = $('cat-btn-limpiar-filtro');
    const elModal            = $('cat-modal');
    const elModalTitulo      = $('cat-modal-titulo');
    const elAvisoModal       = $('cat-aviso-modal');
    const elBtnModalCerrar   = $('cat-modal-cerrar');
    const elPanelAyuda       = $('cat-panel-ayuda');
    const elPanelAyudaTitulo = $('cat-panel-ayuda-titulo');
    const elPanelAyudaBody   = $('cat-panel-ayuda-body');
    const elBtnToggleAyuda   = $('cat-btn-toggle-ayuda');

 
    const pagCatalogo = window.Paginador
        ? window.Paginador.crear(elPaginacionCat, { alCambiar: () => renderTabla() })
        : {
            recortar: lista => lista,
            reiniciar() {},
            mostrar() {},
            contenedor: null
        };

    /* =========================================================
       UTILIDADES
       ========================================================= */

    function mensajeCat(texto, tipo) {
        if (!elMensaje) return;
        elMensaje.textContent = texto;
        elMensaje.className = 'alert ' + tipo;
        elMensaje.classList.remove('oculto');
    }

    function ocultarMensajeCat() {
        if (!elMensaje) return;
        elMensaje.className = 'alert oculto';
        elMensaje.textContent = '';
    }

    function mostrarAvisoModal(html) {
        if (!elAvisoModal) return;
        if (!html) {
            elAvisoModal.classList.add('oculto');
            elAvisoModal.innerHTML = '';
            return;
        }
        elAvisoModal.innerHTML = `<div class="aviso-texto">${html}</div>`;
        elAvisoModal.classList.remove('oculto');
    }

    function setGuardandoCat(v) {
        guardando = v;
        if (!elBtnGuardar) return;
        elBtnGuardar.disabled = v;
        const txt = elBtnGuardar.querySelector('.btn-text');
        const spin = elBtnGuardar.querySelector('.btn-spinner');
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
    function alertaExito(titulo, texto = '') {
        return Swal.fire({
            icon: 'success',
            title: titulo,
            html: texto ? `<p style="margin:0;">${texto}</p>` : undefined,
            timer: 2100,
            timerProgressBar: true,
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { popup: 'cl-alert' }
        });
    }

    function alertaError(titulo, texto = '') {
        return Swal.fire({
            icon: 'error',
            title: titulo,
            html: texto ? `<p style="margin:0;">${texto}</p>` : undefined,
            showConfirmButton: false,
            showCloseButton: true,
            buttonsStyling: false,
            customClass: { popup: 'cl-alert cl-alert-error' }
        });
    }

    /* =========================================================
       PANEL DE AYUDA
       ========================================================= */
    function renderAyuda() {
        const ayuda = AYUDA_CATALOGO[catalogoActual];
        const cfg   = CATALOGOS_FRONT[catalogoActual];
        if (!ayuda || !elPanelAyudaBody || !elPanelAyudaTitulo || !cfg) return;

        elPanelAyudaTitulo.textContent = `Cómo funciona "${cfg.titulo}"`;

        const tips = (ayuda.tips || []).map(t => `<li>${t}</li>`).join('');
        elPanelAyudaBody.innerHTML = `
            <p class="ayuda-resumen">${ayuda.resumen}</p>
            ${tips ? `<ul class="ayuda-tips">${tips}</ul>` : ''}
        `;

        if (elPanelAyuda) elPanelAyuda.classList.remove('oculto');
    }

    function aplicarEstadoAyuda() {
        if (!elPanelAyudaBody || !elPanelAyuda) return;
        elPanelAyudaBody.style.display = ayudaAbierta ? '' : 'none';
        elPanelAyuda.classList.toggle('colapsado', !ayudaAbierta);
    }

    /* =========================================================
       ACTUALIZAR UI DEL CATÁLOGO ACTIVO
       ========================================================= */
    function actualizarUIDeCatalogo() {
        const cfg = CATALOGOS_FRONT[catalogoActual];
        if (!cfg) return;

        const enEliminados = (vistaCatalogo === 'eliminados');

        if (elPanelTitulo) elPanelTitulo.textContent = cfg.titulo;
        if (elPanelDescripcion) {
            elPanelDescripcion.textContent = enEliminados
                ? 'Registros dados de baja · Puedes restaurarlos individualmente'
                : 'Gestiona los registros activos del catálogo';
        }

        if (elBtnNuevoTexto) elBtnNuevoTexto.textContent = `Nuevo ${cfg.tituloSingular}`;
        if (elBtnNuevo) {
            elBtnNuevo.disabled = enEliminados;
            elBtnNuevo.title = enEliminados ? 'No disponible en la vista de Eliminados' : '';
        }

        /* Hero compartido con el inventario: refleja el catálogo abierto. */
        if (tituloPagina) tituloPagina.textContent = `Catálogos · ${cfg.titulo}`;
        if (subtituloPagina) subtituloPagina.textContent = 'Configuración maestra del inventario';

        actualizarMenuCatalogo();
        renderAyuda();
        aplicarEstadoAyuda();
    }

    /* =========================================================
       MENÚ DESPLEGABLE DE CATÁLOGOS
       ========================================================= */
    function abrirMenuCatalogo(abrir) {
        if (!elMenuToggle || !elMenuDropdown) return;
        const visible = typeof abrir === 'boolean' ? abrir : elMenuDropdown.hidden;
        elMenuDropdown.hidden = !visible;
        elMenuToggle.setAttribute('aria-expanded', String(visible));
    }

    function actualizarMenuCatalogo() {
        if (!elMenuDropdown) return;
        const btn = elMenuDropdown.querySelector(`.tab-btn[data-catalogo="${catalogoActual}"]`);
        if (!btn) return;

        const iconoOrigen = btn.querySelector('.tab-icon');
        if (elMenuIcono && iconoOrigen) elMenuIcono.innerHTML = iconoOrigen.innerHTML;
        if (elMenuTitulo) elMenuTitulo.textContent = btn.querySelector('.tab-title')?.textContent || '';
    }

    /* =========================================================
       CARGA DE DATOS
       ========================================================= */
    async function cargarCatalogo() {
        try {
         
            const filtros = vistaCatalogo === 'eliminados'
                ? { soloEliminados: true }
                : { incluirInactivos: true };
            registros = await window.api.activoFijo.catalogos.listar(catalogoActual, filtros);
            cargado = true;
            renderTabla();
        } catch (err) {
            alertaError('No se pudieron cargar los datos', err.message);
        }
    }


    function estaActivo(registro) {
        return registro.Activo !== 0 && registro.Activo !== false;
    }

    /* =========================================================
       RENDER DE LA TABLA (en vivo con Vivo.js)
       ========================================================= */
    function renderTabla() {
        const cfg = CATALOGOS_FRONT[catalogoActual];
        if (!cfg || !elTablaHead || !elTablaBody) return;

        if (window.Vivo) {
            window.Vivo.enVivo(elTablaBody, () => pintarTabla(cfg));
            return;
        }
        pintarTabla(cfg);
    }

    /* ---------- Acciones de fila ---------- */
    const ICONO_EDITAR = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>`;

    const ICONO_RESTAURAR = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>`;

    const ICONO_ESTADO = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
            <line x1="12" y1="2" x2="12" y2="12"></line>
        </svg>`;


    const ICONO_PAPELERA = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M14.5 9.5l-5 5M9.5 9.5l5 5"></path>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
        </svg>`;

  
    function crearBotonAccion(clase, tooltip, svg, alHacerClic, permiso) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn-accion ${clase}`;
        btn.setAttribute('data-tooltip', tooltip);
        if (permiso) btn.setAttribute('data-permiso', permiso);
        btn.innerHTML = svg;
        btn.addEventListener('click', alHacerClic);
        return btn;
    }


    function crearAccionesFila(celda, cfg, registro) {
        if (!celda) return;
        const id = registro[cfg.pk];

        if (vistaCatalogo === 'eliminados') {
            celda.appendChild(crearBotonAccion('restaurar', 'Restaurar', ICONO_RESTAURAR,
                () => cambiarEstadoRegistro(id, true), 'af-cat:editar'));

            /* Purga física: sólo tiene sentido aquí, en Eliminados. */
            const nombre = registro.Nombre || `#${id}`;
            celda.appendChild(crearBotonAccion('definitivo', 'Eliminar definitivamente', ICONO_PAPELERA,
                () => eliminarDefinitivoRegistro(id, nombre), 'af-cat:eliminar'));
            return;
        }

        celda.appendChild(crearBotonAccion('editar', 'Editar', ICONO_EDITAR,
            () => abrirEdicionCat(id), 'af-cat:editar'));

        const activo = estaActivo(registro);
        celda.appendChild(crearBotonAccion(
            `estado ${activo ? 'desactivar' : 'activar'}`,
            activo ? 'Desactivar' : 'Activar',
            ICONO_ESTADO,
            () => cambiarEstadoRegistro(id, !activo),
            activo ? 'af-cat:eliminar' : 'af-cat:editar'
        ));
    }

    function marcarFilaInactiva(tr, registro) {
        if (vistaCatalogo === 'eliminados') return;
        if (estaActivo(registro)) return;
        tr.classList.add('fila-inactiva');
        const primeraCelda = tr.querySelector('td');
        if (!primeraCelda) return;
        const badge = document.createElement('span');
        badge.className = 'badge-estado inactivo';
        badge.textContent = 'Inactivo';
        primeraCelda.appendChild(badge);
    }

    function pintarTabla(cfg) {
        const listaFiltrada = registros.filter(r => {
            if (!busqueda) return true;
            const texto = cfg.campos
                .map(c => {
                    if (c.tipo === 'select') return etiquetaSelect(c, r[c.nombre]);
                    if (c.tipo === 'bool') return r[c.nombre] ? 'si yes' : 'no';
                    return String(r[c.nombre] ?? '');
                })
                .join(' ').toLowerCase();
            return texto.includes(busqueda);
        });

        elTablaBody.innerHTML = '';

        /* ---------- ESTADO VACÍO ---------- */
        if (listaFiltrada.length === 0) {
            const hayBusqueda = !!busqueda;
            pagCatalogo.mostrar(false);
            if (elSinResultados) elSinResultados.classList.remove('oculto');
            if (elCardTabla) elCardTabla.style.display = 'none';

            if (elSinResultadosTit) {
                elSinResultadosTit.textContent = hayBusqueda ? 'Sin coincidencias' : 'Sin registros';
            }
            if (elSinResultadosTxt) {
                if (hayBusqueda) {
                    elSinResultadosTxt.textContent = `Ningún registro coincide con "${elInputBusqueda?.value || ''}".`;
                } else if (vistaCatalogo === 'eliminados') {
                    elSinResultadosTxt.textContent = `Aún no hay ${cfg.titulo.toLowerCase()} dados de baja.`;
                } else {
                    elSinResultadosTxt.textContent = `Aún no hay ${cfg.titulo.toLowerCase()} registrados. Crea el primero con el botón de arriba.`;
                }
            }
            if (elBtnLimpiarFiltro) {
                elBtnLimpiarFiltro.style.display = hayBusqueda ? '' : 'none';
            }
            return;
        }

        if (elSinResultados) elSinResultados.classList.add('oculto');
        if (elCardTabla) elCardTabla.style.display = '';

        const filasVisibles = pagCatalogo.recortar(listaFiltrada);
        pagCatalogo.mostrar(true);

        /* ---------- RENDER ESPECIAL: TIPOS ---------- */
        if (catalogoActual === 'tipos') {
            elTablaHead.innerHTML = `
                <tr>
                    <th style="width:22%;">Nombre</th>
                    <th style="width:15%;">Grupo</th>
                    <th>Requisitos</th>
                    <th style="width:100px; text-align:right;">Acciones</th>
                </tr>
            `;

            const campoTipoGrupo = cfg.campos.find(c => c.nombre === 'GrupoSubtipo');

            filasVisibles.forEach(r => {
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

                crearAccionesFila(tr.querySelector('.acciones-tabla'), cfg, r);
                marcarFilaInactiva(tr, r);

                elTablaBody.appendChild(tr);
            });
            return;
        }

        /* ---------- RENDER NORMAL ---------- */
        const headers = cfg.campos.map(c => `<th>${escaparHTML(c.etiqueta)}</th>`);
        headers.push('<th style="width:100px; text-align:right;">Acciones</th>');
        elTablaHead.innerHTML = `<tr>${headers.join('')}</tr>`;

        filasVisibles.forEach(r => {
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

            crearAccionesFila(tr.querySelector('.acciones-tabla'), cfg, r);
            marcarFilaInactiva(tr, r);

            elTablaBody.appendChild(tr);
        });
    }

    /* =========================================================
       MODAL
       ========================================================= */
    function abrirModalCat() {
        if (!elModal) return;
        elModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function cerrarModalCat() {
        if (!elModal) return;
        elModal.style.display = 'none';
        document.body.style.overflow = '';
        ocultarMensajeCat();
        mostrarAvisoModal(null);
        editando = false;
        idEditando = null;
    }

    /* =========================================================
       CONSTRUIR FORMULARIO DEL CATÁLOGO
       ========================================================= */
    function construirFormulario(datos = {}) {
        const cfg = CATALOGOS_FRONT[catalogoActual];
        if (!cfg || !elCamposForm) return;

        elCamposForm.innerHTML = '';

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
                const bloqueado = (editando && c.esGrupoInmutable);
                const opcionesHtml = (c.opciones || []).map(op => {
                    const sel = String(datos[c.nombre] ?? '') === String(op.valor) ? 'selected' : '';
                    return `<option value="${escaparHTML(op.valor)}" ${sel}>${escaparHTML(op.etiqueta)}</option>`;
                }).join('');

                wrapper.innerHTML = `
                    <label for="cat-campo-${c.nombre}">${escaparHTML(c.etiqueta)}${reqMark}</label>
                    <select id="cat-campo-${c.nombre}" ${c.requerido ? 'required' : ''} ${bloqueado ? 'disabled' : ''}>
                        ${opcionesHtml}
                    </select>
                    ${bloqueado ? `<small class="campo-nota">El grupo no se puede cambiar una vez creado.</small>` : hintHTML}
                `;
            } else {
                wrapper.innerHTML = `
                    <label for="cat-campo-${c.nombre}">${escaparHTML(c.etiqueta)}${reqMark}</label>
                    <input type="text" id="cat-campo-${c.nombre}" maxlength="${c.max || ''}"
                           value="${escaparHTML(datos[c.nombre] ?? '')}"
                           ${c.requerido ? 'required' : ''}>
                    ${hintHTML}
                `;
            }
            elCamposForm.appendChild(wrapper);
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
                    <input type="checkbox" id="cat-campo-${c.nombre}" ${datos[c.nombre] ? 'checked' : ''}>
                    <span class="slider"></span>
                    <span class="label-txt">${escaparHTML(c.etiqueta)}</span>`;
                fila.appendChild(item);
            });

            grupo.appendChild(fila);
            elCamposForm.appendChild(grupo);
        }
    }

    /* =========================================================
       NUEVO / EDITAR
       ========================================================= */
    function aplicarPermisoGuardar(clave) {
        if (!elBtnGuardar) return;
        elBtnGuardar.setAttribute('data-permiso', clave);
        window.PermisosUI?.aplicar();
    }

    function abrirNuevoRegistro() {
        if (vistaCatalogo === 'eliminados') return;
        const cfg = CATALOGOS_FRONT[catalogoActual];
        if (!cfg) return;

        editando = false;
        idEditando = null;
        aplicarPermisoGuardar('af-cat:crear');
        if (elModalTitulo) elModalTitulo.textContent = `Nuevo ${cfg.tituloSingular}`;
        construirFormulario();
        ocultarMensajeCat();
        mostrarAvisoModal(null);
        abrirModalCat();

        const primerInput = elCamposForm ? elCamposForm.querySelector('input[type="text"], select') : null;
        if (primerInput) primerInput.focus();
    }

    function abrirEdicionCat(id) {
        const cfg = CATALOGOS_FRONT[catalogoActual];
        if (!cfg) return;
        const r = registros.find(x => x[cfg.pk] === id);
        if (!r) { alertaError('Registro no encontrado'); return; }

        editando = true;
        idEditando = id;
        aplicarPermisoGuardar('af-cat:editar');
        if (elModalTitulo) elModalTitulo.textContent = `Editar ${cfg.tituloSingular}`;
        construirFormulario(r);
        ocultarMensajeCat();
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

        abrirModalCat();
        const primerInput = elCamposForm ? elCamposForm.querySelector('input[type="text"], select:not([disabled])') : null;
        if (primerInput) { primerInput.focus(); primerInput.select?.(); }
    }

    /* =========================================================
       GUARDAR
       ========================================================= */
    async function guardarRegistro(e) {
        e.preventDefault();
        if (guardando) return;

        const cfg = CATALOGOS_FRONT[catalogoActual];
        if (!cfg) return;

        const datos = {};

        for (const c of cfg.campos) {
            const el = $(`cat-campo-${c.nombre}`);
            if (!el) continue;

            if (c.tipo === 'bool') {
                datos[c.nombre] = el.checked;
            } else {
                if (editando && c.esGrupoInmutable) continue;

                const val = el.value.trim();
                if (c.requerido && !val) {
                    mensajeCat(`${c.etiqueta} es obligatorio.`, 'error');
                    el.focus();
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
                datos[c.nombre] = val || null;
            }
        }

        if (catalogoActual === 'tipos') {
            const elReqSubtipo = $('cat-campo-RequiereSubtipo');
            const elGrupo      = $('cat-campo-GrupoSubtipo');
            const reqSubtipo   = elReqSubtipo ? elReqSubtipo.checked : false;
            const grupo        = elGrupo ? elGrupo.value : '';
            if (reqSubtipo && !grupo) {
                mensajeCat('Si el tipo requiere subtipo, debes indicar un Grupo de subtipo.', 'error');
                if (elGrupo) {
                    elGrupo.focus();
                    elGrupo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
        }

        setGuardandoCat(true);
        try {
            let res;
            if (editando && idEditando !== null) {
                res = await window.api.activoFijo.catalogos.actualizar(catalogoActual, idEditando, datos);
            } else {
                res = await window.api.activoFijo.catalogos.crear(catalogoActual, datos);
            }

            if (res && res.ok) {
                const mensajeRes = res.mensaje || (editando ? 'Registro actualizado.' : 'Registro creado.');
                cerrarModalCat();
                huboCambios = true;
                await cargarCatalogo();
                await alertaExito('Guardado correctamente', mensajeRes);
            } else {
                mensajeCat(res?.mensaje || 'No se pudo guardar.', 'error');
            }
        } catch (err) {
            mensajeCat('Error: ' + err.message, 'error');
        } finally {
            setGuardandoCat(false);
        }
    }

    /* =========================================================
       ACTIVAR / DESACTIVAR
       ========================================================= */
    async function cambiarEstadoRegistro(id, activar) {
        const cfg = CATALOGOS_FRONT[catalogoActual];
        if (!cfg) return;
        const r = registros.find(x => x[cfg.pk] === id);
        const nombre = r ? (r.Nombre || `#${id}`) : `#${id}`;

        try {
            const res = activar
                ? await window.api.activoFijo.catalogos.restaurar(catalogoActual, id)
                : await window.api.activoFijo.catalogos.eliminar(catalogoActual, id);

            if (res && res.ok) {
                huboCambios = true;
                await cargarCatalogo();
                await alertaExito(
                    activar ? 'Registro activado' : 'Registro desactivado',
                    `<strong>${escaparHTML(nombre)}</strong> ${activar
                        ? 'vuelve a estar disponible en los formularios.'
                        : 'ya no aparecerá en los formularios de activos.'}`
                );
            } else {
                await alertaError(
                    activar ? 'No se pudo activar' : 'No se pudo desactivar',
                    escaparHTML(res?.mensaje || 'Ocurrió un error inesperado.')
                );
            }
        } catch (err) {
            await alertaError('Error al cambiar el estado', escaparHTML(err.message));
        }
    }

    /* =========================================================
       PURGA FÍSICA DE UN REGISTRO DE CATÁLOGO
       ========================================================= */
    async function eliminarDefinitivoRegistro(id, nombre) {
        if (!CATALOGOS_FRONT[catalogoActual]) return;

        const resultado = await Swal.fire({
            icon: 'error',
            title: '¿Eliminar definitivamente?',
            html: `
                <div>Se borrará de la base de datos <strong>${escaparHTML(nombre)}</strong>.</div>
                <div style="margin-top:.65rem;"><strong>Esta acción no se puede deshacer.</strong><br>
                Si sólo querías ocultarlo de los formularios, cierra esta ventana y usa <em>Restaurar</em>.</div>
            `,
            showCloseButton: true,
            confirmButtonText: 'Sí, eliminar definitivamente',
            buttonsStyling: false,
            customClass: {
                popup: 'cl-confirm cl-confirm-peligro',
                confirmButton: 'swal2-confirm swal2-styled cl-peligro'
            }
        });

        if (!resultado.isConfirmed) return;

        try {
            const res = await window.api.activoFijo.catalogos.eliminarDefinitivo(catalogoActual, id);

            if (res && res.ok) {
                huboCambios = true;
                await cargarCatalogo();
                await alertaExito('Registro eliminado', `<strong>${escaparHTML(nombre)}</strong> ya no existe en la base de datos.`);
            } else {
                await alertaError('No se pudo eliminar', escaparHTML(res?.mensaje || 'Ocurrió un error inesperado.'));
            }
        } catch (err) {
            await alertaError('Error al eliminar', escaparHTML(err.message));
        }
    }

    /* =========================================================
       BUSCADOR DEL CATÁLOGO
       ========================================================= */
    function limpiarBusquedaCat() {
        if (elInputBusqueda) elInputBusqueda.value = '';
        busqueda = '';
        if (elBtnLimpiarBusq) elBtnLimpiarBusq.classList.add('oculto');
        pagCatalogo.reiniciar();
        renderTabla();
    }

    /* =========================================================
       LISTENERS
       ========================================================= */
    function conectarEventos() {
        if (elMenuToggle) {
            elMenuToggle.addEventListener('click', () => abrirMenuCatalogo());
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-seccion')) abrirMenuCatalogo(false);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            abrirMenuCatalogo(false);
            if (elModal && elModal.style.display === 'flex') cerrarModalCat();
        });

        if (elTabs) {
            elTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (!btn) return;

                abrirMenuCatalogo(false);
                if (btn.classList.contains('activo')) return;

                elTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('activo'));
                btn.classList.add('activo');

                catalogoActual = btn.dataset.catalogo;
                if (elInputBusqueda) elInputBusqueda.value = '';
                busqueda = '';
                if (elBtnLimpiarBusq) elBtnLimpiarBusq.classList.add('oculto');
                /* Otro catálogo, otro listado: se vuelve a la página 1. */
                pagCatalogo.reiniciar();

                actualizarUIDeCatalogo();
                cargarCatalogo();
            });
        }

        if (elTabsVista) {
            elTabsVista.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-vista');
                if (!btn || btn.classList.contains('activo')) return;

                elTabsVista.querySelectorAll('.tab-vista').forEach(t => t.classList.remove('activo'));
                btn.classList.add('activo');

                vistaCatalogo = btn.dataset.vista;
                pagCatalogo.reiniciar();

                if (elInputBusqueda) elInputBusqueda.value = '';
                busqueda = '';
                if (elBtnLimpiarBusq) elBtnLimpiarBusq.classList.add('oculto');

                actualizarUIDeCatalogo();
                cargarCatalogo();
            });
        }

        if (elInputBusqueda) {
            elInputBusqueda.addEventListener('input', () => {
                busqueda = elInputBusqueda.value.trim().toLowerCase();
                if (elBtnLimpiarBusq) elBtnLimpiarBusq.classList.toggle('oculto', !busqueda);
                /* Nuevo filtro: la página vigente ya no aplica. */
                pagCatalogo.reiniciar();
                renderTabla();
            });
        }

        if (elBtnLimpiarBusq) {
            elBtnLimpiarBusq.addEventListener('click', () => {
                limpiarBusquedaCat();
                if (elInputBusqueda) elInputBusqueda.focus();
            });
        }

        if (elBtnLimpiarFiltro) {
            elBtnLimpiarFiltro.addEventListener('click', limpiarBusquedaCat);
        }

        if (elBtnToggleAyuda) {
            elBtnToggleAyuda.addEventListener('click', () => {
                ayudaAbierta = !ayudaAbierta;
                aplicarEstadoAyuda();
            });
        }

        if (elBtnNuevo) elBtnNuevo.addEventListener('click', abrirNuevoRegistro);

        if (elBtnModalCerrar) elBtnModalCerrar.addEventListener('click', cerrarModalCat);
        if (elModal) {
            elModal.addEventListener('click', (e) => { if (e.target === elModal) cerrarModalCat(); });
        }

        if (elFormulario) elFormulario.addEventListener('submit', guardarRegistro);
    }

    /* =========================================================
       API PÚBLICA
       ========================================================= */
    function inicializar() {
        if (!CATALOGOS_FRONT[catalogoActual]) return;
        conectarEventos();
        actualizarUIDeCatalogo();
    }

    /* Al entrar a la vista: se refresca el catálogo abierto. */
    function mostrar() {
        actualizarUIDeCatalogo();
        return cargarCatalogo();
    }

    function ocultar() {
        if (tituloPagina) tituloPagina.textContent = HERO_INVENTARIO.titulo;
        if (subtituloPagina) subtituloPagina.textContent = HERO_INVENTARIO.subtitulo;
    }

    return {
        inicializar,
        mostrar,
        ocultar,
        huboCambios: () => huboCambios,
        limpiarCambios: () => { huboCambios = false; },
        estaCargado: () => cargado
    };
})();

/* =========================================================
   ARRANQUE
   ========================================================= */
(async () => {
    await aplicarPermisos();

    CatalogosUI.inicializar();

    const puedeVerInventario = permiteInventario();
    const puedeVerCatalogos  = permiteCatalogos();
    const hashPideCatalogos = (location.hash.replace('#', '').toLowerCase() === 'catalogos');
    const vistaInicial = (hashPideCatalogos && puedeVerCatalogos) || !puedeVerInventario
        ? 'catalogos'
        : 'activos';

    if (puedeVerInventario) await cargarCatalogos();

    await cambiarVista(vistaInicial, { permiteInventario: puedeVerInventario });
})();