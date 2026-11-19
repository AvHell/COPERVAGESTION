# Control general de IP — unificación con Activo Fijo y el colector

Este documento resume **cómo se reparten** las pantallas que quedan (Control
general de IP y el inventario de Activo Fijo), **qué tablas/columnas repiten
datos** en la base, cuál es la **fuente de verdad** recomendada (joins en lugar
de duplicar) y cómo se apoya el **colector** en este esquema.

## 1. Una pantalla viva, una sola fuente de datos

**No hay página fusionada.** El Control general de IP vive en su archivo y se
entra a él por su ruta propia; el inventario de Activo Fijo es otra ruta.

| Página | Archivo | Renderer | Qué hace |
|--------|---------|----------|----------|
| Control general IP | `src/html/inventario-ip.html` | `src/js/inventario-ip-renderer.js` | Segmentos, alta/edición, catálogos editables, color, exportar/importar Excel, columna *Origen IP* y filtro de volátiles. |
| Activo Fijo (inventario) | `src/ActivoFijo/html/activos.html` | `src/ActivoFijo/js/activos-renderer.js` | Carteras, ABM de activos, catálogos y la ficha **Ver** (red / cuentas / programas / piezas, incluidas diademas). Siempre con `Vigente = 1`. |

Historial: el módulo **Detalle del activo** existió como página aparte
(`detalle.html` + `detalle-renderer.js` + `detalle.css`) y **se retiró**. Lo que
sobrevive es su capa de datos, `src/ActivoFijo/consultas/detalle.js`, porque el
botón *Ver* del inventario la usa para pintar la ficha de piezas y red
(`IPC af-activos-componentes`). La pestaña *Puente con equipos* y su vista
`dbo.vw_ActivoFijoPuenteEquipos` también se eliminaron (ver §6.2).


Lo que **sí** los unifica es la base de datos, no la UI:

- `dbo.vw_InventarioIPUnificado` — una fila por IP, venga del control general,
  de un equipo de cliente **o de la red que reporta el colector** (ver §5).
- `dbo.vw_ActivoFijoPiezasUnificadas` — cada pieza (monitor, disco, teclado,
  ratón, **diadema**) con su activo dueño.
- `dbo.InventarioGeneralIP.OrigenIP`/`EsConfiable` — procedencia común para el
  alta manual, la importación de Excel y el colector (ver §3).

Tipografía y piel: las pantallas comparten la misma pareja de fuentes
(**Inter** para texto, **Manrope** para títulos), declarada en
`src/css/inventario-ip.css` y en los CSS de Activo Fijo y cargada desde
Google Fonts en los HTML. Si se cambia una hay que cambiar la otra, para que
las pantallas no se vean distintas.

Cada renderer sigue envuelto en **IIFE**: evita que sus `const $`,
`escaparHTML`, etc. se cuelguen del `window` y choquen con cualquier otro
script que use esos nombres.

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
| `Activo` | `ActivoFijoEquiposRed` (`Vigente = 1`) | Red que **reporta el colector** para un activo fijo (WiFi, DHCP, WORKGROUP). | **Editar datos** (dispositivo, tipo, piso, cliente, puerto Fortinet y descripción, guardados en `InventarioIPGestion`); IP/MAC/hostname de sólo lectura |

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
- **La red de un `Activo` no se edita aquí**: la IP, la MAC y el hostname los
  vuelve a mandar el colector en cada lote, así que son de sólo lectura. Lo que
  el colector **no puede saber** —dispositivo y tipo de catálogo, piso, cliente,
  puerto del Fortinet y una descripción legible— sí se captura desde esta
  pantalla y se guarda aparte en `dbo.InventarioIPGestion` (ver §5.2). Esos
  datos **no** los plancha el siguiente lote del colector: él sólo conoce el
  nombre técnico del adaptador (`Ethernet 2`), que se conserva como referencia
  en `DispositivoColector` / `TipoEquipoColector` / `DescripcionColector`.
