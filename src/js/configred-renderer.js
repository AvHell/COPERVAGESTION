const Swal = window.Swal;

let clientes = [];
let configs = [];

const tabla = document.getElementById('tabla-config');
const filtroCliente = document.getElementById('filtro-cliente');
const filtroTipo = document.getElementById('filtro-tipo');
const filtroBusqueda = document.getElementById('filtro-busqueda');

const TIPOS_NOMBRES = {
    'Mascara': 'Máscara',
    'PuertaEnlace': 'Puerta de enlace',
    'DNS1': 'DNS 1',
    'DNS2': 'DNS 2'
};

const SWAL_CLASS = { popup: 'swal-config' };

document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

/* =========================================================
   CARGA
   ========================================================= */

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

async function cargarConfigs() {
    const filtros = {
        idCliente: parseInt(filtroCliente.value, 10) || null,
        tipo: filtroTipo.value || null,
        busqueda: filtroBusqueda.value.trim() || null
    };
    configs = await window.api.config.listarTodas(filtros);
    renderTabla();
}

function renderTabla() {
    tabla.innerHTML = '';

    if (configs.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:30px;">Sin configuraciones registradas</td></tr>';
        return;
    }

    configs.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.ClienteCodigo}</td>
            <td>${TIPOS_NOMBRES[c.Tipo] ?? c.Tipo}</td>
            <td><strong>${c.Valor}</strong></td>
            <td>${c.Descripcion ?? '-'}</td>
            <td class="acciones-tabla"></td>
        `;
        const celda = tr.querySelector('.acciones-tabla');

        const btnEditar = document.createElement('button');
        btnEditar.textContent = 'Editar';
        btnEditar.className = 'secundario';
        btnEditar.addEventListener('click', () => abrirEditar(c));

        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.className = 'peligro';
        btnEliminar.addEventListener('click', () => eliminar(c));

        celda.appendChild(btnEditar);
        celda.appendChild(btnEliminar);
        tabla.appendChild(tr);
    });
}

/* =========================================================
   FILTROS
   ========================================================= */

filtroCliente.addEventListener('change', cargarConfigs);
filtroTipo.addEventListener('change', cargarConfigs);
filtroBusqueda.addEventListener('input', cargarConfigs);

/* =========================================================
   CREAR
   ========================================================= */

document.getElementById('btn-nueva').addEventListener('click', abrirCrear);

async function abrirCrear() {
    if (clientes.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin clientes',
            text: 'Primero crea al menos un cliente.',
            customClass: SWAL_CLASS
        });
        return;
    }

    const opcionesClientes = clientes.map(c =>
        `<option value="${c.IdCliente}">${c.Codigo} - ${c.Nombre}</option>`
    ).join('');

    const { value: formValues } = await Swal.fire({
        title: 'Nueva configuración de red',
        customClass: SWAL_CLASS,
        html: `
            <select id="swal-cliente" class="swal2-select">
                <option value="">-- Selecciona cliente --</option>
                ${opcionesClientes}
            </select>
            <select id="swal-tipo" class="swal2-select">
                <option value="">-- Selecciona tipo --</option>
                <option value="Mascara">Máscara</option>
                <option value="PuertaEnlace">Puerta de enlace</option>
                <option value="DNS1">DNS 1</option>
                <option value="DNS2">DNS 2</option>
            </select>
            <input id="swal-valor" class="swal2-input" placeholder="Valor (ej. 192.168.111.10)">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción (opcional)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const idCliente = parseInt(document.getElementById('swal-cliente').value, 10);
            const tipo = document.getElementById('swal-tipo').value;
            const valor = document.getElementById('swal-valor').value.trim();
            const desc = document.getElementById('swal-desc').value.trim();
            if (!idCliente || !tipo || !valor) {
                Swal.showValidationMessage('Cliente, tipo y valor son obligatorios');
                return false;
            }
            return { idCliente, tipo, valor, desc };
        }
    });

    if (formValues) {
        const res = await window.api.config.crear(formValues.idCliente, formValues.tipo, formValues.valor, formValues.desc);
        if (res.ok) {
            await cargarConfigs();
            Swal.fire({
                icon: 'success', title: 'Creado', timer: 1500, showConfirmButton: false,
                customClass: SWAL_CLASS
            });
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.mensaje, customClass: SWAL_CLASS });
        }
    }
}

/* =========================================================
   EDITAR
   ========================================================= */

async function abrirEditar(c) {
    const { value: formValues } = await Swal.fire({
        title: 'Editar configuración',
        customClass: SWAL_CLASS,
        html: `
            <input id="swal-valor" class="swal2-input" placeholder="Valor" value="${c.Valor}">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción" value="${c.Descripcion ?? ''}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
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
        await window.api.config.actualizar(c.IdConfig, formValues.valor, formValues.desc);
        await cargarConfigs();
        Swal.fire({
            icon: 'success', title: 'Actualizado', timer: 1500, showConfirmButton: false,
            customClass: SWAL_CLASS
        });
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */

async function eliminar(c) {
    const confirm = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar configuración?',
        html: `Se eliminará <b>${c.Valor}</b> del catálogo de ${c.ClienteCodigo}.<br><br>
               Los equipos ya guardados con este valor no se ven afectados.`,
        customClass: SWAL_CLASS,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626'
    });

    if (confirm.isConfirmed) {
        await window.api.config.eliminar(c.IdConfig);
        await cargarConfigs();
        Swal.fire({
            icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false,
            customClass: SWAL_CLASS
        });
    }
}

/* =========================================================
   INICIO
   ========================================================= */

(async () => {
    await cargarClientes();
    await cargarConfigs();
})();