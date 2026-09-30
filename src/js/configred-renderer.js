/* =========================================================
   CONFIGURACIONES DE RED — RENDERER
   ========================================================= */

/* =========================================================
   REFERENCIA A SWEETALERT
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   TOASTS — versión limpia
   ========================================================= */
function toastExito(titulo) {
    Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: titulo,
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true,
        background: '#ffffff',
        color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-success' },
        didOpen: (toast) => {
            toast.style.boxShadow = 'none';
            toast.style.webkitBoxShadow = 'none';
            toast.style.filter = 'none';
            toast.style.webkitFilter = 'none';
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false,
        timer: 3400,
        timerProgressBar: true,
        background: '#ffffff',
        color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-error' },
        didOpen: (toast) => {
            toast.style.boxShadow = 'none';
            toast.style.webkitBoxShadow = 'none';
            toast.style.filter = 'none';
            toast.style.webkitFilter = 'none';
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   MAPA DE COLORES POR CÓDIGO DE CLIENTE
   ========================================================= */
const COLORES_CODIGO_CLIENTE = {
    'NU':    'codigo-nu',
    'DIDI':  'codigo-didi',
    'ADAMA': 'codigo-adama',
    'KUBO':  'codigo-kubo',
    'MEGA':  'codigo-mega'
};

function claseCodigoCliente(codigo) {
    const key = String(codigo || '').trim().toUpperCase();
    return COLORES_CODIGO_CLIENTE[key] || 'codigo-def';
}

/* =========================================================
   MAPA DE CLASES POR TIPO
   ========================================================= */
const TIPOS_CLASES = {
    'Mascara':      'tipo-mascara',
    'PuertaEnlace': 'tipo-puertaenlace',
    'DNS1':         'tipo-dns1',
    'DNS2':         'tipo-dns2'
};

const TIPOS_NOMBRES = {
    'Mascara':      'Máscara',
    'PuertaEnlace': 'Puerta de enlace',
    'DNS1':         'DNS 1',
    'DNS2':         'DNS 2'
};

function claseTipo(tipo) {
    return TIPOS_CLASES[tipo] || 'tipo-def';
}

/* =========================================================
   LIMPIEZA DE RESIDUOS DE SWEETALERT2
   ========================================================= */
function limpiarResiduosSwal() {
    document.querySelectorAll('body > .swal2-container').forEach(c => {
        if (!c.querySelector('.swal2-popup') && !c.classList.contains('swal2-backdrop-show')) {
            c.remove();
        }
    });
    const selectoresInternos = [
        'body > input.swal2-input',
        'body > input.swal2-file',
        'body > input.swal2-radio',
        'body > input.swal2-checkbox',
        'body > select.swal2-select',
        'body > textarea.swal2-textarea',
        'body > .swal2-validation-message',
        'body > .swal2-input-label',
        'body > .swal2-select-label'
    ];
    document.querySelectorAll(selectoresInternos.join(',')).forEach(el => el.remove());
    document.querySelectorAll('body > [id^="swal2-"]').forEach(el => {
        if (!el.closest('.swal2-popup')) el.remove();
    });
}

/* =========================================================
   ESTADO
   ========================================================= */
let clientes = [];
let configs  = [];

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const contenedorGrupos = document.getElementById('contenedor-grupos');
const sinResultados    = document.getElementById('sin-resultados');
const filtroCliente    = document.getElementById('filtro-cliente');
const filtroTipo       = document.getElementById('filtro-tipo');
const filtroBusqueda   = document.getElementById('filtro-busqueda');

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* Validación básica de IPv4 o máscara */
function esIPv4Valida(v) {
    const partes = v.split('.');
    if (partes.length !== 4) return false;
    return partes.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => {
    window.api.volverMenu();
});

/* =========================================================
   CARGA
   ========================================================= */
async function cargarClientes() {
    try {
        clientes = await window.api.clientes.listar();
        filtroCliente.innerHTML = '<option value="">Todos los clientes</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.IdCliente);
            opt.textContent = `${c.Codigo} - ${c.Nombre}`;
            filtroCliente.appendChild(opt);
        });
    } catch (err) {
        toastError('No se pudieron cargar los clientes', err.message);
    }
}

async function cargarConfigs() {
    try {
        const filtros = {
            idCliente: parseInt(filtroCliente.value, 10) || null,
            tipo:      filtroTipo.value || null,
            busqueda:  filtroBusqueda.value.trim() || null
        };
        configs = await window.api.config.listarTodas(filtros);
        renderTabla();
    } catch (err) {
        toastError('No se pudieron cargar las configuraciones', err.message);
    }
}

/* =========================================================
   RENDER TABLA (agrupado por cliente, grupos cerrados al inicio)
   ========================================================= */
function renderTabla() {
    contenedorGrupos.innerHTML = '';

    if (!configs || configs.length === 0) {
        sinResultados.classList.remove('oculto');
        return;
    }
    sinResultados.classList.add('oculto');

    /* Agrupar por código de cliente */
    const porCliente = new Map();
    configs.forEach(c => {
        const key = c.ClienteCodigo;
        if (!porCliente.has(key)) {
            porCliente.set(key, {
                codigo: c.ClienteCodigo,
                nombre: c.ClienteNombre,
                items: []
            });
        }
        porCliente.get(key).items.push(c);
    });

    const clientesOrdenados = Array.from(porCliente.values())
        .sort((a, b) => a.codigo.localeCompare(b.codigo));

    clientesOrdenados.forEach(grupoCliente => {
        const divCliente = document.createElement('div');
        // ✅ CLIENTE: inicia COLAPSADO
        divCliente.className = 'grupo-cliente colapsado';

        const claseCodigo = claseCodigoCliente(grupoCliente.codigo);

        // ================= HEADER CLIENTE =================
        const headerCliente = document.createElement('div');
        headerCliente.className = 'grupo-cliente-header';
        headerCliente.innerHTML = `
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span class="badge-cliente ${claseCodigo}">
                <span class="codigo">${escaparHTML(grupoCliente.codigo)}</span>
                <span class="nombre">${escaparHTML(grupoCliente.nombre)}</span>
            </span>
        `;
        headerCliente.addEventListener('click', () => {
            divCliente.classList.toggle('colapsado');
        });
        divCliente.appendChild(headerCliente);

        // ================= BODY CLIENTE (tabla) =================
        const bodyCliente = document.createElement('div');
        bodyCliente.className = 'grupo-cliente-body';

        const tabla = document.createElement('table');
        tabla.className = 'tabla-config';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th style="width:22%;">Tipo</th>
                    <th style="width:26%;">Valor</th>
                    <th>Descripción</th>
                    <th style="width:200px; text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = tabla.querySelector('tbody');

        grupoCliente.items
            .slice()
            .sort((a, b) => (a.Tipo || '').localeCompare(b.Tipo || ''))
            .forEach(c => {
                const tr = document.createElement('tr');

                const claseTipo_ = claseTipo(c.Tipo);
                const nombreTipo = TIPOS_NOMBRES[c.Tipo] ?? c.Tipo;

                const descripcionHTML = (c.Descripcion && c.Descripcion.trim())
                    ? `<span class="badge-desc">${escaparHTML(c.Descripcion)}</span>`
                    : `<span class="badge-desc vacia">— sin descripción —</span>`;

                tr.innerHTML = `
                    <td>
                        <span class="badge-tipo ${claseTipo_}">
                            ${escaparHTML(nombreTipo)}
                        </span>
                    </td>
                    <td><span class="badge-valor">${escaparHTML(c.Valor)}</span></td>
                    <td>${descripcionHTML}</td>
                    <td class="acciones-tabla"></td>
                `;
                const celda = tr.querySelector('.acciones-tabla');

                const btnEditar = document.createElement('button');
                btnEditar.type = 'button';
                btnEditar.className = 'secundario';
                btnEditar.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Editar
                `;
                btnEditar.addEventListener('click', () => abrirEditar(c));

                const btnEliminar = document.createElement('button');
                btnEliminar.type = 'button';
                btnEliminar.className = 'peligro';
                btnEliminar.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6M14 11v6"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                    Eliminar
                `;
                btnEliminar.addEventListener('click', () => eliminar(c));

                celda.appendChild(btnEditar);
                celda.appendChild(btnEliminar);
                tbody.appendChild(tr);
            });

        bodyCliente.appendChild(tabla);
        divCliente.appendChild(bodyCliente);
        contenedorGrupos.appendChild(divCliente);
    });
}

/* =========================================================
   FILTROS
   ========================================================= */
filtroCliente.addEventListener('change', cargarConfigs);
filtroTipo.addEventListener('change', cargarConfigs);

let debounceBusqueda = null;
filtroBusqueda.addEventListener('input', () => {
    clearTimeout(debounceBusqueda);
    debounceBusqueda = setTimeout(cargarConfigs, 250);
});

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
            confirmButtonText: 'Entendido',
            buttonsStyling: false,
            customClass: {
                popup:         'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled'
            }
        });
        return;
    }

    const opcionesClientes = clientes.map(c =>
        `<option value="${c.IdCliente}">${escaparHTML(c.Codigo)} - ${escaparHTML(c.Nombre)}</option>`
    ).join('');

    const { value: formValues } = await Swal.fire({
        title: 'Nueva configuración de red',
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
        buttonsStyling: false,
        customClass: {
            popup:         'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton:  'swal2-cancel swal2-styled'
        },
        preConfirm: () => {
            const idCliente = parseInt(document.getElementById('swal-cliente').value, 10);
            const tipo      = document.getElementById('swal-tipo').value;
            const valor     = document.getElementById('swal-valor').value.trim();
            const desc      = document.getElementById('swal-desc').value.trim();

            if (!idCliente || Number.isNaN(idCliente)) {
                Swal.showValidationMessage('Debes seleccionar un cliente');
                return false;
            }
            if (!tipo) {
                Swal.showValidationMessage('Debes seleccionar un tipo');
                return false;
            }
            if (!valor) {
                Swal.showValidationMessage('El valor es obligatorio');
                return false;
            }
            if (valor.length > 45) {
                Swal.showValidationMessage('El valor no puede superar 45 caracteres');
                return false;
            }
            if (!esIPv4Valida(valor)) {
                Swal.showValidationMessage('El valor debe ser una IPv4 válida (ej. 192.168.1.1)');
                return false;
            }
            if (desc.length > 200) {
                Swal.showValidationMessage('La descripción no puede superar 200 caracteres');
                return false;
            }
            return { idCliente, tipo, valor, desc };
        }
    });

    if (!formValues) return;

    try {
        const res = await window.api.config.crear(
            formValues.idCliente, formValues.tipo, formValues.valor, formValues.desc
        );
        if (res && res.ok) {
            await cargarConfigs();
            toastExito(res.mensaje || 'Configuración creada');
        } else {
            toastError('No se pudo crear', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error', err.message);
    }
}

/* =========================================================
   EDITAR
   ========================================================= */
async function abrirEditar(c) {
    const { value: formValues } = await Swal.fire({
        title: 'Editar configuración',
        html: `
            <div style="text-align:left;font-size:12.5px;color:#4a5568;margin-bottom:10px;">
                <strong>${escaparHTML(c.ClienteCodigo)}</strong> — ${escaparHTML(TIPOS_NOMBRES[c.Tipo] ?? c.Tipo)}
            </div>
            <input id="swal-valor" class="swal2-input" placeholder="Valor" value="${escaparHTML(c.Valor)}">
            <input id="swal-desc" class="swal2-input" placeholder="Descripción" value="${escaparHTML(c.Descripcion ?? '')}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        buttonsStyling: false,
        customClass: {
            popup:         'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton:  'swal2-cancel swal2-styled'
        },
        preConfirm: () => {
            const valor = document.getElementById('swal-valor').value.trim();
            const desc  = document.getElementById('swal-desc').value.trim();

            if (!valor) {
                Swal.showValidationMessage('El valor es obligatorio');
                return false;
            }
            if (valor.length > 45) {
                Swal.showValidationMessage('El valor no puede superar 45 caracteres');
                return false;
            }
            if (!esIPv4Valida(valor)) {
                Swal.showValidationMessage('El valor debe ser una IPv4 válida (ej. 192.168.1.1)');
                return false;
            }
            if (desc.length > 200) {
                Swal.showValidationMessage('La descripción no puede superar 200 caracteres');
                return false;
            }
            return { valor, desc };
        }
    });

    if (!formValues) return;

    try {
        const res = await window.api.config.actualizar(c.IdConfig, formValues.valor, formValues.desc);
        if (res && res.ok) {
            await cargarConfigs();
            toastExito(res.mensaje || 'Configuración actualizada');
        } else {
            toastError('No se pudo actualizar', res?.mensaje || 'Error desconocido');
        }
    } catch (err) {
        toastError('Error', err.message);
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(c) {
    const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar configuración?',
        html: `Se eliminará <strong>${escaparHTML(c.Valor)}</strong> del catálogo de <strong>${escaparHTML(c.ClienteCodigo)}</strong>.<br><br>
               Los equipos ya guardados con este valor no se ven afectados.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
        customClass: {
            popup:         'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled cl-peligro',
            cancelButton:  'swal2-cancel swal2-styled'
        }
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await window.api.config.eliminar(c.IdConfig);
        if (res && res.ok) {
            await cargarConfigs();
            toastExito(res.mensaje || 'Configuración eliminada');
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
    await cargarConfigs();
    limpiarResiduosSwal();
})();