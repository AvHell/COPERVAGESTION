const $ = id => document.getElementById(id);
const formIP = $('form-ip');
const formCatalogo = $('form-catalogo');
const modalIP = $('modal-ip');
const modalCatalogo = $('modal-catalogo');
const modalCatalogos = $('modal-catalogos');
const tipoCatalogo = $('tipo-catalogo');
const textoCatalogo = $('nombre-catalogo');

let registros = [];
let filas = [];
let catalogos = [];
let idEditando = null;
let catalogoEditando = null;
let paginaActual = 1;
let tamanoPagina = 25;
let segmentoActual = '';
let rangosCliente = [];
let clientesCatalogo = [];
let ipOriginalRegistro = '';
let tokenHintRango = 0;


const HOST_INICIAL = 1;
const HOST_FINAL = 254;

const CAMPOS_BUSQUEDA = [
    'Origen', 'IP', 'Hostname', 'MAC', 'Descripcion', 'PuertoFortinet', 'Estado', 'Dispositivo',
    'TipoEquipo', 'Piso', 'ClienteCodigo', 'ClienteNombre', 'Site'
];

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

/* IPv4 estricta: cuatro octetos 0-255 separados por puntos. */
function validarIPv4(valor) {
    const octetos = String(valor || '').trim().split('.');
    return octetos.length === 4 &&
        octetos.every(octeto => /^\d{1,3}$/.test(octeto) && Number(octeto) <= 255);
}

/* MAC: 12 dígitos hexadecimales, SIEMPRE en formato 00:11:22:33:44:55.
   Devuelve '' si viene vacía, null si es inválida y la cadena normalizada
   (con dos puntos) cuando es correcta. */
function normalizarMAC(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    const hex = texto.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (hex.length !== 12) return null;
    return hex.match(/.{2}/g).join(':');
}

/* Da formato progresivo mientras se escribe: agrupa en pares con ":" y
   limita a 12 dígitos (17 caracteres con separadores). */
