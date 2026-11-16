# Prompt para el Colector — diademas y datos nuevos

Copia y pega el bloque **Prompt** de abajo como instrucción del programa que
colecta el hardware (en adelante *el colector*) para que empiece a reportar
**diademas** (headsets con micrófono) y los **campos que hoy faltan**: la
conexión/MAC de cada pieza y la **procedencia de la IP**.

Todo lo que se pide aquí ya existe en la base (verificado contra
`copervaservicios_` el 2026-11-15):

- `dbo.ActivoFijoEquiposComponentes`: columnas `MAC`, `ConectadoA`,
  `EstadoConexion`, `Bateria`, y `CK_AFComp_Tipo` admite `'DIADEMA'`.
- `dbo.InventarioGeneralIP`: columnas `OrigenIP`, `EsConfiable` y el `CHECK`
  `CK_InventarioGeneralIP_Origen` (`Manual` | `DHCP` | `Wifi` | `Otro`).
- Catálogo `dbo.CatalogosInventarioIP` con el TipoIP `'WiFi (controlador)'`.
- Vistas de lectura `dbo.vw_InventarioIPUnificado` y
  `dbo.vw_ActivoFijoPiezasUnificadas` (el colector puede leerlas para no
  repetir JOINs).

---

## Prompt

> A partir de ahora debes reportar **diademas** y completar los campos que hoy
> llegan vacíos. No cambies lo que ya funciona (monitor, disco, teclado,
> ratón): sólo agrega.
>
> ### 1. Diademas (headset / auriculares con micrófono)
>
> Detéctalas por Bluetooth (dispositivos emparejados del adaptador), por
> receptor USB (*dongle* `VID:PID`) o por jack 3.5. Envíalas al mismo
> endpoint/tabla de piezas del Activo Fijo, `dbo.ActivoFijoEquiposComponentes`,
> con **una fila por diadema** y `TipoComponente = 'DIADEMA'`.
>
> `TipoComponente` sólo acepta:
> `'MONITOR' | 'DISCO' | 'TECLADO' | 'RATON' | 'DIADEMA' | 'OTRO'`.
> Cualquier otro valor hace fallar el `CHECK` y se pierde **todo el lote**.
>
> ### 2. Reglas de identidad y actualización (upsert, nunca duplicar)
>
> - Identifica el equipo padre por su **`NoSerie`** (serie del CPU). Si el
>   equipo aún no existe, primero crea/actualiza el equipo y luego sus piezas.
> - **No** envíes `NoSerie` ni `Hostname` dentro de la fila de la pieza. La
>   vista `vw_ActivoFijoPiezasUnificadas` los resuelve por JOIN
>   (`AF.NoSerie AS NoSerieActivo`, `EQ.Hostname AS HostnameEquipo`). La tabla
>   `ActivoFijoEquiposComponentes` **sí tiene** esas dos columnas como copia
>   desnormalizada (no hay trigger que las llene): si algún día las llenas, que
>   sean exactamente las del equipo padre. Duplicarlas a mano es el problema que
>   estamos eliminando.
> - `Clave` = identidad **estable** de la pieza. Prioriza:
>   1. MAC Bluetooth (si el sistema la expone), si no
>   2. receptor USB `VID:PID + puerto/hub`, si no
>   3. `Marca + Modelo + NombreDispositivo`.
> - Con `(IdActivoFijoEQ, Clave)` haces *upsert*: si ya existe **actualizas**
>   sus campos y `UltimaDeteccion`; si no, la insertas con
>   `PrimeraDeteccion = SYSDATETIME()`.
> - Nunca borres físicamente: marca **`Vigente = 0`** las piezas que ya no se
>   detecten en el equipo (soft-delete, igual que el resto de componentes).
> - Manda un `LoteEnvio` (`uniqueidentifier`, el mismo para todas las filas de
>   una corrida): permite rastrear qué mandó cada pasada.
>
> ### 3. Mapeo de campos de la pieza
>
> | Columna             | Valor esperado                                                        |
> |---------------------|-----------------------------------------------------------------------|
> | `TipoComponente`    | `'DIADEMA'` (o `MONITOR`/`DISCO`/`TECLADO`/`RATON`/`OTRO`)             |
> | `Clave`             | Identidad estable (ver regla de arriba)                               |
> | `Marca`             | Fabricante (ej. Logitech, Jabra, Poly)                                |
> | `Modelo`            | Modelo comercial                                                      |
> | `Serie`             | Serie si el dispositivo la reporta                                    |
> | `Identificador`     | MAC (BT), `VID:PID` del receptor, o el nombre del dispositivo         |
> | `IdentificadorTipo` | `'MAC'` \| `'VID_PID'` \| `'NOMBRE'`                                   |
> | `Confianza`         | `'alta'` (MAC/serie), `'media'` (VID:PID), `'baja'` (solo nombre)     |
> | `Cantidad`          | Normalmente `1`                                                       |
> | ★ `MAC`             | MAC Bluetooth/Dongle en formato `AA:BB:CC:DD:EE:FF` (17 caracteres) o `NULL` |
> | ★ `ConectadoA`      | `'Bluetooth'` \| `'USB-Dongle'` \| `'Jack 3.5'` \| `'USB'` (máx. **300** car.; admite detalle corto) |
> | ★ `EstadoConexion`  | `'Emparejada'` \| `'Conectada'` \| `'Desconectada'` (máx. 30 car.)     |
> | ★ `Bateria`         | Entero **0–100** (% de batería) o `NULL`. No mandes negativos/`>100`: la columna es `TINYINT` |
> | `Detalles`          | JSON crudo del colector (perfil BT, códecs, fabricante BT, etc.)      |
> | `PrimeraDeteccion`  | `SYSDATETIME()` al insertar                                           |
> | `UltimaDeteccion`   | `SYSDATETIME()` en cada pasada                                        |
> | `Vigente`           | `1` mientras se detecte; `0` cuando desaparezca                       |
>
> ### 4. Otros datos que hoy faltan (aplícalos a **todas** las piezas)
>
> - **`MAC`**: si el monitor/docking/teclado expone MAC (Ethernet de un
>   docking, por ejemplo), mándala normalizada a `AA:BB:CC:DD:EE:FF`.
>   Aceptamos cualquier separador en origen, pero la columna guarda 17
>   caracteres con `:`.
> - **`Identificador` + `IdentificadorTipo` + `Confianza`**: si hoy los dejas
>   vacíos, llénalos. Sin ellos no se puede emparejar una pieza nueva con la
>   anterior (el upsert acaba duplicando).
> - **`Detalles`**: manda siempre el JSON crudo, aunque la pieza no sea
>   diadema. Es el único lugar donde cabe lo que no tiene columna propia.
>
> ### 5. Procedencia de la IP (`dbo.InventarioGeneralIP`)
>
> No todas las IP valen lo mismo. Al reportar la IP de un equipo manda
> siempre **de dónde salió**:
>
> | Columna       | Valor                                                                 |
> |---------------|-----------------------------------------------------------------------|
> | `OrigenIP`    | `'Manual'` (estática capturada a mano) \| `'DHCP'` \| `'Wifi'` \| `'Otro'`. El `CHECK` rechaza cualquier otro texto |
> | `EsConfiable` | `1` = dirección estable y verificable · `0` = volátil (referencia, no inventario duro) |
>
> Reglas:
>
> - **TipoIP `'WiFi (controlador)'`** (ya existe en el catálogo
>   `CatalogosInventarioIP`): es IP **volátil** → `OrigenIP = 'Wifi'`,
>   `EsConfiable = 0`. Puede llegar **sin IP**: el equipo está registrado y la
>   dirección se completa cuando el controlador la asigne.
> - **TipoIP `'DHCP'` o `'Dinámica'`**: `OrigenIP = 'DHCP'`, `EsConfiable = 0`.
>   También puede entrar **sin IP** (se asigna después de la reconexión).
> - **TipoIP `'Estatica'`**: `OrigenIP = 'Manual'`, `EsConfiable = 1` y la IP es
>   **obligatoria**. Si el colector no tiene IP para un equipo estático, no
>   inventes una: omite la fila y repórtalo.
> - La app aplica la misma regla en `src/js/db/inventario-ip.js`
>   (`procedenciaPorTipoIP` / `permiteSinIP`): el TipoIP manda sobre el
>   `OrigenIP` guardado. Si mandas `OrigenIP = 'Manual'` para un equipo WiFi,
>   la vista lo seguirá mostrando como `Wifi`/volátil **y al guardar se
>   corrige solo**: `resolverProcedencia` ignora el `origenIP` explícito cuando
>   el TipoIP es volátil y escribe `Wifi`/`DHCP` con `EsConfiable = 0`. En
>   tipos estáticos sí se respeta lo que mandes (incluido `'Otro'`).
>
> ### 6. Lo que **no** debes hacer
>
> - No cambies el esquema ni ejecutes `ALTER TABLE`.
> - No borres filas: usa `Vigente = 0` / `Activo = 0`.
> - No mandes un `OrigenIP` fuera de la lista (rompe el lote completo).
> - No mandes `Bateria` fuera de 0–100.
> - No dupliques serie/hostname dentro de la pieza (van por JOIN).

