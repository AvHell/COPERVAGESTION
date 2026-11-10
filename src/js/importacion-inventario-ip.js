/* =========================================================
   IMPORTACIÓN INTELIGENTE DEL CONTROL GENERAL DE IP
   ---------------------------------------------------------
   Lee un archivo Excel/CSV (una o varias hojas), reconoce las columnas
   por su ENCABEZADO (sin importar el orden, los acentos ni el idioma),
   valida IP y MAC con las mismas reglas que el alta manual, detecta
   duplicados e incoherencias y devuelve un resumen revisable ANTES de
   escribir en la base de datos.

   Flujo:
     1) seleccionarYAnalizar()  -> lee, mapea y valida (no escribe nada)
     2) aplicarImportacion()    -> crea catálogos faltantes (opcional)
                                   e inserta las filas válidas.

   El renderer sólo muestra el resumen y confirma (ver
   src/js/inventario-ip-renderer.js).
   ========================================================= */

const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');

const { dialog } = require('electron');

const inventarioIPDB = require('./db/inventario-ip');
const clientesDB = require('./db/clientes');
const rangosDB = require('./db/rangos');

/* Límites de la tabla dbo.InventarioGeneralIP (ver scripts/control-general-ip.sql). */
const LIMITES = Object.freeze({
    hostname: 255,
    descripcion: 500,
    puertoFortinet: 100,
    mac: 17,
    ip: 45
});

/* Cantidad máxima de ejemplos de error que se devuelven al renderer. */
const MAX_EJEMPLOS = 30;

/* =========================================================
   CAMPOS DESTINO Y SUS ALIAS
   Orden importante: en el modo "contiene" se revisan del alias más
   largo al más corto para que "tipo de ip" no caiga en "tipo".
   ========================================================= */

const ETIQUETAS = Object.freeze({
    ip: 'IP',
    estado: 'Estado',
    hostname: 'Hostname',
    mac: 'MAC',
    descripcion: 'Descripción',
    dispositivo: 'Dispositivo',
    tipoEquipo: 'Tipo',
    cliente: 'Cliente',
    piso: 'Piso',
    site: 'Switch',
    puertoFortinet: 'Puerto',
    tipoIP: 'Tipo de IP'
});

const ALIAS = Object.freeze({
    ip: [
        'ip', 'direccion ip', 'direccionip', 'ip address', 'ipaddress', 'ipv4',
        'numero ip', 'no ip', 'numero de ip', 'ip equipo', 'ip del equipo',
        'direccion', 'direccion del equipo'
    ],
    estado: [
        'estado', 'estado ip', 'estado de la ip', 'estatus', 'status',
        'estado del equipo', 'estado equipo', 'estatus ip'
    ],
    hostname: [
        'hostname', 'host name', 'host', 'nombre host', 'nombre de host',
        'nombre equipo', 'nombre del equipo', 'nombre de equipo',
        'nombre dispositivo', 'nombre del dispositivo', 'device name',
        'nombre de la maquina', 'nombre maquina', 'hostname equipo'
    ],
    mac: [
        'mac', 'mac address', 'macaddress', 'direccion mac', 'direccionmac',
        'mac add', 'direccion fisica', 'physical address', 'mac del equipo'
    ],
    descripcion: [
        'descripcion', 'description', 'descripcion del equipo',
        'descripcion equipo', 'detalle', 'observaciones', 'observacion',
        'comentarios', 'notas', 'uso del equipo'
    ],
    dispositivo: [
        'dispositivo', 'device', 'tipo de dispositivo', 'tipo dispositivo',
        'dispositivo tipo', 'categoria dispositivo'
    ],
    tipoEquipo: [
        'tipo', 'tipo equipo', 'tipo de equipo', 'tipo de activo', 'tipo activo',
        'type', 'categoria'
    ],
    cliente: [
        'cliente', 'client', 'nombre cliente', 'cliente nombre', 'nombre del cliente',
        'codigo cliente', 'cliente codigo', 'empresa',
        'razon social', 'cliente empresa'
    ],
    piso: [
        'piso', 'floor', 'planta', 'nivel', 'nombre piso', 'piso nombre',
        'ubicacion piso'
    ],
    site: [
        'switch', 'switches', 'switch nombre', 'nombre switch', 'nombre del switch',
        'switch de red', 'switchred', 'switch red', 'nodo', 'nodo de red'
    ],
    puertoFortinet: [
        'puerto fortinet', 'puerto del fortinet', 'puerto', 'puerto de red',
        'puerto switch', 'puerto del switch', 'puerto sw', 'port', 'interfaz',
        'interface', 'puerto de acceso'
    ],
    tipoIP: [
        'tipo ip', 'tipo de ip', 'tipo de la ip', 'tipo asignacion',
        'tipo de asignacion', 'asignacion ip', 'asignacion de ip',
        'tipo de direccion', 'dhcp estatica', 'dhcp estatico'
    ]
});

