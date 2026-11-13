/* =========================================================
   ACTIVO FIJO — CRUD DE EQUIPOS (inventario físico)
   Soft delete + Exportación a Excel con estilos Poppins
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');
const ExcelJS = require('exceljs');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { dialog } = require('electron');
const catalogosDB = require('./catalogos');

/* Campos que en la tabla eran texto y ahora son FK al catálogo:
   [campo del formulario, clave de catálogo, columna FK, longitud del texto] */
const CAMPOS_CATALOGO_ESPECIFICACIONES = [
    ['Modelo',           'modelos',           'IdModelo',           150],
    ['Procesador',       'procesadores',      'IdProcesador',       150],
    ['MemoriaRAM',       'memoriasRam',       'IdMemoriaRAM',       50],
    ['Almacenamiento',   'almacenamientos',   'IdAlmacenamiento',   50],
    ['SistemaOperativo', 'sistemasOperativos', 'IdSistemaOperativo', 100],
    ['UsuarioAsignado',  'usuariosAsignados', 'IdUsuarioAsignado',  200]
];

/* Accesorios es una relación N:M: un activo lleva varios conjuntos del
   catálogo, así que vive en la tabla puente ActivoFijoEquiposAccesorios
   (ver catalogos.js). La celda de texto anterior queda sólo como respaldo
   de las filas viejas. */
const CAMPO_ACCESORIOS = 'Accesorios';

/* Columnas de texto que la fase 2 de scripts/activo-fijo-3fn.sql elimina
   en cuanto su FK las respalda. Las escrituras las piden sólo si siguen
   existiendo, así el alta y la edición funcionan antes y después de la
   limpieza. */
const TEXTOS_RESPALDO_EQUIPO = new Set([
    ...CAMPOS_CATALOGO_ESPECIFICACIONES.map(c => c[0]),
    CAMPO_ACCESORIOS
]);

async function columnasTextoEquipo() {
    return catalogosDB.columnasExistentes('ActivoFijoEquipos', [...TEXTOS_RESPALDO_EQUIPO]);
}

/* JOINs y columnas para leer las especificaciones por catálogo (3FN). La
   regla "nombre del catálogo, con el texto como respaldo mientras la columna
   siga existiendo" vive en catalogos.js, que la comparte con responsivas. */
async function prepararLecturaEspecificaciones() {
    return catalogosDB.prepararNombresCatalogo(
        'ActivoFijoEquipos',
        'af',
        catalogosDB.camposEspecificaciones3FN()
    );
}

/* =========================================================
   HELPERS
   ========================================================= */
async function getIdPorNombre(pool, tabla, pk, nombre) {
    if (!nombre) return null;
    const r = await pool.request()
        .input('Nombre', sql.NVarChar(100), String(nombre).trim().toUpperCase())
        .query(`SELECT ${pk} FROM ${tabla} WHERE UPPER(Nombre) = @Nombre AND Activo = 1`);
    return r.recordset[0]?.[pk] ?? null;
}

/* Resuelve cada campo de catálogo a su Id.
   Devuelve { ids, textos }:
     - ids:    { IdModelo: 12, ... }  sólo las claves presentes en los datos
     - textos: { Modelo: 'HP', ... }  el texto recortado
   Si el valor no existe en el catálogo se da de alta; si estaba dado
   de baja, se reactiva. Eso es lo que permite capturar un usuario
   asignado nuevo directo en el formulario del activo, sin tener que
   ir antes a Catálogos a crearlo ni a restaurarlo. */
async function resolverEspecificaciones(datos) {
    const ids = {};
    const textos = {};

    for (const [campo, clave, fk] of CAMPOS_CATALOGO_ESPECIFICACIONES) {
        if (datos[campo] === undefined) continue;

        const texto = datos[campo] === null ? '' : String(datos[campo]).trim();
        textos[campo] = texto || null;
        ids[fk] = texto ? await catalogosDB.resolverId(clave, texto) : null;
    }

    return { ids, textos };
}

/* =========================================================
   LISTAR
   ========================================================= */
