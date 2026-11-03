const $ = id => document.getElementById(id);
const formIP = $('form-ip');
const formCatalogo = $('form-catalogo');
const tipoCatalogo = $('tipo-catalogo');
const textoCatalogo = $('nombre-catalogo');

let registros = [];
let catalogos = [];
let idEditando = null;
let catalogoEditando = null;
let paginaActual = 1;
let tamanoPagina = 25;

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

function badge(valor, clase, vacio = '—') {
    return `<span class="ip-badge ${clase}${valor ? '' : ' vacio'}">${escaparHTML(valor || vacio)}</span>`;
}

function mostrarError(mensaje) {
    window.Swal.fire({ icon: 'error', title: 'No se pudo completar', text: mensaje || 'Error desconocido.' });
}

function catalogoPorId(id) {
    return catalogos.find(item => Number(item.IdCatalogoIP) === Number(id));
}

function llenarSelect(id, tipo, seleccion = '') {
    const select = $(id);
    const opciones = catalogos.filter(item => item.TipoCatalogo === tipo && item.Activo);
    select.replaceChildren(new Option('Selecciona...', ''));
    for (const item of opciones) {
        select.add(new Option(item.Nombre, String(item.IdCatalogoIP)));
    }
    select.value = String(seleccion || '');
}

function actualizarFormularioCatalogos() {
    llenarSelect('estado', 'Estado');
    llenarSelect('dispositivo', 'Dispositivo');
    llenarSelect('tipoEquipo', 'TipoEquipo');
    llenarSelect('piso', 'Piso');
    llenarSelect('site', 'Site');
    llenarSelect('tipoIP', 'TipoIP');
}

