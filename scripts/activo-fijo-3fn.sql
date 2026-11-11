/*
  ============================================================
  ACTIVO FIJO — NORMALIZACIÓN A 3FN
  ============================================================
  Ejecutar en la base de datos de la aplicación, antes de abrir
  el módulo de Activo Fijo con la versión normalizada.

  QUÉ PROBLEMA RESUELVE
  ---------------------
  ActivoFijoEquipos y ActivoFijoResponsivas guardaban el TEXTO de
  valores que ya viven en catálogos (Modelo, Procesador,
  MemoriaRAM, Almacenamiento, SistemaOperativo, UsuarioAsignado,
  MotivoSalida, NombreProyecto, DescripcionSolicitud, AreaEntrega,
  PuestoEntrega, NombreEntrega, NombreRecibe...). Eso rompe 3FN:
  el nombre del catálogo se copiaba en cada fila y podía quedar
  distinto entre activos ("HP" / "hp" / "H.P.").

  QUÉ HACE
  --------
   1. Asegura que existan las tablas de catálogo.
   2. Agrega las columnas de clave foránea (FK) que faltaban.
   3. Da de alta en cada catálogo los valores que sólo existían
      como texto en las tablas operativas.
   4. Rellena (backfill) las nuevas FK a partir del texto.
   5. Crea índices y restricciones FK.
   5b. Pasa los accesorios a la tabla puente
      dbo.ActivoFijoEquiposAccesorios (un activo lleva VARIOS
      accesorios: la celda de texto violaba 1FN).
   6. Recrea las 10 vistas y los 4 triggers para que lean por JOIN
      y no por las columnas de texto.
   7. (Opcional, al final) elimina las columnas de texto.

  MIGRACIÓN EN DOS FASES  (FASE 2 YA APLICADA)
  -------------------------------------------
  El script nació con el paso 7 (DROP de las columnas de texto)
  apagado por defecto, para operar unos días con las columnas
  vivas y confirmar que todo se veía bien. **La fase 2 ya se
  ejecutó** sobre la base de datos: las 15 columnas de texto
  listadas arriba ya NO existen.

  @AplicarLimpieza sigue valiendo 1 más abajo para que, si el
  script se vuelve a ejecutar, los bloques de limpieza intenten
  el DROP. Son idempotentes: comprueban la existencia de la
  columna (y de su DEFAULT / índice / CHECK) antes de borrar,
  así que volver a correrlo no falla ni destruye nada.

  NOTA: el código de la aplicación ya no depende de esas
  columnas. `activos.js`, `responsivas.js`, `importacion.js` e
  `importar.js` escriben dinámicamente sólo las columnas que
  existen (ver `catalogos.columnasExistentes()`), por lo que
  funcionan igual antes y después del DROP.

  IDEMPOTENTE: se puede volver a ejecutar sin efectos secundarios.

  LO QUE NO SE NORMALIZA A PROPÓSITO
  ----------------------------------
  - dbo.ActivoFijoAsignacionesHist y dbo.ActivoFijoHistoricos son
    tablas de SNAPSHOT: guardan el valor tal como estaba en el
    momento del movimiento. Si mañana cambia el nombre de un
    modelo, la responsiva histórica debe seguir mostrando el
    nombre original. Eso NO viola 3FN, es el requisito de un
    histórico inmutable.
  - dbo.ActivoFijoResponsivas.AreaRecibe todavía no tiene catálogo.
  - PuestoRecibe ya está normalizado por dbo.ActivoFijoResponsivas
    .IdPuesto; su columna de texto es sólo duplicado.
  ============================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ============================================================
   1. TABLAS DE CATÁLOGO (defensivo: crea sólo las que falten)
   Misma forma que usa src/ActivoFijo/consultas/catalogos.js
   ============================================================ */
DECLARE @Catalogos TABLE (Tabla NVARCHAR(128) PRIMARY KEY, Pk NVARCHAR(128), Largo INT);

INSERT INTO @Catalogos (Tabla, Pk, Largo) VALUES
    (N'ActivoFijoModelos',              N'IdModelo',              150),
    (N'ActivoFijoProcesadores',         N'IdProcesador',          150),
    (N'ActivoFijoMemoriasRAM',          N'IdMemoriaRAM',           50),
    (N'ActivoFijoAlmacenamientos',      N'IdAlmacenamiento',       50),
    (N'ActivoFijoSistemasOperativos',   N'IdSistemaOperativo',    100),
    (N'ActivoFijoAccesorios',           N'IdAccesorio',           300),
    (N'ActivoFijoUsuariosAsignados',    N'IdUsuarioAsignado',     200),
    (N'ActivoFijoResponsivasMotivos',   N'IdMotivoResponsiva',    150),
    (N'ActivoFijoResponsivasProyectos', N'IdProyectoResponsiva',  200),
    (N'ActivoFijoResponsivasDescripciones', N'IdDescripcionResponsiva', 300),
    (N'ActivoFijoResponsivasAreasEntrega',  N'IdAreaEntregaResponsiva', 100),
    (N'ActivoFijoResponsivasPuestosEntrega', N'IdPuestoEntregaResponsiva', 100);

DECLARE @tabla NVARCHAR(128), @pk NVARCHAR(128), @largo INT, @sql NVARCHAR(MAX);

DECLARE curCatalogo CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla, Pk, Largo FROM @Catalogos;
OPEN curCatalogo;
FETCH NEXT FROM curCatalogo INTO @tabla, @pk, @largo;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'
        IF OBJECT_ID(N''dbo.' + @tabla + N''', N''U'') IS NULL
            CREATE TABLE dbo.' + QUOTENAME(@tabla) + N' (
                ' + QUOTENAME(@pk) + N' INT IDENTITY(1,1) NOT NULL
                    CONSTRAINT PK_' + @tabla + N' PRIMARY KEY,
                Nombre NVARCHAR(' + CAST(@largo AS NVARCHAR(10)) + N') NOT NULL,
                Activo BIT NOT NULL
                    CONSTRAINT DF_' + @tabla + N'_Activo DEFAULT (1)
            );';
    EXEC sp_executesql @sql;
    FETCH NEXT FROM curCatalogo INTO @tabla, @pk, @largo;
END
CLOSE curCatalogo;
DEALLOCATE curCatalogo;
GO

/* ============================================================
   2-3. COLUMNAS FK QUE FALTABAN
   ============================================================ */
DECLARE @Fks TABLE (Tabla NVARCHAR(128), Columna NVARCHAR(128));
INSERT INTO @Fks (Tabla, Columna) VALUES
    (N'ActivoFijoEquipos', N'IdModelo'),
    (N'ActivoFijoEquipos', N'IdProcesador'),
    (N'ActivoFijoEquipos', N'IdMemoriaRAM'),
    (N'ActivoFijoEquipos', N'IdAlmacenamiento'),
    (N'ActivoFijoEquipos', N'IdSistemaOperativo'),
    (N'ActivoFijoEquipos', N'IdUsuarioAsignado'),
    (N'ActivoFijoResponsivas', N'IdMotivoResponsiva'),
    (N'ActivoFijoResponsivas', N'IdProyectoResponsiva'),
    (N'ActivoFijoResponsivas', N'IdDescripcionResponsiva'),
    (N'ActivoFijoResponsivas', N'IdAreaEntregaResponsiva'),
    (N'ActivoFijoResponsivas', N'IdPuestoEntregaResponsiva'),
    (N'ActivoFijoResponsivas', N'IdUsuarioEntrega'),
    (N'ActivoFijoResponsivas', N'IdUsuarioRecibe');

