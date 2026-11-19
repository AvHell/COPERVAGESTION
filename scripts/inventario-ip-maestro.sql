/* ===========================================================================
   INVENTARIO IP — TABLA MAESTRA ÚNICA
   ---------------------------------------------------------------------------
   PROBLEMA QUE RESUELVE
   Hoy la misma dirección IP puede existir en tres lugares distintos:
     · dbo.InventarioGeneralIP        (Control general, capturado a mano)
     · dbo.Equipos + EquiposControlGeneralIP (módulo Equipos / clientes)
     · dbo.ActivoFijoEquiposRed       (colector, red del activo fijo)
   De ahí salen los "choques": la misma IP aparece dos veces, o el renglón
   que trae la MAC no trae el piso y viceversa.

   QUÉ HACE ESTE SCRIPT
   Crea UNA sola tabla consolidada, dbo.InventarioIPMaestro, con una fila por
   dirección IP. NO mueve, NO borra y NO reescribe los datos originales:
   las tres tablas de origen se quedan exactamente como están y cada módulo
   sigue escribiendo en la suya, con su flujo intacto.

   CÓMO SE MANTIENE SINCRONIZADA
   Un trigger por tabla de origen copia a la maestra SOLO las columnas que ese
   origen posee (ver tabla de propiedad más abajo). La maestra es un espejo,
   nunca la fuente de verdad: si un trigger falla, el origen ya quedó escrito
   y el error se ignora (TRY/CATCH) para no romper el flujo del módulo.

   PROPIEDAD DE COLUMNAS (quién manda en cada dato)
     Técnico   (Hostname, MAC, DescripcionTecnica, OrigenIP, EsConfiable,
                Mascara, PuertaEnlace, DNS, Dominio)
                Colector > Equipos > Control general
     Gestión   (IdDispositivo, IdTipoEquipo, IdPiso, IdCliente, IdSite,
                PuertoFortinet, Descripcion)
                InventarioIPGestion (edición explícita en la pantalla)
                  > Control general > Equipos > Colector
     Vínculos  (IdInventarioIP, IdEquipo, IdActivoFijoEQ, IdEquipoRed)
                cada origen escribe sólo el suyo

   REGLA DE ORO: si la fila está marcada GestionManual = 1 (alguien la editó
   en "Control general de IP"), ningún origen automático vuelve a escribir las
   columnas de gestión. Así el colector no vuelve a planchar el piso, el
   cliente, el switch, el puerto Fortinet ni la descripción.

   Es idempotente: se puede ejecutar las veces que haga falta.
   =========================================================================== */

SET NOCOUNT ON;

/* ---------------------------------------------------------------------------
   1. TABLA MAESTRA
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.InventarioIPMaestro', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InventarioIPMaestro
    (
        IdIPMaestro        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InventarioIPMaestro PRIMARY KEY,
        IP                 VARCHAR(45)      NOT NULL,

        /* ---- Datos técnicos (los escribe el colector / el módulo Equipos) ---- */
        Hostname           NVARCHAR(255)    NULL,
        MAC                VARCHAR(17)      NULL,
        DescripcionTecnica NVARCHAR(1000)   NULL,   -- p.ej. "Intel(R) Ethernet Connection (2) I219-LM #2"
        NombreAdaptador    NVARCHAR(200)    NULL,   -- p.ej. "Ethernet 2"
        TipoMedio          NVARCHAR(100)    NULL,
        DHCP               BIT              NULL,
        Mascara            VARCHAR(45)      NULL,
        PuertoEnlace       VARCHAR(45)      NULL,   -- gateway (nombre propio para no confundir con PuertoFortinet)
        DNS1               VARCHAR(45)      NULL,
        DNS2               VARCHAR(45)      NULL,
        Dominio            NVARCHAR(150)    NULL,

        /* ---- Gestión (lo captura una persona en Control general de IP) ---- */
        IdEstado           INT              NULL,   -- CatalogosInventarioIP 'Estado'
        IdDispositivo      INT              NULL,   -- CatalogosInventarioIP 'Dispositivo'
        IdTipoEquipo       INT              NULL,   -- CatalogosInventarioIP 'TipoEquipo'
        IdPiso             INT              NULL,   -- CatalogosInventarioIP 'Piso'
        IdSite             INT              NULL,   -- CatalogosInventarioIP 'Site'
        IdCliente          INT              NULL,   -- dbo.Clientes
        IdPisoPlano        INT              NULL,   -- dbo.Pisos (el catálogo del plano, es OTRO)
        PuertoFortinet     NVARCHAR(200)    NULL,
        Descripcion        NVARCHAR(1000)   NULL,   -- descripción legible para el usuario

        /* ---- Procedencia de la dirección ---- */
        OrigenIP           VARCHAR(20)      NULL,   -- Manual | DHCP | Wifi | Otro
        EsConfiable        BIT              NOT NULL CONSTRAINT DF_IPMaestro_Confiable DEFAULT (1),

        /* ---- Vínculos con el registro original de cada módulo ---- */
        IdInventarioIP     INT              NULL,   -- dbo.InventarioGeneralIP
        IdEquipo           INT              NULL,   -- dbo.Equipos
        IdActivoFijoEQ     INT              NULL,   -- dbo.ActivoFijoEquipos
        IdEquipoRed        INT              NULL,   -- dbo.ActivoFijoEquiposRed
        ClaveGestion       VARCHAR(60)      NULL,   -- misma clave que dbo.InventarioIPGestion

        /* ---- Banderas de origen (una IP puede estar en varios) ---- */
        EnGeneral          BIT NOT NULL CONSTRAINT DF_IPMaestro_EnGeneral  DEFAULT (0),
        EnCliente          BIT NOT NULL CONSTRAINT DF_IPMaestro_EnCliente  DEFAULT (0),
        EnColector         BIT NOT NULL CONSTRAINT DF_IPMaestro_EnColector DEFAULT (0),

        /* ---- Control de propiedad ---- */
        FuenteGestion      VARCHAR(10)      NULL,   -- General | Cliente | Colector
        GestionManual      BIT NOT NULL CONSTRAINT DF_IPMaestro_GestionManual DEFAULT (0),

        FechaAlta          DATETIME2(0) NOT NULL CONSTRAINT DF_IPMaestro_FechaAlta DEFAULT (SYSDATETIME()),
        FechaActualizacion DATETIME2(0) NOT NULL CONSTRAINT DF_IPMaestro_FechaAct    DEFAULT (SYSDATETIME())
    );
END
GO

