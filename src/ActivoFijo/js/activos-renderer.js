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
        poblarCatalogoTexto(inpSO, catalogosEspecificaciones.sistemasOperativos, '— Seleccionar sistema operativo —');
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
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los activos', err.message);
    }
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


function textoPiezas(a) {
    const total = Number(a.Piezas) || 0;
    if (!total) return '—';
    const detalle = detallePiezas(a);
    return detalle ? `${total} (${detalle})` : String(total);
}

function pintarTabla() {
    const listaFiltrada = activos.filter(a => {
        if (!filtroBusqueda) return true;
        const texto = [
            a.NoSerie, a.IMEI1, a.IMEI2, a.NoTelefono,
            a.Marca, a.Modelo, a.Tipo,
            a.Estado, a.Estatus,
            a.Cartera, a.Sitio,
            a.UsuarioAsignado, a.Observaciones,
            a.Procesador, a.MemoriaRAM, a.Almacenamiento, a.SistemaOperativo,
            a.Accesorios, a.Subtipo, a.Clasificacion, a.Tamanio, a.Capacidad, a.Voltaje,
            (Array.isArray(a.PiezasTipos) ? a.PiezasTipos.map(t => NOMBRE_TIPO_PIEZA[t.tipo] || t.tipo).join(' ') : '')
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
   EXPORTAR INTELIGENTE A EXCEL
   ========================================================= */
btnExportar.addEventListener('click', async () => {
    if (!activos || activos.length === 0) {
        toastError('Sin datos', 'No hay activos para exportar.');
        return;
    }

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

    let datosExport = [];
    let columnas = [];
    let tituloReporte = 'Inventario_General';

    if (idTipo) {
        // Filtrar por tipo
        const tipoSel = tipos.find(t => t.IdTipo == idTipo);
        datosExport = activos.filter(a => a.IdTipo == idTipo);
        tituloReporte = `Inventario_${tipoSel.Nombre.replace(/\s+/g, '_')}`;

        if (datosExport.length === 0) {
            toastError('Sin datos', `No hay activos registrados de tipo "${tipoSel.Nombre}".`);
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
      
        datosExport = activos;
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

   
    columnas.push({ header: 'Piezas conectadas', key: 'PiezasTexto', width: 34 });
    datosExport = datosExport.map(a => ({ ...a, PiezasTexto: textoPiezas(a) }));

    const confirm = await Swal.fire({
        icon: 'question',
        title: '¿Generar Excel?',
        html: `Se exportarán <strong>${datosExport.length}</strong> registros con <strong>${columnas.length}</strong> columnas.`,
        showCloseButton: true,
        confirmButtonText: 'Sí, generar',
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
        const payload = {
            titulo: tituloReporte,
            columnas: columnas,
            datos: datosExport
        };

        const res = await window.api.activoFijo.activos.exportarExcel(payload);
        Swal.close();

        if (res && res.ok) {
            await Swal.fire({
                icon: 'success',
                title: 'Excel generado',
                html: `Se guardó en:<br><code style="background:#FFF7E8;padding:4px 8px;border-radius:6px;color:#2E3228;word-break:break-all;font-size:0.82rem;">${escaparHTML(res.ruta)}</code>`,
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
        return;
    }

    toggle('.campo-imei1', !!tipo.RequiereIMEI);
    toggle('.campo-imei2', !!tipo.RequiereIMEI);
    toggle('.campo-telefono', !!tipo.RequiereTelefono);
    toggle('.campo-sitio',         !!tipo.RequiereSitio);
    toggle('.campo-subtipo',       !!tipo.RequiereSubtipo);
    toggle('.campo-clasificacion', !!tipo.RequiereClasificacion);
    toggle('.campo-tamanio',       !!tipo.RequiereTamanio);
    toggle('.campo-capacidad',     !!tipo.RequiereCapacidad);
    toggle('.campo-voltaje',       !!tipo.RequiereVoltaje);
    toggle('.campo-precio', !!tipo.RequierePrecio);
    toggle('.bloque-especificaciones', !!tipo.RequiereEspecificaciones);
    toggle('.campo-accesorios', !!tipo.RequiereAccesorios);

    if (tipo.RequiereSubtipo) {
        poblarSubtipos(tipo.GrupoSubtipo);
    } else {
        poblarSubtipos(null);
    }

    if (tipo.RequiereUsuarioAsignado) {
        const esAlmacenamiento = (tipo.Nombre === 'SSD NVME' || tipo.Nombre === 'DISCO MECANICO');
        if (esAlmacenamiento) {
            actualizarUsuarioAsignado();
        } else {
            toggle('.campo-usuario-asignado', true);
        }
    } else {
        toggle('.campo-usuario-asignado', false);
    }
}

selClasificacion.addEventListener('change', actualizarUsuarioAsignado);

function actualizarUsuarioAsignado() {
    const idTipo = parseInt(selTipo.value, 10);
    const tipo = tipos.find(t => t.IdTipo === idTipo);
    if (!tipo || !tipo.RequiereUsuarioAsignado) {
        document.querySelector('.campo-usuario-asignado')?.classList.add('oculto');
        return;
    }

    const esAlmacenamiento = (tipo.Nombre === 'SSD NVME' || tipo.Nombre === 'DISCO MECANICO');
    if (!esAlmacenamiento) {
        document.querySelector('.campo-usuario-asignado')?.classList.remove('oculto');
        return;
    }

    const idCla = parseInt(selClasificacion.value, 10);
    const cla = clasificaciones.find(c => c.IdClasificacion === idCla);
    const esExterno = cla && cla.Nombre.toUpperCase() === 'EXTERNO';

    document.querySelector('.campo-usuario-asignado')?.classList.toggle('oculto', !esExterno);
}


function activoEnUso(estatus) {
    const nombre = String(estatus ?? '').trim().toUpperCase();
    return nombre === 'ASIGNADO' || nombre === 'PENDIENTE';
}


function aplicarEstadoUsuarioAsignado(enUso) {
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

function abrirEdicion(id) {
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
    seleccionarCatalogoTexto(inpSO, a.SistemaOperativo);
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

    if (tipo.RequiereSubtipo && !selSubtipo.value) {
        mostrarMensaje('El subtipo es obligatorio para este tipo.', 'error'); return;
    }
    if (tipo.RequiereClasificacion && !selClasificacion.value) {
        mostrarMensaje('La clasificación es obligatoria para este tipo.', 'error'); return;
    }
    if (tipo.RequiereTamanio && !selTamanio.value) {
        mostrarMensaje('El tamaño es obligatorio para este tipo.', 'error'); return;
    }
    if (tipo.RequiereCapacidad && !selCapacidad.value) {
        mostrarMensaje('La capacidad es obligatoria para este tipo.', 'error'); return;
    }
    if (tipo.RequiereVoltaje && !selVoltaje.value) {
        mostrarMensaje('El voltaje es obligatorio para este tipo.', 'error'); return;
    }
    if (tipo.RequiereEspecificaciones && (!inpProcesador.value || !inpRAM.value || !inpAlmacenamiento.value || !inpSO.value)) {
        mostrarMensaje('Selecciona procesador, memoria RAM, almacenamiento y sistema operativo del catálogo.', 'error'); return;
    }
    if (tipo.RequiereAccesorios && !inpAccesorios.value) {
        mostrarMensaje('Selecciona los accesorios del catálogo.', 'error'); return;
    }
    
    const campoUsuarioVisible = !document.querySelector('.campo-usuario-asignado')?.classList.contains('oculto');
    const activoEditando = (modoEdicion && idEditando !== null)
        ? activos.find(x => x.IdActivoFijoEQ === idEditando)
        : null;
    const usuarioObligatorio = !!tipo.RequiereUsuarioAsignado && campoUsuarioVisible &&
        (!activoEditando || activoEnUso(activoEditando.Estatus));
    if (usuarioObligatorio && !inpUsuarioAsig.value.trim()) {
        mostrarMensaje('Selecciona el usuario asignado del catálogo.', 'error'); return;
    }
    if (tipo.RequierePrecio && !inpPrecio.value.trim()) {
        mostrarMensaje('El precio es obligatorio para este tipo.', 'error'); return;
    }

    const precioNum = inpPrecio.value.trim() ? parseFloat(inpPrecio.value) : null;

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
        SistemaOperativo: inpSO.value.trim() || null,
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
                  hint: 'Ej. Windows 11 Pro.' }
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