DECLARE @tablaFk NVARCHAR(128), @colFk NVARCHAR(128), @sql NVARCHAR(MAX);
DECLARE curFk CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla, Columna FROM @Fks;
OPEN curFk;
FETCH NEXT FROM curFk INTO @tablaFk, @colFk;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @tablaFk, @colFk) IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tablaFk)
                 + N' ADD ' + QUOTENAME(@colFk) + N' INT NULL;';
        EXEC sp_executesql @sql;
    END
    FETCH NEXT FROM curFk INTO @tablaFk, @colFk;
END
CLOSE curFk;
DEALLOCATE curFk;
GO

/* ============================================================
   4-5. BACKFILL: del texto a la FK
   Se apagan los triggers para que el backfill no ensucie
   el histórico de movimientos.
   ============================================================ */
ALTER TABLE dbo.ActivoFijoEquipos DISABLE TRIGGER ALL;
GO
ALTER TABLE dbo.ActivoFijoResponsivas DISABLE TRIGGER ALL;
GO

DECLARE @Map TABLE (
    OrigenTabla   NVARCHAR(128),
    ColumnaTexto  NVARCHAR(128),
    CatTabla      NVARCHAR(128),
    CatPk         NVARCHAR(128),
    FkColumna     NVARCHAR(128)
);

INSERT INTO @Map (OrigenTabla, ColumnaTexto, CatTabla, CatPk, FkColumna) VALUES
    (N'ActivoFijoEquipos',    N'Modelo',              N'ActivoFijoModelos',                   N'IdModelo',                  N'IdModelo'),
    (N'ActivoFijoEquipos',    N'Procesador',          N'ActivoFijoProcesadores',              N'IdProcesador',              N'IdProcesador'),
    (N'ActivoFijoEquipos',    N'MemoriaRAM',          N'ActivoFijoMemoriasRAM',               N'IdMemoriaRAM',              N'IdMemoriaRAM'),
    (N'ActivoFijoEquipos',    N'Almacenamiento',      N'ActivoFijoAlmacenamientos',           N'IdAlmacenamiento',          N'IdAlmacenamiento'),
    (N'ActivoFijoEquipos',    N'SistemaOperativo',    N'ActivoFijoSistemasOperativos',        N'IdSistemaOperativo',        N'IdSistemaOperativo'),
    (N'ActivoFijoEquipos',    N'UsuarioAsignado',     N'ActivoFijoUsuariosAsignados',         N'IdUsuarioAsignado',         N'IdUsuarioAsignado'),
    (N'ActivoFijoResponsivas',N'MotivoSalida',        N'ActivoFijoResponsivasMotivos',        N'IdMotivoResponsiva',        N'IdMotivoResponsiva'),
    (N'ActivoFijoResponsivas',N'NombreProyecto',      N'ActivoFijoResponsivasProyectos',      N'IdProyectoResponsiva',      N'IdProyectoResponsiva'),
    (N'ActivoFijoResponsivas',N'DescripcionSolicitud',N'ActivoFijoResponsivasDescripciones',  N'IdDescripcionResponsiva',   N'IdDescripcionResponsiva'),
    (N'ActivoFijoResponsivas',N'AreaEntrega',         N'ActivoFijoResponsivasAreasEntrega',   N'IdAreaEntregaResponsiva',   N'IdAreaEntregaResponsiva'),
    (N'ActivoFijoResponsivas',N'PuestoEntrega',       N'ActivoFijoResponsivasPuestosEntrega', N'IdPuestoEntregaResponsiva', N'IdPuestoEntregaResponsiva');

DECLARE @t NVARCHAR(128), @col NVARCHAR(128),
        @cat NVARCHAR(128), @catPk NVARCHAR(128), @fk NVARCHAR(128),
        @sql NVARCHAR(MAX);

DECLARE curMap CURSOR LOCAL FAST_FORWARD FOR
    SELECT OrigenTabla, ColumnaTexto, CatTabla, CatPk, FkColumna FROM @Map;
OPEN curMap;
FETCH NEXT FROM curMap INTO @t, @col, @cat, @catPk, @fk;
WHILE @@FETCH_STATUS = 0
BEGIN
    /* 4.a Dar de alta en el catálogo los valores que sólo eran texto */
    SET @sql = N'
        INSERT INTO dbo.' + QUOTENAME(@cat) + N' (Nombre)
        SELECT DISTINCT LTRIM(RTRIM(o.' + QUOTENAME(@col) + N'))
        FROM dbo.' + QUOTENAME(@t) + N' o
        WHERE NULLIF(LTRIM(RTRIM(o.' + QUOTENAME(@col) + N')), N'''') IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM dbo.' + QUOTENAME(@cat) + N' c
              WHERE UPPER(LTRIM(RTRIM(c.Nombre))) =
                    UPPER(LTRIM(RTRIM(o.' + QUOTENAME(@col) + N')))
          );';
    EXEC sp_executesql @sql;

    /* 4.b Enlazar la FK por nombre (MIN evita duplicados por capitalización) */
    SET @sql = N'
        UPDATE o
        SET o.' + QUOTENAME(@fk) + N' = x.Id
        FROM dbo.' + QUOTENAME(@t) + N' o
        CROSS APPLY (
            SELECT MIN(c.' + QUOTENAME(@catPk) + N') AS Id
            FROM dbo.' + QUOTENAME(@cat) + N' c
            WHERE UPPER(LTRIM(RTRIM(c.Nombre))) =
                  UPPER(LTRIM(RTRIM(o.' + QUOTENAME(@col) + N')))
        ) x
        WHERE o.' + QUOTENAME(@fk) + N' IS NULL
          AND NULLIF(LTRIM(RTRIM(o.' + QUOTENAME(@col) + N')), N'''') IS NOT NULL;';
    EXEC sp_executesql @sql;

    FETCH NEXT FROM curMap INTO @t, @col, @cat, @catPk, @fk;
END
CLOSE curMap;
DEALLOCATE curMap;
GO

/* 4.c NombreRecibe de responsivas → catálogo Usuarios asignados.
   Así "Usuarios asignados" queda completo con quien recibió. */
IF OBJECT_ID(N'dbo.ActivoFijoResponsivas', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.ActivoFijoUsuariosAsignados (Nombre)
    SELECT DISTINCT LTRIM(RTRIM(r.NombreRecibe))
    FROM dbo.ActivoFijoResponsivas r
    WHERE NULLIF(LTRIM(RTRIM(r.NombreRecibe)), N'') IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ActivoFijoUsuariosAsignados c
          WHERE UPPER(LTRIM(RTRIM(c.Nombre))) =
                UPPER(LTRIM(RTRIM(r.NombreRecibe)))
      );

    UPDATE r
    SET r.IdUsuarioRecibe = x.Id
    FROM dbo.ActivoFijoResponsivas r
    CROSS APPLY (
        SELECT MIN(c.IdUsuarioAsignado) AS Id
        FROM dbo.ActivoFijoUsuariosAsignados c
        WHERE UPPER(LTRIM(RTRIM(c.Nombre))) =
              UPPER(LTRIM(RTRIM(r.NombreRecibe)))
    ) x
    WHERE r.IdUsuarioRecibe IS NULL
      AND NULLIF(LTRIM(RTRIM(r.NombreRecibe)), N'') IS NOT NULL;
END;
GO

/* 5.f NombreEntrega → dbo.Usuarios (quien entrega es un usuario del sistema) */
IF OBJECT_ID(N'dbo.ActivoFijoResponsivas', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Usuarios', N'U') IS NOT NULL
BEGIN
    UPDATE r
    SET r.IdUsuarioEntrega = x.Id
    FROM dbo.ActivoFijoResponsivas r
    CROSS APPLY (
        SELECT TOP 1 u.IdUsuario AS Id
        FROM dbo.Usuarios u
        WHERE UPPER(LTRIM(RTRIM(
                  COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.Nombres, N' ', u.Apellidos))), N''), u.NombreUsuario)
              ))) = UPPER(LTRIM(RTRIM(r.NombreEntrega)))
           OR UPPER(LTRIM(RTRIM(u.NombreUsuario))) = UPPER(LTRIM(RTRIM(r.NombreEntrega)))
        ORDER BY u.Activo DESC, u.IdUsuario
    ) x
    WHERE r.IdUsuarioEntrega IS NULL
      AND NULLIF(LTRIM(RTRIM(r.NombreEntrega)), N'') IS NOT NULL;
