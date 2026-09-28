/* =========================================================
   ESTADO GLOBAL
   ========================================================= */

let clientes = [];
let lugares = [];
let roles = [];

// Estado por panel: { idCliente, idLugar, dimensiones, celdas, zonas, equiposSinUbicar }
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

// Drag & drop
let dragOrigen = null; // { tipo:'celda'|'lista', idEquipo, fila, columna, panelSufijo }

// Modal mover entre pisos
let moverPendiente = null; // { idEquipo, panelOrigen, panelDestino, fila, columna, equipoInfo }

const COLORES_DISPONIBLES = [
    '#e74c3c', '#e67e22', '#f1c40f', '#27ae60',
    '#3498db', '#9b59b6', '#95a5a6', '#2c3e50'
];

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */

const contenedorPrincipal = document.querySelector('.contenedor-principal');

// Panel izquierdo
const selectClienteIzq = document.getElementById('select-cliente-izq');
const selectLugarIzq   = document.getElementById('select-lugar-izq');
const inputFilasIzq    = document.getElementById('input-filas-izq');
const inputColumnasIzq = document.getElementById('input-columnas-izq');
const gridIzq          = document.getElementById('grid-izq');
const panelIzqDiv      = document.getElementById('panel-izq');

// Panel derecho
const selectClienteDer = document.getElementById('select-cliente-der');
const selectLugarDer   = document.getElementById('select-lugar-der');
const inputFilasDer    = document.getElementById('input-filas-der');
const inputColumnasDer = document.getElementById('input-columnas-der');
const gridDer          = document.getElementById('grid-der');
const panelDerDiv      = document.getElementById('panel-der');

const selectModo       = document.getElementById('select-modo');

// Panel lateral
const listaSinUbicar   = document.getElementById('lista-sin-ubicar');
const listaZonas       = document.getElementById('lista-zonas');

const btnModoZona         = document.getElementById('btn-modo-zona');
const btnLimpiarSeleccion = document.getElementById('btn-limpiar-seleccion');

// Modal confirmación
const modal          = document.getElementById('modal');
const modalTitulo    = document.getElementById('modal-titulo');
const modalTexto     = document.getElementById('modal-texto');
const modalAceptar   = document.getElementById('modal-aceptar');
const modalCancelar  = document.getElementById('modal-cancelar');

// Modal zona
const modalZona         = document.getElementById('modal-zona');
const modalZonaTitulo   = document.getElementById('modal-zona-titulo');
const modalZonaNombre   = document.getElementById('zona-nombre');
const modalZonaRango    = document.getElementById('zona-rango');
const modalZonaAceptar  = document.getElementById('modal-zona-aceptar');
const modalZonaCancelar = document.getElementById('modal-zona-cancelar');
const coloresZonaDiv    = document.getElementById('colores-zona');

// Modal mover entre pisos
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
   MODAL DE CONFIRMACIÓN
   ========================================================= */

let accionPendiente = null;

function mostrarConfirmacion(titulo, texto, alAceptar) {
    modalTitulo.textContent = titulo;
    modalTexto.textContent = texto;
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
    panelDerDiv.style.display = doble ? 'block' : 'none';
    contenedorPrincipal.classList.toggle('solo-simple', !doble);

    if (doble && !panelDer.idLugar) {
        // Inicializar el panel derecho con el mismo cliente del izquierdo
        // pero sin piso (usuario lo elige)
        if (panelIzq.idCliente) {
            cargarLugaresPanel(panelDer, panelIzq.idCliente, false);
        }
    }
});

/* =========================================================
   MODO ZONA
   ========================================================= */

