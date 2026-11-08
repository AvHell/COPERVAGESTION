/* =========================================================
   EQUIPOS — Renderer Premium
   Colores estrictos sólidos · Tooltips · Sticky Header
   ========================================================= */

const Swal = window.Swal;

/* =========================================================
   HELPERS
   ========================================================= */

function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
        customClass: { popup: 'cl-toast' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

}

function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false, timer: 3400, timerProgressBar: true,
        customClass: { popup: 'cl-toast' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function limpiarResiduosSwal() {
    document.querySelectorAll('body > .swal2-container').forEach(c => {
        if (!c.querySelector('.swal2-popup') && !c.classList.contains('swal2-backdrop-show')) {
            c.remove();
        }
    });
    document.querySelectorAll('body > [id^="swal2-"]').forEach(el => {
        if (!el.closest('.swal2-popup')) el.remove();
    });
}

let tooltipAccionActivo = null;
let tooltipAccionElemento = null;

function mostrarTooltipAccion(elemento) {
    const texto = elemento.dataset.tooltip;
    if (!texto) return;

    if (!tooltipAccionActivo) {
        tooltipAccionActivo = document.createElement('div');
        tooltipAccionActivo.className = 'tooltip-accion-equipos';
        tooltipAccionActivo.id = 'tooltip-accion-equipos';
        tooltipAccionActivo.setAttribute('role', 'tooltip');
        document.body.append(tooltipAccionActivo);
    }

    tooltipAccionElemento = elemento;
    tooltipAccionActivo.textContent = texto;
    tooltipAccionActivo.style.display = 'block';
    elemento.setAttribute('aria-describedby', tooltipAccionActivo.id);

    const boton = elemento.getBoundingClientRect();
    const tooltip = tooltipAccionActivo.getBoundingClientRect();
    const left = Math.max(8, Math.min(
        boton.left + boton.width / 2 - tooltip.width / 2,
        window.innerWidth - tooltip.width - 8
    ));
    const below = boton.bottom + 8;
    const top = below + tooltip.height <= window.innerHeight - 8
        ? below
        : Math.max(8, boton.top - tooltip.height - 8);

    tooltipAccionActivo.style.left = `${left}px`;
    tooltipAccionActivo.style.top = `${top}px`;
}

function ocultarTooltipAccion() {
    if (tooltipAccionElemento) tooltipAccionElemento.removeAttribute('aria-describedby');
    tooltipAccionElemento = null;
    if (tooltipAccionActivo) tooltipAccionActivo.style.display = 'none';
}

document.addEventListener('pointerover', event => {
    const button = event.target instanceof Element
        ? event.target.closest('.acciones-tabla [data-tooltip]')
        : null;
    if (button && button !== tooltipAccionElemento) mostrarTooltipAccion(button);
});

document.addEventListener('pointerout', event => {
    const button = event.target instanceof Element
        ? event.target.closest('.acciones-tabla [data-tooltip]')
        : null;
    const related = event.relatedTarget instanceof Element
        ? event.relatedTarget.closest('.acciones-tabla [data-tooltip]')
        : null;
    if (button === tooltipAccionElemento && related !== button) ocultarTooltipAccion();
});

document.addEventListener('focusin', event => {
    const button = event.target instanceof Element
        ? event.target.closest('.acciones-tabla [data-tooltip]')
        : null;
    if (button) mostrarTooltipAccion(button);
});

document.addEventListener('focusout', event => {
    const button = event.target instanceof Element
        ? event.target.closest('.acciones-tabla [data-tooltip]')
        : null;
    if (button === tooltipAccionElemento) ocultarTooltipAccion();
});

window.addEventListener('scroll', ocultarTooltipAccion, true);
window.addEventListener('resize', ocultarTooltipAccion);

/* =========================================================
   RENDERIZADORES DE BADGES
   ========================================================= */
function renderBadgeCliente(codigo, nombre = null) {
    const nombreHTML = `<span class="nombre">${escaparHTML(nombre || codigo)}</span>`;
    const codigoHTML = nombre
        ? `<span class="codigo">${escaparHTML(codigo)}</span>`
        : '';
    return `<span class="badge-cliente" data-color="${String(codigo).toUpperCase()}">
                ${nombreHTML}
                ${codigoHTML}
            </span>`;
}

function renderRolPill(codigo, nombre = '') {
    if (!codigo) return `<span class="rol-pill">—</span>`;
    return `<span class="rol-pill" data-color="${String(codigo).toUpperCase()}" title="${escaparHTML(nombre || codigo)}">${escaparHTML(nombre || codigo)}</span>`;
}

// El hostname hereda el color del rol
function renderHostnameBadge(hostname, rolCodigo) {
    return `<span class="hostname-badge" data-color="${String(rolCodigo).toUpperCase()}">${escaparHTML(hostname)}</span>`;
}

function renderTipoBadge(tipo) {
    return `<span class="badge-tipo-ip" data-color="BOTON">${escaparHTML(tipo)}</span>`;
}

function renderIpBadge(ip) {
    if (!ip) return `<span class="badge-ip vacia">${iconoRedSVG()}DHCP</span>`;
    return `<span class="badge-ip" data-color="BOTON">${iconoRedSVG()}${escaparHTML(ip)}</span>`;
}

function renderBadgePiso(nombre) {
    if (!nombre) return `<span style="color:#a8a08a;">—</span>`;
    return `<span class="badge-piso" data-color="BOTON">${escaparHTML(nombre)}</span>`;
}

/* =========================================================
   ESTADO
   ========================================================= */
let equipos = [];
let clientes = [];
let pisos = [];
let roles = [];
let dominios = [];
let filtroBusqueda = '';
/* Códigos de cliente cuyos grupos el usuario dejó abiertos. Se conserva
   entre repintados para que un refresco no vuelva a colapsar las tablas. */
const gruposExpandidos = new Set();
let modoEdicion = false;
let idEditando = null;
let guardando = false;

/* DOM */
const contenedorGrupos = document.getElementById('contenedor-grupos');
const sinResultados    = document.getElementById('sin-resultados');
const mensaje          = document.getElementById('mensaje');
const inputBusqueda    = document.getElementById('input-busqueda');
const btnLimpiarBusq   = document.getElementById('btn-limpiar-busqueda');
const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtro');

const modalEquipo   = document.getElementById('modal-equipo');
const modalTitulo   = document.getElementById('modal-equipo-titulo');

const selectCli     = document.getElementById('cliente');
const selectPiso    = document.getElementById('piso');
const selectRol     = document.getElementById('rol');
const selectTipoIP  = document.getElementById('tipoIP');
const selectMascara = document.getElementById('mascara');
const selectPuerta  = document.getElementById('puertaEnlace');
const selectDNS1    = document.getElementById('dns1');
const selectDNS2    = document.getElementById('dns2');
const selectDominio = document.getElementById('dominio');

const inputHostPreview = document.getElementById('hostnamePreview');
const inputHostLibre   = document.getElementById('hostnameLibre');
const campoHostEst     = document.getElementById('campoHostnameEstatico');
const campoHostDHCP    = document.getElementById('campoHostnameDHCP');
const bloqueEstatico   = document.getElementById('bloqueEstatico');

const chkHostnameManual = document.getElementById('chk-hostname-manual');
const filaCheckbox      = document.getElementById('filaCheckboxHostname');

const inputIP       = document.getElementById('ip');
const inputNumHost  = document.getElementById('numeroHost');
const inputPassword = document.getElementById('passwordAdmin');
const btnIPsDisponibles = document.getElementById('btn-ips-disponibles');

const btnGuardar    = document.getElementById('btn-guardar');
const seccionRed    = document.getElementById('seccion-red');
const btnExportarExcel = document.getElementById('btn-exportar-excel');

/* =========================================================
   UTILIDADES
   ========================================================= */
function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'alert ' + tipo;
    mensaje.classList.remove('oculto');
}
function ocultarMensaje() { mensaje.classList.add('oculto'); }

function setGuardando(v) {
    guardando = v;
    btnGuardar.disabled = v;
    const txt = btnGuardar.querySelector('.btn-text');
    const spin = btnGuardar.querySelector('.btn-spinner');
    if (txt) txt.textContent = v ? 'Guardando...' : 'Guardar';
    if (spin) spin.classList.toggle('oculto', !v);
}

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

/* =========================================================
   CARGA DE CATÁLOGOS BASE
   ========================================================= */

async function cargarClientes() {
    try {
        clientes = await window.api.clientes.listar();
        selectCli.innerHTML = '<option value="">-- Selecciona --</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.IdCliente);
            opt.textContent = c.Nombre ? `${c.Nombre} (${c.Codigo})` : c.Codigo;
            selectCli.appendChild(opt);
        });
    } catch (err) {
        toastError('Error al cargar clientes', err.message);
    }
}