---

## Ejemplo de carga (una corrida)

```jsonc
{
  "loteEnvio": "9f1c2b6e-6d1a-4f3e-9d0a-0b7c5e2f8a41",
  "equipo": { "noSerie": "CZC1234ABC" },          // padre; no se repite en las piezas
  "componentes": [
    {
      "tipoComponente": "MONITOR",
      "clave": "DEL-U2723QE-8HJ2K3",
      "marca": "Dell",
      "modelo": "U2723QE",
      "serie": "8HJ2K3",
      "identificador": "8HJ2K3",
      "identificadorTipo": "NOMBRE",
      "confianza": "alta",
      "cantidad": 1,
      "detalles": { "resolucion": "3840x2160", "puerto": "DP-1" }
    },
    {
      "tipoComponente": "DIADEMA",
      "clave": "BT-A4:5E:60:11:22:33",
      "marca": "Logitech",
      "modelo": "Zone Wired",
      "serie": null,
      "identificador": "A4:5E:60:11:22:33",
      "identificadorTipo": "MAC",
      "confianza": "alta",
      "cantidad": 1,
      "MAC": "A4:5E:60:11:22:33",
      "conectadoA": "Bluetooth",
      "estadoConexion": "Emparejada",
      "bateria": 87,
      "detalles": { "perfilBT": "A2DP+HFP", "codec": "SBC" }
    }
  ],
  "red": {
    "ip": "10.20.30.41",
    "hostname": "PC-CONTABILIDAD-01",
    "mac": "00:1A:2B:3C:4D:5E",
    "tipoIP": "WiFi (controlador)",   // si es WiFi/DHCP, ip puede ser null
    "origenIP": "Wifi",
    "esConfiable": 0
  }
}
```