/* Valores de "Estado" que en realidad describen OCUPACIÓN (los que
   exporta esta misma pantalla) y no una opción del catálogo Estado. */
const ESTADOS_OCUPACION = Object.freeze({
    libre: 'libre',
    disponibles: 'libre',
    disponible: 'libre',
    free: 'libre',
    ocupado: 'ocupado',
    ocupada: 'ocupado',
    'en uso': 'ocupado',
    reservado: 'ocupado',
    reservada: 'ocupado',
    'sin ip': 'ocupado'
});

/* Columnas que exporta esta misma pantalla y que NO son datos del registro.
   Se ignoran en silencio para que un export reimportado no avise de
   "columnas no reconocidas" ni se confunda "Reserva de cliente" con Cliente. */
const COLUMNAS_IGNORADAS = new Set([
    'origen', 'reserva', 'reserva de cliente', 'reserva cliente',
    'segmento', 'libre', 'ocupacion', 'tipo de ocupacion'
]);

/* =========================================================
   UTILIDADES DE TEXTO Y COLUMNAS
   ========================================================= */

/** minúsculas, sin acentos y sin signos: "Dirección MAC" -> "direccion mac" */
function normalizarTexto(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function texto(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
        .replace(/\s+/g, ' ')
        .trim();
}

/* Índice alias -> campo y lista ordenada por longitud para el modo "contiene". */
const ALIAS_EXACTO = new Map();
const ALIAS_CONTENER = [];
for (const [campo, alias] of Object.entries(ALIAS)) {
    for (const nombre of alias) {
        const limpio = normalizarTexto(nombre);
        if (!limpio) continue;
        if (!ALIAS_EXACTO.has(limpio)) ALIAS_EXACTO.set(limpio, campo);
        ALIAS_CONTENER.push({ alias: limpio, campo });
    }
}
/* Sin duplicados y del alias más largo al más corto. */
const ALIAS_CONTENER_UNICO = [];
{
    const vistos = new Set();
    ALIAS_CONTENER
        .slice()
        .sort((a, b) => b.alias.length - a.alias.length)
        .forEach(item => {
            if (vistos.has(item.alias)) return;
            vistos.add(item.alias);
            ALIAS_CONTENER_UNICO.push(item);
        });
}

/**
 * Interpreta el valor de la columna Estado: puede ser una opción del catálogo
 * ("Activo") o el estado de ocupación que escribe esta pantalla al exportar
 * ("Libre", "Ocupado", "Ocupada (reservada)").
 * @returns {'libre'|'ocupado'|null}
 */
function ocupacionDe(valorEstado) {
    const limpio = normalizarTexto(valorEstado);
    if (!limpio) return null;
    if (ESTADOS_OCUPACION[limpio]) return ESTADOS_OCUPACION[limpio];
    /* "Ocupada (reservada)" o "Ocupado - en uso": manda la primera palabra. */
    const primera = limpio.split(' ')[0];
    return ESTADOS_OCUPACION[primera] || null;
}

/** Devuelve el campo destino de un encabezado, o null si no se reconoce. */
function campoDeEncabezado(celda) {
    const limpio = normalizarTexto(celda);
    if (!limpio) return null;
    if (ALIAS_EXACTO.has(limpio)) return ALIAS_EXACTO.get(limpio);
    /* Coincidencia parcial: "IP Address (última)" o "Mac del equipo - área".
       Los alias de 1-3 letras sólo valen exactos para no confundir "sw". */
    for (const item of ALIAS_CONTENER_UNICO) {
        if (item.alias.length < 4) continue;
        if (limpio.includes(item.alias)) return item.campo;
    }
    return null;
}

/**
 * Busca la fila de encabezados de una hoja.
 * Gana la primera fila que reconozca más columnas (y que tenga al menos
 * IP, MAC o Hostname, o bien tres campos reconocidos).
 */
function detectarEncabezado(filas) {
    let mejor = null;
    for (let indice = 0; indice < Math.min(filas.length, 20); indice += 1) {
        const fila = Array.isArray(filas[indice]) ? filas[indice] : [];
        const mapa = {};
        const desconocidas = [];
        fila.forEach((celda, posicion) => {
            const limpio = texto(celda);
            /* Columnas propias del export (Origen, Reserva de cliente...):
               no son datos del registro ni deben avisarse como desconocidas. */
            if (limpio && COLUMNAS_IGNORADAS.has(normalizarTexto(limpio))) return;
            const campo = campoDeEncabezado(celda);
            if (campo) {
                if (mapa[campo] === undefined) mapa[campo] = posicion;
                return;
            }
            if (limpio) desconocidas.push(limpio);
        });
        const columnas = Object.keys(mapa);
        if (!columnas.length) continue;
        const tieneClave = mapa.ip !== undefined || mapa.mac !== undefined || mapa.hostname !== undefined;
        if (!tieneClave && columnas.length < 3) continue;
        if (!mejor || columnas.length > Object.keys(mejor.mapa).length) {
            mejor = { indice, mapa, desconocidas };
        }
    }
    return mejor;
}

/* =========================================================
   IP Y RANGOS DE CLIENTE
   ========================================================= */

function ipAEntero(ip) {
    const partes = String(ip || '').trim().split('.');
    if (partes.length !== 4) return null;
    if (!partes.every(parte => /^\d{1,3}$/.test(parte) && Number(parte) <= 255)) return null;
    return partes.reduce((total, parte) => total * 256 + Number(parte), 0);
}

function buscarRangoCliente(rangos, ip) {
    const valor = ipAEntero(ip);
    if (valor === null || !rangos.length) return null;
    return rangos.find(rango => {
        const inicio = ipAEntero(rango.IPInicio);
        const fin = ipAEntero(rango.IPFin);
        if (inicio === null || fin === null) return false;
        return valor >= inicio && valor <= fin;
    }) || null;
}

/* =========================================================
   CATÁLOGOS
   Los nombres del archivo se comparan sin acentos ni mayúsculas contra
   las opciones activas del ámbito General (las compartidas + las suyas).
   ========================================================= */

const TIPOS_CATALOGO = Object.freeze({
    estado: 'Estado',
    dispositivo: 'Dispositivo',
    tipoEquipo: 'TipoEquipo',
    piso: 'Piso',
    site: 'Site',
    tipoIP: 'TipoIP'
});

/** Valores por defecto cuando el archivo no trae la columna. */
const DEFAULTS = Object.freeze({
    estado: 'Activo',
    dispositivo: 'Sin asignar',
    tipoEquipo: 'Sin asignar',
    piso: 'Sin asignar',
    site: 'Sin asignar'
});

function construirIndiceCatalogos(lista) {
    const indice = new Map();
    for (const tipo of Object.values(TIPOS_CATALOGO)) indice.set(tipo, new Map());
    for (const item of Array.isArray(lista) ? lista : []) {
        const tipo = String(item?.TipoCatalogo || '').trim();
        if (!indice.has(tipo)) continue;
        if (item.Activo !== undefined && item.Activo !== null && !Number(item.Activo)) continue;
        const nombre = normalizarTexto(item.Nombre);
        if (!nombre) continue;
        if (!indice.get(tipo).has(nombre)) indice.get(tipo).set(nombre, Number(item.IdCatalogoIP));
    }
    return indice;
}

function idDeCatalogo(indice, tipo, nombre) {
    const mapa = indice.get(tipo);
    if (!mapa) return null;
    return mapa.get(normalizarTexto(nombre)) || null;
}

/* =========================================================
   LECTURA DEL ARCHIVO
   ========================================================= */

async function seleccionarArchivo(ventana) {
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const opciones = {
        title: 'Importar control de IP desde Excel',
        buttonLabel: 'Analizar archivo',
        defaultPath: fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(),
        properties: ['openFile'],
        filters: [
            { name: 'Hojas de cálculo', extensions: ['xlsx', 'xlsm', 'xls', 'csv'] },
            { name: 'Todos los archivos', extensions: ['*'] }
        ]
    };
    const resultado = ventana && !ventana.isDestroyed?.()
        ? await dialog.showOpenDialog(ventana, opciones)
        : await dialog.showOpenDialog(opciones);
    if (!resultado || resultado.canceled || !resultado.filePaths?.length) return null;
    return resultado.filePaths[0];
}

function leerHojas(rutaArchivo) {
    const libro = XLSX.readFile(rutaArchivo, { cellDates: false, cellNF: false, cellStyles: false });
    return (libro.SheetNames || []).map(nombre => {
        const hoja = libro.Sheets[nombre];
        const filas = hoja
            ? XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '', blankrows: false })
            : [];
        return { nombre: String(nombre), filas: Array.isArray(filas) ? filas : [] };
    });
}

