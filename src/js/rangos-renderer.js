/* =========================================================
   RANGOS IP — Renderer de la página propia (rangos.html)
   ---------------------------------------------------------
   Antes vivía como modal dentro de Equipos y como pestaña de
   "ajuste automático" dentro de Catálogos (duplicidad). Ahora
   es una sola ventana, con tres bloques:

     1. Ajuste automático  → propone crear/ampliar rangos.
     2. Auditoría          → sólo reporta lo que está mal.
     3. Alta / edición     → en modal (.modal-* de equipos.css).

   Reglas que respeta el motor (src/js/db/rangos.js):
     · Un rango sin perfil se hereda a todos los perfiles.
     · No se elimina ni se toca un rango en conflicto.
     · Los rangos se proponen en consecutivo (un tramo continuo),
       nunca fragmentados por huecos ni por IP del Control General.
   ========================================================= */

const Swal = window.Swal;

/* =========================================================
   HELPERS (mismos nombres que equipos-renderer para que los
   colores de cliente/perfil se pinten igual en toda la app)
   ========================================================= */

function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
        customClass: { popup: 'cl-toast' }
    });
}

function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false, timer: 3400, timerProgressBar: true,
        customClass: { popup: 'cl-toast' }
    });
}

function confirmar(opciones) {
    return Swal.fire({
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        },
        ...opciones
    });
}

function renderBadgeCliente(codigo, nombre = null) {
    const nombreHTML = `<span class="nombre">${escaparHTML(nombre || codigo)}</span>`;
    const codigoHTML = nombre ? `<span class="codigo">${escaparHTML(codigo)}</span>` : '';
    return `<span class="badge-cliente" data-color="${escaparHTML(String(codigo).toUpperCase())}">
                ${nombreHTML}
                ${codigoHTML}
            </span>`;
}

function renderRolPill(codigo, nombre = '') {
    if (!codigo) return '<span class="rango-general">Todos los perfiles</span>';
    return `<span class="rol-pill" data-color="${escaparHTML(String(codigo).toUpperCase())}" title="${escaparHTML(nombre || codigo)}">${escaparHTML(nombre || codigo)}</span>`;
}

function iconoEditarSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>`;
}

function iconoEliminarSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>`;
}

function ipValorEntero(ip) {
    const partes = String(ip ?? '').trim().split('.');
    if (partes.length !== 4) return null;
    if (!partes.every(octeto => /^\d{1,3}$/.test(octeto) && Number(octeto) <= 255)) return null;
    const [a, b, c, d] = partes.map(Number);
    return ((a * 256 + b) * 256 + c) * 256 + d;
}

function hostEnSegmento(ip, segmento) {
    const partes = String(ip ?? '').trim().split('.');
    if (partes.length !== 4) return null;
    if (partes.slice(0, 3).map(Number).join('.') !== segmento) return null;
    const host = Number(partes[3]);
    return Number.isInteger(host) && host >= 1 && host <= 254 ? host : null;
}

function normalizarSegmento(valor) {
    const partes = String(valor ?? '').trim().replace(/\.$/, '').split('.');
    if (partes.length !== 3) return null;
    if (!partes.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return null;
    return partes.map(p => String(Number(p))).join('.');
}

function segmentoDeIP(ip) {
    const partes = String(ip ?? '').trim().split('.');
    return partes.length === 4 ? partes.slice(0, 3).join('.') : '';
}

/** Texto comparable: sin acentos, minúsculas y espacios colapsados. */
function normalizarTexto(valor) {
    return String(valor ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/* =========================================================
   ESTADO
   ========================================================= */

const HOST_INICIAL_RANGO = 2;   /* .0 = dirección de red */
const HOST_FINAL_RANGO = 254;   /* .255 = broadcast */

let clientes = [];
let perfiles = [];
let rangos = [];

let rangoEditando = null;
let guardandoRango = false;

let analisis = null;
let ocupado = false;

let sugerenciasRango = [];
let sugerenciasFragmentadas = [];
let sugiriendoRango = false;

/* =========================================================
   DOM
   ========================================================= */

const btnVolver = document.getElementById('btn-volver');

const buscador = document.getElementById('rango-buscar');
const btnLimpiarBusqueda = document.getElementById('btn-limpiar-busqueda');
const filtroCliente = document.getElementById('rangos-filtro-cliente');

const btnAnalizar = document.getElementById('btn-rangos-analizar');
const btnAplicar = document.getElementById('btn-rangos-aplicar');
const btnAuditar = document.getElementById('btn-rangos-auditar');
const btnNuevo = document.getElementById('btn-rango-nuevo');

const seccionAjuste = document.getElementById('seccion-ajuste');
const btnCerrarAjuste = document.getElementById('btn-cerrar-ajuste');
const rngMensaje = document.getElementById('rng-mensaje');
const rngResumen = document.getElementById('rng-resumen');
const rngPropuestas = document.getElementById('rng-propuestas');
const rngAvisos = document.getElementById('rng-avisos');
const rngVacio = document.getElementById('rng-vacio');

const seccionAuditoria = document.getElementById('seccion-auditoria');
const btnCerrarAuditoria = document.getElementById('btn-cerrar-auditoria');
const auditoriaContenido = document.getElementById('auditoria-contenido');

const modalRango = document.getElementById('modal-rango');
const editorTitulo = document.getElementById('rango-editor-titulo');
const btnCerrarEditor = document.getElementById('btn-cerrar-editor');
const rangoCliente = document.getElementById('rango-cliente');
const rangoPerfil = document.getElementById('rango-perfil');
const rangoSegmento = document.getElementById('rango-segmento');
const rangoInicio = document.getElementById('rango-inicio');
const rangoFin = document.getElementById('rango-fin');
const rangoDescripcion = document.getElementById('rango-descripcion');
const rangoMensaje = document.getElementById('rango-mensaje');
const btnGuardar = document.getElementById('rango-guardar');
const btnCancelar = document.getElementById('rango-cancelar');

const rangoCantidad = document.getElementById('rango-cantidad');
const rangoSugerencias = document.getElementById('rango-sugerencias');
const btnSugerir = document.getElementById('btn-sugerir-rango');

const listaRangos = document.getElementById('rangos-lista');
const conteoRangos = document.getElementById('rangos-conteo');

/* =========================================================
   SELECTS DE CATÁLOGOS
   ========================================================= */

function llenarSelectClientes(select, valorSeleccionado = '') {
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecciona --</option>';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.IdCliente);
        opt.textContent = c.Nombre ? `${c.Nombre} (${c.Codigo})` : c.Codigo;
        select.appendChild(opt);
    });
    if (valorSeleccionado) select.value = String(valorSeleccionado);
}

function llenarSelectPerfiles(select, valorSeleccionado = '') {
    if (!select) return;
    select.innerHTML = '<option value="">Todos los perfiles (heredado)</option>';
    perfiles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = String(r.IdRolEquipo);
        opt.textContent = r.Nombre ? `${r.Nombre} (${r.Codigo})` : r.Codigo;
        select.appendChild(opt);
    });
    select.value = valorSeleccionado ? String(valorSeleccionado) : '';
}

