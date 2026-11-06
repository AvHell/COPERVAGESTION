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
const filtrosColumna = {};

const HOST_INICIAL = 1;
const HOST_FINAL = 254;

const CAMPOS_TEXTO = new Set(['IP', 'Hostname', 'MAC', 'PuertoFortinet', 'Descripcion']);
const CAMPOS_BUSQUEDA = [
    'Origen', 'IP', 'Hostname', 'MAC', 'Descripcion', 'PuertoFortinet', 'Estado', 'Dispositivo',
    'TipoEquipo', 'Piso', 'ClienteCodigo', 'ClienteNombre', 'Site'
];

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
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

/* Badge de cliente: usa el color configurado en Catálogos del Sistema
   (Clientes.ColorHex) y cae al color por código de la hoja de estilos. */
function badgeCliente(registro) {
    const codigo = String(registro?.ClienteCodigo || '').trim().toUpperCase();
    if (!codigo) return badge('', 'cliente');
    const color = window.PermisosUI?.colorCliente?.(codigo) || '';
    const estilo = /^#[0-9A-F]{6}$/i.test(color)
        ? ` style="background-color:${color} !important;border-color:${color} !important;color:${contraste(color)} !important"`
        : '';
    const nombre = String(registro?.ClienteNombre || '').trim();
    return `<span class="ip-badge cliente badge-cliente" data-color="${escaparHTML(codigo)}"${estilo}>`
        + `<span class="codigo">${escaparHTML(codigo)}</span>`
        + (nombre ? `<span class="nombre">${escaparHTML(nombre)}</span>` : '')
        + '</span>';
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
        resultado.push({ ...registro, Estado: estadoVisible(registro.Estado), Libre: false });
    }

    for (const segmento of [...segmentos].sort(compararSegmentos)) {
        for (let host = HOST_INICIAL; host <= HOST_FINAL; host += 1) {
            const ip = `${segmento}.${host}`;
            if (ocupadas.has(ip)) continue;
            resultado.push({
                Origen: '', IP: ip, Estado: 'Libre', Libre: true,
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
            mapa.set(segmento, { segmento, total: 0, ocupadas: 0, libres: 0, ips: new Set() });
        }
        const item = mapa.get(segmento);
        if (item.ips.has(fila.IP)) continue;
        item.ips.add(fila.IP);
        item.total += 1;
        if (fila.Libre) item.libres += 1;
        else item.ocupadas += 1;
    }
    return [...mapa.values()]
        .map(({ ips, ...datos }) => datos)
        .sort((a, b) => compararSegmentos(a.segmento, b.segmento));
}

function detalleSegmento(datos) {
    if (!datos?.total) return 'Este segmento no tiene direcciones registradas.';
    if (datos.segmento === 'Sin IP') return `${datos.total} registros sin IP`;
    return `${datos.total} IP · ${datos.ocupadas} ocupadas · ${datos.libres} libres`;
}

function crearItemSegmento(datos, esTodos = false) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'segmento-item';
    const seleccionado = esTodos ? !segmentoActual : segmentoActual === datos.segmento;
    boton.classList.toggle('activo', seleccionado);
    const ocupado = datos.ocupadas > 0;
    boton.innerHTML = `
        <span class="segmento-cabecera">
            <span class="segmento-nombre">${escaparHTML(esTodos ? 'Todos los segmentos' : etiquetaSegmento(datos.segmento))}</span>
            <span class="segmento-pill ${ocupado ? 'ocupado' : 'libre'}">${ocupado ? 'Ocupado' : 'Libre'}</span>
        </span>
        <span class="segmento-meta">${escaparHTML(esTodos ? detalleTotales(datos) : detalleSegmento(datos))}</span>`;
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
        libres: acumulado.libres + item.libres
    }), { segmento: '', total: 0, ocupadas: 0, libres: 0 });
}

