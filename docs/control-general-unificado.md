# Detalle del activo + Control general de IP — unificación

Este documento resume **cómo se reparten** las dos pantallas (Detalle del activo
fijo y Control general de IP), **qué tablas/columnas repiten datos** en la base,
cuál es la **fuente de verdad** recomendada (joins en lugar de duplicar) y cómo
se apoya el **colector** en este esquema.

## 1. Dos páginas, una sola fuente de datos

**No hay página fusionada.** Cada módulo vive en su archivo y se entra a él por
su ruta propia (el menú de `permisos-ui.js` ya los separa):

| Página | Archivo | Renderer | Qué hace |
|--------|---------|----------|----------|
| Detalle del activo fijo | `src/ActivoFijo/html/detalle.html` | `src/ActivoFijo/js/detalle-renderer.js` | Maestro de activos, buscadores cruzados y ficha (red / cuentas / programas / piezas, incluidas diademas). Siempre con `Vigente = 1`. |
| Control general IP | `src/html/inventario-ip.html` | `src/js/inventario-ip-renderer.js` | Segmentos, alta/edición, catálogos editables, color, exportar/importar Excel, columna *Origen IP* y filtro de volátiles. |

Historial: en una versión intermedia el *Control general IP* se incrustó como
cuarta pestaña del Detalle. **Se revirtió**: duplicaba el módulo, obligaba a
cargar `inventario-ip.css` dentro de otra página y mantenía dos copias de los
mismos IDs. Hoy el Detalle tiene exactamente dos pestañas (`maestro` y
`buscadores`) y el control de IP volvió a ser su propia página. La tercera
pestaña, *Puente con equipos*, se eliminó junto con su vista
`dbo.vw_ActivoFijoPuenteEquipos` (ver §6.2).

Lo que **sí** los unifica es la base de datos, no la UI:

- `dbo.vw_InventarioIPUnificado` — una fila por IP, venga del control general,
  de un equipo de cliente **o de la red que reporta el colector** (ver §5).
- `dbo.vw_ActivoFijoPiezasUnificadas` — cada pieza (monitor, disco, teclado,
  ratón, **diadema**) con su activo dueño.
- `dbo.InventarioGeneralIP.OrigenIP`/`EsConfiable` — procedencia común para el
  alta manual, la importación de Excel y el colector (ver §3).

Tipografía y piel: ambos módulos comparten la misma pareja de fuentes
(**Inter** para texto, **Manrope** para títulos), declarada en
`src/ActivoFijo/css/detalle.css` y `src/css/inventario-ip.css` y cargada desde
Google Fonts en los dos HTML. Si se cambia una hay que cambiar la otra, para que
las pantallas no se vean distintas.

Los dos renderers siguen envueltos en **IIFE** aunque ya no compartan documento:
evita que sus `const $`, `escaparHTML`, etc. se cuelguen del `window` y choquen
con cualquier otro script que use esos nombres.

## 2. Revisión de la base: datos repetidos y fuente de verdad

Al revisar el esquema (`scripts/*.sql`) se detecta duplicación entre el flujo
antiguo de **Equipos** y el nuevo de **Activo Fijo**, y entre el inventario IP
manual y el de equipos de clientes. Recomendación: **no duplicar en reposo**;
leer con `JOIN`/vistas. Estado actual y destino:

| Dato                    | Tablas que lo repiten hoy                                   | Fuente de verdad recomendada                         |
|-------------------------|-------------------------------------------------------------|------------------------------------------------------|
| IP / Hostname / MAC     | `dbo.Equipos`, `dbo.InventarioGeneralIP`, `dbo.EquiposControlGeneralIP` (MAC/puerto), `dbo.ActivoFijoEquiposRed` (red del colector) | `InventarioGeneralIP` para IP "suelta"/manual; `dbo.Equipos` para equipos de cliente; `ActivoFijoEquiposRed` para los activos administrados (lo que captura el colector). La vista `vw_InventarioIPUnificado` mezcla las tres y `inventario-ip.js` la replica en su respaldo. |
| NoSerie / Hostname      | `ActivoFijoEquipos`, `ActivoFijoEquiposRed`, `ActivoFijoEquiposComponentes` | `ActivoFijoEquipos.NoSerie` es el maestro; las tablas de detalle lo repiten **sólo** como clave de correlación para lecturas puntuales (ya es el diseño). |
| Marca / Modelo / Tipo   | texto en `Equipos`/`ActivoFijoEquipos` y catálogos 3FN          | Catálogos 3FN (`ActivoFijoTipos`, marcas, modelos…). `activo-fijo-3fn.sql` ya migró a FKs. |
| Catálogos del control IP| `CatalogosInventarioIP` (única)                              | OK: una sola tabla de catálogo por `TipoCatalogo`.  |
| Datos de cliente IP     | `EquiposControlGeneralIP` (complemento, por `IdEquipo`)      | `EquiposControlGeneralIP` complementa `dbo.Equipos` sin duplicar columnas base. |

