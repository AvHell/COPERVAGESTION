const $ = (id) => document.getElementById(id);
const mapa = $('mapa');
const selectPiso = $('select-piso');
const dialogo = $('dialog-equipo');
const form = $('form-mantenimiento');
const Swal = window.Swal;

let pisos = [];
let pisoActual = null;
let planoActual = null;
let registrosActuales = [];
let equipoSeleccionado = null;
let puedeRegistrar = false;
let idUsuarioSesion = null;

function mostrarMensaje(texto, error = false, detalle = '') {
    if (!texto) return;
    Swal.fire({
        toast: !error,
        position: error ? 'center' : 'bottom-end',
        icon: error ? 'error' : 'success',
        title: error ? 'No se pudo completar' : texto,
        text: error ? texto : detalle || undefined,
        showConfirmButton: error,
        confirmButtonText: 'Entendido',
        timer: error ? undefined : 3000,
        timerProgressBar: !error,
        customClass: {
            popup: error ? 'mt-swal-popup' : 'mt-toast',
            confirmButton: 'mt-swal-confirm'
        }
    });
}

function fechaLocal(fecha) {
    if (!fecha) return '';
    if (fecha instanceof Date) {
        return `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}`;
    }
    const isoDate = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return String(fecha);
    return new Intl.DateTimeFormat('es-MX').format(date);
}