async function cargarRoles() {
    try {
        roles = await window.api.roles.listar();
        selectRol.innerHTML = '<option value="">-- Selecciona --</option>';
        roles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = String(r.IdRolEquipo);
            opt.textContent = r.Nombre ? `${r.Nombre} (${r.Codigo})` : r.Codigo;
            selectRol.appendChild(opt);
        });
    } catch (err) {
        toastError('Error al cargar roles', err.message);
    }
}

/* =========================================================
   PISOS DEL CLIENTE
   ========================================================= */
async function cargarPisosDelCliente(idCliente) {
    if (!idCliente) {
        selectPiso.innerHTML = '<option value="">-- Selecciona un cliente primero --</option>';
        selectPiso.disabled = true;
        return;
    }

    try {
        const todos = await window.api.pisos.listar();
        pisos = todos.filter(p => (p.clientes || []).some(c => Number(c.IdCliente) === Number(idCliente)));

        selectPiso.disabled = false;
        selectPiso.innerHTML = '<option value="">-- Selecciona --</option>';
        pisos.forEach(p => {
            const opt = document.createElement('option');
            opt.value = String(p.IdPiso);
            opt.textContent = p.Nombre;
            selectPiso.appendChild(opt);
        });

        if (pisos.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.disabled = true;
            opt.textContent = 'Este cliente no tiene pisos asignados.';
            selectPiso.appendChild(opt);
        }
    } catch (err) {
        toastError('Error al cargar pisos', err.message);
    }
}

/* =========================================================
   CONFIGURACIONES DEL CLIENTE
   ========================================================= */
async function cargarConfiguracionesDelCliente(idCliente) {
    if (!idCliente) {
        limpiarSelectConMensaje(selectMascara, '-- Selecciona un cliente primero --');
        limpiarSelectConMensaje(selectPuerta,  '-- Selecciona un cliente primero --');
        limpiarSelectConMensaje(selectDNS1,    '-- Selecciona un cliente primero --');
        limpiarSelectConMensaje(selectDNS2,    '-- Selecciona un cliente primero --');
        limpiarSelectConMensaje(selectDominio, '-- Selecciona un cliente primero --');
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

        dominios = doms;

        llenarSelectConfig(selectMascara, mascaras, '-- Máscara --');
        llenarSelectConfig(selectPuerta,  puertas,  '-- Puerta de enlace --');
        llenarSelectConfig(selectDNS1,    dns1s,    '-- DNS 1 --');
        llenarSelectConfig(selectDNS2,    dns2s,    '-- DNS 2 (opcional) --');

        selectDominio.disabled = false;
        selectDominio.innerHTML = '<option value="">-- Dominio admin --</option>';
        doms.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.Usuario;
            opt.dataset.password = d.Password;
            opt.dataset.descripcion = d.Descripcion || '';
            opt.textContent = d.Descripcion ? `${d.Usuario} (${d.Descripcion})` : d.Usuario;
            selectDominio.appendChild(opt);
        });
        if (doms.length === 0) {
            const opt = document.createElement('option');
            opt.value = ''; opt.disabled = true;
            opt.textContent = 'Sin dominios. Haz clic en + para agregar uno.';
            selectDominio.appendChild(opt);
        }
    } catch (err) {
        console.error('Error cargando configuraciones:', err);
        toastError('Error al cargar configuraciones', err.message);
    }
}

function limpiarSelectConMensaje(select, msg) {
    select.innerHTML = `<option value="">${msg}</option>`;
    select.disabled = true;
}

function llenarSelectConfig(select, items, placeholder) {
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

/* =========================================================
   AGREGAR CONFIGURACIÓN / DOMINIO
   ========================================================= */
async function agregarConfigRed(tipo, selectTarget) {
    const idCliente = parseInt(selectCli.value, 10);
    if (!idCliente) { toastError('Sin cliente', 'Primero selecciona un cliente.'); return; }

    const nombresTipo = {
        'Mascara': 'Máscara',
        'PuertaEnlace': 'Puerta de enlace',
        'DNS1': 'DNS 1',
        'DNS2': 'DNS 2'
    };

    const { value: formValues } = await Swal.fire({
        title: `Agregar ${nombresTipo[tipo] || tipo}`,
        html: `
            <input id="swal-valor" class="swal2-input" placeholder="Valor (ej. 192.168.111.10)">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción (opcional)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        },
        preConfirm: () => {
            const valor = document.getElementById('swal-valor').value.trim();
            const desc  = document.getElementById('swal-desc').value.trim();
            if (!valor) { Swal.showValidationMessage('El valor es obligatorio'); return false; }
            return { valor, desc };
        }
    });

    if (!formValues) return;

    try {
        const res = await window.api.config.crear(idCliente, tipo, formValues.valor, formValues.desc);
        if (res && res.ok) {
            await cargarConfiguracionesDelCliente(idCliente);
            selectTarget.value = formValues.valor;
            toastExito('Agregado correctamente');
        } else {
            toastError('Error', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error', err.message);
    }
}

async function agregarDominio() {
    const idCliente = parseInt(selectCli.value, 10);
    if (!idCliente) { toastError('Sin cliente', 'Primero selecciona un cliente.'); return; }

    const { value: formValues } = await Swal.fire({
        title: 'Agregar dominio admin',
        html: `
            <input id="swal-usuario" class="swal2-input" placeholder="Usuario">
            <input id="swal-password" class="swal2-input" placeholder="Password">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción (opcional)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        },
        preConfirm: () => {
            const usuario = document.getElementById('swal-usuario').value.trim();
            const password = document.getElementById('swal-password').value;
            const desc = document.getElementById('swal-desc').value.trim();
            if (!usuario || !password) { Swal.showValidationMessage('Usuario y password son obligatorios'); return false; }
            return { usuario, password, desc };
        }
    });

    if (!formValues) return;

    try {
        const res = await window.api.dominios.crear(idCliente, formValues.usuario, formValues.password, formValues.desc);
        if (res && res.ok) {
            await cargarConfiguracionesDelCliente(idCliente);
            selectDominio.value = formValues.usuario;
            inputPassword.value = formValues.password;
            toastExito('Agregado correctamente');
        } else {
            toastError('Error', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error', err.message);
    }
}

/* =========================================================
   EVENTOS DE FORMULARIO
   ========================================================= */

selectCli.addEventListener('change', async () => {
    const id = parseInt(selectCli.value, 10);

    selectPiso.innerHTML = '<option value="">-- Cargando... --</option>';
    selectPiso.disabled = true;

    if (id) {
        await cargarPisosDelCliente(id);
        await cargarConfiguracionesDelCliente(id);
    } else {
        selectPiso.innerHTML = '<option value="">-- Selecciona un cliente primero --</option>';
        await cargarConfiguracionesDelCliente(null);
    }

    actualizarPreviewHostname();
});

selectRol.addEventListener('change', actualizarPreviewHostname);

selectDominio.addEventListener('change', () => {
    const opt = selectDominio.options[selectDominio.selectedIndex];
    inputPassword.value = (opt && opt.dataset.password) ? opt.dataset.password : '';
});

document.querySelectorAll('.btn-agregar-mini[data-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
        const tipo = btn.dataset.tipo;
        const targetId = btn.dataset.target;
        agregarConfigRed(tipo, document.getElementById(targetId));
    });
});
document.getElementById('btn-nuevo-dominio').addEventListener('click', agregarDominio);

selectTipoIP.addEventListener('change', actualizarCamposSegunTipo);
btnIPsDisponibles.addEventListener('click', consultarIPsDisponibles);

/* =========================================================
   MOSTRAR / OCULTAR SEGÚN TIPO DE IP
   ========================================================= */
function actualizarCamposSegunTipo() {
    const tipo = selectTipoIP.value;
    const esEstatica = tipo === 'Estatica';
    btnIPsDisponibles.disabled = !esEstatica;

    if (esEstatica) {
        campoHostEst.classList.remove('campo-oculto');
        campoHostDHCP.classList.add('campo-oculto');
        bloqueEstatico.style.display = 'block';
        filaCheckbox.style.display = 'flex';
    } else {
        campoHostEst.classList.add('campo-oculto');
        campoHostDHCP.classList.remove('campo-oculto');
        bloqueEstatico.style.display = 'none';
        filaCheckbox.style.display = 'none';
    }

    if (seccionRed) seccionRed.style.display = esEstatica ? 'block' : 'none';

    if (!esEstatica) {
        selectMascara.value = '';
        selectPuerta.value  = '';
        selectDNS1.value    = '';
        selectDNS2.value    = '';
        inputIP.value       = '';
        inputNumHost.value  = '';
    }
}

