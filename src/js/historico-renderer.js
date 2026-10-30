/* =========================================================
   SWEETALERT
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   TOASTS
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
        customClass: { popup: 'cl-toast' },
        didOpen: (toast) => {
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
        customClass: { popup: 'cl-toast' },
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   LIMPIEZA DE RESIDUOS SWEETALERT2
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
   REFERENCIAS DOM
   ========================================================= */
const selectCliente       = document.getElementById('select-cliente');
const selectLugar         = document.getElementById('select-lugar');
const inputBusqueda       = document.getElementById('input-busqueda');
const btnLimpiarBusqueda  = document.getElementById('btn-limpiar-busqueda');
const filtroDesde         = document.getElementById('filtro-desde');
const filtroHasta         = document.getElementById('filtro-hasta');
const btnLimpiarFiltros   = document.getElementById('btn-limpiar-filtros');
const contadorMovs        = document.getElementById('contador-movimientos');
const panelSubtitulo      = document.getElementById('panel-subtitulo');

const tabla               = document.getElementById('tabla-historico');
const contenedorTabla     = document.getElementById('contenedor-tabla');
const estadoInicial       = document.getElementById('estado-inicial');
const sinResultados       = document.getElementById('sin-resultados');
const textoSinRes         = document.getElementById('texto-sin-resultados');

const chipsFecha          = document.querySelectorAll('.chip-fecha');

/* =========================================================
   ESTADO
   ========================================================= */
let clientes     = [];
let pisos        = [];
let historicos   = [];
let filtroTexto  = '';

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

function iconoUsuarioSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>`;
}

function iconoInfoSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>`;
}

function formatearFecha(fechaISO) {
    const f = new Date(fechaISO);
    if (isNaN(f.getTime())) return { fecha: '—', hora: '' };
    const dia  = String(f.getDate()).padStart(2, '0');
    const mes  = String(f.getMonth() + 1).padStart(2, '0');
    const anio = f.getFullYear();
    const hh   = String(f.getHours()).padStart(2, '0');
    const mm   = String(f.getMinutes()).padStart(2, '0');
    return { fecha: `${dia}/${mes}/${anio}`, hora: `${hh}:${mm}` };
}

