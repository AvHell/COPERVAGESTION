/* =========================================================
   ESTADO
   ========================================================= */

let equipos = [];
let clientes = [];
let lugares = [];
let roles = [];
let dominios = [];
let filtroBusqueda = '';

let modoEdicion = false;
let idEditando = null;

/* =========================================================
   DOM
   ========================================================= */

const tabla         = document.getElementById('tabla-equipos');
const mensaje       = document.getElementById('mensaje');
const inputBusqueda = document.getElementById('input-busqueda');

const modalEquipo   = document.getElementById('modal-equipo');
const modalTitulo   = document.getElementById('modal-equipo-titulo');

const selectCli     = document.getElementById('cliente');
const selectLugar   = document.getElementById('lugar');
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

const Swal = window.Swal;

/* =========================================================
   NAVEGACIÓN
   ========================================================= */

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

/* =========================================================
   CARGA DE CATÁLOGOS BASE
   ========================================================= */

async function cargarClientes() {
    clientes = await window.api.clientes.listar();
    selectCli.innerHTML = '<option value="">-- Selecciona --</option>';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.IdCliente;
        opt.textContent = `${c.Codigo} - ${c.Nombre}`;
        selectCli.appendChild(opt);
    });
}

async function cargarRoles() {
    roles = await window.api.roles.listar();
    selectRol.innerHTML = '<option value="">-- Selecciona --</option>';
    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.IdRolEquipo;
        opt.textContent = `${r.Codigo} - ${r.Nombre}`;
        selectRol.appendChild(opt);
    });
}

async function cargarLugaresDelCliente(idCliente) {
    const todos = await window.api.lugares.listar();
    lugares = todos.filter(l => l.IdCliente === idCliente);
    selectLugar.innerHTML = '<option value="">-- Selecciona --</option>';
    lugares.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.IdLugarCliente;
        opt.textContent = l.Nombre;
        selectLugar.appendChild(opt);
    });
}

/* =========================================================
   CARGA DE CONFIGURACIONES DEL CLIENTE
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
        const mascaras = await window.api.config.listarPorClienteTipo(idCliente, 'Mascara');
        const puertas  = await window.api.config.listarPorClienteTipo(idCliente, 'PuertaEnlace');
        const dns1s    = await window.api.config.listarPorClienteTipo(idCliente, 'DNS1');
        const dns2s    = await window.api.config.listarPorClienteTipo(idCliente, 'DNS2');
        const doms     = await window.api.dominios.listarPorCliente(idCliente);

        dominios = doms;

        llenarSelectConfig(selectMascara, mascaras, '-- Máscara --', idCliente);
        llenarSelectConfig(selectPuerta,  puertas,  '-- Puerta de enlace --', idCliente);
        llenarSelectConfig(selectDNS1,    dns1s,    '-- DNS 1 --', idCliente);
        llenarSelectConfig(selectDNS2,    dns2s,    '-- DNS 2 (opcional) --', idCliente);

        // Dominios
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
            opt.value = '';
            opt.disabled = true;
            opt.textContent = 'Sin dominios. Haz clic en + para agregar uno.';
            selectDominio.appendChild(opt);
        }
    } catch (err) {
        console.error('❌ ERROR en cargarConfiguracionesDelCliente:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error al cargar configuraciones',
            text: err.message
        });
    }
}

function limpiarSelectConMensaje(select, mensaje) {
    select.innerHTML = `<option value="">${mensaje}</option>`;
    select.disabled = true;
}

function llenarSelectConfig(select, items, placeholder, idCliente) {
    select.disabled = false;
    select.innerHTML = `<option value="">${placeholder}</option>`;

    if (items.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
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
   AGREGAR VALOR AL CATÁLOGO DESDE EL BOTÓN +
   ========================================================= */

