SET NOCOUNT ON;
/* Muestras reales de la fusión */
SELECT Origen, Origenes, IP, Hostname, MAC, ClaveGestion, Dispositivo, TipoEquipo,
       Piso, Site, ClienteNombre, PuertoFortinet, Descripcion, DescripcionTecnica,
       OrigenIP, EsConfiable, GestionManual, FuenteGestion
FROM dbo.vw_InventarioIPMaestro
WHERE IP IN ('192.168.2.156', '192.168.140.100');

/* Prueba del trigger de gestión: escribe, comprueba y deshace */
BEGIN TRAN;
INSERT INTO dbo.InventarioIPGestion (Clave, IdDispositivo, IdTipoEquipo, IdPiso, IdCliente, PuertoFortinet, Descripcion)
SELECT ClaveGestion,
       (SELECT TOP 1 IdCatalogoIP FROM dbo.CatalogosInventarioIP WHERE TipoCatalogo='Dispositivo' ORDER BY IdCatalogoIP),
       (SELECT TOP 1 IdCatalogoIP FROM dbo.CatalogosInventarioIP WHERE TipoCatalogo='TipoEquipo'  ORDER BY IdCatalogoIP),
       (SELECT TOP 1 IdCatalogoIP FROM dbo.CatalogosInventarioIP WHERE TipoCatalogo='Piso'        ORDER BY IdCatalogoIP),
       (SELECT TOP 1 IdCliente FROM dbo.Clientes ORDER BY IdCliente),
       'P-TEST', 'PRUEBA TRIGGER'
FROM dbo.InventarioIPMaestro WHERE IP = '192.168.2.156';

SELECT 'DESPUES' AS Paso, IP, Dispositivo, TipoEquipo, Piso, ClienteNombre, PuertoFortinet,
       Descripcion, GestionManual, FuenteGestion
FROM dbo.vw_InventarioIPMaestro WHERE IP = '192.168.2.156';
ROLLBACK TRAN;

SELECT 'TRAS ROLLBACK' AS Paso, IP, PuertoFortinet, Descripcion, GestionManual
FROM dbo.vw_InventarioIPMaestro WHERE IP = '192.168.2.156';