END;
GO

ALTER TABLE dbo.ActivoFijoEquipos ENABLE TRIGGER ALL;
GO
ALTER TABLE dbo.ActivoFijoResponsivas ENABLE TRIGGER ALL;
GO
/* ============================================================
   6. RESTRICCIONES DE CLAVE FORÁNEA
   NO ACTION: los catálogos usan baja lógica (Activo = 0),
   nunca se borran filas.
   ============================================================ */
DECLARE @FkDefs TABLE (
    Nombre    NVARCHAR(128) PRIMARY KEY,
    Tabla     NVARCHAR(128),
    Columna   NVARCHAR(128),
    RefTabla  NVARCHAR(128),
    RefPk     NVARCHAR(128)
);

INSERT INTO @FkDefs (Nombre, Tabla, Columna, RefTabla, RefPk) VALUES
    (N'FK_ActivoFijoEquipos_Modelo',            N'ActivoFijoEquipos', N'IdModelo',                  N'ActivoFijoModelos',                   N'IdModelo'),
    (N'FK_ActivoFijoEquipos_Procesador',        N'ActivoFijoEquipos', N'IdProcesador',              N'ActivoFijoProcesadores',              N'IdProcesador'),
    (N'FK_ActivoFijoEquipos_MemoriaRAM',        N'ActivoFijoEquipos', N'IdMemoriaRAM',              N'ActivoFijoMemoriasRAM',               N'IdMemoriaRAM'),
    (N'FK_ActivoFijoEquipos_Almacenamiento',    N'ActivoFijoEquipos', N'IdAlmacenamiento',          N'ActivoFijoAlmacenamientos',           N'IdAlmacenamiento'),
    (N'FK_ActivoFijoEquipos_SistemaOperativo',  N'ActivoFijoEquipos', N'IdSistemaOperativo',        N'ActivoFijoSistemasOperativos',        N'IdSistemaOperativo'),
    (N'FK_ActivoFijoEquipos_UsuarioAsignado',   N'ActivoFijoEquipos', N'IdUsuarioAsignado',         N'ActivoFijoUsuariosAsignados',         N'IdUsuarioAsignado'),
    (N'FK_ActivoFijoResponsivas_Motivo',        N'ActivoFijoResponsivas', N'IdMotivoResponsiva',     N'ActivoFijoResponsivasMotivos',        N'IdMotivoResponsiva'),
    (N'FK_ActivoFijoResponsivas_Proyecto',      N'ActivoFijoResponsivas', N'IdProyectoResponsiva',   N'ActivoFijoResponsivasProyectos',      N'IdProyectoResponsiva'),
    (N'FK_ActivoFijoResponsivas_Descripcion',   N'ActivoFijoResponsivas', N'IdDescripcionResponsiva',N'ActivoFijoResponsivasDescripciones',  N'IdDescripcionResponsiva'),
    (N'FK_ActivoFijoResponsivas_AreaEntrega',   N'ActivoFijoResponsivas', N'IdAreaEntregaResponsiva',N'ActivoFijoResponsivasAreasEntrega',   N'IdAreaEntregaResponsiva'),
    (N'FK_ActivoFijoResponsivas_PuestoEntrega', N'ActivoFijoResponsivas', N'IdPuestoEntregaResponsiva', N'ActivoFijoResponsivasPuestosEntrega', N'IdPuestoEntregaResponsiva'),
    (N'FK_ActivoFijoResponsivas_UsuarioEntrega',N'ActivoFijoResponsivas', N'IdUsuarioEntrega',       N'Usuarios',                            N'IdUsuario'),
    (N'FK_ActivoFijoResponsivas_UsuarioRecibe', N'ActivoFijoResponsivas', N'IdUsuarioRecibe',        N'ActivoFijoUsuariosAsignados',         N'IdUsuarioAsignado');

DECLARE @fkNombre NVARCHAR(128), @fkTabla NVARCHAR(128), @fkCol NVARCHAR(128),
        @fkRefTabla NVARCHAR(128), @fkRefPk NVARCHAR(128), @sql NVARCHAR(MAX);

DECLARE curFkDef CURSOR LOCAL FAST_FORWARD FOR
    SELECT Nombre, Tabla, Columna, RefTabla, RefPk FROM @FkDefs;
OPEN curFkDef;
FETCH NEXT FROM curFkDef INTO @fkNombre, @fkTabla, @fkCol, @fkRefTabla, @fkRefPk;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = @fkNombre)
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@fkTabla)
                 + N' ADD CONSTRAINT ' + QUOTENAME(@fkNombre)
                 + N' FOREIGN KEY (' + QUOTENAME(@fkCol) + N')'
                 + N' REFERENCES dbo.' + QUOTENAME(@fkRefTabla)
                 + N' (' + QUOTENAME(@fkRefPk) + N');';
        EXEC sp_executesql @sql;
    END
    FETCH NEXT FROM curFkDef INTO @fkNombre, @fkTabla, @fkCol, @fkRefTabla, @fkRefPk;
END
CLOSE curFkDef;
DEALLOCATE curFkDef;
GO

/* ============================================================
   7. ÍNDICES SOBRE LAS FK (SQL Server no los crea solo)
   ============================================================ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_ActivoFijoEquipos_IdUsuarioAsignado'
                 AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquipos'))
    CREATE INDEX IX_ActivoFijoEquipos_IdUsuarioAsignado
        ON dbo.ActivoFijoEquipos (IdUsuarioAsignado) INCLUDE (IdTipo, IdEstatus);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_ActivoFijoEquipos_Especificaciones'
                 AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquipos'))
    CREATE INDEX IX_ActivoFijoEquipos_Especificaciones
        ON dbo.ActivoFijoEquipos (IdModelo, IdProcesador, IdMemoriaRAM,
                                  IdAlmacenamiento, IdSistemaOperativo);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_ActivoFijoResponsivas_IdUsuarioRecibe'
                 AND object_id = OBJECT_ID(N'dbo.ActivoFijoResponsivas'))
    CREATE INDEX IX_ActivoFijoResponsivas_IdUsuarioRecibe
        ON dbo.ActivoFijoResponsivas (IdUsuarioRecibe)
        INCLUDE (EstatusResponsiva, IdActivoFijoEQ);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_ActivoFijoResponsivas_IdUsuarioEntrega'
                 AND object_id = OBJECT_ID(N'dbo.ActivoFijoResponsivas'))
    CREATE INDEX IX_ActivoFijoResponsivas_IdUsuarioEntrega
        ON dbo.ActivoFijoResponsivas (IdUsuarioEntrega);
GO
/* ============================================================
   7B. ACCESORIOS — TABLA PUENTE (1FN)
   ActivoFijoEquipos.Accesorios guardaba VARIOS accesorios en una
   sola celda. Ahora cada activo apunta a sus conjuntos del
   catálogo ActivoFijoAccesorios mediante esta tabla N:M; la
   columna de texto queda sólo como respaldo hasta la fase 2.
   ============================================================ */
