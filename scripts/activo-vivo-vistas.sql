/*
  ============================================================================
  ACTIVO VIVO — Vistas unificadas (IP/Hostname/MAC + piezas del activo)
  ============================================================================
  Objetivo: dejar de tener IP, hostnames y series "regados" en varias
  tablas. NO se duplican columnas ni se copian datos: se expone UNA sola
  fila por equipo/pieza mediante JOINs, y la app (y el colector) leen de
  aquí.

  Fuente de verdad (no se mueve nada):
    dbo.InventarioGeneralIP        → infraestructura (control general)
    dbo.Equipos + dbo.Clientes     → equipos de clientes (inventario viejo)
    dbo.EquiposControlGeneralIP    → datos complementarios del equipo
    dbo.ActivoFijoEquiposRed       → red que reporta el colector para cada
                                     activo fijo (IP/MAC/DHCP/adaptador)
    dbo.CatalogosInventarioIP      → catálogos (Estado/Dispositivo/Piso/...)
    dbo.ActivoFijoEquiposComponentes → piezas que cuelgan del activo
                                     (monitor, disco, teclado, ratón, DIADEMA)

  Ejecutar DESPUÉS de:
    - control-general-ip.sql
    - control-general-ip-datos-clientes.sql
    - activo-fijo-detalle.sql
    - activo-vivo-unificado.sql
  Es idempotente (CREATE OR ALTER VIEW) y de sólo lectura.
  ============================================================================
*/

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   Red de seguridad: el script asume las columnas de procedencia de IP que
   agrega activo-vivo-unificado.sql. Si no se ejecutó, se agregan aquí para
   que las vistas no fallen (mismas definiciones, aditivas y NULLables).
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.InventarioGeneralIP', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.InventarioGeneralIP', 'OrigenIP') IS NULL
        ALTER TABLE dbo.InventarioGeneralIP ADD OrigenIP VARCHAR(20) NULL;

    IF COL_LENGTH('dbo.InventarioGeneralIP', 'EsConfiable') IS NULL
        ALTER TABLE dbo.InventarioGeneralIP
            ADD EsConfiable BIT NOT NULL
                CONSTRAINT DF_InventarioGeneralIP_Confiable DEFAULT (1);
END
GO

