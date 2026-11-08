const { getPool, sql } = require('./conexion');

/* =========================================================
   MÓDULO DOCUMENTACIÓN — capa de datos
   ---------------------------------------------------------
   Guarda los metadatos Y el binario de los documentos (diagramas,
   manuales, procedimientos, etc.) en la columna Contenido
   (VARBINARY(MAX)). NombreGuardado es sólo una clave lógica para
   localizar el archivo; no apunta a ninguna ruta del disco.

   La estructura de las tablas vive en scripts/documentacion.sql
   (se ejecuta una sola vez sobre la base de datos). Este módulo
   sólo contiene código JavaScript: nada de DDL.
   ========================================================= */

/* =========================================================
   HELPERS
   ========================================================= */
function limpiar(valor, max = 500) {
    if (valor === null || valor === undefined) return null;
    const texto = String(valor).trim();
    return texto ? texto.substring(0, max) : null;
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/** Normaliza el binario recibido (Buffer, ArrayBuffer o vista) para VARBINARY(MAX). */
function binario(valor) {
    if (!valor) return null;
    const buffer = Buffer.isBuffer(valor)
        ? valor
        : valor instanceof ArrayBuffer
            ? Buffer.from(new Uint8Array(valor))
            : ArrayBuffer.isView(valor)
                ? Buffer.from(valor.buffer, valor.byteOffset, valor.byteLength)
                : null;
    return buffer && buffer.length ? buffer : null;
}

async function etiquetasPorDocumento(pool, ids) {
    const mapa = new Map();
    if (!ids.length) return mapa;

    const peticion = pool.request();
    const marcas = ids.map((id, indice) => {
        peticion.input(`D${indice}`, sql.NVarChar(40), id);
        return `@D${indice}`;
    });

    const result = await peticion.query(`
        SELECT DE.DocumentoId, E.Id, E.Nombre
        FROM dbo.DocumentosEtiquetas DE
        INNER JOIN dbo.Etiquetas E ON E.Id = DE.EtiquetaId
        WHERE DE.DocumentoId IN (${marcas.join(',')})
        ORDER BY E.Nombre
    `);

    result.recordset.forEach(fila => {
        if (!mapa.has(fila.DocumentoId)) mapa.set(fila.DocumentoId, []);
        mapa.get(fila.DocumentoId).push({ id: fila.Id, nombre: fila.Nombre });
    });
    return mapa;
}

/* =========================================================
   SECCIONES
   ========================================================= */
async function listarSecciones() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT S.Id, S.Nombre, S.Icono, S.Orden, S.Activa,
               (SELECT COUNT(*) FROM dbo.Documentos D
                 WHERE D.Seccion = S.Id AND D.Eliminado = 0) AS Total
        FROM dbo.Secciones S
        ORDER BY S.Orden, S.Nombre
    `);
    return result.recordset;
}

async function crearSeccion(datos) {
    try {
        const nombre = limpiar(datos?.nombre, 100);
        if (!nombre) return { ok: false, mensaje: 'Escribe un nombre para la sección.' };

        const pool = await getPool();
        const dup = await pool.request()
            .input('Nombre', sql.NVarChar(100), nombre)
            .query('SELECT 1 FROM dbo.Secciones WHERE Nombre = @Nombre');
        if (dup.recordset.length) return { ok: false, mensaje: `Ya existe una sección llamada "${nombre}".` };

        const id = `sec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        const orden = numero(datos?.orden) || 99;

        await pool.request()
            .input('Id', sql.NVarChar(60), id)
            .input('Nombre', sql.NVarChar(100), nombre)
            .input('Icono', sql.NVarChar(20), limpiar(datos?.icono, 20) || '▦')
            .input('Orden', sql.Int, orden)
            .query('INSERT INTO dbo.Secciones (Id, Nombre, Icono, Orden, Activa) VALUES (@Id, @Nombre, @Icono, @Orden, 1)');

        return { ok: true, mensaje: 'Sección creada correctamente.', id };
    } catch (err) {
        return { ok: false, mensaje: 'Error al crear la sección: ' + err.message };
    }
}

