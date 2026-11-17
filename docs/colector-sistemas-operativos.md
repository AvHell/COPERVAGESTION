# Prompt para el Colector — Sistema operativo (Nombre + Compilación) al catálogo

Copia y pega el bloque **Prompt** de abajo como instrucción del programa que
colecta el hardware (en adelante *el colector*). El colector ya **no** escribe el
sistema operativo en el equipo: reporta el par **`Nombre` + `BuildSO`** al catálogo
`dbo.ActivoFijoSistemasOperativos` y deja en el equipo sólo `IdSistemaOperativo`.

Ejemplo de la identidad: `Windows 10` + `22H2` → `Nombre = 'Windows 10'`,
`BuildSO = '22H2'`. En pantalla se muestra como **Windows 10 · 22H2**.

## Qué cambió y por qué

Antes el sistema operativo se guardaba aplanado en cada equipo
(`dbo.ActivoFijoEquipos.BuildSO`). Eso duplicaba en cada fila un dato que
pertenece al sistema operativo y rompía la tercera forma normal:
`("Windows 10 Pro", "22H2")` no es *un equipo*, es *un sistema operativo*.
El script `scripts/activo-fijo-buildso-catalogo.sql` ya movió ese dato al
catálogo y **eliminó la columna del equipo**.

Estado final del esquema (es lo que el colector debe usar):

| Tabla | Columnas relevantes |
|-------|---------------------|
| `dbo.ActivoFijoSistemasOperativos` | `IdSistemaOperativo` (INT IDENTITY, PK), `Nombre` NVARCHAR(100) NOT NULL, `BuildSO` NVARCHAR(20) NULL, `Activo` BIT NOT NULL DEFAULT 1 |
| `dbo.ActivoFijoEquipos` | `IdActivoFijoEQ` (PK), `NoSerie`, `IdSistemaOperativo` (FK al catálogo), **ya NO existe `BuildSO`** |

- **Identidad del catálogo = `Nombre` + `BuildSO`.** `("Windows 10", "22H2")` y
  `("Windows 10", "21H2")` son **dos filas distintas**. El build puede ser `NULL`
  (sistemas sin compilación reportada, como los capturados a mano).
- El equipo sólo apunta a su fila con **`IdSistemaOperativo`**.
- Índice único filtrado `UX_AFSO_Nombre_Build` sobre `(Nombre, BuildSO)` (cuando
  `BuildSO` no es NULL) para que el upsert del colector sea estable.

---

## Prompt (texto plano, copiar y pegar)