- La **exportación a Excel** (`main.js`) no considera reservadas las IP de
  origen `Activo`: sólo aplica la reserva de cliente a `General` y a las IP
  libres de un segmento.

### 5.2 Una IP = un renglón (colector + cliente, sin duplicar)

El mismo aparato puede estar registrado **dos veces** en orígenes distintos: el
colector lo reporta (`Origen = 'Activo'`, con MAC y adaptador) y además alguien
lo capturó como equipo de un cliente (`Origen = 'Cliente'`) o en el control
general (`Origen = 'General'`). Antes eso pintaba dos renglones con la misma IP:

```
Activo   Ocupado  192.168.2.156  ...  AGT-TOY156  FC:3F:DB:0C:68:B8  Ethernet 2  ...  —       —      Intel(R) Ethernet Connection (2) I219-LM
Cliente  Ocupado  192.168.2.156  ...  AGT-TOY156  —                   —           ...  PISO 2  TOYOTA  —
```

Ahora `fusionarPorIP()` en `src/js/db/inventario-ip.js` deja **un solo renglón**:

1. La fila del **colector manda** (es la observación real del equipo) y se
   queda con su IP, MAC, hostname y adaptador.
2. Absorbe del renglón manual lo que le falta: `Piso`, `Site`, cliente,
   `PuertoFortinet` y la descripción legible (la técnica se guarda en
   `DescripcionColector` para no perderla). `Dispositivo` y `TipoEquipo` son la
   excepción: el manual **reemplaza** al del colector porque son una
   clasificación de catálogo elegida a mano, no un dato técnico; el original del
   colector queda en `DispositivoColector` / `TipoEquipoColector`.
3. El renglón manual **desaparece de la lista, no de la base**: sigue vivo en
   `Equipos` / `InventarioGeneralIP`, donde se administra como siempre.
4. La celda *Origen* muestra las dos insignias (`Colector` + `+ Cliente`) con
   un tooltip que explica por qué hay una sola fila. Con la maestra
   instalada, `badgeFusion()` lee la columna **`Origenes`** de la vista
   (`General+Cliente`, `General+Colector`…) en vez de deducir la segunda
   insignia; `etiquetaOrigen()` traduce el `Origen = 'Activo'` de la vista al
   nombre que usa la persona (**Colector**). El camino antiguo
   (`OrigenFusionado`) se conserva para bases sin la maestra.
5. Lo capturado en esta pantalla (`dbo.InventarioIPGestion`) se aplica **encima**
   de lo heredado, así que lo gestionado aquí siempre gana.

Si una misma IP la reportan **dos adaptadores distintos** del colector no se
fusiona nada: eso es un conflicto real y debe verse.

`dbo.InventarioIPGestion` (en `scripts/control-general-ip.sql`) guarda **sólo**
el complemento, con una clave estable por adaptador
(`MAC:00:11:22:33:44:55`, o `IP:192.168.1.10` si no expone MAC). Es el mismo
patrón que `dbo.EquiposControlGeneralIP` con `dbo.Equipos`: la tabla base manda
y ésta la complementa. Como el colector nunca escribe ahí, su siguiente lote no
borra lo capturado a mano. Si se guarda todo vacío (botón *Restablecer*), la
gestión se retira y el renglón vuelve a mostrar exactamente lo del colector.

Columnas: `IdDispositivo`, `IdTipoEquipo`, `IdPiso`, `IdCliente`,
`PuertoFortinet` y `Descripcion`. Todas son `NULL`ables y **vacío = «no
manda»**: se muestra lo que reporta el colector. `IdDispositivo`/`IdTipoEquipo`
se validan contra `dbo.CatalogosInventarioIP` (categoría y `Activo = 1`) igual
que en el alta manual; si la base todavía no tiene esas columnas, el guardado se
rechaza con el aviso de volver a ejecutar el script en lugar de perder la
clasificación en silencio.

