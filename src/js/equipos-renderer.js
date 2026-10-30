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

/* =========================================================
   RENDERIZADORES DE BADGES
   ========================================================= */
function renderBadgeCliente(codigo, nombre = null) {
    const nombreHTML = nombre ? `<span class="nombre">${escaparHTML(nombre)}</span>` : '';
    return `<span class="badge-cliente" data-color="${String(codigo).toUpperCase()}">
                <span class="codigo">${escaparHTML(codigo)}</span>
                ${nombreHTML}
            </span>`;
}

function renderRolPill(codigo) {
    if (!codigo) return `<span class="rol-pill">—</span>`;
    return `<span class="rol-pill" data-color="${String(codigo).toUpperCase()}">${escaparHTML(codigo)}</span>`;
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

const btnGuardar    = document.getElementById('btn-guardar');
const seccionRed    = document.getElementById('seccion-red');

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
            opt.textContent = `${c.Codigo} - ${c.Nombre}`;
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
            opt.textContent = `${r.Codigo} - ${r.Nombre}`;
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

/* =========================================================
   MOSTRAR / OCULTAR SEGÚN TIPO DE IP
   ========================================================= */
function actualizarCamposSegunTipo() {
    const tipo = selectTipoIP.value;
    const esEstatica = tipo === 'Estatica';

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
    contenedorGrupos.innerHTML = '';

    const listaFiltrada = equipos.filter(e => {
        if (!filtroBusqueda) return true;
        const texto = [e.Hostname, e.ClienteCodigo, e.ClienteNombre, e.PisoNombre, e.RolCodigo, e.IP, e.UsuarioAdmin]
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
        divCliente.className = 'grupo-cliente colapsado';

        const headerCliente = document.createElement('div');
        headerCliente.className = 'grupo-cliente-header';
        headerCliente.innerHTML = `
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            ${renderBadgeCliente(grupoCliente.codigo, grupoCliente.nombre)}
            <span class="grupo-count">${grupoCliente.equipos.length} ${grupoCliente.equipos.length === 1 ? 'equipo' : 'equipos'}</span>
        `;
        headerCliente.addEventListener('click', () => divCliente.classList.toggle('colapsado'));
        divCliente.appendChild(headerCliente);

        const bodyCliente = document.createElement('div');
        bodyCliente.className = 'grupo-cliente-body';

        const tabla = document.createElement('table');
        tabla.className = 'data-table';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th style="width:22%;">Hostname</th>
                    <th style="width:10%;">Rol</th>
                    <th style="width:11%;">Tipo</th>
                    <th style="width:16%;">IP</th>
                    <th style="width:14%;">Piso</th>
                    <th style="width:19%;">Usuario admin</th>
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
                const rolHTML      = renderRolPill(e.RolCodigo);

                // Admin con el color de botón (Fondo oscuro, Letras claras)
                const adminHTML = e.UsuarioAdmin
                    ? `<span class="badge-admin" data-color="BOTON" title="${escaparHTML(e.UsuarioAdmin)}">${iconoUsuarioSVG()}${escaparHTML(e.UsuarioAdmin)}</span>`
                    : `<span class="badge-admin vacia">${iconoUsuarioSVG()}Sin asignar</span>`;

                tr.innerHTML = `
                    <td>${hostnameHTML}</td>
                    <td>${rolHTML}</td>
                    <td>${tipoBadge}</td>
                    <td>${ipHTML}</td>
                    <td>${pisoHTML}</td>
                    <td>${adminHTML}</td>
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
        idRangoIP:      null,
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
   INICIO
   ========================================================= */
(async () => {
    await cargarClientes();
    await cargarRoles();
    await recargarEquipos();
    limpiarResiduosSwal();
})();