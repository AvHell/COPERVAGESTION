let clientes = [];
let modoEdicion = false;
let idEditando = null;

const tabla        = document.getElementById('tabla-clientes');
const formulario   = document.getElementById('formulario');
const inputCodigo  = document.getElementById('codigo');
const inputNombre  = document.getElementById('nombre');
const mensaje      = document.getElementById('mensaje');

/* =========================================================
   NAVEGACIÓN
   ========================================================= */

document.getElementById('btn-volver').addEventListener('click', () => {
    window.api.volverMenu();
});

/* =========================================================
   LISTAR
   ========================================================= */

async function cargarClientes() {
    clientes = await window.api.clientes.listar();
    renderTabla();
}

function renderTabla() {
    tabla.innerHTML = '';
    clientes.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.Codigo}</td>
            <td>${c.Nombre}</td>
            <td class="acciones-tabla">
                <button data-id="${c.IdCliente}" class="editar">Editar</button>
                <button data-id="${c.IdCliente}" class="peligro eliminar">Eliminar</button>
            </td>
        `;
        tabla.appendChild(tr);
    });

    // Listeners de acciones
    document.querySelectorAll('.editar').forEach(btn => {
        btn.addEventListener('click', () => abrirEdicion(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.eliminar').forEach(btn => {
        btn.addEventListener('click', () => eliminarCliente(parseInt(btn.dataset.id)));
    });
}

/* =========================================================
   CREAR / EDITAR
   ========================================================= */

document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando = null;
    inputCodigo.value = '';
    inputNombre.value = '';
    formulario.style.display = 'block';
    ocultarMensaje();
    inputCodigo.focus();
});

function abrirEdicion(id) {
    const c = clientes.find(x => x.IdCliente === id);
    if (!c) return;
    modoEdicion = true;
    idEditando = id;
    inputCodigo.value = c.Codigo;
    inputNombre.value = c.Nombre;
    formulario.style.display = 'block';
    ocultarMensaje();
}

document.getElementById('btn-cancelar').addEventListener('click', () => {
    formulario.style.display = 'none';
    ocultarMensaje();
});

document.getElementById('btn-guardar').addEventListener('click', async () => {
    const codigo = inputCodigo.value.trim().toUpperCase();
    const nombre = inputNombre.value.trim();

    if (!codigo || !nombre) {
        mostrarMensaje('Código y nombre son obligatorios.', 'error');
        return;
    }

    try {
        let res;
        if (modoEdicion) {
            res = await window.api.clientes.actualizar(idEditando, codigo, nombre);
        } else {
            res = await window.api.clientes.crear(codigo, nombre);
        }

        if (res.ok) {
            mostrarMensaje(res.mensaje, 'ok');
            formulario.style.display = 'none';
            await cargarClientes();
        } else {
            mostrarMensaje(res.mensaje, 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    }
});

/* =========================================================
   ELIMINAR
   ========================================================= */

async function eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente?')) return;
    try {
        await window.api.clientes.eliminar(id);
        await cargarClientes();
    } catch (err) {
        alert('Error al eliminar: ' + err.message);
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

cargarClientes();