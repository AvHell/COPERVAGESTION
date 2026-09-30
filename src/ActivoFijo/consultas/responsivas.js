/* =========================================================
   ACTIVO FIJO — CRUD DE RESPONSIVAS
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   LISTAR (con filtros)
   ========================================================= */
async function listar(filtros = {}) {
    const pool = await getPool();
    const request = pool.request();

    let where = '1=1';
    if (filtros.idEstatus)  { where += ' AND r.EstatusResponsiva = @Estatus'; request.input('Estatus', sql.NVarChar(30), filtros.idEstatus); }
    if (filtros.idTipo)     { where += ' AND af.IdTipo = @IdTipo';           request.input('IdTipo', sql.Int, filtros.idTipo); }

    const result = await request.query(`
        SELECT
            r.IdResponsiva,
            r.FolioTicket,
            r.TipoResponsiva,
            r.FechaAsignacion,
            r.FechaDevolucionProgramada,
            r.FechaDevolucionReal,
            r.EstatusResponsiva,
            r.MotivoSalida,
            r.NombreProyecto,
            r.DescripcionSolicitud,
            r.Observaciones,
            r.NombreRecibe,
            r.PuestoRecibe,
            r.AreaRecibe,
            r.CorreoRecibe,
            r.NombreEntrega,
            r.PuestoEntrega,
            r.AreaEntrega,
            r.RutaPDF,
            r.RutaINE,
            r.RutaComprobanteDomicilio,
            r.FechaCreacion,

            af.IdActivoFijoEQ,
            af.NoSerie,
            af.IMEI1,
            af.IMEI2,
            af.NoTelefono,
            af.Modelo,
            af.PrecioActivo,
            m.Nombre     AS Marca,
            t.Nombre     AS Tipo,
            es.Nombre    AS Estado,
            st.Nombre    AS EstatusActivo,

            c.Nombre     AS Cartera
        FROM ActivoFijoResponsivas r
        INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
        INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
        INNER JOIN ActivoFijoEstados es ON es.IdEstado = af.IdEstado
        INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
        LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
        LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera
        WHERE ${where}
        ORDER BY r.IdResponsiva DESC
    `);
    return result.recordset;
}

/* =========================================================
   OBTENER POR ID
   ========================================================= */
async function obtener(id) {
    const pool = await getPool();
    const r = await pool.request()
        .input('Id', sql.Int, id)
        .query(`
            SELECT
                r.*,
                af.NoSerie,
                af.IMEI1,
                af.IMEI2,
                af.NoTelefono,
                af.Modelo,
                af.PrecioActivo,
                af.Procesador,
                af.MemoriaRAM,
                af.Almacenamiento,
                af.Accesorios,
                m.Nombre  AS Marca,
                t.Nombre  AS Tipo,
                t.RequiereIMEI,
                t.RequiereTelefono
            FROM ActivoFijoResponsivas r
            INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
            INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
            LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
            WHERE r.IdResponsiva = @Id
        `);
    return r.recordset[0] ?? null;
}

/* =========================================================
   ACTIVOS DISPONIBLES PARA ASIGNAR
   Solo los que su tipo requiere responsiva y están libres.
   ========================================================= */