chkHostnameManual.addEventListener('change', () => {
    const manual = chkHostnameManual.checked;
    if (manual) {
        inputHostPreview.readOnly = false;
        inputHostPreview.focus();
        inputHostPreview.placeholder = 'Escribe el hostname manualmente...';
    } else {
        inputHostPreview.readOnly = true;
        inputHostPreview.placeholder = 'Se armará automáticamente...';
        actualizarPreviewHostname();
    }
});

function configurarInputIP(input) {
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
        if (input === inputIP) actualizarPreviewHostname();
    });
    input.addEventListener('blur', () => {
        const partes = input.value.split('.');
        while (partes.length < 4 && partes[0] !== '') partes.push('0');
        if (partes[0] !== '') {
            input.value = partes.slice(0, 4).join('.');
            if (input === inputIP) actualizarPreviewHostname();
        }
    });
}
configurarInputIP(inputIP);

function obtenerSegmentoIPv4(valor) {
    const octetos = String(valor ?? '').trim().split('.');
    if (octetos.length < 3 || octetos.length > 4) return null;

    const segmento = octetos.slice(0, 3);
    const valido = segmento.every(octeto =>
        /^\d{1,3}$/.test(octeto) && Number(octeto) >= 0 && Number(octeto) <= 255
    );
    if (!valido) return null;

    if (octetos.length === 4 && octetos[3] !== '' &&
        (!/^\d{1,3}$/.test(octetos[3]) || Number(octetos[3]) > 255)) {
        return null;
    }

    return segmento.map(Number).join('.');
}

/* ---------- Lupa de IPs libres: sólo dentro de los rangos autorizados ---------- */

/** Devuelve el último octeto de `ip` si pertenece al segmento /24 indicado. */
function hostEnSegmento(ip, segmento) {
    const partes = String(ip ?? '').trim().split('.');
    if (partes.length !== 4) return null;
    if (partes.slice(0, 3).map(Number).join('.') !== segmento) return null;
    const host = Number(partes[3]);
    return Number.isInteger(host) && host >= 1 && host <= 254 ? host : null;
}

function ipValorEntero(ip) {
    const partes = String(ip ?? '').trim().split('.');
    if (partes.length !== 4) return null;
    if (!partes.every(octeto => /^\d{1,3}$/.test(octeto) && Number(octeto) <= 255)) return null;
    const [a, b, c, d] = partes.map(Number);
    return ((a * 256 + b) * 256 + c) * 256 + d;
}

/**
 * Rangos del cliente que aplican al perfil elegido, con la misma regla del
 * backend (db/rangos.js): un rango sin perfil aplica a cualquier perfil.
 */
async function rangosDeLaLupa(idCliente, idRol) {
    if (!idCliente) return { estado: 'sin-cliente', rangos: [], delCliente: [] };

    let delCliente;
    try {
        delCliente = await window.api.rangos.listar(idCliente);
    } catch (err) {
        return { estado: 'error', mensaje: err?.message || '', rangos: [], delCliente: [] };
    }
    if (!Array.isArray(delCliente)) {
        return { estado: 'error', mensaje: delCliente?.mensaje || '', rangos: [], delCliente: [] };
    }
    if (!delCliente.length) return { estado: 'sin-rangos', rangos: [], delCliente };

    if (!idRol) return { estado: 'sin-perfil', rangos: delCliente, delCliente };

    const aplicables = delCliente.filter(r => !r.IdRolEquipo || Number(r.IdRolEquipo) === idRol);
    if (!aplicables.length) return { estado: 'perfil-sin-rango', rangos: [], delCliente };
    return { estado: 'ok', rangos: aplicables, delCliente };
}

/** Hosts (1–254) del segmento que caen dentro de alguno de los rangos. */
function hostsDentroDeRangos(rangos, segmento) {
    const hosts = new Set();
    for (let host = 1; host <= 254; host++) {
        const valor = ipValorEntero(`${segmento}.${host}`);
        if (valor === null) continue;
        const dentro = (rangos || []).some(r => {
            const inicio = ipValorEntero(r.IPInicio);
            const fin = ipValorEntero(r.IPFin);
            return inicio !== null && fin !== null && valor >= inicio && valor <= fin;
        });
        if (dentro) hosts.add(host);
    }
    return hosts;
}

function textoRangos(rangos) {
    const lista = (rangos || []).map(r => `${r.IPInicio} – ${r.IPFin}`);
    return escaparHTML(lista.join(', '));
}

/** Nota explicativa que acompaña al listado de IPs libres. */
function notaRangosLupa(info, segmento, hostsPermitidos, nombrePerfil) {
    if (info.estado === 'sin-cliente') {
        return { clase: 'neutra', html: 'Sin cliente seleccionado: se muestran los 254 hosts del segmento. Elige un cliente para respetar sus rangos autorizados.' };
    }
    if (info.estado === 'error') {
        const detalle = info.mensaje ? `: ${escaparHTML(info.mensaje)}` : '';
        return { clase: 'aviso', html: `No se pudieron leer los rangos del cliente${detalle}. Se muestran los 254 hosts del segmento.` };
    }
    if (info.estado === 'sin-rangos') {
        const codigo = escaparHTML(info.delCliente[0]?.ClienteCodigo || '');
        return { clase: 'neutra', html: `El cliente ${codigo} todavía no tiene rangos configurados: se muestran los 254 hosts del segmento.` };
    }
    if (info.estado === 'sin-perfil') {
        return { clase: 'ok', html: `Selecciona un perfil para afinar la búsqueda. Por ahora se muestran las IPs dentro de estos rangos: ${textoRangos(info.rangos)}.` };
    }
    if (info.estado === 'perfil-sin-rango') {
        const codigo = escaparHTML(info.delCliente[0]?.ClienteCodigo || '');
        const perfil = escaparHTML(nombrePerfil || 'sin perfil');
        return { clase: 'alerta', html: `El perfil ${perfil} no tiene rango IP definido para el cliente ${codigo}. Registra un rango en «Rangos IP» antes de asignar direcciones.` };
    }
    if (!hostsPermitidos || !hostsPermitidos.size) {
        const segmentos = [...new Set((info.rangos || []).map(r =>
            String(r.IPInicio || '').split('.').slice(0, 3).join('.')
        ).filter(Boolean))];
        return {
            clase: 'alerta',
            html: `Ningún rango autorizado cubre el segmento ${escaparHTML(segmento)}. Rangos del perfil: ${textoRangos(info.rangos)}${segmentos.length ? ` (segmentos: ${escaparHTML(segmentos.join(', '))})` : ''}.`
        };
    }
    return { clase: 'ok', html: `Sólo IPs dentro de los rangos autorizados: ${textoRangos(info.rangos)}.` };
}