/* Columnas añadidas después, por si la tabla ya existía de una versión previa */
IF COL_LENGTH('dbo.InventarioIPMaestro', 'NombreAdaptador') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD NombreAdaptador NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'TipoMedio') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD TipoMedio NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'DHCP') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD DHCP BIT NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'Mascara') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD Mascara VARCHAR(45) NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'PuertoEnlace') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD PuertoEnlace VARCHAR(45) NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'DNS1') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD DNS1 VARCHAR(45) NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'DNS2') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD DNS2 VARCHAR(45) NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'Dominio') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD Dominio NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'IdPisoPlano') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD IdPisoPlano INT NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'IdEquipoRed') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD IdEquipoRed INT NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'ClaveGestion') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD ClaveGestion VARCHAR(60) NULL;
IF COL_LENGTH('dbo.InventarioIPMaestro', 'GestionManual') IS NULL
    ALTER TABLE dbo.InventarioIPMaestro ADD GestionManual BIT NOT NULL CONSTRAINT DF_IPMaestro_GestionManual2 DEFAULT (0);
GO

/* Índice único por IP: la razón de ser de la tabla. Filtrado para no chocar
   con posibles filas sin IP (hoy la columna es NOT NULL, pero por si acaso). */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_InventarioIPMaestro_IP'
                                             AND object_id = OBJECT_ID('dbo.InventarioIPMaestro'))
    CREATE UNIQUE INDEX UX_InventarioIPMaestro_IP
        ON dbo.InventarioIPMaestro(IP)
        WHERE IP IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_IPMaestro_ClaveGestion'
                                             AND object_id = OBJECT_ID('dbo.InventarioIPMaestro'))
    CREATE INDEX IX_IPMaestro_ClaveGestion ON dbo.InventarioIPMaestro(ClaveGestion);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_IPMaestro_IdCliente'
                                             AND object_id = OBJECT_ID('dbo.InventarioIPMaestro'))
    CREATE INDEX IX_IPMaestro_IdCliente ON dbo.InventarioIPMaestro(IdCliente);
GO

