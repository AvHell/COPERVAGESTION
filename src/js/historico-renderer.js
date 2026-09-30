/* =========================================================
   REFERENCIA A SWEETALERT
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   TOASTS — versión limpia
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
        background: '#ffffff',
        color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-success' },
        didOpen: (toast) => {
            toast.style.boxShadow = 'none';
            toast.style.webkitBoxShadow = 'none';
            toast.style.filter = 'none';
            toast.style.webkitFilter = 'none';
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
        background: '#ffffff',
        color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-error' },
        didOpen: (toast) => {
            toast.style.boxShadow = 'none';
            toast.style.webkitBoxShadow = 'none';
            toast.style.filter = 'none';
            toast.style.webkitFilter = 'none';
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   LIMPIEZA DE RESIDUOS DE SWEETALERT2
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
const selectCliente    = document.getElementById('select-cliente');
const selectLugar      = document.getElementById('select-lugar');
const filtroDesde      = document.getElementById('filtro-desde');
const filtroHasta      = document.getElementById('filtro-hasta');
const btnLimpiarFechas = document.getElementById('btn-limpiar-fechas');

const tabla            = document.getElementById('tabla-historico');
const contenedorTabla  = document.getElementById('contenedor-tabla');
const estadoInicial    = document.getElementById('estado-inicial');
const sinResultados    = document.getElementById('sin-resultados');
const textoSinRes      = document.getElementById('texto-sin-resultados');

/* =========================================================
   ESTADO
   ========================================================= */
let clientes       = [];
let lugares        = [];
let historicos     = [];

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

/* Icono SVG usuario */
function iconoUsuarioSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>`;
}

/* Icono SVG info */
function iconoInfoSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>`;
}

/* Formatear fecha */
function formatearFecha(fechaISO) {
    const f = new Date(fechaISO);
    if (isNaN(f.getTime())) return { fecha: '—', hora: '' };

    const dia = String(f.getDate()).padStart(2, '0');
    const mes = String(f.getMonth() + 1).padStart(2, '0');
    const anio = f.getFullYear();

    const hh = String(f.getHours()).padStart(2, '0');
    const mm = String(f.getMinutes()).padStart(2, '0');

    return {
        fecha: `${dia}/${mes}/${anio}`,
        hora: `${hh}:${mm}`
    };
}

/* Etiqueta legible de la acción */
function etiquetaAccion(accion) {
    const map = {
        'asignar':       'Asignar',
        'mover':         'Mover',
        'quitar':        'Quitar',
        'intercambiar':  'Intercambiar',
        'crear_zona':    'Crear zona',
        'actualizar_zona':'Editar zona',
        'eliminar_zona': 'Eliminar zona',
        'actualizar_dim':'Cambiar tamaño'
    };
    return map[accion] || (accion ? accion.charAt(0).toUpperCase() + accion.slice(1) : '—');
}

/* Clase CSS de la acción */
function claseAccion(accion) {
    if (!accion) return 'accion-def';
    const key = accion.toLowerCase();
    if (key.includes('asignar')) return 'accion-asignar';
    if (key.includes('mover')) return 'accion-mover';
    if (key.includes('quitar')) return 'accion-quitar';
    if (key.includes('intercambiar')) return 'accion-intercambiar';
    if (key.includes('zona')) return 'accion-zona';
    if (key.includes('dim')) return 'accion-dimensiones';
    return 'accion-def';
}