/* ---------------------------------------------------------------------------
   1. vw_InventarioIPUnificado
   ---------------------------------------------------------------------------
   Una fila por dirección registrada, venga del control general, de un
   equipo de cliente o del colector (red del activo fijo). Es exactamente
   la UNIÓN que hoy se escribe dentro de src/js/db/inventario-ip.js
   (listar()), pero en la base: cualquier otra pantalla / el colector
   pueden leerla sin repetir la consulta.

   Tres orígenes (columna Origen):
     'General' → dbo.InventarioGeneralIP  (infraestructura capturada a mano)
     'Cliente' → dbo.Equipos estáticos activos de un cliente
     'Activo'  → dbo.ActivoFijoEquiposRed (lo que reporta el colector para
                 cada activo fijo: laptops por WiFi, DHCP, WORKGROUP...).
                 Antes no se leía aquí, así que esos equipos nunca
                 aparecían en el control general de IP.

   Columnas de procedencia (regla de negocio):
     OrigenIP     'Manual' (estática), 'DHCP', 'Wifi' u 'Otro'.
     EsConfiable  1 = dirección estable y verificable.
                  0 = dirección volátil (DHCP o controlador WiFi): sirve
                  como referencia, NO como inventario duro.
   Lo que provenga de un TipoIP "WiFi (controlador)" se marca como volátil
   automáticamente, aunque la importación no lo haya dicho.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_InventarioIPUnificado
AS
SELECT
    Inventario.Origen,
    Inventario.IdInventarioIP,
    Inventario.IdEquipo,
    Inventario.IP,
    Inventario.Hostname,
    Inventario.MAC,
    Inventario.Descripcion,
    Inventario.PuertoFortinet,
    Inventario.Estado,
    Inventario.Dispositivo,
    Inventario.TipoEquipo,
    Inventario.Piso,
    Inventario.Site,
    Inventario.TipoIP,
    Inventario.ClienteCodigo,
    Inventario.ClienteNombre,
    Inventario.OrigenIP,
    Inventario.EsConfiable,
    Inventario.FechaActualizacion,
    Inventario.IdEstado,
    Inventario.IdDispositivo,
    Inventario.IdTipoEquipo,
    Inventario.IdPiso,
    Inventario.IdSite,
    Inventario.IdTipoIP
FROM (
    /* ---- Control general (infraestructura, sin cliente) ---- */
    SELECT N'General' AS Origen,
           I.IdInventarioIP,
           CAST(NULL AS INT) AS IdEquipo,
           I.IP,
           I.Hostname,
           I.MAC,
           I.Descripcion,
           I.PuertoFortinet,
           Estado.Nombre      AS Estado,
           Dispositivo.Nombre AS Dispositivo,
           TipoEquipo.Nombre  AS TipoEquipo,
           Piso.Nombre        AS Piso,
           Site.Nombre        AS Site,
           TipoIP.Nombre      AS TipoIP,
           CAST(NULL AS NVARCHAR(10))  AS ClienteCodigo,
           CAST(NULL AS NVARCHAR(150)) AS ClienteNombre,
           /* Procedencia: lo capturado a mano es fijo; DHCP/Dinámica/WiFi es
              volátil. Si el TipoIP dice volátil, manda el catálogo por encima
              del dato guardado: así una fila capturada como 'Manual' con
              TipoIP WiFi se muestra (y se lee) como volátil, y nunca cuenta
              como inventario duro. Mismo criterio que procedenciaPorTipoIP()
              en src/js/db/inventario-ip.js. */
           CASE
               WHEN TipoIP.Nombre LIKE N'WiFi%'      THEN 'Wifi'
               WHEN TipoIP.Nombre LIKE N'DHCP%'      THEN 'DHCP'
               WHEN TipoIP.Nombre LIKE N'Din[aá]mic%' THEN 'DHCP'
               WHEN I.OrigenIP IS NOT NULL           THEN I.OrigenIP
               ELSE 'Manual'
           END AS OrigenIP,
           CASE
               WHEN TipoIP.Nombre LIKE N'WiFi%'       THEN CAST(0 AS BIT)
               WHEN TipoIP.Nombre LIKE N'DHCP%'       THEN CAST(0 AS BIT)
               WHEN TipoIP.Nombre LIKE N'Din[aá]mic%' THEN CAST(0 AS BIT)
               ELSE ISNULL(I.EsConfiable, 1)
           END AS EsConfiable,
           I.FechaActualizacion,
           I.IdEstado,
           I.IdDispositivo,
           I.IdTipoEquipo,
           I.IdPiso,
           I.IdSite,
           I.IdTipoIP
    FROM dbo.InventarioGeneralIP I
    LEFT JOIN dbo.CatalogosInventarioIP Estado      ON Estado.IdCatalogoIP      = I.IdEstado
    LEFT JOIN dbo.CatalogosInventarioIP Dispositivo ON Dispositivo.IdCatalogoIP = I.IdDispositivo
    LEFT JOIN dbo.CatalogosInventarioIP TipoEquipo  ON TipoEquipo.IdCatalogoIP  = I.IdTipoEquipo
    LEFT JOIN dbo.CatalogosInventarioIP Piso        ON Piso.IdCatalogoIP        = I.IdPiso
    LEFT JOIN dbo.CatalogosInventarioIP Site        ON Site.IdCatalogoIP        = I.IdSite
    LEFT JOIN dbo.CatalogosInventarioIP TipoIP      ON TipoIP.IdCatalogoIP      = I.IdTipoIP

    UNION ALL

    /* ---- Equipos de clientes con IP estática activa (los que ya
            funcionan al 100: no se tocan, sólo se leen) ---- */
    SELECT N'Cliente' AS Origen,
           CAST(NULL AS INT) AS IdInventarioIP,
           E.IdEquipo,
           LTRIM(RTRIM(E.IP)) AS IP,
           E.Hostname,
           Datos.MAC,
           Datos.Descripcion,
           Datos.PuertoFortinet,
           CASE WHEN E.Activo = 1 THEN N'Activo' ELSE N'Inactivo' END AS Estado,
           Dispositivo.Nombre AS Dispositivo,
           TipoEquipo.Nombre  AS TipoEquipo,
           P.Nombre           AS Piso,
           Site.Nombre        AS Site,
           E.TipoIP,
           C.Codigo AS ClienteCodigo,
           C.Nombre AS ClienteNombre,
           CASE WHEN E.TipoIP = N'Estatica' THEN 'Manual' ELSE 'DHCP' END AS OrigenIP,
           CASE WHEN E.TipoIP = N'Estatica' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS EsConfiable,
           Datos.FechaActualizacion,
           CAST(NULL AS INT) AS IdEstado,
           Datos.IdDispositivo,
           Datos.IdTipoEquipo,
           E.IdPiso,
           Datos.IdSite,
           CAST(NULL AS INT) AS IdTipoIP
    FROM dbo.Equipos E
    INNER JOIN dbo.Clientes C ON C.IdCliente = E.IdCliente
    LEFT JOIN dbo.Pisos P ON P.IdPiso = E.IdPiso
    LEFT JOIN dbo.EquiposControlGeneralIP Datos ON Datos.IdEquipo = E.IdEquipo
    LEFT JOIN dbo.CatalogosInventarioIP Dispositivo ON Dispositivo.IdCatalogoIP = Datos.IdDispositivo
    LEFT JOIN dbo.CatalogosInventarioIP TipoEquipo  ON TipoEquipo.IdCatalogoIP  = Datos.IdTipoEquipo
    LEFT JOIN dbo.CatalogosInventarioIP Site        ON Site.IdCatalogoIP        = Datos.IdSite
    WHERE E.TipoIP = N'Estatica'
      AND E.Activo = 1
      AND NULLIF(LTRIM(RTRIM(E.IP)), '') IS NOT NULL

    UNION ALL

    /* ---- Red que reporta el colector para cada activo fijo ----
       dbo.ActivoFijoEquiposRed es la única tabla que sabe la IP de una
       laptop/desktop administrada: no vive en InventarioGeneralIP (control
       general) ni en Equipos (clientes). Sin este bloque, todo lo que
       captura el colector (WiFi, DHCP, WORKGROUP) queda invisible en el
       control general aunque el equipo esté registrado.

       Un solo renglón por tarjeta de red: se agrupa por MAC (o por IP si
       el adaptador no expone MAC), no por activo, porque la misma tarjeta
       puede venir registrada dos veces (una fila huérfana sin activo y la
       fila buena, o dos registros duplicados del mismo equipo) y eso
       pintaba la misma IP repetida en el control general. De cada grupo se
       toma el adaptador principal vigente y, si ninguno lo está, el visto
       por última vez (mismo criterio que vw_ActivoFijoEquipoInline en
       scripts/activo-fijo-detalle.sql).

       Procedencia: un adaptador WiFi o una IP por DHCP es volátil
       (EsConfiable = 0); una IP fija capturada se considera inventario
       duro (Manual / 1). Un equipo DHCP puede venir sin IP: se registra
       igual y la dirección se completa en la siguiente pasada. */
    SELECT N'Activo' AS Origen,
           CAST(NULL AS INT) AS IdInventarioIP,
           CAST(NULL AS INT) AS IdEquipo,
           NULLIF(LTRIM(RTRIM(A.IP)), '') AS IP,
           A.Hostname,
           A.MAC,
           COALESCE(NULLIF(LTRIM(RTRIM(A.DescripcionAdaptador)), N''),
                    NULLIF(LTRIM(RTRIM(A.NombreAdaptador)), N'')) AS Descripcion,
           CAST(NULL AS NVARCHAR(100)) AS PuertoFortinet,
           N'Activo' AS Estado,
           NULLIF(LTRIM(RTRIM(A.NombreAdaptador)), N'') AS Dispositivo,
           COALESCE(NULLIF(LTRIM(RTRIM(A.TipoMedio)), N''),
                    NULLIF(LTRIM(RTRIM(A.DescripcionAdaptador)), N'')) AS TipoEquipo,
           CAST(NULL AS NVARCHAR(150)) AS Piso,
           CAST(NULL AS NVARCHAR(150)) AS Site,
           CASE WHEN A.EsWifi = 1      THEN N'WiFi'
                WHEN A.DHCP = 1        THEN N'DHCP'
                ELSE N'Estatica' END               AS TipoIP,
           CAST(NULL AS NVARCHAR(10))  AS ClienteCodigo,
           CAST(NULL AS NVARCHAR(150)) AS ClienteNombre,
           CASE WHEN A.EsWifi = 1 THEN 'Wifi'
                WHEN A.DHCP = 1   THEN 'DHCP'
                ELSE 'Manual' END                  AS OrigenIP,
           CASE WHEN A.EsWifi = 1 OR A.DHCP = 1
                THEN CAST(0 AS BIT)
                ELSE CAST(1 AS BIT) END            AS EsConfiable,
           A.UltimaDeteccion AS FechaActualizacion,
           CAST(NULL AS INT) AS IdEstado,
           CAST(NULL AS INT) AS IdDispositivo,
           CAST(NULL AS INT) AS IdTipoEquipo,
           CAST(NULL AS INT) AS IdPiso,
           CAST(NULL AS INT) AS IdSite,
           CAST(NULL AS INT) AS IdTipoIP
    FROM (
        SELECT R.IdActivoFijoEQ,
               R.Hostname, R.MAC, R.IP, R.NombreAdaptador,
               R.DescripcionAdaptador, R.TipoMedio, R.DHCP,
               R.UltimaDeteccion,
               ROW_NUMBER() OVER (
                   /* Una tarjeta de red = una MAC. Si no hay MAC se usa la
                      IP y, en último caso, el propio renglón (IdEquipoRed),
                      para no colapsar adaptadores distintos sin datos. */
                   PARTITION BY COALESCE(
                       NULLIF(LTRIM(RTRIM(R.MAC)), N''),
                       CONCAT(N'IP:', COALESCE(NULLIF(LTRIM(RTRIM(R.IP)), N''),
                                               CONCAT(N'R', R.IdEquipoRed)))
                   )
                   ORDER BY CASE WHEN R.IdActivoFijoEQ IS NULL THEN 1 ELSE 0 END,
                            R.EsPrincipal DESC, R.UltimaDeteccion DESC, R.IdEquipoRed DESC
               ) AS Renglon,
               CASE WHEN ISNULL(R.TipoMedio, N'')          LIKE N'%Wi%Fi%'
                      OR ISNULL(R.TipoMedio, N'')          LIKE N'%Wireless%'
                      OR ISNULL(R.TipoMedio, N'')          LIKE N'%WLAN%'
                      OR ISNULL(R.NombreAdaptador, N'')    LIKE N'%Wi%Fi%'
                      OR ISNULL(R.NombreAdaptador, N'')    LIKE N'%Wireless%'
                      OR ISNULL(R.DescripcionAdaptador, N'') LIKE N'%Wi%Fi%'
                      OR ISNULL(R.DescripcionAdaptador, N'') LIKE N'%Wireless%'
                    THEN 1 ELSE 0 END AS EsWifi
        FROM dbo.ActivoFijoEquiposRed R
        WHERE R.Vigente = 1
    ) A
    WHERE A.Renglon = 1
) Inventario;
GO

