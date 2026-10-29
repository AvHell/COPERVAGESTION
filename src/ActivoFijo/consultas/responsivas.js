/* =========================================================
   ACTIVO FIJO — CRUD DE RESPONSIVAS
   Soft delete: al cancelar NO se borra, queda como histórico
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   LISTAR
   - filtros.idEstatus        → filtra por ese estatus exacto
   - filtros.soloCancelados   → solo CANCELADO
   - por defecto              → oculta CANCELADO
   ========================================================= */
async function listar(filtros = {}) {
    const pool = await getPool();
    const request = pool.request();

    let where = '1=1';

    if (filtros.soloCancelados) {
        where += " AND r.EstatusResponsiva = 'CANCELADO'";
    } else if (filtros.idEstatus) {
        where += ' AND r.EstatusResponsiva = @Estatus';
        request.input('Estatus', sql.NVarChar(30), filtros.idEstatus);
    } else {
        where += " AND r.EstatusResponsiva <> 'CANCELADO'";
    }

    if (filtros.idTipo) {
        where += ' AND af.IdTipo = @IdTipo';
        request.input('IdTipo', sql.Int, filtros.idTipo);
    }

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
            r.IdCartera,
            r.IdPuesto,
            r.FechaCreacion,
            r.FechaModificacion,
            r.IdUsuarioModificacion,

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
   OBTENER DATOS COMPLETOS PARA PDF
   ========================================================= */
async function obtenerParaPDF(id) {
    const pool = await getPool();
    const r = await pool.request()
        .input('Id', sql.Int, id)
        .query(`
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

                af.IdActivoFijoEQ,
                af.NoSerie,
                af.IMEI1,
                af.IMEI2,
                af.NoTelefono,
                af.Modelo,
                af.PrecioActivo,
                af.Procesador,
                af.MemoriaRAM,
                af.Almacenamiento,
                af.SistemaOperativo,
                af.Accesorios,

                m.Nombre  AS Marca,
                t.Nombre  AS Tipo,
                t.RequiereIMEI,
                t.RequiereTelefono,

                c.Nombre  AS Cartera,
                p.Nombre  AS PuestoCatalogo
            FROM ActivoFijoResponsivas r
            INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
            INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
            LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
            LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera
            LEFT  JOIN ActivoFijoPuestos  p ON p.IdPuesto  = r.IdPuesto
            WHERE r.IdResponsiva = @Id
        `);
    return r.recordset[0] ?? null;
}

/* =========================================================
   ACTUALIZAR RUTA PDF
   ========================================================= */
async function actualizarRutaPDF(id, ruta, idUsuario) {
    const pool = await getPool();
    await pool.request()
        .input('Id',        sql.Int,           id)
        .input('Ruta',      sql.NVarChar(500), ruta)
        .input('IdUsuario', sql.Int,           idUsuario || null)
        .query(`
            UPDATE ActivoFijoResponsivas SET
                RutaPDF = @Ruta,
                FechaGeneracionPDF = GETDATE(),
                IdUsuarioModificacion = @IdUsuario,
                FechaModificacion = GETDATE()
            WHERE IdResponsiva = @Id
        `);
}

/* =========================================================
   ACTIVOS DISPONIBLES PARA ASIGNAR
   Excluye los que ya tienen responsiva activa
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
          AND st.Nombre IN ('DISPONIBLE', 'DEVUELTO')
          AND NOT EXISTS (
              SELECT 1
              FROM ActivoFijoResponsivas r
              WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                AND r.EstatusResponsiva IN ('ASIGNADO','PENDIENTE')
          )
        ORDER BY t.Nombre, m.Nombre, af.NoSerie
    `);
    return r.recordset;
}

/* =========================================================
   CREAR RESPONSIVA
   ========================================================= */
async function crear(datos, idUsuario) {
    try {
        const pool = await getPool();

        // Verificar que no tenga otra responsiva activa
        const respActiva = await pool.request()
            .input('IdActivo', sql.Int, datos.IdActivoFijoEQ)
            .query(`
                SELECT TOP 1 IdResponsiva
                FROM ActivoFijoResponsivas
                WHERE IdActivoFijoEQ = @IdActivo
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);
        if (respActiva.recordset.length > 0) {
            return { ok: false, mensaje: 'Este activo ya tiene una responsiva activa. Debe devolverse o cancelarse antes de reasignar.' };
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

        // Actualizar estatus del activo si está asignado
        if ((datos.EstatusResponsiva || 'ASIGNADO') !== 'DEVUELTO') {
            await pool.request()
                .input('IdActivo', sql.Int, datos.IdActivoFijoEQ)
                .input('IdUsuario', sql.Int, idUsuario || null)
                .query(`
                    UPDATE ActivoFijoEquipos SET
                        IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'ASIGNADO'),
                        IdUsuarioModificacion = @IdUsuario,
                        FechaModificacion = GETDATE()
                    WHERE IdActivoFijoEQ = @IdActivo
                      AND IdEstatus <> (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'ASIGNADO')
                `);
        }

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
   DEVOLVER
   - Marca la responsiva como DEVUELTO
   - Libera el activo (DISPONIBLE)
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
            return { ok: false, mensaje: 'La responsiva ya estaba devuelta, cancelada o no existe.' };
        }

        // Liberar el activo
        await pool.request()
            .input('Id', sql.Int, id)
            .input('IdUsuario', sql.Int, idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'DISPONIBLE'),
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdActivoFijoEQ IN (
                    SELECT IdActivoFijoEQ FROM ActivoFijoResponsivas
                    WHERE IdResponsiva = @Id
                )
            `);

        return { ok: true, mensaje: 'Devolución registrada. El activo vuelve a estar disponible.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al devolver: ' + err.message };
    }
}