async function consultarIPsDisponibles() {
    const segmento = obtenerSegmentoIPv4(inputIP.value);
    if (!segmento) {
        toastError('Segmento inválido', 'Ingresa una IPv4 válida para consultar sus primeros tres octetos.');
        inputIP.focus();
        return;
    }

    btnIPsDisponibles.disabled = true;
    try {
        const resultado = await window.api.equipos.listarIPsAsignadasEnSegmento(segmento, idEditando);
        if (!Array.isArray(resultado)) {
            throw new Error(resultado?.mensaje || 'No se pudieron consultar las IP asignadas.');
        }

        const prefijo = `${segmento}.`;
        const ipsReservadas = [
            ...resultado,
            selectPuerta.value,
            selectDNS1.value,
            selectDNS2.value
        ];
        const hostsOcupados = new Set(
            ipsReservadas.map(ip => hostEnSegmento(ip, segmento)).filter(host => host !== null)
        );

        /* Rangos autorizados del cliente/perfil seleccionados en el formulario */
        const idCliente = parseInt(selectCli.value, 10) || null;
        const idRol = parseInt(selectRol.value, 10) || null;
        const opcionPerfil = selectRol.options[selectRol.selectedIndex];
        const nombrePerfil = opcionPerfil ? opcionPerfil.textContent.trim() : '';

        const infoRangos = await rangosDeLaLupa(idCliente, idRol);
        let hostsPermitidos = null; // null = sin restricción de rango
        if (infoRangos.estado === 'ok' || infoRangos.estado === 'sin-perfil') {
            hostsPermitidos = hostsDentroDeRangos(infoRangos.rangos, segmento);
        } else if (infoRangos.estado === 'perfil-sin-rango') {
            hostsPermitidos = new Set();
        }

        const ipsLibres = [];
        for (let host = 1; host <= 254; host++) {
            if (hostsPermitidos && !hostsPermitidos.has(host)) continue;
            if (hostsOcupados.has(host)) continue;
            ipsLibres.push(`${prefijo}${host}`);
        }

        const totalConsiderados = hostsPermitidos ? hostsPermitidos.size : 254;
        const nota = notaRangosLupa(infoRangos, segmento, hostsPermitidos, nombrePerfil);

        const filas = ipsLibres.map(ip => {
            return `<tr data-ip="${ip}">
                <td><code>${ip}</code></td>
                <td><button type="button" class="btn-usar-ip" data-ip-disponible="${ip}">Usar IP</button></td>
            </tr>`;
        }).join('');

        await Swal.fire({
            title: `IPs disponibles — ${segmento}.0/24`,
            html: `
                <p class="ips-disponibles-resumen">
                    <strong>${ipsLibres.length}</strong> libres de ${totalConsiderados} hosts ${hostsPermitidos ? 'autorizados' : 'utilizables'}
                    <span>${hostsPermitidos ? 'Rangos autorizados y ocupación ya aplicados' : `Rango de hosts: ${segmento}.1 a ${segmento}.254`}</span>
                </p>
                <p class="ips-rangos-nota ${nota.clase}">${nota.html}</p>
                <label for="buscar-ip-libre" class="ips-busqueda">Buscar IP libre</label>
                <input id="buscar-ip-libre" type="search" class="swal2-input"
                    placeholder="Ej. ${prefijo}67 o 67">
                ${ipsLibres.length
                    ? `<div class="ips-disponibles-lista">
                        <table class="tabla-ips-disponibles">
                            <thead><tr><th>Dirección IP</th><th></th></tr></thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>`
                    : `<p class="ips-disponibles-vacias">${hostsPermitidos && !ipsLibres.length
                        ? 'No hay IPs libres dentro de los rangos autorizados para este segmento.'
                        : 'No hay direcciones disponibles en este segmento.'}</p>`}
            `,
            showConfirmButton: false,
            showCloseButton: true,
            width: 680,
            customClass: { popup: 'cl-confirm cl-modal-ips' },
            didOpen: popup => {
                const buscarIP = popup.querySelector('#buscar-ip-libre');
                buscarIP.addEventListener('input', () => {
                    const termino = buscarIP.value.trim().toLowerCase();
                    popup.querySelectorAll('tbody tr[data-ip]').forEach(fila => {
                        fila.hidden = termino !== '' && !fila.dataset.ip.toLowerCase().includes(termino);
                    });
                });
                popup.querySelectorAll('[data-ip-disponible]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        inputIP.value = btn.dataset.ipDisponible;
                        actualizarPreviewHostname();
                        Swal.close();
                        inputIP.focus();
                    });
                });
            }
        });
    } catch (err) {
        toastError('No se pudieron consultar las IP disponibles', err.message);
    } finally {
        btnIPsDisponibles.disabled = selectTipoIP.value !== 'Estatica';
    }
}

