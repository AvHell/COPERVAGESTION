/* =========================================================
   ESTADO GLOBAL
   ========================================================= */

let clientes = [];
let pisos = [];
let roles = [];
let dominiosCache = {};

const clientesFiltroIzq = new Set();
const clientesFiltroDer = new Set();

const panelIzq = crearEstadoPanel('izq');
const panelDer = crearEstadoPanel('der');
let panelActivo = panelIzq;

function crearEstadoPanel(sufijo) {
    return {
        sufijo,
        idPiso: null,
        clientesDelPiso: [],
        dimensiones: { Filas: 8, Columnas: 12 },
        celdas: [],
        zonas: [],
        zonasLibres: [],
        equiposSinUbicar: []
    };
}

/* Zona Libre: marcar celdas vacías */
let modoZonaLibre = false;
let celdasLibresSeleccionadas = [];
let colorSeleccionadoLibre = '#e74c3c';

/* Zona Normal: manual 1×1 acumulativo (permite celdas con o sin equipo) */
let modoZona = false;
let celdasZonaSeleccionadas = [];  // [{fila, columna}, ...]
let colorSeleccionado = '#e74c3c';

/* Edición */
let modoEdicion = false;
let equipoEditando = null;

let zonaEditando = null;

let dragOrigen = null;
let moverPendiente = null;

let tabActivo = '__todos__';
let filtroRolActivo = '__todos__';
let filtroBusquedaLateral = '';

let guardandoZonaLibre = false;

/* Estado del modal editar */
let edDominiosCargados = [];
let edPisosCliente = [];
let edGuardando = false;

/* =========================================================
   REFERENCIA A LA VENTANA DE VISTA PREVIA
   (para cerrarla cuando se cierre el plano)
   ========================================================= */
let ventanaVistaPrevia = null;

const COLORES_DISPONIBLES = [
    '#e74c3c', '#e67e22', '#f1c40f', '#27ae60',
    '#3498db', '#9b59b6', '#95a5a6', '#2c3e50'
];

const CELL_W = 74;
const CELL_H = 52;
const CELL_GAP = 5;
const GRID_PADDING = 10;

/* =========================================================
   TOAST
   ========================================================= */