async function actualizarSeccion(id, datos) {
    try {
        const pool = await getPool();
        const nombre = limpiar(datos?.nombre, 100);
        if (!nombre) return { ok: false, mensaje: 'Escribe un nombre para la sección.' };

        const dup = await pool.request()
            .input('Id', sql.NVarChar(60), id)
            .input('Nombre', sql.NVarChar(100), nombre)
            .query('SELECT 1 FROM dbo.Secciones WHERE Nombre = @Nombre AND Id <> @Id');
        if (dup.recordset.length) return { ok: false, mensaje: `Ya existe otra sección llamada "${nombre}".` };

        const result = await pool.request()
            .input('Id', sql.NVarChar(60), id)
            .input('Nombre', sql.NVarChar(100), nombre)
            .input('Icono', sql.NVarChar(20), limpiar(datos?.icono, 20) || '▦')
            .input('Orden', sql.Int, numero(datos?.orden))
            .input('Activa', sql.Bit, datos?.activa === false ? 0 : 1)
            .query('UPDATE dbo.Secciones SET Nombre = @Nombre, Icono = @Icono, Orden = @Orden, Activa = @Activa WHERE Id = @Id');

        if (result.rowsAffected[0] === 0) return { ok: false, mensaje: 'La sección ya no existe.' };
        return { ok: true, mensaje: 'Sección actualizada correctamente.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al actualizar la sección: ' + err.message };
    }
}

async function eliminarSeccion(id) {
    try {
        const pool = await getPool();

        const enUso = await pool.request()
            .input('Id', sql.NVarChar(60), id)
            .query('SELECT COUNT(*) AS Total FROM dbo.Documentos WHERE Seccion = @Id');
        if (enUso.recordset[0]?.Total > 0) {
            return { ok: false, mensaje: 'No se puede eliminar: la sección todavía tiene documentos.' };
        }

        const result = await pool.request()
            .input('Id', sql.NVarChar(60), id)
            .query('DELETE FROM dbo.Secciones WHERE Id = @Id');

        if (result.rowsAffected[0] === 0) return { ok: false, mensaje: 'La sección ya no existe.' };
        return { ok: true, mensaje: 'Sección eliminada correctamente.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al eliminar la sección: ' + err.message };
    }
}

/* =========================================================
   ETIQUETAS
   ========================================================= */
async function listarEtiquetas() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT E.Id, E.Nombre,
               (SELECT COUNT(*) FROM dbo.DocumentosEtiquetas DE WHERE DE.EtiquetaId = E.Id) AS Total
        FROM dbo.Etiquetas E
        ORDER BY E.Nombre
    `);
    return result.recordset;
}

async function guardarEtiquetas(pool, documentoId, etiquetas) {
    const nombres = [...new Set(
        (Array.isArray(etiquetas) ? etiquetas : String(etiquetas || '').split(','))
            .map(nombre => limpiar(nombre, 60))
            .filter(Boolean)
    )].slice(0, 12);

    await pool.request()
        .input('DocumentoId', sql.NVarChar(40), documentoId)
        .query('DELETE FROM dbo.DocumentosEtiquetas WHERE DocumentoId = @DocumentoId');

    for (const nombre of nombres) {
        const existente = await pool.request()
            .input('Nombre', sql.NVarChar(60), nombre)
            .query('SELECT Id FROM dbo.Etiquetas WHERE Nombre = @Nombre');

        let etiquetaId = existente.recordset[0]?.Id;
        if (!etiquetaId) {
            etiquetaId = `etq_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
            await pool.request()
                .input('Id', sql.NVarChar(40), etiquetaId)
                .input('Nombre', sql.NVarChar(60), nombre)
                .query('INSERT INTO dbo.Etiquetas (Id, Nombre) VALUES (@Id, @Nombre)');
        }

        await pool.request()
            .input('DocumentoId', sql.NVarChar(40), documentoId)
            .input('EtiquetaId', sql.NVarChar(40), etiquetaId)
            .query(`IF NOT EXISTS (SELECT 1 FROM dbo.DocumentosEtiquetas
                                   WHERE DocumentoId = @DocumentoId AND EtiquetaId = @EtiquetaId)
                    INSERT INTO dbo.DocumentosEtiquetas (DocumentoId, EtiquetaId)
                    VALUES (@DocumentoId, @EtiquetaId)`);
    }
}

/* =========================================================
   LISTAR / OBTENER
   ========================================================= */
async function listar(opciones = {}) {
    const pool = await getPool();
    const papelera = opciones.papelera === true || opciones.papelera === 1;

    const result = await pool.request()
        .input('Eliminado', sql.Bit, papelera ? 1 : 0)
        .query(`
            SELECT Id, Seccion, Titulo, Cliente, Categoria, NombreOriginal, NombreGuardado,
                   TipoMime, TamanoBytes, Hash, VersionActual, Descripcion, Eliminado,
                   CreadoEn, ActualizadoEn
            FROM dbo.Documentos
            WHERE Eliminado = @Eliminado
            ORDER BY ActualizadoEn DESC
        `);

    const documentos = result.recordset;
    const mapa = await etiquetasPorDocumento(pool, documentos.map(d => d.Id));
    documentos.forEach(doc => {
        doc.Etiquetas = mapa.get(doc.Id) || [];
    });
    return documentos;
}