/* =========================================================
   ANÁLISIS
   ========================================================= */

async function analizarArchivo(rutaArchivo) {
    const hojasLeidas = leerHojas(rutaArchivo);
    if (!hojasLeidas.length) {
        return { ok: false, mensaje: 'El archivo no tiene hojas legibles.' };
    }

    const [catalogos, ipOcupadasLista, clientes, rangos, macsRegistradas] = await Promise.all([
        inventarioIPDB.listarCatalogos('General'),
        inventarioIPDB.listarIPsOcupadas(),
        clientesDB.listar().catch(() => []),
        rangosDB.listar().catch(() => []),
        inventarioIPDB.listarMACsRegistradas().catch(() => [])
    ]);
    if (!Array.isArray(catalogos)) {
        return { ok: false, mensaje: 'No se pudieron leer los catálogos del control de IP.' };
    }

    const indiceCatalogos = construirIndiceCatalogos(catalogos);
    const ocupadas = new Set((ipOcupadasLista || []).map(ip => String(ip).trim()));
    /* MACs ya registradas en el sistema, normalizadas para poder comparar
       cualquier formato con el que se hayan capturado. */
    const macsSistema = new Set(
        (Array.isArray(macsRegistradas) ? macsRegistradas : [])
            .map(mac => inventarioIPDB.normalizarMAC(mac))
            .filter(Boolean)
    );
    const clientesPorNombre = new Map();
    for (const cliente of Array.isArray(clientes) ? clientes : []) {
        clientesPorNombre.set(normalizarTexto(cliente.Codigo), cliente);
        clientesPorNombre.set(normalizarTexto(cliente.Nombre), cliente);
    }

    const registros = [];
    const hojas = [];
    const ejemplosErrores = [];
    const faltantes = new Map();      // `${tipo}|${nombre}` -> { tipo, valor, filas }
    const avisos = [];
    const ipsEnArchivo = new Map();   // ip -> fila
    const macsEnArchivo = new Map();  // mac -> fila
    const macsEnSistema = new Set();  // mac ya registrada en la base
    const ipsReservadas = new Map();  // ip -> cliente
    const clientesDesconocidos = new Set();
    let total = 0;
    let conErrores = 0;
    let requierenCatalogo = 0;
    let duplicados = 0;
    let omitidas = 0;
    let omitidasLibres = 0;
    let omitidasReservadas = 0;
    let sinMAC = 0;

    const registrarFaltante = (tipo, valor) => {
        const clave = `${tipo}|${normalizarTexto(valor)}`;
        if (!faltantes.has(clave)) faltantes.set(clave, { tipo, valor: texto(valor), filas: 0 });
        faltantes.get(clave).filas += 1;
    };

    for (const hoja of hojasLeidas) {
        const encabezado = detectarEncabezado(hoja.filas);
        if (!encabezado) {
            hojas.push({
                hoja: hoja.nombre,
                filas: 0,
                columnas: [],
                omitida: true,
                motivo: 'no se encontraron encabezados de IP, MAC o Hostname'
            });
            continue;
        }

        const datos = hoja.filas.slice(encabezado.indice + 1);
        let filasUsadas = 0;
        hojas.push({
            hoja: hoja.nombre,
            filas: 0,
            columnas: Object.keys(encabezado.mapa).map(campo => ETIQUETAS[campo] || campo),
            omitida: false,
            motivo: '',
            columnasNoReconocidas: encabezado.desconocidas.slice(0, 8)
        });
        const infoHoja = hojas[hojas.length - 1];
        if (encabezado.desconocidas.length) {
            avisos.push(`Hoja "${hoja.nombre}": columnas ignoradas por no reconocerse → ${encabezado.desconocidas.slice(0, 8).join(', ')}.`);
        }

        datos.forEach((fila, posicion) => {
            const numeroFila = encabezado.indice + posicion + 2; // fila real en Excel
            const valores = {};
            for (const [campo, indiceColumna] of Object.entries(encabezado.mapa)) {
                valores[campo] = texto(Array.isArray(fila) ? fila[indiceColumna] : '');
            }
            const llenos = Object.values(valores).filter(valor => valor !== '');
            if (!llenos.length) return; // fila vacía: no cuenta

            filasUsadas += 1;
            total += 1;
            const referencia = `${hoja.nombre} fila ${numeroFila}`;
            let hayError = false;
            /* Una fila con cualquier problema no se importa: se cuenta y se
               muestra como ejemplo para que el usuario corrija el origen. */
            const fallo = motivo => {
                conErrores += 1;
                hayError = true;
                if (ejemplosErrores.length < MAX_EJEMPLOS) ejemplosErrores.push(`${referencia}: ${motivo}`);
            };

            /* ---- Estado: puede venir como ocupación (export de la propia
                    pantalla) y entonces no es una opción del catálogo. ---- */
            const estadoCrudo = texto(valores.estado);
            const ocupacion = estadoCrudo ? ocupacionDe(estadoCrudo) : null;
            const otrosDatos = [valores.hostname, valores.mac, valores.descripcion,
                valores.dispositivo, valores.tipoEquipo].some(valor => valor !== '');
            if (ocupacion && !otrosDatos) {
                /* Fila sintética del propio export: el segmento completo se
                   exporta con TODAS las IP (libres y reservadas) y esas filas
                   sólo traen IP + Estado. No son registros: si se importaran
                   llenarían el control general de altas vacías. */
                if (ocupacion === 'libre') omitidasLibres += 1;
                else omitidasReservadas += 1;
                omitidas += 1;
                total -= 1;
                filasUsadas -= 1;
                return;
            }
            const estado = ocupacion ? DEFAULTS.estado : (estadoCrudo || DEFAULTS.estado);

            /* ---- IP ---- */
            let ip = texto(valores.ip);
            let ipValida = true;
            if (ip) {
                if (!inventarioIPDB.validarIPv4(ip)) {
                    ipValida = false;
                    fallo(`IP inválida "${ip}" (formato esperado 192.168.0.10)`);
                } else {
                    ip = inventarioIPDB.normalizarIPv4(ip);
                }
            }

            /* ---- MAC ---- */
            const mac = inventarioIPDB.normalizarMAC(valores.mac);
            if (mac === null) {
                fallo(`MAC inválida "${texto(valores.mac)}" (se esperan 12 dígitos hexadecimales)`);
            }

            /* ---- Tipo de IP (estática por defecto si hay IP) ---- */
            const tipoIPCrudo = texto(valores.tipoIP);
            let tipoIPNombre = tipoIPCrudo;
            if (!tipoIPNombre) {
                tipoIPNombre = ip ? 'Estatica' : 'DHCP';
            } else if (['dhcp', 'dinamica', 'dinamico', 'automatica'].includes(normalizarTexto(tipoIPCrudo))) {
                tipoIPNombre = 'DHCP';
            } else if (['estatica', 'estatico', 'fija', 'static'].includes(normalizarTexto(tipoIPCrudo))) {
                tipoIPNombre = 'Estatica';
            }
            /* Misma regla que el alta manual: una IP estática/dinámica necesita IP. */
            if (!ip && normalizarTexto(tipoIPNombre) !== 'dhcp') {
                fallo(`sin IP pero el tipo de asignación es "${tipoIPNombre}" (captura la IP o usa DHCP)`);
            }

            /* ---- Descripción + referencia del cliente ---- */
            const cliente = texto(valores.cliente);
            let descripcion = texto(valores.descripcion);
            if (cliente) {
                if (!clientesPorNombre.has(normalizarTexto(cliente))) clientesDesconocidos.add(cliente);
                if (!descripcion.toLowerCase().includes(cliente.toLowerCase())) {
                    descripcion = descripcion ? `${descripcion} · Cliente: ${cliente}` : `Cliente: ${cliente}`;
                }
            }
            if (descripcion.length > LIMITES.descripcion) {
                fallo(`descripción demasiado larga (${descripcion.length}/${LIMITES.descripcion})`);
            }
            const hostname = texto(valores.hostname);
            if (hostname.length > LIMITES.hostname) {
                fallo(`hostname demasiado largo (${hostname.length}/${LIMITES.hostname})`);
            }
            const puertoFortinet = texto(valores.puertoFortinet);
            if (puertoFortinet.length > LIMITES.puertoFortinet) {
                fallo(`puerto demasiado largo (${puertoFortinet.length}/${LIMITES.puertoFortinet})`);
            }

            /* ---- Duplicados ---- */
            if (ip) {
                if (ipsEnArchivo.has(ip)) {
                    duplicados += 1;
                    fallo(`IP duplicada en el archivo (ya aparece en ${ipsEnArchivo.get(ip)})`);
                } else if (ocupadas.has(ip)) {
                    duplicados += 1;
                    fallo(`la IP ya existe en el control general o en un equipo estático`);
                } else {
                    ipsEnArchivo.set(ip, referencia);
                    const rango = buscarRangoCliente(rangos, ip);
                    if (rango) ipsReservadas.set(ip, rango.ClienteCodigo || rango.ClienteNombre || 'cliente');
                }
            }
            if (mac) {
                if (macsEnArchivo.has(mac)) {
                    avisos.push(`MAC ${mac} repetida: ${referencia} y ${macsEnArchivo.get(mac)}.`);
                } else {
                    macsEnArchivo.set(mac, referencia);
                }
                if (macsSistema.has(mac)) macsEnSistema.add(mac);
            }

            if (!ipValida || mac === null || hayError) return;

            /* La MAC es opcional, pero si el archivo trae la columna y viene
               vacía conviene avisarlo: en la migración suele ser un dato real
               que se perdió al copiar. */
            if (!mac && encabezado.mapa.mac !== undefined) sinMAC += 1;

            /* ---- Catálogos ---- */
            const nombres = {
                estado,
                dispositivo: texto(valores.dispositivo) || DEFAULTS.dispositivo,
                tipoEquipo: texto(valores.tipoEquipo) || DEFAULTS.tipoEquipo,
                piso: texto(valores.piso) || DEFAULTS.piso,
                site: texto(valores.site) || DEFAULTS.site,
                tipoIP: tipoIPNombre
            };
            let faltaCatalogo = false;
            for (const [campo, nombre] of Object.entries(nombres)) {
                const tipo = TIPOS_CATALOGO[campo];
                if (idDeCatalogo(indiceCatalogos, tipo, nombre)) continue;
                faltaCatalogo = true;
                registrarFaltante(tipo, nombre);
            }
            if (faltaCatalogo) requierenCatalogo += 1;

            registros.push({
                hoja: hoja.nombre,
                fila: numeroFila,
                ip: ip ? ip : '',
                hostname,
                mac: mac || '',
                descripcion,
                puertoFortinet,
                estado: nombres.estado,
                dispositivo: nombres.dispositivo,
                tipoEquipo: nombres.tipoEquipo,
                piso: nombres.piso,
                site: nombres.site,
                tipoIP: nombres.tipoIP
            });
        });

        infoHoja.filas = filasUsadas;
    }

    if (!registros.length && !conErrores) {
        return {
            ok: false,
            mensaje: omitidas
                ? `No se encontraron registros importables: ${omitidas} fila(s) eran IP libres o reservadas del export (sin Hostname, MAC ni Descripción).`
                : 'No se encontraron filas con datos reconocibles en el archivo.'
        };
    }

    if (omitidasLibres) {
        avisos.push(`${omitidasLibres} fila(s) omitidas por ser IP libres (no son registros del control general).`);
    }
    if (omitidasReservadas) {
        avisos.push(`${omitidasReservadas} fila(s) omitidas por venir del export como IP reservada sin datos (sólo IP + Estado).`);
    }
    if (ipsReservadas.size) {
        const muestra = Array.from(ipsReservadas.entries()).slice(0, 5)
            .map(([ip, cliente]) => `${ip} (${cliente})`).join(', ');
        avisos.push(`${ipsReservadas.size} IP ${ipsReservadas.size === 1 ? 'cae' : 'caen'} en rangos reservados por clientes: ${muestra}${ipsReservadas.size > 5 ? '…' : ''}. Se importan como registro general.`);
    }
    if (clientesDesconocidos.size) {
        avisos.push(`Clientes no encontrados en el catálogo (se guardan en la descripción): ${Array.from(clientesDesconocidos).slice(0, 8).join(', ')}.`);
    }
    if (sinMAC) {
        avisos.push(`${sinMAC} fila(s) con la columna MAC vacía (se importan sin MAC).`);
    }
    if (macsEnSistema.size) {
        const muestra = Array.from(macsEnSistema).slice(0, 5).join(', ');
        avisos.push(`${macsEnSistema.size} MAC ${macsEnSistema.size === 1 ? 'ya existe' : 'ya existen'} en el sistema con otro registro: ${muestra}${macsEnSistema.size > 5 ? '…' : ''}. Revisa si son altas duplicadas.`);
    }

    return {
        ok: true,
        archivo: rutaArchivo,
        hojas,
        resumen: {
            total,
            listos: registros.length,
            conErrores,
            requierenCatalogo,
            duplicados,
            omitidas,
            faltantesCatalogo: Array.from(faltantes.values()).sort((a, b) => b.filas - a.filas),
            ejemplosErrores,
            avisos
        },
        registros
    };
}