function llenarFiltroClientes() {
    if (!filtroCliente) return;
    const actual = filtroCliente.value;
    filtroCliente.innerHTML = '<option value="">Todos los clientes</option>';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.IdCliente);
        opt.textContent = c.Nombre ? `${c.Nombre} (${c.Codigo})` : c.Codigo;
        filtroCliente.appendChild(opt);
    });
    if (actual && Array.from(filtroCliente.options).some(o => o.value === actual)) {
        filtroCliente.value = actual;
    }
}

async function cargarCatalogos() {
    const [resClientes, resPerfiles] = await Promise.all([
        window.api.clientes.listar().catch(() => []),
        window.api.roles.listar().catch(() => [])
    ]);
    clientes = Array.isArray(resClientes) ? resClientes : [];
    perfiles = Array.isArray(resPerfiles) ? resPerfiles : [];

    llenarFiltroClientes();
    llenarSelectClientes(rangoCliente);
    llenarSelectPerfiles(rangoPerfil);
}

/* =========================================================
   LISTADO
   ========================================================= */

async function cargarRangos() {
    const idCliente = parseInt(filtroCliente?.value, 10) || null;
    try {
        const resultado = await window.api.rangos.listar(idCliente);
        if (!Array.isArray(resultado)) {
            throw new Error(resultado?.mensaje || 'No se pudieron consultar los rangos.');
        }
        rangos = resultado;
        renderRangos();
    } catch (err) {
        rangos = [];
        listaRangos.innerHTML = `<p class="rangos-vacio error">${escaparHTML(err.message)}</p>`;
        if (conteoRangos) conteoRangos.textContent = '';
    }
}

/** Rangos que coinciden con el buscador (IP, cliente, perfil, descripción). */
function rangosFiltrados() {
    const termino = normalizarTexto(buscador?.value);
    if (!termino) return rangos;
    return rangos.filter(r => {
        const texto = normalizarTexto([
            r.IPInicio, r.IPFin, r.ClienteCodigo, r.ClienteNombre,
            r.RolCodigo, r.RolNombre, r.Descripcion, r.Nombre, r.PisoNombre
        ].filter(Boolean).join(' '));
        return texto.includes(termino);
    });
}

function renderRangos() {
    const visibles = rangosFiltrados();

    if (conteoRangos) {
        conteoRangos.textContent = visibles.length === rangos.length
            ? `${rangos.length} ${rangos.length === 1 ? 'rango' : 'rangos'}`
            : `${visibles.length} de ${rangos.length} rangos`;
    }

    if (!visibles.length) {
        listaRangos.innerHTML = `<p class="rangos-vacio">
            ${rangos.length
                ? 'Ningún rango coincide con la búsqueda.'
                : `Este ${filtroCliente?.value ? 'cliente' : 'sistema'} todavía no tiene rangos configurados.
                   Mientras no existan rangos, el control de IP no restringe sus equipos.`}
        </p>`;
        return;
    }

    const grupos = new Map();
    visibles.forEach(r => {
        const clave = String(r.ClienteCodigo || r.IdCliente);
        if (!grupos.has(clave)) {
            grupos.set(clave, { codigo: r.ClienteCodigo, nombre: r.ClienteNombre, filas: [] });
        }
        grupos.get(clave).filas.push(r);
    });

    const fragmento = document.createDocumentFragment();

    [...grupos.values()].forEach(grupo => {
        const bloque = document.createElement('section');
        bloque.className = 'rangos-grupo';

        const encabezado = document.createElement('div');
        encabezado.className = 'rangos-grupo-header';
        encabezado.innerHTML = `
            ${renderBadgeCliente(grupo.codigo, grupo.nombre)}
            <span class="grupo-count">${grupo.filas.length} ${grupo.filas.length === 1 ? 'rango' : 'rangos'}</span>
        `;
        bloque.appendChild(encabezado);

        const tabla = document.createElement('table');
        tabla.className = 'rangos-tabla';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th style="width:26%;">Perfil</th>
                    <th style="width:34%;">Rango autorizado</th>
                    <th style="width:32%;">Descripción</th>
                    <th style="width:8%; text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = tabla.querySelector('tbody');

        grupo.filas.forEach(r => {
            const fila = document.createElement('tr');

            const perfilHTML = renderRolPill(r.RolCodigo, r.RolNombre);
            const inicio = escaparHTML(r.IPInicio);
            const fin = escaparHTML(r.IPFin);
            const rangoHTML = r.IPInicio === r.IPFin
                ? `<code class="rango-ip">${inicio}</code>`
                : `<code class="rango-ip">${inicio}</code><span class="rango-sep">–</span><code class="rango-ip">${fin}</code>`;
            const descripcionHTML = r.Descripcion
                ? escaparHTML(r.Descripcion)
                : '<span class="rango-sin-desc">—</span>';

            fila.innerHTML = `
                <td data-label="Perfil">${perfilHTML}</td>
                <td data-label="Rango">${rangoHTML}</td>
                <td data-label="Descripción">${descripcionHTML}</td>
                <td class="acciones-tabla"></td>
            `;

            const celda = fila.querySelector('.acciones-tabla');

            const btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'secundario';
            btnEditar.setAttribute('data-tooltip', 'Editar rango');
            btnEditar.innerHTML = iconoEditarSVG();
            btnEditar.addEventListener('click', () => abrirEditor(r));

            const btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'peligro';
            btnEliminar.setAttribute('data-tooltip', 'Eliminar rango');
            btnEliminar.innerHTML = iconoEliminarSVG();
            btnEliminar.addEventListener('click', () => eliminarRango(r));

            celda.appendChild(btnEditar);
            celda.appendChild(btnEliminar);
            tbody.appendChild(fila);
        });

        bloque.appendChild(tabla);
        fragmento.appendChild(bloque);
    });

    listaRangos.innerHTML = '';
    listaRangos.appendChild(fragmento);
}

