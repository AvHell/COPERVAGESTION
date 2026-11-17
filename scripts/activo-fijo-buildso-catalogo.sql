/*
  ============================================================
  ACTIVO FIJO — BuildSO pasa del equipo al catálogo de SO
  ============================================================

  QUÉ PROBLEMA RESUELVE
  ---------------------
  dbo.ActivoFijoEquipos guardaba el build del sistema operativo
  en una columna propia (BuildSO). Eso duplica en cada equipo un
  dato que pertenece al sistema operativo y rompe 3FN: el build
  es una característica del SO (catálogo
  dbo.ActivoFijoSistemasOperativos), no del activo.

  QUÉ HACE
  --------
   1. Agrega dbo.ActivoFijoSistemasOperativos.BuildSO (idempotente).
   2. Adopta el build existente en el catálogo cuando el SO sólo
      tiene un build entre todos sus equipos (sin duplicar filas).
   3. Cuando un mismo SO convive con VARIOS builds, crea la fila de
      catálogo (Nombre + BuildSO) que falte y re-apunta los equipos
      a ella. Así no se pierde ningún build histórico.
   4. Elimina dbo.ActivoFijoEquipos.BuildSO (con sus DEFAULT/CHECK/
      índices, si existieran).
   5. Recrea dbo.vw_ActivoFijoInventario exponiendo so.BuildSO.
   6. Verifica el resultado: no debe quedar BuildSO en el equipo y
      cada equipo con SO debe apuntar a una fila de catálogo que
      tenga su Nombre y BuildSO.

  IDENTIDAD DEL CATÁLOGO
  ----------------------
  Un sistema operativo se identifica por Nombre + BuildSO:
  ("Windows 11 Pro", "22631.3155") y ("Windows 11 Pro", "26100.2033")
  son dos filas distintas. El build puede ser NULL (SO sin build
  reportado, como los capturados a mano).

  IDEMPOTENTE: se puede volver a ejecutar sin efectos secundarios.
  Se apoya en scripts/activo-fijo-3fn.sql, que ya deja la tabla de
  catálogo creada.
  ============================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ============================================================
   1. Columna BuildSO en el catálogo de sistemas operativos
   ============================================================ */
IF OBJECT_ID(N'dbo.ActivoFijoSistemasOperativos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ActivoFijoSistemasOperativos', N'BuildSO') IS NULL
BEGIN
    ALTER TABLE dbo.ActivoFijoSistemasOperativos
        ADD BuildSO NVARCHAR(20) NULL;
    PRINT N'ActivoFijoSistemasOperativos.BuildSO agregada.';
END;
GO

/* ============================================================
   2. Adoptar el build cuando el SO sólo tiene uno entre sus equipos
   (evita crear filas de catálogo innecesarias)
   ============================================================ */