function construirHostname(idRol, idCli, ip) {
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

function actualizarPreviewHostname() {
    if (chkHostnameManual.checked) { actualizarNumeroHost(); return; }
    const idRol = parseInt(selectRol.value, 10);
    const idCli = parseInt(selectCli.value, 10);
    const ip = inputIP.value.trim();
    inputHostPreview.value = construirHostname(idRol, idCli, ip);
    actualizarNumeroHost();
}

function actualizarNumeroHost() {
    const partes = inputIP.value.trim().split('.');
    if (partes.length === 4) {
        const ultimo = parseInt(partes[3], 10);
        inputNumHost.value = isNaN(ultimo) ? '' : ultimo;
    } else {
        inputNumHost.value = '';
    }
}

/* =========================================================
   BUSCADOR
   ========================================================= */
inputBusqueda.addEventListener('input', () => {
    filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
    btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
    renderTabla();
});

btnExportarExcel.addEventListener('click', async () => {
    btnExportarExcel.disabled = true;
    try {
        const columnas = [
            ['clienteNombre', 'Nombre del cliente'], ['clienteCodigo', 'Código cliente'],
            ['rolNombre', 'Nombre del rol'], ['rolCodigo', 'Código rol'],
            ['hostname', 'Hostname'], ['tipoIP', 'Tipo IP'], ['ip', 'IP'], ['piso', 'Piso'],
            ['mascara', 'Máscara'], ['puertaEnlace', 'Puerta de enlace'], ['dns1', 'DNS 1'],
            ['dns2', 'DNS 2'], ['usuarioAdmin', 'Usuario admin'],
            ['numeroHost', 'Número host'], ['activo', 'Activo']
        ];
        const opcionesCliente = [
            '<option value="">Todos los clientes</option>',
            ...clientes.map(cliente =>
                `<option value="${Number(cliente.IdCliente)}">${escaparHTML(cliente.Nombre || cliente.Codigo)} (${escaparHTML(cliente.Codigo)})</option>`
            )
        ].join('');
        const checksColumnas = columnas.map(([clave, etiqueta]) => `
            <label style="display:inline-flex;align-items:center;gap:6px;margin:5px 9px 5px 0;">
                <input type="checkbox" class="swal-columna-exportar" value="${clave}" checked>
                ${escaparHTML(etiqueta)}
            </label>
        `).join('');
        const seleccion = await Swal.fire({
            title: 'Configurar exportación',
            html: `
                <label for="swal-cliente-exportar" style="display:block;text-align:left;margin:12px 0 5px;">Cliente</label>
                <select id="swal-cliente-exportar" class="swal2-select" style="width:100%;margin:0;">${opcionesCliente}</select>
                <p style="text-align:left;margin:18px 0 5px;font-weight:600;">Columnas que incluir</p>
                <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));text-align:left;max-height:260px;overflow:auto;">${checksColumnas}</div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Exportar Excel',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const seleccionadas = [...document.querySelectorAll('.swal-columna-exportar:checked')]
                    .map(input => input.value);
                if (!seleccionadas.length) {
                    Swal.showValidationMessage('Selecciona al menos una columna.');
                    return false;
                }
                return {
                    idCliente: document.getElementById('swal-cliente-exportar').value || null,
                    columnas: seleccionadas
                };
            }
        });
        if (!seleccion.isConfirmed) return;
        const resultado = await window.api.equipos.exportarExcel(seleccion.value);
        if (resultado?.ok) {
            toastExito(`Excel exportado: ${resultado.ruta}`);
        } else if (!resultado?.cancelado) {
            toastError('No se pudo exportar a Excel', resultado?.mensaje || 'Error desconocido');
        }
    } catch (error) {
        console.error('[Equipos] Error exportando Excel:', error);
        toastError('No se pudo exportar a Excel', error.message);
    } finally {
        btnExportarExcel.disabled = false;
    }
});

btnLimpiarBusq.addEventListener('click', () => {
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    renderTabla();
    inputBusqueda.focus();
});

btnLimpiarFiltro.addEventListener('click', () => {
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    renderTabla();
});

/* =========================================================
   RECARGAR / RENDER
   ========================================================= */
async function recargarEquipos() {
    try {
        equipos = await window.api.equipos.listar();
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar los equipos', err.message);
    }
}

function iconoRedSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>`;
}
function iconoUsuarioSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>`;
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

function renderTabla() {
    // Refresco en vivo: conserva el desplazamiento y los grupos abiertos.
    if (window.Vivo && contenedorGrupos) {
        window.Vivo.enVivo(contenedorGrupos, pintarTablaEquipos);
        return;
    }
    pintarTablaEquipos();
}

function pintarTablaEquipos() {
    contenedorGrupos.innerHTML = '';

    const listaFiltrada = equipos.filter(e => {
        if (!filtroBusqueda) return true;
        const texto = [e.Hostname, e.ClienteCodigo, e.ClienteNombre, e.PisoNombre, e.RolCodigo, e.RolNombre, e.IP, e.UsuarioAdmin]
            .filter(Boolean).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    if (listaFiltrada.length === 0) {
        sinResultados.classList.remove('oculto');
        return;
    }
    sinResultados.classList.add('oculto');

    const porCliente = new Map();
    listaFiltrada.forEach(e => {
        if (!porCliente.has(e.ClienteCodigo)) {
            porCliente.set(e.ClienteCodigo, {
                codigo: e.ClienteCodigo,
                nombre: e.ClienteNombre,
                equipos: []
            });
        }
        porCliente.get(e.ClienteCodigo).equipos.push(e);
    });

    const clientesOrdenados = Array.from(porCliente.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));

    clientesOrdenados.forEach(grupoCliente => {
        const divCliente = document.createElement('div');
        divCliente.className = gruposExpandidos.has(grupoCliente.codigo)
            ? 'grupo-cliente'
            : 'grupo-cliente colapsado';

        const headerCliente = document.createElement('div');
        headerCliente.className = 'grupo-cliente-header';
        headerCliente.innerHTML = `
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            ${renderBadgeCliente(grupoCliente.codigo, grupoCliente.nombre)}
            <span class="grupo-count">${grupoCliente.equipos.length} ${grupoCliente.equipos.length === 1 ? 'equipo' : 'equipos'}</span>
        `;
        headerCliente.addEventListener('click', () => {
            divCliente.classList.toggle('colapsado');
            if (divCliente.classList.contains('colapsado')) gruposExpandidos.delete(grupoCliente.codigo);
            else gruposExpandidos.add(grupoCliente.codigo);
        });
        divCliente.appendChild(headerCliente);

        const bodyCliente = document.createElement('div');
        bodyCliente.className = 'grupo-cliente-body';

        const tabla = document.createElement('table');
        tabla.className = 'data-table';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th style="width:17%;">Hostname</th>
                    <th style="width:16%;">Cliente</th>
                    <th style="width:12%;">Rol</th>
                    <th style="width:9%;">Tipo</th>
                    <th style="width:12%;">IP</th>
                    <th style="width:12%;">Piso</th>
                    <th style="width:14%;">Usuario admin</th>
                    <th style="width:8%; text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = tabla.querySelector('tbody');

        grupoCliente.equipos
            .sort((a, b) => (a.Hostname || '').localeCompare(b.Hostname || ''))
            .forEach(e => {
                const tr = document.createElement('tr');

                const hostnameHTML = renderHostnameBadge(e.Hostname, e.RolCodigo);
                const tipoBadge    = renderTipoBadge(e.TipoIP);
                const ipHTML       = renderIpBadge(e.IP);
                const pisoHTML     = renderBadgePiso(e.PisoNombre);
                const clienteHTML  = renderBadgeCliente(e.ClienteCodigo, e.ClienteNombre);
                const rolHTML      = renderRolPill(e.RolCodigo, e.RolNombre);

                // Admin con el color de botón (Fondo oscuro, Letras claras)
                const adminHTML = e.UsuarioAdmin
                    ? `<span class="badge-admin" data-color="BOTON" title="${escaparHTML(e.UsuarioAdmin)}">${iconoUsuarioSVG()}${escaparHTML(e.UsuarioAdmin)}</span>`
                    : `<span class="badge-admin vacia">${iconoUsuarioSVG()}Sin asignar</span>`;

                tr.innerHTML = `
                    <td data-label="Hostname">${hostnameHTML}</td>
                    <td data-label="Cliente">${clienteHTML}</td>
                    <td data-label="Rol">${rolHTML}</td>
                    <td data-label="Tipo">${tipoBadge}</td>
                    <td data-label="IP">${ipHTML}</td>
                    <td data-label="Piso">${pisoHTML}</td>
                    <td data-label="Usuario admin">${adminHTML}</td>
                    <td class="acciones-tabla"></td>
                `;
                const celda = tr.querySelector('.acciones-tabla');

                // Botones con SOLO ICONO y TOOLTIP
                const btnEditar = document.createElement('button');
                btnEditar.type = 'button';
                btnEditar.className = 'secundario';
                btnEditar.setAttribute('data-tooltip', 'Editar equipo');
                btnEditar.innerHTML = iconoEditarSVG();
                btnEditar.addEventListener('click', () => abrirEdicion(e.IdEquipo));

                const btnEliminar = document.createElement('button');
                btnEliminar.type = 'button';
                btnEliminar.className = 'peligro';
                btnEliminar.setAttribute('data-tooltip', 'Eliminar equipo');
                btnEliminar.innerHTML = iconoEliminarSVG();
                btnEliminar.addEventListener('click', () => eliminarEquipo(e.IdEquipo, e.Hostname));

                celda.appendChild(btnEditar);
                celda.appendChild(btnEliminar);
                tbody.appendChild(tr);
            });

        const wrapper = document.createElement('div');
        wrapper.className = 'card-table';
        wrapper.appendChild(tabla);

        bodyCliente.appendChild(wrapper);
        divCliente.appendChild(bodyCliente);
        contenedorGrupos.appendChild(divCliente);
    });
}

/* =========================================================
   MODAL
   ========================================================= */
function abrirModal() {
    modalEquipo.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarModal() {
    modalEquipo.style.display = 'none';
    document.body.style.overflow = '';
    ocultarMensaje();
    modoEdicion = false;
    idEditando = null;
}

document.getElementById('modal-equipo-cerrar').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
modalEquipo.addEventListener('click', (e) => { if (e.target === modalEquipo) cerrarModal(); });

document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando = null;
    modalTitulo.textContent = 'Nuevo equipo';
    limpiarFormulario();
    abrirModal();
    actualizarCamposSegunTipo();
    selectCli.focus();
});
document.getElementById('btn-control-ip').addEventListener('click', () => {
    window.api.navegarModulo('inventario_ip');
});

function limpiarFormulario() {
    selectCli.value = '';
    selectPiso.innerHTML = '<option value="">-- Selecciona un cliente primero --</option>';
    selectPiso.disabled = true;
    selectRol.value = '';
    selectTipoIP.value = 'Estatica';
    limpiarSelectConMensaje(selectMascara, '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(selectPuerta,  '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(selectDNS1,    '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(selectDNS2,    '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(selectDominio, '-- Selecciona un cliente primero --');

    chkHostnameManual.checked = false;
    inputHostPreview.readOnly = true;
    inputHostPreview.placeholder = 'Se armará automáticamente...';
    inputHostPreview.value = '';
    inputHostLibre.value = '';
    inputIP.value = '';
    inputNumHost.value = '';
    inputPassword.value = '';
    actualizarHintRango();
}

async function abrirEdicion(id) {
    const e = equipos.find(x => Number(x.IdEquipo) === Number(id));
    if (!e) { toastError('Equipo no encontrado'); return; }

    modoEdicion = true;
    idEditando = e.IdEquipo;
    modalTitulo.textContent = `Editar equipo — ${e.Hostname}`;

    chkHostnameManual.checked = false;
    inputHostPreview.readOnly = true;
    inputHostPreview.placeholder = 'Se armará automáticamente...';

    selectCli.value = String(e.IdCliente);

    await cargarPisosDelCliente(e.IdCliente);
    if (e.IdPiso) selectPiso.value = String(e.IdPiso);

    await cargarConfiguracionesDelCliente(e.IdCliente);

    selectRol.value = String(e.IdRolEquipo);
    selectTipoIP.value = e.TipoIP;
    actualizarCamposSegunTipo();

    if (e.TipoIP === 'Estatica') {
        inputIP.value = e.IP ?? '';
        inputNumHost.value = e.NumeroHost ?? '';
        inputHostPreview.value = e.Hostname;
    } else {
        inputHostLibre.value = e.Hostname;
    }

    if (e.TipoIP === 'Estatica') {
        setSelectValorConHuerfano(selectMascara, e.Mascara);
        setSelectValorConHuerfano(selectPuerta,  e.PuertaEnlace);
        setSelectValorConHuerfano(selectDNS1,    e.DNS1);
        setSelectValorConHuerfano(selectDNS2,    e.DNS2);
    }

    setSelectValorConHuerfano(selectDominio, e.UsuarioAdmin);
    inputPassword.value = e.PasswordAdmin ?? '';

    abrirModal();
    ocultarMensaje();
    actualizarHintRango();
}

function setSelectValorConHuerfano(select, valor) {
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

/* =========================================================
   GUARDAR
   ========================================================= */
btnGuardar.addEventListener('click', async () => {
    const tipo = selectTipoIP.value;
    const esEstatica = tipo === 'Estatica';
    let hostnameFinal;

    if (esEstatica) {
        if (chkHostnameManual.checked) {
            hostnameFinal = inputHostPreview.value.trim();
            if (!hostnameFinal) { mostrarMensaje('Escribe el hostname manualmente o desmarca la casilla.', 'error'); return; }
        } else {
            const idRol = parseInt(selectRol.value, 10);
            const idCli = parseInt(selectCli.value, 10);
            const ip = inputIP.value.trim();
            hostnameFinal = construirHostname(idRol, idCli, ip);
            if (!hostnameFinal) { mostrarMensaje('No se pudo armar el hostname. Verifica cliente, rol e IP.', 'error'); return; }
        }
    } else {
        hostnameFinal = inputHostLibre.value.trim();
    }

    const datos = {
        idCliente:      parseInt(selectCli.value, 10),
        idPiso:         selectPiso.value ? parseInt(selectPiso.value, 10) : null,
        idRolEquipo:    parseInt(selectRol.value, 10),
        tipoIP:         tipo,
        hostname:       hostnameFinal,
        numeroHost:     esEstatica ? parseInt(inputNumHost.value, 10) : null,
        ip:             esEstatica ? inputIP.value.trim() : null,
        mascara:        esEstatica ? (selectMascara.value || null) : null,
        puertaEnlace:   esEstatica ? (selectPuerta.value  || null) : null,
        dns1:           esEstatica ? (selectDNS1.value    || null) : null,
        dns2:           esEstatica ? (selectDNS2.value    || null) : null,
        usuarioAdmin:   selectDominio.value || null,
        passwordAdmin:  inputPassword.value.trim() || null,
        activo:         true
    };

    if (!datos.idCliente || !datos.idRolEquipo) {
        mostrarMensaje('Cliente y rol son obligatorios.', 'error'); return;
    }
    if (!datos.hostname) {
        mostrarMensaje('El hostname es obligatorio.', 'error'); return;
    }
    if (!datos.usuarioAdmin || !datos.passwordAdmin) {
        mostrarMensaje('Usuario admin y password son obligatorios.', 'error'); return;
    }
    if (esEstatica) {
        if (!datos.idPiso)       { mostrarMensaje('El piso es obligatorio para equipos estáticos.', 'error'); return; }
        if (!datos.ip)           { mostrarMensaje('La IP es obligatoria para equipos estáticos.', 'error'); return; }
        if (!datos.mascara)      { mostrarMensaje('La máscara es obligatoria.', 'error'); return; }
        if (!datos.puertaEnlace) { mostrarMensaje('La puerta de enlace es obligatoria.', 'error'); return; }
        if (!datos.dns1)         { mostrarMensaje('El DNS 1 es obligatorio.', 'error'); return; }
    }

    setGuardando(true);

    try {
        let res;
        if (modoEdicion) res = await window.api.equipos.actualizar(idEditando, datos);
        else res = await window.api.equipos.crear(datos);

        if (res && res.ok) {
            cerrarModal();
            await recargarEquipos();
            toastExito(res.mensaje || '¡Guardado!');
        } else if (res && res.tipo === 'ip-fuera-de-rango') {
            const permitidos = (res.detalle?.aplicables || [])
                .map(r => `${r.IPInicio} – ${r.IPFin}`)
                .join(', ');
            await Swal.fire({
                icon: 'warning',
                title: 'IP fuera de rango',
                html: `<div style="text-align:left;font-size:0.9rem;">
                    ${escaparHTML(res.mensaje || 'La IP no está dentro del rango autorizado.')}<br><br>
                    <div style="background:#FFF7E8;padding:10px;border-radius:6px;border-left:3px solid #A99A63;">
                        <b>IP capturada:</b> ${escaparHTML(datos.ip || '')}<br>
                        <b>Rangos permitidos:</b> ${escaparHTML(permitidos || 'Sin rangos para este perfil')}
                    </div>
                    <p style="margin-top:10px;color:#7a7563;">
                        Ajusta la IP o configura el rango en <b>Rangos IP</b>.
                    </p></div>`,
                confirmButtonText: 'Entendido',
                buttonsStyling: false,
                customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
            });
            actualizarHintRango();
        } else if (res && res.tipo === 'ip-duplicada') {
            await Swal.fire({
                icon: 'warning',
                title: 'IP duplicada',
                html: `<div style="text-align:left;font-size:0.9rem;">
                    La IP <b>${escaparHTML(datos.ip)}</b> ya está asignada al equipo:<br><br>
                    <div style="background:#FFF7E8;padding:10px;border-radius:6px;border-left:3px solid #A99A63;">
                        <b>${escaparHTML(res.choque.Hostname)}</b><br>
                        <span style="color:#7a7563;">${escaparHTML(res.choque.ClienteCodigo)} — ${escaparHTML(res.choque.PisoNombre)}</span>
                    </div></div>`,
                confirmButtonText: 'Entendido',
                buttonsStyling: false,
                customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
            });
        } else if (res && res.tipo === 'hostname-duplicado') {
            await Swal.fire({
                icon: 'warning',
                title: 'Hostname duplicado',
                html: `<div style="text-align:left;font-size:0.9rem;">
                    El hostname <b>${escaparHTML(datos.hostname)}</b> ya está en uso por:<br><br>
                    <div style="background:#FFF7E8;padding:10px;border-radius:6px;border-left:3px solid #A99A63;">
                        <b>${escaparHTML(res.choque.Hostname)}</b><br>
                        <span style="color:#7a7563;">${escaparHTML(res.choque.ClienteCodigo)} — ${escaparHTML(res.choque.PisoNombre)}</span>
                    </div></div>`,
                confirmButtonText: 'Entendido',
                buttonsStyling: false,
                customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
            });
        } else {
            mostrarMensaje(res?.mensaje || 'Error desconocido', 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    } finally {
        setGuardando(false);
    }
});

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminarEquipo(id, hostname) {
    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar equipo?',
        html: `Se eliminará <strong>${escaparHTML(hostname)}</strong>.<br>
               Si está ubicado en el plano, también se quitará de su posición.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true, focusCancel: true, buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro',
            cancelButton: 'swal2-cancel swal2-styled'
        }
    });
    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.equipos.eliminar(id);
        if (res && res.ok) {
            await recargarEquipos();
            toastExito(res.mensaje || 'Equipo eliminado');
        } else {
            toastError('No se pudo eliminar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error al eliminar', err.message);
    }
}

/* =========================================================
   RANGOS IP POR CLIENTE
   ========================================================= */

const modalRangos        = document.getElementById('modal-rangos');
const rangosFiltroCliente = document.getElementById('rangos-filtro-cliente');
const rangosLista        = document.getElementById('rangos-lista');
const rangosResumen      = document.getElementById('rangos-resumen');

const modalRango        = document.getElementById('modal-rango');
const modalRangoTitulo  = document.getElementById('modal-rango-titulo');
const rangoCliente      = document.getElementById('rango-cliente');
const rangoPerfil       = document.getElementById('rango-perfil');
const rangoSegmento     = document.getElementById('rango-segmento');
const rangoInicio       = document.getElementById('rango-inicio');
const rangoFin          = document.getElementById('rango-fin');
const rangoDescripcion  = document.getElementById('rango-descripcion');
const rangoMensaje      = document.getElementById('rango-mensaje');
const btnRangoGuardar   = document.getElementById('rango-guardar');

const rangoCantidad     = document.getElementById('rango-cantidad');
const rangoSugerencias  = document.getElementById('rango-sugerencias');
const btnSugerirRango   = document.getElementById('btn-sugerir-rango');

const hintRangoIP     = document.getElementById('hint-rango-ip');

let rangos = [];
let rangoEditando = null;
let guardandoRango = false;
let tokenValidacionRango = 0;

function actualizarBloqueoScroll() {
    const abierto = [modalEquipo, modalRangos, modalRango]
        .some(modal => modal && modal.style.display === 'flex');
    document.body.style.overflow = abierto ? 'hidden' : '';
}

function segmentoDeIP(ip) {
    const partes = String(ip || '').trim().split('.');
    return partes.length === 4 ? partes.slice(0, 3).join('.') : '';
}

function llenarSelectClientes(select, valorSeleccionado = '') {
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
    select.innerHTML = '<option value="">Todos los perfiles (heredado)</option>';
    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = String(r.IdRolEquipo);
        opt.textContent = r.Nombre ? `${r.Nombre} (${r.Codigo})` : r.Codigo;
        select.appendChild(opt);
    });
    select.value = valorSeleccionado ? String(valorSeleccionado) : '';
}