btnModoZona.addEventListener('click', () => {
    modoZona = !modoZona;
    if (modoZona) {
        btnModoZona.classList.add('activo');
        btnModoZona.textContent = 'Modo Zona (activo)';
        btnLimpiarSeleccion.style.display = 'inline-block';
        seleccionZona = null;
    } else {
        btnModoZona.classList.remove('activo');
        btnModoZona.textContent = 'Modo Zona';
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
   CARGA DE CLIENTES Y LUGARES
   ========================================================= */

async function cargarClientes() {
    clientes = await window.api.clientes.listar();
    llenarSelectCliente(selectClienteIzq);
    llenarSelectCliente(selectClienteDer);
}

function llenarSelectCliente(select) {
    select.innerHTML = '<option value="">-- Todos los clientes --</option>';
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

    // Si idCliente es null, mostramos todos los pisos
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
   EVENTOS DE LOS PANELES
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
        const nuevasFilas    = parseInt(inputFilas.value, 10);
        const nuevasColumnas = parseInt(inputColumnas.value, 10);

        if (nuevasFilas < 1 || nuevasColumnas < 1) {
            alert('Filas y columnas deben ser mayor a 0.');
            return;
        }

        mostrarConfirmacion(
            'Cambiar dimensiones',
            `Se cambiará el grid a ${nuevasFilas} filas × ${nuevasColumnas} columnas. Los equipos fuera del nuevo rango se quedarán sin ubicar. ¿Continuar?`,
            async () => {
                await window.api.plano.actualizarDim(panel.idLugar, nuevasFilas, nuevasColumnas);
                await cargarPanel(panel);
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

    // Input de dimensiones
    const inputFilas = panel.sufijo === 'izq' ? inputFilasIzq : inputFilasDer;
    const inputColumnas = panel.sufijo === 'izq' ? inputColumnasIzq : inputColumnasDer;
    inputFilas.value = panel.dimensiones.Filas;
    inputColumnas.value = panel.dimensiones.Columnas;

    // Matriz
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
                RolCodigo: u.RolCodigo
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
   UTILIDAD ZONAS
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
                    <div class="hostname">${contenido.Hostname}</div>
                    <div class="tipo">${contenido.TipoIP === 'DHCP' ? 'DHCP' : contenido.IP}</div>
                `;
                if (!modoZona) {
                    celda.draggable = true;
                    celda.addEventListener('dragstart', (ev) => {
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
   PANEL LATERAL (agrupado por cliente)
   ========================================================= */

function renderPanelLateral() {
    renderListaSinUbicarAgrupada();
    renderListaZonas();
}

function renderListaSinUbicarAgrupada() {
    listaSinUbicar.innerHTML = '';

    if (!panelActivo.equiposSinUbicar || panelActivo.equiposSinUbicar.length === 0) {
        listaSinUbicar.innerHTML = '<p style="color:#95a5a6;font-size:0.85rem;">Sin equipos pendientes</p>';
        return;
    }

    // Agrupar por cliente
    const grupos = {};
    panelActivo.equiposSinUbicar.forEach(e => {
        const key = e.IdCliente;
        if (!grupos[key]) {
            grupos[key] = {
                idCliente: e.IdCliente,
                codigo: e.ClienteCodigo,
                nombre: e.ClienteNombre,
                equipos: []
            };
        }
        grupos[key].equipos.push(e);
    });

    Object.values(grupos).forEach(g => {
        const details = document.createElement('details');
        details.className = 'grupo-cliente';

        const summary = document.createElement('summary');
        summary.textContent = `${g.codigo} - ${g.nombre} (${g.equipos.length})`;
        details.appendChild(summary);

        const ul = document.createElement('ul');
        g.equipos.forEach(e => {
            const li = document.createElement('li');
            li.textContent = e.Hostname;
            li.draggable = true;
            li.addEventListener('dragstart', (ev) => {
                dragOrigen = {
                    tipo: 'lista',
                    idEquipo: e.IdEquipo,
                    panelSufijo: panelActivo.sufijo,
                    hostname: e.Hostname
                };
                ev.dataTransfer.effectAllowed = 'move';
            });
            ul.appendChild(li);
        });
        details.appendChild(ul);
        listaSinUbicar.appendChild(details);
    });
}

function renderListaZonas() {
    listaZonas.innerHTML = '';

    if (!panelActivo.zonas || panelActivo.zonas.length === 0) {
        listaZonas.innerHTML = '<li style="cursor:default;color:#95a5a6;background:transparent;">Sin zonas definidas</li>';
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

    // ============================================================
    // CASO 1: viene de la lista "sin ubicar"
    // ============================================================
    if (dragOrigen.tipo === 'lista') {
        const idEq = dragOrigen.idEquipo;
        const equipo = panelActivo.equiposSinUbicar.find(e => Number(e.IdEquipo) === Number(idEq));
        dragOrigen = null;

        if (!equipo) return;

        // Si es del mismo panel: asignar normal
        if (mismoPanel) {
            if (contenidoDestino) {
                mostrarConfirmacion(
                    'Celda ocupada',
                    `La celda (${filaDestino}, ${columnaDestino}) ya tiene ${contenidoDestino.Hostname}. ` +
                    `Si continúas, se quitará ese equipo y se colocará ${equipo.Hostname}. ¿Continuar?`,
                    async () => {
                        await window.api.plano.quitar(contenidoDestino.IdEquipo, panelDestino.idLugar, contenidoDestino.Hostname);
                        await window.api.plano.asignar(panelDestino.idLugar, equipo.IdEquipo, filaDestino, columnaDestino);
                        await recargarPanel(panelDestino);
                    }
                );
            } else {
                mostrarConfirmacion(
                    'Asignar equipo',
                    `¿Colocar ${equipo.Hostname} en la celda (${filaDestino}, ${columnaDestino})?`,
                    async () => {
                        await window.api.plano.asignar(panelDestino.idLugar, equipo.IdEquipo, filaDestino, columnaDestino);
                        await recargarPanel(panelDestino);
                    }
                );
            }
            return;
        }

        // Si es de otro panel: no aplica, la lista solo pertenece al panel activo
        return;
    }

    // ============================================================
    // CASO 2: viene de una celda
    // ============================================================
    if (dragOrigen.tipo === 'celda') {
        const origen = { ...dragOrigen };
        dragOrigen = null;

        if (mismoPanel && origen.fila === filaDestino && origen.columna === columnaDestino) return;

        const equipoOrigen = panelOrigen.celdas[origen.fila - 1][origen.columna - 1];
        if (!equipoOrigen) return;

        // -------- MISMO PANEL --------
        if (mismoPanel) {
            if (!contenidoDestino) {
                // Mover
                mostrarConfirmacion(
                    'Mover equipo',
                    `¿Mover ${equipoOrigen.Hostname} de (${origen.fila}, ${origen.columna}) a (${filaDestino}, ${columnaDestino})?`,
                    async () => {
                        await window.api.plano.mover(
                            equipoOrigen.IdEquipo, filaDestino, columnaDestino,
                            origen.fila, origen.columna, panelDestino.idLugar
                        );
                        await recargarPanel(panelDestino);
                    }
                );
            } else {
                // Intercambiar mismo piso
                mostrarConfirmacion(
                    'Intercambiar posiciones',
                    `Se intercambiarán las posiciones de ${equipoOrigen.Hostname} y ${contenidoDestino.Hostname}. ` +
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

        // -------- ENTRE PANELES (cambio de piso) --------
        if (!contenidoDestino) {
            // Cambio de piso sin swap
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
            // Cambio de piso con swap
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

    // Info general
    let infoHTML = `
        <div><b>Equipo:</b> ${equipoInfo.Hostname}</div>
        <div><b>Desde:</b> Panel ${panelOrigen.sufijo === 'izq' ? 'Izquierdo' : 'Derecho'}, celda (${datos.filaOrigen ?? '?'}, ${datos.columnaOrigen ?? '?'})</div>
        <div><b>Hacia:</b> Panel ${panelDestino.sufijo === 'izq' ? 'Izquierdo' : 'Derecho'}, celda (${fila}, ${columna})</div>
    `;

    if (conSwap) {
        infoHTML += `
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid #bdc3c7;">
                <b>⚠ La celda destino ya tiene:</b> ${equipoDestino.Hostname}<br>
                Se intercambiarán posiciones. Los datos de cada equipo se mantienen.
            </div>
        `;
    }

    moverInfo.innerHTML = infoHTML;
    moverTitulo.textContent = conSwap ? 'Intercambiar equipos entre pisos' : 'Mover equipo entre pisos';

    chkMantener.checked = true;
    formEditarMover.style.display = 'none';
    moverMensaje.style.display = 'none';

    // Si hay swap, ocultamos el checkbox (no aplica)
    document.querySelector('.check-mantener').style.display = conSwap ? 'none' : 'block';

    // Cargar selects del formulario (clientes, roles)
    llenarSelectClientesMover();
    llenarSelectRolesMover();

    // Cargar datos del equipo
    await cargarDatosEquipoEnModal(equipoInfo.IdEquipo);

    // Cargar lugares del piso destino
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
            // Swap entre pisos
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
                moverConfirmar.disabled = false;
                moverConfirmar.textContent = 'Confirmar';
                return;
            }
        } else {
            // Mover normal (con o sin editar)
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
                    moverConfirmar.disabled = false;
                    moverConfirmar.textContent = 'Confirmar';
                    return;
                }
                if (!nuevosDatos.hostname) {
                    mostrarMensajeMover('El hostname es obligatorio.', 'error');
                    moverConfirmar.disabled = false;
                    moverConfirmar.textContent = 'Confirmar';
                    return;
                }
                if (nuevosDatos.tipoIP === 'Estatica' && !nuevosDatos.ip) {
                    mostrarMensajeMover('La IP es obligatoria en estáticos.', 'error');
                    moverConfirmar.disabled = false;
                    moverConfirmar.textContent = 'Confirmar';
                    return;
                }
            }

            const res = await window.api.plano.moverEntrePisos(
                idEquipo, panelOrigen.idLugar, panelDestino.idLugar, fila, columna, nuevosDatos
            );

            if (!res.ok) {
                mostrarMensajeMover(res.mensaje, 'error');
                moverConfirmar.disabled = false;
                moverConfirmar.textContent = 'Confirmar';
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
    // Buscar el equipo en los paneles
    const equipo = [...panelIzq.celdas.flat(), ...panelDer.celdas.flat()]
        .find(e => e && Number(e.IdEquipo) === Number(idEquipo));
    if (!equipo) return;

    // Necesitamos más datos: vamos al listado completo de equipos
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
        `¿Quitar ${equipo.Hostname} del plano? El equipo seguirá existiendo en el sistema, solo se eliminará su ubicación física.`,
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

    // Cargar lugares del panel izquierdo (todos los pisos por defecto)
    await cargarLugaresPanel(panelIzq, null, false);
})();