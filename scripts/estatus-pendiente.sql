/* =========================================================
   ACTIVO FIJO — Crea el estatus PENDIENTE
   ---------------------------------------------------------
   Los triggers trg_AFR_AfterInsert / trg_AFR_AfterUpdate y el
   formulario de responsivas ya trabajan con el estatus
   'PENDIENTE' (una responsiva capturada pero todavía no
   entregada). Pero ActivoFijoEstatus sólo tenía
   STOCK / DISPONIBLE / ASIGNADO / DEVUELTO / ROBADO / BAJA.

   Consecuencia: al crear o editar una responsiva como
   PENDIENTE el trigger hacía

       SET IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus
                        WHERE Nombre = 'PENDIENTE')   -- devolvía NULL

   y el UPDATE fallaba con
       "Cannot insert the value NULL into column 'IdEstatus'"
   (error 515), revirtiendo toda la operación.

   Este script agrega el estatus y reactiva el registro si
   alguien lo había dado de baja. Idempotente: se puede
   ejecutar varias veces sin duplicar filas.
   ========================================================= */
SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.ActivoFijoEstatus', N'U') IS NULL
BEGIN
    RAISERROR(N'No existe dbo.ActivoFijoEstatus: ejecuta antes scripts/activo-fijo-3fn.sql.', 16, 1);
    RETURN;
END;
GO

/* 1. Crear el estatus si falta. */
IF NOT EXISTS (
    SELECT 1 FROM dbo.ActivoFijoEstatus WHERE UPPER(LTRIM(RTRIM(Nombre))) = N'PENDIENTE'
)
    INSERT INTO dbo.ActivoFijoEstatus (Nombre, Activo)
    VALUES (N'PENDIENTE', 1);
GO

/* 2. Si existe pero estaba dado de baja, reactivarlo. */
UPDATE dbo.ActivoFijoEstatus
   SET Activo = 1
 WHERE UPPER(LTRIM(RTRIM(Nombre))) = N'PENDIENTE'
   AND ISNULL(Activo, 0) = 0;
GO

/* 3. Verificación: PENDIENTE debe salir Activo = 1 y sin duplicados. */
SELECT
    IdEstatus,
    Nombre,
    Activo,
    (SELECT COUNT(*) FROM dbo.ActivoFijoEstatus e2
      WHERE UPPER(LTRIM(RTRIM(e2.Nombre))) = N'PENDIENTE') AS Copias
FROM dbo.ActivoFijoEstatus
WHERE UPPER(LTRIM(RTRIM(Nombre))) = N'PENDIENTE';
GO
