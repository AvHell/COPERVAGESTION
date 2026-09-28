let lugares = [];
let clientes = [];
let modoEdicion = false;
let idEditando = null;

const tabla       = document.getElementById('tabla-lugares');
const formulario  = document.getElementById('formulario');
const selectCli   = document.getElementById('cliente');
const inputNombre = document.getElementById('nombre');
const mensaje     = document.getElementById('mensaje');

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

async function cargarLugares() {
    lugares = await window.api.lugares.listar();
    renderTabla();
}

function renderTabla() {
    tabla.innerHTML = '';
    lugares.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${l.ClienteCodigo} - ${l.ClienteNombre}</td>
            <td>${l.Nombre}</td>
            <td class="acciones-tabla">
                <button data-id="${l.IdLugarCliente}" class="editar">Editar</button>
                <button data-id="${l.IdLugarCliente}" class="peligro eliminar">Eliminar</button>
            </td>
        `;
        tabla.appendChild(tr);
    });

    document.querySelectorAll('.editar').forEach(btn => {
        btn.addEventListener('click', () => abrirEdicion(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.eliminar').forEach(btn => {
        btn.addEventListener('click', () => eliminarLugar(parseInt(btn.dataset.id)));
    });
}

document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando = null;
    selectCli.value = '';
    inputNombre.value = '';
    formulario.style.display = 'block';
    ocultarMensaje();
});

function abrirEdicion(id) {
    const l = lugares.find(x => x.IdLugarCliente === id);
    if (!l) return;
    modoEdicion = true;
    idEditando = id;
    selectCli.value = l.IdCliente;
    inputNombre.value = l.Nombre;
    formulario.style.display = 'block';
    ocultarMensaje();
}

document.getElementById('btn-cancelar').addEventListener('click', () => {
    formulario.style.display = 'none';
    ocultarMensaje();
});

document.getElementById('btn-guardar').addEventListener('click', async () => {
    const idCliente = parseInt(selectCli.value);
    const nombre = inputNombre.value.trim();

    if (!idCliente || !nombre) {
        mostrarMensaje('Cliente y nombre son obligatorios.', 'error');
        return;
    }

    try {
        let res;
        if (modoEdicion) {
            res = await window.api.lugares.actualizar(idEditando, idCliente, nombre);
        } else {
            res = await window.api.lugares.crear(idCliente, nombre);
        }
        if (res.ok) {
            mostrarMensaje(res.mensaje, 'ok');
            formulario.style.display = 'none';
            await cargarLugares();
        } else {
            mostrarMensaje(res.mensaje, 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    }
});

async function eliminarLugar(id) {
    if (!confirm('¿Eliminar este lugar?')) return;
    try {
        await window.api.lugares.eliminar(id);
        await cargarLugares();
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
    await cargarLugares();
})();