IF OBJECT_ID(N'dbo.ActivoFijoEquipos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ActivoFijoEquipos', N'BuildSO') IS NOT NULL
BEGIN
    /* SQL dinámico a propósito: SQL Server valida el código estático de
       TODO el lote antes de ejecutarlo, aunque el IF no se cumpla. Como
       el paso 4 elimina af.BuildSO, las referencias directas reventarían
       al re-ejecutar el script (Invalid column name 'BuildSO'). */
    EXEC sp_executesql N'
        WITH builds AS (
            SELECT af.IdSistemaOperativo,
                   COUNT(DISTINCT LTRIM(RTRIM(af.BuildSO))) AS Distintos,
                   MIN(LTRIM(RTRIM(af.BuildSO)))             AS BuildUnico
            FROM dbo.ActivoFijoEquipos af
            WHERE af.IdSistemaOperativo IS NOT NULL
              AND NULLIF(LTRIM(RTRIM(af.BuildSO)), N'''') IS NOT NULL
            GROUP BY af.IdSistemaOperativo
        )
        UPDATE so
           SET so.BuildSO = b.BuildUnico
        FROM dbo.ActivoFijoSistemasOperativos so
        INNER JOIN builds b ON b.IdSistemaOperativo = so.IdSistemaOperativo
        WHERE so.BuildSO IS NULL
          AND b.Distintos = 1;';
END;
GO

/* ============================================================
   3. Un SO con varios builds: crear la fila que falte y re-apuntar
   ============================================================ */
IF OBJECT_ID(N'dbo.ActivoFijoEquipos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ActivoFijoEquipos', N'BuildSO') IS NOT NULL
BEGIN
    /* Dinámico por la misma razón que el paso 2: el lote se valida antes
       de ejecutarse y af.BuildSO desaparece en el paso 4. */
    EXEC sp_executesql N'
    /* Equipos cuyo build todavía no coincide con el de su fila de
       catálogo (los que el paso 2 no pudo adoptar). */
    DECLARE @mapa TABLE (
        IdEquipo INT           PRIMARY KEY,
        Nombre   NVARCHAR(100) NOT NULL,
        BuildSO  NVARCHAR(20)  NOT NULL
    );

    INSERT INTO @mapa (IdEquipo, Nombre, BuildSO)
    SELECT af.IdActivoFijoEQ,
           so.Nombre,
           LTRIM(RTRIM(af.BuildSO))
    FROM dbo.ActivoFijoEquipos af
    INNER JOIN dbo.ActivoFijoSistemasOperativos so
            ON so.IdSistemaOperativo = af.IdSistemaOperativo
    WHERE af.BuildSO IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(af.BuildSO)), N'''') IS NOT NULL
      AND UPPER(LTRIM(RTRIM(ISNULL(so.BuildSO, N'''')))) <> UPPER(LTRIM(RTRIM(af.BuildSO)));

    /* Alta de las combinaciones Nombre + BuildSO que aún no existen. */
    INSERT INTO dbo.ActivoFijoSistemasOperativos (Nombre, BuildSO, Activo)
    SELECT DISTINCT m.Nombre, m.BuildSO, 1
    FROM @mapa m
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.ActivoFijoSistemasOperativos c
        WHERE UPPER(LTRIM(RTRIM(c.Nombre))) = UPPER(LTRIM(RTRIM(m.Nombre)))
          AND UPPER(LTRIM(RTRIM(ISNULL(c.BuildSO, N'''')))) = UPPER(m.BuildSO)
    );

    /* Re-apuntar cada equipo a la fila de catálogo con SU build. */
    UPDATE af
       SET af.IdSistemaOperativo = c.IdSistemaOperativo
    FROM dbo.ActivoFijoEquipos af
    INNER JOIN @mapa m ON m.IdEquipo = af.IdActivoFijoEQ
    INNER JOIN dbo.ActivoFijoSistemasOperativos c
            ON UPPER(LTRIM(RTRIM(c.Nombre))) = UPPER(LTRIM(RTRIM(m.Nombre)))
           AND UPPER(LTRIM(RTRIM(ISNULL(c.BuildSO, N'''')))) = UPPER(m.BuildSO);';
END;
GO

/* ============================================================
   3b. Índice único del catálogo por Nombre + BuildSO
   Es la identidad que usa el colector para hacer el upsert
   (si ya existe la fila con ese nombre y build, la reutiliza; si
   no, la crea). Es filtrado para que varias filas puedan tener
   BuildSO NULL (sistemas capturados a mano, sin build). Se crea
   sólo si todavía no hay duplicados, para no romper la migración.
   ============================================================ */
IF OBJECT_ID(N'dbo.ActivoFijoSistemasOperativos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ActivoFijoSistemasOperativos', N'BuildSO') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE object_id = OBJECT_ID(N'dbo.ActivoFijoSistemasOperativos')
                     AND name = N'UX_AFSO_Nombre_Build')
   AND NOT EXISTS (SELECT 1
                   FROM dbo.ActivoFijoSistemasOperativos
                   WHERE BuildSO IS NOT NULL
                   GROUP BY Nombre, BuildSO
                   HAVING COUNT(*) > 1)
    CREATE UNIQUE INDEX UX_AFSO_Nombre_Build
        ON dbo.ActivoFijoSistemasOperativos (Nombre, BuildSO)
        WHERE BuildSO IS NOT NULL;
GO

/* ============================================================
   4. Eliminar ActivoFijoEquipos.BuildSO
   Se quitan antes los objetos que dependan de la columna para que
   el DROP no falle en bases donde se agregó a mano.
   ============================================================ */
IF OBJECT_ID(N'dbo.ActivoFijoEquipos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ActivoFijoEquipos', N'BuildSO') IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'';

    /* DEFAULT y CHECK de la columna */
    SELECT @sql = @sql
                + N'ALTER TABLE dbo.ActivoFijoEquipos DROP CONSTRAINT '
                + QUOTENAME(o.name) + N';'
    FROM sys.objects o
    INNER JOIN sys.columns c
            ON c.object_id = o.parent_object_id
           AND c.column_id = o.parent_column_id
    WHERE o.parent_object_id = OBJECT_ID(N'dbo.ActivoFijoEquipos')
      AND o.type IN ('D', 'C')
      AND c.name = N'BuildSO';
    IF @sql <> N'' EXEC sp_executesql @sql;

    /* Índices que la incluyan */
    SET @sql = N'';
    SELECT @sql = @sql
                + N'DROP INDEX ' + QUOTENAME(i.name)
                + N' ON dbo.ActivoFijoEquipos;'
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic
            ON ic.object_id = i.object_id
           AND ic.index_id  = i.index_id
    INNER JOIN sys.columns c
            ON c.object_id = ic.object_id
           AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID(N'dbo.ActivoFijoEquipos')
      AND i.type > 0
      AND c.name = N'BuildSO';
    IF @sql <> N'' EXEC sp_executesql @sql;

    ALTER TABLE dbo.ActivoFijoEquipos DROP COLUMN BuildSO;
    PRINT N'ActivoFijoEquipos.BuildSO eliminada.';
END;
GO

/* ============================================================
   5. Vista de inventario: exponer el build del catálogo
   (Nombres y orden de columnas anteriores se conservan; BuildSO
   se agrega al final)
   ============================================================ */
IF OBJECT_ID(N'dbo.vw_ActivoFijoInventario', N'V') IS NOT NULL
   AND OBJECT_ID(N'dbo.ActivoFijoSistemasOperativos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ActivoFijoSistemasOperativos', N'BuildSO') IS NOT NULL
    EXEC(N'
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
            (SELECT STRING_AGG(ca.Nombre, N'', '') WITHIN GROUP (ORDER BY ca.Nombre)
             FROM dbo.ActivoFijoEquiposAccesorios ea
             INNER JOIN dbo.ActivoFijoAccesorios ca ON ca.IdAccesorio = ea.IdAccesorio
             WHERE ea.IdActivoFijoEQ = af.IdActivoFijoEQ) AS Accesorios,
            af.Observaciones,
            af.FechaCreacion,
            so.BuildSO
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
    ');
GO

/* ============================================================
   6. Verificación
   ============================================================ */
IF OBJECT_ID(N'dbo.ActivoFijoSistemasOperativos', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ActivoFijoSistemasOperativos', N'BuildSO') IS NOT NULL
   AND OBJECT_ID(N'dbo.ActivoFijoEquipos', N'U') IS NOT NULL
    /* Dinámico para que el lote no falle si falta el catálogo o la
       columna (SQL Server valida el código estático antes de ejecutar). */
    EXEC(N'
    SELECT
        CASE WHEN COL_LENGTH(N''dbo.ActivoFijoSistemasOperativos'', N''BuildSO'') IS NULL
             THEN N''FALTA'' ELSE N''OK'' END                                  AS [BuildSO en SistemasOperativos],
        CASE WHEN OBJECT_ID(N''dbo.ActivoFijoEquipos'', N''U'') IS NOT NULL
                  AND COL_LENGTH(N''dbo.ActivoFijoEquipos'', N''BuildSO'') IS NOT NULL
             THEN N''TODAVIA EXISTE'' ELSE N''OK'' END                         AS [BuildSO en Equipos],
        (SELECT COUNT(*) FROM dbo.ActivoFijoSistemasOperativos)                AS [Filas catalogo SO],
        (SELECT COUNT(*) FROM dbo.ActivoFijoSistemasOperativos
         WHERE NULLIF(LTRIM(RTRIM(BuildSO)), N'''') IS NOT NULL)               AS [Filas con compilacion],
        (SELECT COUNT(*)
         FROM dbo.ActivoFijoEquipos af
         LEFT JOIN dbo.ActivoFijoSistemasOperativos so
                ON so.IdSistemaOperativo = af.IdSistemaOperativo
         WHERE af.IdSistemaOperativo IS NOT NULL
           AND so.IdSistemaOperativo IS NULL)                                  AS [Equipos con FK de SO huerfana];
    ')
ELSE
    PRINT N'OJO: falta dbo.ActivoFijoSistemasOperativos, su columna BuildSO o dbo.ActivoFijoEquipos. Revisa los pasos 1-3 antes de usar la app.';
GO