/* ---------------------------------------------------------------------------
   2. RECALCULO
   ---------------------------------------------------------------------------
   dbo.sp_IPMaestroRefrescar reconstruye la fila de UNA IP (o de todas)
   leyendo los tres orígenes. NO abre transacción: lo llaman igual la
   resincronización completa y los triggers de baja, que ya corren dentro de
   la transacción de su propia sentencia.

       EXEC dbo.sp_IPMaestroRefrescar;                     -- todas
       EXEC dbo.sp_IPMaestroRefrescar @IP = '10.0.0.5';    -- una sola

   Se LIMPIA lo derivado y se vuelve a calcular en vez de parchearlo: así, si
   un origen desaparece, sus datos se van con él y no quedan fantasmas (el
   caso de las IP que se seguían viendo como "General" después de borrar el
   registro del control general). Nunca borra filas: si la IP ya no está en
   ningún origen se queda con las tres banderas en 0 y la vista la oculta.
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_IPMaestroRefrescar
    @IP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ahora DATETIME2(0) = SYSDATETIME();
    SET @IP = NULLIF(LTRIM(RTRIM(@IP)), '');

    /* 2.1 Una fila por IP de cualquiera de los tres orígenes (INSERT puro). */
    ;WITH ip AS (
        SELECT NULLIF(LTRIM(RTRIM(IP)), '') AS IP FROM dbo.InventarioGeneralIP
        UNION
        SELECT NULLIF(LTRIM(RTRIM(IP)), '') FROM dbo.Equipos WHERE Activo = 1
        UNION
        SELECT NULLIF(LTRIM(RTRIM(IP)), '') FROM dbo.ActivoFijoEquiposRed WHERE Vigente = 1
    )
    INSERT INTO dbo.InventarioIPMaestro (IP, FechaAlta, FechaActualizacion, EsConfiable)
    SELECT ip.IP, @ahora, @ahora, 1
    FROM ip
    WHERE ip.IP IS NOT NULL
      AND (@IP IS NULL OR ip.IP = @IP)
      AND NOT EXISTS (SELECT 1 FROM dbo.InventarioIPMaestro m WHERE m.IP = ip.IP);

    /* 2.2 Se limpia todo lo derivado de la fila. Lo único que se conserva es
           la IP y la fecha de alta: la maestra es un espejo, no una fuente.
           GestionManual también se recalcula (lo vuelve a poner el paso 2.9
           sólo si hay fila en dbo.InventarioIPGestion); si no, al retirar la
           gestión la fila quedaría bloqueada para siempre. */
    UPDATE m
       SET m.Hostname = NULL, m.MAC = NULL, m.DescripcionTecnica = NULL,
           m.NombreAdaptador = NULL, m.TipoMedio = NULL, m.DHCP = NULL,
           m.Mascara = NULL, m.PuertoEnlace = NULL, m.DNS1 = NULL, m.DNS2 = NULL,
           m.Dominio = NULL, m.OrigenIP = NULL, m.EsConfiable = 1,
           m.IdEstado = NULL, m.IdDispositivo = NULL, m.IdTipoEquipo = NULL,
           m.IdPiso = NULL, m.IdSite = NULL, m.IdCliente = NULL,
           m.IdPisoPlano = NULL, m.PuertoFortinet = NULL, m.Descripcion = NULL,
           m.IdInventarioIP = NULL, m.IdEquipo = NULL, m.IdActivoFijoEQ = NULL,
           m.IdEquipoRed = NULL, m.ClaveGestion = NULL,
           m.FuenteGestion = NULL, m.GestionManual = 0
      FROM dbo.InventarioIPMaestro m
     WHERE @IP IS NULL OR m.IP = @IP;

    /* 2.3 Banderas de origen: reflejan exactamente lo que hay hoy. */
    UPDATE m
       SET m.EnGeneral = CASE WHEN EXISTS (SELECT 1 FROM dbo.InventarioGeneralIP g
                                            WHERE LTRIM(RTRIM(g.IP)) = m.IP) THEN 1 ELSE 0 END,
           m.EnCliente = CASE WHEN EXISTS (SELECT 1 FROM dbo.Equipos e
                                            WHERE e.Activo = 1 AND LTRIM(RTRIM(e.IP)) = m.IP) THEN 1 ELSE 0 END,
           m.EnColector = CASE WHEN EXISTS (SELECT 1 FROM dbo.ActivoFijoEquiposRed r
                                             WHERE r.Vigente = 1 AND LTRIM(RTRIM(r.IP)) = m.IP) THEN 1 ELSE 0 END
      FROM dbo.InventarioIPMaestro m
     WHERE @IP IS NULL OR m.IP = @IP;

    /* 2.4 Columnas técnicas, en orden de menor a mayor autoridad:
           Control general → Equipos → Colector (el último gana).        */

    /* 2.4.a Control general.
           OJO: dbo.InventarioGeneralIP NO tiene columna Mascara. Una versión
           anterior copiaba aquí su MAC y dejaba la máscara con un valor
           imposible (00:23:24:B5:88:B5). La máscara sólo la aportan Equipos
           y el colector, que son los que de verdad la conocen. */
    UPDATE m
       SET m.IdInventarioIP = g.IdInventarioIP,
           m.Hostname       = COALESCE(NULLIF(LTRIM(RTRIM(g.Hostname)), ''), m.Hostname),
           m.MAC            = COALESCE(NULLIF(LTRIM(RTRIM(g.MAC)), ''), m.MAC),
           m.IdEstado       = g.IdEstado,
           m.FechaActualizacion = @ahora
      FROM dbo.InventarioIPMaestro m
      JOIN dbo.InventarioGeneralIP g ON LTRIM(RTRIM(g.IP)) = m.IP
     WHERE @IP IS NULL OR m.IP = @IP;

    /* 2.4.b Equipos de cliente (+ su control general, que guarda MAC)
           El piso de Equipos es del catálogo del plano (dbo.Pisos), por eso
           va a IdPisoPlano y limpia IdPiso: las dos columnas son
           excluyentes (ver §2.10 y el trigger del colector).
           Si la fila está gestionada a mano se respeta lo elegido.        */
    UPDATE m
       SET m.IdEquipo   = x.IdEquipo,
           m.IdCliente  = x.IdCliente,
           m.IdPisoPlano = CASE WHEN m.GestionManual = 1 AND m.IdPiso IS NOT NULL
                                THEN m.IdPisoPlano ELSE x.IdPiso END,
           m.IdPiso     = CASE WHEN m.GestionManual = 1 THEN m.IdPiso
                               WHEN x.IdPiso IS NOT NULL THEN NULL
                               ELSE m.IdPiso END,
           m.Hostname   = COALESCE(NULLIF(LTRIM(RTRIM(x.Hostname)), ''), m.Hostname),
           m.MAC        = COALESCE(NULLIF(LTRIM(RTRIM(x.MAC)), ''), m.MAC),
           m.Mascara    = COALESCE(NULLIF(LTRIM(RTRIM(x.Mascara)), ''), m.Mascara),
           m.PuertoEnlace = COALESCE(NULLIF(LTRIM(RTRIM(x.PuertaEnlace)), ''), m.PuertoEnlace),
           m.DNS1       = COALESCE(NULLIF(LTRIM(RTRIM(x.DNS1)), ''), m.DNS1),
           m.DNS2       = COALESCE(NULLIF(LTRIM(RTRIM(x.DNS2)), ''), m.DNS2),
           m.OrigenIP   = CASE WHEN x.TipoIP = 'Estatica' THEN 'Manual' ELSE 'DHCP' END,
           m.EsConfiable = CASE WHEN x.TipoIP = 'Estatica' THEN 1 ELSE 0 END,
           m.FechaActualizacion = @ahora
      FROM dbo.InventarioIPMaestro m
      JOIN (SELECT e.IdEquipo, e.IdCliente, e.IdPiso, e.TipoIP,
                   LTRIM(RTRIM(e.IP)) AS IP, e.Hostname, e.Mascara, e.PuertaEnlace,
                   e.DNS1, e.DNS2, d.MAC,
                   ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM(e.IP))
                                      ORDER BY e.IdEquipo DESC) AS rn
              FROM dbo.Equipos e
              LEFT JOIN dbo.EquiposControlGeneralIP d ON d.IdEquipo = e.IdEquipo
             WHERE e.Activo = 1 AND NULLIF(LTRIM(RTRIM(e.IP)), '') IS NOT NULL) x
        ON x.IP = m.IP AND x.rn = 1
     WHERE @IP IS NULL OR m.IP = @IP;

    /* 2.4.c Colector: máxima autoridad técnica (es la detección real) */
    UPDATE m
       SET m.IdActivoFijoEQ = r.IdActivoFijoEQ,
           m.IdEquipoRed    = r.IdEquipoRed,
           m.Hostname       = COALESCE(NULLIF(LTRIM(RTRIM(r.Hostname)), ''), m.Hostname),
           m.MAC            = COALESCE(NULLIF(LTRIM(RTRIM(r.MAC)), ''), m.MAC),
           m.DescripcionTecnica = COALESCE(NULLIF(LTRIM(RTRIM(r.DescripcionAdaptador)), N''),
                                           NULLIF(LTRIM(RTRIM(r.NombreAdaptador)), N''), m.DescripcionTecnica),
           m.NombreAdaptador = COALESCE(NULLIF(LTRIM(RTRIM(r.NombreAdaptador)), N''), m.NombreAdaptador),
           m.TipoMedio      = COALESCE(NULLIF(LTRIM(RTRIM(r.TipoMedio)), N''), m.TipoMedio),
           m.DHCP           = r.DHCP,
           m.Mascara        = COALESCE(NULLIF(LTRIM(RTRIM(r.Mascara)), ''), m.Mascara),
           m.PuertoEnlace   = COALESCE(NULLIF(LTRIM(RTRIM(r.PuertaEnlace)), ''), m.PuertoEnlace),
           m.DNS1           = COALESCE(NULLIF(LTRIM(RTRIM(r.DNS1)), ''), m.DNS1),
           m.DNS2           = COALESCE(NULLIF(LTRIM(RTRIM(r.DNS2)), ''), m.DNS2),
           m.Dominio        = COALESCE(NULLIF(LTRIM(RTRIM(r.Dominio)), N''), m.Dominio),
           m.OrigenIP       = CASE WHEN r.EsWifi = 1 THEN 'Wifi'
                                   WHEN r.DHCP   = 1 THEN 'DHCP'
                                   ELSE 'Manual' END,
           m.EsConfiable    = CASE WHEN r.EsWifi = 1 OR r.DHCP = 1 THEN 0 ELSE 1 END,
           m.FechaActualizacion = @ahora
      FROM dbo.InventarioIPMaestro m
      JOIN (SELECT R.IdEquipoRed, R.IdActivoFijoEQ, R.Hostname, R.MAC, R.NombreAdaptador,
                   R.DescripcionAdaptador, R.TipoMedio, R.DHCP, R.Mascara, R.PuertaEnlace,
                   R.DNS1, R.DNS2, R.Dominio, LTRIM(RTRIM(R.IP)) AS IP,
                   CASE WHEN ISNULL(R.TipoMedio, N'') LIKE N'%Wi%Fi%'
                          OR ISNULL(R.TipoMedio, N'') LIKE N'%Wireless%'
                          OR ISNULL(R.TipoMedio, N'') LIKE N'%WLAN%'
                          OR ISNULL(R.TipoMedio, N'') LIKE N'%802.11%'
                          OR ISNULL(R.NombreAdaptador, N'') LIKE N'%Wi%Fi%'
                          OR ISNULL(R.DescripcionAdaptador, N'') LIKE N'%Wi%Fi%'
                        THEN 1 ELSE 0 END AS EsWifi,
                   ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM(R.IP))
                                      ORDER BY R.EsPrincipal DESC, R.UltimaDeteccion DESC, R.IdEquipoRed DESC) AS rn
              FROM dbo.ActivoFijoEquiposRed R
             WHERE R.Vigente = 1 AND NULLIF(LTRIM(RTRIM(R.IP)), '') IS NOT NULL) r
        ON r.IP = m.IP AND r.rn = 1
     WHERE @IP IS NULL OR m.IP = @IP;

    /* 2.5 Clave de gestión (MAC si hay, si no la IP): la misma que usa
           src/js/db/inventario-ip.js → claveGestion().                      */
    UPDATE m
       SET m.ClaveGestion = CASE WHEN NULLIF(LTRIM(RTRIM(m.MAC)), '') IS NOT NULL
                                 THEN 'MAC:' + UPPER(LTRIM(RTRIM(m.MAC)))
                                 ELSE 'IP:'  + m.IP END
      FROM dbo.InventarioIPMaestro m
     WHERE @IP IS NULL OR m.IP = @IP;

    /* 2.6 Gestión: Control general manda sobre Equipos; el colector no
           aporta gestión (no la conoce).
           IdPiso es del catálogo de control general: si llega, limpia
           IdPisoPlano para no dejar las dos columnas llenas.               */
    UPDATE m
       SET m.IdDispositivo  = g.IdDispositivo,
           m.IdTipoEquipo   = g.IdTipoEquipo,
           m.IdPiso         = g.IdPiso,
           m.IdPisoPlano    = CASE WHEN g.IdPiso IS NOT NULL THEN NULL
                                   ELSE m.IdPisoPlano END,
           m.IdSite         = g.IdSite,
           m.PuertoFortinet = g.PuertoFortinet,
           m.Descripcion    = g.Descripcion,
           m.FuenteGestion  = 'General'
      FROM dbo.InventarioIPMaestro m
      JOIN dbo.InventarioGeneralIP g ON LTRIM(RTRIM(g.IP)) = m.IP
     WHERE m.GestionManual = 0
       AND (@IP IS NULL OR m.IP = @IP);

    UPDATE m
       SET m.IdDispositivo  = COALESCE(m.IdDispositivo, d.IdDispositivo),
           m.IdTipoEquipo   = COALESCE(m.IdTipoEquipo, d.IdTipoEquipo),
           m.IdSite         = COALESCE(m.IdSite, d.IdSite),
           m.IdCliente      = COALESCE(m.IdCliente, x.IdCliente),
           m.PuertoFortinet = COALESCE(m.PuertoFortinet, NULLIF(LTRIM(RTRIM(d.PuertoFortinet)), N'')),
           m.Descripcion    = COALESCE(m.Descripcion, NULLIF(LTRIM(RTRIM(d.Descripcion)), N'')),
           m.FuenteGestion  = COALESCE(m.FuenteGestion, 'Cliente')
      FROM dbo.InventarioIPMaestro m
      JOIN (SELECT e.IdEquipo, e.IdCliente, LTRIM(RTRIM(e.IP)) AS IP,
                   ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM(e.IP)) ORDER BY e.IdEquipo DESC) AS rn
              FROM dbo.Equipos e
             WHERE e.Activo = 1 AND NULLIF(LTRIM(RTRIM(e.IP)), '') IS NOT NULL) x
        ON x.IP = m.IP AND x.rn = 1
      LEFT JOIN dbo.EquiposControlGeneralIP d ON d.IdEquipo = x.IdEquipo
     WHERE m.GestionManual = 0
       AND m.FuenteGestion IS NULL
       AND (@IP IS NULL OR m.IP = @IP);

    UPDATE m
       SET m.FuenteGestion = 'Colector'
      FROM dbo.InventarioIPMaestro m
     WHERE m.FuenteGestion IS NULL AND m.EnColector = 1
       AND (@IP IS NULL OR m.IP = @IP);

    /* 2.9 Lo que la persona capturó en "Editar datos" gana sobre todo.
           IdPiso es del catálogo de control general y IdPisoPlano del
           catálogo del plano (dbo.Pisos): son dos vocabularios y la
           persona eligió uno de los dos, así que se copia el que traiga. */
    UPDATE m
       SET m.IdDispositivo  = COALESCE(k.IdDispositivo, m.IdDispositivo),
           m.IdTipoEquipo   = COALESCE(k.IdTipoEquipo, m.IdTipoEquipo),
           /* Excluyentes: si la persona eligió el piso del plano, el del
              catálogo de control general se limpia (y al revés), para que
              la vista no muestre un piso que ya no se eligió. */
           m.IdPiso         = COALESCE(k.IdPiso,
                                       CASE WHEN k.IdPisoPlano IS NOT NULL THEN NULL ELSE m.IdPiso END),
           m.IdPisoPlano    = COALESCE(k.IdPisoPlano,
                                       CASE WHEN k.IdPiso IS NOT NULL THEN NULL ELSE m.IdPisoPlano END),
           m.IdSite         = COALESCE(k.IdSite, m.IdSite),
           m.IdCliente      = COALESCE(k.IdCliente, m.IdCliente),
           m.PuertoFortinet = COALESCE(NULLIF(LTRIM(RTRIM(k.PuertoFortinet)), N''), m.PuertoFortinet),
           m.Descripcion    = COALESCE(NULLIF(LTRIM(RTRIM(k.Descripcion)), N''), m.Descripcion),
           m.GestionManual  = 1,
           m.FuenteGestion  = 'General',
           m.FechaActualizacion = @ahora
      FROM dbo.InventarioIPMaestro m
      JOIN dbo.InventarioIPGestion k
        ON k.Clave = CASE WHEN NULLIF(LTRIM(RTRIM(m.MAC)), '') IS NOT NULL
                          THEN 'MAC:' + UPPER(LTRIM(RTRIM(m.MAC)))
                          ELSE 'IP:' + m.IP END
     WHERE @IP IS NULL OR m.IP = @IP;

    /* 2.10 Red de seguridad de la exclusividad: ninguna fila debe quedar con
            los dos pisos. Si quedó alguna de arrastre histórico, manda el
            catálogo de control general (IdPiso) sobre el del plano.
            Es idempotente: con 0 conflictos no toca nada.                    */
    UPDATE m
       SET m.IdPisoPlano = NULL
      FROM dbo.InventarioIPMaestro m
     WHERE m.IdPiso IS NOT NULL AND m.IdPisoPlano IS NOT NULL
       AND (@IP IS NULL OR m.IP = @IP);