> El `Piso` de un equipo de cliente vive en `dbo.Pisos`, mientras que el que se
> captura aquí es una opción de `dbo.CatalogosInventarioIP` (`TipoCatalogo =
> 'Piso'`). Por eso el diálogo sólo preselecciona los ids **propios** de la
> gestión (`IdPisoGestion` / `IdClienteGestion`) y nunca el piso heredado.

### 5.3 Tabla maestra única (`dbo.InventarioIPMaestro`)

La fusión de §5.2 resuelve el renglón repetido **en la pantalla**. Para que
los tres módulos dejen de chocar de raíz, `scripts/inventario-ip-maestro.sql`
crea **una sola tabla consolidada con una fila por IP**
(`UX_InventarioIPMaestro_IP`), sin mover, borrar ni reescribir ningún
registro original:

| Tabla de origen | Módulo dueño | Escribe |
|-----------------|--------------|---------|
| `dbo.InventarioGeneralIP` | Control general IP | la app (alta manual / Excel) |
| `dbo.Equipos` + `dbo.EquiposControlGeneralIP` | Equipos | el módulo Equipos |
| `dbo.ActivoFijoEquiposRed` | Colector (Activo Fijo) | **sólo el colector** |
| `dbo.InventarioIPGestion` | Control general IP | la app (*Editar datos*) |
| `dbo.InventarioIPMaestro` | — (espejo) | **nadie**: la llenan 5 triggers |

Cada trigger copia **sólo las columnas que su origen posee** y nunca escribe
las de los demás, así que cada módulo conserva su flujo intacto y la maestra
nunca es fuente de verdad:

- **Técnico** (`Hostname`, `MAC`, `DescripcionTecnica`, `NombreAdaptador`,
  `TipoMedio`, `DHCP`, `Mascara`, `PuertaEnlace`, `DNS*`, `Dominio`):
  Colector > Equipos > Control general.
- **Gestión** (`IdDispositivo`, `IdTipoEquipo`, `IdPiso`, `IdCliente`,
  `IdSite`, `PuertoFortinet`, `Descripcion`): `InventarioIPGestion` >
  Control general > Equipos > Colector. Si la fila tiene
  `GestionManual = 1`, **ningún origen automático vuelve a escribirla**.
- **Vínculos** (`IdInventarioIP`, `IdEquipo`, `IdActivoFijoEQ`,
  `IdEquipoRed`): cada origen escribe sólo el suyo.

Los triggers van en `TRY/CATCH` con `SET NOCOUNT ON`: si uno falla, el
módulo de origen ya quedó escrito y su flujo no se rompe; y el resultset
extra no confunde al `MERGE` del colector. `dbo.vw_InventarioIPMaestro`
expone el mismo contrato de columnas que `vw_InventarioIPUnificado`, y
`src/js/db/inventario-ip.js` la detecta (`estadoProcedencia().maestra`) y la
usa como camino preferente; si no existe, cae a la vista anterior sin
romper. `sp_IPMaestroRefrescar` recompone una IP (o todas, sin `@IP`) desde
los orígenes y `sp_IPMaestroResincronizar` hace lo mismo para todas dentro
de una transacción. Ninguno borra filas: si una IP desaparece de los tres
orígenes queda con las tres banderas en 0 y la vista la oculta.

**Las bajas también se escuchan.** El hueco real que provocaba el "origen
fantasma" era que sólo había triggers `AFTER INSERT, UPDATE`: al borrar un
registro de `InventarioGeneralIP` la maestra se quedaba con `EnGeneral = 1`
y un `IdInventarioIP` que ya no existía, así que la pantalla seguía
mostrando esos datos de gestión y ofrecía *Eliminar* para un registro
inexistente. Desde esta versión hay **un `AFTER DELETE` por tabla de
origen**, y todos llaman a `sp_IPMaestroRefrescar @IP = …`:

| Trigger de baja | Origen |
|-----------------|--------|
| `trg_IPMaestro_InventarioGeneralIP_Baja` | Control general IP |
| `trg_IPMaestro_Equipos_Baja` | Equipos de cliente |
| `trg_IPMaestro_EquiposControlGeneralIP_Baja` | Complemento de Equipos |
| `trg_IPMaestro_Colector_Baja` | `ActivoFijoEquiposRed` |
| `trg_IPMaestro_InventarioIPGestion_Baja` | *Editar datos* (retirar gestión) |

