/* =========================================================
   ACTIVO FIJO — CONSULTAS DE REPORTES (consolidadas)
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');
const path = require('path');
const os   = require('os');
const fs   = require('fs');
const { dialog } = require('electron');
const XLSX = require('xlsx');

/* =========================================================
   KPIs GENERALES
   ========================================================= */
async function resumenGeneral() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT
            (SELECT COUNT(*) FROM ActivoFijoEquipos) AS TotalActivos,
            (SELECT COALESCE(SUM(PrecioActivo), 0) FROM ActivoFijoEquipos) AS ValorTotal,
            (SELECT COUNT(*) FROM ActivoFijoEquipos af
                INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE st.Nombre = 'STOCK') AS EnStock,
            (SELECT COUNT(*) FROM ActivoFijoEquipos af
                INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE st.Nombre = 'DISPONIBLE') AS Disponibles,
            (SELECT COUNT(*) FROM ActivoFijoEquipos af
                INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE st.Nombre = 'ASIGNADO') AS Asignados,
            (SELECT COUNT(*) FROM ActivoFijoEquipos af
                INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE st.Nombre = 'PENDIENTE') AS Pendientes,
            (SELECT COUNT(*) FROM ActivoFijoEquipos af
                INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE st.Nombre = 'BAJA') AS Bajas,
            (SELECT COUNT(*) FROM ActivoFijoResponsivas
                WHERE EstatusResponsiva = 'ASIGNADO') AS ResponsivasActivas
    `);
    return result.recordset[0];
}

/* =========================================================
   CONSULTA UNIFICADA POR VISTA
   ========================================================= */
async function obtenerReporte(vista, filtros = {}) {
    switch (vista) {
        case 'resumen-tipo':    return resumenPorTipo();
        case 'resumen-cartera': return resumenPorCartera();
        case 'inventario':      return inventario(filtros);
        case 'responsivas':     return responsivasActivas();
        case 'personas':        return asignacionesPorPersona();
        case 'tickets':         return porTicket();
        case 'celulares':       return celulares();
        case 'laptops':         return laptops();
        default: throw new Error(`Vista desconocida: ${vista}`);
    }
}

/* =========================================================
   VISTAS
   ========================================================= */
async function resumenPorTipo() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT Tipo, TotalEquipos, EnStock, Disponibles, Asignados, Pendientes, Bajas, ValorTotalInventario
        FROM vw_ActivoFijoPorTipo
        WHERE TotalEquipos > 0
        ORDER BY TotalEquipos DESC
    `);
    return r.recordset;
}

async function resumenPorCartera() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT Cartera, TotalEquipos, ValorStock, ValorAsignado, ValorBaja, ValorTotal
        FROM vw_ActivoFijoValorPorCartera
        WHERE TotalEquipos > 0
        ORDER BY ValorTotal DESC
    `);
    return r.recordset;
}

async function inventario(filtros = {}) {
    const pool = await getPool();
    const request = pool.request();
    let where = '1=1';
    if (filtros.tipo)    { where += ' AND Tipo = @Tipo';       request.input('Tipo',    sql.NVarChar(100), filtros.tipo); }
    if (filtros.estado)  { where += ' AND Estado = @Estado';   request.input('Estado',  sql.NVarChar(50),  filtros.estado); }
    if (filtros.estatus) { where += ' AND Estatus = @Estatus'; request.input('Estatus', sql.NVarChar(50),  filtros.estatus); }
    if (filtros.cartera) { where += ' AND Cartera = @Cartera'; request.input('Cartera', sql.NVarChar(100), filtros.cartera); }

    const r = await request.query(`
        SELECT IdActivoFijoEQ, Cartera, NoSerie, IMEI1, IMEI2, NoTelefono,
               Marca, Modelo, Tipo, Estado, Estatus, PrecioActivo,
               Procesador, MemoriaRAM, Almacenamiento, SistemaOperativo,
               Observaciones, FechaCreacion
        FROM vw_ActivoFijoInventario
        WHERE ${where}
        ORDER BY Tipo, Marca, Modelo
    `);
    return r.recordset;
}

async function responsivasActivas() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT IdResponsiva, FolioTicket, TipoResponsiva, FechaAsignacion,
               FechaDevolucionProgramada, EstatusResponsiva,
               NombreRecibe, PuestoRecibe, AreaRecibe, CorreoRecibe, Cartera,
               NoSerie, IMEI1, IMEI2, NoTelefono, Marca, Modelo, Tipo, PrecioActivo
        FROM vw_ActivoFijoResponsivasActivas
        ORDER BY FechaAsignacion DESC
    `);
    return r.recordset;
}