async function listar(filtros = {}) {
    const pool = await getPool();
    await catalogosDB.asegurarCatalogosExtendidos();
    const request = pool.request();

    let where = '1=1';
    if (filtros.idTipo)    { where += ' AND af.IdTipo = @IdTipo';        request.input('IdTipo',    sql.Int, filtros.idTipo); }
    if (filtros.idEstado)  { where += ' AND af.IdEstado = @IdEstado';    request.input('IdEstado',  sql.Int, filtros.idEstado); }
    if (filtros.idCartera) { where += ' AND af.IdCartera = @IdCartera';  request.input('IdCartera', sql.Int, filtros.idCartera); }
    if (filtros.idSitio)   { where += ' AND af.IdSitio = @IdSitio';      request.input('IdSitio',   sql.Int, filtros.idSitio); }

    if (filtros.soloEliminados) {
        where += " AND st.Nombre = 'BAJA'";
    } else if (filtros.idEstatus) {
        where += ' AND af.IdEstatus = @IdEstatus';
        request.input('IdEstatus', sql.Int, filtros.idEstatus);
    } else {
        where += " AND st.Nombre <> 'BAJA'";
    }

    const lectura = catalogosDB.unirNombresCatalogo(
        await prepararLecturaEspecificaciones(),
        await catalogosDB.prepararAccesoriosEquipo('af')
    );

    const result = await request.query(`
        SELECT
            af.IdActivoFijoEQ,
            af.IdCartera,
            c.Nombre        AS Cartera,
            af.IdMarca,
            m.Nombre        AS Marca,
            af.IdTipo,
            t.Nombre        AS Tipo,
            t.RequiereResponsiva,
            t.RequiereIMEI,
            t.RequiereTelefono,
            t.RequiereSitio,
            t.RequiereSubtipo,
            t.RequiereClasificacion,
            t.RequiereTamanio,
            t.RequiereCapacidad,
            t.RequiereVoltaje,
            t.RequiereUsuarioAsignado,
            t.RequierePrecio,
            t.RequiereEspecificaciones,
            t.RequiereAccesorios,
            t.GrupoSubtipo,
            af.NoSerie,
            af.IMEI1,
            af.IMEI2,
            af.NoTelefono,
            af.PrecioActivo,
            af.IdEstado,
            es.Nombre       AS Estado,
            af.IdEstatus,
            st.Nombre       AS Estatus,
            af.IdLugarCliente,
            af.IdSitio,
            si.Nombre       AS Sitio,
            af.IdSubtipo,
            sub.Nombre      AS Subtipo,
            sub.Grupo       AS SubtipoGrupo,
            af.IdClasificacion,
            cla.Nombre      AS Clasificacion,
            af.IdTamanio,
            tam.Nombre      AS Tamanio,
            af.IdCapacidad,
            cap.Nombre      AS Capacidad,
            af.IdVoltaje,
            vol.Nombre      AS Voltaje,
            af.Observaciones,
            af.FechaCreacion,
            af.FechaModificacion,
            ${lectura.columnas.join(',\n            ')}
        FROM ActivoFijoEquipos af
        LEFT  JOIN ActivoFijoCarteras       c   ON c.IdCartera       = af.IdCartera
        LEFT  JOIN ActivoFijoMarcas         m   ON m.IdMarca         = af.IdMarca
        INNER JOIN ActivoFijoTipos          t   ON t.IdTipo          = af.IdTipo
        INNER JOIN ActivoFijoEstados        es  ON es.IdEstado       = af.IdEstado
        INNER JOIN ActivoFijoEstatus        st  ON st.IdEstatus      = af.IdEstatus
        LEFT  JOIN ActivoFijoSitios         si  ON si.IdSitio        = af.IdSitio
        LEFT  JOIN ActivoFijoSubtipos       sub ON sub.IdSubtipo     = af.IdSubtipo
        LEFT  JOIN ActivoFijoClasificaciones cla ON cla.IdClasificacion = af.IdClasificacion
        LEFT  JOIN ActivoFijoTamanios       tam ON tam.IdTamanio     = af.IdTamanio
        LEFT  JOIN ActivoFijoCapacidades    cap ON cap.IdCapacidad   = af.IdCapacidad
        LEFT  JOIN ActivoFijoVoltajes       vol ON vol.IdVoltaje     = af.IdVoltaje
        ${lectura.joins.join('\n        ')}
        WHERE ${where}
        ORDER BY af.IdActivoFijoEQ DESC
    `);
    return result.recordset.map(lectura.aplicar);
}

/* =========================================================
   OBTENER UNO POR ID
   ========================================================= */
