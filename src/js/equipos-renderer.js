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

/* Paginación por grupos (un registro = un cliente con sus equipos): sólo se
   vuelcan al DOM los grupos de la página vigente, así un cliente con cientos
   de equipos no arrastra a todos los demás. Si el módulo Paginador no se
   cargó, recortar() devuelve la lista completa y la página sigue igual. */
const pagEquipos = window.Paginador
    ? window.Paginador.crear(document.getElementById('paginacion-equipos'), {
        alCambiar: () => pintarTablaEquipos()
    })
    : { recortar: lista => lista, reiniciar() {}, mostrar() {} };

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
   RANGOS DEL CLIENTE (caché) + AUTOFORMATO DEL FORMULARIO

   Los rangos declarados en «Rangos IP» son la fuente para dos
   automatismos del formulario:
     1) inferir el rol del equipo a partir de la IP capturada;
     2) deducir el segmento al importar listas de hostnames.
   ========================================================= */
const cacheRangosPorCliente = new Map();

/** Rangos del cliente, memorizados por cliente. Nunca rechaza: devuelve []. */
function rangosDelCliente(idCliente) {
    const id = Number(idCliente);
    if (!id) return Promise.resolve([]);
    if (!cacheRangosPorCliente.has(id)) {
        const peticion = window.api.rangos.listar(id)
            .then(lista => (Array.isArray(lista) ? lista : []))
            .catch(() => []);
        cacheRangosPorCliente.set(id, peticion);
    }
    return cacheRangosPorCliente.get(id);
}

/** Olvida la caché de rangos (tras crear/editar/eliminar un rango). */
function invalidarCacheRangos() {
    cacheRangosPorCliente.clear();
}

/** Opciones realmente elegibles de un select (sin el placeholder vacío). */
function opcionesUtiles(select) {
    return Array.from(select.options).filter(o => o.value !== '' && !o.disabled);
}

/** Selecciona el valor si el catálogo trae uno solo y el campo está vacío. */
function autoseleccionarUnico(select) {
    if (!select || select.disabled) return false;
    if (select.value) return false;
    const opciones = opcionesUtiles(select);
    if (opciones.length !== 1) return false;
    select.value = opciones[0].value;
    return true;
}

/** Copia la password del dominio elegido al input indicado. */
function sincronizarPasswordDominio(select, input) {
    if (!select || !input) return;
    const opt = select.options[select.selectedIndex];
    input.value = (opt && opt.dataset && opt.dataset.password) ? opt.dataset.password : '';
}

/**
 * Autollenado de red y administración con la información ya cargada del
 * cliente. Sólo actúa cuando el catálogo ofrece un único valor, de modo que
 * nunca inventa ni pisa una elección del usuario.
 */
function autollenarConfiguracionDelCliente() {
    if (selectTipoIP && selectTipoIP.value !== 'Estatica') return false;
    let cambios = false;
    [selectMascara, selectPuerta, selectDNS1, selectDNS2].forEach(select => {
        if (autoseleccionarUnico(select)) cambios = true;
    });
    if (autoseleccionarUnico(selectDominio)) {
        sincronizarPasswordDominio(selectDominio, inputPassword);
        cambios = true;
    } else if (selectDominio && selectDominio.value && !inputPassword.value) {
        sincronizarPasswordDominio(selectDominio, inputPassword);
    }
    return cambios;
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
        /* Red y administración se rellenan con lo ya cargado del cliente
           (sólo cuando el catálogo tiene un único valor). */
        autollenarConfiguracionDelCliente();
    } else {
        selectPiso.innerHTML = '<option value="">-- Selecciona un cliente primero --</option>';
        await cargarConfiguracionesDelCliente(null);
        mostrarHintRol(null);
    }

    actualizarPreviewHostname();
    inferirRolPorIP();
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
 * Reusa la caché de rangosDelCliente() para no repetir la consulta.
 */
async function rangosDeLaLupa(idCliente, idRol) {
    if (!idCliente) return { estado: 'sin-cliente', rangos: [], delCliente: [] };

    const delCliente = await rangosDelCliente(idCliente);
    if (!delCliente.length) return { estado: 'sin-rangos', rangos: [], delCliente };

    if (!idRol) return { estado: 'sin-perfil', rangos: delCliente, delCliente };

    const aplicables = delCliente.filter(r => !r.IdRolEquipo || Number(r.IdRolEquipo) === idRol);
    if (!aplicables.length) return { estado: 'perfil-sin-rango', rangos: [], delCliente };
    return { estado: 'ok', rangos: aplicables, delCliente };
}

/** Hosts (1–254) del segmento autorizados por los rangos, con el rango que los cubre. */
function hostsAutorizadosPorRango(rangos, segmento) {
    const mapa = new Map();
    for (let host = 1; host <= 254; host++) {
        const valor = ipValorEntero(`${segmento}.${host}`);
        if (valor === null) continue;
        const rango = (rangos || []).find(r => {
            const inicio = ipValorEntero(r.IPInicio);
            const fin = ipValorEntero(r.IPFin);
            return inicio !== null && fin !== null && valor >= inicio && valor <= fin;
        });
        if (rango) mapa.set(host, rango);
    }
    return mapa;
}

/**
 * Hosts del segmento que el cliente ya ocupa con sus parámetros de red
 * (puerta de enlace, DNS, máscara). La puerta de enlace típica —192.168.3.1—
 * nunca debe ofrecerse como IP libre aunque el rango empiece en .1.
 * `selects` permite usar los mismos catálogos desde la importación pasiva,
 * que tiene sus propios combos (ipas-*).
 */
function hostsDeConfiguracionDelCliente(segmento, selects = [selectMascara, selectPuerta, selectDNS1, selectDNS2]) {
    const hosts = new Set();
    (selects || []).forEach(select => {
        Array.from(select?.options || []).forEach(opcion => {
            const host = hostEnSegmento(opcion.value, segmento);
            if (host !== null) hosts.add(host);
        });
    });
    return hosts;
}