async function eliminarRegistro(item) {
    const confirmacion = await window.Swal.fire({
        icon: 'warning',
        title: '¿Eliminar registro de IP?',
        text: `Se eliminará ${item.IP || item.Hostname || 'el registro'} del control general.`,
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!confirmacion.isConfirmed) return;
    try {
        const result = await window.api.inventarioIP.eliminar(item.IdInventarioIP);
        if (!result?.ok) return mostrarError(result?.mensaje);
        await cargar();
        window.Swal.fire({
            toast: true,
            position: 'bottom-end',
            icon: 'success',
            title: result.mensaje,
            showConfirmButton: false,
            timer: 2500
        });
    } catch (error) {
        mostrarError(error.message);
    }
}

function renderizarTabla() {
    const termino = $('busqueda').value.trim().toLocaleLowerCase();
    const cuerpo = $('tabla-ip');
    cuerpo.replaceChildren();
    const lista = registros.filter(registro =>
        [registro.Origen, registro.IP, registro.Hostname, registro.MAC, registro.Descripcion, registro.PuertoFortinet,
            registro.Estado, registro.Dispositivo, registro.TipoEquipo, registro.Piso,
            registro.ClienteCodigo, registro.ClienteNombre, registro.Site]
            .some(valor => String(valor || '').toLocaleLowerCase().includes(termino))
    );
    const totalPaginas = Math.max(1, Math.ceil(lista.length / tamanoPagina));
    paginaActual = Math.min(paginaActual, totalPaginas);
    const inicio = (paginaActual - 1) * tamanoPagina;
    const pagina = lista.slice(inicio, inicio + tamanoPagina);
    $('sin-registros').hidden = lista.length > 0;
    for (const item of pagina) {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${badge(item.Origen, item.Origen === 'Cliente' ? 'origen-cliente' : 'origen-general')}</td>
            <td>${badge(item.Estado, item.Estado === 'Activo' ? 'estado-activo' : 'estado-inactivo')}</td>
            <td>${badge(item.IP || 'DHCP', 'ip')}</td>
            <td>${badge(item.Hostname, 'hostname')}</td>
            <td>${badge(item.MAC, 'dato')}</td>
            <td>${badge(item.Dispositivo, 'dato')}</td>
            <td>${badge(item.TipoEquipo, 'dato')}</td>
            <td>${badge(item.Piso, 'dato')}</td>
            <td>${badge(item.ClienteCodigo ? `${item.ClienteCodigo} — ${item.ClienteNombre}` : '', 'cliente')}</td>
            <td>${badge(item.Site, 'dato')}</td>
            <td>${badge(item.PuertoFortinet, 'dato')}</td>
            <td class="descripcion-celda">${badge(item.Descripcion, 'dato')}</td>`;
        const acciones = document.createElement('td');
        acciones.className = 'actions';
        if (item.Origen === 'General') {
            const editar = document.createElement('button');
            editar.type = 'button';
            editar.className = 'button secondary';
            editar.dataset.permiso = 'equipos:editar';
            editar.textContent = 'Editar';
            editar.addEventListener('click', () => editarRegistro(item));
            const eliminar = document.createElement('button');
            eliminar.type = 'button';
            eliminar.className = 'button danger';
            eliminar.dataset.permiso = 'equipos:eliminar';
            eliminar.textContent = 'Eliminar';
            eliminar.addEventListener('click', () => eliminarRegistro(item));
            acciones.append(editar, eliminar);
        } else {
            const editar = document.createElement('button');
            editar.type = 'button';
            editar.className = 'button secondary';
            editar.dataset.permiso = 'equipos:editar';
            editar.textContent = 'Editar datos';
            editar.addEventListener('click', () => editarDatosCliente(item));
            acciones.append(editar);
        }
        fila.append(acciones);
        cuerpo.append(fila);
    }
    $('resumen-paginacion').textContent = lista.length
        ? `${inicio + 1}–${Math.min(inicio + tamanoPagina, lista.length)} de ${lista.length}`
        : '0 registros';
    $('pagina-anterior').disabled = paginaActual <= 1;
    $('pagina-siguiente').disabled = paginaActual >= totalPaginas;
    window.PermisosUI?.aplicar(cuerpo);
}

async function editarDatosCliente(item) {
    const opciones = tipo => catalogos
        .filter(catalogo => catalogo.TipoCatalogo === tipo && catalogo.Activo)
        .map(catalogo => `<option value="${catalogo.IdCatalogoIP}">${escaparHTML(catalogo.Nombre)}</option>`)
        .join('');
    const resultado = await window.Swal.fire({
        title: `Datos complementarios: ${escaparHTML(item.Hostname || item.IP)}`,
        html: `
            <div class="edicion-cliente-grid">
                <label>MAC<input id="cliente-mac" maxlength="17" value="${escaparHTML(item.MAC)}" placeholder="00:11:22:33:44:55"></label>
                <label>Dispositivo<select id="cliente-dispositivo"><option value="">Sin asignar</option>${opciones('Dispositivo')}</select></label>
                <label>Tipo<select id="cliente-tipo"><option value="">Sin asignar</option>${opciones('TipoEquipo')}</select></label>
                <label>Site<select id="cliente-site"><option value="">Sin asignar</option>${opciones('Site')}</select></label>
                <label>Puerto Fortinet<input id="cliente-puerto" maxlength="100" value="${escaparHTML(item.PuertoFortinet)}"></label>
                <label class="wide">Descripción<input id="cliente-descripcion" maxlength="500" value="${escaparHTML(item.Descripcion)}"></label>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Guardar datos',
        cancelButtonText: 'Cancelar',
        didOpen: popup => {
            popup.querySelector('#cliente-dispositivo').value = String(item.IdDispositivo || '');
            popup.querySelector('#cliente-tipo').value = String(item.IdTipoEquipo || '');
            popup.querySelector('#cliente-site').value = String(item.IdSite || '');
        },
        preConfirm: () => ({
            mac: $('cliente-mac').value.trim(),
            idDispositivo: $('cliente-dispositivo').value || null,
            idTipoEquipo: $('cliente-tipo').value || null,
            idSite: $('cliente-site').value || null,
            puertoFortinet: $('cliente-puerto').value.trim(),
            descripcion: $('cliente-descripcion').value.trim()
        })
    });
    if (!resultado.isConfirmed) return;
    try {
        const guardado = await window.api.inventarioIP.actualizarDatosEquipoCliente(item.IdEquipo, resultado.value);
        if (!guardado?.ok) return mostrarError(guardado?.mensaje);
        await cargar();
        window.Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: guardado.mensaje, showConfirmButton: false, timer: 2500 });
    } catch (error) {
        mostrarError(error.message);
    }
}