async function obtener(id) {
    const pool = await getPool();
    await catalogosDB.asegurarCatalogosExtendidos();
    const lectura = catalogosDB.unirNombresCatalogo(
        await prepararLecturaEspecificaciones(),
        await catalogosDB.prepararAccesoriosEquipo('af')
    );
    const r = await pool.request()
        .input('Id', sql.Int, id)
        .query(`
            SELECT
                af.*,
                c.Nombre   AS Cartera,
                m.Nombre   AS Marca,
                t.Nombre   AS Tipo,
                es.Nombre  AS Estado,
                st.Nombre  AS Estatus,
                si.Nombre  AS Sitio,
                sub.Nombre AS Subtipo,
                sub.Grupo  AS SubtipoGrupo,
                cla.Nombre AS Clasificacion,
                tam.Nombre AS Tamanio,
                cap.Nombre AS Capacidad,
                vol.Nombre AS Voltaje,
                ${lectura.columnas.join(',\n                ')}
            FROM ActivoFijoEquipos af
            LEFT  JOIN ActivoFijoCarteras       c   ON c.IdCartera       = af.IdCartera
            LEFT  JOIN ActivoFijoMarcas         m   ON m.IdMarca         = af.IdMarca
            INNER JOIN ActivoFijoTipos          t   ON t.IdTipo          = af.IdTipo
            INNER JOIN ActivoFijoEstados        es  ON es.IdEstado       = af.IdEstado
            INNER JOIN ActivoFijoEstatus        st  ON st.IdEstatus      = af.IdEstatus
            LEFT  JOIN ActivoFijoSitios         si  ON si.IdSitio        = af.IdSitio
            LEFT  JOIN ActivoFijoSubtipos       sub ON sub.IdSubtipo     = af.IdSubtipo
            LEFT  JOIN ActivoFijoClasificaciones cla ON cla.IdClasificacion = af.IdClasificacion
            LEFT  JOIN ActivoFijoTamanios       tam ON tam.IdTamanio     = af.IdTamanio
            LEFT  JOIN ActivoFijoCapacidades    cap ON cap.IdCapacidad   = af.IdCapacidad
            LEFT  JOIN ActivoFijoVoltajes       vol ON vol.IdVoltaje     = af.IdVoltaje
            ${lectura.joins.join('\n            ')}
            WHERE af.IdActivoFijoEQ = @Id
        `);
    return lectura.aplicar(r.recordset[0] ?? null);
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(datos, idUsuario) {
    try {
        const pool = await getPool();
        await catalogosDB.asegurarCatalogosExtendidos();

        /* Resuelve (y crea/reactiva si hace falta) los catálogos de
           especificaciones y del usuario asignado. */
        const { ids: idsCatalogo, textos } = await resolverEspecificaciones(datos);

        if (datos.NoSerie) {
            const dup = await pool.request()
                .input('NoSerie', sql.NVarChar(150), datos.NoSerie)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoSerie = @NoSerie');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un activo con NoSerie "${datos.NoSerie}".` };
            }
        }
        if (datos.IMEI1) {
            const dup = await pool.request()
                .input('IMEI1', sql.NVarChar(50), datos.IMEI1)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE IMEI1 = @IMEI1 OR IMEI2 = @IMEI1');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un activo con IMEI1 "${datos.IMEI1}".` };
            }
        }
        if (datos.IMEI2) {
            const dup = await pool.request()
                .input('IMEI2', sql.NVarChar(50), datos.IMEI2)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE IMEI1 = @IMEI2 OR IMEI2 = @IMEI2');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un activo con IMEI2 "${datos.IMEI2}".` };
            }
        }
        if (datos.NoTelefono) {
            const dup = await pool.request()
                .input('NoTelefono', sql.NVarChar(50), datos.NoTelefono)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoTelefono = @NoTelefono');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un activo con NoTeléfono "${datos.NoTelefono}".` };
            }
        }

        if (!datos.IdTipo) {
            return { ok: false, mensaje: 'El tipo es obligatorio.' };
        }

        let IdEstado = null;
        if (datos.IdEstado) {
            IdEstado = datos.IdEstado;
        } else if (datos.Estado) {
            IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', datos.Estado);
        }
        if (!IdEstado) {
            IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', 'VALIDAR');
        }
        if (!IdEstado) return { ok: false, mensaje: 'Agrega un estado al catálogo antes de crear activos.' };

        const IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', 'DISPONIBLE');
        if (!IdEstatus) return { ok: false, mensaje: 'No existe el estatus DISPONIBLE en el catálogo.' };

        /* Columnas de texto legado: sólo se escriben si aún existen. */
        const hayTexto = await columnasTextoEquipo();

        const request  = pool.request();
        const columnas = [];
        const valores  = [];

        const agregar = (columna, tipo, valor) => {
            if (TEXTOS_RESPALDO_EQUIPO.has(columna) && !hayTexto.has(columna)) return;
            const param = `p${columnas.length}`;
            request.input(param, tipo, valor);
            columnas.push(columna);
            valores.push('@' + param);
        };

        agregar('IdCartera',           sql.Int,           datos.IdCartera || null);
        agregar('IdMarca',             sql.Int,           datos.IdMarca || null);
        agregar('IdModelo',            sql.Int,           idsCatalogo.IdModelo ?? null);
        agregar('Modelo',              sql.NVarChar(150), textos.Modelo ?? null);
        agregar('IdProcesador',        sql.Int,           idsCatalogo.IdProcesador ?? null);
        agregar('Procesador',          sql.NVarChar(150), textos.Procesador ?? null);
        agregar('IdMemoriaRAM',        sql.Int,           idsCatalogo.IdMemoriaRAM ?? null);
        agregar('MemoriaRAM',          sql.NVarChar(50),  textos.MemoriaRAM ?? null);
        agregar('IdAlmacenamiento',    sql.Int,           idsCatalogo.IdAlmacenamiento ?? null);
        agregar('Almacenamiento',      sql.NVarChar(50),  textos.Almacenamiento ?? null);
        agregar('IdSistemaOperativo',  sql.Int,           idsCatalogo.IdSistemaOperativo ?? null);
        agregar('SistemaOperativo',    sql.NVarChar(100), textos.SistemaOperativo ?? null);
        agregar('IdUsuarioAsignado',   sql.Int,           idsCatalogo.IdUsuarioAsignado ?? null);
        agregar('UsuarioAsignado',     sql.NVarChar(200), textos.UsuarioAsignado ?? null);
        agregar('IdTipo',              sql.Int,           datos.IdTipo);
        agregar('NoSerie',             sql.NVarChar(150), datos.NoSerie || null);
        agregar('IMEI1',               sql.NVarChar(50),  datos.IMEI1 || null);
        agregar('IMEI2',               sql.NVarChar(50),  datos.IMEI2 || null);
        agregar('NoTelefono',          sql.NVarChar(50),  datos.NoTelefono || null);
        agregar(CAMPO_ACCESORIOS,      sql.NVarChar(300), datos.Accesorios || null);
        agregar('PrecioActivo',        sql.Decimal(18,2), datos.PrecioActivo ?? null);
        agregar('IdEstado',            sql.Int,           IdEstado);
        agregar('IdEstatus',           sql.Int,           IdEstatus);
        agregar('IdLugarCliente',      sql.Int,           datos.IdLugarCliente || null);
        agregar('IdSitio',             sql.Int,           datos.IdSitio || null);
        agregar('IdSubtipo',           sql.Int,           datos.IdSubtipo || null);
        agregar('IdClasificacion',     sql.Int,           datos.IdClasificacion || null);
        agregar('IdTamanio',           sql.Int,           datos.IdTamanio || null);
        agregar('IdCapacidad',         sql.Int,           datos.IdCapacidad || null);
        agregar('IdVoltaje',           sql.Int,           datos.IdVoltaje || null);
        agregar('Observaciones',       sql.NVarChar(500), datos.Observaciones || null);
        agregar('IdUsuarioCreacion',   sql.Int,           idUsuario || null);

        const result = await request.query(`
            INSERT INTO ActivoFijoEquipos (${columnas.join(', ')})
            VALUES (${valores.join(', ')});
            SELECT SCOPE_IDENTITY() AS Id;
        `);

        const idNuevo = result.recordset[0].Id;

        /* Accesorios: se guardan en la tabla puente (N:M). */
        await catalogosDB.sincronizarAccesoriosEquipo(idNuevo, datos[CAMPO_ACCESORIOS]);

        return { ok: true, mensaje: 'Activo creado correctamente.', id: idNuevo };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un activo con ese valor único.' };
        }
        return { ok: false, mensaje: 'Error al crear: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(id, datos, idUsuario) {
    try {
        const pool = await getPool();
        await catalogosDB.asegurarCatalogosExtendidos();

        const actual = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT af.IdTipo, af.IdEstado, af.IdEstatus, af.IdUsuarioAsignado,
                       st.Nombre AS Estatus,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM ActivoFijoResponsivas r
                           WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                             AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                       ) THEN 1 ELSE 0 END AS TieneResponsivaActiva
                FROM ActivoFijoEquipos af
                LEFT JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE af.IdActivoFijoEQ = @Id
            `);

        if (actual.recordset.length === 0) {
            return { ok: false, mensaje: 'El activo ya no existe.' };
        }

        const current = actual.recordset[0];

        /* Igual que en crear(): convierte lo capturado en catálogos de
           especificaciones / usuario asignado a su FK, creando o
           reactivando el registro si no existía. Devuelve además el
           texto legible que se conserva en la columna de respaldo. */
        const { ids: idsCatalogo, textos } = await resolverEspecificaciones(datos);

        if (datos.NoSerie !== undefined && datos.NoSerie) {
            const dup = await pool.request()
                .input('NoSerie', sql.NVarChar(150), datos.NoSerie)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoSerie = @NoSerie AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con NoSerie "${datos.NoSerie}".` };
            }
        }
        if (datos.IMEI1 !== undefined && datos.IMEI1) {
            const dup = await pool.request()
                .input('IMEI1', sql.NVarChar(50), datos.IMEI1)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE (IMEI1 = @IMEI1 OR IMEI2 = @IMEI1) AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con IMEI1 "${datos.IMEI1}".` };
            }
        }
        if (datos.IMEI2 !== undefined && datos.IMEI2) {
            const dup = await pool.request()
                .input('IMEI2', sql.NVarChar(50), datos.IMEI2)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE (IMEI1 = @IMEI2 OR IMEI2 = @IMEI2) AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con IMEI2 "${datos.IMEI2}".` };
            }
        }
        if (datos.NoTelefono !== undefined && datos.NoTelefono) {
            const dup = await pool.request()
                .input('NoTelefono', sql.NVarChar(50), datos.NoTelefono)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoTelefono = @NoTelefono AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con NoTeléfono "${datos.NoTelefono}".` };
            }
        }

        let IdTipo = null;
        if (datos.IdTipo) IdTipo = datos.IdTipo;
        else if (datos.Tipo) IdTipo = await getIdPorNombre(pool, 'ActivoFijoTipos', 'IdTipo', datos.Tipo);
        if (!IdTipo) IdTipo = current.IdTipo;
        if (!IdTipo) return { ok: false, mensaje: 'El tipo es obligatorio.' };

        let IdEstado = null;
        if (datos.IdEstado) IdEstado = datos.IdEstado;
        else if (datos.Estado) IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', datos.Estado);
        if (!IdEstado) IdEstado = current.IdEstado;
        if (!IdEstado) IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', 'VALIDAR');

        let IdEstatus = current.IdEstatus;
        if (datos.IdEstatus) {
            IdEstatus = Number(datos.IdEstatus);
        } else if (datos.Estatus) {
            IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', datos.Estatus);
        }
        if (!IdEstatus) return { ok: false, mensaje: 'El estatus seleccionado no existe.' };

        const estatusSolicitado = await pool.request()
            .input('IdEstatus', sql.Int, IdEstatus)
            .query('SELECT Nombre FROM ActivoFijoEstatus WHERE IdEstatus = @IdEstatus AND Activo = 1');
        const nombreEstatusSolicitado = estatusSolicitado.recordset[0]?.Nombre?.toUpperCase();
        if (!nombreEstatusSolicitado) {
            return { ok: false, mensaje: 'El estatus seleccionado no está activo en el catálogo.' };
        }
        if (nombreEstatusSolicitado === 'ASIGNADO' && !current.TieneResponsivaActiva) {
            return { ok: false, mensaje: 'El estatus ASIGNADO solo se establece al crear una responsiva activa.' };
        }
        if (current.TieneResponsivaActiva && Number(IdEstatus) !== Number(current.IdEstatus)) {
            return { ok: false, mensaje: 'No se puede cambiar el estatus mientras exista una responsiva activa. Registra primero la devolución o cancelación.' };
        }

        /* El usuario de inventario de un activo con responsiva abierta es el
           que recibe esa responsiva (lo sincroniza el trigger). Editarlo aquí
           desincroniza inventario y responsiva, así que se rechaza. */
        if (current.TieneResponsivaActiva && datos.UsuarioAsignado !== undefined) {
            const solicitado = idsCatalogo.IdUsuarioAsignado ?? null;
            const guardado   = current.IdUsuarioAsignado ?? null;
            if (Number(solicitado ?? 0) !== Number(guardado ?? 0)) {
                return {
                    ok: false,
                    mensaje: 'El usuario asignado lo controla la responsiva abierta. Cámbialo editando la responsiva o registra primero la devolución.'
                };
            }
        }

        /* Columnas de texto legado: sólo se actualizan si aún existen. */
        const hayTexto = await columnasTextoEquipo();

        const request = pool.request();
        request.input('Id',         sql.Int, id);
        request.input('IdTipo',     sql.Int, IdTipo);
        request.input('IdEstado',   sql.Int, IdEstado);
        request.input('IdEstatus',  sql.Int, IdEstatus);
        request.input('NombreEstatus', sql.NVarChar(50), nombreEstatusSolicitado);
        request.input('IdUsuario',  sql.Int, idUsuario || null);

        const sets = [
            'IdTipo = @IdTipo',
            'IdEstado = @IdEstado',
            'IdEstatus = @IdEstatus',
            'IdUsuarioModificacion = @IdUsuario',
            'FechaModificacion = GETDATE()'
        ];

        const camposOpcionales = [
            ['IdCartera',       'IdCartera',        sql.Int,       null],
            ['IdMarca',         'IdMarca',          sql.Int,       null],
            ['NoSerie',         'NoSerie',          sql.NVarChar,  150],
            ['IMEI1',           'IMEI1',            sql.NVarChar,  50],
            ['IMEI2',           'IMEI2',            sql.NVarChar,  50],
            ['NoTelefono',      'NoTelefono',       sql.NVarChar,  50],
            ['Accesorios',      'Accesorios',       sql.NVarChar,  300],
            ['PrecioActivo',    'PrecioActivo',     'Decimal',     null],
            ['IdLugarCliente',  'IdLugarCliente',   sql.Int,       null],
            ['IdSitio',         'IdSitio',          sql.Int,       null],
            ['IdSubtipo',       'IdSubtipo',        sql.Int,       null],
            ['IdClasificacion', 'IdClasificacion',  sql.Int,       null],
            ['IdTamanio',       'IdTamanio',        sql.Int,       null],
            ['IdCapacidad',     'IdCapacidad',      sql.Int,       null],
            ['IdVoltaje',       'IdVoltaje',        sql.Int,       null],
            ['Observaciones',   'Observaciones',    sql.NVarChar,  500]
        ];

        for (const [jsKey, colName, tipoSqlFn, longitud] of camposOpcionales) {
            if (datos[jsKey] === undefined) continue;
            if (TEXTOS_RESPALDO_EQUIPO.has(colName) && !hayTexto.has(colName)) continue;

            const paramName = 'p_' + colName;
            let sqlType;
            if (tipoSqlFn === 'Decimal')   sqlType = sql.Decimal(18, 2);
            else if (longitud !== null)    sqlType = tipoSqlFn(longitud);
            else                           sqlType = tipoSqlFn;

            request.input(paramName, sqlType, datos[jsKey]);
            sets.push(`${colName} = @${paramName}`);
        }

        /* Especificaciones y usuario asignado: se escriben el texto legible
           y su FK al catálogo (3FN). Sólo se tocan las claves enviadas, así
           que un PATCH parcial no borra el resto. */
        for (const [campo, , fk, longitud] of CAMPOS_CATALOGO_ESPECIFICACIONES) {
            if (datos[campo] === undefined) continue;

            request.input('fk_' + fk,  sql.Int,           idsCatalogo[fk] ?? null);
            request.input('p_' + campo, sql.NVarChar(longitud), textos[campo] ?? null);
            sets.push(`${fk} = @fk_${fk}`);

            /* El texto de respaldo ya no existe tras la fase 2 del script 3FN. */
            if (hayTexto.has(campo)) sets.push(`${campo} = @p_${campo}`);
        }

        const result = await request.query(
            `UPDATE ActivoFijoEquipos SET ${sets.join(', ')}
             WHERE IdActivoFijoEQ = @Id
               AND (
                   @NombreEstatus <> 'ASIGNADO'
                   OR EXISTS (
                       SELECT 1 FROM ActivoFijoResponsivas r
                       WHERE r.IdActivoFijoEQ = ActivoFijoEquipos.IdActivoFijoEQ
                         AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                   )
               )
               AND (
                   NOT EXISTS (
                       SELECT 1 FROM ActivoFijoResponsivas r
                       WHERE r.IdActivoFijoEQ = ActivoFijoEquipos.IdActivoFijoEQ
                         AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                   )
                   OR @IdEstatus = ActivoFijoEquipos.IdEstatus
               )`
        );

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'No se pudo actualizar: el activo no existe o su estatus está protegido por una responsiva activa.' };
        }

        /* Accesorios: sólo se reemplaza la tabla puente si el campo vino en
           los datos, para no borrarlos en un PATCH parcial. */
        if (datos[CAMPO_ACCESORIOS] !== undefined) {
            await catalogosDB.sincronizarAccesoriosEquipo(id, datos[CAMPO_ACCESORIOS]);
        }

        return { ok: true, mensaje: 'Activo actualizado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un activo con ese valor único.' };
        }
        return { ok: false, mensaje: 'Error al actualizar: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR (Soft delete)
   ========================================================= */
async function eliminar(id, idUsuario, motivo = null) {
    try {
        const pool = await getPool();

        const respActivas = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT COUNT(*) AS Total
                FROM ActivoFijoResponsivas
                WHERE IdActivoFijoEQ = @Id
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);

        if (respActivas.recordset[0].Total > 0) {
            return {
                ok: false,
                mensaje: 'No se puede dar de baja: el activo tiene responsivas activas. Cancélalas primero.'
            };
        }

        const result = await pool.request()
            .input('Id',     sql.Int, id)
            .input('IdUser', sql.Int, idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus             = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'BAJA'),
                    IdUsuarioModificacion = @IdUser,
                    FechaModificacion     = GETDATE()
                WHERE IdActivoFijoEQ = @Id
                  AND IdEstatus <> (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'BAJA')
                  AND NOT EXISTS (
                      SELECT 1 FROM ActivoFijoResponsivas
                      WHERE IdActivoFijoEQ = @Id
                        AND EstatusResponsiva IN ('ASIGNADO','PENDIENTE')
                  );
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El activo ya estaba dado de baja o no existe.' };
        }

        if (motivo) {
            await pool.request()
                .input('Id',     sql.Int,           id)
                .input('Motivo', sql.NVarChar(500), motivo)
                .query(`
                    UPDATE ActivoFijoHistoricos
                    SET Motivo = @Motivo
                    WHERE IdHistorico = (
                        SELECT TOP 1 IdHistorico
                        FROM ActivoFijoHistoricos
                        WHERE IdActivoFijoEQ = @Id
                          AND Accion = 'BAJA'
                        ORDER BY FechaMovimiento DESC
                    );
                `);
        }

        return { ok: true, mensaje: 'Activo dado de baja. Se conserva en la pestaña "Eliminados".' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al dar de baja: ' + err.message };
    }
}

/* =========================================================
   RESTAURAR
   ========================================================= */
async function restaurar(id, idUsuario, motivo = null) {
    try {
        await catalogosDB.asegurarCatalogosExtendidos();
        const pool = await getPool();

        const responsivasActivas = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT COUNT(*) AS Total
                FROM ActivoFijoResponsivas
                WHERE IdActivoFijoEQ = @Id
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);
        if (responsivasActivas.recordset[0].Total > 0) {
            return { ok: false, mensaje: 'No se puede restaurar: el activo tiene una responsiva activa.' };
        }

        const result = await pool.request()
            .input('Id',     sql.Int, id)
            .input('IdUser', sql.Int, idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'DISPONIBLE' AND Activo = 1),
                    IdUsuarioModificacion = @IdUser,
                    FechaModificacion     = GETDATE()
                WHERE IdActivoFijoEQ = @Id
                  AND IdEstatus = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'BAJA')
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El activo no está dado de baja o no existe.' };
        }

        if (motivo) {
            await pool.request()
                .input('Id',     sql.Int,           id)
                .input('Motivo', sql.NVarChar(500), motivo)
                .query(`
                    UPDATE ActivoFijoHistoricos
                    SET Motivo = @Motivo
                    WHERE IdHistorico = (
                        SELECT TOP 1 IdHistorico
                        FROM ActivoFijoHistoricos
                        WHERE IdActivoFijoEQ = @Id
                          AND Accion = 'RESTAURACION'
                        ORDER BY FechaMovimiento DESC
                    );
                `);
        }

        return { ok: true, mensaje: 'Activo restaurado. Vuelve al inventario activo.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al restaurar: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR DEFINITIVAMENTE (purga física)

   Sólo para activos que ya están en BAJA y que no tienen ninguna
   responsiva: la responsiva es un documento firmado y jamás se borra
   en cascada. Las filas hijas se descubren en el catálogo del sistema
   (sys.foreign_keys) para no quedar desfasadas si mañana se añade otra
   tabla que apunte a ActivoFijoEquipos.
   ========================================================= */
async function tablasHijasDe(tx, tabla) {
    const r = await new sql.Request(tx)
        .input('Tabla', sql.NVarChar(200), `dbo.${tabla}`)
        .query(`
            SELECT OBJECT_NAME(fk.parent_object_id)                     AS Tabla,
                   COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Columna,
                   COLUMNPROPERTY(fkc.parent_object_id,
                                  COL_NAME(fkc.parent_object_id, fkc.parent_column_id),
                                  'AllowsNull')                     AS Nulable
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc
                    ON fkc.constraint_object_id = fk.object_id
            WHERE fk.referenced_object_id = OBJECT_ID(@Tabla)
        `);
    return r.recordset;
}

/* Tablas de histórico: su referencia a la responsiva es un retrato del
   pasado. Si la fila pertenece a OTRO activo no se borra: sólo se suelta
   el vínculo, para no perder movimientos ajenos a esta purga. */
const TABLAS_HISTORIAL = new Set(['ActivoFijoHistoricos', 'ActivoFijoAsignacionesHist']);

async function eliminarDefinitivo(id, idUsuario) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        const activo = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query(`
                SELECT af.IdActivoFijoEQ, st.Nombre AS Estatus
                FROM ActivoFijoEquipos af WITH (UPDLOCK, HOLDLOCK)
                LEFT JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE af.IdActivoFijoEQ = @Id
            `);
        if (activo.recordset.length === 0) {
            await tx.rollback();
            return { ok: false, mensaje: 'El activo ya no existe.' };
        }

        const estatus = String(activo.recordset[0].Estatus || '').toUpperCase();
        if (estatus !== 'BAJA') {
            await tx.rollback();
            return { ok: false, mensaje: 'Sólo se pueden eliminar definitivamente los activos dados de baja.' };
        }

        /* Una responsiva ABIERTA bloquea la purga: es un documento vigente
           con un activo en manos de alguien. Las cerradas (devueltas o
           canceladas) son histórico del propio activo y se van con él, tal
           como avisa el diálogo de confirmación. */
        const abiertas = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query(`
                SELECT COUNT(*) AS Total
                FROM ActivoFijoResponsivas
                WHERE IdActivoFijoEQ = @Id
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);
        const totalAbiertas = abiertas.recordset[0].Total;
        if (totalAbiertas > 0) {
            await tx.rollback();
            return {
                ok: false,
                mensaje: `No se puede eliminar definitivamente: el activo tiene ${totalAbiertas} responsiva(s) activa(s). Cancélala(s) o regístrala(s) como devuelta(s) primero.`
            };
        }

        const borradas = {};
        const contar = (tabla, n) => { if (n > 0) borradas[tabla] = (borradas[tabla] || 0) + n; };

        /* Orden de borrado: primero lo que cuelga del equipo (histórico,
           accesorios, asignaciones), luego lo que cuelga de sus
           responsivas, después las responsivas cerradas y al final el
           equipo. Así ninguna FK intermedia apunta a una fila ya borrada. */
        const hijasEquipo = await tablasHijasDe(tx, 'ActivoFijoEquipos');
        for (const h of hijasEquipo) {
            if (!h.Tabla || !h.Columna || h.Tabla === 'ActivoFijoResponsivas') continue;
            const r = await new sql.Request(tx)
                .input('Id', sql.Int, id)
                .query(`
                    DELETE FROM dbo.${h.Tabla}
                    WHERE ${h.Columna} = @Id
                `);
            contar(h.Tabla, r.rowsAffected[0] || 0);
        }

        const hijasResp = await tablasHijasDe(tx, 'ActivoFijoResponsivas');
        for (const h of hijasResp) {
            if (!h.Tabla || !h.Columna) continue;
            const filtro = `
                ${h.Columna} IN (
                    SELECT IdResponsiva
                    FROM dbo.ActivoFijoResponsivas
                    WHERE IdActivoFijoEQ = @Id
                )`;
            const esHistorialNulable = TABLAS_HISTORIAL.has(h.Tabla) && h.Nulable === 1;
            const r = esHistorialNulable
                ? await new sql.Request(tx)
                    .input('Id', sql.Int, id)
                    .query(`UPDATE dbo.${h.Tabla} SET ${h.Columna} = NULL WHERE ${filtro}`)
                : await new sql.Request(tx)
                    .input('Id', sql.Int, id)
                    .query(`DELETE FROM dbo.${h.Tabla} WHERE ${filtro}`);
            contar(h.Tabla, r.rowsAffected[0] || 0);
        }

        const rResp = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query('DELETE FROM dbo.ActivoFijoResponsivas WHERE IdActivoFijoEQ = @Id');
        contar('ActivoFijoResponsivas', rResp.rowsAffected[0] || 0);

        const r = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query('DELETE FROM dbo.ActivoFijoEquipos WHERE IdActivoFijoEQ = @Id');

        if (r.rowsAffected[0] === 0) {
            await tx.rollback();
            return { ok: false, mensaje: 'El activo ya no existe.' };
        }

        await tx.commit();

        const detalle = Object.entries(borradas)
            .filter(([, n]) => n > 0)
            .map(([tabla, n]) => `${tabla}: ${n}`)
            .join(', ');
        console.log(`🗑️  Activo #${id} eliminado definitivamente` +
            (idUsuario ? ` por el usuario ${idUsuario}` : '') +
            (detalle ? ` (${detalle})` : ''));

        return { ok: true, mensaje: 'Activo eliminado definitivamente.' };
    } catch (err) {
        try { await tx.rollback(); } catch (_) { /* la transacción ya estaba cerrada */ }
        if (err.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar: hay registros asociados al activo.' };
        }
        return { ok: false, mensaje: 'Error al eliminar definitivamente: ' + err.message };
    }
}