/* =========================================================
   ALTA / EDICIÓN (ficha embebida, sin modal)
   ========================================================= */

function mostrarRangoMensaje(texto, tipo = 'error') {
    if (!rangoMensaje) return;
    rangoMensaje.textContent = texto;
    rangoMensaje.className = 'alert ' + tipo;
}

function ocultarRangoMensaje() {
    if (!rangoMensaje) return;
    rangoMensaje.className = 'alert oculto';
    rangoMensaje.textContent = '';
}

function setGuardandoRango(valor) {
    guardandoRango = valor;
    if (!btnGuardar) return;
    btnGuardar.disabled = valor;
    const txt = btnGuardar.querySelector('.btn-text');
    const spin = btnGuardar.querySelector('.btn-spinner');
    if (txt) txt.textContent = valor ? 'Guardando...' : 'Guardar';
    if (spin) spin.classList.toggle('oculto', !valor);
}

/** Bloquea el scroll del fondo mientras el modal está abierto. */
function bloquearScroll(bloquear) {
    document.body.style.overflow = bloquear ? 'hidden' : '';
}

function abrirEditor(rango = null) {
    if (!modalRango) return;
    rangoEditando = rango ? Number(rango.IdRangoIP) : null;
    if (editorTitulo) editorTitulo.textContent = rango ? 'Editar rango IP' : 'Nuevo rango IP';

    llenarSelectClientes(rangoCliente, rango?.IdCliente || filtroCliente?.value || '');
    llenarSelectPerfiles(rangoPerfil, rango?.IdRolEquipo || '');

    const segmento = rango ? segmentoDeIP(rango.IPInicio) : (rangoSegmento.value || '192.168.2');
    rangoSegmento.value = segmento;
    rangoInicio.value = rango?.IPInicio || '';
    rangoFin.value = (rango?.IPFin && rango.IPFin !== rango.IPInicio) ? rango.IPFin : '';
    rangoDescripcion.value = rango?.Descripcion || '';

    if (rangoCantidad && !parseInt(rangoCantidad.value, 10)) rangoCantidad.value = '10';
    reiniciarSugerencias();
    ocultarRangoMensaje();

    modalRango.classList.remove('oculto');
    bloquearScroll(true);
    rangoInicio.focus({ preventScroll: true });
}

function cerrarEditor() {
    if (!modalRango) return;
    modalRango.classList.add('oculto');
    bloquearScroll(false);
    rangoEditando = null;
    reiniciarSugerencias();
    ocultarRangoMensaje();
}

function reiniciarSugerencias() {
    sugerenciasRango = [];
    sugerenciasFragmentadas = [];
    if (!rangoSugerencias) return;
    rangoSugerencias.innerHTML = `
        <p class="sugerencias-vacio">
            Elige cliente, segmento y cantidad de hosts; después pulsa «Sugerir».
        </p>`;
}

async function guardarRango() {
    if (guardandoRango) return;

    const idCliente = parseInt(rangoCliente.value, 10);
    const datos = {
        idCliente,
        idRolEquipo: rangoPerfil.value ? parseInt(rangoPerfil.value, 10) : null,
        segmento: rangoSegmento.value.trim(),
        ipInicio: rangoInicio.value.trim(),
        ipFin: rangoFin.value.trim(),
        descripcion: rangoDescripcion.value.trim()
    };

    if (!idCliente) { mostrarRangoMensaje('Selecciona el cliente al que pertenece el rango.'); return; }
    if (!datos.ipInicio) { mostrarRangoMensaje('Captura la IP inicial del rango.'); return; }

    setGuardandoRango(true);
    try {
        const res = rangoEditando
            ? await window.api.rangos.actualizar(rangoEditando, datos)
            : await window.api.rangos.crear(datos);

        if (res && res.ok) {
            cerrarEditor();
            if (filtroCliente?.querySelector(`option[value="${idCliente}"]`)) {
                filtroCliente.value = String(idCliente);
            }
            await cargarRangos();
            toastExito(res.mensaje || 'Rango guardado');
        } else {
            mostrarRangoMensaje(res?.mensaje || 'No se pudo guardar el rango.');
        }
    } catch (err) {
        mostrarRangoMensaje('Error: ' + err.message);
    } finally {
        setGuardandoRango(false);
    }
}

async function eliminarRango(rango) {
    const etiqueta = rango.RolNombre
        ? `${rango.RolNombre} · ${rango.IPInicio} – ${rango.IPFin}`
        : `${rango.IPInicio} – ${rango.IPFin}`;
    const confirmacion = await confirmar({
        icon: 'warning',
        title: '¿Eliminar rango IP?',
        html: `Se eliminará el rango <strong>${escaparHTML(etiqueta)}</strong> de
               <strong>${escaparHTML(rango.ClienteCodigo || '')}</strong>.<br>
               Los equipos que lo tengan asignado quedarán sin rango.`,
        confirmButtonText: 'Sí, eliminar',
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro',
            cancelButton: 'swal2-cancel swal2-styled'
        }
    });
    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.rangos.eliminar(rango.IdRangoIP);
        if (res && res.ok) {
            await cargarRangos();
            toastExito(res.mensaje || 'Rango eliminado');
        } else {
            toastError('No se pudo eliminar el rango', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al eliminar el rango', err.message);
    }
}

/* =========================================================
   SUGERENCIA DE IP LIBRES
   ---------------------------------------------------------
   Un rango nuevo no debe pisar el rango de NINGÚN cliente ni
   una IP ya registrada. Se prefieren bloques consecutivos; si
   no alcanzan, se ofrecen fragmentos que en conjunto cubren
   lo pedido.
   ========================================================= */

