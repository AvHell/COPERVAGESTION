/* =========================================================
   SALUD DE LA UNIFICACIÓN DE IP
   ---------------------------------------------------------
   Solo lectura. Devuelve 8 result sets etiquetados para
   revisar el estado de dbo.InventarioIPMaestro contra sus
   tres orígenes.
   Ejecutar:
     npx electron scripts/_run-sql.js scripts/_probe-salud-ip.sql
   ========================================================= */
SET NOCOUNT ON;

PRINT '1. Totales por origen y en la maestra';
SELECT
  (SELECT COUNT(*) FROM dbo.InventarioGeneralIP)                                  AS GeneralFilas,
  (SELECT COUNT(*) FROM dbo.Equipos WHERE Activo = 1 AND IP IS NOT NULL AND IP <> '') AS ClienteFilas,
  (SELECT COUNT(*) FROM dbo.ActivoFijoEquiposRed WHERE Vigente = 1)              AS ColectorFilas,
  (SELECT COUNT(*) FROM dbo.InventarioIPMaestro)                                 AS MaestraFilas,
  (SELECT COUNT(DISTINCT IP) FROM dbo.InventarioIPMaestro)                       AS MaestraIPs,
  (SELECT COUNT(*) FROM dbo.InventarioIPMaestro WHERE GestionManual = 1)         AS Gestionadas;

PRINT '2. Filas de la maestra sin ningún origen vivo (candidatas a purga)';
SELECT COUNT(*) AS Huerfanas
FROM dbo.InventarioIPMaestro
WHERE EnGeneral = 0 AND EnCliente = 0 AND EnColector = 0;

PRINT '3. IPs presentes en más de un origen (el punto de choque)';
SELECT SUM(CASE WHEN fuentes > 1 THEN 1 ELSE 0 END) AS IPsCompartidas,
       COUNT(*)                                     AS IPsTotales
FROM (
  SELECT IP, (CAST(EnGeneral AS INT) + CAST(EnCliente AS INT) + CAST(EnColector AS INT)) AS fuentes
  FROM dbo.InventarioIPMaestro
) x;

PRINT '4. Filas de origen que NO llegaron a la maestra (trigger caído)';
SELECT
  (SELECT COUNT(*) FROM dbo.InventarioGeneralIP g
     WHERE NULLIF(LTRIM(RTRIM(g.IP)),'') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.InventarioIPMaestro m WHERE m.IP = LTRIM(RTRIM(g.IP)))) AS GeneralSinMaestra,
  (SELECT COUNT(*) FROM dbo.Equipos e
     WHERE e.Activo = 1 AND NULLIF(LTRIM(RTRIM(e.IP)),'') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.InventarioIPMaestro m WHERE m.IP = LTRIM(RTRIM(e.IP)))) AS ClienteSinMaestra,
  (SELECT COUNT(*) FROM dbo.ActivoFijoEquiposRed r
     WHERE r.Vigente = 1 AND NULLIF(LTRIM(RTRIM(r.IP)),'') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.InventarioIPMaestro m WHERE m.IP = LTRIM(RTRIM(r.IP)))) AS ColectorSinMaestra;

PRINT '5. Gestión manual: filas protegidas y coherencia de piso';
SELECT
  COUNT(*)                                                                   AS Gestionadas,
  SUM(CASE WHEN IdPiso IS NOT NULL AND IdPisoPlano IS NOT NULL THEN 1 ELSE 0 END) AS PisoDoble,
  SUM(CASE WHEN IdPiso IS NULL AND IdPisoPlano IS NULL THEN 1 ELSE 0 END)         AS SinPiso,
  SUM(CASE WHEN IdCliente IS NULL THEN 1 ELSE 0 END)                              AS SinCliente
FROM dbo.InventarioIPGestion;

PRINT '6. Filas de la maestra con piso de los dos vocabularios (debe ser 0)';
SELECT COUNT(*) AS ConflictoPiso
FROM dbo.InventarioIPMaestro
WHERE IdPiso IS NOT NULL AND IdPisoPlano IS NOT NULL;

PRINT '7. Cobertura del colector: activos fijos sin ninguna fila de red';
SELECT
  (SELECT COUNT(*) FROM dbo.ActivoFijoEquipos) AS ActivosTotales,
  (SELECT COUNT(DISTINCT IdActivoFijoEQ) FROM dbo.ActivoFijoEquiposRed) AS ActivosConRed;

PRINT '8. Los dos catálogos de piso (no son el mismo)';
SELECT 'dbo.Pisos' AS Catalogo, COUNT(*) AS Filas FROM dbo.Pisos
UNION ALL
SELECT 'CatalogosInventarioIP Piso', COUNT(*) FROM dbo.CatalogosInventarioIP WHERE TipoCatalogo = 'Piso';