END
GO

/* ---------------------------------------------------------------------------
   2-bis. RESINCRONIZACIÓN COMPLETA
   Reconstruye la maestra desde los orígenes SIN tocar los orígenes. Se
   ejecuta al final del script y se puede lanzar a mano cuando haga falta:
       EXEC dbo.sp_IPMaestroResincronizar;
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_IPMaestroResincronizar
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRAN;
        EXEC dbo.sp_IPMaestroRefrescar;   /* sin @IP = todas las direcciones */
        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

/* ---------------------------------------------------------------------------
   3. TRIGGERS — uno por tabla de origen. Cada uno escribe SOLO sus columnas.
   Todos llevan SET NOCOUNT ON para no devolver resultadosets al proceso que
   hizo el MERGE/INSERT (el colector) y TRY/CATCH para no romperlo nunca.
   --------------------------------------------------------------------------- */

/* 3.1 Control general: es el dueño de la clasificación manual de su tabla. */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_InventarioGeneralIP
ON dbo.InventarioGeneralIP
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;
    BEGIN TRY
        /* Filas nuevas en la maestra (INSERT puro, nunca UPDATE de registros ajenos) */
        INSERT INTO dbo.InventarioIPMaestro (IP, EnGeneral, FechaAlta, FechaActualizacion)
        SELECT DISTINCT NULLIF(LTRIM(RTRIM(i.IP)), ''), 1, SYSDATETIME(), SYSDATETIME()
        FROM inserted i
        WHERE NULLIF(LTRIM(RTRIM(i.IP)), '') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dbo.InventarioIPMaestro m
                           WHERE m.IP = NULLIF(LTRIM(RTRIM(i.IP)), ''));

        UPDATE m
           SET m.EnGeneral      = 1,
               m.IdInventarioIP = i.IdInventarioIP,
               m.Hostname       = COALESCE(NULLIF(LTRIM(RTRIM(i.Hostname)), ''), m.Hostname),
               m.MAC            = COALESCE(NULLIF(LTRIM(RTRIM(i.MAC)), ''), m.MAC),
               m.IdEstado       = i.IdEstado,
               /* Gestión: sólo si nadie la editó a mano en la pantalla */
               m.IdDispositivo  = CASE WHEN m.GestionManual = 1 THEN m.IdDispositivo  ELSE i.IdDispositivo END,
               m.IdTipoEquipo   = CASE WHEN m.GestionManual = 1 THEN m.IdTipoEquipo   ELSE i.IdTipoEquipo  END,
               /* IdPiso es del catálogo de control general y excluye a
                  IdPisoPlano (el del plano, dbo.Pisos).                        */
               m.IdPiso         = CASE WHEN m.GestionManual = 1 THEN m.IdPiso ELSE i.IdPiso END,
               m.IdPisoPlano    = CASE WHEN m.GestionManual = 1 OR i.IdPiso IS NULL
                                       THEN m.IdPisoPlano ELSE NULL END,
               m.IdSite         = CASE WHEN m.GestionManual = 1 THEN m.IdSite         ELSE i.IdSite        END,
               m.PuertoFortinet = CASE WHEN m.GestionManual = 1 THEN m.PuertoFortinet ELSE i.PuertoFortinet END,
               m.Descripcion    = CASE WHEN m.GestionManual = 1 THEN m.Descripcion    ELSE i.Descripcion    END,
               m.FuenteGestion  = CASE WHEN m.GestionManual = 1 THEN m.FuenteGestion  ELSE 'General'        END,
               m.ClaveGestion   = CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(i.MAC)), ''), m.MAC))), '') IS NOT NULL
                                       THEN 'MAC:' + UPPER(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(i.MAC)), ''), m.MAC))))
                                       ELSE 'IP:'  + m.IP END,
               m.FechaActualizacion = SYSDATETIME()
          FROM dbo.InventarioIPMaestro m
          JOIN inserted i ON NULLIF(LTRIM(RTRIM(i.IP)), '') = m.IP;
    END TRY
    BEGIN CATCH
        /* La maestra es un espejo: si falla, el módulo de origen sigue igual. */
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(General): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* 3.2 Módulo Equipos: aporta cliente, piso del plano y la MAC/gestión que
       guarda dbo.EquiposControlGeneralIP. */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_Equipos
