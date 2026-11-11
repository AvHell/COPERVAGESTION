(function () {
  const SECCIONES = [
    {
      label: 'Pisos',
      modulos: [
        { key: 'catalogos', label: 'Catálogos', permiso: 'catalogos', icon: '▦' },
        { key: 'equipos', label: 'Equipos', permiso: 'equipos', icon: '▣' },
        { key: 'plano', label: 'Plano visual', permiso: 'plano', icon: '▤' },
        { key: 'documentacion', label: 'Documentación', permiso: 'documentos', icon: '▨' },
        { key: 'historico', label: 'Histórico', permiso: 'historico', icon: '◷' }
      ]
    },
    {
      label: 'Activo Fijo',
      modulos: [
        { key: 'activofijo_catalogos', label: 'Catálogos de activo fijo', permiso: 'activofijo_catalogos', icon: '▤' },
        { key: 'activofijo_activos', label: 'Inventario de activo fijo', permiso: 'activofijo_activos', icon: '▣' },
        { key: 'activofijo_responsivas', label: 'Responsivas', permiso: 'activofijo_responsivas', icon: '▧' },
        { key: 'activofijo_reportes', label: 'Reportes', permiso: 'activofijo_reportes', icon: '▥' },
        { key: 'activofijo_importar', label: 'Importación', permiso: 'activofijo_importar', icon: '⇧' }
      ]
    },
    {
      label: 'Mantenimientos',
      modulos: [
        { key: 'mantenimientos', label: 'Mantenimientos', permiso: 'mantenimientos', icon: '✓' }
      ]
    },
    {
      label: 'Administrador',
      modulos: [
        { key: 'usuarios', label: 'Usuarios', permiso: 'usuarios', icon: '♙' }
      ]
    }
  ];

  /* =========================================================
     REGLAS EXPLÍCITAS POR PÁGINA
     Se aplican primero: cualquier `data-permiso` declarado aquí
     gana sobre la inferencia automática.
     ========================================================= */
  const REGLAS_PAGINA = {
    'catalogos.html': {
      '#menu-toggle': 'catalogos',
      '.tab-btn[data-tab="clientes"]': 'catalogos',
      '.tab-btn[data-tab="pisos"]': 'catalogos',
      '.tab-btn[data-tab="roles"]': 'catalogos',
      '.tab-btn[data-tab="dominios"]': 'catalogos:dominios:gestionar',
      '.tab-btn[data-tab="config"]': 'catalogos:config:gestionar',
      '.tab-btn[data-tab="rangos"]': 'catalogos:rangos:auditar|catalogos:rangos:editar|catalogos',
      '.tab-panel[data-tab-panel="dominios"]': 'catalogos:dominios:gestionar',
      '.tab-panel[data-tab-panel="config"]': 'catalogos:config:gestionar',
      '.tab-panel[data-tab-panel="rangos"]': 'catalogos:rangos:auditar|catalogos:rangos:editar|catalogos',
      '#rng-filtro-cliente': 'catalogos:rangos:auditar|catalogos:rangos:editar|catalogos',
      '#rng-btn-analizar': 'catalogos:rangos:auditar|equipos:rangos:auditar|catalogos',
      '#rng-btn-aplicar': 'catalogos:rangos:crear|catalogos:rangos:editar|equipos:rangos:crear|equipos:rangos:editar',
      '#cli-btn-nuevo': 'catalogos:clientes:crear',
      '#cli-guardar': 'catalogos:clientes:crear|catalogos:clientes:editar',
      '#pis-btn-nuevo': 'catalogos:pisos:crear',
      '#pis-guardar': 'catalogos:pisos:crear|catalogos:pisos:editar',
      '#rol-btn-nuevo': 'catalogos:roles:crear',
      '#rol-guardar': 'catalogos:roles:crear|catalogos:roles:editar',
      '#dom-btn-nuevo': 'catalogos:dominios:gestionar',
      '#cfg-btn-nuevo': 'catalogos:config:gestionar',
      '#cli-tabla button.secundario': 'catalogos:clientes:editar',
      '#cli-tabla button.peligro': 'catalogos:clientes:eliminar',
      '#pis-contenedor-grupos button.secundario': 'catalogos:pisos:editar',
      '#pis-contenedor-grupos button.peligro': 'catalogos:pisos:eliminar',
      '#rol-tabla button.secundario': 'catalogos:roles:editar',
      '#rol-tabla button.peligro': 'catalogos:roles:eliminar',
      '#dom-tabla button.secundario': 'catalogos:dominios:gestionar',
      '#dom-tabla button.peligro': 'catalogos:dominios:gestionar',
      '#cfg-contenedor-grupos button.secundario': 'catalogos:config:gestionar',
      '#cfg-contenedor-grupos button.peligro': 'catalogos:config:gestionar',
      '#dom-tabla': 'catalogos:dominios:gestionar',
      '#cfg-contenedor-grupos': 'catalogos:config:gestionar'
    },
    'equipos.html': {
      '#btn-nuevo': 'equipos:crear',
      '#btn-guardar': 'equipos:crear|equipos:editar',
      '#btn-exportar-excel': 'equipos:listado:exportar',
      '#btn-control-ip': 'equipos:listado:ver',
      '#btn-nuevo-dominio': 'catalogos:dominios:gestionar',
      '.btn-agregar-mini[data-tipo]': 'catalogos:config:gestionar',
      '#btn-ips-disponibles': 'equipos:listado:ver',
      '.btn-usar-ip': 'equipos:listado:ver',
      '#contenedor-grupos': 'equipos:listado:ver',
      '.data-table button.secundario': 'equipos:editar',
      '.data-table button.peligro': 'equipos:eliminar',
      '#btn-rangos-ip': 'equipos',
      '#rangos-filtro-cliente': 'equipos',
      '#btn-rangos-auditar': 'equipos:rangos:auditar|equipos',
      '#btn-rango-nuevo': 'equipos:rangos:crear',
      '#btn-sugerir-rango': 'equipos:rangos:crear|equipos:rangos:editar',
      '#rango-guardar': 'equipos:rangos:crear|equipos:rangos:editar',
      '#rangos-lista button.secundario': 'equipos:rangos:editar',
      '#rangos-lista button.peligro': 'equipos:rangos:eliminar'
    },
    'plano.html': {
      '#contenedor-principal': 'plano:ver',
      '#btn-exportar-pdf-doc': 'plano:exportar',
      '#btn-aplicar-dim-izq': 'plano:editar-dim',
      '#btn-aplicar-dim-der': 'plano:editar-dim',
      '#btn-modo-zona': 'plano:zonas:gestionar',
      '#btn-modo-zona-libre': 'plano:zonas:gestionar',
      '#btn-modo-edicion': 'equipos:editar',
      '#modal-zona-aceptar': 'plano:zonas:gestionar',
      '#modal-zona-eliminar': 'plano:zonas:eliminar',
      '#modal-zona-libre-aceptar': 'plano:zonas:gestionar',
      '#modal-zona-libre-eliminar': 'plano:zonas:eliminar',
      '#mover-confirmar': 'plano:mover|plano:asignar',
      '#modal-aceptar': 'plano:mover|plano:asignar',
      '#btn-limpiar-seleccion': 'plano:mover|plano:asignar',
      '#editar-confirmar': 'equipos:editar',
      '.btn-editar-equipo': 'equipos:editar',
      '.tabla-equipos button.secundario': 'equipos:editar'
    },
    'clientes.html': {
      '#btn-nuevo': 'catalogos:clientes:crear',
      '#btn-guardar': 'catalogos:clientes:crear|catalogos:clientes:editar',
      '#tabla-clientes button.secundario': 'catalogos:clientes:editar',
      '#tabla-clientes button.peligro': 'catalogos:clientes:eliminar'
    },
    'lugares.html': {
      '#btn-nuevo': 'catalogos:pisos:crear',
      '#btn-guardar': 'catalogos:pisos:crear|catalogos:pisos:editar'
    },
    'roles.html': {
      '#btn-nuevo': 'catalogos:roles:crear',
      '#btn-guardar': 'catalogos:roles:crear|catalogos:roles:editar',
      '#tabla-roles button.secundario': 'catalogos:roles:editar',
      '#tabla-roles button.peligro': 'catalogos:roles:eliminar'
    },
    'dominios.html': {
      '#btn-nuevo': 'catalogos:dominios:gestionar',
      '#tabla-dominios button.secundario': 'catalogos:dominios:gestionar',
      '#tabla-dominios button.peligro': 'catalogos:dominios:gestionar'
    },
    'configred.html': {
      '#btn-nueva': 'catalogos:config:gestionar',
      'table button.secundario': 'catalogos:config:gestionar',
      'table button.peligro': 'catalogos:config:gestionar'
    },
    'usuarios.html': {
      '#btn-nuevo': 'usuarios:crear',
      '#btn-guardar': 'usuarios:crear|usuarios:editar',
      '#btn-nuevo-rol': 'usuarios',
      '#btn-permisos': 'usuarios',
      '#btn-guardar-rol': 'usuarios',
      '#btn-editar-rol': 'usuarios',
      '#btn-toggle-rol': 'usuarios',
      '#btn-eliminar-rol': 'usuarios',
      '.card-tabla': 'usuarios:listado:ver',
      '#tabla-usuarios': 'usuarios:listado:ver',
      '#tabla-usuarios button.secundario': 'usuarios:editar',
      '#tabla-usuarios button.peligro': 'usuarios:eliminar'
    },
    'inventario-ip.html': {
      '#btn-recargar': 'equipos:listado:ver',
      '#btn-catalogos': 'equipos:listado:ver',
      '#btn-exportar': 'equipos:listado:exportar',
      '#lista-segmentos': 'equipos:listado:ver',
      '#tabla-ip': 'equipos:listado:ver',
      '#btn-nuevo-registro': 'equipos:crear',
      '#btn-guardar': 'equipos:crear|equipos:editar',
      '#btn-nueva-opcion': 'equipos:crear',
      '#btn-guardar-catalogo': 'equipos:crear',
      '#tabla-ip .actions button.secondary': 'equipos:editar',
      '#tabla-ip .actions button.danger': 'equipos:eliminar'
    },
    'mantenimientos.html': {
      '#mapa': 'mantenimientos',
      '#btn-guardar': 'mantenimientos:crear',
      '#btn-exportar-excel': 'mantenimientos',
      '#btn-ver-historial': 'mantenimientos',
      '#btn-actualizar': 'mantenimientos',
      '#btn-cerrar-historial': 'mantenimientos'
    },
    'documentacion.html': {
      '#btn-subir': 'documentos:subir',
      '#zona-subida': 'documentos:subir',
      '#btn-menu-secciones': 'documentos:secciones:gestionar',
      '#btn-nueva-seccion': 'documentos:secciones:gestionar',
      '#btn-editar-seccion': 'documentos:secciones:gestionar',
      '#btn-eliminar-seccion': 'documentos:secciones:gestionar',
      '#btn-papelera': 'documentos:listado:ver',
      '#btn-recargar': 'documentos:listado:ver',
      '.tarjeta-doc button.secundario': 'documentos:editar',
      '.tarjeta-doc button.peligro': 'documentos:eliminar',
      '.btn-archivo': 'documentos:descargar',
      '#det-versiones button.secundario': 'documentos:descargar'
    },
    'historico.html': {
      '.main-content': 'historico'
    }
  };

  const REGLAS_ACTIVOFIJO = {
    'catalogos.html': {
      '#btn-nuevo': 'af-cat:crear',
      '#btn-guardar': 'af-cat:crear|af-cat:editar',
      '#card-tabla': 'af-cat:listado:ver'
    },
    'activos.html': {
      '#btn-nuevo': 'af-act:crear',
      '#btn-guardar': 'af-act:crear|af-act:editar',
      '#btn-exportar': 'af-act:listado:ver',
      '#card-tabla': 'af-act:listado:ver'
    },
    'responsivas.html': {
      '#btn-nuevo': 'af-resp:crear',
      '#btn-guardar': 'af-resp:crear|af-resp:editar',
      '#btn-catalogos-responsiva': 'activofijo_responsivas',
      '#card-tabla': 'af-resp:listado:ver',
      '[data-agregar]': 'activofijo_responsivas',
      '[data-editar]': 'activofijo_responsivas',
      '[data-guardar]': 'activofijo_responsivas',
      '[data-eliminar]': 'activofijo_responsivas'
    },
    'reportes.html': {
      '#btn-exportar': 'af-rep:exportar',
      '#btn-recargar': 'af-rep:ver',
      '#card-tabla': 'af-rep:ver'
    },
    'importar.html': {
      '#btn-importar': 'af-imp:ejecutar',
      '#btn-descargar-plantilla': 'af-imp:ejecutar'
    }
  };

  /* =========================================================
     CONTEXTO POR PÁGINA (base de la inferencia automática)
     Cada acción del DOM se traduce a la clave real del catálogo.
     ========================================================= */
  const CONTEXTOS = {
    'equipos.html': {
      ver: 'equipos:listado:ver',
      crear: 'equipos:crear',
      editar: 'equipos:editar',
      eliminar: 'equipos:eliminar',
      guardar: 'equipos:crear|equipos:editar',
      exportar: 'equipos:listado:exportar',
      importar: 'equipos:listado:exportar',
      gestionar: 'equipos',
      asignar: 'equipos:editar'
    },
    'inventario-ip.html': {
      ver: 'equipos:listado:ver',
      crear: 'equipos:crear',
      editar: 'equipos:editar',
      eliminar: 'equipos:eliminar',
      guardar: 'equipos:crear|equipos:editar',
      exportar: 'equipos:listado:exportar',
      importar: 'equipos:listado:exportar',
      gestionar: 'equipos',
      asignar: 'equipos:editar'
    },
    'plano.html': {
      ver: 'plano:ver',
      crear: 'plano:asignar',
      editar: 'equipos:editar',
      eliminar: 'plano:zonas:eliminar|plano:quitar',
      guardar: 'plano:asignar|plano:mover',
      exportar: 'plano:exportar',
      gestionar: 'plano:zonas:gestionar',
      asignar: 'plano:asignar'
    },
    'mantenimientos.html': {
      ver: 'mantenimientos',
      crear: 'mantenimientos:crear',
      editar: 'mantenimientos:fecha:editar',
      eliminar: 'mantenimientos',
      guardar: 'mantenimientos:crear',
      exportar: 'mantenimientos',
      gestionar: 'mantenimientos'
    },
    'usuarios.html': {
      ver: 'usuarios:listado:ver',
      crear: 'usuarios:crear',
      editar: 'usuarios:editar',
      eliminar: 'usuarios:eliminar',
      guardar: 'usuarios:crear|usuarios:editar',
      exportar: 'usuarios:listado:ver',
      gestionar: 'usuarios',
      asignar: 'usuarios:asignar-rol'
    },
    'roles.html': {
      ver: 'catalogos',
      crear: 'catalogos:roles:crear',
      editar: 'catalogos:roles:editar',
      eliminar: 'catalogos:roles:eliminar',
      guardar: 'catalogos:roles:crear|catalogos:roles:editar',
      gestionar: 'catalogos'
    },
    'clientes.html': {
      ver: 'catalogos',
      crear: 'catalogos:clientes:crear',
      editar: 'catalogos:clientes:editar',
      eliminar: 'catalogos:clientes:eliminar',
      guardar: 'catalogos:clientes:crear|catalogos:clientes:editar',
      gestionar: 'catalogos'
    },
    'lugares.html': {
      ver: 'catalogos',
      crear: 'catalogos:pisos:crear',
      editar: 'catalogos:pisos:editar',
      eliminar: 'catalogos:pisos:eliminar',
      guardar: 'catalogos:pisos:crear|catalogos:pisos:editar',
      gestionar: 'catalogos'
    },
    'dominios.html': {
      ver: 'catalogos:dominios:gestionar',
      crear: 'catalogos:dominios:gestionar',
      editar: 'catalogos:dominios:gestionar',
      eliminar: 'catalogos:dominios:gestionar',
      guardar: 'catalogos:dominios:gestionar',
      gestionar: 'catalogos:dominios:gestionar'
    },
    'configred.html': {
      ver: 'catalogos:config:gestionar',
      crear: 'catalogos:config:gestionar',
      editar: 'catalogos:config:gestionar',
      eliminar: 'catalogos:config:gestionar',
      guardar: 'catalogos:config:gestionar',
      gestionar: 'catalogos:config:gestionar'
    },
    'catalogos.html': {
      ver: 'catalogos',
      crear: 'catalogos',
      editar: 'catalogos',
      eliminar: 'catalogos',
      guardar: 'catalogos',
      exportar: 'catalogos',
      gestionar: 'catalogos'
    },
    'documentacion.html': {
      ver: 'documentos:listado:ver',
      crear: 'documentos:subir',
      editar: 'documentos:editar',
      eliminar: 'documentos:eliminar',
      guardar: 'documentos:subir|documentos:editar',
      exportar: 'documentos:descargar',
      importar: 'documentos:subir',
      gestionar: 'documentos:secciones:gestionar',
      asignar: 'documentos'
    },
    'historico.html': {
      ver: 'historico',
      exportar: 'historico',
      gestionar: 'historico'
    }
  };

  const CONTEXTOS_ACTIVOFIJO = {
    'catalogos.html': {
      ver: 'af-cat:listado:ver',
      crear: 'af-cat:crear',
      editar: 'af-cat:editar',
      eliminar: 'af-cat:eliminar',
      guardar: 'af-cat:crear|af-cat:editar',
      exportar: 'af-cat:listado:ver',
      gestionar: 'activofijo_catalogos'
    },
    'activos.html': {
      ver: 'af-act:listado:ver',
      crear: 'af-act:crear',
      editar: 'af-act:editar',
      eliminar: 'af-act:eliminar',
      guardar: 'af-act:crear|af-act:editar',
      exportar: 'af-act:listado:ver',
      gestionar: 'activofijo_activos'
    },
    'responsivas.html': {
      ver: 'af-resp:listado:ver',
      crear: 'af-resp:crear',
      editar: 'af-resp:editar',
      eliminar: 'af-resp:eliminar',
      guardar: 'af-resp:crear|af-resp:editar',
      exportar: 'af-resp:pdf',
      gestionar: 'activofijo_responsivas'
    },
    'reportes.html': {
      ver: 'af-rep:ver',
      exportar: 'af-rep:exportar',
      gestionar: 'activofijo_reportes'
    },
    'importar.html': {
      ver: 'activofijo_importar',
      crear: 'af-imp:ejecutar',
      guardar: 'af-imp:ejecutar',
      exportar: 'af-imp:ejecutar',
      gestionar: 'activofijo_importar'
    }
  };

  /* Tokens que identifican la acción de un control. Se comparan por
     palabra completa (id/texto partidos por separadores), así "btn-volver"
     nunca se confunde con "ver". El orden define la prioridad. */
  const TOKENS_ACCION = [
    ['eliminar', ['eliminar', 'elimina', 'eliminacion', 'borrar', 'borra', 'quitar', 'quita', 'desactivar', 'danger', 'peligro', 'trash']],
    ['exportar', ['exportar', 'exporta', 'excel', 'xlsx', 'pdf', 'descargar', 'descarga', 'imprimir']],
    ['importar', ['importar', 'importa', 'importacion', 'subir', 'plantilla', 'carga']],
    ['editar', ['editar', 'edita', 'edicion', 'modificar', 'modifica']],
    ['guardar', ['guardar', 'guarda', 'aceptar', 'aplicar', 'confirmar', 'save']],
    ['crear', ['nuevo', 'nueva', 'crear', 'crea', 'agregar', 'agrega', 'anadir', 'añadir', 'registrar', 'registra', 'alta']],
    ['asignar', ['asignar', 'asigna', 'permisos', 'permiso', 'rol', 'roles']],
    ['ver', ['ver', 'consultar', 'consulta', 'auditar', 'auditoria', 'recargar', 'actualizar', 'catalogo', 'catalogos', 'listado', 'historial', 'detalle', 'seleccionar']]
  ];

  /* Acciones detectables por selector genérico (filas de tabla, etc.). */
  const SELECTORES_ACCION = {
    editar: '.btn-accion.editar, button.editar, [data-accion="editar"], [data-editar], table button.secundario, .data-table button.secundario, .acciones-tabla button.secundario',
    eliminar: '.btn-accion.eliminar, button.eliminar, button.peligro, button.danger, [data-accion="eliminar"], [data-eliminar], table button.peligro, .acciones-tabla button.peligro',
    crear: '.btn-accion.crear, button.crear, [data-accion="crear"], [data-agregar]',
    guardar: '[data-accion="guardar"], [data-guardar]',
    exportar: '[data-accion="exportar"], [data-exportar]',
    ver: '[data-accion="ver"], [data-ver], .card-tabla table, table.data-table'
  };

  const SELECTOR_CONTROL = 'button, input[type="submit"], input[type="button"], [role="button"]';

  let permisos = {};
  let rol = null;
  let observer = null;
  let iniciando = null;
  const coloresClientes = new Map();
  const coloresRoles = new Map();
  /* Estado propio de cada elemento antes de que PermisosUI lo ocultara:
     así devolvemos el control tal cual estaba si el permiso vuelve. */
  const estados = new WeakMap();
  const pendientes = new Set();
  let temporizador = null;

  /* ---------- Permisos ---------- */

  function puede(claves) {
    if (rol === 'ADMIN') return true;
    return String(claves || '').split('|').some(grupo =>
      grupo.split('&').every(clave => permisos[clave.trim()] === true)
    );
  }

  function obtenerPagina() {
    return decodeURIComponent(location.pathname.split(/[\\/]/).pop() || '').toLowerCase();
  }

  function esActivoFijo() {
    return /[\\/]activofijo[\\/]html[\\/]/i.test(location.pathname);
  }

  function reglasDePagina(pagina = obtenerPagina()) {
    if (esActivoFijo()) return REGLAS_ACTIVOFIJO[pagina] || {};
    return REGLAS_PAGINA[pagina] || {};
  }

  function contextoDePagina(pagina = obtenerPagina()) {
    if (esActivoFijo()) return CONTEXTOS_ACTIVOFIJO[pagina] || null;
    return CONTEXTOS[pagina] || null;
  }

  /* ---------- Inferencia de permisos ---------- */

  function partirEnTokens(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z]+/)
      .filter(Boolean);
  }

  function accionPorTokens(tokens) {
    if (!tokens.length) return null;
    for (const [accion, lista] of TOKENS_ACCION) {
      if (tokens.some(token => lista.includes(token))) return accion;
    }
    return null;
  }

  /** Acción deducible de un control, o null si no se puede interpretar. */
  function accionDeElemento(el) {
    const declarada = String(el.dataset.accion || '').toLowerCase();
    if (declarada && TOKENS_ACCION.some(([accion]) => accion === declarada)) return declarada;

    const porId = accionPorTokens(partirEnTokens(el.id));
    if (porId) return porId;

    const porClases = accionPorTokens(partirEnTokens(typeof el.className === 'string' ? el.className : ''));
    if (porClases) return porClases;

    if (el.tagName === 'INPUT') {
      const porValor = accionPorTokens(partirEnTokens(el.value));
      if (porValor) return porValor;
    }

    return accionPorTokens(partirEnTokens((el.textContent || '').slice(0, 60)));
  }

  /** Aplica la inferencia dentro de `root`, reciclando lo ya asignado. */
  function inferirPermisos(root) {
    const contexto = contextoDePagina();
    if (!contexto) return;

    const candidatos = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(SELECTOR_CONTROL)) candidatos.push(root);
    if (root.querySelectorAll) candidatos.push(...root.querySelectorAll(SELECTOR_CONTROL));

    for (const el of candidatos) {
      if (el.closest('.app-sidebar')) continue;

      const previo = el.dataset.permisoAuto;
      const accion = accionDeElemento(el);
      const permiso = accion ? contexto[accion] : null;

      if (previo) {
        /* Reciclaje: si la regla cambió o desapareció, limpiamos en vez de
           arrastrar un permiso viejo (nada de basura acumulada). */
        if (!permiso) {
          el.removeAttribute('data-permiso');
          delete el.dataset.permisoAuto;
        } else if (el.dataset.permiso !== permiso) {
          el.dataset.permiso = permiso;
        }
        continue;
      }

      if (el.hasAttribute('data-permiso') || !permiso) continue;
      el.dataset.permisoAuto = accion;
      el.dataset.permiso = permiso;
    }
  }

  /* ---------- Aplicación de reglas ---------- */

  function aplicarReglasPagina(root = document) {
    const reglas = reglasDePagina();
    for (const [selector, permiso] of Object.entries(reglas)) {
      const elementos = root.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
      if (root.matches?.(selector)) elementos.unshift(root);
      elementos.forEach(el => {
        if (!el.hasAttribute('data-permiso')) el.setAttribute('data-permiso', permiso);
      });
    }

    const contexto = contextoDePagina();
    if (contexto) {
      for (const [accion, selector] of Object.entries(SELECTORES_ACCION)) {
        const permiso = contexto[accion];
        if (!permiso) continue;
        const elementos = root.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
        if (root.matches?.(selector)) elementos.unshift(root);
        elementos.forEach(el => {
          if (!el.hasAttribute('data-permiso')) el.setAttribute('data-permiso', permiso);
        });
      }
    }

    inferirPermisos(root);
    aplicar(root);
  }

  /** Devuelve un control a cómo estaba antes de que PermisosUI lo ocultara. */
  function restaurarNatural(el) {
    const estado = estados.get(el);
    if (!estado) {
      el.classList.remove('permiso-ui-oculto');
      return;
    }
    el.hidden = estado.hidden === true;
    if ('disabled' in el && estado.disabled !== null) el.disabled = estado.disabled;
    el.classList.remove('permiso-ui-oculto');
    if (estado.aria === null || estado.aria === undefined) el.removeAttribute('aria-hidden');
    else el.setAttribute('aria-hidden', estado.aria);
    /* Estado natural devuelto: la próxima vez volvemos a capturarlo, así no
       arrastramos un estado viejo (nada de basura acumulada). */
    estados.delete(el);
  }

  function aplicarElemento(el) {
    const permitido = puede(el.dataset.permiso);
    const estado = estados.get(el);

    if (!permitido) {
      if (!estado) {
        /* Primera vez que lo ocultamos: guardamos cómo estaba. */
        estados.set(el, {
          hidden: el.hidden,
          disabled: 'disabled' in el ? el.disabled : null,
          aria: el.getAttribute('aria-hidden'),
          oculto: true
        });
      }
      el.hidden = true;
      el.classList.add('permiso-ui-oculto');
      if ('disabled' in el) el.disabled = true;
      el.setAttribute('aria-hidden', 'true');
      return;
    }

    if (!estado || !estado.oculto) {
      /* Nunca lo ocultamos nosotros: no tocamos su visibilidad para no
         des-ocultar controles que la propia página esconde por su lógica. */
      el.classList.remove('permiso-ui-oculto');
      return;
    }

    restaurarNatural(el);
  }

  function aplicar(root = document) {
    const lista = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.('[data-permiso]')) lista.push(root);
    if (root.querySelectorAll) lista.push(...root.querySelectorAll('[data-permiso]'));
    lista.forEach(aplicarElemento);
  }

  /* ---------- Colores de clientes y roles ---------- */

  function contraste(hex) {
    const canales = hex.slice(1).match(/.{2}/g).map(canal => parseInt(canal, 16) / 255)
      .map(canal => canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4);
    return canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722 > 0.42 ? '#20271f' : '#ffffff';
  }

  /* Firma de lo último que pintamos en cada elemento. Sirve para dos cosas:
     no reescribir estilos idénticos en cada repintado del DOM (el
     MutationObserver revisa muy seguido) y poder retirar exactamente lo que
     nosotros pusimos cuando un color deja de existir en Catálogos. */
  const pintados = new WeakMap();

  /* Aclara un color hacia blanco: el mismo cálculo que usa el renderer del
     plano para el fondo de las celdas ocupadas. */
  function aclararColor(hex) {
    const canales = hex.slice(1).match(/.{2}/g).map(canal => parseInt(canal, 16));
    return `#${canales.map(canal => Math.round(canal + (255 - canal) * .78).toString(16).padStart(2, '0')).join('')}`;
  }

  /* Devuelve el elemento a su estado natural (lo pinta la hoja de estilos). */
  function despintarElemento(el) {
    if (!pintados.has(el)) return;
    pintados.delete(el);
    ['--rol-color', '--rol-borde', '--rol-fondo', '--rol-texto',
      '--cliente-color', '--cliente-borde', '--cliente-fondo', '--cliente-texto',
      'background-color', 'border-color', 'color']
      .forEach(propiedad => el.style.removeProperty(propiedad));
    /* Si el navegador no dejó nada en el atributo, lo quitamos para no
       arrastrar un style="" vacío en el DOM. */
    if (!el.getAttribute('style')) el.removeAttribute('style');
  }

  function pintarElemento(el) {
    const codigo = String(el.dataset.color || el.dataset.rol || '').trim().toUpperCase();
    /* 'BOTON' es el marcador de insignia neutra: no es un color de catálogo. */
    if (!codigo || codigo === 'BOTON') return;

    /* Chips de filtro del panel lateral del plano (roles y clientes del piso):
       sólo el activo toma el color del catálogo; los inactivos vuelven al
       estilo de la hoja, porque si no todos parecerían seleccionados. */
    const esChipFiltro = el.matches('.filtro-rol-chip');
    const esChipCliente = el.matches('.chip-cliente');
    /* Punto de color junto al nombre del cliente (lista "Equipos sin ubicar"). */
    const esPuntoCliente = el.matches('.punto-cliente');
    if ((esChipFiltro || esChipCliente) && !el.classList.contains('activo')) {
      despintarElemento(el);
      return;
    }

    const pagina = obtenerPagina();
    const esCliente = esChipCliente || esPuntoCliente ||
      el.matches('.badge-cliente, .badge-cli') ||
      el.dataset.colorKind === 'client' ||
      (pagina === 'clientes.html' && el.matches('.badge-codigo'));
    const esRol = esChipFiltro ||
      el.matches('.rol-pill, .hostname-badge') ||
      el.matches('.badge-equipo') ||
      el.hasAttribute('data-rol') ||
      el.dataset.colorKind === 'role' ||
      ((pagina === 'roles.html' || pagina === 'catalogos.html') && el.matches('.badge-codigo'));
    const color = esCliente ? coloresClientes.get(codigo) : esRol ? coloresRoles.get(codigo) : null;
    if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
      /* El cliente/rol ya no tiene color en Catálogos: si lo habíamos pintado,
         se retira para no arrastrar un color viejo. */
      despintarElemento(el);
      return;
    }

    /* Las celdas del plano y de mantenimientos (y los chips del filtro de rol)
       se colorean con variables CSS que ya consumen sus hojas de estilo. Es
       importante NO escribir background/border inline con !important: eso
       aplastaría los estados :hover, .seleccionada y .destino, que es
       justamente lo que se perdió al quitar los colores fijos del CSS. */
    const esCeldaEquipo = el.matches('.celda[data-rol]');
    const usaVariables = esCeldaEquipo || esChipFiltro || esChipCliente || esPuntoCliente;
    const fondo = esCeldaEquipo ? aclararColor(color) : color;
    const modo = esCeldaEquipo ? 'celda'
      : esChipCliente ? 'chip-cliente'
      : esPuntoCliente ? 'punto-cliente'
      : esChipFiltro ? 'chip'
      : 'solido';

    const firma = `${color}|${modo}`;
    if (pintados.get(el) === firma) return;

    /* Los chips y puntos de cliente escriben tokens `--cliente-*` propios: así
       el color de un cliente nunca se mezcla con el de un rol en la variable. */
    const prefijo = (esChipCliente || esPuntoCliente) ? 'cliente' : 'rol';
    el.style.setProperty(`--${prefijo}-color`, color);
    el.style.setProperty(`--${prefijo}-borde`, color);
    el.style.setProperty(`--${prefijo}-fondo`, fondo);
    el.style.setProperty(`--${prefijo}-texto`, esCeldaEquipo ? '#20271f' : contraste(color));
    if (usaVariables) {
      el.style.removeProperty('background-color');
      el.style.removeProperty('border-color');
      el.style.removeProperty('color');
    } else {
      el.style.setProperty('background-color', fondo, 'important');
      el.style.setProperty('border-color', color, 'important');
      el.style.setProperty('color', contraste(color), 'important');
    }
    pintados.set(el, firma);
  }

  function aplicarColores(root = document) {
    const elementos = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.('[data-color], [data-rol]')) elementos.push(root);
    if (root.querySelectorAll) elementos.push(...root.querySelectorAll('[data-color], [data-rol]'));
    elementos.forEach(pintarElemento);
  }

  async function refrescarColores() {
    if (obtenerPagina() === 'login.html' || !window.api?.catalogosColores) return;
    try {
      const catalogos = await window.api.catalogosColores();
      if (!catalogos || catalogos.ok === false) {
        throw new Error(catalogos?.mensaje || 'No se pudieron obtener los colores configurados.');
      }
      coloresClientes.clear();
      coloresRoles.clear();
      (catalogos.clientes || []).forEach(item => {
        if (item.codigo && /^#[0-9A-F]{6}$/i.test(item.colorHex || '')) {
          coloresClientes.set(String(item.codigo).toUpperCase(), item.colorHex);
        }
      });
      (catalogos.roles || []).forEach(item => {
        if (item.codigo && /^#[0-9A-F]{6}$/i.test(item.colorHex || '')) {
          coloresRoles.set(String(item.codigo).toUpperCase(), item.colorHex);
        }
      });
      aplicarColores();
      return true;
    } catch (error) {
      console.error('[PermisosUI] No se pudieron aplicar los colores de clientes y roles:', error);
      mostrarError('No se pudieron cargar los colores configurados.');
      return false;
    }
  }

  /* ---------- Menú lateral ---------- */

  function montarMenu() {
    if (obtenerPagina() === 'login.html' || document.querySelector('.app-sidebar')) return;
    if (!document.getElementById('app-shell-css')) {
      const link = document.createElement('link');
      link.id = 'app-shell-css';
      link.rel = 'stylesheet';
      link.href = esActivoFijo() ? '../../css/app-shell.css' : '../css/app-shell.css';
      document.head.appendChild(link);
    }
    document.body.classList.add('app-shell');

    const aside = document.createElement('aside');
    aside.className = 'app-sidebar';
    aside.innerHTML = `
      <div class="app-sidebar-brand">
        <span class="app-sidebar-logo">C</span>
        <span class="app-sidebar-brand-text"><strong>Coperva</strong><small>Control de equipos</small></span>
        <button type="button" class="app-sidebar-toggle" aria-label="Contraer menú" title="Contraer menú">‹</button>
      </div>
      <nav class="app-sidebar-nav" aria-label="Navegación principal"></nav>
      <div class="app-sidebar-footer">
        <div class="app-sidebar-user"><strong class="app-sidebar-user-name">Usuario</strong><small class="app-sidebar-user-role"></small></div>
        <button type="button" class="app-sidebar-logout" title="Cerrar sesión" aria-label="Cerrar sesión">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"></path>
          </svg>
          <span>Cerrar sesión</span>
        </button>
      </div>`;
    document.body.prepend(aside);
    const collapsed = localStorage.getItem('app-sidebar-collapsed') === 'true';
    document.body.classList.toggle('app-sidebar-collapsed', collapsed);
    aside.querySelector('.app-sidebar-toggle').textContent = collapsed ? '›' : '‹';
    aside.querySelector('.app-sidebar-toggle').setAttribute('aria-label', collapsed ? 'Expandir menú' : 'Contraer menú');

    const nav = aside.querySelector('.app-sidebar-nav');
    const actual = obtenerPagina();
    SECCIONES.forEach(seccion => {
      const grupo = document.createElement('section');
      grupo.className = 'app-sidebar-section';
      const titulo = document.createElement('h2');
      titulo.className = 'app-sidebar-section-title';
      titulo.textContent = seccion.label;
      grupo.appendChild(titulo);
      let modulosVisibles = 0;
      seccion.modulos.forEach(modulo => {
        const permiso = modulo.permiso;
        const linkModulo = document.createElement('button');
        linkModulo.type = 'button';
        linkModulo.className = 'app-sidebar-link';
        linkModulo.dataset.modulo = modulo.key;
        linkModulo.setAttribute('aria-label', modulo.label);
        linkModulo.title = modulo.label;
        linkModulo.innerHTML = `<span class="app-sidebar-icon" aria-hidden="true">${modulo.icon}</span><span>${modulo.label}</span>`;
        linkModulo.hidden = !puede(permiso);
        linkModulo.classList.toggle('permiso-ui-oculto', linkModulo.hidden);
        if (!linkModulo.hidden) modulosVisibles += 1;
        const esModuloAF = modulo.key.startsWith('activofijo_');
        const paginaActiva = modulo.key === 'roles'
          ? !esActivoFijo() && actual === 'roles.html'
          : esModuloAF
            ? esActivoFijo() && actual === modulo.key.replace('activofijo_', '') + '.html'
            : !esActivoFijo() && actual === modulo.key + '.html';
        linkModulo.classList.toggle('active', paginaActiva);
        linkModulo.addEventListener('click', async () => {
          if (!puede(permiso)) return;
          try {
            const resultado = await window.api.navegarModulo(modulo.key);
            if (resultado?.ok === false) mostrarError(resultado.mensaje || 'No se pudo abrir la página.');
          } catch (error) {
            console.error('[PermisosUI] Error navegando al módulo:', error);
            mostrarError('Ocurrió un error al abrir el módulo.');
          }
        });
        grupo.appendChild(linkModulo);
      });
      if (modulosVisibles > 0) nav.appendChild(grupo);
    });

    aside.querySelector('.app-sidebar-toggle').addEventListener('click', () => {
      document.body.classList.toggle('app-sidebar-collapsed');
      const colapsado = document.body.classList.contains('app-sidebar-collapsed');
      localStorage.setItem('app-sidebar-collapsed', String(colapsado));
      aside.querySelector('.app-sidebar-toggle').textContent = colapsado ? '›' : '‹';
      aside.querySelector('.app-sidebar-toggle').setAttribute('aria-label', colapsado ? 'Expandir menú' : 'Contraer menú');
    });
    aside.querySelector('.app-sidebar-logout').addEventListener('click', async () => {
      if (window.Swal) {
        const result = await window.Swal.fire({
          title: '¿Cerrar sesión?',
          text: 'Se cerrará tu sesión actual.',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Cerrar sesión',
          cancelButtonText: 'Cancelar'
        });
        if (!result.isConfirmed) return;
      }
      await window.api.logout();
    });

    window.api.usuarioActual().then(usuario => {
      if (!usuario) return;
      aside.querySelector('.app-sidebar-user-name').textContent =
        [usuario.Nombres, usuario.Apellidos].filter(Boolean).join(' ') || usuario.NombreUsuario || 'Usuario';
      aside.querySelector('.app-sidebar-user-role').textContent = usuario.RolNombre || usuario.Rol || '';
    }).catch(err => console.warn('[PermisosUI] No se pudo cargar el usuario:', err));

    document.querySelectorAll('#btn-volver').forEach(button => button.hidden = true);
  }

  /* ---------- Estilos base de los diálogos ---------- */

  function instalarToastSinBlurNiCerrar() {
    const style = document.createElement('style');
    style.textContent = `
      .permiso-ui-oculto { display: none !important; }
      .global-toast-container { background: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
      .swal2-popup.swal2-toast .swal2-close { display: none !important; }
      .swal2-container:has(.swal2-popup.swal2-toast) { background: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
      .app-swal-container { background: rgba(24, 30, 25, .48) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
      .swal2-popup.app-swal-popup { padding: 1.65rem !important; border: 1px solid rgba(81, 104, 72, .16) !important; border-radius: 20px !important; color: #263126 !important; background: #fff !important; box-shadow: 0 24px 70px rgba(18, 30, 20, .24) !important; font-family: Inter, system-ui, sans-serif !important; }
      .app-swal-popup .swal2-title { color: #263126 !important; font: 800 1.25rem/1.3 Manrope, Inter, sans-serif !important; }
      .app-swal-popup .swal2-html-container { margin-top: .55rem !important; color: #687365 !important; font-size: .92rem !important; line-height: 1.55 !important; }
      .app-swal-popup .swal2-actions { gap: .65rem !important; margin-top: 1.35rem !important; }
      .app-swal-confirm-button, .app-swal-cancel-button { min-height: 42px !important; padding: 0 1.15rem !important; border: 0 !important; border-radius: 11px !important; font: 700 .85rem Inter, system-ui, sans-serif !important; transition: transform .16s ease, box-shadow .16s ease, background .16s ease !important; }
      .app-swal-confirm-button { color: #fff !important; background: #526b49 !important; box-shadow: 0 5px 12px rgba(82, 107, 73, .22) !important; }
      .app-swal-confirm-button:hover { background: #435a3b !important; box-shadow: 0 7px 16px rgba(82, 107, 73, .28) !important; transform: translateY(-1px); }
      .app-swal-cancel-button { color: #445044 !important; background: #edf0e9 !important; }
      .app-swal-cancel-button:hover { background: #e1e6dc !important; transform: translateY(-1px); }
      @media (prefers-reduced-motion: reduce) { .app-swal-confirm-button, .app-swal-cancel-button { transition: none !important; } }
    `;
    document.head.appendChild(style);

    if (!window.Swal || window.Swal.__globalToastFix) return;
    const fireOriginal = window.Swal.fire.bind(window.Swal);
    window.Swal.fire = function (options, ...rest) {
      if (options && typeof options === 'object') {
        const classObject = typeof options.customClass === 'string'
          ? { popup: options.customClass }
          : { ...(options.customClass || {}) };
        const agregarClase = (existente, nueva) => [...new Set(
          `${Array.isArray(existente) ? existente.join(' ') : existente || ''} ${nueva}`.trim().split(/\s+/)
        )].join(' ');
        if (options.toast) {
          classObject.container = agregarClase(classObject.container, 'global-toast-container');
          classObject.popup = agregarClase(classObject.popup, 'cl-toast');
          return fireOriginal({ ...options, showCloseButton: false, backdrop: false, customClass: classObject }, ...rest);
        }
        classObject.container = agregarClase(classObject.container, 'app-swal-container');
        classObject.popup = agregarClase(classObject.popup, 'app-swal-popup');
        classObject.confirmButton = agregarClase(classObject.confirmButton, 'app-swal-confirm-button');
        if (options.showCancelButton) {
          classObject.cancelButton = agregarClase(classObject.cancelButton, 'app-swal-cancel-button');
        }
        return fireOriginal({ ...options, buttonsStyling: false, customClass: classObject }, ...rest);
      }
      return fireOriginal(options, ...rest);
    };
    window.Swal.__globalToastFix = true;
  }

  /* ---------- Observación del DOM (reciclaje continuo) ---------- */

  function procesarPendientes() {
    temporizador = null;
    const raices = [...pendientes];
    pendientes.clear();
    /* Si un nodo ya está dentro de otra raíz pendiente, se revisa una sola
       vez: evita trabajo repetido y listas que crecen sin control. */
    const utiles = raices.filter(raiz =>
      raiz !== document &&
      raiz.isConnected &&
      !raices.some(otra => otra !== raiz && otra !== document && otra.contains(raiz))
    );
    utiles.forEach(raiz => {
      aplicarReglasPagina(raiz);
      aplicarColores(raiz);
    });
  }

  function programarRevision(raiz) {
    if (!raiz) return;
    pendientes.add(raiz);
    if (temporizador) return;
    temporizador = setTimeout(procesarPendientes, 60);
  }

  function observar() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(mutaciones => {
      mutaciones.forEach(mutacion => {
        mutacion.addedNodes.forEach(nodo => {
          if (nodo.nodeType === Node.ELEMENT_NODE) programarRevision(nodo);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Ciclo de vida ---------- */

  async function cargarPermisos() {
    try {
      if (window.api?.permisos) {
        const [mapa, miRol] = await Promise.all([
          window.api.permisos.mios(),
          window.api.permisos.miRol()
        ]);
        permisos = mapa || {};
        rol = miRol?.codigo || null;
      }
    } catch (err) {
      console.error('[PermisosUI] No se pudieron cargar permisos:', err);
      permisos = {};
      rol = null;
    }
  }

  async function arrancar() {
    await cargarPermisos();
    aplicarReglasPagina();
    montarMenu();
    observar();
    await refrescarColores();
  }

  function init() {
    if (!iniciando) iniciando = arrancar();
    return iniciando;
  }

  /**
   * Vuelve a leer permisos y recicla todo: reglas, inferencia, menú y colores.
   * Úsalo cuando cambien los permisos del rol en sesión.
   */
  async function refrescar(opciones = {}) {
    await cargarPermisos();
    if (opciones.menu !== false) {
      document.querySelector('.app-sidebar')?.remove();
      montarMenu();
    }
    document.querySelectorAll('[data-permiso-auto]').forEach(el => {
      /* Primero devolvemos el control a su estado natural: si estaba
         oculto por permisos y la regla desapareció, no debe quedarse
         escondido (sería basura del filtro anterior). */
      restaurarNatural(el);
      delete el.dataset.permisoAuto;
      el.removeAttribute('data-permiso');
    });
    aplicarReglasPagina();
    if (opciones.colores !== false) await refrescarColores();
    return true;
  }

  function mostrarError(texto) {
    if (window.Swal) {
      window.Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'error',
        title: texto,
        showConfirmButton: false,
        timer: 3400,
        timerProgressBar: true,
        customClass: { popup: 'cl-toast cl-toast-error' }
      });
      return;
    }
    const aviso = document.createElement('div');
    aviso.className = 'app-toast-error';
    aviso.textContent = texto;
    document.body.appendChild(aviso);
    setTimeout(() => aviso.remove(), 3500);
  }

  window.PermisosUI = {
    init,
    aplicar: aplicarReglasPagina,
    aplicarColores,
    refrescar,
    refrescarColores,
    puede,
    accionDe: accionDeElemento,
    permisoDe: el => el?.dataset?.permiso || null,
    colorCliente: codigo => coloresClientes.get(String(codigo || '').trim().toUpperCase()) || null,
    colorRol: codigo => coloresRoles.get(String(codigo || '').trim().toUpperCase()) || null,
    puedoRemoto: async clave => {
      const resultado = await window.api.permisos.puedo(clave);
      return !!(resultado && resultado.ok && resultado.permitido);
    },
    get rol() { return rol; },
    get mapa() { return { ...permisos }; }
  };

  instalarToastSinBlurNiCerrar();
  init();
})();