Conclusiones:

- **No conviene borrar columnas** todavía: `dbo.Equipos` lo usa el módulo de
  Equipos (funciona al 100 en clientes) y varias vistas/triggers lo referencian.
- La unificación correcta es **por lectura con joins** (lo que ya hace
  `inventario-ip.js`): el control general combina `InventarioGeneralIP` +
  `EquiposControlGeneralIP` + `dbo.Equipos`. No se requiere copiar IP/serie a
  otra tabla.
- Si en el futuro se decide consolidar de verdad, el orden seguro es:
  1. crear una **vista** que unifique ambos orígenes, 2. apuntar la UI a la
    vista, 3. sólo entonces retirar columnas redundantes. Este repo ya usa ese
    patrón (`vw_ActivoFijo*`). No se ejecuta el paso 3 aquí para no romper
    Equipos/clientes.

## 3. Procedencia de IP: estático, DHCP y WiFi

- El control general modela el tipo de IP en el catálogo
  `CatalogosInventarioIP` (`TipoCatalogo = 'TipoIP'`). Ahora incluye
  **`WiFi (controlador)`** además de `Estatica` y `DHCP`.
- `dbo.InventarioGeneralIP` gana dos columnas (ver
  `scripts/activo-vivo-unificado.sql`):
  - `OrigenIP` ∈ `Manual | DHCP | Wifi | Otro`.
  - `EsConfiable` (BIT, default 1).
- **Regla:** lo que venga de un **controlador WiFi** (o DHCP volátil) se marca
  `EsConfiable = 0`. Esas IP cambian al reconectar y no deben tratarse como
  inventario fijo. El inventario "duro" es Estático + DHCP confirmado.
- El `TipoIP` del catálogo **manda** sobre lo que se haya guardado: si el
  equipo dice `WiFi (controlador)`, `DHCP` o `Dinámica`, la vista
  (`vw_InventarioIPUnificado`) y el respaldo de la app recalculan
  `OrigenIP`/`EsConfiable` sin importar el valor almacenado. Esto evita que una
  importación vieja marque como fija una dirección que ya es volátil.
- **La misma precedencia se aplica al escribir** (`resolverProcedencia` en
  `src/js/db/inventario-ip.js`): con un `TipoIP` volátil, un `origenIP`
  explícito contradictorio (p. ej. el colector manda `'Manual'` para un equipo
  WiFi) se ignora y se guarda `Wifi`/`DHCP` con `EsConfiable = 0`. Así lo que
  hay en disco nunca contradice lo que muestra la pantalla. En tipos estáticos
  el valor explícito sí manda, para poder registrar `Otro` o corregir a mano
  (`EsConfiable` explícito también se respeta). El verificador
  `scripts/activo-vivo-verificar.sql` prueba ese caso contradictorio.
- **La red del colector no se guarda en `InventarioGeneralIP`:** el colector
  escribe en `dbo.ActivoFijoEquiposRed` y la vista deduce la procedencia ahí
  mismo (WiFi → `Wifi`/`0`, `DHCP = 1` → `DHCP`/`0`, resto → `Manual`/`1`), sin
  copiar nada al inventario manual. Ver §5.1.
- **Regla de alta:** sólo un tipo **volátil** puede guardarse **sin IP**.
  `permiteSinIP(nombreTipoIP)` (en `src/js/db/inventario-ip.js`) reutiliza
  `procedenciaPorTipoIP` y devuelve `true` para `DHCP`, `Dinámica` y
  `WiFi (controlador)`, `false` para `Estatica` y cualquier tipo manual. Se usa
  igual en el alta manual (`guardar`), en la importación masiva
  (`insertarImportados`) y en la pre-validación del Excel
  (`src/js/importacion-inventario-ip.js`), así que un equipo del controlador
  WiFi puede entrar sin dirección y se completa cuando el colector la reporta.
  En el Excel, `tipo IP` acepta `wifi`, `wifi controlador`, `controlador`,
  `wireless`, `inalámbrica/o` y los normaliza a `WiFi (controlador)`.
- En la interfaz de la página *Control general IP* (`inventario-ip.html`):
  - Columna **Origen IP** con etiqueta `Estática` (verde) / `DHCP` / `WiFi`
    (ámbar, borde discontinuo = volátil).
  - Casilla **“Incluir volátiles (DHCP / WiFi)”**, **apagada por defecto**: la
    tabla sólo muestra direcciones confiables. El resumen de segmentos avisa
    cuántas quedaron ocultas (`N volátiles ocultas`) para que no desaparezcan
    en silencio; al activarla se recalculan segmentos y ocupación.