/* ---------------------------------------------------------------------------
   2. vw_ActivoFijoPiezasUnificadas
   ---------------------------------------------------------------------------
   Cada pieza (monitor, disco, teclado, ratón, DIADEMA) con el activo al
   que pertenece y el empate con el inventario anterior por NoSerie.
   Así la serie/MAC/hostname de una pieza no tiene que copiarse en la
   tabla de piezas: se resuelve por JOIN.

   Las columnas de diadema (MAC, ConectadoA, EstadoConexion, Bateria) las
   agrega activo-vivo-unificado.sql; si aún no existen, se crean aquí
   vacías para que las vistas y la app no fallen.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'MAC') IS NULL
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ADD MAC VARCHAR(17) NULL;

    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'ConectadoA') IS NULL
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ADD ConectadoA NVARCHAR(300) NULL;

    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'EstadoConexion') IS NULL
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ADD EstadoConexion VARCHAR(30) NULL;

    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'Bateria') IS NULL
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ADD Bateria TINYINT NULL;
END
GO

CREATE OR ALTER VIEW dbo.vw_ActivoFijoPiezasUnificadas
AS
SELECT
    CP.IdEquipoComponente,
    CP.IdActivoFijoEQ,
    CP.TipoComponente,
    CP.Clave,
    CP.Marca,
    CP.Modelo,
    CP.Serie,
    CP.Identificador,
    CP.IdentificadorTipo,
    CP.Confianza,
    CP.Cantidad,
    CP.Detalles,
    CP.Vigente,
    CP.LoteEnvio,
    CP.PrimeraDeteccion,
    CP.UltimaDeteccion,
    /* Diademas: cómo se conecta y cuánta batería trae. */
    CP.MAC,
    CP.ConectadoA,
    CP.EstadoConexion,
    CP.Bateria,
    /* Dueño de la pieza: el activo (CPU), no un activo suelto. */
    AF.NoSerie          AS NoSerieActivo,
    /* Empate con el inventario anterior (3FN: por NoSerieCPU, sin copiar). */
    EQ.IdEquipo         AS IdEquipoInventario,
    EQ.Hostname         AS HostnameEquipo