function renderizarCatalogos() {
    const contenedor = $('lista-catalogos');
    contenedor.replaceChildren();
    const items = catalogos.filter(item => item.TipoCatalogo === tipoCatalogo.value);
    for (const item of items) {
        const fila = document.createElement('div');
        fila.className = 'catalog-item';
        const nombre = document.createElement('span');
        nombre.className = 'catalog-name';
        nombre.textContent = item.Nombre;
        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'button secondary';
        editar.dataset.permiso = 'equipos:editar';
        editar.textContent = 'Editar';
        editar.addEventListener('click', () => {
            catalogoEditando = item.IdCatalogoIP;
            textoCatalogo.value = item.Nombre;
            $('btn-guardar-catalogo').textContent = 'Guardar cambio';
            $('btn-cancelar-catalogo').hidden = false;
        });
        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'button danger';
        eliminar.dataset.permiso = 'equipos:eliminar';
        eliminar.textContent = 'Eliminar';
        eliminar.addEventListener('click', async () => {
            const confirmacion = await window.Swal.fire({
                icon: 'warning',
                title: '¿Eliminar opción?',
                text: `Se eliminará "${item.Nombre}" del catálogo.`,
                showCancelButton: true,
                confirmButtonText: 'Eliminar',
                cancelButtonText: 'Cancelar'
            });
            if (!confirmacion.isConfirmed) return;
            try {
                const result = await window.api.inventarioIP.eliminarCatalogo(item.IdCatalogoIP);
                if (!result?.ok) return mostrarError(result?.mensaje);
                await cargar();
            } catch (error) {
                mostrarError(error.message);
            }
        });
        fila.append(nombre, editar, eliminar);
        contenedor.append(fila);
    }
    window.PermisosUI?.aplicar(contenedor);
}

function editarRegistro(item) {
    idEditando = item.IdInventarioIP;
    $('ip').value = item.IP || '';
    $('hostname').value = item.Hostname || '';
    $('mac').value = item.MAC || '';
    $('descripcion').value = item.Descripcion || '';
    $('puertoFortinet').value = item.PuertoFortinet || '';
    llenarSelect('estado', 'Estado', item.IdEstado);
    llenarSelect('dispositivo', 'Dispositivo', item.IdDispositivo);
    llenarSelect('tipoEquipo', 'TipoEquipo', item.IdTipoEquipo);
    llenarSelect('piso', 'Piso', item.IdPiso);
    llenarSelect('site', 'Site', item.IdSite);
    llenarSelect('tipoIP', 'TipoIP', item.IdTipoIP);
    $('btn-guardar').textContent = 'Guardar cambios';
    $('btn-guardar').dataset.permiso = 'equipos:editar';
    $('btn-cancelar-edicion').hidden = false;
    window.PermisosUI?.aplicar($('btn-guardar'));
    $('ip').focus();
}

function limpiarFormulario() {
    formIP.reset();
    idEditando = null;
    $('btn-guardar').textContent = 'Registrar IP';
    $('btn-guardar').dataset.permiso = 'equipos:crear';
    $('btn-cancelar-edicion').hidden = true;
    actualizarFormularioCatalogos();
    window.PermisosUI?.aplicar($('btn-guardar'));
}