async function asignacionesPorPersona() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT Persona, Area, Puesto, Correo, TotalAsignaciones, ValorTotalAsignado
        FROM vw_ActivoFijoAsignacionesPorPersona
        ORDER BY TotalAsignaciones DESC, Persona
    `);
    return r.recordset;
}

async function porTicket() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT FolioTicket, TotalActivos, Personas, ValorTotalTicket, FechaAsignacion
        FROM vw_ActivoFijoPorTicket
        ORDER BY FechaAsignacion DESC
    `);
    return r.recordset;
}

async function celulares() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT IdActivoFijoEQ, NoSerie, IMEI1, IMEI2, NoTelefono,
               Marca, Modelo, PrecioActivo, Estatus,
               FolioTicket, NombreRecibe, PuestoRecibe, AreaRecibe, CorreoRecibe,
               Cartera, FechaAsignacion, EstatusResponsiva
        FROM vw_ActivoFijoCelulares
        ORDER BY Marca, Modelo
    `);
    return r.recordset;
}

async function laptops() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT IdActivoFijoEQ, NoSerie, Marca, Modelo,
               Procesador, MemoriaRAM, Almacenamiento, PrecioActivo, Estatus,
               FolioTicket, NombreRecibe, PuestoRecibe, AreaRecibe, CorreoRecibe,
               Cartera, FechaAsignacion, EstatusResponsiva
        FROM vw_ActivoFijoLaptops
        ORDER BY Marca, Modelo
    `);
    return r.recordset;
}

/* =========================================================
   CATÁLOGOS PARA FILTROS
   ========================================================= */
async function tiposParaFiltro() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdTipo, Nombre FROM ActivoFijoTipos WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function estadosParaFiltro() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdEstado, Nombre FROM ActivoFijoEstados WHERE Activo = 1 ORDER BY IdEstado'
    );
    return r.recordset;
}

async function estatusParaFiltro() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdEstatus, Nombre FROM ActivoFijoEstatus WHERE Activo = 1 ORDER BY IdEstatus'
    );
    return r.recordset;
}

async function carterasParaFiltro() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdCartera, Nombre FROM ActivoFijoCarteras WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

/* =========================================================
   EXPORTAR A EXCEL
   payload = { vista, titulo, columnas: [{key, etiqueta, tipo}], filas: [{etiqueta: valor}] }
   ========================================================= */
async function exportarExcel(payload) {
    const { titulo, columnas, filas } = payload || {};

    if (!Array.isArray(filas) || filas.length === 0) {
        return { ok: false, mensaje: 'Sin datos para exportar.' };
    }
    if (!Array.isArray(columnas) || columnas.length === 0) {
        return { ok: false, mensaje: 'No se especificaron columnas.' };
    }

    // Nombre sugerido
    const safeTitulo = String(titulo || 'Reporte').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Reporte';
    const fecha      = new Date().toISOString().slice(0, 10);

    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const baseDir      = fs.existsSync(downloadsDir) ? downloadsDir : os.homedir();
    const defaultPath  = path.join(baseDir, `${safeTitulo}_${fecha}.xlsx`);

    // Pedir ubicación al usuario
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar reporte en Excel',
        defaultPath,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

    // Construir hoja
    const encabezados = columnas.map(c => c.etiqueta);
    const datos = filas.map(f => columnas.map(c => {
        const v = f[c.etiqueta];
        return (v === null || v === undefined) ? '' : v;
    }));

    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...datos]);

    // Anchos automáticos de columna
    ws['!cols'] = encabezados.map((_, i) => {
        const valores = [encabezados[i], ...datos.map(fila => fila[i])];
        const max = Math.max(...valores.map(v => String(v ?? '').length));
        return { wch: Math.min(Math.max(max + 2, 10), 45) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, safeTitulo.substring(0, 30) || 'Reporte');

    try {
        XLSX.writeFile(wb, filePath);
    } catch (err) {
        console.error('[Reportes] Error escribiendo XLSX:', err);
        return { ok: false, mensaje: 'No se pudo escribir el archivo: ' + err.message };
    }

    return { ok: true, ruta: filePath };
}

module.exports = {
    resumenGeneral,
    obtenerReporte,
    exportarExcel,
    tiposParaFiltro,
    estadosParaFiltro,
    estatusParaFiltro,
    carterasParaFiltro
};