async function agregarConfigRed(tipo, selectTarget) {
    const idCliente = parseInt(selectCli.value, 10);
    if (!idCliente) {
        Swal.fire({ icon: 'warning', title: 'Sin cliente', text: 'Primero selecciona un cliente.' });
        return;
    }

    const nombresTipo = {
        'Mascara': 'máscara',
        'PuertaEnlace': 'puerta de enlace',
        'DNS1': 'DNS 1',
        'DNS2': 'DNS 2'
    };

    const { value: formValues } = await Swal.fire({
        title: `Agregar ${nombresTipo[tipo]}`,
        html: `
            <input id="swal-valor" class="swal2-input" placeholder="Valor (ej. 192.168.111.10)">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción (ej. DNS NU piso 2)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'swal-config' },
        preConfirm: () => {
            const valor = document.getElementById('swal-valor').value.trim();
            const desc = document.getElementById('swal-desc').value.trim();
            if (!valor) {
                Swal.showValidationMessage('El valor es obligatorio');
                return false;
            }
            return { valor, desc };
        }
    });

    if (formValues) {
        const res = await window.api.config.crear(idCliente, tipo, formValues.valor, formValues.desc);
        if (res.ok) {
            await cargarConfiguracionesDelCliente(idCliente);
            selectTarget.value = formValues.valor;
            Swal.fire({ icon: 'success', title: 'Agregado', timer: 1200, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.mensaje });
        }
    }
}

async function agregarDominio(selectTarget) {
    const idCliente = parseInt(selectCli.value, 10);
    if (!idCliente) {
        Swal.fire({ icon: 'warning', title: 'Sin cliente', text: 'Primero selecciona un cliente.' });
        return;
    }

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
        customClass: { popup: 'swal-config' },
        preConfirm: () => {
            const usuario = document.getElementById('swal-usuario').value.trim();
            const password = document.getElementById('swal-password').value;
            const desc = document.getElementById('swal-desc').value.trim();
            if (!usuario || !password) {
                Swal.showValidationMessage('Usuario y password son obligatorios');
                return false;
            }
            return { usuario, password, desc };
        }
    });

    if (formValues) {
        const res = await window.api.dominios.crear(idCliente, formValues.usuario, formValues.password, formValues.desc);
        if (res.ok) {
            await cargarConfiguracionesDelCliente(idCliente);
            selectTarget.value = formValues.usuario;
            inputPassword.value = formValues.password;
            Swal.fire({ icon: 'success', title: 'Agregado', timer: 1200, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.mensaje });
        }
    }
}

/* =========================================================
   COMPORTAMIENTO DINÁMICO
   ========================================================= */

selectCli.addEventListener('change', async () => {
    const id = parseInt(selectCli.value, 10);

    if (id) {
        await cargarLugaresDelCliente(id);
        await cargarConfiguracionesDelCliente(id);
    } else {
        selectLugar.innerHTML = '<option value="">-- Selecciona --</option>';
        await cargarConfiguracionesDelCliente(null);
    }

    actualizarPreviewHostname();
});

selectRol.addEventListener('change', actualizarPreviewHostname);

selectDominio.addEventListener('change', () => {
    const opt = selectDominio.options[selectDominio.selectedIndex];
    inputPassword.value = (opt && opt.dataset.password) ? opt.dataset.password : '';
});

// Botones +
document.querySelectorAll('.btn-agregar-mini[data-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
        const tipo = btn.dataset.tipo;
        const targetId = btn.dataset.target;
        agregarConfigRed(tipo, document.getElementById(targetId));
    });
});

document.getElementById('btn-nuevo-dominio').addEventListener('click', () => agregarDominio(selectDominio));

selectTipoIP.addEventListener('change', actualizarCamposSegunTipo);

function actualizarCamposSegunTipo() {
    const tipo = selectTipoIP.value;
    if (tipo === 'DHCP') {
        campoHostEst.classList.add('campo-oculto');
        campoHostDHCP.classList.remove('campo-oculto');
        bloqueEstatico.style.display = 'none';
        filaCheckbox.style.display = 'none';    // En DHCP no aplica
    } else {
        campoHostEst.classList.remove('campo-oculto');
        campoHostDHCP.classList.add('campo-oculto');
        bloqueEstatico.style.display = 'block';
        filaCheckbox.style.display = 'flex';    // En estático sí aplica
    }
}

/* =========================================================
   HOSTNAME MANUAL
   ========================================================= */

chkHostnameManual.addEventListener('change', () => {
    const manual = chkHostnameManual.checked;

    if (manual) {
        // Habilitar edición del hostname
        inputHostPreview.readOnly = false;
        inputHostPreview.focus();
        inputHostPreview.placeholder = 'Escribe el hostname manualmente...';
    } else {
        // Volver a modo automático
        inputHostPreview.readOnly = true;
        inputHostPreview.placeholder = 'Se armará automáticamente...';
        // Re-armar desde la regla
        actualizarPreviewHostname();
    }
});

/* =========================================================
   INPUT IP CON PUNTOS AUTOMÁTICOS
   ========================================================= */

function configurarInputIP(input) {
    input.addEventListener('input', () => {
        let valor = input.value.replace(/[^0-9.]/g, '');
        const partes = valor.split('.').slice(0, 4);
        const partesLimpias = partes.map(p => p.slice(0, 3));
        valor = partesLimpias.join('.');

        if (partesLimpias.length < 4) {
            const ultima = partesLimpias[partesLimpias.length - 1];
            const puntoYaEscrito = input.value.endsWith('.');
            if (ultima.length === 3 && !puntoYaEscrito) {
                valor = valor + '.';
            }
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

/* =========================================================
   CONSTRUIR HOSTNAME
   ========================================================= */

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
    // Si el checkbox está marcado, NO tocar el hostname
    if (chkHostnameManual.checked) {
        // Solo actualizar número host
        actualizarNumeroHost();
        return;
    }

    const idRol = parseInt(selectRol.value, 10);
    const idCli = parseInt(selectCli.value, 10);
    const ip = inputIP.value.trim();

    inputHostPreview.value = construirHostname(idRol, idCli, ip);
    actualizarNumeroHost();
}

function actualizarNumeroHost() {
    const ip = inputIP.value.trim();
    const partes = ip.split('.');
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
    renderTabla();
});

/* =========================================================
   RENDER TABLA
   ========================================================= */

async function recargarEquipos() {
    equipos = await window.api.equipos.listar();
    renderTabla();
}

function renderTabla() {
    tabla.innerHTML = '';

    const listaFiltrada = equipos.filter(e => {
        if (!filtroBusqueda) return true;
        const texto = [e.Hostname, e.ClienteCodigo, e.ClienteNombre, e.LugarNombre, e.IP]
            .filter(Boolean).join(' ').toLowerCase();
        return texto.includes(filtroBusqueda);
    });

    if (listaFiltrada.length === 0) {
        tabla.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:30px;">
            ${filtroBusqueda ? 'Sin resultados para tu búsqueda' : 'Sin equipos registrados'}
        </td></tr>`;
        return;
    }

    listaFiltrada.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${e.Hostname}</strong></td>
            <td>${e.ClienteCodigo}</td>
            <td>${e.LugarNombre}</td>
            <td>${e.RolCodigo}</td>
            <td>${e.TipoIP}</td>
            <td>${e.IP ?? '-'}</td>
            <td class="acciones-tabla"></td>
        `;
        const celda = tr.querySelector('.acciones-tabla');

        const btnEditar = document.createElement('button');
        btnEditar.textContent = 'Editar';
        btnEditar.className = 'secundario';
        btnEditar.addEventListener('click', () => abrirEdicion(e.IdEquipo));

        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.className = 'peligro';
        btnEliminar.addEventListener('click', () => eliminarEquipo(e.IdEquipo, e.Hostname));

        celda.appendChild(btnEditar);
        celda.appendChild(btnEliminar);
        tabla.appendChild(tr);
    });
}

/* =========================================================
   MODAL
   ========================================================= */

function abrirModal() { modalEquipo.style.display = 'flex'; }
function cerrarModal() { modalEquipo.style.display = 'none'; ocultarMensaje(); }

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
});

function limpiarFormulario() {
    selectCli.value = '';
    selectLugar.innerHTML = '<option value="">-- Selecciona --</option>';
    selectRol.value = '';
    selectTipoIP.value = 'Estatica';
    limpiarSelectConMensaje(selectMascara, '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(selectPuerta,  '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(selectDNS1,    '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(selectDNS2,    '-- Selecciona un cliente primero --');
    limpiarSelectConMensaje(selectDominio, '-- Selecciona un cliente primero --');

    // Reset checkbox hostname manual
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
    if (!e) {
        Swal.fire({ icon: 'error', title: 'No encontrado', text: 'Cierra y vuelve a abrir la ventana.' });
        return;
    }

    modoEdicion = true;
    idEditando = e.IdEquipo;
    modalTitulo.textContent = 'Editar equipo';

    // Reset checkbox manual (por defecto OFF al abrir)
    chkHostnameManual.checked = false;
    inputHostPreview.readOnly = true;
    inputHostPreview.placeholder = 'Se armará automáticamente...';

    selectCli.value = e.IdCliente;
    await cargarLugaresDelCliente(e.IdCliente);
    selectLugar.value = e.IdLugarCliente;

    await cargarConfiguracionesDelCliente(e.IdCliente);

    selectRol.value = e.IdRolEquipo;
    selectTipoIP.value = e.TipoIP;
    actualizarCamposSegunTipo();

    if (e.TipoIP === 'Estatica') {
        inputIP.value = e.IP ?? '';
        inputNumHost.value = e.NumeroHost ?? '';
        inputHostPreview.value = e.Hostname;
    } else {
        inputHostLibre.value = e.Hostname;
    }

    // Setear valores (con opción huérfana si no está)
    setSelectValorConHuerfano(selectMascara, e.Mascara);
    setSelectValorConHuerfano(selectPuerta,  e.PuertaEnlace);
    setSelectValorConHuerfano(selectDNS1,    e.DNS1);
    setSelectValorConHuerfano(selectDNS2,    e.DNS2);
    setSelectValorConHuerfano(selectDominio, e.UsuarioAdmin);

    inputPassword.value = e.PasswordAdmin ?? '';

    abrirModal();
    ocultarMensaje();
}

function setSelectValorConHuerfano(select, valor) {
    if (!valor) {
        select.value = '';
        return;
    }

    const existe = Array.from(select.options).some(o => o.value === valor);
    if (!existe) {
        const opt = document.createElement('option');
        opt.value = valor;
        opt.textContent = `${valor} (ya no está en catálogo)`;
        opt.style.color = '#f59e0b';
        select.appendChild(opt);
    }
    select.value = valor;
}

/* =========================================================
   GUARDAR
   ========================================================= */

document.getElementById('btn-guardar').addEventListener('click', async () => {
    const tipo = selectTipoIP.value;

    let hostnameFinal;
    if (tipo === 'Estatica') {
        if (chkHostnameManual.checked) {
            // Manual: tomar lo que escribió el usuario
            hostnameFinal = inputHostPreview.value.trim();
            if (!hostnameFinal) {
                mostrarMensaje('Escribe el hostname manualmente o desmarca la casilla.', 'error');
                return;
            }
        } else {
            // Automático: armar con la regla
            const idRol = parseInt(selectRol.value, 10);
            const idCli = parseInt(selectCli.value, 10);
            const ip = inputIP.value.trim();

            hostnameFinal = construirHostname(idRol, idCli, ip);
            if (!hostnameFinal) {
                mostrarMensaje('No se pudo armar el hostname. Verifica cliente, rol e IP.', 'error');
                return;
            }
        }
    } else {
        hostnameFinal = inputHostLibre.value.trim();
    }

    const datos = {
        idCliente:      parseInt(selectCli.value, 10),
        idLugarCliente: parseInt(selectLugar.value, 10),
        idRolEquipo:    parseInt(selectRol.value, 10),
        tipoIP:         tipo,
        hostname:       hostnameFinal,
        numeroHost:     tipo === 'Estatica' ? parseInt(inputNumHost.value, 10) : null,
        ip:             tipo === 'Estatica' ? inputIP.value.trim() : null,
        idRangoIP:      null,
        mascara:        selectMascara.value || null,
        puertaEnlace:   selectPuerta.value || null,
        dns1:           selectDNS1.value || null,
        dns2:           selectDNS2.value || null,
        usuarioAdmin:   selectDominio.value || null,
        passwordAdmin:  inputPassword.value.trim(),
        activo:         true
    };

    // Validaciones
    if (!datos.idCliente || !datos.idLugarCliente || !datos.idRolEquipo) {
        mostrarMensaje('Cliente, lugar y rol son obligatorios.', 'error');
        return;
    }
    if (!datos.hostname) {
        mostrarMensaje('El hostname es obligatorio.', 'error');
        return;
    }
    if (!datos.mascara) {
        mostrarMensaje('La máscara es obligatoria.', 'error');
        return;
    }
    if (!datos.puertaEnlace) {
        mostrarMensaje('La puerta de enlace es obligatoria.', 'error');
        return;
    }
    if (!datos.dns1) {
        mostrarMensaje('El DNS 1 es obligatorio.', 'error');
        return;
    }
    // DNS2 opcional
    if (!datos.usuarioAdmin || !datos.passwordAdmin) {
        mostrarMensaje('Usuario admin y password son obligatorios.', 'error');
        return;
    }
    if (tipo === 'Estatica' && !datos.ip) {
        mostrarMensaje('En equipos estáticos, la IP es obligatoria.', 'error');
        return;
    }

    const btnGuardar = document.getElementById('btn-guardar');
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        let res;
        if (modoEdicion) res = await window.api.equipos.actualizar(idEditando, datos);
        else res = await window.api.equipos.crear(datos);

        if (res.ok) {
            await Swal.fire({ icon: 'success', title: '¡Guardado!', text: res.mensaje });
            cerrarModal();
            await recargarEquipos();
        } else if (res.tipo === 'ip-duplicada') {
            await Swal.fire({
                icon: 'warning',
                title: 'IP duplicada',
                html: `<div style="text-align:left;font-size:0.9rem;">
                    La IP <b>${datos.ip}</b> ya está asignada al equipo:<br><br>
                    <div style="background:#f1f5f9;padding:10px;border-radius:6px;border-left:3px solid #f59e0b;">
                        <b>${res.choque.Hostname}</b><br>
                        <span style="color:#64748b;">${res.choque.ClienteCodigo} — ${res.choque.LugarNombre}</span>
                    </div></div>`
            });
        } else {
            mostrarMensaje(res.mensaje, 'error');
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `
            <svg class="icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg> Guardar`;
    }
});

/* =========================================================
   ELIMINAR
   ========================================================= */

async function eliminarEquipo(id, hostname) {
    const confirm = await Swal.fire({
        icon: 'question',
        title: '¿Eliminar equipo?',
        text: `Se eliminará ${hostname}. Si está ubicado en el plano, también se quitará de su posición.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626'
    });
    if (!confirm.isConfirmed) return;

    try {
        await window.api.equipos.eliminar(id);
        await Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
        await recargarEquipos();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

/* =========================================================
   UTILIDADES
   ========================================================= */

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje ' + tipo;
    mensaje.style.display = 'block';
}

function ocultarMensaje() {
    mensaje.style.display = 'none';
}

/* =========================================================
   INICIO
   ========================================================= */

(async () => {
    await cargarClientes();
    await cargarRoles();
    await recargarEquipos();
})();