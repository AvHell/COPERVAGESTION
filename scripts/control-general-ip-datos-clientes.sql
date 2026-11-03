/*
  Ejecutar una vez después de control-general-ip.sql.
  Guarda los datos complementarios del control general sin modificar Equipos.
*/

IF OBJECT_ID(N'dbo.EquiposControlGeneralIP', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EquiposControlGeneralIP (
        IdEquipo INT NOT NULL
            CONSTRAINT PK_EquiposControlGeneralIP PRIMARY KEY,
        MAC VARCHAR(17) NULL,
        IdDispositivo INT NULL,
        IdTipoEquipo INT NULL,
        IdSite INT NULL,
        PuertoFortinet NVARCHAR(100) NULL,
        Descripcion NVARCHAR(500) NULL,
        FechaActualizacion DATETIME2(0) NOT NULL
            CONSTRAINT DF_EquiposControlGeneralIP_Fecha DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_EquiposControlGeneralIP_Equipo
            FOREIGN KEY (IdEquipo) REFERENCES dbo.Equipos (IdEquipo)
            ON DELETE CASCADE,
        CONSTRAINT FK_EquiposControlGeneralIP_Dispositivo
            FOREIGN KEY (IdDispositivo) REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP),
        CONSTRAINT FK_EquiposControlGeneralIP_TipoEquipo
            FOREIGN KEY (IdTipoEquipo) REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP),
        CONSTRAINT FK_EquiposControlGeneralIP_Site
            FOREIGN KEY (IdSite) REFERENCES dbo.CatalogosInventarioIP (IdCatalogoIP)
    );
END;
GO
