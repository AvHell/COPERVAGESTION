/* =========================================================
   ACTIVO FIJO — Corrige trg_AFR_AfterUpdate
   ---------------------------------------------------------
   La fase 2 de scripts/activo-fijo-3fn.sql eliminó la columna
   ActivoFijoResponsivas.NombreRecibe, pero este trigger seguía
   usándola en el detalle del histórico, así que CUALQUIER update
   sobre la responsiva (cancelar, devolver, editar) fallaba con
   "Invalid column name 'NombreRecibe'".

   Aquí se reescribe el trigger con el nombre resuelto por JOIN al
   catálogo ActivoFijoUsuariosAsignados (3FN), y se añade el filtro
   "sólo en la transición a DEVUELTO/CANCELADO" para que editar una
   responsiva ya cerrada no vuelva a tocar el estatus del activo.

   Idempotente: CREATE OR ALTER, se puede ejecutar varias veces.
   ========================================================= */
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER TRIGGER dbo.trg_AFR_AfterUpdate
ON dbo.ActivoFijoResponsivas
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    /* 1. Actualizar el snapshot de la asignación. */
    UPDATE h
       SET h.EstatusAsignacion = i.EstatusResponsiva,
           h.FechaDevolucion   = i.FechaDevolucionReal
    FROM ActivoFijoAsignacionesHist h
    INNER JOIN inserted i ON i.IdResponsiva = h.IdResponsiva
    INNER JOIN deleted  d ON d.IdResponsiva = i.IdResponsiva
    WHERE i.EstatusResponsiva <> d.EstatusResponsiva
       OR ISNULL(i.FechaDevolucionReal, '1900-01-01') <> ISNULL(d.FechaDevolucionReal, '1900-01-01');

    /* 2. Liberar el activo si se devuelve o se cancela.
          Sólo en la transición: si ya estaba cerrada, un simple
          cambio de observaciones no debe alterar el inventario. */
    UPDATE af
       SET af.IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'DISPONIBLE'),
           af.IdUsuarioModificacion = i.IdUsuarioModificacion,
           af.FechaModificacion = GETDATE()
    FROM ActivoFijoEquipos af
    INNER JOIN inserted i ON i.IdActivoFijoEQ = af.IdActivoFijoEQ
    INNER JOIN deleted  d ON d.IdResponsiva  = i.IdResponsiva
    WHERE i.EstatusResponsiva IN ('DEVUELTO', 'CANCELADO')
      AND d.EstatusResponsiva NOT IN ('DEVUELTO', 'CANCELADO');

    /* 3. Registrar el movimiento.
          El nombre de quien recibe sale del catálogo (NombreRecibe ya
          no existe en la tabla) y no se pierde: el snapshot histórico
          de ActivoFijoAsignacionesHist conserva el texto. */
    INSERT INTO ActivoFijoHistoricos (
        IdActivoFijoEQ, IdEstatusNuevo, IdResponsivaOrigen,
        Accion, Detalle, IdUsuarioMovimiento, FechaMovimiento
    )
    SELECT
        i.IdActivoFijoEQ,
        (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'DISPONIBLE'),
        i.IdResponsiva,
        'DEVOLUCION',
        'Devolución de: ' + ISNULL(
            (SELECT Nombre FROM ActivoFijoUsuariosAsignados
              WHERE IdUsuarioAsignado = i.IdUsuarioRecibe), ''),
        i.IdUsuarioModificacion,
        GETDATE()
    FROM inserted i
    INNER JOIN deleted d ON d.IdResponsiva = i.IdResponsiva
    WHERE i.EstatusResponsiva IN ('DEVUELTO', 'CANCELADO')
      AND d.EstatusResponsiva NOT IN ('DEVUELTO', 'CANCELADO');
END;
GO
