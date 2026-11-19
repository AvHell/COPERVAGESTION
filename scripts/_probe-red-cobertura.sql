/* =========================================================
   COBERTURA DEL COLECTOR EN ACTIVO FIJO
   ---------------------------------------------------------
   Solo lectura. Responde una sola pregunta:
   ¿qué activos fijos NO tienen ninguna fila en la tabla de
   red del colector (ActivoFijoEquiposRed)?

   Ejecutar:
     npx electron scripts/_run-sql.js scripts/_probe-red-cobertura.sql
   ========================================================= */
SET NOCOUNT ON;

PRINT '1. Resumen de cobertura';
SELECT
  (SELECT COUNT(*) FROM dbo.ActivoFijoEquipos)                              AS ActivosTotales,
  (SELECT COUNT(DISTINCT IdActivoFijoEQ) FROM dbo.ActivoFijoEquiposRed)     AS ConAlgunaFilaRed,
  (SELECT COUNT(DISTINCT IdActivoFijoEQ) FROM dbo.ActivoFijoEquiposRed
     WHERE Vigente = 1)                                                     AS ConRedVigente,
  (SELECT COUNT(DISTINCT r.IdActivoFijoEQ)
     FROM dbo.ActivoFijoEquiposRed r
    WHERE r.Vigente = 0
      AND r.IdActivoFijoEQ NOT IN (SELECT IdActivoFijoEQ FROM dbo.ActivoFijoEquiposRed
                                    WHERE Vigente = 1))                     AS SoloHistoricos,
  (SELECT COUNT(*) FROM dbo.ActivoFijoEquipos af
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ActivoFijoEquiposRed r
                       WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ))         AS SinNingunaFilaRed;

PRINT '2. Activos SIN fila de red (los que nunca ha reportado el colector)';
SELECT af.IdActivoFijoEQ,
       af.NoSerie,
       ti.Nombre  AS Tipo,
       ma.Nombre  AS Marca,
       mo.Nombre  AS Modelo,
       st.Nombre  AS Estatus,
       ca.Nombre  AS Cartera
FROM dbo.ActivoFijoEquipos af
LEFT JOIN dbo.ActivoFijoTipos   ti ON ti.IdTipo    = af.IdTipo
LEFT JOIN dbo.ActivoFijoMarcas  ma ON ma.IdMarca   = af.IdMarca
LEFT JOIN dbo.ActivoFijoModelos mo ON mo.IdModelo  = af.IdModelo
LEFT JOIN dbo.ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
LEFT JOIN dbo.ActivoFijoCarteras ca ON ca.IdCartera = af.IdCartera
WHERE NOT EXISTS (SELECT 1 FROM dbo.ActivoFijoEquiposRed r
                   WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ)
ORDER BY ti.Nombre, af.NoSerie;

PRINT '2-bis. Los mismos activos, agrupados por tipo (compacto, sin truncar)';
SELECT ti.Nombre AS Tipo,
       COUNT(*)  AS SinRed,
       STRING_AGG(af.NoSerie, ', ') WITHIN GROUP (ORDER BY af.NoSerie) AS Series
FROM dbo.ActivoFijoEquipos af
LEFT JOIN dbo.ActivoFijoTipos ti ON ti.IdTipo = af.IdTipo
WHERE NOT EXISTS (SELECT 1 FROM dbo.ActivoFijoEquiposRed r
                   WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ)
GROUP BY ti.Nombre
ORDER BY SinRed DESC;

PRINT '3. Activos que solo tienen filas históricas (red dada de baja)';
SELECT af.IdActivoFijoEQ, af.NoSerie, st.Nombre AS Estatus,
       (SELECT COUNT(*) FROM dbo.ActivoFijoEquiposRed r
         WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ) AS FilasRed,
       (SELECT MAX(r.UltimaDeteccion) FROM dbo.ActivoFijoEquiposRed r
         WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ) AS UltimaDeteccion
FROM dbo.ActivoFijoEquipos af
LEFT JOIN dbo.ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
WHERE NOT EXISTS (SELECT 1 FROM dbo.ActivoFijoEquiposRed r
                   WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ AND r.Vigente = 1)
ORDER BY UltimaDeteccion;
