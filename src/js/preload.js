const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    /* =========================================================
       SESIÓN
       ========================================================= */
    login:         (u, p) => ipcRenderer.invoke('login', u, p),
    logout:        ()     => ipcRenderer.invoke('logout'),
    usuarioActual: ()     => ipcRenderer.invoke('usuario-actual'),
    haySesion:     ()     => ipcRenderer.invoke('sesion:hay'),
    version:       ()     => ipcRenderer.invoke('app:version'),

    consumirMotivoLogin: () => ipcRenderer.invoke('login:motivo-consumir'),
    onLoginMotivo:       (cb) => ipcRenderer.on('login:motivo', (_e, m) => cb(m)),
    onSesionCerrada:     (cb) => ipcRenderer.on('sesion:cerrada', (_e, data) => cb(data)),

    /* =========================================================
       PERMISOS
       ========================================================= */
    permisos: {
        mios:            ()                    => ipcRenderer.invoke('permisos:mios'),
        miRol:           ()                    => ipcRenderer.invoke('permisos:mi-rol'),
        puedo:           (clave)               => ipcRenderer.invoke('permisos:puedo', clave),
        catalogo:        ()                    => ipcRenderer.invoke('permisos:catalogo'),
        listarRoles:     ()                    => ipcRenderer.invoke('permisos:listar-roles'),
        listarTodos:     ()                    => ipcRenderer.invoke('permisos:listar-todos'),
        actualizar:      (idRol, modulo, perm) => ipcRenderer.invoke('permisos:actualizar', idRol, modulo, perm),
        asignarRol:      (idUsuario, idRol)    => ipcRenderer.invoke('permisos:asignar-rol', idUsuario, idRol),
        crearRol:        (datos)               => ipcRenderer.invoke('permisos:crear-rol', datos),
        actualizarRol:   (idRol, datos)        => ipcRenderer.invoke('permisos:actualizar-rol', idRol, datos),
        cambiarEstadoRol:(idRol, activo)       => ipcRenderer.invoke('permisos:cambiar-estado-rol', idRol, activo),
        eliminarRol:     (idRol)               => ipcRenderer.invoke('permisos:eliminar-rol', idRol)
    },

    /* =========================================================
       NAVEGACIÓN / VENTANAS
       ========================================================= */
    abrirMenu:      () => ipcRenderer.invoke('abrir-menu'),
    abrirCatalogos: () => ipcRenderer.invoke('abrir-catalogos'),
    abrirEquipos:   () => ipcRenderer.invoke('abrir-equipos'),
    abrirPlano:     () => ipcRenderer.invoke('abrir-plano'),
    abrirUsuarios:  () => ipcRenderer.invoke('abrir-usuarios'),
    abrirHistorico: () => ipcRenderer.invoke('abrir-historico'),
    abrirMantenimientos: () => ipcRenderer.invoke('abrir-mantenimientos'),
    volverMenu:     () => ipcRenderer.invoke('volver-menu'),
    cerrarVentana:  () => ipcRenderer.invoke('ventana:cerrar-actual'),
    navegarModulo:  (modulo) => ipcRenderer.invoke('navegar-modulo', modulo),

    /* =========================================================
       MÓDULO ACTIVO FIJO
       ========================================================= */
    abrirActivoFijoCatalogos:   () => ipcRenderer.invoke('abrir-activofijo-catalogos'),
    abrirActivoFijoActivos:     () => ipcRenderer.invoke('abrir-activofijo-activos'),
    abrirActivoFijoResponsivas: () => ipcRenderer.invoke('abrir-activofijo-responsivas'),
    abrirActivoFijoReportes:    () => ipcRenderer.invoke('abrir-activofijo-reportes'),
    abrirActivoFijoImportar:    () => ipcRenderer.invoke('abrir-activofijo-importar'),

    /* =========================================================
       CLIENTES
       ========================================================= */
    clientes: {
        listar:     ()                       => ipcRenderer.invoke('clientes:listar'),
        crear:      (codigo, nombre, color)  => ipcRenderer.invoke('clientes:crear', codigo, nombre, color),
        actualizar: (id, codigo, nombre, color) => ipcRenderer.invoke('clientes:actualizar', id, codigo, nombre, color),
        eliminar:   (id)                     => ipcRenderer.invoke('clientes:eliminar', id)
    },

    /* =========================================================
       ROLES (equipos)
       ========================================================= */
    roles: {
        listar:     ()                                  => ipcRenderer.invoke('roles:listar'),
        crear:      (codigo, nombre, descripcion, color) => ipcRenderer.invoke('roles:crear', codigo, nombre, descripcion, color),
        actualizar: (id, codigo, nombre, descripcion, color) => ipcRenderer.invoke('roles:actualizar', id, codigo, nombre, descripcion, color),
        eliminar:   (id)                                => ipcRenderer.invoke('roles:eliminar', id)
    },

    catalogosColores: () => ipcRenderer.invoke('catalogos:colores'),

    /* =========================================================
       PISOS
       ========================================================= */
    pisos: {
        listar:                ()                                              => ipcRenderer.invoke('pisos:listar'),
        obtener:               (id)                                            => ipcRenderer.invoke('pisos:obtener', id),
        listarPorCliente:      (idCliente)                                     => ipcRenderer.invoke('pisos:listarPorCliente', idCliente),
        clientesDePiso:        (idPiso)                                        => ipcRenderer.invoke('pisos:clientesDePiso', idPiso),
        crear:                 (nombre, filas, cols, ids)                      => ipcRenderer.invoke('pisos:crear', nombre, filas, cols, ids),
        actualizarConClientes: (id, nombre, filas, cols, ids)                  => ipcRenderer.invoke('pisos:actualizarConClientes', id, nombre, filas, cols, ids),
        eliminar:              (id)                                            => ipcRenderer.invoke('pisos:eliminar', id)
    },

    /* =========================================================
       RANGOS
       ========================================================= */
    rangos: {
        listar:     ()                                                          => ipcRenderer.invoke('rangos:listar'),
        crear:      (idCliente, idPiso, nombre, ipInicio, ipFin, desc)          => ipcRenderer.invoke('rangos:crear', idCliente, idPiso, nombre, ipInicio, ipFin, desc),
        actualizar: (id, idCliente, idPiso, nombre, ipInicio, ipFin, desc)      => ipcRenderer.invoke('rangos:actualizar', id, idCliente, idPiso, nombre, ipInicio, ipFin, desc),
        eliminar:   (id)                                                        => ipcRenderer.invoke('rangos:eliminar', id)
    },

    /* =========================================================
       EQUIPOS
       ========================================================= */
    equipos: {
        listar:               ()                => ipcRenderer.invoke('equipos:listar'),
        exportarExcel:        (opciones)        => ipcRenderer.invoke('equipos:exportarExcel', opciones),
        crear:                (datos)           => ipcRenderer.invoke('equipos:crear', datos),
        obtenerPorId:         (id)              => ipcRenderer.invoke('equipos:obtenerPorId', id),
        actualizar:           (id, datos)       => ipcRenderer.invoke('equipos:actualizar', id, datos),
        eliminar:             (id)              => ipcRenderer.invoke('equipos:eliminar', id),
        verificarIPDuplicada: (ip, idExcluir)   => ipcRenderer.invoke('equipos:verificarIPDuplicada', ip, idExcluir),
        listarIPsAsignadasEnSegmento: (segmento, idExcluir) => ipcRenderer.invoke('equipos:listarIPsAsignadasEnSegmento', segmento, idExcluir)
    },

    inventarioIP: {
        listar: () => ipcRenderer.invoke('inventario-ip:listar'),
        listarCatalogos: () => ipcRenderer.invoke('inventario-ip:catalogos'),
        crearCatalogo: (tipo, nombre) => ipcRenderer.invoke('inventario-ip:catalogo:crear', tipo, nombre),
        actualizarCatalogo: (id, tipo, nombre) => ipcRenderer.invoke('inventario-ip:catalogo:actualizar', id, tipo, nombre),
        eliminarCatalogo: id => ipcRenderer.invoke('inventario-ip:catalogo:eliminar', id),
        crear: datos => ipcRenderer.invoke('inventario-ip:crear', datos),
        actualizar: (id, datos) => ipcRenderer.invoke('inventario-ip:actualizar', id, datos),
        actualizarDatosEquipoCliente: (idEquipo, datos) =>
            ipcRenderer.invoke('inventario-ip:cliente:actualizar', idEquipo, datos),
        eliminar: id => ipcRenderer.invoke('inventario-ip:eliminar', id)
    },

    /* =========================================================
       DOMINIOS
       ========================================================= */
    dominios: {
        listarPorCliente: (idCliente)          => ipcRenderer.invoke('dominios:listarPorCliente', idCliente),
        listarTodas:      (filtros)            => ipcRenderer.invoke('dominios:listarTodas', filtros),
        crear:            (idCliente, u, p, d) => ipcRenderer.invoke('dominios:crear', idCliente, u, p, d),
        actualizar:       (id, u, p, d)        => ipcRenderer.invoke('dominios:actualizar', id, u, p, d),
        eliminar:         (id)                 => ipcRenderer.invoke('dominios:eliminar', id)
    },

    /* =========================================================
       CONFIGURACIONES DE RED
       ========================================================= */
    config: {
        listarPorClienteTipo: (idCliente, tipo)              => ipcRenderer.invoke('config:listarPorClienteTipo', idCliente, tipo),
        listarTodas:          (filtros)                      => ipcRenderer.invoke('config:listarTodas', filtros),
        crear:                (idCliente, tipo, valor, desc) => ipcRenderer.invoke('config:crear', idCliente, tipo, valor, desc),
        actualizar:           (id, valor, desc)              => ipcRenderer.invoke('config:actualizar', id, valor, desc),
        eliminar:             (id)                           => ipcRenderer.invoke('config:eliminar', id)
    },

    /* =========================================================
       USUARIOS
       ========================================================= */
    usuarios: {
        listar:     ()              => ipcRenderer.invoke('usuarios:listar'),
        crear:      (datos)         => ipcRenderer.invoke('usuarios:crear', datos),
        actualizar: (id, datos)     => ipcRenderer.invoke('usuarios:actualizar', id, datos),
        eliminar:   (id)            => ipcRenderer.invoke('usuarios:eliminar', id)
    },

    /* =========================================================
       HISTÓRICOS
       ========================================================= */
    historicos: {
        listar:        (idCliente, idPiso) => ipcRenderer.invoke('historicos:listar', idCliente, idPiso),
        listarPorPiso: (idPiso)            => ipcRenderer.invoke('historicos:listarPorPiso', idPiso)
    },

    /* =========================================================
       MANTENIMIENTOS
       ========================================================= */
    mantenimientos: {
        listarPisos: () => ipcRenderer.invoke('mantenimientos:listarPisos'),
        listarUsuarios: () => ipcRenderer.invoke('mantenimientos:listarUsuarios'),
        obtenerPlano: (idPiso) => ipcRenderer.invoke('mantenimientos:obtenerPlano', idPiso),
        listarRegistros: (idPiso) => ipcRenderer.invoke('mantenimientos:listarRegistros', idPiso),
        crear: (datos) => ipcRenderer.invoke('mantenimientos:crear', datos),
        exportarExcel: (idPiso) => ipcRenderer.invoke('mantenimientos:exportarExcel', idPiso)
    },

    /* =========================================================
       PLANO
       ========================================================= */
    plano: {
        dimensiones:    (idPiso)                 => ipcRenderer.invoke('plano:dimensiones', idPiso),
        actualizarDim:  (idPiso, f, c)           => ipcRenderer.invoke('plano:actualizarDim', idPiso, f, c),

        listarPorLugar: (idPiso)                 => ipcRenderer.invoke('plano:listarPorLugar', idPiso),
        sinUbicacion:   (idPiso)                 => ipcRenderer.invoke('plano:sinUbicacion', idPiso),
        listarFuturos: (idPiso) => ipcRenderer.invoke('plano:futuros:listar', idPiso),
        ubicacionesFuturas: (idEscenario, idPiso) => ipcRenderer.invoke('plano:futuros:ubicaciones', idEscenario, idPiso),
        crearFuturo: (idPisos, nombre) => ipcRenderer.invoke('plano:futuros:crear', idPisos, nombre),
        moverFuturo: (idEscenario, idEquipo, idPisoDestino, fila, columna) => ipcRenderer.invoke('plano:futuros:mover', idEscenario, idEquipo, idPisoDestino, fila, columna),
        eliminarFuturo: (idEscenario, idPiso) => ipcRenderer.invoke('plano:futuros:eliminar', idEscenario, idPiso),

        asignar:        (idPiso, idEquipo, fila, col)                              => ipcRenderer.invoke('plano:asignar', idPiso, idEquipo, fila, col),
        mover:          (idEquipo, fila, col, filaAnt, colAnt, idPiso)             => ipcRenderer.invoke('plano:mover', idEquipo, fila, col, filaAnt, colAnt, idPiso),
        quitar:         (idEquipo, idPiso, hostname)                               => ipcRenderer.invoke('plano:quitar', idEquipo, idPiso, hostname),
        intercambiar:   (a, b, idPiso, hostA, hostB, filaA, colA, filaB, colB)     => ipcRenderer.invoke('plano:intercambiar', a, b, idPiso, hostA, hostB, filaA, colA, filaB, colB),

        moverEntrePisos: (idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos) =>
            ipcRenderer.invoke('plano:moverEntrePisos', idEquipo, idPisoOrigen, idPisoDestino, fila, columna, nuevosDatos),

        swapEntrePisos: (datos) =>
            ipcRenderer.invoke('plano:swapEntrePisos', datos),

        listarZonas:    (idPiso)                                                       => ipcRenderer.invoke('plano:listarZonas', idPiso),
        crearZona:      (idPiso, nombre, color, fi, ff, ci, cf)                        => ipcRenderer.invoke('plano:crearZona', idPiso, nombre, color, fi, ff, ci, cf),
        actualizarZona: (idZona, nombre, color, fi, ff, ci, cf, idPiso)                => ipcRenderer.invoke('plano:actualizarZona', idZona, nombre, color, fi, ff, ci, cf, idPiso),
        actualizarZonasPorNombre: (idPiso, nombreActual, colorActual, nombre, color)     => ipcRenderer.invoke('plano:actualizarZonasPorNombre', idPiso, nombreActual, colorActual, nombre, color),
        eliminarZona:   (idZona, idPiso, nombre)                                       => ipcRenderer.invoke('plano:eliminarZona', idZona, idPiso, nombre),
        eliminarZonasPorNombre: (idPiso, nombre, color)                                => ipcRenderer.invoke('plano:eliminarZonasPorNombre', idPiso, nombre, color),

        listarZonasLibres:  (idPiso)                          => ipcRenderer.invoke('plano:listarZonasLibres', idPiso),
        guardarZonaLibre:   (idPiso, nombre, color, celdas)   => ipcRenderer.invoke('plano:guardarZonaLibre', idPiso, nombre, color, celdas),
        actualizarZonaLibre: (idPiso, nombreActual, colorActual, nombre, color) => ipcRenderer.invoke('plano:actualizarZonaLibre', idPiso, nombreActual, colorActual, nombre, color),
        eliminarZonaLibre:  (idPiso, nombre, color)           => ipcRenderer.invoke('plano:eliminarZonaLibre', idPiso, nombre, color),

        exportarPDF: (opciones) => ipcRenderer.invoke('plano:exportarPDF', opciones)
    },

    /* =========================================================
       ACTIVO FIJO
       ========================================================= */
    activoFijo: {
        catalogos: {
            listar: (clave, filtros) => ipcRenderer.invoke('af-catalogos-listar', clave, filtros),
            crear: (clave, datos) => ipcRenderer.invoke('af-catalogos-crear', clave, datos),
            actualizar: (clave, id, datos) => ipcRenderer.invoke('af-catalogos-actualizar', clave, id, datos),
            eliminar: (clave, id) => ipcRenderer.invoke('af-catalogos-eliminar', clave, id),
            restaurar: (clave, id) => ipcRenderer.invoke('af-catalogos-restaurar', clave, id)
        },
        activos: {
            listar: filtros => ipcRenderer.invoke('af-activos-listar', filtros),
            obtener: id => ipcRenderer.invoke('af-activos-obtener', id),
            crear: datos => ipcRenderer.invoke('af-activos-crear', datos),
            actualizar: (id, datos) => ipcRenderer.invoke('af-activos-actualizar', id, datos),
            eliminar: (id, motivo) => ipcRenderer.invoke('af-activos-eliminar', id, motivo),
            restaurar: (id, motivo) => ipcRenderer.invoke('af-activos-restaurar', id, motivo),
            historico: id => ipcRenderer.invoke('af-activos-historico', id),
            exportarExcel: payload => ipcRenderer.invoke('af-activos-exportar-excel', payload),
            listarTipos: () => ipcRenderer.invoke('af-activos-lista-tipos'),
            listarMarcas: () => ipcRenderer.invoke('af-activos-lista-marcas'),
            listarEstados: () => ipcRenderer.invoke('af-activos-lista-estados'),
            listarEstatus: () => ipcRenderer.invoke('af-activos-lista-estatus'),
            listarCarteras: () => ipcRenderer.invoke('af-activos-lista-carteras'),
            listarSitios: () => ipcRenderer.invoke('af-activos-lista-sitios'),
            listarSubtipos: () => ipcRenderer.invoke('af-activos-lista-subtipos'),
            listarVoltajes: () => ipcRenderer.invoke('af-activos-lista-voltajes'),
            listarClasificaciones: () => ipcRenderer.invoke('af-activos-lista-clasificaciones'),
            listarTamanios: () => ipcRenderer.invoke('af-activos-lista-tamanios'),
            listarCapacidades: () => ipcRenderer.invoke('af-activos-lista-capacidades'),
            listarCatalogosExtendidos: () => ipcRenderer.invoke('af-activos-lista-catalogos-especificaciones')
        },
        responsivas: {
            listar: filtros => ipcRenderer.invoke('af-resp-listar', filtros),
            obtener: id => ipcRenderer.invoke('af-resp-obtener', id),
            activosDisponibles: () => ipcRenderer.invoke('af-resp-activos-disponibles'),
            crear: datos => ipcRenderer.invoke('af-resp-crear', datos),
            actualizar: (id, datos) => ipcRenderer.invoke('af-resp-actualizar', id, datos),
            devolver: (id, fecha, obs) => ipcRenderer.invoke('af-resp-devolver', id, fecha, obs),
            eliminar: (id, motivo) => ipcRenderer.invoke('af-resp-eliminar', id, motivo),
            verPDF: id => ipcRenderer.invoke('af-resp-ver-pdf', id),
            guardarPDF: id => ipcRenderer.invoke('af-resp-guardar-pdf', id),
            listarCarteras: () => ipcRenderer.invoke('af-resp-lista-carteras'),
            listarPuestos: () => ipcRenderer.invoke('af-resp-lista-puestos'),
            listarCatalogo: clave => ipcRenderer.invoke('af-resp-lista-catalogo', clave),
            crearCatalogo: (clave, datos) => ipcRenderer.invoke('af-resp-catalogo-crear', clave, datos),
            actualizarCatalogo: (clave, id, datos) => ipcRenderer.invoke('af-resp-catalogo-actualizar', clave, id, datos),
            eliminarCatalogo: (clave, id) => ipcRenderer.invoke('af-resp-catalogo-eliminar', clave, id),
            listarUsuariosEntrega: () => ipcRenderer.invoke('af-resp-lista-usuarios-entrega')
        },
        reportes: {
            obtenerReporte: (vista, filtros) => ipcRenderer.invoke('af-rep-obtener-reporte', vista, filtros),
            exportarExcel: payload => ipcRenderer.invoke('af-rep-exportar-excel', payload),
            resumenGeneral: () => ipcRenderer.invoke('af-rep-resumen-general'),
            resumenPorTipo: () => ipcRenderer.invoke('af-rep-resumen-tipo'),
            resumenPorCartera: () => ipcRenderer.invoke('af-rep-resumen-cartera'),
            inventario: filtros => ipcRenderer.invoke('af-rep-inventario', filtros),
            responsivasActivas: () => ipcRenderer.invoke('af-rep-responsivas-activas'),
            asignacionesPorPersona: () => ipcRenderer.invoke('af-rep-asignaciones-persona'),
            porTicket: () => ipcRenderer.invoke('af-rep-por-ticket'),
            historialAsignaciones: filtros => ipcRenderer.invoke('af-rep-historial-asignaciones', filtros),
            historialActivo: id => ipcRenderer.invoke('af-rep-historial-activo', id),
            celulares: () => ipcRenderer.invoke('af-rep-celulares'),
            laptops: () => ipcRenderer.invoke('af-rep-laptops'),
            tiposParaFiltro: () => ipcRenderer.invoke('af-rep-tipos'),
            estadosParaFiltro: () => ipcRenderer.invoke('af-rep-estados'),
            estatusParaFiltro: () => ipcRenderer.invoke('af-rep-estatus'),
            carterasParaFiltro: () => ipcRenderer.invoke('af-rep-carteras')
        },
        importacion: {
            listarLayouts: () => ipcRenderer.invoke('af-import-layouts'),
            obtenerLayout: clave => ipcRenderer.invoke('af-import-layout', clave),
            importar: datos => ipcRenderer.invoke('af-import-procesar', datos)
        }
    }
});