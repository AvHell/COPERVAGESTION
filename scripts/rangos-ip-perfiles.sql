/*
  ============================================================
  RANGOS IP POR CLIENTE Y PERFIL  (módulo Equipos)
  ------------------------------------------------------------
  Ejecutar en la base de datos de la aplicación antes de usar
  el botón "Rangos IP" de la pantalla de Equipos.

  El script es idempotente: se puede volver a ejecutar sin
  duplicar tablas, columnas ni rangos.

  Regla de negocio que soporta:
    - Cada equipo estático (TipoIP = 'Estatica') de un cliente
      debe caer dentro de un rango autorizado para su perfil.
    - Un rango SIN perfil (IdRolEquipo NULL) se hereda a todos
      los perfiles del cliente.
    - Un rango CON perfil aplica únicamente a ese perfil.
    - Si el cliente no tiene rangos configurados, el sistema no
      restringe (permite migrar la información poco a poco).

  Al final el script imprime un reporte con los rangos que NO se
  pudieron cargar (cliente o perfil no encontrado) para que los
  puedas corregir y volver a ejecutar.
  ============================================================
*/

/* ------------------------------------------------------------
   1. Tabla de rangos
   ------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.RangosIP', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RangosIP (
        IdRangoIP INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_RangosIP PRIMARY KEY,
        IdCliente INT NOT NULL,
        IdPiso INT NULL,
        IdRolEquipo INT NULL,
        Nombre NVARCHAR(100) NOT NULL,
        IPInicio VARCHAR(45) NOT NULL,
        IPFin VARCHAR(45) NOT NULL,
        Descripcion NVARCHAR(200) NULL,
        CONSTRAINT FK_RangosIP_Cliente FOREIGN KEY (IdCliente)
            REFERENCES dbo.Clientes (IdCliente) ON DELETE CASCADE,
        CONSTRAINT FK_RangosIP_Piso FOREIGN KEY (IdPiso)
            REFERENCES dbo.Pisos (IdPiso),
        CONSTRAINT FK_RangosIP_Rol FOREIGN KEY (IdRolEquipo)
            REFERENCES dbo.RolesEquipo (IdRolEquipo)
    );
END;
GO

/* Migración para instalaciones que ya tenían la tabla sin perfil */
IF COL_LENGTH(N'dbo.RangosIP', N'IdRolEquipo') IS NULL
    ALTER TABLE dbo.RangosIP ADD IdRolEquipo INT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_RangosIP_Rol'
)
    ALTER TABLE dbo.RangosIP ADD CONSTRAINT FK_RangosIP_Rol
        FOREIGN KEY (IdRolEquipo) REFERENCES dbo.RolesEquipo (IdRolEquipo);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.RangosIP')
      AND name = N'IX_RangosIP_Cliente'
)
    CREATE INDEX IX_RangosIP_Cliente
        ON dbo.RangosIP (IdCliente, IPInicio, IPFin);
GO

/* ------------------------------------------------------------
   2. Columna en Equipos: guarda el rango que valida cada IP
   ------------------------------------------------------------ */
IF COL_LENGTH(N'dbo.Equipos', N'IdRangoIP') IS NULL
    ALTER TABLE dbo.Equipos ADD IdRangoIP INT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Equipos_RangoIP'
)
    ALTER TABLE dbo.Equipos ADD CONSTRAINT FK_Equipos_RangoIP
        FOREIGN KEY (IdRangoIP) REFERENCES dbo.RangosIP (IdRangoIP)
        ON DELETE SET NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Equipos')
      AND name = N'IX_Equipos_IdRangoIP'
)
    CREATE INDEX IX_Equipos_IdRangoIP ON dbo.Equipos (IdRangoIP);
GO

/* ============================================================
   3. Datos iniciales + 4. Reporte de validación
   ------------------------------------------------------------
   Ajusta los códigos/nombres de cliente y de perfil a los que
   tengas dados de alta. El reporte del final te dice cuáles no
   encontró y por lo tanto no se cargaron.
   ============================================================ */

IF OBJECT_ID(N'tempdb..#Rangos', N'U') IS NOT NULL DROP TABLE #Rangos;
IF OBJECT_ID(N'tempdb..#Perfiles', N'U') IS NOT NULL DROP TABLE #Perfiles;

CREATE TABLE #Rangos (
    ClienteCodigo VARCHAR(50) NOT NULL,
    Perfil        NVARCHAR(100) NULL,
    IPInicio      VARCHAR(45) NOT NULL,
    IPFin         VARCHAR(45) NULL
);

