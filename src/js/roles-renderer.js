let roles = [];
let modoEdicion = false;
let idEditando = null;

const tabla        = document.getElementById('tabla-roles');
const formulario   = document.getElementById('formulario');
const inputCodigo  = document.getElementById('codigo');
const inputNombre  = document.getElementById('nombre');
const inputDesc    = document.getElementById('descripcion');
const mensaje      = document.getElementById('mensaje');

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

async function cargarRoles() {
    roles = await window.api.roles.listar();
    renderTabla();
}

function renderTabla() {
    tabla.innerHTML = '';
    roles.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.Codigo}</td>
            <td>${r.Nombre}</td>
            <td>${r.Descripcion ?? ''}</td>
            <td class="acciones-tabla">
                <button data-id="${r.IdRolEquipo}" class="editar">Editar</button>
                <button data-id="${r.IdRolEquipo}" class="peligro eliminar">Eliminar</button>
            </td>
        `;
        tabla.appendChild(tr);
    });

    document.querySelectorAll('.editar').forEach(btn => {
        btn.addEventListener('click', () => abrirEdicion(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.eliminar').forEach(btn => {
        btn.addEventListener('click', () => eliminarRol(parseInt(btn.dataset.id)));
    });
}

document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando = null;
    inputCodigo.value = '';
    inputNombre.value = '';
    inputDesc.value = '';
    formulario.style.display = 'block';
    ocultarMensaje();
    inputCodigo.focus();
});

function abrirEdicion(id) {
    const r = roles.find(x => x.IdRolEquipo === id);
    if (!r) return;
    modoEdicion = true;
    idEditando = id;
    inputCodigo.value = r.Codigo;
    inputNombre.value = r.Nombre;
    inputDesc.value = r.Descripcion ?? '';
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
    const desc   = inputDesc.value.trim() || null;

    if (!codigo || !nombre) {
        mostrarMensaje('Código y nombre son obligatorios.', 'error');
        return;
    }

    try {
        let res;
        if (modoEdicion) {
            res = await window.api.roles.actualizar(idEditando, codigo, nombre, desc);
        } else {
            res = await window.api.roles.crear(codigo, nombre, desc);
        }
        if (res.ok) {
            mostrarMensaje(res.mensaje, 'ok');
            formulario.style.display = 'none';
            await cargarRoles();
        } else {
            mostrarMensaje(res.mensaje, 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    }
});

async function eliminarRol(id) {
    if (!confirm('¿Eliminar este rol?')) return;
    try {
        await window.api.roles.eliminar(id);
        await cargarRoles();
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

cargarRoles();