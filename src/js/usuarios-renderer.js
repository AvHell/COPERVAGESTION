let usuarios = [];
let modoEdicion = false;
let idEditando = null;

const tabla = document.getElementById('tabla-usuarios');
const formulario = document.getElementById('formulario');
const mensaje = document.getElementById('mensaje');

const inputNombres = document.getElementById('nombres');
const inputApellidos = document.getElementById('apellidos');
const inputUsuario = document.getElementById('nombreUsuario');
const inputPassword = document.getElementById('password');

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

async function cargar() {
    usuarios = await window.api.usuarios.listar();
    renderTabla();
}

function renderTabla() {
    tabla.innerHTML = '';
    usuarios.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.NombreUsuario}</td>
            <td>${u.Nombres}</td>
            <td>${u.Apellidos}</td>
            <td>${u.Activo ? 'Sí' : 'No'}</td>
            <td class="acciones-tabla"></td>
        `;
        const acciones = tr.querySelector('.acciones-tabla');

        const btnEditar = document.createElement('button');
        btnEditar.textContent = 'Editar';
        btnEditar.addEventListener('click', () => abrirEdicion(u.IdUsuario));

        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = 'Desactivar';
        btnEliminar.className = 'peligro';
        btnEliminar.addEventListener('click', () => desactivar(u.IdUsuario));

        acciones.appendChild(btnEditar);
        acciones.appendChild(btnEliminar);
        tabla.appendChild(tr);
    });
}

document.getElementById('btn-nuevo').addEventListener('click', () => {
    modoEdicion = false;
    idEditando = null;
    limpiar();
    formulario.style.display = 'block';
    ocultarMensaje();
});

function limpiar() {
    inputNombres.value = '';
    inputApellidos.value = '';
    inputUsuario.value = '';
    inputPassword.value = '';
}

function abrirEdicion(id) {
    const u = usuarios.find(x => Number(x.IdUsuario) === Number(id));
    if (!u) return;
    modoEdicion = true;
    idEditando = u.IdUsuario;
    inputNombres.value = u.Nombres;
    inputApellidos.value = u.Apellidos;
    inputUsuario.value = u.NombreUsuario;
    inputPassword.value = '';
    formulario.style.display = 'block';
    ocultarMensaje();
}

document.getElementById('btn-cancelar').addEventListener('click', () => {
    formulario.style.display = 'none';
    ocultarMensaje();
});

document.getElementById('btn-guardar').addEventListener('click', async () => {
    const datos = {
        nombres: inputNombres.value.trim(),
        apellidos: inputApellidos.value.trim(),
        nombreUsuario: inputUsuario.value.trim(),
        password: inputPassword.value,
        activo: true
    };

    if (!datos.nombres || !datos.apellidos || !datos.nombreUsuario) {
        mostrarMensaje('Todos los campos son obligatorios.', 'error');
        return;
    }
    if (!modoEdicion && !datos.password) {
        mostrarMensaje('La contraseña es obligatoria al crear.', 'error');
        return;
    }

    try {
        let res;
        if (modoEdicion) {
            res = await window.api.usuarios.actualizar(idEditando, datos);
        } else {
            res = await window.api.usuarios.crear(datos);
        }
        if (res.ok) {
            mostrarMensaje(res.mensaje, 'ok');
            formulario.style.display = 'none';
            await cargar();
        } else {
            mostrarMensaje(res.mensaje, 'error');
        }
    } catch (err) {
        mostrarMensaje('Error: ' + err.message, 'error');
    }
});

async function desactivar(id) {
    if (!confirm('¿Desactivar este usuario?')) return;
    try {
        await window.api.usuarios.eliminar(id);
        await cargar();
    } catch (err) {
        alert('Error: ' + err.message);
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

cargar();