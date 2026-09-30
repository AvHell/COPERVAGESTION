/* =========================================================
   ESTADO GLOBAL
   ========================================================= */

let clientes = [];
let lugares = [];
let roles = [];

const panelIzq = crearEstadoPanel('izq');
const panelDer = crearEstadoPanel('der');
let panelActivo = panelIzq;

function crearEstadoPanel(sufijo) {
    return {
        sufijo,
        idCliente: null,
        idLugar: null,
        dimensiones: { Filas: 8, Columnas: 12 },
        celdas: [],
        zonas: [],
        zonasLibres: [],
        equiposSinUbicar: []
    };
}

let modoZonaLibre = false;
let celdasLibresSeleccionadas = [];
let colorSeleccionadoLibre = '#e74c3c';

let modoZona = false;
let seleccionZona = null;
let seleccionando = false;
let celdaInicioSeleccion = null;

let zonaEditando = null;
let colorSeleccionado = '#e74c3c';

let dragOrigen = null;
let moverPendiente = null;

let tabActivo = '__todos__';
let filtroRolActivo = '__todos__';
let filtroBusquedaLateral = '';

// 🔧 FIX: flag para evitar doble apertura del modal de zona libre
let guardandoZonaLibre = false;

const COLORES_DISPONIBLES = [
    '#e74c3c', '#e67e22', '#f1c40f', '#27ae60',
    '#3498db', '#9b59b6', '#95a5a6', '#2c3e50'
];

/* Dimensiones de celda en px (deben coincidir con el CSS) */
const CELL_W = 74;
const CELL_H = 52;
const CELL_GAP = 5;
const GRID_PADDING = 10;

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */

const contenedorPrincipal = document.getElementById('contenedor-principal');

const selectClienteIzq = document.getElementById('select-cliente-izq');
const selectLugarIzq   = document.getElementById('select-lugar-izq');
const inputFilasIzq    = document.getElementById('input-filas-izq');
const inputColumnasIzq = document.getElementById('input-columnas-izq');
const gridIzq          = document.getElementById('grid-izq');
const llavesIzq        = document.getElementById('llaves-izq');

const selectClienteDer = document.getElementById('select-cliente-der');
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
const btnLimpiarSeleccion = document.getElementById('btn-limpiar-seleccion');
const btnExportarPDF      = document.getElementById('btn-exportar-pdf');
const btnExportarPDFDoc   = document.getElementById('btn-exportar-pdf-doc');

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

/* Zona libre */
const btnModoZonaLibre        = document.getElementById('btn-modo-zona-libre');
const modalZonaLibre          = document.getElementById('modal-zona-libre');
const modalZonaLibreTitulo    = document.getElementById('modal-zona-libre-titulo');
const modalZonaLibreNombre    = document.getElementById('zona-libre-nombre');
const modalZonaLibreCeldas    = document.getElementById('zona-libre-celdas');
const modalZonaLibreAceptar   = document.getElementById('modal-zona-libre-aceptar');
const modalZonaLibreCancelar  = document.getElementById('modal-zona-libre-cancelar');
const coloresZonaLibreDiv     = document.getElementById('colores-zona-libre');

/* =========================================================
   TOOLTIP CUSTOM
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

    tooltipDiv.innerHTML = `
        <div class="tooltip-header">
            <span class="rol-badge" data-rol="${contenido.rol}">${contenido.rol}</span>
            <span class="hostname">${contenido.hostname}</span>
        </div>
        <div class="tooltip-body">
            <div class="tooltip-row">
                <span class="label">Tipo:</span>
                <span class="valor">${contenido.tipoIP}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">IP:</span>
                <span class="valor">${contenido.ip || 'DHCP (sin IP)'}</span>
            </div>
            <div class="tooltip-row">
                <span class="label">Posición:</span>
                <span class="valor">Fila ${contenido.fila}, Col ${contenido.col}</span>
            </div>
        </div>
    `;

    tooltipDiv.style.display = 'block';

    const x = ev.clientX + 16;
    const y = ev.clientY + 16;
    const rect = tooltipDiv.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    let posX = x;
    let posY = y;

    if (x + w > window.innerWidth - 12) posX = ev.clientX - w - 16;
    if (y + h > window.innerHeight - 12) posY = ev.clientY - h - 16;

    tooltipDiv.style.left = posX + 'px';
    tooltipDiv.style.top = posY + 'px';
}

function ocultarTooltip() {
    if (tooltipDiv) tooltipDiv.style.display = 'none';
}

/* =========================================================
   PANEL LATERAL COLAPSABLE
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

document.addEventListener('dragstart', (e) => {
    if (lateralBackdrop) lateralBackdrop.style.pointerEvents = 'none';
}, true);

document.addEventListener('dragend', (e) => {
    if (lateralBackdrop) {
        setTimeout(() => {
            lateralBackdrop.style.pointerEvents = 'auto';
        }, 100);
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
   MODAL DE CONFIRMACIÓN
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
   MODAL DE ZONA
   ========================================================= */

function renderColoresZona() {
    coloresZonaDiv.innerHTML = '';
    COLORES_DISPONIBLES.forEach(c => {
        const d = document.createElement('div');
        d.className = 'color-opcion' + (c === colorSeleccionado ? ' seleccionado' : '');
        d.style.background = c;
        d.addEventListener('click', () => {
            colorSeleccionado = c;
            renderColoresZona();
        });
        coloresZonaDiv.appendChild(d);
    });
}

function abrirModalZona(zona = null) {
    zonaEditando = zona;
    if (zona) {
        modalZonaTitulo.textContent = 'Editar zona';
        modalZonaNombre.value = zona.Nombre;
        colorSeleccionado = zona.Color || COLORES_DISPONIBLES[0];
        modalZonaRango.textContent = `Rango: fila ${zona.FilaInicio}-${zona.FilaFin}, columna ${zona.ColumnaInicio}-${zona.ColumnaFin}`;
    } else {
        modalZonaTitulo.textContent = 'Nueva zona';
        modalZonaNombre.value = '';
        colorSeleccionado = COLORES_DISPONIBLES[0];
        if (seleccionZona) {
            modalZonaRango.textContent = `Rango: fila ${seleccionZona.filaInicio}-${seleccionZona.filaFin}, columna ${seleccionZona.colInicio}-${seleccionZona.colFin}`;
        } else {
            modalZonaRango.textContent = 'Sin selección';
        }
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
});

modalZonaAceptar.addEventListener('click', async () => {
    const nombre = modalZonaNombre.value.trim();
    if (!nombre) {
        alert('El nombre es obligatorio.');
        modalZonaNombre.focus();
        return;
    }
    if (!panelActivo.idLugar) {
        alert('Selecciona un piso en el panel activo.');
        return;
    }

    try {
        if (zonaEditando) {
            await window.api.plano.actualizarZona(
                zonaEditando.IdZona, nombre, colorSeleccionado,
                zonaEditando.FilaInicio, zonaEditando.FilaFin,
                zonaEditando.ColumnaInicio, zonaEditando.ColumnaFin,
                panelActivo.idLugar
            );
        } else {
            if (!seleccionZona) {
                alert('Primero selecciona un rango de celdas.');
                return;
            }
            await window.api.plano.crearZona(
                panelActivo.idLugar, nombre, colorSeleccionado,
                seleccionZona.filaInicio, seleccionZona.filaFin,
                seleccionZona.colInicio, seleccionZona.colFin
            );
        }
    } catch (err) {
        alert('Error al guardar zona: ' + err.message);
        return;
    }

    modalZona.style.display = 'none';
    zonaEditando = null;
    seleccionZona = null;
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
        d.addEventListener('click', () => {
            colorSeleccionadoLibre = c;
            renderColoresZonaLibre();
        });
        coloresZonaLibreDiv.appendChild(d);
    });
}

