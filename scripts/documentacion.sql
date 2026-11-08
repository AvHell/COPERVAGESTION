/*
  MÓDULO DOCUMENTACIÓN
  Ejecutar en la base de datos de la aplicación ANTES de abrir
  el módulo "Documentación".

  El archivo (diagrama, manual o procedimiento) se guarda DENTRO
  de la base de datos en la columna Contenido (VARBINARY(MAX)).
  NombreGuardado es sólo una clave lógica para localizarlo; no
  corresponde a ninguna ruta del disco.

  El script es idempotente: se puede ejecutar varias veces sin
  duplicar tablas, índices ni secciones. También sirve para
  actualizar una instalación anterior (sección 8).
*/

/* =========================================================
   1. DOCUMENTOS (tabla principal)
   ========================================================= */
IF OBJECT_ID(N'dbo.Documentos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Documentos (
        Id             NVARCHAR(40)   NOT NULL
            CONSTRAINT PK_Documentos PRIMARY KEY,
        Seccion        NVARCHAR(60)   NOT NULL,
        Titulo         NVARCHAR(200)  NOT NULL,
        Cliente        NVARCHAR(60)   NULL,
        Categoria      NVARCHAR(100)  NULL,
        NombreOriginal NVARCHAR(260)  NOT NULL,
        NombreGuardado NVARCHAR(260)  NOT NULL,
        Contenido      VARBINARY(MAX) NULL,
        TipoMime       NVARCHAR(150)  NOT NULL
            CONSTRAINT DF_Documentos_TipoMime DEFAULT (N'application/octet-stream'),
        TamanoBytes    BIGINT         NOT NULL
            CONSTRAINT DF_Documentos_Tamano DEFAULT (0),
        Hash           CHAR(64)       NOT NULL
            CONSTRAINT DF_Documentos_Hash DEFAULT (''),
        VersionActual  INT            NOT NULL
            CONSTRAINT DF_Documentos_Version DEFAULT (1),
        Descripcion    NVARCHAR(1000) NULL,
        Eliminado      BIT            NOT NULL
            CONSTRAINT DF_Documentos_Eliminado DEFAULT (0),
        CreadoEn       BIGINT         NOT NULL
            CONSTRAINT DF_Documentos_Creado DEFAULT (0),
        ActualizadoEn  BIGINT         NOT NULL
            CONSTRAINT DF_Documentos_Actualizado DEFAULT (0)
    );
END;
GO

/* =========================================================
   2. VERSIONES DEL DOCUMENTO
   ========================================================= */