async function obtener(id) {
    const pool = await getPool();
    const result = await pool.request()
        .input('Id', sql.NVarChar(40), id)
        .query(`
            SELECT Id, Seccion, Titulo, Cliente, Categoria, NombreOriginal, NombreGuardado,
                   TipoMime, TamanoBytes, Hash, VersionActual, Descripcion, Eliminado,
                   CreadoEn, ActualizadoEn
            FROM dbo.Documentos
            WHERE Id = @Id
        `);

    const doc = result.recordset[0];
    if (!doc) return null;
    const mapa = await etiquetasPorDocumento(pool, [doc.Id]);
    doc.Etiquetas = mapa.get(doc.Id) || [];
    return doc;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(datos) {
    try {
        const pool = await getPool();

        const seccion = limpiar(datos?.seccion, 60);
        const titulo = limpiar(datos?.titulo, 200);
        const nombreOriginal = limpiar(datos?.nombreOriginal, 260);
        const nombreGuardado = limpiar(datos?.nombreGuardado, 260);
        const contenido = binario(datos?.contenido);

        if (!seccion) return { ok: false, mensaje: 'Selecciona una sección.' };
        if (!titulo) return { ok: false, mensaje: 'Escribe un título para el documento.' };
        if (!nombreOriginal || !nombreGuardado) return { ok: false, mensaje: 'No se recibió el archivo a guardar.' };

        const existe = await pool.request()
            .input('Id', sql.NVarChar(60), seccion)
            .query('SELECT 1 FROM dbo.Secciones WHERE Id = @Id');
        if (!existe.recordset.length) return { ok: false, mensaje: 'La sección seleccionada no existe.' };

        const id = `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
        const ahora = Date.now();

        await pool.request()
            .input('Id', sql.NVarChar(40), id)
            .input('Seccion', sql.NVarChar(60), seccion)
            .input('Titulo', sql.NVarChar(200), titulo)
            .input('Cliente', sql.NVarChar(60), limpiar(datos?.cliente, 60))
            .input('Categoria', sql.NVarChar(100), limpiar(datos?.categoria, 100))
            .input('NombreOriginal', sql.NVarChar(260), nombreOriginal)
            .input('NombreGuardado', sql.NVarChar(260), nombreGuardado)
            .input('Contenido', sql.VarBinary(sql.MAX), contenido)
            .input('TipoMime', sql.NVarChar(150), limpiar(datos?.tipoMime, 150) || 'application/octet-stream')
            .input('TamanoBytes', sql.BigInt, numero(datos?.tamanoBytes) || (contenido ? contenido.length : 0))
            .input('Hash', sql.Char(64), String(datos?.hash || '').substring(0, 64))
            .input('Descripcion', sql.NVarChar(1000), limpiar(datos?.descripcion, 1000))
            .input('CreadoEn', sql.BigInt, ahora)
            .input('ActualizadoEn', sql.BigInt, ahora)
            .query(`
                INSERT INTO dbo.Documentos
                    (Id, Seccion, Titulo, Cliente, Categoria, NombreOriginal, NombreGuardado, Contenido,
                     TipoMime, TamanoBytes, Hash, VersionActual, Descripcion, Eliminado, CreadoEn, ActualizadoEn)
                VALUES
                    (@Id, @Seccion, @Titulo, @Cliente, @Categoria, @NombreOriginal, @NombreGuardado, @Contenido,
                     @TipoMime, @TamanoBytes, @Hash, 1, @Descripcion, 0, @CreadoEn, @ActualizadoEn)
            `);

        await guardarEtiquetas(pool, id, datos?.etiquetas);
        return { ok: true, mensaje: 'Documento guardado correctamente.', id };
    } catch (err) {
        return { ok: false, mensaje: 'Error al guardar el documento: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR METADATOS
   ========================================================= */
async function actualizar(id, datos) {
    try {
        const pool = await getPool();

        const titulo = limpiar(datos?.titulo, 200);
        const seccion = limpiar(datos?.seccion, 60);
        if (!titulo) return { ok: false, mensaje: 'Escribe un título para el documento.' };
        if (!seccion) return { ok: false, mensaje: 'Selecciona una sección.' };

        const result = await pool.request()
            .input('Id', sql.NVarChar(40), id)
            .input('Seccion', sql.NVarChar(60), seccion)
            .input('Titulo', sql.NVarChar(200), titulo)
            .input('Cliente', sql.NVarChar(60), limpiar(datos?.cliente, 60))
            .input('Categoria', sql.NVarChar(100), limpiar(datos?.categoria, 100))
            .input('Descripcion', sql.NVarChar(1000), limpiar(datos?.descripcion, 1000))
            .input('ActualizadoEn', sql.BigInt, Date.now())
            .query(`
                UPDATE dbo.Documentos
                   SET Seccion = @Seccion, Titulo = @Titulo, Cliente = @Cliente,
                       Categoria = @Categoria, Descripcion = @Descripcion,
                       ActualizadoEn = @ActualizadoEn
                 WHERE Id = @Id
            `);

        if (result.rowsAffected[0] === 0) return { ok: false, mensaje: 'El documento ya no existe.' };

        await guardarEtiquetas(pool, id, datos?.etiquetas);
        return { ok: true, mensaje: 'Documento actualizado correctamente.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al actualizar el documento: ' + err.message };
    }
}

/* =========================================================
   VERSIONES
   ========================================================= */
async function listarVersiones(documentoId) {
    const pool = await getPool();
    const result = await pool.request()
        .input('DocumentoId', sql.NVarChar(40), documentoId)
        .query(`
            SELECT Id, DocumentoId, NumeroVersion, NombreGuardado, NombreOriginal,
                   Hash, TamanoBytes, TipoMime, CreadoEn
            FROM dbo.VersionesDocumento
            WHERE DocumentoId = @DocumentoId
            ORDER BY NumeroVersion DESC
        `);
    return result.recordset;
}

async function agregarVersion(documentoId, datos) {
    try {
        const pool = await getPool();

        const actual = await pool.request()
            .input('Id', sql.NVarChar(40), documentoId)
            .query('SELECT VersionActual, NombreOriginal FROM dbo.Documentos WHERE Id = @Id');
        if (!actual.recordset.length) return { ok: false, mensaje: 'El documento ya no existe.' };

        const versionActual = actual.recordset[0].VersionActual || 1;
        const numero = versionActual + 1;
        const id = `ver_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
        const ahora = Date.now();
        const nombreOriginal = limpiar(datos?.nombreOriginal, 260) || actual.recordset[0].NombreOriginal;
        const nombreGuardado = limpiar(datos?.nombreGuardado, 260);
        if (!nombreGuardado) return { ok: false, mensaje: 'No se recibió el archivo de la nueva versión.' };
        const contenido = binario(datos?.contenido);
        const tamano = numero(datos?.tamanoBytes) || (contenido ? contenido.length : 0);

        await pool.request()
            .input('Id', sql.NVarChar(40), id)
            .input('DocumentoId', sql.NVarChar(40), documentoId)
            .input('NumeroVersion', sql.Int, numero)
            .input('NombreGuardado', sql.NVarChar(260), nombreGuardado)
            .input('NombreOriginal', sql.NVarChar(260), nombreOriginal)
            .input('Contenido', sql.VarBinary(sql.MAX), contenido)
            .input('Hash', sql.Char(64), String(datos?.hash || '').substring(0, 64))
            .input('TamanoBytes', sql.BigInt, tamano)
            .input('TipoMime', sql.NVarChar(150), limpiar(datos?.tipoMime, 150) || 'application/octet-stream')
            .input('CreadoEn', sql.BigInt, ahora)
            .query(`
                INSERT INTO dbo.VersionesDocumento
                    (Id, DocumentoId, NumeroVersion, NombreGuardado, NombreOriginal,
                     Contenido, Hash, TamanoBytes, TipoMime, CreadoEn)
                VALUES
                    (@Id, @DocumentoId, @NumeroVersion, @NombreGuardado, @NombreOriginal,
                     @Contenido, @Hash, @TamanoBytes, @TipoMime, @CreadoEn)
            `);

        await pool.request()
            .input('Id', sql.NVarChar(40), documentoId)
            .input('VersionActual', sql.Int, numero)
            .input('NombreGuardado', sql.NVarChar(260), nombreGuardado)
            .input('NombreOriginal', sql.NVarChar(260), nombreOriginal)
            .input('Contenido', sql.VarBinary(sql.MAX), contenido)
            .input('Hash', sql.Char(64), String(datos?.hash || '').substring(0, 64))
            .input('TamanoBytes', sql.BigInt, tamano)
            .input('TipoMime', sql.NVarChar(150), limpiar(datos?.tipoMime, 150) || 'application/octet-stream')
            .input('ActualizadoEn', sql.BigInt, ahora)
            .query(`
                UPDATE dbo.Documentos
                   SET VersionActual = @VersionActual, NombreGuardado = @NombreGuardado,
                       NombreOriginal = @NombreOriginal, Contenido = @Contenido,
                       Hash = @Hash, TamanoBytes = @TamanoBytes, TipoMime = @TipoMime,
                       ActualizadoEn = @ActualizadoEn
                 WHERE Id = @Id
            `);

        return { ok: true, mensaje: `Versión ${numero} registrada.`, version: numero };
    } catch (err) {
        return { ok: false, mensaje: 'Error al guardar la nueva versión: ' + err.message };
    }
}

/* =========================================================
   PAPELERA
   ========================================================= */
async function moverAPapelera(id) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id', sql.NVarChar(40), id)
            .input('ActualizadoEn', sql.BigInt, Date.now())
            .query('UPDATE dbo.Documentos SET Eliminado = 1, ActualizadoEn = @ActualizadoEn WHERE Id = @Id');

        if (result.rowsAffected[0] === 0) return { ok: false, mensaje: 'El documento ya no existe.' };
        return { ok: true, mensaje: 'Documento movido a la papelera.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al mover a la papelera: ' + err.message };
    }
}

