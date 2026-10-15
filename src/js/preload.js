const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    /* =========================================================
       SESIÓN
       ========================================================= */
    login:         (u, p) => ipcRenderer.invoke('login', u, p),
    logout:        ()     => ipcRenderer.invoke('logout'),
    usuarioActual: ()     => ipcRenderer.invoke('usuario-actual'),
    haySesion:     ()     => ipcRenderer.invoke('sesion:hay'),

    /* Motivo de llegada al login (logout, expirada, etc.) */
    consumirMotivoLogin: () => ipcRenderer.invoke('login:motivo-consumir'),
    onLoginMotivo:       (cb) => ipcRenderer.on('login:motivo', (_e, m) => cb(m)),
    onSesionCerrada:     (cb) => ipcRenderer.on('sesion:cerrada', (_e, data) => cb(data)),

    /* =========================================================
       PERMISOS
       ========================================================= */
    permisos: {
        mios:            ()                    => ipcRenderer.invoke('permisos:mios'),
        miRol:           ()                    => ipcRenderer.invoke('permisos:mi-rol'),
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
    volverMenu:     () => ipcRenderer.invoke('volver-menu'),
    cerrarVentana:  () => ipcRenderer.invoke('ventana:cerrar-actual'),

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
        crear:      (codigo, nombre)         => ipcRenderer.invoke('clientes:crear', codigo, nombre),
        actualizar: (id, codigo, nombre)     => ipcRenderer.invoke('clientes:actualizar', id, codigo, nombre),
        eliminar:   (id)                     => ipcRenderer.invoke('clientes:eliminar', id)
    },

    /* =========================================================
       ROLES (equipos)
       ========================================================= */
    roles: {
        listar:     ()                                  => ipcRenderer.invoke('roles:listar'),
        crear:      (codigo, nombre, descripcion)       => ipcRenderer.invoke('roles:crear', codigo, nombre, descripcion),
        actualizar: (id, codigo, nombre, descripcion)   => ipcRenderer.invoke('roles:actualizar', id, codigo, nombre, descripcion),
        eliminar:   (id)                                => ipcRenderer.invoke('roles:eliminar', id)
    },

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
        crear:                (datos)           => ipcRenderer.invoke('equipos:crear', datos),
        actualizar:           (id, datos)       => ipcRenderer.invoke('equipos:actualizar', id, datos),
        eliminar:             (id)              => ipcRenderer.invoke('equipos:eliminar', id),
        verificarIPDuplicada: (ip, idExcluir)   => ipcRenderer.invoke('equipos:verificarIPDuplicada', ip, idExcluir)
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
        listarPorClienteTipo: (idCliente, tipo)             => ipcRenderer.invoke('config:listarPorClienteTipo', idCliente, tipo),
        listarTodas:          (filtros)                     => ipcRenderer.invoke('config:listarTodas', filtros),
        crear:                (idCliente, tipo, valor, desc)=> ipcRenderer.invoke('config:crear', idCliente, tipo, valor, desc),
        actualizar:           (id, valor, desc)             => ipcRenderer.invoke('config:actualizar', id, valor, desc),
        eliminar:             (id)                          => ipcRenderer.invoke('config:eliminar', id)
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
       PLANO
       ========================================================= */
    plano: {
        dimensiones:    (idPiso)                 => ipcRenderer.invoke('plano:dimensiones', idPiso),
        actualizarDim:  (idPiso, f, c)           => ipcRenderer.invoke('plano:actualizarDim', idPiso, f, c),

        listarPorLugar: (idPiso)                 => ipcRenderer.invoke('plano:listarPorLugar', idPiso),
        sinUbicacion:   (idPiso)                 => ipcRenderer.invoke('plano:sinUbicacion', idPiso),

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
        eliminarZona:   (idZona, idPiso, nombre)                                       => ipcRenderer.invoke('plano:eliminarZona', idZona, idPiso, nombre),

        eliminarZonasPorNombre: (idPiso, nombre, color)                                => ipcRenderer.invoke('plano:eliminarZonasPorNombre', idPiso, nombre, color),

        listarZonasLibres:  (idPiso)                          => ipcRenderer.invoke('plano:listarZonasLibres', idPiso),
        guardarZonaLibre:   (idPiso, nombre, color, celdas)   => ipcRenderer.invoke('plano:guardarZonaLibre', idPiso, nombre, color, celdas),
        eliminarZonaLibre:  (idPiso, nombre, color)           => ipcRenderer.invoke('plano:eliminarZonaLibre', idPiso, nombre, color),

        exportarPDF: (opciones) => ipcRenderer.invoke('plano:exportarPDF', opciones)
    }
});