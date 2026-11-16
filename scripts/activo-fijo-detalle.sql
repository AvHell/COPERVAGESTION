/* =========================================================
   ACTIVO FIJO — MÓDULO "DETALLE" (tablas puente + vistas)
   ---------------------------------------------------------
   Contexto:
     Dos aplicaciones comparten esta base.
       · App A (colector Windows) escribe en dbo.ActivoFijoEquipos,
         dbo.ActivoFijoEquiposRed, dbo.ActivoFijoEquiposCuentas y
         dbo.ActivoFijoEquiposProgramas.
       · App B (esta app) LEE las vistas que crea este script y
         gestiona el activo fijo. Cero captura de hardware.

   Qué hace este script, en este orden:
     1. Crea las CUATRO tablas puente del colector si no existen
        (nunca toca las que ya existen: es puramente aditivo):
          ActivoFijoEquiposRed         → adaptadores de red
          ActivoFijoEquiposCuentas     → cuentas locales / dominio
          ActivoFijoEquiposProgramas   → software instalado
          ActivoFijoEquiposComponentes → periféricos/internos que
                                         cuelgan del equipo (monitor
                                         externo, disco, teclado,
                                         ratón…), ligados al equipo
                                         por IdActivoFijoEQ + NoSerie
                                         (la NoSerie del CPU).
     2. Crea los índices de apoyo de esas tablas.
     3. Crea/actualiza la vista de lectura:
          vw_ActivoFijoEquipoInline  → base del maestro y la ficha
     4. Crea índices de cruce sobre dbo.Equipos (hostname, IP y
        serie) para el maestro.

   Modelo padre/hijo:
     · El EQUIPO (CPU / AIO / laptop / desktop) es el activo padre:
       una sola fila en dbo.ActivoFijoEquipos, identificada por su
       NoSerie. Ese es el activo que se administra y lista.
     · Lo que tiene CONECTADO (monitor externo, teclado, ratón) o
       INTERNO (discos) NO se da de alta como activo suelto: vive en
       dbo.ActivoFijoEquiposComponentes, colgado del padre por
       IdActivoFijoEQ y por la NoSerie del CPU. Así el inventario no
       pierde coherencia listando cada pieza como un activo 1 a 1 y
       siempre se sabe a qué equipo pertenece cada componente.

   Reglas de oro que respeta el diseño:
     · Vigente = 1 es lo único que lee el módulo Detalle; los
       históricos (Vigente = 0) nunca se borran, pero ya no se
       muestran en la ficha ni en los buscadores cruzados.
     · LoteEnvio agrupa un envío y permite comparar dos lotes.
     · UltimaDeteccion = última vez visto.
     · Las cuatro puente repiten NoSerie y Hostname para consulta
       inline sin JOIN.

   NO se declaran llaves foráneas hacia dbo.ActivoFijoEquipos a
   propósito: la app A inserta el detalle del equipo y un FK sólo
   podría hacerla fallar si su orden de inserción cambia. La
   integridad la garantiza el colector; aquí sólo se indexa.

   Idempotente: se puede ejecutar varias veces.
   ========================================================= */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   1. dbo.ActivoFijoEquiposRed — adaptadores de red del activo
   ========================================================= */