IF OBJECT_ID(N'dbo.ActivoFijoEquiposAccesorios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActivoFijoEquiposAccesorios (
        IdEquipoAccesorio INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ActivoFijoEquiposAccesorios PRIMARY KEY,
        IdActivoFijoEQ INT NOT NULL,
        IdAccesorio    INT NOT NULL,
        CONSTRAINT UQ_ActivoFijoEquiposAccesorios UNIQUE (IdActivoFijoEQ, IdAccesorio)
    );
    PRINT 'Creada dbo.ActivoFijoEquiposAccesorios.';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = N'FK_ActivoFijoEquiposAccesorios_Equipo')
    ALTER TABLE dbo.ActivoFijoEquiposAccesorios
        ADD CONSTRAINT FK_ActivoFijoEquiposAccesorios_Equipo
            FOREIGN KEY (IdActivoFijoEQ) REFERENCES dbo.ActivoFijoEquipos (IdActivoFijoEQ);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = N'FK_ActivoFijoEquiposAccesorios_Accesorio')
    ALTER TABLE dbo.ActivoFijoEquiposAccesorios
        ADD CONSTRAINT FK_ActivoFijoEquiposAccesorios_Accesorio
            FOREIGN KEY (IdAccesorio) REFERENCES dbo.ActivoFijoAccesorios (IdAccesorio);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_ActivoFijoEquiposAccesorios_IdAccesorio'
                 AND object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposAccesorios'))
    CREATE INDEX IX_ActivoFijoEquiposAccesorios_IdAccesorio
        ON dbo.ActivoFijoEquiposAccesorios (IdAccesorio)
        INCLUDE (IdActivoFijoEQ);
GO
/* Respaldo del texto a la tabla puente (idempotente). */
IF COL_LENGTH(N'dbo.ActivoFijoEquipos', N'Accesorios') IS NOT NULL
BEGIN
    INSERT INTO dbo.ActivoFijoAccesorios (Nombre)
    SELECT DISTINCT LTRIM(RTRIM(af.Accesorios))
    FROM dbo.ActivoFijoEquipos af
    WHERE af.Accesorios IS NOT NULL
      AND LTRIM(RTRIM(af.Accesorios)) <> ''
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ActivoFijoAccesorios c
          WHERE UPPER(c.Nombre) = UPPER(LTRIM(RTRIM(af.Accesorios)))
      );

    ;WITH objetivo AS (
        SELECT af.IdActivoFijoEQ, MIN(c.IdAccesorio) AS IdAccesorio
        FROM dbo.ActivoFijoEquipos af
        INNER JOIN dbo.ActivoFijoAccesorios c
                ON UPPER(c.Nombre) = UPPER(LTRIM(RTRIM(af.Accesorios)))
        WHERE af.Accesorios IS NOT NULL
          AND LTRIM(RTRIM(af.Accesorios)) <> ''
        GROUP BY af.IdActivoFijoEQ
    )
    INSERT INTO dbo.ActivoFijoEquiposAccesorios (IdActivoFijoEQ, IdAccesorio)
    SELECT o.IdActivoFijoEQ, o.IdAccesorio
    FROM objetivo o
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.ActivoFijoEquiposAccesorios ea
        WHERE ea.IdActivoFijoEQ = o.IdActivoFijoEQ
          AND ea.IdAccesorio    = o.IdAccesorio
    );
END;
GO
/* ============================================================
   8. VISTAS
   Se recrean SÓLO las 5 que leían columnas de texto; el resto
   (PorTipo, ValorPorCartera, HistorialAsignaciones, PorTicket,
   HistorialActivo) no toca columnas denormalizadas y se deja
   intacto. Nombres y orden de columnas se conservan.
   ============================================================ */
CREATE OR ALTER VIEW dbo.vw_ActivoFijoInventario AS
SELECT
    af.IdActivoFijoEQ,
    c.Nombre            AS Cartera,
    af.NoSerie,
    af.IMEI1,
    af.IMEI2,
    af.NoTelefono,
    m.Nombre            AS Marca,
    mo.Nombre           AS Modelo,
    t.Nombre            AS Tipo,
    es.Nombre           AS Estado,
    st.Nombre           AS Estatus,
    af.IdLugarCliente,
    af.PrecioActivo,
    pr.Nombre           AS Procesador,
    mr.Nombre           AS MemoriaRAM,
    al.Nombre           AS Almacenamiento,
    so.Nombre           AS SistemaOperativo,
    /* Accesorios desde la tabla puente (varios por activo). */
    (SELECT STRING_AGG(ca.Nombre, N', ') WITHIN GROUP (ORDER BY ca.Nombre)
     FROM dbo.ActivoFijoEquiposAccesorios ea
     INNER JOIN dbo.ActivoFijoAccesorios ca ON ca.IdAccesorio = ea.IdAccesorio
     WHERE ea.IdActivoFijoEQ = af.IdActivoFijoEQ) AS Accesorios,
    af.Observaciones,
    af.FechaCreacion
FROM ActivoFijoEquipos af
LEFT  JOIN ActivoFijoCarteras c  ON c.IdCartera = af.IdCartera
LEFT  JOIN ActivoFijoMarcas   m  ON m.IdMarca   = af.IdMarca
INNER JOIN ActivoFijoTipos    t  ON t.IdTipo    = af.IdTipo
INNER JOIN ActivoFijoEstados  es ON es.IdEstado = af.IdEstado
INNER JOIN ActivoFijoEstatus  st ON st.IdEstatus = af.IdEstatus
LEFT  JOIN ActivoFijoModelos            mo ON mo.IdModelo          = af.IdModelo
LEFT  JOIN ActivoFijoProcesadores       pr ON pr.IdProcesador      = af.IdProcesador
LEFT  JOIN ActivoFijoMemoriasRAM        mr ON mr.IdMemoriaRAM      = af.IdMemoriaRAM
LEFT  JOIN ActivoFijoAlmacenamientos    al ON al.IdAlmacenamiento  = af.IdAlmacenamiento
LEFT  JOIN ActivoFijoSistemasOperativos so ON so.IdSistemaOperativo = af.IdSistemaOperativo;
GO