function abrirModalZonaLibre() {
    if (guardandoZonaLibre) return; // 🔧 FIX: evitar doble apertura
    if (celdasLibresSeleccionadas.length === 0) {
        alert('Primero selecciona una o más celdas vacías.');
        return;
    }

    // 🔧 FIX: mantener estado consistente
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
    guardandoZonaLibre = false; // 🔧 FIX
    celdasLibresSeleccionadas = [];
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

modalZonaLibreAceptar.addEventListener('click', async () => {
    if (!guardandoZonaLibre) return; // 🔧 FIX: evitar doble submit

    const nombre = modalZonaLibreNombre.value.trim();
    if (!nombre) {
        alert('El texto es obligatorio.');
        modalZonaLibreNombre.focus();
        return;
    }
    if (!panelActivo.idLugar) {
        alert('Selecciona un piso primero.');
        return;
    }
    if (celdasLibresSeleccionadas.length === 0) {
        alert('No hay celdas seleccionadas.');
        return;
    }

    // 🔧 FIX: bloquear botón mientras guarda para evitar duplicados
    modalZonaLibreAceptar.disabled = true;

    try {
        await window.api.plano.guardarZonaLibre(
            panelActivo.idLugar, nombre, colorSeleccionadoLibre,
            celdasLibresSeleccionadas.slice() // 🔧 FIX: copia defensiva
        );
    } catch (err) {
        alert('Error al guardar: ' + err.message);
        modalZonaLibreAceptar.disabled = false;
        return;
    }

    modalZonaLibre.style.display = 'none';
    modalZonaLibreAceptar.disabled = false;
    guardandoZonaLibre = false; // 🔧 FIX
    celdasLibresSeleccionadas = [];
    await recargarPanel(panelActivo);
});

/* =========================================================
   NAVEGACIÓN
   ========================================================= */

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

/* =========================================================
   CAMBIO DE MODO
   ========================================================= */

selectModo.addEventListener('change', () => {
    const doble = selectModo.value === 'doble';
    panelDerDiv.style.display = doble ? 'flex' : 'none';
    contenedorPrincipal.classList.toggle('solo-simple', !doble);

    if (doble && !panelDer.idLugar && panelIzq.idCliente) {
        cargarLugaresPanel(panelDer, panelIzq.idCliente, false);
    }
});

/* =========================================================
   MODO ZONA
   ========================================================= */

btnModoZona.addEventListener('click', () => {
    modoZona = !modoZona;

    // Apagar modo zona libre
    if (modoZona && modoZonaLibre) {
        modoZonaLibre = false;
        btnModoZonaLibre.classList.remove('activo');
        btnModoZonaLibre.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <path d="M4 20h16M4 4h16v16"/>
                <path d="M9 4v16M4 9h16"/>
            </svg>
            Modo Zona Libre`;
        celdasLibresSeleccionadas = [];
        [gridIzq, gridDer].forEach(g => { if (g) g.classList.remove('modo-zona-libre'); });
    }

    if (modoZona) {
        btnModoZona.classList.add('activo');
        btnModoZona.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
            </svg>
            Modo Zona (activo)`;
        btnLimpiarSeleccion.style.display = 'inline-block';
        seleccionZona = null;
    } else {
        btnModoZona.classList.remove('activo');
        btnModoZona.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
            </svg>
            Modo Zona`;
        btnLimpiarSeleccion.style.display = 'none';
        seleccionZona = null;
        celdaInicioSeleccion = null;
    }
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

btnLimpiarSeleccion.addEventListener('click', () => {
    seleccionZona = null;
    celdaInicioSeleccion = null;
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

/* =========================================================
   MODO ZONA LIBRE
   ========================================================= */

btnModoZonaLibre.addEventListener('click', () => {
    modoZonaLibre = !modoZonaLibre;

    // Apagar modo zona normal
    if (modoZonaLibre && modoZona) {
        modoZona = false;
        btnModoZona.classList.remove('activo');
        btnModoZona.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
            </svg>
            Modo Zona`;
        btnLimpiarSeleccion.style.display = 'none';
        seleccionZona = null;
        celdaInicioSeleccion = null;
    }

    if (modoZonaLibre) {
        btnModoZonaLibre.classList.add('activo');
        btnModoZonaLibre.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <path d="M4 20h16M4 4h16v16"/>
                <path d="M9 4v16M4 9h16"/>
            </svg>
            Modo Zona Libre (activo)`;
        celdasLibresSeleccionadas = [];
    } else {
        btnModoZonaLibre.classList.remove('activo');
        btnModoZonaLibre.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <path d="M4 20h16M4 4h16v16"/>
                <path d="M9 4v16M4 9h16"/>
            </svg>
            Modo Zona Libre`;
        celdasLibresSeleccionadas = [];
    }

    [gridIzq, gridDer].forEach(g => {
        if (g) g.classList.toggle('modo-zona-libre', modoZonaLibre);
    });

    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

/* =========================================================
   CARGA DE CLIENTES Y LUGARES
   ========================================================= */

async function cargarClientes() {
    clientes = await window.api.clientes.listar();
    llenarSelectCliente(selectClienteIzq);
    llenarSelectCliente(selectClienteDer);
}

function llenarSelectCliente(select) {
    select.innerHTML = '<option value="">-- Todos --</option>';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.IdCliente;
        opt.textContent = `${c.Codigo} - ${c.Nombre}`;
        select.appendChild(opt);
    });
}

async function cargarLugaresPanel(panel, idCliente, seleccionarPrimero) {
    const todos = await window.api.lugares.listar();
    lugares = todos;

    const filtrados = idCliente
        ? todos.filter(l => Number(l.IdCliente) === Number(idCliente))
        : todos;

    const select = panel.sufijo === 'izq' ? selectLugarIzq : selectLugarDer;
    select.innerHTML = '<option value="">-- Piso --</option>';
    filtrados.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.IdLugarCliente;
        opt.textContent = l.Nombre;
        select.appendChild(opt);
    });

    if (seleccionarPrimero && filtrados.length > 0) {
        select.value = filtrados[0].IdLugarCliente;
        panel.idLugar = filtrados[0].IdLugarCliente;
        await cargarPanel(panel);
    }
}

/* =========================================================
   EVENTOS DE PANELES
   ========================================================= */

function conectarEventosPanel(panel, selectCliente, selectLugar, inputFilas, inputColumnas, btnAplicar) {
    selectCliente.addEventListener('change', async () => {
        panel.idCliente = parseInt(selectCliente.value, 10) || null;
        await cargarLugaresPanel(panel, panel.idCliente, false);
        panel.idLugar = null;
        limpiarPanel(panel);
    });

    selectLugar.addEventListener('change', async () => {
        panel.idLugar = parseInt(selectLugar.value, 10) || null;
        panelActivo = panel;
        if (panel.idLugar) {
            await cargarPanel(panel);
            renderPanelLateral();
        } else {
            limpiarPanel(panel);
        }
    });

    btnAplicar.addEventListener('click', async () => {
        if (!panel.idLugar) {
            alert('Selecciona un piso primero.');
            return;
        }
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

        mostrarConfirmacion(
            'Cambiar dimensiones',
            contenidoModal,
            async () => {
                const res = await window.api.plano.actualizarDim(panel.idLugar, nuevasFilas, nuevasColumnas);
                await recargarPanel(panel);

                if (res && res.expulsados && res.expulsados.length > 0) {
                    const nombres = res.expulsados.map(e => e.Hostname).join(', ');
                    setTimeout(() => {
                        alert(`Se regresaron ${res.expulsados.length} equipo(s) a la lista:\n\n${nombres}`);
                    }, 200);
                }
            }
        );
    });
}

conectarEventosPanel(panelIzq, selectClienteIzq, selectLugarIzq, inputFilasIzq, inputColumnasIzq,
    document.getElementById('btn-aplicar-dim-izq'));
conectarEventosPanel(panelDer, selectClienteDer, selectLugarDer, inputFilasDer, inputColumnasDer,
    document.getElementById('btn-aplicar-dim-der'));

/* =========================================================
   CARGA DE UN PANEL
   ========================================================= */