/* Formatea Date → "YYYY-MM-DD" usando hora LOCAL (no UTC) */
function fechaAInput(date) {
    const anio = date.getFullYear();
    const mes  = String(date.getMonth() + 1).padStart(2, '0');
    const dia  = String(date.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

/* Extrae el prefijo del hostname para los códigos de color.
   Ej: "AGT-NU228" → "AGT" ; "CLD-NU250" → "CLD" */
function obtenerPrefijoHostname(hostname) {
    if (!hostname) return '';
    const partes = hostname.split('-');
    return partes.length > 1 ? partes[0].toUpperCase() : '';
}

/* =========================================================
   ETIQUETA / CLASE POR ACCIÓN
   ⚠️ SWAPISO y SWAP se muestran como "Mover"
   ========================================================= */
function etiquetaAccion(accion) {
    const map = {
        'asignar':         'Asignar',
        'mover':           'Mover',
        'intercambiar':    'Mover',
        'swapiso':         'Mover',            // ← DB manda "SWAPISO"
        'swap':            'Mover',            // ← por si acaso
        'quitar':          'Quitar',
        'cambiopiso':      'Cambio de piso',
        'crear_zona':      'Crear zona',
        'actualizar_zona': 'Editar zona',
        'eliminar_zona':   'Eliminar zona',
        'actualizar_dim':  'Cambiar tamaño'
    };
    const key = (accion || '').toLowerCase().replace(/\s+/g, '');
    return map[key] || (accion ? accion.charAt(0).toUpperCase() + accion.slice(1) : '—');
}

function claseAccion(accion) {
    if (!accion) return 'accion-def';
    const key = accion.toLowerCase();
    if (key.includes('asignar'))      return 'accion-asignar';
    if (key.includes('swap'))         return 'accion-mover';
    if (key.includes('intercambiar')) return 'accion-mover';
    if (key.includes('mover'))        return 'accion-mover';
    if (key.includes('quitar'))       return 'accion-quitar';
    if (key.includes('cambiopiso') || key.includes('cambio_piso') || key.includes('cambio piso'))
                                      return 'accion-cambiopiso';
    if (key.includes('zona'))         return 'accion-zona';
    if (key.includes('dim'))          return 'accion-dimensiones';
    return 'accion-def';
}

function limpiarDetalleCambioPiso(detalle) {
    if (!detalle) return detalle;
    return detalle
        .replace(/^Movido\s+de\s+piso\s+\d+\s+a\s+piso\s+\d+\s*/i, '')
        .replace(/^Movido\s+de\s+.+?\s+a\s+.+?\s*(?=\()/i, '')
        .trim();
}

/* =========================================================
   DETALLE ENRIQUECIDO
   ========================================================= */
function generarDetalle(h) {
    const accion      = (h.Accion || '').toLowerCase();
    const origenFK    = h.PisoOrigen;
    const destinoFK   = h.PisoDestino;
    const pisoBase    = h.NombrePisoBase;

    const esCambioPiso = accion.includes('cambiopiso') ||
                         accion.includes('cambio_piso') ||
                         accion.includes('cambio piso');

    let contextoHTML = '';
    let detalleTexto = '';

    if (esCambioPiso && origenFK && destinoFK) {
        contextoHTML = `
            <div class="ruta-movimiento">
                <span class="piso">${escaparHTML(origenFK)}</span>
                <span class="flecha">→</span>
                <span class="piso">${escaparHTML(destinoFK)}</span>
            </div>
        `;
        detalleTexto = limpiarDetalleCambioPiso(h.Detalle);
    } else if (esCambioPiso && (origenFK || destinoFK)) {
        contextoHTML = `
            <div class="ruta-movimiento">
                <span class="piso">${escaparHTML(origenFK || '—')}</span>
                <span class="flecha">→</span>
                <span class="piso">${escaparHTML(destinoFK || '—')}</span>
            </div>
        `;
        detalleTexto = limpiarDetalleCambioPiso(h.Detalle);
    } else if (pisoBase) {
        contextoHTML = `
            <div class="ruta-movimiento">
                <span class="piso">${escaparHTML(pisoBase)}</span>
                <span class="flecha">↻</span>
                <span class="piso">mismo piso</span>
            </div>
        `;
        detalleTexto = h.Detalle;
    } else {
        detalleTexto = h.Detalle;
    }

    detalleTexto = detalleTexto && detalleTexto.trim() ? escaparHTML(detalleTexto) : null;

    if (!detalleTexto && !contextoHTML) {
        return `<div class="detalle-celda vacia">— sin detalle —</div>`;
    }

    return `
        <div class="detalle-celda">
            ${iconoInfoSVG()}
            <div>
                ${detalleTexto ? `<div>${detalleTexto}</div>` : ''}
                ${contextoHTML}
            </div>
        </div>
    `;
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => {
    window.api.volverMenu();
});

/* =========================================================
   VALIDACIÓN DE API
   ========================================================= */
function validarAPI() {
    if (!window.api) {
        toastError('API no disponible', 'window.api no está definido. Revisa el preload.');
        return false;
    }
    if (!window.api.clientes || typeof window.api.clientes.listar !== 'function') {
        toastError('API incompleta', 'window.api.clientes.listar no existe.');
        return false;
    }
    if (!window.api.pisos || typeof window.api.pisos.listarPorCliente !== 'function') {
        toastError('API incompleta', 'window.api.pisos.listarPorCliente no existe. Revisa el preload.');
        return false;
    }
    if (!window.api.historicos || typeof window.api.historicos.listar !== 'function') {
        toastError('API incompleta', 'window.api.historicos.listar no existe. Agrégalo al preload.');
        return false;
    }
    return true;
}

/* =========================================================
   CARGA DE CLIENTES
   ========================================================= */
async function cargarClientes() {
    try {
        clientes = await window.api.clientes.listar();
        selectCliente.innerHTML = '<option value="">-- Selecciona cliente --</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.IdCliente);
            opt.textContent = `${c.Codigo} - ${c.Nombre}`;
            selectCliente.appendChild(opt);
        });
    } catch (err) {
        toastError('No se pudieron cargar los clientes', err.message);
    }
}

/* =========================================================
   CARGA DE PISOS DEL CLIENTE
   ========================================================= */
async function cargarPisosCliente(idCliente) {
    try {
        pisos = await window.api.pisos.listarPorCliente(idCliente);

        if (!pisos || pisos.length === 0) {
            selectLugar.innerHTML = '<option value="">Sin pisos asignados</option>';
            selectLugar.disabled = true;
            return;
        }

        selectLugar.disabled = false;
        selectLugar.innerHTML = '<option value="">Todos los pisos</option>';
        pisos.forEach(p => {
            const opt = document.createElement('option');
            opt.value = String(p.IdPiso);
            opt.textContent = p.Nombre;
            selectLugar.appendChild(opt);
        });
    } catch (err) {
        toastError('No se pudieron cargar los pisos', err.message);
    }
}

/* =========================================================
   CARGA DE HISTÓRICO
   ========================================================= */
async function cargarHistorico() {
    const idCliente = parseInt(selectCliente.value, 10) || null;
    const idPiso    = parseInt(selectLugar.value, 10) || null;

    if (!idCliente) {
        historicos = [];
        mostrarEstadoInicial();
        actualizarSubtitulo(null, null);
        return;
    }

    try {
        historicos = await window.api.historicos.listar(idCliente, idPiso);
        renderTabla();
        actualizarSubtitulo(idCliente, idPiso);
    } catch (err) {
        toastError('No se pudieron cargar los movimientos', err.message);
        mostrarSinResultados('Error al cargar los movimientos.');
    }
}

/* =========================================================
   SUBTÍTULO DINÁMICO
   ========================================================= */
function actualizarSubtitulo(idCliente, idPiso) {
    if (!idCliente) {
        panelSubtitulo.textContent = 'Selecciona un cliente para comenzar';
        return;
    }

    const cli = clientes.find(c => Number(c.IdCliente) === Number(idCliente));
    const p   = idPiso ? pisos.find(x => Number(x.IdPiso) === Number(idPiso)) : null;

    if (cli && p)  panelSubtitulo.textContent = `${cli.Nombre} · ${p.Nombre}`;
    else if (cli)  panelSubtitulo.textContent = `${cli.Nombre} · Todos los pisos`;
    else           panelSubtitulo.textContent = 'Movimientos';
}

/* =========================================================
   ESTADOS DE VISTA
   ========================================================= */
function mostrarEstadoInicial() {
    contenedorTabla.classList.add('oculto');
    sinResultados.classList.add('oculto');
    estadoInicial.classList.remove('oculto');
    contadorMovs.classList.add('oculto');
}

function mostrarSinResultados(texto = 'No hay movimientos registrados.') {
    contenedorTabla.classList.add('oculto');
    estadoInicial.classList.add('oculto');
    textoSinRes.textContent = texto;
    sinResultados.classList.remove('oculto');
    contadorMovs.classList.add('oculto');
}

function mostrarTabla() {
    estadoInicial.classList.add('oculto');
    sinResultados.classList.add('oculto');
    contenedorTabla.classList.remove('oculto');
}

function actualizarContador(n) {
    contadorMovs.textContent = `${n} ${n === 1 ? 'movimiento' : 'movimientos'}`;
    contadorMovs.classList.toggle('oculto', n === 0);
}

/* =========================================================
   FILTRADO (texto + rango de fechas)
   ========================================================= */
function aplicarFiltros(lista) {
    let resultado = lista;

    if (filtroTexto) {
        resultado = resultado.filter(h => {
            const texto = [
                h.NombreUsuario, h.Nombres, h.Apellidos,
                h.Hostname, h.Detalle, h.Accion,
                h.PisoOrigen, h.PisoDestino, h.NombrePisoBase
            ].filter(Boolean).join(' ').toLowerCase();
            return texto.includes(filtroTexto);
        });
    }

    const desde = filtroDesde.value ? new Date(filtroDesde.value + 'T00:00:00') : null;
    const hasta = filtroHasta.value ? new Date(filtroHasta.value + 'T23:59:59') : null;
    if (desde || hasta) {
        resultado = resultado.filter(h => {
            const f = new Date(h.Fecha);
            if (isNaN(f.getTime())) return false;
            if (desde && f < desde) return false;
            if (hasta && f > hasta) return false;
            return true;
        });
    }

    return resultado;
}

/* =========================================================
   RENDER
   ========================================================= */
function renderTabla() {
    tabla.innerHTML = '';

    const filtrados = aplicarFiltros(historicos);

    if (!filtrados || filtrados.length === 0) {
        if (historicos.length === 0) {
            mostrarSinResultados('No hay movimientos registrados para este cliente o piso.');
        } else {
            const razones = [];
            if (filtroTexto) razones.push(`"${filtroTexto}"`);
            if (filtroDesde.value || filtroHasta.value) razones.push('el rango de fechas');
            mostrarSinResultados(`No hay movimientos que coincidan con ${razones.join(' y ') || 'los filtros'}.`);
        }
        return;
    }

    mostrarTabla();
    actualizarContador(filtrados.length);

    filtrados.forEach(h => {
        const { fecha, hora } = formatearFecha(h.Fecha);
        const usuarioCompleto = `${h.NombreUsuario} (${h.Nombres} ${h.Apellidos})`;
        const claseAcc = claseAccion(h.Accion);
        const etiqueta = etiquetaAccion(h.Accion);

        // ─── NUEVO: Extraemos el prefijo del hostname para data-color ───
        const prefijo = obtenerPrefijoHostname(h.Hostname);
        
        const equipoHTML = h.Hostname
            ? `<span class="badge-equipo" data-color="${escaparHTML(prefijo)}">${escaparHTML(h.Hostname)}</span>`
            : `<span class="badge-equipo vacia">— sin equipo —</span>`;

        const detalleHTML = generarDetalle(h);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Fecha">
                <span class="badge-fecha">
                    ${fecha}
                    <span class="hora">${hora}</span>
                </span>
            </td>
            <td data-label="Usuario">
                <span class="badge-usuario" title="${escaparHTML(usuarioCompleto)}">
                    ${iconoUsuarioSVG()}
                    ${escaparHTML(h.NombreUsuario)}
                </span>
            </td>
            <td data-label="Acción">
                <span class="badge-accion ${claseAcc}">
                    ${escaparHTML(etiqueta)}
                </span>
            </td>
            <td data-label="Equipo">${equipoHTML}</td>
            <td data-label="Detalle" class="detalle-td">${detalleHTML}</td>
        `;
        tabla.appendChild(tr);
    });
}

/* =========================================================
   EVENTOS — CLIENTE / PISO
   ========================================================= */
selectCliente.addEventListener('change', async () => {
    const idCliente = parseInt(selectCliente.value, 10);

    if (!idCliente) {
        selectLugar.innerHTML = '<option value="">Todos los pisos</option>';
        selectLugar.disabled = true;
        historicos = [];
        mostrarEstadoInicial();
        actualizarSubtitulo(null, null);
        return;
    }

    await cargarPisosCliente(idCliente);
    await cargarHistorico();
});

selectLugar.addEventListener('change', () => {
    if (selectCliente.value) cargarHistorico();
});

/* =========================================================
   EVENTOS — BÚSQUEDA
   ========================================================= */
inputBusqueda.addEventListener('input', () => {
    filtroTexto = inputBusqueda.value.trim().toLowerCase();
    btnLimpiarBusqueda.classList.toggle('oculto', !filtroTexto);
    if (historicos.length > 0) renderTabla();
});

btnLimpiarBusqueda.addEventListener('click', () => {
    inputBusqueda.value = '';
    filtroTexto = '';
    btnLimpiarBusqueda.classList.add('oculto');
    if (historicos.length > 0) renderTabla();
    inputBusqueda.focus();
});

/* =========================================================
   EVENTOS — CHIPS RÁPIDOS DE FECHA
   ========================================================= */
chipsFecha.forEach(chip => {
    chip.addEventListener('click', () => {
        chipsFecha.forEach(c => c.classList.remove('activo'));
        chip.classList.add('activo');

        const dias = parseInt(chip.dataset.dias, 10);

        if (dias > 0) {
            const hoy = new Date();
            const desde = new Date();
            desde.setDate(hoy.getDate() - (dias - 1));
            filtroDesde.value = fechaAInput(desde);
            filtroHasta.value = fechaAInput(hoy);
        } else {
            filtroDesde.value = '';
            filtroHasta.value = '';
        }

        if (historicos.length > 0) renderTabla();
    });
});

/* =========================================================
   EVENTOS — FECHAS MANUALES
   ========================================================= */
function alCambiarFecha() {
    chipsFecha.forEach(c => c.classList.remove('activo'));
    if (historicos.length > 0) renderTabla();
}
filtroDesde.addEventListener('change', alCambiarFecha);
filtroHasta.addEventListener('change', alCambiarFecha);

/* =========================================================
   EVENTOS — LIMPIAR TODO
   ========================================================= */
btnLimpiarFiltros.addEventListener('click', () => {
    filtroTexto = '';
    inputBusqueda.value = '';
    btnLimpiarBusqueda.classList.add('oculto');

    filtroDesde.value = '';
    filtroHasta.value = '';

    selectLugar.value = '';

    chipsFecha.forEach(c => c.classList.remove('activo'));
    const chipTodo = document.querySelector('.chip-fecha[data-dias="0"]');
    if (chipTodo) chipTodo.classList.add('activo');

    if (selectCliente.value) {
        cargarHistorico();
    } else if (historicos.length > 0) {
        renderTabla();
    }
});

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    if (!validarAPI()) return;
    mostrarEstadoInicial();
    await cargarClientes();
    limpiarResiduosSwal();
})();