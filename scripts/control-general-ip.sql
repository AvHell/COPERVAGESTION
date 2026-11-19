/*
  Ejecutar en la base de datos de la aplicación antes de abrir
  Control general de IP y movimientos futuros del plano.
*/

IF OBJECT_ID(N'dbo.CatalogosInventarioIP', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CatalogosInventarioIP (
        IdCatalogoIP INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_CatalogosInventarioIP PRIMARY KEY,
        TipoCatalogo VARCHAR(30) NOT NULL,
        Nombre NVARCHAR(100) NOT NULL,
        Activo BIT NOT NULL CONSTRAINT DF_CatalogosInventarioIP_Activo DEFAULT (1),
        CONSTRAINT UQ_CatalogosInventarioIP_Tipo_Nombre UNIQUE (TipoCatalogo, Nombre)
    );
END;
GO

IF OBJECT_ID(N'dbo.InventarioGeneralIP', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InventarioGeneralIP (
        IdInventarioIP INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_InventarioGeneralIP PRIMARY KEY,
        IP VARCHAR(45) NULL,
        Hostname NVARCHAR(255) NULL,
        MAC VARCHAR(17) NULL,
        Descripcion NVARCHAR(500) NULL,
        PuertoFortinet NVARCHAR(100) NULL,
        IdEstado INT NOT NULL,
        IdDispositivo INT NOT NULL,
        IdTipoEquipo INT NOT NULL,
        IdPiso INT NOT NULL,
        IdSite INT NOT NULL,
        IdTipoIP INT NOT NULL,
        FechaActualizacion DATETIME2(0) NOT NULL
            CONSTRAINT DF_InventarioGeneralIP_Fecha DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_InventarioGeneralIP_Estado FOREIGN KEY (IdEstado)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP),
        CONSTRAINT FK_InventarioGeneralIP_Dispositivo FOREIGN KEY (IdDispositivo)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP),
        CONSTRAINT FK_InventarioGeneralIP_TipoEquipo FOREIGN KEY (IdTipoEquipo)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP),
        CONSTRAINT FK_InventarioGeneralIP_Piso FOREIGN KEY (IdPiso)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP),
        CONSTRAINT FK_InventarioGeneralIP_Site FOREIGN KEY (IdSite)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP),
        CONSTRAINT FK_InventarioGeneralIP_TipoIP FOREIGN KEY (IdTipoIP)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.InventarioGeneralIP')
      AND name = N'UX_InventarioGeneralIP_IP'
)
    CREATE UNIQUE INDEX UX_InventarioGeneralIP_IP
        ON dbo.InventarioGeneralIP (IP)
        WHERE IP IS NOT NULL;
GO

DECLARE @Semillas TABLE (TipoCatalogo VARCHAR(30), Nombre NVARCHAR(100));
INSERT INTO @Semillas (TipoCatalogo, Nombre)
VALUES
    ('Estado', N'Activo'), ('Estado', N'Inactivo'),
    ('Dispositivo', N'Firewall'), ('Dispositivo', N'Servidor'),
    ('Dispositivo', N'PC'), ('Dispositivo', N'Laptop'),
    ('Dispositivo', N'Celular'), ('Dispositivo', N'Switch'),
    ('Dispositivo', N'Access Point'),
    ('TipoEquipo', N'Físico'), ('TipoEquipo', N'Máquina Virtual'),
    ('Piso', N'Piso 1'), ('Piso', N'Piso 2'),
    ('Site', N'Site principal'),
    ('TipoIP', N'Estatica'), ('TipoIP', N'DHCP');

INSERT INTO dbo.CatalogosInventarioIP (TipoCatalogo, Nombre)
SELECT S.TipoCatalogo, S.Nombre
FROM @Semillas S
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CatalogosInventarioIP C
    WHERE C.TipoCatalogo = S.TipoCatalogo AND C.Nombre = S.Nombre
);
GO