/**
 * Texto legible del dueño real de una IP ocupada: un equipo del inventario o
 * un dispositivo del control general. Lo usan la lupa y la importación pasiva
 * para decir QUIÉN usa la dirección en lugar de un genérico «ocupada», que es
 * justo lo que hacía pensar que el rango la estaba bloqueando.
 * Devuelve texto plano: cada consumidor lo escapa al pintarlo.
 */
function describirDuenoIP(registro) {
    const hostname = String(registro?.Hostname || '').trim();
    const cliente = String(registro?.ClienteCodigo || '').trim();
    const origen = String(registro?.Origen || '').trim();
    const nombre = hostname || (origen === 'Control general' ? 'Dispositivo general' : 'Equipo sin hostname');
    const ambito = cliente ? ` (${cliente})` : (origen === 'Control general' ? ' · control general' : '');
    return `${nombre}${ambito}`;
}

/** Segmentos /24 que cubren los rangos: para avisar cuando el segmento no es el del cliente. */
function segmentosDeRangos(rangos) {
    return [...new Set((rangos || [])
        .map(r => String(r.IPInicio || '').split('.').slice(0, 3).join('.'))
        .filter(segmento => /^\d{1,3}(\.\d{1,3}){2}$/.test(segmento)))];
}

function textoRangos(rangos) {
    const lista = (rangos || []).map(r => `${r.IPInicio} – ${r.IPFin}`);
    return escaparHTML(lista.join(', '));
}

/** Nota explicativa que acompaña al listado de IPs libres. */
function notaRangosLupa(info, segmento, autorizados, nombrePerfil) {
    const perfil = escaparHTML(nombrePerfil || 'sin perfil');
    const codigo = escaparHTML(info.delCliente?.[0]?.ClienteCodigo || '');

    if (info.estado === 'sin-cliente') {
        return { clase: 'aviso', html: 'Elige el cliente para consultar las IP libres dentro de su rango autorizado.' };
    }
    if (info.estado === 'sin-rangos') {
        return { clase: 'aviso', html: `El cliente ${codigo} todavía no tiene rangos IP registrados. Declara su rango en «Rangos IP» para que la lupa pueda sugerir direcciones.` };
    }
    if (info.estado === 'perfil-sin-rango') {
        return { clase: 'alerta', html: `El perfil ${perfil} no tiene rango IP definido para el cliente ${codigo}. Regístralo en «Rangos IP» para poder sugerir direcciones.` };
    }
    if (!autorizados.size) {
        const segmentos = segmentosDeRangos(info.rangos);
        return {
            clase: 'alerta',
            html: `El rango de ${perfil} no cubre el segmento ${escaparHTML(segmento)}: ${textoRangos(info.rangos)}${segmentos.length ? ` (segmento ${escaparHTML(segmentos.join(', '))})` : ''}. Escribe una IP del segmento del rango para ver sus direcciones libres.`
        };
    }
    if (info.estado === 'sin-perfil') {
        return { clase: 'aviso', html: `Sin perfil seleccionado se usan todos los rangos del cliente: ${textoRangos(info.rangos)}.` };
    }
    return {
        clase: 'ok',
        html: `Direcciones libres dentro del rango de ${perfil}: ${textoRangos(info.rangos)}. Estar dentro del rango <b>reserva</b> la IP para el cliente, no la ocupa: sólo se descartan las que ya usa un equipo o un dispositivo activo.`
    };
}

