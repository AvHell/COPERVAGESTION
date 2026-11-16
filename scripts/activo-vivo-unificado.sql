/*
  ============================================================================
  ACTIVO VIVO — Detalle del activo + Control general de IP en un solo lugar
  ============================================================================
  Ejecutar una vez (idempotente) después de:
    - activo-fijo-detalle.sql
    - control-general-ip.sql
    - control-general-ip-datos-clientes.sql

  Este script NO borra datos ni columnas. Es puramente aditivo y puede
  ejecutarse varias veces sin efectos secundarios. Aporta:

    1) Soporte de DIADEMAS en el detalle del activo.
       - Amplía el CK de TipoComponente para admitir 'DIADEMA'.
       - Agrega columnas opcionales que el colector puede llenar:
         MAC, ConectadoA, EstadoConexion, Bateria.

    2) Procedencia de la IP (para el control general).
       - Agrega OrigenIP + EsConfiable a InventarioGeneralIP.
       - Siembra el TipoIP 'WiFi (controlador)'.

  Nota sobre DHCP / WiFi:
    Las IP asignadas por DHCP y, sobre todo, por controladores WiFi son
    volátiles: el equipo puede recibir una IP distinta en cada reconexión.
    Por eso guardamos OrigenIP y EsConfiable. Lo que provenga de un
    controlador WiFi se marca EsConfiable = 0 y se documenta como
    informativo; el inventario "duro" sigue siendo lo Estático y lo DHCP
    confirmado. Ver docs/control-general-unificado.md.
  ============================================================================
*/

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   1.1  TipoComponente = DIADEMA (diadema / headset con micrófono)
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_AFComp_Tipo'
          AND parent_object_id = OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes')
    )
    BEGIN
        ALTER TABLE dbo.ActivoFijoEquiposComponentes DROP CONSTRAINT CK_AFComp_Tipo;
    END;

    ALTER TABLE dbo.ActivoFijoEquiposComponentes
        ADD CONSTRAINT CK_AFComp_Tipo
        CHECK (TipoComponente IN ('MONITOR', 'DISCO', 'TECLADO', 'RATON', 'DIADEMA', 'OTRO'));

    PRINT 'CK_AFComp_Tipo actualizado (incluye DIADEMA).';
END
ELSE
    PRINT 'Aviso: dbo.ActivoFijoEquiposComponentes no existe; ejecuta activo-fijo-detalle.sql primero.';
GO

/* ---------------------------------------------------------------------------
   1.2  Columnas opcionales para diademas (aditivas, NULLables)
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.ActivoFijoEquiposComponentes', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'MAC') IS NULL
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ADD MAC VARCHAR(17) NULL;   -- MAC Bluetooth / receptor USB

    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'ConectadoA') IS NULL
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ADD ConectadoA NVARCHAR(300) NULL; -- 'Bluetooth', 'USB-Dongle', 'Jack 3.5', etc.

    /* Si una base anterior la creó en NVARCHAR(150) se ensancha a 300: el
       colector puede reportar descripciones largas ('Bluetooth LE · receptor
       USB en el puerto frontal del monitor', etc.) y sólo se gana espacio.
       COL_LENGTH devuelve bytes: 300 caracteres NVARCHAR = 600 bytes. */
    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'ConectadoA') < 600
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ALTER COLUMN ConectadoA NVARCHAR(300) NULL;

    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'EstadoConexion') IS NULL
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ADD EstadoConexion VARCHAR(30) NULL; -- 'Emparejada', 'Desconectada', ...

    IF COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'Bateria') IS NULL
        ALTER TABLE dbo.ActivoFijoEquiposComponentes ADD Bateria TINYINT NULL;  -- 0..100 (% batería reportado por el colector)

    PRINT 'Columnas de diadema verificadas en ActivoFijoEquiposComponentes.';
END
GO