async function activosDisponibles() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            af.IdActivoFijoEQ,
            af.NoSerie,
            af.IMEI1,
            af.IMEI2,
            af.NoTelefono,
            af.Modelo,
            af.PrecioActivo,
            m.Nombre  AS Marca,
            t.Nombre  AS Tipo,
            t.RequiereIMEI,
            t.RequiereTelefono,
            st.Nombre AS Estatus,
            af.Observaciones
        FROM ActivoFijoEquipos af
        INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
        INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
        LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
        WHERE t.RequiereResponsiva = 1
          AND st.Nombre IN ('STOCK', 'DISPONIBLE', 'DEVUELTO')
        ORDER BY t.Nombre, m.Nombre, af.NoSerie
    `);
    return r.recordset;
}

/* =========================================================
   CREAR RESPONSIVA
   El trigger trg_AFR_AfterInsert hace el resto:
   - Snapshot en ActivoFijoAsignacionesHist
   - Movimiento en ActivoFijoHistoricos
   - Update estatus del activo a ASIGNADO/PENDIENTE
   ========================================================= */
async function crear(datos, idUsuario) {
    try {
        const pool = await getPool();

        // Validar que el activo exista y no tenga responsiva activa
        const respActiva = await pool.request()
            .input('IdActivo', sql.Int, datos.IdActivoFijoEQ)
            .query(`
                SELECT TOP 1 IdResponsiva
                FROM ActivoFijoResponsivas
                WHERE IdActivoFijoEQ = @IdActivo
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);
        if (respActiva.recordset.length > 0) {
            return { ok: false, mensaje: 'Este activo ya tiene una responsiva activa. Debe devolverse antes de reasignar.' };
        }

        const result = await pool.request()
            .input('FolioTicket',       sql.NVarChar(50),  datos.FolioTicket)
            .input('IdActivoFijoEQ',    sql.Int,           datos.IdActivoFijoEQ)
            .input('TipoResponsiva',    sql.NVarChar(50),  datos.TipoResponsiva)
            .input('FechaAsignacion',   sql.Date,          datos.FechaAsignacion)
            .input('FechaDevolucionProgramada', sql.Date,  datos.FechaDevolucionProgramada || null)
            .input('EstatusResponsiva', sql.NVarChar(30),  datos.EstatusResponsiva || 'ASIGNADO')
            .input('MotivoSalida',      sql.NVarChar(150), datos.MotivoSalida || null)
            .input('NombreProyecto',    sql.NVarChar(200), datos.NombreProyecto || null)
            .input('DescripcionSolicitud', sql.NVarChar(300), datos.DescripcionSolicitud || null)
            .input('Observaciones',     sql.NVarChar(500), datos.Observaciones || null)
            .input('NombreRecibe',      sql.NVarChar(200), datos.NombreRecibe)
            .input('PuestoRecibe',      sql.NVarChar(100), datos.PuestoRecibe || null)
            .input('AreaRecibe',        sql.NVarChar(100), datos.AreaRecibe || null)
            .input('CorreoRecibe',      sql.NVarChar(150), datos.CorreoRecibe || null)
            .input('IdCartera',         sql.Int,           datos.IdCartera || null)
            .input('IdPuesto',          sql.Int,           datos.IdPuesto || null)
            .input('NombreEntrega',     sql.NVarChar(200), datos.NombreEntrega || null)
            .input('PuestoEntrega',     sql.NVarChar(100), datos.PuestoEntrega || null)
            .input('AreaEntrega',       sql.NVarChar(100), datos.AreaEntrega || 'Sistemas')
            .input('RutaPDF',           sql.NVarChar(500), datos.RutaPDF || null)
            .input('RutaINE',           sql.NVarChar(500), datos.RutaINE || null)
            .input('RutaComprobanteDomicilio', sql.NVarChar(500), datos.RutaComprobanteDomicilio || null)
            .input('IdUsuario',         sql.Int,           idUsuario || null)
            .query(`
                INSERT INTO ActivoFijoResponsivas (
                    FolioTicket, IdActivoFijoEQ, TipoResponsiva,
                    FechaAsignacion, FechaDevolucionProgramada, EstatusResponsiva,
                    MotivoSalida, NombreProyecto, DescripcionSolicitud, Observaciones,
                    NombreRecibe, PuestoRecibe, AreaRecibe, CorreoRecibe, IdCartera, IdPuesto,
                    NombreEntrega, PuestoEntrega, AreaEntrega,
                    RutaPDF, RutaINE, RutaComprobanteDomicilio,
                    IdUsuarioCreacion
                ) VALUES (
                    @FolioTicket, @IdActivoFijoEQ, @TipoResponsiva,
                    @FechaAsignacion, @FechaDevolucionProgramada, @EstatusResponsiva,
                    @MotivoSalida, @NombreProyecto, @DescripcionSolicitud, @Observaciones,
                    @NombreRecibe, @PuestoRecibe, @AreaRecibe, @CorreoRecibe, @IdCartera, @IdPuesto,
                    @NombreEntrega, @PuestoEntrega, @AreaEntrega,
                    @RutaPDF, @RutaINE, @RutaComprobanteDomicilio,
                    @IdUsuario
                );
                SELECT SCOPE_IDENTITY() AS Id;
            `);

        return { ok: true, mensaje: 'Responsiva creada correctamente.', id: result.recordset[0].Id };
    } catch (err) {
        return { ok: false, mensaje: 'Error al crear responsiva: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR RESPONSIVA
   ========================================================= */
async function actualizar(id, datos, idUsuario) {
    try {
        const pool = await getPool();

        const result = await pool.request()
            .input('Id',                sql.Int,           id)
            .input('FolioTicket',       sql.NVarChar(50),  datos.FolioTicket)
            .input('FechaAsignacion',   sql.Date,          datos.FechaAsignacion)
            .input('FechaDevolucionProgramada', sql.Date,  datos.FechaDevolucionProgramada || null)
            .input('FechaDevolucionReal', sql.Date,        datos.FechaDevolucionReal || null)
            .input('EstatusResponsiva', sql.NVarChar(30),  datos.EstatusResponsiva)
            .input('MotivoSalida',      sql.NVarChar(150), datos.MotivoSalida || null)
            .input('NombreProyecto',    sql.NVarChar(200), datos.NombreProyecto || null)
            .input('DescripcionSolicitud', sql.NVarChar(300), datos.DescripcionSolicitud || null)
            .input('Observaciones',     sql.NVarChar(500), datos.Observaciones || null)
            .input('NombreRecibe',      sql.NVarChar(200), datos.NombreRecibe)
            .input('PuestoRecibe',      sql.NVarChar(100), datos.PuestoRecibe || null)
            .input('AreaRecibe',        sql.NVarChar(100), datos.AreaRecibe || null)
            .input('CorreoRecibe',      sql.NVarChar(150), datos.CorreoRecibe || null)
            .input('IdCartera',         sql.Int,           datos.IdCartera || null)
            .input('IdPuesto',          sql.Int,           datos.IdPuesto || null)
            .input('NombreEntrega',     sql.NVarChar(200), datos.NombreEntrega || null)
            .input('PuestoEntrega',     sql.NVarChar(100), datos.PuestoEntrega || null)
            .input('AreaEntrega',       sql.NVarChar(100), datos.AreaEntrega || 'Sistemas')
            .input('RutaPDF',           sql.NVarChar(500), datos.RutaPDF || null)
            .input('RutaINE',           sql.NVarChar(500), datos.RutaINE || null)
            .input('RutaComprobanteDomicilio', sql.NVarChar(500), datos.RutaComprobanteDomicilio || null)
            .input('IdUsuario',         sql.Int,           idUsuario || null)
            .query(`
                UPDATE ActivoFijoResponsivas SET
                    FolioTicket = @FolioTicket,
                    FechaAsignacion = @FechaAsignacion,
                    FechaDevolucionProgramada = @FechaDevolucionProgramada,
                    FechaDevolucionReal = @FechaDevolucionReal,
                    EstatusResponsiva = @EstatusResponsiva,
                    MotivoSalida = @MotivoSalida,
                    NombreProyecto = @NombreProyecto,
                    DescripcionSolicitud = @DescripcionSolicitud,
                    Observaciones = @Observaciones,
                    NombreRecibe = @NombreRecibe,
                    PuestoRecibe = @PuestoRecibe,
                    AreaRecibe = @AreaRecibe,
                    CorreoRecibe = @CorreoRecibe,
                    IdCartera = @IdCartera,
                    IdPuesto = @IdPuesto,
                    NombreEntrega = @NombreEntrega,
                    PuestoEntrega = @PuestoEntrega,
                    AreaEntrega = @AreaEntrega,
                    RutaPDF = @RutaPDF,
                    RutaINE = @RutaINE,
                    RutaComprobanteDomicilio = @RutaComprobanteDomicilio,
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdResponsiva = @Id
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'La responsiva ya no existe.' };
        }
        return { ok: true, mensaje: 'Responsiva actualizada correctamente.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al actualizar: ' + err.message };
    }
}

/* =========================================================
   DEVOLVER (atajo que solo cambia estatus)
   El trigger trg_AFR_AfterUpdate libera el activo.
   ========================================================= */
async function devolver(id, fechaDevolucionReal, observaciones, idUsuario) {
    try {
        const pool = await getPool();

        const result = await pool.request()
            .input('Id',              sql.Int,           id)
            .input('FechaDevolucion', sql.Date,          fechaDevolucionReal)
            .input('Observaciones',   sql.NVarChar(500), observaciones || null)
            .input('IdUsuario',       sql.Int,           idUsuario || null)
            .query(`
                UPDATE ActivoFijoResponsivas SET
                    EstatusResponsiva = 'DEVUELTO',
                    FechaDevolucionReal = @FechaDevolucion,
                    Observaciones = COALESCE(@Observaciones, Observaciones),
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdResponsiva = @Id
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'La responsiva ya estaba devuelta o no existe.' };
        }
        return { ok: true, mensaje: 'Devolución registrada. El activo vuelve a estar disponible.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al devolver: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(id) {
    try {
        const pool = await getPool();

        // Si estaba activa, liberar el activo primero
        await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'DISPONIBLE'),
                    FechaModificacion = GETDATE()
                WHERE IdActivoFijoEQ IN (
                    SELECT IdActivoFijoEQ FROM ActivoFijoResponsivas
                    WHERE IdResponsiva = @Id
                      AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                )
            `);

        const result = await pool.request()
            .input('Id', sql.Int, id)
            .query('DELETE FROM ActivoFijoResponsivas WHERE IdResponsiva = @Id');

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'La responsiva ya no existe.' };
        }
        return { ok: true, mensaje: 'Responsiva eliminada correctamente.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al eliminar: ' + err.message };
    }
}

/* =========================================================
   CATÁLOGOS AUXILIARES (para selects)
   ========================================================= */
async function listarCarteras() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdCartera, Nombre FROM ActivoFijoCarteras WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarPuestos() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdPuesto, Nombre FROM ActivoFijoPuestos WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

module.exports = {
    listar, obtener, activosDisponibles, crear, actualizar, devolver, eliminar,
    listarCarteras, listarPuestos
};