async function consultarIPsDisponibles() {
    const segmento = obtenerSegmentoIPv4(inputIP.value);
    if (!segmento) {
        toastError('Segmento inválido', 'Ingresa una IPv4 válida para consultar sus primeros tres octetos.');
        inputIP.focus();
        return;
    }

    const idCliente = parseInt(selectCli.value, 10) || null;
    const idRol = parseInt(selectRol.value, 10) || null;
    const opcionPerfil = selectRol.options[selectRol.selectedIndex];
    const nombrePerfil = opcionPerfil ? opcionPerfil.textContent.trim() : '';

    btnIPsDisponibles.disabled = true;
    try {
        /* La lupa sólo propone direcciones que el rango autorizado cubra: el
           guardado del equipo rechaza cualquier IP fuera de rango (db/rangos.js),
           así que ofrecerlas sería prometer algo que no se puede guardar. */
        const infoRangos = await rangosDeLaLupa(idCliente, idRol);
        const autorizados = (infoRangos.estado === 'ok' || infoRangos.estado === 'sin-perfil')
            ? hostsAutorizadosPorRango(infoRangos.rangos, segmento)
            : new Map();
        const nota = notaRangosLupa(infoRangos, segmento, autorizados, nombrePerfil);
        const notaHTML = `<p class="ips-rangos-nota ${nota.clase}">${nota.html}</p>`;
        const comun = {
            title: `IPs disponibles — ${segmento}.0/24`,
            showConfirmButton: false,
            showCloseButton: true,
            width: 680,
            customClass: { popup: 'cl-confirm cl-modal-ips' }
        };

        if (!autorizados.size) {
            await Swal.fire({
                ...comun,
                html: `${notaHTML}
                    <p class="ips-disponibles-vacias">Sin rango autorizado no hay IPs que sugerir: la lupa sólo muestra direcciones libres dentro del rango del cliente y perfil elegidos.</p>`
            });
            return;
        }

        const resultado = await window.api.equipos.listarOcupacionSegmento(segmento, idEditando);
        if (!Array.isArray(resultado)) {
            throw new Error(resultado?.mensaje || 'No se pudieron consultar las IP asignadas.');
        }

        /* Ocupadas = en uso: equipos activos y dispositivos activos del Control
           general que sí identifican un aparato, más los parámetros de red del
           cliente (puerta de enlace, DNS, máscara), que nunca son equipos.
           Pertenecer al rango NO ocupa: el rango es la autorización, así que
           toda dirección del rango que no use nadie se ofrece como libre. */
        const infra = hostsDeConfiguracionDelCliente(segmento);
        const duenos = new Map();
        resultado.forEach(registro => {
            const host = hostEnSegmento(registro?.IP, segmento);
            if (host !== null) duenos.set(host, registro);
        });
        const libres = [];
        const ocupadas = [];
        let usadosEnRango = 0;
        let redEnRango = 0;
        autorizados.forEach((rangoAutorizado, host) => {
            const ip = `${segmento}.${host}`;
            const dueno = duenos.get(host);
            if (dueno) {
                usadosEnRango += 1;
                ocupadas.push({ ip, motivo: `En uso por ${escaparHTML(describirDuenoIP(dueno))}` });
                return;
            }
            if (infra.has(host)) {
                redEnRango += 1;
                ocupadas.push({ ip, motivo: 'Red del cliente: puerta de enlace, DNS o máscara' });
                return;
            }
            libres.push({ ip, rango: rangoAutorizado });
        });
        libres.sort((a, b) => ipValorEntero(a.ip) - ipValorEntero(b.ip));

        const filas = libres.map(item => `<tr data-ip="${item.ip}">
                <td><code>${item.ip}</code></td>
                <td>${escaparHTML(`${item.rango.IPInicio} – ${item.rango.IPFin}`)}</td>
                <td><button type="button" class="btn-usar-ip" data-ip-disponible="${item.ip}">Usar IP</button></td>
            </tr>`).join('');

        const ejemplo = libres.length ? libres[0].ip : `${segmento}.10`;

        /* Desglose del rango: por qué un host del rango no aparece como libre.
           Nunca se descuenta por "estar reservado": eso es el rango mismo. */
        const bloqueos = [
            usadosEnRango ? `${usadosEnRango} en uso` : '',
            redEnRango ? `${redEnRango} de la red del cliente` : ''
        ].filter(Boolean).join(' · ');
        const resumenBloqueo = bloqueos
            ? `Del rango: ${bloqueos}`
            : 'Ninguna dirección del rango está en uso';
        const vacias = `No hay IPs libres en ${escaparHTML(segmento)}.0/24 dentro del rango autorizado${
            bloqueos ? `: ${escaparHTML(bloqueos)}` : ''
        }. Libera una dirección o amplía el rango en «Rangos IP».`;

        /* Las que sí están tomadas se listan aparte y con dueño: así se ve de
           un golpe que lo que falta es un equipo/dispositivo concreto y no una
           «reserva» del rango (el rango sólo autoriza, nunca bloquea). */
        const filasOcupadas = ocupadas.map(item => `<tr>
                <td><code>${escaparHTML(item.ip)}</code></td>
                <td>${item.motivo}</td>
            </tr>`).join('');
        const detalleOcupadas = ocupadas.length
            ? `<details class="ips-ocupadas">
                    <summary>${ocupadas.length} dirección(es) del rango ya están en uso o son de la red del cliente</summary>
                    <div class="ips-disponibles-lista">
                        <table class="tabla-ips-disponibles">
                            <thead><tr><th>Dirección IP</th><th>Motivo</th></tr></thead>
                            <tbody>${filasOcupadas}</tbody>
                        </table>
                    </div>
               </details>`
            : '';

        await Swal.fire({
            ...comun,
            html: `
                <p class="ips-disponibles-resumen">
                    <strong>${libres.length}</strong> libres de ${autorizados.size} host(s) del rango
                    <span>${escaparHTML(resumenBloqueo)}</span>
                </p>
                ${notaHTML}
                <label for="buscar-ip-libre" class="ips-busqueda">Buscar IP libre</label>
                <input id="buscar-ip-libre" type="search" class="swal2-input"
                    placeholder="Ej. ${ejemplo} o ${ejemplo.split('.').pop()}">
                ${libres.length
                    ? `<div class="ips-disponibles-lista">
                        <table class="tabla-ips-disponibles">
                            <thead><tr><th>Dirección IP</th><th>Rango</th><th></th></tr></thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>`
                    : `<p class="ips-disponibles-vacias">${vacias}</p>`}
                ${detalleOcupadas}
            `,
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
   ROL AUTOMÁTICO A PARTIR DE LA IP

   Si la IP capturada cae dentro de un rango declarado con un perfil
   concreto, ese perfil se selecciona solo. Cuando el rango es heredado
   (sin perfil) o hay varios perfiles compatibles, no se toca la elección
   y se explica por qué.
   ========================================================= */
const hintRolIP = document.getElementById('hint-rol-ip');
let tokenRolIP = 0;

function mostrarHintRol(texto, clase) {
    if (!hintRolIP) return;
    if (!texto) {
        hintRolIP.textContent = '';
        hintRolIP.className = 'ayuda-rango oculto';
        return;
    }
    hintRolIP.textContent = texto;
    hintRolIP.className = `ayuda-rango ${clase || 'neutra'}`;
}

async function inferirRolPorIP() {
    const token = ++tokenRolIP;
    const idCliente = parseInt(selectCli.value, 10);
    const ip = inputIP.value.trim();

    if (selectTipoIP.value !== 'Estatica' || !idCliente || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
        mostrarHintRol(null);
        return;
    }

    const listaRangos = await rangosDelCliente(idCliente);
    if (token !== tokenRolIP) return;
    if (!listaRangos.length) { mostrarHintRol(null); return; }

    const valor = ipValorEntero(ip);
    if (valor === null) { mostrarHintRol(null); return; }

    const rangosQueCubren = listaRangos.filter(r => {
        const inicio = ipValorEntero(r.IPInicio);
        const fin = ipValorEntero(r.IPFin);
        return inicio !== null && fin !== null && valor >= inicio && valor <= fin;
    });
    if (!rangosQueCubren.length) {
        mostrarHintRol('La IP no cae en ningún rango declarado: elige el rol manualmente.', 'neutra');
        return;
    }

    const idsPerfil = [...new Set(
        rangosQueCubren.map(r => Number(r.IdRolEquipo) || 0).filter(Boolean)
    )];

    if (!idsPerfil.length) {
        mostrarHintRol('La IP cae en un rango heredado (sin perfil): elige el rol manualmente.', 'neutra');
        return;
    }
    if (idsPerfil.length > 1) {
        mostrarHintRol('La IP cae en varios rangos con perfiles distintos: elige el rol manualmente.', 'alerta');
        return;
    }

    const idRol = idsPerfil[0];
    const rol = roles.find(r => Number(r.IdRolEquipo) === idRol);
    const nombreRol = rol ? (rol.Nombre || rol.Codigo) : `perfil ${idRol}`;

    if (String(selectRol.value) !== String(idRol)) {
        selectRol.value = String(idRol);
        actualizarPreviewHostname();
    }
    mostrarHintRol(`Rol inferido por la IP: ${nombreRol}.`, 'ok');
}

/* =========================================================
   BUSCADOR
   ========================================================= */
inputBusqueda.addEventListener('input', () => {
    filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
    btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
    pagEquipos.reiniciar();
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
    pagEquipos.reiniciar();
    renderTabla();
    inputBusqueda.focus();
});

btnLimpiarFiltro.addEventListener('click', () => {
    inputBusqueda.value = '';
    filtroBusqueda = '';
    btnLimpiarBusq.classList.add('oculto');
    pagEquipos.reiniciar();
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

/**
 * Buscador de la tabla: compara término por término contra cada campo (en vez
 * de concatenar todo en una sola cadena), de modo que buscar una IP, un número
 * de host o varios criterios separados por espacios funciona siempre.
 */
function tokensDeBusqueda(texto) {
    return String(texto || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function camposBuscablesEquipo(e) {
    return [
        e.Hostname, e.ClienteCodigo, e.ClienteNombre, e.PisoNombre,
        e.RolCodigo, e.RolNombre, e.IP, e.UsuarioAdmin, e.TipoIP,
        e.NumeroHost != null ? String(e.NumeroHost) : ''
    ]
        .filter(valor => valor !== null && valor !== undefined && String(valor).trim() !== '')
        .map(valor => String(valor).toLowerCase());
}

function coincideBusquedaEquipo(e, tokens) {
    if (!tokens.length) return true;
    const campos = camposBuscablesEquipo(e);
    return tokens.every(token => {
        const compacto = token.replace(/[^a-z0-9]/g, '');
        return campos.some(campo =>
            campo.includes(token) ||
            (compacto !== '' && campo.replace(/[^a-z0-9]/g, '').includes(compacto))
        );
    });
}

function pintarTablaEquipos() {
    contenedorGrupos.innerHTML = '';

    const tokensFiltro = tokensDeBusqueda(filtroBusqueda);
    const listaFiltrada = equipos.filter(e => coincideBusquedaEquipo(e, tokensFiltro));

    if (listaFiltrada.length === 0) {
        sinResultados.classList.remove('oculto');
        pagEquipos.mostrar(false);
        return;
    }
    sinResultados.classList.add('oculto');
    pagEquipos.mostrar(true);

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

    pagEquipos.recortar(clientesOrdenados).forEach(grupoCliente => {
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
    mostrarHintRol(null);
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

    /* Al editar se respeta lo guardado; sólo se completa lo que esté vacío
       con el único valor disponible en el catálogo del cliente. */
    autollenarConfiguracionDelCliente();
    mostrarHintRol(null);

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
   AVISO DE RANGO EN EL FORMULARIO DEL EQUIPO

   La administración de rangos IP vive en su propia ventana
   (rangos.html · Rangos IP por cliente). Aquí sólo queda el
   aviso que valida la IP capturada contra los rangos ya
   declarados para el cliente y perfil seleccionados.
   ========================================================= */

const hintRangoIP = document.getElementById('hint-rango-ip');
let tokenValidacionRango = 0;


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

/* La administración de rangos IP se abrió en su propia ventana: aquí sólo
   navegamos a ella (mismo patrón que «Inventario IP»). */
document.getElementById('btn-rangos-ip')
    .addEventListener('click', () => window.api.navegarModulo('rangos_ip'));

inputIP.addEventListener('input', actualizarHintRango);
inputIP.addEventListener('blur', actualizarHintRango);
selectCli.addEventListener('change', actualizarHintRango);
selectRol.addEventListener('change', actualizarHintRango);

/* Al capturar la IP se deduce el rol desde los rangos declarados. */
inputIP.addEventListener('input', inferirRolPorIP);
inputIP.addEventListener('blur', inferirRolPorIP);

/* =========================================================
   IMPORTACIÓN PASIVA

   El usuario pega una lista de hostnames (AGT-TALA29, SPR-TALA153…).
   De cada token se deducen tres cosas:
     · el rol      → el prefijo (AGT, SPR…)
     · el cliente  → el código intermedio (TALA…)
     · el host     → los dígitos finales
   Con el rol y los rangos declarados del cliente se resuelve el segmento
   y la IP exacta. Nada se crea hasta que la vista previa está en verde.
   ========================================================= */

const modalPasiva    = document.getElementById('modal-importacion-pasiva');
const btnPasiva      = document.getElementById('btn-importacion-pasiva');
const pasCliente     = document.getElementById('ipas-cliente');
const pasPiso        = document.getElementById('ipas-piso');
const pasDominio     = document.getElementById('ipas-dominio');
const pasPassword    = document.getElementById('ipas-password');
const pasMascara     = document.getElementById('ipas-mascara');
const pasPuerta      = document.getElementById('ipas-puerta');
const pasDns1        = document.getElementById('ipas-dns1');
const pasDns2        = document.getElementById('ipas-dns2');
const pasTexto       = document.getElementById('ipas-texto');
const pasPreview     = document.getElementById('ipas-preview');
const pasMensaje     = document.getElementById('ipas-mensaje');
const pasImportar    = document.getElementById('ipas-importar');

/* ROL-CLIENTE##  →  AGT-TALA29 */
const RE_TOKEN_PASIVA = /^([A-Za-z0-9]+)-(.+)$/;

/** Códigos de cliente del catálogo en mayúsculas (desempata códigos con dígitos). */
function codigosDeCliente() {
    return new Set(clientes.map(c => String(c.Codigo || '').toUpperCase()).filter(Boolean));
}

/**
 * Descompone un token de la lista pasiva en rol, cliente y número de host.
 *
 * La regla es «ROL-CLIENTE + octeto final» (AGT-TALA29 → AGT · TALA · 29), así
 * que los dígitos finales SIEMPRE son el número de host y nunca parte del
 * código del cliente (el patrón anterior era codicioso y leía TALA2 + 9). Sólo
 * cuando el código que queda a la izquierda no existe en el catálogo se prueba
 * la lectura anclada al cliente elegido, única forma de respetar códigos que
 * terminan en dígitos (p. ej. TALA2 → AGT-TALA229).
 */
function descomponerTokenPasiva(token, codigoElegido) {
    const base = RE_TOKEN_PASIVA.exec(String(token ?? '').trim());
    if (!base) return null;

    const rol = base[1].toUpperCase();
    const resto = base[2];
    const conocidos = codigosDeCliente();
    const elegido = String(codigoElegido || '').toUpperCase();

    /* Se puntúan las tres lecturas posibles (1, 2 o 3 dígitos finales como
       número de host). Gana la que coincide con el cliente elegido en el
       formulario, después la que existe en el catálogo y, en empate, la que
       deja más dígitos como host — así AGT-TALA29 nunca se lee como TALA2 + 9. */
    const candidatos = [];
    for (let digitos = 1; digitos <= 3; digitos++) {
        const cola = resto.slice(-digitos);
        if (!/^\d+$/.test(cola)) break;
        const codigo = resto.slice(0, resto.length - digitos).toUpperCase();
        if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(codigo)) continue;
        candidatos.push({
            rol,
            cliente: codigo,
            host: Number(cola),
            puntaje: (codigo === elegido ? 30 : 0)
                + (conocidos.has(codigo) ? 20 : 0)
                + digitos
        });
    }
    if (!candidatos.length) return null;

    const mejor = candidatos.reduce((a, b) => (b.puntaje > a.puntaje ? b : a));
    return { rol: mejor.rol, cliente: mejor.cliente, host: mejor.host };
}

let filasPasivas = [];
let importandoPasiva = false;
let temporizadorPasiva = null;
let pasPisosCliente = [];

function mostrarMensajePasiva(texto, tipo) {
    if (!pasMensaje) return;
    if (!texto) { pasMensaje.className = 'alert oculto'; pasMensaje.textContent = ''; return; }
    pasMensaje.textContent = texto;
    pasMensaje.className = `alert ${tipo || 'info'}`;
}

function tokensDeListaPasiva(texto) {
    return String(texto || '')
        .split(/[\s,;]+/)
        .map(token => token.trim())
        .filter(Boolean);
}

async function cargarPisosPasiva(idCliente) {
    if (!pasPiso) return;
    if (!idCliente) {
        pasPiso.innerHTML = '<option value="">-- Selecciona un cliente --</option>';
        pasPiso.disabled = true;
        pasPisosCliente = [];
        return;
    }
    try {
        const todos = await window.api.pisos.listar();
        pasPisosCliente = (todos || []).filter(p =>
            (p.clientes || []).some(c => Number(c.IdCliente) === Number(idCliente))
        );
        pasPiso.disabled = false;
        pasPiso.innerHTML = '<option value="">-- Selecciona --</option>';
        pasPisosCliente
            .slice()
            .sort((a, b) => String(a.Nombre).localeCompare(String(b.Nombre)))
            .forEach(p => {
                const opt = document.createElement('option');
                opt.value = String(p.IdPiso);
                opt.textContent = p.Nombre;
                pasPiso.appendChild(opt);
            });
        if (pasPisosCliente.length === 1) pasPiso.value = String(pasPisosCliente[0].IdPiso);
        if (pasPisosCliente.length === 0) {
            const opt = document.createElement('option');
            opt.value = ''; opt.disabled = true;
            opt.textContent = 'Este cliente no tiene pisos asignados.';
            pasPiso.appendChild(opt);
        }
    } catch (err) {
        toastError('No se pudieron cargar los pisos', err.message);
    }
}

async function cargarConfiguracionPasiva(idCliente) {
    if (!idCliente) {
        limpiarSelectConMensaje(pasMascara, '-- Selecciona un cliente --');
        limpiarSelectConMensaje(pasPuerta,  '-- Selecciona un cliente --');
        limpiarSelectConMensaje(pasDns1,    '-- Selecciona un cliente --');
        limpiarSelectConMensaje(pasDns2,    '-- Selecciona un cliente --');
        limpiarSelectConMensaje(pasDominio, '-- Selecciona un cliente --');
        pasPassword.value = '';
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

        llenarSelectConfig(pasMascara, mascaras, '-- Máscara --');
        llenarSelectConfig(pasPuerta,  puertas,  '-- Puerta de enlace --');
        llenarSelectConfig(pasDns1,    dns1s,    '-- DNS 1 --');
        llenarSelectConfig(pasDns2,    dns2s,    '-- DNS 2 (opcional) --');

        pasDominio.disabled = false;
        pasDominio.innerHTML = '<option value="">-- Dominio admin --</option>';
        (doms || []).forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.Usuario;
            opt.dataset.password = d.Password;
            opt.dataset.descripcion = d.Descripcion || '';
            opt.textContent = d.Descripcion ? `${d.Usuario} (${d.Descripcion})` : d.Usuario;
            pasDominio.appendChild(opt);
        });
        if (!doms || !doms.length) {
            const opt = document.createElement('option');
            opt.value = ''; opt.disabled = true;
            opt.textContent = 'Sin dominios. Agrégalo en el formulario de equipo.';
            pasDominio.appendChild(opt);
        }

        /* Igual que en el formulario: si el cliente tiene un único valor
           cargado, se elige solo para que el flujo sea de dos clics. */
        [pasMascara, pasPuerta, pasDns1, pasDns2, pasDominio].forEach(autoseleccionarUnico);
        sincronizarPasswordDominio(pasDominio, pasPassword);
    } catch (err) {
        console.error('[Equipos] Error cargando configuración de importación:', err);
        toastError('No se pudo cargar la configuración', err.message);
    }
}

/** Evalúa un token y devuelve la fila de la vista previa. */
async function evaluarTokenPasiva(token, contexto) {
    const fila = {
        token,
        hostname: token,
        clienteCodigo: '',
        rolCodigo: '',
        ip: '',
        idRolEquipo: null,
        idPiso: null,
        estado: 'error',
        detalle: ''
    };

    const { cliente, listaRangos } = contexto;
    const partes = descomponerTokenPasiva(token, cliente?.Codigo);
    if (!partes) {
        fila.detalle = 'Formato no reconocido (se espera ROL-CLIENTE29)';
        return fila;
    }

    fila.rolCodigo = partes.rol;
    fila.clienteCodigo = partes.cliente;
    const host = partes.host;

    const rol = roles.find(r => String(r.Codigo || '').toUpperCase() === fila.rolCodigo);
    if (!rol) {
        fila.detalle = `El rol «${fila.rolCodigo}» no existe en el catálogo`;
        return fila;
    }
    fila.idRolEquipo = Number(rol.IdRolEquipo);
    fila.rolCodigo = rol.Codigo;

    if (fila.clienteCodigo !== String(cliente.Codigo || '').toUpperCase()) {
        fila.detalle = `El hostname es de «${fila.clienteCodigo}» y el cliente elegido es «${cliente.Codigo}»`;
        return fila;
    }
    if (!Number.isInteger(host) || host < 1 || host > 254) {
        fila.detalle = 'El número de host debe estar entre 1 y 254';
        return fila;
    }

    fila.hostname = `${rol.Codigo}-${cliente.Codigo}${host}`;

    const aplicables = listaRangos.filter(r =>
        !r.IdRolEquipo || Number(r.IdRolEquipo) === fila.idRolEquipo
    );
    const candidatos = [];
    aplicables.forEach(r => {
        const inicio = ipValorEntero(r.IPInicio);
        const fin = ipValorEntero(r.IPFin);
        if (inicio === null || fin === null) return;
        const segmento = String(r.IPInicio || '').split('.').slice(0, 3).join('.');
        if (!/^\d{1,3}(\.\d{1,3}){2}$/.test(segmento)) return;
        const ip = `${segmento}.${host}`;
        const valor = ipValorEntero(ip);
        if (valor === null) return;
        if (valor >= inicio && valor <= fin) candidatos.push({ ip, segmento, rango: r });
    });

    if (!candidatos.length) {
        fila.detalle = aplicables.length
            ? `El host ${host} no cae en ningún rango autorizado del rol ${rol.Codigo}`
            : `El cliente no tiene rangos declarados para el rol ${rol.Codigo}`;
        return fila;
    }

    const ipsCandidatas = [...new Set(candidatos.map(c => c.ip))];
    if (ipsCandidatas.length > 1) {
        fila.detalle = 'Varios segmentos posibles: depura el rango en «Rangos IP»';
        return fila;
    }

    fila.ip = ipsCandidatas[0];
    const elegido = candidatos.find(c => c.ip === fila.ip);
    const segmento = elegido.segmento;
    fila.idPiso = elegido.rango.IdPiso != null ? Number(elegido.rango.IdPiso) : null;

    const hostLower = fila.hostname.toLowerCase();
    if (contexto.hostnamesExistentes.has(hostLower)) {
        fila.detalle = 'Ese hostname ya existe en el inventario';
        return fila;
    }
    if (contexto.vistosHostname.has(hostLower)) {
        fila.detalle = 'Hostname repetido dentro de la lista';
        return fila;
    }
    if (contexto.vistosIP.has(fila.ip)) {
        fila.detalle = 'IP repetida dentro de la lista';
        return fila;
    }

    /* La puerta de enlace y los DNS del cliente no son hosts libres aunque el
       rango los cubra: se descuentan igual que en la lupa. */
    const hostInfra = hostEnSegmento(fila.ip, segmento);
    if (hostInfra !== null &&
        hostsDeConfiguracionDelCliente(segmento, [pasMascara, pasPuerta, pasDns1, pasDns2]).has(hostInfra)) {
        fila.detalle = `La IP ${fila.ip} ya la usa la red del cliente (puerta de enlace o DNS)`;
        return fila;
    }

    /* Ocupado = en uso por un equipo activo o un dispositivo activo del
       control general. El rango sólo reserva la IP para el cliente, así que
       pertenecer al rango nunca deja la fila en rojo. */
    if (!contexto.ocupacionPorSegmento.has(segmento)) {
        const registros = await window.api.equipos
            .listarOcupacionSegmento(segmento, null)
            .then(lista => (Array.isArray(lista) ? lista : []))
            .catch(() => []);
        const porIP = new Map();
        registros.forEach(registro => {
            const ip = String(registro?.IP || '').trim();
            if (ip) porIP.set(ip, describirDuenoIP(registro));
        });
        contexto.ocupacionPorSegmento.set(segmento, porIP);
    }
    const duenoIP = contexto.ocupacionPorSegmento.get(segmento).get(fila.ip);
    if (duenoIP) {
        fila.detalle = `La IP ${fila.ip} ya está en uso por ${duenoIP}`;
        return fila;
    }

    contexto.vistosHostname.add(hostLower);
    contexto.vistosIP.add(fila.ip);
    fila.estado = 'ok';
    fila.detalle = 'Listo para crear';
    return fila;
}

/** Nombre legible del piso dentro del modal de importación pasiva. */
function nombrePisoPasiva(idPiso) {
    if (idPiso == null || idPiso === '') return '';
    const piso = pasPisosCliente.find(p => Number(p.IdPiso) === Number(idPiso));
    return piso ? String(piso.Nombre) : `Piso ${idPiso}`;
}

/** Explica en qué piso terminarán los equipos y avisa de rangos incoherentes. */
function resumenPisoPasiva(pendientes) {
    const conPiso = pendientes.map(f => f.idPiso).filter(id => id != null);
    const pisos = [...new Set(conPiso)];
    const sinPiso = pendientes.some(f => f.idPiso == null);
    const elegido = parseInt(pasPiso.value, 10) || null;

    if (!pendientes.length) return { texto: '', tipo: 'info' };

    if (elegido) {
        const otros = pisos.filter(id => Number(id) !== Number(elegido));
        const base = `Piso elegido: ${nombrePisoPasiva(elegido)}`;
        if (otros.length) {
            return {
                texto: `${base} · Ojo: el rango de ${otros.map(nombrePisoPasiva).join(', ')} apunta a otro piso`,
                tipo: 'aviso'
            };
        }
        return { texto: base, tipo: 'ok' };
    }

    if (pisos.length > 1) {
        return {
            texto: `Los rangos apuntan a pisos distintos (${pisos.map(nombrePisoPasiva).join(', ')}): elige un piso arriba`,
            tipo: 'aviso'
        };
    }
    if (pisos.length === 1 && !sinPiso) {
        return { texto: `Piso del rango: ${nombrePisoPasiva(pisos[0])}`, tipo: 'ok' };
    }
    return { texto: 'Los rangos no definen piso: elige un piso arriba', tipo: 'aviso' };
}

function renderPreviewPasiva() {
    if (!pasPreview) return;

    if (!filasPasivas.length) {
        pasPreview.innerHTML = '';
        pasImportar.disabled = true;
        return;
    }

    const pendientes = filasPasivas.filter(f => f.estado === 'ok');
    const resumenPiso = resumenPisoPasiva(pendientes);
    const cuerpo = filasPasivas.map(fila => `
        <tr${fila.estado === 'ok' ? '' : ' class="fila-invalida"'}>
            <td data-label="Hostname"><code class="rango-ip">${escaparHTML(fila.hostname || fila.token)}</code></td>
            <td data-label="Cliente">${escaparHTML(fila.clienteCodigo || '—')}</td>
            <td data-label="Rol">${escaparHTML(fila.rolCodigo || '—')}</td>
            <td data-label="IP inferida">${fila.ip ? `<code class="rango-ip">${escaparHTML(fila.ip)}</code>` : '—'}</td>
            <td data-label="Piso">${escaparHTML(nombrePisoPasiva(fila.idPiso) || '—')}</td>
            <td data-label="Estado">${fila.estado === 'ok'
                ? '<span class="rango-general">Listo</span>'
                : `<span class="rango-motivo">${escaparHTML(fila.detalle || 'Revisar')}</span>`}</td>
        </tr>`).join('');

    pasPreview.innerHTML = `
        <div class="rangos-resumen">
            <span class="grupo-count">${pendientes.length} de ${filasPasivas.length} listos</span>
            ${resumenPiso.texto ? `<span class="ipas-destino ${resumenPiso.tipo === 'aviso' ? 'ipas-destino-aviso' : ''}">${escaparHTML(resumenPiso.texto)}</span>` : ''}
        </div>
        <table class="rangos-tabla">
            <thead>
                <tr>
                    <th>Hostname</th>
                    <th>Cliente</th>
                    <th>Rol</th>
                    <th>IP inferida</th>
                    <th>Piso</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>${cuerpo}</tbody>
        </table>`;

    pasImportar.disabled = pendientes.length === 0 || importandoPasiva;
}

async function construirFilasPasivas() {
    const tokens = tokensDeListaPasiva(pasTexto.value);
    filasPasivas = [];

    if (!tokens.length) { mostrarMensajePasiva(null); renderPreviewPasiva(); return; }

    const idCliente = parseInt(pasCliente.value, 10);
    if (!idCliente) {
        filasPasivas = tokens.map(token => ({
            token, hostname: token, clienteCodigo: '', rolCodigo: '',
            ip: '', idRolEquipo: null, estado: 'error',
            detalle: 'Selecciona primero el cliente'
        }));
        renderPreviewPasiva();
        return;
    }

    const cliente = clientes.find(c => Number(c.IdCliente) === idCliente);
    if (!cliente) { renderPreviewPasiva(); return; }

    const listaRangos = await rangosDelCliente(idCliente);
    const contexto = {
        cliente,
        listaRangos,
        hostnamesExistentes: new Set(equipos.map(e => String(e.Hostname || '').toLowerCase())),
        ocupacionPorSegmento: new Map(),
        vistosHostname: new Set(),
        vistosIP: new Set()
    };

    for (const token of tokens) {
        filasPasivas.push(await evaluarTokenPasiva(token, contexto));
    }
    mostrarMensajePasiva(null);
    renderPreviewPasiva();
}

function programarPreviewPasiva() {
    clearTimeout(temporizadorPasiva);
    temporizadorPasiva = setTimeout(() => { construirFilasPasivas(); }, 250);
}

function abrirModalPasiva() {
    if (!modalPasiva) return;
    filasPasivas = [];
    importandoPasiva = false;
    pasTexto.value = '';
    pasPassword.value = '';
    mostrarMensajePasiva(null);
    renderPreviewPasiva();

    pasCliente.innerHTML = '<option value="">-- Selecciona --</option>';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.IdCliente);
        opt.textContent = c.Nombre ? `${c.Nombre} (${c.Codigo})` : c.Codigo;
        pasCliente.appendChild(opt);
    });
    limpiarSelectConMensaje(pasPiso, '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(pasMascara, '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(pasPuerta,  '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(pasDns1,    '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(pasDns2,    '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(pasDominio, '-- Selecciona un cliente primero --');

    modalPasiva.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => pasCliente.focus(), 60);
}

function cerrarModalPasiva() {
    if (!modalPasiva) return;
    modalPasiva.style.display = 'none';
    document.body.style.overflow = '';
    mostrarMensajePasiva(null);
}

function setImportandoPasiva(valor) {
    importandoPasiva = valor;
    if (!pasImportar) return;
    pasImportar.disabled = valor;
    const texto = pasImportar.querySelector('.btn-text');
    const spinner = pasImportar.querySelector('.btn-spinner');
    if (texto) texto.textContent = valor ? 'Importando...' : 'Importar equipos';
    if (spinner) spinner.classList.toggle('oculto', !valor);
}

async function importarPasiva() {
    const idCliente = parseInt(pasCliente.value, 10);
    const pisoSeleccionado = parseInt(pasPiso.value, 10) || null;
    const usuarioAdmin = pasDominio.value;
    const passwordAdmin = pasPassword.value.trim();
    const mascara = pasMascara.value;
    const puertaEnlace = pasPuerta.value;
    const dns1 = pasDns1.value;
    const dns2 = pasDns2.value;

    if (!idCliente) { mostrarMensajePasiva('Selecciona el cliente.', 'error'); return; }
    if (!usuarioAdmin || !passwordAdmin) { mostrarMensajePasiva('Usuario admin y password son obligatorios.', 'error'); return; }
    if (!mascara || !puertaEnlace || !dns1) { mostrarMensajePasiva('Máscara, puerta de enlace y DNS 1 son obligatorios.', 'error'); return; }

    const pendientes = filasPasivas.filter(f => f.estado === 'ok');
    if (!pendientes.length) { mostrarMensajePasiva('No hay filas válidas para importar.', 'error'); return; }

    /* El piso elegido a mano manda; si no se eligió, se toma el del rango. */
    let idPiso = pisoSeleccionado;
    if (!idPiso) {
        const pisosDeLosRangos = [...new Set(
            pendientes.map(f => f.idPiso).filter(id => id != null)
        )];
        if (pisosDeLosRangos.length === 1) {
            idPiso = Number(pisosDeLosRangos[0]);
        } else if (pisosDeLosRangos.length > 1) {
            mostrarMensajePasiva(
                `Los rangos apuntan a pisos distintos (${pisosDeLosRangos.map(nombrePisoPasiva).join(', ')}). Elige arriba el piso que se aplicará a todos.`,
                'error'
            );
            return;
        } else {
            mostrarMensajePasiva('Selecciona el piso al que se asignarán los equipos.', 'error');
            return;
        }
    }

    const nombrePisoDestino = nombrePisoPasiva(idPiso);


    const confirmacion = await Swal.fire({
        icon: 'question',
        title: `¿Importar ${pendientes.length} equipo(s)?`,
        html: `<div style="text-align:left;font-size:0.9rem;">
            Se crearán <b>${pendientes.length}</b> equipos estáticos en <b>${escaparHTML(nombrePisoDestino)}</b>.
            <div style="background:#F4F6F0;padding:10px;border-radius:6px;border-left:3px solid #516848;margin-top:10px;max-height:180px;overflow:auto;">
                ${pendientes.map(f => `${escaparHTML(f.hostname)} — <code>${escaparHTML(f.ip)}</code>`).join('<br>')}
            </div></div>`,
        showCancelButton: true,
        confirmButtonText: 'Sí, importar',
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

    setImportandoPasiva(true);
    mostrarMensajePasiva(null);

    let creados = 0;
    const errores = [];

    for (const fila of pendientes) {
        const datos = {
            idCliente,
            idPiso,
            idRolEquipo: fila.idRolEquipo,
            tipoIP: 'Estatica',
            hostname: fila.hostname,
            numeroHost: Number(String(fila.ip).split('.').pop()),
            ip: fila.ip,
            mascara,
            puertaEnlace,
            dns1,
            dns2: dns2 || null,
            usuarioAdmin,
            passwordAdmin,
            activo: true
        };
        try {
            const res = await window.api.equipos.crear(datos);
            if (res && res.ok) creados += 1;
            else errores.push(`${fila.hostname}: ${res?.mensaje || 'Error desconocido'}`);
        } catch (err) {
            errores.push(`${fila.hostname}: ${err.message}`);
        }
    }

    setImportandoPasiva(false);
    await recargarEquipos();

    if (errores.length) {
        pasTexto.value = errores.map(texto => texto.split(':')[0]).join('\n');
        await construirFilasPasivas();
        mostrarMensajePasiva(
            `Se crearon ${creados} equipo(s). ${errores.length} con error — revisa la lista: ${errores[0]}`,
            'error'
        );
        toastError(`Se importaron ${creados} equipos`, `${errores.length} con error`);
    } else {
        pasTexto.value = '';
        filasPasivas = [];
        renderPreviewPasiva();
        mostrarMensajePasiva(`Se importaron ${creados} equipo(s) correctamente.`, 'ok');
        toastExito(`${creados} equipo(s) importados`);
    }
}

if (btnPasiva) btnPasiva.addEventListener('click', abrirModalPasiva);
if (document.getElementById('ipas-cerrar')) document.getElementById('ipas-cerrar').addEventListener('click', cerrarModalPasiva);
if (document.getElementById('ipas-cancelar')) document.getElementById('ipas-cancelar').addEventListener('click', cerrarModalPasiva);
if (modalPasiva) modalPasiva.addEventListener('click', (e) => { if (e.target === modalPasiva) cerrarModalPasiva(); });

if (pasCliente) {
    pasCliente.addEventListener('change', async () => {
        const id = parseInt(pasCliente.value, 10);
        await cargarPisosPasiva(id);
        await cargarConfiguracionPasiva(id);
        await construirFilasPasivas();
    });
}
if (pasDominio) pasDominio.addEventListener('change', () => sincronizarPasswordDominio(pasDominio, pasPassword));
if (pasPiso) pasPiso.addEventListener('change', renderPreviewPasiva);
if (pasTexto) pasTexto.addEventListener('input', programarPreviewPasiva);
if (pasImportar) pasImportar.addEventListener('click', importarPasiva);

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