/* =========================================================
   HISTÓRICO
   ========================================================= */
async function historico(idActivo, limite = 200) {
    const pool = await getPool();
    const r = await pool.request()
        .input('Id',     sql.Int, idActivo)
        .input('Limite', sql.Int, limite)
        .query(`
            SELECT TOP (@Limite)
                h.IdHistorico,
                h.IdActivoFijoEQ,
                h.Accion,
                h.Detalle,
                h.Motivo,
                h.IdEstadoAnterior,  ea.Nombre AS EstadoAnterior,
                h.IdEstadoNuevo,     en.Nombre AS EstadoNuevo,
                h.IdEstatusAnterior, sa.Nombre AS EstatusAnterior,
                h.IdEstatusNuevo,    sn.Nombre AS EstatusNuevo,
                h.IdLugarOrigen,     h.IdLugarDestino,
                h.IdSitioAnterior,   sia.Nombre  AS SitioAnterior,
                h.IdSitioNuevo,      sin_.Nombre AS SitioNuevo,
                h.UsuarioAsignadoAnterior,
                h.UsuarioAsignadoNuevo,
                h.IdUsuarioMovimiento,
                LTRIM(RTRIM(
                    ISNULL(u.Nombres, '') + ' ' + ISNULL(u.Apellidos, '')
                )) AS UsuarioMovimiento,
                u.NombreUsuario,
                h.FechaMovimiento
            FROM ActivoFijoHistoricos h
            LEFT JOIN ActivoFijoEstados  ea   ON ea.IdEstado   = h.IdEstadoAnterior
            LEFT JOIN ActivoFijoEstados  en   ON en.IdEstado   = h.IdEstadoNuevo
            LEFT JOIN ActivoFijoEstatus  sa   ON sa.IdEstatus  = h.IdEstatusAnterior
            LEFT JOIN ActivoFijoEstatus  sn   ON sn.IdEstatus  = h.IdEstatusNuevo
            LEFT JOIN ActivoFijoSitios   sia  ON sia.IdSitio   = h.IdSitioAnterior
            LEFT JOIN ActivoFijoSitios   sin_ ON sin_.IdSitio  = h.IdSitioNuevo
            LEFT JOIN Usuarios           u    ON u.IdUsuario = h.IdUsuarioMovimiento
            WHERE h.IdActivoFijoEQ = @Id
            ORDER BY h.FechaMovimiento DESC
        `);
    return r.recordset;
}