async function cargarPanel(panel) {
    if (!panel.idLugar) return;

    panel.dimensiones = await window.api.plano.dimensiones(panel.idLugar);

    const inputFilas = panel.sufijo === 'izq' ? inputFilasIzq : inputFilasDer;
    const inputColumnas = panel.sufijo === 'izq' ? inputColumnasIzq : inputColumnasDer;
    inputFilas.value = panel.dimensiones.Filas;
    inputColumnas.value = panel.dimensiones.Columnas;

    panel.celdas = Array.from({ length: panel.dimensiones.Filas }, () =>
        Array.from({ length: panel.dimensiones.Columnas }, () => null)
    );

    const ubicaciones = await window.api.plano.listarPorLugar(panel.idLugar);
    ubicaciones.forEach(u => {
        const f = u.Fila - 1;
        const c = u.Columna - 1;
        if (panel.celdas[f] && panel.celdas[f][c] !== undefined) {
            panel.celdas[f][c] = {
    IdEquipo: u.IdEquipo,
    IdCliente: u.IdCliente,
    Hostname: u.Hostname,
    TipoIP: u.TipoIP,
    IP: u.IP,
    Mascara: u.Mascara,
    PuertaEnlace: u.PuertaEnlace,
    DNS1: u.DNS1,
    DNS2: u.DNS2,
    UsuarioAdmin: u.UsuarioAdmin,
    PasswordAdmin: u.PasswordAdmin,
    RolCodigo: u.RolCodigo,
    _fila: u.Fila,
    _col: u.Columna
};
        }
    });

    panel.equiposSinUbicar = await window.api.plano.sinUbicacion(panel.idLugar);
    panel.zonas = await window.api.plano.listarZonas(panel.idLugar);
    panel.zonasLibres = await window.api.plano.listarZonasLibres(panel.idLugar);

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

    const grid = panel.sufijo === 'izq' ? gridIzq : gridDer;
    const llaves = panel.sufijo === 'izq' ? llavesIzq : llavesDer;
    grid.innerHTML = '';
    llaves.innerHTML = '';

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
   SVG ICONO PC
   ========================================================= */

const SVG_PC = `
    <svg class="icono-pc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
`;

/* =========================================================
   RENDER DEL GRID
   ========================================================= */

function renderGridPanel(panel) {
    const grid = panel.sufijo === 'izq' ? gridIzq : gridDer;
    const llaves = panel.sufijo === 'izq' ? llavesIzq : llavesDer;
    if (!grid) return;

    grid.innerHTML = '';
    llaves.innerHTML = '';

    if (!panel.dimensiones.Filas) return;

    grid.style.gridTemplateColumns = `repeat(${panel.dimensiones.Columnas}, 1fr)`;

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

            // Aplicar color de zona libre SOLO si la celda NO tiene equipo
            if (zl && !contenido) {
                celda.classList.add('celda-libre');
                celda.style.backgroundColor = zl.Color;
            }

            // Marcar selección en modo zona
            if (seleccionZona && panel === panelActivo && enSeleccion(fila, columna)) {
                celda.classList.add('seleccionada');
            }

            // Marcar selección en modo zona libre
            if (modoZonaLibre && panel === panelActivo) {
                const estaSeleccionada = celdasLibresSeleccionadas.some(
                    c => c.fila === fila && c.columna === columna
                );
                if (estaSeleccionada) {
                    celda.classList.add('seleccionada');
                }
            }

            if (contenido) {
                celda.innerHTML = `
                    <button class="cerrar" data-id="${contenido.IdEquipo}">✕</button>
                    ${SVG_PC}
                `;

                celda.addEventListener('mouseenter', (ev) => {
                    if (modoZona || modoZonaLibre) return;
                    mostrarTooltip(ev, {
                        hostname: contenido.Hostname,
                        rol: contenido.RolCodigo || '',
                        tipoIP: contenido.TipoIP,
                        ip: contenido.IP,
                        fila,
                        col: columna
                    });
                });
                celda.addEventListener('mousemove', (ev) => {
                    if (modoZona || modoZonaLibre) return;
                    if (tooltipDiv && tooltipDiv.style.display === 'block') {
                        mostrarTooltip(ev, {
                            hostname: contenido.Hostname,
                            rol: contenido.RolCodigo || '',
                            tipoIP: contenido.TipoIP,
                            ip: contenido.IP,
                            fila,
                            col: columna
                        });
                    }
                });
                celda.addEventListener('mouseleave', ocultarTooltip);

                if (!modoZona && !modoZonaLibre) {
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
                celda.querySelector('.cerrar').addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (!modoZona && !modoZonaLibre) confirmarQuitar(contenido, panel);
                });
            }

            if (!modoZona && !modoZonaLibre) {
                celda.addEventListener('dragover', (ev) => {
                    if (dragOrigen) {
                        ev.preventDefault();
                        celda.classList.add('destino');
                    }
                });
                celda.addEventListener('dragleave', () => {
                    celda.classList.remove('destino');
                });
                celda.addEventListener('drop', async (ev) => {
                    ev.preventDefault();
                    celda.classList.remove('destino');
                    await manejarDrop(panel, fila, columna);
                });
            }

            // Modo zona normal: selección por arrastre
            if (modoZona && panel === panelActivo) {
                celda.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    seleccionando = true;
                    celdaInicioSeleccion = { fila, columna };
                    seleccionZona = { filaInicio: fila, colInicio: columna, filaFin: fila, colFin: columna };
                    renderGridPanel(panel);
                });
                celda.addEventListener('mouseenter', () => {
                    if (seleccionando && celdaInicioSeleccion) {
                        const a = celdaInicioSeleccion;
                        seleccionZona = {
                            filaInicio: Math.min(a.fila, fila),
                            filaFin: Math.max(a.fila, fila),
                            colInicio: Math.min(a.columna, columna),
                            colFin: Math.max(a.columna, columna)
                        };
                        renderGridPanel(panel);
                    }
                });
                celda.addEventListener('mouseup', () => {
                    seleccionando = false;
                });
            }

            // Modo zona libre: toggle por clic en celdas vacías
            // 🔧 FIX: ya NO abre el modal aquí. Solo toglea la selección.
            if (modoZonaLibre && panel === panelActivo) {
                celda.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();

                    if (contenido) return; // Solo celdas vacías

                    const idx = celdasLibresSeleccionadas.findIndex(
                        c => c.fila === fila && c.columna === columna
                    );

                    if (idx >= 0) {
                        celdasLibresSeleccionadas.splice(idx, 1);
                        celda.classList.remove('seleccionada');
                    } else {
                        celdasLibresSeleccionadas.push({ fila, columna });
                        celda.classList.add('seleccionada');
                    }

                    // 🔧 FIX: solo actualizar contador si el modal ya está abierto
                    if (modalZonaLibre.style.display === 'flex') {
                        modalZonaLibreCeldas.textContent =
                            `Celdas seleccionadas: ${celdasLibresSeleccionadas.length}`;
                    }
                });
            }

            grid.appendChild(celda);
        }
    }

    // Renderizar textos centrados en zonas libres
    renderizarTextosZonasLibres(panel);

    // Renderizar llaves de zonas (bloques)
    renderizarLlavesZonas(panel);
}

function enSeleccion(fila, columna) {
    if (!seleccionZona) return false;
    return fila >= seleccionZona.filaInicio && fila <= seleccionZona.filaFin &&
           columna >= seleccionZona.colInicio && columna <= seleccionZona.colFin;
}

document.addEventListener('mouseup', () => {
    if (seleccionando) {
        seleccionando = false;
        if (seleccionZona && modoZona) {
            abrirModalZona();
        }
    }
});

/* =========================================================
   RENDERIZAR TEXTOS DE ZONAS LIBRES
   ========================================================= */