ON dbo.Equipos
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;
    BEGIN TRY
        INSERT INTO dbo.InventarioIPMaestro (IP, EnCliente, FechaAlta, FechaActualizacion)
        SELECT DISTINCT NULLIF(LTRIM(RTRIM(i.IP)), ''), 1, SYSDATETIME(), SYSDATETIME()
        FROM inserted i
        WHERE NULLIF(LTRIM(RTRIM(i.IP)), '') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dbo.InventarioIPMaestro m
                           WHERE m.IP = NULLIF(LTRIM(RTRIM(i.IP)), ''));

        UPDATE m
           SET m.EnCliente   = CASE WHEN i.Activo = 1 THEN 1 ELSE m.EnCliente END,
               m.IdEquipo    = i.IdEquipo,
               m.IdCliente   = i.IdCliente,
               /* El piso de Equipos es del plano (dbo.Pisos) → IdPisoPlano.
                  Excluyente con IdPiso; si la fila se gestionó a mano, no se
                  pisa lo que eligió el usuario.                                  */
               m.IdPisoPlano = CASE WHEN m.GestionManual = 1 AND m.IdPiso IS NOT NULL
                                    THEN m.IdPisoPlano ELSE i.IdPiso END,
               m.IdPiso      = CASE WHEN m.GestionManual = 1 THEN m.IdPiso
                                    WHEN i.IdPiso IS NOT NULL THEN NULL
                                    ELSE m.IdPiso END,
               m.Hostname    = COALESCE(NULLIF(LTRIM(RTRIM(i.Hostname)), ''), m.Hostname),
               m.OrigenIP    = COALESCE(m.OrigenIP, CASE WHEN i.TipoIP = 'Estatica' THEN 'Manual' ELSE 'DHCP' END),
               m.EsConfiable = CASE WHEN i.TipoIP = 'Estatica' THEN 1 ELSE 0 END,
               m.FechaActualizacion = SYSDATETIME()
          FROM dbo.InventarioIPMaestro m
          JOIN inserted i ON NULLIF(LTRIM(RTRIM(i.IP)), '') = m.IP;

        /* La gestión de los equipos de cliente vive en otra tabla */
        UPDATE m
           SET m.IdDispositivo  = CASE WHEN m.GestionManual = 1 OR m.FuenteGestion IN ('General','Cliente') THEN m.IdDispositivo  ELSE d.IdDispositivo  END,
               m.IdTipoEquipo   = CASE WHEN m.GestionManual = 1 OR m.FuenteGestion IN ('General','Cliente') THEN m.IdTipoEquipo   ELSE d.IdTipoEquipo   END,
               m.IdSite         = CASE WHEN m.GestionManual = 1 OR m.FuenteGestion IN ('General','Cliente') THEN m.IdSite         ELSE d.IdSite         END,
               m.PuertoFortinet = CASE WHEN m.GestionManual = 1 OR m.FuenteGestion IN ('General','Cliente') THEN m.PuertoFortinet ELSE d.PuertoFortinet END,
               m.Descripcion    = CASE WHEN m.GestionManual = 1 OR m.FuenteGestion IN ('General','Cliente') THEN m.Descripcion    ELSE d.Descripcion    END,
               m.FuenteGestion  = COALESCE(m.FuenteGestion, 'Cliente'),
               m.FechaActualizacion = SYSDATETIME()
          FROM dbo.InventarioIPMaestro m
          JOIN dbo.Equipos e ON e.IdEquipo IN (SELECT IdEquipo FROM inserted)
          JOIN dbo.EquiposControlGeneralIP d ON d.IdEquipo = e.IdEquipo
         WHERE m.IdEquipo = e.IdEquipo;
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(Equipos): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* 3.3 Gestión capturada en EquiposControlGeneralIP (misma tabla del flujo de
       Equipos, se dispara por su propia clave). */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_EquiposControlGeneralIP
