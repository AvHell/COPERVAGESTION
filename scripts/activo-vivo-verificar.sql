/*
  ============================================================================
  ACTIVO VIVO — Verificación (sólo lectura del esquema + pruebas con ROLLBACK)
  ============================================================================
  Ejecutar DESPUÉS de:
    - scripts/activo-vivo-unificado.sql
    - scripts/activo-vivo-vistas.sql

  Este script NO deja datos. Hace dos cosas:
    1) Comprueba que existan las columnas, el CHECK y las vistas.
    2) Prueba la REGLA con filas temporales (ZZ_VERIF% / ZZSERIE) dentro de
       una transacción que termina siempre en ROLLBACK:
         · WiFi (controlador) y DHCP  → OrigenIP volátil (EsConfiable = 0)
         · Estatica                   → Manual (EsConfiable = 1)
         · el CHECK rechaza un OrigenIP inventado
         · el CHECK acepta TipoComponente = 'DIADEMA'
         · la vista de piezas expone MAC/ConectadoA/EstadoConexion/Bateria
         · la red del colector (ActivoFijoEquiposRed) aparece en el control
           general como origen 'Activo', WiFi/DHCP volátil, y sin duplicar
           la misma MAC
  Si un paso falla, el último SELECT lo muestra como FALLO y no hubo cambios.
  ============================================================================
*/

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   1. Inventario: columnas, CHECK y vistas.
   --------------------------------------------------------------------------- */