function renderizarTextosZonasLibres(panel) {
    if (!panel.zonasLibres || panel.zonasLibres.length === 0) return;

    const gridEl = panel.sufijo === 'izq' ? gridIzq : gridDer;
    if (!gridEl) return;

    const wrapper = gridEl.closest('.grid-plano-wrapper');
    if (!wrapper) return;

    // 🔧 FIX: limpiar overlays previos de ESTE panel antes de redibujar
    wrapper.querySelectorAll('.texto-zona-libre-overlay').forEach(el => el.remove());

    // Agrupar por nombre+color
    const grupos = {};
    panel.zonasLibres.forEach(zl => {
        const key = `${zl.Nombre}||${zl.Color}`;
        if (!grupos[key]) {
            grupos[key] = {
                nombre: zl.Nombre,
                color: zl.Color,
                celdas: []
            };
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

        const celdaTL = gridEl.querySelector(
            `.celda[data-fila="${filaMin}"][data-columna="${colMin}"]`
        );
        const celdaBR = gridEl.querySelector(
            `.celda[data-fila="${filaMax}"][data-columna="${colMax}"]`
        );
        if (!celdaTL || !celdaBR) return;

        const gridRect = gridEl.getBoundingClientRect();
        const rectTL = celdaTL.getBoundingClientRect();
        const rectBR = celdaBR.getBoundingClientRect();

        const offsetX = rectTL.left - gridRect.left;
        const offsetY = rectTL.top - gridRect.top;
        const anchoTotal = (rectBR.right - rectTL.left);
        const altoTotal = (rectBR.bottom - rectTL.top);

        const totalFilas = filaMax - filaMin + 1;
        const totalCols = colMax - colMin + 1;
        const baseFontSize = Math.max(
            0.6,
            Math.min(1.5, 0.7 + Math.min(totalFilas, totalCols) * 0.08)
        );

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

        // 🔧 FIX: el wrapper tiene padding, entonces el offset debe restar
        // ese padding para posicionarse correctamente sobre el grid.
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
   RENDERIZAR LLAVES DE ZONA (tipo Google Charts)
   ========================================================= */

/* =========================================================
   RENDERIZAR LLAVES DE ZONA (tipo Google Charts)
   Lógica inteligente: si la mesa está en la mitad derecha
   del grid → llave a la derecha. Si está en la mitad
   izquierda → llave a la izquierda.
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

    // Ancho del grid en px
    const gridAnchoPx = gridRect.width;

    // Mitad del grid (para decidir lado)
    const mitadGrid = offsetX + gridAnchoPx / 2;

    // Espacio disponible a cada lado del wrapper
    const espacioDerecha = wrapperRect.width - (offsetX + gridRect.width);
    const espacioIzquierda = offsetX;

    // Si no hay suficiente espacio a la derecha, forzamos izquierda
    const forzarIzquierda = espacioDerecha < 30 && espacioIzquierda >= 30;

    const zonasOrdenadas = [...panel.zonas].sort((a, b) => a.FilaInicio - b.FilaInicio);

    // Trackear ocupación vertical por lado para no solapar llaves
    const ocupacionDerecha = [];
    const ocupacionIzquierda = [];

    zonasOrdenadas.forEach(zona => {
        const startFila = zona.FilaInicio - 1;
        const endFila = zona.FilaFin - 1;
        const endCol = zona.ColumnaFin - 1;

        // Y (vertical) del bloque
        const zonaY = offsetY + GRID_PADDING + startFila * (CELL_H + CELL_GAP);
        const zonaH = (endFila - startFila) * (CELL_H + CELL_GAP) + CELL_H;

        // X del extremo derecho del bloque
        const zonaXRight = offsetX + GRID_PADDING + (endCol + 1) * (CELL_W + CELL_GAP) - CELL_GAP;
        // X del extremo izquierdo del bloque
        const zonaXLeft = offsetX + GRID_PADDING + (zona.ColumnaInicio - 1) * (CELL_W + CELL_GAP);

        // Centro horizontal del bloque
        const centroBloque = (zonaXLeft + zonaXRight) / 2;

        // Decidir lado: si el centro está en la mitad derecha → derecha
        // Si está en la mitad izquierda → izquierda
        let lado;
        if (forzarIzquierda) {
            lado = 'izquierda';
        } else if (centroBloque >= mitadGrid) {
            lado = 'derecha';
        } else {
            lado = 'izquierda';
        }

        // Ajustar Y si hay solapamiento con otra llave en el mismo lado
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

/* =========================================================
   DIBUJAR UNA LLAVE (línea curva simple con etiqueta al final)
   ========================================================= */

function dibujarLlave(contenedor, opciones) {
    const { lado, x, y, h, color, nombre, zona } = opciones;

    const cont = document.createElement('div');
    cont.className = 'llave-zona';
    cont.style.position = 'absolute';

    // Geometría de la llave (línea con codo)
    const svgW = 20;         // ancho de la línea (codo horizontal)
    const svgH = Math.max(h, 30);

    let path;
    let svgLeft;

    if (lado === 'derecha') {
        // La llave sale desde x hacia la derecha
        svgLeft = x + 2;

        // Forma: línea vertical + codo hacia la derecha que apunta a la etiqueta
        // Empieza arriba del bloque, baja, hace un codo a la mitad
        path = `
            M 0 0
            L 0 ${svgH}
            M 0 ${svgH / 2}
            L ${svgW} ${svgH / 2}
        `;
    } else {
        // La llave sale desde x hacia la izquierda
        svgLeft = x - svgW - 2;

        path = `
            M ${svgW} 0
            L ${svgW} ${svgH}
            M ${svgW} ${svgH / 2}
            L 0 ${svgH / 2}
        `;
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

    // Etiqueta al final del codo
    const etiqueta = document.createElement('div');
    etiqueta.className = 'etiqueta-llave';
    etiqueta.style.position = 'absolute';
    etiqueta.style.top = '50%';
    etiqueta.style.transform = 'translateY(-50%)';
    etiqueta.style.borderColor = color;

    if (lado === 'derecha') {
        etiqueta.style.left = (svgW + 4) + 'px';
    } else {
        etiqueta.style.right = (svgW + 4) + 'px';
    }

    etiqueta.innerHTML = `
        <span class="punto-color" style="background:${color};"></span>
        ${nombre}
    `;

    etiqueta.addEventListener('click', () => abrirModalZona(zona));

    cont.appendChild(etiqueta);
    contenedor.appendChild(cont);
}

/* =========================================================
   DIBUJAR UNA LLAVE (línea curva simple con etiqueta al final)
   ========================================================= */

function dibujarLlave(contenedor, opciones) {
    const { lado, x, y, h, color, nombre, zona } = opciones;

    const cont = document.createElement('div');
    cont.className = 'llave-zona';
    cont.style.position = 'absolute';

    // Geometría de la llave (línea con codo)
    const svgW = 20;         // ancho de la línea (codo horizontal)
    const svgH = Math.max(h, 30);

    let path;
    let svgLeft;

    if (lado === 'derecha') {
        // La llave sale desde x hacia la derecha
        svgLeft = x + 2;

        // Forma: línea vertical + codo hacia la derecha que apunta a la etiqueta
        // Empieza arriba del bloque, baja, hace un codo a la mitad
        path = `
            M 0 0
            L 0 ${svgH}
            M 0 ${svgH / 2}
            L ${svgW} ${svgH / 2}
        `;
    } else {
        // La llave sale desde x hacia la izquierda
        svgLeft = x - svgW - 2;

        path = `
            M ${svgW} 0
            L ${svgW} ${svgH}
            M ${svgW} ${svgH / 2}
            L 0 ${svgH / 2}
        `;
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

    // Etiqueta al final del codo
    const etiqueta = document.createElement('div');
    etiqueta.className = 'etiqueta-llave';
    etiqueta.style.position = 'absolute';
    etiqueta.style.top = '50%';
    etiqueta.style.transform = 'translateY(-50%)';
    etiqueta.style.borderColor = color;

    if (lado === 'derecha') {
        etiqueta.style.left = (svgW + 4) + 'px';
    } else {
        etiqueta.style.right = (svgW + 4) + 'px';
    }

    etiqueta.innerHTML = `
        <span class="punto-color" style="background:${color};"></span>
        ${nombre}
    `;

    etiqueta.addEventListener('click', () => abrirModalZona(zona));

    cont.appendChild(etiqueta);
    contenedor.appendChild(cont);
}

/* =========================================================
   PANEL LATERAL
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
                id: e.IdCliente,
                codigo: e.ClienteCodigo,
                nombre: e.ClienteNombre,
                total: 0
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
        equipos = equipos.filter(e =>
            e.Hostname.toLowerCase().includes(filtroBusquedaLateral)
        );
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
        const pisoNom = lugares.find(l => Number(l.IdLugarCliente) === Number(e.IdLugarCliente))?.Nombre
                       || `Piso ${e.IdLugarCliente || '?'}`;

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
                setTimeout(() => {
                    lateralBackdrop.style.pointerEvents = 'auto';
                }, 100);
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

    zonasNormales.forEach(z => {
        const li = document.createElement('li');

        const colorDiv = document.createElement('div');
        colorDiv.className = 'muestra-color';
        colorDiv.style.background = z.Color || '#ccc';

        const nombreSpan = document.createElement('span');
        nombreSpan.className = 'nombre-zona';
        nombreSpan.textContent = z.Nombre;

        const btnEditar = document.createElement('button');
        btnEditar.textContent = 'Editar';
        btnEditar.className = 'secundario';
        btnEditar.addEventListener('click', () => abrirModalZona(z));

        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.className = 'peligro';
        btnEliminar.addEventListener('click', () => {
            mostrarConfirmacion(
                'Eliminar zona',
                `¿Eliminar la zona "${z.Nombre}"? Los equipos permanecerán en sus posiciones.`,
                async () => {
                    await window.api.plano.eliminarZona(z.IdZona, panelActivo.idLugar, z.Nombre);
                    await recargarPanel(panelActivo);
                }
            );
        });

        li.appendChild(colorDiv);
        li.appendChild(nombreSpan);
        li.appendChild(btnEditar);
        li.appendChild(btnEliminar);

        listaZonas.appendChild(li);
    });

    if (zonasLibres.length > 0) {
        const grupos = {};
        zonasLibres.forEach(zl => {
            const key = `${zl.Nombre}||${zl.Color}`;
            if (!grupos[key]) {
                grupos[key] = { nombre: zl.Nombre, color: zl.Color, celdas: [] };
            }
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
                        await window.api.plano.eliminarZonaLibre(panelActivo.idLugar, g.nombre, g.color);
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
                        await window.api.plano.quitar(contenidoDestino.IdEquipo, panelDestino.idLugar, contenidoDestino.Hostname);
                        await window.api.plano.asignar(panelDestino.idLugar, equipo.IdEquipo, filaDestino, columnaDestino);
                        await recargarPanel(panelDestino);
                    }
                );
            } else {
                mostrarConfirmacion(
                    'Asignar equipo',
                    `¿Colocar <b>${equipo.Hostname}</b> en la celda (${filaDestino}, ${columnaDestino})?`,
                    async () => {
                        await window.api.plano.asignar(panelDestino.idLugar, equipo.IdEquipo, filaDestino, columnaDestino);
                        await recargarPanel(panelDestino);
                    }
                );
            }
        } else {
            if (!panelDestino.idLugar) {
                alert('Selecciona un piso en el panel destino primero.');
                return;
            }

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
                            origen.fila, origen.columna, panelDestino.idLugar
                        );
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
                            equipoOrigen.IdEquipo, contenidoDestino.IdEquipo, panelDestino.idLugar,
                            equipoOrigen.Hostname, contenidoDestino.Hostname,
                            origen.fila, origen.columna, filaDestino, columnaDestino
                        );
                        await recargarPanel(panelDestino);
                    }
                );
            }
            return;
        }

        if (!panelDestino.idLugar) {
            alert('Selecciona un piso en el panel destino primero.');
            return;
        }

        if (contenidoDestino) {
            abrirModalMoverEntrePisos({
                idEquipo: equipoOrigen.IdEquipo,
                panelOrigen,
                panelDestino,
                fila: filaDestino,
                columna: columnaDestino,
                equipoInfo: equipoOrigen,
                conSwap: true,
                equipoDestino: contenidoDestino,
                filaOrigen: origen.fila,
                columnaOrigen: origen.columna
            });
        } else {
            abrirModalMoverEntrePisos({
                idEquipo: equipoOrigen.IdEquipo,
                panelOrigen,
                panelDestino,
                fila: filaDestino,
                columna: columnaDestino,
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

    const lugarOrigen = lugares.find(l => Number(l.IdLugarCliente) === Number(panelOrigen.idLugar));
    const lugarDestino = lugares.find(l => Number(l.IdLugarCliente) === Number(panelDestino.idLugar));

    let infoHTML = `
        <div><b>Equipo:</b> ${equipoInfo.Hostname}</div>
        <div><b>Desde:</b> ${lugarOrigen?.Nombre ?? 'Piso ' + panelOrigen.idLugar}${datos.filaOrigen ? ' (fila ' + datos.filaOrigen + ', col ' + datos.columnaOrigen + ')' : ''}</div>
        <div><b>Hacia:</b> ${lugarDestino?.Nombre ?? 'Piso ' + panelDestino.idLugar}, celda (${fila}, ${columna})</div>
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

    if (lugarDestino) {
        mvLugar.innerHTML = `<option value="${lugarDestino.IdLugarCliente}">${lugarDestino.Nombre}</option>`;
        mvLugar.value = lugarDestino.IdLugarCliente;
    } else {
        mvLugar.innerHTML = `<option value="${panelDestino.idLugar}">Piso ${panelDestino.idLugar}</option>`;
        mvLugar.value = panelDestino.idLugar;
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
                idPisoA: panelOrigen.idLugar,
                filaA: filaOrigen,
                colA: columnaOrigen,
                idPisoB: panelDestino.idLugar,
                filaB: fila,
                colB: columna,
                hostA: datos.equipoInfo.Hostname,
                hostB: equipoDestino.Hostname
            });

            if (!res || !res.ok) {
                mostrarMensajeMover(res?.mensaje || 'No se pudo intercambiar.', 'error');
                return;
            }
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
                    await window.api.plano.quitar(equipoDestino.IdEquipo, panelDestino.idLugar, equipoDestino.Hostname);
                }
                const res = await window.api.plano.asignar(panelDestino.idLugar, idEquipo, fila, columna);

                if (nuevosDatos) {
                    await window.api.equipos.actualizar(idEquipo, {
                        ...nuevosDatos,
                        idLugarCliente: panelDestino.idLugar,
                        activo: true
                    });
                }

                if (!res || !res.ok) {
                    mostrarMensajeMover(res?.mensaje || 'No se pudo asignar.', 'error');
                    return;
                }
            } else {
                const res = await window.api.plano.moverEntrePisos(
                    idEquipo, panelOrigen.idLugar, panelDestino.idLugar, fila, columna, nuevosDatos
                );

                if (!res || !res.ok) {
                    mostrarMensajeMover(res?.mensaje || 'No se pudo mover.', 'error');
                    return;
                }
            }
        }

        modalMover.style.display = 'none';
        moverPendiente = null;

        await recargarPanel(panelOrigen);
        await recargarPanel(panelDestino);

    } catch (err) {
        console.error(err);
        mostrarMensajeMover('Error: ' + err.message, 'error');
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

    mvCliente.value = eq.IdCliente;
    mvRol.value = eq.IdRolEquipo;
    mvTipoIP.value = eq.TipoIP;
    mvHostname.value = eq.Hostname;
    mvIP.value = eq.IP ?? '';
    mvMascara.value = eq.Mascara ?? '';
    mvPuerta.value = eq.PuertaEnlace ?? '';
    mvDns1.value = eq.DNS1 ?? '';
    mvDns2.value = eq.DNS2 ?? '';
    mvUsuario.value = eq.UsuarioAdmin ?? '';
    mvPassword.value = eq.PasswordAdmin ?? '';
}

/* =========================================================
   QUITAR EQUIPO
   ========================================================= */

function confirmarQuitar(equipo, panel) {
    mostrarConfirmacion(
        'Quitar del plano',
        `¿Quitar <b>${equipo.Hostname}</b> del plano?<br><br>El equipo seguirá existiendo en el sistema, solo se eliminará su ubicación física.`,
        async () => {
            await window.api.plano.quitar(equipo.IdEquipo, panel.idLugar, equipo.Hostname);
            await recargarPanel(panel);
        }
    );
}

/* =========================================================
   EXPORTAR PDF — VISUAL
   ========================================================= */

btnExportarPDF.addEventListener('click', async () => {
    if (!panelActivo.idLugar) {
        alert('Selecciona un piso primero.');
        return;
    }

    try {
        btnExportarPDF.disabled = true;
        const original = btnExportarPDF.innerHTML;
        btnExportarPDF.innerHTML = 'Generando...';

        const opciones = generarPDFVisual(panelActivo);
        const res = await window.api.plano.exportarPDF(opciones);

        if (res.ok) {
            alert('✅ PDF Visual generado en:\n\n' + res.ruta);
        } else {
            alert('Generación cancelada.');
        }

        btnExportarPDF.disabled = false;
        btnExportarPDF.innerHTML = original;
    } catch (err) {
        alert('Error al generar PDF: ' + err.message);
        btnExportarPDF.disabled = false;
    }
});

function generarPDFVisual(panel) {
    const lugar = lugares.find(l => Number(l.IdLugarCliente) === Number(panel.idLugar));
    const cliente = clientes.find(c => Number(c.IdCliente) === Number(panel.idCliente)) ||
                    clientes.find(c => panel.equiposSinUbicar.some(e => Number(e.IdCliente) === Number(c.IdCliente)));

    const nombreCliente = cliente ? `${cliente.Codigo} · ${cliente.Nombre}` : '';
    const nombrePiso = lugar ? lugar.Nombre : '';
    const fecha = new Date().toLocaleString('es-MX');

    /* ---------------------------------------------------------
       Tamaño de celda del PDF (se puede ajustar)
       --------------------------------------------------------- */
    const CELL_W_PDF   = 110;
    const CELL_H_PDF   = 85;
    const GAP          = 6;
    const GRID_PADDING = 28;
    const BODY_PADDING = 40;

    const cols = panel.dimensiones.Columnas;
    const filas = panel.dimensiones.Filas;

    /* Ancho/alto total del grid en px */
    const gridW = cols * CELL_W_PDF + (cols - 1) * GAP + GRID_PADDING * 2;
    const gridH = filas * CELL_H_PDF + (filas - 1) * GAP + GRID_PADDING * 2;

    /* Ancho total de la hoja. Se genera una hoja del tamaño del contenido
       así nunca se corta y siempre cabe todo. */
    const totalW = gridW + BODY_PADDING * 2;
    const totalH = gridH + BODY_PADDING * 2 + 200; /* 200px extra para el encabezado + leyenda */

    /* ---------------------------------------------------------
       MAPA de zonas libres por celda
       --------------------------------------------------------- */
    const zonasLibresMap = new Map();
    (panel.zonasLibres || []).forEach(zl => {
        zonasLibresMap.set(`${zl.Fila}-${zl.Columna}`, zl);
    });

    /* ---------------------------------------------------------
       AGRUPAR zonas libres por nombre+color para el overlay de texto
       --------------------------------------------------------- */
    const gruposLibres = {};
    (panel.zonasLibres || []).forEach(zl => {
        const key = `${zl.Nombre}||${zl.Color}`;
        if (!gruposLibres[key]) {
            gruposLibres[key] = { nombre: zl.Nombre, color: zl.Color, celdas: [] };
        }
        gruposLibres[key].celdas.push({ fila: zl.Fila, columna: zl.Columna });
    });

    /* ---------------------------------------------------------
       RENDERIZAR celdas
       --------------------------------------------------------- */
    let celdasHTML = '';
    for (let f = 0; f < filas; f++) {
        for (let c = 0; c < cols; c++) {
            const fila = f + 1;
            const col = c + 1;
            const contenido = panel.celdas[f]?.[c];
            const zl = zonasLibresMap.get(`${fila}-${col}`);

            let styleCelda = '';
            if (zl && !contenido) {
                styleCelda = `background:${zl.Color};border-color:rgba(0,0,0,0.15);border-style:solid;`;
            }

            if (contenido) {
                const ip = contenido.IP || 'DHCP';
                const rol = contenido.RolCodigo || '';
                celdasHTML += `
                    <div class="celda ocupada" data-rol="${rol}">
                        <div class="hostname">${contenido.Hostname}</div>
                        <div class="ip">${ip}</div>
                    </div>
                `;
            } else {
                celdasHTML += `<div class="celda ${zl ? 'libre' : 'vacia'}" style="${styleCelda}"></div>`;
            }
        }
    }

    /* ---------------------------------------------------------
       OVERLAYS de texto de zonas libres (posicionados en absoluto)
       --------------------------------------------------------- */
    let overlaysLibresHTML = '';
    Object.values(gruposLibres).forEach(g => {
        const filasArr = g.celdas.map(c => c.fila);
        const colsArr = g.celdas.map(c => c.columna);
        const filaMin = Math.min(...filasArr);
        const filaMax = Math.max(...filasArr);
        const colMin = Math.min(...colsArr);
        const colMax = Math.max(...colsArr);

        const x = (colMin - 1) * (CELL_W_PDF + GAP);
        const y = (filaMin - 1) * (CELL_H_PDF + GAP);
        const w = (colMax - colMin + 1) * (CELL_W_PDF + GAP) - GAP;
        const h = (filaMax - filaMin + 1) * (CELL_H_PDF + GAP) - GAP;

        const totalFilas = filaMax - filaMin + 1;
        const totalCols = colMax - colMin + 1;
        const fontSize = Math.max(0.7, Math.min(1.4, 0.75 + Math.min(totalFilas, totalCols) * 0.08));

        overlaysLibresHTML += `
            <div class="overlay-zona-libre" style="
                position:absolute;
                left:${x + GRID_PADDING}px;
                top:${y + GRID_PADDING}px;
                width:${w}px;
                height:${h}px;
                display:flex;
                align-items:center;
                justify-content:center;
                text-align:center;
                font-weight:700;
                font-size:${fontSize}rem;
                color:#1e293b;
                text-transform:uppercase;
                letter-spacing:0.05em;
                text-shadow:0 1px 2px rgba(255,255,255,0.7);
                pointer-events:none;
                padding:4px;
                line-height:1.1;
                word-break:break-word;
                z-index:5;
            ">${g.nombre}</div>
        `;
    });

    /* ---------------------------------------------------------
       MARCOS PUNTEADOS de las MESAS (zonas normales)
       NO tocan los colores de las celdas, solo dibujan un borde
       por encima con la etiqueta del nombre.
       --------------------------------------------------------- */
    let mesasHTML = '';
    (panel.zonas || []).forEach(z => {
        const filaMin = z.FilaInicio;
        const filaMax = z.FilaFin;
        const colMin = z.ColumnaInicio;
        const colMax = z.ColumnaFin;

        const x = (colMin - 1) * (CELL_W_PDF + GAP);
        const y = (filaMin - 1) * (CELL_H_PDF + GAP);
        const w = (colMax - colMin + 1) * (CELL_W_PDF + GAP) - GAP;
        const h = (filaMax - filaMin + 1) * (CELL_H_PDF + GAP) - GAP;

        const color = z.Color || '#3b82f6';

        mesasHTML += `
            <div class="mesa-pdf" style="
                position:absolute;
                left:${x + GRID_PADDING}px;
                top:${y + GRID_PADDING}px;
                width:${w}px;
                height:${h}px;
                border:3px dashed ${color};
                border-radius:10px;
                pointer-events:none;
                box-sizing:border-box;
                z-index:6;
            ">
                <span class="etiqueta-mesa" style="
                    position:absolute;
                    top:-12px;
                    left:10px;
                    background:${color};
                    color:#fff;
                    font-size:0.72rem;
                    font-weight:700;
                    padding:2px 8px;
                    border-radius:4px;
                    letter-spacing:0.03em;
                    text-transform:uppercase;
                    white-space:nowrap;
                    box-shadow:0 1px 3px rgba(0,0,0,0.2);
                ">${z.Nombre}</span>
            </div>
        `;
    });

    /* ---------------------------------------------------------
       CSS
       --------------------------------------------------------- */
    const css = `
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* 🔧 FIX: la hoja se genera del tamaño exacto del contenido.
           Así nunca se corta y el plano siempre cabe completo. */
        @page {
            size: ${totalW}px ${totalH}px;
            margin: 0;
        }

        body {
            font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: #fff;
            color: #1e293b;
            padding: ${BODY_PADDING}px;
            width: ${totalW}px;
            min-height: ${totalH}px;
        }

        .encabezado {
            text-align: center;
            padding-bottom: 16px;
            border-bottom: 3px solid #1e293b;
            margin-bottom: 20px;
        }
        .encabezado h1 { font-size: 1.8rem; color: #1e293b; margin-bottom: 6px; }
        .encabezado .sub { font-size: 1rem; color: #64748b; margin-bottom: 4px; }
        .encabezado .fecha { font-size: 0.78rem; color: #94a3b8; }

        /* 🔧 FIX: el wrapper del grid es relative para contener
           los overlays de zonas libres y los marcos de mesas. */
        .grid-plano {
            display: grid;
            grid-template-columns: repeat(${cols}, ${CELL_W_PDF}px);
            grid-template-rows: repeat(${filas}, ${CELL_H_PDF}px);
            gap: ${GAP}px;
            background: #e2e8f0;
            padding: ${GRID_PADDING}px;
            border-radius: 10px;
            border: 2px solid #cbd5e1;
            width: fit-content;
            margin: 0 auto;
            position: relative;
        }

        .celda {
            width: ${CELL_W_PDF}px;
            height: ${CELL_H_PDF}px;
            background: #fff;
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 4px;
        }
        .celda.ocupada { border-style: solid; border-width: 2px; }
        .celda.libre { border-style: solid; border-width: 1px; }
        .celda .hostname { font-weight: 700; font-size: 0.78rem; line-height: 1.15; word-break: break-all; }
        .celda .ip { font-size: 0.68rem; margin-top: 4px; color: #475569; font-weight: 500; }

        .celda[data-rol="AGT"] { background: #dbeafe; border-color: #3b82f6; }
        .celda[data-rol="SPR"] { background: #dcfce7; border-color: #22c55e; }
        .celda[data-rol="CLD"] { background: #ffedd5; border-color: #f97316; }
        .celda[data-rol="GRN"] { background: #f3e8ff; border-color: #a855f7; }
        .celda[data-rol="CRD"] { background: #ccfbf1; border-color: #14b8a6; }
        .celda[data-rol="MIS"] { background: #fce7f3; border-color: #ec4899; }
        .celda[data-rol="ADM"] { background: #e2e8f0; border-color: #475569; }

        .celda[data-rol="AGT"] .hostname { color: #1e40af; }
        .celda[data-rol="SPR"] .hostname { color: #166534; }
        .celda[data-rol="CLD"] .hostname { color: #9a3412; }
        .celda[data-rol="GRN"] .hostname { color: #6b21a8; }
        .celda[data-rol="CRD"] .hostname { color: #115e59; }
        .celda[data-rol="MIS"] .hostname { color: #9d174d; }
        .celda[data-rol="ADM"] .hostname { color: #1e293b; }

        .leyenda-pdf {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
            padding-top: 16px;
            margin-top: 20px;
            border-top: 2px solid #e2e8f0;
        }
        .leyenda-pdf .item { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #334155; font-weight: 600; }
        .leyenda-pdf .punto { width: 14px; height: 14px; border-radius: 3px; }
    `;

    /* ---------------------------------------------------------
       HTML final
       --------------------------------------------------------- */
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${css}</style>
        </head>
        <body>
            <div class="encabezado">
                <h1>Plano de Equipos</h1>
                <div class="sub">${nombreCliente}${nombrePiso ? ' · ' + nombrePiso : ''}</div>
                <div class="fecha">Generado: ${fecha}</div>
            </div>
            <div class="grid-plano">
                ${celdasHTML}
                ${overlaysLibresHTML}
                ${mesasHTML}
            </div>
            <div class="leyenda-pdf">
                <div class="item"><span class="punto" style="background:#3b82f6;"></span>AGT</div>
                <div class="item"><span class="punto" style="background:#22c55e;"></span>SPR</div>
                <div class="item"><span class="punto" style="background:#f97316;"></span>CLD</div>
                <div class="item"><span class="punto" style="background:#a855f7;"></span>GRN</div>
                <div class="item"><span class="punto" style="background:#14b8a6;"></span>CRD</div>
                <div class="item"><span class="punto" style="background:#ec4899;"></span>MIS</div>
                <div class="item"><span class="punto" style="background:#475569;"></span>ADM</div>
            </div>
        </body>
        </html>
    `;

    const nombreArchivo = `Plano-Visual-${nombrePiso || 'Piso'}-${Date.now()}.pdf`;
    return { html, nombreArchivo };
}

/* =========================================================
   EXPORTAR PDF — DOCUMENTADO
   ========================================================= */

btnExportarPDFDoc.addEventListener('click', async () => {
    if (!panelActivo.idLugar) {
        alert('Selecciona un piso primero.');
        return;
    }

    try {
        btnExportarPDFDoc.disabled = true;
        const original = btnExportarPDFDoc.innerHTML;
        btnExportarPDFDoc.innerHTML = 'Generando...';

        const opciones = generarPDFDocumentado(panelActivo);
        const res = await window.api.plano.exportarPDF(opciones);

        if (res.ok) {
            alert('✅ PDF Documentado generado en:\n\n' + res.ruta);
        } else {
            alert('Generación cancelada.');
        }

        btnExportarPDFDoc.disabled = false;
        btnExportarPDFDoc.innerHTML = original;
    } catch (err) {
        alert('Error al generar PDF: ' + err.message);
        btnExportarPDFDoc.disabled = false;
    }
});

function generarPDFDocumentado(panel) {
    const lugar = lugares.find(l => Number(l.IdLugarCliente) === Number(panel.idLugar));
    const cliente = clientes.find(c => Number(c.IdCliente) === Number(panel.idCliente)) ||
                    clientes.find(c => panel.equiposSinUbicar.some(e => Number(e.IdCliente) === Number(c.IdCliente)));

    const nombreCliente = cliente ? `${cliente.Codigo} · ${cliente.Nombre}` : '';
    const nombrePiso = lugar ? lugar.Nombre : '';
    const fecha = new Date().toLocaleString('es-MX');

    const cols = panel.dimensiones.Columnas;
    const filas = panel.dimensiones.Filas;

    /* ---------------------------------------------------------
       MAPA de zonas por celda (para saber la mesa de cada equipo)
       --------------------------------------------------------- */
    const zonasMap = new Map();
    (panel.zonas || []).forEach(z => {
        for (let f = z.FilaInicio; f <= z.FilaFin; f++) {
            for (let c = z.ColumnaInicio; c <= z.ColumnaFin; c++) {
                zonasMap.set(`${f}-${c}`, z);
            }
        }
    });

    /* ---------------------------------------------------------
       LISTA de equipos
       --------------------------------------------------------- */
    const equiposList = [];
    let contador = 1;

    for (let f = 0; f < filas; f++) {
        for (let c = 0; c < cols; c++) {
            const contenido = panel.celdas[f]?.[c];
            if (contenido) {
                const fila = f + 1;
                const col = c + 1;
                const zona = zonasMap.get(`${fila}-${col}`);
                equiposList.push({
                    num: contador++,
                    fila,
                    col,
                    zona,
                    ...contenido
                });
            }
        }
    }

    const totalEquipos = equiposList.length;

    /* ---------------------------------------------------------
       MAPA de zonas libres por celda (para pintar celdas)
       --------------------------------------------------------- */
    const zonasLibresMap = new Map();
    (panel.zonasLibres || []).forEach(zl => {
        zonasLibresMap.set(`${zl.Fila}-${zl.Columna}`, zl);
    });

    /* ---------------------------------------------------------
       AGRUPAR zonas libres por nombre+color para overlay de texto
       --------------------------------------------------------- */
    const gruposLibres = {};
    (panel.zonasLibres || []).forEach(zl => {
        const key = `${zl.Nombre}||${zl.Color}`;
        if (!gruposLibres[key]) {
            gruposLibres[key] = { nombre: zl.Nombre, color: zl.Color, celdas: [] };
        }
        gruposLibres[key].celdas.push({ fila: zl.Fila, columna: zl.Columna });
    });

    /* ---------------------------------------------------------
       RENDERIZAR celdas del grid numerado
       --------------------------------------------------------- */
    let celdasHTML = '';
    for (let f = 0; f < filas; f++) {
        for (let c = 0; c < cols; c++) {
            const contenido = panel.celdas[f]?.[c];
            const fila = f + 1;
            const col = c + 1;
            const zl = zonasLibresMap.get(`${fila}-${col}`);

            let styleCelda = '';
            if (zl && !contenido) {
                styleCelda = `background:${zl.Color};border-color:rgba(0,0,0,0.15);border-style:solid;`;
            }

            if (contenido) {
                const eq = equiposList.find(x => x.fila === fila && x.col === col);
                const rol = contenido.RolCodigo || '';
                celdasHTML += `
                    <div class="celda ocupada" data-rol="${rol}">
                        <div class="numero">${eq.num}</div>
                    </div>
                `;
            } else {
                celdasHTML += `<div class="celda ${zl ? 'libre' : 'vacia'}" style="${styleCelda}"></div>`;
            }
        }
    }

    /* ---------------------------------------------------------
       OVERLAYS de texto de zonas libres
       --------------------------------------------------------- */
    const CELL_W_PDF = 42;
    const CELL_H_PDF = 34;
    const GAP = 4;
    const GRID_PADDING = 10;

    let overlaysLibresHTML = '';
    Object.values(gruposLibres).forEach(g => {
        const filasArr = g.celdas.map(c => c.fila);
        const colsArr = g.celdas.map(c => c.columna);
        const filaMin = Math.min(...filasArr);
        const filaMax = Math.max(...filasArr);
        const colMin = Math.min(...colsArr);
        const colMax = Math.max(...colsArr);

        const x = (colMin - 1) * (CELL_W_PDF + GAP);
        const y = (filaMin - 1) * (CELL_H_PDF + GAP);
        const w = (colMax - colMin + 1) * (CELL_W_PDF + GAP) - GAP;
        const h = (filaMax - filaMin + 1) * (CELL_H_PDF + GAP) - GAP;

        const totalFilas = filaMax - filaMin + 1;
        const totalCols = colMax - colMin + 1;
        const fontSize = Math.max(0.55, Math.min(0.9, 0.5 + Math.min(totalFilas, totalCols) * 0.06));

        overlaysLibresHTML += `
            <div style="
                position:absolute;
                left:${x + GRID_PADDING}px;
                top:${y + GRID_PADDING}px;
                width:${w}px;
                height:${h}px;
                display:flex;
                align-items:center;
                justify-content:center;
                text-align:center;
                font-weight:700;
                font-size:${fontSize}rem;
                color:#1e293b;
                text-transform:uppercase;
                letter-spacing:0.04em;
                text-shadow:0 1px 1px rgba(255,255,255,0.6);
                pointer-events:none;
                padding:2px;
                line-height:1;
                word-break:break-word;
                z-index:5;
            ">${g.nombre}</div>
        `;
    });

    /* ---------------------------------------------------------
       MARCOS de las MESAS (zonas normales)
       --------------------------------------------------------- */
    let mesasHTML = '';
    (panel.zonas || []).forEach(z => {
        const filaMin = z.FilaInicio;
        const filaMax = z.FilaFin;
        const colMin = z.ColumnaInicio;
        const colMax = z.ColumnaFin;

        const x = (colMin - 1) * (CELL_W_PDF + GAP);
        const y = (filaMin - 1) * (CELL_H_PDF + GAP);
        const w = (colMax - colMin + 1) * (CELL_W_PDF + GAP) - GAP;
        const h = (filaMax - filaMin + 1) * (CELL_H_PDF + GAP) - GAP;

        mesasHTML += `
            <div style="
                position:absolute;
                left:${x + GRID_PADDING}px;
                top:${y + GRID_PADDING}px;
                width:${w}px;
                height:${h}px;
                border:2px dashed ${z.Color || '#3b82f6'};
                border-radius:6px;
                pointer-events:none;
                box-sizing:border-box;
                z-index:6;
            ">
                <span style="
                    position:absolute;
                    top:-9px;
                    left:6px;
                    background:${z.Color || '#3b82f6'};
                    color:#fff;
                    font-size:0.55rem;
                    font-weight:700;
                    padding:1px 5px;
                    border-radius:3px;
                    letter-spacing:0.03em;
                    text-transform:uppercase;
                    white-space:nowrap;
                ">${z.Nombre}</span>
            </div>
        `;
    });

    /* ---------------------------------------------------------
       FILAS de la tabla de equipos
       (SIN Fila, SIN Col, SIN Tipo — CON Mesa, Dominio, CDominio,
        Máscara, Puerta, DNS1, DNS2)
       --------------------------------------------------------- */
    const filasTabla = equiposList.map(e => {
        const mesaNombre = e.zona ? e.zona.Nombre : '';
        const mesaColor  = e.zona ? (e.zona.Color || '#3b82f6') : '';

        return `
            <tr>
                <td class="center bold">${e.num}</td>
                <td>${e.Hostname}</td>
                <td class="center">
                    <span class="badge-rol" data-rol="${e.RolCodigo || ''}">${e.RolCodigo || '-'}</span>
                </td>
                <td class="center">
                    ${mesaNombre ? `<span class="badge-mesa" style="background:${mesaColor};">${mesaNombre}</span>` : '-'}
                </td>
                <td>${e.IP || '-'}</td>
                <td>${e.Mascara || '-'}</td>
                <td>${e.PuertaEnlace || '-'}</td>
                <td>${e.DNS1 || '-'}</td>
                <td>${e.DNS2 || '-'}</td>
                <td>${e.UsuarioAdmin || '-'}</td>
                <td>${e.PasswordAdmin || '-'}</td>
            </tr>
        `;
    }).join('');

    /* ---------------------------------------------------------
       IDENTIFICADORES (roles + zonas libres)
       --------------------------------------------------------- */
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

    const zonasLibresGrupos = Object.values(gruposLibres);
    const zonasLibresHTML = zonasLibresGrupos.length > 0
        ? zonasLibresGrupos.map(g => `
            <div class="identificador-item">
                <span class="muestra-color-inline" style="background:${g.color};"></span>
                <span class="nombre-zona-libre">${g.nombre}</span>
                <span class="cant">${g.celdas.length}</span>
            </div>
        `).join('')
        : '';

    /* ---------------------------------------------------------
       CSS
       --------------------------------------------------------- */
    const css = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: A3 landscape; margin: 12mm; }
        body { font-family: 'Segoe UI', 'Inter', system-ui, sans-serif; background: #fff; color: #1e293b; font-size: 11px; }

        .encabezado { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; border-bottom: 3px solid #1e293b; margin-bottom: 18px; }
        .encabezado .titulo h1 { font-size: 1.5rem; color: #1e293b; margin-bottom: 4px; }
        .encabezado .titulo .sub { font-size: 0.95rem; color: #64748b; }
        .encabezado .meta { text-align: right; font-size: 0.75rem; color: #64748b; line-height: 1.6; }
        .encabezado .meta strong { color: #1e293b; }

        .seccion-titulo { font-size: 0.9rem; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }

        .grid-plano { display: grid; grid-template-columns: repeat(${cols}, 42px); grid-template-rows: repeat(${filas}, 34px); gap: 4px; background: #e2e8f0; padding: 10px; border-radius: 8px; border: 2px solid #cbd5e1; width: fit-content; margin: 0 auto 20px; position: relative; }
        .celda { width: 42px; height: 34px; background: #fff; border: 1.5px dashed #cbd5e1; border-radius: 5px; display: flex; align-items: center; justify-content: center; }
        .celda.ocupada { border-style: solid; border-width: 1.5px; }
        .celda.libre { border-style: solid; border-width: 1px; }
        .celda .numero { font-weight: 700; font-size: 0.7rem; color: #1e293b; }
        .celda[data-rol="AGT"] { background: #dbeafe; border-color: #3b82f6; }
        .celda[data-rol="SPR"] { background: #dcfce7; border-color: #22c55e; }
        .celda[data-rol="CLD"] { background: #ffedd5; border-color: #f97316; }
        .celda[data-rol="GRN"] { background: #f3e8ff; border-color: #a855f7; }
        .celda[data-rol="CRD"] { background: #ccfbf1; border-color: #14b8a6; }
        .celda[data-rol="MIS"] { background: #fce7f3; border-color: #ec4899; }
        .celda[data-rol="ADM"] { background: #e2e8f0; border-color: #475569; }

        .tabla-equipos { width: 100%; border-collapse: collapse; font-size: 0.66rem; }
        .tabla-equipos thead { background: #1e293b; color: #fff; }
        .tabla-equipos thead th { padding: 5px 6px; text-align: left; font-weight: 600; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.02em; }
        .tabla-equipos tbody tr { border-bottom: 1px solid #e2e8f0; }
        .tabla-equipos tbody tr:nth-child(even) { background: #f8fafc; }
        .tabla-equipos tbody td { padding: 3px 6px; color: #334155; word-break: break-all; }
        .tabla-equipos .center { text-align: center; }
        .tabla-equipos .bold { font-weight: 700; color: #1e293b; }

        .badge-rol { display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 0.6rem; font-weight: 700; color: #fff; background: #94a3b8; }
        .badge-rol[data-rol="AGT"] { background: #3b82f6; }
        .badge-rol[data-rol="SPR"] { background: #22c55e; }
        .badge-rol[data-rol="CLD"] { background: #f97316; }
        .badge-rol[data-rol="GRN"] { background: #a855f7; }
        .badge-rol[data-rol="CRD"] { background: #14b8a6; }
        .badge-rol[data-rol="MIS"] { background: #ec4899; }
        .badge-rol[data-rol="ADM"] { background: #475569; }

        .badge-mesa { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 700; color: #fff; background: #3b82f6; }

        .identificadores { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
        .identificador-item { display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.72rem; }
        .identificador-item .cant { font-weight: 700; color: #1e293b; font-size: 0.8rem; }
        .identificador-item .muestra-color-inline { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.15); }
        .identificador-item .nombre-zona-libre { font-weight: 600; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em; }

        .page-break { page-break-before: always; }
    `;

    /* ---------------------------------------------------------
       HTML final
       --------------------------------------------------------- */
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${css}</style>
        </head>
        <body>

            <div class="encabezado">
                <div class="titulo">
                    <h1>Plano de Equipos — Documentación</h1>
                    <div class="sub">${nombreCliente}${nombrePiso ? ' · ' + nombrePiso : ''}</div>
                </div>
                <div class="meta">
                    <div><strong>Fecha:</strong> ${fecha}</div>
                    <div><strong>Total equipos:</strong> ${totalEquipos}</div>
                    <div><strong>Dimensiones:</strong> ${cols} × ${filas}</div>
                </div>
            </div>

            <div class="seccion-titulo">Plano numerado</div>
            <div class="grid-plano">
                ${celdasHTML}
                ${overlaysLibresHTML}
                ${mesasHTML}
            </div>

            <div class="page-break"></div>

            <div class="seccion-titulo">Tabla de equipos (${totalEquipos})</div>
            <table class="tabla-equipos">
                <thead>
                    <tr>
                        <th style="width:30px;">#</th>
                        <th style="width:130px;">Hostname</th>
                        <th style="width:50px;">Rol</th>
                        <th style="width:60px;">Mesa</th>
                        <th style="width:110px;">IP</th>
                        <th style="width:110px;">Máscara</th>
                        <th style="width:110px;">Puerta enlace</th>
                        <th style="width:110px;">DNS 1</th>
                        <th style="width:110px;">DNS 2</th>
                        <th style="width:120px;">Dominio</th>
                        <th style="width:120px;">CDominio</th>
                    </tr>
                </thead>
                <tbody>${filasTabla}</tbody>
            </table>

            <div class="seccion-titulo" style="margin-top:24px;">Identificadores</div>
            <div class="identificadores">
                ${rolesHTML}
                ${zonasLibresHTML}
            </div>

        </body>
        </html>
    `;

    const nombreArchivo = `Plano-Documentado-${nombrePiso || 'Piso'}-${Date.now()}.pdf`;
    return { html, nombreArchivo };
}

/* =========================================================
   ATAJO: ENTER PARA GUARDAR ZONA LIBRE
   ========================================================= */

document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && modoZonaLibre && celdasLibresSeleccionadas.length > 0 && !guardandoZonaLibre) {
        ev.preventDefault();
        abrirModalZonaLibre();
    }
});

/* =========================================================
   INICIO
   ========================================================= */

(async () => {
    await cargarClientes();
    roles = await window.api.roles.listar();
    await cargarLugaresPanel(panelIzq, null, false);
    renderPanelLateral();
    crearTooltip();

    window.addEventListener('resize', () => {
        if (panelIzq.idLugar) renderGridPanel(panelIzq);
        if (panelDer.idLugar) renderGridPanel(panelDer);
    });
})();