```text
CONTEXTO
El inventario de activo fijo está normalizado en SQL Server. El sistema
operativo NO es un dato del equipo: vive en el catálogo
dbo.ActivoFijoSistemasOperativos y el equipo sólo guarda la llave foránea
IdSistemaOperativo. Tu trabajo en cada corrida es reportar el sistema
operativo de cada equipo como dos valores separados, Nombre y Compilación,
y enlazar el equipo a la fila correcta del catálogo.

TABLAS
- dbo.ActivoFijoSistemasOperativos
    IdSistemaOperativo  INT IDENTITY, PK
    Nombre              NVARCHAR(100) NOT NULL   (nombre comercial del SO)
    BuildSO             NVARCHAR(20)  NULL       (compilación / versión del SO)
    Activo              BIT NOT NULL DEFAULT 1
- dbo.ActivoFijoEquipos
    IdActivoFijoEQ      INT IDENTITY, PK
    NoSerie             NVARCHAR(...)            (identidad del equipo)
    IdSistemaOperativo  INT NULL, FK ->
                        dbo.ActivoFijoSistemasOperativos
    NO EXISTE la columna BuildSO en esta tabla. No la intentes escribir.

1) QUÉ DEBES OBTENER POR CADA EQUIPO
Dos valores del sistema operativo:

  a) Nombre: nombre comercial del SO.
     Windows: el ProductName del sistema (ya incluye la edición), por ejemplo
     "Windows 10", "Windows 10 Pro", "Windows 11 Pro",
     "Windows 11 Enterprise", "Windows Server 2022 Standard".
     Linux: la distribución y versión, por ejemplo "Ubuntu 24.04 LTS".

  b) BuildSO: la compilación / versión de feature update del SO, el texto
     corto que aparece junto al nombre. Ejemplos válidos:
     "22H2", "21H2", "23H2", "24H2", "1809".
     No pongas la palabra "Build" ni "Compilación" ni paréntesis: sólo el
     valor, por ejemplo 22H2.

  Resultado esperado: Nombre = 'Windows 10'  y  BuildSO = '22H2'
  (lo que el usuario lee como "Windows 10 22H2", pero son DOS columnas).

2) CÓMO OBTENERLO EN WINDOWS
Lee la clave del registro:
  HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion

  - Nombre  <- ProductName
  - BuildSO <- DisplayVersion        (aquí viven "22H2", "23H2", "24H2")
  - Si DisplayVersion viene vacío, usa CurrentBuildNumber como respaldo
    (por ejemplo "19045").
  - Si la máquina es Windows 11 (CurrentBuild >= 22000) y ProductName aún
    dice "Windows 10 ..." (pasa por compatibilidad), corrige el nombre a
    "Windows 11 ..." conservando la edición.
  - Fuente alternativa: Win32_OperatingSystem.Caption / Version
    (quita el prefijo "Microsoft " del Caption). DisplayVersion no está en
    CIM, sólo en el registro.

3) REGLAS DE NORMALIZACIÓN (obligatorias)
- Recorta espacios al inicio y al final de Nombre y BuildSO (TRIM).
- No metas la compilación dentro del Nombre: "Windows 10 22H2" NO es un
  Nombre válido; es Nombre = 'Windows 10' + BuildSO = '22H2'.
- No concatenes dos formatos de compilación ("22H2 (19045.5011)"): elige
  uno, preferentemente DisplayVersion (22H2).
- No recortes la edición del SO: Pro, Enterprise, Workstations, LTSC forman
  parte del Nombre y distinguen sistemas distintos.
- BuildSO mide máximo 20 caracteres. Si tu fuente devuelve algo más largo,
  quédate con la compilación y no con el volcado completo.
- Si el equipo no tiene SO, o el SO no expone compilación, manda
  BuildSO = NULL (columna NULL, o cadena vacía que se convertirá en NULL).
  No inventes una compilación. No uses 'N/A', 'Desconocido' ni '-'.

4) UPSERT DEL CATÁLOGO (nunca dupliques filas)
Para cada par (Nombre, BuildSO):
  1. Busca la fila en dbo.ActivoFijoSistemasOperativos comparando
     Nombre con UPPER(LTRIM(RTRIM(Nombre))) y BuildSO con
     UPPER(LTRIM(RTRIM(BuildSO))); cuando BuildSO es NULL compara IS NULL
     (un Nombre sin compilación es una fila distinta del mismo Nombre con
     compilación).
  2. Si existe: reutiliza su IdSistemaOperativo. Si estaba con Activo = 0,
     ponlo en 1.
  3. Si no existe: inserta (Nombre, BuildSO, Activo = 1) y toma el
     IdSistemaOperativo generado (SCOPE_IDENTITY() u OUTPUT INSERTED).
- Haslo dentro de una transacción por lote. Si insertas en paralelo y choca
  el índice único UX_AFSO_Nombre_Build, captura el error de clave duplicada
  y vuelve a seleccionar el Id existente (patrón insert-or-select).

5) ENLAZAR EL EQUIPO
En el mismo upsert del equipo (dbo.ActivoFijoEquipos, identidad por NoSerie):
  UPDATE dbo.ActivoFijoEquipos
     SET IdSistemaOperativo = @IdSistemaOperativo
   WHERE NoSerie = @NoSerie;
- NO escribas BuildSO en dbo.ActivoFijoEquipos: esa columna ya no existe y
  el INSERT/UPDATE fallará.
- NO escribas el nombre del SO dentro del equipo: se lee por JOIN.
- Si el equipo no reporta SO, deja IdSistemaOperativo = NULL; no borres el
  equipo ni la fila del catálogo.
- Si el equipo ya existía y su SO no cambió, no toques nada más.

6) PROHIBIDO
- Ejecutar ALTER TABLE, DROP, TRUNCATE o cualquier cambio de esquema.
- Borrar filas del catálogo: si un SO deja de usarse, pon Activo = 0.
- Insertar una fila nueva del catálogo cuando ya existe el mismo
  Nombre + BuildSO (comparación case-insensitive, sin espacios).
- Crear una fila por equipo: el catálogo debe tener un registro por
  sistema operativo, no por máquina.

7) EJEMPLO (T-SQL que debes replicar)
@NoSerie = 'ABC123', @Nombre = N'Windows 10', @BuildSO = N'22H2'

DECLARE @IdSistemaOperativo INT;

SELECT TOP (1) @IdSistemaOperativo = IdSistemaOperativo
FROM dbo.ActivoFijoSistemasOperativos
WHERE UPPER(LTRIM(RTRIM(Nombre))) = UPPER(LTRIM(RTRIM(@Nombre)))
  AND ( (BuildSO IS NULL AND @BuildSO IS NULL)
     OR UPPER(LTRIM(RTRIM(BuildSO))) = UPPER(LTRIM(RTRIM(@BuildSO))) )
ORDER BY IdSistemaOperativo;

IF @IdSistemaOperativo IS NULL
BEGIN
    INSERT INTO dbo.ActivoFijoSistemasOperativos (Nombre, BuildSO, Activo)
    VALUES (LTRIM(RTRIM(@Nombre)), NULLIF(LTRIM(RTRIM(@BuildSO)), N''), 1);
    SET @IdSistemaOperativo = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.ActivoFijoSistemasOperativos
       SET Activo = 1
     WHERE IdSistemaOperativo = @IdSistemaOperativo AND Activo = 0;
END;

UPDATE dbo.ActivoFijoEquipos
   SET IdSistemaOperativo = @IdSistemaOperativo
 WHERE NoSerie = @NoSerie;

8) RESULTADO ESPERADO EN EL CATÁLOGO
| Nombre                    | BuildSO |
|---------------------------|---------|
| Windows 10                | 22H2    |
| Windows 10 Pro            | 22H2    |
| Windows 11 Pro            | 23H2    |
| Windows 11 Enterprise     | 24H2    |
| Ubuntu 24.04 LTS          | NULL    |

Si tu salida produce "Windows 10 22H2" en una sola columna, o dos filas del
catálogo con el mismo Nombre y la misma compilación, está mal: corrígelo
antes de enviar.
```

