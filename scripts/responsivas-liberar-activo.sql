/* =========================================================
   ACTIVO FIJO — Liberar bien el activo al cerrar una responsiva
   ---------------------------------------------------------
   Problema que corrige:
     Al devolver o cancelar una responsiva, el activo volvía a
     DISPONIBLE pero conservaba pegado su "usuario de inventario"
     (ActivoFijoEquipos.IdUsuarioAsignado). Como el flujo además
     elegía el estatus con la regla "¿conserva usuario? → ASIGNADO",
     un activo ya devuelto quedaba ASIGNADO sin ninguna responsiva
     abierta: se veía ocupado por alguien que ya lo había entregado y
     desde el formulario no se podía vaciar el campo, porque el tipo
     lo marca como obligatorio. La única salida era eliminar el activo.

   Este script reescribe trg_AFR_AfterUpdate para que:
     1. Al CERRAR (DEVUELTO / CANCELADO): el activo queda DISPONIBLE y
        sin usuario de inventario. Quién lo tenía no se pierde: queda en
        la responsiva cerrada y en el snapshot ActivoFijoAsignacionesHist.
     2. Con la responsiva ABIERTA: si cambia quién recibe, el usuario de
        inventario del activo se resincroniza (antes se quedaba el viejo).
   El histórico lo registra trg_AFE_AfterUpdate ("usuario: X → (vacío)").

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

    /* 2. Cerrar: liberar el activo (DISPONIBLE y SIN usuario de inventario).
          Sólo en la transición: si ya estaba cerrada, un simple cambio de
          observaciones no debe alterar el inventario. */
    UPDATE af
       SET af.IdEstatus = (SELECT TOP 1 IdEstatus FROM ActivoFijoEstatus
                           WHERE UPPER(Nombre) = 'DISPONIBLE' AND Activo = 1
                           ORDER BY IdEstatus),
           af.IdUsuarioAsignado = NULL,
           af.IdUsuarioModificacion = i.IdUsuarioModificacion,
           af.FechaModificacion = GETDATE()
    FROM ActivoFijoEquipos af
    INNER JOIN inserted i ON i.IdActivoFijoEQ = af.IdActivoFijoEQ
    INNER JOIN deleted  d ON d.IdResponsiva  = i.IdResponsiva
    WHERE i.EstatusResponsiva IN ('DEVUELTO', 'CANCELADO')
      AND d.EstatusResponsiva NOT IN ('DEVUELTO', 'CANCELADO');

    /* 3. Sigue abierta y cambió quien recibe: el usuario de inventario del
          activo debe seguir a la responsiva (antes se quedaba el anterior). */
    UPDATE af
       SET af.IdUsuarioAsignado = i.IdUsuarioRecibe,
           af.IdUsuarioModificacion = i.IdUsuarioModificacion,
           af.FechaModificacion = GETDATE()
    FROM ActivoFijoEquipos af
    INNER JOIN inserted i ON i.IdActivoFijoEQ = af.IdActivoFijoEQ
    INNER JOIN deleted  d ON d.IdResponsiva  = i.IdResponsiva
    WHERE i.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
      AND ISNULL(i.IdUsuarioRecibe, 0) <> ISNULL(d.IdUsuarioRecibe, 0);

    /* 4. Registrar el movimiento de devolución/cancelación.
          El nombre de quien recibe sale del catálogo (NombreRecibe ya
          no existe en la tabla) y no se pierde: el snapshot histórico
          de ActivoFijoAsignacionesHist conserva el texto. */
    INSERT INTO ActivoFijoHistoricos (
        IdActivoFijoEQ, IdEstatusNuevo, IdResponsivaOrigen,
        Accion, Detalle, IdUsuarioMovimiento, FechaMovimiento
    )
    SELECT
        i.IdActivoFijoEQ,
        (SELECT TOP 1 IdEstatus FROM ActivoFijoEstatus
         WHERE UPPER(Nombre) = 'DISPONIBLE' AND Activo = 1
         ORDER BY IdEstatus),
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

/* =========================================================
   VERIFICACIÓN
   Activos que siguen marcados como en uso pero ya no tienen ninguna
   responsiva abierta. Lo esperado es 0 filas; las que salgan son datos
   viejos que quedaron inconsistentes (p. ej. responsivas devueltas antes
   de aplicar este script) y se corrigen poniéndolos a mano en DISPONIBLE
   y sin usuario asignado, o restaurando y volviendo a devolver. 
   ========================================================= */
SELECT af.IdActivoFijoEQ,
       af.NoSerie,
       st.Nombre AS Estatus,
       ur.Nombre AS UsuarioAsignado
FROM dbo.ActivoFijoEquipos af
INNER JOIN dbo.ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
LEFT  JOIN dbo.ActivoFijoUsuariosAsignados ur
       ON ur.IdUsuarioAsignado = af.IdUsuarioAsignado
WHERE UPPER(st.Nombre) IN ('ASIGNADO', 'PENDIENTE')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ActivoFijoResponsivas r
      WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
        AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
  )
ORDER BY af.IdActivoFijoEQ;
GO