FROM dbo.ActivoFijoEquiposComponentes CP
INNER JOIN dbo.ActivoFijoEquipos AF ON AF.IdActivoFijoEQ = CP.IdActivoFijoEQ
LEFT JOIN dbo.Equipos EQ ON EQ.NoSerieCPU = AF.NoSerie;
GO

/* ---------------------------------------------------------------------------
   3. Verificación: las dos vistas deben existir (Existe = 1) y responder.
   --------------------------------------------------------------------------- */
/* El COUNT va en SQL dinámico: si una vista no llegó a crearse, este lote
   informa "Existe = 0" en lugar de fallar por compilación. */
DECLARE @FilasIP INT = NULL, @FilasPiezas INT = NULL;

IF OBJECT_ID(N'dbo.vw_InventarioIPUnificado', N'V') IS NOT NULL
    EXEC sp_executesql
        N'SELECT @n = COUNT(*) FROM dbo.vw_InventarioIPUnificado;',
        N'@n INT OUTPUT', @n = @FilasIP OUTPUT;

IF OBJECT_ID(N'dbo.vw_ActivoFijoPiezasUnificadas', N'V') IS NOT NULL
    EXEC sp_executesql
        N'SELECT @n = COUNT(*) FROM dbo.vw_ActivoFijoPiezasUnificadas;',
        N'@n INT OUTPUT', @n = @FilasPiezas OUTPUT;