---

## Ejemplo de upsert (T-SQL, para probar a mano)

```sql
-- @NoSerie = serie del CPU; @Nombre = 'Windows 10'; @BuildSO = '22H2'
DECLARE @IdSistemaOperativo INT;

SELECT TOP (1) @IdSistemaOperativo = IdSistemaOperativo
FROM dbo.ActivoFijoSistemasOperativos
WHERE UPPER(LTRIM(RTRIM(Nombre))) = UPPER(LTRIM(RTRIM(@Nombre)))
  AND ( (BuildSO IS NULL AND @BuildSO IS NULL)
     OR UPPER(LTRIM(RTRIM(BuildSO))) = UPPER(LTRIM(RTRIM(@BuildSO))) )
ORDER BY IdSistemaOperativo;

IF @IdSistemaOperativo IS NULL
BEGIN
    INSERT INTO dbo.ActivoFijoSistemasOperativos (Nombre, BuildSO, Activo)
    VALUES (LTRIM(RTRIM(@Nombre)), NULLIF(LTRIM(RTRIM(@BuildSO)), N''), 1);

    SET @IdSistemaOperativo = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE dbo.ActivoFijoSistemasOperativos
       SET Activo = 1
     WHERE IdSistemaOperativo = @IdSistemaOperativo AND Activo = 0;
END;

UPDATE dbo.ActivoFijoEquipos
   SET IdSistemaOperativo = @IdSistemaOperativo
 WHERE NoSerie = @NoSerie;

-- (Si el equipo no existe, primero créalo y luego repite este UPDATE.)
```

---

## Cómo verificar que el colector quedó bien

```sql
-- 1) El catálogo tiene una fila por Nombre + Compilación
SELECT so.IdSistemaOperativo, so.Nombre, so.BuildSO, so.Activo,
       COUNT(af.IdActivoFijoEQ) AS Equipos
FROM dbo.ActivoFijoSistemasOperativos so
LEFT JOIN dbo.ActivoFijoEquipos af ON af.IdSistemaOperativo = so.IdSistemaOperativo
GROUP BY so.IdSistemaOperativo, so.Nombre, so.BuildSO, so.Activo
ORDER BY so.Nombre, so.BuildSO;

-- 2) Ningún equipo quedó con BuildSO (la columna no debe existir)
SELECT CASE WHEN COL_LENGTH(N'dbo.ActivoFijoEquipos', N'BuildSO') IS NULL
            THEN N'OK' ELSE N'TODAVIA EXISTE' END AS [BuildSO en Equipos];

-- 3) No hay compilaciones con formato Viejo (número de build en vez de 22H2)
SELECT IdSistemaOperativo, Nombre, BuildSO
FROM dbo.ActivoFijoSistemasOperativos
WHERE BuildSO LIKE '%[0-9].[0-9]%'        -- p. ej. 19045.5011
   OR BuildSO LIKE '%Build%'
   OR Nombre LIKE '%[0-9][0-9]H[0-9]%';    -- compilación metida en el Nombre

-- 4) No hay equipos con SO huérfano
SELECT COUNT(*) AS ConFKHuerfana
FROM dbo.ActivoFijoEquipos af
LEFT JOIN dbo.ActivoFijoSistemasOperativos so
       ON so.IdSistemaOperativo = af.IdSistemaOperativo
WHERE af.IdSistemaOperativo IS NOT NULL AND so.IdSistemaOperativo IS NULL;
```

Lo esperado: `BuildSO en Equipos = OK`, consulta 3 sin filas,
`ConFKHuerfana = 0`, y una fila de catálogo por cada `Nombre + BuildSO`.

> **Nota sobre datos viejos.** El script de migración copió a `BuildSO` lo que
> hubiera en `ActivoFijoEquipos.BuildSO`; si el colector anterior guardaba ahí el
> número de build (`22631.3155`) en vez de la compilación (`23H2`), esas filas
> aparecerán en la consulta 3. Re-apunta esos equipos a la fila correcta del
> catálogo y deja la vieja con `Activo = 0`; no la borres a mano si tiene equipos
> apuntando a ella.

---

## Orden de despliegue

1. `scripts/activo-fijo-buildso-catalogo.sql` — agrega `BuildSO` al catálogo,
   migra lo existente, crea el índice único y **elimina**
   `ActivoFijoEquipos.BuildSO`.
2. Desplegar el colector con este prompt.
3. Verificar con las consultas de arriba.

Si el colector manda `BuildSO` a `dbo.ActivoFijoEquipos` **después** del paso 1,
el comando falla porque la columna ya no existe. Si lo hace **antes**, el script
de migración adopta el build y re-apunta el equipo (no se pierde el dato).