function formatearEntradaMAC(valor) {
    const hex = String(valor || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(0, 12);
    return hex.match(/.{1,2}/g)?.join(':') || '';
}

function badge(valor, clase, vacio = '—') {
    return `<span class="ip-badge ${clase}${valor ? '' : ' vacio'}">${escaparHTML(valor || vacio)}</span>`;
}

/* Contraste legible sobre un color de fondo (mismo criterio que PermisosUI). */
function contraste(hex) {
    if (!/^#[0-9A-F]{6}$/i.test(hex || '')) return '#ffffff';
    const canales = hex.slice(1).match(/.{2}/g)
        .map(canal => parseInt(canal, 16) / 255)
        .map(canal => canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4);
    return canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722 > 0.42 ? '#20271f' : '#ffffff';
}

/* Estilo sólido de una insignia pintada con un color propio. */
function estiloSolido(color) {
    return ` style="background-color:${color} !important;border-color:${color} !important;color:${contraste(color)} !important"`;
}

/* Badge de cliente: muestra SOLO el nombre del cliente (el código ya no se
   repite en la tabla) con el color configurado en Catálogos del Sistema.
   Si el cliente no tiene nombre registrado se usa el código como respaldo.
   Los registros que entran directo por el control general no pertenecen a
   ningún cliente: llevan su propio color (ver colorGeneral()). */
function badgeCliente(registro) {
    const codigo = String(registro?.ClienteCodigo || '').trim().toUpperCase();
    const nombre = String(registro?.ClienteNombre || '').trim();
    const etiqueta = nombre || codigo;
    if (!etiqueta) {
        if (String(registro?.Origen || '') === 'General') {
            return `<span class="ip-badge cliente badge-cliente badge-general"${estiloSolido(colorGeneral())}`
                + ' title="Dispositivo del control general: no lo administra ningún cliente"'
                + '>General</span>';
        }
        return badge('', 'cliente');
    }
    const color = colorDeCliente(codigo);
    const estilo = color ? estiloSolido(color) : '';
    const titulo = codigo ? ` title="Cliente ${escaparHTML(codigo)}"` : '';
    return `<span class="ip-badge cliente badge-cliente" data-color="${escaparHTML(codigo)}"${estilo}${titulo}>`
        + `<span class="nombre">${escaparHTML(etiqueta)}</span>`
        + '</span>';
}

/* =========================================================
   COLOR DEL CLIENTE
   El color se define en Catálogos del Sistema. Aquí sólo se
   administra el color propio de los registros que entran
   directo por el control general.
   ========================================================= */

const COLOR_CLIENTE_DEFECTO = '#6E7B5B';

/* Devuelve "#RRGGBB" en mayúsculas o el color por defecto si no es válido. */
function normalizarColorHex(valor, defecto = COLOR_CLIENTE_DEFECTO) {
    const texto = String(valor || '').trim();
    if (/^#[0-9A-F]{6}$/i.test(texto)) return texto.toUpperCase();
    if (/^#[0-9A-F]{3}$/i.test(texto)) {
        return `#${texto.slice(1).split('').map(canal => canal + canal).join('')}`.toUpperCase();
    }
    return defecto;
}

/* =========================================================
   COLOR DE LOS DISPOSITIVOS SIN CLIENTE
   Los registros que entran directo por el control general no los
   administra ningún cliente, pero también necesitan distinguirse por
   color. Ese color se guarda en la base de datos
   (dbo.PreferenciasInventarioIP, clave 'color-general'), así es el mismo
   en todos los equipos; localStorage queda sólo como caché para poder
   pintar la tabla antes de que responda la base.
   ========================================================= */

const COLOR_GENERAL_CLAVE = 'inventario-ip:color-general';
const COLOR_GENERAL_DEFECTO = '#5C6B73';

/* Último color leído de la base (o de la caché) durante esta sesión. */
let colorGeneralActual = null;

function colorGeneral() {
    if (colorGeneralActual) return colorGeneralActual;
    try {
        return normalizarColorHex(localStorage.getItem(COLOR_GENERAL_CLAVE), COLOR_GENERAL_DEFECTO);
    } catch (error) {
        return COLOR_GENERAL_DEFECTO;
    }
}

function cachearColorGeneral(color) {
    colorGeneralActual = normalizarColorHex(color, COLOR_GENERAL_DEFECTO);
    try {
        localStorage.setItem(COLOR_GENERAL_CLAVE, colorGeneralActual);
    } catch (error) {
        /* Sin almacenamiento el color sigue aplicado en memoria. */
    }
    return colorGeneralActual;
}

/* Lee el color guardado en la base y refresca la caché local. */
async function cargarColorGeneral() {
    try {
        const preferencias = await window.api?.inventarioIP?.listarPreferencias?.();
        const color = normalizarColorHex(preferencias?.['color-general'], '');
        if (color) cachearColorGeneral(color);
    } catch (error) {
        console.warn('No se pudo leer el color del control general:', error?.message || error);
    }
}

/* Guarda el color en la base. Si la base no responde, el color se aplica
   igual en esta sesión y se avisa del problema. */
async function guardarColorGeneral(color) {
    const normalizado = cachearColorGeneral(color);
    try {
        const guardado = await window.api.inventarioIP.guardarPreferencia('color-general', normalizado);
        return guardado?.ok
            ? guardado
            : { ok: false, mensaje: guardado?.mensaje || 'No se pudo guardar el color en la base de datos.' };
    } catch (error) {
        return { ok: false, mensaje: `No se pudo guardar el color en la base de datos: ${error.message}` };
    }
}

function canalesColor(valor) {
    const hex = normalizarColorHex(valor, '');
    return hex ? hex.slice(1).match(/.{2}/g).map(canal => parseInt(canal, 16)) : null;
}

/* Tono tenue: fondo y borde del color del cliente con el texto oscurecido,
   así el hostname se distingue por cliente sin perder legibilidad. */
function estiloColorTenue(valor) {
    const canales = canalesColor(valor);
    if (!canales) return '';
    const [rojo, verde, azul] = canales;
    const texto = canales.map(canal => Math.round(canal * 0.55)).join(', ');
    return ` style="background-color:rgba(${rojo}, ${verde}, ${azul}, .16);`
        + `border-color:rgba(${rojo}, ${verde}, ${azul}, .55);color:rgb(${texto})"`;
}

/* Color del cliente: primero el mapa de PermisosUI (Catálogos del Sistema)
   y, como respaldo, el ColorHex de la lista de clientes de esta pantalla. */
function colorDeCliente(codigo) {
    const clave = String(codigo || '').trim().toUpperCase();
    if (!clave) return '';
    const guardado = window.PermisosUI?.colorCliente?.(clave);
    if (guardado) return normalizarColorHex(guardado, '');
    const cliente = clientesCatalogo.find(item =>
        String(item.Codigo || '').trim().toUpperCase() === clave
    );
    return normalizarColorHex(cliente?.ColorHex, '');
}

/* El color del cliente se aplica SOLO al hostname de los equipos que
   pertenecen a un cliente; los registros del inventario general y las IP
   libres conservan la etiqueta neutra. */
function badgeHostname(registro) {
    const hostname = String(registro?.Hostname || '').trim();
    const esCliente = registro?.Origen === 'Cliente' &&
        Boolean(String(registro?.ClienteCodigo || '').trim());
    if (!esCliente || !hostname) return badge(hostname, 'hostname');
    const color = colorDeCliente(registro.ClienteCodigo);
    if (!color) return badge(hostname, 'hostname hostname-cliente');
    return `<span class="ip-badge hostname hostname-cliente"${estiloColorTenue(color)}`
        + ` title="Hostname del cliente ${escaparHTML(String(registro.ClienteCodigo).trim())}"`
        + `>${escaparHTML(hostname)}</span>`;
}


/* Los <dialog> abiertos con showModal() viven en la capa superior del navegador,
   así que un SweetAlert insertado en <body> queda SIEMPRE detrás de ellos.
   Para que el aviso se vea por encima del modal, se crea una capa <dialog>
   temporal (también en la capa superior) y ahí se monta el SweetAlert. */
let capaSwal = null;

function abrirCapaSwal() {
    if (!document.querySelector('dialog[open]')) return null;
    if (!capaSwal) {
        capaSwal = document.createElement('dialog');
        capaSwal.className = 'ip-swal-layer';
        capaSwal.setAttribute('aria-label', 'Aviso de control general de IP');
        document.body.append(capaSwal);
    }
    if (!capaSwal.open) capaSwal.showModal();
    return capaSwal;
}

function cerrarCapaSwal() {
    if (!capaSwal) return;
    if (capaSwal.open) capaSwal.close();
    capaSwal.remove();
    capaSwal = null;
}

/* Envoltorio de Swal.fire que siempre se dibuja sobre el modal abierto. */
function fireSwal(opciones = {}) {
    const capa = abrirCapaSwal();
    const { didClose, ...resto } = opciones;
    return window.Swal.fire({
        ...resto,
        ...(capa ? { target: capa } : {}),
        didClose: (...args) => {
            cerrarCapaSwal();
            if (typeof didClose === 'function') return didClose(...args);
            return undefined;
        }
    });
}

function mostrarError(mensaje) {
    fireSwal({ icon: 'error', title: 'No se pudo completar', text: mensaje || 'Error desconocido.' });
}

function mostrarToast(mensaje) {
    fireSwal({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: mensaje,
        showConfirmButton: false,
        timer: 2600
    });
}

function catalogoPorId(id) {
    return catalogos.find(item => Number(item.IdCatalogoIP) === Number(id));
}

function opcionesCatalogo(tipo) {
    return catalogos.filter(item => item.TipoCatalogo === tipo && item.Activo);
}

/* =========================================================
   SEGMENTOS
   ========================================================= */

function segmentoDe(ip) {
    const partes = String(ip || '').trim().split('.');
    if (partes.length !== 4 || !partes.every(parte => /^\d{1,3}$/.test(parte) && Number(parte) <= 255)) {
        return 'Sin IP';
    }
    return partes.slice(0, 3).map(parte => String(Number(parte))).join('.');
}

function etiquetaSegmento(segmento) {
    return segmento === 'Sin IP' ? 'Sin IP' : `${segmento}.0/24`;
}

function compararSegmentos(a, b) {
    if (a === 'Sin IP') return 1;
    if (b === 'Sin IP') return -1;
    const octetosA = a.split('.').map(Number);
    const octetosB = b.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) {
        if (octetosA[i] !== octetosB[i]) return octetosA[i] - octetosB[i];
    }
    return 0;
}

/* Estado visible: una IP registrada y en uso es "Ocupado"; las inactivas
   y las que nadie ha registrado son "Libre". */
function estadoVisible(estado) {
    return String(estado || '').trim().toLowerCase() === 'activo' ? 'Ocupado' : 'Libre';
}

/* Valor numérico de la IP, para ordenar el segmento por host. */
function ipComoNumero(ip) {
    const partes = String(ip || '').split('.');
    if (partes.length !== 4 || !partes.every(parte => /^\d{1,3}$/.test(parte))) {
        return Number.MAX_SAFE_INTEGER;
    }
    return partes.reduce((total, parte) => total * 256 + Number(parte), 0);
}

/* =========================================================
   RANGOS DE CLIENTE (reserva de IP)
   Una misma línea para clientes y general: la IP que un cliente
   declaró en sus rangos queda reservada y el control general no
   puede ocuparla con un dispositivo que no pertenece a ese cliente.
   ========================================================= */

function rangoDeIP(ip) {
    const valor = ipComoNumero(ip);
    if (!rangosCliente.length || valor === Number.MAX_SAFE_INTEGER) return null;
    return rangosCliente.find(rango => {
        const inicio = ipComoNumero(rango.IPInicio);
        const fin = ipComoNumero(rango.IPFin);
        if (inicio === Number.MAX_SAFE_INTEGER || fin === Number.MAX_SAFE_INTEGER) return false;
        return valor >= inicio && valor <= fin;
    }) || null;
}

function etiquetaRangoCliente(rango) {
    if (!rango) return '';
    const cliente = rango.ClienteCodigo || 'Cliente';
    const perfil = rango.RolNombre || 'cualquier perfil';
    return `${cliente} · ${perfil} (${rango.IPInicio} – ${rango.IPFin})`;
}

/* Carga los rangos declarados por los clientes (todos los clientes).
   Si la tabla dbo.RangosIP todavía no existe, el control general sigue
   operando sin reservas en lugar de romper la pantalla. */
async function cargarRangosCliente() {
    try {
        const lista = await window.api?.rangos?.listar?.();
        rangosCliente = Array.isArray(lista) ? lista : [];
    } catch (error) {
        rangosCliente = [];
        console.warn('No se pudieron cargar los rangos de cliente:', error?.message || error);
    }
}

/* La tabla muestra el segmento completo: los registros existentes más
   todas las IP del /24 (1-254) que todavía están libres, porque esas
   direcciones no viven en la base de datos. */
function construirFilas(lista) {
    const resultado = [];
    const ocupadas = new Set();
    const segmentos = new Set();

    for (const registro of lista) {
        const ip = String(registro.IP || '').trim();
        const segmento = segmentoDe(ip);
        if (segmento !== 'Sin IP') {
            ocupadas.add(ip);
            segmentos.add(segmento);
        }
        /* Un registro del inventario general que cae en un rango de cliente
           ya no cumple la norma: se marca en la tabla para poder corregirlo. */
        const rangoReservado = String(registro.Origen || '') === 'General' ? rangoDeIP(ip) : null;
        resultado.push({
            ...registro,
            Estado: estadoVisible(registro.Estado),
            Libre: false,
            Reservado: Boolean(rangoReservado),
            RangoReservado: rangoReservado
        });
    }

    for (const segmento of [...segmentos].sort(compararSegmentos)) {
        for (let host = HOST_INICIAL; host <= HOST_FINAL; host += 1) {
            const ip = `${segmento}.${host}`;
            if (ocupadas.has(ip)) continue;
            const rangoReservado = rangoDeIP(ip);
            resultado.push({
                Origen: '', IP: ip,
                Estado: rangoReservado ? 'Reservado' : 'Libre',
                Libre: !rangoReservado,
                Reservado: Boolean(rangoReservado),
                RangoReservado: rangoReservado,
                Hostname: '', MAC: '', Descripcion: '', PuertoFortinet: '',
                ClienteCodigo: '', ClienteNombre: '', Dispositivo: '', TipoEquipo: '',
                Piso: '', Site: '', IdSite: null, IdEstado: null
            });
        }
    }

    return resultado.sort((a, b) => {
        const porSegmento = compararSegmentos(segmentoDe(a.IP), segmentoDe(b.IP));
        if (porSegmento !== 0) return porSegmento;
        const porIP = ipComoNumero(a.IP) - ipComoNumero(b.IP);
        if (porIP !== 0) return porIP;
        return String(a.Origen || '').localeCompare(String(b.Origen || ''), 'es');
    });
}

/* Estadísticas por segmento (sin contar dos veces una misma IP). */
function calcularSegmentos(lista) {
    const mapa = new Map();
    for (const fila of lista) {
        const segmento = segmentoDe(fila.IP);
        if (!mapa.has(segmento)) {
            mapa.set(segmento, { segmento, total: 0, ocupadas: 0, reservadas: 0, libres: 0, ips: new Set() });
        }
        const item = mapa.get(segmento);
        if (item.ips.has(fila.IP)) continue;
        item.ips.add(fila.IP);
        item.total += 1;
        if (fila.Reservado) item.reservadas += 1;
        else if (fila.Libre) item.libres += 1;
        else item.ocupadas += 1;
    }
    return [...mapa.values()]
        .map(({ ips, ...datos }) => datos)
        .sort((a, b) => compararSegmentos(a.segmento, b.segmento));
}

function detalleSegmento(datos) {
    if (!datos?.total) return 'Este segmento no tiene direcciones registradas.';
    if (datos.segmento === 'Sin IP') return `${datos.total} registros sin IP`;
    const reservadas = datos.reservadas ? ` · ${datos.reservadas} reservadas` : '';
    return `${datos.total} IP · ${datos.ocupadas} ocupadas${reservadas} · ${datos.libres} libres`;
}

/* Porcentajes del segmento: ocupadas + reservadas sobre el total de IP. */
function porcentajesSegmento(datos) {
    const total = Number(datos?.total) || 0;
    if (!total) return { ocupado: 0, acumulado: 0 };
    const ocupadas = Number(datos.ocupadas) || 0;
    const reservadas = Number(datos.reservadas) || 0;
    const ocupado = Math.round((ocupadas / total) * 100);
    const reservado = Math.min(100 - ocupado, Math.round((reservadas / total) * 100));
    return { ocupado, acumulado: ocupado + reservado };
}

function crearItemSegmento(datos, esTodos = false) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'segmento-item';
    const seleccionado = esTodos ? !segmentoActual : segmentoActual === datos.segmento;
    boton.classList.toggle('activo', seleccionado);
    boton.setAttribute('aria-pressed', seleccionado ? 'true' : 'false');

    const ocupado = datos.ocupadas > 0;
    const { ocupado: pctOcupado, acumulado: pctAcumulado } = porcentajesSegmento(datos);
    const detalle = esTodos ? detalleTotales(datos) : detalleSegmento(datos);
    boton.title = detalle;

    const meta = datos.segmento === 'Sin IP'
        ? `${datos.total} registros sin IP`
        : `${datos.total} IP en el segmento`;

    boton.innerHTML = `
        <span class="segmento-cabecera">
            <span class="segmento-nombre">${escaparHTML(esTodos ? 'Todos los segmentos' : etiquetaSegmento(datos.segmento))}</span>
            <span class="segmento-pill ${ocupado ? 'ocupado' : 'libre'}">${ocupado ? 'Ocupado' : 'Libre'}</span>
        </span>
        <span class="kpi-cifras">
            <span class="kpi-cifra ocupada"><strong>${datos.ocupadas}</strong><small>ocupadas</small></span>
            <span class="kpi-cifra libre"><strong>${datos.libres}</strong><small>libres</small></span>
            ${datos.reservadas ? `<span class="kpi-cifra reservada"><strong>${datos.reservadas}</strong><small>reservadas</small></span>` : ''}
            <span class="kpi-porcentaje">${pctAcumulado}%</span>
        </span>
        <span class="kpi-progreso" role="img" aria-label="Ocupación del ${pctAcumulado}%">
            <span class="kpi-progreso-relleno"
                style="--pct-ocupado:${pctOcupado}%; --pct-acumulado:${pctAcumulado}%"></span>
        </span>
        <span class="segmento-meta">${escaparHTML(meta)}</span>`;
    boton.addEventListener('click', () => {
        segmentoActual = esTodos ? '' : datos.segmento;
        paginaActual = 1;
        renderizarSegmentos();
        renderizarTabla();
    });
    const contenedor = document.createElement('li');
    contenedor.append(boton);
    return contenedor;
}

/* Suma todas las IP del conjunto de segmentos (la usan la tarjeta
   "Todos los segmentos" y la cabecera de la tabla). */
function sumarSegmentos(segmentos) {
    return segmentos.reduce((acumulado, item) => ({
        segmento: '',
        total: acumulado.total + item.total,
        ocupadas: acumulado.ocupadas + item.ocupadas,
        reservadas: acumulado.reservadas + item.reservadas,
        libres: acumulado.libres + item.libres
    }), { segmento: '', total: 0, ocupadas: 0, reservadas: 0, libres: 0 });
}

function detalleTotales(datos) {
    if (!datos.total) return 'Sin direcciones registradas.';
    const reservadas = datos.reservadas ? ` · ${datos.reservadas} reservadas` : '';
    return `${datos.total} IP · ${datos.ocupadas} ocupadas${reservadas} · ${datos.libres} libres`;
}

function renderizarSegmentos() {
    const lista = $('lista-segmentos');
    if (!lista) return;

    // Refresco en vivo: la lista de segmentos conserva su desplazamiento
    // al cambiar de segmento, exportar o recargar datos.
    if (window.Vivo) {
        window.Vivo.enVivo(lista, () => pintarSegmentos(lista));
        return;
    }
    pintarSegmentos(lista);
}

function pintarSegmentos(lista) {
    lista.replaceChildren();
    const segmentos = calcularSegmentos(filas);

    lista.append(crearItemSegmento(sumarSegmentos(segmentos), true));
    segmentos.forEach(item => lista.append(crearItemSegmento(item)));

    const resumen = $('segmentos-resumen');
    if (resumen) {
        const totales = sumarSegmentos(segmentos);
        const piezas = [
            `<span>${segmentos.length} ${segmentos.length === 1 ? 'segmento' : 'segmentos'}</span>`,
            `<span><b>${totales.total}</b> IP</span>`,
            `<span class="dato-ocupado"><b>${totales.ocupadas}</b> ocupadas</span>`,
            `<span class="dato-libre"><b>${totales.libres}</b> libres</span>`
        ];
        if (totales.reservadas) {
            piezas.push(`<span class="dato-reservado"><b>${totales.reservadas}</b> reservadas</span>`);
        }
        resumen.innerHTML = piezas.join('');
    }
}

function actualizarCabeceraSegmento() {
    const segmentos = calcularSegmentos(filas);
    const datos = segmentoActual
        ? segmentos.find(item => item.segmento === segmentoActual) || { segmento: segmentoActual, total: 0, ocupadas: 0, libres: 0 }
        : sumarSegmentos(segmentos);

    $('segmento-titulo').textContent = segmentoActual ? etiquetaSegmento(segmentoActual) : 'Todos los segmentos';
    $('segmento-detalle').textContent = detalleSegmento(datos);

    const ocupado = datos.ocupadas > 0;
    const { acumulado } = porcentajesSegmento(datos);
    $('segmento-estado').innerHTML = `
        <span class="barra-kpi"><strong>${datos.ocupadas}</strong> ocupadas</span>
        <span class="barra-kpi libre"><strong>${datos.libres}</strong> libres</span>
        <span class="barra-kpi porcentaje">${acumulado}% usado</span>
        <span class="segmento-pill ${ocupado ? 'ocupado' : 'libre'}">${ocupado ? 'Ocupado' : 'Libre'}</span>`;
}

/* =========================================================
   FILTRADO DE LA TABLA
   La tabla se acota con el segmento elegido y con el buscador
   general; no lleva filtros por columna.
   ========================================================= */

function registrosFiltrados() {
    const termino = $('busqueda').value.trim().toLowerCase();
    return filas.filter(registro => {
        if (segmentoActual && segmentoDe(registro.IP) !== segmentoActual) return false;
        if (!termino) return true;
        return CAMPOS_BUSQUEDA.some(campo =>
            String(registro[campo] || '').toLowerCase().includes(termino)
        );
    });
}

/* =========================================================
   TABLA
   ========================================================= */

function renderizarTabla() {
    // Refresco en vivo: el repintado conserva el desplazamiento de la tabla.
    const cuerpoTabla = $('tabla-ip');
    if (window.Vivo && cuerpoTabla) {
        window.Vivo.enVivo(cuerpoTabla, pintarTabla);
        return;
    }
    pintarTabla();
}

function pintarTabla() {
    const cuerpo = $('tabla-ip');
    cuerpo.replaceChildren();
    const lista = registrosFiltrados();
    const totalPaginas = Math.max(1, Math.ceil(lista.length / tamanoPagina));
    paginaActual = Math.min(paginaActual, totalPaginas);
    const inicio = (paginaActual - 1) * tamanoPagina;
    const pagina = lista.slice(inicio, inicio + tamanoPagina);

    $('sin-registros').hidden = lista.length > 0;
    for (const item of pagina) {
        const fila = document.createElement('tr');
        if (item.Reservado) {
            fila.classList.add('fila-reservada');
            fila.title = item.RangoReservado
                ? `IP reservada para ${etiquetaRangoCliente(item.RangoReservado)}`
                : '';
        } else if (item.Libre) {
            fila.classList.add('fila-libre');
        }
        const claseEstado = item.Reservado
            ? 'estado-reservado'
            : (item.Estado === 'Ocupado' ? 'estado-ocupado' : 'estado-libre');
        fila.innerHTML = `
            <td>${badge(item.Origen, item.Origen === 'Cliente' ? 'origen-cliente' : 'origen-general')}</td>
            <td>${badge(item.Estado, claseEstado)}</td>
            <td>${badge(item.IP || 'DHCP', 'ip')}</td>
            <td>${badgeHostname(item)}</td>
            <td>${badge(item.MAC, 'dato')}</td>
            <td>${badge(item.Dispositivo, 'dato')}</td>
            <td>${badge(item.TipoEquipo, 'dato')}</td>
            <td>${badge(item.Piso, 'dato')}</td>
            <td class="cliente-celda"><div class="cliente-celda-inner">${badgeCliente(item)}</div></td>
            <td>${badge(item.PuertoFortinet, 'dato')}</td>
            <td class="descripcion-celda">${badge(item.Descripcion, 'dato')}</td>`;

        const acciones = document.createElement('td');
        acciones.className = 'actions';
        if (item.Reservado && !item.Origen) {
            /* IP libre del segmento que un cliente ya reservó: no se puede
               asignar desde el control general. */
            const nota = document.createElement('span');
            nota.className = 'reservado-nota';
            nota.textContent = 'Reservada al cliente';
            nota.title = etiquetaRangoCliente(item.RangoReservado);
            acciones.append(nota);
        } else if (item.Libre) {
            const asignar = document.createElement('button');
            asignar.type = 'button';
            asignar.className = 'button primary';
            asignar.dataset.permiso = 'equipos:crear';
            asignar.textContent = 'Asignar';
            asignar.title = `Registrar ${item.IP} en el control general`;
            asignar.addEventListener('click', () => abrirRegistroLibre(item));
            acciones.append(asignar);
        } else if (item.Origen === 'General') {
            const editar = document.createElement('button');
            editar.type = 'button';
            editar.className = 'button secondary';
            editar.dataset.permiso = 'equipos:editar';
            editar.textContent = 'Editar';
            editar.addEventListener('click', () => editarRegistro(item));
            const eliminar = document.createElement('button');
            eliminar.type = 'button';
            eliminar.className = 'button danger';
            eliminar.dataset.permiso = 'equipos:eliminar';
            eliminar.textContent = 'Eliminar';
            eliminar.addEventListener('click', () => eliminarRegistro(item));
            acciones.append(editar, eliminar);
        } else {
            const editar = document.createElement('button');
            editar.type = 'button';
            editar.className = 'button secondary';
            editar.dataset.permiso = 'equipos:editar';
            editar.textContent = 'Editar datos';
            editar.addEventListener('click', () => editarDatosCliente(item));
            acciones.append(editar);
        }
        fila.append(acciones);
        cuerpo.append(fila);
    }

    $('resumen-paginacion').textContent = lista.length
        ? `${inicio + 1}–${Math.min(inicio + tamanoPagina, lista.length)} de ${lista.length}`
        : '0 registros';
    $('pagina-anterior').disabled = paginaActual <= 1;
    $('pagina-siguiente').disabled = paginaActual >= totalPaginas;
    window.PermisosUI?.aplicar(cuerpo);
    actualizarCabeceraSegmento();
}

/* =========================================================
   FORMULARIOS
   ========================================================= */

function llenarSelect(id, tipo, seleccion = '') {
    const select = $(id);
    select.replaceChildren(new Option('Selecciona...', ''));
    for (const item of opcionesCatalogo(tipo)) {
        select.add(new Option(item.Nombre, String(item.IdCatalogoIP)));
    }
    select.value = String(seleccion || '');
}

function actualizarFormularioCatalogos() {
    llenarSelect('estado', 'Estado');
    llenarSelect('dispositivo', 'Dispositivo');
    llenarSelect('tipoEquipo', 'TipoEquipo');
    llenarSelect('piso', 'Piso');
    llenarSelect('switchRed', 'Site');
    llenarSelect('tipoIP', 'TipoIP');
}

async function eliminarRegistro(item) {
    const confirmacion = await fireSwal({
        icon: 'warning',
        title: '¿Eliminar registro de IP?',
        text: `Se eliminará ${item.IP || item.Hostname || 'el registro'} del control general.`,
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!confirmacion.isConfirmed) return;
    try {
        const result = await window.api.inventarioIP.eliminar(item.IdInventarioIP);
        if (!result?.ok) return mostrarError(result?.mensaje);
        await cargar();
        mostrarToast(result.mensaje);
    } catch (error) {
        mostrarError(error.message);
    }
}

async function editarDatosCliente(item) {
    const opciones = tipo => opcionesCatalogo(tipo)
        .map(catalogo => `<option value="${catalogo.IdCatalogoIP}">${escaparHTML(catalogo.Nombre)}</option>`)
        .join('');
    const resultado = await fireSwal({
        title: `Datos complementarios: ${escaparHTML(item.Hostname || item.IP)}`,
        html: `
            <div class="edicion-cliente-grid">
                <label>MAC<input id="cliente-mac" maxlength="17" value="${escaparHTML(item.MAC)}" placeholder="00:11:22:33:44:55"></label>
                <label>Dispositivo<select id="cliente-dispositivo"><option value="">Sin asignar</option>${opciones('Dispositivo')}</select></label>
                <label>Tipo<select id="cliente-tipo"><option value="">Sin asignar</option>${opciones('TipoEquipo')}</select></label>
                <label>Switch<select id="cliente-site"><option value="">Sin asignar</option>${opciones('Site')}</select></label>
                <label>Puerto Fortinet<input id="cliente-puerto" maxlength="100" value="${escaparHTML(item.PuertoFortinet)}"></label>
                <label class="wide">Descripción<input id="cliente-descripcion" maxlength="500" value="${escaparHTML(item.Descripcion)}"></label>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar datos',
        cancelButtonText: 'Cancelar',
        didOpen: popup => {
            popup.querySelector('#cliente-dispositivo').value = String(item.IdDispositivo || '');
            popup.querySelector('#cliente-tipo').value = String(item.IdTipoEquipo || '');
            /* Switch: un desplegable más; vacío = sin switch asignado. */
            const selector = popup.querySelector('#cliente-site');
            const valor = String(item.IdSite || '');
            selector.value = [...selector.options].some(opcion => opcion.value === valor) ? valor : '';
        },
        preConfirm: () => ({
            mac: $('cliente-mac').value.trim(),
            idDispositivo: $('cliente-dispositivo').value || null,
            idTipoEquipo: $('cliente-tipo').value || null,
            idSite: $('cliente-site').value || null,
            puertoFortinet: $('cliente-puerto').value.trim(),
            descripcion: $('cliente-descripcion').value.trim()
        })
    });
    if (!resultado.isConfirmed) return;
    try {
        const guardado = await window.api.inventarioIP.actualizarDatosEquipoCliente(item.IdEquipo, resultado.value);
        if (!guardado?.ok) return mostrarError(guardado?.mensaje);
        await cargar();
        mostrarToast(guardado.mensaje);
    } catch (error) {
        mostrarError(error.message);
    }
}

/* Diálogo de color del tono de los dispositivos que no pertenecen a ningún
   cliente (mismo patrón que Catálogos del Sistema). Devuelve "#RRGGBB", ""
   si el valor no es válido o null si el usuario cancela. */
async function pedirColor({ titulo, etiqueta, colorActual, ayuda }) {
    const resultado = await fireSwal({
        title: titulo,
        html: `
            <div class="color-cliente-form">
                <p class="color-cliente-titulo">${etiqueta}</p>
                <label class="color-cliente-campo">Color
                    <span class="color-picker-field">
                        <input id="color-cliente-input" type="color" value="${escaparHTML(colorActual)}"
                            aria-label="Color hexadecimal">
                        <span id="color-cliente-valor">${escaparHTML(colorActual)}</span>
                    </span>
                </label>
                <p class="color-cliente-ayuda">${ayuda}</p>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar color',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            const input = document.getElementById('color-cliente-input');
            const valor = document.getElementById('color-cliente-valor');
            input?.addEventListener('input', () => {
                if (valor) valor.textContent = normalizarColorHex(input.value);
            });
        },
        preConfirm: () => ({
            color: normalizarColorHex(document.getElementById('color-cliente-input')?.value, '')
        })
    });
    if (!resultado.isConfirmed) return null;
    return resultado.value?.color || '';
}

/* Color de los dispositivos que entran directo por el control general.
   Es el único color que se administra desde esta pantalla: el color de los
   equipos de cada cliente se define en Catálogos del Sistema. */
async function editarColorGeneral() {
    const colorActual = colorGeneral();
    const color = await pedirColor({
        titulo: 'Color de dispositivos sin cliente',
        etiqueta: '<b>Control general</b> Dispositivos sin cliente asignado',
        colorActual,
        ayuda: 'Se aplica a la etiqueta Cliente de los registros que entran directo por '
            + 'el control general. Se guarda en la base de datos, así que es el mismo '
            + 'color en cualquier equipo.'
    });
    if (color === null) return;
    if (!color) return mostrarError('El color seleccionado no es válido.');
    if (color === colorActual) {
        mostrarToast('El color no cambió.');
        return;
    }

    const guardado = await guardarColorGeneral(color);
    renderizarTabla();
    if (!guardado?.ok) return mostrarError(guardado?.mensaje);
    mostrarToast('Color de dispositivos sin cliente actualizado.');
}

function renderizarCatalogos() {
    const contenedor = $('lista-catalogos');
    contenedor.replaceChildren();
    const vacio = $('sin-catalogos');
    vacio.textContent = 'No hay opciones en este catálogo.';
    const items = catalogos.filter(item => item.TipoCatalogo === tipoCatalogo.value);
    $('sin-catalogos').hidden = items.length > 0;
    for (const item of items) {
        const fila = document.createElement('tr');
        const celdaNombre = document.createElement('td');
        celdaNombre.textContent = item.Nombre;
        const celdaEstado = document.createElement('td');
        celdaEstado.className = `catalog-status${item.Activo ? '' : ' inactivo'}`;
        celdaEstado.textContent = item.Activo ? 'Activo' : 'Inactivo';
        const celdaAcciones = document.createElement('td');
        const acciones = document.createElement('div');
        acciones.className = 'catalog-actions';
        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'button secondary';
        editar.dataset.permiso = 'equipos:editar';
        editar.textContent = 'Editar';
        editar.addEventListener('click', () => abrirModalCatalogo(item));
        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'button danger';
        eliminar.dataset.permiso = 'equipos:eliminar';
        eliminar.textContent = 'Eliminar';
        eliminar.addEventListener('click', async () => {
            const confirmacion = await fireSwal({
                icon: 'warning',
                title: '¿Eliminar opción?',
                text: `Se eliminará "${item.Nombre}" del catálogo.`,
                showCancelButton: true,
                confirmButtonText: 'Eliminar',
                cancelButtonText: 'Cancelar'
            });
            if (!confirmacion.isConfirmed) return;
            try {
                const result = await window.api.inventarioIP.eliminarCatalogo(item.IdCatalogoIP);
                if (!result?.ok) return mostrarError(result?.mensaje);
                await cargar();
            } catch (error) {
                mostrarError(error.message);
            }
        });
        acciones.append(editar, eliminar);
        celdaAcciones.append(acciones);
        fila.append(celdaNombre, celdaEstado, celdaAcciones);
        contenedor.append(fila);
    }
    window.PermisosUI?.aplicar(contenedor);
}

function abrirModalCatalogo(item = null) {
    catalogoEditando = item?.IdCatalogoIP || null;
    textoCatalogo.value = item?.Nombre || '';
    $('modal-catalogo-titulo').textContent = item ? 'Editar opción' : 'Agregar opción';
    $('btn-guardar-catalogo').textContent = item ? 'Guardar cambio' : 'Agregar opción';
    $('btn-guardar-catalogo').dataset.permiso = item ? 'equipos:editar' : 'equipos:crear';
    window.PermisosUI?.aplicar($('btn-guardar-catalogo'));
    if (!modalCatalogo.open) modalCatalogo.showModal();
    textoCatalogo.focus();
}

function abrirModalCatalogos() {
    renderizarCatalogos();
    if (!modalCatalogos.open) modalCatalogos.showModal();
}

function editarRegistro(item) {
    idEditando = item.IdInventarioIP;
    ipOriginalRegistro = String(item.IP || '').trim();
    $('ip').value = item.IP || '';
    $('hostname').value = item.Hostname || '';
    $('mac').value = item.MAC || '';
    $('descripcion').value = item.Descripcion || '';
    $('puertoFortinet').value = item.PuertoFortinet || '';
    llenarSelect('estado', 'Estado', item.IdEstado);
    llenarSelect('dispositivo', 'Dispositivo', item.IdDispositivo);
    llenarSelect('tipoEquipo', 'TipoEquipo', item.IdTipoEquipo);
    llenarSelect('piso', 'Piso', item.IdPiso);
    llenarSelect('switchRed', 'Site', item.IdSite);
    llenarSelect('tipoIP', 'TipoIP', item.IdTipoIP);
    $('modal-ip-titulo').textContent = 'Editar registro general';
    $('btn-guardar').textContent = 'Guardar cambios';
    $('btn-guardar').dataset.permiso = 'equipos:editar';
    window.PermisosUI?.aplicar($('btn-guardar'));
    if (!modalIP.open) modalIP.showModal();
    actualizarHintRangoIP();
    $('ip').focus();
}

function limpiarFormulario() {
    formIP.reset();
    idEditando = null;
    ipOriginalRegistro = '';
    $('modal-ip-titulo').textContent = 'Registrar IP';
    $('btn-guardar').textContent = 'Registrar IP';
    $('btn-guardar').dataset.permiso = 'equipos:crear';
    actualizarFormularioCatalogos();
    window.PermisosUI?.aplicar($('btn-guardar'));
    limpiarHintRangoIP();
    if (modalIP.open) modalIP.close();
}

/* Una IP libre no existe en la base de datos: al asignarla se abre el
   formulario de registro con la dirección ya capturada. */
function abrirRegistroLibre(fila) {
    limpiarFormulario();
    $('ip').value = fila.IP || '';
    if (!modalIP.open) modalIP.showModal();
    actualizarHintRangoIP();
    $('hostname').focus();
}

/* =========================================================
   AVISO DE RANGO DE CLIENTE EN EL FORMULARIO
   ========================================================= */

function limpiarHintRangoIP() {
    const hint = $('hint-rango-ip');
    if (!hint) return;
    hint.textContent = '';
    hint.className = 'ayuda-rango oculto';
}

function actualizarHintRangoIP() {
    const hint = $('hint-rango-ip');
    if (!hint) return;
    const ip = $('ip').value.trim();

    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || !rangosCliente.length) {
        limpiarHintRangoIP();
        return;
    }

    const rango = rangoDeIP(ip);

    if (!rango) {
        hint.textContent = 'IP fuera de los rangos declarados por los clientes: disponible para el control general.';
        hint.className = 'ayuda-rango ok';
        return;
    }

    if (ipOriginalRegistro && ipOriginalRegistro === ip) {
        hint.textContent = `Esta IP pertenece a ${etiquetaRangoCliente(rango)} y es la que ya tiene el registro. Se conserva mientras no la cambies.`;
        hint.className = 'ayuda-rango neutra';
        return;
    }

    hint.textContent = `Reservada para ${etiquetaRangoCliente(rango)}. Un dispositivo general no puede usar esta IP.`;
    hint.className = 'ayuda-rango alerta';
}