/* =========================================================
   CANCELAR RESPONSIVA (Soft delete → histórico)
   - NO se elimina el registro
   - Se marca como CANCELADO
   - Libera el activo si estaba asignado
   - Guarda quién canceló + motivo en Observaciones
   - NO se puede restaurar: queda como histórico
   ========================================================= */
async function eliminar(id, idUsuario, motivo = null) {
    try {
        const pool = await getPool();

        // 1. Construir el texto de la observación de cancelación
        let textoCancel = null;
        if (motivo) {
            textoCancel = `[CANCELADA] Motivo: ${String(motivo).trim()}`;
        } else {
            textoCancel = '[CANCELADA]';
        }

        // 2. Marcar la responsiva como CANCELADA
        const result = await pool.request()
            .input('Id',        sql.Int,           id)
            .input('IdUsuario', sql.Int,           idUsuario || null)
            .input('Texto',     sql.NVarChar(500), textoCancel)
            .query(`
                UPDATE ActivoFijoResponsivas SET
                    EstatusResponsiva = 'CANCELADO',
                    Observaciones = 
                        CASE
                            WHEN Observaciones IS NULL OR LTRIM(RTRIM(Observaciones)) = ''
                                THEN @Texto
                            ELSE CONCAT(Observaciones, ' | ', @Texto)
                        END,
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdResponsiva = @Id
                  AND EstatusResponsiva <> 'CANCELADO'
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'La responsiva ya estaba cancelada o no existe.' };
        }

        // 3. Liberar el activo (si estaba asignado)
        await pool.request()
            .input('Id',        sql.Int, id)
            .input('IdUsuario', sql.Int, idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'DISPONIBLE'),
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdActivoFijoEQ IN (
                    SELECT IdActivoFijoEQ FROM ActivoFijoResponsivas
                    WHERE IdResponsiva = @Id
                )
            `);

        return {
            ok: true,
            mensaje: 'Responsiva cancelada. El activo vuelve a estar disponible. La responsiva queda como histórico.'
        };
    } catch (err) {
        return { ok: false, mensaje: 'Error al cancelar: ' + err.message };
    }
}

/* =========================================================
   CATÁLOGOS AUXILIARES
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

/* =========================================================
   VERIFICAR SI EXISTE PDF EN DISCO
   ========================================================= */
async function existePDF(ruta) {
    if (!ruta) return { ok: false, existe: false, mensaje: 'La responsiva no tiene ruta de PDF registrada.' };
    try {
        const fs = require('fs');
        const existe = fs.existsSync(ruta);
        return {
            ok: true,
            existe,
            ruta,
            mensaje: existe ? 'PDF encontrado.' : 'El archivo PDF ya no existe en disco.'
        };
    } catch (err) {
        return { ok: false, existe: false, mensaje: 'Error al verificar PDF: ' + err.message };
    }
}

/* =========================================================
   ABRIR PDF EN EL VISOR DEL SISTEMA
   ========================================================= */
async function abrirPDF(ruta) {
    if (!ruta) return { ok: false, mensaje: 'La responsiva no tiene ruta de PDF registrada.' };
    try {
        const fs = require('fs');
        const { shell } = require('electron');
        if (!fs.existsSync(ruta)) {
            return { ok: false, mensaje: 'El archivo PDF ya no existe en disco. Debes regenerarlo.' };
        }
        const res = await shell.openPath(ruta);
        if (res) return { ok: false, mensaje: 'No se pudo abrir el PDF: ' + res };
        return { ok: true, mensaje: 'PDF abierto.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al abrir PDF: ' + err.message };
    }
}

module.exports = {
    listar, obtener, obtenerParaPDF, actualizarRutaPDF,
    activosDisponibles, crear, actualizar, devolver, eliminar,
    listarCarteras, listarPuestos,
    existePDF, abrirPDF
};