/* =========================================================
   EXPORTAR A EXCEL (Inteligente + Poppins)
   ========================================================= */
async function exportarExcel(payload) {
    const { titulo, columnas, datos } = payload || {};

    if (!datos || datos.length === 0) {
        return { ok: false, mensaje: 'No hay datos para exportar.' };
    }

    const safeTitulo = (titulo || 'Inventario').replace(/[\\/:*?"<>|]/g, '_');
    const fecha = new Date().toISOString().slice(0, 10);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const defaultPath = path.join(
        fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(),
        `${safeTitulo}_${fecha}.xlsx`
    );

    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar reporte en Excel',
        defaultPath,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { ok: false, mensaje: 'Cancelado' };

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario');

    // Definir columnas con anchos
    worksheet.columns = columnas.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15
    }));

    // Agregar los datos
    worksheet.addRows(datos);

    // Estilos de encabezado verde con fuente Poppins
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF15803D' } // Verde oscuro
        };
        cell.font = {
            color: { argb: 'FFFFFFFF' },
            bold: true,
            size: 11,
            name: 'Poppins'
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Filtros automáticos
    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columnas.length }
    };

    // Estilos de filas y bordes
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
            cell.font = { name: 'Poppins', size: 10 };
            // Filas alternas grises
            if (rowNumber % 2 === 0) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8FAFC' }
                };
            }
        });
    });

    try {
        await workbook.xlsx.writeFile(filePath);
        return { ok: true, ruta: filePath };
    } catch (err) {
        console.error('[Excel Error]:', err);
        return { ok: false, mensaje: 'No se pudo escribir el archivo: ' + err.message };
    }
}

