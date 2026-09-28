let rangos = [];
let clientes = [];
let lugares = [];
let modoEdicion = false;
let idEditando = null;

const tabla        = document.getElementById('tabla-rangos');
const formulario   = document.getElementById('formulario');
const selectCli    = document.getElementById('cliente');
const selectLugar  = document.getElementById('lugar');
const inputNombre  = document.getElementById('nombre');
const inputIPIni   = document.getElementById('ipInicio');
const inputIPFin   = document.getElementById('ipFin');
const inputDesc    = document.getElementById('descripcion');
const mensaje      = document.getElementById('mensaje');

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

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

async function cargarLugaresDelCliente(idCliente) {
    lugares = await window.api.lugares.listar();
    const filtrados = lugares.filter(l => l.IdCliente === idCliente);
    selectLugar.innerHTML = '<option value="">-- Selecciona --</option>';
    filtrados.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.IdLugarCliente;
        opt.textContent = l.Nombre;
        selectLugar.appendChild(opt);
    });
}

selectCli.addEventListener('change', () => {
    const id = parseInt(selectCli.value);
    if (id) cargarLugaresDelCliente(id);
    else selectLugar.innerHTML = '<option value="">-- Selecciona --</option>';
});

async function cargarRangos() {
    rangos = await window.api.rangos.listar();
    renderTabla();
}

function renderTabla() {
    tabla.innerHTML = '';
    rangos.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.ClienteCodigo} - ${r.ClienteNombre}</td>
            <td>${r.LugarNombre}</td>
            <td>${r.Nombre}</td>
            <td>${r.IPInicio}</td>
            <td>${r.IPFin}</td>
            <td class="acciones-tabla">
                <button data-id="${r.IdRangoIP}" class="editar">Editar</button>
                <button data-id="${r.IdRangoIP}" class="peligro eliminar">Eliminar</button>
            </td>
        `;
        tabla.appendChild(tr);
    });

    document.querySelectorAll('.editar').forEach(btn => {
        btn.addEventListener('click', () => abrirEdicion(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.eliminar').forEach(btn => {
        btn.addEventListener('click', () => eliminarRango(parseInt(btn.dataset.id)));
    });
}

document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando = null;
    selectCli.value = '';
    selectLugar.innerHTML = '<option value="">-- Selecciona --</option>';
    inputNombre.value = '';
    inputIPIni.value = '';
    inputIPFin.value = '';
    inputDesc.value = '';
    formulario.style.display = 'block';
    ocultarMensaje();
});

async function abrirEdicion(id) {
    const r = rangos.find(x => x.IdRangoIP === id);
    if (!r) return;
    modoEdicion = true;
    idEditando = id;
    selectCli.value = r.IdCliente;
    await cargarLugaresDelCliente(r.IdCliente);
    selectLugar.value = r.IdLugarCliente;
    inputNombre.value = r.Nombre;
    inputIPIni.value = r.IPInicio;
    inputIPFin.value = r.IPFin;
    inputDesc.value = r.Descripcion ?? '';
    formulario.style.display = 'block';
    ocultarMensaje();
}

document.getElementById('btn-cancelar').addEventListener('click', () => {
    formulario.style.display = 'none';
    ocultarMensaje();
});

document.getElementById('btn-guardar').addEventListener('click', async () => {
    const idCliente = parseInt(selectCli.value);
    const idLugar   = parseInt(selectLugar.value);
    const nombre    = inputNombre.value.trim();
    const ipIni     = inputIPIni.value.trim();
    const ipFin     = inputIPFin.value.trim();
    const desc      = inputDesc.value.trim() || null;

    if (!idCliente || !idLugar || !nombre || !ipIni || !ipFin) {
        mostrarMensaje('Cliente, lugar, nombre, IP inicio y IP fin son obligatorios.', 'error');
        return;
    }

    try {
        let res;
        if (modoEdicion) {
            res = await window.api.rangos.actualizar(idEditando, idCliente, idLugar, nombre, ipIni, ipFin, desc);
        } else {
            res = await window.api.rangos.crear(idCliente, idLugar, nombre, ipIni, ipFin, desc);
        }
        if (res.ok) {
            mostrarMensaje(res.mensaje, 'ok');
            formulario.style.display = 'none';
            await cargarRangos();
        } else {
            mostrarMensaje(res.mensaje, 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    }
});

async function eliminarRango(id) {
    if (!confirm('¿Eliminar este rango?')) return;
    try {
        await window.api.rangos.eliminar(id);
        await cargarRangos();
    } catch (err) {
        alert('Error al eliminar: ' + err.message);
    }
}

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje ' + tipo;
    mensaje.style.display = 'block';
}

function ocultarMensaje() {
    mensaje.style.display = 'none';
}

(async () => {
    await cargarClientes();
    await cargarRangos();
})();