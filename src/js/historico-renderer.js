const selectCliente = document.getElementById('select-cliente');
const selectLugar = document.getElementById('select-lugar');
const tabla = document.getElementById('tabla-historico');

let clientes = [];
let lugares = [];

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

async function cargarClientes() {
    clientes = await window.api.clientes.listar();
    selectCliente.innerHTML = '<option value="">-- Cliente --</option>';
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.IdCliente;
        opt.textContent = `${c.Codigo} - ${c.Nombre}`;
        selectCliente.appendChild(opt);
    });
}

async function cargarLugares(idCliente) {
    const todos = await window.api.lugares.listar();
    lugares = todos.filter(l => l.IdCliente === idCliente);
    selectLugar.innerHTML = '<option value="">-- Piso --</option>';
    lugares.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.IdLugarCliente;
        opt.textContent = l.Nombre;
        selectLugar.appendChild(opt);
    });
}

selectCliente.addEventListener('change', async () => {
    const id = parseInt(selectCliente.value, 10);
    if (id) await cargarLugares(id);
    else selectLugar.innerHTML = '<option value="">-- Piso --</option>';
    tabla.innerHTML = '';
});

selectLugar.addEventListener('change', async () => {
    const id = parseInt(selectLugar.value, 10);
    if (!id) {
        tabla.innerHTML = '';
        return;
    }
    const historicos = await window.api.historicos.listarPorLugar(id);
    renderTabla(historicos);
});

function renderTabla(historicos) {
    tabla.innerHTML = '';

    if (historicos.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#95a5a6;">Sin movimientos</td></tr>';
        return;
    }

    historicos.forEach(h => {
        const fecha = new Date(h.Fecha).toLocaleString('es-MX');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${fecha}</td>
            <td>${h.NombreUsuario} (${h.Nombres} ${h.Apellidos})</td>
            <td>${h.Accion}</td>
            <td>${h.Hostname ?? '-'}</td>
            <td>${h.Detalle ?? '-'}</td>
        `;
        tabla.appendChild(tr);
    });
}

cargarClientes();