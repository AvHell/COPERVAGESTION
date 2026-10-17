/* =========================================================
   CATÁLOGOS — Renderer Unificado Premium
   Clientes · Pisos · Roles · Dominios · Configuración de Red
   ========================================================= */

/* =========================================================
   HELPERS COMUNES
   ========================================================= */
const Swal = window.Swal;

function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
        background: '#ffffff', color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-success' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false, timer: 3400, timerProgressBar: true,
        background: '#ffffff', color: '#1a202c',
        customClass: { popup: 'cl-toast cl-toast-error' },
        didOpen: (t) => {
            t.style.boxShadow = 'none';
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* =========================================================
   COLORES POR MARCA REAL DEL CLIENTE (empresas mexicanas)
   ========================================================= */

const PALETAS_CLIENTE = {
    // Adamantine → azul marino / rey (corporativo)
    ADAMA:  { bg: 'linear-gradient(135deg, #dbeafe, #93c5fd)', text: '#1e3a8a', border: '#1e40af' },

    // AT&T → azul claro
    ATT:    { bg: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', text: '#0369a1', border: '#0ea5e9' },

      // PHIE Palacio de Hierror
    PHIE:    { bg: 'linear-gradient(135deg, #eeee0d, #fdfbba)', text: '#080808c0', border: '#e9e90e' },

    // Calidad → rosa suave (no chillón)
    CLD:    { bg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', text: '#be185d', border: '#f472b6' },

    // DiDi → naranja
    DIDI:   { bg: 'linear-gradient(135deg, #ffedd5, #fdba74)', text: '#c2410c', border: '#f97316' },

    // Dimex → verde manzana claro
    DMEX:   { bg: 'linear-gradient(135deg, #ecfccb, #bef264)', text: '#3f6212', border: '#84cc16' },

    // Hey Banco → amarillo queso
    HBAN:   { bg: 'linear-gradient(135deg, #fef9c3, #fde047)', text: '#854d0e', border: '#eab308' },

    // Kubo → verde bandera México (verde oscuro profundo)
    KUBO:   { bg: 'linear-gradient(135deg, #dcfce7, #4ade80)', text: '#14532d', border: '#16a34a' },

    // Megacable → azul claro más fuerte que ATT
    MEGA:   { bg: 'linear-gradient(135deg, #cffafe, #22d3ee)', text: '#155e75', border: '#0891b2' },

    // Nubank → morado
    NU:     { bg: 'linear-gradient(135deg, #f3e8ff, #c084fc)', text: '#6b21a8', border: '#a855f7' },

    // Shopee → naranja gradiente (de claro a intenso)
    SHOP:   { bg: 'linear-gradient(135deg, #ffedd5, #fb923c, #ea580c)', text: '#7c2d12', border: '#ea580c' },

    // Toyota → rojo
    TOY:    { bg: 'linear-gradient(135deg, #fecaca, #f87171)', text: '#7f1d1d', border: '#dc2626' },

    // Totalplay → gradiente multicolor (azul, verde, amarillo, rojo, morado)
    TPLAY:  {
        bg: 'linear-gradient(135deg, #dbeafe 0%, #dcfce7 25%, #fef3c7 50%, #fee2e2 75%, #f3e8ff 100%)',
        text: '#1e293b',
        border: '#6366f1'
    }
};

/* Paletas de reserva para clientes NO registrados arriba */
const PALETAS_FALLBACK = [
    { bg: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', text: '#6b21a8', border: '#c084fc' },
    { bg: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', text: '#075985', border: '#7dd3fc' },
    { bg: 'linear-gradient(135deg, #ffe4e6, #fecdd3)', text: '#be123c', border: '#fda4af' },
    { bg: 'linear-gradient(135deg, #fef9c3, #fef08a)', text: '#854d0e', border: '#fde047' },
    { bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', text: '#166534', border: '#86efac' },
    { bg: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', text: '#6d28d9', border: '#c4b5fd' },
    { bg: 'linear-gradient(135deg, #fff7ed, #ffedd5)', text: '#c2410c', border: '#fdba74' },
    { bg: 'linear-gradient(135deg, #fef2f2, #fee2e2)', text: '#991b1b', border: '#fca5a5' }
];

function hashCodigo(codigo) {
    const s = String(codigo || '').toUpperCase();
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function getPaletaCliente(codigo) {
    const key = String(codigo || '').trim().toUpperCase();
    if (PALETAS_CLIENTE[key]) return PALETAS_CLIENTE[key];
    return PALETAS_FALLBACK[hashCodigo(key) % PALETAS_FALLBACK.length];
}

function renderBadgeCliente(codigo, nombre = null) {
    const p = getPaletaCliente(codigo);
    const style = `background:${p.bg};color:${p.text};border-color:${p.border};`;
    const nombreHTML = nombre
        ? `<span class="nombre">${escaparHTML(nombre)}</span>`
        : '';
    return `<span class="badge-cliente" style="${style}">
                <span class="codigo">${escaparHTML(codigo)}</span>
                ${nombreHTML}
            </span>`;
}

/* =========================================================
   COLORES PARA ROLES (se mantienen igual)
   ========================================================= */

const PALETAS_ROL = {
    AGT: { bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', text: '#1e40af', border: '#60a5fa' },
    SPR: { bg: 'linear-gradient(135deg, #fcdcdc, #f7bbbb)', text: '#651616', border: '#de4a4a' },
    CLD: { bg: 'linear-gradient(135deg, #ffedd5, #fed7aa)', text: '#9a3412', border: '#fb923c' },
    GRN: { bg: 'linear-gradient(135deg, #e9d5ff, #d8b4fe)', text: '#6b21a8', border: '#c084fc' },
    CRD: { bg: 'linear-gradient(135deg, #ccfbf1, #99f6e4)', text: '#115e59', border: '#5eead4' },
    MIS: { bg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', text: '#9d174d', border: '#f9a8d4' },
    ADM: { bg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', text: '#3730a3', border: '#a5b4fc' }
};

function renderBadgeRol(codigo) {
    const key = String(codigo || '').trim().toUpperCase();
    const p = PALETAS_ROL[key] || PALETAS_FALLBACK[hashCodigo(key) % PALETAS_FALLBACK.length];
    const style = `background:${p.bg};color:${p.text};border-color:${p.border};`;
    return `<span class="badge-codigo" style="${style}">${escaparHTML(codigo)}</span>`;
}

/* =========================================================
   COLORES PARA TIPO DE CONFIGURACIÓN
   ========================================================= */

const PALETAS_TIPO_CONFIG = {
    Mascara:      { bg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', text: '#3730a3', border: '#a5b4fc' },
    PuertaEnlace: { bg: 'linear-gradient(135deg, #fecaca, #fca5a5)', text: '#991b1b', border: '#f87171' },
    DNS1:         { bg: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', text: '#166534', border: '#4ade80' },
    DNS2:         { bg: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', text: '#5b21b6', border: '#c4b5fd' }
};

function renderBadgeTipoConfig(tipo) {
    const p = PALETAS_TIPO_CONFIG[tipo] || PALETAS_FALLBACK[hashCodigo(tipo) % PALETAS_FALLBACK.length];
    const style = `background:${p.bg};color:${p.text};border-color:${p.border};`;
    return `<span class="badge-codigo" style="${style}">${escaparHTML(nombreTipoConfig(tipo))}</span>`;
}

function nombreTipoConfig(tipo) {
    const map = {
        'Mascara': 'Máscara', 'PuertaEnlace': 'Puerta de enlace',
        'DNS1': 'DNS 1', 'DNS2': 'DNS 2'
    };
    return map[tipo] || tipo;
}

function renderBadgePiso(nombre) {
    const style = 'background:linear-gradient(135deg, #f1f5f9, #e2e8f0);color:#334155;border-color:#cbd5e1;';
    return `<span class="badge-codigo" style="${style}">${escaparHTML(nombre)}</span>`;
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function esIPv4Valida(v) {
    const partes = String(v).split('.');
    if (partes.length !== 4) return false;
    return partes.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function limpiarResiduosSwal() {
    document.querySelectorAll('body > .swal2-container').forEach(c => {
        if (!c.querySelector('.swal2-popup') && !c.classList.contains('swal2-backdrop-show')) {
            c.remove();
        }
    });
    document.querySelectorAll('body > [id^="swal2-"]').forEach(el => {
        if (!el.closest('.swal2-popup')) el.remove();
    });
}

/* =========================================================
   CACHÉ COMPARTIDO
   ========================================================= */
const Cache = {
    clientes: [],
    cargado: false,

    async cargarClientes() {
        if (this.cargado) return this.clientes;
        try {
            this.clientes = await window.api.clientes.listar();
            this.cargado = true;
            return this.clientes;
        } catch (err) {
            toastError('No se pudieron cargar los clientes', err.message);
            return [];
        }
    },

    invalidarClientes() {
        this.cargado = false;
        this.clientes = [];
    }
};

/* =========================================================
   MÓDULO: CLIENTES
   ========================================================= */
const TabClientes = (() => {
    let clientes = [];
    let modoEdicion = false;
    let idEditando = null;
    let guardando = false;
    let filtroBusqueda = '';

    const $ = id => document.getElementById(id);
    const tbody = $('cli-tabla');
    const sinResultados = $('cli-sin-resultados');
    const inputBusqueda = $('cli-busqueda');
    const btnLimpiarBusq = $('cli-limpiar-busq');
    const modal = $('modal-cliente');
    const modalTitulo = $('modal-cliente-titulo');
    const formulario = $('form-cliente');
    const inputCodigo = $('cli-codigo');
    const inputNombre = $('cli-nombre');
    const mensaje = $('cli-mensaje');
    const btnGuardar = $('cli-guardar');

    function mostrarMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = 'alert ' + tipo;
        mensaje.classList.remove('oculto');
    }
    function ocultarMensaje() { mensaje.classList.add('oculto'); }
    function setGuardando(v) {
        guardando = v;
        btnGuardar.disabled = v;
        const txt = btnGuardar.querySelector('.btn-text');
        const spin = btnGuardar.querySelector('.btn-spinner');
        if (txt) txt.textContent = v ? 'Guardando...' : 'Guardar';
        if (spin) spin.classList.toggle('oculto', !v);
    }
    function abrirModal() { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    function cerrarModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        ocultarMensaje();
        modoEdicion = false;
        idEditando = null;
    }
    function buscarPorId(id) {
        return clientes.find(x => Number(x.IdCliente) === Number(id));
    }

    function render() {
        tbody.innerHTML = '';
        const lista = clientes.filter(c => {
            if (!filtroBusqueda) return true;
            return [c.Codigo, c.Nombre].filter(Boolean).join(' ').toLowerCase().includes(filtroBusqueda);
        });

        if (lista.length === 0) {
            sinResultados.classList.remove('oculto');
            return;
        }
        sinResultados.classList.add('oculto');

        lista.forEach(c => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${renderBadgeCliente(c.Codigo)}</td>
                <td><span class="badge-nombre">${escaparHTML(c.Nombre)}</span></td>
                <td class="acciones-tabla"></td>
            `;
            const celda = tr.querySelector('.acciones-tabla');

            const btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'secundario';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', () => abrirEdicion(c.IdCliente));

            const btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', () => eliminar(c.IdCliente));

            celda.appendChild(btnEditar);
            celda.appendChild(btnEliminar);
            tbody.appendChild(tr);
        });
    }

    async function cargar() {
        try {
            clientes = await window.api.clientes.listar();
            Cache.clientes = clientes;
            Cache.cargado = true;
            render();
            TabPisos.refrescarClientes();
            TabDominios.refrescarClientes();
            TabConfig.refrescarClientes();
        } catch (err) {
            toastError('No se pudieron cargar los clientes', err.message);
        }
    }

    function abrirEdicion(id) {
        const c = buscarPorId(id);
        if (!c) { toastError('Cliente no encontrado'); cargar(); return; }

        modoEdicion = true;
        idEditando = c.IdCliente;
        modalTitulo.textContent = 'Editar cliente';
        inputCodigo.value = c.Codigo ?? '';
        inputNombre.value = c.Nombre ?? '';
        ocultarMensaje();
        abrirModal();
        inputNombre.focus();
        inputNombre.select();
    }

    async function eliminar(id) {
        const c = buscarPorId(id);
        const nombreMostrar = c ? `${c.Codigo} — ${c.Nombre}` : `#${id}`;

        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar cliente?',
            html: `Se eliminará <strong>${escaparHTML(nombreMostrar)}</strong>.<br>Esta acción no se puede deshacer.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true, focusCancel: true, buttonsStyling: false,
            customClass: {
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled cl-peligro',
                cancelButton: 'swal2-cancel swal2-styled'
            }
        });
        if (!confirmacion.isConfirmed) return;

        try {
            const res = await window.api.clientes.eliminar(id);
            if (res && res.ok) {
                await cargar();
                toastExito(res.mensaje || 'Cliente eliminado');
            } else {
                toastError('No se pudo eliminar', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error al eliminar', err.message);
        }
    }

    function init() {
        $('cli-btn-nuevo').addEventListener('click', () => {
            modoEdicion = false;
            idEditando = null;
            modalTitulo.textContent = 'Nuevo cliente';
            inputCodigo.value = '';
            inputNombre.value = '';
            ocultarMensaje();
            abrirModal();
            inputCodigo.focus();
        });

        inputBusqueda.addEventListener('input', () => {
            filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
            btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
            render();
        });

        btnLimpiarBusq.addEventListener('click', () => {
            inputBusqueda.value = '';
            filtroBusqueda = '';
            btnLimpiarBusq.classList.add('oculto');
            render();
            inputBusqueda.focus();
        });

        $('modal-cliente-cerrar').addEventListener('click', cerrarModal);
        $('cli-cancelar').addEventListener('click', cerrarModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

        formulario.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (guardando) return;
            const codigo = inputCodigo.value.trim().toUpperCase();
            const nombre = inputNombre.value.trim();
            if (!codigo || !nombre) { mostrarMensaje('Código y nombre son obligatorios.', 'error'); return; }
            if (!/^[A-Z0-9]{1,10}$/.test(codigo)) { mostrarMensaje('El código solo admite letras y números (máx. 10).', 'error'); return; }
            if (nombre.length > 150) { mostrarMensaje('El nombre no puede superar 150 caracteres.', 'error'); return; }

            setGuardando(true);
            try {
                let res;
                if (modoEdicion) res = await window.api.clientes.actualizar(idEditando, codigo, nombre);
                else res = await window.api.clientes.crear(codigo, nombre);

                if (res && res.ok) {
                    cerrarModal();
                    await cargar();
                    toastExito(res.mensaje || 'Guardado');
                } else {
                    mostrarMensaje(res?.mensaje || 'No se pudo guardar.', 'error');
                }
            } catch (err) {
                mostrarMensaje('Error: ' + err.message, 'error');
            } finally {
                setGuardando(false);
            }
        });
    }

    return { init, cargar, render };
})();

/* =========================================================
   MÓDULO: PISOS
   ========================================================= */
const TabPisos = (() => {
    let pisos = [];
    let modoEdicion = false;
    let idEditando = null;
    let guardando = false;
    let filtroBusqueda = '';
    let clientesSeleccionados = new Set();

    const $ = id => document.getElementById(id);
    const contenedor = $('pis-contenedor-grupos');
    const sinResultados = $('pis-sin-resultados');
    const inputBusqueda = $('pis-busqueda');
    const btnLimpiarBusq = $('pis-limpiar-busq');
    const modal = $('modal-piso');
    const modalTitulo = $('modal-piso-titulo');
    const formulario = $('form-piso');
    const inputNombre = $('pis-nombre');
    const inputFilas = $('pis-filas');
    const inputColumnas = $('pis-columnas');
    const listaClientes = $('pis-lista-clientes');
    const mensaje = $('pis-mensaje');
    const btnGuardar = $('pis-guardar');

    function mostrarMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = 'alert ' + tipo;
        mensaje.classList.remove('oculto');
    }
    function ocultarMensaje() { mensaje.classList.add('oculto'); }
    function setGuardando(v) {
        guardando = v;
        btnGuardar.disabled = v;
        const txt = btnGuardar.querySelector('.btn-text');
        const spin = btnGuardar.querySelector('.btn-spinner');
        if (txt) txt.textContent = v ? 'Guardando...' : 'Guardar';
        if (spin) spin.classList.toggle('oculto', !v);
    }
    function abrirModal() { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    function cerrarModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        ocultarMensaje();
        modoEdicion = false;
        idEditando = null;
        clientesSeleccionados.clear();
    }

    function renderCheckboxesClientes() {
        listaClientes.innerHTML = '';
        Cache.clientes.forEach(c => {
            const label = document.createElement('label');
            label.className = 'checkbox-cliente';
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = String(c.IdCliente);
            chk.checked = clientesSeleccionados.has(Number(c.IdCliente));
            chk.addEventListener('change', () => {
                const id = Number(c.IdCliente);
                if (chk.checked) clientesSeleccionados.add(id);
                else clientesSeleccionados.delete(id);
            });
            label.appendChild(chk);
            label.appendChild(document.createTextNode(`${c.Codigo} — ${c.Nombre}`));
            listaClientes.appendChild(label);
        });
    }

    function render() {
        contenedor.innerHTML = '';
        const lista = pisos.filter(p => {
            if (!filtroBusqueda) return true;
            const txt = [p.Nombre, ...(p.clientes || []).map(c => c.Codigo + ' ' + c.Nombre)]
                .filter(Boolean).join(' ').toLowerCase();
            return txt.includes(filtroBusqueda);
        });

        if (lista.length === 0) {
            sinResultados.classList.remove('oculto');
            return;
        }
        sinResultados.classList.add('oculto');

        const tabla = document.createElement('table');
        tabla.className = 'data-table';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th style="width:22%;">Piso</th>
                    <th style="width:48%;">Clientes con acceso</th>
                    <th style="width:15%;">Dimensiones</th>
                    <th style="width:15%; text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = tabla.querySelector('tbody');

        lista.forEach(p => {
            const tr = document.createElement('tr');

            const chips = (p.clientes || []).map(c =>
                `<span style="display:inline-block;margin:2px 3px 2px 0;">${renderBadgeCliente(c.Codigo)}</span>`
            ).join('');

            tr.innerHTML = `
                <td>${renderBadgePiso(p.Nombre)}</td>
                <td>${chips || '<span style="color:#94a3b8;font-size:0.85rem;">Sin clientes</span>'}</td>
                <td><span style="font-weight:600;color:#475569;">${p.Columnas} × ${p.Filas}</span></td>
                <td class="acciones-tabla"></td>
            `;
            const celda = tr.querySelector('.acciones-tabla');

            const btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'secundario';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', () => abrirEdicion(p.IdPiso));

            const btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', () => eliminar(p.IdPiso, p.Nombre));

            celda.appendChild(btnEditar);
            celda.appendChild(btnEliminar);
            tbody.appendChild(tr);
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'card-table';
        wrapper.appendChild(tabla);
        contenedor.appendChild(wrapper);
    }

    async function cargar() {
        try {
            pisos = await window.api.pisos.listar();
            render();
        } catch (err) {
            toastError('No se pudieron cargar los pisos', err.message);
        }
    }

    function abrirEdicion(idPiso) {
        const p = pisos.find(x => Number(x.IdPiso) === Number(idPiso));
        if (!p) { toastError('Piso no encontrado'); cargar(); return; }

        modoEdicion = true;
        idEditando = p.IdPiso;
        modalTitulo.textContent = 'Editar piso';
        inputNombre.value = p.Nombre;
        inputFilas.value = p.Filas;
        inputColumnas.value = p.Columnas;
        clientesSeleccionados = new Set((p.clientes || []).map(c => Number(c.IdCliente)));
        renderCheckboxesClientes();
        ocultarMensaje();
        abrirModal();
        inputNombre.focus();
    }

    async function eliminar(id, nombre) {
        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar piso?',
            html: `Se eliminará el piso <strong>${escaparHTML(nombre)}</strong>.<br>Esta acción no se puede deshacer.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true, focusCancel: true, buttonsStyling: false,
            customClass: {
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled cl-peligro',
                cancelButton: 'swal2-cancel swal2-styled'
            }
        });
        if (!confirmacion.isConfirmed) return;

        try {
            const res = await window.api.pisos.eliminar(id);
            if (res && res.ok) {
                await cargar();
                toastExito(res.mensaje || 'Piso eliminado');
            } else {
                toastError('No se pudo eliminar', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error al eliminar', err.message);
        }
    }

    function init() {
        $('pis-btn-nuevo').addEventListener('click', async () => {
            await Cache.cargarClientes();
            modoEdicion = false;
            idEditando = null;
            modalTitulo.textContent = 'Nuevo piso';
            inputNombre.value = '';
            inputFilas.value = 8;
            inputColumnas.value = 12;
            clientesSeleccionados.clear();
            renderCheckboxesClientes();
            ocultarMensaje();
            abrirModal();
            inputNombre.focus();
        });

        inputBusqueda.addEventListener('input', () => {
            filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
            btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
            render();
        });

        btnLimpiarBusq.addEventListener('click', () => {
            inputBusqueda.value = '';
            filtroBusqueda = '';
            btnLimpiarBusq.classList.add('oculto');
            render();
            inputBusqueda.focus();
        });

        $('modal-piso-cerrar').addEventListener('click', cerrarModal);
        $('pis-cancelar').addEventListener('click', cerrarModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

        formulario.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (guardando) return;
            const nombre = inputNombre.value.trim();
            const filas = parseInt(inputFilas.value, 10);
            const cols = parseInt(inputColumnas.value, 10);
            const ids = Array.from(clientesSeleccionados);

            if (!nombre) { mostrarMensaje('El nombre es obligatorio.', 'error'); return; }
            if (!filas || filas < 1) { mostrarMensaje('Filas debe ser mayor a 0.', 'error'); return; }
            if (!cols || cols < 1) { mostrarMensaje('Columnas debe ser mayor a 0.', 'error'); return; }
            if (ids.length === 0) { mostrarMensaje('Selecciona al menos un cliente.', 'error'); return; }

            setGuardando(true);
            try {
                let res;
                if (modoEdicion) res = await window.api.pisos.actualizarConClientes(idEditando, nombre, filas, cols, ids);
                else res = await window.api.pisos.crear(nombre, filas, cols, ids);

                if (res && res.ok) {
                    cerrarModal();
                    await cargar();
                    toastExito(res.mensaje || 'Guardado');
                } else {
                    mostrarMensaje(res?.mensaje || 'No se pudo guardar.', 'error');
                }
            } catch (err) {
                mostrarMensaje('Error: ' + err.message, 'error');
            } finally {
                setGuardando(false);
            }
        });
    }

    function refrescarClientes() {
        if (modal.style.display === 'flex') {
            renderCheckboxesClientes();
        }
    }

    return { init, cargar, render, refrescarClientes };
})();

/* =========================================================
   MÓDULO: ROLES
   ========================================================= */
const TabRoles = (() => {
    let roles = [];
    let modoEdicion = false;
    let idEditando = null;
    let guardando = false;
    let filtroBusqueda = '';

    const $ = id => document.getElementById(id);
    const tbody = $('rol-tabla');
    const sinResultados = $('rol-sin-resultados');
    const inputBusqueda = $('rol-busqueda');
    const btnLimpiarBusq = $('rol-limpiar-busq');
    const modal = $('modal-rol');
    const modalTitulo = $('modal-rol-titulo');
    const formulario = $('form-rol');
    const inputCodigo = $('rol-codigo');
    const inputNombre = $('rol-nombre');
    const inputDesc = $('rol-descripcion');
    const mensaje = $('rol-mensaje');
    const btnGuardar = $('rol-guardar');

    function mostrarMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = 'alert ' + tipo;
        mensaje.classList.remove('oculto');
    }
    function ocultarMensaje() { mensaje.classList.add('oculto'); }
    function setGuardando(v) {
        guardando = v;
        btnGuardar.disabled = v;
        const txt = btnGuardar.querySelector('.btn-text');
        const spin = btnGuardar.querySelector('.btn-spinner');
        if (txt) txt.textContent = v ? 'Guardando...' : 'Guardar';
        if (spin) spin.classList.toggle('oculto', !v);
    }
    function abrirModal() { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    function cerrarModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        ocultarMensaje();
        modoEdicion = false;
        idEditando = null;
    }
    function buscarPorId(id) {
        return roles.find(x => Number(x.IdRolEquipo) === Number(id));
    }

    function render() {
        tbody.innerHTML = '';
        const lista = roles.filter(r => {
            if (!filtroBusqueda) return true;
            return [r.Codigo, r.Nombre, r.Descripcion].filter(Boolean).join(' ').toLowerCase().includes(filtroBusqueda);
        });

        if (lista.length === 0) {
            sinResultados.classList.remove('oculto');
            return;
        }
        sinResultados.classList.add('oculto');

        lista.forEach(r => {
            const tr = document.createElement('tr');
            const descHTML = (r.Descripcion && r.Descripcion.trim())
                ? `<span class="badge-desc">${escaparHTML(r.Descripcion)}</span>`
                : `<span class="badge-desc vacia">— sin descripción —</span>`;

            tr.innerHTML = `
                <td>${renderBadgeRol(r.Codigo)}</td>
                <td><span class="badge-nombre">${escaparHTML(r.Nombre)}</span></td>
                <td>${descHTML}</td>
                <td class="acciones-tabla"></td>
            `;
            const celda = tr.querySelector('.acciones-tabla');

            const btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'secundario';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', () => abrirEdicion(r.IdRolEquipo));

            const btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', () => eliminar(r.IdRolEquipo));

            celda.appendChild(btnEditar);
            celda.appendChild(btnEliminar);
            tbody.appendChild(tr);
        });
    }

    async function cargar() {
        try {
            roles = await window.api.roles.listar();
            render();
        } catch (err) {
            toastError('No se pudieron cargar los roles', err.message);
        }
    }

    function abrirEdicion(id) {
        const r = buscarPorId(id);
        if (!r) { toastError('Rol no encontrado'); cargar(); return; }

        modoEdicion = true;
        idEditando = r.IdRolEquipo;
        modalTitulo.textContent = 'Editar rol';
        inputCodigo.value = r.Codigo ?? '';
        inputNombre.value = r.Nombre ?? '';
        inputDesc.value = r.Descripcion ?? '';
        ocultarMensaje();
        abrirModal();
        inputNombre.focus();
        inputNombre.select();
    }

    async function eliminar(id) {
        const r = buscarPorId(id);
        const nombreMostrar = r ? `${r.Codigo} — ${r.Nombre}` : `#${id}`;

        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar rol?',
            html: `Se eliminará <strong>${escaparHTML(nombreMostrar)}</strong>.<br>Esta acción no se puede deshacer.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true, focusCancel: true, buttonsStyling: false,
            customClass: {
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled cl-peligro',
                cancelButton: 'swal2-cancel swal2-styled'
            }
        });
        if (!confirmacion.isConfirmed) return;

        try {
            const res = await window.api.roles.eliminar(id);
            if (res && res.ok) {
                await cargar();
                toastExito(res.mensaje || 'Rol eliminado');
            } else {
                toastError('No se pudo eliminar', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error al eliminar', err.message);
        }
    }

    function init() {
        $('rol-btn-nuevo').addEventListener('click', () => {
            modoEdicion = false;
            idEditando = null;
            modalTitulo.textContent = 'Nuevo rol';
            inputCodigo.value = '';
            inputNombre.value = '';
            inputDesc.value = '';
            ocultarMensaje();
            abrirModal();
            inputCodigo.focus();
        });

        inputBusqueda.addEventListener('input', () => {
            filtroBusqueda = inputBusqueda.value.trim().toLowerCase();
            btnLimpiarBusq.classList.toggle('oculto', !filtroBusqueda);
            render();
        });

        btnLimpiarBusq.addEventListener('click', () => {
            inputBusqueda.value = '';
            filtroBusqueda = '';
            btnLimpiarBusq.classList.add('oculto');
            render();
            inputBusqueda.focus();
        });

        $('modal-rol-cerrar').addEventListener('click', cerrarModal);
        $('rol-cancelar').addEventListener('click', cerrarModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

        formulario.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (guardando) return;
            const codigo = inputCodigo.value.trim().toUpperCase();
            const nombre = inputNombre.value.trim();
            const desc = inputDesc.value.trim() || null;

            if (!codigo || !nombre) { mostrarMensaje('Código y nombre son obligatorios.', 'error'); return; }
            if (!/^[A-Z0-9]{1,10}$/.test(codigo)) { mostrarMensaje('El código solo admite letras y números (máx. 10).', 'error'); return; }
            if (nombre.length > 100) { mostrarMensaje('El nombre no puede superar 100 caracteres.', 'error'); return; }
            if (desc && desc.length > 200) { mostrarMensaje('La descripción no puede superar 200 caracteres.', 'error'); return; }

            setGuardando(true);
            try {
                let res;
                if (modoEdicion) res = await window.api.roles.actualizar(idEditando, codigo, nombre, desc);
                else res = await window.api.roles.crear(codigo, nombre, desc);

                if (res && res.ok) {
                    cerrarModal();
                    await cargar();
                    toastExito(res.mensaje || 'Guardado');
                } else {
                    mostrarMensaje(res?.mensaje || 'No se pudo guardar.', 'error');
                }
            } catch (err) {
                mostrarMensaje('Error: ' + err.message, 'error');
            } finally {
                setGuardando(false);
            }
        });
    }

    return { init, cargar, render };
})();

/* =========================================================
   MÓDULO: DOMINIOS
   ========================================================= */
const TabDominios = (() => {
    let dominios = [];
    const $ = id => document.getElementById(id);
    const tbody = $('dom-tabla');
    const filtroCliente = $('dom-filtro-cliente');
    const filtroBusqueda = $('dom-filtro-busqueda');

    async function cargar() {
        try {
            const filtros = {
                idCliente: parseInt(filtroCliente.value, 10) || null,
                busqueda: filtroBusqueda.value.trim() || null
            };
            dominios = await window.api.dominios.listarTodas(filtros);
            render();
        } catch (err) {
            toastError('No se pudieron cargar los dominios', err.message);
        }
    }

    function render() {
        tbody.innerHTML = '';
        if (!dominios || dominios.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" style="text-align:center;color:#94a3b8;padding:40px;font-style:italic;">Sin dominios registrados</td>`;
            tbody.appendChild(tr);
            return;
        }

        dominios.forEach(d => {
            const tr = document.createElement('tr');
            const passMostrada = (d.Password && d.Password.length > 0)
                ? '•'.repeat(Math.min(d.Password.length, 12)) : '—';
            const descHTML = (d.Descripcion && d.Descripcion.trim())
                ? `<span class="badge-desc">${escaparHTML(d.Descripcion)}</span>`
                : `<span class="badge-desc vacia">— sin descripción —</span>`;

            tr.innerHTML = `
                <td>${renderBadgeCliente(d.ClienteCodigo)}</td>
                <td><span class="badge-nombre">${escaparHTML(d.Usuario)}</span></td>
                <td><span style="font-family:monospace;color:#64748b;">${passMostrada}</span></td>
                <td>${descHTML}</td>
                <td class="acciones-tabla"></td>
            `;
            const celda = tr.querySelector('.acciones-tabla');

            const btnEditar = document.createElement('button');
            btnEditar.type = 'button';
            btnEditar.className = 'secundario';
            btnEditar.textContent = 'Editar';
            btnEditar.addEventListener('click', () => abrirEditar(d));

            const btnEliminar = document.createElement('button');
            btnEliminar.type = 'button';
            btnEliminar.className = 'peligro';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', () => eliminar(d));

            celda.appendChild(btnEditar);
            celda.appendChild(btnEliminar);
            tbody.appendChild(tr);
        });
    }

    async function abrirCrear() {
        const clientes = await Cache.cargarClientes();
        if (clientes.length === 0) {
            Swal.fire({
                icon: 'warning', title: 'Sin clientes',
                text: 'Primero crea al menos un cliente.',
                confirmButtonText: 'Entendido', buttonsStyling: false,
                customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
            });
            return;
        }

        const opciones = clientes.map(c =>
            `<option value="${c.IdCliente}">${escaparHTML(c.Codigo)} - ${escaparHTML(c.Nombre)}</option>`
        ).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Nuevo dominio',
            html: `
                <select id="swal-cliente" class="swal2-select">
                    <option value="">-- Cliente --</option>
                    ${opciones}
                </select>
                <input id="swal-usuario" class="swal2-input" placeholder="Usuario">
                <input id="swal-password" class="swal2-input" placeholder="Password">
                <input id="swal-desc" class="swal2-input" placeholder="Descripción (opcional)">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            buttonsStyling: false,
            customClass: {
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled',
                cancelButton: 'swal2-cancel swal2-styled'
            },
            preConfirm: () => {
                const idCliente = parseInt($('swal-cliente').value, 10);
                const usuario = $('swal-usuario').value.trim();
                const password = $('swal-password').value;
                const desc = $('swal-desc').value.trim();
                if (!idCliente || !usuario || !password) {
                    Swal.showValidationMessage('Cliente, usuario y password son obligatorios');
                    return false;
                }
                return { idCliente, usuario, password, desc };
            }
        });

        if (!formValues) return;

        try {
            const res = await window.api.dominios.crear(
                formValues.idCliente, formValues.usuario, formValues.password, formValues.desc
            );
            if (res && res.ok) {
                await cargar();
                toastExito(res.mensaje || 'Dominio creado');
            } else {
                toastError('No se pudo crear', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error', err.message);
        }
    }

    async function abrirEditar(d) {
        const { value: formValues } = await Swal.fire({
            title: 'Editar dominio',
            html: `
                <input id="swal-usuario" class="swal2-input" placeholder="Usuario" value="${escaparHTML(d.Usuario)}">
                <input id="swal-password" class="swal2-input" placeholder="Password" value="${escaparHTML(d.Password)}">
                <input id="swal-desc" class="swal2-input" placeholder="Descripción" value="${escaparHTML(d.Descripcion ?? '')}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            buttonsStyling: false,
            customClass: {
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled',
                cancelButton: 'swal2-cancel swal2-styled'
            },
            preConfirm: () => {
                const usuario = $('swal-usuario').value.trim();
                const password = $('swal-password').value;
                const desc = $('swal-desc').value.trim();
                if (!usuario || !password) {
                    Swal.showValidationMessage('Usuario y password son obligatorios');
                    return false;
                }
                return { usuario, password, desc };
            }
        });

        if (!formValues) return;

        try {
            const res = await window.api.dominios.actualizar(
                d.IdDominio, formValues.usuario, formValues.password, formValues.desc
            );
            if (res && res.ok) {
                await cargar();
                toastExito(res.mensaje || 'Dominio actualizado');
            } else {
                toastError('No se pudo actualizar', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error', err.message);
        }
    }

    async function eliminar(d) {
        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar dominio?',
            html: `Se eliminará <strong>${escaparHTML(d.Usuario)}</strong> de <strong>${escaparHTML(d.ClienteCodigo)}</strong>.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true, focusCancel: true, buttonsStyling: false,
            customClass: {
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled cl-peligro',
                cancelButton: 'swal2-cancel swal2-styled'
            }
        });
        if (!confirmacion.isConfirmed) return;

        try {
            const res = await window.api.dominios.eliminar(d.IdDominio);
            if (res && res.ok) {
                await cargar();
                toastExito(res.mensaje || 'Dominio eliminado');
            } else {
                toastError('No se pudo eliminar', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error al eliminar', err.message);
        }
    }

    async function refrescarClientes() {
        const clientes = Cache.clientes;
        const valorActual = filtroCliente.value;
        filtroCliente.innerHTML = '<option value="">Todos los clientes</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.IdCliente);
            opt.textContent = `${c.Codigo} - ${c.Nombre}`;
            filtroCliente.appendChild(opt);
        });
        if (valorActual && Array.from(filtroCliente.options).some(o => o.value === valorActual)) {
            filtroCliente.value = valorActual;
        }
    }

    function init() {
        $('dom-btn-nuevo').addEventListener('click', abrirCrear);
        filtroCliente.addEventListener('change', cargar);

        let debounce = null;
        filtroBusqueda.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(cargar, 250);
        });
    }

    return { init, cargar, render, refrescarClientes };
})();

/* =========================================================
   MÓDULO: CONFIGURACIÓN DE RED
   ========================================================= */
const TabConfig = (() => {
    let configs = [];
    const $ = id => document.getElementById(id);
    const contenedor = $('cfg-contenedor-grupos');
    const sinResultados = $('cfg-sin-resultados');
    const filtroCliente = $('cfg-filtro-cliente');
    const filtroTipo = $('cfg-filtro-tipo');
    const filtroBusqueda = $('cfg-filtro-busqueda');

    async function cargar() {
        try {
            const filtros = {
                idCliente: parseInt(filtroCliente.value, 10) || null,
                tipo: filtroTipo.value || null,
                busqueda: filtroBusqueda.value.trim() || null
            };
            configs = await window.api.config.listarTodas(filtros);
            render();
        } catch (err) {
            toastError('No se pudieron cargar las configuraciones', err.message);
        }
    }

    function render() {
        contenedor.innerHTML = '';
        if (!configs || configs.length === 0) {
            sinResultados.classList.remove('oculto');
            return;
        }
        sinResultados.classList.add('oculto');

        const porCliente = new Map();
        configs.forEach(c => {
            const key = c.ClienteCodigo;
            if (!porCliente.has(key)) {
                porCliente.set(key, { codigo: c.ClienteCodigo, nombre: c.ClienteNombre, items: [] });
            }
            porCliente.get(key).items.push(c);
        });

        const ordenados = Array.from(porCliente.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));

        ordenados.forEach(g => {
            const divCliente = document.createElement('div');
            divCliente.className = 'grupo-cliente colapsado';

            divCliente.innerHTML = `
                <div class="grupo-cliente-header">
                    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    ${renderBadgeCliente(g.codigo, g.nombre)}
                    <span style="margin-left:auto;font-size:0.75rem;color:#94a3b8;font-weight:600;">
                        ${g.items.length} ${g.items.length === 1 ? 'registro' : 'registros'}
                    </span>
                </div>
            `;
            divCliente.querySelector('.grupo-cliente-header').addEventListener('click', () => {
                divCliente.classList.toggle('colapsado');
            });

            const body = document.createElement('div');
            body.className = 'grupo-cliente-body';

            const tabla = document.createElement('table');
            tabla.className = 'data-table';
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

            g.items.sort((a, b) => (a.Tipo || '').localeCompare(b.Tipo || '')).forEach(c => {
                const tr = document.createElement('tr');
                const descHTML = (c.Descripcion && c.Descripcion.trim())
                    ? `<span class="badge-desc">${escaparHTML(c.Descripcion)}</span>`
                    : `<span class="badge-desc vacia">— sin descripción —</span>`;

                tr.innerHTML = `
                    <td>${renderBadgeTipoConfig(c.Tipo)}</td>
                    <td><span class="badge-nombre">${escaparHTML(c.Valor)}</span></td>
                    <td>${descHTML}</td>
                    <td class="acciones-tabla"></td>
                `;
                const celda = tr.querySelector('.acciones-tabla');

                const btnEditar = document.createElement('button');
                btnEditar.type = 'button';
                btnEditar.className = 'secundario';
                btnEditar.textContent = 'Editar';
                btnEditar.addEventListener('click', () => abrirEditar(c));

                const btnEliminar = document.createElement('button');
                btnEliminar.type = 'button';
                btnEliminar.className = 'peligro';
                btnEliminar.textContent = 'Eliminar';
                btnEliminar.addEventListener('click', () => eliminar(c));

                celda.appendChild(btnEditar);
                celda.appendChild(btnEliminar);
                tbody.appendChild(tr);
            });

            body.appendChild(tabla);
            divCliente.appendChild(body);
            contenedor.appendChild(divCliente);
        });
    }

    async function abrirCrear() {
        const clientes = await Cache.cargarClientes();
        if (clientes.length === 0) {
            Swal.fire({
                icon: 'warning', title: 'Sin clientes',
                text: 'Primero crea al menos un cliente.',
                confirmButtonText: 'Entendido', buttonsStyling: false,
                customClass: { popup: 'cl-confirm', confirmButton: 'swal2-confirm swal2-styled' }
            });
            return;
        }

        const opciones = clientes.map(c =>
            `<option value="${c.IdCliente}">${escaparHTML(c.Codigo)} - ${escaparHTML(c.Nombre)}</option>`
        ).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Nueva configuración de red',
            html: `
                <select id="swal-cliente" class="swal2-select">
                    <option value="">-- Selecciona cliente --</option>
                    ${opciones}
                </select>
                <select id="swal-tipo" class="swal2-select">
                    <option value="">-- Tipo --</option>
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
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled',
                cancelButton: 'swal2-cancel swal2-styled'
            },
            preConfirm: () => {
                const idCliente = parseInt($('swal-cliente').value, 10);
                const tipo = $('swal-tipo').value;
                const valor = $('swal-valor').value.trim();
                const desc = $('swal-desc').value.trim();

                if (!idCliente || !tipo || !valor) {
                    Swal.showValidationMessage('Cliente, tipo y valor son obligatorios');
                    return false;
                }
                if (!esIPv4Valida(valor)) {
                    Swal.showValidationMessage('El valor debe ser una IPv4 válida');
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
                await cargar();
                toastExito(res.mensaje || 'Configuración creada');
            } else {
                toastError('No se pudo crear', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error', err.message);
        }
    }

    async function abrirEditar(c) {
        const { value: formValues } = await Swal.fire({
            title: 'Editar configuración',
            html: `
                <div style="text-align:left;font-size:12.5px;color:#4a5568;margin-bottom:10px;">
                    <strong>${escaparHTML(c.ClienteCodigo)}</strong> — ${escaparHTML(nombreTipoConfig(c.Tipo))}
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
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled',
                cancelButton: 'swal2-cancel swal2-styled'
            },
            preConfirm: () => {
                const valor = $('swal-valor').value.trim();
                const desc = $('swal-desc').value.trim();
                if (!valor) { Swal.showValidationMessage('El valor es obligatorio'); return false; }
                if (!esIPv4Valida(valor)) { Swal.showValidationMessage('El valor debe ser una IPv4 válida'); return false; }
                return { valor, desc };
            }
        });

        if (!formValues) return;

        try {
            const res = await window.api.config.actualizar(c.IdConfig, formValues.valor, formValues.desc);
            if (res && res.ok) {
                await cargar();
                toastExito(res.mensaje || 'Configuración actualizada');
            } else {
                toastError('No se pudo actualizar', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error', err.message);
        }
    }

    async function eliminar(c) {
        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar configuración?',
            html: `Se eliminará <strong>${escaparHTML(c.Valor)}</strong> del catálogo de <strong>${escaparHTML(c.ClienteCodigo)}</strong>.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true, focusCancel: true, buttonsStyling: false,
            customClass: {
                popup: 'cl-confirm',
                confirmButton: 'swal2-confirm swal2-styled cl-peligro',
                cancelButton: 'swal2-cancel swal2-styled'
            }
        });
        if (!confirmacion.isConfirmed) return;

        try {
            const res = await window.api.config.eliminar(c.IdConfig);
            if (res && res.ok) {
                await cargar();
                toastExito(res.mensaje || 'Configuración eliminada');
            } else {
                toastError('No se pudo eliminar', res?.mensaje || 'Error');
            }
        } catch (err) {
            toastError('Error al eliminar', err.message);
        }
    }

    async function refrescarClientes() {
        const clientes = Cache.clientes;
        const valorActual = filtroCliente.value;
        filtroCliente.innerHTML = '<option value="">Todos los clientes</option>';
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.IdCliente);
            opt.textContent = `${c.Codigo} - ${c.Nombre}`;
            filtroCliente.appendChild(opt);
        });
        if (valorActual && Array.from(filtroCliente.options).some(o => o.value === valorActual)) {
            filtroCliente.value = valorActual;
        }
    }

    function init() {
        $('cfg-btn-nuevo').addEventListener('click', abrirCrear);
        filtroCliente.addEventListener('change', cargar);
        filtroTipo.addEventListener('change', cargar);

        let debounce = null;
        filtroBusqueda.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(cargar, 250);
        });
    }

    return { init, cargar, render, refrescarClientes };
})();

/* =========================================================
   ORQUESTADOR DE TABS
   ========================================================= */
const TabsConfig = {
    clientes: { cargar: () => TabClientes.cargar() },
    pisos:    { cargar: () => TabPisos.cargar() },
    roles:    { cargar: () => TabRoles.cargar() },
    dominios: { cargar: () => TabDominios.cargar() },
    config:   { cargar: () => TabConfig.cargar() }
};

let tabActivo = 'clientes';

function activarTab(nombre) {
    if (!TabsConfig[nombre]) return;
    tabActivo = nombre;

    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.tab === nombre);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('activo', p.dataset.tabPanel === nombre);
    });

    TabsConfig[nombre].cargar();
}

/* =========================================================
   INIT GLOBAL
   ========================================================= */
(async () => {
    document.getElementById('btn-volver').addEventListener('click', () => window.api.volverMenu());

    document.getElementById('tabs-nav').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        activarTab(btn.dataset.tab);
    });

    TabClientes.init();
    TabPisos.init();
    TabRoles.init();
    TabDominios.init();
    TabConfig.init();

    await Cache.cargarClientes();
    await TabClientes.cargar();
    await TabDominios.refrescarClientes();
    await TabConfig.refrescarClientes();

    limpiarResiduosSwal();
})();