ON dbo.EquiposControlGeneralIP
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;
    BEGIN TRY
        UPDATE m
           SET m.IdDispositivo  = d.IdDispositivo,
               m.IdTipoEquipo   = d.IdTipoEquipo,
               m.IdSite         = d.IdSite,
               m.PuertoFortinet = d.PuertoFortinet,
               m.Descripcion    = d.Descripcion,
               m.MAC            = COALESCE(NULLIF(LTRIM(RTRIM(d.MAC)), ''), m.MAC),
               m.FuenteGestion  = 'Cliente',
               m.FechaActualizacion = SYSDATETIME()
          FROM dbo.InventarioIPMaestro m
          JOIN dbo.Equipos e ON e.IdEquipo IN (SELECT IdEquipo FROM inserted)
          JOIN dbo.EquiposControlGeneralIP d ON d.IdEquipo = e.IdEquipo
         WHERE NULLIF(LTRIM(RTRIM(e.IP)), '') = m.IP
           AND m.GestionManual = 0;
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(EquiposControlGeneralIP): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* 3.4 Colector: SOLO datos técnicos. Nunca gestión, nunca piso/cliente. */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_ActivoFijoEquiposRed
ON dbo.ActivoFijoEquiposRed
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;
    BEGIN TRY
        INSERT INTO dbo.InventarioIPMaestro (IP, EnColector, FechaAlta, FechaActualizacion)
        SELECT DISTINCT NULLIF(LTRIM(RTRIM(i.IP)), ''), 1, SYSDATETIME(), SYSDATETIME()
        FROM inserted i
        WHERE NULLIF(LTRIM(RTRIM(i.IP)), '') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dbo.InventarioIPMaestro m
                           WHERE m.IP = NULLIF(LTRIM(RTRIM(i.IP)), ''));

        UPDATE m
           SET m.EnColector     = 1,
               m.IdActivoFijoEQ = x.IdActivoFijoEQ,
               m.IdEquipoRed    = x.IdEquipoRed,
               m.Hostname       = COALESCE(NULLIF(LTRIM(RTRIM(x.Hostname)), ''), m.Hostname),
               m.MAC            = COALESCE(NULLIF(LTRIM(RTRIM(x.MAC)), ''), m.MAC),
               m.DescripcionTecnica = COALESCE(NULLIF(LTRIM(RTRIM(x.DescripcionAdaptador)), N''),
                                               NULLIF(LTRIM(RTRIM(x.NombreAdaptador)), N''), m.DescripcionTecnica),
               m.NombreAdaptador= COALESCE(NULLIF(LTRIM(RTRIM(x.NombreAdaptador)), N''), m.NombreAdaptador),
               m.TipoMedio      = COALESCE(NULLIF(LTRIM(RTRIM(x.TipoMedio)), N''), m.TipoMedio),
               m.DHCP           = x.DHCP,
               m.Mascara        = COALESCE(NULLIF(LTRIM(RTRIM(x.Mascara)), ''), m.Mascara),
               m.PuertoEnlace   = COALESCE(NULLIF(LTRIM(RTRIM(x.PuertaEnlace)), ''), m.PuertoEnlace),
               m.DNS1           = COALESCE(NULLIF(LTRIM(RTRIM(x.DNS1)), ''), m.DNS1),
               m.DNS2           = COALESCE(NULLIF(LTRIM(RTRIM(x.DNS2)), ''), m.DNS2),
               m.Dominio        = COALESCE(NULLIF(LTRIM(RTRIM(x.Dominio)), N''), m.Dominio),
               m.OrigenIP       = CASE WHEN x.EsWifi = 1 THEN 'Wifi'
                                       WHEN x.DHCP   = 1 THEN 'DHCP'
                                       ELSE 'Manual' END,
               m.EsConfiable    = CASE WHEN x.EsWifi = 1 OR x.DHCP = 1 THEN 0 ELSE 1 END,
               m.FuenteGestion  = COALESCE(m.FuenteGestion, 'Colector'),
               m.ClaveGestion   = CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(x.MAC)), ''), m.MAC))), '') IS NOT NULL
                                       THEN 'MAC:' + UPPER(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(x.MAC)), ''), m.MAC))))
                                       ELSE 'IP:'  + m.IP END,
               m.FechaActualizacion = SYSDATETIME()
          FROM dbo.InventarioIPMaestro m
          JOIN (SELECT R.IdEquipoRed, R.IdActivoFijoEQ, R.Hostname, R.MAC, R.NombreAdaptador,
                       R.DescripcionAdaptador, R.TipoMedio, R.DHCP, R.Mascara, R.PuertaEnlace,
                       R.DNS1, R.DNS2, R.Dominio, NULLIF(LTRIM(RTRIM(R.IP)), '') AS IP,
                       CASE WHEN ISNULL(R.TipoMedio, N'') LIKE N'%Wi%Fi%'
                              OR ISNULL(R.TipoMedio, N'') LIKE N'%Wireless%'
                              OR ISNULL(R.TipoMedio, N'') LIKE N'%WLAN%'
                              OR ISNULL(R.TipoMedio, N'') LIKE N'%802.11%'
                              OR ISNULL(R.NombreAdaptador, N'') LIKE N'%Wi%Fi%'
                              OR ISNULL(R.DescripcionAdaptador, N'') LIKE N'%Wi%Fi%'
                            THEN 1 ELSE 0 END AS EsWifi,
                       ROW_NUMBER() OVER (PARTITION BY NULLIF(LTRIM(RTRIM(R.IP)), '')
                                          ORDER BY R.EsPrincipal DESC, R.UltimaDeteccion DESC, R.IdEquipoRed DESC) AS rn
                  FROM dbo.ActivoFijoEquiposRed R
                 WHERE R.Vigente = 1 AND NULLIF(LTRIM(RTRIM(R.IP)), '') IS NOT NULL) x
            ON x.IP = m.IP AND x.rn = 1;
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(Colector): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* 3.5 Edición manual desde "Control general de IP" (Editar datos).
       Esta es la que manda sobre todo: marca GestionManual = 1 para que los
       triggers automáticos dejen de escribir la gestión de esa fila. */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_InventarioIPGestion
