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
        equiposSinUbicar: [],
        escenarioFuturoId: null,
        escenariosFuturos: [],
        /* Posición vertical que el usuario le dio a cada etiqueta del riel,
           por grupo Nombre+Color. Vacío = posición automática. */
        posicionesLlave: {}
    };
}

/* Colores por defecto de las zonas. Ya no hay paleta fija: el usuario elige
   el color con un <input type="color"> igual que en Catálogos del sistema. */
const COLOR_ZONA_DEFECTO = '#A99A63';
const COLOR_ZONA_LIBRE_DEFECTO = '#B5442E';

/* Zona Libre: marcar celdas vacías */
let modoZonaLibre = false;
let celdasLibresSeleccionadas = [];

/* Zona Normal: se marcan celdas con clic o arrastrando una banda sobre la
   grilla (permite celdas con o sin equipo) y después se les pone nombre. */
let modoZona = false;
let celdasZonaSeleccionadas = [];  // [{fila, columna}, ...]

/* Arrastre (banda) de selección en modo zona.
   { ancla:{fila,columna}, base:[celdas previas], sustraer:bool, movido:bool } */
let arrastreZona = null;
let arrastreZonaTerminado = false; // evita que el clic final deshaga la banda

/* Edición */
let modoEdicion = false;
let equipoEditando = null;

let zonaEditando = null;
let zonaGrupoEditando = null;
let zonaLibreEditando = null;

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
let edEsModoCreacion = false; // por si en el futuro se reutiliza para crear

/* Normaliza un color almacenado a un valor CSS seguro (hex/rgb/hsl). */
function normalizarColor(c, fallback = '#e2e8f0') {
    if (!c || typeof c !== 'string') return fallback;
    const s = c.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
    return fallback;
}

/* Devuelve el color de texto que mejor contrasta sobre un fondo dado.
   Se usa tanto en la pantalla como en la vista previa y el PDF. */
function colorTextoContraste(hexColor) {
    try {
        const hex = String(hexColor || '').replace('#', '');
        const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
        const r = parseInt(full.substr(0, 2), 16);
        const g = parseInt(full.substr(2, 2), 16);
        const b = parseInt(full.substr(4, 2), 16);
        if ([r, g, b].some(canal => Number.isNaN(canal))) return '#1e293b';
        const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminancia < 0.6 ? '#ffffff' : '#1e293b';
    } catch { return '#1e293b'; }
}

/* <input type="color"> solo acepta #rrggbb: convierte o cae al valor por defecto. */
function colorParaInput(c, fallback = COLOR_ZONA_DEFECTO) {
    const color = normalizarColor(c, fallback);
    if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
        return '#' + color.slice(1).split('').map(x => x + x).join('').toLowerCase();
    }
    return fallback;
}

const COLORES_CLIENTE_POR_CODIGO = Object.freeze({
    MEGA: '#217a4b',
    NATR: '#5b92e5',
    PHIE: '#eab308',
    TOYL: '#ef4444',
    NU: '#a855f7',
    CLD: '#dc2626',
    TPLAY: '#1e40af',
    ATT: '#3b82f6',
    DMEX: '#4ade80',
    SHOP: '#f97316',
    HBAN: '#fde047',
    TOY: '#b91c1c',
    ADAMA: '#2563eb',
    KUBO: '#15803d',
    DIDI: '#ea580c',
    FESA: '#0f766e',
    FRN: '#6d28d9'
});

const CELL_W = 74;
const CELL_H = 52;
const CELL_GAP = 5;
const GRID_PADDING = 10;

/* Alto de la banda con el código del cliente en planos de celdas angostas
   (p. ej. 12 × 37). Compartido por el markup y por el CSS de la vista previa
   y del PDF para que la banda y el hueco reservado siempre coincidan. */
const ALTO_BANDA_CLIENTE = 14;

/* =========================================================
   CSS EMBEBIDO PARA EL PDF
   ========================================================= */