function fechaInputHoy() {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

function crearBadge(value, badgeClass, color = 'BOTON', nestedClass = '') {
    const badge = document.createElement('span');
    badge.className = `badge-mantenimiento ${badgeClass}`;
    badge.dataset.color = String(color || 'BOTON').trim().toUpperCase();
    if (nestedClass) {
        const content = document.createElement('span');
        content.className = nestedClass;
        content.textContent = value || '—';
        badge.append(content);
    } else {
        badge.textContent = value || '—';
    }
    return badge;
}

function appendBadgeDetail(dl, label, value, badgeClass, color = 'BOTON', nestedClass = '') {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    item.className = 'detalle-badge';
    term.textContent = label;
    description.append(crearBadge(value, badgeClass, color, nestedClass));
    item.append(term, description);
    dl.append(item);
}

function crearCelda(fila, columna, equipo) {
    const celda = document.createElement('button');
    celda.type = 'button';
    celda.className = `celda${equipo ? '' : ' vacia'}`;
    if (equipo?.UltimoMantenimiento) celda.classList.add('con-mantenimiento');
    if (equipo?.UltimoMantenimiento && equipo.UltimoFueClonacion) celda.classList.add('ultimo-clonacion');
    celda.setAttribute('aria-label', equipo
        ? `${equipo.Hostname}, ${equipo.Rol || 'sin rol'}${equipo.UltimoMantenimiento ? ', mantenimiento registrado' : ''}${equipo.UltimoFueClonacion ? ', clonación realizada en el último mantenimiento' : ''}`
        : `Celda vacía, fila ${fila}, columna ${columna}`);
    celda.title = equipo
        ? `${equipo.Hostname} · ${equipo.IP || 'DHCP'}${equipo.UltimoMantenimiento ? ` · Último mantenimiento: ${fechaLocal(equipo.UltimoMantenimiento)}` : ''}`
        : `Fila ${fila}, columna ${columna}`;
    if (equipo) {
        celda.dataset.rol = String(equipo.RolCodigo || '').toUpperCase();
        const hostname = document.createElement('span');
        hostname.className = 'hostname';
        hostname.textContent = equipo.Hostname || 'Sin hostname';
        const cliente = document.createElement('span');
        cliente.className = 'cliente';
        cliente.textContent = equipo.Cliente || 'Cliente no disponible';
        const rol = document.createElement('span');
        rol.className = 'rol';
        rol.textContent = equipo.Rol || 'Rol no disponible';
        const ip = document.createElement('span');
        ip.className = 'ip';
        ip.textContent = equipo.IP || 'DHCP';
        celda.append(hostname, cliente, rol, ip);

        if (equipo.UltimoMantenimiento) {
            const marca = document.createElement('span');
            const clonado = Boolean(equipo.UltimoFueClonacion);
            marca.className = `marca-mantenimiento${clonado ? ' clonado' : ''}`;
            marca.textContent = 'REALIZADO';
            celda.append(marca);
        }
        if (equipo.UltimoMantenimiento) {
            const fecha = document.createElement('span');
            fecha.className = 'fecha-marca';
            fecha.textContent = fechaLocal(equipo.UltimoMantenimiento);
            celda.append(fecha);
        }

        celda.addEventListener('click', () => abrirEquipo(equipo, fila, columna));
    } else {
        const coordenada = document.createElement('span');
        coordenada.className = 'coordenada';
        coordenada.textContent = `${fila},${columna}`;
        celda.append(coordenada);
        celda.disabled = true;
    }
    return celda;
}

function renderizarPlano() {
    mapa.replaceChildren();
    if (!planoActual) {
        $('mapa-vacio').hidden = false;
        return;
    }

    $('mapa-vacio').hidden = true;
    $('titulo-piso').textContent = `${planoActual.Nombre} · ${planoActual.Filas} × ${planoActual.Columnas}`;
    mapa.style.gridTemplateColumns = `repeat(${planoActual.Columnas}, 132px)`;
    const equiposPorUbicacion = new Map(
        planoActual.equipos.map(e => [`${e.Fila}:${e.Columna}`, e])
    );

    for (let fila = 1; fila <= planoActual.Filas; fila += 1) {
        for (let columna = 1; columna <= planoActual.Columnas; columna += 1) {
            mapa.append(crearCelda(fila, columna, equiposPorUbicacion.get(`${fila}:${columna}`)));
        }
    }
}

function renderizarHistorial() {
    const body = $('historial-body');
    body.replaceChildren();
    $('contador-registros').textContent = String(registrosActuales.length);
    $('btn-ver-historial').setAttribute(
        'aria-label',
        `Abrir historial de ${registrosActuales.length} ${registrosActuales.length === 1 ? 'registro' : 'registros'}`
    );
    $('historial-vacio').hidden = registrosActuales.length > 0;

    for (const registro of registrosActuales) {
        const row = document.createElement('tr');
        const values = [
            { value: fechaLocal(registro.FechaMantenimiento) || '—', badge: 'badge-fecha', color: 'FECHA' },
            { value: registro.Hostname, badge: 'hostname-badge', color: registro.RolCodigo },
            { value: registro.IP || 'DHCP', badge: 'badge-ip' },
            { value: registro.Cliente, badge: 'badge-cliente', color: registro.ClienteCodigo, nested: 'nombre' },
            { value: registro.Rol, badge: 'rol-pill', color: registro.RolCodigo }
        ];
        for (const { value, badge, color, nested } of values) {
            const cell = document.createElement('td');
            cell.className = 'historial-badge-cell';
            const badgeElement = crearBadge(value, badge, color, nested);
            badgeElement.classList.add('historial-badge');
            cell.append(badgeElement);
            row.append(cell);
        }
        const ubicacion = document.createElement('td');
        ubicacion.className = 'historial-badge-cell';
        const badgeUbicacion = crearBadge(registro.PisoNombre, 'badge-ubicacion', 'UBICACION');
        badgeUbicacion.classList.add('historial-badge');
        ubicacion.append(badgeUbicacion);
        row.append(ubicacion);
        const responsable = document.createElement('td');
        responsable.textContent = registro.RealizadoPor || '—';
        row.append(responsable);
        const observaciones = document.createElement('td');
        observaciones.textContent = registro.Observaciones;
        row.append(observaciones);
        body.append(row);
    }
}

function abrirEquipo(equipo, fila, columna) {
    equipoSeleccionado = { ...equipo, Fila: fila, Columna: columna };
    $('equipo-titulo').textContent = equipo.Hostname || 'Equipo';
    const detalle = $('equipo-detalle');
    detalle.replaceChildren();
    appendBadgeDetail(detalle, 'Fecha', fechaLocal(equipo.UltimoMantenimiento) || 'Sin registro', 'badge-fecha', 'FECHA');
    appendBadgeDetail(detalle, 'Equipo', equipo.Hostname, 'hostname-badge', equipo.RolCodigo);
    appendBadgeDetail(detalle, 'IP', equipo.IP || 'DHCP', 'badge-ip');
    appendBadgeDetail(detalle, 'Cliente', equipo.Cliente || 'Cliente no disponible', 'badge-cliente', equipo.ClienteCodigo, 'nombre');
    appendBadgeDetail(detalle, 'Rol', equipo.Rol || 'Rol no disponible', 'rol-pill', equipo.RolCodigo);
    appendBadgeDetail(detalle, 'Ubicación', planoActual.Nombre, 'badge-ubicacion', 'UBICACION');

    const ultimo = $('ultimo-registro');
    ultimo.classList.toggle('clonado', Boolean(equipo.UltimoFueClonacion));
    if (equipo.UltimoMantenimiento) {
        const trabajo = equipo.UltimoFueClonacion ? 'Clonación' : 'Mantenimiento';
        ultimo.textContent = `Último ${trabajo.toLowerCase()} realizado por ${equipo.UltimoRealizadoPor || 'Responsable no disponible'}.`;
    } else {
        ultimo.textContent = 'Este equipo aún no tiene mantenimientos registrados.';
    }

    $('fecha-mantenimiento').value = fechaInputHoy();
    for (const option of $('usuario-realizo').options) {
        option.selected = Number(option.value) === idUsuarioSesion;
    }
    $('observaciones').value = '';
    $('btn-guardar').hidden = !puedeRegistrar;
    $('fecha-mantenimiento').disabled = !puedeRegistrar;
    $('usuario-realizo').disabled = !puedeRegistrar;
    $('observaciones').disabled = !puedeRegistrar;
    dialogo.showModal();
}

async function cargarPiso(idPiso) {
    mapa.replaceChildren();
    $('mapa-vacio').hidden = true;
    $('historial-body').replaceChildren();
    try {
        const [plano, registros] = await Promise.all([
            window.api.mantenimientos.obtenerPlano(idPiso),
            window.api.mantenimientos.listarRegistros(idPiso)
        ]);
        if (plano?.ok === false || registros?.ok === false) {
            const response = plano?.ok === false ? plano : registros;
            throw new Error(response.mensaje || 'No se pudo consultar la información.');
        }
        planoActual = plano;
        registrosActuales = registros || [];
        if (!planoActual) {
            mostrarMensaje('El piso no existe o está inactivo.', true);
            $('titulo-piso').textContent = 'Piso no disponible';
            $('mapa-vacio').hidden = false;
            $('mapa-vacio').textContent = 'No se encontró el piso seleccionado.';
            renderizarHistorial();
            return;
        }
        renderizarPlano();
        renderizarHistorial();
    } catch (error) {
        console.error('[Mantenimientos] Error cargando piso:', error);
        mostrarMensaje(`No se pudo cargar el plano o el historial. Verifica que la tabla Mantenimientos exista y vuelve a intentar. Detalle: ${error.message}`, true);
        $('mapa-vacio').hidden = false;
        $('mapa-vacio').textContent = 'No se pudo cargar el plano.';
    }
}

async function inicializar() {
    $('btn-volver').addEventListener('click', () => window.api.volverMenu());
    const mapaScroll = $('mapa-scroll');
    mapaScroll.addEventListener('wheel', event => {
        const puedeDesplazarVerticalmente = mapaScroll.scrollHeight > mapaScroll.clientHeight;
        const puedeDesplazarHorizontalmente = mapaScroll.scrollWidth > mapaScroll.clientWidth;
        if (!event.shiftKey && event.deltaX === 0 &&
            !puedeDesplazarVerticalmente && puedeDesplazarHorizontalmente) {
            mapaScroll.scrollLeft += event.deltaY;
            event.preventDefault();
        }
    }, { passive: false });
    $('btn-actualizar').addEventListener('click', () => cargarPiso(pisoActual));
    $('btn-ver-historial').addEventListener('click', () => $('dialog-historial').showModal());
    $('btn-cerrar-historial').addEventListener('click', () => $('dialog-historial').close());
    $('dialog-historial').addEventListener('click', event => {
        if (event.target === $('dialog-historial')) $('dialog-historial').close();
    });
    $('btn-exportar-excel').addEventListener('click', async () => {
        const button = $('btn-exportar-excel');
        button.disabled = true;
        try {
            const result = await window.api.mantenimientos.exportarExcel(pisoActual);
            if (!result?.ok && result?.mensaje !== 'Cancelado') {
                mostrarMensaje(result?.mensaje || 'No se pudo exportar a Excel.', true);
                return;
            }
            if (result.ok) mostrarMensaje('Excel exportado', false, result.ruta ? `Guardado en: ${result.ruta}` : '');
        } catch (error) {
            console.error('[Mantenimientos] Error exportando Excel:', error);
            mostrarMensaje(`No se pudo exportar a Excel: ${error.message}`, true);
        } finally {
            button.disabled = false;
        }
    });
    selectPiso.addEventListener('change', async () => {
        pisoActual = Number(selectPiso.value);
        await cargarPiso(pisoActual);
    });
    $('usuario-realizo').addEventListener('change', event => {
        const seleccionados = [...event.target.selectedOptions];
        if (seleccionados.length <= 2) return;
        const opcionReciente = [...seleccionados].find(option => option.value === event.target.value);
        if (opcionReciente) opcionReciente.selected = false;
        mostrarMensaje('Puedes seleccionar como máximo dos personas por mantenimiento.', true);
    });
    $('btn-cerrar-dialogo').addEventListener('click', () => dialogo.close());
    $('btn-cancelar').addEventListener('click', () => dialogo.close());
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!equipoSeleccionado || !puedeRegistrar) return;
        const idUsuarios = [...$('usuario-realizo').selectedOptions]
            .map(option => Number(option.value))
            .filter(id => Number.isInteger(id) && id > 0);
        if (idUsuarios.length < 1 || idUsuarios.length > 2) {
            mostrarMensaje('Selecciona una o dos personas que realizaron el mantenimiento.', true);
            return;
        }
        if (!$('fecha-mantenimiento').value || !$('observaciones').value.trim()) {
            mostrarMensaje('Captura la fecha y las observaciones del mantenimiento.', true);
            return;
        }
        const save = $('btn-guardar');
        save.disabled = true;
        try {
            const result = await window.api.mantenimientos.crear({
                idEquipo: equipoSeleccionado.IdEquipo,
                idPiso: pisoActual,
                fila: equipoSeleccionado.Fila,
                columna: equipoSeleccionado.Columna,
                idUsuarios,
                fechaMantenimiento: $('fecha-mantenimiento').value,
                observaciones: $('observaciones').value
            });
            if (!result?.ok) {
                mostrarMensaje(result?.mensaje || 'No se pudo registrar el mantenimiento.', true);
                return;
            }
            dialogo.close();
            mostrarMensaje(result.mensaje || 'Mantenimiento registrado.');
            await cargarPiso(pisoActual);
        } catch (error) {
            console.error('[Mantenimientos] Error al guardar:', error);
            mostrarMensaje(`No se pudo registrar el mantenimiento: ${error.message}`, true);
        } finally {
            save.disabled = false;
        }
    });

    try {
        const [permisoRegistro, usuarios, usuarioSesion] = await Promise.all([
            window.api.permisos.puedo('mantenimientos:crear'),
            window.api.mantenimientos.listarUsuarios(),
            window.api.usuarioActual()
        ]);
        puedeRegistrar = permisoRegistro?.permitido === true;
        if (usuarios?.ok === false) throw new Error(usuarios.mensaje || 'No se pudieron cargar los usuarios.');
        const selectorUsuarios = $('usuario-realizo');
        selectorUsuarios.replaceChildren();
        for (const usuario of usuarios) {
            const option = document.createElement('option');
            option.value = usuario.IdUsuario;
            const nombre = `${usuario.Nombres || ''} ${usuario.Apellidos || ''}`.trim();
            option.textContent = nombre
                ? `${nombre} (${usuario.NombreUsuario})`
                : usuario.NombreUsuario;
            selectorUsuarios.append(option);
        }
        if (usuarioSesion?.IdUsuario) {
            idUsuarioSesion = Number(usuarioSesion.IdUsuario);
            const opcionSesion = [...selectorUsuarios.options].find(option => Number(option.value) === idUsuarioSesion);
            if (opcionSesion) opcionSesion.selected = true;
        }
        pisos = await window.api.mantenimientos.listarPisos();
        if (pisos?.ok === false) throw new Error(pisos.mensaje || 'No se pudieron cargar los pisos.');
        selectPiso.replaceChildren();
        for (const piso of pisos) {
            const option = document.createElement('option');
            option.value = piso.IdPiso;
            option.textContent = piso.Nombre;
            selectPiso.append(option);
        }
        if (!pisos.length) {
            mostrarMensaje('No hay pisos activos para mostrar.');
            $('mapa-vacio').hidden = false;
            return;
        }
        pisoActual = Number(pisos[0].IdPiso);
        selectPiso.value = String(pisoActual);
        await cargarPiso(pisoActual);
    } catch (error) {
        console.error('[Mantenimientos] Error inicializando módulo:', error);
        mostrarMensaje(`No se pudo iniciar el módulo de mantenimientos: ${error.message}`, true);
    }
}

inicializar();