## 4. Diademas

- `dbo.ActivoFijoEquiposComponentes` admite `TipoComponente = 'DIADEMA'`
  (se amplió `CK_AFComp_Tipo`) y tiene columnas nuevas opcionales:
  `MAC`, `ConectadoA`, `EstadoConexion`, `Bateria`. `ConectadoA` es
  `NVARCHAR(300)`: el script lo crea con ese ancho y ensancha bases anteriores
  que la tuvieran en 150, porque el colector puede reportar descripciones largas
  ("Bluetooth LE · receptor USB frontal").
- En el Detalle, el buscador de piezas y la ficha muestran "Diadema(s)".
- El colector las reporta como componentes con `TipoComponente = 'DIADEMA'`
  y completa los campos que hoy llegan vacíos (`MAC`, `Identificador`,
  `IdentificadorTipo`, `Confianza`, `Detalles`) más la procedencia de la IP
  (`OrigenIP`/`EsConfiable`). El prompt listo para copiar está en
  `docs/colector-diademas.md`.

## 5. Vistas unificadas (una sola fuente de lectura)

`scripts/activo-vivo-vistas.sql` crea dos vistas de **sólo lectura** que
materializan por JOIN lo que antes se repetía en el código o en columnas
copiadas. No mueven ni duplican datos en reposo:

| Vista | Qué resuelve | Fuentes |
|-------|--------------|---------|
| `dbo.vw_InventarioIPUnificado` | Una fila por IP, venga del control general, de un equipo de cliente o de la red que reporta el colector, con `Origen`, `OrigenIP` y `EsConfiable` ya calculados. | `InventarioGeneralIP` + `CatalogosInventarioIP` ∪ `Equipos` + `Clientes` + `EquiposControlGeneralIP` ∪ `ActivoFijoEquiposRed` |
| `dbo.vw_ActivoFijoPiezasUnificadas` | Cada pieza (monitor, disco, teclado, ratón, **diadema**) con su activo dueño y el empate al inventario anterior por `NoSerieCPU`. | `ActivoFijoEquiposComponentes` + `ActivoFijoEquipos` + `Equipos` |

Uso desde la app:

- `src/js/db/inventario-ip.js` (`listar()`) **detecta si la vista existe** y la
  usa; si no, cae a la consulta `UNION` directa. Lo mismo con las columnas de
  procedencia: si `OrigenIP`/`EsConfiable` aún no existen, se leen como
  `NULL`/`1` y nada se rompe. El colector y cualquier reporte futuro deben leer
  de las vistas en lugar de reescribir la unión.

La vista del **Detalle** (`vw_ActivoFijoEquipoInline`) la crea
`scripts/activo-fijo-detalle.sql`, no este script. Son independientes.

### 5.1 Las tres fuentes de `vw_InventarioIPUnificado`

La columna `Origen` dice de dónde salió cada renglón y la interfaz la pinta como
badge con color propio (`claseOrigen()` en `inventario-ip-renderer.js`):

| `Origen` | Tabla de la que sale | Para qué sirve | Acciones en la tabla |
|----------|----------------------|----------------|----------------------|
| `General` | `InventarioGeneralIP` | Inventario IP manual / importado. Es donde se da de alta a mano. | Editar, Eliminar |
| `Cliente` | `Equipos` + `Clientes` (`TipoIP = 'Estatica'`, `Activo = 1`) | Equipos de cliente del módulo Equipos. | Editar, Eliminar |
| `Activo` | `ActivoFijoEquiposRed` (`Vigente = 1`) | Red que **reporta el colector** para un activo fijo (WiFi, DHCP, WORKGROUP). | **Sólo lectura**: badge azul grisáceo y nota «Colector» |

Consecuencias de la tercera fuente:

- **Sin ella el colector era invisible**: una laptop reportada por WiFi/DHCP
  (p. ej. `SOP-LAP-1` · `192.168.62.117`) no está en `InventarioGeneralIP` ni en
  `Equipos`, así que el control general no la mostraba aunque el equipo
  estuviera registrado en el Detalle.
- **Un renglón por tarjeta de red**, no por equipo. La vista agrupa con
  `ROW_NUMBER()` particionando por **MAC** (o por IP si el adaptador no expone
  MAC) y se queda con la fila ligada a un activo, `EsPrincipal`, la vista por
  última vez. Así una fila huérfana (`IdActivoFijoEQ = NULL`) o un duplicado del
  mismo equipo no pinta la IP dos veces.