function detalleTotales(datos) {
    if (!datos.total) return 'Sin direcciones registradas.';
    return `${datos.total} IP · ${datos.ocupadas} ocupadas · ${datos.libres} libres`;
}

function renderizarSegmentos() {
    const lista = $('lista-segmentos');
    if (!lista) return;
    lista.replaceChildren();
    const segmentos = calcularSegmentos(filas);

    lista.append(crearItemSegmento(sumarSegmentos(segmentos), true));
    segmentos.forEach(item => lista.append(crearItemSegmento(item)));

    const resumen = $('segmentos-resumen');
    if (resumen) {
        resumen.textContent = `${segmentos.length} ${segmentos.length === 1 ? 'segmento' : 'segmentos'}`;
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
    $('segmento-estado').innerHTML = `<span class="segmento-pill ${ocupado ? 'ocupado' : 'libre'}">${ocupado ? 'Ocupado' : 'Libre'}</span>`;
}

/* =========================================================
   FILTROS POR COLUMNA
   ========================================================= */

function valoresUnicos(campo) {
    const valores = new Set();
    for (const fila of filas) {
        if (campo === 'ClienteCodigo') {
            if (fila.ClienteCodigo) valores.add(String(fila.ClienteCodigo));
        } else if (fila[campo]) valores.add(String(fila[campo]));
    }
    return [...valores].sort((a, b) => a.localeCompare(b, 'es'));
}

function poblarFiltros() {
    document.querySelectorAll('[data-filtro]').forEach(control => {
        const campo = control.dataset.filtro;
        if (!(control instanceof HTMLSelectElement)) return;
        const valorActual = filtrosColumna[campo] || control.value || '';
        const valores = valoresUnicos(campo);
        control.replaceChildren(new Option('Todos', ''));
        for (const valor of valores) {
            const etiqueta = campo === 'ClienteCodigo'
                ? `${valor} — ${filas.find(fila => String(fila.ClienteCodigo) === valor)?.ClienteNombre || ''}`.trim()
                : valor;
            control.add(new Option(etiqueta, valor));
        }
        control.value = valores.includes(valorActual) ? valorActual : '';
        filtrosColumna[campo] = control.value;
    });
}

function coincideFiltro(registro, campo, valor) {
    const texto = String(valor || '').toLowerCase();
    if (!texto) return true;
    if (campo === 'ClienteCodigo') return String(registro.ClienteCodigo || '').toLowerCase() === texto;
    const dato = String(registro[campo] ?? '').toLowerCase();
    return CAMPOS_TEXTO.has(campo) ? dato.includes(texto) : dato === texto;
}

function registrosFiltrados() {
    const termino = $('busqueda').value.trim().toLowerCase();
    return filas.filter(registro => {
        if (segmentoActual && segmentoDe(registro.IP) !== segmentoActual) return false;
        if (termino && !CAMPOS_BUSQUEDA.some(campo =>
            String(registro[campo] || '').toLowerCase().includes(termino)
        )) return false;
        return Object.entries(filtrosColumna).every(([campo, valor]) => coincideFiltro(registro, campo, valor));
    });
}

function limpiarFiltros() {
    $('busqueda').value = '';
    Object.keys(filtrosColumna).forEach(campo => { filtrosColumna[campo] = ''; });
    document.querySelectorAll('[data-filtro]').forEach(control => { control.value = ''; });
    paginaActual = 1;
    renderizarTabla();
}

/* =========================================================
   TABLA
   ========================================================= */

function crearSwitchSite(item) {
    const esCliente = item.Origen === 'Cliente';
    const asignado = Boolean(Number(item.IdSite));
    const etiqueta = document.createElement('label');
    etiqueta.className = 'switch-site';
    etiqueta.title = esCliente
        ? (asignado ? `Switch asignado: ${item.Site || ''}` : 'Sin switch asignado')
        : 'El switch del inventario general se edita en el formulario del registro.';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'switch-input';
    input.checked = asignado;
    input.disabled = !esCliente;
    if (esCliente) input.dataset.permiso = 'equipos:editar';

    const pista = document.createElement('span');
    pista.className = 'switch-track';
    const pulgar = document.createElement('span');
    pulgar.className = 'switch-thumb';
    pista.append(pulgar);

    const texto = document.createElement('span');
    texto.className = 'switch-texto';
    texto.textContent = asignado ? (item.Site || 'Switch') : 'Sin switch';

    input.addEventListener('change', () => alternarSwitch(item, input.checked, input));
    etiqueta.append(input, pista, texto);
    return etiqueta;
}

async function alternarSwitch(item, asignar, input) {
    const opcionSwitch = opcionesCatalogo('Site')[0];
    if (asignar && !opcionSwitch) {
        input.checked = false;
        return mostrarError('No hay un Switch activo en catálogos.');
    }
    input.disabled = true;
    try {
        const resultado = await window.api.inventarioIP.actualizarDatosEquipoCliente(item.IdEquipo, {
            mac: item.MAC || '',
            idDispositivo: item.IdDispositivo || null,
            idTipoEquipo: item.IdTipoEquipo || null,
            idSite: asignar ? opcionSwitch.IdCatalogoIP : null,
            puertoFortinet: item.PuertoFortinet || '',
            descripcion: item.Descripcion || ''
        });
        if (!resultado?.ok) throw new Error(resultado?.mensaje || 'No se pudo actualizar el switch.');
        mostrarToast(asignar ? 'Switch asignado.' : 'Switch retirado.');
        await cargar();
    } catch (error) {
        input.checked = !asignar;
        mostrarError(error.message);
    } finally {
        input.disabled = false;
    }
}

function renderizarTabla() {
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
        if (item.Libre) fila.classList.add('fila-libre');
        fila.innerHTML = `
            <td>${badge(item.Origen, item.Origen === 'Cliente' ? 'origen-cliente' : 'origen-general')}</td>
            <td>${badge(item.Estado, item.Estado === 'Ocupado' ? 'estado-ocupado' : 'estado-libre')}</td>
            <td>${badge(item.IP || 'DHCP', 'ip')}</td>
            <td>${badge(item.Hostname, 'hostname')}</td>
            <td>${badge(item.MAC, 'dato')}</td>
            <td>${badge(item.Dispositivo, 'dato')}</td>
            <td>${badge(item.TipoEquipo, 'dato')}</td>
            <td>${badge(item.Piso, 'dato')}</td>
            <td>${badgeCliente(item)}</td>`;
        const celdaSwitch = document.createElement('td');
        celdaSwitch.className = 'switch-celda';
        celdaSwitch.append(crearSwitchSite(item));
        fila.append(celdaSwitch);
        fila.insertAdjacentHTML('beforeend', `
            <td>${badge(item.PuertoFortinet, 'dato')}</td>
            <td class="descripcion-celda">${badge(item.Descripcion, 'dato')}</td>`);

        const acciones = document.createElement('td');
        acciones.className = 'actions';
        if (item.Libre) {
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
    const sitios = opcionesCatalogo('Site');
    const resultado = await fireSwal({
        title: `Datos complementarios: ${escaparHTML(item.Hostname || item.IP)}`,
        html: `
            <div class="edicion-cliente-grid">
                <label>MAC<input id="cliente-mac" maxlength="17" value="${escaparHTML(item.MAC)}" placeholder="00:11:22:33:44:55"></label>
                <label>Dispositivo<select id="cliente-dispositivo"><option value="">Sin asignar</option>${opciones('Dispositivo')}</select></label>
                <label>Tipo<select id="cliente-tipo"><option value="">Sin asignar</option>${opciones('TipoEquipo')}</select></label>
                <div class="edicion-site wide">
                    <span class="edicion-site-etiqueta">Switch</span>
                    <label class="switch-site">
                        <input id="cliente-site-on" type="checkbox" class="switch-input">
                        <span class="switch-track"><span class="switch-thumb"></span></span>
                        <span class="switch-texto" id="cliente-site-texto">Sin switch</span>
                    </label>
                    ${sitios.length > 1
                        ? `<select id="cliente-site" class="edicion-site-select"><option value="">Sin asignar</option>${opciones('Site')}</select>`
                        : ''}
                </div>
                <label>Puerto Fortinet<input id="cliente-puerto" maxlength="100" value="${escaparHTML(item.PuertoFortinet)}"></label>
                <label class="wide">Descripción<input id="cliente-descripcion" maxlength="500" value="${escaparHTML(item.Descripcion)}"></label>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar datos',
        cancelButtonText: 'Cancelar',
        didOpen: popup => {
            popup.querySelector('#cliente-dispositivo').value = String(item.IdDispositivo || '');
            popup.querySelector('#cliente-tipo').value = String(item.IdTipoEquipo || '');
            /* Switch: encendido = asignado. */
            const interruptor = popup.querySelector('#cliente-site-on');
            const selector = popup.querySelector('#cliente-site');
            const texto = popup.querySelector('#cliente-site-texto');
            const sincronizar = asignado => {
                interruptor.checked = Boolean(asignado);
                if (selector) {
                    selector.hidden = !interruptor.checked;
                    if (interruptor.checked && !selector.value) {
                        selector.value = String(sitios[0]?.IdCatalogoIP || '');
                    }
                }
                const valor = interruptor.checked
                    ? (selector?.value || String(sitios[0]?.IdCatalogoIP || ''))
                    : '';
                const sitio = sitios.find(opcion => String(opcion.IdCatalogoIP) === String(valor));
                texto.textContent = interruptor.checked ? (sitio?.Nombre || 'Switch activo') : 'Sin switch';
            };
            interruptor.addEventListener('change', () => sincronizar(interruptor.checked));
            if (selector) {
                selector.value = String(item.IdSite || '');
                selector.addEventListener('change', () => sincronizar(true));
            }
            sincronizar(Boolean(Number(item.IdSite)));
        },
        preConfirm: () => {
            const asignado = $('cliente-site-on').checked;
            const sitioElegido = $('cliente-site')?.value || String(sitios[0]?.IdCatalogoIP || '');
            return {
                mac: $('cliente-mac').value.trim(),
                idDispositivo: $('cliente-dispositivo').value || null,
                idTipoEquipo: $('cliente-tipo').value || null,
                idSite: asignado ? (sitioElegido || null) : null,
                puertoFortinet: $('cliente-puerto').value.trim(),
                descripcion: $('cliente-descripcion').value.trim()
            };
        }
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

function renderizarCatalogos() {
    const contenedor = $('lista-catalogos');
    contenedor.replaceChildren();
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
    $('ip').focus();
}

function limpiarFormulario() {
    formIP.reset();
    idEditando = null;
    $('modal-ip-titulo').textContent = 'Registrar IP';
    $('btn-guardar').textContent = 'Registrar IP';
    $('btn-guardar').dataset.permiso = 'equipos:crear';
    actualizarFormularioCatalogos();
    window.PermisosUI?.aplicar($('btn-guardar'));
    if (modalIP.open) modalIP.close();
}

/* Una IP libre no existe en la base de datos: al asignarla se abre el
   formulario de registro con la dirección ya capturada. */
function abrirRegistroLibre(fila) {
    limpiarFormulario();
    $('ip').value = fila.IP || '';
    if (!modalIP.open) modalIP.showModal();
    $('hostname').focus();
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
    const segmentos = calcularSegmentos(filas).map(item => item.segmento).filter(segmento => segmento !== 'Sin IP');
    const clientes = [...new Map(
        registros.filter(registro => registro.ClienteCodigo)
            .map(registro => [String(registro.ClienteCodigo), registro])
    ).values()];

    const resultado = await fireSwal({
        title: 'Exportar a Excel',
        html: `
            <div class="exportar-form">
                <label>Alcance
                    <select id="exportar-alcance">
                        <option value="todo">Todo el inventario</option>
                        <option value="cliente">Por cliente</option>
                        <option value="segmento">Por segmento</option>
                    </select>
                </label>
                <label id="exportar-cliente-campo" hidden>Cliente
                    <select id="exportar-cliente">
                        ${clientes.map(registro => `<option value="${escaparHTML(registro.ClienteCodigo)}">${escaparHTML(registro.ClienteCodigo)} — ${escaparHTML(registro.ClienteNombre || '')}</option>`).join('')}
                    </select>
                </label>
                <label id="exportar-segmento-campo" hidden>Segmento
                    <select id="exportar-segmento">
                        ${segmentos.map(segmento => `<option value="${escaparHTML(segmento)}">${escaparHTML(etiquetaSegmento(segmento))}</option>`).join('')}
                    </select>
                </label>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Exportar',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            const alcance = document.getElementById('exportar-alcance');
            const campos = {
                cliente: document.getElementById('exportar-cliente-campo'),
                segmento: document.getElementById('exportar-segmento-campo')
            };
            alcance.addEventListener('change', () => {
                campos.cliente.hidden = alcance.value !== 'cliente';
                campos.segmento.hidden = alcance.value !== 'segmento';
            });
        },
        preConfirm: () => {
            const alcance = document.getElementById('exportar-alcance').value;
            return {
                cliente: alcance === 'cliente' ? document.getElementById('exportar-cliente').value : null,
                segmento: alcance === 'segmento' ? document.getElementById('exportar-segmento').value : null
            };
        }
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
   CARGA
   ========================================================= */

async function cargar() {
    const [listaCatalogos, listaRegistros] = await Promise.all([
        window.api.inventarioIP.listarCatalogos(),
        window.api.inventarioIP.listar()
    ]);
    if (!Array.isArray(listaCatalogos)) throw new Error(listaCatalogos?.mensaje || 'No se pudieron cargar los catálogos.');
    if (!Array.isArray(listaRegistros)) throw new Error(listaRegistros?.mensaje || 'No se pudieron cargar las IP.');
    catalogos = listaCatalogos;
    registros = listaRegistros;
    /* La tabla también muestra las IP libres del segmento, que no viven
       en la base de datos: se calculan aquí. */
    filas = construirFilas(registros);
    /* Refresca los colores de cliente definidos en Catálogos del Sistema
       para que un alta o cambio de ColorHex se vea al recargar la tabla. */
    await window.PermisosUI?.refrescarColores?.();
    actualizarFormularioCatalogos();
    poblarFiltros();
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
    const button = $('btn-guardar');
    button.disabled = true;
    try {
        const result = idEditando
            ? await window.api.inventarioIP.actualizar(idEditando, datos)
            : await window.api.inventarioIP.crear(datos);
        if (!result?.ok) return mostrarError(result?.mensaje);
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
$('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);

$('busqueda').addEventListener('input', () => {
    paginaActual = 1;
    renderizarTabla();
});

let debounceFiltros = null;
document.querySelectorAll('[data-filtro]').forEach(control => {
    const campo = control.dataset.filtro;
    const aplicar = () => {
        filtrosColumna[campo] = control.value || '';
        paginaActual = 1;
        renderizarTabla();
    };
    if (control instanceof HTMLSelectElement) {
        control.addEventListener('change', aplicar);
    } else {
        control.addEventListener('input', () => {
            clearTimeout(debounceFiltros);
            debounceFiltros = setTimeout(aplicar, 220);
        });
    }
});

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
$('btn-recargar').addEventListener('click', () => cargar().catch(error => mostrarError(error.message)));
$('btn-volver').addEventListener('click', () => window.api.navegarModulo('equipos'));

(async () => {
    await window.PermisosUI?.init();
    try {
        await cargar();
    } catch (error) {
        mostrarError(error.message);
    }
})();