CREATE OR ALTER VIEW dbo.vw_ActivoFijoResponsivasActivas AS
SELECT
    r.IdResponsiva,
    r.FolioTicket,
    r.TipoResponsiva,
    r.FechaAsignacion,
    r.FechaDevolucionProgramada,
    r.EstatusResponsiva,
    ur.Nombre       AS NombreRecibe,
    pu.Nombre       AS PuestoRecibe,
    r.AreaRecibe,
    r.CorreoRecibe,
    c.Nombre        AS Cartera,
    COALESCE(
        NULLIF(LTRIM(RTRIM(CONCAT(ue.Nombres, N' ', ue.Apellidos))), N''),
        ue.NombreUsuario
    )               AS NombreEntrega,
    r.RutaPDF,
    r.RutaINE,
    r.RutaComprobanteDomicilio,
    af.IdActivoFijoEQ,
    af.NoSerie,
    af.IMEI1,
    af.IMEI2,
    af.NoTelefono,
    ma.Nombre       AS Marca,
    mo.Nombre       AS Modelo,
    ti.Nombre       AS Tipo,
    af.PrecioActivo
FROM ActivoFijoResponsivas r
INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
INNER JOIN ActivoFijoTipos   ti ON ti.IdTipo = af.IdTipo
LEFT  JOIN ActivoFijoMarcas  ma ON ma.IdMarca = af.IdMarca
LEFT  JOIN ActivoFijoModelos mo ON mo.IdModelo = af.IdModelo
LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera
LEFT  JOIN ActivoFijoUsuariosAsignados ur ON ur.IdUsuarioAsignado = r.IdUsuarioRecibe
LEFT  JOIN ActivoFijoPuestos pu ON pu.IdPuesto = r.IdPuesto
LEFT  JOIN dbo.Usuarios ue ON ue.IdUsuario = r.IdUsuarioEntrega
WHERE r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE');
GO

CREATE OR ALTER VIEW dbo.vw_ActivoFijoAsignacionesPorPersona AS
SELECT
    ur.Nombre                           AS Persona,
    r.AreaRecibe                        AS Area,
    pu.Nombre                           AS Puesto,
    r.CorreoRecibe                      AS Correo,
    COUNT(r.IdResponsiva)               AS TotalAsignaciones,
    COALESCE(SUM(af.PrecioActivo), 0)   AS ValorTotalAsignado
FROM ActivoFijoResponsivas r
INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
LEFT  JOIN ActivoFijoUsuariosAsignados ur ON ur.IdUsuarioAsignado = r.IdUsuarioRecibe
LEFT  JOIN ActivoFijoPuestos pu ON pu.IdPuesto = r.IdPuesto
WHERE r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
GROUP BY ur.Nombre, r.AreaRecibe, pu.Nombre, r.CorreoRecibe;
GO

CREATE OR ALTER VIEW dbo.vw_ActivoFijoCelulares AS
SELECT
    af.IdActivoFijoEQ,
    af.NoSerie,
    af.IMEI1,
    af.IMEI2,
    af.NoTelefono,
    m.Nombre        AS Marca,
    mo.Nombre       AS Modelo,
    af.PrecioActivo,
    st.Nombre       AS Estatus,
    r.FolioTicket,
    ur.Nombre       AS NombreRecibe,
    pu.Nombre       AS PuestoRecibe,
    r.AreaRecibe,
    r.CorreoRecibe,
    c.Nombre        AS Cartera,
    r.FechaAsignacion,
    r.EstatusResponsiva
FROM ActivoFijoEquipos af
INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo AND t.RequiereIMEI = 1
INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
LEFT  JOIN ActivoFijoModelos mo ON mo.IdModelo = af.IdModelo
LEFT  JOIN ActivoFijoResponsivas r
        ON r.IdActivoFijoEQ = af.IdActivoFijoEQ
       AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
LEFT  JOIN ActivoFijoUsuariosAsignados ur ON ur.IdUsuarioAsignado = r.IdUsuarioRecibe
LEFT  JOIN ActivoFijoPuestos pu ON pu.IdPuesto = r.IdPuesto
LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera;
GO

CREATE OR ALTER VIEW dbo.vw_ActivoFijoLaptops AS
SELECT
    af.IdActivoFijoEQ,
    af.NoSerie,
    m.Nombre        AS Marca,
    mo.Nombre       AS Modelo,
    pr.Nombre       AS Procesador,
    mr.Nombre       AS MemoriaRAM,
    al.Nombre       AS Almacenamiento,
    af.PrecioActivo,
    st.Nombre       AS Estatus,
    r.FolioTicket,
    ur.Nombre       AS NombreRecibe,
    pu.Nombre       AS PuestoRecibe,
    r.AreaRecibe,
    r.CorreoRecibe,
    c.Nombre        AS Cartera,
    r.FechaAsignacion,
    r.EstatusResponsiva
FROM ActivoFijoEquipos af
INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
                                AND t.RequiereResponsiva = 1
                                AND t.RequiereIMEI = 0
INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
LEFT  JOIN ActivoFijoModelos mo ON mo.IdModelo = af.IdModelo
LEFT  JOIN ActivoFijoProcesadores    pr ON pr.IdProcesador     = af.IdProcesador
LEFT  JOIN ActivoFijoMemoriasRAM     mr ON mr.IdMemoriaRAM     = af.IdMemoriaRAM
LEFT  JOIN ActivoFijoAlmacenamientos al ON al.IdAlmacenamiento = af.IdAlmacenamiento
LEFT  JOIN ActivoFijoResponsivas r
        ON r.IdActivoFijoEQ = af.IdActivoFijoEQ
       AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
LEFT  JOIN ActivoFijoUsuariosAsignados ur ON ur.IdUsuarioAsignado = r.IdUsuarioRecibe
LEFT  JOIN ActivoFijoPuestos pu ON pu.IdPuesto = r.IdPuesto
LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera;
GO
/* ============================================================
   9. TRIGGERS
   Los dos que sí leían texto se recrean para leer por FK.
   trg_AFE_AfterInsert, trg_AFR_AfterUpdate y trg_AFR_AfterDelete
   no tocan columnas denormalizadas: se dejan intactos.
   ============================================================ */