let debounceHintRango = null;
function programarHintRangoIP() {
    const token = ++tokenHintRango;
    clearTimeout(debounceHintRango);
    debounceHintRango = setTimeout(() => {
        if (token !== tokenHintRango) return;
        actualizarHintRangoIP();
    }, 180);
}

/* Aviso explícito cuando la base de datos rechaza la IP por estar reservada. */
async function mostrarAvisoRangoCliente(detalle, ip) {
    const rango = detalle?.rango || null;
    await fireSwal({
        icon: 'warning',
        title: 'IP reservada a un cliente',
        html: `<div style="text-align:left;font-size:.9rem;">
            ${escaparHTML(detalle?.mensaje || 'La IP pertenece a un rango declarado por un cliente.')}<br><br>
            <div style="background:#FFF7E8;padding:10px;border-radius:6px;border-left:3px solid #A99A63;">
                <b>IP capturada:</b> ${escaparHTML(ip || '')}<br>
                <b>Cliente:</b> ${escaparHTML(rango?.ClienteCodigo || '—')}<br>
                <b>Perfil:</b> ${escaparHTML(rango?.RolNombre || 'Cualquier perfil')}<br>
                <b>Rango reservado:</b> ${escaparHTML(rango ? `${rango.IPInicio} – ${rango.IPFin}` : '—')}
            </div>
            <p style="margin-top:10px;color:#7a7563;">
                Los rangos se administran en <b>Equipos → Rangos IP</b>. Usa una IP libre
                fuera de los rangos de clientes.
            </p></div>`,
        confirmButtonText: 'Entendido',
        buttonsStyling: false,
        customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
    });
}