IF OBJECT_ID(N'dbo.EscenariosPlanoFuturo', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EscenariosPlanoFuturo (
        IdEscenarioFuturo INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_EscenariosPlanoFuturo PRIMARY KEY,
        IdPiso INT NOT NULL,
        Nombre NVARCHAR(100) NOT NULL,
        IdUsuarioCreador INT NULL,
        FechaCreacion DATETIME2(0) NOT NULL
            CONSTRAINT DF_EscenariosPlanoFuturo_Fecha DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_EscenariosPlanoFuturo_Piso FOREIGN KEY (IdPiso)
            REFERENCES dbo.Pisos (IdPiso) ON DELETE CASCADE,
        CONSTRAINT FK_EscenariosPlanoFuturo_Usuario FOREIGN KEY (IdUsuarioCreador)
            REFERENCES dbo.Usuarios (IdUsuario)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.EscenariosPlanoFuturo')
      AND name = N'UX_EscenariosPlanoFuturo_Piso_Nombre'
)
    CREATE UNIQUE INDEX UX_EscenariosPlanoFuturo_Piso_Nombre
        ON dbo.EscenariosPlanoFuturo (IdPiso, Nombre);
GO

IF OBJECT_ID(N'dbo.EscenarioPlanoFuturoOriginal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EscenarioPlanoFuturoOriginal (
        IdEscenarioFuturo INT NOT NULL,
        IdEquipo INT NOT NULL,
        IdPisoOriginal INT NOT NULL,
        FilaOriginal INT NOT NULL,
        ColumnaOriginal INT NOT NULL,
        CONSTRAINT PK_EscenarioPlanoFuturoOriginal
            PRIMARY KEY (IdEscenarioFuturo, IdEquipo),
        CONSTRAINT FK_EscenarioPlanoFuturoOriginal_Escenario
            FOREIGN KEY (IdEscenarioFuturo)
            REFERENCES dbo.EscenariosPlanoFuturo (IdEscenarioFuturo)
            ON DELETE CASCADE,
        CONSTRAINT FK_EscenarioPlanoFuturoOriginal_Equipo
            FOREIGN KEY (IdEquipo) REFERENCES dbo.Equipos (IdEquipo),
        CONSTRAINT FK_EscenarioPlanoFuturoOriginal_Piso
            FOREIGN KEY (IdPisoOriginal) REFERENCES dbo.Pisos (IdPiso),
        CONSTRAINT CK_EscenarioPlanoFuturoOriginal_Posicion
            CHECK (FilaOriginal > 0 AND ColumnaOriginal > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.EscenarioPlanoFuturoUbicaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EscenarioPlanoFuturoUbicaciones (
        IdEscenarioFuturo INT NOT NULL,
        IdEquipo INT NOT NULL,
        IdPiso INT NOT NULL,
        Fila INT NOT NULL,
        Columna INT NOT NULL,
        DatosEquipoJson NVARCHAR(MAX) NULL,
        CONSTRAINT PK_EscenarioPlanoFuturoUbicaciones
            PRIMARY KEY (IdEscenarioFuturo, IdEquipo),
        CONSTRAINT FK_EscenarioPlanoFuturoUbicaciones_Original
            FOREIGN KEY (IdEscenarioFuturo, IdEquipo)
            REFERENCES dbo.EscenarioPlanoFuturoOriginal (IdEscenarioFuturo, IdEquipo)
            ON DELETE CASCADE,
        CONSTRAINT FK_EscenarioPlanoFuturoUbicaciones_Piso
            FOREIGN KEY (IdPiso) REFERENCES dbo.Pisos (IdPiso),
        CONSTRAINT CK_EscenarioPlanoFuturoUbicaciones_Posicion
            CHECK (Fila > 0 AND Columna > 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.EscenarioPlanoFuturoUbicaciones')
      AND name = N'UX_EscenarioPlanoFuturoUbicaciones_Celda'
)
    CREATE UNIQUE INDEX UX_EscenarioPlanoFuturoUbicaciones_Celda
        ON dbo.EscenarioPlanoFuturoUbicaciones (IdEscenarioFuturo, IdPiso, Fila, Columna);
GO

IF OBJECT_ID(N'dbo.EscenarioPlanoFuturoPisos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EscenarioPlanoFuturoPisos (
        IdEscenarioFuturo INT NOT NULL,
        IdPiso INT NOT NULL,
        CONSTRAINT PK_EscenarioPlanoFuturoPisos
            PRIMARY KEY (IdEscenarioFuturo, IdPiso),
        CONSTRAINT FK_EscenarioPlanoFuturoPisos_Escenario
            FOREIGN KEY (IdEscenarioFuturo)
            REFERENCES dbo.EscenariosPlanoFuturo (IdEscenarioFuturo)
            ON DELETE CASCADE,
        CONSTRAINT FK_EscenarioPlanoFuturoPisos_Piso
            FOREIGN KEY (IdPiso) REFERENCES dbo.Pisos (IdPiso)
    );
END;
GO

INSERT INTO dbo.EscenarioPlanoFuturoPisos (IdEscenarioFuturo, IdPiso)
SELECT E.IdEscenarioFuturo, E.IdPiso
FROM dbo.EscenariosPlanoFuturo E
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.EscenarioPlanoFuturoPisos EP
    WHERE EP.IdEscenarioFuturo = E.IdEscenarioFuturo
      AND EP.IdPiso = E.IdPiso
);
GO

/* =========================================================
   PREFERENCIAS DEL CONTROL GENERAL DE IP
   Guarda en la base de datos los ajustes de la pantalla que antes
   vivían sólo en el navegador (localStorage), empezando por el color
   con el que se pintan los dispositivos que no pertenecen a ningún
   cliente. Así el ajuste es el mismo en cualquier equipo.
   Idempotente: se puede volver a ejecutar sin duplicar nada.
   ========================================================= */

IF OBJECT_ID(N'dbo.PreferenciasInventarioIP', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PreferenciasInventarioIP (
        Clave VARCHAR(60) NOT NULL
            CONSTRAINT PK_PreferenciasInventarioIP PRIMARY KEY,
        Valor NVARCHAR(200) NULL,
        FechaActualizacion DATETIME2(0) NOT NULL
            CONSTRAINT DF_PreferenciasInventarioIP_Fecha DEFAULT (SYSDATETIME())
    );
END;
GO

/* Color de la etiqueta "General" (dispositivos sin cliente). */
INSERT INTO dbo.PreferenciasInventarioIP (Clave, Valor)
SELECT 'color-general', N'#5C6B73'
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.PreferenciasInventarioIP WHERE Clave = 'color-general'
);
GO

/* =========================================================
   CATÁLOGOS POR ORIGEN
   Origen NULL  -> opción compartida: sirve al control general y a los
                   equipos de los clientes (comportamiento histórico).
   Origen 'General' / 'Cliente' -> opción exclusiva de ese origen, para
                   poder administrar listas distintas sin que choquen.
   ========================================================= */

IF COL_LENGTH('dbo.CatalogosInventarioIP', 'Origen') IS NULL
    ALTER TABLE dbo.CatalogosInventarioIP ADD Origen VARCHAR(10) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.CatalogosInventarioIP')
      AND name = N'CK_CatalogosInventarioIP_Origen'
)
    ALTER TABLE dbo.CatalogosInventarioIP
        ADD CONSTRAINT CK_CatalogosInventarioIP_Origen
        CHECK (Origen IS NULL OR Origen IN ('General', 'Cliente'));
GO

/* La unicidad pasa a incluir Origen: "Piso 1" puede existir a la vez como
   opción compartida, del control general y de los equipos de cliente. */
IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.CatalogosInventarioIP')
      AND name = N'UQ_CatalogosInventarioIP_Tipo_Nombre'
)
    ALTER TABLE dbo.CatalogosInventarioIP
        DROP CONSTRAINT UQ_CatalogosInventarioIP_Tipo_Nombre;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.CatalogosInventarioIP')
      AND name = N'UX_CatalogosInventarioIP_Tipo_Nombre_Origen'
)
    CREATE UNIQUE INDEX UX_CatalogosInventarioIP_Tipo_Nombre_Origen
        ON dbo.CatalogosInventarioIP (TipoCatalogo, Nombre, Origen);