CREATE OR ALTER TRIGGER dbo.trg_AFE_AfterUpdate
ON ActivoFijoEquipos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdBaja INT = (
        SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'BAJA'
    );

    INSERT INTO ActivoFijoHistoricos (
        IdActivoFijoEQ,
        IdEstadoAnterior,        IdEstadoNuevo,
        IdEstatusAnterior,       IdEstatusNuevo,
        IdLugarOrigen,           IdLugarDestino,
        IdSitioAnterior,         IdSitioNuevo,
        UsuarioAsignadoAnterior, UsuarioAsignadoNuevo,
        Accion,
        Detalle,
        IdUsuarioMovimiento,
        FechaMovimiento
    )
    SELECT
        i.IdActivoFijoEQ,

        d.IdEstado,
        i.IdEstado,

        d.IdEstatus,
        i.IdEstatus,

        d.IdLugarCliente,
        i.IdLugarCliente,

        d.IdSitio,
        i.IdSitio,

        /* El histórico guarda el NOMBRE (snapshot inmutable),
           pero se obtiene del catálogo, no de una copia en la fila. */
        uad.Nombre,
        uai.Nombre,

        /* ---------- Acción semántica ---------- */
        CASE
            WHEN ISNULL(d.IdEstatus,0) <> @IdBaja
             AND i.IdEstatus           = @IdBaja
                THEN 'BAJA'

            WHEN d.IdEstatus           = @IdBaja
             AND ISNULL(i.IdEstatus,0) <> @IdBaja
                THEN 'RESTAURACION'

            WHEN ISNULL(i.IdLugarCliente,-1) <> ISNULL(d.IdLugarCliente,-1)
              OR ISNULL(i.IdSitio,-1)        <> ISNULL(d.IdSitio,-1)
                THEN 'TRASLADO'

            WHEN ISNULL(i.IdUsuarioAsignado,0) <> ISNULL(d.IdUsuarioAsignado,0)
                THEN 'ASIGNACION'

            ELSE 'EDICION'
        END,

        /* ---------- Detalle legible ---------- */
        CASE
            WHEN ISNULL(d.IdEstatus,0) <> @IdBaja
             AND i.IdEstatus           = @IdBaja
                THEN 'Activo dado de baja'

            WHEN d.IdEstatus           = @IdBaja
             AND ISNULL(i.IdEstatus,0) <> @IdBaja
                THEN 'Activo restaurado al inventario'

            WHEN ISNULL(i.IdLugarCliente,-1) <> ISNULL(d.IdLugarCliente,-1)
                THEN CONCAT('Cambio de lugar cliente: ',
                            ISNULL(CAST(d.IdLugarCliente AS NVARCHAR(20)),'(vacío)'),
                            ' → ',
                            ISNULL(CAST(i.IdLugarCliente AS NVARCHAR(20)),'(vacío)'))

            WHEN ISNULL(i.IdSitio,-1) <> ISNULL(d.IdSitio,-1)
                THEN CONCAT('Cambio de sitio: ',
                            ISNULL(CAST(d.IdSitio AS NVARCHAR(20)),'(vacío)'),
                            ' → ',
                            ISNULL(CAST(i.IdSitio AS NVARCHAR(20)),'(vacío)'))

            WHEN ISNULL(i.IdUsuarioAsignado,0) <> ISNULL(d.IdUsuarioAsignado,0)
                THEN CONCAT('Usuario asignado: "',
                            ISNULL(uad.Nombre,'(vacío)'),
                            '" → "',
                            ISNULL(uai.Nombre,'(vacío)'), '"')

            ELSE 'Cambio de estado/estatus'
        END,

        i.IdUsuarioModificacion,
        GETDATE()

    FROM inserted i
    INNER JOIN deleted d
        ON d.IdActivoFijoEQ = i.IdActivoFijoEQ
    LEFT JOIN dbo.ActivoFijoUsuariosAsignados uad
        ON uad.IdUsuarioAsignado = d.IdUsuarioAsignado
    LEFT JOIN dbo.ActivoFijoUsuariosAsignados uai
        ON uai.IdUsuarioAsignado = i.IdUsuarioAsignado

    WHERE
           ISNULL(i.IdEstado,0)             <> ISNULL(d.IdEstado,0)
        OR ISNULL(i.IdEstatus,0)            <> ISNULL(d.IdEstatus,0)
        OR ISNULL(i.IdLugarCliente,-1)      <> ISNULL(d.IdLugarCliente,-1)
        OR ISNULL(i.IdSitio,-1)             <> ISNULL(d.IdSitio,-1)
        OR ISNULL(i.IdUsuarioAsignado,0)    <> ISNULL(d.IdUsuarioAsignado,0)
        OR ISNULL(i.IdSubtipo,-1)           <> ISNULL(d.IdSubtipo,-1)
        OR ISNULL(i.IdClasificacion,-1)     <> ISNULL(d.IdClasificacion,-1);
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_AFR_AfterInsert
ON ActivoFijoResponsivas
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    /* 1. Snapshot desnormalizado.
       ActivoFijoAsignacionesHist SÍ guarda texto a propósito:
       es una foto del momento de la asignación. El texto sale
       del catálogo, no de una copia en la tabla operativa. */
    INSERT INTO ActivoFijoAsignacionesHist (
        IdActivoFijoEQ, IdResponsiva, FolioTicket, TipoEquipo,
        Marca, Modelo, NoSerie, IMEI1, IMEI2, NoTelefono, PrecioActivo,
        NombreRecibe, PuestoRecibe, AreaRecibe, Cartera, CorreoRecibe,
        FechaAsignacion, EstatusAsignacion, MotivoSalida,
        RutaPDF, RutaINE, RutaComprobante
    )
    SELECT
        af.IdActivoFijoEQ, i.IdResponsiva, i.FolioTicket, t.Nombre,
        m.Nombre, mo.Nombre, af.NoSerie, af.IMEI1, af.IMEI2,
        af.NoTelefono, af.PrecioActivo,
        ur.Nombre, pu.Nombre, i.AreaRecibe,
        (SELECT Nombre FROM ActivoFijoCarteras WHERE IdCartera = i.IdCartera),
        i.CorreoRecibe,
        i.FechaAsignacion, i.EstatusResponsiva, mot.Nombre,
        i.RutaPDF, i.RutaINE, i.RutaComprobanteDomicilio
    FROM inserted i
    INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = i.IdActivoFijoEQ
    INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
    LEFT  JOIN ActivoFijoMarcas   m  ON m.IdMarca = af.IdMarca
    LEFT  JOIN ActivoFijoModelos  mo ON mo.IdModelo = af.IdModelo
    LEFT  JOIN ActivoFijoUsuariosAsignados ur ON ur.IdUsuarioAsignado = i.IdUsuarioRecibe
    LEFT  JOIN ActivoFijoPuestos  pu ON pu.IdPuesto = i.IdPuesto
    LEFT  JOIN ActivoFijoResponsivasMotivos mot
           ON mot.IdMotivoResponsiva = i.IdMotivoResponsiva;

    /* 2. Histórico de movimiento */
    INSERT INTO ActivoFijoHistoricos (
        IdActivoFijoEQ, IdEstatusNuevo,
        IdResponsivaDestino, Accion, Detalle,
        IdUsuarioMovimiento, FechaMovimiento
    )
    SELECT
        i.IdActivoFijoEQ,
        (SELECT IdEstatus FROM ActivoFijoEstatus
         WHERE Nombre = CASE
             WHEN i.EstatusResponsiva = 'PENDIENTE' THEN 'PENDIENTE'
             ELSE 'ASIGNADO' END),
        i.IdResponsiva,
        'ASIGNACION',
        'Asignación a: ' + ISNULL(
            (SELECT Nombre FROM ActivoFijoUsuariosAsignados
             WHERE IdUsuarioAsignado = i.IdUsuarioRecibe), ''),
        i.IdUsuarioCreacion, GETDATE()
    FROM inserted i;

    /* 3. Actualizar el activo
       El usuario asignado del inventario queda sincronizado con
       quien recibe la responsiva. */
    UPDATE af
       SET af.IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus
                           WHERE Nombre = CASE
                               WHEN i.EstatusResponsiva = 'PENDIENTE' THEN 'PENDIENTE'
                               ELSE 'ASIGNADO' END),
           af.IdUsuarioAsignado = i.IdUsuarioRecibe,
           af.IdUsuarioModificacion = i.IdUsuarioCreacion,
           af.FechaModificacion = GETDATE()
    FROM ActivoFijoEquipos af
    INNER JOIN inserted i ON i.IdActivoFijoEQ = af.IdActivoFijoEQ;
END;
GO
/* ============================================================
   10. VERIFICACIÓN
   Debe reportar 0 en todas las filas. Si algo sale > 0, es que
   quedó un valor de texto que no se pudo enlazar a su catálogo.
   ============================================================ */