IF OBJECT_ID(N'dbo.VersionesDocumento', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VersionesDocumento (
        Id            NVARCHAR(40)  NOT NULL
            CONSTRAINT PK_VersionesDocumento PRIMARY KEY,
        DocumentoId   NVARCHAR(40)  NOT NULL,
        NumeroVersion INT           NOT NULL,
        NombreGuardado NVARCHAR(260) NOT NULL,
        NombreOriginal NVARCHAR(260) NOT NULL,
        Contenido     VARBINARY(MAX) NULL,
        Hash          CHAR(64)      NOT NULL
            CONSTRAINT DF_VersionesDocumento_Hash DEFAULT (''),
        TamanoBytes   BIGINT        NOT NULL
            CONSTRAINT DF_VersionesDocumento_Tamano DEFAULT (0),
        TipoMime      NVARCHAR(150) NULL,
        CreadoEn      BIGINT        NOT NULL
            CONSTRAINT DF_VersionesDocumento_Creado DEFAULT (0),
        CONSTRAINT FK_VersionesDocumento_Documentos
            FOREIGN KEY (DocumentoId) REFERENCES dbo.Documentos (Id)
            ON DELETE CASCADE
    );
END;
GO

/* =========================================================
   3. SECCIONES (menú dinámico del módulo)
   ========================================================= */
IF OBJECT_ID(N'dbo.Secciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Secciones (
        Id     NVARCHAR(60)  NOT NULL
            CONSTRAINT PK_Secciones PRIMARY KEY,
        Nombre NVARCHAR(100) NOT NULL,
        Icono  NVARCHAR(20)  NULL,
        Orden  INT           NOT NULL
            CONSTRAINT DF_Secciones_Orden DEFAULT (0),
        Activa BIT           NOT NULL
            CONSTRAINT DF_Secciones_Activa DEFAULT (1)
    );
END;
GO

/* =========================================================
   4. ETIQUETAS
   ========================================================= */
IF OBJECT_ID(N'dbo.Etiquetas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Etiquetas (
        Id     NVARCHAR(40) NOT NULL
            CONSTRAINT PK_Etiquetas PRIMARY KEY,
        Nombre NVARCHAR(60) NOT NULL
            CONSTRAINT UQ_Etiquetas_Nombre UNIQUE
    );
END;
GO

/* =========================================================
   5. RELACIÓN DOCUMENTOS - ETIQUETAS
   ========================================================= */
IF OBJECT_ID(N'dbo.DocumentosEtiquetas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DocumentosEtiquetas (
        DocumentoId NVARCHAR(40) NOT NULL,
        EtiquetaId  NVARCHAR(40) NOT NULL,
        CONSTRAINT PK_DocumentosEtiquetas PRIMARY KEY (DocumentoId, EtiquetaId),
        CONSTRAINT FK_DocumentosEtiquetas_Documentos
            FOREIGN KEY (DocumentoId) REFERENCES dbo.Documentos (Id)
            ON DELETE CASCADE,
        CONSTRAINT FK_DocumentosEtiquetas_Etiquetas
            FOREIGN KEY (EtiquetaId) REFERENCES dbo.Etiquetas (Id)
            ON DELETE CASCADE
    );
END;
GO

/* =========================================================
   6. ÍNDICES
   ========================================================= */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Documentos')
      AND name = N'IX_Documentos_Seccion'
)
    CREATE INDEX IX_Documentos_Seccion ON dbo.Documentos (Seccion);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Documentos')
      AND name = N'IX_Documentos_Cliente'
)
    CREATE INDEX IX_Documentos_Cliente ON dbo.Documentos (Cliente);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Documentos')
      AND name = N'IX_Documentos_Hash'
)
    CREATE INDEX IX_Documentos_Hash ON dbo.Documentos (Hash);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Documentos')
      AND name = N'IX_Documentos_Eliminado'
)
    CREATE INDEX IX_Documentos_Eliminado ON dbo.Documentos (Eliminado);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.VersionesDocumento')
      AND name = N'IX_VersionesDocumento_Documento'
)
    CREATE INDEX IX_VersionesDocumento_Documento
        ON dbo.VersionesDocumento (DocumentoId);
GO

/* Búsqueda del binario por su clave lógica (NombreGuardado) */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Documentos')
      AND name = N'IX_Documentos_NombreGuardado'
)
    CREATE INDEX IX_Documentos_NombreGuardado ON dbo.Documentos (NombreGuardado);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.VersionesDocumento')
      AND name = N'IX_VersionesDocumento_Nombre'
)
    CREATE INDEX IX_VersionesDocumento_Nombre
        ON dbo.VersionesDocumento (NombreGuardado);
GO

/* =========================================================
   7. SECCIONES INICIALES
   ========================================================= */
INSERT INTO dbo.Secciones (Id, Nombre, Icono, Orden, Activa)
SELECT N'diagramas', N'Diagramas', N'◈', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Secciones WHERE Id = N'diagramas');
GO

INSERT INTO dbo.Secciones (Id, Nombre, Icono, Orden, Activa)
SELECT N'manuales', N'Manuales', N'▤', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Secciones WHERE Id = N'manuales');
GO

INSERT INTO dbo.Secciones (Id, Nombre, Icono, Orden, Activa)
SELECT N'procedimientos', N'Procedimientos', N'✓', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Secciones WHERE Id = N'procedimientos');
GO

/* =========================================================
   8. ACTUALIZACIÓN DE UNA INSTALACIÓN ANTERIOR
   ---------------------------------------------------------
   Si el módulo ya existía y los archivos se guardaban en disco,
   estas sentencias agregan la columna Contenido sin tocar los
   datos. Los documentos cargados antes de la migración quedan
   con Contenido = NULL y el sistema los sigue leyendo desde
   userData/documentos; al subir una nueva versión el binario ya
   se almacena en la base de datos.
   ========================================================= */
IF COL_LENGTH('dbo.Documentos', 'Contenido') IS NULL
    ALTER TABLE dbo.Documentos ADD Contenido VARBINARY(MAX) NULL;
GO

IF COL_LENGTH('dbo.VersionesDocumento', 'Contenido') IS NULL
    ALTER TABLE dbo.VersionesDocumento ADD Contenido VARBINARY(MAX) NULL;
GO