/* =========================================================
   CATÁLOGOS AUXILIARES
   ========================================================= */
async function listarTipos() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT IdTipo, Nombre, GrupoSubtipo,
               RequiereResponsiva, RequiereIMEI, RequiereTelefono,
               RequiereSitio, RequiereSubtipo, RequiereClasificacion,
               RequiereTamanio, RequiereCapacidad, RequiereVoltaje,
               RequiereUsuarioAsignado,
               RequierePrecio, RequiereEspecificaciones, RequiereAccesorios
        FROM ActivoFijoTipos
        WHERE Activo = 1
        ORDER BY Nombre
    `);
    return r.recordset;
}

async function listarMarcas() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdMarca, Nombre FROM ActivoFijoMarcas WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarEstados() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdEstado, Nombre FROM ActivoFijoEstados WHERE Activo = 1 ORDER BY IdEstado'
    );
    return r.recordset;
}

async function listarEstatus() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdEstatus, Nombre FROM ActivoFijoEstatus WHERE Activo = 1 ORDER BY IdEstatus'
    );
    return r.recordset;
}

async function listarCarteras() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdCartera, Nombre FROM ActivoFijoCarteras WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarSitios() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdSitio, Nombre FROM ActivoFijoSitios WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarSubtipos() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdSubtipo, Grupo, Nombre FROM ActivoFijoSubtipos WHERE Activo = 1 ORDER BY Grupo, Nombre'
    );
    return r.recordset;
}

async function listarVoltajes() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdVoltaje, Nombre FROM ActivoFijoVoltajes WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarClasificaciones() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdClasificacion, Nombre FROM ActivoFijoClasificaciones WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarTamanios() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdTamanio, Nombre FROM ActivoFijoTamanios WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarCapacidades() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdCapacidad, Nombre FROM ActivoFijoCapacidades WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarCatalogosExtendidos() {
    return catalogosDB.listarEspecificaciones();
}

module.exports = {
    listar, obtener, crear, actualizar, eliminar, restaurar, eliminarDefinitivo,
    historico, exportarExcel,
    listarTipos, listarMarcas, listarEstados, listarEstatus, listarCarteras,
    listarSitios, listarSubtipos, listarVoltajes,
    listarClasificaciones, listarTamanios, listarCapacidades,
    listarCatalogosExtendidos
};