/* ---------- Listado ---------- */

function abrirModalRangos() {
    llenarSelectClientes(rangosFiltroCliente, selectCli.value || '');
    rangosResumen.classList.add('oculto');
    rangosResumen.innerHTML = '';
    rangosLista.innerHTML = '<p class="rangos-vacio">Cargando rangos...</p>';
    modalRangos.style.display = 'flex';
    actualizarBloqueoScroll();
    cargarRangos();
}

function cerrarModalRangos() {
    modalRangos.style.display = 'none';
    actualizarBloqueoScroll();
}

async function cargarRangos() {
    const idCliente = parseInt(rangosFiltroCliente.value, 10) || null;
    try {
        const resultado = await window.api.rangos.listar(idCliente);
        if (!Array.isArray(resultado)) {
            throw new Error(resultado?.mensaje || 'No se pudieron consultar los rangos.');
        }
        rangos = resultado;
        renderRangos();
    } catch (err) {
        rangos = [];
        rangosLista.innerHTML = `<p class="rangos-vacio error">${escaparHTML(err.message)}</p>`;
    }
}

function renderRangos() {
    if (!rangos.length) {
        rangosLista.innerHTML = `<p class="rangos-vacio">
            Este cliente todavía no tiene rangos configurados. Mientras no existan rangos,
            el control de IP no restringe sus equipos.
        </p>`;
        return;
    }

    const grupos = new Map();
    rangos.forEach(r => {
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

            const perfilHTML = r.RolNombre
                ? renderRolPill(r.RolCodigo, r.RolNombre)
                : '<span class="rango-general">Todos los perfiles</span>';
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
            btnEditar.addEventListener('click', () => abrirModalRango(r));

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

    rangosLista.innerHTML = '';
    rangosLista.appendChild(fragmento);
}

/* ---------- Alta / edición ---------- */

function abrirModalRango(rango = null) {
    rangoEditando = rango ? Number(rango.IdRangoIP) : null;
    modalRangoTitulo.textContent = rango ? 'Editar rango IP' : 'Nuevo rango IP';

    llenarSelectClientes(rangoCliente, rango?.IdCliente || rangosFiltroCliente.value || selectCli.value || '');
    llenarSelectPerfiles(rangoPerfil, rango?.IdRolEquipo || '');

    const segmento = rango ? segmentoDeIP(rango.IPInicio) : (rangoSegmento.value || '192.168.2');
    rangoSegmento.value = segmento;
    rangoInicio.value = rango?.IPInicio || '';
    rangoFin.value = (rango?.IPFin && rango.IPFin !== rango.IPInicio) ? rango.IPFin : '';
    rangoDescripcion.value = rango?.Descripcion || '';

    sugerenciasRango = [];
    sugerenciasFragmentadas = [];
    if (rangoCantidad && !parseInt(rangoCantidad.value, 10)) rangoCantidad.value = '10';
    reiniciarSugerenciasRango();

    ocultarRangoMensaje();
    modalRango.style.display = 'flex';
    actualizarBloqueoScroll();
    rangoInicio.focus();
}

function cerrarModalRango() {
    modalRango.style.display = 'none';
    rangoEditando = null;
    sugerenciasRango = [];
    sugerenciasFragmentadas = [];
    ocultarRangoMensaje();
    actualizarBloqueoScroll();
}

function reiniciarSugerenciasRango() {
    if (!rangoSugerencias) return;
    sugerenciasRango = [];
    sugerenciasFragmentadas = [];
    rangoSugerencias.innerHTML = `
        <p class="sugerencias-vacio">
            Elige cliente, segmento y cantidad de hosts; después pulsa «Sugerir».
        </p>`;
}

function mostrarRangoMensaje(texto, tipo) {
    rangoMensaje.textContent = texto;
    rangoMensaje.className = 'alert ' + tipo;
}
function ocultarRangoMensaje() { rangoMensaje.className = 'alert oculto'; }

function setGuardandoRango(valor) {
    guardandoRango = valor;
    btnRangoGuardar.disabled = valor;
    const txt = btnRangoGuardar.querySelector('.btn-text');
    const spin = btnRangoGuardar.querySelector('.btn-spinner');
    if (txt) txt.textContent = valor ? 'Guardando...' : 'Guardar';
    if (spin) spin.classList.toggle('oculto', !valor);
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

    if (!idCliente)  { mostrarRangoMensaje('Selecciona el cliente al que pertenece el rango.', 'error'); return; }
    if (!datos.ipInicio) { mostrarRangoMensaje('Captura la IP inicial del rango.', 'error'); return; }

    setGuardandoRango(true);
    try {
        const res = rangoEditando
            ? await window.api.rangos.actualizar(rangoEditando, datos)
            : await window.api.rangos.crear(datos);

        if (res && res.ok) {
            cerrarModalRango();
            if (rangosFiltroCliente.querySelector(`option[value="${idCliente}"]`)) {
                rangosFiltroCliente.value = String(idCliente);
            }
            await cargarRangos();
            toastExito(res.mensaje || 'Rango guardado');
        } else {
            mostrarRangoMensaje(res?.mensaje || 'No se pudo guardar el rango.', 'error');
        }
    } catch (err) {
        mostrarRangoMensaje('Error: ' + err.message, 'error');
    } finally {
        setGuardandoRango(false);
    }
}

async function eliminarRango(rango) {
    const etiqueta = rango.RolNombre ? `${rango.RolNombre} · ${rango.IPInicio} – ${rango.IPFin}` : `${rango.IPInicio} – ${rango.IPFin}`;
    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar rango IP?',
        html: `Se eliminará el rango <strong>${escaparHTML(etiqueta)}</strong> de
               <strong>${escaparHTML(rango.ClienteCodigo || '')}</strong>.<br>
               Los equipos que lo tengan asignado quedarán sin rango.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
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

/* ---------- Auditoría ---------- */

async function auditarRangos() {
    const idCliente = parseInt(rangosFiltroCliente.value, 10) || null;
    try {
        const res = await window.api.rangos.auditar(idCliente);
        if (!res || res.ok === false || !Array.isArray(res.violaciones)) {
            throw new Error(res?.mensaje || 'No se pudo auditar el cumplimiento de rangos.');
        }
        renderResumenAuditoria(res);
    } catch (err) {
        toastError('No se pudo auditar', err.message);
    }
}

function renderResumenAuditoria(res) {
    const violaciones = res.violaciones || [];
    const sinNorma = res.sinNorma || [];

    const detalleViolaciones = violaciones.map(v => `
        <li>
            <strong>${escaparHTML(v.Hostname || '')}</strong>
            <code class="rango-ip">${escaparHTML(v.IP || '')}</code>
            <span class="rango-motivo">${escaparHTML(v.mensaje || '')}</span>
        </li>`).join('');

    const detalleSinNorma = sinNorma.map(v => `
        <li>
            <strong>${escaparHTML(v.Hostname || '')}</strong>
            <code class="rango-ip">${escaparHTML(v.IP || '')}</code>
            <span class="rango-motivo">El cliente ${escaparHTML(v.ClienteCodigo || '')} no tiene rangos configurados.</span>
        </li>`).join('');

    rangosResumen.classList.remove('oculto');
    rangosResumen.innerHTML = `
        <div class="rangos-resumen-titulo">
            <span class="${violaciones.length ? 'contador-alerta' : 'contador-ok'}">${violaciones.length}</span>
            ${violaciones.length === 1 ? 'equipo fuera de norma' : 'equipos fuera de norma'}
            <span class="rangos-resumen-sep">·</span>
            <span class="${sinNorma.length ? 'contador-alerta' : 'contador-ok'}">${sinNorma.length}</span>
            sin rangos configurados
            <span class="rangos-resumen-sep">·</span>
            ${Number(res.totalEquipos) || 0} estáticos revisados
        </div>
        ${violaciones.length
            ? `<ul class="rangos-resumen-lista">${detalleViolaciones}</ul>`
            : '<p class="rangos-resumen-ok">Todos los equipos con rango definido cumplen su rango autorizado.</p>'}
        ${sinNorma.length
            ? `<details class="rangos-resumen-detalle">
                   <summary>Ver equipos sin norma (${sinNorma.length})</summary>
                   <ul class="rangos-resumen-lista">${detalleSinNorma}</ul>
               </details>`
            : ''}
    `;
}

/* ---------- Sugerencia inteligente de IP libres ----------
   Regla: un rango nuevo no debe pisar el rango de NINGÚN cliente
   (no solo del actual) ni una IP ya registrada, porque esas
   direcciones quedan reservadas en el control general de IP.
   Se prefieren bloques consecutivos; si no alcanzan, se ofrecen
   fragmentos consecutivos pequeños que en conjunto cubren lo pedido. */

const HOST_INICIAL_RANGO = 2;   /* .0 = dirección de red */
const HOST_FINAL_RANGO   = 254; /* .255 = broadcast */

let sugerenciasRango = [];
let sugerenciasFragmentadas = [];
let sugiriendoRango = false;

function normalizarSegmentoRango(valor) {
    const partes = String(valor ?? '').trim().replace(/\.$/, '').split('.');
    if (partes.length !== 3) return null;
    if (!partes.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return null;
    return partes.map(p => String(Number(p))).join('.');
}

/** Mapa host → motivo de ocupación para un segmento /24. */
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

/** Bloques consecutivos de hosts libres dentro del segmento. */
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

function renderSugerenciasRango(segmento, cantidad, fragmentos, ocupados) {
    sugerenciasRango = [];
    sugerenciasFragmentadas = [];
    const consecutivos = fragmentos
        .filter(f => f.hosts >= cantidad)
        .sort((a, b) => a.inicio - b.inicio);
    const restantes = fragmentos
        .filter(f => f.hosts < cantidad)
        .sort((a, b) => b.hosts - a.hosts || a.inicio - b.inicio);

    const totalLibres = fragmentos.reduce((suma, f) => suma + f.hosts, 0);
    const ocupadas = ocupados.size;
    const resumen = `
        <p class="sugerencias-resumen">
            <span class="sugerencias-pill">${totalLibres} hosts libres</span>
            <span class="sugerencias-pill">${ocupadas} ocupadas</span>
            <span class="sugerencias-pill">${fragmentos.length} ${fragmentos.length === 1 ? 'bloque' : 'bloques'} libres</span>
        </p>`;

    if (!totalLibres) {
        rangoSugerencias.innerHTML = `${resumen}
            <p class="sugerencias-vacio alerta">
                El segmento ${escaparHTML(segmento)} no tiene hosts libres: todos están en rangos de clientes o registrados.
            </p>`;
        sugerenciasRango = [];
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
                    <button type="button" id="btn-sugerencia-fragmentada" class="btn-primary"
                            data-permiso="equipos:rangos:crear">
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
        sugerenciasRango = [];
    }

    const sinCliente = !parseInt(rangoCliente.value, 10);
    rangoSugerencias.innerHTML = `
        ${resumen}
        ${sinCliente ? '<p class="sugerencias-vacio alerta">Selecciona el cliente del rango para poder registrar la sugerencia.</p>' : ''}
        ${cuerpo}`;
}

function setSugiriendoRango(valor) {
    sugiriendoRango = valor;
    if (!btnSugerirRango) return;
    btnSugerirRango.disabled = valor;
    const txt = btnSugerirRango.querySelector('.btn-text');
    const spin = btnSugerirRango.querySelector('.btn-spinner');
    if (txt) txt.textContent = valor ? 'Calculando...' : 'Sugerir';
    if (spin) spin.classList.toggle('oculto', !valor);
}

async function sugerirIPsRango() {
    if (sugiriendoRango) return;

    const segmento = normalizarSegmentoRango(rangoSegmento.value);
    if (!segmento) {
        rangoSugerencias.innerHTML = '<p class="sugerencias-vacio alerta">Indica el segmento con formato 192.168.2 para calcular las IP libres.</p>';
        return;
    }
    rangoSegmento.value = segmento;

    const cantidad = Math.min(
        HOST_FINAL_RANGO,
        Math.max(1, parseInt(rangoCantidad.value, 10) || 10)
    );
    rangoCantidad.value = String(cantidad);

    setSugiriendoRango(true);
    rangoSugerencias.innerHTML = '<p class="sugerencias-vacio">Buscando huecos libres en el segmento...</p>';
    try {
        const ocupados = await mapaOcupacionSegmento(segmento, rangoEditando);
        renderSugerenciasRango(segmento, cantidad, fragmentosLibres(ocupados), ocupados);
    } catch (err) {
        rangoSugerencias.innerHTML = `<p class="sugerencias-vacio alerta">${escaparHTML(err.message || 'No se pudieron calcular las IP libres.')}</p>`;
        sugerenciasRango = [];
    } finally {
        setSugiriendoRango(false);
    }
}

function usarSugerencia(indice) {
    const bloque = sugerenciasRango[indice];
    if (!bloque) return;
    const segmento = normalizarSegmentoRango(rangoSegmento.value);
    if (!segmento) return;
    rangoInicio.value = `${segmento}.${bloque.inicio}`;
    rangoFin.value = bloque.inicio === bloque.fin ? '' : `${segmento}.${bloque.fin}`;
    ocultarRangoMensaje();
    rangoDescripcion.focus();
}

async function crearRangosFragmentados() {
    const idCliente = parseInt(rangoCliente.value, 10);
    if (!idCliente) {
        mostrarRangoMensaje('Selecciona el cliente al que pertenece el rango.', 'error');
        return;
    }
    const segmento = normalizarSegmentoRango(rangoSegmento.value);
    if (!segmento) {
        mostrarRangoMensaje('Indica un segmento válido antes de crear los rangos.', 'error');
        return;
    }
    const cantidad = Math.max(1, parseInt(rangoCantidad.value, 10) || 10);
    const bloques = sugerenciasFragmentadas;
    if (!bloques.length) return;

    const detalle = bloques
        .map(b => `${segmento}.${b.inicio}${b.inicio === b.fin ? '' : ' – ' + segmento + '.' + b.fin}`)
        .join('<br>');

    const confirmacion = await Swal.fire({
        icon: 'question',
        title: '¿Crear rangos fragmentados?',
        html: `<div style="text-align:left;font-size:0.9rem;">
            Se crearán ${bloques.length} rangos para el cliente seleccionado:<br><br>
            <div style="background:#F4F6F0;padding:10px;border-radius:6px;border-left:3px solid #516848;">
                ${detalle}
            </div>
            <p style="margin-top:10px;color:#7a7563;">
                Ninguno se empalma con rangos de otros clientes. La suma cubre al menos ${cantidad} hosts.
            </p></div>`,
        showCancelButton: true,
        confirmButtonText: 'Crear rangos',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        }
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

    if (rangosFiltroCliente.querySelector(`option[value="${idCliente}"]`)) {
        rangosFiltroCliente.value = String(idCliente);
    }
    await cargarRangos();
    cerrarModalRango();

    if (errores.length) {
        toastError(`Se crearon ${creados} rangos`, errores[0]);
    } else {
        toastExito(`${creados} rango(s) fragmentados creados`);
    }
}

/* ---------- Aviso en el formulario de equipo ---------- */

async function actualizarHintRango() {
    if (!hintRangoIP) return;

    const idCliente = parseInt(selectCli.value, 10);
    const idRol = parseInt(selectRol.value, 10) || null;
    const ip = inputIP.value.trim();
    const esEstatica = selectTipoIP.value === 'Estatica';

    const limpiar = () => {
        hintRangoIP.className = 'ayuda-rango oculto';
        hintRangoIP.textContent = '';
    };

    if (!esEstatica || !idCliente || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) { limpiar(); return; }

    const token = ++tokenValidacionRango;
    try {
        const res = await window.api.rangos.validarIP(idCliente, idRol, ip);
        if (token !== tokenValidacionRango) return;

        if (res && res.ok === false && res.aplica) {
            hintRangoIP.textContent = res.mensaje || 'La IP está fuera del rango autorizado.';
            hintRangoIP.className = 'ayuda-rango alerta';
            return;
        }
        if (res && res.rango) {
            hintRangoIP.textContent = `Dentro del rango permitido (${res.rango.IPInicio} – ${res.rango.IPFin}).`;
            hintRangoIP.className = 'ayuda-rango ok';
            return;
        }
        hintRangoIP.textContent = 'Este cliente no tiene rangos configurados: la IP no se restringe.';
        hintRangoIP.className = 'ayuda-rango neutra';
    } catch (_) {
        if (token === tokenValidacionRango) limpiar();
    }
}

/* ---------- Eventos ---------- */

document.getElementById('btn-rangos-ip').addEventListener('click', abrirModalRangos);
document.getElementById('modal-rangos-cerrar').addEventListener('click', cerrarModalRangos);
document.getElementById('btn-rangos-cerrar-pie').addEventListener('click', cerrarModalRangos);
modalRangos.addEventListener('click', (e) => { if (e.target === modalRangos) cerrarModalRangos(); });

rangosFiltroCliente.addEventListener('change', () => {
    rangosResumen.classList.add('oculto');
    rangosResumen.innerHTML = '';
    cargarRangos();
});

document.getElementById('btn-rangos-auditar').addEventListener('click', auditarRangos);
document.getElementById('btn-rango-nuevo').addEventListener('click', () => abrirModalRango(null));

document.getElementById('modal-rango-cerrar').addEventListener('click', cerrarModalRango);
document.getElementById('rango-cancelar').addEventListener('click', cerrarModalRango);
modalRango.addEventListener('click', (e) => { if (e.target === modalRango) cerrarModalRango(); });
btnRangoGuardar.addEventListener('click', guardarRango);

/* Sugerencia de IP libres */
if (btnSugerirRango) btnSugerirRango.addEventListener('click', sugerirIPsRango);
if (rangoSegmento) {
    rangoSegmento.addEventListener('change', reiniciarSugerenciasRango);
    rangoSegmento.addEventListener('blur', () => {
        const segmento = normalizarSegmentoRango(rangoSegmento.value);
        if (segmento) rangoSegmento.value = segmento;
    });
}
if (rangoCantidad) {
    rangoCantidad.addEventListener('change', () => {
        if (!sugerenciasRango.length) return;
        sugerirIPsRango();
    });
}
if (rangoSugerencias) {
    rangoSugerencias.addEventListener('click', (evento) => {
        const boton = evento.target.closest('.sugerencia-usar');
        if (boton) {
            usarSugerencia(Number(boton.dataset.sugerencia));
            return;
        }
        if (evento.target.closest('#btn-sugerencia-fragmentada')) {
            crearRangosFragmentados();
        }
    });
}

inputIP.addEventListener('input', actualizarHintRango);
inputIP.addEventListener('blur', actualizarHintRango);
selectCli.addEventListener('change', actualizarHintRango);
selectRol.addEventListener('change', actualizarHintRango);

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    await window.PermisosUI?.init();
    await cargarClientes();
    await cargarRoles();
    await recargarEquipos();
    limpiarResiduosSwal();
})();