async function mapaOcupacionSegmento(segmento, idRangoIgnorar = null) {
    const ocupados = new Map();
    ocupados.set(0, { tipo: 'red', etiqueta: 'Dirección de red' });
    ocupados.set(255, { tipo: 'red', etiqueta: 'Broadcast' });

    let todos = [];
    try {
        todos = await window.api.rangos.listar();
    } catch (_) {
        todos = [];
    }
    if (!Array.isArray(todos)) todos = [];

    const base = ipValorEntero(`${segmento}.0`);
    for (const r of todos) {
        if (idRangoIgnorar && Number(r.IdRangoIP) === Number(idRangoIgnorar)) continue;
        const inicio = ipValorEntero(r.IPInicio);
        const fin = ipValorEntero(r.IPFin);
        if (inicio === null || fin === null) continue;
        const desde = Math.max(inicio, base + HOST_INICIAL_RANGO);
        const hasta = Math.min(fin, base + HOST_FINAL_RANGO);
        const etiqueta = `${r.ClienteCodigo || 'Cliente'}${r.RolNombre ? ' · ' + r.RolNombre : ''}`;
        for (let valor = desde; valor <= hasta; valor += 1) {
            ocupados.set(valor - base, { tipo: 'rango', etiqueta });
        }
    }

    try {
        const asignadas = await window.api.equipos.listarIPsAsignadasEnSegmento(segmento);
        if (Array.isArray(asignadas)) {
            asignadas.forEach(ip => {
                const host = hostEnSegmento(String(ip ?? '').trim(), segmento);
                if (host === null || host < HOST_INICIAL_RANGO || host > HOST_FINAL_RANGO) return;
                if (!ocupados.has(host)) ocupados.set(host, { tipo: 'equipo', etiqueta: 'IP ya registrada' });
            });
        }
    } catch (_) { /* sin permiso o esquema pendiente: seguimos con los rangos */ }

    return ocupados;
}

function fragmentosLibres(ocupados) {
    const libres = [];
    let inicio = null;
    for (let host = HOST_INICIAL_RANGO; host <= HOST_FINAL_RANGO; host += 1) {
        const libre = !ocupados.has(host);
        if (libre && inicio === null) inicio = host;
        const ultimo = host === HOST_FINAL_RANGO;
        if (inicio !== null && (!libre || ultimo)) {
            const fin = libre && ultimo ? host : host - 1;
            libres.push({ inicio, fin, hosts: fin - inicio + 1 });
            inicio = null;
        }
    }
    return libres;
}

function tarjetaSugerencia(segmento, bloque, indice, singular) {
    const etiqueta = bloque.inicio === bloque.fin
        ? `${segmento}.${bloque.inicio}`
        : `${segmento}.${bloque.inicio} – ${segmento}.${bloque.fin}`;
    return `
        <article class="sugerencia-card">
            <div class="sugerencia-datos">
                <code class="sugerencia-rango">${escaparHTML(etiqueta)}</code>
                <span class="sugerencia-host">${bloque.hosts} ${bloque.hosts === 1 ? 'host' : 'hosts'}</span>
            </div>
            <button type="button" class="btn-ghost sugerencia-usar"
                    data-sugerencia="${indice}" data-inicio="${bloque.inicio}" data-fin="${bloque.fin}">
                ${singular ? 'Usar' : 'Usar bloque'}
            </button>
        </article>`;
}

function renderSugerencias(segmento, cantidad, fragmentos, ocupados) {
    sugerenciasRango = [];
    sugerenciasFragmentadas = [];
    const consecutivos = fragmentos
        .filter(f => f.hosts >= cantidad)
        .sort((a, b) => a.inicio - b.inicio);
    const restantes = fragmentos
        .filter(f => f.hosts < cantidad)
        .sort((a, b) => b.hosts - a.hosts || a.inicio - b.inicio);

    const totalLibres = fragmentos.reduce((suma, f) => suma + f.hosts, 0);
    const resumen = `
        <p class="sugerencias-resumen">
            <span class="sugerencias-pill">${totalLibres} hosts libres</span>
            <span class="sugerencias-pill">${ocupados.size} ocupadas</span>
            <span class="sugerencias-pill">${fragmentos.length} ${fragmentos.length === 1 ? 'bloque' : 'bloques'} libres</span>
        </p>`;

    if (!totalLibres) {
        rangoSugerencias.innerHTML = `${resumen}
            <p class="sugerencias-vacio alerta">
                El segmento ${escaparHTML(segmento)} no tiene hosts libres: todos están en rangos de clientes o registrados.
            </p>`;
        return;
    }

    let cuerpo = '';
    if (consecutivos.length) {
        const primeros = consecutivos.slice(0, 6);
        cuerpo += `
            <div class="sugerencias-grupo">
                <h5>Consecutivo recomendado</h5>
                <div class="sugerencias-grid">
                    ${primeros.map((f, i) => tarjetaSugerencia(segmento, f, i, true)).join('')}
                </div>
            </div>`;
        sugerenciasRango = primeros;
    }

    if (restantes.length && totalLibres >= cantidad) {
        const elegidos = [];
        let acumulado = 0;
        for (const f of restantes) {
            if (acumulado >= cantidad) break;
            elegidos.push(f);
            acumulado += f.hosts;
        }
        if (acumulado >= cantidad) {
            cuerpo += `
                <div class="sugerencias-grupo">
                    <h5>Sin consecutivo suficiente · ${elegidos.length} rangos fragmentados</h5>
                    <p class="sugerencias-nota">
                        No hay un bloque de ${cantidad} hosts seguidos. Estos fragmentos suman
                        ${acumulado} hosts sin pisar ningún rango ajeno.
                    </p>
                    <div class="sugerencias-grid">
                        ${elegidos.map((f, i) => tarjetaSugerencia(segmento, f, consecutivos.length + i, false)).join('')}
                    </div>
                    <button type="button" id="btn-sugerencia-fragmentada" class="btn-primary">
                        Crear ${elegidos.length} rangos fragmentados
                    </button>
                </div>`;
            sugerenciasFragmentadas = elegidos;
        }
    }

    if (!cuerpo) {
        cuerpo = `<p class="sugerencias-vacio alerta">
            Sólo hay bloques libres menores a ${cantidad} hosts y no alcanzan a cubrirlo.
            Baja la cantidad de hosts o revisa los rangos del segmento.
        </p>`;
    }

    const sinCliente = !parseInt(rangoCliente.value, 10);
    rangoSugerencias.innerHTML = `
        ${resumen}
        ${sinCliente ? '<p class="sugerencias-vacio alerta">Selecciona el cliente del rango para poder registrar la sugerencia.</p>' : ''}
        ${cuerpo}`;
}

function setSugiriendo(valor) {
    sugiriendoRango = valor;
    if (!btnSugerir) return;
    btnSugerir.disabled = valor;
    const txt = btnSugerir.querySelector('.btn-text');
    const spin = btnSugerir.querySelector('.btn-spinner');
    if (txt) txt.textContent = valor ? 'Calculando...' : 'Sugerir';
    if (spin) spin.classList.toggle('oculto', !valor);
}

