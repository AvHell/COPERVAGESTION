/* =========================================================
   ACTIVO FIJO — DETALLE DEL ACTIVO (renderer)
   ---------------------------------------------------------
   Maestro de activos, ficha (red / cuentas / programas) y
   buscadores cruzados.

   SIN require: todo pasa por window.api.activoFijo.detalle
   (preload.js -> ipcMain de main.js -> consultas/detalle.js).

   Reglas que respeta:
     · Sólo lectura: este módulo no escribe nada.
     · Paginado en el SERVIDOR: no se traen los ~500 activos ni
       los 200+ programas de un activo de golpe. El control de
       paginación reutiliza el marcado de paginador.css, pero
       pide otra página en vez de recortar un arreglo en memoria.
     · Vigente = 1 siempre: ni la ficha ni los buscadores cruzados
       muestran filas históricas (Vigente = 0).
     · Si el script de base no se aplicó, la página lo explica en
       vez de reventar con "Invalid object name".
   ========================================================= */

(function () {

const Swal = window.Swal;
const OCULTO = 'oculto';

/* =========================================================
   ESTADO
   ========================================================= */
const estado = {
    seccion: 'maestro',
    fuentes: null,
    maestro: { busqueda: '', dominio: '', filtro: '', pagina: 1, tamano: 50, total: 0, cargando: false },
    programa: { texto: '', version: '', pagina: 1, tamano: 25, total: 0, cargando: false },
    cuenta: { texto: '', tipo: '', pagina: 1, tamano: 25, total: 0, cargando: false },
    host: { texto: '', pagina: 1, tamano: 25, total: 0, cargando: false },
    componente: { texto: '', tipo: '', pagina: 1, tamano: 25, total: 0, cargando: false },
    ficha: null
};

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const $ = id => document.getElementById(id);

const elBtnVolver    = $('btn-volver');
const elBtnRecargar  = $('btn-recargar');

const elAviso        = $('aviso-fuentes');
const elAvisoTexto   = $('aviso-fuentes-texto');

const elTabs  = $('det-tabs');
const paneles = {
    maestro: $('panel-maestro'),
    buscadores: $('panel-buscadores')
};

/* Maestro */
const elBusquedaMaestro = $('input-busqueda');
const elFiltroDominio   = $('filtro-dominio');
const elFiltroVista     = $('filtro-vista');
const elBtnLimpiar      = $('btn-limpiar-maestro');
const elTbodyMaestro    = $('tbody-maestro');
const elCardMaestro     = $('card-maestro');
const elVacioMaestro    = $('vacio-maestro');
const elPillMaestro     = $('pill-maestro');

/* Buscadores cruzados */
const elPrgTexto      = $('prg-texto');
const elPrgVersion    = $('prg-version');
const elBtnPrg        = $('btn-buscar-programa');
const elPrgResumen    = $('prg-resumen');
const elCardPrograma  = $('card-programa');
const elTbodyPrograma = $('tbody-programa');

const elCtaTexto    = $('cta-texto');
const elCtaTipo     = $('cta-tipo');
const elBtnCta      = $('btn-buscar-cuenta');
const elCardCuenta  = $('card-cuenta');
const elTbodyCuenta = $('tbody-cuenta');

const elHostTexto  = $('host-texto');
const elBtnHost    = $('btn-buscar-host');
const elCardHost   = $('card-host');
const elTbodyHost  = $('tbody-host');

/* Buscador de piezas: la pieza nunca es un activo, se responde con su equipo. */
const elCompTexto    = $('comp-texto');
const elCompTipo     = $('comp-tipo');
const elBtnComp      = $('btn-buscar-componente');
const elCompResumen  = $('comp-resumen');
const elCardComponente  = $('card-componente');
const elTbodyComponente = $('tbody-componente');

const elPillBusqueda = $('pill-busqueda');

/* Ficha */
const elModal          = $('det-modal');
const elFichaTitulo    = $('ficha-titulo');
const elFichaSub       = $('ficha-subtitulo');
const elBtnCerrarFicha = $('btn-cerrar-ficha');
const elFichaTabs      = $('ficha-tabs');
const elPillRed        = $('pill-red');
const elPillCuentas    = $('pill-cuentas');
const elPillProgramas  = $('pill-programas');
const elPillComponentes = $('pill-componentes');
const elFichaEquipo    = $('ficha-equipo');
const elFichaRed       = $('ficha-red');
const elFichaCuentas   = $('ficha-cuentas');
const elFichaProgramas = $('ficha-programas');
const elFichaComponentes = $('ficha-componentes');
const elFichaLotes     = $('ficha-lotes');
const elFichaPie       = $('ficha-pie');
const elTbodyRed       = $('tbody-red');
const elTbodyCuentas   = $('tbody-cuentas');
const elTbodyProgramas = $('tbody-programas');
const elTbodyComponentes = $('tbody-componentes');

/* Statusbar */
const elStatusTexto   = $('status-texto');
const elStatusDerecha = $('status-derecha');

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function texto(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).trim();
}

/** Celda que nunca queda vacía: marca el hueco con un guion. */
function celda(valor, clase) {
    const t = texto(valor);
    const attr = clase ? ` class="${clase}"` : '';
    return t
        ? `<td${attr}>${escaparHTML(t)}</td>`
        : `<td${attr}><span class="sin-dato">—</span></td>`;
}

function celdaNumero(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n === 0) return '<td class="num"><span class="sin-dato">0</span></td>';
    return `<td class="num">${n}</td>`;
}

function formatearFecha(valor) {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '—';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
}

