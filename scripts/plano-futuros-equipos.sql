/*
  Ejecutar una vez en la base de datos de la aplicación para permitir
  AÑADIR equipos que no están ubicados en el plano a una copia futura.

  En EscenarioPlanoFuturoOriginal la posición (0,0) significa "este equipo no
  tenía sitio asignado en el plano actual" y la ubicación propuesta vive en
  EscenarioPlanoFuturoUbicaciones (que sigue exigiendo Fila > 0 y Columna > 0).
  El plano actual (PlanoUbicaciones / Equipos) nunca se modifica.

  Idempotente: solo actúa si la restricción sigue siendo la versión estricta
  (Fila > 0). SQL Server normaliza el texto de la restricción a
  ([FilaOriginal]>=(0) AND ...), por eso la comprobación busca la ausencia
  de ">=" en lugar de un texto con espacios.
*/

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.EscenarioPlanoFuturoOriginal')
      AND name = N'CK_EscenarioPlanoFuturoOriginal_Posicion'
      AND definition NOT LIKE N'%>=%'
)
    ALTER TABLE dbo.EscenarioPlanoFuturoOriginal
        DROP CONSTRAINT CK_EscenarioPlanoFuturoOriginal_Posicion;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.EscenarioPlanoFuturoOriginal')
      AND name = N'CK_EscenarioPlanoFuturoOriginal_Posicion'
)
    ALTER TABLE dbo.EscenarioPlanoFuturoOriginal
        ADD CONSTRAINT CK_EscenarioPlanoFuturoOriginal_Posicion
        CHECK (FilaOriginal >= 0 AND ColumnaOriginal >= 0);
GO
