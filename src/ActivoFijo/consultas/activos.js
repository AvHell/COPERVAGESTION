/* =========================================================
   ACTIVO FIJO — CRUD DE EQUIPOS (inventario físico)
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   HELPERS — obtener IDs por nombre
   ========================================================= */
async function getIdPorNombre(pool, tabla, pk, nombre) {
    if (!nombre) return null;
    const r = await pool.request()
        .input('Nombre', sql.NVarChar(100), nombre)
        .query(`SELECT ${pk} FROM ${tabla} WHERE Nombre = @Nombre`);
    return r.recordset[0]?.[pk] ?? null;
}

/* =========================================================
   LISTAR (con filtros opcionales)
   ========================================================= */
async function listar(filtros = {}) {
    const pool = await getPool();
    const request = pool.request();

    let where = '1=1';
    if (filtros.idTipo)    { where += ' AND af.IdTipo = @IdTipo';        request.input('IdTipo',    sql.Int, filtros.idTipo); }
    if (filtros.idEstado)  { where += ' AND af.IdEstado = @IdEstado';    request.input('IdEstado',  sql.Int, filtros.idEstado); }
    if (filtros.idEstatus) { where += ' AND af.IdEstatus = @IdEstatus';  request.input('IdEstatus', sql.Int, filtros.idEstatus); }
    if (filtros.idCartera) { where += ' AND af.IdCartera = @IdCartera';  request.input('IdCartera', sql.Int, filtros.idCartera); }

    const result = await request.query(`
        SELECT
            af.IdActivoFijoEQ,
            af.IdCartera,
            c.Nombre        AS Cartera,
            af.IdMarca,
            m.Nombre        AS Marca,
            af.Modelo,
            af.IdTipo,
            t.Nombre        AS Tipo,
            t.RequiereResponsiva,
            t.RequiereIMEI,
            t.RequiereTelefono,
            af.NoSerie,
            af.IMEI1,
            af.IMEI2,
            af.NoTelefono,
            af.Procesador,
            af.MemoriaRAM,
            af.Almacenamiento,
            af.SistemaOperativo,
            af.Accesorios,
            af.PrecioActivo,
            af.IdEstado,
            es.Nombre       AS Estado,
            af.IdEstatus,
            st.Nombre       AS Estatus,
            af.IdLugarCliente,
            af.Observaciones,
            af.FechaCreacion,
            af.FechaModificacion
        FROM ActivoFijoEquipos af
        LEFT  JOIN ActivoFijoCarteras c  ON c.IdCartera = af.IdCartera
        LEFT  JOIN ActivoFijoMarcas   m  ON m.IdMarca   = af.IdMarca
        INNER JOIN ActivoFijoTipos    t  ON t.IdTipo    = af.IdTipo
        INNER JOIN ActivoFijoEstados  es ON es.IdEstado = af.IdEstado
        INNER JOIN ActivoFijoEstatus  st ON st.IdEstatus = af.IdEstatus
        WHERE ${where}
        ORDER BY af.IdActivoFijoEQ DESC
    `);
    return result.recordset;
}

/* =========================================================
   OBTENER UNO POR ID
   ========================================================= */
async function obtener(id) {
    const pool = await getPool();
    const r = await pool.request()
        .input('Id', sql.Int, id)
        .query(`
            SELECT
                af.*,
                c.Nombre  AS Cartera,
                m.Nombre  AS Marca,
                t.Nombre  AS Tipo,
                es.Nombre AS Estado,
                st.Nombre AS Estatus
            FROM ActivoFijoEquipos af
            LEFT  JOIN ActivoFijoCarteras c  ON c.IdCartera = af.IdCartera
            LEFT  JOIN ActivoFijoMarcas   m  ON m.IdMarca   = af.IdMarca
            INNER JOIN ActivoFijoTipos    t  ON t.IdTipo    = af.IdTipo
            INNER JOIN ActivoFijoEstados  es ON es.IdEstado = af.IdEstado
            INNER JOIN ActivoFijoEstatus  st ON st.IdEstatus = af.IdEstatus
            WHERE af.IdActivoFijoEQ = @Id
        `);
    return r.recordset[0] ?? null;
}