SELECT 'Esquema' AS Bloque, 'InventarioGeneralIP.OrigenIP' AS Objeto,
       CAST(CASE WHEN COL_LENGTH('dbo.InventarioGeneralIP', 'OrigenIP') IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS Existe
UNION ALL
SELECT 'Esquema', 'InventarioGeneralIP.EsConfiable',
       CAST(CASE WHEN COL_LENGTH('dbo.InventarioGeneralIP', 'EsConfiable') IS NOT NULL THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT 'Esquema', 'CK_InventarioGeneralIP_Origen',
       CAST(CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints
                              WHERE name = N'CK_InventarioGeneralIP_Origen') THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT 'Esquema', 'ActivoFijoEquiposComponentes.MAC',
       CAST(CASE WHEN COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'MAC') IS NOT NULL THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT 'Esquema', 'ActivoFijoEquiposComponentes.ConectadoA NVARCHAR(300)',
       CAST(CASE WHEN COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'ConectadoA') >= 600 THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT 'Esquema', 'ActivoFijoEquiposComponentes.EstadoConexion',
       CAST(CASE WHEN COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'EstadoConexion') IS NOT NULL THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT 'Esquema', 'ActivoFijoEquiposComponentes.Bateria',
       CAST(CASE WHEN COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'Bateria') IS NOT NULL THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT 'Esquema', 'CK_AFComp_Tipo admite DIADEMA',
       CAST(CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints
                              WHERE name = N'CK_AFComp_Tipo'
                                AND definition LIKE '%DIADEMA%') THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT 'Esquema', 'vw_InventarioIPUnificado',
       CAST(CASE WHEN OBJECT_ID(N'dbo.vw_InventarioIPUnificado', N'V') IS NOT NULL THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT 'Esquema', 'vw_ActivoFijoPiezasUnificadas',
       CAST(CASE WHEN OBJECT_ID(N'dbo.vw_ActivoFijoPiezasUnificadas', N'V') IS NOT NULL THEN 1 ELSE 0 END AS BIT);
GO

/* ---------------------------------------------------------------------------
   2. Regla de procedencia de la IP (con ROLLBACK).
   --------------------------------------------------------------------------- */
BEGIN TRAN;

DECLARE @wifi INT = (SELECT TOP 1 IdCatalogoIP FROM dbo.CatalogosInventarioIP
                     WHERE TipoCatalogo = 'TipoIP' AND Nombre LIKE N'WiFi%');
DECLARE @dhcp INT = (SELECT TOP 1 IdCatalogoIP FROM dbo.CatalogosInventarioIP
                     WHERE TipoCatalogo = 'TipoIP' AND Nombre = N'DHCP');
DECLARE @estatica INT = (SELECT TOP 1 IdCatalogoIP FROM dbo.CatalogosInventarioIP
                         WHERE TipoCatalogo = 'TipoIP' AND Nombre = N'Estatica');
DECLARE @plantillaIdEstado INT, @plantillaIdDispositivo INT, @plantillaIdTipoEquipo INT,
        @plantillaIdPiso INT, @plantillaIdSite INT;

SELECT TOP 1
    @plantillaIdEstado = IdEstado,
    @plantillaIdDispositivo = IdDispositivo,
    @plantillaIdTipoEquipo = IdTipoEquipo,
    @plantillaIdPiso = IdPiso,
    @plantillaIdSite = IdSite
FROM dbo.InventarioGeneralIP ORDER BY IdInventarioIP;

INSERT INTO dbo.InventarioGeneralIP
    (IP, Hostname, MAC, Descripcion, PuertoFortinet, IdEstado, IdDispositivo,
     IdTipoEquipo, IdPiso, IdSite, IdTipoIP, FechaActualizacion)
VALUES
    ('10.99.99.1', 'ZZ_VERIF_WIFI', NULL, 'verificacion', NULL, @plantillaIdEstado,
     @plantillaIdDispositivo, @plantillaIdTipoEquipo, @plantillaIdPiso, @plantillaIdSite,
     @wifi, SYSUTCDATETIME()),
    ('10.99.99.2', 'ZZ_VERIF_DHCP', NULL, 'verificacion', NULL, @plantillaIdEstado,
     @plantillaIdDispositivo, @plantillaIdTipoEquipo, @plantillaIdPiso, @plantillaIdSite,
     @dhcp, SYSUTCDATETIME()),
    ('10.99.99.3', 'ZZ_VERIF_ESTATICA', NULL, 'verificacion', NULL, @plantillaIdEstado,
     @plantillaIdDispositivo, @plantillaIdTipoEquipo, @plantillaIdPiso, @plantillaIdSite,
     @estatica, SYSUTCDATETIME());

/* Caso contradictorio: TipoIP volátil + OrigenIP guardado como 'Manual'.
   La vista (y resolverProcedencia en el módulo JS) deben darle la última
   palabra al TipoIP: la fila se lee 'Wifi' / EsConfiable 0, nunca inventario
   duro. Así lo guardado no puede contradecir lo que muestra la pantalla. */
INSERT INTO dbo.InventarioGeneralIP
    (IP, Hostname, MAC, Descripcion, PuertoFortinet, IdEstado, IdDispositivo,
     IdTipoEquipo, IdPiso, IdSite, IdTipoIP, FechaActualizacion, OrigenIP, EsConfiable)
VALUES
    ('10.99.99.5', 'ZZ_VERIF_CONTRADICHO', NULL, 'verificacion', NULL, @plantillaIdEstado,
     @plantillaIdDispositivo, @plantillaIdTipoEquipo, @plantillaIdPiso, @plantillaIdSite,
     @wifi, SYSUTCDATETIME(), 'Manual', 1);

/* Lo esperado: WIFI/DHCP → EsConfiable 0 (oculta por defecto);
   ESTATICA → EsConfiable 1 (visible). El contradictorio debe salir 'Wifi' / 0. */
SELECT N'Procedencia' AS Bloque, Hostname, TipoIP, OrigenIP, EsConfiable,
       CASE WHEN EsConfiable = 0 THEN N'OCULTA por defecto' ELSE N'visible' END AS EnLaUI,
       CASE WHEN Hostname = N'ZZ_VERIF_CONTRADICHO'
                 AND OrigenIP = N'Wifi' AND EsConfiable = 0 THEN N'OK'
            WHEN Hostname = N'ZZ_VERIF_CONTRADICHO' THEN N'FALLO: el TipoIP no mandó'
            ELSE N'-' END AS Regla
FROM dbo.vw_InventarioIPUnificado
WHERE Hostname LIKE 'ZZ_VERIF%'
ORDER BY Hostname;

/* El CHECK debe rechazar un OrigenIP fuera del catálogo. */
BEGIN TRY
    INSERT INTO dbo.InventarioGeneralIP
        (IP, Hostname, IdEstado, IdDispositivo, IdTipoEquipo, IdPiso, IdSite,
         IdTipoIP, FechaActualizacion, OrigenIP)
    VALUES ('10.99.99.4', 'ZZ_VERIF_MALO', @plantillaIdEstado, @plantillaIdDispositivo,
            @plantillaIdTipoEquipo, @plantillaIdPiso, @plantillaIdSite,
            @estatica, SYSUTCDATETIME(), 'Inventado');
    SELECT N'Procedencia' AS Bloque, N'FALLO' AS Resultado,
           N'el CHECK aceptó OrigenIP inválido' AS Detalle;
END TRY
BEGIN CATCH
    SELECT N'Procedencia' AS Bloque, N'OK' AS Resultado, ERROR_MESSAGE() AS Detalle;
END CATCH;

ROLLBACK;

SELECT N'Procedencia' AS Bloque, COUNT(*) AS FilasVerificacionRestantes
FROM dbo.InventarioGeneralIP WHERE Hostname LIKE 'ZZ_VERIF%';
GO

/* ---------------------------------------------------------------------------
   3. DIADEMA: el CHECK la acepta y la vista de piezas la expone completa.
   --------------------------------------------------------------------------- */
BEGIN TRAN;

DECLARE @activo INT = (SELECT TOP 1 IdActivoFijoEQ FROM dbo.ActivoFijoEquipos ORDER BY IdActivoFijoEQ);

INSERT INTO dbo.ActivoFijoEquiposComponentes
    (IdActivoFijoEQ, NoSerie, Hostname, TipoComponente, Clave, Marca, Modelo,
     Serie, Identificador, IdentificadorTipo, Confianza, Cantidad, Detalles,
     Vigente, LoteEnvio, PrimeraDeteccion, UltimaDeteccion,
     MAC, ConectadoA, EstadoConexion, Bateria)
SELECT @activo, AF.NoSerie, NULL, 'DIADEMA', 'ZZ-DIADEMA-PRUEBA', 'Jabra', 'Evolve 20',
       'ZZSERIE', 'ZZ-DIADEMA-PRUEBA', 'VID_PID', 'media', 1, N'{"prueba":true}',
       1, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(),
       'AA:BB:CC:DD:EE:FF', N'Bluetooth', 'Emparejada', 87
FROM dbo.ActivoFijoEquipos AF WHERE AF.IdActivoFijoEQ = @activo;

SELECT N'Diadema' AS Bloque, TipoComponente, Serie, MAC, ConectadoA, EstadoConexion,
       Bateria, NoSerieActivo
FROM dbo.vw_ActivoFijoPiezasUnificadas
WHERE Serie = 'ZZSERIE';

ROLLBACK;

SELECT N'Diadema' AS Bloque, COUNT(*) AS DiademasDePruebaRestantes
FROM dbo.ActivoFijoEquiposComponentes WHERE Serie = 'ZZSERIE';
GO

/* ---------------------------------------------------------------------------
   4. Red del colector: aparece en el control general IP y es volátil.
   ---------------------------------------------------------------------------
   Lo que reporta el colector vive en dbo.ActivoFijoEquiposRed, no en
   InventarioGeneralIP ni en Equipos. Si la vista no la lee, un equipo WiFi
   registrado nunca sale en la pantalla. Aquí se comprueba:
     · Tarjeta WiFi por DHCP  → Origen 'Activo', OrigenIP 'Wifi', confiable 0
     · Tarjeta Ethernet fija  → Origen 'Activo', OrigenIP 'Manual', confiable 1
     · La MISMA MAC repetida (mismo equipo capturado dos veces) se muestra
       una sola vez: la vista deduplica por MAC.
   --------------------------------------------------------------------------- */
BEGIN TRAN;

DECLARE @activoRed INT = (SELECT TOP 1 IdActivoFijoEQ FROM dbo.ActivoFijoEquipos ORDER BY IdActivoFijoEQ);

IF @activoRed IS NOT NULL
BEGIN
    INSERT INTO dbo.ActivoFijoEquiposRed
        (IdActivoFijoEQ, NoSerie, Hostname, Clave, NombreAdaptador, DescripcionAdaptador,
         TipoMedio, MAC, IP, Mascara, PrefijoRed, PuertaEnlace, DHCP,
         EsPrincipal, Vigente, PrimeraDeteccion, UltimaDeteccion)
    VALUES
        /* WiFi + DHCP, principal */
        (@activoRed, N'ZZSERIE', N'ZZ_RED_WIFI', N'ZZ-RED-WIFI-1', N'ZZ Wi-Fi Adapter',
         N'ZZ Wi-Fi Adapter', N'Native 802.11', 'AA:BB:CC:00:00:01', '10.99.99.11',
         '255.255.255.0', 24, '10.99.99.1', 1, 1, 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
        /* La misma tarjeta capturada de nuevo: no debe duplicarse en la vista */
        (@activoRed, N'ZZSERIE', N'ZZ_RED_WIFI', N'ZZ-RED-WIFI-2', N'ZZ Wi-Fi Adapter',
         N'ZZ Wi-Fi Adapter', N'Native 802.11', 'AA:BB:CC:00:00:01', '10.99.99.11',
         '255.255.255.0', 24, '10.99.99.1', 1, 0, 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
        /* Ethernet con IP fija: inventario duro */
        (@activoRed, N'ZZSERIE', N'ZZ_RED_LAN', N'ZZ-RED-LAN-1', N'ZZ Ethernet Adapter',
         N'ZZ Ethernet Adapter', N'802.3', 'AA:BB:CC:00:00:02', '10.99.99.12',
         '255.255.255.0', 24, '10.99.99.1', 0, 1, 1, SYSUTCDATETIME(), SYSUTCDATETIME());

    SELECT N'RedColector' AS Bloque, Origen, Hostname, IP, MAC, TipoIP, OrigenIP,
           EsConfiable,
           CASE WHEN Hostname = N'ZZ_RED_WIFI' AND Origen = N'Activo'
                     AND OrigenIP = N'Wifi' AND EsConfiable = 0 THEN N'OK'
                WHEN Hostname = N'ZZ_RED_LAN' AND Origen = N'Activo'
                     AND OrigenIP = N'Manual' AND EsConfiable = 1 THEN N'OK'
                WHEN Hostname LIKE N'ZZ_RED%' THEN N'FALLO: procedencia incorrecta'
                ELSE N'-' END AS Regla
    FROM dbo.vw_InventarioIPUnificado
    WHERE Hostname LIKE N'ZZ_RED%'
    ORDER BY Hostname;

    /* Deduplicación: tres filas insertadas, dos MAC distintas → 2 renglones. */
    SELECT N'RedColector' AS Bloque,
           COUNT(*) AS Renglones,
           COUNT(DISTINCT MAC) AS MacsDistintas,
           CASE WHEN COUNT(*) = COUNT(DISTINCT MAC) THEN N'OK'
                ELSE N'FALLO: la misma MAC sale repetida' END AS Regla
    FROM dbo.vw_InventarioIPUnificado
    WHERE Hostname LIKE N'ZZ_RED%';
END

ROLLBACK;

SELECT N'RedColector' AS Bloque, COUNT(*) AS RedesDePruebaRestantes
FROM dbo.ActivoFijoEquiposRed WHERE Hostname LIKE N'ZZ_RED%';
GO

PRINT 'Verificación terminada: revisa que todos los "Existe" sean 1, que WiFi/DHCP salgan con EsConfiable 0 y que no queden filas de prueba.';
GO