function mostrarToast(mensaje, tipo = 'exito', duracion = 2800) {
    let cont = document.getElementById('toast-container');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'toast-container';
        cont.className = 'toast-container';
        document.body.appendChild(cont);
    }

    const iconos = { exito: '✓', error: '✕', info: 'i', warn: '!' };

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <span class="toast-icon">${iconos[tipo] || '✓'}</span>
        <span class="toast-texto">${mensaje}</span>
    `;
    cont.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('saliendo');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 250);
    }, duracion);
}

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */

const contenedorPrincipal = document.getElementById('contenedor-principal');

const selectLugarIzq   = document.getElementById('select-lugar-izq');
const inputFilasIzq    = document.getElementById('input-filas-izq');
const inputColumnasIzq = document.getElementById('input-columnas-izq');
const gridIzq          = document.getElementById('grid-izq');
const llavesIzq        = document.getElementById('llaves-izq');

const selectLugarDer   = document.getElementById('select-lugar-der');
const inputFilasDer    = document.getElementById('input-filas-der');
const inputColumnasDer = document.getElementById('input-columnas-der');
const gridDer          = document.getElementById('grid-der');
const llavesDer        = document.getElementById('llaves-der');
const panelDerDiv      = document.getElementById('panel-der');

const selectModo       = document.getElementById('select-modo');

const panelLateral     = document.getElementById('panel-lateral');
const lateralBackdrop  = document.getElementById('lateral-backdrop');
const btnToggleLateral = document.getElementById('btn-toggle-lateral');
const btnCerrarLateral = document.getElementById('btn-cerrar-lateral');
const badgeToggle      = document.getElementById('badge-toggle');

const listaSinUbicar   = document.getElementById('lista-sin-ubicar');
const listaZonas       = document.getElementById('lista-zonas');
const lateralTabs      = document.getElementById('lateral-tabs');
const lateralFiltrosRol = document.getElementById('lateral-filtros-rol');
const buscadorLateral  = document.getElementById('buscador-lateral');

const btnModoZona         = document.getElementById('btn-modo-zona');
const btnModoZonaLibre    = document.getElementById('btn-modo-zona-libre');
const btnModoEdicion      = document.getElementById('btn-modo-edicion');
const btnLimpiarSeleccion = document.getElementById('btn-limpiar-seleccion');
const btnVistaPrevia      = document.getElementById('btn-vista-previa');
const btnExportarPDFDoc   = document.getElementById('btn-exportar-pdf-doc');

const filtroClientesIzq = document.getElementById('filtro-clientes-izq');
const filtroClientesDer = document.getElementById('filtro-clientes-der');
const wrapFiltroDer     = document.getElementById('filtro-clientes-der-wrap');

const modal          = document.getElementById('modal');
const modalTitulo    = document.getElementById('modal-titulo');
const modalTexto     = document.getElementById('modal-texto');
const modalAceptar   = document.getElementById('modal-aceptar');
const modalCancelar  = document.getElementById('modal-cancelar');

const modalZona         = document.getElementById('modal-zona');
const modalZonaTitulo   = document.getElementById('modal-zona-titulo');
const modalZonaNombre   = document.getElementById('zona-nombre');
const modalZonaRango    = document.getElementById('zona-rango');
const modalZonaAceptar  = document.getElementById('modal-zona-aceptar');
const modalZonaCancelar = document.getElementById('modal-zona-cancelar');
const coloresZonaDiv    = document.getElementById('colores-zona');

const modalMover        = document.getElementById('modal-mover-piso');
const moverTitulo       = document.getElementById('mover-titulo');
const moverInfo         = document.getElementById('mover-info');
const chkMantener       = document.getElementById('chk-mantener');
const formEditarMover   = document.getElementById('form-editar-mover');
const mvCliente         = document.getElementById('mv-cliente');
const mvLugar           = document.getElementById('mv-lugar');
const mvRol             = document.getElementById('mv-rol');
const mvTipoIP          = document.getElementById('mv-tipoIP');
const mvHostname        = document.getElementById('mv-hostname');
const mvIP              = document.getElementById('mv-ip');
const mvMascara         = document.getElementById('mv-mascara');
const mvPuerta          = document.getElementById('mv-puerta');
const mvDns1            = document.getElementById('mv-dns1');
const mvDns2            = document.getElementById('mv-dns2');
const mvUsuario         = document.getElementById('mv-usuario');
const mvPassword        = document.getElementById('mv-password');
const moverMensaje      = document.getElementById('mover-mensaje');
const moverCancelar     = document.getElementById('mover-cancelar');
const moverConfirmar    = document.getElementById('mover-confirmar');

const modalZonaLibre          = document.getElementById('modal-zona-libre');
const modalZonaLibreTitulo    = document.getElementById('modal-zona-libre-titulo');
const modalZonaLibreNombre    = document.getElementById('zona-libre-nombre');
const modalZonaLibreCeldas    = document.getElementById('zona-libre-celdas');
const modalZonaLibreAceptar   = document.getElementById('modal-zona-libre-aceptar');
const modalZonaLibreCancelar  = document.getElementById('modal-zona-libre-cancelar');
const coloresZonaLibreDiv     = document.getElementById('colores-zona-libre');

/* ===== Modal Editar Equipo ===== */
const modalEditarEquipo    = document.getElementById('modal-editar-equipo');
const editarTitulo         = document.getElementById('editar-titulo');
const editarInfo           = document.getElementById('editar-info');

const edCliente            = document.getElementById('ed-cliente');
const edPiso               = document.getElementById('ed-piso');
const edRol                = document.getElementById('ed-rol');
const edTipoIP             = document.getElementById('ed-tipoIP');

const edIP                 = document.getElementById('ed-ip');
const edNumeroHost         = document.getElementById('ed-numeroHost');
const edHostnamePreview    = document.getElementById('ed-hostnamePreview');
const edChkManual          = document.getElementById('ed-chk-hostname-manual');
const edFilaCheckbox       = document.getElementById('ed-filaCheckboxHostname');
const edCampoHostEst       = document.getElementById('ed-campoHostnameEstatico');
const edCampoHostDHCP      = document.getElementById('ed-campoHostnameDHCP');
const edHostnameLibre      = document.getElementById('ed-hostname-libre');

const edSeccionRed         = document.getElementById('ed-seccion-red');
const edMascara            = document.getElementById('ed-mascara');
const edPuerta             = document.getElementById('ed-puerta');
const edDns1               = document.getElementById('ed-dns1');
const edDns2               = document.getElementById('ed-dns2');

const edUsuario            = document.getElementById('ed-usuario');
const edPassword           = document.getElementById('ed-password');

const editarMensaje        = document.getElementById('editar-mensaje');
const editarCancelar       = document.getElementById('editar-cancelar');
const editarConfirmar      = document.getElementById('editar-confirmar');

/* =========================================================
   TOOLTIP — MEJORADO (más grande, detallado y legible)
   ========================================================= */
let tooltipDiv = null;

function crearTooltip() {
    tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'tooltip-plano';
    tooltipDiv.style.display = 'none';
    document.body.appendChild(tooltipDiv);
}

function mostrarTooltip(ev, contenido) {
    if (!tooltipDiv) crearTooltip();

    const clienteTexto = contenido.clienteNombre
        ? `${contenido.cliente || ''} — ${contenido.clienteNombre}`
        : (contenido.cliente || '—');

    const ipTexto = contenido.ip
        ? contenido.ip
        : 'DHCP (sin IP estática)';

    const usuarioTexto = contenido.usuarioAdmin
        ? contenido.usuarioAdmin
        : '—';

    const descripcionTexto = contenido.descripcionAdmin
        ? contenido.descripcionAdmin
        : '—';

    tooltipDiv.innerHTML = `
        <div class="tooltip-header">
            <span class="rol-badge" data-rol="${contenido.rol || ''}">${contenido.rol || 'SIN ROL'}</span>
            <span class="hostname">${contenido.hostname || '—'}</span>
        </div>
        <div class="tooltip-body">
            <div class="tooltip-row">
                <span class="label">Cliente:</span>
                <span class="valor">${clienteTexto}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Tipo de IP:</span>
                <span class="valor">${contenido.tipoIP || '—'}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Dirección IP:</span>
                <span class="valor mono">${ipTexto}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Dominio:</span>
                <span class="valor mono">${usuarioTexto}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Usuario admin:</span>
                <span class="valor">${descripcionTexto}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Posición:</span>
                <span class="valor">Fila <b>${contenido.fila}</b>, Columna <b>${contenido.col}</b></span>
            </div>
            ${contenido.pisoNombre ? `
            <div class="tooltip-row">
                <span class="label">Piso:</span>
                <span class="valor">${contenido.pisoNombre}</span>
            </div>` : ''}
        </div>
    `;

    tooltipDiv.style.display = 'block';

    const x = ev.clientX + 18;
    const y = ev.clientY + 18;
    const rect = tooltipDiv.getBoundingClientRect();
    const w = rect.width, h = rect.height;

    let posX = x, posY = y;
    if (x + w > window.innerWidth - 12) posX = ev.clientX - w - 18;
    if (y + h > window.innerHeight - 12) posY = ev.clientY - h - 18;

    tooltipDiv.style.left = posX + 'px';
    tooltipDiv.style.top = posY + 'px';
}

function ocultarTooltip() {
    if (tooltipDiv) tooltipDiv.style.display = 'none';
}

/* =========================================================
   PANEL LATERAL
   ========================================================= */
function abrirLateral() {
    panelLateral.classList.add('abierto');
    lateralBackdrop.style.display = 'block';
    lateralBackdrop.style.pointerEvents = 'auto';
}
function cerrarLateral() {
    panelLateral.classList.remove('abierto');
    lateralBackdrop.style.display = 'none';
}

btnToggleLateral.addEventListener('click', () => {
    if (panelLateral.classList.contains('abierto')) cerrarLateral();
    else abrirLateral();
});
btnCerrarLateral.addEventListener('click', cerrarLateral);

document.addEventListener('dragstart', () => {
    if (lateralBackdrop) lateralBackdrop.style.pointerEvents = 'none';
}, true);
document.addEventListener('dragend', () => {
    if (lateralBackdrop) {
        setTimeout(() => { lateralBackdrop.style.pointerEvents = 'auto'; }, 100);
    }
}, true);

document.querySelectorAll('.grid-plano').forEach(grid => {
    grid.addEventListener('dragover', (ev) => {
        if (dragOrigen) {
            ev.preventDefault();
            if (lateralBackdrop) lateralBackdrop.style.pointerEvents = 'none';
        }
    });
});

/* =========================================================
   MODAL CONFIRMACIÓN
   ========================================================= */
let accionPendiente = null;

function mostrarConfirmacion(titulo, contenidoHTML, alAceptar) {
    modalTitulo.textContent = titulo;
    if (typeof contenidoHTML === 'string' && contenidoHTML.startsWith('<')) {
        modalTexto.innerHTML = contenidoHTML;
    } else {
        modalTexto.innerHTML = `<p>${contenidoHTML}</p>`;
    }
    modal.style.display = 'flex';
    accionPendiente = alAceptar;
}

modalCancelar.addEventListener('click', () => {
    modal.style.display = 'none';
    accionPendiente = null;
});

modalAceptar.addEventListener('click', async () => {
    modal.style.display = 'none';
    if (accionPendiente) {
        const fn = accionPendiente;
        accionPendiente = null;
        await fn();
    }
});

/* =========================================================
   MODAL DE ZONA (acumulativo — múltiples celdas 1×1)
   ========================================================= */
function renderColoresZona() {
    coloresZonaDiv.innerHTML = '';
    COLORES_DISPONIBLES.forEach(c => {
        const d = document.createElement('div');
        d.className = 'color-opcion' + (c === colorSeleccionado ? ' seleccionado' : '');
        d.style.background = c;
        d.addEventListener('click', () => { colorSeleccionado = c; renderColoresZona(); });
        coloresZonaDiv.appendChild(d);
    });
}

function abrirModalZona(zona = null) {
    zonaEditando = zona;

    if (zona) {
        modalZonaTitulo.textContent = 'Editar zona';
        modalZonaNombre.value = zona.Nombre;
        colorSeleccionado = zona.Color || COLORES_DISPONIBLES[0];
        modalZonaRango.textContent = `Celda: fila ${zona.FilaInicio}, columna ${zona.ColumnaInicio}`;
    } else {
        if (celdasZonaSeleccionadas.length === 0) {
            alert('Primero selecciona al menos una celda.');
            return;
        }
        modalZonaTitulo.textContent = celdasZonaSeleccionadas.length > 1
            ? `Nueva zona (${celdasZonaSeleccionadas.length} celdas)`
            : 'Nueva zona';
        modalZonaNombre.value = '';
        colorSeleccionado = COLORES_DISPONIBLES[0];
        modalZonaRango.textContent = celdasZonaSeleccionadas.length === 1
            ? `Celda seleccionada: fila ${celdasZonaSeleccionadas[0].fila}, columna ${celdasZonaSeleccionadas[0].columna}`
            : `${celdasZonaSeleccionadas.length} celdas seleccionadas`;
    }
    renderColoresZona();
    modalZona.style.display = 'flex';

    setTimeout(() => {
        modalZonaNombre.focus();
        modalZonaNombre.select();
    }, 50);
}

modalZonaCancelar.addEventListener('click', () => {
    modalZona.style.display = 'none';
    zonaEditando = null;
    celdasZonaSeleccionadas = [];
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

modalZonaAceptar.addEventListener('click', async () => {
    const nombre = modalZonaNombre.value.trim();
    if (!nombre) { alert('El nombre es obligatorio.'); modalZonaNombre.focus(); return; }
    if (!panelActivo.idPiso) { alert('Selecciona un piso en el panel activo.'); return; }

    try {
        if (zonaEditando) {
            await window.api.plano.actualizarZona(
                zonaEditando.IdZona, nombre, colorSeleccionado,
                zonaEditando.FilaInicio, zonaEditando.FilaFin,
                zonaEditando.ColumnaInicio, zonaEditando.ColumnaFin,
                panelActivo.idPiso
            );
            mostrarToast(`Zona "${nombre}" actualizada`, 'exito');
        } else {
            if (celdasZonaSeleccionadas.length === 0) {
                alert('No hay celdas seleccionadas.');
                return;
            }

            const filas = celdasZonaSeleccionadas.map(c => c.fila);
            const cols  = celdasZonaSeleccionadas.map(c => c.columna);

            const filaMin = Math.min(...filas);
            const filaMax = Math.max(...filas);
            const colMin  = Math.min(...cols);
            const colMax  = Math.max(...cols);

            await window.api.plano.crearZona(
                panelActivo.idPiso, nombre, colorSeleccionado,
                filaMin, filaMax, colMin, colMax
            );

            if (celdasZonaSeleccionadas.length === 1) {
                mostrarToast(`Zona "${nombre}" creada en (${filaMin}, ${colMin})`, 'exito');
            } else {
                mostrarToast(
                    `Zona "${nombre}" creada (${filaMin}-${filaMax} × ${colMin}-${colMax})`,
                    'exito'
                );
            }
        }
    } catch (err) {
        mostrarToast('Error al guardar zona: ' + err.message, 'error', 4000);
        return;
    }

    modalZona.style.display = 'none';
    zonaEditando = null;
    celdasZonaSeleccionadas = [];
    await recargarPanel(panelActivo);
});
/* =========================================================
   MODAL ZONA LIBRE
   ========================================================= */
function renderColoresZonaLibre() {
    coloresZonaLibreDiv.innerHTML = '';
    COLORES_DISPONIBLES.forEach(c => {
        const d = document.createElement('div');
        d.className = 'color-opcion' + (c === colorSeleccionadoLibre ? ' seleccionado' : '');
        d.style.background = c;
        d.addEventListener('click', () => { colorSeleccionadoLibre = c; renderColoresZonaLibre(); });
        coloresZonaLibreDiv.appendChild(d);
    });
}

function abrirModalZonaLibre() {
    if (guardandoZonaLibre) return;
    if (celdasLibresSeleccionadas.length === 0) {
        alert('Primero selecciona una o más celdas vacías.');
        return;
    }

    guardandoZonaLibre = true;
    modalZonaLibreTitulo.textContent = 'Nueva zona libre';
    modalZonaLibreNombre.value = '';
    colorSeleccionadoLibre = COLORES_DISPONIBLES[0];
    modalZonaLibreCeldas.textContent = `Celdas seleccionadas: ${celdasLibresSeleccionadas.length}`;
    renderColoresZonaLibre();
    modalZonaLibre.style.display = 'flex';

    setTimeout(() => {
        modalZonaLibreNombre.focus();
        modalZonaLibreNombre.select();
    }, 50);
}

modalZonaLibreCancelar.addEventListener('click', () => {
    modalZonaLibre.style.display = 'none';
    guardandoZonaLibre = false;
    celdasLibresSeleccionadas = [];
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

modalZonaLibreAceptar.addEventListener('click', async () => {
    if (!guardandoZonaLibre) return;

    const nombre = modalZonaLibreNombre.value.trim();
    if (!nombre) { alert('El texto es obligatorio.'); modalZonaLibreNombre.focus(); return; }
    if (!panelActivo.idPiso) { alert('Selecciona un piso primero.'); return; }
    if (celdasLibresSeleccionadas.length === 0) { alert('No hay celdas seleccionadas.'); return; }

    modalZonaLibreAceptar.disabled = true;

    try {
        await window.api.plano.guardarZonaLibre(
            panelActivo.idPiso, nombre, colorSeleccionadoLibre,
            celdasLibresSeleccionadas.slice()
        );
        mostrarToast(`Zona libre "${nombre}" guardada`, 'exito');
    } catch (err) {
        mostrarToast('Error al guardar: ' + err.message, 'error', 4000);
        modalZonaLibreAceptar.disabled = false;
        return;
    }

    modalZonaLibre.style.display = 'none';
    modalZonaLibreAceptar.disabled = false;
    guardandoZonaLibre = false;
    celdasLibresSeleccionadas = [];
    await recargarPanel(panelActivo);
});

/* =========================================================
   MODAL EDITAR EQUIPO — FLUJO TIPO equipos.js
   ========================================================= */

function edLimpiarSelectConMensaje(select, msg) {
    if (!select) return;
    select.innerHTML = `<option value="">${msg}</option>`;
    select.disabled = true;
}

function edLlenarSelectConfig(select, items, placeholder) {
    if (!select) return;
    select.disabled = false;
    select.innerHTML = `<option value="">${placeholder}</option>`;

    if (!items || items.length === 0) {
        const opt = document.createElement('option');
        opt.value = ''; opt.disabled = true;
        opt.textContent = 'Sin valores. Haz clic en + para agregar uno.';
        select.appendChild(opt);
        return;
    }

    items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = it.Valor;
        opt.dataset.descripcion = it.Descripcion || '';
        opt.textContent = it.Descripcion ? `${it.Valor} — ${it.Descripcion}` : it.Valor;
        select.appendChild(opt);
    });
}

function edSetSelectValorConHuerfano(select, valor) {
    if (!select) return;
    if (!valor) { select.value = ''; return; }
    const existe = Array.from(select.options).some(o => o.value === valor);
    if (!existe) {
        const opt = document.createElement('option');
        opt.value = valor;
        opt.textContent = `${valor} (ya no está en catálogo)`;
        opt.style.color = '#b7791f';
        select.appendChild(opt);
    }
    select.value = valor;
}

function edLlenarSelectClientes() {
    if (!edCliente) return;
    edCliente.innerHTML = '';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.IdCliente;
        opt.textContent = `${c.Codigo} - ${c.Nombre}`;
        edCliente.appendChild(opt);
    });
}

function edLlenarSelectRoles() {
    if (!edRol) return;
    edRol.innerHTML = '';
    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.IdRolEquipo;
        opt.textContent = `${r.Codigo} - ${r.Nombre}`;
        edRol.appendChild(opt);
    });
}

async function edCargarPisosDelCliente(idCliente) {
    if (!edPiso) return;
    if (!idCliente) {
        edLimpiarSelectConMensaje(edPiso, '-- Selecciona un cliente primero --');
        return;
    }
    try {
        const todos = await window.api.pisos.listar();
        edPisosCliente = todos.filter(p =>
            (p.clientes || []).some(c => Number(c.IdCliente) === Number(idCliente))
        );

        edPiso.disabled = false;
        edPiso.innerHTML = '<option value="">-- Selecciona --</option>';
        edPisosCliente.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.IdPiso;
            opt.textContent = p.Nombre;
            edPiso.appendChild(opt);
        });

        if (edPisosCliente.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.disabled = true;
            opt.textContent = 'Este cliente no tiene pisos asignados.';
            edPiso.appendChild(opt);
        }
    } catch (err) {
        console.error(err);
        edLimpiarSelectConMensaje(edPiso, '-- Error al cargar pisos --');
    }
}

async function edCargarConfiguracionesDelCliente(idCliente) {
    if (!idCliente) {
        edLimpiarSelectConMensaje(edMascara, '-- Selecciona un cliente primero --');
        edLimpiarSelectConMensaje(edPuerta,  '-- Selecciona un cliente primero --');
        edLimpiarSelectConMensaje(edDns1,    '-- Selecciona un cliente primero --');
        edLimpiarSelectConMensaje(edDns2,    '-- Selecciona un cliente primero --');
        edLimpiarSelectConMensaje(edUsuario, '-- Selecciona un cliente primero --');
        edDominiosCargados = [];
        return;
    }
    try {
        const [mascaras, puertas, dns1s, dns2s, doms] = await Promise.all([
            window.api.config.listarPorClienteTipo(idCliente, 'Mascara'),
            window.api.config.listarPorClienteTipo(idCliente, 'PuertaEnlace'),
            window.api.config.listarPorClienteTipo(idCliente, 'DNS1'),
            window.api.config.listarPorClienteTipo(idCliente, 'DNS2'),
            window.api.dominios.listarPorCliente(idCliente)
        ]);

        edDominiosCargados = doms;
        dominiosCache[idCliente] = doms;

        edLlenarSelectConfig(edMascara, mascaras, '-- Máscara --');
        edLlenarSelectConfig(edPuerta,  puertas,  '-- Puerta de enlace --');
        edLlenarSelectConfig(edDns1,    dns1s,    '-- DNS 1 --');
        edLlenarSelectConfig(edDns2,    dns2s,    '-- DNS 2 (opcional) --');

        if (edUsuario) {
            edUsuario.disabled = false;
            edUsuario.innerHTML = '<option value="">-- Dominio admin --</option>';
            doms.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.Usuario;
                opt.dataset.password = d.Password;
                opt.dataset.descripcion = d.Descripcion || '';
                opt.textContent = d.Descripcion ? `${d.Usuario} (${d.Descripcion})` : d.Usuario;
                edUsuario.appendChild(opt);
            });
            if (doms.length === 0) {
                const opt = document.createElement('option');
                opt.value = ''; opt.disabled = true;
                opt.textContent = 'Sin dominios configurados.';
                edUsuario.appendChild(opt);
            }
        }
    } catch (err) {
        console.error('Error cargando configuraciones (editar):', err);
    }
}

function edConstruirHostname(idRol, idCli, ip) {
    if (!idRol || !idCli || !ip) return '';
    const partes = ip.split('.');
    if (partes.length !== 4) return '';
    const ultimo = parseInt(partes[3], 10);
    if (isNaN(ultimo)) return '';

    const rol = roles.find(r => Number(r.IdRolEquipo) === Number(idRol));
    const cli = clientes.find(c => Number(c.IdCliente) === Number(idCli));
    if (!rol || !cli) return '';

    return `${rol.Codigo}-${cli.Codigo}${ultimo}`;
}

function edActualizarNumeroHost() {
    if (!edIP || !edNumeroHost) return;
    const partes = edIP.value.trim().split('.');
    if (partes.length === 4) {
        const ultimo = parseInt(partes[3], 10);
        edNumeroHost.value = isNaN(ultimo) ? '' : ultimo;
    } else {
        edNumeroHost.value = '';
    }
}

function edActualizarPreviewHostname() {
    if (!edChkManual || !edHostnamePreview) return;
    if (edChkManual.checked) { edActualizarNumeroHost(); return; }
    const idRol = parseInt(edRol.value, 10);
    const idCli = parseInt(edCliente.value, 10);
    const ip = edIP.value.trim();
    edHostnamePreview.value = edConstruirHostname(idRol, idCli, ip);
    edActualizarNumeroHost();
}

function edActualizarCamposSegunTipo() {
    if (!edTipoIP) return;
    const tipo = edTipoIP.value;
    const esEstatica = tipo === 'Estatica';

    if (esEstatica) {
        if (edCampoHostEst) edCampoHostEst.classList.remove('campo-oculto');
        if (edCampoHostDHCP) edCampoHostDHCP.classList.add('campo-oculto');
        if (edFilaCheckbox) edFilaCheckbox.style.display = 'flex';
        if (edSeccionRed) edSeccionRed.style.display = 'block';
    } else {
        if (edCampoHostEst) edCampoHostEst.classList.add('campo-oculto');
        if (edCampoHostDHCP) edCampoHostDHCP.classList.remove('campo-oculto');
        if (edFilaCheckbox) edFilaCheckbox.style.display = 'none';
        if (edSeccionRed) edSeccionRed.style.display = 'none';

        if (edMascara) edMascara.value = '';
        if (edPuerta)  edPuerta.value  = '';
        if (edDns1)    edDns1.value    = '';
        if (edDns2)    edDns2.value    = '';
        if (edIP)      edIP.value      = '';
        if (edNumeroHost) edNumeroHost.value = '';
        if (edHostnamePreview) edHostnamePreview.value = '';
    }
}

function edConfigurarInputIP(input) {
    if (!input) return;
    input.addEventListener('input', () => {
        let valor = input.value.replace(/[^0-9.]/g, '');
        const partes = valor.split('.').slice(0, 4);
        const partesLimpias = partes.map(p => p.slice(0, 3));
        valor = partesLimpias.join('.');
        if (partesLimpias.length < 4) {
            const ultima = partesLimpias[partesLimpias.length - 1];
            const puntoYaEscrito = input.value.endsWith('.');
            if (ultima.length === 3 && !puntoYaEscrito) valor = valor + '.';
        }
        input.value = valor;
        edActualizarPreviewHostname();
    });
    input.addEventListener('blur', () => {
        const partes = input.value.split('.');
        while (partes.length < 4 && partes[0] !== '') partes.push('0');
        if (partes[0] !== '') {
            input.value = partes.slice(0, 4).join('.');
            edActualizarPreviewHostname();
        }
    });
}

async function abrirModalEditarEquipo(equipo, panel) {
    equipoEditando = { equipo, panel };

    if (editarTitulo) editarTitulo.textContent = `Editar equipo — ${equipo.Hostname}`;
    if (editarInfo) editarInfo.innerHTML = `
        <div><b>Posición:</b> Fila ${equipo._fila}, Columna ${equipo._col}</div>
        <div><b>Cliente actual:</b> ${equipo.ClienteCodigo || '—'}</div>
        <div><b>Rol actual:</b> ${equipo.RolCodigo || '—'}</div>
        <div><b>Piso:</b> ${pisos.find(p => Number(p.IdPiso) === Number(panel.idPiso))?.Nombre || ''}</div>
    `;

    if (editarMensaje) editarMensaje.style.display = 'none';

    edLlenarSelectClientes();
    edLlenarSelectRoles();

    if (edCliente) edCliente.value = equipo.IdCliente != null ? String(equipo.IdCliente) : '';

    if (equipo.IdCliente != null) {
        await edCargarPisosDelCliente(equipo.IdCliente);
        if (equipo.IdPiso && edPiso) edSetSelectValorConHuerfano(edPiso, String(equipo.IdPiso));

        await edCargarConfiguracionesDelCliente(equipo.IdCliente);
    } else {
        edLimpiarSelectConMensaje(edPiso, '-- Selecciona un cliente --');
        await edCargarConfiguracionesDelCliente(null);
    }

    if (edRol) edRol.value = equipo.IdRolEquipo != null ? String(equipo.IdRolEquipo) : '';
    if (edTipoIP) edTipoIP.value = equipo.TipoIP || 'Estatica';

    if (edChkManual) edChkManual.checked = false;

    if (edHostnamePreview) {
        edHostnamePreview.readOnly = true;
        edHostnamePreview.placeholder = 'Se armará automáticamente...';
    }
    if (edHostnameLibre) edHostnameLibre.value = '';

    edActualizarCamposSegunTipo();

    if (equipo.TipoIP === 'Estatica') {
        if (edIP) edIP.value = equipo.IP || '';
        if (edNumeroHost) edNumeroHost.value = equipo.NumeroHost ?? '';
        if (edHostnamePreview) edHostnamePreview.value = equipo.Hostname || '';

        edSetSelectValorConHuerfano(edMascara, equipo.Mascara || '');
        edSetSelectValorConHuerfano(edPuerta,  equipo.PuertaEnlace || '');
        edSetSelectValorConHuerfano(edDns1,    equipo.DNS1 || '');
        edSetSelectValorConHuerfano(edDns2,    equipo.DNS2 || '');
    } else {
        if (edHostnameLibre) edHostnameLibre.value = equipo.Hostname || '';
    }

    edSetSelectValorConHuerfano(edUsuario, equipo.UsuarioAdmin || '');
    if (edPassword) edPassword.value = equipo.PasswordAdmin ?? '';

    if (modalEditarEquipo) modalEditarEquipo.style.display = 'flex';
    setTimeout(() => { if (edCliente) edCliente.focus(); }, 60);
}

if (edCliente) {
    edCliente.addEventListener('change', async () => {
        const id = parseInt(edCliente.value, 10);
        edLimpiarSelectConMensaje(edPiso, '-- Cargando... --');
        if (id) {
            await edCargarPisosDelCliente(id);
            await edCargarConfiguracionesDelCliente(id);
        } else {
            edLimpiarSelectConMensaje(edPiso, '-- Selecciona un cliente primero --');
            await edCargarConfiguracionesDelCliente(null);
        }
        edActualizarPreviewHostname();
    });
}

if (edRol) edRol.addEventListener('change', edActualizarPreviewHostname);

if (edUsuario) {
    edUsuario.addEventListener('change', () => {
        const opt = edUsuario.options[edUsuario.selectedIndex];
        if (edPassword) edPassword.value = (opt && opt.dataset.password) ? opt.dataset.password : '';
    });
}

if (edTipoIP) edTipoIP.addEventListener('change', edActualizarCamposSegunTipo);

if (edChkManual) {
    edChkManual.addEventListener('change', () => {
        const manual = edChkManual.checked;
        if (manual) {
            edHostnamePreview.readOnly = false;
            edHostnamePreview.focus();
            edHostnamePreview.placeholder = 'Escribe el hostname manualmente...';
        } else {
            edHostnamePreview.readOnly = true;
            edHostnamePreview.placeholder = 'Se armará automáticamente...';
            edActualizarPreviewHostname();
        }
    });
}

edConfigurarInputIP(edIP);

if (editarCancelar) {
    editarCancelar.addEventListener('click', () => {
        modalEditarEquipo.style.display = 'none';
        equipoEditando = null;
        edGuardando = false;
    });
}

function edMostrarError(texto) {
    if (!editarMensaje) return;
    editarMensaje.textContent = texto;
    editarMensaje.className = 'mensaje error';
    editarMensaje.style.display = 'block';
}

if (editarConfirmar) {
    editarConfirmar.addEventListener('click', async () => {
        if (!equipoEditando || edGuardando) return;

        const { equipo, panel } = equipoEditando;
        const tipo = edTipoIP.value;
        const esEstatica = tipo === 'Estatica';
        let hostnameFinal;

        if (esEstatica) {
            if (edChkManual.checked) {
                hostnameFinal = edHostnamePreview.value.trim();
                if (!hostnameFinal) { edMostrarError('Escribe el hostname manualmente o desmarca la casilla.'); return; }
            } else {
                const idRol = parseInt(edRol.value, 10);
                const idCli = parseInt(edCliente.value, 10);
                const ip = edIP.value.trim();
                hostnameFinal = edConstruirHostname(idRol, idCli, ip);
                if (!hostnameFinal) { edMostrarError('No se pudo armar el hostname. Verifica cliente, rol e IP.'); return; }
            }
        } else {
            hostnameFinal = edHostnameLibre.value.trim();
            if (!hostnameFinal) { edMostrarError('El hostname es obligatorio.'); return; }
        }

        const datos = {
            idCliente:      parseInt(edCliente.value, 10),
            idPiso:         edPiso.value ? parseInt(edPiso.value, 10) : null,
            idRolEquipo:    parseInt(edRol.value, 10),
            tipoIP:         tipo,
            hostname:       hostnameFinal,
            numeroHost:     esEstatica ? parseInt(edNumeroHost.value, 10) : null,
            ip:             esEstatica ? edIP.value.trim() : null,
            idRangoIP:      null,
            mascara:        esEstatica ? (edMascara.value || null) : null,
            puertaEnlace:   esEstatica ? (edPuerta.value  || null) : null,
            dns1:           esEstatica ? (edDns1.value    || null) : null,
            dns2:           esEstatica ? (edDns2.value    || null) : null,
            usuarioAdmin:   edUsuario.value || null,
            passwordAdmin:  edPassword.value.trim() || null,
            activo:         true
        };

        if (!datos.idCliente || !datos.idRolEquipo) { edMostrarError('Cliente y rol son obligatorios.'); return; }
        if (!datos.hostname) { edMostrarError('El hostname es obligatorio.'); return; }

        if (!datos.usuarioAdmin || !datos.passwordAdmin) {
            edMostrarError('Usuario admin y password son obligatorios.'); return;
        }

        if (esEstatica) {
            if (!datos.idPiso)       { edMostrarError('El piso es obligatorio para equipos estáticos.'); return; }
            if (!datos.ip)           { edMostrarError('La IP es obligatoria para equipos estáticos.'); return; }
            if (!datos.mascara)      { edMostrarError('La máscara es obligatoria.'); return; }
            if (!datos.puertaEnlace) { edMostrarError('La puerta de enlace es obligatoria.'); return; }
            if (!datos.dns1)         { edMostrarError('El DNS 1 es obligatorio.'); return; }
        }

        edGuardando = true;
        editarConfirmar.disabled = true;
        editarConfirmar.textContent = 'Guardando...';

        try {
            const res = await window.api.equipos.actualizar(equipo.IdEquipo, datos);

            if (res && res.ok) {
                modalEditarEquipo.style.display = 'none';
                equipoEditando = null;
                mostrarToast(`Equipo "${datos.hostname}" actualizado correctamente`, 'exito', 3200);
                await recargarPanel(panel);
                return;
            }

            if (res && res.tipo === 'ip-duplicada') {
                edMostrarError(`IP duplicada: ${res.mensaje || ''}`);
                return;
            }
            if (res && res.tipo === 'hostname-duplicado') {
                edMostrarError(`Hostname duplicado: ${res.mensaje || ''}`);
                return;
            }

            edMostrarError(res?.mensaje || 'Error desconocido al guardar.');
        } catch (err) {
            edMostrarError('Error: ' + err.message);
        } finally {
            edGuardando = false;
            editarConfirmar.disabled = false;
            editarConfirmar.textContent = 'Guardar cambios';
        }
    });
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => {
    cerrarVistaPrevia();
    window.api.volverMenu();
});

/* =========================================================
   CAMBIO DE MODO
   ========================================================= */
selectModo.addEventListener('change', () => {
    const doble = selectModo.value === 'doble';
    panelDerDiv.style.display = doble ? 'flex' : 'none';
    wrapFiltroDer.style.display = doble ? 'flex' : 'none';
    contenedorPrincipal.classList.toggle('solo-simple', !doble);

    if (doble && !panelDer.idPiso) {
        cargarPisosPanel(panelDer, false);
    }
});

/* =========================================================
   MODO ZONA (acumulativo 1×1 con Enter)
   ========================================================= */
btnModoZona.addEventListener('click', () => {
    modoZona = !modoZona;

    if (modoZona) {
        if (modoZonaLibre) modoZonaLibre = false;
        if (modoEdicion) modoEdicion = false;
        celdasLibresSeleccionadas = [];
        celdasZonaSeleccionadas = [];
        [gridIzq, gridDer].forEach(g => { if (g) g.classList.remove('modo-zona-libre'); });
    } else {
        celdasZonaSeleccionadas = [];
    }

    actualizarBotonesModo();
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

btnLimpiarSeleccion.addEventListener('click', () => {
    celdasZonaSeleccionadas = [];
    celdasLibresSeleccionadas = [];
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

/* =========================================================
   MODO ZONA LIBRE
   ========================================================= */
btnModoZonaLibre.addEventListener('click', () => {
    modoZonaLibre = !modoZonaLibre;

    if (modoZonaLibre) {
        if (modoZona) modoZona = false;
        if (modoEdicion) modoEdicion = false;
        celdasLibresSeleccionadas = [];
        celdasZonaSeleccionadas = [];
    } else {
        celdasLibresSeleccionadas = [];
    }

    actualizarBotonesModo();
    [gridIzq, gridDer].forEach(g => {
        if (g) g.classList.toggle('modo-zona-libre', modoZonaLibre);
    });
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

/* =========================================================
   MODO EDICIÓN
   ========================================================= */
btnModoEdicion.addEventListener('click', () => {
    modoEdicion = !modoEdicion;

    if (modoEdicion) {
        if (modoZona) modoZona = false;
        if (modoZonaLibre) modoZonaLibre = false;
        celdasLibresSeleccionadas = [];
        celdasZonaSeleccionadas = [];
        [gridIzq, gridDer].forEach(g => { if (g) g.classList.remove('modo-zona-libre'); });
    }

    actualizarBotonesModo();
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

/* =========================================================
   ACTUALIZAR BOTONES DE MODO
   ========================================================= */
function actualizarBotonesModo() {
    if (modoZona) {
        btnModoZona.classList.add('activo');
        btnModoZona.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
            </svg>
            Crear Zona (1×1) — activo`;
        btnLimpiarSeleccion.style.display = 'inline-block';
    } else {
        btnModoZona.classList.remove('activo');
        btnModoZona.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
            </svg>
            Crear Zona (1×1)`;
        btnLimpiarSeleccion.style.display = 'none';
        celdasZonaSeleccionadas = [];
    }

    if (modoZonaLibre) {
        btnModoZonaLibre.classList.add('activo');
        btnModoZonaLibre.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <path d="M4 20h16M4 4h16v16"/>
                <path d="M9 4v16M4 9h16"/>
            </svg>
            Marcar Zona Libre — activo`;
    } else {
        btnModoZonaLibre.classList.remove('activo');
        btnModoZonaLibre.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <path d="M4 20h16M4 4h16v16"/>
                <path d="M9 4v16M4 9h16"/>
            </svg>
            Marcar Zona Libre`;
    }

    if (modoEdicion) {
        btnModoEdicion.classList.add('activo');
        btnModoEdicion.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
            Editar Equipo — activo`;
    } else {
        btnModoEdicion.classList.remove('activo');
        btnModoEdicion.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
            Editar Equipo`;
    }
}

/* =========================================================
   LIMPIEZA TOTAL DE UN PANEL
   ========================================================= */
function limpiarRenderPanel(panel) {
    const grid = panel.sufijo === 'izq' ? gridIzq : gridDer;
    const llaves = panel.sufijo === 'izq' ? llavesIzq : llavesDer;
    if (!grid) return;

    grid.innerHTML = '';
    if (llaves) llaves.innerHTML = '';

    const wrapper = grid.closest('.grid-plano-wrapper');
    if (wrapper) {
        wrapper.querySelectorAll('.texto-zona-libre-overlay').forEach(el => el.remove());
    }
}

/* =========================================================
   CARGA DE DATOS
   ========================================================= */

async function cargarClientes() {
    clientes = await window.api.clientes.listar();
}

async function cargarPisosPanel(panel, seleccionarPrimero) {
    const todos = await window.api.pisos.listar();
    pisos = todos;

    const select = panel.sufijo === 'izq' ? selectLugarIzq : selectLugarDer;
    select.innerHTML = '<option value="">-- Piso --</option>';
    todos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.IdPiso;
        opt.textContent = p.Nombre;
        select.appendChild(opt);
    });

    if (seleccionarPrimero && todos.length > 0) {
        select.value = todos[0].IdPiso;
        panel.idPiso = todos[0].IdPiso;
        await cargarPanel(panel);
    }
}

/* =========================================================
   FILTRO DE CLIENTES
   ========================================================= */

function renderFiltroClientes(panel) {
    const contenedor = panel.sufijo === 'izq' ? filtroClientesIzq : filtroClientesDer;
    const setFiltro  = panel.sufijo === 'izq' ? clientesFiltroIzq : clientesFiltroDer;

    contenedor.innerHTML = '';

    if (panel.clientesDelPiso.length === 0) {
        contenedor.innerHTML = '<span class="filtro-vacio">Sin clientes en este piso</span>';
        return;
    }

    panel.clientesDelPiso.forEach(c => {
        const activo = setFiltro.has(Number(c.IdCliente));
        const chip = document.createElement('button');
        chip.className = 'chip-cliente' + (activo ? ' activo' : '');
        chip.dataset.idCliente = c.IdCliente;
        chip.innerHTML = `
            <span class="chip-check">${activo ? '✓' : ''}</span>
            <span class="chip-codigo">${c.Codigo}</span>
            <span class="chip-nombre">${c.Nombre}</span>
        `;
        chip.addEventListener('click', () => {
            if (setFiltro.has(Number(c.IdCliente))) {
                setFiltro.delete(Number(c.IdCliente));
            } else {
                setFiltro.add(Number(c.IdCliente));
            }
            renderFiltroClientes(panel);
            renderGridPanel(panel);
        });
        contenedor.appendChild(chip);
    });
}

document.querySelectorAll('.btn-filtro-accion').forEach(btn => {
    btn.addEventListener('click', () => {
        const panelSufijo = btn.dataset.panel;
        const accion      = btn.dataset.accion;
        const panel       = panelSufijo === 'izq' ? panelIzq : panelDer;
        const setFiltro   = panelSufijo === 'izq' ? clientesFiltroIzq : clientesFiltroDer;

        if (accion === 'todos') {
            panel.clientesDelPiso.forEach(c => setFiltro.add(Number(c.IdCliente)));
        } else {
            setFiltro.clear();
        }
        renderFiltroClientes(panel);
        renderGridPanel(panel);
    });
});

/* =========================================================
   EVENTOS DE PANELES
   ========================================================= */
function conectarEventosPanel(panel, selectLugar, inputFilas, inputColumnas, btnAplicar) {
    selectLugar.addEventListener('change', async () => {
        const nuevoIdPiso = parseInt(selectLugar.value, 10) || null;

        limpiarRenderPanel(panel);

        celdasZonaSeleccionadas = [];
        celdasLibresSeleccionadas = [];

        panel.idPiso = nuevoIdPiso;
        panelActivo = panel;

        if (panel.idPiso) {
            await cargarPanel(panel);
            renderPanelLateral();
        } else {
            limpiarPanel(panel);
        }
    });

    btnAplicar.addEventListener('click', async () => {
        if (!panel.idPiso) { alert('Selecciona un piso primero.'); return; }
        const nuevasFilas = parseInt(inputFilas.value, 10);
        const nuevasColumnas = parseInt(inputColumnas.value, 10);

        if (nuevasFilas < 1 || nuevasColumnas < 1) {
            alert('Filas y columnas deben ser mayor a 0.');
            return;
        }

        const expulsados = [];
        panel.celdas.forEach((fila, i) => {
            fila.forEach((celda, j) => {
                if (celda && (i + 1 > nuevasFilas || j + 1 > nuevasColumnas)) {
                    expulsados.push({ ...celda, _fila: i + 1, _col: j + 1 });
                }
            });
        });

        let contenidoModal;
        if (expulsados.length > 0) {
            const lista = expulsados.map(e =>
                `<li><b>${e.Hostname}</b> — estaba en fila ${e._fila}, columna ${e._col}</li>`
            ).join('');
            contenidoModal = `
                <p>Se cambiará el grid a <b>${nuevasFilas} × ${nuevasColumnas}</b>.</p>
                <p style="color:#dc2626;"><b>${expulsados.length} equipo(s)</b> quedarán fuera del rango y volverán a la lista:</p>
                <ul class="lista-expulsados">${lista}</ul>
                <p style="margin-top:10px;font-size:0.85rem;color:#64748b;">Los equipos seguirán existiendo, solo perderán su posición.</p>
            `;
        } else {
            contenidoModal = `<p>Se cambiará el grid a <b>${nuevasFilas} × ${nuevasColumnas}</b>. No hay equipos afectados.</p>`;
        }

        mostrarConfirmacion('Cambiar dimensiones', contenidoModal, async () => {
            const res = await window.api.plano.actualizarDim(panel.idPiso, nuevasFilas, nuevasColumnas);
            await recargarPanel(panel);

            if (res && res.expulsados && res.expulsados.length > 0) {
                mostrarToast(`Se regresaron ${res.expulsados.length} equipo(s) a la lista`, 'warn', 4000);
            } else {
                mostrarToast(`Dimensiones cambiadas a ${nuevasFilas} × ${nuevasColumnas}`, 'exito');
            }
        });
    });
}

conectarEventosPanel(panelIzq, selectLugarIzq, inputFilasIzq, inputColumnasIzq,
    document.getElementById('btn-aplicar-dim-izq'));
conectarEventosPanel(panelDer, selectLugarDer, inputFilasDer, inputColumnasDer,
    document.getElementById('btn-aplicar-dim-der'));

/* =========================================================
   CARGA DE UN PANEL
   ========================================================= */
async function cargarPanel(panel) {
    if (!panel.idPiso) return;

    limpiarRenderPanel(panel);

    const piso = pisos.find(p => Number(p.IdPiso) === Number(panel.idPiso));
    panel.clientesDelPiso = piso ? piso.clientes : [];

    const setFiltro = panel.sufijo === 'izq' ? clientesFiltroIzq : clientesFiltroDer;
    setFiltro.clear();
    panel.clientesDelPiso.forEach(c => setFiltro.add(Number(c.IdCliente)));
    renderFiltroClientes(panel);

    panel.dimensiones = await window.api.plano.dimensiones(panel.idPiso);

    const inputFilas = panel.sufijo === 'izq' ? inputFilasIzq : inputFilasDer;
    const inputColumnas = panel.sufijo === 'izq' ? inputColumnasIzq : inputColumnasDer;
    inputFilas.value = panel.dimensiones.Filas;
    inputColumnas.value = panel.dimensiones.Columnas;

    panel.celdas = Array.from({ length: panel.dimensiones.Filas }, () =>
        Array.from({ length: panel.dimensiones.Columnas }, () => null)
    );

    const ubicaciones = await window.api.plano.listarPorLugar(panel.idPiso);
    ubicaciones.forEach(u => {
        const f = u.Fila - 1;
        const c = u.Columna - 1;
        if (panel.celdas[f] && panel.celdas[f][c] !== undefined) {
            panel.celdas[f][c] = {
                IdEquipo:      u.IdEquipo,
                IdCliente:     u.IdCliente,
                IdRolEquipo:   u.IdRolEquipo,
                ClienteCodigo: u.ClienteCodigo,
                ClienteNombre: u.ClienteNombre,
                Hostname:      u.Hostname,
                TipoIP:        u.TipoIP,
                IP:            u.IP,
                Mascara:       u.Mascara,
                PuertaEnlace:  u.PuertaEnlace,
                DNS1:          u.DNS1,
                DNS2:          u.DNS2,
                UsuarioAdmin:  u.UsuarioAdmin,
                PasswordAdmin: u.PasswordAdmin,
                DescripcionAdmin: u.DescripcionAdmin,
                RolCodigo:     u.RolCodigo,
                _fila:         u.Fila,
                _col:          u.Columna
            };
        }
    });

    panel.equiposSinUbicar = await window.api.plano.sinUbicacion(panel.idPiso);
    panel.zonas = await window.api.plano.listarZonas(panel.idPiso);
    panel.zonasLibres = await window.api.plano.listarZonasLibres(panel.idPiso);

    renderGridPanel(panel);
    if (panel === panelActivo) renderPanelLateral();
}

async function recargarPanel(panel) {
    await cargarPanel(panel);
}

function limpiarPanel(panel) {
    panel.celdas = [];
    panel.zonas = [];
    panel.zonasLibres = [];
    panel.equiposSinUbicar = [];
    panel.clientesDelPiso = [];

    limpiarRenderPanel(panel);

    const contenedor = panel.sufijo === 'izq' ? filtroClientesIzq : filtroClientesDer;
    contenedor.innerHTML = '';

    if (panel === panelActivo) renderPanelLateral();
}

/* =========================================================
   ZONAS
   ========================================================= */
function zonaEnCelda(panel, fila, columna) {
    return panel.zonas.find(z =>
        fila >= z.FilaInicio && fila <= z.FilaFin &&
        columna >= z.ColumnaInicio && columna <= z.ColumnaFin
    );
}

function zonaLibreEnCelda(panel, fila, columna) {
    return panel.zonasLibres?.find(zl => zl.Fila === fila && zl.Columna === columna);
}

/* =========================================================
   SVG ICONO PC (para el canvas en vivo)
   ========================================================= */
const SVG_PC = `
    <svg class="icono-pc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
`;

/* =========================================================
   RENDER DEL GRID — CANVAS EN VIVO
   (vuelve al ícono de PC original, sin hostname ni IP)
   ========================================================= */
function renderGridPanel(panel) {
    const grid = panel.sufijo === 'izq' ? gridIzq : gridDer;
    if (!grid) return;

    limpiarRenderPanel(panel);

    if (!panel.dimensiones.Filas) return;

    grid.style.gridTemplateColumns = `repeat(${panel.dimensiones.Columnas}, 1fr)`;

    const setFiltro = panel.sufijo === 'izq' ? clientesFiltroIzq : clientesFiltroDer;

    for (let f = 0; f < panel.dimensiones.Filas; f++) {
        for (let c = 0; c < panel.dimensiones.Columnas; c++) {
            const fila = f + 1;
            const columna = c + 1;
            const celda = document.createElement('div');
            const contenido = panel.celdas[f]?.[c];
            const zl = zonaLibreEnCelda(panel, fila, columna);

            celda.className = 'celda ' + (contenido ? 'ocupada' : 'vacia');
            celda.dataset.fila = fila;
            celda.dataset.columna = columna;
            celda.dataset.panel = panel.sufijo;

            if (contenido && contenido.RolCodigo) {
                celda.dataset.rol = contenido.RolCodigo;
            }

            if (zl && !contenido) {
                celda.classList.add('celda-libre');
                celda.style.backgroundColor = zl.Color;
            }

            if (contenido) {
                const idCli = Number(contenido.IdCliente);
                celda.dataset.cliente = idCli;
                if (!setFiltro.has(idCli)) {
                    celda.classList.add('celda-filtrada');
                }
            }

            if (modoZona && panel === panelActivo) {
                const estaSel = celdasZonaSeleccionadas.some(
                    cc => cc.fila === fila && cc.columna === columna
                );
                if (estaSel) celda.classList.add('seleccionada');
            }

            if (modoZonaLibre && panel === panelActivo) {
                const estaSeleccionada = celdasLibresSeleccionadas.some(
                    cc => cc.fila === fila && cc.columna === columna
                );
                if (estaSeleccionada) celda.classList.add('seleccionada');
            }

            if (modoEdicion && panel === panelActivo && contenido) {
                celda.classList.add('celda-editable');
            }

            if (contenido) {
                // 👇 Canvas en vivo: ícono de PC original (sin hostname/IP)
                celda.innerHTML = `
                    <button class="cerrar" data-id="${contenido.IdEquipo}">✕</button>
                    ${SVG_PC}
                `;

                celda.addEventListener('mouseenter', (ev) => {
                    if (modoZona || modoZonaLibre || modoEdicion) return;
                    mostrarTooltip(ev, {
                        hostname: contenido.Hostname,
                        rol: contenido.RolCodigo || '',
                        tipoIP: contenido.TipoIP,
                        ip: contenido.IP,
                        cliente: contenido.ClienteCodigo || '',
                        clienteNombre: contenido.ClienteNombre || '',
                        usuarioAdmin: contenido.UsuarioAdmin || '',
                        descripcionAdmin: contenido.DescripcionAdmin || '',
                        pisoNombre: pisos.find(p => Number(p.IdPiso) === Number(panel.idPiso))?.Nombre || '',
                        fila, col: columna
                    });
                });
                celda.addEventListener('mousemove', (ev) => {
                    if (modoZona || modoZonaLibre || modoEdicion) return;
                    if (tooltipDiv && tooltipDiv.style.display === 'block') {
                        mostrarTooltip(ev, {
                            hostname: contenido.Hostname,
                            rol: contenido.RolCodigo || '',
                            tipoIP: contenido.TipoIP,
                            ip: contenido.IP,
                            cliente: contenido.ClienteCodigo || '',
                            clienteNombre: contenido.ClienteNombre || '',
                            usuarioAdmin: contenido.UsuarioAdmin || '',
                            descripcionAdmin: contenido.DescripcionAdmin || '',
                            pisoNombre: pisos.find(p => Number(p.IdPiso) === Number(panel.idPiso))?.Nombre || '',
                            fila, col: columna
                        });
                    }
                });
                celda.addEventListener('mouseleave', ocultarTooltip);

                if (!modoZona && !modoZonaLibre && !modoEdicion) {
                    celda.draggable = true;
                    celda.addEventListener('dragstart', (ev) => {
                        ocultarTooltip();
                        dragOrigen = {
                            tipo: 'celda',
                            idEquipo: contenido.IdEquipo,
                            fila, columna,
                            panelSufijo: panel.sufijo,
                            clienteId: contenido.IdCliente,
                            hostname: contenido.Hostname
                        };
                        ev.dataTransfer.effectAllowed = 'move';
                    });
                }

                if (modoEdicion && panel === panelActivo) {
                    celda.style.cursor = 'pointer';
                    celda.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        abrirModalEditarEquipo(contenido, panel);
                    });
                }

                const btnCerrar = celda.querySelector('.cerrar');
                if (btnCerrar) {
                    btnCerrar.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        if (!modoZona && !modoZonaLibre && !modoEdicion) confirmarQuitar(contenido, panel);
                    });
                }
            }

            if (!modoZona && !modoZonaLibre && !modoEdicion) {
                celda.addEventListener('dragover', (ev) => {
                    if (dragOrigen) {
                        ev.preventDefault();
                        celda.classList.add('destino');
                    }
                });
                celda.addEventListener('dragleave', () => celda.classList.remove('destino'));
                celda.addEventListener('drop', async (ev) => {
                    ev.preventDefault();
                    celda.classList.remove('destino');
                    await manejarDrop(panel, fila, columna);
                });
            }

            if (modoZona && panel === panelActivo) {
                celda.style.cursor = 'crosshair';
                celda.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();

                    const idx = celdasZonaSeleccionadas.findIndex(
                        cc => cc.fila === fila && cc.columna === columna
                    );

                    if (idx >= 0) {
                        celdasZonaSeleccionadas.splice(idx, 1);
                        celda.classList.remove('seleccionada');
                    } else {
                        celdasZonaSeleccionadas.push({ fila, columna });
                        celda.classList.add('seleccionada');
                    }
                });
            }

            if (modoZonaLibre && panel === panelActivo) {
                celda.style.cursor = contenido ? 'not-allowed' : 'pointer';
                celda.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (contenido) return;

                    const idx = celdasLibresSeleccionadas.findIndex(
                        cc => cc.fila === fila && cc.columna === columna
                    );

                    if (idx >= 0) {
                        celdasLibresSeleccionadas.splice(idx, 1);
                        celda.classList.remove('seleccionada');
                    } else {
                        celdasLibresSeleccionadas.push({ fila, columna });
                        celda.classList.add('seleccionada');
                    }

                    if (modalZonaLibre.style.display === 'flex') {
                        modalZonaLibreCeldas.textContent =
                            `Celdas seleccionadas: ${celdasLibresSeleccionadas.length}`;
                    }
                });
            }

            grid.appendChild(celda);
        }
    }

    renderizarTextosZonasLibres(panel);
    renderizarLlavesZonas(panel);
}

/* =========================================================
   RENDERIZAR TEXTOS DE ZONAS LIBRES
   ========================================================= */
function renderizarTextosZonasLibres(panel) {
    if (!panel.zonasLibres || panel.zonasLibres.length === 0) return;

    const gridEl = panel.sufijo === 'izq' ? gridIzq : gridDer;
    if (!gridEl) return;

    const wrapper = gridEl.closest('.grid-plano-wrapper');
    if (!wrapper) return;

    wrapper.querySelectorAll('.texto-zona-libre-overlay').forEach(el => el.remove());

    const grupos = {};
    panel.zonasLibres.forEach(zl => {
        const key = `${zl.Nombre}||${zl.Color}`;
        if (!grupos[key]) {
            grupos[key] = { nombre: zl.Nombre, color: zl.Color, celdas: [] };
        }
        grupos[key].celdas.push({ fila: zl.Fila, columna: zl.Columna });
    });

    Object.values(grupos).forEach(g => {
        const filas = g.celdas.map(c => c.fila);
        const cols = g.celdas.map(c => c.columna);
        const filaMin = Math.min(...filas);
        const filaMax = Math.max(...filas);
        const colMin = Math.min(...cols);
        const colMax = Math.max(...cols);

        const celdaTL = gridEl.querySelector(`.celda[data-fila="${filaMin}"][data-columna="${colMin}"]`);
        const celdaBR = gridEl.querySelector(`.celda[data-fila="${filaMax}"][data-columna="${colMax}"]`);
        if (!celdaTL || !celdaBR) return;

        const rectTL = celdaTL.getBoundingClientRect();
        const rectBR = celdaBR.getBoundingClientRect();

        const anchoTotal = (rectBR.right - rectTL.left);
        const altoTotal = (rectBR.bottom - rectTL.top);

        const totalFilas = filaMax - filaMin + 1;
        const totalCols = colMax - colMin + 1;
        const baseFontSize = Math.max(0.6, Math.min(1.5, 0.7 + Math.min(totalFilas, totalCols) * 0.08));

        const overlay = document.createElement('div');
        overlay.className = 'texto-zona-libre-overlay';
        overlay.dataset.key = `${g.nombre}||${g.color}`;
        overlay.style.position = 'absolute';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.textAlign = 'center';
        overlay.style.fontWeight = '700';
        overlay.style.color = '#1e293b';
        overlay.style.textTransform = 'uppercase';
        overlay.style.letterSpacing = '0.05em';
        overlay.style.pointerEvents = 'none';
        overlay.style.textShadow = '0 1px 2px rgba(255,255,255,0.7)';
        overlay.style.padding = '4px';
        overlay.style.lineHeight = '1.1';
        overlay.style.wordBreak = 'break-word';
        overlay.style.fontSize = baseFontSize + 'rem';
        overlay.style.zIndex = '5';

        const wrapperRect = wrapper.getBoundingClientRect();
        const relX = (rectTL.left - wrapperRect.left) + wrapper.scrollLeft;
        const relY = (rectTL.top - wrapperRect.top) + wrapper.scrollTop;

        overlay.style.left = relX + 'px';
        overlay.style.top = relY + 'px';
        overlay.style.width = anchoTotal + 'px';
        overlay.style.height = altoTotal + 'px';
        overlay.textContent = g.nombre;

        wrapper.appendChild(overlay);
    });
}

/* =========================================================
   RENDERIZAR LLAVES DE ZONA
   ========================================================= */
function renderizarLlavesZonas(panel) {
    const llaves = panel.sufijo === 'izq' ? llavesIzq : llavesDer;
    if (!llaves || !panel.zonas || panel.zonas.length === 0) return;

    llaves.innerHTML = '';

    const gridEl = panel.sufijo === 'izq' ? gridIzq : gridDer;
    const wrapper = gridEl.closest('.grid-plano-wrapper');
    if (!wrapper) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const gridRect = gridEl.getBoundingClientRect();

    const offsetX = gridRect.left - wrapperRect.left;
    const offsetY = gridRect.top - wrapperRect.top;

    const gridAnchoPx = gridRect.width;
    const mitadGrid = offsetX + gridAnchoPx / 2;

    const espacioDerecha = wrapperRect.width - (offsetX + gridRect.width);
    const espacioIzquierda = offsetX;

    const forzarIzquierda = espacioDerecha < 30 && espacioIzquierda >= 30;

    const zonasOrdenadas = [...panel.zonas].sort((a, b) => a.FilaInicio - b.FilaInicio);

    const ocupacionDerecha = [];
    const ocupacionIzquierda = [];

    zonasOrdenadas.forEach(zona => {
        const startFila = zona.FilaInicio - 1;
        const endFila = zona.FilaFin - 1;
        const endCol = zona.ColumnaFin - 1;

        const zonaY = offsetY + GRID_PADDING + startFila * (CELL_H + CELL_GAP);
        const zonaH = (endFila - startFila) * (CELL_H + CELL_GAP) + CELL_H;

        const zonaXRight = offsetX + GRID_PADDING + (endCol + 1) * (CELL_W + CELL_GAP) - CELL_GAP;
        const zonaXLeft = offsetX + GRID_PADDING + (zona.ColumnaInicio - 1) * (CELL_W + CELL_GAP);

        const centroBloque = (zonaXLeft + zonaXRight) / 2;

        let lado;
        if (forzarIzquierda) lado = 'izquierda';
        else if (centroBloque >= mitadGrid) lado = 'derecha';
        else lado = 'izquierda';

        const ocupacion = lado === 'derecha' ? ocupacionDerecha : ocupacionIzquierda;
        let yFinal = zonaY;
        const alturaMinLlave = 22;

        for (const oc of ocupacion) {
            if (yFinal < oc.bottom && (yFinal + zonaH) > oc.top) {
                yFinal = oc.bottom + 4;
            }
        }

        ocupacion.push({ top: yFinal, bottom: yFinal + Math.max(zonaH, alturaMinLlave) });

        dibujarLlave(llaves, {
            lado,
            x: lado === 'derecha' ? zonaXRight : zonaXLeft,
            y: yFinal,
            h: Math.max(zonaH, 30),
            color: zona.Color || '#3b82f6',
            nombre: zona.Nombre,
            zona
        });
    });
}

function dibujarLlave(contenedor, opciones) {
    const { lado, x, y, h, color, nombre, zona } = opciones;

    const cont = document.createElement('div');
    cont.className = 'llave-zona';
    cont.style.position = 'absolute';

    const svgW = 20;
    const svgH = Math.max(h, 30);

    let path, svgLeft;

    if (lado === 'derecha') {
        svgLeft = x + 2;
        path = `M 0 0 L 0 ${svgH} M 0 ${svgH / 2} L ${svgW} ${svgH / 2}`;
    } else {
        svgLeft = x - svgW - 2;
        path = `M ${svgW} 0 L ${svgW} ${svgH} M ${svgW} ${svgH / 2} L 0 ${svgH / 2}`;
    }

    cont.style.left = svgLeft + 'px';
    cont.style.top = y + 'px';
    cont.style.height = svgH + 'px';

    const svg = `
        <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
            <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="${lado === 'derecha' ? svgW : 0}" cy="${svgH / 2}" r="3" fill="${color}"/>
        </svg>
    `;

    cont.innerHTML = svg;

    const etiqueta = document.createElement('div');
    etiqueta.className = 'etiqueta-llave';
    etiqueta.style.position = 'absolute';
    etiqueta.style.top = '50%';
    etiqueta.style.transform = 'translateY(-50%)';
    etiqueta.style.borderColor = color;

    if (lado === 'derecha') etiqueta.style.left = (svgW + 4) + 'px';
    else etiqueta.style.right = (svgW + 4) + 'px';

    etiqueta.innerHTML = `
        <span class="punto-color" style="background:${color};"></span>
        ${nombre}
    `;

    etiqueta.addEventListener('click', () => abrirModalZona(zona));

    cont.appendChild(etiqueta);
    contenedor.appendChild(cont);
}

/* =========================================================
   PANEL LATERAL — listas
   ========================================================= */
buscadorLateral.addEventListener('input', () => {
    filtroBusquedaLateral = buscadorLateral.value.trim().toLowerCase();
    renderPanelLateral();
});

lateralFiltrosRol.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.filtro-rol-chip');
    if (!btn) return;
    filtroRolActivo = btn.dataset.rol;
    renderPanelLateral();
});

lateralTabs.addEventListener('click', (ev) => {
    const tab = ev.target.closest('.lateral-tab');
    if (!tab) return;
    tabActivo = tab.dataset.tab;
    renderPanelLateral();
});

function renderPanelLateral() {
    renderTabs();
    renderFiltrosRol();
    renderListaSinUbicarFiltrada();
    renderListaZonas();
    actualizarBadge();
}

function renderTabs() {
    lateralTabs.innerHTML = '';
    const equipos = panelActivo.equiposSinUbicar || [];

    const porCliente = {};
    equipos.forEach(e => {
        if (!porCliente[e.IdCliente]) {
            porCliente[e.IdCliente] = {
                id: e.IdCliente, codigo: e.ClienteCodigo,
                nombre: e.ClienteNombre, total: 0
            };
        }
        porCliente[e.IdCliente].total++;
    });

    const tabTodos = document.createElement('button');
    tabTodos.className = 'lateral-tab' + (tabActivo === '__todos__' ? ' activo' : '');
    tabTodos.dataset.tab = '__todos__';
    tabTodos.innerHTML = `Todos <span class="tab-badge">${equipos.length}</span>`;
    lateralTabs.appendChild(tabTodos);

    Object.values(porCliente).forEach(g => {
        const tab = document.createElement('button');
        tab.className = 'lateral-tab' + (tabActivo === String(g.id) ? ' activo' : '');
        tab.dataset.tab = String(g.id);
        tab.innerHTML = `${g.codigo} <span class="tab-badge">${g.total}</span>`;
        lateralTabs.appendChild(tab);
    });
}

function renderFiltrosRol() {
    lateralFiltrosRol.querySelectorAll('.filtro-rol-chip').forEach(chip => {
        const rol = chip.dataset.rol;
        chip.classList.toggle('activo', rol === filtroRolActivo);
    });
}

function renderListaSinUbicarFiltrada() {
    listaSinUbicar.innerHTML = '';
    let equipos = panelActivo.equiposSinUbicar || [];

    if (tabActivo !== '__todos__') {
        const idCli = parseInt(tabActivo, 10);
        equipos = equipos.filter(e => Number(e.IdCliente) === idCli);
    }
    if (filtroRolActivo !== '__todos__') {
        equipos = equipos.filter(e => e.RolCodigo === filtroRolActivo);
    }
    if (filtroBusquedaLateral) {
        equipos = equipos.filter(e => e.Hostname.toLowerCase().includes(filtroBusquedaLateral));
    }

    if (equipos.length === 0) {
        listaSinUbicar.innerHTML = '<li class="lista-sin-ubicar-vacia">Sin equipos que coincidan con el filtro.</li>';
        return;
    }

    equipos.forEach(e => {
        const li = document.createElement('li');
        li.dataset.rol = e.RolCodigo || '';
        li.draggable = true;

        const clienteNom = e.ClienteCodigo || '?';
        const pisoNom = pisos.find(p => Number(p.IdPiso) === Number(e.IdPiso))?.Nombre
                       || `Piso ${e.IdPiso || '?'}`;

        li.innerHTML = `
            <span class="rol-punto"></span>
            <div class="equipo-info">
                <div class="hostname-texto">${e.Hostname}</div>
                <div class="equipo-ubicacion">${clienteNom} · ${pisoNom}</div>
            </div>
        `;
        li.addEventListener('dragstart', (ev) => {
            dragOrigen = {
                tipo: 'lista',
                idEquipo: e.IdEquipo,
                panelSufijo: panelActivo.sufijo,
                hostname: e.Hostname
            };
            ev.dataTransfer.effectAllowed = 'move';
            if (lateralBackdrop) lateralBackdrop.style.pointerEvents = 'none';
        });
        li.addEventListener('dragend', () => {
            if (lateralBackdrop) {
                setTimeout(() => { lateralBackdrop.style.pointerEvents = 'auto'; }, 100);
            }
        });
        listaSinUbicar.appendChild(li);
    });
}

function actualizarBadge() {
    const total = (panelActivo.equiposSinUbicar || []).length;
    badgeToggle.textContent = total;
}

function renderListaZonas() {
    listaZonas.innerHTML = '';
    const zonasNormales = panelActivo.zonas || [];
    const zonasLibres   = panelActivo.zonasLibres || [];

    if (zonasNormales.length === 0 && zonasLibres.length === 0) {
        listaZonas.innerHTML = '<li style="cursor:default;color:#95a5a6;background:transparent;font-size:0.8rem;">Sin zonas definidas</li>';
        return;
    }

    const gruposNormales = {};
    zonasNormales.forEach(z => {
        const key = `${z.Nombre}||${z.Color || ''}`;
        if (!gruposNormales[key]) {
            gruposNormales[key] = {
                nombre: z.Nombre,
                color: z.Color,
                zonas: []
            };
        }
        gruposNormales[key].zonas.push(z);
    });

    Object.values(gruposNormales).forEach(g => {
        const li = document.createElement('li');
        const colorDiv = document.createElement('div');
        colorDiv.className = 'muestra-color';
        colorDiv.style.background = g.color || '#ccc';
        const nombreSpan = document.createElement('span');
        nombreSpan.className = 'nombre-zona';
        nombreSpan.textContent = g.nombre;

        if (g.zonas.length > 1) {
            const cantSpan = document.createElement('span');
            cantSpan.textContent = `${g.zonas.length}`;
            cantSpan.style.cssText = 'font-size:0.7rem;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:8px;';
            li.appendChild(colorDiv);
            li.appendChild(nombreSpan);
            li.appendChild(cantSpan);
        } else {
            li.appendChild(colorDiv);
            li.appendChild(nombreSpan);
        }

        const btnEditar = document.createElement('button');
        btnEditar.textContent = 'Editar';
        btnEditar.className = 'secundario';
        btnEditar.addEventListener('click', () => abrirModalZona(g.zonas[0]));

        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.className = 'peligro';
        btnEliminar.addEventListener('click', () => {
            const total = g.zonas.length;
            const mensaje = total > 1
                ? `¿Eliminar TODAS las zonas llamadas <b>"${g.nombre}"</b> (${total} registros)?<br>
                   <span style="color:#64748b;font-size:0.85rem;">Los equipos permanecerán en sus posiciones.</span>`
                : `¿Eliminar la zona <b>"${g.nombre}"</b>?<br>
                   <span style="color:#64748b;font-size:0.85rem;">Los equipos permanecerán en sus posiciones.</span>`;

            mostrarConfirmacion(
                'Eliminar zona',
                mensaje,
                async () => {
                    try {
                        const res = await window.api.plano.eliminarZonasPorNombre(
                            panelActivo.idPiso, g.nombre, g.color
                        );

                        if (!res || res.ok === false) {
                            mostrarToast(res?.mensaje || 'No se pudo eliminar la zona', 'error', 4000);
                            return;
                        }

                        mostrarToast(
                            res.mensaje || `Zona "${g.nombre}" eliminada`,
                            'exito'
                        );
                        await recargarPanel(panelActivo);
                    } catch (err) {
                        mostrarToast('Error al eliminar: ' + err.message, 'error', 4000);
                    }
                }
            );
        });

        li.appendChild(btnEditar);
        li.appendChild(btnEliminar);
        listaZonas.appendChild(li);
    });

    if (zonasLibres.length > 0) {
        const grupos = {};
        zonasLibres.forEach(zl => {
            const key = `${zl.Nombre}||${zl.Color}`;
            if (!grupos[key]) grupos[key] = { nombre: zl.Nombre, color: zl.Color, celdas: [] };
            grupos[key].celdas.push(zl);
        });

        Object.values(grupos).forEach(g => {
            const li = document.createElement('li');
            const colorDiv = document.createElement('div');
            colorDiv.className = 'muestra-color';
            colorDiv.style.background = g.color;
            const nombreSpan = document.createElement('span');
            nombreSpan.className = 'nombre-zona';
            nombreSpan.textContent = g.nombre + ' (libre)';
            const cantSpan = document.createElement('span');
            cantSpan.textContent = `${g.celdas.length} c.`;
            cantSpan.style.cssText = 'font-size:0.7rem;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:8px;';

            const btnEliminar = document.createElement('button');
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.className = 'peligro';
            btnEliminar.addEventListener('click', () => {
                mostrarConfirmacion(
                    'Eliminar zona libre',
                    `¿Eliminar la zona libre "${g.nombre}"?`,
                    async () => {
                        await window.api.plano.eliminarZonaLibre(panelActivo.idPiso, g.nombre, g.color);
                        mostrarToast(`Zona libre "${g.nombre}" eliminada`, 'exito');
                        await recargarPanel(panelActivo);
                    }
                );
            });

            li.appendChild(colorDiv);
            li.appendChild(nombreSpan);
            li.appendChild(cantSpan);
            li.appendChild(btnEliminar);
            listaZonas.appendChild(li);
        });
    }
}

/* =========================================================
   DROP
   ========================================================= */
async function manejarDrop(panelDestino, filaDestino, columnaDestino) {
    if (!dragOrigen) return;

    const panelOrigen = dragOrigen.panelSufijo === 'izq' ? panelIzq : panelDer;
    const mismoPanel = panelOrigen === panelDestino;
    const contenidoDestino = panelDestino.celdas[filaDestino - 1][columnaDestino - 1];

    if (dragOrigen.tipo === 'lista') {
        const idEq = dragOrigen.idEquipo;
        const equipo = panelActivo.equiposSinUbicar.find(e => Number(e.IdEquipo) === Number(idEq));
        dragOrigen = null;
        if (!equipo) return;

        if (mismoPanel) {
            if (contenidoDestino) {
                mostrarConfirmacion(
                    'Celda ocupada',
                    `La celda (${filaDestino}, ${columnaDestino}) ya tiene <b>${contenidoDestino.Hostname}</b>.<br><br>` +
                    `Si continúas, se quitará ese equipo y se colocará <b>${equipo.Hostname}</b>. ¿Continuar?`,
                    async () => {
                        await window.api.plano.quitar(contenidoDestino.IdEquipo, panelDestino.idPiso, contenidoDestino.Hostname);
                        await window.api.plano.asignar(panelDestino.idPiso, equipo.IdEquipo, filaDestino, columnaDestino);
                        mostrarToast(`"${equipo.Hostname}" asignado en (${filaDestino}, ${columnaDestino})`, 'exito');
                        await recargarPanel(panelDestino);
                    }
                );
            } else {
                mostrarConfirmacion(
                    'Asignar equipo',
                    `¿Colocar <b>${equipo.Hostname}</b> en la celda (${filaDestino}, ${columnaDestino})?`,
                    async () => {
                        await window.api.plano.asignar(panelDestino.idPiso, equipo.IdEquipo, filaDestino, columnaDestino);
                        mostrarToast(`"${equipo.Hostname}" asignado en (${filaDestino}, ${columnaDestino})`, 'exito');
                        await recargarPanel(panelDestino);
                    }
                );
            }
        } else {
            if (!panelDestino.idPiso) { alert('Selecciona un piso en el panel destino primero.'); return; }

            abrirModalMoverEntrePisos({
                idEquipo: equipo.IdEquipo,
                panelOrigen: panelActivo,
                panelDestino,
                fila: filaDestino,
                columna: columnaDestino,
                equipoInfo: equipo,
                conSwap: false,
                equipoDestino: contenidoDestino || null,
                desdeLista: true
            });
        }
        return;
    }

    if (dragOrigen.tipo === 'celda') {
        const origen = { ...dragOrigen };
        dragOrigen = null;

        if (mismoPanel && origen.fila === filaDestino && origen.columna === columnaDestino) return;

        const equipoOrigen = panelOrigen.celdas[origen.fila - 1]?.[origen.columna - 1];
        if (!equipoOrigen) return;

        if (mismoPanel) {
            if (!contenidoDestino) {
                mostrarConfirmacion(
                    'Mover equipo',
                    `¿Mover <b>${equipoOrigen.Hostname}</b> de (${origen.fila}, ${origen.columna}) a (${filaDestino}, ${columnaDestino})?`,
                    async () => {
                        await window.api.plano.mover(
                            equipoOrigen.IdEquipo, filaDestino, columnaDestino,
                            origen.fila, origen.columna, panelDestino.idPiso
                        );
                        mostrarToast(`"${equipoOrigen.Hostname}" movido`, 'exito');
                        await recargarPanel(panelDestino);
                    }
                );
            } else {
                mostrarConfirmacion(
                    'Intercambiar posiciones',
                    `Se intercambiarán las posiciones de <b>${equipoOrigen.Hostname}</b> y <b>${contenidoDestino.Hostname}</b>.<br><br>` +
                    `Los datos de cada equipo permanecerán intactos. ¿Continuar?`,
                    async () => {
                        await window.api.plano.intercambiar(
                            equipoOrigen.IdEquipo, contenidoDestino.IdEquipo, panelDestino.idPiso,
                            equipoOrigen.Hostname, contenidoDestino.Hostname,
                            origen.fila, origen.columna, filaDestino, columnaDestino
                        );
                        mostrarToast(`"${equipoOrigen.Hostname}" ↔ "${contenidoDestino.Hostname}"`, 'exito');
                        await recargarPanel(panelDestino);
                    }
                );
            }
            return;
        }

        if (!panelDestino.idPiso) { alert('Selecciona un piso en el panel destino primero.'); return; }

        if (contenidoDestino) {
            abrirModalMoverEntrePisos({
                idEquipo: equipoOrigen.IdEquipo,
                panelOrigen, panelDestino,
                fila: filaDestino, columna: columnaDestino,
                equipoInfo: equipoOrigen,
                conSwap: true,
                equipoDestino: contenidoDestino,
                filaOrigen: origen.fila,
                columnaOrigen: origen.columna
            });
        } else {
            abrirModalMoverEntrePisos({
                idEquipo: equipoOrigen.IdEquipo,
                panelOrigen, panelDestino,
                fila: filaDestino, columna: columnaDestino,
                equipoInfo: equipoOrigen,
                conSwap: false,
                equipoDestino: null,
                filaOrigen: origen.fila,
                columnaOrigen: origen.columna
            });
        }
    }
}

/* =========================================================
   MODAL MOVER ENTRE PISOS
   ========================================================= */
async function abrirModalMoverEntrePisos(datos) {
    moverPendiente = datos;

    const { equipoInfo, panelOrigen, panelDestino, fila, columna, conSwap, equipoDestino } = datos;

    const pisoOrigen = pisos.find(p => Number(p.IdPiso) === Number(panelOrigen.idPiso));
    const pisoDestino = pisos.find(p => Number(p.IdPiso) === Number(panelDestino.idPiso));

    let infoHTML = `
        <div><b>Equipo:</b> ${equipoInfo.Hostname}</div>
        <div><b>Cliente:</b> ${equipoInfo.ClienteCodigo || '—'}</div>
        <div><b>Desde:</b> ${pisoOrigen?.Nombre ?? 'Piso ' + panelOrigen.idPiso}${datos.filaOrigen ? ' (fila ' + datos.filaOrigen + ', col ' + datos.columnaOrigen + ')' : ''}</div>
        <div><b>Hacia:</b> ${pisoDestino?.Nombre ?? 'Piso ' + panelDestino.idPiso}, celda (${fila}, ${columna})</div>
    `;

    if (conSwap) {
        infoHTML += `
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid #cbd5e1;">
                <b style="color:#dc2626;">⚠ La celda destino ya tiene:</b> ${equipoDestino.Hostname}<br>
                Se intercambiarán posiciones. Los datos de cada equipo se mantienen.
            </div>
        `;
    }

    moverInfo.innerHTML = infoHTML;
    moverTitulo.textContent = conSwap ? 'Intercambiar equipos entre pisos' : 'Mover equipo entre pisos';

    chkMantener.checked = true;
    formEditarMover.style.display = 'none';
    moverMensaje.style.display = 'none';

    document.querySelector('.check-mantener').style.display = conSwap ? 'none' : 'block';

    llenarSelectClientesMover();
    llenarSelectRolesMover();
    await cargarDatosEquipoEnModal(equipoInfo.IdEquipo);

    if (pisoDestino) {
        mvLugar.innerHTML = `<option value="${pisoDestino.IdPiso}">${pisoDestino.Nombre}</option>`;
        mvLugar.value = pisoDestino.IdPiso;
    } else {
        mvLugar.innerHTML = `<option value="${panelDestino.idPiso}">Piso ${panelDestino.idPiso}</option>`;
        mvLugar.value = panelDestino.idPiso;
    }

    modalMover.style.display = 'flex';
}

chkMantener.addEventListener('change', () => {
    formEditarMover.style.display = chkMantener.checked ? 'none' : 'block';
});

moverCancelar.addEventListener('click', () => {
    modalMover.style.display = 'none';
    moverPendiente = null;
});

moverConfirmar.addEventListener('click', async () => {
    if (!moverPendiente) return;

    const datos = moverPendiente;
    const { idEquipo, panelOrigen, panelDestino, fila, columna, conSwap, equipoDestino, filaOrigen, columnaOrigen } = datos;

    moverConfirmar.disabled = true;
    moverConfirmar.textContent = 'Guardando...';
    moverMensaje.style.display = 'none';

    try {
        if (conSwap) {
            const res = await window.api.plano.swapEntrePisos({
                idEquipoA: idEquipo,
                idEquipoB: equipoDestino.IdEquipo,
                idPisoA: panelOrigen.idPiso,
                filaA: filaOrigen,
                colA: columnaOrigen,
                idPisoB: panelDestino.idPiso,
                filaB: fila,
                colB: columna,
                hostA: datos.equipoInfo.Hostname,
                hostB: equipoDestino.Hostname
            });

            if (!res || !res.ok) {
                mostrarMensajeMover(res?.mensaje || 'No se pudo intercambiar.', 'error');
                return;
            }
            mostrarToast(`Intercambio entre pisos completado`, 'exito');
        } else {
            let nuevosDatos = null;

            if (!chkMantener.checked) {
                nuevosDatos = {
                    idCliente:    parseInt(mvCliente.value, 10),
                    idRolEquipo:  parseInt(mvRol.value, 10),
                    tipoIP:       mvTipoIP.value,
                    hostname:     mvHostname.value.trim(),
                    numeroHost:   mvTipoIP.value === 'Estatica' ? parseInt(mvIP.value.split('.')[3], 10) : null,
                    ip:           mvTipoIP.value === 'Estatica' ? mvIP.value.trim() : null,
                    mascara:      mvMascara.value.trim(),
                    puertaEnlace: mvPuerta.value.trim(),
                    dns1:         mvDns1.value.trim(),
                    dns2:         mvDns2.value.trim(),
                    usuarioAdmin: mvUsuario.value.trim(),
                    passwordAdmin:mvPassword.value.trim()
                };

                if (!nuevosDatos.idCliente || !nuevosDatos.idRolEquipo) {
                    mostrarMensajeMover('Cliente y rol son obligatorios.', 'error');
                    return;
                }
                if (!nuevosDatos.hostname) {
                    mostrarMensajeMover('El hostname es obligatorio.', 'error');
                    return;
                }
                if (nuevosDatos.tipoIP === 'Estatica' && !nuevosDatos.ip) {
                    mostrarMensajeMover('La IP es obligatoria en estáticos.', 'error');
                    return;
                }
            }

            if (datos.desdeLista) {
                if (equipoDestino) {
                    await window.api.plano.quitar(equipoDestino.IdEquipo, panelDestino.idPiso, equipoDestino.Hostname);
                }
                const res = await window.api.plano.asignar(panelDestino.idPiso, idEquipo, fila, columna);

                if (nuevosDatos) {
                    const resUpd = await window.api.equipos.actualizar(idEquipo, {
                        ...nuevosDatos,
                        idPiso: panelDestino.idPiso,
                        activo: true
                    });
                    if (resUpd && resUpd.ok === false) {
                        mostrarMensajeMover(resUpd.mensaje || 'No se pudo actualizar.', 'error');
                        return;
                    }
                }

                if (!res || !res.ok) {
                    mostrarMensajeMover(res?.mensaje || 'No se pudo asignar.', 'error');
                    return;
                }
                mostrarToast(`Equipo movido a otro piso`, 'exito');
            } else {
                const res = await window.api.plano.moverEntrePisos(
                    idEquipo, panelOrigen.idPiso, panelDestino.idPiso, fila, columna, nuevosDatos
                );

                if (!res || !res.ok) {
                    mostrarMensajeMover(res?.mensaje || 'No se pudo mover.', 'error');
                    return;
                }
                mostrarToast(`Equipo movido a otro piso`, 'exito');
            }
        }

        modalMover.style.display = 'none';
        moverPendiente = null;

        await recargarPanel(panelOrigen);
        await recargarPanel(panelDestino);

    } catch (err) {
        console.error(err);
        mostrarMensajeMover('Error: ' + err.message, 'error');
        mostrarToast('Error al mover equipo', 'error', 4000);
    } finally {
        moverConfirmar.disabled = false;
        moverConfirmar.textContent = 'Confirmar';
    }
});

function mostrarMensajeMover(texto, tipo) {
    moverMensaje.textContent = texto;
    moverMensaje.className = 'mensaje ' + tipo;
    moverMensaje.style.display = 'block';
}

/* =========================================================
   HELPERS MODAL MOVER
   ========================================================= */
function llenarSelectClientesMover() {
    mvCliente.innerHTML = '';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.IdCliente;
        opt.textContent = `${c.Codigo} - ${c.Nombre}`;
        mvCliente.appendChild(opt);
    });
}

function llenarSelectRolesMover() {
    mvRol.innerHTML = '';
    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.IdRolEquipo;
        opt.textContent = `${r.Codigo} - ${r.Nombre}`;
        mvRol.appendChild(opt);
    });
}

async function cargarDatosEquipoEnModal(idEquipo) {
    const todos = await window.api.equipos.listar();
    const eq = todos.find(x => Number(x.IdEquipo) === Number(idEquipo));
    if (!eq) return;

    mvCliente.value  = eq.IdCliente != null ? String(eq.IdCliente) : '';
    mvRol.value      = eq.IdRolEquipo != null ? String(eq.IdRolEquipo) : '';
    mvTipoIP.value   = eq.TipoIP;
    mvHostname.value = eq.Hostname;
    mvIP.value       = eq.IP ?? '';
    mvMascara.value  = eq.Mascara ?? '';
    mvPuerta.value   = eq.PuertaEnlace ?? '';
    mvDns1.value     = eq.DNS1 ?? '';
    mvDns2.value     = eq.DNS2 ?? '';
    mvUsuario.value  = eq.UsuarioAdmin ?? '';
    mvPassword.value = eq.PasswordAdmin ?? '';
}

/* =========================================================
   QUITAR EQUIPO
   ========================================================= */
function confirmarQuitar(equipo, panel) {
    mostrarConfirmacion(
        'Quitar del plano',
        `¿Quitar <b>${equipo.Hostname}</b> (${equipo.ClienteCodigo || ''}) del plano?<br><br>El equipo seguirá existiendo en el sistema, solo se eliminará su ubicación física.`,
        async () => {
            await window.api.plano.quitar(equipo.IdEquipo, panel.idPiso, equipo.Hostname);
            mostrarToast(`"${equipo.Hostname}" quitado del plano`, 'exito');
            await recargarPanel(panel);
        }
    );
}

/* =========================================================
   VISTA PREVIA — CON CIERRE AUTOMÁTICO
   ========================================================= */
function cerrarVistaPrevia() {
    if (ventanaVistaPrevia && !ventanaVistaPrevia.closed) {
        try {
            ventanaVistaPrevia.close();
        } catch (e) {
            console.warn('No se pudo cerrar la vista previa:', e);
        }
    }
    ventanaVistaPrevia = null;
}

btnVistaPrevia.addEventListener('click', () => {
    if (!panelActivo.idPiso) { alert('Selecciona un piso primero.'); return; }

    // Cerrar vista previa anterior si existe
    cerrarVistaPrevia();

    try {
        const opciones = generarPDFDocumentado(panelActivo);
        const ventana = window.open('', '_blank');
        if (!ventana) {
            alert('El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para ver la vista previa.');
            return;
        }
        ventanaVistaPrevia = ventana;

        ventana.document.open();
        ventana.document.write(opciones.html);
        ventana.document.close();
    } catch (err) {
        mostrarToast('Error al generar vista previa: ' + err.message, 'error', 4000);
        ventanaVistaPrevia = null;
    }
});

/* Cerrar la vista previa al cerrar/recargar la ventana del plano */
window.addEventListener('beforeunload', () => {
    cerrarVistaPrevia();
});

/* Cerrar la vista previa también si el usuario cierra la pestaña desde la barra */
window.addEventListener('pagehide', () => {
    cerrarVistaPrevia();
});

/* =========================================================
   EXPORTAR PDF
   ========================================================= */
btnExportarPDFDoc.addEventListener('click', async () => {
    if (!panelActivo.idPiso) { alert('Selecciona un piso primero.'); return; }

    try {
        btnExportarPDFDoc.disabled = true;
        const original = btnExportarPDFDoc.innerHTML;
        btnExportarPDFDoc.innerHTML = 'Generando...';

        const opciones = generarPDFDocumentado(panelActivo);
        const res = await window.api.plano.exportarPDF(opciones);

        if (res.ok) {
            mostrarToast('PDF Documentado generado correctamente', 'exito', 4000);
            console.log('Ruta:', res.ruta);
        } else {
            mostrarToast('Generación cancelada', 'info');
        }

        btnExportarPDFDoc.disabled = false;
        btnExportarPDFDoc.innerHTML = original;
    } catch (err) {
        mostrarToast('Error al generar PDF: ' + err.message, 'error', 4000);
        btnExportarPDFDoc.disabled = false;
    }
});

/* =========================================================
   GENERADOR PDF DOCUMENTADO
   - Celdas: Hostname (arriba, negrita) + IP (abajo, mono)
   - Tabla: sin columna #, con "Dominio" y "UsuarioAdmin" correctos
   - Llaves + etiquetas de zonas fuera del grid
   ========================================================= */
function generarPDFDocumentado(panel) {
    const piso = pisos.find(p => Number(p.IdPiso) === Number(panel.idPiso));
    const nombrePiso = piso ? piso.Nombre : '';
    const fecha = new Date().toLocaleString('es-MX');

    const cols = panel.dimensiones.Columnas;
    const filas = panel.dimensiones.Filas;

    const zonasLibresMap = new Map();
    (panel.zonasLibres || []).forEach(zl => {
        zonasLibresMap.set(`${zl.Fila}-${zl.Columna}`, zl);
    });

    const gruposLibres = {};
    (panel.zonasLibres || []).forEach(zl => {
        const key = `${zl.Nombre}||${zl.Color}`;
        if (!gruposLibres[key]) {
            gruposLibres[key] = { nombre: zl.Nombre, color: zl.Color, celdas: [] };
        }
        gruposLibres[key].celdas.push({ fila: zl.Fila, columna: zl.Columna });
    });

    const equiposList = [];
    for (let f = 0; f < filas; f++) {
        for (let c = 0; c < cols; c++) {
            const contenido = panel.celdas[f]?.[c];
            if (contenido) {
                const fila = f + 1;
                const col = c + 1;
                equiposList.push({
                    fila, col,
                    ...contenido
                });
            }
        }
    }

    const totalEquipos = equiposList.length;

    /* COLORES POR CLIENTE */
    const COLORES_CLIENTE_POR_CODIGO = {
        'MEGA':    '#22c55e',
        'DIDI':    '#f97316',
        'NU':      '#a855f7',
        'ATT':     '#0ea5e9',
        'ADAMA':   '#1e40af',
        'CLD':     '#ec4899',
        'DMEX':    '#84cc16',
        'HBAN':    '#eab308',
        'KUBO':    '#16a34a',
        'FESA':    '#0d9488',
        'SHOP':    '#ea580c',
        'TOY':     '#dc2626',
        'TOYL':    '#dc2626',
        'TPLAY':   '#6366f1',
        'PHIE':    '#f59e0b'
    };

    const COLORES_FALLBACK = [
        '#3b82f6', '#22c55e', '#f97316', '#a855f7',
        '#14b8a6', '#ec4899', '#eab308', '#ef4444',
        '#06b6d4', '#8b5cf6', '#84cc16', '#f43f5e'
    ];

    const colorPorCliente = new Map();
    let fallbackIdx = 0;

    equiposList.forEach(e => {
        const id = e.IdCliente;
        if (id == null || colorPorCliente.has(id)) return;

        const codigo = String(e.ClienteCodigo || '').toUpperCase().trim();
        let color = COLORES_CLIENTE_POR_CODIGO[codigo];

        if (!color) {
            color = COLORES_FALLBACK[fallbackIdx % COLORES_FALLBACK.length];
            fallbackIdx++;
        }

        colorPorCliente.set(id, color);
    });

    /* TAMAÑOS — A3 PORTRAIT */
    const ANCHO_UTIL = 1060;
    const ALTO_PLANO = 1420;

    const GAP = 8;
    const GRID_PADDING = 14;

    const anchoDisponible = ANCHO_UTIL - GRID_PADDING * 2 - GAP * (cols - 1);
    const altoDisponible  = ALTO_PLANO - GRID_PADDING * 2 - GAP * (filas - 1);

    let CELL_W = Math.floor(anchoDisponible / cols);
    let CELL_H = Math.floor(altoDisponible / filas);

    const ALTO_MAX_CELDA = 46;
    CELL_H = Math.min(CELL_H, ALTO_MAX_CELDA);

    const MAX_RATIO_W_H = 1.8;
    const anchoMaxPorAlto = Math.floor(CELL_H * MAX_RATIO_W_H);
    CELL_W = Math.min(CELL_W, anchoMaxPorAlto);

    CELL_W = Math.max(16, CELL_W);
    CELL_H = Math.max(16, CELL_H);

    // Fuentes del PDF (ajustadas a gusto del usuario)
    const FONT_HOST = Math.max(0.17, Math.min(0.68, CELL_H / 54)).toFixed(2);
    const FONT_IP   = Math.max(0.09, Math.min(0.55, CELL_H / 60)).toFixed(2);

    function normalizarColor(c, fallback = '#e2e8f0') {
        if (!c || typeof c !== 'string') return fallback;
        const s = c.trim();
        if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
        if (/^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
        return fallback;
    }

    function colorTextoContraste(hexColor) {
        try {
            const hex = String(hexColor).replace('#', '');
            const full = hex.length === 3
                ? hex.split('').map(c => c + c).join('')
                : hex;
            const r = parseInt(full.substr(0, 2), 16);
            const g = parseInt(full.substr(2, 2), 16);
            const b = parseInt(full.substr(4, 2), 16);
            const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminancia < 0.6 ? '#ffffff' : '#1e293b';
        } catch {
            return '#1e293b';
        }
    }

    /* CELDAS BASE */
    let celdasHTML = '';
    for (let f = 0; f < filas; f++) {
        for (let c = 0; c < cols; c++) {
            const fila = f + 1;
            const col = c + 1;
            const contenido = panel.celdas[f]?.[c];
            const zl = zonasLibresMap.get(`${fila}-${col}`);

            if (contenido) {
                const ipMostrar = contenido.IP ? contenido.IP : 'DHCP';
                celdasHTML += `
                    <div class="celda ocupada" data-rol="${contenido.RolCodigo || ''}">
                        <div class="celda-contenido">
                            <div class="celda-hostname">${contenido.Hostname || ''}</div>
                            <div class="celda-ip">${ipMostrar}</div>
                        </div>
                    </div>`;
            } else if (zl) {
                const colorZL = normalizarColor(zl.Color, '#e2e8f0');
                celdasHTML += `<div class="celda libre" style="background:${colorZL} !important;border:1px solid rgba(0,0,0,0.25) !important;"></div>`;
            } else {
                celdasHTML += `<div class="celda vacia"></div>`;
            }
        }
    }

    /* BORDE POR EQUIPO + CHIP DE CLIENTE ARRIBA */
    let bordesEquipoHTML = '';
    let etiquetasEquipoHTML = '';

    const BORDE_OFFSET = 2;
    const CHIP_ALTO = 16;
    const CHIP_FONT = 0.6;

    equiposList.forEach(e => {
        const colorCli = colorPorCliente.get(e.IdCliente) || '#3b82f6';

        const x = (e.col - 1) * (CELL_W + GAP);
        const y = (e.fila - 1) * (CELL_H + GAP);

        bordesEquipoHTML += `
            <div style="
                position:absolute;
                left:${x + GRID_PADDING - BORDE_OFFSET}px;
                top:${y + GRID_PADDING - BORDE_OFFSET}px;
                width:${CELL_W + BORDE_OFFSET * 2}px;
                height:${CELL_H + BORDE_OFFSET * 2}px;
                border:2.5px solid ${colorCli};
                border-radius:6px;
                pointer-events:none;
                box-sizing:border-box;
                z-index:4;
            "></div>
        `;

        const codigoCli = e.ClienteCodigo || '?';
        etiquetasEquipoHTML += `
            <div style="
                position:absolute;
                left:${x + GRID_PADDING - BORDE_OFFSET}px;
                top:${y + GRID_PADDING - BORDE_OFFSET - CHIP_ALTO + 2}px;
                height:${CHIP_ALTO}px;
                max-width:${CELL_W + BORDE_OFFSET * 2}px;
                padding:0 6px;
                background:${colorCli};
                color:#ffffff;
                font-size:${CHIP_FONT}rem;
                font-weight:700;
                letter-spacing:0.03em;
                text-transform:uppercase;
                border-radius:3px;
                display:flex;
                align-items:center;
                justify-content:center;
                white-space:nowrap;
                overflow:visible;
                pointer-events:none;
                box-sizing:border-box;
                z-index:5;
                text-shadow:0 1px 1px rgba(0,0,0,0.25);
            ">${codigoCli}</div>
        `;
    });

    /* TEXTO DE ZONAS LIBRES */
    let textosLibresHTML = '';

    Object.values(gruposLibres).forEach(g => {
        const filasArr = g.celdas.map(c => c.fila);
        const colsArr  = g.celdas.map(c => c.columna);
        const filaMin  = Math.min(...filasArr);
        const filaMax  = Math.max(...filasArr);
        const colMin   = Math.min(...colsArr);
        const colMax   = Math.max(...colsArr);

        const x0 = (colMin - 1) * (CELL_W + GAP) + GRID_PADDING;
        const y0 = (filaMin - 1) * (CELL_H + GAP) + GRID_PADDING;
        const w  = (colMax - colMin + 1) * (CELL_W + GAP) - GAP;
        const h  = (filaMax - filaMin + 1) * (CELL_H + GAP) - GAP;

        const colorZona  = normalizarColor(g.color, '#e2e8f0');
        const colorTexto = colorTextoContraste(colorZona);

        const totalFilas = filaMax - filaMin + 1;
        const totalCols  = colMax - colMin + 1;
        const fontSizeRem = Math.max(0.7, Math.min(1.4, 0.75 + Math.min(totalFilas, totalCols) * 0.08));

        textosLibresHTML += `
            <div style="
                position:absolute;
                left:${x0}px;
                top:${y0}px;
                width:${w}px;
                height:${h}px;
                display:flex;
                align-items:center;
                justify-content:center;
                text-align:center;
                font-weight:700;
                font-size:${fontSizeRem}rem;
                color:${colorTexto};
                text-transform:uppercase;
                letter-spacing:0.05em;
                text-shadow:0 1px 2px rgba(255,255,255,0.35);
                pointer-events:none;
                padding:2px;
                line-height:1.05;
                word-break:break-word;
                box-sizing:border-box;
                z-index:5;
            ">${g.nombre}</div>
        `;
    });

    /* ZONAS (MESAS) — llaves + etiquetas laterales */
    let zonasLlavesHTML = '';

    const ZONA_ORDENADAS = [...(panel.zonas || [])].sort((a, b) => a.FilaInicio - b.FilaInicio);
    const GRID_TOTAL_W = cols * CELL_W + (cols - 1) * GAP;

    const ocupacionIzq = [];
    const ocupacionDer = [];

    ZONA_ORDENADAS.forEach(zona => {
        const startFila = zona.FilaInicio - 1;
        const endFila   = zona.FilaFin - 1;
        const endCol    = zona.ColumnaFin - 1;

        const zonaY = startFila * (CELL_H + GAP);
        const zonaH = (endFila - startFila) * (CELL_H + GAP) + CELL_H;

        const zonaXRight = (endCol + 1) * (CELL_W + GAP) - GAP;
        const zonaXLeft  = (zona.ColumnaInicio - 1) * (CELL_W + GAP);

        const centroBloque = (zonaXLeft + zonaXRight) / 2;
        const mitadGrid    = GRID_TOTAL_W / 2;

        let lado = centroBloque >= mitadGrid ? 'derecha' : 'izquierda';

        const ocupacion = lado === 'derecha' ? ocupacionDer : ocupacionIzq;
        let yFinal = zonaY;
        const alturaMin = 24;

        for (const oc of ocupacion) {
            if (yFinal < oc.bottom && (yFinal + zonaH) > oc.top) {
                yFinal = oc.bottom + 6;
            }
        }
        ocupacion.push({ top: yFinal, bottom: yFinal + Math.max(zonaH, alturaMin) });

        const colorZona = normalizarColor(zona.Color, '#3b82f6');

        const OFFSET_LLAVE = 8;
        const xBase = lado === 'derecha'
            ? zonaXRight + OFFSET_LLAVE
            : zonaXLeft  - OFFSET_LLAVE;

        const hLlave = Math.max(zonaH, 30);

        const svgW = 24;
        const svgH = hLlave;
        let path;
        if (lado === 'derecha') {
            path = `M 0 0 L 0 ${svgH} M 0 ${svgH / 2} L ${svgW} ${svgH / 2}`;
        } else {
            path = `M ${svgW} 0 L ${svgW} ${svgH} M ${svgW} ${svgH / 2} L 0 ${svgH / 2}`;
        }

        const leftLlave = xBase + GRID_PADDING + (lado === 'derecha' ? 2 : -svgW - 2);
        const topLlave  = yFinal + GRID_PADDING;

        const chipH = 20;
        const chipFont = 0.7;

        zonasLlavesHTML += `
            <div style="
                position:absolute;
                left:${leftLlave}px;
                top:${topLlave}px;
                width:${svgW}px;
                height:${svgH}px;
                pointer-events:none;
                z-index:6;
            ">
                <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"
                     xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
                    <path d="${path}" fill="none" stroke="${colorZona}" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="${lado === 'derecha' ? svgW : 0}" cy="${svgH / 2}" r="3" fill="${colorZona}"/>
                </svg>

                <div style="
                    position:absolute;
                    top:50%;
                    transform:translateY(-50%) ${lado === 'izquierda' ? ' translateX(-100%)' : ''};
                    left:${lado === 'derecha' ? svgW + 6 : 0}px;
                    background:#ffffff;
                    border:1px solid ${colorZona};
                    border-radius:4px;
                    padding:2px 8px;
                    height:${chipH}px;
                    display:flex;
                    align-items:center;
                    gap:5px;
                    font-size:${chipFont}rem;
                    font-weight:700;
                    color:#1e293b;
                    text-transform:uppercase;
                    letter-spacing:0.03em;
                    white-space:nowrap;
                    box-shadow:0 1px 3px rgba(0,0,0,0.08);
                    box-sizing:border-box;
                ">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colorZona};"></span>
                    ${zona.Nombre}
                </div>
            </div>
        `;
    });

    /* TABLA — SIN COLUMNA #
       Orden correcto:
       Hostname, Cliente, Rol, IP, Máscara, Puerta enlace, DNS 1, DNS 2,
       Dominio (= UsuarioAdmin de la BD),
       Password admin (= PasswordAdmin),
       UsuarioAdmin (= DescripcionAdmin de DominiosAdmin)
    */
    const filasTabla = equiposList.map(e => `
        <tr>
            <td class="bold-host">${e.Hostname || '-'}</td>
            <td class="center">${e.ClienteCodigo || '-'}</td>
            <td class="center"><span class="badge-rol" data-rol="${e.RolCodigo || ''}">${e.RolCodigo || '-'}</span></td>
            <td class="mono">${e.IP || '-'}</td>
            <td class="mono">${e.Mascara || '-'}</td>
            <td class="mono">${e.PuertaEnlace || '-'}</td>
            <td class="mono">${e.DNS1 || '-'}</td>
            <td class="mono">${e.DNS2 || '-'}</td>
            <td class="mono">${e.UsuarioAdmin || '-'}</td>
            <td class="mono">${e.PasswordAdmin || '-'}</td>
            <td class="mono">${e.DescripcionAdmin || '-'}</td>
        </tr>
    `).join('');

    const porRol = {};
    equiposList.forEach(e => {
        const r = e.RolCodigo || 'SIN ROL';
        porRol[r] = (porRol[r] || 0) + 1;
    });

    const rolesHTML = Object.entries(porRol)
        .sort((a, b) => b[1] - a[1])
        .map(([rol, cant]) => `
            <div class="identificador-item">
                <span class="badge-rol" data-rol="${rol}">${rol}</span>
                <span class="cant">${cant}</span>
            </div>
        `).join('');

    const porCliente = {};
    equiposList.forEach(e => {
        const c = e.ClienteCodigo || 'SIN CLIENTE';
        porCliente[c] = (porCliente[c] || 0) + 1;
    });

    const clientesHTML = Object.entries(porCliente)
        .sort((a, b) => b[1] - a[1])
        .map(([cli, cant]) => `
            <div class="identificador-item">
                <span class="badge-cli">${cli}</span>
                <span class="cant">${cant}</span>
            </div>
        `).join('');

    const zonasLibresGrupos = Object.values(gruposLibres);
    const zonasLibresHTML = zonasLibresGrupos.length > 0
        ? zonasLibresGrupos.map(g => `
            <div class="identificador-item">
                <span class="muestra-color-inline" style="background:${normalizarColor(g.color)};"></span>
                <span class="nombre-zona-libre">${g.nombre}</span>
                <span class="cant">${g.celdas.length}</span>
            </div>
        `).join('')
        : '';

    /* CSS */
    const css = `
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @page plano-page { size: A3 portrait; margin: 8mm; }
        @page tabla-page { size: A3 landscape; margin: 8mm; }

        html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }

        body {
            font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: #f1f5f9; color: #1e293b; font-size: 11px; line-height: 1.2;
        }

        .zoom-scroll-area { position: fixed; inset: 0; overflow: auto; padding: 24px; background: #f1f5f9; }
        .zoom-center { display: block; width: max-content; min-width: 100%; margin: 0 auto; }
        #pdf-zoom-target {
            transform-origin: top left; transition: transform 0.08s ease-out;
            width: fit-content; background: #fff;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); border-radius: 4px; margin: 0 auto;
        }

        .pagina-plano {
            page: plano-page; page-break-after: always; width: 1120px;
            display: flex; flex-direction: column; padding: 20px; background: #fff;
        }
        .pagina-tabla { page: tabla-page; width: 1400px; padding: 20px; background: #fff; }

        .encabezado {
            display: flex; justify-content: space-between; align-items: flex-end;
            padding-bottom: 6px; border-bottom: 3px solid #1e293b; margin-bottom: 10px; flex-shrink: 0;
        }
        .encabezado .titulo h1 { font-size: 1.4rem; color: #1e293b; margin-bottom: 2px; }
        .encabezado .titulo .sub { font-size: 0.92rem; color: #64748b; }
        .encabezado .meta { text-align: right; font-size: 0.8rem; color: #64748b; line-height: 1.5; }
        .encabezado .meta strong { color: #1e293b; }

        .seccion-titulo {
            font-size: 0.82rem; font-weight: 700; color: #1e293b;
            text-transform: uppercase; letter-spacing: 0.06em;
            margin: 10px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #e2e8f0;
        }

        .plano-wrap {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 12px 160px;
            min-height: fit-content;
        }
        .grid-plano {
            display: grid;
            grid-template-columns: repeat(${cols}, ${CELL_W}px);
            grid-template-rows: repeat(${filas}, ${CELL_H}px);
            gap: ${GAP}px; background: #e2e8f0; padding: ${GRID_PADDING}px;
            border-radius: 10px; border: 2px solid #cbd5e1; width: fit-content; position: relative;
        }
        .celda {
            width: ${CELL_W}px; height: ${CELL_H}px; background: #fff;
            border: 1px dashed #cbd5e1; border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
        }
        .celda.ocupada { border-style: solid; border-width: 1.5px; }
        .celda.libre { border-style: solid; border-width: 1px; }
        .celda.vacia { border-style: dashed; }

        .celda-contenido {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            width: 100%;
            height: 100%;
            padding: 2px 3px;
            text-align: center;
            line-height: 1.05;
            overflow: hidden;
        }
        .celda-hostname {
            font-weight: 700;
            font-size: ${FONT_HOST}rem;
            color: #1e293b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            letter-spacing: -0.01em;
        }
        .celda-ip {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: ${FONT_IP}rem;
            font-weight: 600;
            color: #334155;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            letter-spacing: -0.01em;
        }

        .celda[data-rol="AGT"] { background: #dbeafe; border-color: #3b82f6; }
        .celda[data-rol="SPR"] { background: #dcfce7; border-color: #22c55e; }
        .celda[data-rol="CLD"] { background: #ffedd5; border-color: #f97316; }
        .celda[data-rol="GRN"] { background: #f3e8ff; border-color: #a855f7; }
        .celda[data-rol="CRD"] { background: #ccfbf1; border-color: #14b8a6; }
        .celda[data-rol="MIS"] { background: #fce7f3; border-color: #ec4899; }
        .celda[data-rol="ADM"] { background: #e2e8f0; border-color: #475569; }

        .tabla-equipos { width: 100%; border-collapse: collapse; font-size: 0.72rem; table-layout: fixed; margin-top: 6px; }
        .tabla-equipos thead { background: #1e293b; color: #fff; display: table-header-group; }
        .tabla-equipos thead th { padding: 6px 6px; text-align: left; font-weight: 700; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.03em; }
        .tabla-equipos tbody tr { border-bottom: 1px solid #e2e8f0; }
        .tabla-equipos tbody tr:nth-child(even) { background: #f8fafc; }
        .tabla-equipos tbody td { padding: 3px 6px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
        .tabla-equipos .center { text-align: center; }
        .tabla-equipos .bold { font-weight: 700; color: #64748b; }
        .tabla-equipos .bold-host { font-weight: 600; color: #1e293b; }
        .tabla-equipos .mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 0.66rem; color: #475569; }

        .badge-rol { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 0.6rem; font-weight: 700; color: #fff; background: #94a3b8; }
        .badge-rol[data-rol="AGT"] { background: #3b82f6; }
        .badge-rol[data-rol="SPR"] { background: #22c55e; }
        .badge-rol[data-rol="CLD"] { background: #f97316; }
        .badge-rol[data-rol="GRN"] { background: #a855f7; }
        .badge-rol[data-rol="CRD"] { background: #14b8a6; }
        .badge-rol[data-rol="MIS"] { background: #ec4899; }
        .badge-rol[data-rol="ADM"] { background: #475569; }

        .identificadores { display: flex; flex-wrap: wrap; gap: 5px; padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 6px; }
        .identificador-item { display: flex; align-items: center; gap: 5px; padding: 3px 9px; background: #fff; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 0.72rem; }
        .identificador-item .cant { font-weight: 700; color: #1e293b; font-size: 0.8rem; }
        .identificador-item .muestra-color-inline { display: inline-block; width: 13px; height: 13px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.15); }
        .identificador-item .nombre-zona-libre { font-weight: 600; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em; }
        .badge-cli { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 0.62rem; font-weight: 700; color: #1e293b; background: #e2e8f0; }

        .zoom-indicador {
            position: fixed; bottom: 20px; right: 20px; background: rgba(15, 23, 42, 0.92); color: #fff;
            padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
            z-index: 99999; display: none; align-items: center; gap: 8px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25);
            pointer-events: none; user-select: none;
        }
        .zoom-indicador.visible { display: flex; }
        .zoom-indicador .zoom-valor { background: rgba(255,255,255,0.18); padding: 3px 10px; border-radius: 5px; font-variant-numeric: tabular-nums; }

        .zoom-hint {
            position: fixed; bottom: 20px; left: 20px; background: rgba(15, 23, 42, 0.82); color: #cbd5e1;
            padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 500; z-index: 99999;
            pointer-events: none; user-select: none; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .zoom-hint.oculto { opacity: 0; transform: translateY(10px); }

        body.zoom-activo { cursor: zoom-in; }

        @media print {
            html, body { overflow: visible; background: #fff; }
            .zoom-scroll-area { position: static; overflow: visible; padding: 0; background: #fff; }
            .zoom-center { display: block; width: auto; min-width: auto; }
            #pdf-zoom-target { transform: none !important; box-shadow: none; border-radius: 0; margin: 0; }
            .zoom-indicador, .zoom-hint { display: none !important; }
        }
    `;

    /* HTML */
    const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Vista previa — ${nombrePiso || 'Plano'}</title><style>${css}</style></head>
        <body>

            <div class="zoom-scroll-area" id="zoom-scroll-area">
                <div class="zoom-center" id="zoom-center">
                    <div id="pdf-zoom-target">

                        <div class="pagina-plano">
                            <div class="encabezado">
                                <div class="titulo">
                                    <h1>Plano de Equipos</h1>
                                    <div class="sub">${nombrePiso}</div>
                                </div>
                                <div class="meta">
                                    <div><strong>Fecha:</strong> ${fecha}</div>
                                    <div><strong>Total equipos:</strong> ${totalEquipos}</div>
                                    <div><strong>Dimensiones:</strong> ${cols} × ${filas}</div>
                                </div>
                            </div>

                            <div class="plano-wrap">
                                <div class="grid-plano">
                                    ${celdasHTML}
                                    ${bordesEquipoHTML}
                                    ${etiquetasEquipoHTML}
                                    ${textosLibresHTML}
                                    ${zonasLlavesHTML}
                                </div>
                            </div>
                        </div>

                        <div class="pagina-tabla">
                            <div class="encabezado">
                                <div class="titulo">
                                    <h1>Tabla de Equipos</h1>
                                    <div class="sub">${nombrePiso} — ${totalEquipos} equipos</div>
                                </div>
                                <div class="meta">
                                    <div><strong>Fecha:</strong> ${fecha}</div>
                                </div>
                            </div>

                            <div class="seccion-titulo">Identificadores</div>
                            <div class="identificadores">
                                ${clientesHTML}
                                ${rolesHTML}
                                ${zonasLibresHTML}
                            </div>

                            <div class="seccion-titulo">Equipos (${totalEquipos})</div>
                            <table class="tabla-equipos">
                                <thead>
                                    <tr>
                                        <th style="width:130px;">Hostname</th>
                                        <th style="width:55px;">Cliente</th>
                                        <th style="width:50px;">Rol</th>
                                        <th style="width:110px;">IP</th>
                                        <th style="width:110px;">Máscara</th>
                                        <th style="width:110px;">Puerta enlace</th>
                                        <th style="width:100px;">DNS 1</th>
                                        <th style="width:90px;">DNS 2</th>
                                        <th style="width:120px;">Dominio</th>
                                        <th style="width:130px;">Password admin</th>
                                        <th style="width:150px;">UsuarioAdmin</th>
                                    </tr>
                                </thead>
                                <tbody>${filasTabla}</tbody>
                            </table>
                        </div>

                    </div>
                </div>
            </div>

            <div class="zoom-indicador" id="zoom-indicador">
                Zoom: <span class="zoom-valor" id="zoom-valor">100%</span>
            </div>

            <div class="zoom-hint" id="zoom-hint">
                Ctrl + rueda del ratón para hacer zoom · Ctrl + 0 para restablecer
            </div>

            <script>
            (function() {
                let zoom = 1;
                const MIN_ZOOM = 0.3, MAX_ZOOM = 4, PASO = 0.1;
                const scrollArea = document.getElementById('zoom-scroll-area');
                const target     = document.getElementById('pdf-zoom-target');
                const indicador  = document.getElementById('zoom-indicador');
                const valorTxt   = document.getElementById('zoom-valor');
                const hint       = document.getElementById('zoom-hint');
                let ocultarTimer = null, hintTimer = null;

                function aplicarZoom() {
                    const rect = scrollArea.getBoundingClientRect();
                    const centerX = scrollArea.scrollLeft + rect.width / 2;
                    const centerY = scrollArea.scrollTop + rect.height / 2;
                    target.style.transform = 'scale(' + zoom + ')';
                    valorTxt.textContent = Math.round(zoom * 100) + '%';
                    requestAnimationFrame(() => {
                        scrollArea.scrollLeft = Math.max(0, centerX * zoom - rect.width / 2);
                        scrollArea.scrollTop  = Math.max(0, centerY * zoom - rect.height / 2);
                    });
                    indicador.classList.add('visible');
                    clearTimeout(ocultarTimer);
                    ocultarTimer = setTimeout(() => indicador.classList.remove('visible'), 1200);
                    if (hint) {
                        hint.classList.remove('oculto');
                        clearTimeout(hintTimer);
                        hintTimer = setTimeout(() => hint.classList.add('oculto'), 2500);
                    }
                }

                if (hint) setTimeout(() => hint.classList.add('oculto'), 5000);

                document.addEventListener('wheel', function(ev) {
                    if (!ev.ctrlKey && !ev.metaKey) return;
                    ev.preventDefault();
                    const delta = ev.deltaY > 0 ? -PASO : PASO;
                    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
                    aplicarZoom();
                }, { passive: false });

                document.addEventListener('keydown', function(ev) {
                    if ((ev.ctrlKey || ev.metaKey) && ev.key === '0') { ev.preventDefault(); zoom = 1; aplicarZoom(); return; }
                    if ((ev.ctrlKey || ev.metaKey) && (ev.key === '+' || ev.key === '=' || ev.key === 'Add')) {
                        ev.preventDefault(); zoom = Math.min(MAX_ZOOM, zoom + PASO); aplicarZoom(); return;
                    }
                    if ((ev.ctrlKey || ev.metaKey) && (ev.key === '-' || ev.key === 'Subtract')) {
                        ev.preventDefault(); zoom = Math.max(MIN_ZOOM, zoom - PASO); aplicarZoom(); return;
                    }
                });

                document.addEventListener('keydown', function(ev) {
                    if (ev.ctrlKey || ev.metaKey) document.body.classList.add('zoom-activo');
                });
                document.addEventListener('keyup', function(ev) {
                    if (!ev.ctrlKey && !ev.metaKey) document.body.classList.remove('zoom-activo');
                });
                window.addEventListener('blur', function() { document.body.classList.remove('zoom-activo'); });
            })();
            <\/script>
        </body>
        </html>
    `;

    const nombreArchivo = `Plano-Documentado-${nombrePiso || 'Piso'}-${Date.now()}.pdf`;
    return { html, nombreArchivo };
}

/* =========================================================
   ATAJOS: ENTER para guardar (Zona Libre y Zona 1×1)
   ========================================================= */
document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;

    if (modoZonaLibre && celdasLibresSeleccionadas.length > 0 && !guardandoZonaLibre) {
        ev.preventDefault();
        abrirModalZonaLibre();
        return;
    }

    if (modoZona && celdasZonaSeleccionadas.length > 0 && modalZona.style.display !== 'flex') {
        ev.preventDefault();
        abrirModalZona(null);
        return;
    }
});

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    await cargarClientes();
    roles = await window.api.roles.listar();
    await cargarPisosPanel(panelIzq, false);
    renderPanelLateral();
    crearTooltip();
    actualizarBotonesModo();

    window.addEventListener('resize', () => {
        if (panelIzq.idPiso) renderGridPanel(panelIzq);
        if (panelDer.idPiso) renderGridPanel(panelDer);
    });
})();