/* =========================================================
   CREAR
   Reglas:
   - IdEstado  = VALIDAR (default)
   - IdEstatus = STOCK   (default)
   - IdLugarCliente = NULL (Sótano se maneja por convención)
   ========================================================= */
async function crear(datos, idUsuario) {
    try {
        const pool = await getPool();

        // Validar duplicados por NoSerie / IMEI / NoTelefono
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

        // Resolver IDs por nombre (más amigable desde el frontend)
        const IdEstado  = await getIdPorNombre(pool, 'ActivoFijoEstados',  'IdEstado',  datos.Estado  || 'VALIDAR');
        const IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus',  'IdEstatus', datos.Estatus || 'STOCK');

        const result = await pool.request()
            .input('IdCartera',      sql.Int,           datos.IdCartera || null)
            .input('IdMarca',        sql.Int,           datos.IdMarca || null)
            .input('Modelo',         sql.NVarChar(150), datos.Modelo || null)
            .input('IdTipo',         sql.Int,           datos.IdTipo)
            .input('NoSerie',        sql.NVarChar(150), datos.NoSerie || null)
            .input('IMEI1',          sql.NVarChar(50),  datos.IMEI1 || null)
            .input('IMEI2',          sql.NVarChar(50),  datos.IMEI2 || null)
            .input('NoTelefono',     sql.NVarChar(50),  datos.NoTelefono || null)
            .input('Procesador',     sql.NVarChar(150), datos.Procesador || null)
            .input('MemoriaRAM',     sql.NVarChar(50),  datos.MemoriaRAM || null)
            .input('Almacenamiento', sql.NVarChar(50),  datos.Almacenamiento || null)
            .input('SistemaOperativo', sql.NVarChar(100), datos.SistemaOperativo || null)
            .input('Accesorios',     sql.NVarChar(300), datos.Accesorios || null)
            .input('PrecioActivo',   sql.Decimal(18,2), datos.PrecioActivo ?? null)
            .input('IdEstado',       sql.Int,           IdEstado)
            .input('IdEstatus',      sql.Int,           IdEstatus)
            .input('IdLugarCliente', sql.Int,           datos.IdLugarCliente || null)
            .input('Observaciones',  sql.NVarChar(500), datos.Observaciones || null)
            .input('IdUsuario',      sql.Int,           idUsuario || null)
            .query(`
                INSERT INTO ActivoFijoEquipos (
                    IdCartera, IdMarca, Modelo, IdTipo, NoSerie, IMEI1, IMEI2, NoTelefono,
                    Procesador, MemoriaRAM, Almacenamiento, SistemaOperativo, Accesorios,
                    PrecioActivo, IdEstado, IdEstatus, IdLugarCliente, Observaciones,
                    IdUsuarioCreacion
                ) VALUES (
                    @IdCartera, @IdMarca, @Modelo, @IdTipo, @NoSerie, @IMEI1, @IMEI2, @NoTelefono,
                    @Procesador, @MemoriaRAM, @Almacenamiento, @SistemaOperativo, @Accesorios,
                    @PrecioActivo, @IdEstado, @IdEstatus, @IdLugarCliente, @Observaciones,
                    @IdUsuario
                );
                SELECT SCOPE_IDENTITY() AS Id;
            `);

        return { ok: true, mensaje: 'Activo creado correctamente.', id: result.recordset[0].Id };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un activo con ese valor único (serie, IMEI o teléfono).' };
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

        // Validar duplicados excluyendo el propio
        if (datos.NoSerie) {
            const dup = await pool.request()
                .input('NoSerie', sql.NVarChar(150), datos.NoSerie)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoSerie = @NoSerie AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con NoSerie "${datos.NoSerie}".` };
            }
        }
        if (datos.IMEI1) {
            const dup = await pool.request()
                .input('IMEI1', sql.NVarChar(50), datos.IMEI1)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE (IMEI1 = @IMEI1 OR IMEI2 = @IMEI1) AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con IMEI1 "${datos.IMEI1}".` };
            }
        }
        if (datos.NoTelefono) {
            const dup = await pool.request()
                .input('NoTelefono', sql.NVarChar(50), datos.NoTelefono)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE NoTelefono = @NoTelefono AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con NoTeléfono "${datos.NoTelefono}".` };
            }
        }

        const IdEstado  = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado',  datos.Estado);
        const IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', datos.Estatus);

        const result = await pool.request()
            .input('Id',             sql.Int,           id)
            .input('IdCartera',      sql.Int,           datos.IdCartera || null)
            .input('IdMarca',        sql.Int,           datos.IdMarca || null)
            .input('Modelo',         sql.NVarChar(150), datos.Modelo || null)
            .input('IdTipo',         sql.Int,           datos.IdTipo)
            .input('NoSerie',        sql.NVarChar(150), datos.NoSerie || null)
            .input('IMEI1',          sql.NVarChar(50),  datos.IMEI1 || null)
            .input('IMEI2',          sql.NVarChar(50),  datos.IMEI2 || null)
            .input('NoTelefono',     sql.NVarChar(50),  datos.NoTelefono || null)
            .input('Procesador',     sql.NVarChar(150), datos.Procesador || null)
            .input('MemoriaRAM',     sql.NVarChar(50),  datos.MemoriaRAM || null)
            .input('Almacenamiento', sql.NVarChar(50),  datos.Almacenamiento || null)
            .input('SistemaOperativo', sql.NVarChar(100), datos.SistemaOperativo || null)
            .input('Accesorios',     sql.NVarChar(300), datos.Accesorios || null)
            .input('PrecioActivo',   sql.Decimal(18,2), datos.PrecioActivo ?? null)
            .input('IdEstado',       sql.Int,           IdEstado)
            .input('IdEstatus',      sql.Int,           IdEstatus)
            .input('IdLugarCliente', sql.Int,           datos.IdLugarCliente || null)
            .input('Observaciones',  sql.NVarChar(500), datos.Observaciones || null)
            .input('IdUsuario',      sql.Int,           idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdCartera = @IdCartera,
                    IdMarca = @IdMarca,
                    Modelo = @Modelo,
                    IdTipo = @IdTipo,
                    NoSerie = @NoSerie,
                    IMEI1 = @IMEI1,
                    IMEI2 = @IMEI2,
                    NoTelefono = @NoTelefono,
                    Procesador = @Procesador,
                    MemoriaRAM = @MemoriaRAM,
                    Almacenamiento = @Almacenamiento,
                    SistemaOperativo = @SistemaOperativo,
                    Accesorios = @Accesorios,
                    PrecioActivo = @PrecioActivo,
                    IdEstado = @IdEstado,
                    IdEstatus = @IdEstatus,
                    IdLugarCliente = @IdLugarCliente,
                    Observaciones = @Observaciones,
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdActivoFijoEQ = @Id
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El activo ya no existe.' };
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
   ELIMINAR
   ========================================================= */
async function eliminar(id) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id', sql.Int, id)
            .query('DELETE FROM ActivoFijoEquipos WHERE IdActivoFijoEQ = @Id');

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El activo ya no existe.' };
        }
        return { ok: true, mensaje: 'Activo eliminado correctamente.' };
    } catch (err) {
        if (err.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar: tiene responsivas o históricos asociados.' };
        }
        return { ok: false, mensaje: 'Error al eliminar: ' + err.message };
    }
}

/* =========================================================
   CATÁLOGOS AUXILIARES (para los selects del formulario)
   ========================================================= */
async function listarTipos() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdTipo, Nombre, RequiereResponsiva, RequiereIMEI, RequiereTelefono FROM ActivoFijoTipos WHERE Activo = 1 ORDER BY Nombre'
    );
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

module.exports = {
    listar, obtener, crear, actualizar, eliminar,
    listarTipos, listarMarcas, listarEstados, listarEstatus, listarCarteras
};