SELECT N'dbo.vw_InventarioIPUnificado' AS Vista,
       CAST(CASE WHEN OBJECT_ID(N'dbo.vw_InventarioIPUnificado', N'V') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT) AS Existe,
       @FilasIP AS Filas
UNION ALL
SELECT N'dbo.vw_ActivoFijoPiezasUnificadas',
       CAST(CASE WHEN OBJECT_ID(N'dbo.vw_ActivoFijoPiezasUnificadas', N'V') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT),
       @FilasPiezas;
GO

/* Desglose por origen y procedencia. Aquí deben aparecer las tres fuentes
   ('General', 'Cliente', 'Activo'). Si 'Activo' no sale, el colector aún no
   ha insertado en dbo.ActivoFijoEquiposRed (Vigente = 1). */
IF OBJECT_ID(N'dbo.vw_InventarioIPUnificado', N'V') IS NOT NULL
    EXEC sp_executesql N'
        SELECT Origen, OrigenIP, EsConfiable, COUNT(*) AS Filas
        FROM dbo.vw_InventarioIPUnificado
        GROUP BY Origen, OrigenIP, EsConfiable
        ORDER BY Origen, OrigenIP;';
GO

PRINT 'Listo: vistas unificadas vw_InventarioIPUnificado y vw_ActivoFijoPiezasUnificadas creadas.';
GO