async function restaurar(id) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id', sql.NVarChar(40), id)
            .input('ActualizadoEn', sql.BigInt, Date.now())
            .query('UPDATE dbo.Documentos SET Eliminado = 0, ActualizadoEn = @ActualizadoEn WHERE Id = @Id');

        if (result.rowsAffected[0] === 0) return { ok: false, mensaje: 'El documento ya no existe.' };
        return { ok: true, mensaje: 'Documento restaurado correctamente.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al restaurar el documento: ' + err.message };
    }
}

/**
 * Eliminación definitiva. El binario vive en la misma fila, así que
 * el DELETE (con ON DELETE CASCADE a versiones y etiquetas) lo borra
 * todo de la base de datos.
 */
async function eliminar(id) {
    try {
        const pool = await getPool();

        const result = await pool.request()
            .input('Id', sql.NVarChar(40), id)
            .query('DELETE FROM dbo.Documentos WHERE Id = @Id');

        if (result.rowsAffected[0] === 0) return { ok: false, mensaje: 'El documento ya no existe.' };
        return { ok: true, mensaje: 'Documento eliminado definitivamente.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al eliminar el documento: ' + err.message };
    }
}

/* =========================================================
   ARCHIVO (binario en la base de datos)
   ========================================================= */

/**
 * Devuelve el binario de un documento o de una de sus versiones a
 * partir de su clave lógica (NombreGuardado). Busca primero en la
 * versión vigente y luego en el histórico.
 */