/* ---------------------------------------------------------------------------
   2.1  Procedencia / confiabilidad de la IP en el control general
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.InventarioGeneralIP', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.InventarioGeneralIP', 'OrigenIP') IS NULL
        ALTER TABLE dbo.InventarioGeneralIP ADD OrigenIP VARCHAR(20) NULL;

    IF COL_LENGTH('dbo.InventarioGeneralIP', 'EsConfiable') IS NULL
        ALTER TABLE dbo.InventarioGeneralIP
            ADD EsConfiable BIT NOT NULL
                CONSTRAINT DF_InventarioGeneralIP_Confiable DEFAULT (1);

    PRINT 'Columnas OrigenIP / EsConfiable verificadas en InventarioGeneralIP.';
END
ELSE
    PRINT 'Aviso: dbo.InventarioGeneralIP no existe; ejecuta control-general-ip.sql primero.';
GO

/* ---------------------------------------------------------------------------
   2.1-bis  CHECK de OrigenIP — EN SU PROPIO LOTE.
   ---------------------------------------------------------------------------
   Importante: NO se puede declarar el CHECK en el mismo lote que el
   ALTER TABLE ... ADD OrigenIP. SQL Server compila el lote completo antes
   de ejecutarlo, así que la referencia a la columna nueva falla con
   "Invalid column name 'OrigenIP'" y el lote entero se rechaza (por eso
   tampoco se creaban las columnas). Aquí ya existe con seguridad, y de
   todos modos se usa SQL dinámico para que el nombre se resuelva en
   tiempo de ejecución.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.InventarioGeneralIP', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.InventarioGeneralIP', 'OrigenIP') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_InventarioGeneralIP_Origen'
          AND parent_object_id = OBJECT_ID(N'dbo.InventarioGeneralIP')
    )
        EXEC(N'ALTER TABLE dbo.InventarioGeneralIP
                   ADD CONSTRAINT CK_InventarioGeneralIP_Origen
                   CHECK (OrigenIP IS NULL OR OrigenIP IN (''Manual'', ''DHCP'', ''Wifi'', ''Otro''));');

    PRINT 'CK_InventarioGeneralIP_Origen verificado.';
END
GO

/* ---------------------------------------------------------------------------
   2.2  Sembrar el TipoIP 'WiFi (controlador)'
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.CatalogosInventarioIP', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.CatalogosInventarioIP (TipoCatalogo, Nombre, Activo)
    SELECT N'TipoIP', N'WiFi (controlador)', 1
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.CatalogosInventarioIP
        WHERE TipoCatalogo = N'TipoIP' AND Nombre = N'WiFi (controlador)'
    );

    PRINT 'TipoIP ''WiFi (controlador)'' verificado.';
END
GO

/* ---------------------------------------------------------------------------
   3. Verificación (visible en el mensaje de salida)
   --------------------------------------------------------------------------- */
SELECT N'InventarioGeneralIP' AS Tabla, N'OrigenIP' AS Columna,
       CAST(CASE WHEN COL_LENGTH('dbo.InventarioGeneralIP', 'OrigenIP') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT) AS Existe
UNION ALL
SELECT N'InventarioGeneralIP', N'EsConfiable',
       CAST(CASE WHEN COL_LENGTH('dbo.InventarioGeneralIP', 'EsConfiable') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT N'ActivoFijoEquiposComponentes', N'MAC',
       CAST(CASE WHEN COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'MAC') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT N'ActivoFijoEquiposComponentes', N'ConectadoA',
       CAST(CASE WHEN COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'ConectadoA') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT N'ActivoFijoEquiposComponentes', N'EstadoConexion',
       CAST(CASE WHEN COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'EstadoConexion') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT)
UNION ALL
SELECT N'ActivoFijoEquiposComponentes', N'Bateria',
       CAST(CASE WHEN COL_LENGTH('dbo.ActivoFijoEquiposComponentes', 'Bateria') IS NOT NULL
                 THEN 1 ELSE 0 END AS BIT);
GO

PRINT 'Listo: Activo vivo unificado (diademas + procedencia de IP) aplicado.';
GO