- **Procedencia derivada**: adaptador WiFi → `Wifi`/`0`; `DHCP = 1` →
  `DHCP`/`0`; el resto → `Manual`/`1`. Por eso lo del colector sale oculto por
  defecto y se ve al activar **“Incluir volátiles”**.
- **Los registros `Activo` no se editan aquí** (no aparecen Editar/Eliminar):
  la fila pertenece a otra tabla y el siguiente lote del colector la
  sobrescribiría. Se corrigen en el equipo de origen.
- La **exportación a Excel** (`main.js`) no considera reservadas las IP de
  origen `Activo`: sólo aplica la reserva de cliente a `General` y a las IP
  libres de un segmento.

## 6. Pasos de despliegue

Orden recomendado (todos los scripts son idempotentes: se pueden repetir sin
efectos secundarios):

1. `scripts/activo-fijo-detalle.sql` — tablas puente del colector
   (`ActivoFijoEquiposRed/Cuentas/Programas/Componentes`), índices y la vista
   `vw_ActivoFijoEquipoInline`. **Ejecutarlo primero**: si no, el Detalle muestra
   "Faltan las fuentes del colector" (ver §6.2).
1-bis. `scripts/drop-vw-activo-fijo-puente.sql` — retira la vista y la tabla del
   *Puente con equipos* que quedaron en bases ya migradas.
2. `scripts/activo-vivo-unificado.sql` — `DIADEMA` en el `CHECK`, columnas de
   diadema y `OrigenIP`/`EsConfiable`.
3. `scripts/activo-vivo-vistas.sql` — `vw_InventarioIPUnificado` y
   `vw_ActivoFijoPiezasUnificadas`.
4. Desplegar esta versión de la app (Detalle + Control general IP separados,
   diademas, filtro de volátiles).
5. Actualizar el colector con el prompt de `docs/colector-diademas.md`.
6. Verificar con `scripts/activo-vivo-verificar.sql` (sólo lectura + pruebas
   con `ROLLBACK`, no deja datos).

Cada script termina con un `SELECT` de verificación: las columnas nuevas deben
salir con `Existe = 1`. El script de verificación va más allá: comprueba los
diez objetos (columnas, `CK`, vistas), prueba que `WiFi (controlador)` y `DHCP`
caigan en `EsConfiable = 0`, que `Estatica` quede en `Manual`/`1`, que el `CHECK`
rechace un `OrigenIP` inventado y que una `DIADEMA` se vea completa en la vista.

### 6.1 Error "Invalid column name 'OrigenIP'" al ejecutar el script

Síntoma: el mensaje sale justo antes de «Columnas OrigenIP / EsConfiable
verificadas…» o después de «Columnas de diadema verificadas…», y al consultar
`COL_LENGTH('dbo.InventarioGeneralIP','OrigenIP')` sigue devolviendo `NULL`.

Causa: SQL Server **compila el lote completo antes de ejecutarlo**, así que un
`ALTER TABLE ... ADD CONSTRAINT ... CHECK (OrigenIP ...)` en el **mismo** lote
que el `ALTER TABLE ... ADD OrigenIP` se rechaza con ese error y **todo el lote
se descarta** (por eso tampoco se creaban las columnas).

Solución aplicada: el `CHECK` de `OrigenIP` vive ahora en su propio lote
(`2.1-bis`) y se declara con `EXEC(N'ALTER TABLE …')`, de modo que el nombre se
resuelve en tiempo de ejecución. Basta volver a ejecutar el script completo: es
idempotente. Mismo patrón a respetar en cualquier migración futura que añada
una columna y una restricción que la use.

### 6.2 «Faltan las fuentes del colector» y Puente vacío

El aviso de la ficha y la bandeja del *Puente con equipos* dependen de dos cosas
distintas:

- `estadoFuentes()` sólo comprueba que **existan** las tablas y las dos vistas
  del Detalle. Si están, la ficha deja de avisar.
- `resumenPuente()` / `listarPuente()` leen `dbo.vw_ActivoFijoPuenteEquipos`.
  Si el objeto existe pero es una **versión vieja** (le faltan `Hostname`, `IP`,
  `Mascara`, `PuertaEnlace`, `DNS1`, `DNS2`, `NoSerieActivo`, `DominioActivo` o
  `EsSoloActivo`), las consultas devuelven 0 filas con
  «La vista del puente no tiene las columnas esperadas». El Puente se ve vacío
  aunque el objeto "exista".

Como el script usa `CREATE OR ALTER VIEW`, volver a ejecutar
`scripts/activo-fijo-detalle.sql` **actualiza** las vistas en sitio sin tocar
datos. Después de ejecutarlo, en una base real con 562 equipos el puente
devuelve ~591 filas (los 562 del flujo viejo + los activos `SOLO_ACTIVO`).