async function sugerirIPs() {
    if (sugiriendoRango) return;

    const segmento = normalizarSegmento(rangoSegmento.value);
    if (!segmento) {
        rangoSugerencias.innerHTML = '<p class="sugerencias-vacio alerta">Indica el segmento con formato 192.168.2 para calcular las IP libres.</p>';
        return;
    }
    rangoSegmento.value = segmento;

    const cantidad = Math.min(HOST_FINAL_RANGO, Math.max(1, parseInt(rangoCantidad.value, 10) || 10));
    rangoCantidad.value = String(cantidad);

    setSugiriendo(true);
    rangoSugerencias.innerHTML = '<p class="sugerencias-vacio">Buscando huecos libres en el segmento...</p>';
    try {
        const ocupados = await mapaOcupacionSegmento(segmento, rangoEditando);
        renderSugerencias(segmento, cantidad, fragmentosLibres(ocupados), ocupados);
    } catch (err) {
        rangoSugerencias.innerHTML = `<p class="sugerencias-vacio alerta">${escaparHTML(err.message || 'No se pudieron calcular las IP libres.')}</p>`;
        sugerenciasRango = [];
    } finally {
        setSugiriendo(false);
    }
}

function usarSugerencia(indice) {
    const bloque = sugerenciasRango[indice];
    if (!bloque) return;
    const segmento = normalizarSegmento(rangoSegmento.value);
    if (!segmento) return;
    rangoInicio.value = `${segmento}.${bloque.inicio}`;
    rangoFin.value = bloque.inicio === bloque.fin ? '' : `${segmento}.${bloque.fin}`;
    ocultarRangoMensaje();
    rangoDescripcion.focus();
}

async function crearRangosFragmentados() {
    const idCliente = parseInt(rangoCliente.value, 10);
    if (!idCliente) {
        mostrarRangoMensaje('Selecciona el cliente al que pertenece el rango.');
        return;
    }
    const segmento = normalizarSegmento(rangoSegmento.value);
    if (!segmento) {
        mostrarRangoMensaje('Indica un segmento válido antes de crear los rangos.');
        return;
    }
    const cantidad = Math.max(1, parseInt(rangoCantidad.value, 10) || 10);
    const bloques = sugerenciasFragmentadas;
    if (!bloques.length) return;

    const detalle = bloques
        .map(b => `${segmento}.${b.inicio}${b.inicio === b.fin ? '' : ' – ' + segmento + '.' + b.fin}`)
        .join('<br>');

    const confirmacion = await confirmar({
        title: '¿Crear rangos fragmentados?',
        html: `<div style="text-align:left;font-size:0.9rem;">
            Se crearán ${bloques.length} rangos para el cliente seleccionado:<br><br>
            <div style="background:#F4F6F0;padding:10px;border-radius:6px;border-left:3px solid #516848;">
                ${detalle}
            </div>
            <p style="margin-top:10px;color:#7a7563;">
                Ninguno se empalma con rangos de otros clientes. La suma cubre al menos ${cantidad} hosts.
            </p></div>`,
        confirmButtonText: 'Crear rangos'
    });
    if (!confirmacion.isConfirmed) return;

    const datosBase = {
        idCliente,
        idRolEquipo: rangoPerfil.value ? parseInt(rangoPerfil.value, 10) : null,
        segmento,
        descripcion: 'Sugerencia de IP fragmentada'
    };

    let creados = 0;
    const errores = [];
    for (const bloque of bloques) {
        try {
            const res = await window.api.rangos.crear({
                ...datosBase,
                ipInicio: `${segmento}.${bloque.inicio}`,
                ipFin: `${segmento}.${bloque.fin}`
            });
            if (res && res.ok) creados += 1;
            else errores.push(res?.mensaje || 'Error desconocido');
        } catch (err) {
            errores.push(err.message);
        }
    }

    if (filtroCliente?.querySelector(`option[value="${idCliente}"]`)) {
        filtroCliente.value = String(idCliente);
    }
    await cargarRangos();
    cerrarEditor();

    if (errores.length) toastError(`Se crearon ${creados} rangos`, errores[0]);
    else toastExito(`${creados} rango(s) fragmentados creados`);
}

/* =========================================================
   AJUSTE AUTOMÁTICO (antes en la pestaña Rangos de Catálogos)
   ========================================================= */

const ETIQUETA_ACCION = {
    crear: 'Crear rango',
    ampliar: 'Ampliar rango',
    conflicto: 'Revisar a mano'
};

function mostrarMensajeAjuste(texto, tipo = 'error') {
    if (!rngMensaje) return;
    rngMensaje.textContent = texto;
    rngMensaje.className = 'alert ' + tipo;
}

function ocultarMensajeAjuste() {
    if (!rngMensaje) return;
    rngMensaje.className = 'alert oculto';
    rngMensaje.textContent = '';
}

function idClienteFiltro() {
    const valor = parseInt(filtroCliente?.value || '', 10);
    return Number.isInteger(valor) && valor > 0 ? valor : null;
}

function pendientesAplicables() {
    const r = analisis?.resumen;
    return (r?.crear || 0) + (r?.ampliar || 0);
}

function setEtiqueta(boton, texto) {
    const span = boton?.querySelector('.btn-text');
    if (span) span.textContent = texto;
}

function actualizarBotonAplicar() {
    if (!btnAplicar) return;
    const pendientes = pendientesAplicables();
    btnAplicar.disabled = ocupado || pendientes === 0;
    setEtiqueta(btnAplicar, pendientes
        ? `Ajustar automáticamente (${pendientes})`
        : 'Ajustar automáticamente');
}

function tarjetaStat(etiqueta, valor, ayuda = '', tono = '') {
    return `<div class="rng-stat ${tono}">
                <span class="rng-stat-valor">${escaparHTML(valor)}</span>
                <span class="rng-stat-label">${escaparHTML(etiqueta)}</span>
                ${ayuda ? `<span class="rng-stat-hint">${escaparHTML(ayuda)}</span>` : ''}
            </div>`;
}

