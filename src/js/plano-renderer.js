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
        equiposSinUbicar: []
    };
}

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

const COLORES_DISPONIBLES = [
    '#e74c3c', '#e67e22', '#f1c40f', '#27ae60',
    '#3498db', '#9b59b6', '#95a5a6', '#2c3e50'
];

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */

const contenedorPrincipal = document.getElementById('contenedor-principal');

const selectClienteIzq = document.getElementById('select-cliente-izq');
const selectLugarIzq   = document.getElementById('select-lugar-izq');
const inputFilasIzq    = document.getElementById('input-filas-izq');
const inputColumnasIzq = document.getElementById('input-columnas-izq');
const gridIzq          = document.getElementById('grid-izq');
const panelIzqDiv      = document.getElementById('panel-izq');

const selectClienteDer = document.getElementById('select-cliente-der');
const selectLugarDer   = document.getElementById('select-lugar-der');
const inputFilasDer    = document.getElementById('input-filas-der');
const inputColumnasDer = document.getElementById('input-columnas-der');
const gridDer          = document.getElementById('grid-der');
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

    // Posicionar
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
lateralBackdrop.addEventListener('click', cerrarLateral);
/* Desactivar el backdrop mientras se arrastra para no bloquear el drop */
document.addEventListener('dragstart', () => {
    lateralBackdrop.style.pointerEvents = 'none';
});

