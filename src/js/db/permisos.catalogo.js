/* =========================================================
   CATÁLOGO DE PERMISOS
   ---------------------------------------------------------
   Convención de claves:  modulo:recurso:accion
     - 'ventas'                  → acceso al módulo (menú)
     - 'ventas:listado:ver'      → ver tabla/listado
     - 'ventas:columna:total'    → ver columna específica
     - 'ventas:crear'            → acción concreta (botón)
     - 'clientes:campo:credito'  → campo sensible de formulario
   ========================================================= */

const CATALOGO = {
  /* ---------- MÓDULOS (menú / ventanas) ---------- */
  'catalogos':                     { grupo: 'Catálogos',    etiqueta: 'Acceso al módulo' },
  'equipos':                       { grupo: 'Equipos',      etiqueta: 'Acceso al módulo' },
  'plano':                         { grupo: 'Plano',        etiqueta: 'Acceso al módulo' },
  'usuarios':                      { grupo: 'Usuarios',     etiqueta: 'Acceso al módulo' },
  'historico':                     { grupo: 'Histórico',    etiqueta: 'Acceso al módulo' },

  'activofijo_catalogos':          { grupo: 'Activo Fijo',  etiqueta: 'Catálogos' },
  'activofijo_activos':            { grupo: 'Activo Fijo',  etiqueta: 'Inventario' },
  'activofijo_responsivas':        { grupo: 'Activo Fijo',  etiqueta: 'Responsivas' },
  'activofijo_reportes':           { grupo: 'Activo Fijo',  etiqueta: 'Reportes' },
  'activofijo_importar':           { grupo: 'Activo Fijo',  etiqueta: 'Importación masiva' },

  /* ---------- CATÁLOGOS: acciones finas ---------- */
  'catalogos:clientes:crear':      { grupo: 'Catálogos',    etiqueta: 'Crear cliente' },
  'catalogos:clientes:editar':     { grupo: 'Catálogos',    etiqueta: 'Editar cliente' },
  'catalogos:clientes:eliminar':   { grupo: 'Catálogos',    etiqueta: 'Eliminar cliente' },
  'catalogos:pisos:crear':         { grupo: 'Catálogos',    etiqueta: 'Crear piso' },
  'catalogos:pisos:editar':        { grupo: 'Catálogos',    etiqueta: 'Editar piso' },
  'catalogos:pisos:eliminar':      { grupo: 'Catálogos',    etiqueta: 'Eliminar piso' },
  'catalogos:rangos:crear':        { grupo: 'Catálogos',    etiqueta: 'Crear rango IP' },
  'catalogos:rangos:editar':       { grupo: 'Catálogos',    etiqueta: 'Editar rango IP' },
  'catalogos:rangos:eliminar':     { grupo: 'Catálogos',    etiqueta: 'Eliminar rango IP' },
  'catalogos:dominios:gestionar':  { grupo: 'Catálogos',    etiqueta: 'Gestionar dominios' },
  'catalogos:config:gestionar':    { grupo: 'Catálogos',    etiqueta: 'Gestionar config. de red' },

  /* ---------- EQUIPOS ---------- */
  'equipos:listado:ver':           { grupo: 'Equipos',      etiqueta: 'Ver tabla de equipos' },
  'equipos:listado:exportar':      { grupo: 'Equipos',      etiqueta: 'Exportar equipos' },
  'equipos:crear':                 { grupo: 'Equipos',      etiqueta: 'Crear equipo' },
  'equipos:editar':                { grupo: 'Equipos',      etiqueta: 'Editar equipo' },
  'equipos:eliminar':              { grupo: 'Equipos',      etiqueta: 'Eliminar equipo' },

  /* ---------- PLANO ---------- */
  'plano:ver':                     { grupo: 'Plano',        etiqueta: 'Ver plano' },
  'plano:editar-dim':              { grupo: 'Plano',        etiqueta: 'Cambiar dimensiones' },
  'plano:asignar':                 { grupo: 'Plano',        etiqueta: 'Asignar equipo a celda' },
  'plano:mover':                   { grupo: 'Plano',        etiqueta: 'Mover equipo' },
  'plano:quitar':                  { grupo: 'Plano',        etiqueta: 'Quitar equipo' },
  'plano:intercambiar':            { grupo: 'Plano',        etiqueta: 'Intercambiar equipos' },
  'plano:zonas:gestionar':         { grupo: 'Plano',        etiqueta: 'Crear/editar zonas' },
  'plano:zonas:eliminar':          { grupo: 'Plano',        etiqueta: 'Eliminar zonas' },
  'plano:exportar':                { grupo: 'Plano',        etiqueta: 'Exportar PDF' },

  /* ---------- USUARIOS ---------- */
  'usuarios:listado:ver':          { grupo: 'Usuarios',     etiqueta: 'Ver tabla de usuarios' },
  'usuarios:crear':                { grupo: 'Usuarios',     etiqueta: 'Crear usuario' },
  'usuarios:editar':               { grupo: 'Usuarios',     etiqueta: 'Editar usuario' },
  'usuarios:eliminar':             { grupo: 'Usuarios',     etiqueta: 'Desactivar usuario' },
  'usuarios:asignar-rol':          { grupo: 'Usuarios',     etiqueta: 'Asignar rol' },

  /* ---------- ACTIVO FIJO: catálogos ---------- */
  'af-cat:listado:ver':            { grupo: 'Activo Fijo',  etiqueta: 'Ver catálogos AF' },
  'af-cat:crear':                  { grupo: 'Activo Fijo',  etiqueta: 'Crear registro catálogo' },
  'af-cat:editar':                 { grupo: 'Activo Fijo',  etiqueta: 'Editar registro catálogo' },
  'af-cat:eliminar':               { grupo: 'Activo Fijo',  etiqueta: 'Eliminar registro catálogo' },
  'af-cat:restaurar':              { grupo: 'Activo Fijo',  etiqueta: 'Restaurar registro catálogo' },

  /* ---------- ACTIVO FIJO: activos ---------- */
  'af-act:listado:ver':            { grupo: 'Activo Fijo',  etiqueta: 'Ver inventario AF' },
  'af-act:crear':                  { grupo: 'Activo Fijo',  etiqueta: 'Crear activo' },
  'af-act:editar':                 { grupo: 'Activo Fijo',  etiqueta: 'Editar activo' },
  'af-act:eliminar':               { grupo: 'Activo Fijo',  etiqueta: 'Eliminar activo' },
  'af-act:restaurar':              { grupo: 'Activo Fijo',  etiqueta: 'Restaurar activo' },

  /* ---------- ACTIVO FIJO: responsivas ---------- */
  'af-resp:listado:ver':           { grupo: 'Activo Fijo',  etiqueta: 'Ver responsivas' },
  'af-resp:crear':                 { grupo: 'Activo Fijo',  etiqueta: 'Crear responsiva' },
  'af-resp:editar':                { grupo: 'Activo Fijo',  etiqueta: 'Editar responsiva' },
  'af-resp:devolver':              { grupo: 'Activo Fijo',  etiqueta: 'Registrar devolución' },
  'af-resp:eliminar':              { grupo: 'Activo Fijo',  etiqueta: 'Eliminar responsiva' },
  'af-resp:pdf':                   { grupo: 'Activo Fijo',  etiqueta: 'Generar PDF' },

  /* ---------- ACTIVO FIJO: reportes / importación ---------- */
  'af-rep:ver':                    { grupo: 'Activo Fijo',  etiqueta: 'Ver reportes' },
  'af-rep:exportar':               { grupo: 'Activo Fijo',  etiqueta: 'Exportar reportes' },
  'af-imp:ejecutar':               { grupo: 'Activo Fijo',  etiqueta: 'Ejecutar importación' }
};

const CLAVES = Object.keys(CATALOGO);

function esPermisoValido(clave) {
  return Object.prototype.hasOwnProperty.call(CATALOGO, clave);
}

/**
 * Catálogo agrupado para pintar la matriz en la UI de roles.
 * [{ grupo, items: [{ clave, etiqueta }] }, ...]
 */
function catalogoAgrupado() {
  const grupos = new Map();
  for (const [clave, meta] of Object.entries(CATALOGO)) {
    if (!grupos.has(meta.grupo)) grupos.set(meta.grupo, []);
    grupos.get(meta.grupo).push({ clave, etiqueta: meta.etiqueta });
  }
  return [...grupos.entries()].map(([grupo, items]) => ({ grupo, items }));
}

module.exports = { CATALOGO, CLAVES, esPermisoValido, catalogoAgrupado };