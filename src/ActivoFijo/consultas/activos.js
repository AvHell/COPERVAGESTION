/* =========================================================
   ACTIVO FIJO — CRUD DE EQUIPOS (inventario físico)
   Soft delete: los activos se marcan como BAJA, no se borran
   El trigger trg_AFE_AfterUpdate registra el movimiento en
   ActivoFijoHistoricos con Accion = BAJA / RESTAURACION /
   TRASLADO / ASIGNACION / EDICION
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   HELPERS
   ========================================================= */
async function getIdPorNombre(pool, tabla, pk, nombre) {
    if (!nombre) return null;
    const r = await pool.request()
        .input('Nombre', sql.NVarChar(100), String(nombre).trim().toUpperCase())
        .query(`SELECT ${pk} FROM ${tabla} WHERE UPPER(Nombre) = @Nombre`);
    return r.recordset[0]?.[pk] ?? null;
}

/* =========================================================
   LISTAR (con filtros opcionales)
   - Si soloEliminados = true → solo BAJA
   - Si no hay filtro de estatus → excluye BAJA
   ========================================================= */
async function listar(filtros = {}) {
    const pool = await getPool();
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
            af.UsuarioAsignado,

            af.Observaciones,
            af.FechaCreacion,
            af.FechaModificacion
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
                vol.Nombre AS Voltaje
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
            WHERE af.IdActivoFijoEQ = @Id
        `);
    return r.recordset[0] ?? null;
}

/* =========================================================
   CREAR
   ========================================================= */
async function crear(datos, idUsuario) {
    try {
        const pool = await getPool();

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

        let IdEstatus = null;
        if (datos.IdEstatus) {
            IdEstatus = datos.IdEstatus;
        } else if (datos.Estatus) {
            IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', datos.Estatus);
        }
        if (!IdEstatus) {
            IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', 'STOCK');
        }

        const result = await pool.request()
            .input('IdCartera',        sql.Int,           datos.IdCartera || null)
            .input('IdMarca',          sql.Int,           datos.IdMarca || null)
            .input('Modelo',           sql.NVarChar(150), datos.Modelo || null)
            .input('IdTipo',           sql.Int,           datos.IdTipo)
            .input('NoSerie',          sql.NVarChar(150), datos.NoSerie || null)
            .input('IMEI1',            sql.NVarChar(50),  datos.IMEI1 || null)
            .input('IMEI2',            sql.NVarChar(50),  datos.IMEI2 || null)
            .input('NoTelefono',       sql.NVarChar(50),  datos.NoTelefono || null)
            .input('Procesador',       sql.NVarChar(150), datos.Procesador || null)
            .input('MemoriaRAM',       sql.NVarChar(50),  datos.MemoriaRAM || null)
            .input('Almacenamiento',   sql.NVarChar(50),  datos.Almacenamiento || null)
            .input('SistemaOperativo', sql.NVarChar(100), datos.SistemaOperativo || null)
            .input('Accesorios',       sql.NVarChar(300), datos.Accesorios || null)
            .input('PrecioActivo',     sql.Decimal(18,2), datos.PrecioActivo ?? null)
            .input('IdEstado',         sql.Int,           IdEstado)
            .input('IdEstatus',        sql.Int,           IdEstatus)
            .input('IdLugarCliente',   sql.Int,           datos.IdLugarCliente || null)
            .input('IdSitio',          sql.Int,           datos.IdSitio || null)
            .input('IdSubtipo',        sql.Int,           datos.IdSubtipo || null)
            .input('IdClasificacion',  sql.Int,           datos.IdClasificacion || null)
            .input('IdTamanio',        sql.Int,           datos.IdTamanio || null)
            .input('IdCapacidad',      sql.Int,           datos.IdCapacidad || null)
            .input('IdVoltaje',        sql.Int,           datos.IdVoltaje || null)
            .input('UsuarioAsignado',  sql.NVarChar(200), datos.UsuarioAsignado || null)
            .input('Observaciones',    sql.NVarChar(500), datos.Observaciones || null)
            .input('IdUsuario',        sql.Int,           idUsuario || null)
            .query(`
                INSERT INTO ActivoFijoEquipos (
                    IdCartera, IdMarca, Modelo, IdTipo, NoSerie, IMEI1, IMEI2, NoTelefono,
                    Procesador, MemoriaRAM, Almacenamiento, SistemaOperativo, Accesorios,
                    PrecioActivo, IdEstado, IdEstatus, IdLugarCliente,
                    IdSitio, IdSubtipo, IdClasificacion, IdTamanio, IdCapacidad, IdVoltaje,
                    UsuarioAsignado,
                    Observaciones, IdUsuarioCreacion
                ) VALUES (
                    @IdCartera, @IdMarca, @Modelo, @IdTipo, @NoSerie, @IMEI1, @IMEI2, @NoTelefono,
                    @Procesador, @MemoriaRAM, @Almacenamiento, @SistemaOperativo, @Accesorios,
                    @PrecioActivo, @IdEstado, @IdEstatus, @IdLugarCliente,
                    @IdSitio, @IdSubtipo, @IdClasificacion, @IdTamanio, @IdCapacidad, @IdVoltaje,
                    @UsuarioAsignado,
                    @Observaciones, @IdUsuario
                );
                SELECT SCOPE_IDENTITY() AS Id;
            `);

        return { ok: true, mensaje: 'Activo creado correctamente.', id: result.recordset[0].Id };
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

        const actual = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT IdTipo, IdEstado, IdEstatus
                FROM ActivoFijoEquipos
                WHERE IdActivoFijoEQ = @Id
            `);

        if (actual.recordset.length === 0) {
            return { ok: false, mensaje: 'El activo ya no existe.' };
        }

        const current = actual.recordset[0];

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
        if (datos.IMEI2) {
            const dup = await pool.request()
                .input('IMEI2', sql.NVarChar(50), datos.IMEI2)
                .input('Id', sql.Int, id)
                .query('SELECT 1 FROM ActivoFijoEquipos WHERE (IMEI1 = @IMEI2 OR IMEI2 = @IMEI2) AND IdActivoFijoEQ <> @Id');
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe otro activo con IMEI2 "${datos.IMEI2}".` };
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

        let IdTipo = null;
        if (datos.IdTipo) {
            IdTipo = datos.IdTipo;
        } else if (datos.Tipo) {
            IdTipo = await getIdPorNombre(pool, 'ActivoFijoTipos', 'IdTipo', datos.Tipo);
        }
        if (!IdTipo) IdTipo = current.IdTipo;
        if (!IdTipo) return { ok: false, mensaje: 'El tipo es obligatorio.' };

        let IdEstado = null;
        if (datos.IdEstado) {
            IdEstado = datos.IdEstado;
        } else if (datos.Estado) {
            IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', datos.Estado);
        }
        if (!IdEstado) IdEstado = current.IdEstado;
        if (!IdEstado) IdEstado = await getIdPorNombre(pool, 'ActivoFijoEstados', 'IdEstado', 'VALIDAR');

        let IdEstatus = null;
        if (datos.IdEstatus) {
            IdEstatus = datos.IdEstatus;
        } else if (datos.Estatus) {
            IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', datos.Estatus);
        }
        if (!IdEstatus) IdEstatus = current.IdEstatus;
        if (!IdEstatus) IdEstatus = await getIdPorNombre(pool, 'ActivoFijoEstatus', 'IdEstatus', 'STOCK');

        const result = await pool.request()
            .input('Id',               sql.Int,           id)
            .input('IdCartera',        sql.Int,           datos.IdCartera || null)
            .input('IdMarca',          sql.Int,           datos.IdMarca || null)
            .input('Modelo',           sql.NVarChar(150), datos.Modelo || null)
            .input('IdTipo',           sql.Int,           IdTipo)
            .input('NoSerie',          sql.NVarChar(150), datos.NoSerie || null)
            .input('IMEI1',            sql.NVarChar(50),  datos.IMEI1 || null)
            .input('IMEI2',            sql.NVarChar(50),  datos.IMEI2 || null)
            .input('NoTelefono',       sql.NVarChar(50),  datos.NoTelefono || null)
            .input('Procesador',       sql.NVarChar(150), datos.Procesador || null)
            .input('MemoriaRAM',       sql.NVarChar(50),  datos.MemoriaRAM || null)
            .input('Almacenamiento',   sql.NVarChar(50),  datos.Almacenamiento || null)
            .input('SistemaOperativo', sql.NVarChar(100), datos.SistemaOperativo || null)
            .input('Accesorios',       sql.NVarChar(300), datos.Accesorios || null)
            .input('PrecioActivo',     sql.Decimal(18,2), datos.PrecioActivo ?? null)
            .input('IdEstado',         sql.Int,           IdEstado)
            .input('IdEstatus',        sql.Int,           IdEstatus)
            .input('IdLugarCliente',   sql.Int,           datos.IdLugarCliente || null)
            .input('IdSitio',          sql.Int,           datos.IdSitio || null)
            .input('IdSubtipo',        sql.Int,           datos.IdSubtipo || null)
            .input('IdClasificacion',  sql.Int,           datos.IdClasificacion || null)
            .input('IdTamanio',        sql.Int,           datos.IdTamanio || null)
            .input('IdCapacidad',      sql.Int,           datos.IdCapacidad || null)
            .input('IdVoltaje',        sql.Int,           datos.IdVoltaje || null)
            .input('UsuarioAsignado',  sql.NVarChar(200), datos.UsuarioAsignado || null)
            .input('Observaciones',    sql.NVarChar(500), datos.Observaciones || null)
            .input('IdUsuario',        sql.Int,           idUsuario || null)
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
                    IdSitio = @IdSitio,
                    IdSubtipo = @IdSubtipo,
                    IdClasificacion = @IdClasificacion,
                    IdTamanio = @IdTamanio,
                    IdCapacidad = @IdCapacidad,
                    IdVoltaje = @IdVoltaje,
                    UsuarioAsignado = @UsuarioAsignado,
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
   ELIMINAR (Soft delete) — Marca como BAJA
   - Valida responsivas activas (doble check: antes y en el UPDATE)
   - NO borra nada, solo cambia IdEstatus
   - El trigger trg_AFE_AfterUpdate registra el movimiento
   - Si viene motivo, lo pega al histórico del BAJA recién creado
   ========================================================= */
async function eliminar(id, idUsuario, motivo = null) {
    try {
        const pool = await getPool();

        // 1. Validar responsivas activas (mensaje amigable)
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

        // 2. UPDATE atómico con doble validación
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

        // 3. Guardar motivo en el histórico más reciente del BAJA
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
   RESTAURAR — Saca un activo de BAJA y lo vuelve a STOCK
   ========================================================= */
async function restaurar(id, idUsuario, motivo = null) {
    try {
        const pool = await getPool();

        const result = await pool.request()
            .input('Id',     sql.Int, id)
            .input('IdUser', sql.Int, idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus             = (SELECT IdEstatus FROM ActivoFijoEstatus WHERE Nombre = 'DISPONIBLE'),
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
   HISTÓRICO — Movimientos de un activo
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
            LEFT JOIN Usuarios           u    ON u.IdUsuario   = h.IdUsuarioMovimiento
            WHERE h.IdActivoFijoEQ = @Id
            ORDER BY h.FechaMovimiento DESC
        `);
    return r.recordset;
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

module.exports = {
    listar, obtener, crear, actualizar, eliminar, restaurar, historico,
    listarTipos, listarMarcas, listarEstados, listarEstatus, listarCarteras,
    listarSitios, listarSubtipos, listarVoltajes,
    listarClasificaciones, listarTamanios, listarCapacidades
};