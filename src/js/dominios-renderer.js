const Swal = window.Swal;

let clientes = [];
let dominios = [];

const tabla = document.getElementById('tabla-dominios');
const filtroCliente = document.getElementById('filtro-cliente');
const filtroBusqueda = document.getElementById('filtro-busqueda');

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

async function cargarClientes() {
    clientes = await window.api.clientes.listar();
    filtroCliente.innerHTML = '<option value="">Todos los clientes</option>';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.IdCliente;
        opt.textContent = `${c.Codigo} - ${c.Nombre}`;
        filtroCliente.appendChild(opt);
    });
}

async function cargarDominios() {
    const filtros = {
        idCliente: parseInt(filtroCliente.value, 10) || null,
        busqueda: filtroBusqueda.value.trim() || null
    };
    dominios = await window.api.dominios.listarTodas(filtros);
    renderTabla();
}

function renderTabla() {
    tabla.innerHTML = '';

    if (dominios.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:30px;">Sin dominios registrados</td></tr>';
        return;
    }

    dominios.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.ClienteCodigo}</td>
            <td><strong>${d.Usuario}</strong></td>
            <td><span class="password-celda">${'•'.repeat(d.Password.length)}</span></td>
            <td>${d.Descripcion ?? '-'}</td>
            <td class="acciones-tabla"></td>
        `;
        const celda = tr.querySelector('.acciones-tabla');

        const btnEditar = document.createElement('button');
        btnEditar.textContent = 'Editar';
        btnEditar.className = 'secundario';
        btnEditar.addEventListener('click', () => abrirEditar(d));

        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.className = 'peligro';
        btnEliminar.addEventListener('click', () => eliminar(d));

        celda.appendChild(btnEditar);
        celda.appendChild(btnEliminar);
        tabla.appendChild(tr);
    });
}

filtroCliente.addEventListener('change', cargarDominios);
filtroBusqueda.addEventListener('input', cargarDominios);

/* =========================================================
   CREAR / EDITAR
   ========================================================= */

document.getElementById('btn-nuevo').addEventListener('click', abrirCrear);

async function abrirCrear() {
    if (clientes.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Sin clientes', text: 'Primero crea al menos un cliente.' });
        return;
    }

    const opcionesClientes = clientes.map(c =>
        `<option value="${c.IdCliente}">${c.Codigo} - ${c.Nombre}</option>`
    ).join('');

    const { value: formValues } = await Swal.fire({
        title: 'Nuevo dominio',
        html: `
            <select id="swal-cliente" class="swal2-select">
                <option value="">-- Cliente --</option>
                ${opcionesClientes}
            </select>
            <input id="swal-usuario" class="swal2-input" placeholder="Usuario">
            <input id="swal-password" class="swal2-input" placeholder="Password">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción (opcional)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const idCliente = parseInt(document.getElementById('swal-cliente').value, 10);
            const usuario = document.getElementById('swal-usuario').value.trim();
            const password = document.getElementById('swal-password').value;
            const desc = document.getElementById('swal-desc').value.trim();
            if (!idCliente || !usuario || !password) {
                Swal.showValidationMessage('Cliente, usuario y password son obligatorios');
                return false;
            }
            return { idCliente, usuario, password, desc };
        }
    });

    if (formValues) {
        const res = await window.api.dominios.crear(formValues.idCliente, formValues.usuario, formValues.password, formValues.desc);
        if (res.ok) {
            await cargarDominios();
            Swal.fire({ icon: 'success', title: 'Creado', timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.mensaje });
        }
    }
}

async function abrirEditar(d) {
    const { value: formValues } = await Swal.fire({
        title: 'Editar dominio',
        html: `
            <input id="swal-usuario" class="swal2-input" placeholder="Usuario" value="${d.Usuario}">
            <input id="swal-password" class="swal2-input" placeholder="Password" value="${d.Password}">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción" value="${d.Descripcion ?? ''}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
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
        await window.api.dominios.actualizar(d.IdDominio, formValues.usuario, formValues.password, formValues.desc);
        await cargarDominios();
        Swal.fire({ icon: 'success', title: 'Actualizado', timer: 1500, showConfirmButton: false });
    }
}

async function eliminar(d) {
    const confirm = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar dominio?',
        html: `Se eliminará <b>${d.Usuario}</b> de ${d.ClienteCodigo}. Los equipos ya guardados con este usuario no se ven afectados.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626'
    });

    if (confirm.isConfirmed) {
        await window.api.dominios.eliminar(d.IdDominio);
        await cargarDominios();
        Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
    }
}

(async () => {
    await cargarClientes();
    await cargarDominios();
})();