function pintarResumenAjuste() {
    if (!rngResumen) return;
    if (!analisis) {
        rngResumen.innerHTML = '';
        rngResumen.classList.add('oculto');
        return;
    }
    const r = analisis.resumen || {};
    rngResumen.innerHTML = [
        tarjetaStat('Clientes con IP', r.clientes ?? 0, 'Con equipos estáticos'),
        tarjetaStat('Equipos con IP', r.equipos ?? 0, `${r.equiposEnPlano ?? 0} ya en el plano`),
        tarjetaStat('Rangos actuales', r.rangos ?? 0, `${r.cubiertos ?? 0} bloque(s) ya cubiertos`),
        tarjetaStat('Por crear', r.crear ?? 0, 'Rangos nuevos', r.crear ? 'ok' : ''),
        tarjetaStat('Por ampliar', r.ampliar ?? 0, 'Rangos existentes', r.ampliar ? 'aviso' : ''),
        tarjetaStat('Conflictos', r.conflicto ?? 0, 'Revisión manual', r.conflicto ? 'peligro' : ''),
        tarjetaStat('Rangos sin uso', r.sinUso ?? 0, 'El perfil tiene equipos, pero fuera del rango', r.sinUso ? 'aviso' : ''),
        tarjetaStat('Reservados', r.reservado ?? 0, 'Perfil aún sin equipos', r.reservado ? 'aviso' : ''),
        tarjetaStat('IP fuera de norma', r.violaciones ?? 0,
            `${r.sinNorma ?? 0} equipo(s) sin rango`, r.violaciones ? 'peligro' : '')
    ].join('');
    rngResumen.classList.remove('oculto');
}

function pintarPropuestas() {
    if (!rngPropuestas) return;
    rngPropuestas.innerHTML = '';
    const lista = analisis?.propuestas || [];
    if (!lista.length) return;

    const card = document.createElement('div');
    card.className = 'card-table';

    const tabla = document.createElement('table');
    tabla.className = 'data-table';
    tabla.innerHTML = `
        <thead>
            <tr>
                <th style="width:150px;">Cliente</th>
                <th style="width:160px;">Perfil</th>
                <th>Rango propuesto</th>
                <th style="width:130px;">Equipos</th>
                <th style="width:150px;">Acción</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = tabla.querySelector('tbody');

    lista.forEach(p => {
        const tr = document.createElement('tr');
        const perfil = renderRolPill(p.RolCodigo, p.RolNombre);
        const generales = Array.isArray(p.generaGeneral) && p.generaGeneral.length
            ? `<span class="rng-motivo rng-alerta">Incluye IP del Control general: ${escaparHTML(p.generaGeneral.join(', '))}</span>`
            : '';

        tr.innerHTML = `
            <td data-label="Cliente">${renderBadgeCliente(p.ClienteCodigo, p.ClienteNombre)}</td>
            <td data-label="Perfil">${perfil}</td>
            <td data-label="Rango propuesto">
                <span class="valor-tecnico">${escaparHTML(`${p.IPInicio} – ${p.IPFin}`)}</span>
                <span class="rng-motivo">${escaparHTML(p.Motivo || '')}</span>
                ${generales}
            </td>
            <td data-label="Equipos">
                <span class="badge-nombre">${p.TotalEquipos ?? 0}</span>
                <span class="rng-motivo">${p.EquiposEnPlano ?? 0} en el plano</span>
            </td>
            <td data-label="Acción">
                <span class="rng-accion ${escaparHTML(p.Accion || '')}">${escaparHTML(ETIQUETA_ACCION[p.Accion] || p.Accion || '')}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });

    card.appendChild(tabla);
    rngPropuestas.appendChild(card);
}

function bloqueAjuste(titulo, descripcion, items, tono) {
    if (!items || !items.length) return '';
    return `<section class="rng-bloque ${tono}">
                <div class="rng-bloque-header">
                    <h3>${escaparHTML(titulo)}</h3>
                    <span class="rng-bloque-count">${items.length}</span>
                </div>
                <p class="rng-bloque-desc">${escaparHTML(descripcion)}</p>
                <ul class="rng-lista">${items.map(i => `<li>${i}</li>`).join('')}</ul>
            </section>`;
}

function pintarAvisosAjuste() {
    if (!rngAvisos) return;
    if (!analisis) { rngAvisos.innerHTML = ''; return; }

    const sinUso = (analisis.sinUso || []).map(r =>
        `${renderBadgeCliente(r.ClienteCodigo || '')}
         ${renderRolPill(r.RolCodigo, r.RolNombre)}
         <span class="valor-tecnico">${escaparHTML(`${r.IPInicio} – ${r.IPFin}`)}</span>
         · ${escaparHTML(r.Motivo || '')}`
    );

    /* Rangos apartados para un perfil que todavía no tiene equipos: es el
       caso normal de reservar direcciones para el futuro, no un hallazgo. */
    const reservados = (analisis.reservado || []).map(r =>
        `${renderBadgeCliente(r.ClienteCodigo || '')}
         ${renderRolPill(r.RolCodigo, r.RolNombre)}
         <span class="valor-tecnico">${escaparHTML(`${r.IPInicio} – ${r.IPFin}`)}</span>
         · ${escaparHTML(r.Motivo || '')}`
    );

    const generales = (analisis.generalesEnRangos || []).map(g =>
        `<span class="valor-tecnico">${escaparHTML(g.IP)}</span>
         · ${escaparHTML(g.Hostname || 'sin hostname')}
         · dentro del rango de ${renderBadgeCliente(g.ClienteCodigo || '')}`
    );

    const invalidas = (analisis.ipsInvalidas || []).map(e =>
        `${renderBadgeCliente(e.ClienteCodigo || '')}
         ${escaparHTML(e.Hostname || 'Sin hostname')}
         · IP registrada: <span class="valor-tecnico">${escaparHTML(e.IP ?? '')}</span>`
    );

    const fuera = (analisis.violaciones || []).map(v =>
        `${renderBadgeCliente(v.ClienteCodigo || '')}
         ${escaparHTML(v.Hostname || 'Sin hostname')}
         · <span class="valor-tecnico">${escaparHTML(v.IP || '')}</span>
         · ${escaparHTML(v.mensaje || '')}`
    );

    rngAvisos.innerHTML = [
        bloqueAjuste('Rangos sin uso',
            'El perfil sí tiene equipos con IP, pero ninguno cae dentro de este rango: revisa si el rango está mal ubicado.',
            sinUso, 'aviso'),
        bloqueAjuste('Rangos reservados para perfiles sin equipos',
            'Se conservan tal cual: están apartados para cuando lleguen equipos de ese perfil. No hay nada que depurar.',
            reservados, ''),
        bloqueAjuste('IP del Control general dentro de rangos de cliente',
            'Esas direcciones son de infraestructura; conviene sacarlas del rango del cliente.',
            generales, 'aviso'),
        bloqueAjuste('Equipos con IP inválida',
            'No se pueden ubicar en ningún rango hasta corregir la IP.',
            invalidas, 'peligro'),
        bloqueAjuste('Equipos fuera de rango',
            'Se resuelven al aplicar el ajuste automático.',
            fuera, 'peligro')
    ].join('');
}