async function obtenerArchivo(nombreGuardado) {
    const pool = await getPool();
    const result = await pool.request()
        .input('Nombre', sql.NVarChar(260), String(nombreGuardado || ''))
        .query(`
            SELECT TOP (1) NombreOriginal, TipoMime, TamanoBytes, Contenido
            FROM (
                SELECT NombreOriginal, TipoMime, TamanoBytes, Contenido, 0 AS Prioridad
                  FROM dbo.Documentos
                 WHERE NombreGuardado = @Nombre
                UNION ALL
                SELECT NombreOriginal, TipoMime, TamanoBytes, Contenido, 1 AS Prioridad
                  FROM dbo.VersionesDocumento
                 WHERE NombreGuardado = @Nombre
            ) AS Archivos
            ORDER BY Prioridad
        `);

    const fila = result.recordset[0];
    if (!fila) return null;

    return {
        nombreOriginal: fila.NombreOriginal,
        tipoMime: fila.TipoMime,
        tamanoBytes: Number(fila.TamanoBytes) || 0,
        contenido: fila.Contenido && fila.Contenido.length ? fila.Contenido : null
    };
}

module.exports = {
    listarSecciones,
    crearSeccion,
    actualizarSeccion,
    eliminarSeccion,
    listarEtiquetas,
    listar,
    obtener,
    obtenerArchivo,
    crear,
    actualizar,
    listarVersiones,
    agregarVersion,
    moverAPapelera,
    restaurar,
    eliminar
};
