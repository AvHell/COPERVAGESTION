const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    /* =========================================================
       SESIÓN
       ========================================================= */
    login:         (u, p) => ipcRenderer.invoke('login', u, p),
    logout:        ()     => ipcRenderer.invoke('logout'),
    usuarioActual: ()     => ipcRenderer.invoke('usuario-actual'),

    /* =========================================================
       NAVEGACIÓN / VENTANAS
       ========================================================= */
    abrirMenu:      () => ipcRenderer.invoke('abrir-menu'),
    abrirClientes:  () => ipcRenderer.invoke('abrir-clientes'),
    abrirRoles:     () => ipcRenderer.invoke('abrir-roles'),
    abrirLugares:   () => ipcRenderer.invoke('abrir-lugares'),
    abrirRangos:    () => ipcRenderer.invoke('abrir-rangos'),
    abrirEquipos:   () => ipcRenderer.invoke('abrir-equipos'),
    abrirPlano:     () => ipcRenderer.invoke('abrir-plano'),
    abrirUsuarios:  () => ipcRenderer.invoke('abrir-usuarios'),
    abrirHistorico: () => ipcRenderer.invoke('abrir-historico'),
    abrirDominios:  () => ipcRenderer.invoke('abrir-dominios'),
    abrirConfigRed: () => ipcRenderer.invoke('abrir-configred'),
    volverMenu:     () => ipcRenderer.invoke('volver-menu'),

    /* =====================================================
       MÓDULO ACTIVO FIJO (ventanas aisladas)
       ===================================================== */
    abrirActivoFijoCatalogos:   () => ipcRenderer.invoke('abrir-activofijo-catalogos'),
    abrirActivoFijoActivos:     () => ipcRenderer.invoke('abrir-activofijo-activos'),
    abrirActivoFijoResponsivas: () => ipcRenderer.invoke('abrir-activofijo-responsivas'),
    abrirActivoFijoReportes:    () => ipcRenderer.invoke('abrir-activofijo-reportes'),
    abrirActivoFijoImportar: () => ipcRenderer.invoke('af-abrir-importar'),


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
       ROLES
       ========================================================= */
    roles: {
        listar:     ()                                  => ipcRenderer.invoke('roles:listar'),
        crear:      (codigo, nombre, descripcion)       => ipcRenderer.invoke('roles:crear', codigo, nombre, descripcion),
        actualizar: (id, codigo, nombre, descripcion)   => ipcRenderer.invoke('roles:actualizar', id, codigo, nombre, descripcion),
        eliminar:   (id)                                => ipcRenderer.invoke('roles:eliminar', id)
    },

    /* =========================================================
       LUGARES
       ========================================================= */
    lugares: {
        listar:     ()                          => ipcRenderer.invoke('lugares:listar'),
        crear:      (idCliente, nombre)         => ipcRenderer.invoke('lugares:crear', idCliente, nombre),
        actualizar: (id, idCliente, nombre)     => ipcRenderer.invoke('lugares:actualizar', id, idCliente, nombre),
        eliminar:   (id)                        => ipcRenderer.invoke('lugares:eliminar', id)
    },

    /* =========================================================
       RANGOS
       ========================================================= */
    rangos: {
        listar:     ()                                                          => ipcRenderer.invoke('rangos:listar'),
        crear:      (idCliente, idLugar, nombre, ipInicio, ipFin, desc)         => ipcRenderer.invoke('rangos:crear', idCliente, idLugar, nombre, ipInicio, ipFin, desc),
        actualizar: (id, idCliente, idLugar, nombre, ipInicio, ipFin, desc)     => ipcRenderer.invoke('rangos:actualizar', id, idCliente, idLugar, nombre, ipInicio, ipFin, desc),
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
        listarPorLugar: (idLugar) => ipcRenderer.invoke('historicos:listarPorLugar', idLugar)
    },

    /* =========================================================
       PLANO
       ========================================================= */
    plano: {
        /* Dimensiones */
        dimensiones:    (idLugar)                 => ipcRenderer.invoke('plano:dimensiones', idLugar),
        actualizarDim:  (idLugar, f, c)           => ipcRenderer.invoke('plano:actualizarDim', idLugar, f, c),

        /* Listado */
        listarPorLugar: (idLugar)                 => ipcRenderer.invoke('plano:listarPorLugar', idLugar),
        sinUbicacion:   (idLugar)                 => ipcRenderer.invoke('plano:sinUbicacion', idLugar),

        /* Movimientos */
        asignar:        (idLugar, idEquipo, fila, col)                              => ipcRenderer.invoke('plano:asignar', idLugar, idEquipo, fila, col),
        mover:          (idEquipo, fila, col, filaAnt, colAnt, idLugar)             => ipcRenderer.invoke('plano:mover', idEquipo, fila, col, filaAnt, colAnt, idLugar),
        quitar:         (idEquipo, idLugar, hostname)                               => ipcRenderer.invoke('plano:quitar', idEquipo, idLugar, hostname),
        intercambiar:   (a, b, idLugar, hostA, hostB, filaA, colA, filaB, colB)     => ipcRenderer.invoke('plano:intercambiar', a, b, idLugar, hostA, hostB, filaA, colA, filaB, colB),

        /* Movimientos entre pisos */
        moverEntrePisos: (idEquipo, idLugarOrigen, idLugarDestino, fila, columna, nuevosDatos) =>
            ipcRenderer.invoke('plano:moverEntrePisos', idEquipo, idLugarOrigen, idLugarDestino, fila, columna, nuevosDatos),

        swapEntrePisos: (datos) =>
            ipcRenderer.invoke('plano:swapEntrePisos', datos),

        /* Zonas */
        listarZonas:    (idLugar)                                                       => ipcRenderer.invoke('plano:listarZonas', idLugar),
        crearZona:      (idLugar, nombre, color, fi, ff, ci, cf)                        => ipcRenderer.invoke('plano:crearZona', idLugar, nombre, color, fi, ff, ci, cf),
        actualizarZona: (idZona, nombre, color, fi, ff, ci, cf, idLugar)                => ipcRenderer.invoke('plano:actualizarZona', idZona, nombre, color, fi, ff, ci, cf, idLugar),
        eliminarZona:   (idZona, idLugar, nombre)                                       => ipcRenderer.invoke('plano:eliminarZona', idZona, idLugar, nombre),

        /* Zonas libres */
        listarZonasLibres:  (idLugar)                          => ipcRenderer.invoke('plano:listarZonasLibres', idLugar),
        guardarZonaLibre:   (idLugar, nombre, color, celdas)   => ipcRenderer.invoke('plano:guardarZonaLibre', idLugar, nombre, color, celdas),
        eliminarZonaLibre:  (idLugar, nombre, color)           => ipcRenderer.invoke('plano:eliminarZonaLibre', idLugar, nombre, color),

        /* Exportar */
        exportarPDF: (opciones) => ipcRenderer.invoke('plano:exportarPDF', opciones)
    }
});