function limpiarFormularioCatalogo() {
    formCatalogo.reset();
    catalogoEditando = null;
    $('modal-catalogo-titulo').textContent = 'Agregar opción';
    $('btn-guardar-catalogo').textContent = 'Agregar opción';
    $('btn-guardar-catalogo').dataset.permiso = 'equipos:crear';
    window.PermisosUI?.aplicar($('btn-guardar-catalogo'));
    if (modalCatalogo.open) modalCatalogo.close();
}

/* =========================================================
   EXPORTACIÓN A EXCEL
   ========================================================= */

async function exportarExcel() {
    const segmentos = calcularSegmentos(filas)
        .map(item => item.segmento)
        .filter(segmento => segmento !== 'Sin IP');
    if (!segmentos.length) {
        return mostrarError('Todavía no hay segmentos con IP registradas para exportar.');
    }

    const resultado = await fireSwal({
        title: 'Exportar a Excel',
        html: `
            <div class="exportar-form">
                <label>Segmento
                    <select id="exportar-segmento">
                        <option value="">Todos los segmentos</option>
                        ${segmentos.map(segmento => `<option value="${escaparHTML(segmento)}">${escaparHTML(etiquetaSegmento(segmento))}</option>`).join('')}
                    </select>
                </label>
                <p class="exportar-ayuda">
                    El archivo incluye las IP ocupadas, reservadas y libres del segmento elegido.
                    Los encabezados llevan filtro para localizar cualquier dato en un clic.
                </p>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Exportar',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            /* Si hay un segmento seleccionado en pantalla, se propone ese. */
            const selector = document.getElementById('exportar-segmento');
            if (selector && segmentoActual && segmentos.includes(segmentoActual)) {
                selector.value = segmentoActual;
            }
        },
        preConfirm: () => ({ segmento: document.getElementById('exportar-segmento')?.value || null })
    });
    if (!resultado.isConfirmed) return;
    try {
        const exportado = await window.api.inventarioIP.exportarExcel(resultado.value || {});
        if (exportado?.cancelado) return;
        if (!exportado?.ok) return mostrarError(exportado?.mensaje);
        fireSwal({
            icon: 'success',
            title: 'Exportación lista',
            html: `El archivo se guardó en:<br><small>${escaparHTML(exportado.ruta || '')}</small>`
        });
    } catch (error) {
        mostrarError(error.message);
    }
}

/* =========================================================
   IMPORTACIÓN INTELIGENTE DE EXCEL
   El análisis y el mapeo de columnas los hace el proceso principal
   (main) porque ahí vive SheetJS. Aquí sólo se muestra el resumen y
   se confirma la escritura. La lectura es multi-hoja y reconoce las
   columnas por su encabezado, sin importar el orden.
   ========================================================= */

function construirResumenImportacion(resultado, hayFaltantes) {
    const { resumen, hojas } = resultado;
    const bloqueHojas = (hojas || []).map(hoja => hoja.omitida
        ? `<li><b>${escaparHTML(hoja.hoja)}</b>: omitida (${escaparHTML(hoja.motivo || 'sin encabezados')})</li>`
        : `<li><b>${escaparHTML(hoja.hoja)}</b>: ${hoja.filas} fila(s) · columnas: ${escaparHTML((hoja.columnas || []).join(', '))}</li>`
    ).join('');

    const faltantes = (resumen.faltantesCatalogo || []).slice(0, 20).map(item =>
        `<li><b>${escaparHTML(item.tipo)}</b>: ${escaparHTML(item.valor)} <small>(${item.filas} fila/s)</small></li>`
    ).join('');

    const ejemplos = (resumen.ejemplosErrores || []).slice(0, 15).map(texto =>
        `<li>${escaparHTML(texto)}</li>`
    ).join('');

    /* Avisos: no impiden importar, pero el usuario debe verlos
       (MAC repetida, IP en rango de un cliente, cliente desconocido...). */
    const avisos = (resumen.avisos || []).slice(0, 15).map(texto =>
        `<li>${escaparHTML(texto)}</li>`
    ).join('');

    return `
        <div class="importar-resumen">
            <p class="importar-totales">
                <span><b>${resumen.total}</b> fila(s)</span>
                <span class="ok"><b>${resumen.listos}</b> listas</span>
                <span class="alerta"><b>${resumen.conErrores}</b> con problemas</span>
                ${resumen.requierenCatalogo ? `<span class="alerta"><b>${resumen.requierenCatalogo}</b> requieren catálogo</span>` : ''}
                ${resumen.duplicados ? `<span class="alerta"><b>${resumen.duplicados}</b> duplicado(s)</span>` : ''}
                ${resumen.omitidas ? `<span class="importar-omitidas">${resumen.omitidas} fila(s) del segmento omitida(s)</span>` : ''}
            </p>
            <details open>
                <summary>Hojas y columnas detectadas</summary>
                <ul>${bloqueHojas || '<li>Sin hojas procesadas.</li>'}</ul>
            </details>
            ${faltantes ? `
            <details open>
                <summary>Catálogos que faltan crear</summary>
                <ul>${faltantes}</ul>
            </details>` : ''}
            ${ejemplos ? `
            <details>
                <summary>Ejemplos de filas con problemas</summary>
                <ul>${ejemplos}</ul>
            </details>` : ''}
            ${avisos ? `
            <details class="importar-avisos" open>
                <summary>Avisos a revisar</summary>
                <ul>${avisos}</ul>
            </details>` : ''}
            ${hayFaltantes ? `
            <label class="importar-check">
                <input type="checkbox" id="importar-crear-catalogos" checked>
                Crear automáticamente los catálogos que falten
            </label>` : ''}
            <p class="importar-nota">
                Las filas con errores (IP/MAC inválidas, duplicados o datos incompletos) se omiten.
                La columna Cliente se conserva como referencia, pero los registros entran al control general.
            </p>
        </div>`;
}

async function importarExcel() {
    const resultado = await window.api.inventarioIP.importarExcel();
    if (resultado?.cancelado) return;
    if (!resultado?.ok) return mostrarError(resultado?.mensaje);
    if (!resultado.resumen || !resultado.resumen.total) {
        return mostrarError('El archivo no contiene filas reconocibles. Verifica que tenga encabezados como IP, Hostname, MAC, Cliente, Piso, Switch, etc.');
    }

    const hayFaltantes = Array.isArray(resultado.resumen.faltantesCatalogo) && resultado.resumen.faltantesCatalogo.length > 0;
    const revision = await fireSwal({
        title: 'Revisión de importación',
        html: construirResumenImportacion(resultado, hayFaltantes),
        width: 780,
        showCancelButton: true,
        confirmButtonText: 'Importar registros',
        cancelButtonText: 'Cancelar',
        preConfirm: () => ({
            crearCatalogos: hayFaltantes
                ? Boolean(document.getElementById('importar-crear-catalogos')?.checked)
                : false
        })
    });
    if (!revision.isConfirmed) return;

    const aplicado = await window.api.inventarioIP.aplicarImportacion(resultado.registros, revision.value || {});
    if (!aplicado?.ok) return mostrarError(aplicado?.mensaje);
    await cargar();

    const detalle = [`<b>${aplicado.insertados || 0}</b> registro(s) importado(s).`];
    if (aplicado.omitidos) detalle.push(`${aplicado.omitidos} omitido(s).`);
    if (aplicado.catalogosCreados) detalle.push(`${aplicado.catalogosCreados} catálogo(s) creado(s).`);
    if (Array.isArray(aplicado.errores) && aplicado.errores.length) {
        detalle.push(`<br><small>${aplicado.errores.slice(0, 10).map(escaparHTML).join('<br>')}</small>`);
    }
    fireSwal({ icon: 'success', title: 'Importación completada', html: detalle.join(' ') });
}

/* =========================================================
   CARGA
   ========================================================= */

/* Carga los clientes del catálogo (incluye a los que aún no tienen
   equipos) para poder ajustar su color desde esta pantalla. */
async function cargarClientesCatalogo() {
    try {
        const lista = await window.api?.clientes?.listar?.();
        clientesCatalogo = Array.isArray(lista) ? lista : [];
    } catch (error) {
        clientesCatalogo = [];
        console.warn('No se pudieron cargar los clientes:', error?.message || error);
    }
}

async function cargar() {
    const [listaCatalogos, listaRegistros] = await Promise.all([
        window.api.inventarioIP.listarCatalogos(),
        window.api.inventarioIP.listar(),
        cargarClientesCatalogo(),
        cargarColorGeneral()
    ]);
    if (!Array.isArray(listaCatalogos)) throw new Error(listaCatalogos?.mensaje || 'No se pudieron cargar los catálogos.');
    if (!Array.isArray(listaRegistros)) throw new Error(listaRegistros?.mensaje || 'No se pudieron cargar las IP.');
    catalogos = listaCatalogos;
    registros = listaRegistros;
    /* Misma norma que Equipos: las IP que un cliente declaró en sus rangos
       quedan reservadas también para el control general. */
    await cargarRangosCliente();
    /* La tabla también muestra las IP libres del segmento, que no viven
       en la base de datos: se calculan aquí. */
    filas = construirFilas(registros);
    /* Refresca los colores de cliente definidos en Catálogos del Sistema
       para que un alta o cambio de ColorHex se vea al recargar la tabla. */
    await window.PermisosUI?.refrescarColores?.();
    actualizarFormularioCatalogos();
    renderizarSegmentos();
    renderizarTabla();
    renderizarCatalogos();
}

formIP.addEventListener('submit', async event => {
    event.preventDefault();
    const datos = {
        ip: $('ip').value.trim(),
        tipoIP: catalogoPorId($('tipoIP').value)?.Nombre,
        hostname: $('hostname').value.trim(),
        mac: $('mac').value.trim(),
        descripcion: $('descripcion').value.trim(),
        puertoFortinet: $('puertoFortinet').value.trim(),
        idEstado: $('estado').value,
        idDispositivo: $('dispositivo').value,
        idTipoEquipo: $('tipoEquipo').value,
        idPiso: $('piso').value,
        idSite: $('switchRed').value,
        idTipoIP: $('tipoIP').value
    };
    /* Validación estricta de IP y MAC antes de tocar la base de datos. */
    if (datos.ip && !validarIPv4(datos.ip)) {
        return mostrarError('La IP no es válida. Usa cuatro números separados por puntos, por ejemplo 192.168.0.10.');
    }
    if (datos.mac) {
        const macNormalizada = normalizarMAC(datos.mac);
        if (macNormalizada === null) {
            return mostrarError('La MAC debe tener 12 dígitos hexadecimales en formato 00:11:22:33:44:55.');
        }
        datos.mac = macNormalizada;
    }

    const button = $('btn-guardar');
    button.disabled = true;
    try {
        const result = idEditando
            ? await window.api.inventarioIP.actualizar(idEditando, datos)
            : await window.api.inventarioIP.crear(datos);
        if (!result?.ok) {
            /* La IP cae dentro de un rango declarado por un cliente:
               se avisa con el detalle en lugar de un error genérico. */
            if (result?.tipo === 'ip-en-rango-cliente') {
                return await mostrarAvisoRangoCliente(result.detalle, datos.ip);
            }
            return mostrarError(result?.mensaje);
        }
        limpiarFormulario();
        await cargar();
        mostrarToast(result.mensaje);
    } catch (error) {
        mostrarError(error.message);
    } finally {
        button.disabled = false;
    }
});

formCatalogo.addEventListener('submit', async event => {
    event.preventDefault();
    if (!textoCatalogo.value.trim()) return mostrarError('Escribe el nombre de la opción.');
    try {
        const result = catalogoEditando
            ? await window.api.inventarioIP.actualizarCatalogo(catalogoEditando, tipoCatalogo.value, textoCatalogo.value.trim())
            : await window.api.inventarioIP.crearCatalogo(tipoCatalogo.value, textoCatalogo.value.trim());
        if (!result?.ok) return mostrarError(result?.mensaje);
        limpiarFormularioCatalogo();
        await cargar();
    } catch (error) {
        mostrarError(error.message);
    }
});

$('btn-nuevo-registro').addEventListener('click', () => {
    limpiarFormulario();
    if (!modalIP.open) modalIP.showModal();
    $('ip').focus();
});
$('btn-cerrar-ip').addEventListener('click', limpiarFormulario);
$('btn-cancelar-edicion').addEventListener('click', limpiarFormulario);
$('btn-catalogos').addEventListener('click', abrirModalCatalogos);
$('btn-cerrar-catalogos').addEventListener('click', () => {
    if (modalCatalogos.open) modalCatalogos.close();
});
$('btn-nueva-opcion').addEventListener('click', () => abrirModalCatalogo());
$('btn-cerrar-catalogo').addEventListener('click', limpiarFormularioCatalogo);
$('btn-cancelar-catalogo').addEventListener('click', limpiarFormularioCatalogo);
$('btn-exportar').addEventListener('click', () => exportarExcel().catch(error => mostrarError(error.message)));
$('btn-color-general').addEventListener('click', () => editarColorGeneral().catch(error => mostrarError(error.message)));
$('btn-importar').addEventListener('click', () => importarExcel().catch(error => mostrarError(error.message)));

/* La MAC se captura siempre con dos puntos y 12 dígitos hexadecimales
   (17 caracteres con separadores); se forma sola mientras se escribe. */
$('mac').addEventListener('input', event => {
    const formateada = formatearEntradaMAC(event.target.value);
    if (formateada !== event.target.value) event.target.value = formateada;
});

/* La IP sólo admite dígitos y puntos mientras se escribe. */
$('ip').addEventListener('input', event => {
    const limpia = String(event.target.value || '').replace(/[^\d.]/g, '');
    if (limpia !== event.target.value) event.target.value = limpia;
});


$('busqueda').addEventListener('input', () => {
    paginaActual = 1;
    renderizarTabla();
});

/* Aviso en línea: mientras se captura la IP, indica si está reservada
   a un cliente o si queda libre para el control general. */
$('ip').addEventListener('input', programarHintRangoIP);

$('tamano-pagina').addEventListener('change', () => {
    tamanoPagina = Number($('tamano-pagina').value) || 25;
    paginaActual = 1;
    renderizarTabla();
});
$('pagina-anterior').addEventListener('click', () => {
    paginaActual = Math.max(1, paginaActual - 1);
    renderizarTabla();
});
$('pagina-siguiente').addEventListener('click', () => {
    paginaActual++;
    renderizarTabla();
});
tipoCatalogo.addEventListener('change', renderizarCatalogos);
$('btn-volver').addEventListener('click', () => window.api.navegarModulo('equipos'));

(async () => {
    await window.PermisosUI?.init();
    try {
        await cargar();
    } catch (error) {
        mostrarError(error.message);
    }
})();
