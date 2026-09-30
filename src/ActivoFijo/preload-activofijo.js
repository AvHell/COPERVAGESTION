/* =========================================================
   PRELOAD EXCLUSIVO DEL MÓDULO ACTIVO FIJO
   Aislado del preload principal. Solo expone lo que AF necesita.
   ========================================================= */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    /* =====================================================
       NAVEGACIÓN
       ===================================================== */
    volverMenu:    () => ipcRenderer.invoke('volver-menu'),
    usuarioActual: () => ipcRenderer.invoke('usuario-actual'),
    

    /* =====================================================
       ABRIR OTRAS VENTANAS DE ACTIVO FIJO
       ===================================================== */
    abrirActivoFijoCatalogos:   () => ipcRenderer.invoke('af-abrir-catalogos'),
    abrirActivoFijoActivos:     () => ipcRenderer.invoke('af-abrir-activos'),
    abrirActivoFijoResponsivas: () => ipcRenderer.invoke('af-abrir-responsivas'),
    abrirActivoFijoReportes: () => ipcRenderer.invoke('af-abrir-reportes'),

    /* =====================================================
       CRUD — MÓDULO ACTIVO FIJO
       ===================================================== */
    activoFijo: {
        /* =================================================
           CATÁLOGOS (marcas, tipos, estados, estatus,
                      carteras, puestos)
           ================================================= */
        catalogos: {
            listar:     (clave)            => ipcRenderer.invoke('af-catalogos-listar',     clave),
            crear:      (clave, datos)     => ipcRenderer.invoke('af-catalogos-crear',      clave, datos),
            actualizar: (clave, id, datos) => ipcRenderer.invoke('af-catalogos-actualizar', clave, id, datos),
            eliminar:   (clave, id)        => ipcRenderer.invoke('af-catalogos-eliminar',   clave, id)
        },

        /* =================================================
           INVENTARIO DE ACTIVOS
           ================================================= */
        activos: {
            listar:     (filtros)   => ipcRenderer.invoke('af-activos-listar',     filtros),
            obtener:    (id)        => ipcRenderer.invoke('af-activos-obtener',    id),
            crear:      (datos)     => ipcRenderer.invoke('af-activos-crear',      datos),
            actualizar: (id, datos) => ipcRenderer.invoke('af-activos-actualizar', id, datos),
            eliminar:   (id)        => ipcRenderer.invoke('af-activos-eliminar',   id),

            listarTipos:    () => ipcRenderer.invoke('af-activos-lista-tipos'),
            listarMarcas:   () => ipcRenderer.invoke('af-activos-lista-marcas'),
            listarEstados:  () => ipcRenderer.invoke('af-activos-lista-estados'),
            listarEstatus:  () => ipcRenderer.invoke('af-activos-lista-estatus'),
            listarCarteras: () => ipcRenderer.invoke('af-activos-lista-carteras')
        },

        /* =================================================
           RESPONSIVAS
           ================================================= */
        responsivas: {
            listar:             (filtros)          => ipcRenderer.invoke('af-resp-listar',              filtros),
            obtener:            (id)               => ipcRenderer.invoke('af-resp-obtener',             id),
            activosDisponibles: ()                 => ipcRenderer.invoke('af-resp-activos-disponibles'),
            crear:              (datos)            => ipcRenderer.invoke('af-resp-crear',               datos),
            actualizar:         (id, datos)        => ipcRenderer.invoke('af-resp-actualizar',          id, datos),
            devolver:           (id, fecha, obs)   => ipcRenderer.invoke('af-resp-devolver',            id, fecha, obs),
            eliminar:           (id)               => ipcRenderer.invoke('af-resp-eliminar',            id),

            listarCarteras:     ()                 => ipcRenderer.invoke('af-resp-lista-carteras'),
            listarPuestos:      ()                 => ipcRenderer.invoke('af-resp-lista-puestos')
        },
                /* =================================================
           REPORTES
           ================================================= */
        reportes: {
            resumenGeneral:       ()        => ipcRenderer.invoke('af-rep-resumen-general'),
            resumenPorTipo:       ()        => ipcRenderer.invoke('af-rep-resumen-tipo'),
            resumenPorCartera:    ()        => ipcRenderer.invoke('af-rep-resumen-cartera'),
            inventario:           (filtros) => ipcRenderer.invoke('af-rep-inventario', filtros),
            responsivasActivas:   ()        => ipcRenderer.invoke('af-rep-responsivas-activas'),
            asignacionesPorPersona: ()      => ipcRenderer.invoke('af-rep-asignaciones-persona'),
            porTicket:            ()        => ipcRenderer.invoke('af-rep-por-ticket'),
            historialAsignaciones:(filtros) => ipcRenderer.invoke('af-rep-historial-asignaciones', filtros),
            historialActivo:      (id)      => ipcRenderer.invoke('af-rep-historial-activo', id),
            celulares:            ()        => ipcRenderer.invoke('af-rep-celulares'),
            laptops:              ()        => ipcRenderer.invoke('af-rep-laptops'),

            tiposParaFiltro:      ()        => ipcRenderer.invoke('af-rep-tipos'),
            estadosParaFiltro:    ()        => ipcRenderer.invoke('af-rep-estados'),
            estatusParaFiltro:    ()        => ipcRenderer.invoke('af-rep-estatus'),
            carterasParaFiltro:   ()        => ipcRenderer.invoke('af-rep-carteras')
        }
    }
});