IF COL_LENGTH(N'dbo.ActivoFijoEquipos', N'Modelo') IS NOT NULL
BEGIN
    SELECT 'ActivoFijoEquipos.Modelo sin enlazar' AS Revision, COUNT(*) AS Filas
    FROM dbo.ActivoFijoEquipos
    WHERE NULLIF(LTRIM(RTRIM(Modelo)), N'') IS NOT NULL AND IdModelo IS NULL
    UNION ALL
    SELECT 'ActivoFijoEquipos.Procesador sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoEquipos
    WHERE NULLIF(LTRIM(RTRIM(Procesador)), N'') IS NOT NULL AND IdProcesador IS NULL
    UNION ALL
    SELECT 'ActivoFijoEquipos.MemoriaRAM sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoEquipos
    WHERE NULLIF(LTRIM(RTRIM(MemoriaRAM)), N'') IS NOT NULL AND IdMemoriaRAM IS NULL
    UNION ALL
    SELECT 'ActivoFijoEquipos.Almacenamiento sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoEquipos
    WHERE NULLIF(LTRIM(RTRIM(Almacenamiento)), N'') IS NOT NULL AND IdAlmacenamiento IS NULL
    UNION ALL
    SELECT 'ActivoFijoEquipos.SistemaOperativo sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoEquipos
    WHERE NULLIF(LTRIM(RTRIM(SistemaOperativo)), N'') IS NOT NULL AND IdSistemaOperativo IS NULL
    UNION ALL
    SELECT 'ActivoFijoEquipos.UsuarioAsignado sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoEquipos
    WHERE NULLIF(LTRIM(RTRIM(UsuarioAsignado)), N'') IS NOT NULL AND IdUsuarioAsignado IS NULL;
END;

/* Accesorios: los activos con texto tienen que estar en la tabla puente. */
IF COL_LENGTH(N'dbo.ActivoFijoEquipos', N'Accesorios') IS NOT NULL
BEGIN
    SELECT 'ActivoFijoEquipos.Accesorios sin fila en la tabla puente' AS Revision,
           COUNT(*) AS Filas
    FROM dbo.ActivoFijoEquipos af
    WHERE NULLIF(LTRIM(RTRIM(af.Accesorios)), N'') IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ActivoFijoEquiposAccesorios ea
          WHERE ea.IdActivoFijoEQ = af.IdActivoFijoEQ
      );
END;

IF COL_LENGTH(N'dbo.ActivoFijoResponsivas', N'NombreRecibe') IS NOT NULL
BEGIN
    SELECT 'ActivoFijoResponsivas.NombreRecibe sin enlazar' AS Revision, COUNT(*) AS Filas
    FROM dbo.ActivoFijoResponsivas
    WHERE NULLIF(LTRIM(RTRIM(NombreRecibe)), N'') IS NOT NULL AND IdUsuarioRecibe IS NULL
    UNION ALL
    SELECT 'ActivoFijoResponsivas.MotivoSalida sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoResponsivas
    WHERE NULLIF(LTRIM(RTRIM(MotivoSalida)), N'') IS NOT NULL AND IdMotivoResponsiva IS NULL
    UNION ALL
    SELECT 'ActivoFijoResponsivas.NombreProyecto sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoResponsivas
    WHERE NULLIF(LTRIM(RTRIM(NombreProyecto)), N'') IS NOT NULL AND IdProyectoResponsiva IS NULL
    UNION ALL
    SELECT 'ActivoFijoResponsivas.DescripcionSolicitud sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoResponsivas
    WHERE NULLIF(LTRIM(RTRIM(DescripcionSolicitud)), N'') IS NOT NULL AND IdDescripcionResponsiva IS NULL
    UNION ALL
    SELECT 'ActivoFijoResponsivas.AreaEntrega sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoResponsivas
    WHERE NULLIF(LTRIM(RTRIM(AreaEntrega)), N'') IS NOT NULL AND IdAreaEntregaResponsiva IS NULL
    UNION ALL
    SELECT 'ActivoFijoResponsivas.PuestoEntrega sin enlazar', COUNT(*)
    FROM dbo.ActivoFijoResponsivas
    WHERE NULLIF(LTRIM(RTRIM(PuestoEntrega)), N'') IS NOT NULL AND IdPuestoEntregaResponsiva IS NULL;
END;
GO

/* ============================================================
   11. LIMPIEZA (FASE 2) — ACTIVA
   Elimina las columnas de texto ya reemplazadas por FK.
   Ya no hay dependencias: las vistas y triggers de la sección 8/9
   leen por FK, y la aplicación tolera que las columnas no existan.
   Deja la bandera en 0 para no borrar nada.
   ============================================================ */

/* Respaldo previo: si quedara algún NombreEntrega de texto sin FK
   (la FK apunta a dbo.Usuarios, no a un catálogo de texto), se enlaza
   por nombre. Lo que no se pueda enlazar se deja y la columna se omite. */
IF COL_LENGTH(N'dbo.ActivoFijoResponsivas', N'NombreEntrega') IS NOT NULL
BEGIN
    UPDATE r
       SET r.IdUsuarioEntrega = u.IdUsuario
    FROM dbo.ActivoFijoResponsivas r
    CROSS APPLY (
        SELECT TOP 1 u.IdUsuario
        FROM dbo.Usuarios u
        WHERE NULLIF(LTRIM(RTRIM(r.NombreEntrega)), N'') IS NOT NULL
          AND u.IdUsuario = (
              SELECT MIN(u2.IdUsuario) FROM dbo.Usuarios u2
              WHERE LTRIM(RTRIM(u2.Nombres)) = LTRIM(RTRIM(r.NombreEntrega))
                 OR LTRIM(RTRIM(u2.Nombres) + N' ' + LTRIM(RTRIM(u2.Apellidos))) = LTRIM(RTRIM(r.NombreEntrega))
          )
    ) u
    WHERE r.IdUsuarioEntrega IS NULL;
END;
GO

DECLARE @AplicarLimpieza BIT = 1;