Refrescar en lugar de parchear es deliberado: el refresco limpia **todo lo
derivado** de la fila (incluido `GestionManual`, que se vuelve a poner sólo
si hay fila en `InventarioIPGestion`) y luego relee los orígenes. Parchear
campo por campo era lo que dejaba basura acumulada cuando un origen
desaparecía y otro seguía vivo.

> También se corrigió un copy-paste en el paso 2.4.a: escribía
> `m.Mascara = g.MAC` (la columna `Mascara` no existe en
> `InventarioGeneralIP`), así que la MAC acababa en la máscara de la maestra.
> Ahora la máscara sólo se toca cuando el origen realmente tiene una.

Consecuencia práctica: **una IP = una fila** en la base, y el colector puede
seguir reportando lo suyo sin planchar el piso, el cliente, el switch, el
puerto Fortinet ni la descripción. El contrato que debe cumplir el colector
está en `docs/colector-inventario-ip.txt` y el mapa completo de tablas del
sistema en `docs/tablas-sistema.txt`.

### 5.4 Los dos pisos: `IdPiso` e `IdPisoPlano` (excluyentes)

En la base conviven **dos catálogos de piso distintos** y no son
intercambiables:

| Columna | Catálogo | Quién la llena |
|---------|----------|----------------|
| `IdPiso` | `dbo.CatalogosInventarioIP` (`Tipo = 'Piso'`) | Control general IP (alta manual) y *Editar datos* |
| `IdPisoPlano` | `dbo.Pisos` | el plano / `dbo.Equipos.IdPiso`, heredado al fusionar la fila |

Ésa era la incoherencia: un renglón de cliente/colector **mostraba**
"PISO 2" (id de `dbo.Pisos`) pero el desplegable de piso se quedaba vacío,
porque el id no existe en el otro catálogo.

Reglas que aplican por igual el `sp_IPMaestroResincronizar` (pasos 2.3.b,
2.5 y red de seguridad 2.7) y los triggers `trg_IPMaestro_Equipos` /
`trg_IPMaestro_InventarioGeneralIP`:

1. `dbo.Equipos.IdPiso` **sólo** se escribe en `IdPisoPlano`.
2. `dbo.InventarioGeneralIP.IdPiso` **sólo** se escribe en `IdPiso`.
3. Son **excluyentes**: escribir una limpia la otra. Ninguna fila puede
   quedar con las dos (`ConflictoPiso = 0` en
   `scripts/_probe-salud-ip.sql`).
4. Con `GestionManual = 1` no se toca ninguna de las dos: manda lo que
   eligió la persona en *Editar datos*.

En la pantalla, el botón *Editar datos* ofrece **un desplegable por
catálogo** ("Piso (control general)" y "Piso (plano / Equipos)"), se
preselecciona cada uno con su propio id y al elegir uno se limpia el otro.
La lista del plano se lee con `window.api.mantenimientos.listarPisos()`
(API que ya existía; no se agregó ninguna nueva).

Además, cada fila pinta **un solo juego de acciones, sólo con iconos**:
`data-tooltip` + `aria-label`, y el texto en un tooltip flotante
`position: fixed` (clase `.tooltip-accion-ip`, mismo patrón que
`equipos-renderer.js`) para que no lo recorte el `overflow: auto` de
`.table-wrap`. Antes se dibujaba el botón de gestión **y** el del origen, y
aparecían dos "Editar datos" que abrían lo mismo.

Si se re-ejecuta `scripts/inventario-ip-maestro.sql` en una base que ya
tenía filas con los dos pisos llenos, el paso 2.7 las normaliza (deja
`IdPiso` y limpia `IdPisoPlano`).

### 5.5 La propiedad de la IP ya se impone al dar de alta