---

## Cómo verificar que el colector quedó bien

Consulta rápida sobre la base (sólo lectura):

```sql
-- ¿llegaron diademas?
SELECT TOP 20 TipoComponente, Marca, Modelo, MAC, ConectadoA, EstadoConexion, Bateria
FROM dbo.vw_ActivoFijoPiezasUnificadas
WHERE TipoComponente = 'DIADEMA'
ORDER BY UltimaDeteccion DESC;

-- ¿llegó la procedencia de la IP?
SELECT OrigenIP, EsConfiable, COUNT(*) AS Filas
FROM dbo.vw_InventarioIPUnificado
GROUP BY OrigenIP, EsConfiable;
```

Lo esperado: filas `Wifi`/`0` y `DHCP`/`0` (volátiles, ocultas por defecto en
la pestaña *Control general IP*) además de `Manual`/`1` (estáticas, las que se
muestran siempre).

Para una comprobación completa (esquema + reglas, sin dejar datos) ejecuta
`scripts/activo-vivo-verificar.sql`: termina en `ROLLBACK` y debe devolver
todos los `Existe = 1`, `EsConfiable = 0` para WiFi/DHCP, el `CHECK` en `OK`
y `0` filas de prueba restantes.

---

## Notas para el control general de IP

- La app oculta por defecto las IP volátiles (casilla **“Incluir volátiles
  (DHCP / WiFi)”** apagada) y avisa cuántas quedaron ocultas. Un equipo con
  `EsConfiable = 0` **no desaparece**: se puede mostrar marcándolo.
- El inventario “duro” es lo **Estático** (`Manual`/`1`). DHCP y WiFi se
  guardan como referencia para saber en qué rango/tipo de red vive el equipo.
- Ver `docs/control-general-unificado.md` para el detalle de tablas
  duplicadas, qué columna es la fuente de verdad y las vistas unificadas.

## Orden de despliegue

1. `scripts/activo-fijo-detalle.sql` (tablas puente + vistas del Detalle).
2. `scripts/activo-vivo-unificado.sql` (columnas + `CHECK` de `DIADEMA`).
3. `scripts/activo-vivo-vistas.sql` (vistas `vw_*` unificadas).
4. Desplegar el colector con este prompt.

Los tres son idempotentes y se pueden volver a ejecutar en cualquier momento.

Si el colector manda una diadema **antes** del paso 2, el `CHECK` rechaza
`TipoComponente = 'DIADEMA'` y se pierde el lote; si manda las columnas ★ sin
el paso 2, quedan simplemente en `NULL` (no falla).