function formatearFechaHora(valor) {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '—';
    const hora = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${formatearFecha(valor)} ${hora}:${min}`;
}

function debounce(fn, ms = 350) {
    let t = null;
    return (...args) => {
        if (t) clearTimeout(t);
        t = setTimeout(() => { t = null; fn(...args); }, ms);
    };
}

function setStatus(izquierda, derecha) {
    if (elStatusTexto && izquierda !== undefined) elStatusTexto.textContent = izquierda;
    if (elStatusDerecha && derecha !== undefined) elStatusDerecha.textContent = derecha;
}

function mostrar(el, visible) {
    if (el) el.classList.toggle(OCULTO, !visible);
}

function toastExito(titulo) {
    if (!Swal) return;
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2400, timerProgressBar: true
    });
}

function toastError(titulo, detalle) {
    if (!Swal) { console.error('[Detalle AF]', titulo, detalle || ''); return; }
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'error',
        title: detalle ? `${titulo} — ${detalle}` : titulo,
        showConfirmButton: false, timer: 3800, timerProgressBar: true
    });
}

/** Respuesta fallida de la capa de datos: un solo camino de aviso. */
function avisarError(res, contexto) {
    const mensaje = (res && res.mensaje) || 'No se pudo consultar la base de datos.';
    toastError(contexto, mensaje);
    setStatus(`${contexto}: ${mensaje}`);
}

/* =========================================================
   PAGINACIÓN EN SERVIDOR
   ---------------------------------------------------------
   Mismo marcado que pinta paginador.css (.paginacion,
   .paginador-tamano, .paginador-resumen, .paginador-acciones),
   pero cada cambio pide otra página a la base.
   ========================================================= */
function crearPaginador(contenedor, opciones) {
    const opts = opciones || {};
    const raiz = typeof contenedor === 'string' ? $(contenedor) : contenedor;
    const tamanos = Array.isArray(opts.tamanos) && opts.tamanos.length ? opts.tamanos : [25, 50, 100];
    let tamano = tamanos.includes(Number(opts.tamano)) ? Number(opts.tamano) : tamanos[0];
    let pagina = 1;
    let total = 0;

    if (!raiz) {
        return {
            pintar: () => {}, mostrar: () => {}, reiniciar: () => {},
            get tamano() { return tamano; }, get pagina() { return pagina; }
        };
    }

    raiz.classList.add('paginador-contenedor');
    raiz.replaceChildren();

    const nav = document.createElement('nav');
    nav.className = 'paginacion';
    nav.setAttribute('aria-label', 'Paginación de la tabla');

    const label = document.createElement('label');
    label.append('Filas ');
    const sel = document.createElement('select');
    sel.className = 'paginador-tamano';
    tamanos.forEach(n => sel.append(new Option(String(n), String(n))));
    sel.value = String(tamano);
    label.append(sel);

    const resumen = document.createElement('span');
    resumen.className = 'paginador-resumen';
    resumen.setAttribute('aria-live', 'polite');

    const acciones = document.createElement('div');
    acciones.className = 'paginador-acciones';
    const btnAnterior = document.createElement('button');
    btnAnterior.type = 'button';
    btnAnterior.textContent = 'Anterior';
    const btnSiguiente = document.createElement('button');
    btnSiguiente.type = 'button';
    btnSiguiente.textContent = 'Siguiente';
    acciones.append(btnAnterior, btnSiguiente);

    nav.append(label, resumen, acciones);
    raiz.append(nav);

    const paginas = () => Math.max(1, Math.ceil(total / tamano));
    const emitir = () => { if (typeof opts.alCambiar === 'function') opts.alCambiar(pagina, tamano); };

    sel.addEventListener('change', () => {
        tamano = Number(sel.value) || tamanos[0];
        pagina = 1;
        emitir();
    });
    btnAnterior.addEventListener('click', () => {
        if (pagina <= 1) return;
        pagina -= 1;
        emitir();
    });
    btnSiguiente.addEventListener('click', () => {
        if (pagina >= paginas()) return;
        pagina += 1;
        emitir();
    });

    return {
        get tamano() { return tamano; },
        get pagina() { return pagina; },
        reiniciar() { pagina = 1; },
        mostrar(visible) { raiz.classList.toggle(OCULTO, !visible); },
        pintar(totalFilas, paginaActual) {
            total = Number(totalFilas) || 0;
            pagina = Math.min(Math.max(1, Number(paginaActual) || 1), paginas());
            const inicio = (pagina - 1) * tamano;
            const fin = Math.min(inicio + tamano, total);
            resumen.textContent = total ? `${inicio + 1}–${fin} de ${total}` : '0 registros';
            btnAnterior.disabled = pagina <= 1;
            btnSiguiente.disabled = pagina >= paginas();
        }
    };
}

/* =========================================================
   ¿ESTÁN LAS FUENTES?
   ---------------------------------------------------------
   Si el script de base no se aplicó, se dice qué falta en vez de
   mostrar tablas vacías sin explicación.
   ========================================================= */
async function revisarFuentes() {
    try {
        const res = await window.api.activoFijo.detalle.estado();
        if (!res || res.ok === false) {
            avisarError(res, 'No se pudo revisar la base');
            return;
        }
        estado.fuentes = res;
        if (res.listo) {
            mostrar(elAviso, false);
            return;
        }

        const faltan = [];
        if (!res.maestro)   faltan.push('dbo.vw_ActivoFijoEquipoInline');
        if (!res.red)       faltan.push('dbo.ActivoFijoEquiposRed');
        if (!res.cuentas)   faltan.push('dbo.ActivoFijoEquiposCuentas');
        if (!res.programas) faltan.push('dbo.ActivoFijoEquiposProgramas');
        if (!res.componentes) faltan.push('dbo.ActivoFijoEquiposComponentes');

        if (elAvisoTexto) {
            elAvisoTexto.innerHTML = faltan.length
                ? `Faltan ${escaparHTML(faltan.join(', '))}. Ejecuta <code>${escaparHTML(res.script || 'scripts/activo-fijo-detalle.sql')}</code> en la base y vuelve a recargar.`
                : 'Ejecuta el script de base de datos y vuelve a recargar.';
        }
        mostrar(elAviso, true);
    } catch (err) {
        console.error('[Detalle AF] revisarFuentes:', err);
        toastError('No se pudo revisar la base', err.message || '');
    }
}

/* =========================================================
   MAESTRO DE ACTIVOS
   ========================================================= */
const pagMaestro = crearPaginador('paginacion-maestro', {
    tamanos: [50, 100],
    tamano: 50,
    alCambiar: (pagina, tamano) => {
        estado.maestro.pagina = pagina;
        estado.maestro.tamano = tamano;
        cargarMaestro();
    }
});

function pintarMaestro(filas) {
    if (!elTbodyMaestro) return;
    elTbodyMaestro.innerHTML = filas.map(f => {
        const id = Number(f.IdActivoFijoEQ) || 0;
        const dominio = texto(f.Dominio);
        return `
            <tr>
                ${celda(f.NoSerie, 'mono')}
                ${celda(f.Hostname)}
                <td>${dominio ? `<span class="tag tag-dominio">${escaparHTML(dominio)}</span>` : '<span class="sin-dato">—</span>'}</td>
                ${celda(f.IP, 'mono')}
                ${celda(f.MAC, 'mono')}
                ${celda(f.Adaptador)}
                ${celdaNumero(f.Programas)}
                ${celdaNumero(f.Cuentas)}
                ${celdaNumero(f.Componentes)}
                ${celda(formatearFechaHora(f.UltimaDeteccion))}
                <td class="acciones-col">
                    <button type="button" class="btn-mini" data-ficha="${id}" title="Ver red, cuentas y programas de este activo">Ficha</button>
                </td>
            </tr>`;
    }).join('');
}

async function cargarMaestro() {
    const m = estado.maestro;
    if (m.cargando) return;
    m.cargando = true;
    setStatus('Consultando el maestro de activos…');

    try {
        const res = await window.api.activoFijo.detalle.maestro.listar({
            busqueda: m.busqueda,
            dominio: m.dominio,
            filtro: m.filtro,
            pagina: m.pagina,
            tamano: m.tamano
        });

        if (!res || res.ok === false) {
            avisarError(res, 'No se pudo cargar el maestro');
            pintarMaestro([]);
            m.total = 0;
            mostrar(elCardMaestro, false);
            mostrar(elVacioMaestro, false);
            pagMaestro.mostrar(false);
            return;
        }

        if (res.fuenteDisponible === false) {
            mostrar(elAviso, true);
            pintarMaestro([]);
            m.total = 0;
            mostrar(elCardMaestro, false);
            mostrar(elVacioMaestro, false);
            pagMaestro.mostrar(false);
            if (elPillMaestro) elPillMaestro.textContent = 'Sin fuentes';
            setStatus(res.mensaje || 'Las vistas del colector aún no existen.');
            return;
        }

        m.total  = Number(res.total) || 0;
        m.pagina = Number(res.pagina) || 1;
        m.tamano = Number(res.tamano) || m.tamano;

        pintarMaestro(Array.isArray(res.filas) ? res.filas : []);

        const hay = m.total > 0;
        mostrar(elCardMaestro, hay);
        mostrar(elVacioMaestro, !hay);
        pagMaestro.pintar(m.total, m.pagina);
        pagMaestro.mostrar(hay);

        if (elPillMaestro) {
            elPillMaestro.textContent = m.total === 1 ? '1 activo' : `${m.total} activos`;
        }
        setStatus(
            hay ? `${m.total} activos en el maestro` : 'Sin activos que coincidan con el filtro',
            (m.busqueda || m.dominio || m.filtro) ? 'Filtros activos' : 'Sin filtros'
        );
    } catch (err) {
        console.error('[Detalle AF] cargarMaestro:', err);
        toastError('No se pudo cargar el maestro', err.message || '');
    } finally {
        m.cargando = false;
    }
}

async function cargarDominios() {
    if (!elFiltroDominio) return;
    try {
        const res = await window.api.activoFijo.detalle.maestro.dominios();
        if (!res || res.ok === false || !Array.isArray(res.dominios)) return;

        elFiltroDominio.replaceChildren(new Option('Todos', ''));
        res.dominios.forEach(d => elFiltroDominio.append(new Option(String(d), String(d))));
        elFiltroDominio.append(new Option('(sin dominio)', '(sin-dominio)'));
        elFiltroDominio.value = estado.maestro.dominio;
    } catch (err) {
        console.error('[Detalle AF] cargarDominios:', err);
    }
}
/* =========================================================
   FICHA DEL ACTIVO (carga on demand por IdActivoFijoEQ)
   ========================================================= */
/* Un icono por tipo de dato, según su función. Trazo de 1.8 sobre
   viewBox 24 para que empate con los iconos de las pestañas. */
const SVGS_FICHA = {
    identificacion: '<rect x="3" y="4" width="18" height="12" rx="2"></rect><line x1="8" y1="20" x2="16" y2="20"></line><line x1="12" y1="16" x2="12" y2="20"></line>',
    componentes: '<rect x="7" y="7" width="10" height="10" rx="2"></rect><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"></path>',
    sistema: '<path d="M12 3l7 3v5.5c0 4-2.9 7.6-7 9.5-4.1-1.9-7-5.5-7-9.5V6z"></path><path d="M9.2 12l2 2 3.6-3.6"></path>',
    asignacion: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    notas: '<path d="M6 3h9l4 4v14H6z"></path><path d="M9 12h7M9 16h5"></path>'
};

function svgFicha(clave) {
    const trazo = SVGS_FICHA[clave];
    if (!trazo) return '';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${trazo}</svg>`;
}