function pintarAjuste() {
    pintarResumenAjuste();
    pintarPropuestas();
    pintarAvisosAjuste();
    if (rngVacio) rngVacio.classList.toggle('oculto', !!analisis);
    actualizarBotonAplicar();
}

async function analizar() {
    if (ocupado) return;
    ocupado = true;
    ocultarMensajeAjuste();
    seccionAjuste?.classList.remove('oculto');
    if (btnAnalizar) btnAnalizar.disabled = true;
    setEtiqueta(btnAnalizar, 'Analizando...');
    actualizarBotonAplicar();

    try {
        const res = await window.api.rangos.analizar(idClienteFiltro());
        if (!res || res.ok === false) {
            analisis = null;
            pintarAjuste();
            mostrarMensajeAjuste(res?.mensaje || 'No se pudo analizar los rangos.');
            return;
        }
        analisis = res;
        pintarAjuste();
        if (!pendientesAplicables()) {
            mostrarMensajeAjuste(
                'Los rangos establecidos ya cubren todas las IP registradas: no hay nada que ajustar.',
                'ok'
            );
        }
    } catch (err) {
        analisis = null;
        pintarAjuste();
        mostrarMensajeAjuste(err.message || 'Error al analizar los rangos.');
    } finally {
        ocupado = false;
        if (btnAnalizar) btnAnalizar.disabled = false;
        setEtiqueta(btnAnalizar, 'Analizar');
        actualizarBotonAplicar();
    }
}

async function aplicarAjuste() {
    if (ocupado || !pendientesAplicables()) return;
    const r = analisis.resumen;

    const confirmacion = await confirmar({
        title: '¿Ajustar los rangos?',
        html: `<p style="margin:0 0 8px;">Se crearán <strong>${r.crear || 0}</strong> rango(s)
               y se ampliarán <strong>${r.ampliar || 0}</strong>.</p>
               <p style="margin:0;">Ningún rango se elimina: los conflictos quedan pendientes para revisarlos a mano.</p>`,
        confirmButtonText: 'Sí, ajustar'
    });
    if (!confirmacion.isConfirmed) return;

    ocupado = true;
    ocultarMensajeAjuste();
    if (btnAnalizar) btnAnalizar.disabled = true;
    if (btnAplicar) btnAplicar.disabled = true;
    setEtiqueta(btnAplicar, 'Aplicando...');

    try {
        const res = await window.api.rangos.aplicarAjuste(idClienteFiltro());
        if (res && res.ok) {
            analisis = res.analisis || null;
            pintarAjuste();
            await cargarRangos();
            await Swal.fire({
                icon: 'success',
                title: 'Rangos ajustados',
                html: escaparHTML(res.mensaje || ''),
                confirmButtonText: 'Entendido',
                buttonsStyling: false,
                customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
            });
        } else {
            mostrarMensajeAjuste(res?.mensaje || 'No se pudo aplicar el ajuste de rangos.');
        }
    } catch (err) {
        mostrarMensajeAjuste(err.message || 'Error al aplicar el ajuste de rangos.');
    } finally {
        ocupado = false;
        if (btnAnalizar) btnAnalizar.disabled = false;
        actualizarBotonAplicar();
    }
}

/* =========================================================
   AUDITORÍA
   ---------------------------------------------------------
   Sólo reporta lo que está mal. Un equipo cuya IP cae dentro
   de un rango establecido NO aparece aquí, aunque su perfil no
   tenga rango propio (antes eso generaba falsos positivos).
   ========================================================= */

async function auditar() {
    if (btnAuditar) btnAuditar.disabled = true;
    setEtiqueta(btnAuditar, 'Auditando...');
    seccionAuditoria?.classList.remove('oculto');
    auditoriaContenido.innerHTML = '<p class="rangos-vacio">Revisando rangos, choques e IP registradas...</p>';

    try {
        const res = await window.api.rangos.auditar(idClienteFiltro());
        if (!res || res.ok === false) {
            throw new Error(res?.mensaje || 'No se pudo auditar el cumplimiento de rangos.');
        }
        renderAuditoria(res);
        seccionAuditoria.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        auditoriaContenido.innerHTML = `<p class="rangos-vacio error">${escaparHTML(err.message)}</p>`;
    } finally {
        if (btnAuditar) btnAuditar.disabled = false;
        setEtiqueta(btnAuditar, 'Auditar');
    }
}