INSERT INTO #Rangos (ClienteCodigo, Perfil, IPInicio, IPFin) VALUES
    /* Calidad: no distingue perfiles, se carga como rango general */
    ('CALIDAD',                NULL,           '192.168.2.231', '192.168.2.245'),

    /* Totalplay */
    ('TOTALPLAY',              N'Agentes',     '192.168.2.10',  '192.168.2.49'),
    ('TOTALPLAY',              N'Supervisor',  '192.168.2.50',  '192.168.2.53'),
    ('TOTALPLAY',              N'Coordinador', '192.168.2.54',  '192.168.2.55'),
    ('TOTALPLAY',              N'Gerente',     '192.168.2.56',  NULL),

    /* AT&T: perfiles con una sola IP (sin IP final) */
    ('AT&T',                   N'Agentes',     '192.168.2.59',  NULL),
    ('AT&T',                   N'Supervisor',  '192.168.2.58',  NULL),
    ('AT&T',                   N'Coordinador', '192.168.2.57',  NULL),

    /* Dimex */
    ('DIMEX',                  N'Agentes',     '192.168.2.60',  '192.168.2.69'),
    ('DIMEX',                  N'Supervisor',  '192.168.2.70',  '192.168.2.72'),
    ('DIMEX',                  N'Coordinador', '192.168.2.73',  '192.168.2.75'),
    ('DIMEX',                  N'Gerente',     '192.168.2.76',  '192.168.2.77'),
    ('DIMEX',                  N'Extra',       '192.168.2.78',  '192.168.2.79'),

    /* Shopee */
    ('SHOPEE',                 N'Agentes',     '192.168.2.80',  '192.168.2.100'),
    ('SHOPEE',                 N'Supervisor',  '192.168.2.101', '192.168.2.102'),
    ('SHOPEE',                 N'Coordinador', '192.168.2.103', '192.168.2.105'),
    ('SHOPEE',                 N'Gerente',     '192.168.2.106', '192.168.2.107'),
    ('SHOPEE',                 N'Extra',       '192.168.2.108', '192.168.2.109'),

    /* Hey Banco */
    ('HEYBANCO',               N'Agentes',     '192.168.2.110', '192.168.2.121'),
    ('HEYBANCO',               N'Supervisor',  '192.168.2.122', '192.168.2.123'),
    ('HEYBANCO',               N'Coordinador', '192.168.2.124', '192.168.2.125'),
    ('HEYBANCO',               N'Gerente',     '192.168.2.126', '192.168.2.127'),
    ('HEYBANCO',               N'Extra',       '192.168.2.128', '192.168.2.129'),

    /* Toyota */
    ('TOYOTA',                 N'Agentes',     '192.168.2.130', '192.168.2.169'),
    ('TOYOTA',                 N'Supervisor',  '192.168.2.170', '192.168.2.174'),
    ('TOYOTA',                 N'Coordinador', '192.168.2.175', '192.168.2.179'),
    ('TOYOTA',                 N'Gerente',     '192.168.2.180', '192.168.2.181'),
    ('TOYOTA',                 N'Extra',       '192.168.2.182', '192.168.2.184'),

    /* Adamantine */
    ('ADAMANTINE',             N'Agentes',     '192.168.2.185', '192.168.2.195'),
    ('ADAMANTINE',             N'Supervisor',  '192.168.2.196', '192.168.2.199'),
    ('ADAMANTINE',             N'Coordinador', '192.168.2.200', '192.168.2.201'),
    ('ADAMANTINE',             N'Gerente',     '192.168.2.202', '192.168.2.203'),
    ('ADAMANTINE',             N'Extra',       '192.168.2.204', '192.168.2.205'),

    /* Kubo */
    ('KUBO',                   N'Agentes',     '192.168.2.210', '192.168.2.219'),
    ('KUBO',                   N'Supervisor',  '192.168.2.220', '192.168.2.222'),
    ('KUBO',                   N'Coordinador', '192.168.2.223', '192.168.2.225'),
    ('KUBO',                   N'Gerente',     '192.168.2.226', '192.168.2.227'),
    ('KUBO',                   N'Extra',       '192.168.2.228', '192.168.2.229'),

    /* Adamantine Hipotecario */
    ('ADAMANTINE HIPOTECARIO', N'Agentes',     '192.168.2.230', '192.168.2.240'),
    ('ADAMANTINE HIPOTECARIO', N'Supervisor',  '192.168.2.241', '192.168.2.242'),
    ('ADAMANTINE HIPOTECARIO', N'Coordinador', '192.168.2.243', '192.168.2.244'),
    ('ADAMANTINE HIPOTECARIO', N'Gerente',     '192.168.2.245', '192.168.2.246'),
    ('ADAMANTINE HIPOTECARIO', N'Extra',       '192.168.2.247', '192.168.2.248');

/* Equivalencias para tolerar variantes de escritura en los perfiles */
CREATE TABLE #Perfiles (Alias NVARCHAR(100) NOT NULL, Nombre NVARCHAR(100) NOT NULL);
INSERT INTO #Perfiles (Alias, Nombre) VALUES
    (N'Agente',       N'Agentes'),
    (N'Agentes',      N'Agentes'),
    (N'Supervisores', N'Supervisor'),
    (N'Supervisor',   N'Supervisor'),
    (N'Cordinador',   N'Coordinador'),
    (N'Coordinador',  N'Coordinador'),
    (N'Gerentes',     N'Gerente'),
    (N'Gerente',      N'Gerente'),
    (N'Extras',       N'Extra'),
    (N'Extra',        N'Extra');