GO

/* =========================================================
   GESTIÓN DE LAS FILAS DEL COLECTOR
   ---------------------------------------------------------
   Las filas con Origen 'Activo' no viven en dbo.InventarioGeneralIP:
   las reporta el colector en dbo.ActivoFijoEquiposRed (IP, MAC,
   hostname, adaptador...). Lo que el colector NO puede saber —y que
   sólo una persona decide— es el piso, el cliente al que pertenece el
   equipo, el puerto del Fortinet y, a veces, una descripción legible:
   el colector manda el nombre técnico del adaptador, p. ej.
   "Intel(R) Ethernet Connection (2) I219-LM #2".

   Esta tabla guarda SÓLO ese complemento y se une por Clave contra la
   fila que ya devuelve dbo.vw_InventarioIPUnificado (o el respaldo
   UNION de src/js/db/inventario-ip.js). No duplica la IP ni crea un
   segundo renglón: la pantalla sigue mostrando UNA fila por adaptador,
   con lo del colector y encima lo gestionado aquí (ver
   aplicarGestion() en src/js/db/inventario-ip.js).

   Es el mismo patrón que dbo.EquiposControlGeneralIP con dbo.Equipos:
   la tabla base manda y ésta sólo la complementa. Como el colector
   nunca escribe aquí, su siguiente lote no borra lo capturado a mano.

   Clave: 'MAC:00:11:22:33:44:55' (la MAC normalizada del adaptador) o
   'IP:192.168.1.10' cuando el adaptador no expone MAC.

   Columnas:
     IdDispositivo / IdTipoEquipo  clasificación de catálogo elegida a mano
                                   (el colector sólo sabe el nombre técnico
                                   del adaptador: «Ethernet 2»).
     IdPiso                        piso del catálogo de control general.
     IdSite                        switch (Site) donde está conectado; es
                                   el equipo dueño del puerto del Fortinet.
     IdCliente                     cliente dueño del aparato.
     PuertoFortinet                puerto del switch Fortinet.
     Descripcion                   texto legible que reemplaza al nombre
                                   técnico del adaptador.
   Todas son NULLables: vacío = «no manda» y se muestra lo del colector.
   ========================================================= */

IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InventarioIPGestion (
        IdGestion INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_InventarioIPGestion PRIMARY KEY,
        Clave VARCHAR(60) NOT NULL,
        IdDispositivo INT NULL,
        IdTipoEquipo INT NULL,
        IdPiso INT NULL,
        IdSite INT NULL,
        IdCliente INT NULL,
        PuertoFortinet NVARCHAR(100) NULL,
        Descripcion NVARCHAR(500) NULL,
        FechaActualizacion DATETIME2(0) NOT NULL
            CONSTRAINT DF_InventarioIPGestion_Fecha DEFAULT (SYSDATETIME()),
        CONSTRAINT UQ_InventarioIPGestion_Clave UNIQUE (Clave)
    );

    PRINT 'Creada dbo.InventarioIPGestion';
END
ELSE
    PRINT 'dbo.InventarioIPGestion ya existía (sin cambios)';
GO

/* Las claves foráneas van en su propio lote y con guardas: la tabla debe
   poder crearse aunque dbo.Clientes aún no exista en esa base. */
/* Dispositivo y Tipo son datos de catálogo que el colector nunca manda (él
   sólo conoce el nombre técnico del adaptador, p.ej. «Ethernet 2»). Se
   guardan aquí para que la clasificación hecha a mano sobreviva a cada lote
   del colector. Columnas nuevas sobre tablas ya creadas: idempotente. */
IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.InventarioIPGestion', N'IdDispositivo') IS NULL
    ALTER TABLE dbo.InventarioIPGestion ADD IdDispositivo INT NULL;
GO

IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.InventarioIPGestion', N'IdTipoEquipo') IS NULL
    ALTER TABLE dbo.InventarioIPGestion ADD IdTipoEquipo INT NULL;
GO

IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.CatalogosInventarioIP', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InventarioIPGestion_Dispositivo')
    ALTER TABLE dbo.InventarioIPGestion
        ADD CONSTRAINT FK_InventarioIPGestion_Dispositivo FOREIGN KEY (IdDispositivo)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP);
GO

IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.CatalogosInventarioIP', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InventarioIPGestion_TipoEquipo')
    ALTER TABLE dbo.InventarioIPGestion
        ADD CONSTRAINT FK_InventarioIPGestion_TipoEquipo FOREIGN KEY (IdTipoEquipo)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP);
GO

/* Switch (Site) al que está conectado el adaptador: el colector no lo sabe
   (él sólo ve la tarjeta de red del equipo) y es el equipo dueño del puerto
   del Fortinet, así que se captura aquí. Idempotente. */
IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.InventarioIPGestion', N'IdSite') IS NULL
    ALTER TABLE dbo.InventarioIPGestion ADD IdSite INT NULL;
GO

IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.CatalogosInventarioIP', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InventarioIPGestion_Site')
    ALTER TABLE dbo.InventarioIPGestion
        ADD CONSTRAINT FK_InventarioIPGestion_Site FOREIGN KEY (IdSite)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP);
GO

IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.CatalogosInventarioIP', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InventarioIPGestion_Piso')
    ALTER TABLE dbo.InventarioIPGestion
        ADD CONSTRAINT FK_InventarioIPGestion_Piso FOREIGN KEY (IdPiso)
            REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP);
GO

/* =========================================================
   PISO: DOS CATÁLOGOS, UNA SOLA ELECCIÓN
   ---------------------------------------------------------
   El piso de un equipo capturado en Equipos o en el plano vive en
   dbo.Pisos («PISO 2», «PISO 3 LADO A»), mientras que el piso que se
   elige en el alta manual del control general vive en
   CatalogosInventarioIP ('Piso') («Piso 2», «Planta Baja»). Son
   vocabularios distintos: si sólo se guardara uno, la fila mostraba el
   piso heredado pero el desplegable salía vacío.
   IdPisoPlano guarda la elección del catálogo del plano; IdPiso la del
   catálogo de control general. Se usan de forma excluyente.
   ========================================================= */
IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.InventarioIPGestion', N'IdPisoPlano') IS NULL
    ALTER TABLE dbo.InventarioIPGestion ADD IdPisoPlano INT NULL;
GO

IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Pisos', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InventarioIPGestion_PisoPlano')
    ALTER TABLE dbo.InventarioIPGestion
        ADD CONSTRAINT FK_InventarioIPGestion_PisoPlano FOREIGN KEY (IdPisoPlano)
            REFERENCES dbo.Pisos (IdPiso);
GO

IF OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Clientes', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_InventarioIPGestion_Cliente')
    ALTER TABLE dbo.InventarioIPGestion
        ADD CONSTRAINT FK_InventarioIPGestion_Cliente FOREIGN KEY (IdCliente)
            REFERENCES dbo.Clientes (IdCliente);
GO

/* Verificación: la tabla debe existir (Existe = 1). Si sale 0, el lote
   anterior no se aplicó y la pantalla seguirá mostrando «Colector» sin
   botón de edición en esas filas. */
SELECT N'dbo.InventarioIPGestion' AS Objeto,
       CAST(CASE WHEN OBJECT_ID(N'dbo.InventarioIPGestion', N'U') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT) AS Existe;
GO