/* La pestaña "Equipo" no es una rejilla de cajas sueltas: es una hoja
   de ficha, con secciones rotuladas por icono y renglones
   etiqueta/valor separados por una línea. */
const GRUPOS_EQUIPO = [
    {
        titulo: 'Identificación',
        icono: 'identificacion',
        campos: [
            ['NoSerie', 'No. de serie', 'mono'],
            ['Marca', 'Marca', ''],
            ['Modelo', 'Modelo', ''],
            ['Tipo', 'Tipo', '']
        ]
    },
    {
        titulo: 'Componentes',
        icono: 'componentes',
        campos: [
            ['Procesador', 'Procesador', ''],
            ['MemoriaRAM', 'Memoria RAM', ''],
            ['Almacenamiento', 'Almacenamiento', '']
        ]
    },
    {
        titulo: 'Sistema y estado',
        icono: 'sistema',
        campos: [
            ['SistemaOperativo', 'Sistema operativo', ''],
            ['Estado', 'Estado', ''],
            ['Estatus', 'Estatus', '']
        ]
    },
    {
        titulo: 'Asignación',
        icono: 'asignacion',
        campos: [
            ['Cartera', 'Cartera', ''],
            ['UsuarioAsignado', 'Usuario asignado', '']
        ]
    },
    {
        titulo: 'Observaciones',
        icono: 'notas',
        ancho: true,
        campos: [
            ['Observaciones', 'Observaciones', '']
        ]
    }
];

function renderEquipo(equipo) {
    if (!elFichaEquipo) return;
    if (!equipo) {
        elFichaEquipo.innerHTML = '<p class="det-hint">No se pudo leer la cabecera del activo.</p>';
        return;
    }

    const grupos = GRUPOS_EQUIPO.map(grupo => {
        const filas = grupo.campos.map(([clave, etiqueta, clase]) => {
            const valor = texto(equipo[clave]);
            return `
                    <div class="ficha-fila${grupo.ancho ? ' ancho' : ''}">
                        <dt>${escaparHTML(etiqueta)}</dt>
                        <dd${clase ? ` class="${clase}"` : ''}>${valor ? escaparHTML(valor) : '<span class="sin-dato">—</span>'}</dd>
                    </div>`;
        }).join('');

        return `
            <section class="ficha-grupo">
                <header class="ficha-grupo-head">
                    <span class="ficha-grupo-icono">${svgFicha(grupo.icono)}</span>
                    <h3>${escaparHTML(grupo.titulo)}</h3>
                    <span class="ficha-grupo-linea"></span>
                </header>
                <dl class="ficha-filas">${filas}
                </dl>
            </section>`;
    }).join('');

    elFichaEquipo.innerHTML = `<div class="ficha-hoja">${grupos}
        </div>`;
}

function renderRed(filas, disponible) {
    if (!elTbodyRed) return;
    if (!disponible) {
        elTbodyRed.innerHTML = '<tr><td colspan="11"><span class="sin-dato">La tabla de red del colector aún no existe.</span></td></tr>';
        return;
    }
    if (!filas.length) {
        elTbodyRed.innerHTML = '<tr><td colspan="11"><span class="sin-dato">Sin adaptadores registrados.</span></td></tr>';
        return;
    }
    elTbodyRed.innerHTML = filas.map(r => {
        const adaptador = texto(r.NombreAdaptador) || texto(r.DescripcionAdaptador) || texto(r.Clave);
        return `
            <tr>
                ${celda(adaptador)}
                ${celda(r.MAC, 'mono')}
                ${celda(r.IP, 'mono')}
                ${celda(r.Mascara, 'mono')}
                ${celda(r.PuertaEnlace, 'mono')}
                ${celda(r.DNS1, 'mono')}
                ${celda(r.DNS2, 'mono')}
                <td>${r.DHCP ? '<span class="tag tag-ok">Sí</span>' : '<span class="tag">No</span>'}</td>
                <td>${texto(r.Dominio) ? `<span class="tag tag-dominio">${escaparHTML(r.Dominio)}</span>` : '<span class="sin-dato">—</span>'}</td>
                <td>${r.EsPrincipal ? '<span class="tag tag-ok">Principal</span>' : '<span class="sin-dato">—</span>'}</td>
                <td>${r.Vigente ? '<span class="tag">Vigente</span>' : '<span class="tag tag-off">Histórico</span>'}</td>
            </tr>`;
    }).join('');
}