async function cargar() {
    const [listaCatalogos, listaRegistros] = await Promise.all([
        window.api.inventarioIP.listarCatalogos(),
        window.api.inventarioIP.listar()
    ]);
    if (!Array.isArray(listaCatalogos)) throw new Error(listaCatalogos?.mensaje || 'No se pudieron cargar los catálogos.');
    if (!Array.isArray(listaRegistros)) throw new Error(listaRegistros?.mensaje || 'No se pudieron cargar las IP.');
    catalogos = listaCatalogos;
    registros = listaRegistros;
    actualizarFormularioCatalogos();
    renderizarTabla();
    renderizarCatalogos();
}

formIP.addEventListener('submit', async event => {
    event.preventDefault();
    const datos = {
        ip: $('ip').value.trim(),
        tipoIP: catalogoPorId($('tipoIP').value)?.Nombre,
        hostname: $('hostname').value.trim(),
        mac: $('mac').value.trim(),
        descripcion: $('descripcion').value.trim(),
        puertoFortinet: $('puertoFortinet').value.trim(),
        idEstado: $('estado').value,
        idDispositivo: $('dispositivo').value,
        idTipoEquipo: $('tipoEquipo').value,
        idPiso: $('piso').value,
        idSite: $('site').value,
        idTipoIP: $('tipoIP').value
    };
    const button = $('btn-guardar');
    button.disabled = true;
    try {
        const result = idEditando
            ? await window.api.inventarioIP.actualizar(idEditando, datos)
            : await window.api.inventarioIP.crear(datos);
        if (!result?.ok) return mostrarError(result?.mensaje);
        limpiarFormulario();
        await cargar();
        window.Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: result.mensaje, showConfirmButton: false, timer: 2500 });
    } catch (error) {
        mostrarError(error.message);
    } finally {
        button.disabled = false;
    }
});

formCatalogo.addEventListener('submit', async event => {
    event.preventDefault();
    try {
        const result = catalogoEditando
            ? await window.api.inventarioIP.actualizarCatalogo(catalogoEditando, tipoCatalogo.value, textoCatalogo.value.trim())
            : await window.api.inventarioIP.crearCatalogo(tipoCatalogo.value, textoCatalogo.value.trim());
        if (!result?.ok) return mostrarError(result?.mensaje);
        catalogoEditando = null;
        textoCatalogo.value = '';
        $('btn-guardar-catalogo').textContent = 'Agregar opción';
        $('btn-cancelar-catalogo').hidden = true;
        await cargar();
    } catch (error) {
        mostrarError(error.message);
    }
});

$('btn-cancelar-edicion').addEventListener('click', limpiarFormulario);
$('btn-cancelar-catalogo').addEventListener('click', () => {
    catalogoEditando = null;
    textoCatalogo.value = '';
    $('btn-guardar-catalogo').textContent = 'Agregar opción';
    $('btn-cancelar-catalogo').hidden = true;
});
$('busqueda').addEventListener('input', () => {
    paginaActual = 1;
    renderizarTabla();
});
$('tamano-pagina').addEventListener('change', () => {
    tamanoPagina = Number($('tamano-pagina').value) || 25;
    paginaActual = 1;
    renderizarTabla();
});
$('pagina-anterior').addEventListener('click', () => {
    paginaActual = Math.max(1, paginaActual - 1);
    renderizarTabla();
});
$('pagina-siguiente').addEventListener('click', () => {
    paginaActual++;
    renderizarTabla();
});
tipoCatalogo.addEventListener('change', renderizarCatalogos);
$('btn-recargar').addEventListener('click', () => cargar().catch(error => mostrarError(error.message)));
$('btn-volver').addEventListener('click', () => window.api.navegarModulo('equipos'));

(async () => {
    await window.PermisosUI?.init();
    try {
        await cargar();
    } catch (error) {
        mostrarError(error.message);
    }
})();