ON dbo.InventarioIPGestion
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;
    BEGIN TRY
        UPDATE m
           SET m.ClaveGestion   = k.Clave,
               m.IdDispositivo  = COALESCE(k.IdDispositivo, m.IdDispositivo),
               m.IdTipoEquipo   = COALESCE(k.IdTipoEquipo, m.IdTipoEquipo),
               /* Piso: dos catálogos excluyentes (control general / plano). */
               m.IdPiso         = COALESCE(k.IdPiso,
                                           CASE WHEN k.IdPisoPlano IS NOT NULL THEN NULL ELSE m.IdPiso END),
               m.IdPisoPlano    = COALESCE(k.IdPisoPlano,
                                           CASE WHEN k.IdPiso IS NOT NULL THEN NULL ELSE m.IdPisoPlano END),
               m.IdSite         = COALESCE(k.IdSite, m.IdSite),
               m.IdCliente      = COALESCE(k.IdCliente, m.IdCliente),
               m.PuertoFortinet = COALESCE(NULLIF(LTRIM(RTRIM(k.PuertoFortinet)), N''), m.PuertoFortinet),
               m.Descripcion    = COALESCE(NULLIF(LTRIM(RTRIM(k.Descripcion)), N''), m.Descripcion),
               m.GestionManual  = 1,
               m.FuenteGestion  = 'General',
               m.FechaActualizacion = SYSDATETIME()
          FROM dbo.InventarioIPMaestro m
          JOIN inserted k
            ON k.Clave = m.ClaveGestion
            OR k.Clave = CASE WHEN NULLIF(LTRIM(RTRIM(m.MAC)), '') IS NOT NULL
                              THEN 'MAC:' + UPPER(LTRIM(RTRIM(m.MAC))) ELSE 'IP:' + m.IP END
            OR k.Clave = 'IP:' + m.IP;
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(Gestion): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* ---------------------------------------------------------------------------
   3-bis. TRIGGERS DE BAJA
   ---------------------------------------------------------------------------
   Los cinco triggers de arriba escuchan INSERT y UPDATE: si un registro se
   BORRA en su origen, la maestra nunca se enteraba y la fila quedaba con la
   bandera encendida y datos que ya no existían (el caso real: una IP del
   control general borrada seguía apareciendo como "General", con su
   descripción y su puerto, y ofrecía un botón Eliminar que respondía "el
   registro ya no existe").
   Aquí se cierra el círculo: al borrar, se recalcula la fila desde cero con
   dbo.sp_IPMaestroRefrescar, que limpia lo que aportaba ese origen y deja
   sólo lo que los demás orígenes sí siguen aportando.
   --------------------------------------------------------------------------- */

/* 3.6 Baja en el control general */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_InventarioGeneralIP_Baja
ON dbo.InventarioGeneralIP
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    BEGIN TRY
        DECLARE @ips TABLE (Orden INT IDENTITY(1, 1) PRIMARY KEY, IP VARCHAR(45));
        INSERT INTO @ips (IP)
        SELECT DISTINCT NULLIF(LTRIM(RTRIM(d.IP)), '')
        FROM deleted d
        WHERE NULLIF(LTRIM(RTRIM(d.IP)), '') IS NOT NULL;

        DECLARE @i INT = 1, @total INT = (SELECT COUNT(*) FROM @ips), @ip VARCHAR(45);
        WHILE @i <= @total
        BEGIN
            SELECT @ip = IP FROM @ips WHERE Orden = @i;
            EXEC dbo.sp_IPMaestroRefrescar @IP = @ip;
            SET @i += 1;
        END
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(General-baja): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* 3.7 Baja de un equipo de cliente (el piso de cliente es del plano) */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_Equipos_Baja
ON dbo.Equipos
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    BEGIN TRY
        DECLARE @ips TABLE (Orden INT IDENTITY(1, 1) PRIMARY KEY, IP VARCHAR(45));
        INSERT INTO @ips (IP)
        SELECT DISTINCT NULLIF(LTRIM(RTRIM(d.IP)), '')
        FROM deleted d
        WHERE NULLIF(LTRIM(RTRIM(d.IP)), '') IS NOT NULL;

        DECLARE @i INT = 1, @total INT = (SELECT COUNT(*) FROM @ips), @ip VARCHAR(45);
        WHILE @i <= @total
        BEGIN
            SELECT @ip = IP FROM @ips WHERE Orden = @i;
            EXEC dbo.sp_IPMaestroRefrescar @IP = @ip;
            SET @i += 1;
        END
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(Equipos-baja): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* 3.8 Baja del control general de un equipo.
       Esta tabla no guarda la IP: se resuelve por IdEquipo contra dbo.Equipos.
       Si el equipo también se borró en la misma sentencia, su propio trigger
       (3.7) hace el trabajo. */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_EquiposControlGeneralIP_Baja
ON dbo.EquiposControlGeneralIP
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    BEGIN TRY
        DECLARE @ips TABLE (Orden INT IDENTITY(1, 1) PRIMARY KEY, IP VARCHAR(45));
        INSERT INTO @ips (IP)
        SELECT DISTINCT NULLIF(LTRIM(RTRIM(e.IP)), '')
        FROM deleted d
        JOIN dbo.Equipos e ON e.IdEquipo = d.IdEquipo
        WHERE NULLIF(LTRIM(RTRIM(e.IP)), '') IS NOT NULL;

        DECLARE @i INT = 1, @total INT = (SELECT COUNT(*) FROM @ips), @ip VARCHAR(45);
        WHILE @i <= @total
        BEGIN
            SELECT @ip = IP FROM @ips WHERE Orden = @i;
            EXEC dbo.sp_IPMaestroRefrescar @IP = @ip;
            SET @i += 1;
        END
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(EquiposCG-baja): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* 3.9 Baja de la red reportada por el colector.
       La fila de red no se borra nunca (Vigente = 0), pero si alguien lo
       hiciera, la maestra tiene que dejar de creerla. */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_Colector_Baja
ON dbo.ActivoFijoEquiposRed
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    BEGIN TRY
        DECLARE @ips TABLE (Orden INT IDENTITY(1, 1) PRIMARY KEY, IP VARCHAR(45));
        INSERT INTO @ips (IP)
        SELECT DISTINCT NULLIF(LTRIM(RTRIM(d.IP)), '')
        FROM deleted d
        WHERE NULLIF(LTRIM(RTRIM(d.IP)), '') IS NOT NULL;

        DECLARE @i INT = 1, @total INT = (SELECT COUNT(*) FROM @ips), @ip VARCHAR(45);
        WHILE @i <= @total
        BEGIN
            SELECT @ip = IP FROM @ips WHERE Orden = @i;
            EXEC dbo.sp_IPMaestroRefrescar @IP = @ip;
            SET @i += 1;
        END
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(Colector-baja): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* 3.10 Retiro de la gestión manual ("Eliminar" en Editar datos).
        Al desaparecer la fila de gestión, la maestra deja de estar bloqueada
        y vuelve a mostrar lo que dicen los orígenes. */
CREATE OR ALTER TRIGGER dbo.trg_IPMaestro_InventarioIPGestion_Baja
ON dbo.InventarioIPGestion
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    BEGIN TRY
        DECLARE @ips TABLE (Orden INT IDENTITY(1, 1) PRIMARY KEY, IP VARCHAR(45));
        INSERT INTO @ips (IP)
        SELECT DISTINCT m.IP
        FROM deleted d
        JOIN dbo.InventarioIPMaestro m
          ON d.Clave = m.ClaveGestion
          OR d.Clave = CASE WHEN NULLIF(LTRIM(RTRIM(m.MAC)), '') IS NOT NULL
                            THEN 'MAC:' + UPPER(LTRIM(RTRIM(m.MAC))) ELSE 'IP:' + m.IP END
          OR d.Clave = 'IP:' + m.IP
        WHERE m.IP IS NOT NULL;

        DECLARE @i INT = 1, @total INT = (SELECT COUNT(*) FROM @ips), @ip VARCHAR(45);
        WHILE @i <= @total
        BEGIN
            SELECT @ip = IP FROM @ips WHERE Orden = @i;
            EXEC dbo.sp_IPMaestroRefrescar @IP = @ip;
            SET @i += 1;
        END
    END TRY
    BEGIN CATCH
        DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
        RAISERROR(N'IPMaestro(Gestion-baja): %s', 0, 1, @msg) WITH NOWAIT;
    END CATCH
END
GO

/* ---------------------------------------------------------------------------
   4. VISTA DE LECTURA
   Mismo contrato de columnas que dbo.vw_InventarioIPUnificado, para que la
   pantalla y el export no cambien una sola línea. Un renglón por IP.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_InventarioIPMaestro
AS
SELECT
    /* Origen: la etiqueta que ya pinta la pantalla (General > Cliente > Activo) */
    CASE WHEN m.EnGeneral = 1 THEN N'General'
         WHEN m.EnCliente = 1 THEN N'Cliente'
         ELSE N'Activo' END                       AS Origen,
    CASE WHEN m.EnGeneral = 1 AND m.EnCliente = 1 AND m.EnColector = 1 THEN N'General+Cliente+Colector'
         WHEN m.EnGeneral = 1 AND m.EnCliente = 1 THEN N'General+Cliente'
         WHEN m.EnGeneral = 1 AND m.EnColector = 1 THEN N'General+Colector'
         WHEN m.EnCliente = 1 AND m.EnColector = 1 THEN N'Cliente+Colector'
         WHEN m.EnGeneral = 1 THEN N'General'
         WHEN m.EnCliente = 1 THEN N'Cliente'
         ELSE N'Colector' END                     AS Origenes,
    m.IdIPMaestro,
    m.IdInventarioIP,
    m.IdEquipo,
    m.IdActivoFijoEQ,
    m.IP,
    m.Hostname,
    m.MAC,
    m.ClaveGestion,
    /* Descripción: la capturada a mano si existe; si no, la del adaptador */
    COALESCE(NULLIF(LTRIM(RTRIM(m.Descripcion)), N''), m.DescripcionTecnica) AS Descripcion,
    m.DescripcionTecnica,
    m.PuertoFortinet,
    /* Estado: el del catálogo cuando existe (filas de control general);
       si no, las filas vivas de Equipos/colector se muestran como 'Activo'. */
    COALESCE(Estado.Nombre,
             CASE WHEN m.EnCliente = 1 OR m.EnColector = 1 THEN N'Activo' ELSE N'Inactivo' END) AS Estado,
    Dispositivo.Nombre AS Dispositivo,
    TipoEquipo.Nombre  AS TipoEquipo,
    /* Piso: el del catálogo de control general si lo capturó una persona;
       si no, el piso del plano que trae el equipo de cliente
       (dbo.Equipos.IdPiso apunta a dbo.Pisos, que es OTRO catálogo). */
    COALESCE(Piso.Nombre, PisoPlano.Nombre) AS Piso,
    Site.Nombre        AS Site,
    CASE WHEN m.OrigenIP IN ('DHCP', 'Wifi') THEN N'DHCP'
         WHEN m.OrigenIP = 'Manual' THEN N'Estatica'
         ELSE m.OrigenIP END                      AS TipoIP,
    C.Codigo           AS ClienteCodigo,
    C.Nombre           AS ClienteNombre,
    m.OrigenIP,
    m.EsConfiable,
    m.FechaActualizacion,
    m.IdEstado,
    m.IdDispositivo,
    m.IdTipoEquipo,
    m.IdPiso,
    m.IdSite,
    CAST(NULL AS INT)  AS IdTipoIP,
    m.IdCliente,
    m.IdPisoPlano,
    m.EnGeneral,
    m.EnCliente,
    m.EnColector,
    m.GestionManual,
    m.FuenteGestion,
    m.NombreAdaptador,
    m.TipoMedio,
    m.DHCP
FROM dbo.InventarioIPMaestro m
LEFT JOIN dbo.CatalogosInventarioIP Estado       ON Estado.IdCatalogoIP      = m.IdEstado
LEFT JOIN dbo.CatalogosInventarioIP Dispositivo ON Dispositivo.IdCatalogoIP = m.IdDispositivo
LEFT JOIN dbo.CatalogosInventarioIP TipoEquipo  ON TipoEquipo.IdCatalogoIP  = m.IdTipoEquipo
LEFT JOIN dbo.CatalogosInventarioIP Piso        ON Piso.IdCatalogoIP        = m.IdPiso
LEFT JOIN dbo.CatalogosInventarioIP Site        ON Site.IdCatalogoIP        = m.IdSite
LEFT JOIN dbo.Clientes C                        ON C.IdCliente             = m.IdCliente
LEFT JOIN dbo.Pisos PisoPlano                   ON PisoPlano.IdPiso        = m.IdPisoPlano
WHERE m.EnGeneral = 1 OR m.EnCliente = 1 OR m.EnColector = 1;
GO

/* ---------------------------------------------------------------------------
   5. CARGA INICIAL Y VERIFICACIÓN
   --------------------------------------------------------------------------- */
EXEC dbo.sp_IPMaestroResincronizar;
GO

SELECT (SELECT COUNT(*) FROM dbo.InventarioIPMaestro) AS FilasMaestro,
       (SELECT COUNT(DISTINCT IP) FROM dbo.InventarioIPMaestro) AS IPsDistintas,
       (SELECT COUNT(*) FROM dbo.vw_InventarioIPMaestro) AS FilasVista,
       (SELECT COUNT(*) FROM dbo.InventarioIPMaestro WHERE GestionManual = 1) AS Gestionadas,
       (SELECT COUNT(*) FROM dbo.InventarioIPMaestro WHERE EnGeneral = 1) AS EnGeneral,
       (SELECT COUNT(*) FROM dbo.InventarioIPMaestro WHERE EnCliente = 1) AS EnCliente,
       (SELECT COUNT(*) FROM dbo.InventarioIPMaestro WHERE EnColector = 1) AS EnColector;
GO