function renderCuentas(filas, disponible) {
    if (!elTbodyCuentas) return;
    if (!disponible) {
        elTbodyCuentas.innerHTML = '<tr><td colspan="8"><span class="sin-dato">La tabla de cuentas del colector aún no existe.</span></td></tr>';
        return;
    }
    if (!filas.length) {
        elTbodyCuentas.innerHTML = '<tr><td colspan="8"><span class="sin-dato">Sin cuentas registradas.</span></td></tr>';
        return;
    }
    elTbodyCuentas.innerHTML = filas.map(c => {
        const esDominio = String(c.TipoCuenta || '').toUpperCase() === 'DOMINIO';
        return `
            <tr>
                ${celda(c.Cuenta, 'mono')}
                <td>${esDominio ? '<span class="tag tag-dominio">Dominio</span>' : '<span class="tag">Local</span>'}</td>
                ${celda(c.NombreCompleto)}
                <td>${c.Habilitada ? '<span class="tag tag-ok">Sí</span>' : '<span class="tag tag-off">No</span>'}</td>
                ${celda(formatearFechaHora(c.UltimoAcceso))}
                ${celda(c.SID, 'mono')}
                <td>${c.EsCuentaSesion ? '<span class="tag tag-ok">En sesión</span>' : '<span class="sin-dato">—</span>'}</td>
                <td>${c.Vigente ? '<span class="tag">Vigente</span>' : '<span class="tag tag-off">Histórico</span>'}</td>
            </tr>`;
    }).join('');
}

function renderProgramas(filas, disponible) {
    if (!elTbodyProgramas) return;
    if (!disponible) {
        elTbodyProgramas.innerHTML = '<tr><td colspan="7"><span class="sin-dato">La tabla de programas del colector aún no existe.</span></td></tr>';
        return;
    }
    if (!filas.length) {
        elTbodyProgramas.innerHTML = '<tr><td colspan="7"><span class="sin-dato">Sin programas registrados.</span></td></tr>';
        return;
    }
    /* Los 200+ programas del activo ya vienen sólo de ese activo; se
       muestran completos para comparar versiones de un vistazo. */
    elTbodyProgramas.innerHTML = filas.map(p => {
        const alcance = String(p.Alcance || '').toUpperCase();
        return `
            <tr>
                ${celda(p.Programa)}
                ${celda(p.Version, 'mono')}
                ${celda(p.Fabricante)}
                ${celda(formatearFecha(p.FechaInstalacion))}
                <td>${alcance === 'USUARIO' ? '<span class="tag">Usuario</span>' : '<span class="tag tag-ok">Equipo</span>'}</td>
                ${celda(p.Cuenta, 'mono')}
                <td>${p.Vigente ? '<span class="tag">Vigente</span>' : '<span class="tag tag-off">Histórico</span>'}</td>
            </tr>`;
    }).join('');
}

/* Piezas que cuelgan del equipo (monitor externo, disco, teclado, ratón).
   El activo es el CPU: esto es su contenido, no activos sueltos.
   El par [singular, plural] se usa tanto en la etiqueta de la tabla como en
   los textos ("3 piezas: 1 monitor, 2 discos duros"), con la MISMA redacción
   que el inventario (activos-renderer) para que ambas pantallas no discrepen. */
const NOMBRE_PIEZA = {
    MONITOR: ['monitor',    'monitores'],
    DISCO:   ['disco duro', 'discos duros'],
    TECLADO: ['teclado',    'teclados'],
    RATON:   ['ratón',      'ratones'],
    DIADEMA: ['diadema',    'diademas'],
    OTRO:    ['otro',       'otros']
};

/** Nombre de la pieza concordando con el número: "1 monitor", "3 monitores". */
function nombrePieza(tipo, n) {
    const clave = String(tipo || '').toUpperCase();
    const par = NOMBRE_PIEZA[clave];
    if (!par) return clave || '—';
    return par[Number(n) === 1 ? 0 : 1];
}

/** "3 piezas" / "1 pieza": el total de unidades, no de renglones. */
function textoPiezas(n) {
    const total = Number(n) || 0;
    return `${total} ${total === 1 ? 'pieza' : 'piezas'}`;
}

/** Suma Cantidad (una fila puede traer 2 discos) para no contar filas. */
function totalPiezas(filas) {
    return (Array.isArray(filas) ? filas : [])
        .reduce((suma, c) => suma + (Number(c && c.Cantidad) || 1), 0);
}

/** Desglose por tipo en orden fijo: "1 monitor, 2 discos duros". */
function desglosePiezas(filas) {
    const cuenta = new Map();
    (Array.isArray(filas) ? filas : []).forEach(c => {
        const tipo = String(c && c.TipoComponente || 'OTRO').toUpperCase();
        cuenta.set(tipo, (cuenta.get(tipo) || 0) + (Number(c && c.Cantidad) || 1));
    });
    const orden = ['MONITOR', 'DISCO', 'TECLADO', 'RATON', 'DIADEMA'];
    const partes = [];
    orden.forEach(tipo => {
        const n = cuenta.get(tipo) || 0;
        if (n) { partes.push(`${n} ${nombrePieza(tipo, n)}`); cuenta.delete(tipo); }
    });
    for (const [tipo, n] of cuenta) partes.push(`${n} ${nombrePieza(tipo, n)}`);
    return partes.join(', ');
}