const CSS_PDF = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
        size: A3 var(--pdf-orientation, landscape);
        margin: 6mm;
    }

    html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
        color: #1e293b;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        font-size: 11px;
        line-height: 1.2;
    }

    .pagina-plano {
        width: 100%;
        height: 100%;
        padding: 8px 12px;
        overflow: hidden;
        page-break-after: always;
        page-break-inside: avoid;
        display: flex;
        flex-direction: column;
        background: #fff;
    }

    .pagina-tabla {
        width: 100%;
        padding: 12px 16px;
        page-break-before: always;
        background: #fff;
    }

    .encabezado {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-bottom: 6px;
        border-bottom: 3px solid #1e293b;
        margin-bottom: 10px;
        flex-shrink: 0;
    }
    .encabezado .titulo h1 { font-size: 1.4rem; color: #1e293b; margin-bottom: 2px; }
    .encabezado .titulo .sub { font-size: 0.92rem; color: #64748b; }
    .encabezado .meta { text-align: right; font-size: 0.8rem; color: #64748b; line-height: 1.5; }
    .encabezado .meta strong { color: #1e293b; }
    .marca-propuesta {
        display: inline-flex;
        flex-direction: column;
        max-width: 250px;
        margin-bottom: 5px;
        padding: 4px 8px;
        border: 1px solid #a99a63;
        border-radius: 6px;
        background: #f4f0e6;
        color: #566348;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        line-height: 1.25;
        text-align: right;
        overflow-wrap: anywhere;
    }
    .marca-propuesta small { color: #575347; font-size: 0.66rem; font-weight: 600; letter-spacing: 0; }

    .seccion-titulo {
        font-size: 0.82rem;
        font-weight: 700;
        color: #1e293b;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 10px 0 6px;
        padding-bottom: 3px;
        border-bottom: 2px solid #e2e8f0;
    }

    .plano-wrap {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 12px 8px;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    /* Riel de indicadores de zona: reserva el espacio lateral FUERA del canvas
       para que la etiqueta nunca se encime con las celdas ni se salga de la
       hoja. El riel se toma SIEMPRE del espacio sobrante: el canvas no cambia. */
    .plano-con-riel {
        position: relative;
        width: fit-content;
        flex-shrink: 0;
        /* content-box explícito: el relleno del riel se SUMA al canvas, nunca
           lo encoge. Así el PDF mide igual que la vista previa, aunque en el
           PDF exista el reset universal a border-box. */
        box-sizing: content-box;
    }

    .etiqueta-zona-pdf {
        position: absolute;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 23px;
        padding: 0 9px;
        background: #fff;
        border: 2px solid;
        border-radius: 6px;
        font-size: 0.86rem;
        font-weight: 700;
        color: #1e293b;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        white-space: nowrap;
        box-sizing: border-box;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    .etiqueta-zona-pdf .punto-color {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        flex-shrink: 0;
    }

    /* Nombre de la zona: si no cabe en el riel se recorta con elipsis. */
    .etiqueta-zona-pdf .texto-zona-pdf {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Etiqueta girada 90°: se usa cuando la hoja no tiene franjas laterales
       libres. Cabe en el relleno de la página, así que no tapa ninguna celda y
       el canvas conserva su tamaño. */
    .etiqueta-zona-pdf.vertical {
        writing-mode: vertical-rl;
        height: auto;
        padding: 8px 0;
        font-size: 0.78rem;
        line-height: 1.1;
        letter-spacing: 0.06em;
    }

    .etiqueta-zona-pdf.vertical .texto-zona-pdf {
        text-overflow: clip;
    }

    /* Franja de página sin relleno lateral: esos píxeles pasan al riel de las
       etiquetas, nunca al tamaño de las celdas. */
    .plano-wrap.compacto,
    .pagina-plano.compacto {
        padding-left: 0;
        padding-right: 0;
    }

    .grid-plano {
        display: grid;
        background: #e2e8f0;
        border-radius: 10px;
        border: 2px solid #cbd5e1;
        width: fit-content;
        position: relative;
    }

    .celda {
        background: #fff;
        border: 1px dashed #cbd5e1;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
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
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        letter-spacing: -0.01em;
    }

    .celda-ip {
        font-family: 'Consolas', 'Monaco', monospace;
        font-weight: 600;
        color: #334155;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        letter-spacing: -0.01em;
    }

    .celda[data-rol="AGT"] { background: var(--rol-agt-suave); border-color: var(--rol-agt); }
    .celda[data-rol="CRD"] { background: var(--rol-crd-suave); border-color: var(--rol-crd); }
    .celda[data-rol="CLD"] { background: var(--rol-cld-suave); border-color: var(--rol-cld); }
    .celda[data-rol="SPR"] { background: var(--rol-spr-suave); border-color: var(--rol-spr); }
    .celda[data-rol="GRN"] { background: var(--rol-grn-suave); border-color: var(--rol-grn); }
    .celda[data-rol="ADM"] { background: var(--rol-adm-suave); border-color: var(--rol-adm); }
    .celda[data-rol="MIS"] { background: var(--rol-mis-suave); border-color: var(--rol-mis); }

    .tabla-equipos {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.72rem;
        table-layout: fixed;
        margin-top: 6px;
    }
    .tabla-equipos thead {
        background: #1e293b;
        color: #fff;
        display: table-header-group;
    }
    .tabla-equipos thead th {
        padding: 6px 6px;
        text-align: left;
        font-weight: 700;
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }
    .tabla-equipos tbody tr { border-bottom: 1px solid #e2e8f0; }
    .tabla-equipos tbody tr:nth-child(even) { background: #f8fafc; }
    .tabla-equipos tbody td {
        padding: 3px 6px;
        color: #334155;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
    }
    .tabla-equipos .center { text-align: center; }
    .tabla-equipos .bold { font-weight: 700; color: #64748b; }
    .tabla-equipos .bold-host { font-weight: 600; color: #1e293b; }
    .tabla-equipos .mono {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 0.66rem;
        color: #475569;
    }

    .badge-rol {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 0.6rem;
        font-weight: 700;
        color: #fff;
        background: #94a3b8;
    }
    .badge-rol[data-rol="AGT"] { background: var(--rol-agt); }
    .badge-rol[data-rol="CRD"] { background: var(--rol-crd); }
    .badge-rol[data-rol="CLD"] { background: var(--rol-cld); }
    .badge-rol[data-rol="SPR"] { background: var(--rol-spr); }
    .badge-rol[data-rol="GRN"] { background: var(--rol-grn); }
    .badge-rol[data-rol="ADM"] { background: var(--rol-adm); }
    .badge-rol[data-rol="MIS"] { background: var(--rol-mis); }

    .badge-cli[data-color] { border: 1px solid transparent; }
    [data-color="MEGA"] { background: #217a4b !important; color: #ffffff !important; border-color: #14532d !important; }
    [data-color="NATR"] { background: #5b92e5 !important; color: #ffffff !important; border-color: #3b82f6 !important; }
    [data-color="PHIE"] { background: #eab308 !important; color: #3f3010 !important; border-color: #a16207 !important; }
    [data-color="TOYL"] { background: #ef4444 !important; color: #ffffff !important; border-color: #b91c1c !important; }
    [data-color="NU"] { background: #a855f7 !important; color: #ffffff !important; border-color: #7e22ce !important; }
    [data-color="CLD"] { background: #dc2626 !important; color: #ffffff !important; border-color: #991b1b !important; }
    [data-color="TPLAY"] { background: #1e40af !important; color: #ffffff !important; border-color: #1e3a8a !important; }
    [data-color="ATT"] { background: #3b82f6 !important; color: #ffffff !important; border-color: #2563eb !important; }
    [data-color="DMEX"] { background: #4ade80 !important; color: #064e3b !important; border-color: #22c55e !important; }
    [data-color="SHOP"] { background: #f97316 !important; color: #ffffff !important; border-color: #c2410c !important; }
    [data-color="HBAN"] { background: #fde047 !important; color: #713f12 !important; border-color: #ca8a04 !important; }
    [data-color="TOY"] { background: #b91c1c !important; color: #ffffff !important; border-color: #7f1d1d !important; }
    [data-color="ADAMA"] { background: #2563eb !important; color: #ffffff !important; border-color: #1d4ed8 !important; }
    [data-color="KUBO"] { background: #15803d !important; color: #ffffff !important; border-color: #166534 !important; }
    [data-color="DIDI"] { background: #ea580c !important; color: #ffffff !important; border-color: #c2410c !important; }
    [data-color="FESA"] { background: #0f766e !important; color: #ffffff !important; border-color: #115e59 !important; }
    [data-color="FRN"] { background: #6d28d9 !important; color: #ffffff !important; border-color: #5b21b6 !important; }

    .badge-dhcp {
        display: inline-block;
        padding: 1px 5px;
        border: 1px solid #cfc7b0;
        border-radius: 3px;
        background: #f4f0e6;
        color: #575347;
        font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    .badge-cli {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 0.62rem;
        font-weight: 700;
        color: #1e293b;
        background: #e2e8f0;
    }

    .identificadores {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding: 8px 10px;
        background: #f8fafc;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        margin-top: 6px;
    }
    .identificador-item {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        background: #fff;
        border-radius: 4px;
        border: 1px solid #e2e8f0;
        font-size: 0.72rem;
    }
    .identificador-item .cant {
        font-weight: 700;
        color: #1e293b;
        font-size: 0.8rem;
    }
    .identificador-item .muestra-color-inline {
        display: inline-block;
        width: 13px;
        height: 13px;
        border-radius: 3px;
        border: 1px solid rgba(0,0,0,0.15);
    }
    .identificador-item .nombre-zona-libre {
        font-weight: 600;
        color: #1e293b;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    :root {
        --plano-fondo: #faf8f2;
        --plano-superficie: #ffffff;
        --plano-superficie-suave: #f4f0e6;
        --plano-borde: #e6e0cf;
        --plano-borde-fuerte: #cfc7b0;
        --plano-texto: #2e3228;
        --plano-texto-secundario: #575347;
        --plano-texto-suave: #7a7563;
        --plano-oliva: #6e7b5b;
        --plano-oro: #a99a63;
        --plano-rojo: #b5442e;
        --plano-rojo-suave: #f3ded6;
        /* Respaldo cuando el rol no tiene color en el catálogo. Los tokens
           -texto solo se usan si tampoco llega --celda-texto del catálogo. */
        --rol-agt: #93c5fd;
        --rol-agt-suave: #93c5fd;
        --rol-agt-texto: #1e3a8a;
        --rol-crd: #fef08a;
        --rol-crd-suave: #fef08a;
        --rol-crd-texto: #713f12;
        --rol-cld: #fbcfe8;
        --rol-cld-suave: #fbcfe8;
        --rol-cld-texto: #831843;
        --rol-spr: #bbf7d0;
        --rol-spr-suave: #bbf7d0;
        --rol-spr-texto: #14532d;
        --rol-grn: #d8b4fe;
        --rol-grn-suave: #d8b4fe;
        --rol-grn-texto: #4c1d95;
        --rol-adm: #1d201a;
        --rol-adm-suave: #1d201a;
        --rol-adm-texto: #ffffff;
        --rol-mis: #fca5a5;
        --rol-mis-suave: #fca5a5;
        --rol-mis-texto: #7f1d1d;
    }

    html, body { color: var(--plano-texto); }
    .encabezado { border-bottom-color: var(--plano-oro); }
    .encabezado .titulo h1,
    .encabezado .meta strong,
    .seccion-titulo,
    .celda-hostname,
    .identificador-item .cant,
    .identificador-item .nombre-zona-libre { color: var(--plano-texto); }
    .encabezado .titulo .sub,
    .encabezado .meta,
    .tabla-equipos .bold { color: var(--plano-texto-suave); }
    .seccion-titulo { border-bottom-color: var(--plano-borde); }
    .grid-plano {
        background: var(--plano-superficie-suave);
        border-color: var(--plano-borde-fuerte);
    }
    .celda {
        background: var(--plano-superficie);
        border-color: var(--plano-borde-fuerte);
    }
    .celda-ip,
    .tabla-equipos tbody td { color: var(--plano-texto-secundario); }
    .tabla-equipos thead { background: var(--plano-texto); }
    .tabla-equipos tbody tr { border-bottom-color: var(--plano-borde); }
    .tabla-equipos tbody tr:nth-child(even),
    .identificadores { background: var(--plano-superficie-suave); }
    .identificadores,
    .identificador-item { border-color: var(--plano-borde); }
    .identificador-item { background: var(--plano-superficie); }
    /* ------------------------------------------------------------------
       ROLES: el color NO se declara aquí.
       El renderer inyecta en la celda el fondo y el borde del color
       configurado en el catálogo de Roles, y el contraste del texto como
       --celda-texto. Estas reglas solo aportan el respaldo (tokens --rol-*)
       cuando el rol no tiene color capturado.
       ------------------------------------------------------------------ */
    .celda[data-rol="AGT"] { background: var(--rol-agt-suave); border-color: var(--rol-agt); --rol-texto: var(--rol-agt-texto); }
    .celda[data-rol="CRD"] { background: var(--rol-crd-suave); border-color: var(--rol-crd); --rol-texto: var(--rol-crd-texto); }
    .celda[data-rol="CLD"] { background: var(--rol-cld-suave); border-color: var(--rol-cld); --rol-texto: var(--rol-cld-texto); }
    .celda[data-rol="SPR"] { background: var(--rol-spr-suave); border-color: var(--rol-spr); --rol-texto: var(--rol-spr-texto); }
    .celda[data-rol="GRN"] { background: var(--rol-grn-suave); border-color: var(--rol-grn); --rol-texto: var(--rol-grn-texto); }
    .celda[data-rol="ADM"] { background: var(--rol-adm-suave); border-color: var(--rol-adm); --rol-texto: var(--rol-adm-texto); }
    .celda[data-rol="MIS"] { background: var(--rol-mis-suave); border-color: var(--rol-mis); --rol-texto: var(--rol-mis-texto); }

    .celda[data-rol] .celda-hostname,
    .celda[data-rol] .celda-ip {
        color: var(--celda-texto, var(--rol-texto, var(--plano-texto)));
    }

    .badge-rol[data-rol="AGT"] { background: var(--rol-agt); }
    .badge-rol[data-rol="CRD"] { background: var(--rol-crd); }
    .badge-rol[data-rol="CLD"] { background: var(--rol-cld); }
    .badge-rol[data-rol="SPR"] { background: var(--rol-spr); }
    .badge-rol[data-rol="GRN"] { background: var(--rol-grn); }
    .badge-rol[data-rol="ADM"] { background: var(--rol-adm); }
    .badge-rol[data-rol="MIS"] { background: var(--rol-mis); }
`;

/* =========================================================
   TOAST
   ========================================================= */
function mostrarToast(mensaje, tipo = 'exito', duracion = 2800) {
    const iconos = { exito: 'success', error: 'error', info: 'info', warn: 'warning' };
    window.Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: iconos[tipo] || 'success',
        title: String(mensaje),
        showConfirmButton: false,
        timer: duracion,
        timerProgressBar: true,
        customClass: { popup: `cl-toast cl-toast-${tipo === 'exito' ? 'success' : tipo === 'error' ? 'error' : 'info'}` },
        didOpen: toast => {
            toast.addEventListener('mouseenter', window.Swal.stopTimer);
            toast.addEventListener('mouseleave', window.Swal.resumeTimer);
        }
    });
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
const controlesFuturo = document.getElementById('controles-futuro');
const selectEscenarioFuturo = document.getElementById('select-escenario-futuro');
const btnCrearFuturo = document.getElementById('btn-crear-futuro');
const btnEliminarFuturo = document.getElementById('btn-eliminar-futuro');

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
const modalZonaEliminar = document.getElementById('modal-zona-eliminar');
const inputColorZona    = document.getElementById('zona-color');

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
const modalZonaLibreEliminar  = document.getElementById('modal-zona-libre-eliminar');
const inputColorZonaLibre     = document.getElementById('zona-libre-color');

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
const editarCerrar         = document.getElementById('editar-cerrar');
const editarConfirmar      = document.getElementById('editar-confirmar');

/* =========================================================
   TOOLTIP
   ========================================================= */
let tooltipDiv = null;

function escaparTextoTooltip(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

function crearTooltip() {
    tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'tooltip-plano';
    tooltipDiv.style.display = 'none';
    document.body.appendChild(tooltipDiv);
}

/* Datos que alimentan el tooltip de una celda ocupada. Se arma en un único
   lugar para que mouseenter y mousemove no se desincronicen (antes el objeto
   estaba duplicado y ya divergía). No incluye la posición ni el tipo de IP:
   esos datos no aportan al hover y alargaban la tarjeta. */
function datosTooltipCelda(contenido, fila, columna, panel) {
    return {
        hostname: contenido.Hostname,
        rol: contenido.RolCodigo || '',
        ip: contenido.IP,
        cliente: contenido.ClienteCodigo || '',
        clienteNombre: contenido.ClienteNombre || '',
        usuarioAdmin: contenido.UsuarioAdmin || '',
        descripcionAdmin: contenido.DescripcionAdmin || '',
        pisoNombre: pisos.find(p => Number(p.IdPiso) === Number(panel.idPiso))?.Nombre || '',
        fila,
        col: columna
    };
}

function mostrarTooltip(ev, contenido) {
    if (!tooltipDiv) crearTooltip();

    const esc = escaparTextoTooltip;

    const clienteTexto = contenido.clienteNombre
        ? `${contenido.cliente || ''} — ${contenido.clienteNombre}`
        : (contenido.cliente || '—');

    const ipTexto = contenido.ip ? contenido.ip : 'DHCP (sin IP estática)';

    /* OJO con el JOIN de dominios: DescripcionAdmin es la Descripcion del
       catálogo DominiosAdmin (el dominio en sí) y UsuarioAdmin es la cuenta.
       Estaban cruzados y el tooltip mostraba el dominio como usuario. */
    const filas = [
        ['Cliente', esc(clienteTexto), ''],
        ['Dirección IP', esc(ipTexto), 'mono'],
        ['Dominio', esc(contenido.descripcionAdmin || '—'), 'mono'],
        ['Usuario admin', esc(contenido.usuarioAdmin || '—'), ''],
        ...(contenido.pisoNombre ? [['Piso', esc(contenido.pisoNombre), '']] : [])
    ];

    /* El color del rol lo hereda del catálogo de Roles (el mismo canal que usa
       el resto del plano). Se pasa como token --rol-* para que el CSS siga
       mandando en la forma y no quede ningún color fijo aquí. */
    const rolCodigo = String(contenido.rol || '').toUpperCase().trim();
    const colorRol = window.PermisosUI?.colorRol?.(rolCodigo) || null;
    const estiloRol = /^#[0-9A-F]{6}$/i.test(colorRol || '')
        ? ` style="--rol-color:${colorRol};--rol-borde:${colorRol};--rol-texto:${colorTextoContraste(colorRol)};"`
        : '';

    tooltipDiv.innerHTML = `
        <div class="tooltip-header">
            <span class="rol-badge" data-rol="${esc(contenido.rol || '')}"${estiloRol}>${esc(contenido.rol || 'SIN ROL')}</span>
            <span class="hostname">${esc(contenido.hostname || '—')}</span>
        </div>
        <div class="tooltip-body">
            ${filas.map(([etiqueta, valor, clase]) => `
                <div class="tooltip-row">
                    <span class="label">${etiqueta}</span>
                    <span class="valor${clase ? ` ${clase}` : ''}">${valor}</span>
                </div>`).join('')}
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

document.addEventListener('dragstart', (ev) => {
    if (ev.target.closest('.btn-editar-equipo')) {
        ev.preventDefault();
        return;
    }
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

function mostrarConfirmacion(titulo, contenidoHTML, alAceptar, permiso) {
    modalTitulo.textContent = titulo;
    if (permiso) {
        modalAceptar.dataset.permiso = permiso;
        window.PermisosUI?.aplicar(modalAceptar);
    } else {
        delete modalAceptar.dataset.permiso;
        modalAceptar.hidden = false;
        modalAceptar.disabled = false;
        modalAceptar.classList.remove('permiso-ui-oculto');
        modalAceptar.removeAttribute('aria-hidden');
    }
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
function abrirModalZona(zona = null, grupo = null) {
    zonaEditando = zona;
    zonaGrupoEditando = grupo;

    if (zona) {
        /* Edición: se trabaja sobre el grupo completo (mismo Nombre+Color) para
           que renombrar, recolorear y mover celdas sea una sola operación. */
        const celdasGrupo = (grupo?.zonas?.length ? grupo.zonas : [zona])
            .map(z => ({ fila: Number(z.FilaInicio), columna: Number(z.ColumnaInicio) }));

        celdasZonaSeleccionadas = celdasGrupo;
        modalZonaTitulo.textContent = 'Editar zona';
        modalZonaNombre.value = zona.Nombre;
        inputColorZona.value = colorParaInput(zona.Color || grupo?.color, COLOR_ZONA_DEFECTO);
        modalZonaRango.textContent = celdasGrupo.length > 1
            ? `${celdasGrupo.length} celdas en la zona`
            : `Celda: fila ${celdasGrupo[0].fila}, columna ${celdasGrupo[0].columna}`;
    } else {
        if (celdasZonaSeleccionadas.length === 0) {
            alert('Primero selecciona al menos una celda.');
            return;
        }
        modalZonaTitulo.textContent = celdasZonaSeleccionadas.length > 1
            ? `Nueva zona (${celdasZonaSeleccionadas.length} celdas)`
            : 'Nueva zona';
        modalZonaNombre.value = '';
        inputColorZona.value = COLOR_ZONA_DEFECTO;
        modalZonaRango.textContent = celdasZonaSeleccionadas.length === 1
            ? `Celda seleccionada: fila ${celdasZonaSeleccionadas[0].fila}, columna ${celdasZonaSeleccionadas[0].columna}`
            : `${celdasZonaSeleccionadas.length} celdas seleccionadas`;
    }

    if (modalZonaEliminar) {
        /* Solo se ofrece eliminar al editar y si el rol tiene el permiso. */
        const puedeEliminar = !window.PermisosUI || window.PermisosUI.puede('plano:zonas:eliminar');
        modalZonaEliminar.hidden = !zona || !puedeEliminar;
    }
    modalZona.style.display = 'flex';

    setTimeout(() => {
        modalZonaNombre.focus();
        modalZonaNombre.select();
    }, 50);
}

modalZonaCancelar.addEventListener('click', () => {
    modalZona.style.display = 'none';
    zonaEditando = null;
    zonaGrupoEditando = null;
    celdasZonaSeleccionadas = [];
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

/* Eliminar desde el propio modal: misma operación que la lista lateral,
   así el CRUD queda coherente en los dos puntos de entrada. */
function eliminarZonaDelModal() {
    const grupo = zonaGrupoEditando;
    if (!grupo) return;

    modalZona.style.display = 'none';
    mostrarConfirmacion(
        'Eliminar zona',
        `¿Eliminar la zona <b>"${grupo.nombre}"</b> (${grupo.zonas.length} celda(s))?<br>
         <span style="color:#64748b;font-size:0.85rem;">Los equipos permanecerán en sus posiciones.</span>`,
        async () => {
            try {
                const res = await window.api.plano.eliminarZonasPorNombre(
                    panelActivo.idPiso, grupo.nombre, grupo.color
                );
                if (!res || res.ok === false) {
                    mostrarToast(res?.mensaje || 'No se pudo eliminar la zona', 'error', 4000);
                    return;
                }
                mostrarToast(res.mensaje || `Zona "${grupo.nombre}" eliminada`, 'exito');
            } catch (err) {
                mostrarToast('Error al eliminar: ' + err.message, 'error', 4000);
                return;
            }
            zonaEditando = null;
            zonaGrupoEditando = null;
            celdasZonaSeleccionadas = [];
            await recargarPanel(panelActivo);
        },
        'plano:zonas:eliminar'
    );
}

if (modalZonaEliminar) {
    modalZonaEliminar.addEventListener('click', eliminarZonaDelModal);
}

modalZonaAceptar.addEventListener('click', async () => {
    const nombre = modalZonaNombre.value.trim();
    const color = inputColorZona.value || COLOR_ZONA_DEFECTO;

    if (!nombre) { alert('El nombre es obligatorio.'); modalZonaNombre.focus(); return; }
    if (!panelActivo.idPiso) { alert('Selecciona un piso en el panel activo.'); return; }

    const celdas = celdasZonaSeleccionadas.map(c => ({
        fila: Number(c.fila),
        columna: Number(c.columna)
    }));
    if (celdas.length === 0) { alert('No hay celdas seleccionadas.'); return; }

    modalZonaAceptar.disabled = true;
    try {
        /* Siempre se envían las celdas: crear, renombrar, recolorear y recolocar
           son la misma operación en la capa de datos. */
        const res = zonaGrupoEditando
            ? await window.api.plano.actualizarZonasPorNombre(
                panelActivo.idPiso,
                zonaGrupoEditando.nombre,
                zonaGrupoEditando.color,
                nombre,
                color,
                celdas
            )
            : await window.api.plano.crearZona(panelActivo.idPiso, nombre, color, celdas);

        if (!res || res.ok === false) {
            mostrarToast(res?.mensaje || 'No se pudo guardar la zona', 'error', 4000);
            modalZonaAceptar.disabled = false;
            return;
        }

        mostrarToast(
            zonaGrupoEditando
                ? (res.mensaje || `Zona "${nombre}" actualizada`)
                : (celdas.length === 1
                    ? `Zona "${nombre}" creada en (${celdas[0].fila}, ${celdas[0].columna})`
                    : `Zona "${nombre}" creada (${celdas.length} celdas)`),
            'exito'
        );
    } catch (err) {
        mostrarToast('Error al guardar zona: ' + err.message, 'error', 4000);
        modalZonaAceptar.disabled = false;
        return;
    }

    modalZonaAceptar.disabled = false;
    modalZona.style.display = 'none';
    zonaEditando = null;
    zonaGrupoEditando = null;
    celdasZonaSeleccionadas = [];
    await recargarPanel(panelActivo);
});

/* =========================================================
   MODAL ZONA LIBRE
   ========================================================= */
function abrirModalZonaLibre(grupo = null) {
    if (guardandoZonaLibre) return;
    if (!grupo && celdasLibresSeleccionadas.length === 0) {
        alert('Primero selecciona una o más celdas vacías.');
        return;
    }

    guardandoZonaLibre = true;
    zonaLibreEditando = grupo;
    modalZonaLibreTitulo.textContent = grupo ? 'Editar zona libre' : 'Nueva zona libre';
    modalZonaLibreNombre.value = grupo?.nombre || '';
    inputColorZonaLibre.value = colorParaInput(grupo?.color, COLOR_ZONA_LIBRE_DEFECTO);
    if (grupo) {
        celdasLibresSeleccionadas = grupo.celdas.map(celda => ({
            fila: celda.Fila,
            columna: celda.Columna
        }));
    }
    if (modalZonaLibreEliminar) {
        const puedeEliminar = !window.PermisosUI || window.PermisosUI.puede('plano:zonas:eliminar');
        modalZonaLibreEliminar.hidden = !grupo || !puedeEliminar;
    }
    modalZonaLibreCeldas.textContent = `Celdas seleccionadas: ${celdasLibresSeleccionadas.length}`;
    modalZonaLibre.style.display = 'flex';

    setTimeout(() => {
        modalZonaLibreNombre.focus();
        modalZonaLibreNombre.select();
    }, 50);
}

modalZonaLibreCancelar.addEventListener('click', () => {
    modalZonaLibre.style.display = 'none';
    guardandoZonaLibre = false;
    zonaLibreEditando = null;
    celdasLibresSeleccionadas = [];
    renderGridPanel(panelIzq);
    renderGridPanel(panelDer);
});

function eliminarZonaLibreDelModal() {
    const grupo = zonaLibreEditando;
    if (!grupo) return;

    modalZonaLibre.style.display = 'none';
    guardandoZonaLibre = false;

    mostrarConfirmacion(
        'Eliminar zona libre',
        `¿Eliminar la zona libre <b>"${grupo.nombre}"</b> (${grupo.celdas.length} celda(s))?`,
        async () => {
            try {
                const res = await window.api.plano.eliminarZonaLibre(
                    panelActivo.idPiso, grupo.nombre, grupo.color
                );
                if (!res || res.ok === false) {
                    mostrarToast(res?.mensaje || 'No se pudo eliminar la zona libre', 'error', 4000);
                    return;
                }
                mostrarToast(res.mensaje || `Zona libre "${grupo.nombre}" eliminada`, 'exito');
            } catch (err) {
                mostrarToast('Error al eliminar: ' + err.message, 'error', 4000);
                return;
            }
            zonaLibreEditando = null;
            celdasLibresSeleccionadas = [];
            await recargarPanel(panelActivo);
        },
        'plano:zonas:eliminar'
    );
}

if (modalZonaLibreEliminar) {
    modalZonaLibreEliminar.addEventListener('click', eliminarZonaLibreDelModal);
}

modalZonaLibreAceptar.addEventListener('click', async () => {
    if (!guardandoZonaLibre) return;

    const nombre = modalZonaLibreNombre.value.trim();
    const color = inputColorZonaLibre.value || COLOR_ZONA_LIBRE_DEFECTO;
    if (!nombre) { alert('El texto es obligatorio.'); modalZonaLibreNombre.focus(); return; }
    if (!panelActivo.idPiso) { alert('Selecciona un piso primero.'); return; }
    if (celdasLibresSeleccionadas.length === 0) { alert('No hay celdas seleccionadas.'); return; }

    modalZonaLibreAceptar.disabled = true;

    const celdas = celdasLibresSeleccionadas.map(c => ({
        fila: Number(c.fila),
        columna: Number(c.columna)
    }));

    try {
        /* Las celdas se envían siempre: editar también puede mover el bloque. */
        const res = zonaLibreEditando
            ? await window.api.plano.actualizarZonaLibre(
                panelActivo.idPiso,
                zonaLibreEditando.nombre,
                zonaLibreEditando.color,
                nombre,
                color,
                celdas
            )
            : await window.api.plano.guardarZonaLibre(
                panelActivo.idPiso, nombre, color, celdas
            );
        if (!res || res.ok === false) {
            throw new Error(res?.mensaje || 'No se pudo guardar la zona libre');
        }
        mostrarToast(res.mensaje || `Zona libre "${nombre}" guardada`, 'exito');
    } catch (err) {
        mostrarToast('Error al guardar: ' + err.message, 'error', 4000);
        modalZonaLibreAceptar.disabled = false;
        return;
    }

    modalZonaLibre.style.display = 'none';
    modalZonaLibreAceptar.disabled = false;
    guardandoZonaLibre = false;
    zonaLibreEditando = null;
    celdasLibresSeleccionadas = [];
    await recargarPanel(panelActivo);
});

/* =========================================================
   MODAL EDITAR EQUIPO — FLUJO TIPO equipos.js
   ---------------------------------------------------------
   FIXES APLICADOS:
   1) edCargarPisosDelCliente ahora incluye el piso actual
      del equipo aunque no esté vinculado al cliente.
   2) edActualizarCamposSegunTipo ahora DESHABILITA y limpia
      los campos de la sección oculta (evita validaciones
      fantasma y datos residuales).
   3) Validaciones y UI según tipo IP (DHCP no pide red,
      no pide IP, no pide número host; Estática no pide
      hostname libre).
   4) Indicadores visuales de campos obligatorios y estados.
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

function edSetSelectValorConHuerfano(select, valor, etiquetaHuerfano) {
    if (!select) return;
    if (!valor) { select.value = ''; return; }
    const existe = Array.from(select.options).some(o => o.value === String(valor));
    if (!existe) {
        const opt = document.createElement('option');
        opt.value = valor;
        opt.textContent = etiquetaHuerfano || `${valor} (valor guardado, no está en catálogo)`;
        opt.style.color = '#b7791f';
        opt.style.fontStyle = 'italic';
        select.appendChild(opt);
    }
    select.value = String(valor);
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

/**
 * FIX PRINCIPAL:
 * Carga los pisos del cliente seleccionado.
 * Si se pasa `idPisoActual`, se asegura de incluirlo en la lista
 * aunque el piso ya no esté vinculado al cliente.
 */
async function edCargarPisosDelCliente(idCliente, idPisoActual = null) {
    if (!edPiso) return;
    if (!idCliente) {
        edLimpiarSelectConMensaje(edPiso, '-- Selecciona un cliente primero --');
        return;
    }
    try {
        const todos = await window.api.pisos.listar();

        // Pisos que pertenecen al cliente
        edPisosCliente = todos.filter(p =>
            (p.clientes || []).some(c => Number(c.IdCliente) === Number(idCliente))
        );

        // FIX: si el equipo tiene un piso guardado que NO está en la lista del cliente,
        // lo agregamos igual para no perder la referencia.
        if (idPisoActual != null) {
            const yaExiste = edPisosCliente.some(
                p => Number(p.IdPiso) === Number(idPisoActual)
            );
            if (!yaExiste) {
                const pisoGuardado = todos.find(
                    p => Number(p.IdPiso) === Number(idPisoActual)
                );
                if (pisoGuardado) {
                    edPisosCliente.push(pisoGuardado);
                }
            }
        }

        edPiso.disabled = false;
        edPiso.innerHTML = '<option value="">-- Selecciona un piso --</option>';

        // Ordenar por nombre para consistencia visual
        edPisosCliente.sort((a, b) =>
            String(a.Nombre).localeCompare(String(b.Nombre))
        );

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

/**
 * FIX: actualiza visibilidad, DISABLED y LIMPIEZA de campos
 * según el tipo de IP seleccionado.
 *
 * Estática:
 *   - Muestra: IP, Número host, Hostname (auto/manual), Red (máscara, puerta, DNS)
 *   - Oculta: hostname DHCP libre
 *
 * DHCP:
 *   - Muestra: hostname libre
 *   - Oculta y DESHABILITA: IP, Número host, Hostname auto, Red completa
 *   - Al guardar NO se envían esos campos (van como null)
 */
function edActualizarCamposSegunTipo() {
    if (!edTipoIP) return;
    const tipo = edTipoIP.value;
    const esEstatica = tipo === 'Estatica';

    if (esEstatica) {
        // Mostrar bloques de Estática
        if (edCampoHostEst) edCampoHostEst.classList.remove('campo-oculto');
        if (edCampoHostDHCP) edCampoHostDHCP.classList.add('campo-oculto');
        if (edFilaCheckbox) edFilaCheckbox.style.display = 'flex';
        if (edSeccionRed) edSeccionRed.style.display = 'block';

        // Habilitar campos de Estática
        [edIP, edNumeroHost, edHostnamePreview, edMascara, edPuerta, edDns1, edDns2]
            .forEach(el => { if (el) el.disabled = false; });

        // Deshabilitar y limpiar hostname DHCP
        if (edHostnameLibre) {
            edHostnameLibre.disabled = true;
            edHostnameLibre.value = '';
        }
    } else {
        // DHCP: ocultar bloques de Estática
        if (edCampoHostEst) edCampoHostEst.classList.add('campo-oculto');
        if (edCampoHostDHCP) edCampoHostDHCP.classList.remove('campo-oculto');
        if (edFilaCheckbox) edFilaCheckbox.style.display = 'none';
        if (edSeccionRed) edSeccionRed.style.display = 'none';

        // Deshabilitar campos de Estática
        [edIP, edNumeroHost, edHostnamePreview, edMascara, edPuerta, edDns1, edDns2]
            .forEach(el => { if (el) el.disabled = true; });

        // Limpiar valores residuales (para que no se envíen al backend)
        if (edIP) edIP.value = '';
        if (edNumeroHost) edNumeroHost.value = '';
        if (edHostnamePreview) edHostnamePreview.value = '';
        if (edMascara) edMascara.value = '';
        if (edPuerta) edPuerta.value = '';
        if (edDns1) edDns1.value = '';
        if (edDns2) edDns2.value = '';

        // Habilitar hostname DHCP
        if (edHostnameLibre) edHostnameLibre.disabled = false;
    }

    // Actualizar indicador de campos obligatorios visibles
    edActualizarIndicadoresObligatorios();
}

/**
 * FIX UI/UX: resalta visualmente los campos obligatorios según
 * el tipo de IP seleccionado.
 */
function edActualizarIndicadoresObligatorios() {
    const esEstatica = edTipoIP && edTipoIP.value === 'Estatica';

    // Marcar/desmarcar campos como "requerido" visualmente
    const camposRequeridos = esEstatica
        ? [edIP, edMascara, edPuerta, edDns1, edUsuario, edPassword]
        : [edHostnameLibre, edUsuario, edPassword];

    // Limpiar clases
    document.querySelectorAll('#modal-editar-equipo .campo-obligatorio')
        .forEach(el => el.classList.remove('campo-obligatorio'));

    camposRequeridos.forEach(el => {
        if (!el) return;
        // Buscar el wrapper del campo (div padre)
        const wrap = el.closest('div');
        if (wrap) wrap.classList.add('campo-obligatorio');
    });
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

    // FIX: usar equipo.IdPiso o, si no viene, el piso del panel activo
    const idPisoReal = equipo.IdPiso ?? panel.idPiso;

    if (editarTitulo) editarTitulo.textContent = `Editar equipo — ${equipo.Hostname}`;
    const posicion = equipo._fila != null && equipo._col != null
        ? `Fila ${equipo._fila}, Columna ${equipo._col}`
        : 'Sin ubicar';
    if (editarInfo) editarInfo.innerHTML = `
        <div><b>Posición:</b> ${posicion}</div>
        <div><b>Cliente actual:</b> ${equipo.ClienteCodigo || '—'}</div>
        <div><b>Rol actual:</b> ${equipo.RolCodigo || '—'}</div>
        <div><b>Piso:</b> ${pisos.find(p => Number(p.IdPiso) === Number(idPisoReal))?.Nombre || ''}</div>
        ${panel.escenarioFuturoId ? '<div><b>Propuesta temporal:</b> los cambios no modifican el equipo original.</div>' : ''}
    `;
    editarConfirmar.textContent = panel.escenarioFuturoId ? 'Guardar en copia futura' : 'Guardar cambios';

    if (editarMensaje) { editarMensaje.style.display = 'none'; editarMensaje.textContent = ''; }

    edLlenarSelectClientes();
    edLlenarSelectRoles();

    if (edCliente) edCliente.value = equipo.IdCliente != null ? String(equipo.IdCliente) : '';

    // FIX: al cargar pisos, incluir el piso actual del equipo
    if (equipo.IdCliente != null) {
        await edCargarPisosDelCliente(equipo.IdCliente, idPisoReal);
        if (idPisoReal && edPiso) {
            const pisoObj = pisos.find(p => Number(p.IdPiso) === Number(idPisoReal));
            edSetSelectValorConHuerfano(
                edPiso,
                String(idPisoReal),
                `${pisoObj?.Nombre || 'Piso ' + idPisoReal} (no vinculado al cliente)`
            );
        }
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

    // Primero actualizamos visibilidad/disabled según tipo
    edActualizarCamposSegunTipo();

    // Luego rellenamos valores (solo los que aplican según tipo)
    if (equipo.TipoIP === 'Estatica') {
        if (edIP) edIP.value = equipo.IP || '';
        if (edNumeroHost) edNumeroHost.value = equipo.NumeroHost ?? '';
        if (edHostnamePreview) edHostnamePreview.value = equipo.Hostname || '';

        edSetSelectValorConHuerfano(edMascara, equipo.Mascara || '');
        edSetSelectValorConHuerfano(edPuerta,  equipo.PuertaEnlace || '');
        edSetSelectValorConHuerfano(edDns1,    equipo.DNS1 || '');
        edSetSelectValorConHuerfano(edDns2,    equipo.DNS2 || '');

        // ============================================================
        // FIX PRINCIPAL: recalcular NúmeroHost y HostnamePreview
        // aunque el usuario no haya tocado el input de IP.
        // ============================================================
        edActualizarNumeroHost();
        // Si el checkbox manual está desmarcado, reconstruir el hostname
        // a partir de rol + cliente + IP (para que se vea consistente).
        // Si el checkbox está marcado, respetar el hostname guardado.
        if (!edChkManual.checked) {
            const idRol = parseInt(edRol.value, 10);
            const idCli = parseInt(edCliente.value, 10);
            const ip = edIP.value.trim();
            const autoHost = edConstruirHostname(idRol, idCli, ip);
            // Si el auto-generado coincide con el guardado, usarlo;
            // si no coincide (porque el hostname guardado era custom),
            // respetar el guardado y marcar el checkbox manual.
            if (autoHost && autoHost !== equipo.Hostname) {
                // El hostname guardado NO coincide con el auto-generado
                // → activar modo manual y dejar el guardado
                if (edChkManual) edChkManual.checked = true;
                if (edHostnamePreview) {
                    edHostnamePreview.readOnly = false;
                    edHostnamePreview.value = equipo.Hostname || '';
                }
            } else {
                // Coincide o no se pudo construir → usar el guardado
                if (edHostnamePreview) edHostnamePreview.value = equipo.Hostname || autoHost || '';
            }
        }
    } else {
        if (edHostnameLibre) edHostnameLibre.value = equipo.Hostname || '';
    }

    edSetSelectValorConHuerfano(edUsuario, equipo.UsuarioAdmin || '');
    if (edPassword) edPassword.value = equipo.PasswordAdmin ?? '';

    if (modalEditarEquipo) modalEditarEquipo.style.display = 'flex';
    /* El aviso de rango se calcula con los valores ya cargados del equipo. */
    edActualizarHintRango();
    setTimeout(() => { if (edCliente) edCliente.focus(); }, 60);
}

if (edCliente) {
    edCliente.addEventListener('change', async () => {
        const id = parseInt(edCliente.value, 10);
        edLimpiarSelectConMensaje(edPiso, '-- Cargando... --');
        if (id) {
            // En cambio manual de cliente, no hay piso "actual" que preservar
            await edCargarPisosDelCliente(id, null);
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

function cerrarModalEditarEquipo() {
    if (!modalEditarEquipo) return;
    modalEditarEquipo.style.display = 'none';
    equipoEditando = null;
    edGuardando = false;
}

if (editarCerrar) {
    editarCerrar.addEventListener('click', cerrarModalEditarEquipo);
}

/* Escape cierra el modal de Editar Equipo en cualquier estado,
   sin depender del guard de los módulos de zona. */
document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!modalEditarEquipo || modalEditarEquipo.style.display !== 'flex') return;
    ev.preventDefault();
    ev.stopPropagation();
    cerrarModalEditarEquipo();
});

function edMostrarError(texto) {
    if (!editarMensaje) return;
    editarMensaje.textContent = texto;
    editarMensaje.className = 'mensaje error';
    editarMensaje.style.display = 'block';
}

/* =========================================================
   RANGOS IP EN EL PLANO

   La edición de equipos desde el Plano (modal Editar Equipo y modal
   Mover entre pisos → "Editar datos del equipo") aplica exactamente la
   misma norma que la página de Equipos: si el cliente tiene rangos
   declarados, la IP estática debe caer dentro del rango del perfil.
   El backend ya la bloquea; aquí se avisa en línea y se explica el
   motivo para que no haya incoherencias entre pantallas.
   ========================================================= */
const edIPHint = document.getElementById('ed-ip-hint');
const mvIPHint = document.getElementById('mv-ip-hint');
const RE_IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

let tokenHintRangoEd = 0;
let tokenHintRangoMv = 0;

function limpiarHintRango(hint) {
    if (!hint) return;
    hint.textContent = '';
    hint.className = 'ayuda-rango oculto';
}

function aplicarHintRango(hint, info) {
    if (!hint) return;
    if (!info) { limpiarHintRango(hint); return; }
    hint.textContent = info.texto;
    hint.className = 'ayuda-rango ' + info.clase;
}

/* Consulta el rango autorizado. Devuelve null cuando no aplica (DHCP, sin
   cliente, IP incompleta o error de comunicación) para no mostrar ruido. */
async function resolverHintRango(idCliente, idRol, tipoIP, ip) {
    if (tipoIP !== 'Estatica' || !idCliente || !RE_IPV4.test(ip)) return null;
    try {
        const res = await window.api.rangos.validarIP(idCliente, idRol || null, ip);
        if (res && res.ok === false && res.aplica) {
            return { clase: 'alerta', texto: res.mensaje || 'La IP está fuera del rango autorizado.' };
        }
        if (res && res.rango) {
            return {
                clase: 'ok',
                texto: `Dentro del rango permitido (${res.rango.IPInicio} – ${res.rango.IPFin}).`
            };
        }
        return {
            clase: 'neutra',
            texto: 'Este cliente no tiene rangos configurados: la IP no se restringe.'
        };
    } catch (_) {
        return null;
    }
}

async function edActualizarHintRango() {
    const token = ++tokenHintRangoEd;
    const info = await resolverHintRango(
        parseInt(edCliente.value, 10),
        parseInt(edRol.value, 10),
        edTipoIP.value,
        edIP.value.trim()
    );
    if (token !== tokenHintRangoEd) return;
    aplicarHintRango(edIPHint, info);
}

async function mvActualizarHintRango() {
    const token = ++tokenHintRangoMv;
    const info = await resolverHintRango(
        parseInt(mvCliente.value, 10),
        parseInt(mvRol.value, 10),
        mvTipoIP.value,
        mvIP.value.trim()
    );
    if (token !== tokenHintRangoMv) return;
    aplicarHintRango(mvIPHint, info);
}

/* Aviso explícito cuando el backend rechaza la IP por rango (mismo mensaje
   que ve el usuario en la página de Equipos). */
async function alertaRangoIP(res, ip) {
    const permitidos = (res?.detalle?.aplicables || [])
        .map(r => `${r.IPInicio} – ${r.IPFin}`)
        .join(', ');
    const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    await window.Swal.fire({
        icon: 'warning',
        title: 'IP fuera de rango',
        html: `<div style="text-align:left;font-size:0.9rem;">
            ${escapar(res?.mensaje || 'La IP no está dentro del rango autorizado.')}<br><br>
            <div style="background:#FFF7E8;padding:10px;border-radius:6px;border-left:3px solid #A99A63;">
                <b>IP capturada:</b> ${escapar(ip || '')}<br>
                <b>Rangos permitidos:</b> ${escapar(permitidos || 'Sin rangos para este perfil')}
            </div>
            <p style="margin-top:10px;color:#7a7563;">
                Ajusta la IP o configura el rango en <b>Equipos → Rangos IP</b>.
            </p></div>`,
        confirmButtonText: 'Entendido',
        buttonsStyling: false,
        customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
    });
}

if (edIP) {
    edIP.addEventListener('input', edActualizarHintRango);
    edIP.addEventListener('blur', edActualizarHintRango);
}
if (edCliente) edCliente.addEventListener('change', edActualizarHintRango);
if (edRol) edRol.addEventListener('change', edActualizarHintRango);
if (edTipoIP) edTipoIP.addEventListener('change', edActualizarHintRango);

if (mvIP) {
    mvIP.addEventListener('input', mvActualizarHintRango);
    mvIP.addEventListener('blur', mvActualizarHintRango);
}
if (mvCliente) mvCliente.addEventListener('change', mvActualizarHintRango);
if (mvRol) mvRol.addEventListener('change', mvActualizarHintRango);
if (mvTipoIP) mvTipoIP.addEventListener('change', mvActualizarHintRango);

if (editarConfirmar) {
    editarConfirmar.addEventListener('click', async () => {
        if (!equipoEditando || edGuardando) return;

        const { equipo, panel } = equipoEditando;
        const tipo = edTipoIP.value;
        const esEstatica = tipo === 'Estatica';
        let hostnameFinal;

        // === VALIDACIÓN DE HOSTNAME SEGÚN TIPO ===
        if (esEstatica) {
            if (edChkManual.checked) {
                hostnameFinal = edHostnamePreview.value.trim();
                if (!hostnameFinal) {
                    edMostrarError('Escribe el hostname manualmente o desmarca la casilla.');
                    return;
                }
            } else {
                const idRol = parseInt(edRol.value, 10);
                const idCli = parseInt(edCliente.value, 10);
                const ip = edIP.value.trim();
                hostnameFinal = edConstruirHostname(idRol, idCli, ip);
                if (!hostnameFinal) {
                    edMostrarError('No se pudo armar el hostname. Verifica cliente, rol e IP.');
                    return;
                }
            }
        } else {
            hostnameFinal = edHostnameLibre.value.trim();
            if (!hostnameFinal) {
                edMostrarError('El hostname es obligatorio.');
                return;
            }
        }

        // === CONSTRUCCIÓN DEL PAYLOAD ===
        const datos = {
            idCliente:      parseInt(edCliente.value, 10),
            idPiso:         edPiso.value ? parseInt(edPiso.value, 10) : null,
            idRolEquipo:    parseInt(edRol.value, 10),
            tipoIP:         tipo,
            hostname:       hostnameFinal,
            numeroHost:     esEstatica ? parseInt(edNumeroHost.value, 10) : null,
            ip:             esEstatica ? (edIP.value.trim() || null) : null,
            /* El rango se resuelve en el backend a partir del cliente, el
               perfil y la IP: nunca se confía en lo que mande la pantalla. */
            mascara:        esEstatica ? (edMascara.value || null) : null,
            puertaEnlace:   esEstatica ? (edPuerta.value  || null) : null,
            dns1:           esEstatica ? (edDns1.value    || null) : null,
            dns2:           esEstatica ? (edDns2.value    || null) : null,
            usuarioAdmin:   edUsuario.value || null,
            passwordAdmin:  edPassword.value.trim() || null,
            activo:         true
        };

        // === VALIDACIONES GENERALES ===
        if (!datos.idCliente)   { edMostrarError('El cliente es obligatorio.'); return; }
        if (!datos.idRolEquipo) { edMostrarError('El rol es obligatorio.'); return; }
        if (!datos.hostname)    { edMostrarError('El hostname es obligatorio.'); return; }

        // Usuario/password: obligatorios siempre (según lógica original)
        if (!datos.usuarioAdmin)  { edMostrarError('El usuario admin es obligatorio.'); return; }
        if (!datos.passwordAdmin) { edMostrarError('El password admin es obligatorio.'); return; }

        // === VALIDACIONES ESPECÍFICAS DE ESTÁTICA ===
        if (esEstatica) {
            if (!datos.idPiso)       { edMostrarError('El piso es obligatorio para equipos estáticos.'); return; }
            if (!datos.ip)           { edMostrarError('La IP es obligatoria para equipos estáticos.'); return; }
            if (!datos.mascara)      { edMostrarError('La máscara es obligatoria.'); return; }
            if (!datos.puertaEnlace) { edMostrarError('La puerta de enlace es obligatoria.'); return; }
            if (!datos.dns1)         { edMostrarError('El DNS 1 es obligatorio.'); return; }
        }
        // DHCP no valida idPiso, ip, mascara, puerta, dns1, dns2

        edGuardando = true;
        editarConfirmar.disabled = true;
        editarConfirmar.textContent = 'Guardando...';

        try {
            const res = panel.escenarioFuturoId
                ? await window.api.plano.editarEquipoFuturo(panel.escenarioFuturoId, equipo.IdEquipo, datos)
                : await window.api.equipos.actualizar(equipo.IdEquipo, datos);

            if (res && res.ok) {
                modalEditarEquipo.style.display = 'none';
                equipoEditando = null;
                mostrarToast(
                    panel.escenarioFuturoId
                        ? `Equipo "${datos.hostname}" actualizado solo en la copia futura`
                        : `Equipo "${datos.hostname}" actualizado correctamente`,
                    'exito',
                    3200
                );
                await recargarPanel(panel);
                return;
            }

            if (res && res.tipo === 'ip-fuera-de-rango') {
                edMostrarError(res.mensaje || 'La IP está fuera del rango autorizado para este cliente y perfil.');
                await alertaRangoIP(res, datos.ip);
                edActualizarHintRango();
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
            editarConfirmar.textContent = panel.escenarioFuturoId ? 'Guardar en copia futura' : 'Guardar cambios';
        }
    });
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => {
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
    if (!doble) panelActivo = panelIzq;
    actualizarControlesFuturos(panelActivo);

    if (doble && !panelDer.idPiso) {
        cargarPisosPanel(panelDer, false);
    } else if (doble && panelDer.idPiso) {
        /* El panel derecho estuvo oculto: sus medidas eran 0 y el riel de zonas
           no se pudo dibujar. Al mostrarlo se vuelve a renderizar. */
        renderGridPanel(panelDer);
    }
});

/* =========================================================
   SELECCIÓN EN BLOQUE (BANDA) PARA ZONAS
   ========================================================= */
function claveCelda(fila, columna) {
    return `${fila},${columna}`;
}

/* Todas las celdas del rectángulo que va del ancla hasta la celda actual. */
function celdasDelRectangulo(ancla, hasta) {
    const filaA = Math.min(ancla.fila, hasta.fila);
    const filaB = Math.max(ancla.fila, hasta.fila);
    const colA = Math.min(ancla.columna, hasta.columna);
    const colB = Math.max(ancla.columna, hasta.columna);

    const salida = [];
    for (let fila = filaA; fila <= filaB; fila++) {
        for (let columna = colA; columna <= colB; columna++) {
            salida.push({ fila, columna });
        }
    }
    return salida;
}

/* Pinta las celdas marcadas sin reconstruir la grilla: la banda tiene que
   seguir al ratón en vivo y reconstruir en cada movimiento parpadea. */
function pintarSeleccionZona() {
    if (!panelActivo) return;
    const grid = panelActivo.sufijo === 'izq' ? gridIzq : gridDer;
    if (!grid) return;

    const marcadas = new Set(celdasZonaSeleccionadas.map(c => claveCelda(c.fila, c.columna)));
    grid.querySelectorAll('.celda').forEach(celda => {
        celda.classList.toggle(
            'seleccionada',
            marcadas.has(claveCelda(Number(celda.dataset.fila), Number(celda.dataset.columna)))
        );
    });
}

function iniciarArrastreZona(ev, fila, columna) {
    arrastreZona = {
        ancla: { fila, columna },
        base: celdasZonaSeleccionadas.map(c => ({ fila: c.fila, columna: c.columna })),
        sustraer: Boolean(ev.shiftKey || ev.altKey),
        movido: false
    };
    arrastreZonaTerminado = false;
    document.body.classList.add('seleccionando-grupo');
}

/* Suma (o resta, con Shift) el rectángulo ancla→celda a la selección actual. */
function extenderArrastreZona(fila, columna) {
    if (!arrastreZona) return;

    const destino = celdasDelRectangulo(arrastreZona.ancla, { fila, columna });
    const mapa = new Map(arrastreZona.base.map(c => [claveCelda(c.fila, c.columna), c]));

    for (const celda of destino) {
        const clave = claveCelda(celda.fila, celda.columna);
        if (arrastreZona.sustraer) mapa.delete(clave);
        else if (!mapa.has(clave)) mapa.set(clave, celda);
    }

    if (fila !== arrastreZona.ancla.fila || columna !== arrastreZona.ancla.columna) {
        arrastreZona.movido = true;
    }

    celdasZonaSeleccionadas = [...mapa.values()];
    pintarSeleccionZona();
    actualizarBotonesModo();
}

function finalizarArrastreZona() {
    if (!arrastreZona) return;
    arrastreZonaTerminado = arrastreZona.movido;
    arrastreZona = null;
    document.body.classList.remove('seleccionando-grupo');
    actualizarBotonesModo();
}

/* El mouseup puede ocurrir fuera de la grilla: se escucha en el documento. */
document.addEventListener('mouseup', finalizarArrastreZona);

/* =========================================================
   MODO ZONA (varias celdas → una sola zona con nombre)
   ========================================================= */
btnModoZona.addEventListener('click', () => {
    /* Con celdas ya marcadas, este clic significa "ponle nombre al grupo".
       Antes apagaba el modo y borraba la selección, que es justo lo que hacía
       parecer que solo se podían crear zonas de 1×1. */
    if (modoZona && celdasZonaSeleccionadas.length > 0) {
        abrirModalZona(null);
        return;
    }

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
    actualizarBotonesModo();   /* reinicia el contador del botón de zona */
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
const ICONO_MODO_ZONA = `
    <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
    </svg>`;

function actualizarBotonesModo() {
    if (modoZona) {
        /* Contador en vivo: el usuario ve cuántas celdas lleva agrupadas antes
           de pulsar Enter, que es cuando se le pide el nombre del grupo. */
        const seleccionadas = celdasZonaSeleccionadas.length;
        btnModoZona.classList.add('activo');
        btnModoZona.innerHTML = `${ICONO_MODO_ZONA}${seleccionadas > 0
            ? `Agrupar zona — ${seleccionadas} celda${seleccionadas === 1 ? '' : 's'} · Enter`
            : 'Agrupar zona — elige celdas'}`;
        btnModoZona.title = seleccionadas > 0
            ? `Clic aquí o Enter para nombrar el grupo de ${seleccionadas} celda${seleccionadas === 1 ? '' : 's'}.`
            : 'Arrastra sobre la grilla para marcar el grupo de golpe (o clic celda a celda; Shift resta). Después clic aquí o Enter para ponerle nombre.';
        btnLimpiarSeleccion.style.display = 'inline-block';
    } else {
        btnModoZona.classList.remove('activo');
        btnModoZona.innerHTML = `${ICONO_MODO_ZONA}Agrupar en zona`;
        btnModoZona.title = 'Selecciona varias celdas y dales un nombre (MESA 1, etc.). El indicador se dibuja fuera del canvas, sin tapar equipos.';
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
        wrapper.classList.remove('con-riel');
        wrapper.querySelectorAll('.texto-zona-libre-overlay').forEach(el => el.remove());
    }
}

/* =========================================================
   CARGA DE DATOS
   ========================================================= */

// plano-renderer.js

async function cargarClientes() {
    try {
        const res = await window.api.clientes.listar();
        if (Array.isArray(res)) {
            clientes = res;
        } else {
            console.warn('No se pudieron cargar los clientes:', res);
            clientes = [];
        }
    } catch (err) {
        console.error('Error al cargar clientes:', err);
        clientes = [];
    }
}

async function cargarPisosPanel(panel, seleccionarPrimero) {
    try {
        const todos = await window.api.pisos.listar();
        
        // VALIDACIÓN CLAVE: Si no es un array, salimos.
        if (!Array.isArray(todos)) {
            console.error('El backend no devolvió una lista de pisos:', todos);
            const select = panel.sufijo === 'izq' ? selectLugarIzq : selectLugarDer;
            select.innerHTML = '<option value="">Error al cargar pisos</option>';
            return;
        }

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
    } catch (err) {
        console.error('Error en cargarPisosPanel:', err);
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
        chip.dataset.color = String(c.Codigo || '').toUpperCase();
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
        actualizarControlesFuturos(panel);

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
        }, 'plano:editar-dim');
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

    // ============================================================
    // FIX DE RENDIMIENTO: ejecutar todas las queries en PARALELO
    // en lugar de secuencialmente. Reduce el tiempo total de
    // carga de ~5 round-trips a 1 (el más lento).
    // ============================================================
    const [
        dimensiones,
        ubicaciones,
        equiposSinUbicar,
        zonas,
        zonasLibres,
        escenariosFuturos
    ] = await Promise.all([
        window.api.plano.dimensiones(panel.idPiso),
        window.api.plano.listarPorLugar(panel.idPiso),
        window.api.plano.sinUbicacion(panel.idPiso),
        window.api.plano.listarZonas(panel.idPiso),
        window.api.plano.listarZonasLibres(panel.idPiso),
        window.api.plano.listarFuturos(panel.idPiso)
    ]);
    if ([dimensiones, ubicaciones, equiposSinUbicar, zonas, zonasLibres, escenariosFuturos].some(respuesta =>
        respuesta?.ok === false
    )) {
        const error = [dimensiones, ubicaciones, equiposSinUbicar, zonas, zonasLibres, escenariosFuturos]
            .find(respuesta => respuesta?.ok === false);
        throw new Error(error.mensaje || 'No se pudieron cargar los datos del plano.');
    }

    panel.dimensiones = dimensiones;

    const inputFilas = panel.sufijo === 'izq' ? inputFilasIzq : inputFilasDer;
    const inputColumnas = panel.sufijo === 'izq' ? inputColumnasIzq : inputColumnasDer;
    inputFilas.value = panel.dimensiones.Filas;
    inputColumnas.value = panel.dimensiones.Columnas;

    panel.celdas = Array.from({ length: panel.dimensiones.Filas }, () =>
        Array.from({ length: panel.dimensiones.Columnas }, () => null)
    );

    ubicaciones.forEach(u => {
        const f = u.Fila - 1;
        const c = u.Columna - 1;
        if (panel.celdas[f] && panel.celdas[f][c] !== undefined) {
            panel.celdas[f][c] = {
                IdEquipo:      u.IdEquipo,
                IdCliente:     u.IdCliente,
                IdPiso:        u.IdPiso,
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

    panel.equiposSinUbicar = equiposSinUbicar;
    panel.zonas = zonas;
    panel.zonasLibres = zonasLibres;
    panel.escenariosFuturos = escenariosFuturos;
    if (panel.escenarioFuturoId &&
        !escenariosFuturos.some(escenario => Number(escenario.IdEscenarioFuturo) === Number(panel.escenarioFuturoId))) {
        panel.escenarioFuturoId = null;
    }
    if (panel.escenarioFuturoId) {
        const propuesta = await window.api.plano.ubicacionesFuturas(panel.escenarioFuturoId, panel.idPiso);
        if (!Array.isArray(propuesta)) {
            throw new Error(propuesta?.mensaje || 'No se pudo cargar la copia futura.');
        }
        const celdasPropuesta = Array.from({ length: panel.dimensiones.Filas }, () =>
            Array.from({ length: panel.dimensiones.Columnas }, () => null)
        );
        for (const ubicacion of propuesta) {
            const fila = Number(ubicacion.Fila) - 1;
            const columna = Number(ubicacion.Columna) - 1;
            if (!celdasPropuesta[fila] || celdasPropuesta[fila][columna] === undefined) continue;
            const equipo = {
                ...ubicacion,
                Cliente: ubicacion.ClienteNombre,
                Rol: ubicacion.RolNombre,
                IdPiso: Number(ubicacion.IdPisoPropuesto),
                _fila: Number(ubicacion.Fila),
                _col: Number(ubicacion.Columna),
                _movimientoFuturo:
                    Number(ubicacion.IdPisoOriginal) !== Number(ubicacion.IdPisoPropuesto) ||
                    Number(ubicacion.Fila) !== Number(ubicacion.FilaOriginal) ||
                    Number(ubicacion.Columna) !== Number(ubicacion.ColumnaOriginal)
            };
            if (ubicacion.DatosEquipoJson) {
                const cambios = JSON.parse(ubicacion.DatosEquipoJson);
                const clienteCambio = clientes.find(item => Number(item.IdCliente) === Number(cambios.idCliente));
                const rolCambio = roles.find(item => Number(item.IdRolEquipo) === Number(cambios.idRolEquipo));
                Object.assign(equipo, {
                    IdCliente: cambios.idCliente,
                    IdPiso: cambios.idPiso,
                    IdRolEquipo: cambios.idRolEquipo,
                    IdRangoIP: cambios.idRangoIP,
                    TipoIP: cambios.tipoIP,
                    Hostname: cambios.hostname,
                    NumeroHost: cambios.numeroHost,
                    IP: cambios.ip,
                    Mascara: cambios.mascara,
                    PuertaEnlace: cambios.puertaEnlace,
                    DNS1: cambios.dns1,
                    DNS2: cambios.dns2,
                    UsuarioAdmin: cambios.usuarioAdmin,
                    PasswordAdmin: cambios.passwordAdmin,
                    ClienteCodigo: clienteCambio?.Codigo || equipo.ClienteCodigo,
                    ClienteNombre: clienteCambio?.Nombre || equipo.ClienteNombre,
                    Cliente: clienteCambio?.Nombre || equipo.Cliente,
                    RolCodigo: rolCambio?.Codigo || equipo.RolCodigo,
                    RolNombre: rolCambio?.Nombre || equipo.RolNombre,
                    Rol: rolCambio?.Nombre || equipo.Rol
                });
            }
            celdasPropuesta[fila][columna] = equipo;
            const idCliente = Number(equipo.IdCliente);
            if (!panel.clientesDelPiso.some(cliente => Number(cliente.IdCliente) === idCliente)) {
                const cliente = clientes.find(item => Number(item.IdCliente) === idCliente);
                if (cliente) panel.clientesDelPiso.push(cliente);
            }
            if (idCliente) setFiltro.add(idCliente);
        }
        panel.celdas = celdasPropuesta;
        renderFiltroClientes(panel);
    }

    renderGridPanel(panel);
    if (panel === panelActivo) actualizarControlesFuturos(panel);
    if (panel === panelActivo) renderPanelLateral();
}

async function recargarPanel(panel) {
    await cargarPanel(panel);
}

function actualizarControlesFuturos(panel) {
    if (!controlesFuturo) return;
    const visible = Boolean(panel?.idPiso);
    controlesFuturo.hidden = !visible;
    selectEscenarioFuturo.replaceChildren(new Option('Plano actual', ''));
    const escenarios = new Map();
    for (const fuente of [panelIzq, panelDer]) {
        for (const escenario of fuente.escenariosFuturos || []) {
            escenarios.set(Number(escenario.IdEscenarioFuturo), escenario);
        }
    }
    for (const escenario of escenarios.values()) {
        selectEscenarioFuturo.add(new Option(escenario.Nombre, String(escenario.IdEscenarioFuturo)));
    }
    const escenarioVisible = panel?.escenarioFuturoId ||
        (panelIzq.escenarioFuturoId === panelDer.escenarioFuturoId ? panelIzq.escenarioFuturoId : null);
    selectEscenarioFuturo.value = escenarioVisible ? String(escenarioVisible) : '';
    const hayPropuesta = Boolean(panel?.escenarioFuturoId);
    btnEliminarFuturo.hidden = !hayPropuesta;
    const moverDeshabilitado = hayPropuesta;
    for (const control of [btnModoZona, btnModoZonaLibre]) {
        if (control) control.disabled = moverDeshabilitado;
    }
    const botonDimensiones = document.getElementById(`btn-aplicar-dim-${panel?.sufijo || 'izq'}`);
    if (botonDimensiones) botonDimensiones.disabled = moverDeshabilitado;
}

selectEscenarioFuturo.addEventListener('change', async () => {
    if (!panelActivo?.idPiso) return;
    const escenarioId = selectEscenarioFuturo.value ? Number(selectEscenarioFuturo.value) : null;
    const paneles = selectModo.value === 'doble' ? [panelIzq, panelDer] : [panelActivo];
    for (const panel of paneles) {
        const participa = escenarioId && panel.escenariosFuturos.some(
            escenario => Number(escenario.IdEscenarioFuturo) === escenarioId
        );
        panel.escenarioFuturoId = participa ? escenarioId : null;
    }
    if (escenarioId && paneles.some(panel => panel.escenarioFuturoId)) {
        modoZona = false;
        modoZonaLibre = false;
        modoEdicion = false;
        celdasZonaSeleccionadas = [];
        celdasLibresSeleccionadas = [];
        btnModoZona.classList.remove('activo');
        btnModoZonaLibre.classList.remove('activo');
        btnModoEdicion.classList.remove('activo');
        [gridIzq, gridDer].forEach(grid => grid?.classList.remove('modo-zona-libre'));
        actualizarBotonesModo();
    }
    try {
        await Promise.all(paneles.filter(panel => panel.idPiso).map(cargarPanel));
    } catch (error) {
        mostrarToast(error.message, 'error', 4500);
    }
});

btnCrearFuturo.addEventListener('click', async () => {
    if (!panelActivo?.idPiso) return;
    const pisosEscenario = selectModo.value === 'doble'
        ? [panelIzq.idPiso, panelDer.idPiso]
        : [panelActivo.idPiso];
    if (pisosEscenario.some(piso => !piso) ||
        (pisosEscenario.length > 1 && Number(pisosEscenario[0]) === Number(pisosEscenario[1]))) {
        mostrarToast('Selecciona dos pisos distintos para crear una propuesta entre pisos.', 'warn', 4000);
        return;
    }
    const respuesta = await window.Swal.fire({
        title: 'Crear copia futura',
        text: pisosEscenario.length > 1
            ? 'La propuesta copiará ambos pisos y permitirá mover equipos entre ellos sin cambiar el plano actual.'
            : 'La propuesta parte de una copia independiente del plano actual.',
        input: 'text',
        inputLabel: 'Nombre de la propuesta',
        inputPlaceholder: 'Ej. Reubicación de switches - diciembre',
        inputAttributes: { maxlength: 100 },
        showCancelButton: true,
        confirmButtonText: 'Crear copia',
        cancelButtonText: 'Cancelar',
        inputValidator: valor => String(valor || '').trim() ? undefined : 'Captura un nombre.'
    });
    if (!respuesta.isConfirmed) return;
    try {
        const resultado = await window.api.plano.crearFuturo(pisosEscenario, respuesta.value.trim());
        if (!resultado?.ok) {
            mostrarToast(resultado?.mensaje || 'No se pudo crear la copia.', 'error', 4500);
            return;
        }
        for (const panel of [panelIzq, panelDer]) {
            panel.escenarioFuturoId = pisosEscenario.some(piso => Number(piso) === Number(panel.idPiso))
                ? resultado.id
                : null;
        }
        modoZona = false;
        modoZonaLibre = false;
        modoEdicion = false;
        [gridIzq, gridDer].forEach(grid => grid?.classList.remove('modo-zona-libre'));
        actualizarBotonesModo();
        mostrarToast(resultado.mensaje, 'exito');
        await Promise.all(pisosEscenario.map(piso =>
            cargarPanel(Number(panelIzq.idPiso) === Number(piso) ? panelIzq : panelDer)
        ));
    } catch (error) {
        mostrarToast(error.message, 'error', 4500);
    }
});

btnEliminarFuturo.addEventListener('click', async () => {
    if (!panelActivo?.escenarioFuturoId) return;
    const idEscenario = panelActivo.escenarioFuturoId;
    const confirmacion = await window.Swal.fire({
        icon: 'warning',
        title: '¿Eliminar propuesta futura?',
        text: 'Se eliminarán la propuesta y sus movimientos; el plano actual no cambiará.',
        showCancelButton: true,
        confirmButtonText: 'Eliminar propuesta',
        cancelButtonText: 'Cancelar'
    });
    if (!confirmacion.isConfirmed) return;
    try {
        const resultado = await window.api.plano.eliminarFuturo(
            idEscenario,
            panelActivo.idPiso
        );
        if (!resultado?.ok) {
            mostrarToast(resultado?.mensaje || 'No se pudo eliminar la propuesta.', 'error', 4500);
            return;
        }
        for (const panel of [panelIzq, panelDer]) {
            if (Number(panel.escenarioFuturoId) === Number(idEscenario)) {
                panel.escenarioFuturoId = null;
            }
        }
        const panelesARecargar = selectModo.value === 'doble'
            ? [panelIzq, panelDer]
            : [panelActivo];
        await Promise.all(panelesARecargar.filter(panel => panel.idPiso).map(cargarPanel));
        mostrarToast(resultado.mensaje, 'exito');
    } catch (error) {
        mostrarToast(error.message, 'error', 4500);
    }
});

function limpiarPanel(panel) {
    panel.celdas = [];
    panel.zonas = [];
    panel.zonasLibres = [];
    panel.equiposSinUbicar = [];
    panel.clientesDelPiso = [];
    panel.escenarioFuturoId = null;
    panel.escenariosFuturos = [];
    if (panel === panelActivo) actualizarControlesFuturos(panel);

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
            if (contenido?._movimientoFuturo) {
                celda.classList.add('movimiento-futuro');
                celda.title = 'Movimiento propuesto; no modifica el plano actual.';
            }

            if (zl && !contenido) {
                celda.classList.add('celda-libre');
                celda.style.backgroundColor = normalizarColor(zl.Color, COLOR_ZONA_LIBRE_DEFECTO);
            }

            /* Zona normal: marca visual de las celdas que pertenecen a una zona.
               Se usa un anillo interior (CSS) para no tapar el color del rol. */
            const zona = zonaEnCelda(panel, fila, columna);
            if (zona) {
                celda.classList.add('celda-zona');
                celda.style.setProperty('--zona-color', normalizarColor(zona.Color, COLOR_ZONA_DEFECTO));
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
                celda.innerHTML = `${panel.escenarioFuturoId ? '' : `<button class="cerrar" data-id="${contenido.IdEquipo}">✕</button>`}
                    ${SVG_PC}
                    ${contenido._movimientoFuturo ? '<span class="marca-futuro">FUTURO</span>' : ''}`;

                celda.addEventListener('mouseenter', (ev) => {
                    if (modoZona || modoZonaLibre || modoEdicion) return;
                    mostrarTooltip(ev, datosTooltipCelda(contenido, fila, columna, panel));
                });
                celda.addEventListener('mousemove', (ev) => {
                    if (modoZona || modoZonaLibre || modoEdicion) return;
                    if (tooltipDiv && tooltipDiv.style.display === 'block') {
                        mostrarTooltip(ev, datosTooltipCelda(contenido, fila, columna, panel));
                    }
                });
                celda.addEventListener('mouseleave', ocultarTooltip);

                if (!modoZona && !modoZonaLibre && !modoEdicion) {
                    celda.draggable = true;
                    celda.addEventListener('dragstart', (ev) => {
                        if (window.PermisosUI && !window.PermisosUI.puede('plano:mover|plano:intercambiar')) {
                            ev.preventDefault();
                            return;
                        }
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
                    btnCerrar.dataset.permiso = 'plano:quitar';
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

                /* Pulsar y arrastrar marca de golpe todo el rectángulo recorrido
                   (los 8 equipos de la MESA 1 en un solo gesto). Shift resta. */
                celda.addEventListener('mousedown', (ev) => {
                    if (ev.button !== 0) return;
                    if (ev.target.closest('.cerrar')) return;
                    ev.preventDefault();
                    iniciarArrastreZona(ev, fila, columna);
                });

                celda.addEventListener('mouseenter', () => {
                    if (!arrastreZona) return;
                    extenderArrastreZona(fila, columna);
                });

                celda.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();

                    /* Clic que cierra una banda: la selección ya está aplicada. */
                    if (arrastreZonaTerminado) {
                        arrastreZonaTerminado = false;
                        return;
                    }

                    const idx = celdasZonaSeleccionadas.findIndex(
                        cc => cc.fila === fila && cc.columna === columna
                    );

                    if (idx >= 0) {
                        celdasZonaSeleccionadas.splice(idx, 1);
                    } else {
                        celdasZonaSeleccionadas.push({ fila, columna });
                    }
                    pintarSeleccionZona();
                    actualizarBotonesModo();
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

    /* ORDEN IMPORTANTE: el riel de zonas reserva (o libera) el espacio lateral
       del wrapper; los textos de zona libre se posicionan midiendo el wrapper,
       así que deben medirse DESPUÉS de que el riel esté aplicado. Al revés, un
       piso con zonas y zonas libres desplazaba los nombres libres ~118 px. */
    renderizarLlavesZonas(panel);
    renderizarTextosZonasLibres(panel);
}

/* =========================================================
   RENDERIZAR TEXTOS DE ZONAS LIBRES
   ========================================================= */
function renderizarTextosZonasLibres(panel) {
    const gridEl = panel.sufijo === 'izq' ? gridIzq : gridDer;
    if (!gridEl) return;

    const wrapper = gridEl.closest('.grid-plano-wrapper');
    if (!wrapper) return;

    /* Se limpian siempre para no dejar textos de una selección anterior. */
    wrapper.querySelectorAll('.texto-zona-libre-overlay').forEach(el => el.remove());

    if (!panel.zonasLibres || panel.zonasLibres.length === 0) return;

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
/* Agrupa las zonas por Nombre+Color. Cada grupo guarda las celdas REALES que
   ocupa (no solo el rectángulo que las envuelve): así un grupo salteado, por
   ejemplo 8 equipos repartidos en varias filas, se dibuja con tramos exactos
   en lugar de una caja que aparenta abarcar celdas ajenas. */
function agruparZonas(panel) {
    const grupos = new Map();

    for (const zona of panel.zonas || []) {
        const clave = `${zona.Nombre}||${zona.Color || ''}`;
        if (!grupos.has(clave)) {
            grupos.set(clave, {
                nombre: zona.Nombre,
                color: normalizarColor(zona.Color, COLOR_ZONA_DEFECTO),
                zonas: [],
                celdas: [],
                celdasClave: new Set()
            });
        }

        const grupo = grupos.get(clave);
        grupo.zonas.push(zona);

        /* Una zona normalmente es 1×1; si alguna vez guarda un bloque, se
           recorren todas sus celdas para no perder ninguna. */
        const filaInicio = Number(zona.FilaInicio) || 1;
        const filaFin = Math.max(filaInicio, Number(zona.FilaFin) || filaInicio);
        const columnaInicio = Number(zona.ColumnaInicio) || 1;
        const columnaFin = Math.max(columnaInicio, Number(zona.ColumnaFin) || columnaInicio);

        for (let fila = filaInicio; fila <= filaFin; fila++) {
            for (let columna = columnaInicio; columna <= columnaFin; columna++) {
                const marca = `${fila}|${columna}`;
                if (grupo.celdasClave.has(marca)) continue;
                grupo.celdasClave.add(marca);
                grupo.celdas.push({ fila, columna });
            }
        }
    }

    const lista = [...grupos.values()];
    lista.forEach(grupo => {
        delete grupo.celdasClave;
        grupo.filaInicio = Math.min(...grupo.celdas.map(c => c.fila));
        grupo.filaFin = Math.max(...grupo.celdas.map(c => c.fila));
        grupo.columnaInicio = Math.min(...grupo.celdas.map(c => c.columna));
        grupo.columnaFin = Math.max(...grupo.celdas.map(c => c.columna));
    });
    return lista;
}

/* Rectángulos reales de las celdas del grupo agrupados en tramos de filas
   contiguas. Devuelve null si el grupo no está dibujado en este canvas. */
function tramosDeZona(gridEl, grupo, contenedorRect) {
    const porFila = new Map();

    for (const celda of grupo.celdas) {
        const elemento = gridEl.querySelector(
            `.celda[data-fila="${celda.fila}"][data-columna="${celda.columna}"]`
        );
        if (!elemento) continue;

        const rect = elemento.getBoundingClientRect();
        if (!rect.height) continue;

        const top = rect.top - contenedorRect.top;
        const bottom = rect.bottom - contenedorRect.top;
        const actual = porFila.get(celda.fila);

        if (!actual) {
            porFila.set(celda.fila, { top, bottom });
        } else {
            actual.top = Math.min(actual.top, top);
            actual.bottom = Math.max(actual.bottom, bottom);
        }
    }

    if (porFila.size === 0) return null;

    const filas = [...porFila.entries()].sort((a, b) => a[0] - b[0]);
    const tramos = [];

    for (const [fila, rect] of filas) {
        const ultimo = tramos[tramos.length - 1];
        if (ultimo && fila === ultimo.filaFin + 1) {
            ultimo.filaFin = fila;
            ultimo.bottom = Math.max(ultimo.bottom, rect.bottom);
        } else {
            tramos.push({
                filaInicio: fila,
                filaFin: fila,
                top: rect.top,
                bottom: rect.bottom
            });
        }
    }

    return tramos;
}

function renderizarLlavesZonas(panel) {
    const contenedor = panel.sufijo === 'izq' ? llavesIzq : llavesDer;
    if (!contenedor) return;

    /* Se limpia siempre: si ya no quedan zonas no deben quedar indicadores viejos. */
    contenedor.innerHTML = '';
    contenedor.classList.remove('riel-derecha', 'riel-izquierda');

    const gridEl = panel.sufijo === 'izq' ? gridIzq : gridDer;
    if (!gridEl) return;

    const grupos = agruparZonas(panel)
        .sort((a, b) => a.filaInicio - b.filaInicio || a.columnaInicio - b.columnaInicio);

    /* El riel solo se reserva cuando hay algo que dibujar en él; así un piso sin
       zonas no pierde ancho útil a los lados del canvas. */
    const wrapper = gridEl.closest('.grid-plano-wrapper');
    if (wrapper) wrapper.classList.toggle('con-riel', grupos.length > 0);
    if (!grupos.length) return;

    const contenedorRect = contenedor.getBoundingClientRect();
    const gridRect = gridEl.getBoundingClientRect();
    if (!gridRect.width) return;

    /* RIEL: la franja libre FUERA del canvas (el wrapper reserva ese espacio a
       los dos lados). Todos los indicadores de zona viven ahí, así nunca tapan
       una celda ni el equipo que hay debajo. */
    const bordeDerecho = gridRect.right - contenedorRect.left;
    const bordeIzquierdo = gridRect.left - contenedorRect.left;
    const espacioDerecha = contenedorRect.width - bordeDerecho;
    const lado = espacioDerecha >= bordeIzquierdo ? 'derecha' : 'izquierda';

    contenedor.classList.add(lado === 'derecha' ? 'riel-derecha' : 'riel-izquierda');

    const xRiel = lado === 'derecha' ? bordeDerecho : bordeIzquierdo;

    const ocupacion = [];
    let indicadores = 0;

    for (const grupo of grupos) {
        const tramos = tramosDeZona(gridEl, grupo, contenedorRect);
        if (!tramos) continue;

        crearIndicadorZona({
            contenedor,
            grupo,
            lado,
            xRiel,
            panel,
            centro: (tramos[0].top + tramos[tramos.length - 1].bottom) / 2,
            altoContenedor: contenedorRect.height,
            ocupacion
        });
        indicadores++;
    }

    /* Ninguna zona de este piso está realmente dibujada en este canvas (por
       ejemplo, coordenadas fuera de las dimensiones actuales): se devuelve el
       ancho reservado para no dejar dos franjas vacías a los lados. */
    if (!indicadores && wrapper) wrapper.classList.remove('con-riel');
}

/* Posiciones del riel que el usuario acomoda a mano. Se recuerdan por piso
   (no solo mientras la página está abierta) para que no tenga que reacomodar
   las etiquetas cada vez que entra al plano. */
function claveAlmacenLlaves(panel) {
    return `plano:llaves:${panel?.idPiso ?? 'sin-piso'}`;
}

function leerPosicionesLlave(panel) {
    try {
        const guardado = JSON.parse(localStorage.getItem(claveAlmacenLlaves(panel)) || '{}');
        return guardado && typeof guardado === 'object' ? guardado : {};
    } catch {
        return {};
    }
}

function guardarPosicionesLlave(panel, posiciones) {
    try {
        localStorage.setItem(claveAlmacenLlaves(panel), JSON.stringify(posiciones || {}));
    } catch {
        /* Sin almacenamiento disponible: se conserva solo la posición de la sesión. */
    }
}

/* La posición se guarda como { x, y }; se acepta también el formato viejo
   (solo la Y) para que las etiquetas ya acomodadas no salten de lugar. */
function normalizarPosicionLlave(valor) {
    if (valor == null) return { x: null, y: null };
    if (typeof valor === 'number' || typeof valor === 'string') {
        const y = Number(valor);
        return { x: null, y: Number.isFinite(y) ? y : null };
    }
    const x = Number(valor.x);
    const y = Number(valor.y);
    return {
        x: Number.isFinite(x) ? x : null,
        y: Number.isFinite(y) ? y : null
    };
}

/* Dibuja UN indicador por zona, siempre dentro del riel (fuera del canvas):
   una sola etiqueta con el punto de color y el nombre. Ya no se dibuja ningún
   palo ni corchete entre la zona y la etiqueta: el indicador ES la etiqueta y
   el usuario la arrastra a su gusto (más hacia su lado si así lo quiere). */
function crearIndicadorZona(opciones) {
    const {
        contenedor, grupo, lado, xRiel,
        centro, altoContenedor, ocupacion, panel
    } = opciones;

    const margenRiel = 10;  // separación entre el canvas y la etiqueta


    /* 1. Etiqueta: solo el punto de color y el nombre. Sin contador y sin
       palo: el indicador es para ubicar la zona, no para contarla. */
    const etiqueta = document.createElement('div');
    etiqueta.className = 'etiqueta-llave';
    etiqueta.style.borderColor = grupo.color;

    const punto = document.createElement('span');
    punto.className = 'punto-color';
    punto.style.background = grupo.color;
    etiqueta.append(punto, document.createTextNode(` ${grupo.nombre || ''}`));

    etiqueta.title =
        `${grupo.nombre || 'Zona'} · Arrastra para acomodarla · Clic para editar · ` +
        'Doble clic para devolverla a su lugar.';

    /* UN solo cable de unión por etiqueta: nace en el borde del canvas a la
       altura de la zona y muere en el borde interior de la etiqueta. Se dibuja
       antes de la etiqueta para quedar por debajo y nunca cruza la grilla. */
    const cable = document.createElement('div');
    cable.className = 'cable-llave';
    cable.style.background = grupo.color;
    contenedor.appendChild(cable);

    contenedor.appendChild(etiqueta);

    const altoEtiqueta = etiqueta.offsetHeight || 26;
    const anchoEtiqueta = etiqueta.offsetWidth || 90;
    const anchoContenedor = contenedor.clientWidth || anchoEtiqueta + 4;

    /* 2. Límites permitidos de arrastre. La etiqueta nunca se mete al canvas y
       solo puede alejarse hacia SU lado: si está a la derecha se mueve hacia la
       derecha (hasta el borde del riel) y si está a la izquierda hacia la
       izquierda. El resto del riel es su rango libre. */
    const claveGrupo = `${grupo.nombre}||${grupo.color}`;

    const xMin = lado === 'derecha' ? xRiel + 2 : 4;
    const xMax = lado === 'derecha'
        ? Math.max(xMin, anchoContenedor - anchoEtiqueta - 4)
        : Math.max(xMin, xRiel - 4 - anchoEtiqueta);
    const acotarX = valor => Math.max(xMin, Math.min(valor, xMax));

    const limiteInferior = Math.max(altoContenedor - altoEtiqueta - 4, 4);
    const acotarY = valor => Math.max(4, Math.min(valor, limiteInferior));

    /* 3. Posición: si el usuario ya la había acomodado se respeta (x e y); si
       no, se centra en su zona y se apila para no encimarse con otra etiqueta. */
    ocupacion.sort((a, b) => a.top - b.top);
    let yAuto = centro - altoEtiqueta / 2;
    for (const bloque of ocupacion) {
        if (yAuto < bloque.bottom + 6 && (yAuto + altoEtiqueta) > bloque.top - 6) {
            yAuto = bloque.bottom + 6;
        }
    }
    yAuto = acotarY(yAuto);

    const xAuto = lado === 'derecha'
        ? xRiel + margenRiel
        : Math.max(4, xRiel - margenRiel - anchoEtiqueta);

    const posicionGuardada = normalizarPosicionLlave(
        panel?.posicionesLlave?.[claveGrupo] ?? leerPosicionesLlave(panel)[claveGrupo]
    );
    const x = posicionGuardada.x != null ? acotarX(posicionGuardada.x) : acotarX(xAuto);
    const y = posicionGuardada.y != null ? acotarY(posicionGuardada.y) : yAuto;

    etiqueta.style.top = y + 'px';
    etiqueta.style.left = x + 'px';

    ocupacion.push({ top: y, bottom: y + altoEtiqueta });

    /* 4. El cable acompaña a la etiqueta: se recalcula en cada movimiento y se
       oculta si la etiqueta se pasa al otro lado del ancla, de modo que NUNCA
       se dibuja encima de la grilla (el ancla está en el borde del canvas). */
    const actualizarCable = () => {
        const leftActual = parseFloat(etiqueta.style.left);
        const topActual = parseFloat(etiqueta.style.top);
        const xEtiqueta = Number.isFinite(leftActual) ? leftActual : x;
        const yEtiqueta = Number.isFinite(topActual) ? topActual : y;

        /* Extremo en el borde interior de la etiqueta más cercano al canvas. */
        const destinoX = lado === 'derecha' ? xEtiqueta : xEtiqueta + anchoEtiqueta;
        const destinoY = yEtiqueta + altoEtiqueta / 2;

        const dx = destinoX - xRiel;
        const dy = destinoY - centro;
        const largo = Math.hypot(dx, dy);
        const visible = largo >= 4 && (lado === 'derecha' ? dx > 0 : dx < 0);

        cable.classList.toggle('cable-oculto', !visible);
        if (!visible) return;

        cable.style.width = `${Math.round(largo)}px`;
        cable.style.left = `${Math.round(xRiel)}px`;
        cable.style.top = `${Math.round(centro) - 1}px`;
        cable.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
    };

    actualizarCable();

    /* 5. Arrastre libre en las dos direcciones (dentro de los rangos de arriba).
       La posición se recuerda por grupo y por piso; doble clic la restablece. */
    let arrastreEtiqueta = null;
    let etiquetaMovida = false;

    etiqueta.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        arrastreEtiqueta = {
            xPuntero: ev.clientX,
            yPuntero: ev.clientY,
            leftInicial: parseFloat(etiqueta.style.left) || x,
            topInicial: parseFloat(etiqueta.style.top) || y
        };
        etiquetaMovida = false;
        etiqueta.classList.add('arrastrando');
        etiqueta.setPointerCapture?.(ev.pointerId);
        /* Sin preventDefault: así el clic sigue llegando al manejador que abre
           el modal. El texto no se selecciona porque el CSS ya lo desactiva. */
        ev.stopPropagation();
    });

    etiqueta.addEventListener('pointermove', (ev) => {
        if (!arrastreEtiqueta) return;
        const dx = ev.clientX - arrastreEtiqueta.xPuntero;
        const dy = ev.clientY - arrastreEtiqueta.yPuntero;
        if (Math.abs(dx) + Math.abs(dy) > 3) etiquetaMovida = true;
        if (!etiquetaMovida) { ev.stopPropagation(); return; }

        const nuevaX = acotarX(arrastreEtiqueta.leftInicial + dx);
        const nuevaY = acotarY(arrastreEtiqueta.topInicial + dy);
        etiqueta.style.left = nuevaX + 'px';
        etiqueta.style.top = nuevaY + 'px';
        actualizarCable();
        ev.stopPropagation();
    });

    const terminarArrastreEtiqueta = () => {
        if (!arrastreEtiqueta) return;
        arrastreEtiqueta = null;
        etiqueta.classList.remove('arrastrando');
        if (etiquetaMovida && panel) {
            panel.posicionesLlave = panel.posicionesLlave || {};
            panel.posicionesLlave[claveGrupo] = {
                x: parseFloat(etiqueta.style.left) || x,
                y: parseFloat(etiqueta.style.top) || y
            };
            guardarPosicionesLlave(panel, panel.posicionesLlave);
        }
        /* El clic se dispara justo después del pointerup: se limpia la marca en
           el siguiente turno para no abrir el modal al terminar de arrastrar. */
        setTimeout(() => { etiquetaMovida = false; }, 0);
    };

    etiqueta.addEventListener('pointerup', terminarArrastreEtiqueta);
    etiqueta.addEventListener('pointercancel', terminarArrastreEtiqueta);

    /* Al hacer clic se edita el grupo completo (todas las celdas de esa zona),
       no solo una, para que el CRUD quede coherente con lo que se ve. */
    etiqueta.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (etiquetaMovida) return;
        if (!grupo.zonas?.length) return;
        abrirModalZona(grupo.zonas[0], { nombre: grupo.nombre, color: grupo.color });
    });

    etiqueta.addEventListener('dblclick', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!panel) return;
        delete panel.posicionesLlave?.[claveGrupo];
        /* Doble clic = devolverla a su lugar automático, también en lo guardado. */
        const posicionesGuardadas = leerPosicionesLlave(panel);
        delete posicionesGuardadas[claveGrupo];
        guardarPosicionesLlave(panel, posicionesGuardadas);
        renderizarLlavesZonas(panel);
    });
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
    window.PermisosUI?.aplicar(listaSinUbicar);
    window.PermisosUI?.aplicar(listaZonas);
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
        li.draggable = true;

        const clienteNom = e.ClienteCodigo || '?';
        const pisoNom = pisos.find(p => Number(p.IdPiso) === Number(e.IdPiso))?.Nombre
                       || `Piso ${e.IdPiso || '?'}`;

        /* Sin código de color por rol: el color de rol solo se usa en los chips
           del filtro y en la leyenda, no en este listado. */
        li.innerHTML = `
            <div class="equipo-info">
                <div class="hostname-texto">${e.Hostname}</div>
                <div class="equipo-ubicacion">${clienteNom} · ${pisoNom}</div>
            </div>
        `;
        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.className = 'secundario btn-editar-equipo';
        btnEditar.dataset.permiso = 'equipos:editar';
        btnEditar.textContent = 'Editar';
        btnEditar.setAttribute('aria-label', `Editar equipo ${e.Hostname}`);
        btnEditar.draggable = false;
        btnEditar.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            abrirModalEditarEquipo(e, panelActivo);
        });
        li.appendChild(btnEditar);
        li.addEventListener('dragstart', (ev) => {
            if (window.PermisosUI && !window.PermisosUI.puede('plano:asignar')) {
                ev.preventDefault();
                return;
            }
            if (ev.target.closest('button')) {
                ev.preventDefault();
                return;
            }
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
            cantSpan.className = 'cant-zonas';
            cantSpan.textContent = `${g.zonas.length}`;
            li.appendChild(colorDiv);
            li.appendChild(nombreSpan);
            li.appendChild(cantSpan);
        } else {
            li.appendChild(colorDiv);
            li.appendChild(nombreSpan);
        }

        const btnEditar = document.createElement('button');
        btnEditar.type = 'button';
        btnEditar.textContent = 'Editar';
        btnEditar.className = 'secundario';
        btnEditar.dataset.permiso = 'plano:zonas:gestionar';
        btnEditar.addEventListener('click', () => abrirModalZona(g.zonas[0], {
            nombre: g.nombre,
            color: g.color
        }));

        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.className = 'peligro';
        btnEliminar.dataset.permiso = 'plano:zonas:eliminar';
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
                },
                'plano:zonas:eliminar'
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
            cantSpan.className = 'cant-celdas';
            cantSpan.textContent = `${g.celdas.length} c.`;

            const btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.className = 'peligro';
            btnEliminar.dataset.permiso = 'plano:zonas:eliminar';
            btnEliminar.addEventListener('click', () => {
                mostrarConfirmacion(
                    'Eliminar zona libre',
                    `¿Eliminar la zona libre "${g.nombre}"?`,
                    async () => {
                        await window.api.plano.eliminarZonaLibre(panelActivo.idPiso, g.nombre, g.color);
                        mostrarToast(`Zona libre "${g.nombre}" eliminada`, 'exito');
                        await recargarPanel(panelActivo);
                    },
                    'plano:zonas:eliminar'
                );
            });

            const btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.textContent = 'Editar';
            btnEditar.className = 'secundario';
            btnEditar.dataset.permiso = 'plano:zonas:gestionar';
            btnEditar.addEventListener('click', () => abrirModalZonaLibre(g));

            li.appendChild(colorDiv);
            li.appendChild(nombreSpan);
            li.appendChild(cantSpan);
            li.appendChild(btnEditar);
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
    if (panelOrigen.escenarioFuturoId || panelDestino.escenarioFuturoId) {
        const origen = { ...dragOrigen };
        dragOrigen = null;
        const mismaPropuesta = panelOrigen.escenarioFuturoId &&
            Number(panelOrigen.escenarioFuturoId) === Number(panelDestino.escenarioFuturoId);
        const vistaPermitida = mismoPanel || selectModo.value === 'doble';
        const pisosDistintos = Number(panelOrigen.idPiso) !== Number(panelDestino.idPiso);
        if (origen.tipo !== 'celda' || !mismaPropuesta || !vistaPermitida ||
            (!mismoPanel && !pisosDistintos)) {
            mostrarToast('Para mover entre pisos, ambos paneles deben pertenecer a la misma propuesta futura.', 'warn', 4000);
            return;
        }
        const permiso = contenidoDestino ? 'plano:mover|plano:intercambiar' : 'plano:mover';
        if (window.PermisosUI && !window.PermisosUI.puede(permiso)) {
            mostrarToast('No tienes permiso para modificar la propuesta.', 'error');
            return;
        }
        if (origen.fila === filaDestino && origen.columna === columnaDestino) return;
        try {
            const resultado = await window.api.plano.moverFuturo(
                panelDestino.escenarioFuturoId,
                origen.idEquipo,
                panelDestino.idPiso,
                filaDestino,
                columnaDestino
            );
            if (!resultado?.ok) {
                mostrarToast(resultado?.mensaje || 'No se pudo guardar el movimiento futuro.', 'error', 4500);
                return;
            }
            await Promise.all((selectModo.value === 'doble' ? [panelIzq, panelDer] : [panelDestino])
                .filter(panel => panel.idPiso)
                .map(recargarPanel));
            mostrarToast(resultado.mensaje, 'exito');
        } catch (error) {
            mostrarToast(error.message, 'error', 4500);
        }
        return;
    }
    const permisoDrop = dragOrigen.tipo === 'lista'
        ? `plano:asignar${contenidoDestino ? '&plano:quitar' : ''}`
        : (contenidoDestino ? 'plano:intercambiar' : 'plano:mover');
    if (window.PermisosUI && !window.PermisosUI.puede(permisoDrop)) {
        dragOrigen = null;
        mostrarToast('No tienes permiso para realizar esta acción en el plano.', 'error');
        return;
    }

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
                    },
                    contenidoDestino
                        ? 'plano:quitar&plano:asignar'
                        : 'plano:asignar'
                );
            } else {
                mostrarConfirmacion(
                    'Asignar equipo',
                    `¿Colocar <b>${equipo.Hostname}</b> en la celda (${filaDestino}, ${columnaDestino})?`,
                    async () => {
                        await window.api.plano.asignar(panelDestino.idPiso, equipo.IdEquipo, filaDestino, columnaDestino);
                        mostrarToast(`"${equipo.Hostname}" asignado en (${filaDestino}, ${columnaDestino})`, 'exito');
                        await recargarPanel(panelDestino);
                    },
                    'plano:asignar'
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
                    },
                    'plano:mover'
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
                    },
                    'plano:intercambiar'
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

    const puedeEditarEquipo = window.PermisosUI?.puede('equipos:editar') ?? true;
    document.querySelector('.check-mantener').style.display =
        conSwap || !puedeEditarEquipo ? 'none' : 'block';
    actualizarPermisoMover();

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

    limpiarHintRango(mvIPHint);
    modalMover.style.display = 'flex';
}

chkMantener.addEventListener('change', () => {
    formEditarMover.style.display = chkMantener.checked ? 'none' : 'block';
    actualizarPermisoMover();
    /* Al abrir la edición se muestra el aviso de rango con los datos cargados. */
    if (!chkMantener.checked) mvActualizarHintRango();
});

function actualizarPermisoMover() {
    if (!moverPendiente) return;
    const { conSwap, desdeLista, equipoDestino } = moverPendiente;
    let permiso = conSwap
        ? 'plano:intercambiar'
        : desdeLista
            ? 'plano:asignar'
            : 'plano:mover';
    if (!conSwap && desdeLista && equipoDestino) permiso += '&plano:quitar';
    if (!conSwap && !chkMantener.checked) permiso += '&equipos:editar';
    moverConfirmar.dataset.permiso = permiso;
    window.PermisosUI?.aplicar(moverConfirmar);
}

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
                /* La actualización de datos (y por tanto la validación de rango
                   IP) va PRIMERO: si la IP no está autorizada, el equipo no se
                   quita ni se asigna y el plano queda intacto. */
                if (nuevosDatos) {
                    const resUpd = await window.api.equipos.actualizar(idEquipo, {
                        ...nuevosDatos,
                        idPiso: panelDestino.idPiso,
                        activo: true
                    });
                    if (resUpd && resUpd.ok === false) {
                        if (resUpd.tipo === 'ip-fuera-de-rango') {
                            mostrarMensajeMover(resUpd.mensaje || 'La IP está fuera del rango autorizado.', 'error');
                            await alertaRangoIP(resUpd, nuevosDatos.ip);
                            mvActualizarHintRango();
                            return;
                        }
                        mostrarMensajeMover(resUpd.mensaje || 'No se pudo actualizar.', 'error');
                        return;
                    }
                }

                if (equipoDestino) {
                    await window.api.plano.quitar(equipoDestino.IdEquipo, panelDestino.idPiso, equipoDestino.Hostname);
                }
                const res = await window.api.plano.asignar(panelDestino.idPiso, idEquipo, fila, columna);

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
                    if (res && res.tipo === 'ip-fuera-de-rango') {
                        mostrarMensajeMover(res.mensaje || 'La IP está fuera del rango autorizado.', 'error');
                        await alertaRangoIP(res, nuevosDatos?.ip);
                        mvActualizarHintRango();
                        return;
                    }
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
    // ✅ FIX: usar endpoint específico en lugar de listar TODOS los equipos
    const eq = await window.api.equipos.obtenerPorId(idEquipo);
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
        },
        'plano:quitar'
    );
}

/* =========================================================
   VISTA PREVIA
   ========================================================= */
btnVistaPrevia.addEventListener('click', () => {
    if (!panelActivo.idPiso) { alert('Selecciona un piso primero.'); return; }

    try {
        const opciones = generarHTMLVistaPrevia(panelActivo);
        const ventana = window.open('', '_blank');
        if (!ventana) {
            alert('El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para ver la vista previa.');
            return;
        }
        ventana.document.open();
        ventana.document.write(opciones.html);
        ventana.document.close();
    } catch (err) {
        mostrarToast('Error al generar vista previa: ' + err.message, 'error', 4000);
    }
});

/* =========================================================
   EXPORTAR PDF
   ========================================================= */
btnExportarPDFDoc.addEventListener('click', async () => {
    if (!panelActivo.idPiso) { alert('Selecciona un piso primero.'); return; }

    const original = btnExportarPDFDoc.innerHTML;
    btnExportarPDFDoc.disabled = true;
    btnExportarPDFDoc.innerHTML = 'Generando...';

    try {
        const opciones = generarHTMLParaPDF(panelActivo);
        const res = await window.api.plano.exportarPDF(opciones);

        if (res.ok) {
            mostrarToast('PDF Documentado generado correctamente', 'exito', 4000);
            console.log('Ruta:', res.ruta);
        } else {
            mostrarToast(res.mensaje || 'Generación cancelada', 'info');
        }
    } catch (err) {
        mostrarToast('Error al generar PDF: ' + err.message, 'error', 4000);
    } finally {
        btnExportarPDFDoc.disabled = false;
        btnExportarPDFDoc.innerHTML = original;
    }
});

/* =========================================================
   HELPERS COMPARTIDOS ENTRE VISTA PREVIA Y PDF
   ========================================================= */
function calcularLayoutPlano(panel) {
    const cols = panel.dimensiones.Columnas;
    const filas = panel.dimensiones.Filas;

    /* A3 menos los márgenes de @page (6 mm por lado), en px a 96 dpi. */
    const HOJA_A3_LANDSCAPE = { ancho: 1542, alto: 1077 };
    const HOJA_A3_PORTRAIT  = { ancho: 1077, alto: 1542 };

    const ratioGrid = cols / filas;
    const esHorizontal = ratioGrid >= 1.15;
    const hoja = esHorizontal ? HOJA_A3_LANDSCAPE : HOJA_A3_PORTRAIT;

    const GAP = 4;
    const GRID_PADDING = 14;
    const BORDE_GRID = 2;         // borde de .grid-plano (por lado)
    const ALTO_ENCABEZADO = 92;   // encabezado + margen inferior
    const PADDING_PAGINA = { x: 12, y: 8 };  // .pagina-plano
    const PADDING_WRAP   = { x: 8,  y: 12 }; // .plano-wrap

    /* IMPORTANTE: el ancho útil del canvas NO descuenta el riel de las
       etiquetas, así las celdas conservan exactamente el tamaño de siempre. */
    const anchoUtil = hoja.ancho
        - PADDING_PAGINA.x * 2
        - PADDING_WRAP.x * 2
        - BORDE_GRID * 2
        - GRID_PADDING * 2
        - GAP * (cols - 1);
    const altoUtil = hoja.alto
        - ALTO_ENCABEZADO
        - PADDING_PAGINA.y * 2
        - PADDING_WRAP.y * 2
        - BORDE_GRID * 2
        - GRID_PADDING * 2
        - GAP * (filas - 1);

    let CELL_W = Math.floor(anchoUtil / cols);
    let CELL_H = Math.floor(altoUtil / filas);

    const ANCHO_MAX_CELDA = 160;
    const ALTO_MAX_CELDA  = 100;
    CELL_W = Math.min(CELL_W, ANCHO_MAX_CELDA);
    CELL_H = Math.min(CELL_H, ALTO_MAX_CELDA);
    CELL_W = Math.max(28, CELL_W);
    CELL_H = Math.max(24, CELL_H);

    /* RIEL de las etiquetas de zona: SIEMPRE se toma del espacio que ya sobraba
       a los lados del canvas. Nunca se toca el tamaño de las celdas: el plano
       mide exactamente lo mismo que antes de existir los indicadores. Si el
       sobrante no alcanza para una etiqueta legible, no se reserva riel y las
       etiquetas se dibujan encima de su propia zona (ver construirBloquesPlano),
       así la hoja jamás se desborda. Aquí solo se informa cuánto espacio libre
       queda a cada lado; el reparto entre riel izquierdo y derecho lo hace
       construirBloquesPlano según el lado en el que esté cada zona. */
    const sobranteLado = Math.max(0, Math.floor((anchoUtil - (cols * CELL_W + (cols - 1) * GAP)) / 2));

    const orientacionPagina = esHorizontal ? 'landscape' : 'portrait';

    const FONT_HOST = Math.max(0.18, Math.min(0.70, CELL_H / 54)).toFixed(2);
    const FONT_IP = Math.max(0.10, Math.min(0.52, CELL_H / 70)).toFixed(2);

    return {
        cols, filas,
        esHorizontal,
        orientacionPagina,
        GAP,
        GRID_PADDING,
        BORDE_GRID,
        sobranteLado,
        CELL_W,
        CELL_H,
        FONT_HOST,
        FONT_IP
    };
}

function construirBloquesPlano(panel, layout) {
    const {
        cols, filas, GAP, GRID_PADDING, CELL_W, CELL_H,
        FONT_HOST, FONT_IP, BORDE_GRID, sobranteLado
    } = layout;

    const escaparTextoZona = valor => String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);

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
                equiposList.push({ fila: f + 1, col: c + 1, ...contenido });
            }
        }
    }
    const totalEquipos = equiposList.length;

    /* ETIQUETAS DE CLIENTE EN CELDAS APRETADAS
       ---------------------------------------------------------
       El chip con el código del cliente se dibuja FUERA de la celda, encima
       de su borde superior. Eso solo es seguro si la celda tiene altura de
       sobra: el chip (16px) invade ~10px de la celda de arriba y, con celdas
       bajas, ahí está justo la línea de la IP → el código tapaba la IP del
       equipo vecino (caso del plano 12 × 37, celda de 33px).

       Dos casos, y en ambos el código se dibuja como banda DENTRO de su
       propia celda (nunca invade la de arriba ni las columnas vecinas):
         · celdas angostas (p. ej. 37 columnas): el código no cabe a lo ancho;
         · celdas bajas: no hay hueco de alto para el chip (ver chipCabeArriba).
       En los planos con celdas altas se conserva el chip flotante de siempre.
       Las celdas NO cambian de tamaño: el plano sigue cabiendo en una hoja. */
    const CHIP_ALTO = 16;
    const CHIP_FONT = 0.6;
    const BORDE_OFFSET = 2;

    /* ¿CABE EL CHIP FLOTANTE SIN TAPAR EL TEXTO DE LA CELDA DE ARRIBA?
       ---------------------------------------------------------------
       El chip flotante se dibuja pegado al borde superior de su propia celda,
       así que sube CHIP_ALTO - GAP px dentro de la celda de arriba (16px de
       chip menos los 4px de separación: 12px de invasión). El texto de la
       celda va centrado verticalmente, de modo que en cuanto la celda se queda
       corta de alto el chip aterriza justo sobre la línea de la IP del equipo
       vecino: es lo que pasaba en los planos con celdas de 44–54px.

       Antes había un umbral fijo (44px) que no tenía en cuenta el tamaño real
       del texto. Ahora se mide con las medidas que usa el CSS de la celda:
         · 6px fijos: padding 2px arriba + 2px abajo + gap 2px del contenido;
         · cada línea mide line-height 1.05 × su tamaño de fuente.
       El contenido (centrado) debe terminar 2×invasión + 2px de aire antes del
       borde inferior, o sea: CELL_H - altoTextoReal >= 28px.

       Planos grandes (celdas bajas) → banda dentro de la celda.
       Planos chicos (celdas altas)   → chip flotante de siempre, intacto. */
    const pxHostname = parseFloat(FONT_HOST) * 16;
    const pxIP = parseFloat(FONT_IP) * 16;
    const altoTextoReal = 6 + 1.05 * (pxHostname + pxIP);
    const invasionChip = Math.max(0, CHIP_ALTO - GAP);
    const AIRE_CHIP_TEXTO = 2;
    const chipCabeArriba = (CELL_H - altoTextoReal) >= (invasionChip * 2 + AIRE_CHIP_TEXTO * 2);

    const largoCodigoCliente = equiposList.reduce(
        (mayor, e) => Math.max(mayor, String(e.ClienteCodigo || '?').trim().length), 1);
    /* Ancho real que necesita el chip: texto (0.6rem ≈ 9.6px, ~0.66em por
       carácter en negrita con letter-spacing) + 12px de padding + 2px de borde.
       Se mide contra el ancho de la celda: si no cabe, la celda es angosta. */
    const anchoChipNecesario = Math.round(largoCodigoCliente * CHIP_FONT * 16 * 0.66) + 14;
    const celdasAngostas = chipCabeArriba && anchoChipNecesario > CELL_W;
    const chipFlotante = chipCabeArriba && !celdasAngostas;
    const bandaCliente = !chipFlotante;
    /* Banda proporcional al alto de la celda: en celdas bajas se acorta para
       no comerse el espacio del hostname y de la IP (el texto se escala lo
       justo para caber debajo; ver cssBandasCliente). Con 33px de celda queda
       en 10px, que es lo que permite conservar el tamaño de letra original. */
    const altoBanda = Math.min(ALTO_BANDA_CLIENTE, Math.max(9, Math.round(CELL_H * 0.30)));

    /* En celdas angostas conviene romper el texto por sus separadores
       naturales (puntos de la IP, guiones del hostname) antes que a mitad de
       una palabra: se ve mucho más ordenado en la hoja. */
    const partirEnCeldaAngosta = texto => celdasAngostas
        ? String(texto ?? '').replace(/([.-])/g, '$1<wbr>')
        : String(texto ?? '');

    const colorClientePorCodigo = codigo => {
        const codigoNormalizado = String(codigo || '').toUpperCase().trim();
        const colorGuardado = window.PermisosUI?.colorCliente?.(codigoNormalizado) ||
            clientes.find(cliente => String(cliente.Codigo || '').toUpperCase() === codigoNormalizado)?.ColorHex;
        if (/^#[0-9A-F]{6}$/i.test(colorGuardado || '')) return colorGuardado;
        return COLORES_CLIENTE_POR_CODIGO[codigoNormalizado] || '#2e3228';
    };
    const colorPorCliente = new Map();
    equiposList.forEach(e => {
        const id = e.IdCliente;
        if (id == null || colorPorCliente.has(id)) return;
        colorPorCliente.set(id, colorClientePorCodigo(e.ClienteCodigo));
    });
    const colorRolPorCodigo = codigo => {
        const color = window.PermisosUI?.colorRol?.(codigo) ||
            roles.find(rol => String(rol.Codigo || '').toUpperCase() === String(codigo || '').toUpperCase())?.ColorHex;
        return /^#[0-9A-F]{6}$/i.test(color || '') ? color : null;
    };
    const colorSuave = color => {
        const canales = color.slice(1).match(/.{2}/g).map(canal => parseInt(canal, 16));
        return `#${canales.map(canal => Math.round(canal + (255 - canal) * .78).toString(16).padStart(2, '0')).join('')}`;
    };


    let celdasHTML = '';
    for (let f = 0; f < filas; f++) {
        for (let c = 0; c < cols; c++) {
            const fila = f + 1;
            const col = c + 1;
            const contenido = panel.celdas[f]?.[c];
            const zl = zonasLibresMap.get(`${fila}-${col}`);

            if (contenido) {
                const esDhcpSinIp = ['DHC', 'DHCP'].includes(String(contenido.TipoIP || '').trim().toUpperCase())
                    && !String(contenido.IP || '').trim();
                const ipMostrar = esDhcpSinIp ? 'DHCP' : (contenido.IP || '-');
                const colorRol = colorRolPorCodigo(contenido.RolCodigo);
                /* Fondo, borde y contraste del texto salen del color configurado
                   en el catálogo de Roles: no se declaran colores fijos aquí ni
                   en el CSS. --celda-texto lo consume `.celda-hostname/.celda-ip`. */
                const fondoRol = colorRol ? colorSuave(colorRol) : null;
                const estiloRol = colorRol
                    ? ` style="background-color:${fondoRol};border-color:${colorRol};--celda-texto:${colorTextoContraste(fondoRol)};"`
                    : '';
                celdasHTML += `
                    <div class="celda ocupada" data-rol="${contenido.RolCodigo || ''}"${estiloRol}>
                        <div class="celda-contenido">
                            <div class="celda-hostname">${partirEnCeldaAngosta(contenido.Hostname || '')}</div>
                            <div class="celda-ip">${partirEnCeldaAngosta(ipMostrar)}</div>
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

    let bordesEquipoHTML = '';
    let etiquetasEquipoHTML = '';

    equiposList.forEach(e => {
        const colorCli = colorPorCliente.get(e.IdCliente) || colorClientePorCodigo(e.ClienteCodigo);
        const colorTextoCliente = colorTextoContraste(colorCli);
        const x = (e.col - 1) * (CELL_W + GAP);
        const y = (e.fila - 1) * (CELL_H + GAP);

        bordesEquipoHTML += `
            <div style="position:absolute;left:${x + GRID_PADDING - BORDE_OFFSET}px;top:${y + GRID_PADDING - BORDE_OFFSET}px;width:${CELL_W + BORDE_OFFSET * 2}px;height:${CELL_H + BORDE_OFFSET * 2}px;border:2.5px solid ${colorCli};border-radius:6px;pointer-events:none;box-sizing:border-box;z-index:4;"></div>`;

        const codigoCli = String(e.ClienteCodigo || '?').toUpperCase().trim();
        if (bandaCliente) {
            /* Banda del cliente dentro de su propia celda: no toca la IP del
               equipo de arriba ni las columnas vecinas. */
            const fuenteBanda = Math.min(0.55, (altoBanda - 1) / 16).toFixed(2);
            etiquetasEquipoHTML += `
            <div class="chip-cliente-celda" data-color="${codigoCli}" data-color-kind="client" style="position:absolute;left:${x + GRID_PADDING - BORDE_OFFSET}px;top:${y + GRID_PADDING - BORDE_OFFSET}px;width:${CELL_W + BORDE_OFFSET * 2}px;height:${altoBanda}px;padding:0 3px;background-color:${colorCli} !important;color:${colorTextoCliente} !important;border-color:${colorCli} !important;border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;box-sizing:border-box;z-index:5;"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:${fuenteBanda}rem;line-height:1;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;">${codigoCli}</span></div>`;
        } else {
            etiquetasEquipoHTML += `
            <div data-color="${codigoCli}" data-color-kind="client" style="position:absolute;left:${x + GRID_PADDING - BORDE_OFFSET}px;top:${y + GRID_PADDING - BORDE_OFFSET - CHIP_ALTO + 2}px;height:${CHIP_ALTO}px;max-width:${CELL_W + BORDE_OFFSET * 2}px;padding:0 6px;background-color:${colorCli} !important;color:${colorTextoCliente} !important;border-color:${colorCli} !important;font-size:${CHIP_FONT}rem;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;border-radius:3px;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:visible;pointer-events:none;box-sizing:border-box;z-index:5;">${codigoCli}</div>`;
        }
    });

    let textosLibresHTML = '';
    Object.values(gruposLibres).forEach(g => {
        const filasArr = g.celdas.map(c => c.fila);
        const colsArr  = g.celdas.map(c => c.columna);
        const filaMin = Math.min(...filasArr);
        const filaMax = Math.max(...filasArr);
        const colMin  = Math.min(...colsArr);
        const colMax  = Math.max(...colsArr);

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
            <div style="position:absolute;left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:${fontSizeRem}rem;color:${colorTexto};text-transform:uppercase;letter-spacing:0.05em;text-shadow:0 1px 2px rgba(255,255,255,0.35);pointer-events:none;padding:2px;line-height:1.05;word-break:break-word;box-sizing:border-box;z-index:5;">${g.nombre}</div>`;
    });

    /* INDICADORES DE ZONA (vista previa y PDF)
       ---------------------------------------------------------
       UN indicador por grupo Nombre+Color y SIN palo ni corchete: solo la
       etiqueta con el punto de color, centrada a la altura de su zona y en el
       lado del canvas más cercano. Vive en el riel reservado FUERA del canvas
       (`.plano-con-riel`), así nunca tapa una celda ni se sale de la hoja. */
    const ANCHO_CONTENIDO = cols * CELL_W + (cols - 1) * GAP;
    const ALTO_CONTENIDO  = filas * CELL_H + (filas - 1) * GAP;
    const Y_CONTENIDO = BORDE_GRID + GRID_PADDING;
    const ALTO_WRAPPER  = BORDE_GRID * 2 + GRID_PADDING * 2 + ALTO_CONTENIDO;

    const gruposZona = new Map();
    (panel.zonas || []).forEach(zona => {
        const clave = `${zona.Nombre}||${zona.Color || ''}`;
        if (!gruposZona.has(clave)) {
            gruposZona.set(clave, {
                nombre: zona.Nombre,
                color: normalizarColor(zona.Color, COLOR_ZONA_DEFECTO),
                celdas: [],
                marcas: new Set()
            });
        }

        const grupo = gruposZona.get(clave);
        const filaInicio = Number(zona.FilaInicio) || 1;
        const filaFin = Math.max(filaInicio, Number(zona.FilaFin) || filaInicio);
        const colInicio = Number(zona.ColumnaInicio) || 1;
        const colFin = Math.max(colInicio, Number(zona.ColumnaFin) || colInicio);

        for (let f = filaInicio; f <= filaFin; f++) {
            for (let c = colInicio; c <= colFin; c++) {
                const marca = `${f}|${c}`;
                if (grupo.marcas.has(marca)) continue;
                grupo.marcas.add(marca);
                grupo.celdas.push({ fila: f, columna: c });
            }
        }
    });

    const ALTURA_ETIQUETA = 23;
    const ocupacionRiel = { derecha: [], izquierda: [] };
    let etiquetasRiel = '';

    const filaMinima = grupo => Math.min(...grupo.celdas.map(c => c.fila));

    /* RIEL POR LADO
       ---------------------------------------------------------
       El canvas NO cambia de tamaño: las franjas laterales solo se toman del
       espacio que ya sobraba en la hoja. Cada lado se topa a ESE sobrante (no
       al doble), así el bloque con riel nunca excede el ancho de la hoja ni
       desplaza el plano. */
    const RIEL_MINIMO = 64;
    /* Franja que ocupan las etiquetas giradas cuando la hoja no tiene espacio
       lateral. Se toma del relleno de la página, jamás del canvas. */
    const FRANJA_COMPACTA = 22;
    /* Ancho estimado de la etiqueta horizontal: texto en 0.86rem (≈9 px por
       carácter en mayúsculas) + punto (10) + hueco (6) + relleno (18) + bordes. */
    const anchoNecesarioEtiqueta = nombre => Math.min(220, 42 + String(nombre || '').length * 9.1) + 12;

    const gruposDibujables = [...gruposZona.values()]
        .filter(grupo => grupo.celdas.length)
        .map(grupo => {
            const columnas = grupo.celdas.map(c => c.columna);
            const centro = (Math.min(...columnas) + Math.max(...columnas)) / 2;
            return {
                grupo,
                lado: centro > (cols + 1) / 2 ? 'derecha' : 'izquierda',
                ancho: anchoNecesarioEtiqueta(grupo.nombre)
            };
        });

    let RIEL_IZQ = 0;
    let RIEL_DER = 0;
    /* La decisión es POR LADO: una franja puede caber y la otra no. Cuando un
       lado se queda sin riel, sus etiquetas se giran 90°. Antes el giro era
       global, así que el lado sin riel colocaba la etiqueta fuera del
       contenedor y acababa encima de la grilla. */
    let verticalIzq = false;
    let verticalDer = false;

    if (gruposDibujables.length) {
        if (sobranteLado >= RIEL_MINIMO) {
            const necesario = { izquierda: 0, derecha: 0 };
            gruposDibujables.forEach(g => {
                necesario[g.lado] = Math.max(necesario[g.lado], g.ancho);
            });
            RIEL_IZQ = Math.min(necesario.izquierda, sobranteLado);
            RIEL_DER = Math.min(necesario.derecha, sobranteLado);
            /* Por debajo del mínimo la etiqueta no se lee: se descarta ese riel. */
            if (RIEL_IZQ < RIEL_MINIMO) RIEL_IZQ = 0;
            if (RIEL_DER < RIEL_MINIMO) RIEL_DER = 0;
        }

        const hayLado = lado => gruposDibujables.some(g => g.lado === lado);

        /* El canvas ocupa todo el ancho útil (lo normal cuando hay muchas
           columnas). Cada lado sin riel gira sus etiquetas 90° y las lleva a la
           franja del relleno de página: no se tapa una sola celda y el plano
           mide exactamente lo mismo. */
        if (!RIEL_IZQ && hayLado('izquierda')) {
            verticalIzq = true;
            RIEL_IZQ = FRANJA_COMPACTA;
        }
        if (!RIEL_DER && hayLado('derecha')) {
            verticalDer = true;
            RIEL_DER = FRANJA_COMPACTA;
        }
    }

    const etiquetasVerticales = verticalIzq || verticalDer;

    /* Origen del canvas dentro del contenedor con riel. */
    const X_CONTENIDO = RIEL_IZQ + BORDE_GRID + GRID_PADDING;

    gruposDibujables
        .sort((a, b) => filaMinima(a.grupo) - filaMinima(b.grupo))
        .forEach(({ grupo, lado }) => {
            /* Cada lado se dibuja según SU riel: horizontal si la franja
               alcanza, girada 90° si ese lado no tiene espacio lateral. */
            const vertical = lado === 'derecha' ? verticalDer : verticalIzq;
            const filasGrupo = grupo.celdas.map(c => c.fila);
            const filaMin = Math.min(...filasGrupo);
            const filaMax = Math.max(...filasGrupo);
            /* Centro vertical de la zona completa (no de cada tramo): una sola
               etiqueta por zona, siempre a su altura. */
            const centro = Y_CONTENIDO
                + (filaMin - 1) * (CELL_H + GAP)
                + ((filaMax - filaMin + 1) * (CELL_H + GAP) - GAP) / 2;

            /* Alto que ocupará la etiqueta: fijo cuando va horizontal,
               proporcional al nombre cuando va girada. Sirve para apilarlas sin
               que se encimen. */
            const altoEtiqueta = vertical
                ? Math.min(ALTO_WRAPPER - 8, 26 + String(grupo.nombre || '').length * 8)
                : ALTURA_ETIQUETA;

            /* Apilado: dos etiquetas del mismo lado nunca se enciman. */
            const ocupacion = ocupacionRiel[lado];
            let y = centro - altoEtiqueta / 2;
            for (const bloque of ocupacion) {
                if (y < bloque.bottom + 6 && (y + altoEtiqueta) > bloque.top - 6) {
                    y = bloque.bottom + 6;
                }
            }
            y = Math.max(4, Math.min(y, Math.max(ALTO_WRAPPER - altoEtiqueta - 4, 4)));
            ocupacion.push({ top: y, bottom: y + altoEtiqueta });

            /* Borde visible del canvas en el lado de la etiqueta. */
            const xBordeCanvas = lado === 'derecha'
                ? X_CONTENIDO + ANCHO_CONTENIDO + BORDE_GRID + GRID_PADDING
                : X_CONTENIDO - BORDE_GRID - GRID_PADDING;

            let posicionLado;
            let anchoMaxEtiqueta;
            let claseEtiqueta = 'etiqueta-zona-pdf';

            if (vertical) {
                /* Etiqueta girada 90° pegada al borde del canvas: cabe en la
                   franja del relleno de página, así que no toca ninguna celda. */
                const franja = lado === 'derecha' ? RIEL_DER : RIEL_IZQ;
                anchoMaxEtiqueta = Math.max(16, franja - 2);
                claseEtiqueta += ' vertical';
                posicionLado = lado === 'derecha'
                    ? `left:${Math.round(xBordeCanvas + 1)}px;`
                    : `left:${Math.round(xBordeCanvas - 1)}px;transform:translateX(-100%);`;
            } else {
                /* Con riel: la etiqueta vive FUERA del canvas, en su lado. */
                const franja = lado === 'derecha' ? RIEL_DER : RIEL_IZQ;
                const SEPARACION = 8;
                const xEtiqueta = lado === 'derecha'
                    ? xBordeCanvas + SEPARACION
                    : xBordeCanvas - SEPARACION;

                /* En el lado izquierdo la etiqueta crece hacia la izquierda. */
                posicionLado = lado === 'derecha'
                    ? `left:${Math.round(xEtiqueta)}px;`
                    : `left:${Math.round(xEtiqueta)}px;transform:translateX(-100%);`;

                /* max-width acotado al riel: un nombre largo se recorta con
                   elipsis en lugar de salirse de la hoja. */
                anchoMaxEtiqueta = Math.max(40, franja - 12);
            }

            /* En vertical el eje del texto es el alto: se acota con max-height
               para que un nombre larguísimo se recorte con "…" en lugar de
               salirse de la hoja. */
            const limiteTexto = vertical
                ? ` style="max-height:${Math.round(Math.max(40, Math.min(ALTO_CONTENIDO, ALTO_WRAPPER - 30) - 12))}px;"`
                : '';

            etiquetasRiel += `
                <div class="${claseEtiqueta}" style="top:${Math.round(y)}px;${posicionLado}border-color:${grupo.color};max-width:${Math.round(anchoMaxEtiqueta)}px;">
                    <span class="punto-color" style="background:${grupo.color};"></span>
                    <span class="texto-zona-pdf"${limiteTexto}>${escaparTextoZona(grupo.nombre)}</span>
                </div>`;
        });

    const zonasLlavesHTML = etiquetasRiel;

    const filasTabla = equiposList.map(e => {
        const esDhcpSinIp = ['DHC', 'DHCP'].includes(String(e.TipoIP || '').trim().toUpperCase())
            && !String(e.IP || '').trim();
        const celdaRed = valor => esDhcpSinIp
            ? '<span class="badge-dhcp">DHCP</span>'
            : (valor || '-');
        const codigoCliente = String(e.ClienteCodigo || '').toUpperCase().trim();
        const colorCliente = colorClientePorCodigo(codigoCliente);
        return `
            <tr>
                <td class="bold-host">${e.Hostname || '-'}</td>
                <td class="center"><span class="badge-cli" data-color="${codigoCliente}" style="background-color:${colorCliente} !important;color:${colorTextoContraste(colorCliente)} !important;border-color:${colorCliente} !important;">${e.ClienteCodigo || '-'}</span></td>
                <td class="center"><span class="badge-rol" data-rol="${e.RolCodigo || ''}"${colorRolPorCodigo(e.RolCodigo) ? ` style="background-color:${colorRolPorCodigo(e.RolCodigo)};color:${colorTextoContraste(colorRolPorCodigo(e.RolCodigo))};"` : ''}>${e.RolCodigo || '-'}</span></td>
                <td class="mono">${celdaRed(e.IP)}</td>
                <td class="mono">${celdaRed(e.Mascara)}</td>
                <td class="mono">${celdaRed(e.PuertaEnlace)}</td>
                <td class="mono">${celdaRed(e.DNS1)}</td>
                <td class="mono">${celdaRed(e.DNS2)}</td>
                <td class="mono">${e.UsuarioAdmin || '-'}</td>
                <td class="mono">${e.PasswordAdmin || '-'}</td>
                <td class="mono">${e.DescripcionAdmin || '-'}</td>
            </tr>
        `;
    }).join('');

    const porRol = {};
    equiposList.forEach(e => {
        const r = e.RolCodigo || 'SIN ROL';
        porRol[r] = (porRol[r] || 0) + 1;
    });
    const rolesHTML = Object.entries(porRol).sort((a, b) => b[1] - a[1])
        .map(([rol, cant]) => `
            <div class="identificador-item">
                <span class="badge-rol" data-rol="${rol}"${colorRolPorCodigo(rol) ? ` style="background-color:${colorRolPorCodigo(rol)};color:${colorTextoContraste(colorRolPorCodigo(rol))};"` : ''}>${rol}</span>
                <span class="cant">${cant}</span>
            </div>`).join('');

    const porCliente = {};
    equiposList.forEach(e => {
        const c = e.ClienteCodigo || 'SIN CLIENTE';
        porCliente[c] = (porCliente[c] || 0) + 1;
    });
    const clientesHTML = Object.entries(porCliente).sort((a, b) => b[1] - a[1])
        .map(([cli, cant]) => {
            const colorCliente = colorClientePorCodigo(cli);
            return `
            <div class="identificador-item">
                <span class="badge-cli" data-color="${String(cli).toUpperCase().trim()}" style="background-color:${colorCliente} !important;color:${colorTextoContraste(colorCliente)} !important;border-color:${colorCliente} !important;">${cli}</span>
                <span class="cant">${cant}</span>
            </div>`;
        }).join('');

    const zonasLibresGrupos = Object.values(gruposLibres);
    const zonasLibresHTML = zonasLibresGrupos.length > 0
        ? zonasLibresGrupos.map(g => `
            <div class="identificador-item">
                <span class="muestra-color-inline" style="background:${normalizarColor(g.color)};"></span>
                <span class="nombre-zona-libre">${g.nombre}</span>
                <span class="cant">${g.celdas.length}</span>
            </div>`).join('')
        : '';

    return {
        celdasHTML,
        bordesEquipoHTML,
        etiquetasEquipoHTML,
        textosLibresHTML,
        zonasLlavesHTML,
        rielIzq: RIEL_IZQ,
        rielDer: RIEL_DER,
        compacto: etiquetasVerticales,
        celdasAngostas,
        bandaCliente,
        altoBanda,
        filasTabla,
        rolesHTML,
        clientesHTML,
        zonasLibresHTML,
        totalEquipos,
        equiposList
    };
}

/* CSS de apoyo cuando el código del cliente se dibuja como banda DENTRO de la
   celda (celdas angostas o celdas bajas). Se usa TAL CUAL en la vista previa y
   en el PDF para que ambos salgan idénticos: la banda del cliente ya ocupa la
   parte alta de la celda, así que el texto empieza por debajo sin desbordarse
   ni pisar la celda vecina. Las celdas NO cambian de tamaño, así que el plano
   sigue cabiendo en una sola hoja. */
function cssBandasCliente({ bandaCliente, celdasAngostas, altoBanda, CELL_H, FONT_HOST, FONT_IP }) {
    if (!bandaCliente) return '';

    /* Alto REAL que le queda al texto: la caja de la celda (menos el borde de
       1.5px por lado de las ocupadas), menos el padding superior que reserva
       la banda (+1px de aire) y menos 1px de padding inferior. */
    const altoTexto = Math.max(6, CELL_H - 3 - (altoBanda + 1) - 1);
    const pxHost = parseFloat(FONT_HOST) * 16;
    const pxIP   = parseFloat(FONT_IP)   * 16;
    /* Escala mínima para que hostname + IP quepan en una línea cada uno debajo
       de la banda. Es un ajuste diminuto (≈0.93 en el plano 12 × 37) y tiene
       suelo 0.70: por debajo de eso el texto dejaría de leerse y es preferible
       que el clamp recorte. */
    const escala = Math.max(0.70, Math.min(1, (altoTexto - 1) / Math.max(1, pxHost + pxIP)));
    const hostRem = (parseFloat(FONT_HOST) * escala).toFixed(3);
    const ipRem   = (parseFloat(FONT_IP)   * escala).toFixed(3);

    /* Celdas bajas: una sola línea por campo, empezando justo bajo la banda. */
    if (!celdasAngostas) {
        return `
                .celda-contenido {
                    gap: 0;
                    justify-content: flex-start;
                    padding: ${altoBanda + 1}px 2px 1px;
                    line-height: 1;
                    overflow: hidden;
                }
                .celda-hostname,
                .celda-ip {
                    flex: 0 0 auto;
                    min-height: 0;
                    max-width: 100%;
                    white-space: nowrap;
                    line-height: 1;
                }
                .celda-hostname { font-size: ${hostRem}rem; }
                .celda-ip       { font-size: ${ipRem}rem; }
        `;
    }

    /* Reparto del alto REAL de la celda. Antes se usaba un número de líneas
       fijo, que en celdas bajas dejaba la IP cortada a media línea y en celdas
       altas desaprovechaba espacio. Ahora se calcula con las fuentes que ya
       trae el layout (rem → px con la base de 16px del navegador):
       - la banda del cliente (+1px de separación) es intocable;
       - se descuentan el borde de la celda y el padding vertical;
       - el hostname se queda con ~60% del resto y la IP con ~40%, con un
         mínimo de una línea y los topes de siempre (3 y 2).
       Con `-webkit-line-clamp` + `overflow: hidden` el texto se recorta con
       puntos suspensivos DENTRO de su celda: nunca desborda ni pisa la
       vecina, y el plano sigue cabiendo en una sola hoja. */
    const altoTextoMultilinea = Math.max(0, CELL_H - 3 - altoBanda - 3);
    const pxHostLinea = pxHost * 1.02;
    const pxIPLinea   = pxIP * 1.02;
    const lineasHostname = (pxHostLinea > 0 && !Number.isNaN(pxHostLinea))
        ? Math.max(1, Math.min(3, Math.floor((altoTextoMultilinea * 0.6) / pxHostLinea)))
        : 2;
    const lineasIP = (pxIPLinea > 0 && !Number.isNaN(pxIPLinea))
        ? Math.max(1, Math.min(2, Math.floor((altoTextoMultilinea * 0.4) / pxIPLinea)))
        : 1;

    return `
                .celda-contenido {
                    gap: 1px;
                    justify-content: flex-start;
                    padding: ${altoBanda + 1}px 2px 2px;
                    overflow: hidden;
                }
                /* sin min-height: 0 un flex item no puede encogerse por debajo
                   de su contenido y el clamp no tendría efecto */
                .celda-hostname,
                .celda-ip {
                    min-height: 0;
                    max-width: 100%;
                }
                .celda-hostname {
                    white-space: normal;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    text-overflow: clip;
                    line-height: 1.02;
                    display: -webkit-box;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: ${lineasHostname};
                    overflow: hidden;
                }
                .celda-ip {
                    white-space: normal;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    text-overflow: clip;
                    line-height: 1.02;
                    display: -webkit-box;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: ${lineasIP};
                    overflow: hidden;
                }
    `;
}

function generarHTMLVistaPrevia(panel) {
    const piso = pisos.find(p => Number(p.IdPiso) === Number(panel.idPiso));
    const nombrePiso = piso ? piso.Nombre : '';
    const fecha = new Date().toLocaleString('es-MX');
    const marcaPropuesta = obtenerMarcaPropuesta(panel, 'preview');

    const layout = calcularLayoutPlano(panel);
    const bloques = construirBloquesPlano(panel, layout);

    const {
        cols, filas, GAP, GRID_PADDING, CELL_W, CELL_H,
        FONT_HOST, FONT_IP
    } = layout;
    const {
        celdasHTML, bordesEquipoHTML, etiquetasEquipoHTML,
        textosLibresHTML, zonasLlavesHTML, rielIzq, rielDer, compacto,
        celdasAngostas, bandaCliente, altoBanda, filasTabla, rolesHTML,
        clientesHTML, zonasLibresHTML, totalEquipos
    } = bloques;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Vista previa — ${nombrePiso || 'Plano'}</title>
            <link rel="stylesheet" href="../css/planorenderer.css">
            <style>
                .grid-plano {
                    grid-template-columns: repeat(${cols}, ${CELL_W}px);
                    grid-template-rows: repeat(${filas}, ${CELL_H}px);
                    gap: ${GAP}px;
                    padding: ${GRID_PADDING}px;
                }
                .celda {
                    width: ${CELL_W}px;
                    height: ${CELL_H}px;
                }
                .celda-hostname { font-size: ${FONT_HOST}rem; }
                .celda-ip       { font-size: ${FONT_IP}rem; }
                ${cssBandasCliente({ bandaCliente, celdasAngostas, altoBanda, CELL_H, FONT_HOST, FONT_IP })}
                .marca-propuesta {
                    display: inline-flex; flex-direction: column; max-width: 250px; margin-bottom: 5px;
                    padding: 4px 8px; border: 1px solid var(--plano-oro); border-radius: 6px;
                    background: var(--plano-superficie-suave); color: var(--plano-oliva-oscuro);
                    font-size: .68rem; font-weight: 800; letter-spacing: .06em; line-height: 1.25;
                    text-align: right; overflow-wrap: anywhere;
                }
                .marca-propuesta small { color: var(--plano-texto-secundario); font-size: .66rem; font-weight: 600; letter-spacing: 0; }
                .marca-plano-actual {
                    display: inline-block; margin-bottom: 5px; padding: 4px 8px;
                    border: 1px solid var(--plano-borde-fuerte); border-radius: 6px;
                    background: var(--plano-oliva-suave); color: var(--plano-oliva-oscuro);
                    font-size: .68rem; font-weight: 800; letter-spacing: .06em;
                }

                /* Riel de indicadores de zona: la franja reservada a los lados
                   del canvas. Sin recorte, para que la etiqueta no se corte en
                   la vista previa. */
                /* Mismo relleno de página que el PDF: el cálculo del riel
                   (PADDING_PAGINA = 12) supone exactamente estos 12 px. Con los
                   20 px de planorenderer.css el canvas se desplazaba respecto a
                   la franja y la etiqueta se metía en la grilla. */
                .pagina-plano {
                    padding: 8px 12px;
                }
                .plano-wrap {
                    padding: 12px 8px;
                    overflow: visible;
                    align-items: flex-start;
                }
                .plano-con-riel {
                    position: relative;
                    width: fit-content;
                    flex-shrink: 0;
                    /* Igual que en el PDF: el riel se suma al canvas. */
                    box-sizing: content-box;
                }
                .etiqueta-zona-pdf {
                    position: absolute;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 23px;
                    padding: 0 9px;
                    background: #fff;
                    border: 2px solid;
                    border-radius: 6px;
                    font-size: 0.86rem;
                    font-weight: 700;
                    color: #1e293b;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    white-space: nowrap;
                    box-sizing: border-box;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                }
                .etiqueta-zona-pdf .punto-color {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 2px;
                    flex-shrink: 0;
                }
                .etiqueta-zona-pdf .texto-zona-pdf {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                /* Igual que en el PDF: etiqueta girada cuando no hay franjas
                   laterales libres, y relleno lateral cedido al riel. */
                .etiqueta-zona-pdf.vertical {
                    writing-mode: vertical-rl;
                    height: auto;
                    padding: 8px 0;
                    font-size: 0.78rem;
                    line-height: 1.1;
                    letter-spacing: 0.06em;
                }
                .etiqueta-zona-pdf.vertical .texto-zona-pdf {
                    text-overflow: clip;
                }
                .plano-wrap.compacto,
                .pagina-plano.compacto {
                    padding-left: 0;
                    padding-right: 0;
                }
            </style>
        </head>
        <body class="vista-previa-body">

            <div class="zoom-scroll-area" id="zoom-scroll-area">
                <div class="zoom-center" id="zoom-center">
                    <div id="pdf-zoom-target">

                        <div class="pagina-plano${compacto ? ' compacto' : ''}">
                            <div class="encabezado">
                                <div class="titulo">
                                    <h1>Plano de Equipos</h1>
                                    <div class="sub">${nombrePiso}</div>
                                </div>
                                <div class="meta">
                                    ${marcaPropuesta}
                                    <div><strong>Fecha:</strong> ${fecha}</div>
                                    <div><strong>Total equipos:</strong> ${totalEquipos}</div>
                                    <div><strong>Dimensiones:</strong> ${cols} × ${filas}</div>
                                </div>
                            </div>

                            <div class="plano-wrap${compacto ? ' compacto' : ''}">
                                <div class="plano-con-riel" style="padding:0 ${rielDer}px 0 ${rielIzq}px;">
                                    <div class="grid-plano">
                                        ${celdasHTML}
                                        ${bordesEquipoHTML}
                                        ${etiquetasEquipoHTML}
                                        ${textosLibresHTML}
                                    </div>
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
                                    ${marcaPropuesta}
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

    const nombreArchivo = `Plano-${nombrePiso || 'Piso'}-${Date.now()}.pdf`;
    return { html, nombreArchivo };
}

function generarHTMLParaPDF(panel) {
    const piso = pisos.find(p => Number(p.IdPiso) === Number(panel.idPiso));
    const nombrePiso = piso ? piso.Nombre : '';
    const fecha = new Date().toLocaleString('es-MX');
    const marcaPropuesta = obtenerMarcaPropuesta(panel, 'documento');

    const layout = calcularLayoutPlano(panel);
    const bloques = construirBloquesPlano(panel, layout);

    const {
        cols, filas, GAP, GRID_PADDING, CELL_W, CELL_H,
        FONT_HOST, FONT_IP, orientacionPagina
    } = layout;
    const {
        celdasHTML, bordesEquipoHTML, etiquetasEquipoHTML,
        textosLibresHTML, zonasLlavesHTML, rielIzq, rielDer, compacto,
        celdasAngostas, bandaCliente, altoBanda, filasTabla, rolesHTML,
        clientesHTML, zonasLibresHTML, totalEquipos
    } = bloques;

    const cssFinal = CSS_PDF.replace('var(--pdf-orientation, landscape)', orientacionPagina);

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>PDF — ${nombrePiso || 'Plano'}</title>
            <style>${cssFinal}</style>
            <style>
                .grid-plano {
                    grid-template-columns: repeat(${cols}, ${CELL_W}px);
                    grid-template-rows: repeat(${filas}, ${CELL_H}px);
                    gap: ${GAP}px;
                    padding: ${GRID_PADDING}px;
                }
                .celda {
                    width: ${CELL_W}px;
                    height: ${CELL_H}px;
                }
                .celda-hostname { font-size: ${FONT_HOST}rem; }
                .celda-ip       { font-size: ${FONT_IP}rem; }
                ${cssBandasCliente({ bandaCliente, celdasAngostas, altoBanda, CELL_H, FONT_HOST, FONT_IP })}
            </style>
        </head>
        <body>

            <div class="pagina-plano${compacto ? ' compacto' : ''}">
                <div class="encabezado">
                    <div class="titulo">
                        <h1>Plano de Equipos</h1>
                        <div class="sub">${nombrePiso}</div>
                    </div>
                    <div class="meta">
                        ${marcaPropuesta}
                        <div><strong>Fecha:</strong> ${fecha}</div>
                        <div><strong>Total equipos:</strong> ${totalEquipos}</div>
                        <div><strong>Dimensiones:</strong> ${cols} × ${filas}</div>
                    </div>
                </div>

                <div class="plano-wrap${compacto ? ' compacto' : ''}">
                    <div class="plano-con-riel" style="padding:0 ${rielDer}px 0 ${rielIzq}px;">
                        <div class="grid-plano">
                            ${celdasHTML}
                            ${bordesEquipoHTML}
                            ${etiquetasEquipoHTML}
                            ${textosLibresHTML}
                        </div>
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
                        ${marcaPropuesta}
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

        </body>
        </html>
    `;

    const prefijoPropuesta = panel.escenarioFuturoId ? 'Propuesta-' : '';
    const nombreArchivo = `${prefijoPropuesta}Plano-Documentado-${nombrePiso || 'Piso'}-${Date.now()}.pdf`;
    return { html, nombreArchivo, orientacion: orientacionPagina };
}

function obtenerMarcaPropuesta(panel, tipo) {
    if (!panel?.escenarioFuturoId) {
        return tipo === 'preview' ? '<div class="marca-plano-actual">PLANO ACTUAL</div>' : '';
    }
    const escenario = (panel.escenariosFuturos || []).find(
        item => Number(item.IdEscenarioFuturo) === Number(panel.escenarioFuturoId)
    );
    const nombre = escenario?.Nombre || 'Escenario futuro';
    const nombreSeguro = String(nombre).replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
    const etiqueta = tipo === 'documento' ? 'DOCUMENTO · PROPUESTA FUTURA' : 'VISTA PREVIA · PROPUESTA FUTURA';
    return `<div class="marca-propuesta">${etiqueta}<small>${nombreSeguro}</small></div>`;
}

/* =========================================================
   ATAJOS: ENTER para nombrar/guardar el grupo (Zona y Zona Libre)
   ========================================================= */
document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
        const hayModoActivo = modoZona || modoZonaLibre || modoEdicion;
        if (!hayModoActivo) return;
        if (modalZonaLibreAceptar.disabled || edGuardando) return;

        ev.preventDefault();
        if (modalZona.style.display === 'flex') modalZonaCancelar.click();
        if (modalZonaLibre.style.display === 'flex') modalZonaLibreCancelar.click();
        if (modalEditarEquipo.style.display === 'flex') cerrarModalEditarEquipo();

        modoZona = false;
        modoZonaLibre = false;
        modoEdicion = false;
        arrastreZona = null;
        arrastreZonaTerminado = false;
        document.body.classList.remove('seleccionando-grupo');
        celdasZonaSeleccionadas = [];
        celdasLibresSeleccionadas = [];
        [gridIzq, gridDer].forEach(grid => {
            if (grid) grid.classList.remove('modo-zona-libre');
        });
        actualizarBotonesModo();
        renderGridPanel(panelIzq);
        renderGridPanel(panelDer);
        return;
    }

    if (ev.key !== 'Enter') return;

    /* Los modales de nombre son <div>, no <form>: sin esto, escribir "MESA 1"
       y pulsar Enter no hacía nada y obligaba a buscar el botón Guardar. */
    if (modalZona.style.display === 'flex' && !modalZonaAceptar.disabled) {
        ev.preventDefault();
        modalZonaAceptar.click();
        return;
    }

    if (modalZonaLibre.style.display === 'flex' && !modalZonaLibreAceptar.disabled) {
        ev.preventDefault();
        modalZonaLibreAceptar.click();
        return;
    }

    /* Con el foco en otro campo (buscador lateral, filas/columnas) Enter es del
       campo, no un atajo del plano. */
    const enfocado = document.activeElement;
    if (enfocado && (
        enfocado.tagName === 'INPUT' ||
        enfocado.tagName === 'TEXTAREA' ||
        enfocado.tagName === 'SELECT' ||
        enfocado.isContentEditable
    )) return;

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
    // 1. INICIALIZAR PERMISOS PRIMERO (Oculta/deshabilita botones)
    if (window.PermisosUI) {
        await window.PermisosUI.init();
    }

    // 2. Cargar el resto de datos
    await cargarClientes();
    roles = await window.api.roles.listar();
    await cargarPisosPanel(panelIzq, false);
    renderPanelLateral();
    crearTooltip();
    actualizarBotonesModo();

    /* Re-render con debounce: el riel de zonas se mide con el canvas ya
       reposicionado, y no se reconstruye la grilla en cada píxel del arrastre. */
    let temporizadorResize = null;
    window.addEventListener('resize', () => {
        if (temporizadorResize) clearTimeout(temporizadorResize);
        temporizadorResize = setTimeout(() => {
            temporizadorResize = null;
            if (panelIzq.idPiso) renderGridPanel(panelIzq);
            if (panelDer.idPiso && panelDerDiv.style.display !== 'none') renderGridPanel(panelDer);
        }, 140);
    });
})();