La maestra decía **quién** tenía cada IP, pero nadie lo **impedía**: se podía
dar de alta una dirección que ya vivía en otro módulo, y las 72 IP
compartidas de hoy son en buena parte el resultado de ese descuido. Ahora el
alta consulta la maestra **antes del `INSERT`**:

| Función | Dónde | Para qué |
|---------|-------|----------|
| `duenioDeIP(ip, { idInventario, idEquipo })` | `src/js/db/inventario-ip.js` | Devuelve quién manda sobre la dirección (`hostname`, cliente, origen) o `null` si está libre. La usan el alta manual y `guardarGestionActivo()`. |
| `evaluarDuenio(fila, direccion, excluir)` | idem (interna) | La regla pura, sin BD: normaliza la fila de `vw_InventarioIPMaestro` y decide si bloquea. |
| `mapaDueniosDeIP()` | idem | Igual, pero **una sola consulta** para todo un lote; la usa la importación masiva. Devuelve `null` si la maestra no existe. |
| `conflictoEnMaestra(ip, idEquipo)` | `src/js/db/equipos.js` | Envuelve `duenioDeIP()` y la llama `crear()` y `actualizar()` después de `verificarIPDuplicada()`, devolviendo la misma forma `{ tipo: 'ip-duplicada', choque }` que el renderer ya sabía pintar (no hubo que tocar `equipos-renderer.js`). |

Mensaje de rechazo (idéntico en las tres puertas):

```
La IP 192.168.5.86 ya está asignada al equipo AGT-DIDI86 del cliente DIDI.
```

Tres excepciones deliberadas, para no romper flujos que ya funcionaban:

1. Un alta general **«vacía»** (sólo IP y Estado, sin hostname ni gestión) no
   ocupa la dirección: se sigue usando para reservar una IP libre.
2. Una fila en Estado **Inactivo** no bloquea.
3. Al **editar** se excluye el propio registro (`idInventario` / `idEquipo`).

Si la IP la reporta el **colector**, el alta manual no se rechaza: se guarda
con un aviso en el mensaje de éxito (*«se verá como un solo renglón»*),
porque la red del colector no es un alta de la app y fusionar es lo correcto
(§5.2). Si `vw_InventarioIPMaestro` no existe (base sin migrar),
`duenioDeIP()` devuelve `null` y el alta sigue con el respaldo SQL anterior:
nada se rompe.

En la importación masiva, `insertarImportados()` compara cada fila contra el
mapa y, cuando choca, la agrega a la lista de errores con el mismo texto en
vez de insertarla; el reporte de importación conserva su forma.

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
4-bis. `scripts/control-general-ip.sql` — crea/actualiza
   `dbo.InventarioIPGestion`. **Necesario para editar las filas del colector**:
   sin él esas filas muestran «Colector» y ningún botón. Si la tabla ya existía
   de una versión anterior, el script agrega `IdDispositivo` e `IdTipoEquipo`
   (columnas de la clasificación que el colector no puede mandar).
4-ter. `scripts/inventario-ip-maestro.sql` — crea `dbo.InventarioIPMaestro`
   (una fila por IP), sus 5 triggers, `vw_InventarioIPMaestro` y
   `sp_IPMaestroResincronizar`, y hace la carga inicial. **No toca los datos
   originales**: es un espejo. Sin él, la pantalla sigue funcionando con la
   fusión en memoria de §5.2 y con `vw_InventarioIPUnificado`.
   El orden importa: `control-general-ip.sql` crea `InventarioIPGestion.IdPisoPlano`
   (y su FK a `dbo.Pisos`) y este script la lee, así que **4-bis va antes que
   4-ter**. Además 4-ter normaliza los pisos históricos (§5.4, paso 2.7), por eso
   hay que re-ejecutarlo después de actualizar: es idempotente.
5. Actualizar el colector con el prompt de `docs/colector-diademas.md` y el
   contrato de red de `docs/colector-inventario-ip.txt` (tablas que puede
   escribir, upsert, `Vigente = 0` y formato de MAC).
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