function etiquetaComponente(tipo) {
    const nombre = nombrePieza(tipo, 1);
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/** Marca de confianza del identificador de la pieza (serie > modelo > VID/PID). */
function claseConfianzaComponente(confianza) {
    return confianza === 'alta' ? 'alta' : confianza === 'media' ? 'media' : 'baja';
}

/* Conexión de la pieza: el colector manda ConectadoA ('Bluetooth',
   'USB-Dongle', 'Jack 3.5'…) y EstadoConexion ('Emparejada'…).
   Sólo las diademas suelen traerlo; el resto queda vacío. */
function conexionComponente(c) {
    const partes = [texto(c.ConectadoA), texto(c.EstadoConexion)].filter(Boolean);
    return partes.join(' · ');
}

function bateriaComponente(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return String(valor);
    return `${Math.max(0, Math.min(100, Math.round(numero)))}%`;
}

function renderComponentes(filas, disponible) {
    if (!elTbodyComponentes) return;
    if (!disponible) {
        elTbodyComponentes.innerHTML = '<tr><td colspan="13"><span class="sin-dato">La tabla de piezas conectadas aún no existe.</span></td></tr>';
        return;
    }
    if (!Array.isArray(filas) || !filas.length) {
        elTbodyComponentes.innerHTML = '<tr><td colspan="13"><span class="sin-dato">Sin piezas conectadas registradas.</span></td></tr>';
        return;
    }
    elTbodyComponentes.innerHTML = filas.map(c => `
            <tr>
                <td><span class="tag">${escaparHTML(etiquetaComponente(c.TipoComponente))}</span></td>
                ${celda(c.Marca)}
                ${celda(c.Modelo)}
                ${celda(c.Serie, 'mono')}
                ${celda(c.Identificador, 'mono')}
                ${celda(c.IdentificadorTipo)}
                ${celda(conexionComponente(c))}
                ${celda(c.MAC, 'mono')}
                ${celda(bateriaComponente(c.Bateria), 'mono')}
                <td><span class="conf ${claseConfianzaComponente(c.Confianza)}">${escaparHTML(texto(c.Confianza) || 'baja')}</span></td>
                ${celdaNumero(c.Cantidad || 1)}
                ${celda(formatearFechaHora(c.UltimaDeteccion))}
                <td>${c.Vigente ? '<span class="tag">Vigente</span>' : '<span class="tag tag-off">Histórico</span>'}</td>
            </tr>`).join('');
}

/** Lotes de envío del activo: sirve para comparar un envío con el anterior.
    Se pintan en el pie de la ficha, no dentro de una pestaña. */
function renderLotes(lotes) {
    if (!elFichaLotes) return;
    if (!Array.isArray(lotes) || lotes.length === 0) {
        elFichaLotes.innerHTML = '';
        mostrar(elFichaPie, false);
        return;
    }
    mostrar(elFichaPie, true);
    const items = lotes.map(l => {
        const partes = [];
        if (Number(l.Red))       partes.push(`${Number(l.Red)} red`);
        if (Number(l.Cuentas))   partes.push(`${Number(l.Cuentas)} cuentas`);
        if (Number(l.Programas)) partes.push(`${Number(l.Programas)} programas`);
        if (Number(l.Componentes)) partes.push(textoPiezas(l.Componentes));
        return `
            <span class="report-item">
                <strong>${escaparHTML(String(l.LoteEnvio || '—').slice(0, 8))}</strong>
                ${escaparHTML(partes.join(' · ') || 'sin filas')}
                <span class="report-count">${escaparHTML(formatearFechaHora(l.UltimaDeteccion))}</span>
            </span>`;
    }).join('');

    elFichaLotes.innerHTML = items || '<span class="sin-dato">Sin lotes de envío registrados.</span>';
}

function cambiarTabFicha(tab) {
    if (elFichaTabs) {
        elFichaTabs.querySelectorAll('.det-tab').forEach(b => b.classList.toggle('activo', b.dataset.tab === tab));
    }
    mostrar(elFichaEquipo, tab === 'equipo');
    mostrar(elFichaRed, tab === 'red');
    mostrar(elFichaCuentas, tab === 'cuentas');
    mostrar(elFichaProgramas, tab === 'programas');
    mostrar(elFichaComponentes, tab === 'componentes');
}

function cerrarFicha() {
    mostrar(elModal, false);
    estado.ficha = null;
}

async function abrirFicha(idActivo) {
    const id = Number(idActivo) || 0;
    if (!id) return;

    mostrar(elModal, true);
    cambiarTabFicha('equipo');
    if (elFichaTitulo) elFichaTitulo.textContent = 'Ficha del activo';
    if (elFichaSub) elFichaSub.textContent = `Id ${id} · cargando…`;
    renderEquipo(null);
    renderRed([], true);
    renderCuentas([], true);
    renderProgramas([], true);
    renderComponentes([], true);
    renderLotes([]);
    /* Mientras carga, las insignias no deben mostrar los números del activo anterior. */
    if (elPillRed)         elPillRed.textContent = '0';
    if (elPillCuentas)     elPillCuentas.textContent = '0';
    if (elPillProgramas)   elPillProgramas.textContent = '0';
    if (elPillComponentes) elPillComponentes.textContent = '0';

    try {
        const res = await window.api.activoFijo.detalle.ficha(id);
        if (!res || res.ok === false) {
            avisarError(res, 'No se pudo abrir la ficha');
            if (elFichaSub) elFichaSub.textContent = (res && res.mensaje) || 'Error al cargar';
            return;
        }

        estado.ficha = res;
        const equipo    = res.equipo || {};
        const red       = Array.isArray(res.red) ? res.red : [];
        const cuentas   = Array.isArray(res.cuentas) ? res.cuentas : [];
        const programas = Array.isArray(res.programas) ? res.programas : [];
        const componentes = Array.isArray(res.componentes) ? res.componentes : [];
        const fuentes   = res.fuentes || {};

        if (elFichaTitulo) elFichaTitulo.textContent = texto(equipo.NoSerie) || `Activo ${id}`;
        if (elFichaSub) {
            const partes = [texto(equipo.Marca), texto(equipo.Modelo), texto(equipo.Tipo)].filter(Boolean);
            elFichaSub.textContent = partes.length ? partes.join(' · ') : `Id ${id}`;
        }

        renderEquipo(equipo);
        renderRed(red, fuentes.red !== false);
        renderCuentas(cuentas, fuentes.cuentas !== false);
        renderProgramas(programas, fuentes.programas !== false);
        renderComponentes(componentes, fuentes.componentes !== false);
        renderLotes(res.lotes);

        if (elPillRed)       elPillRed.textContent = String(red.length);
        if (elPillCuentas)   elPillCuentas.textContent = String(cuentas.length);
        if (elPillProgramas) elPillProgramas.textContent = String(programas.length);
        /* La insignia cuenta UNIDADES físicas: una fila puede ser "2 discos". */
        const piezasTotal = totalPiezas(componentes);
        const desglose = desglosePiezas(componentes);
        if (elPillComponentes) elPillComponentes.textContent = String(piezasTotal);

        setStatus(
            `Ficha de ${texto(equipo.NoSerie) || `activo ${id}`}`,
            `${red.length} red · ${cuentas.length} cuentas · ${programas.length} programas · ` +
                `${textoPiezas(piezasTotal)}${desglose ? ` (${desglose})` : ''}`
        );
    } catch (err) {
        console.error('[Detalle AF] abrirFicha:', err);
        toastError('No se pudo abrir la ficha', err.message || '');
        if (elFichaSub) elFichaSub.textContent = 'Error al cargar';
    }
}
/* =========================================================
   BUSCADORES CRUZADOS
   ---------------------------------------------------------
   programa -> equipos/versión | cuenta -> equipos | host -> MAC/IP
   ========================================================= */
const pagPrograma = crearPaginador('paginacion-programa', {
    tamanos: [25, 50, 100], tamano: 25,
    alCambiar: (pagina, tamano) => {
        estado.programa.pagina = pagina;
        estado.programa.tamano = tamano;
        buscarPrograma();
    }
});

const pagCuenta = crearPaginador('paginacion-cuenta', {
    tamanos: [25, 50, 100], tamano: 25,
    alCambiar: (pagina, tamano) => {
        estado.cuenta.pagina = pagina;
        estado.cuenta.tamano = tamano;
        buscarCuenta();
    }
});

const pagHost = crearPaginador('paginacion-host', {
    tamanos: [25, 50, 100], tamano: 25,
    alCambiar: (pagina, tamano) => {
        estado.host.pagina = pagina;
        estado.host.tamano = tamano;
        buscarHost();
    }
});

const pagComponente = crearPaginador('paginacion-componente', {
    tamanos: [25, 50, 100], tamano: 25,
    alCambiar: (pagina, tamano) => {
        estado.componente.pagina = pagina;
        estado.componente.tamano = tamano;
        buscarComponente();
    }
});

function resumenResultado(total, vacio) {
    if (!elPillBusqueda) return;
    elPillBusqueda.textContent = total
        ? (total === 1 ? '1 resultado' : `${total} resultados`)
        : (vacio || 'Sin resultados');
}

/** Resumen de versiones del programa: dice de un golpe cuántos equipos
    están en cada versión. */
function renderVersiones(resumen) {
    if (!elPrgResumen) return;
    if (!Array.isArray(resumen) || resumen.length === 0) {
        elPrgResumen.innerHTML = '';
        mostrar(elPrgResumen, false);
        return;
    }
    elPrgResumen.innerHTML = resumen.map(r => `
        <span class="report-item destacado">
            <strong>${escaparHTML(texto(r.Version) || '(sin versión)')}</strong>
            <span class="report-count">${Number(r.Equipos) || 0}</span> equipos
        </span>`).join('');
    mostrar(elPrgResumen, true);
}

async function buscarPrograma() {
    const p = estado.programa;
    const nombre = texto(elPrgTexto && elPrgTexto.value);
    if (!nombre) {
        toastError('Escribe el nombre del programa', 'La búsqueda necesita al menos una palabra.');
        if (elPrgTexto) elPrgTexto.focus();
        return;
    }
    p.texto = nombre;
    p.version = texto(elPrgVersion && elPrgVersion.value);

    if (elBtnPrg) elBtnPrg.disabled = true;
    setStatus(`Buscando "${p.texto}"…`);
    try {
        const res = await window.api.activoFijo.detalle.buscarPrograma({
            programa: p.texto,
            version: p.version,
            pagina: p.pagina,
            tamano: p.tamano
        });

        if (!res || res.ok === false) {
            avisarError(res, 'No se pudo buscar el programa');
            mostrar(elCardPrograma, false);
            return;
        }
        if (res.fuenteDisponible === false) {
            mostrar(elAviso, true);
            mostrar(elCardPrograma, false);
            pagPrograma.mostrar(false);
            resumenResultado(0, 'Sin la tabla de programas');
            setStatus(res.mensaje || 'Falta la tabla de programas.');
            return;
        }

        p.total  = Number(res.total) || 0;
        p.pagina = Number(res.pagina) || 1;

        const filas = Array.isArray(res.filas) ? res.filas : [];
        if (elTbodyPrograma) {
            elTbodyPrograma.innerHTML = filas.length
                ? filas.map(f => `
                    <tr>
                        ${celda(f.Programa)}
                        ${celda(f.Version, 'mono')}
                        <td>${String(f.Alcance || '').toUpperCase() === 'USUARIO' ? '<span class="tag">Usuario</span>' : '<span class="tag tag-ok">Equipo</span>'}</td>
                        ${celda(f.NoSerie, 'mono')}
                        ${celda(f.Hostname)}
                        ${celda(formatearFechaHora(f.UltimaDeteccion))}
                    </tr>`).join('')
                : '<tr><td colspan="6"><span class="sin-dato">Ningún equipo tiene ese programa con ese filtro.</span></td></tr>';
        }

        mostrar(elCardPrograma, true);
        pagPrograma.pintar(p.total, p.pagina);
        pagPrograma.mostrar(p.total > 0);
        renderVersiones(res.resumenVersiones);
        resumenResultado(p.total);
        setStatus(
            `${p.total} instalaciones de "${p.texto}"${p.version ? ` (versión ${p.version})` : ''}`,
            'Sólo lo vigente (Vigente = 1)'
        );
    } catch (err) {
        console.error('[Detalle AF] buscarPrograma:', err);
        toastError('No se pudo buscar el programa', err.message || '');
    } finally {
        if (elBtnPrg) elBtnPrg.disabled = false;
    }
}

async function buscarCuenta() {
    const c = estado.cuenta;
    const busqueda = texto(elCtaTexto && elCtaTexto.value);
    if (!busqueda) {
        toastError('Escribe una cuenta o un nombre', 'La búsqueda necesita al menos una palabra.');
        if (elCtaTexto) elCtaTexto.focus();
        return;
    }
    c.texto = busqueda;
    c.tipo  = texto(elCtaTipo && elCtaTipo.value);

    if (elBtnCta) elBtnCta.disabled = true;
    setStatus(`Buscando la cuenta "${c.texto}"…`);
    try {
        const res = await window.api.activoFijo.detalle.buscarCuenta({
            cuenta: c.texto,
            tipo: c.tipo,
            pagina: c.pagina,
            tamano: c.tamano
        });

        if (!res || res.ok === false) {
            avisarError(res, 'No se pudo buscar la cuenta');
            mostrar(elCardCuenta, false);
            return;
        }
        if (res.fuenteDisponible === false) {
            mostrar(elAviso, true);
            mostrar(elCardCuenta, false);
            pagCuenta.mostrar(false);
            resumenResultado(0, 'Sin la tabla de cuentas');
            setStatus(res.mensaje || 'Falta la tabla de cuentas.');
            return;
        }

        c.total  = Number(res.total) || 0;
        c.pagina = Number(res.pagina) || 1;

        const filas = Array.isArray(res.filas) ? res.filas : [];
        if (elTbodyCuenta) {
            elTbodyCuenta.innerHTML = filas.length
                ? filas.map(f => `
                    <tr>
                        ${celda(f.Cuenta, 'mono')}
                        <td>${String(f.TipoCuenta || '').toUpperCase() === 'DOMINIO' ? '<span class="tag tag-dominio">Dominio</span>' : '<span class="tag">Local</span>'}</td>
                        ${celda(f.NombreCompleto)}
                        <td>${f.Habilitada ? '<span class="tag tag-ok">Sí</span>' : '<span class="tag tag-off">No</span>'}</td>
                        ${celda(formatearFechaHora(f.UltimoAcceso))}
                        ${celda(f.NoSerie, 'mono')}
                        ${celda(f.Hostname)}
                    </tr>`).join('')
                : '<tr><td colspan="7"><span class="sin-dato">Ninguna cuenta coincide con la búsqueda.</span></td></tr>';
        }

        mostrar(elCardCuenta, true);
        pagCuenta.pintar(c.total, c.pagina);
        pagCuenta.mostrar(c.total > 0);
        resumenResultado(c.total);
        setStatus(
            `${c.total} cuentas para "${c.texto}"`,
            c.tipo ? `Tipo ${c.tipo}` : 'Locales y de dominio'
        );
    } catch (err) {
        console.error('[Detalle AF] buscarCuenta:', err);
        toastError('No se pudo buscar la cuenta', err.message || '');
    } finally {
        if (elBtnCta) elBtnCta.disabled = false;
    }
}

async function buscarHost() {
    const h = estado.host;
    const busqueda = texto(elHostTexto && elHostTexto.value);
    if (!busqueda) {
        toastError('Escribe un hostname, MAC o IP', 'La búsqueda necesita al menos un dato de red.');
        if (elHostTexto) elHostTexto.focus();
        return;
    }
    h.texto = busqueda;

    if (elBtnHost) elBtnHost.disabled = true;
    setStatus(`Buscando "${h.texto}" en la red…`);
    try {
        const res = await window.api.activoFijo.detalle.buscarHost({
            hostname: h.texto,
            pagina: h.pagina,
            tamano: h.tamano
        });

        if (!res || res.ok === false) {
            avisarError(res, 'No se pudo buscar la red');
            mostrar(elCardHost, false);
            return;
        }
        if (res.fuenteDisponible === false) {
            mostrar(elAviso, true);
            mostrar(elCardHost, false);
            pagHost.mostrar(false);
            resumenResultado(0, 'Sin la tabla de red');
            setStatus(res.mensaje || 'Falta la tabla de red.');
            return;
        }

        h.total  = Number(res.total) || 0;
        h.pagina = Number(res.pagina) || 1;

        const filas = Array.isArray(res.filas) ? res.filas : [];
        if (elTbodyHost) {
            elTbodyHost.innerHTML = filas.length
                ? filas.map(f => {
                    const dns = [texto(f.DNS1), texto(f.DNS2)].filter(Boolean).join(' / ');
                    return `
                        <tr>
                            ${celda(f.Hostname)}
                            ${celda(f.IP, 'mono')}
                            ${celda(f.MAC, 'mono')}
                            ${celda(f.Mascara, 'mono')}
                            ${celda(f.PuertaEnlace, 'mono')}
                            ${celda(dns, 'mono')}
                            <td>${f.DHCP ? '<span class="tag tag-ok">Sí</span>' : '<span class="tag">No</span>'}</td>
                            ${celda(f.NoSerie, 'mono')}
                        </tr>`;
                }).join('')
                : '<tr><td colspan="8"><span class="sin-dato">Sin coincidencias de red.</span></td></tr>';
        }

        mostrar(elCardHost, true);
        pagHost.pintar(h.total, h.pagina);
        pagHost.mostrar(h.total > 0);
        resumenResultado(h.total);
        setStatus(
            `${h.total} adaptadores para "${h.texto}"`,
            'Sólo lo vigente (Vigente = 1)'
        );
    } catch (err) {
        console.error('[Detalle AF] buscarHost:', err);
        toastError('No se pudo buscar la red', err.message || '');
    } finally {
        if (elBtnHost) elBtnHost.disabled = false;
    }
}

/** Resumen por tipo de pieza: "512 discos en 470 equipos". */
function renderTiposComponente(resumen) {
    if (!elCompResumen) return;
    if (!Array.isArray(resumen) || resumen.length === 0) {
        elCompResumen.innerHTML = '';
        mostrar(elCompResumen, false);
        return;
    }
    elCompResumen.innerHTML = resumen.map(r => {
        const piezas = Number(r.Piezas) || 0;
        const equipos = Number(r.Equipos) || 0;
        return `
        <span class="report-item destacado">
            <strong>${escaparHTML(etiquetaComponente(r.TipoComponente))}</strong>
            <span class="report-count">${piezas}</span> ${nombrePieza(r.TipoComponente, piezas)} ·
            ${equipos} ${equipos === 1 ? 'equipo' : 'equipos'}
        </span>`;
    }).join('');
    mostrar(elCompResumen, true);
}

/* La pieza NO es un activo: cada renglón contesta con su equipo padre, para
   poder abrir la ficha del CPU y ver lo que tiene conectado. */
async function buscarComponente() {
    const k = estado.componente;
    const busqueda = texto(elCompTexto && elCompTexto.value);
    if (!busqueda) {
        toastError('Escribe una serie, modelo o identificador de la pieza', 'La búsqueda necesita al menos una palabra.');
        if (elCompTexto) elCompTexto.focus();
        return;
    }
    k.texto = busqueda;
    k.tipo  = texto(elCompTipo && elCompTipo.value);

    if (elBtnComp) elBtnComp.disabled = true;
    setStatus(`Buscando la pieza "${k.texto}"…`);
    try {
        const res = await window.api.activoFijo.detalle.buscarComponente({
            componente: k.texto,
            tipo: k.tipo,
            pagina: k.pagina,
            tamano: k.tamano
        });

        if (!res || res.ok === false) {
            avisarError(res, 'No se pudo buscar la pieza');
            mostrar(elCardComponente, false);
            return;
        }
        if (res.fuenteDisponible === false) {
            mostrar(elAviso, true);
            mostrar(elCardComponente, false);
            pagComponente.mostrar(false);
            renderTiposComponente([]);
            resumenResultado(0, 'Sin la tabla de piezas');
            setStatus(res.mensaje || 'Falta la tabla de piezas conectadas.');
            return;
        }

        k.total  = Number(res.total) || 0;
        k.pagina = Number(res.pagina) || 1;

        const filas = Array.isArray(res.filas) ? res.filas : [];
        if (elTbodyComponente) {
            elTbodyComponente.innerHTML = filas.length
                ? filas.map(f => {
                    const idActivo = Number(f.IdActivoFijoEQ) || 0;
                    return `
                    <tr>
                        <td><span class="tag">${escaparHTML(etiquetaComponente(f.TipoComponente))}</span></td>
                        ${celda([texto(f.Marca), texto(f.Modelo)].filter(Boolean).join(' '))}
                        ${celda(f.Serie, 'mono')}
                        ${celda(f.Identificador, 'mono')}
                        ${celdaNumero(f.Cantidad || 1)}
                        ${celda(f.NoSerie, 'mono')}
                        ${celda(f.Hostname)}
                        ${celda(formatearFechaHora(f.UltimaDeteccion))}
                        <td class="acciones-col">${idActivo
                            ? `<button type="button" class="btn-mini" data-ficha="${idActivo}" title="Ver el equipo al que pertenece esta pieza">Equipo</button>`
                            : '<span class="sin-dato">—</span>'}</td>
                    </tr>`;
                }).join('')
                : '<tr><td colspan="9"><span class="sin-dato">Ningún equipo tiene una pieza con ese dato.</span></td></tr>';
        }

        mostrar(elCardComponente, true);
        pagComponente.pintar(k.total, k.pagina);
        pagComponente.mostrar(k.total > 0);
        renderTiposComponente(res.resumenTipos);
        resumenResultado(k.total);
        setStatus(
            `${textoPiezas(k.total)} para "${k.texto}"`,
            'Sólo lo vigente (Vigente = 1)'
        );
    } catch (err) {
        console.error('[Detalle AF] buscarComponente:', err);
        toastError('No se pudo buscar la pieza', err.message || '');
    } finally {
        if (elBtnComp) elBtnComp.disabled = false;
    }
}
/* =========================================================
   SECCIONES Y NAVEGACIÓN
   ========================================================= */
function irASeccion(nombre) {
    estado.seccion = nombre;
    if (elTabs) {
        elTabs.querySelectorAll('.det-tab').forEach(b => b.classList.toggle('activo', b.dataset.seccion === nombre));
    }
    Object.entries(paneles).forEach(([clave, panel]) => mostrar(panel, clave === nombre));

    if (nombre === 'maestro') cargarMaestro();
    if (nombre === 'buscadores') setStatus('Buscadores cruzados', 'Sólo lo vigente (Vigente = 1)');
}

/* =========================================================
   EVENTOS
   ========================================================= */
function enlazarNavegacion() {
    /* La navegación entre módulos vive en el sidebar de permisos-ui.js. */
    if (elBtnVolver) elBtnVolver.addEventListener('click', () => window.api.volverMenu());

    document.addEventListener('keydown', ev => {
        if (ev.key !== 'Escape') return;
        if (elModal && !elModal.classList.contains(OCULTO)) cerrarFicha();
    });

    if (elBtnRecargar) {
        elBtnRecargar.addEventListener('click', async () => {
            await revisarFuentes();
            await cargarDominios();
            await cargarMaestro();
            if (estado.ficha && estado.ficha.equipo) abrirFicha(estado.ficha.equipo.IdActivoFijoEQ);
        });
    }
}

function enlazarSecciones() {
    if (elTabs) {
        elTabs.addEventListener('click', ev => {
            const boton = ev.target.closest('[data-seccion]');
            if (boton) irASeccion(boton.dataset.seccion);
        });
    }
}

function enlazarMaestro() {
    if (!elBusquedaMaestro) return;

    const buscar = debounce(() => {
        estado.maestro.busqueda = texto(elBusquedaMaestro.value);
        estado.maestro.pagina = 1;
        pagMaestro.reiniciar();
        cargarMaestro();
    }, 350);

    elBusquedaMaestro.addEventListener('input', buscar);
    elBusquedaMaestro.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            estado.maestro.busqueda = texto(elBusquedaMaestro.value);
            estado.maestro.pagina = 1;
            pagMaestro.reiniciar();
            cargarMaestro();
        }
    });

    if (elFiltroDominio) {
        elFiltroDominio.addEventListener('change', () => {
            estado.maestro.dominio = elFiltroDominio.value || '';
            estado.maestro.pagina = 1;
            pagMaestro.reiniciar();
            cargarMaestro();
        });
    }

    if (elFiltroVista) {
        elFiltroVista.addEventListener('change', () => {
            estado.maestro.filtro = elFiltroVista.value || '';
            estado.maestro.pagina = 1;
            pagMaestro.reiniciar();
            cargarMaestro();
        });
    }

    if (elBtnLimpiar) {
        elBtnLimpiar.addEventListener('click', () => {
            estado.maestro.busqueda = '';
            estado.maestro.dominio = '';
            estado.maestro.filtro = '';
            estado.maestro.pagina = 1;
            if (elBusquedaMaestro) elBusquedaMaestro.value = '';
            if (elFiltroDominio) elFiltroDominio.value = '';
            if (elFiltroVista) elFiltroVista.value = '';
            pagMaestro.reiniciar();
            cargarMaestro();
        });
    }

    if (elTbodyMaestro) {
        elTbodyMaestro.addEventListener('click', ev => {
            const boton = ev.target.closest('[data-ficha]');
            if (boton) abrirFicha(boton.dataset.ficha);
        });
    }
}