/* Generar detalle enriquecido */
function generarDetalle(h) {
    // Si hay origen y destino distintos, mostrar la ruta además del detalle
    const tieneRuta = h.LugarOrigen && h.LugarDestino && h.LugarOrigen !== h.LugarDestino;

    let rutaHTML = '';
    if (tieneRuta) {
        rutaHTML = `
            <div class="ruta-movimiento">
                <span class="piso">${escaparHTML(h.LugarOrigen)}</span>
                <span class="flecha">→</span>
                <span class="piso">${escaparHTML(h.LugarDestino)}</span>
            </div>
        `;
    }

    const detalleTexto = h.Detalle && h.Detalle.trim()
        ? escaparHTML(h.Detalle)
        : null;

    if (!detalleTexto && !rutaHTML) {
        return `<div class="detalle-celda vacia">— sin detalle —</div>`;
    }

    return `
        <div class="detalle-celda">
            ${iconoInfoSVG()}
            <div>
                ${detalleTexto ? `<div>${detalleTexto}</div>` : ''}
                ${rutaHTML}
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

async function cargarLugares(idCliente) {
    try {
        const todos = await window.api.lugares.listar();
        lugares = todos.filter(l => Number(l.IdCliente) === Number(idCliente));
        selectLugar.innerHTML = '<option value="">-- Selecciona piso --</option>';
        lugares.forEach(l => {
            const opt = document.createElement('option');
            opt.value = String(l.IdLugarCliente);
            opt.textContent = l.Nombre;
            selectLugar.appendChild(opt);
        });
    } catch (err) {
        toastError('No se pudieron cargar los pisos', err.message);
    }
}

/* =========================================================
   RENDER
   ========================================================= */
function mostrarEstadoInicial() {
    contenedorTabla.classList.add('oculto');
    sinResultados.classList.add('oculto');
    estadoInicial.classList.remove('oculto');
}

function mostrarSinResultados(texto = 'No hay movimientos registrados.') {
    contenedorTabla.classList.add('oculto');
    estadoInicial.classList.add('oculto');
    textoSinRes.textContent = texto;
    sinResultados.classList.remove('oculto');
}

function mostrarTabla() {
    estadoInicial.classList.add('oculto');
    sinResultados.classList.add('oculto');
    contenedorTabla.classList.remove('oculto');
}

/* Aplicar filtro de fechas sobre el array de históricos */
function aplicarFiltroFechas(lista) {
    const desde = filtroDesde.value ? new Date(filtroDesde.value + 'T00:00:00') : null;
    const hasta = filtroHasta.value ? new Date(filtroHasta.value + 'T23:59:59') : null;

    if (!desde && !hasta) return lista;

    return lista.filter(h => {
        const f = new Date(h.Fecha);
        if (isNaN(f.getTime())) return false;
        if (desde && f < desde) return false;
        if (hasta && f > hasta) return false;
        return true;
    });
}

function renderTabla() {
    tabla.innerHTML = '';

    const filtrados = aplicarFiltroFechas(historicos);

    if (!filtrados || filtrados.length === 0) {
        if (historicos.length > 0) {
            mostrarSinResultados('No hay movimientos en el rango de fechas seleccionado.');
        } else {
            mostrarSinResultados('No hay movimientos registrados para este piso.');
        }
        return;
    }

    mostrarTabla();

    filtrados.forEach(h => {
        const { fecha, hora } = formatearFecha(h.Fecha);
        const usuarioCompleto = `${h.NombreUsuario} (${h.Nombres} ${h.Apellidos})`;

        const claseAcc = claseAccion(h.Accion);
        const etiqueta = etiquetaAccion(h.Accion);

        const equipoHTML = h.Hostname
            ? `<span class="badge-equipo">${escaparHTML(h.Hostname)}</span>`
            : `<span class="badge-equipo vacia">— sin equipo —</span>`;

        const detalleHTML = generarDetalle(h);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="badge-fecha">
                    ${fecha}
                    <span class="hora">${hora}</span>
                </span>
            </td>
            <td>
                <span class="badge-usuario" title="${escaparHTML(usuarioCompleto)}">
                    ${iconoUsuarioSVG()}
                    ${escaparHTML(h.NombreUsuario)}
                </span>
            </td>
            <td>
                <span class="badge-accion ${claseAcc}">
                    ${escaparHTML(etiqueta)}
                </span>
            </td>
            <td>${equipoHTML}</td>
            <td>${detalleHTML}</td>
        `;
        tabla.appendChild(tr);
    });
}

/* =========================================================
   EVENTOS
   ========================================================= */
selectCliente.addEventListener('change', async () => {
    const id = parseInt(selectCliente.value, 10);

    if (id) {
        await cargarLugares(id);
    } else {
        selectLugar.innerHTML = '<option value="">-- Selecciona piso --</option>';
    }

    historicos = [];
    mostrarEstadoInicial();
});

selectLugar.addEventListener('change', async () => {
    const id = parseInt(selectLugar.value, 10);

    if (!id) {
        historicos = [];
        mostrarEstadoInicial();
        return;
    }

    try {
        historicos = await window.api.historicos.listarPorLugar(id);
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los movimientos', err.message);
        mostrarSinResultados('Error al cargar los movimientos.');
    }
});

filtroDesde.addEventListener('change', () => {
    if (historicos.length > 0) renderTabla();
});

filtroHasta.addEventListener('change', () => {
    if (historicos.length > 0) renderTabla();
});

btnLimpiarFechas.addEventListener('click', () => {
    filtroDesde.value = '';
    filtroHasta.value = '';
    if (historicos.length > 0) renderTabla();
});

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    mostrarEstadoInicial();
    await cargarClientes();
    limpiarResiduosSwal();
})();