(function () {
  const SECCIONES = [
    {
      label: 'Pisos',
      modulos: [
        { key: 'catalogos', label: 'Catálogos', permiso: 'catalogos', icon: '▦' },
        { key: 'equipos', label: 'Equipos', permiso: 'equipos', icon: '▣' },
        { key: 'plano', label: 'Plano visual', permiso: 'plano', icon: '▤' },
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

  const REGLAS_PAGINA = {
    'catalogos.html': {
      '#cli-btn-nuevo': 'catalogos:clientes:crear',
      '#cli-guardar': 'catalogos:clientes:crear|catalogos:clientes:editar',
      '#pis-btn-nuevo': 'catalogos:pisos:crear',
      '#pis-guardar': 'catalogos:pisos:crear|catalogos:pisos:editar',
      '#rol-btn-nuevo': 'catalogos',
      '#rol-guardar': 'catalogos',
      '#dom-btn-nuevo': 'catalogos:dominios:gestionar',
      '#cfg-btn-nuevo': 'catalogos:config:gestionar',
      '#cli-tabla button.secundario': 'catalogos:clientes:editar',
      '#cli-tabla button.peligro': 'catalogos:clientes:eliminar',
      '#pis-contenedor-grupos button.secundario': 'catalogos:pisos:editar',
      '#pis-contenedor-grupos button.peligro': 'catalogos:pisos:eliminar',
      '#rol-tabla button.secundario': 'catalogos',
      '#rol-tabla button.peligro': 'catalogos',
      '#dom-tabla button.secundario': 'catalogos:dominios:gestionar',
      '#dom-tabla button.peligro': 'catalogos:dominios:gestionar',
      '#cfg-contenedor-grupos button.secundario': 'catalogos:config:gestionar',
      '#cfg-contenedor-grupos button.peligro': 'catalogos:config:gestionar',
      '.tab-btn[data-tab="dominios"]': 'catalogos:dominios:gestionar',
      '.tab-btn[data-tab="config"]': 'catalogos:config:gestionar',
      '.tab-btn[data-tab="roles"]': 'catalogos',
      '.tab-btn[data-tab="pisos"]': 'catalogos'
    },
    'equipos.html': {
      '#btn-nuevo': 'equipos:crear',
      '#btn-guardar': 'equipos:crear|equipos:editar',
      '#btn-exportar-excel': 'equipos:listado:exportar',
      '#btn-nuevo-dominio': 'catalogos:dominios:gestionar',
      '.btn-agregar-mini[data-tipo]': 'catalogos:config:gestionar',
      '#btn-ips-disponibles': 'equipos:listado:ver',
      '.btn-usar-ip': 'equipos:listado:ver',
      '#contenedor-grupos': 'equipos:listado:ver',
      '.data-table button.secundario': 'equipos:editar',
      '.data-table button.peligro': 'equipos:eliminar'
    },
    'plano.html': {
      '#contenedor-principal': 'plano:ver',
      '#btn-exportar-pdf-doc': 'plano:exportar',
      '#btn-aplicar-dim-izq': 'plano:editar-dim',
      '#btn-aplicar-dim-der': 'plano:editar-dim',
      '#btn-modo-zona': 'plano:zonas:gestionar',
      '#btn-modo-zona-libre': 'plano:zonas:gestionar',
      '#modal-zona-aceptar': 'plano:zonas:gestionar',
      '#modal-zona-libre-aceptar': 'plano:zonas:gestionar',
      '#editar-confirmar': 'equipos:editar',
      '.btn-editar-equipo': 'equipos:editar'
    },
    'clientes.html': {
      '#btn-nuevo': 'catalogos:clientes:crear',
      '#btn-guardar': 'catalogos:clientes:crear|catalogos:clientes:editar',
      '#tabla-clientes button.secundario': 'catalogos:clientes:editar',
      '#tabla-clientes button.peligro': 'catalogos:clientes:eliminar'
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
    'roles.html': {
      '#btn-nuevo': 'catalogos',
      '#btn-guardar': 'catalogos',
      '#tabla-roles button.secundario': 'catalogos',
      '#tabla-roles button.peligro': 'catalogos'
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
    'lugares.html': {
      '#btn-nuevo': 'catalogos',
      'table button.secundario': 'catalogos',
      'table button.peligro': 'catalogos'
    },
    'mantenimientos.html': {
      '#btn-nuevo': 'mantenimientos:crear',
      '#btn-guardar': 'mantenimientos:crear',
      '#btn-exportar-excel': 'mantenimientos',
      '#btn-ver-historial': 'mantenimientos'
    },
    'historico.html': {
      '.main-content': 'historico'
    },
  };

  let permisos = {};
  let rol = null;
  let observer = null;
  const coloresClientes = new Map();
  const coloresRoles = new Map();

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

  function aplicarReglasPagina(root = document) {
    const reglasAF = {
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
      'importar.html': { '#btn-importar': 'af-imp:ejecutar', '#btn-descargar-plantilla': 'af-imp:ejecutar' }
    };
    const pagina = obtenerPagina();
    const reglas = esActivoFijo() ? (reglasAF[pagina] || {}) : (REGLAS_PAGINA[pagina] || {});
    for (const [selector, permiso] of Object.entries(reglas)) {
      const elementos = [...root.querySelectorAll(selector)];
      if (root.matches?.(selector)) elementos.unshift(root);
      elementos.forEach(el => {
        if (!el.hasAttribute('data-permiso')) el.setAttribute('data-permiso', permiso);
      });
    }

    const paginaAF = esActivoFijo();
    const acciones = {
      editar: {
        'equipos.html': 'equipos:editar', 'usuarios.html': 'usuarios:editar',
        'clientes.html': 'catalogos:clientes:editar', 'catalogos.html': 'catalogos:clientes:editar',
        'roles.html': 'catalogos', 'activos.html': 'af-act:editar', 'responsivas.html': 'af-resp:editar'
      },
      eliminar: {
        'equipos.html': 'equipos:eliminar', 'usuarios.html': 'usuarios:eliminar',
        'clientes.html': 'catalogos:clientes:eliminar', 'catalogos.html': 'catalogos:clientes:eliminar',
        'roles.html': 'catalogos',
        'activos.html': 'af-act:eliminar', 'responsivas.html': 'af-resp:eliminar'
      },
      restaurar: { 'activos.html': 'af-act:restaurar', 'catalogos.html': 'af-cat:restaurar' },
      devolver: { 'responsivas.html': 'af-resp:devolver' },
      exito: { 'responsivas.html': 'af-resp:devolver' },
      guardar: { 'responsivas.html': 'af-resp:pdf' },
      ver: { 'responsivas.html': 'af-resp:pdf', 'activos.html': 'af-act:listado:ver' },
      historial: { 'activos.html': 'af-act:listado:ver' }
    };
    for (const accion of Object.keys(acciones)) {
      const elementos = [...root.querySelectorAll(`.btn-accion.${accion}, button.${accion}, [data-accion="${accion}"]`)];
      if (root.matches?.(`.btn-accion.${accion}, button.${accion}, [data-accion="${accion}"]`)) elementos.unshift(root);
      elementos.forEach(el => {
        const permiso = paginaAF && pagina === 'catalogos.html'
          ? (accion === 'restaurar' ? 'af-cat:restaurar' : `af-cat:${accion}`)
          : acciones[accion][pagina];
        if (!el.hasAttribute('data-permiso') && permiso) {
          el.setAttribute('data-permiso', permiso);
        }
      });
    }
    aplicar(root);
  }

  function aplicar(root = document) {
    const elementos = [];
    if (root.matches?.('[data-permiso]')) elementos.push(root);
    elementos.push(...root.querySelectorAll('[data-permiso]'));
    elementos.forEach(el => {
      const permitido = puede(el.dataset.permiso);
      el.hidden = !permitido;
      el.classList.toggle('permiso-ui-oculto', !permitido);
      if ('disabled' in el) el.disabled = !permitido;
      el.setAttribute('aria-hidden', permitido ? 'false' : 'true');
    });
  }

  function contraste(hex) {
    const canales = hex.slice(1).match(/.{2}/g).map(canal => parseInt(canal, 16) / 255)
      .map(canal => canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4);
    return canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722 > 0.42 ? '#20271f' : '#ffffff';
  }

  function aplicarColores(root = document) {
    const elementos = [];
    if (root.matches?.('[data-color], [data-rol]')) elementos.push(root);
    elementos.push(...root.querySelectorAll('[data-color], [data-rol]'));
    elementos.forEach(el => {
      const codigo = String(el.dataset.color || el.dataset.rol || '').trim().toUpperCase();
      if (!codigo || codigo === 'BOTON') return;
      const esCliente = el.matches('.badge-cliente, .badge-cli') ||
        el.dataset.colorKind === 'client' ||
        (obtenerPagina() === 'clientes.html' && el.matches('.badge-codigo'));
      const esRol = el.matches('.rol-pill, .hostname-badge') ||
        el.matches('.badge-equipo') ||
        el.hasAttribute('data-rol') ||
        el.dataset.colorKind === 'role' ||
        ((obtenerPagina() === 'roles.html' || obtenerPagina() === 'catalogos.html') &&
          el.matches('.badge-codigo'));
      const color = esCliente ? coloresClientes.get(codigo) : esRol ? coloresRoles.get(codigo) : null;
      if (!color || !/^#[0-9A-F]{6}$/i.test(color)) return;
      const esCeldaEquipo = el.matches('.celda[data-rol]');
      let fondo = color;
      if (esCeldaEquipo) {
        const partes = color.slice(1).match(/.{2}/g).map(canal => parseInt(canal, 16));
        fondo = `#${partes.map(canal => Math.round(canal + (255 - canal) * .78).toString(16).padStart(2, '0')).join('')}`;
      }
      el.style.setProperty('background-color', fondo, 'important');
      el.style.setProperty('border-color', color, 'important');
      el.style.setProperty('color', esCeldaEquipo ? '#20271f' : contraste(color), 'important');
    });
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

  function montarMenu() {
    if (obtenerPagina() === 'login.html' || document.querySelector('.app-sidebar')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = esActivoFijo() ? '../../css/app-shell.css' : '../css/app-shell.css';
    document.head.appendChild(link);
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
      const collapsed = document.body.classList.contains('app-sidebar-collapsed');
      localStorage.setItem('app-sidebar-collapsed', String(collapsed));
      aside.querySelector('.app-sidebar-toggle').textContent = collapsed ? '›' : '‹';
      aside.querySelector('.app-sidebar-toggle').setAttribute('aria-label', collapsed ? 'Expandir menú' : 'Contraer menú');
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

  async function init() {
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

    aplicarReglasPagina();
    montarMenu();
    if (observer) observer.disconnect();
    observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => [...mutation.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE))) {
        aplicarReglasPagina();
        aplicarColores();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    await refrescarColores();
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
    refrescarColores,
    puede,
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