function enlazarFicha() {
    if (elBtnCerrarFicha) elBtnCerrarFicha.addEventListener('click', cerrarFicha);
    if (elModal) {
        elModal.addEventListener('click', ev => {
            if (ev.target === elModal) cerrarFicha();
        });
    }
    if (elFichaTabs) {
        elFichaTabs.addEventListener('click', ev => {
            const boton = ev.target.closest('[data-tab]');
            if (boton) cambiarTabFicha(boton.dataset.tab);
        });
    }
}

function enlazarBuscadores() {
    if (elBtnPrg) elBtnPrg.addEventListener('click', () => {
        estado.programa.pagina = 1;
        pagPrograma.reiniciar();
        buscarPrograma();
    });
    [elPrgTexto, elPrgVersion].forEach(el => {
        if (el) el.addEventListener('keydown', ev => {
            if (ev.key !== 'Enter') return;
            ev.preventDefault();
            estado.programa.pagina = 1;
            pagPrograma.reiniciar();
            buscarPrograma();
        });
    });

    if (elBtnCta) elBtnCta.addEventListener('click', () => {
        estado.cuenta.pagina = 1;
        pagCuenta.reiniciar();
        buscarCuenta();
    });
    [elCtaTexto, elCtaTipo].forEach(el => {
        if (el) el.addEventListener('keydown', ev => {
            if (ev.key !== 'Enter') return;
            ev.preventDefault();
            estado.cuenta.pagina = 1;
            pagCuenta.reiniciar();
            buscarCuenta();
        });
    });

    if (elBtnHost) elBtnHost.addEventListener('click', () => {
        estado.host.pagina = 1;
        pagHost.reiniciar();
        buscarHost();
    });
    if (elHostTexto) {
        elHostTexto.addEventListener('keydown', ev => {
            if (ev.key !== 'Enter') return;
            ev.preventDefault();
            estado.host.pagina = 1;
            pagHost.reiniciar();
            buscarHost();
        });
    }

    if (elBtnComp) elBtnComp.addEventListener('click', () => {
        estado.componente.pagina = 1;
        pagComponente.reiniciar();
        buscarComponente();
    });
    [elCompTexto, elCompTipo].forEach(el => {
        if (!el) return;
        const disparar = ev => {
            if (ev.type === 'keydown' && ev.key !== 'Enter') return;
            ev.preventDefault();
            estado.componente.pagina = 1;
            pagComponente.reiniciar();
            buscarComponente();
        };
        el.addEventListener('keydown', disparar);
        if (el.tagName === 'SELECT') el.addEventListener('change', disparar);
    });

    /* El botón "Equipo" de una pieza abre la ficha de su CPU: así se ve de un
       golpe todo lo que cuelga de ese equipo. */
    if (elTbodyComponente) {
        elTbodyComponente.addEventListener('click', ev => {
            const boton = ev.target.closest('[data-ficha]');
            if (boton) abrirFicha(boton.dataset.ficha);
        });
    }
}

/* =========================================================
   ARRANQUE
   ========================================================= */
(async function iniciar() {
    if (!window.api || !window.api.activoFijo || !window.api.activoFijo.detalle) {
        setStatus('Esta página sólo funciona dentro de la aplicación.');
        if (elAvisoTexto) elAvisoTexto.textContent = 'No se encontró la API de la aplicación (preload).';
        mostrar(elAviso, true);
        return;
    }

    enlazarNavegacion();
    enlazarSecciones();
    enlazarMaestro();
    enlazarFicha();
    enlazarBuscadores();

    setStatus('Cargando el maestro de activos…', 'Sólo lo vigente (Vigente = 1)');

    await revisarFuentes();
    await cargarDominios();
    await cargarMaestro();
})();

})();



