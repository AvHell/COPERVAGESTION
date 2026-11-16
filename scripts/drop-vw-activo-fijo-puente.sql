/* =========================================================
   ACTIVO FIJO — LIMPIEZA DEL "PUENTE CON EQUIPOS"
   ---------------------------------------------------------
   La pestaña "Puente con equipos" del módulo Detalle se eliminó
   (el empate con el flujo viejo dbo.Equipos ya no es necesario),
   así que sus dos objetos de base sobran:

     · dbo.vw_ActivoFijoPuenteEquipos  (vista de lectura)
     · dbo.ActivoFijoPuenteRevision    (tabla de marcas de revisión,
                                        única escritura que hacía la
                                        app en esa área)

   Este script los borra si existen y es idempotente: se puede
   ejecutar varias veces sin efecto. NO toca las tablas del
   colector (ActivoFijoEquiposRed / Cuentas / Programas /
   Componentes) ni sus datos, ni los índices de cruce sobre
   dbo.Equipos: sólo retira lo que quedó huérfano.

   Antes de borrar la tabla se informa cuántos renglones tenía,
   por si se quiere conservar un respaldo.
   ========================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ---------------------------------------------------------
   1. Vista del puente
   --------------------------------------------------------- */
IF OBJECT_ID(N'dbo.vw_ActivoFijoPuenteEquipos', N'V') IS NOT NULL
BEGIN
    DROP VIEW dbo.vw_ActivoFijoPuenteEquipos;
    PRINT 'Eliminada dbo.vw_ActivoFijoPuenteEquipos';
END
ELSE
    PRINT 'dbo.vw_ActivoFijoPuenteEquipos no existía (sin cambios)';
GO

/* ---------------------------------------------------------
   2. Tabla de marcas de revisión
   --------------------------------------------------------- */
IF OBJECT_ID(N'dbo.ActivoFijoPuenteRevision', N'U') IS NOT NULL
BEGIN
    DECLARE @Filas INT = 0;
    SELECT @Filas = COUNT(*) FROM dbo.ActivoFijoPuenteRevision;
    PRINT CONCAT('dbo.ActivoFijoPuenteRevision tenía ', @Filas, ' renglón(es); se elimina la tabla');

    /* El índice IX_AFPR_Equipo cae con la tabla: no hace falta
       borrarlo antes ni dejarlo suelto. */
    DROP TABLE dbo.ActivoFijoPuenteRevision;
    PRINT 'Eliminada dbo.ActivoFijoPuenteRevision';
END
ELSE
    PRINT 'dbo.ActivoFijoPuenteRevision no existía (sin cambios)';
GO

/* ---------------------------------------------------------
   3. Comprobación final: no debe quedar ningún objeto del puente
   --------------------------------------------------------- */
SELECT Objeto = o.name,
       Tipo   = o.type_desc
FROM sys.objects o
WHERE o.object_id IN (
        OBJECT_ID(N'dbo.vw_ActivoFijoPuenteEquipos'),
        OBJECT_ID(N'dbo.ActivoFijoPuenteRevision'))
ORDER BY o.name;
GO

PRINT 'Listo: el "Puente con equipos" ya no existe en la base.';
GO