document.addEventListener('dragend', () => {
    lateralBackdrop.style.pointerEvents = 'auto';
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
    modalZonaNombre.focus();
}

modalZonaCancelar.addEventListener('click', () => {
    modalZona.style.display = 'none';
    zonaEditando = null;
});

modalZonaAceptar.addEventListener('click', async () => {
    const nombre = modalZonaNombre.value.trim();
    if (!nombre) {
        alert('El nombre es obligatorio.');
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
   EXPORTAR PDF
   ========================================================= */

btnExportarPDF.addEventListener('click', async () => {
    if (!panelActivo.idLugar) {
        alert('Selecciona un piso primero.');
        return;
    }

    try {
        const html = generarHTMLPlanoParaPDF(panelActivo);
        const lugar = lugares.find(l => Number(l.IdLugarCliente) === Number(panelActivo.idLugar));
        const nombreArchivo = `Plano-${lugar?.Nombre || 'Piso'}-${Date.now()}.pdf`;

        btnExportarPDF.disabled = true;
        btnExportarPDF.innerHTML = 'Generando...';

        const res = await window.api.plano.exportarPDF(html, nombreArchivo);

        if (res.ok) {
            alert('✅ PDF generado en:\n\n' + res.ruta);
        } else {
            alert('Generación cancelada.');
        }
    } catch (err) {
        alert('Error al generar PDF: ' + err.message);
    } finally {
        btnExportarPDF.disabled = false;
        btnExportarPDF.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 18 15 15"/>
            </svg>
            Exportar PDF`;
    }
});

function generarHTMLPlanoParaPDF(panel) {
    const lugar = lugares.find(l => Number(l.IdLugarCliente) === Number(panel.idLugar));
    const cliente = clientes.find(c => Number(c.IdCliente) === Number(panel.idCliente)) ||
                    clientes.find(c => {
                        return panel.equiposSinUbicar.some(e => Number(e.IdCliente) === Number(c.IdCliente));
                    });

    const nombreCliente = cliente ? `${cliente.Codigo} - ${cliente.Nombre}` : '';
    const nombrePiso = lugar ? lugar.Nombre : '';

    // Encabezado
    let html = `
        <div class="encabezado">
            <h1>Plano de Equipos</h1>
            <p>${nombreCliente ? nombreCliente + ' · ' : ''}${nombrePiso}</p>
        </div>
    `;

    // Grid
    html += `<div class="grid-plano" style="grid-template-columns: repeat(${panel.dimensiones.Columnas}, 1fr);">`;

    for (let f = 0; f < panel.dimensiones.Filas; f++) {
        for (let c = 0; c < panel.dimensiones.Columnas; c++) {
            const contenido = panel.celdas[f]?.[c];
            const fila = f + 1;
            const col = c + 1;
            const zona = zonaEnCelda(panel, fila, col);

            let clase = 'celda ' + (contenido ? 'ocupada' : 'vacia');
            let attrs = '';
            if (contenido && contenido.RolCodigo) {
                attrs = ` data-rol="${contenido.RolCodigo}"`;
            }

            // Zona (color suave)
            let styleZona = '';
            if (zona && zona.Color) {
                styleZona = ` style="background: ${zona.Color}33;"`;
            }

            if (contenido) {
                const ip = contenido.IP || 'DHCP';
                html += `
                    <div class="${clase}"${attrs}${styleZona}>
                        <div class="hostname">${contenido.Hostname}</div>
                        <div class="ip">${ip}</div>
                        ${zona && esInicioZona(fila, col, zona) ? `<div class="etiqueta-zona">${zona.Nombre}</div>` : ''}
                    </div>
                `;
            } else {
                html += `<div class="${clase}"${styleZona}></div>`;
            }
        }
    }

    html += `</div>`;

    // Leyenda
    html += `
        <div class="leyenda-pdf">
            <div class="item"><span class="punto" style="background:#3b82f6;"></span>AGT</div>
            <div class="item"><span class="punto" style="background:#22c55e;"></span>SPR</div>
            <div class="item"><span class="punto" style="background:#f97316;"></span>CLD</div>
            <div class="item"><span class="punto" style="background:#a855f7;"></span>GRN</div>
            <div class="item"><span class="punto" style="background:#14b8a6;"></span>CRD</div>
            <div class="item"><span class="punto" style="background:#ec4899;"></span>MIS</div>
            <div class="item"><span class="punto" style="background:#475569;"></span>ADM</div>
        </div>
    `;

    return html;
}

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
                RolCodigo: u.RolCodigo,
                _fila: u.Fila,
                _col: u.Columna
            };
        }
    });

    panel.equiposSinUbicar = await window.api.plano.sinUbicacion(panel.idLugar);
    panel.zonas = await window.api.plano.listarZonas(panel.idLugar);

    renderGridPanel(panel);
    if (panel === panelActivo) renderPanelLateral();
}

async function recargarPanel(panel) {
    await cargarPanel(panel);
}

function limpiarPanel(panel) {
    panel.celdas = [];
    panel.zonas = [];
    panel.equiposSinUbicar = [];

    const grid = panel.sufijo === 'izq' ? gridIzq : gridDer;
    grid.innerHTML = '';

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

function esInicioZona(fila, columna, zona) {
    return zona.FilaInicio === fila && zona.ColumnaInicio === columna;
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
    if (!grid) return;

    grid.innerHTML = '';
    if (!panel.dimensiones.Filas) return;

    grid.style.gridTemplateColumns = `repeat(${panel.dimensiones.Columnas}, 1fr)`;

    for (let f = 0; f < panel.dimensiones.Filas; f++) {
        for (let c = 0; c < panel.dimensiones.Columnas; c++) {
            const fila = f + 1;
            const columna = c + 1;
            const celda = document.createElement('div');
            const contenido = panel.celdas[f]?.[c];
            const zona = zonaEnCelda(panel, fila, columna);

            celda.className = 'celda ' + (contenido ? 'ocupada' : 'vacia');
            celda.dataset.fila = fila;
            celda.dataset.columna = columna;
            celda.dataset.panel = panel.sufijo;

            if (contenido && contenido.RolCodigo) {
                celda.dataset.rol = contenido.RolCodigo;
            }

            if (zona && zona.Color) {
                celda.style.background = zona.Color + '33';
                celda.classList.add('en-zona');
            } else if (zona) {
                celda.classList.add('en-zona');
            }

            if (seleccionZona && panel === panelActivo && enSeleccion(fila, columna)) {
                celda.classList.add('seleccionada');
            }

            if (contenido) {
                celda.innerHTML = `
                    <button class="cerrar" data-id="${contenido.IdEquipo}">✕</button>
                    ${SVG_PC}
                `;

                // Tooltip custom
                celda.addEventListener('mouseenter', (ev) => {
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

                if (!modoZona) {
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
                    if (!modoZona) confirmarQuitar(contenido, panel);
                });
            }

            if (zona && esInicioZona(fila, columna, zona)) {
                const etiqueta = document.createElement('div');
                etiqueta.className = 'etiqueta-zona';
                etiqueta.textContent = zona.Nombre;
                celda.appendChild(etiqueta);
            }

            if (!modoZona) {
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

            grid.appendChild(celda);
        }
    }
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
        li.innerHTML = `
            <span class="rol-punto"></span>
            <span class="hostname-texto">${e.Hostname}</span>
        `;
        li.addEventListener('dragstart', (ev) => {
            dragOrigen = {
                tipo: 'lista',
                idEquipo: e.IdEquipo,
                panelSufijo: panelActivo.sufijo,
                hostname: e.Hostname
            };
            ev.dataTransfer.effectAllowed = 'move';
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

    if (!panelActivo.zonas || panelActivo.zonas.length === 0) {
        listaZonas.innerHTML = '<li style="cursor:default;color:#95a5a6;background:transparent;font-size:0.8rem;">Sin zonas definidas</li>';
        return;
    }

    panelActivo.zonas.forEach(z => {
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
        }
        return;
    }

    if (dragOrigen.tipo === 'celda') {
        const origen = { ...dragOrigen };
        dragOrigen = null;

        if (mismoPanel && origen.fila === filaDestino && origen.columna === columnaDestino) return;

        const equipoOrigen = panelOrigen.celdas[origen.fila - 1][origen.columna - 1];
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

        if (!contenidoDestino) {
            abrirModalMoverEntrePisos({
                idEquipo: equipoOrigen.IdEquipo,
                panelOrigen,
                panelDestino,
                fila: filaDestino,
                columna: columnaDestino,
                equipoInfo: equipoOrigen,
                conSwap: false,
                equipoDestino: null
            });
        } else {
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
        }
    }
}

/* =========================================================
   MODAL MOVER ENTRE PISOS
   ========================================================= */

async function abrirModalMoverEntrePisos(datos) {
    moverPendiente = datos;

    const { equipoInfo, panelOrigen, panelDestino, fila, columna, conSwap, equipoDestino } = datos;

    let infoHTML = `
        <div><b>Equipo:</b> ${equipoInfo.Hostname}</div>
        <div><b>Desde:</b> Panel ${panelOrigen.sufijo === 'izq' ? 'Izquierdo' : 'Derecho'}, celda (${datos.filaOrigen ?? '?'}, ${datos.columnaOrigen ?? '?'})</div>
        <div><b>Hacia:</b> Panel ${panelDestino.sufijo === 'izq' ? 'Izquierdo' : 'Derecho'}, celda (${fila}, ${columna})</div>
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

    const selectLugarDestino = panelDestino.idLugar;
    const lugarDestino = lugares.find(l => Number(l.IdLugarCliente) === Number(selectLugarDestino));
    if (lugarDestino) {
        mvLugar.innerHTML = `<option value="${lugarDestino.IdLugarCliente}">${lugarDestino.Nombre}</option>`;
        mvLugar.value = lugarDestino.IdLugarCliente;
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

            if (!res.ok) {
                mostrarMensajeMover(res.mensaje, 'error');
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

            const res = await window.api.plano.moverEntrePisos(
                idEquipo, panelOrigen.idLugar, panelDestino.idLugar, fila, columna, nuevosDatos
            );

            if (!res.ok) {
                mostrarMensajeMover(res.mensaje, 'error');
                return;
            }
        }

        modalMover.style.display = 'none';
        moverPendiente = null;

        await recargarPanel(panelOrigen);
        await recargarPanel(panelDestino);

    } catch (err) {
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
   INICIO
   ========================================================= */

(async () => {
    await cargarClientes();
    roles = await window.api.roles.listar();
    await cargarLugaresPanel(panelIzq, null, false);
    renderPanelLateral();
    crearTooltip();
})();