/** Abre el diálogo, lee y analiza. Devuelve el resumen para revisión. */
async function seleccionarYAnalizar(ventana) {
    try {
        const rutaArchivo = await seleccionarArchivo(ventana);
        if (!rutaArchivo) return { ok: false, cancelado: true };
        const resultado = await analizarArchivo(rutaArchivo);
        return { ...resultado, nombreArchivo: path.basename(rutaArchivo) };
    } catch (error) {
        console.error('[InventarioIP] Error analizando el archivo:', error);
        return { ok: false, mensaje: `No se pudo leer el archivo: ${error.message}` };
    }
}

/* =========================================================
   APLICACIÓN
   ========================================================= */

async function aplicarImportacion(registros, opciones = {}) {
    if (!Array.isArray(registros) || !registros.length) {
        return { ok: false, mensaje: 'No hay registros válidos para importar.' };
    }
    try {
        const crearCatalogos = Boolean(opciones?.crearCatalogos);
        let indice = construirIndiceCatalogos(await inventarioIPDB.listarCatalogos('General'));
        const catalogosCreados = [];

        /* 1) Catálogos que faltan (sólo si el usuario lo pidió). */
        if (crearCatalogos) {
            const pendientes = new Map();
            for (const registro of registros) {
                for (const [campo, tipo] of Object.entries(TIPOS_CATALOGO)) {
                    const nombre = texto(registro?.[campo]);
                    if (!nombre) continue;
                    if (idDeCatalogo(indice, tipo, nombre)) continue;
                    const clave = `${tipo}|${normalizarTexto(nombre)}`;
                    if (!pendientes.has(clave)) pendientes.set(clave, { tipo, nombre });
                }
            }
            for (const { tipo, nombre } of pendientes.values()) {
                const resultado = await inventarioIPDB.guardarCatalogo(tipo, nombre, null, 'General');
                if (resultado?.ok) catalogosCreados.push(`${tipo}: ${nombre}`);
            }
            if (catalogosCreados.length) {
                indice = construirIndiceCatalogos(await inventarioIPDB.listarCatalogos('General'));
            }
        }

        /* 2) Resolver cada fila a ids y separar las que no se pueden guardar. */
        const filas = [];
        const errores = [];
        for (const registro of registros) {
            const referencia = `${registro?.hoja || 'hoja'} fila ${registro?.fila || '?'}`;
            const ids = {};
            const faltan = [];
            for (const [campo, tipo] of Object.entries(TIPOS_CATALOGO)) {
                const nombre = texto(registro?.[campo]);
                const id = nombre ? idDeCatalogo(indice, tipo, nombre) : null;
                ids[`id${campo[0].toUpperCase()}${campo.slice(1)}`] = id;
                if (!id) faltan.push(`${tipo} "${nombre || 'sin valor'}"`);
            }
            if (faltan.length) {
                errores.push(`${referencia}: falta catálogo ${faltan.join(', ')}.`);
                continue;
            }
            filas.push({
                ip: registro.ip,
                hostname: registro.hostname,
                mac: registro.mac,
                descripcion: registro.descripcion,
                puertoFortinet: registro.puertoFortinet,
                ...ids
            });
        }

        /* 3) Insertar (la capa de base valida IP/MAC y reporta por fila). */
        const insercion = filas.length
            ? await inventarioIPDB.insertarImportados(filas)
            : { insertados: 0, errores: [] };
        const erroresInsercion = Array.isArray(insercion.errores) ? insercion.errores : [];

        const resumen = {
            insertados: insercion.insertados || 0,
            omitidos: errores.length + erroresInsercion.length,
            catalogosCreados: catalogosCreados.length,
            errores: [...errores, ...erroresInsercion]
        };
        if (!resumen.insertados && resumen.omitidos) {
            return {
                ...resumen,
                ok: false,
                mensaje: 'No se insertó ningún registro. Revisa los catálogos faltantes o los duplicados.'
            };
        }
        return { ok: true, ...resumen };
    } catch (error) {
        console.error('[InventarioIP] Error aplicando la importación:', error);
        return { ok: false, mensaje: `No se pudo completar la importación: ${error.message}` };
    }
}

module.exports = {
    seleccionarYAnalizar,
    analizarArchivo,
    aplicarImportacion,
    campoDeEncabezado,
    normalizarTexto
};
