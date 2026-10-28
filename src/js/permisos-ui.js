/* =========================================================
   PERMISOS UI — helper compartido para todos los renderers
   ---------------------------------------------------------
   Uso:
     1) En el HTML de cada ventana, incluir este script UNA vez:
        <script src="../renderer/permisos-ui.js"></script>

     2) Marcar los controles a ocultar con data-permiso:
        <button data-permiso="equipos:crear">Nuevo equipo</button>
        <th data-permiso="equipos:columna:ip">IP</th>
        <input data-permiso="clientes:campo:credito">

     3) Al cargar la ventana (después de inyectar HTML dinámico):
        await PermisosUI.init();
        // o si insertas HTML nuevo después:
        PermisosUI.aplicar();
   ========================================================= */

(function () {
  let _permisos = {};
  let _rol = null;

  /** Carga los permisos del usuario actual desde el main process. */
  async function init() {
    try {
      const [mios, miRol] = await Promise.all([
        window.api.permisos.mios(),
        window.api.permisos.miRol()
      ]);
      _permisos = mios || {};
      _rol = miRol || null;
      aplicar();
    } catch (err) {
      console.warn('[PermisosUI] No se pudieron cargar los permisos:', err);
    }
  }

  /** ¿El usuario actual tiene el permiso dado? (ADMIN = todo) */
  function puede(clave) {
    if (_rol && _rol.codigo === 'ADMIN') return true;
    return _permisos[clave] === true;
  }

  /** Aplica data-permiso a todo el DOM (o a un sub-árbol). */
  function aplicar(root = document) {
    root.querySelectorAll('[data-permiso]').forEach(el => {
      const clave = el.dataset.permiso;
      const ok = puede(clave);
      // display: none respeta el layout; usar 'hidden' si prefieres el atributo
      el.style.display = ok ? '' : 'none';
      // también marcamos como disabled por si el display no basta (inputs)
      if ('disabled' in el && !ok) el.disabled = true;
    });
  }

  /** Atajo por si quieres preguntarle al main (no usa caché). */
  async function puedoRemoto(clave) {
    const res = await window.api.permisos.puedo(clave);
    return !!(res && res.ok && res.permitido);
  }

  window.PermisosUI = {
    init,
    aplicar,
    puede,
    puedoRemoto,
    get rol() { return _rol; },
    get mapa() { return { ..._permisos }; }
  };
})();