/* Resolución de cliente y perfil.
   Los renglones cuyo perfil no exista en RolesEquipo NO se cargan
   (no deben convertirse en rango general por error). */
IF OBJECT_ID(N'tempdb..#Resueltos', N'U') IS NOT NULL DROP TABLE #Resueltos;
CREATE TABLE #Resueltos (
    ClienteCodigo VARCHAR(50) NOT NULL,
    Perfil        NVARCHAR(100) NULL,
    IdCliente     INT NOT NULL,
    IdRolEquipo   INT NULL,
    Nombre        NVARCHAR(100) NOT NULL,
    IPInicio      VARCHAR(45) NOT NULL,
    IPFin         VARCHAR(45) NOT NULL,
    Estado        NVARCHAR(200) NOT NULL
);

INSERT INTO #Resueltos (ClienteCodigo, Perfil, IdCliente, IdRolEquipo, Nombre, IPInicio, IPFin, Estado)
SELECT R.ClienteCodigo,
       R.Perfil,
       C.IdCliente,
       RO.IdRolEquipo,
       COALESCE(N'Rango ' + RO.Nombre, N'Rango general'),
       R.IPInicio,
       COALESCE(NULLIF(LTRIM(RTRIM(R.IPFin)), ''), R.IPInicio),
       CASE
           WHEN R.Perfil IS NOT NULL AND RO.IdRolEquipo IS NULL
               THEN N'Perfil no encontrado en RolesEquipo: este rango no se cargó.'
           WHEN R.Perfil IS NULL
               THEN N'Cargado como rango general del cliente.'
           ELSE N'Cargado correctamente.'
       END
FROM #Rangos R
INNER JOIN dbo.Clientes C
        ON REPLACE(UPPER(LTRIM(RTRIM(C.Codigo))), ' ', '') = REPLACE(UPPER(LTRIM(RTRIM(R.ClienteCodigo))), ' ', '')
        OR REPLACE(UPPER(LTRIM(RTRIM(C.Nombre))), ' ', '') = REPLACE(UPPER(LTRIM(RTRIM(R.ClienteCodigo))), ' ', '')
LEFT JOIN #Perfiles P
       ON UPPER(LTRIM(RTRIM(P.Alias))) = UPPER(LTRIM(RTRIM(R.Perfil)))
LEFT JOIN dbo.RolesEquipo RO
       ON R.Perfil IS NOT NULL
      AND (
            UPPER(LTRIM(RTRIM(RO.Nombre))) = UPPER(LTRIM(RTRIM(COALESCE(P.Nombre, R.Perfil))))
         OR UPPER(LTRIM(RTRIM(RO.Codigo))) = UPPER(LTRIM(RTRIM(R.Perfil)))
      );

INSERT INTO dbo.RangosIP (IdCliente, IdPiso, IdRolEquipo, Nombre, IPInicio, IPFin, Descripcion)
SELECT X.IdCliente, NULL, X.IdRolEquipo, X.Nombre, X.IPInicio, X.IPFin, N'Carga inicial de rangos'
FROM #Resueltos X
WHERE X.Estado NOT LIKE N'Perfil no encontrado%'
  AND NOT EXISTS (
        SELECT 1
        FROM dbo.RangosIP RI
        WHERE RI.IdCliente = X.IdCliente
          AND ISNULL(RI.IdRolEquipo, 0) = ISNULL(X.IdRolEquipo, 0)
          AND RI.IPInicio = X.IPInicio
          AND RI.IPFin = X.IPFin
  );

/* Reporte: qué se cargó y qué falta corregir */
SELECT R.ClienteCodigo,
       R.Perfil,
       R.IPInicio,
       R.IPFin,
       CASE
           WHEN NOT EXISTS (
                SELECT 1 FROM dbo.Clientes C
                WHERE REPLACE(UPPER(LTRIM(RTRIM(C.Codigo))), ' ', '') = REPLACE(UPPER(LTRIM(RTRIM(R.ClienteCodigo))), ' ', '')
                   OR REPLACE(UPPER(LTRIM(RTRIM(C.Nombre))), ' ', '') = REPLACE(UPPER(LTRIM(RTRIM(R.ClienteCodigo))), ' ', '')
           )
               THEN N'Cliente no encontrado: revisa el código o el nombre del cliente.'
           ELSE X.Estado
       END AS Estado
FROM #Rangos R
LEFT JOIN #Resueltos X
       ON X.ClienteCodigo = R.ClienteCodigo
      AND ISNULL(X.Perfil, N'') = ISNULL(R.Perfil, N'')
      AND X.IPInicio = R.IPInicio
ORDER BY R.ClienteCodigo, R.IPInicio;

SELECT N'Rangos totales en dbo.RangosIP' AS Resumen, COUNT(*) AS Total
FROM dbo.RangosIP;

DROP TABLE #Resueltos;
DROP TABLE #Perfiles;
DROP TABLE #Rangos;
GO