IF OBJECT_ID(N'dbo.ActivoFijoEquiposRed', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActivoFijoEquiposRed
    (
        IdEquipoRed          INT              IDENTITY(1,1) NOT NULL,
        IdActivoFijoEQ       INT              NOT NULL,
        NoSerie              NVARCHAR(150)    NULL,
        Hostname             NVARCHAR(100)    NULL,
        Clave                NVARCHAR(200)    NOT NULL,
        NombreAdaptador      NVARCHAR(200)    NULL,
        DescripcionAdaptador NVARCHAR(300)    NULL,
        TipoMedio            NVARCHAR(50)     NULL,
        MAC                  VARCHAR(17)      NULL,
        IP                   VARCHAR(45)      NULL,
        Mascara              VARCHAR(45)      NULL,
        PrefijoRed           INT              NULL,
        PuertaEnlace         VARCHAR(45)      NULL,
        DHCP                 BIT              NOT NULL CONSTRAINT DF_AFRed_DHCP           DEFAULT (0),
        DNS1                 VARCHAR(45)      NULL,
        DNS2                 VARCHAR(45)      NULL,
        DNSSufijo            NVARCHAR(200)    NULL,
        Dominio              NVARCHAR(150)    NULL,
        DominioDNS           NVARCHAR(150)    NULL,
        EsPrincipal          BIT              NOT NULL CONSTRAINT DF_AFRed_EsPrincipal    DEFAULT (0),
        Vigente              BIT              NOT NULL CONSTRAINT DF_AFRed_Vigente        DEFAULT (1),
        LoteEnvio            UNIQUEIDENTIFIER NULL,
        PrimeraDeteccion     DATETIME2(0)     NOT NULL CONSTRAINT DF_AFRed_Primera        DEFAULT (SYSDATETIME()),
        UltimaDeteccion      DATETIME2(0)     NOT NULL CONSTRAINT DF_AFRed_Ultima         DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_ActivoFijoEquiposRed PRIMARY KEY CLUSTERED (IdEquipoRed)
    );

    PRINT 'Creada dbo.ActivoFijoEquiposRed';
END
ELSE
    PRINT 'dbo.ActivoFijoEquiposRed ya existía (sin cambios)';
GO

/* =========================================================
   2. dbo.ActivoFijoEquiposCuentas — cuentas locales y de dominio
   ========================================================= */
IF OBJECT_ID(N'dbo.ActivoFijoEquiposCuentas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActivoFijoEquiposCuentas
    (
        IdEquipoCuenta    INT              IDENTITY(1,1) NOT NULL,
        IdActivoFijoEQ    INT              NOT NULL,
        NoSerie           NVARCHAR(150)    NULL,
        Hostname          NVARCHAR(100)    NULL,
        TipoCuenta        VARCHAR(10)      NOT NULL,   -- 'LOCAL' | 'DOMINIO'
        Cuenta            NVARCHAR(200)    NOT NULL,   -- en dominio: 'DOMINIO\usuario'
        NombreCompleto    NVARCHAR(200)    NULL,
        Descripcion       NVARCHAR(400)    NULL,
        Dominio           NVARCHAR(150)    NULL,
        DominioDNS        NVARCHAR(150)    NULL,
        SID               NVARCHAR(200)    NULL,
        Habilitada        BIT              NOT NULL CONSTRAINT DF_AFCue_Habilitada DEFAULT (1),
        UltimoAcceso      DATETIME2(0)     NULL,
        Perfil            NVARCHAR(300)    NULL,
        IP                VARCHAR(45)      NULL,
        MAC               VARCHAR(17)      NULL,
        Mascara           VARCHAR(45)      NULL,
        DNS1              VARCHAR(45)      NULL,
        DNS2              VARCHAR(45)      NULL,
        EsCuentaSesion    BIT              NOT NULL CONSTRAINT DF_AFCue_Sesion     DEFAULT (0),
        Vigente           BIT              NOT NULL CONSTRAINT DF_AFCue_Vigente    DEFAULT (1),
        LoteEnvio         UNIQUEIDENTIFIER NULL,
        PrimeraDeteccion  DATETIME2(0)     NOT NULL CONSTRAINT DF_AFCue_Primera    DEFAULT (SYSDATETIME()),
        UltimaDeteccion   DATETIME2(0)     NOT NULL CONSTRAINT DF_AFCue_Ultima     DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_ActivoFijoEquiposCuentas PRIMARY KEY CLUSTERED (IdEquipoCuenta),
        CONSTRAINT CK_AFCue_TipoCuenta CHECK (TipoCuenta IN ('LOCAL', 'DOMINIO'))
    );

    PRINT 'Creada dbo.ActivoFijoEquiposCuentas';
END
ELSE
    PRINT 'dbo.ActivoFijoEquiposCuentas ya existía (sin cambios)';
GO

/* =========================================================
   3. dbo.ActivoFijoEquiposProgramas — software instalado
   ========================================================= */
IF OBJECT_ID(N'dbo.ActivoFijoEquiposProgramas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActivoFijoEquiposProgramas
    (
        IdEquipoPrograma INT              IDENTITY(1,1) NOT NULL,
        IdActivoFijoEQ   INT              NOT NULL,
        NoSerie          NVARCHAR(150)    NULL,
        Hostname         NVARCHAR(100)    NULL,
        Programa         NVARCHAR(300)    NOT NULL,
        Version          NVARCHAR(100)    NULL,
        Fabricante       NVARCHAR(200)    NULL,
        FechaInstalacion DATE             NULL,
        Ubicacion        NVARCHAR(400)    NULL,
        Arquitectura     NVARCHAR(30)     NULL,
        Alcance          VARCHAR(10)      NOT NULL CONSTRAINT DF_AFProg_Alcance DEFAULT ('EQUIPO'),
        Cuenta           NVARCHAR(200)    NULL,        -- sólo si Alcance = 'USUARIO'
        Vigente          BIT              NOT NULL CONSTRAINT DF_AFProg_Vigente DEFAULT (1),
        LoteEnvio        UNIQUEIDENTIFIER NULL,
        PrimeraDeteccion DATETIME2(0)     NOT NULL CONSTRAINT DF_AFProg_Primera DEFAULT (SYSDATETIME()),
        UltimaDeteccion  DATETIME2(0)     NOT NULL CONSTRAINT DF_AFProg_Ultima  DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_ActivoFijoEquiposProgramas PRIMARY KEY CLUSTERED (IdEquipoPrograma),
        CONSTRAINT CK_AFProg_Alcance CHECK (Alcance IN ('EQUIPO', 'USUARIO'))
    );

    PRINT 'Creada dbo.ActivoFijoEquiposProgramas';
END
ELSE
    PRINT 'dbo.ActivoFijoEquiposProgramas ya existía (sin cambios)';
GO

/* =========================================================
   3.1 dbo.ActivoFijoEquiposComponentes — lo que cuelga del equipo
   ---------------------------------------------------------
   Una fila por PIEZA física conectada al equipo (o interna):
     MONITOR  → monitor externo (el panel del portátil/AIO no se
                registra: es parte del propio equipo)
     DISCO    → disco físico interno
     TECLADO  → teclado
     RATON    → ratón / apuntador
     OTRO     → cualquier periférico futuro
   La pieza se liga al EQUIPO PADRE por IdActivoFijoEQ y por
   NoSerie (la serie del CPU). `Clave` es la identidad estable de
   la pieza (identificador del colector, ya deduplicado por VID/PID
   o por serie) y sirve para no duplicarla en cada envío.
   NO es un activo de dbo.ActivoFijoEquipos: el activo a
   administrar es el equipo; esto es su detalle conectado.
   ========================================================= */
IF OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActivoFijoEquiposComponentes
    (
        IdEquipoComponente INT              IDENTITY(1,1) NOT NULL,
        IdActivoFijoEQ     INT              NOT NULL,   -- equipo padre
        NoSerie            NVARCHAR(150)    NULL,       -- NoSerie del CPU (padre)
        Hostname           NVARCHAR(100)    NULL,
        TipoComponente     VARCHAR(20)      NOT NULL,   -- MONITOR | DISCO | TECLADO | RATON | OTRO
        Clave              NVARCHAR(300)    NOT NULL,   -- identidad estable de la pieza
        Marca              NVARCHAR(150)    NULL,
        Modelo             NVARCHAR(200)    NULL,
        Serie              NVARCHAR(150)    NULL,
        Identificador      NVARCHAR(300)    NULL,
        IdentificadorTipo  VARCHAR(40)      NULL,
        Confianza          VARCHAR(10)      NULL,
        Cantidad           INT              NOT NULL CONSTRAINT DF_AFComp_Cantidad DEFAULT (1),
        Detalles           NVARCHAR(MAX)    NULL,       -- JSON crudo del colector (VID/PID, tamaño…)
        Vigente            BIT              NOT NULL CONSTRAINT DF_AFComp_Vigente  DEFAULT (1),
        LoteEnvio          UNIQUEIDENTIFIER NULL,
        PrimeraDeteccion   DATETIME2(0)     NOT NULL CONSTRAINT DF_AFComp_Primera  DEFAULT (SYSDATETIME()),
        UltimaDeteccion    DATETIME2(0)     NOT NULL CONSTRAINT DF_AFComp_Ultima   DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_ActivoFijoEquiposComponentes PRIMARY KEY CLUSTERED (IdEquipoComponente),
        CONSTRAINT CK_AFComp_Tipo CHECK (TipoComponente IN ('MONITOR', 'DISCO', 'TECLADO', 'RATON', 'OTRO'))
    );

    PRINT 'Creada dbo.ActivoFijoEquiposComponentes';
END
ELSE
    PRINT 'dbo.ActivoFijoEquiposComponentes ya existía (sin cambios)';
GO

/* =========================================================
   4. ÍNDICES DE APOYO
   ---------------------------------------------------------
   La unicidad se declara FILTRADA por Vigente = 1. Así el
   colector puede cerrar una fila (Vigente = 0) e insertar la
   nueva sin violar la llave, que es exactamente el histórico
   auditable que pide la regla de oro.
   ========================================================= */

/* --- Red --- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'UX_AFRed_EquipoClave' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposRed'))
    CREATE UNIQUE INDEX UX_AFRed_EquipoClave
        ON dbo.ActivoFijoEquiposRed (IdActivoFijoEQ, Clave)
        WHERE Vigente = 1;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFRed_NoSerie' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposRed'))
    CREATE INDEX IX_AFRed_NoSerie
        ON dbo.ActivoFijoEquiposRed (NoSerie)
        INCLUDE (IP, MAC, Hostname);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFRed_Hostname' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposRed'))
    CREATE INDEX IX_AFRed_Hostname
        ON dbo.ActivoFijoEquiposRed (Hostname)
        INCLUDE (IP, MAC, NoSerie, Vigente, EsPrincipal, UltimaDeteccion);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFRed_IP' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposRed'))
    CREATE INDEX IX_AFRed_IP
        ON dbo.ActivoFijoEquiposRed (IP)
        INCLUDE (MAC, Hostname, NoSerie, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFRed_Lote' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposRed'))
    CREATE INDEX IX_AFRed_Lote
        ON dbo.ActivoFijoEquiposRed (LoteEnvio)
        INCLUDE (IdActivoFijoEQ, NoSerie, Vigente);
GO

/* --- Cuentas --- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'UX_AFCue_EquipoTipoCuenta' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposCuentas'))
    CREATE UNIQUE INDEX UX_AFCue_EquipoTipoCuenta
        ON dbo.ActivoFijoEquiposCuentas (IdActivoFijoEQ, TipoCuenta, Cuenta)
        WHERE Vigente = 1;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFCue_Cuenta' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposCuentas'))
    CREATE INDEX IX_AFCue_Cuenta
        ON dbo.ActivoFijoEquiposCuentas (Cuenta)
        INCLUDE (IdActivoFijoEQ, NoSerie, Hostname, TipoCuenta, Habilitada, UltimoAcceso, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFCue_Equipo' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposCuentas'))
    CREATE INDEX IX_AFCue_Equipo
        ON dbo.ActivoFijoEquiposCuentas (IdActivoFijoEQ, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFCue_Lote' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposCuentas'))
    CREATE INDEX IX_AFCue_Lote
        ON dbo.ActivoFijoEquiposCuentas (LoteEnvio)
        INCLUDE (IdActivoFijoEQ, NoSerie, Vigente);
GO

/* --- Programas (IX_..._Nombre es el que hace usable el buscador
       "¿en qué equipos está X programa?") --- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFProg_Nombre' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposProgramas'))
    CREATE INDEX IX_AFProg_Nombre
        ON dbo.ActivoFijoEquiposProgramas (Programa)
        INCLUDE (IdActivoFijoEQ, NoSerie, Hostname, Version, Fabricante, Vigente, UltimaDeteccion);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFProg_Equipo' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposProgramas'))
    CREATE INDEX IX_AFProg_Equipo
        ON dbo.ActivoFijoEquiposProgramas (IdActivoFijoEQ, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFProg_NoSerie' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposProgramas'))
    CREATE INDEX IX_AFProg_NoSerie
        ON dbo.ActivoFijoEquiposProgramas (NoSerie)
        INCLUDE (Programa, Version, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFProg_Lote' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposProgramas'))
    CREATE INDEX IX_AFProg_Lote
        ON dbo.ActivoFijoEquiposProgramas (LoteEnvio)
        INCLUDE (IdActivoFijoEQ, NoSerie, Vigente);
GO

/* --- Componentes (una pieza física por fila vigente).
       UX filtrada por Vigente = 1: el colector cierra la fila vieja
       (Vigente = 0) e inserta la nueva sin violar la llave. --- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'UX_AFComp_EquipoClave' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes'))
    CREATE UNIQUE INDEX UX_AFComp_EquipoClave
        ON dbo.ActivoFijoEquiposComponentes (IdActivoFijoEQ, Clave)
        WHERE Vigente = 1;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFComp_TipoSerie' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes'))
    CREATE INDEX IX_AFComp_TipoSerie
        ON dbo.ActivoFijoEquiposComponentes (TipoComponente, Serie)
        INCLUDE (IdActivoFijoEQ, NoSerie, Hostname, Marca, Modelo, Identificador, Confianza, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFComp_Identificador' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes'))
    CREATE INDEX IX_AFComp_Identificador
        ON dbo.ActivoFijoEquiposComponentes (Identificador)
        INCLUDE (IdActivoFijoEQ, NoSerie, Hostname, TipoComponente, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFComp_NoSerie' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes'))
    CREATE INDEX IX_AFComp_NoSerie
        ON dbo.ActivoFijoEquiposComponentes (NoSerie)
        INCLUDE (TipoComponente, Hostname, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFComp_Equipo' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes'))
    CREATE INDEX IX_AFComp_Equipo
        ON dbo.ActivoFijoEquiposComponentes (IdActivoFijoEQ, Vigente);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AFComp_Lote' AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes'))
    CREATE INDEX IX_AFComp_Lote
        ON dbo.ActivoFijoEquiposComponentes (LoteEnvio)
        INCLUDE (IdActivoFijoEQ, NoSerie, Vigente);
GO

/* =========================================================
   5. dbo.vw_ActivoFijoEquipoInline
   ---------------------------------------------------------
   Base de la tabla maestra y de la ficha. Un renglón por
   activo con su red principal vigente y los conteos vigentes
   de componentes, programas y cuentas. Los JOIN ya están
   resueltos aquí: la app B nunca los reimplementa.
   ========================================================= */
CREATE OR ALTER VIEW dbo.vw_ActivoFijoEquipoInline
AS
SELECT
    af.IdActivoFijoEQ,
    af.NoSerie,
    red.Hostname,
    red.Dominio,
    red.DominioDNS,
    red.IP,
    red.MAC,
    red.Mascara,
    red.PuertaEnlace,
    red.DNS1,
    red.DNS2,
    red.Adaptador,
    red.EsPrincipal,
    red.UltimaDeteccion,
    CAST(ISNULL(red.TotalRed, 0) AS INT)   AS TotalRed,
    CAST(ISNULL(comp.TotalComp, 0) AS INT) AS Componentes,
    CAST(ISNULL(prog.TotalProg, 0) AS INT) AS Programas,
    CAST(ISNULL(cue.TotalCue, 0) AS INT)   AS Cuentas
FROM dbo.ActivoFijoEquipos af
OUTER APPLY
(
    /* Adaptador principal vigente: el marcado como EsPrincipal y, si
       ninguno lo está, el visto por última vez. Un solo renglón. */
    SELECT TOP (1)
        r.Hostname,
        r.Dominio,
        r.DominioDNS,
        r.IP,
        r.MAC,
        r.Mascara,
        r.PuertaEnlace,
        r.DNS1,
        r.DNS2,
        r.EsPrincipal,
        r.UltimaDeteccion,
        COALESCE(NULLIF(LTRIM(RTRIM(r.NombreAdaptador)), N''),
                 NULLIF(LTRIM(RTRIM(r.DescripcionAdaptador)), N''),
                 r.TipoMedio) AS Adaptador,
        (SELECT COUNT(*) FROM dbo.ActivoFijoEquiposRed x
          WHERE x.IdActivoFijoEQ = af.IdActivoFijoEQ AND x.Vigente = 1) AS TotalRed
    FROM dbo.ActivoFijoEquiposRed r
    WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
      AND r.Vigente = 1
    ORDER BY r.EsPrincipal DESC, r.UltimaDeteccion DESC, r.IdEquipoRed DESC
) red
OUTER APPLY
(
    SELECT COUNT(*) AS TotalProg
    FROM dbo.ActivoFijoEquiposProgramas p
    WHERE p.IdActivoFijoEQ = af.IdActivoFijoEQ AND p.Vigente = 1
) prog
OUTER APPLY
(
    SELECT COUNT(*) AS TotalCue
    FROM dbo.ActivoFijoEquiposCuentas c
    WHERE c.IdActivoFijoEQ = af.IdActivoFijoEQ AND c.Vigente = 1
) cue
OUTER APPLY
(
    /* Piezas conectadas/internas vigentes: cuántas cuelgan del equipo.
       SUM(Cantidad) y no COUNT(*): el conteo que ve el usuario son unidades
       físicas (una fila con Cantidad = 2 son dos discos), igual que el
       listado del inventario y la pestaña Conectados. */
    SELECT SUM(ISNULL(cp.Cantidad, 1)) AS TotalComp
    FROM dbo.ActivoFijoEquiposComponentes cp
    WHERE cp.IdActivoFijoEQ = af.IdActivoFijoEQ AND cp.Vigente = 1
) comp;
GO

/* =========================================================
   6. (Retirado) dbo.vw_ActivoFijoPuenteEquipos
   ---------------------------------------------------------
   El empate con el flujo viejo dbo.Equipos ya no existe: la
   pestaña "Puente con equipos" se eliminó del módulo Detalle.
   Si la base todavía tiene la vista o la tabla de revisiones,
   ejecuta scripts/drop-vw-activo-fijo-puente.sql.
   ========================================================= */
/* =========================================================
   7. Índices de cruce sobre dbo.Equipos
   ---------------------------------------------------------
   Índices NO CLUSTERED sobre las columnas por las que se cruza
   el activo con el flujo viejo (hostname, IP, serie). No cambian
   el flujo de la app A: no alteran columnas ni restricciones.
   ========================================================= */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Equipos_Hostname' AND object_id = OBJECT_ID(N'dbo.Equipos'))
    CREATE INDEX IX_Equipos_Hostname
        ON dbo.Equipos (Hostname)
        INCLUDE (IdCliente, IdPiso, IP, NoSerieCPU);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Equipos_IP' AND object_id = OBJECT_ID(N'dbo.Equipos'))
    CREATE INDEX IX_Equipos_IP
        ON dbo.Equipos (IP)
        INCLUDE (Hostname, NoSerieCPU);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Equipos_NoSerieCPU' AND object_id = OBJECT_ID(N'dbo.Equipos'))
    CREATE INDEX IX_Equipos_NoSerieCPU
        ON dbo.Equipos (NoSerieCPU)
        INCLUDE (Hostname, IP, IdCliente, IdPiso);
GO

/* =========================================================
   8. Resumen final
   ========================================================= */
SELECT Objeto    = o.name,
       Tipo      = o.type_desc,
       Filas     = CASE WHEN o.type = 'U'
                        THEN (SELECT SUM(p.rows) FROM sys.partitions p
                               WHERE p.object_id = o.object_id AND p.index_id IN (0,1))
                        ELSE NULL END
FROM sys.objects o
WHERE o.object_id IN (
        OBJECT_ID(N'dbo.ActivoFijoEquiposRed'),
        OBJECT_ID(N'dbo.ActivoFijoEquiposCuentas'),
        OBJECT_ID(N'dbo.ActivoFijoEquiposProgramas'),
        OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes'),
        OBJECT_ID(N'dbo.vw_ActivoFijoEquipoInline'))
ORDER BY o.type_desc, o.name;
GO

PRINT 'Listo: el módulo Activo Fijo — Detalle ya tiene sus fuentes.';
GO
