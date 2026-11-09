/*
  Ejecutar una vez en la base de datos de la aplicación.

  Habilita el ciclo completo de "Equipos sin ubicar" dentro de una copia
  futura (propuesta) sin tocar el plano actual:

    * QUITAR del plano de la propuesta: borra solo la fila de
      EscenarioPlanoFuturoUbicaciones. El equipo sigue dentro de la propuesta
      en "Equipos sin ubicar" y puede colocarse otra vez. La fila de
      EscenarioPlanoFuturoOriginal se conserva con su posición real, así que
      el plano actual (PlanoUbicaciones / Equipos) no cambia.

    * COLOCAR un equipo que nunca ha tenido sitio en el plano real: en
      EscenarioPlanoFuturoOriginal no existe posición, se guarda (0,0) como
      marca de "no estaba ubicado" y la posición propuesta vive en
      EscenarioPlanoFuturoUbicaciones (que sigue exigiendo Fila > 0 y
      Columna > 0).

  Para que el marcador (0,0) sea posible hay que relajar
  CK_EscenarioPlanoFuturoOriginal_Posicion de FilaOriginal > 0 a >= 0.
  Este archivo hace lo mismo que scripts/plano-futuros-equipos.sql y lo
  deja documentado junto al flujo de "sin ubicar": basta con ejecutar uno
  de los dos.

  Idempotente: la comprobación busca la ausencia de ">=" en la definición de
  la restricción (SQL Server la normaliza como ([FilaOriginal]>=(0) AND ...)),
  así que una segunda ejecución no hace nada.
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

PRINT N'Listo: las copias futuras permiten quitar equipos del plano y volver a colocarlos (incluidos los que no tienen sitio en el plano actual).';
GO
