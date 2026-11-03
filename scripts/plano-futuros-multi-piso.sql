/*
  Ejecutar una vez en la base de datos de la aplicación para habilitar
  propuestas futuras que incluyan y muevan equipos entre varios pisos.
*/

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

IF COL_LENGTH(N'dbo.EscenarioPlanoFuturoOriginal', N'IdPisoOriginal') IS NULL
    ALTER TABLE dbo.EscenarioPlanoFuturoOriginal ADD IdPisoOriginal INT NULL;
GO

UPDATE O
SET O.IdPisoOriginal = E.IdPiso
FROM dbo.EscenarioPlanoFuturoOriginal O
INNER JOIN dbo.EscenariosPlanoFuturo E
    ON E.IdEscenarioFuturo = O.IdEscenarioFuturo
WHERE O.IdPisoOriginal IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.EscenarioPlanoFuturoOriginal')
      AND name = N'IdPisoOriginal'
      AND is_nullable = 1
)
    ALTER TABLE dbo.EscenarioPlanoFuturoOriginal ALTER COLUMN IdPisoOriginal INT NOT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.EscenarioPlanoFuturoOriginal')
      AND name = N'FK_EscenarioPlanoFuturoOriginal_Piso'
)
    ALTER TABLE dbo.EscenarioPlanoFuturoOriginal
        ADD CONSTRAINT FK_EscenarioPlanoFuturoOriginal_Piso
        FOREIGN KEY (IdPisoOriginal) REFERENCES dbo.Pisos (IdPiso);
GO

IF COL_LENGTH(N'dbo.EscenarioPlanoFuturoUbicaciones', N'IdPiso') IS NULL
    ALTER TABLE dbo.EscenarioPlanoFuturoUbicaciones ADD IdPiso INT NULL;
GO

UPDATE U
SET U.IdPiso = E.IdPiso
FROM dbo.EscenarioPlanoFuturoUbicaciones U
INNER JOIN dbo.EscenariosPlanoFuturo E
    ON E.IdEscenarioFuturo = U.IdEscenarioFuturo
WHERE U.IdPiso IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.EscenarioPlanoFuturoUbicaciones')
      AND name = N'IdPiso'
      AND is_nullable = 1
)
    ALTER TABLE dbo.EscenarioPlanoFuturoUbicaciones ALTER COLUMN IdPiso INT NOT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.EscenarioPlanoFuturoUbicaciones')
      AND name = N'FK_EscenarioPlanoFuturoUbicaciones_Piso'
)
    ALTER TABLE dbo.EscenarioPlanoFuturoUbicaciones
        ADD CONSTRAINT FK_EscenarioPlanoFuturoUbicaciones_Piso
        FOREIGN KEY (IdPiso) REFERENCES dbo.Pisos (IdPiso);
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

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.EscenarioPlanoFuturoUbicaciones')
      AND name = N'UX_EscenarioPlanoFuturoUbicaciones_Celda'
)
    DROP INDEX UX_EscenarioPlanoFuturoUbicaciones_Celda
        ON dbo.EscenarioPlanoFuturoUbicaciones;
GO

CREATE UNIQUE INDEX UX_EscenarioPlanoFuturoUbicaciones_Celda
    ON dbo.EscenarioPlanoFuturoUbicaciones (IdEscenarioFuturo, IdPiso, Fila, Columna);
GO
