/* =========================================================
   ACTIVO FIJO — CONSULTAS DE REPORTES
   Todas las consultas usan las vistas predefinidas.
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   KPIs GENERALES (para las tarjetas de resumen)
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
            (SELECT COUNT(*) FROM ActivoFijoEquipos af
                INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE st.Nombre = 'ROBADO') AS Robados,
            (SELECT COUNT(*) FROM ActivoFijoResponsivas
                WHERE EstatusResponsiva = 'ASIGNADO') AS ResponsivasActivas,
            (SELECT COUNT(*) FROM ActivoFijoCarteras WHERE Activo = 1) AS TotalCarteras,
            (SELECT COUNT(*) FROM ActivoFijoMarcas WHERE Activo = 1)   AS TotalMarcas,
            (SELECT COUNT(*) FROM ActivoFijoTipos WHERE Activo = 1)    AS TotalTipos
    `);

    return result.recordset[0];
}

/* =========================================================
   RESUMEN POR TIPO
   ========================================================= */
async function resumenPorTipo() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            Tipo,
            TotalEquipos,
            EnStock,
            Disponibles,
            Asignados,
            Pendientes,
            Robados,
            Bajas,
            ValorTotalInventario
        FROM vw_ActivoFijoPorTipo
        WHERE TotalEquipos > 0
        ORDER BY TotalEquipos DESC
    `);
    return r.recordset;
}

/* =========================================================
   RESUMEN POR CARTERA
   ========================================================= */
async function resumenPorCartera() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            Cartera,
            TotalEquipos,
            ValorStock,
            ValorAsignado,
            ValorBaja,
            ValorTotal
        FROM vw_ActivoFijoValorPorCartera
        WHERE TotalEquipos > 0
        ORDER BY ValorTotal DESC
    `);
    return r.recordset;
}

/* =========================================================
   INVENTARIO COMPLETO (con filtros opcionales)
   ========================================================= */
async function inventario(filtros = {}) {
    const pool = await getPool();
    const request = pool.request();

    let where = '1=1';
    if (filtros.tipo)    { where += ' AND Tipo = @Tipo';       request.input('Tipo',    sql.NVarChar(100), filtros.tipo); }
    if (filtros.estado)  { where += ' AND Estado = @Estado';   request.input('Estado',  sql.NVarChar(50),  filtros.estado); }
    if (filtros.estatus) { where += ' AND Estatus = @Estatus'; request.input('Estatus', sql.NVarChar(50),  filtros.estatus); }
    if (filtros.cartera) { where += ' AND Cartera = @Cartera'; request.input('Cartera', sql.NVarChar(100), filtros.cartera); }

    const r = await request.query(`
        SELECT
            IdActivoFijoEQ, Cartera, NoSerie, IMEI1, IMEI2, NoTelefono,
            Marca, Modelo, Tipo, Estado, Estatus, PrecioActivo,
            Procesador, MemoriaRAM, Almacenamiento, SistemaOperativo,
            Observaciones, FechaCreacion
        FROM vw_ActivoFijoInventario
        WHERE ${where}
        ORDER BY Tipo, Marca, Modelo
    `);
    return r.recordset;
}

/* =========================================================
   RESPONSIVAS ACTIVAS
   ========================================================= */
async function responsivasActivas() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            IdResponsiva, FolioTicket, TipoResponsiva,
            FechaAsignacion, FechaDevolucionProgramada, EstatusResponsiva,
            NombreRecibe, PuestoRecibe, AreaRecibe, CorreoRecibe, Cartera,
            NoSerie, IMEI1, IMEI2, NoTelefono, Marca, Modelo, Tipo, PrecioActivo
        FROM vw_ActivoFijoResponsivasActivas
        ORDER BY FechaAsignacion DESC
    `);
    return r.recordset;
}

/* =========================================================
   ASIGNACIONES POR PERSONA
   ========================================================= */
async function asignacionesPorPersona() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            Persona, Area, Puesto, Correo,
            TotalAsignaciones, ValorTotalAsignado
        FROM vw_ActivoFijoAsignacionesPorPersona
        ORDER BY TotalAsignaciones DESC, Persona
    `);
    return r.recordset;
}

/* =========================================================
   POR TICKET (contador de activos por folio)
   ========================================================= */
async function porTicket() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            FolioTicket, TotalActivos, Personas,
            ValorTotalTicket, FechaAsignacion
        FROM vw_ActivoFijoPorTicket
        ORDER BY FechaAsignacion DESC
    `);
    return r.recordset;
}

/* =========================================================
   HISTORIAL DE ASIGNACIONES (con filtros)
   ========================================================= */
async function historialAsignaciones(filtros = {}) {
    const pool = await getPool();
    const request = pool.request();

    let where = '1=1';
    if (filtros.desde) {
        where += ' AND FechaAsignacion >= @Desde';
        request.input('Desde', sql.Date, filtros.desde);
    }
    if (filtros.hasta) {
        where += ' AND FechaAsignacion <= @Hasta';
        request.input('Hasta', sql.Date, filtros.hasta);
    }
    if (filtros.estatus) {
        where += ' AND EstatusAsignacion = @Estatus';
        request.input('Estatus', sql.NVarChar(30), filtros.estatus);
    }

    const r = await request.query(`
        SELECT
            IdAsignacionHist, FolioTicket, FechaAsignacion, FechaDevolucion,
            TipoEquipo, Marca, Modelo, NoSerie, IMEI1, IMEI2, NoTelefono, PrecioActivo,
            NombreRecibe, PuestoRecibe, AreaRecibe, Cartera, CorreoRecibe,
            EstatusAsignacion, MotivoSalida
        FROM vw_ActivoFijoHistorialAsignaciones
        WHERE ${where}
        ORDER BY FechaAsignacion DESC
    `);
    return r.recordset;
}

/* =========================================================
   HISTORIAL DE UN ACTIVO ESPECÍFICO
   ========================================================= */
async function historialActivo(idActivo) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdActivo', sql.Int, idActivo)
        .query(`
            SELECT
                IdHistorico, IdActivoFijoEQ, NoSerie, IMEI1, NoTelefono, Tipo,
                EstadoAnterior, EstadoNuevo, EstatusAnterior, EstatusNuevo,
                Accion, Detalle, IdUsuarioMovimiento, FechaMovimiento
            FROM vw_ActivoFijoHistorialActivo
            WHERE IdActivoFijoEQ = @IdActivo
            ORDER BY FechaMovimiento DESC
        `);
    return r.recordset;
}

/* =========================================================
   CELULARES (vista específica)
   ========================================================= */
async function celulares() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            IdActivoFijoEQ, NoSerie, IMEI1, IMEI2, NoTelefono,
            Marca, Modelo, PrecioActivo, Estatus,
            FolioTicket, NombreRecibe, PuestoRecibe, AreaRecibe, CorreoRecibe,
            Cartera, FechaAsignacion, EstatusResponsiva
        FROM vw_ActivoFijoCelulares
        ORDER BY Marca, Modelo
    `);
    return r.recordset;
}

/* =========================================================
   LAPTOPS (vista específica)
   ========================================================= */
async function laptops() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            IdActivoFijoEQ, NoSerie, Marca, Modelo,
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

module.exports = {
    resumenGeneral,
    resumenPorTipo,
    resumenPorCartera,
    inventario,
    responsivasActivas,
    asignacionesPorPersona,
    porTicket,
    historialAsignaciones,
    historialActivo,
    celulares,
    laptops,
    tiposParaFiltro,
    estadosParaFiltro,
    estatusParaFiltro,
    carterasParaFiltro
};