IF @AplicarLimpieza = 1
BEGIN
    DECLARE @Drop TABLE (
        Tabla    NVARCHAR(128),
        Columna  NVARCHAR(128),
        Fk       NVARCHAR(128)
    );

    INSERT INTO @Drop (Tabla, Columna, Fk) VALUES
        (N'ActivoFijoEquipos',    N'Modelo',            N'IdModelo'),
        (N'ActivoFijoEquipos',    N'Procesador',        N'IdProcesador'),
        (N'ActivoFijoEquipos',    N'MemoriaRAM',        N'IdMemoriaRAM'),
        (N'ActivoFijoEquipos',    N'Almacenamiento',    N'IdAlmacenamiento'),
        (N'ActivoFijoEquipos',    N'SistemaOperativo',  N'IdSistemaOperativo'),
        (N'ActivoFijoEquipos',    N'UsuarioAsignado',   N'IdUsuarioAsignado'),
        (N'ActivoFijoResponsivas',N'MotivoSalida',      N'IdMotivoResponsiva'),
        (N'ActivoFijoResponsivas',N'NombreProyecto',    N'IdProyectoResponsiva'),
        (N'ActivoFijoResponsivas',N'DescripcionSolicitud', N'IdDescripcionResponsiva'),
        (N'ActivoFijoResponsivas',N'AreaEntrega',       N'IdAreaEntregaResponsiva'),
        (N'ActivoFijoResponsivas',N'PuestoEntrega',     N'IdPuestoEntregaResponsiva'),
        (N'ActivoFijoResponsivas',N'NombreEntrega',     N'IdUsuarioEntrega'),
        (N'ActivoFijoResponsivas',N'NombreRecibe',      N'IdUsuarioRecibe'),
        (N'ActivoFijoResponsivas',N'PuestoRecibe',      N'IdPuesto');

    DECLARE @dTabla NVARCHAR(128), @dCol NVARCHAR(128), @dFk NVARCHAR(128),
            @pendientes INT, @sqlDrop NVARCHAR(MAX), @q NVARCHAR(1);
    /* Comilla simple como variable: evita anidar N''...'' en el SQL dinámico. */
    SET @q = CHAR(39);

    DECLARE curDrop CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla, Columna, Fk FROM @Drop;
    OPEN curDrop;
    FETCH NEXT FROM curDrop INTO @dTabla, @dCol, @dFk;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF COL_LENGTH(N'dbo.' + @dTabla, @dCol) IS NOT NULL
        BEGIN
            /* Sólo se tira la columna si ya no queda ningún valor sin enlazar */
            SET @sqlDrop = N'SELECT @n = COUNT(*) FROM dbo.' + QUOTENAME(@dTabla)
                         + N' WHERE NULLIF(LTRIM(RTRIM(' + QUOTENAME(@dCol) + N')), N'''') IS NOT NULL'
                         + N' AND ' + QUOTENAME(@dFk) + N' IS NULL;';
            EXEC sp_executesql @sqlDrop, N'@n INT OUTPUT', @n = @pendientes OUTPUT;

            IF @pendientes > 0
            BEGIN
                PRINT 'OMITIDO ' + @dTabla + '.' + @dCol
                    + ': quedan ' + CAST(@pendientes AS NVARCHAR(20)) + ' fila(s) sin enlazar.';
            END
            ELSE
            BEGIN
                BEGIN TRY
                    /* 1. Índices que usan la columna */
                    SET @sqlDrop =
                          N'DECLARE @idx NVARCHAR(MAX) = ' + @q + @q + N';'
                        + N' SELECT @idx = @idx + ' + @q
                        + N'DROP INDEX ' + @q
                        + N' + QUOTENAME(i.name) + ' + @q
                        + N' ON dbo.' + QUOTENAME(@dTabla) + N';' + @q
                        + N' FROM sys.indexes i'
                        + N' WHERE i.object_id = OBJECT_ID(' + @q + N'dbo.' + @dTabla + @q + N')'
                        + N'   AND i.is_primary_key = 0'
                        + N'   AND i.is_unique_constraint = 0'
                        + N'   AND EXISTS ('
                        + N'       SELECT 1'
                        + N'       FROM sys.index_columns ic'
                        + N'       INNER JOIN sys.columns col'
                        + N'               ON col.object_id = ic.object_id'
                        + N'              AND col.column_id = ic.column_id'
                        + N'       WHERE ic.object_id = i.object_id'
                        + N'         AND ic.index_id   = i.index_id'
                        + N'         AND col.name      = ' + @q + @dCol + @q
                        + N'   );'
                        + N' IF @idx <> ' + @q + @q + N' EXEC sp_executesql @idx;';
                    EXEC sp_executesql @sqlDrop;

                    /* 2. DEFAULT constraints de la columna (bloquean el DROP) */
                    SET @sqlDrop =
                          N'DECLARE @df NVARCHAR(MAX) = ' + @q + @q + N';'
                        + N' SELECT @df = @df + ' + @q
                        + N'ALTER TABLE dbo.' + QUOTENAME(@dTabla) + N' DROP CONSTRAINT ' + @q
                        + N' + QUOTENAME(dc.name) + ' + @q
                        + N';' + @q
                        + N' FROM sys.default_constraints dc'
                        + N' WHERE dc.parent_object_id = OBJECT_ID(' + @q + N'dbo.' + @dTabla + @q + N')'
                        + N'   AND dc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(' + @q
                        + N'dbo.' + @dTabla + @q + N'), ' + @q + @dCol + @q + N', ' + @q
                        + N'ColumnId' + @q + N');'
                        + N' IF @df <> ' + @q + @q + N' EXEC sp_executesql @df;';
                    EXEC sp_executesql @sqlDrop;

                    /* 3. CHECK constraints que la mencionan */
                    SET @sqlDrop =
                          N'DECLARE @ck NVARCHAR(MAX) = ' + @q + @q + N';'
                        + N' SELECT @ck = @ck + ' + @q
                        + N'ALTER TABLE dbo.' + QUOTENAME(@dTabla) + N' DROP CONSTRAINT ' + @q
                        + N' + QUOTENAME(cc.name) + ' + @q
                        + N';' + @q
                        + N' FROM sys.check_constraints cc'
                        + N' WHERE cc.parent_object_id = OBJECT_ID(' + @q + N'dbo.' + @dTabla + @q + N')'
                        + N'   AND cc.definition LIKE ' + @q + N'%' + @dCol + N'%' + @q + N';'
                        + N' IF @ck <> ' + @q + @q + N' EXEC sp_executesql @ck;';
                    EXEC sp_executesql @sqlDrop;

                    /* 4. La columna */
                    SET @sqlDrop = N'ALTER TABLE dbo.' + QUOTENAME(@dTabla)
                                 + N' DROP COLUMN ' + QUOTENAME(@dCol) + N';';
                    EXEC sp_executesql @sqlDrop;
                    PRINT 'Eliminada ' + @dTabla + '.' + @dCol;
                END TRY
                BEGIN CATCH
                    PRINT 'No se pudo eliminar ' + @dTabla + '.' + @dCol
                        + ': ' + ERROR_MESSAGE();
                END CATCH
            END
        END
        FETCH NEXT FROM curDrop INTO @dTabla, @dCol, @dFk;
    END
    CLOSE curDrop;
    DEALLOCATE curDrop;

    /* Accesorios: no tiene FK en la tabla (vive en la tabla puente), así
       que se evalúa aparte. Sólo se tira la celda de texto si todos los
       activos que la tenían ya están enlazados en la tabla puente. */
    IF COL_LENGTH(N'dbo.ActivoFijoEquipos', N'Accesorios') IS NOT NULL
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM dbo.ActivoFijoEquipos af
            WHERE NULLIF(LTRIM(RTRIM(af.Accesorios)), N'') IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM dbo.ActivoFijoEquiposAccesorios ea
                  WHERE ea.IdActivoFijoEQ = af.IdActivoFijoEQ
              )
        )
            PRINT 'OMITIDO ActivoFijoEquipos.Accesorios: hay activos sin fila en la tabla puente.';
        ELSE
            BEGIN TRY
                ALTER TABLE dbo.ActivoFijoEquipos DROP COLUMN Accesorios;
                PRINT 'Eliminada ActivoFijoEquipos.Accesorios';
            END TRY
            BEGIN CATCH
                PRINT 'No se pudo eliminar ActivoFijoEquipos.Accesorios: ' + ERROR_MESSAGE();
            END CATCH
    END;
END;
ELSE
    PRINT 'Limpieza omitida (@AplicarLimpieza = 0). Las columnas de texto siguen ahí como respaldo.';
GO