function renderAuditoria(res) {
    const r = res.resumen || {};
    const sinHallazgos = res.sinHallazgos === true;

    const totales = `
        <div class="rng-resumen">
            ${tarjetaStat('Rangos revisados', r.rangos ?? 0, '', '')}
            ${tarjetaStat('Equipos revisados', r.equipos ?? 0, 'IP estática activa', '')}
            ${tarjetaStat('Rangos mal definidos', r.rangosInvalidos ?? 0, 'IP inválida, invertido o cruza /24', r.rangosInvalidos ? 'peligro' : 'ok')}
            ${tarjetaStat('Choques entre rangos', r.choques ?? 0, 'Dos rangos se empalman', r.choques ? 'peligro' : 'ok')}
            ${tarjetaStat('IP duplicadas', r.ipsDuplicadas ?? 0, 'Dos equipos con la misma IP', r.ipsDuplicadas ? 'peligro' : 'ok')}
            ${tarjetaStat('IP en rango ajeno', r.ipEnRangoAjeno ?? 0, 'IP de un cliente en el rango de otro', r.ipEnRangoAjeno ? 'peligro' : 'ok')}
            ${tarjetaStat('Fuera de rango', r.violaciones ?? 0, 'No cae en ningún rango del cliente', r.violaciones ? 'peligro' : 'ok')}
            ${tarjetaStat('Sin cobertura', r.sinCobertura ?? 0, 'Falta configurar (no es error)', r.sinCobertura ? 'aviso' : 'ok')}
        </div>`;

    const bloques = [
        bloqueAjuste('Rangos mal definidos',
            'Un rango debe ser una IPv4 válida, empezar antes de terminar y vivir en un solo segmento /24.',
            (res.rangosInvalidos || []).map(x =>
                `${renderBadgeCliente(x.ClienteCodigo || '', x.ClienteNombre)}
                 ${escaparHTML(x.mensaje || '')}`), 'peligro'),

        bloqueAjuste('Choques entre rangos',
            'Dos rangos reservan las mismas direcciones. Si son de clientes distintos, la misma IP pertenece a dos clientes.',
            (res.choques || []).map(x =>
                `<span class="rng-accion ${x.tipo === 'entre-clientes' ? 'conflicto' : 'ampliar'}">${escaparHTML(x.tipo === 'entre-clientes' ? 'Entre clientes' : 'Mismo cliente')}</span>
                 ${escaparHTML(x.mensaje || '')}`), 'peligro'),

        bloqueAjuste('IP duplicada en varios equipos',
            'Dos o más equipos comparten la misma dirección IP; sólo una puede quedarse con ella.',
            (res.ipsDuplicadas || []).map(x =>
                `<span class="valor-tecnico">${escaparHTML(x.IP)}</span>
                 · ${escaparHTML(x.mensaje || '')}`), 'peligro'),

        bloqueAjuste('IP de un cliente dentro del rango de otro',
            'La IP está en el rango de otro cliente: hay que reasignarla o corregir el rango.',
            (res.ipEnRangoAjeno || []).map(x =>
                `${renderBadgeCliente(x.ClienteCodigo || '')}
                 ${escaparHTML(x.Hostname || '(sin hostname)')}
                 · <span class="valor-tecnico">${escaparHTML(x.IP || '')}</span>
                 · ${escaparHTML(x.mensaje || '')}`), 'peligro'),

        bloqueAjuste('Equipos fuera de los rangos establecidos',
            'Su IP no cae en ningún rango del cliente. El ajuste automático crea o amplía el rango que la cubre.',
            (res.violaciones || []).map(x =>
                `${renderBadgeCliente(x.ClienteCodigo || '')}
                 ${escaparHTML(x.Hostname || '(sin hostname)')}
                 · <span class="valor-tecnico">${escaparHTML(x.IP || '')}</span>
                 · ${escaparHTML(x.mensaje || '')}`), 'aviso')
    ].join('');

    const cobertura = res.cobertura || {};
    const clientesSinRango = (cobertura.clientesSinRango || []).map(c =>
        `${renderBadgeCliente(c.ClienteCodigo || '')} · ${c.equipos} equipo(s) sin ningún rango que los cubra`);
    const perfilesSinRango = (cobertura.perfilesSinRango || []).map(p =>
        `${renderBadgeCliente(p.ClienteCodigo || '')}
         ${renderRolPill('', p.RolNombre)}
         · ${p.equipos} equipo(s): el perfil no tiene rango propio ni norma general`);

    const bloqueCobertura = bloqueAjuste('Cobertura pendiente de configurar (no es un error)',
        'Estos clientes/perfiles todavía no tienen rangos. Mientras no los tengan, el control de IP no los restringe.',
        [...clientesSinRango, ...perfilesSinRango], 'aviso');

    auditoriaContenido.innerHTML = `
        ${totales}
        ${sinHallazgos
            ? `<div class="alert ok">
                   Sin hallazgos: todos los rangos están bien definidos, no hay choques ni IP duplicadas
                   y cada equipo con rango establecido cae dentro de él.
               </div>`
            : bloques}
        ${bloqueCobertura}
    `;
}

/* =========================================================
   EVENTOS
   ========================================================= */

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('load', init, { once: true });

async function init() {
    if (init.hecho) return;
    init.hecho = true;

    if (btnVolver) {
        btnVolver.addEventListener('click', () => window.api.navegarModulo('equipos'));
    }

    await cargarCatalogos();

    /* Filtro por cliente */
    if (filtroCliente) {
        filtroCliente.addEventListener('change', () => {
            analisis = null;
            pintarAjuste();
            if (seccionAjuste) seccionAjuste.classList.add('oculto');
            if (seccionAuditoria) seccionAuditoria.classList.add('oculto');
            cargarRangos();
        });
    }

    /* Buscador */
    if (buscador) {
        let temporizador = null;
        buscador.addEventListener('input', () => {
            clearTimeout(temporizador);
            temporizador = setTimeout(() => {
                if (btnLimpiarBusqueda) btnLimpiarBusqueda.classList.toggle('oculto', !buscador.value);
                renderRangos();
            }, 180);
        });
    }
    if (btnLimpiarBusqueda) {
        btnLimpiarBusqueda.addEventListener('click', () => {
            if (buscador) { buscador.value = ''; buscador.focus(); }
            btnLimpiarBusqueda.classList.add('oculto');
            renderRangos();
        });
    }

    /* Acciones principales */
    if (btnAnalizar) btnAnalizar.addEventListener('click', analizar);
    if (btnAplicar) btnAplicar.addEventListener('click', aplicarAjuste);
    if (btnAuditar) btnAuditar.addEventListener('click', auditar);
    if (btnNuevo) btnNuevo.addEventListener('click', () => abrirEditor(null));

    if (btnCerrarAjuste) {
        btnCerrarAjuste.addEventListener('click', () => seccionAjuste?.classList.add('oculto'));
    }
    if (btnCerrarAuditoria) {
        btnCerrarAuditoria.addEventListener('click', () => seccionAuditoria?.classList.add('oculto'));
    }
    if (btnCerrarEditor) btnCerrarEditor.addEventListener('click', cerrarEditor);
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarEditor);
    if (btnGuardar) btnGuardar.addEventListener('click', guardarRango);

    /* Cerrar el modal con clic en el fondo o con Escape */
    if (modalRango) {
        modalRango.addEventListener('mousedown', evento => {
            if (evento.target === modalRango) cerrarEditor();
        });
        document.addEventListener('keydown', evento => {
            if (evento.key === 'Escape' && !modalRango.classList.contains('oculto')) {
                evento.preventDefault();
                cerrarEditor();
            }
        });
    }

    /* Sugerencias */
    if (btnSugerir) btnSugerir.addEventListener('click', sugerirIPs);
    if (rangoSegmento) {
        rangoSegmento.addEventListener('change', reiniciarSugerencias);
        rangoSegmento.addEventListener('blur', () => {
            const segmento = normalizarSegmento(rangoSegmento.value);
            if (segmento) rangoSegmento.value = segmento;
        });
    }
    if (rangoCantidad) {
        rangoCantidad.addEventListener('change', () => {
            if (sugerenciasRango.length) sugerirIPs();
        });
    }
    if (rangoSugerencias) {
        rangoSugerencias.addEventListener('click', evento => {
            const boton = evento.target.closest('.sugerencia-usar');
            if (boton) { usarSugerencia(Number(boton.dataset.sugerencia)); return; }
            if (evento.target.closest('#btn-sugerencia-fragmentada')) crearRangosFragmentados();
        });
    }

    await cargarRangos();
    actualizarBotonAplicar();

    /* Estado inicial: modal cerrado y scroll libre. */
    if (modalRango) modalRango.classList.add('oculto');
    bloquearScroll(false);
}
