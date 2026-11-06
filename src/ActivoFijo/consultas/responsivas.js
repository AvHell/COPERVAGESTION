/* =========================================================
   ACTIVO FIJO — CRUD DE RESPONSIVAS
   Soft delete: al cancelar NO se borra, queda como histórico
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');
const catalogosDB = require('./catalogos');

/* =========================================================
   LISTAR
   - filtros.idEstatus        → filtra por ese estatus exacto
   - filtros.soloCancelados   → solo CANCELADO
   - por defecto              → oculta CANCELADO
   ========================================================= */
async function listar(filtros = {}) {
    const pool = await getPool();
    const request = pool.request();

    let where = '1=1';

    if (filtros.soloCancelados) {
        where += " AND r.EstatusResponsiva = 'CANCELADO'";
    } else if (filtros.idEstatus) {
        where += ' AND r.EstatusResponsiva = @Estatus';
        request.input('Estatus', sql.NVarChar(30), filtros.idEstatus);
    } else {
        where += " AND r.EstatusResponsiva <> 'CANCELADO'";
    }

    if (filtros.idTipo) {
        where += ' AND af.IdTipo = @IdTipo';
        request.input('IdTipo', sql.Int, filtros.idTipo);
    }

    const result = await request.query(`
        SELECT
            r.IdResponsiva,
            r.FolioTicket,
            r.TipoResponsiva,
            r.FechaAsignacion,
            r.FechaDevolucionProgramada,
            r.FechaDevolucionReal,
            r.EstatusResponsiva,
            r.MotivoSalida,
            r.NombreProyecto,
            r.DescripcionSolicitud,
            r.Observaciones,
            r.NombreRecibe,
            r.PuestoRecibe,
            r.CorreoRecibe,
            r.NombreEntrega,
            r.PuestoEntrega,
            r.AreaEntrega,
            r.IdCartera,
            r.IdPuesto,
            r.FechaCreacion,
            r.FechaModificacion,
            r.IdUsuarioModificacion,

            af.IdActivoFijoEQ,
            af.NoSerie,
            af.IMEI1,
            af.IMEI2,
            af.NoTelefono,
            af.Modelo,
            af.PrecioActivo,
            af.UsuarioAsignado,
            (
                SELECT TOP 1 u.IdUsuario
                FROM Usuarios u
                WHERE u.Activo = 1
                  AND UPPER(COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.Nombres, ' ', u.Apellidos))), ''), u.NombreUsuario)) =
                      UPPER(LTRIM(RTRIM(r.NombreEntrega)))
                ORDER BY u.IdUsuario
            ) AS IdUsuarioEntrega,
            m.Nombre     AS Marca,
            t.Nombre     AS Tipo,
            es.Nombre    AS Estado,
            st.Nombre    AS EstatusActivo,

            c.Nombre     AS Cartera
        FROM ActivoFijoResponsivas r
        INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
        INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
        INNER JOIN ActivoFijoEstados es ON es.IdEstado = af.IdEstado
        INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
        LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
        LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera
        WHERE ${where}
        ORDER BY r.IdResponsiva DESC
    `);
    return result.recordset;
}

/* =========================================================
   OBTENER POR ID
   ========================================================= */
async function obtener(id) {
    const pool = await getPool();
    const r = await pool.request()
        .input('Id', sql.Int, id)
        .query(`
            SELECT
                r.IdResponsiva,
                r.FolioTicket,
                r.TipoResponsiva,
                r.FechaAsignacion,
                r.FechaDevolucionProgramada,
                r.FechaDevolucionReal,
                r.EstatusResponsiva,
                r.MotivoSalida,
                r.NombreProyecto,
                r.DescripcionSolicitud,
                r.Observaciones,
                r.NombreRecibe,
                r.PuestoRecibe,
                r.CorreoRecibe,
                r.NombreEntrega,
                r.PuestoEntrega,
                r.AreaEntrega,
                r.IdCartera,
                r.IdPuesto,
                af.NoSerie,
                af.IMEI1,
                af.IMEI2,
                af.NoTelefono,
                af.Modelo,
                af.PrecioActivo,
                af.Procesador,
                af.MemoriaRAM,
                af.Almacenamiento,
                af.Accesorios,
                m.Nombre  AS Marca,
                t.Nombre  AS Tipo,
                t.RequiereIMEI,
                t.RequiereTelefono
            FROM ActivoFijoResponsivas r
            INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
            INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
            LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
            WHERE r.IdResponsiva = @Id
        `);
    return r.recordset[0] ?? null;
}

/* =========================================================
   OBTENER DATOS COMPLETOS PARA PDF
   ========================================================= */
async function obtenerParaPDF(id) {
    const pool = await getPool();
    const r = await pool.request()
        .input('Id', sql.Int, id)
        .query(`
            SELECT
                r.IdResponsiva,
                r.FolioTicket,
                r.TipoResponsiva,
                r.FechaAsignacion,
                r.FechaDevolucionProgramada,
                r.FechaDevolucionReal,
                r.EstatusResponsiva,
                r.MotivoSalida,
                r.NombreProyecto,
                r.DescripcionSolicitud,
                r.Observaciones,

                r.NombreRecibe,
                r.PuestoRecibe,
                r.CorreoRecibe,

                r.NombreEntrega,
                r.PuestoEntrega,
                r.AreaEntrega,

                af.IdActivoFijoEQ,
                af.NoSerie,
                af.IMEI1,
                af.IMEI2,
                af.NoTelefono,
                af.Modelo,
                af.PrecioActivo,
                af.Procesador,
                af.MemoriaRAM,
                af.Almacenamiento,
                af.SistemaOperativo,
                af.Accesorios,

                m.Nombre  AS Marca,
                t.Nombre  AS Tipo,
                t.RequiereIMEI,
                t.RequiereTelefono,

                c.Nombre  AS Cartera
            FROM ActivoFijoResponsivas r
            INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
            INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
            LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
            LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera
            WHERE r.IdResponsiva = @Id
        `);
    return r.recordset[0] ?? null;
}

/* =========================================================
   ACTIVOS DISPONIBLES PARA ASIGNAR
   Excluye los que ya tienen responsiva activa
   ========================================================= */
async function activosDisponibles() {
    await catalogosDB.asegurarCatalogosExtendidos();
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            af.IdActivoFijoEQ,
            af.NoSerie,
            af.IMEI1,
            af.IMEI2,
            af.NoTelefono,
            af.Modelo,
            af.PrecioActivo,
            m.Nombre  AS Marca,
            t.Nombre  AS Tipo,
            t.RequiereIMEI,
            t.RequiereTelefono,
            st.Nombre AS Estatus,
            af.Observaciones,
            af.UsuarioAsignado
        FROM ActivoFijoEquipos af
        INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
        INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
        LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
        WHERE t.RequiereResponsiva = 1
          AND st.Nombre IN ('DISPONIBLE', 'DEVUELTO', 'ASIGNADO')
          AND NOT EXISTS (
              SELECT 1
              FROM ActivoFijoResponsivas r
              WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                AND r.EstatusResponsiva IN ('ASIGNADO','PENDIENTE')
          )
        ORDER BY t.Nombre, m.Nombre, af.NoSerie
    `);
    return r.recordset;
}

async function validarCatalogosResponsiva(datos) {
    const campos = [
        ['MotivoSalida', 'motivosResponsiva'],
        ['NombreProyecto', 'proyectosResponsiva'],
        ['DescripcionSolicitud', 'descripcionesResponsiva'],
        ['AreaEntrega', 'areasEntregaResponsiva']
    ];

    for (const [campo, catalogo] of campos) {
        const valor = String(datos[campo] ?? '').trim();
        if (valor && !await catalogosDB.esValorActivo(catalogo, valor)) {
            return `El valor "${valor}" ya no está disponible en el catálogo. Actualiza la lista y vuelve a intentarlo.`;
        }
    }

    return null;
}

async function validarCarteraActiva(idCartera) {
    if (!idCartera) return false;
    const pool = await getPool();
    const r = await pool.request()
        .input('IdCartera', sql.Int, idCartera)
        .query(`
            SELECT 1 AS Existe
            FROM ActivoFijoCarteras
            WHERE IdCartera = @IdCartera
              AND Activo = 1
        `);
    return r.recordset.length > 0;
}

async function obtenerNombrePorIdCatalogo(clave, id) {
    if (!id) return null;
    await catalogosDB.asegurarCatalogosExtendidos();
    const cfg = catalogosDB.CATALOGOS[clave];
    if (!cfg) throw new Error(`Catálogo no válido: ${clave}`);

    const pool = await getPool();
    const r = await pool.request()
        .input('Id', sql.Int, id)
        .query(`SELECT Nombre FROM ${cfg.tabla} WHERE ${cfg.pk} = @Id AND Activo = 1`);
    return r.recordset[0]?.Nombre ?? null;
}

async function obtenerDatosEntrega(idUsuario, idPuesto, idArea) {
    if (!idUsuario || !idPuesto || !idArea) {
        return { ok: false, mensaje: 'Selecciona quién entrega, su puesto y su área.' };
    }

    const pool = await getPool();
    const usuario = await pool.request()
        .input('IdUsuario', sql.Int, idUsuario)
        .query(`
            SELECT COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(Nombres, ' ', Apellidos))), ''), NombreUsuario) AS Nombre
            FROM Usuarios
            WHERE IdUsuario = @IdUsuario AND Activo = 1
        `);
    if (!usuario.recordset[0]?.Nombre) {
        return { ok: false, mensaje: 'El usuario seleccionado no está activo. Actualiza la lista y vuelve a seleccionarlo.' };
    }

    const [puesto, area] = await Promise.all([
        obtenerNombrePorIdCatalogo('puestosEntregaResponsiva', idPuesto),
        obtenerNombrePorIdCatalogo('areasEntregaResponsiva', idArea)
    ]);
    if (!puesto || !area) {
        return { ok: false, mensaje: 'El puesto o el área seleccionados ya no están activos en sus catálogos.' };
    }

    return { ok: true, nombre: usuario.recordset[0].Nombre, puesto, area };
}

/* Mantiene sincronizado el catálogo "Usuarios asignados":
   todo nombre que se use como quién recibe queda registrado ahí. */
async function registrarUsuarioAsignado(nombre) {
    const valor = String(nombre ?? '').trim();
    if (!valor) return;
    try {
        await catalogosDB.asegurarCatalogosExtendidos();
        const pool = await getPool();
        await pool.request()
            .input('Nombre', sql.NVarChar(200), valor)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM dbo.ActivoFijoUsuariosAsignados
                    WHERE UPPER(Nombre) = UPPER(@Nombre)
                )
                    INSERT INTO dbo.ActivoFijoUsuariosAsignados (Nombre) VALUES (@Nombre);
            `);
    } catch (err) {
        console.error('[Responsivas] No se pudo registrar el usuario asignado en el catálogo:', err);
    }
}

async function listarCatalogoResponsiva(clave) {
    return catalogosDB.listar(validarCatalogoResponsiva(clave));
}

function validarCatalogoResponsiva(clave) {
    const claveNormalizada = typeof clave === 'string' ? clave.trim() : '';
    const permitidos = new Set([
        'carteras',
        'puestos',
        'puestosEntregaResponsiva',
        'motivosResponsiva',
        'proyectosResponsiva',
        'descripcionesResponsiva',
        'areasEntregaResponsiva',
        'usuariosAsignados'
    ]);
    if (!permitidos.has(claveNormalizada) || !catalogosDB.CATALOGOS[claveNormalizada]) {
        throw new Error(`Catálogo de responsivas no válido: ${clave}`);
    }
    return claveNormalizada;
}

async function crearCatalogoResponsiva(clave, datos) {
    return catalogosDB.crear(validarCatalogoResponsiva(clave), datos);
}

async function actualizarCatalogoResponsiva(clave, id, datos) {
    return catalogosDB.actualizar(validarCatalogoResponsiva(clave), id, datos);
}

async function eliminarCatalogoResponsiva(clave, id) {
    return catalogosDB.eliminar(validarCatalogoResponsiva(clave), id);
}

async function listarUsuariosEntrega() {
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT IdUsuario, Nombres, Apellidos, NombreUsuario
        FROM Usuarios
        WHERE Activo = 1
        ORDER BY Nombres, Apellidos
    `);
    return r.recordset;
}

/* =========================================================
   CREAR RESPONSIVA
   ========================================================= */
async function crear(datos, idUsuario) {
    let tx;
    let transaccionAbierta = false;
    try {
        const pool = await getPool();
        await catalogosDB.asegurarCatalogosExtendidos();

        const estatusResponsiva = String(datos.EstatusResponsiva || 'ASIGNADO').toUpperCase();
        if (!['ASIGNADO', 'PENDIENTE'].includes(estatusResponsiva)) {
            return { ok: false, mensaje: 'Una responsiva nueva debe iniciar como ASIGNADO o PENDIENTE.' };
        }
        if (!datos.IdActivoFijoEQ || !datos.NombreRecibe || !datos.IdUsuarioEntrega) {
            return { ok: false, mensaje: 'Selecciona un activo, indica quién lo recibe y selecciona quién entrega.' };
        }

        const errorCatalogo = await validarCatalogosResponsiva(datos);
        if (errorCatalogo) return { ok: false, mensaje: errorCatalogo };
        if (!await validarCarteraActiva(datos.IdCartera)) {
            return { ok: false, mensaje: 'Selecciona una cartera activa del catálogo.' };
        }

        await registrarUsuarioAsignado(datos.NombreRecibe);

        tx = new sql.Transaction(pool);
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        transaccionAbierta = true;

        const activo = await new sql.Request(tx)
            .input('IdActivo', sql.Int, datos.IdActivoFijoEQ)
            .query(`
                SELECT st.Nombre AS Estatus,
                       CASE WHEN EXISTS (
                           SELECT 1
                           FROM ActivoFijoResponsivas r WITH (UPDLOCK, HOLDLOCK)
                           WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                             AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                       ) THEN 1 ELSE 0 END AS TieneResponsivaActiva
                FROM ActivoFijoEquipos af WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
                WHERE af.IdActivoFijoEQ = @IdActivo
            `);
        if (activo.recordset.length === 0) {
            await tx.rollback();
            transaccionAbierta = false;
            return { ok: false, mensaje: 'El activo seleccionado no existe.' };
        }
        const estadoActivo = activo.recordset[0];
        if (estadoActivo.TieneResponsivaActiva || !['DISPONIBLE', 'DEVUELTO', 'ASIGNADO'].includes(estadoActivo.Estatus.toUpperCase())) {
            await tx.rollback();
            transaccionAbierta = false;
            return {
                ok: false,
                mensaje: estadoActivo.TieneResponsivaActiva
                    ? 'Este activo ya tiene una responsiva activa. Debe devolverse o cancelarse antes de reasignar.'
                    : `El activo tiene estatus ${estadoActivo.Estatus} y no está disponible para asignación.`
            };
        }

        const estatusAsignado = await new sql.Request(tx)
            .query(`SELECT TOP 1 IdEstatus FROM ActivoFijoEstatus WHERE UPPER(Nombre) = 'ASIGNADO' AND Activo = 1 ORDER BY IdEstatus`);
        if (estatusAsignado.recordset.length === 0) {
            await tx.rollback();
            transaccionAbierta = false;
            return { ok: false, mensaje: 'No existe el estatus ASIGNADO activo en el catálogo.' };
        }

        const entrega = await obtenerDatosEntrega(datos.IdUsuarioEntrega, datos.IdPuestoEntrega, datos.IdAreaEntregaResponsiva);
        if (!entrega.ok) {
            await tx.rollback();
            transaccionAbierta = false;
            return { ok: false, mensaje: entrega.mensaje };
        }
        const puestoRecibe = await obtenerNombrePorIdCatalogo('puestos', datos.IdPuesto);

        const result = await new sql.Request(tx)
            .input('FolioTicket',       sql.NVarChar(50),  datos.FolioTicket)
            .input('IdActivoFijoEQ',    sql.Int,           datos.IdActivoFijoEQ)
            .input('TipoResponsiva',    sql.NVarChar(50),  datos.TipoResponsiva)
            .input('FechaAsignacion',   sql.Date,          datos.FechaAsignacion)
            .input('FechaDevolucionProgramada', sql.Date,  datos.FechaDevolucionProgramada || null)
            .input('EstatusResponsiva', sql.NVarChar(30),  estatusResponsiva)
            .input('MotivoSalida',      sql.NVarChar(150), datos.MotivoSalida || null)
            .input('NombreProyecto',    sql.NVarChar(200), datos.NombreProyecto || null)
            .input('DescripcionSolicitud', sql.NVarChar(300), datos.DescripcionSolicitud || null)
            .input('Observaciones',     sql.NVarChar(500), datos.Observaciones || null)
            .input('NombreRecibe',      sql.NVarChar(200), datos.NombreRecibe)
            .input('PuestoRecibe',      sql.NVarChar(100), puestoRecibe)
            .input('CorreoRecibe',      sql.NVarChar(150), datos.CorreoRecibe || null)
            .input('IdCartera',         sql.Int,           datos.IdCartera || null)
            .input('IdPuesto',          sql.Int,           datos.IdPuesto || null)
            .input('NombreEntrega',     sql.NVarChar(200), entrega.nombre)
            .input('PuestoEntrega',     sql.NVarChar(100), entrega.puesto)
            .input('AreaEntrega',       sql.NVarChar(100), entrega.area)
            .input('IdUsuario',         sql.Int,           idUsuario || null)
            .query(`
                INSERT INTO ActivoFijoResponsivas (
                    FolioTicket, IdActivoFijoEQ, TipoResponsiva,
                    FechaAsignacion, FechaDevolucionProgramada, EstatusResponsiva,
                    MotivoSalida, NombreProyecto, DescripcionSolicitud, Observaciones,
                    NombreRecibe, PuestoRecibe, CorreoRecibe, IdCartera, IdPuesto,
                    NombreEntrega, PuestoEntrega, AreaEntrega,
                    IdUsuarioCreacion
                ) VALUES (
                    @FolioTicket, @IdActivoFijoEQ, @TipoResponsiva,
                    @FechaAsignacion, @FechaDevolucionProgramada, @EstatusResponsiva,
                    @MotivoSalida, @NombreProyecto, @DescripcionSolicitud, @Observaciones,
                    @NombreRecibe, @PuestoRecibe, @CorreoRecibe, @IdCartera, @IdPuesto,
                    @NombreEntrega, @PuestoEntrega, @AreaEntrega,
                    @IdUsuario
                );
                SELECT SCOPE_IDENTITY() AS Id;
            `);

        await new sql.Request(tx)
            .input('IdActivo', sql.Int, datos.IdActivoFijoEQ)
            .input('IdEstatus', sql.Int, estatusAsignado.recordset[0].IdEstatus)
            .input('IdUsuario', sql.Int, idUsuario || null)
            .query(`
                UPDATE ActivoFijoEquipos SET
                    IdEstatus = @IdEstatus,
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdActivoFijoEQ = @IdActivo
            `);

        await tx.commit();
        transaccionAbierta = false;
        return { ok: true, mensaje: 'Responsiva creada correctamente.', id: result.recordset[0].Id };
    } catch (err) {
        if (tx && transaccionAbierta) {
            try { await tx.rollback(); } catch (rollbackError) {
                console.error('[Responsivas] Error al revertir asignación:', rollbackError);
            }
        }
        return { ok: false, mensaje: 'Error al crear responsiva: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR RESPONSIVA
   ========================================================= */
async function actualizar(id, datos, idUsuario) {
    try {
        const pool = await getPool();
        const actual = await pool.request()
            .input('Id', sql.Int, id)
            .query('SELECT EstatusResponsiva FROM ActivoFijoResponsivas WHERE IdResponsiva = @Id');
        if (actual.recordset.length === 0) {
            return { ok: false, mensaje: 'La responsiva ya no existe.' };
        }
        if (String(datos.EstatusResponsiva || '').toUpperCase() !== actual.recordset[0].EstatusResponsiva.toUpperCase()) {
            return { ok: false, mensaje: 'El estatus de una responsiva solo puede cambiarse mediante las acciones Devolver o Cancelar.' };
        }

        const errorCatalogo = await validarCatalogosResponsiva(datos);
        if (errorCatalogo) return { ok: false, mensaje: errorCatalogo };
        if (!await validarCarteraActiva(datos.IdCartera)) {
            return { ok: false, mensaje: 'Selecciona una cartera activa del catálogo.' };
        }
        await registrarUsuarioAsignado(datos.NombreRecibe);
        if (!datos.IdUsuarioEntrega) return { ok: false, mensaje: 'Selecciona quién entrega el activo.' };

        const entrega = await obtenerDatosEntrega(datos.IdUsuarioEntrega, datos.IdPuestoEntrega, datos.IdAreaEntregaResponsiva);
        if (!entrega.ok) return { ok: false, mensaje: entrega.mensaje };
        const puestoRecibe = await obtenerNombrePorIdCatalogo('puestos', datos.IdPuesto);

        const result = await pool.request()
            .input('Id',                sql.Int,           id)
            .input('FolioTicket',       sql.NVarChar(50),  datos.FolioTicket)
            .input('FechaAsignacion',   sql.Date,          datos.FechaAsignacion)
            .input('FechaDevolucionProgramada', sql.Date,  datos.FechaDevolucionProgramada || null)
            .input('FechaDevolucionReal', sql.Date,        datos.FechaDevolucionReal || null)
            .input('EstatusResponsiva', sql.NVarChar(30),  datos.EstatusResponsiva)
            .input('MotivoSalida',      sql.NVarChar(150), datos.MotivoSalida || null)
            .input('NombreProyecto',    sql.NVarChar(200), datos.NombreProyecto || null)
            .input('DescripcionSolicitud', sql.NVarChar(300), datos.DescripcionSolicitud || null)
            .input('Observaciones',     sql.NVarChar(500), datos.Observaciones || null)
            .input('NombreRecibe',      sql.NVarChar(200), datos.NombreRecibe)
            .input('PuestoRecibe',      sql.NVarChar(100), puestoRecibe)
            .input('CorreoRecibe',      sql.NVarChar(150), datos.CorreoRecibe || null)
            .input('IdCartera',         sql.Int,           datos.IdCartera || null)
            .input('IdPuesto',          sql.Int,           datos.IdPuesto || null)
            .input('NombreEntrega',     sql.NVarChar(200), entrega.nombre)
            .input('PuestoEntrega',     sql.NVarChar(100), entrega.puesto)
            .input('AreaEntrega',       sql.NVarChar(100), entrega.area)
            .input('IdUsuario',         sql.Int,           idUsuario || null)
            .query(`
                UPDATE ActivoFijoResponsivas SET
                    FolioTicket = @FolioTicket,
                    FechaAsignacion = @FechaAsignacion,
                    FechaDevolucionProgramada = @FechaDevolucionProgramada,
                    FechaDevolucionReal = @FechaDevolucionReal,
                    EstatusResponsiva = @EstatusResponsiva,
                    MotivoSalida = @MotivoSalida,
                    NombreProyecto = @NombreProyecto,
                    DescripcionSolicitud = @DescripcionSolicitud,
                    Observaciones = @Observaciones,
                    NombreRecibe = @NombreRecibe,
                    PuestoRecibe = @PuestoRecibe,
                    CorreoRecibe = @CorreoRecibe,
                    IdCartera = @IdCartera,
                    IdPuesto = @IdPuesto,
                    NombreEntrega = @NombreEntrega,
                    PuestoEntrega = @PuestoEntrega,
                    AreaEntrega = @AreaEntrega,
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdResponsiva = @Id
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'La responsiva ya no existe.' };
        }
        return { ok: true, mensaje: 'Responsiva actualizada correctamente.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al actualizar: ' + err.message };
    }
}

/* =========================================================
   DEVOLVER
   - Marca la responsiva como DEVUELTO
   - Libera el activo (DISPONIBLE)
   ========================================================= */
async function devolver(id, fechaDevolucionReal, observaciones, idUsuario) {
    try {
        await catalogosDB.asegurarCatalogosExtendidos();
        const pool = await getPool();

        const result = await pool.request()
            .input('Id',              sql.Int,           id)
            .input('FechaDevolucion', sql.Date,          fechaDevolucionReal)
            .input('Observaciones',   sql.NVarChar(500), observaciones || null)
            .input('IdUsuario',       sql.Int,           idUsuario || null)
            .query(`
                UPDATE ActivoFijoResponsivas SET
                    EstatusResponsiva = 'DEVUELTO',
                    FechaDevolucionReal = @FechaDevolucion,
                    Observaciones = COALESCE(@Observaciones, Observaciones),
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdResponsiva = @Id
                  AND EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'La responsiva ya estaba devuelta, cancelada o no existe.' };
        }

        // Liberar el activo
        await pool.request()
            .input('Id', sql.Int, id)
            .input('IdUsuario', sql.Int, idUsuario || null)
            .query(`
                UPDATE af SET
                    IdEstatus = (
                        SELECT TOP 1 IdEstatus
                        FROM ActivoFijoEstatus
                        WHERE UPPER(Nombre) = CASE
                            WHEN NULLIF(LTRIM(RTRIM(af.UsuarioAsignado)), '') IS NULL THEN 'DISPONIBLE'
                            ELSE 'ASIGNADO'
                        END
                          AND Activo = 1
                        ORDER BY IdEstatus
                    ),
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                FROM ActivoFijoEquipos af
                WHERE af.IdActivoFijoEQ IN (
                    SELECT IdActivoFijoEQ FROM ActivoFijoResponsivas
                    WHERE IdResponsiva = @Id
                )
                  AND NOT EXISTS (
                      SELECT 1 FROM ActivoFijoResponsivas r
                      WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                        AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                  )
            `);

        return { ok: true, mensaje: 'Devolución registrada. El activo queda libre para una nueva responsiva y conserva su usuario de inventario.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al devolver: ' + err.message };
    }
}

/* =========================================================
   CANCELAR RESPONSIVA (Soft delete → histórico)
   - NO se elimina el registro
   - Se marca como CANCELADO
   - Libera el activo si estaba asignado
   - Guarda quién canceló + motivo en Observaciones
   - NO se puede restaurar: queda como histórico
   ========================================================= */
async function eliminar(id, idUsuario, motivo = null) {
    try {
        await catalogosDB.asegurarCatalogosExtendidos();
        const pool = await getPool();

        // 1. Construir el texto de la observación de cancelación
        let textoCancel = null;
        if (motivo) {
            textoCancel = `[CANCELADA] Motivo: ${String(motivo).trim()}`;
        } else {
            textoCancel = '[CANCELADA]';
        }

        // 2. Marcar la responsiva como CANCELADA
        const result = await pool.request()
            .input('Id',        sql.Int,           id)
            .input('IdUsuario', sql.Int,           idUsuario || null)
            .input('Texto',     sql.NVarChar(500), textoCancel)
            .query(`
                UPDATE ActivoFijoResponsivas SET
                    EstatusResponsiva = 'CANCELADO',
                    Observaciones = 
                        CASE
                            WHEN Observaciones IS NULL OR LTRIM(RTRIM(Observaciones)) = ''
                                THEN @Texto
                            ELSE CONCAT(Observaciones, ' | ', @Texto)
                        END,
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                WHERE IdResponsiva = @Id
                  AND EstatusResponsiva <> 'CANCELADO'
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'La responsiva ya estaba cancelada o no existe.' };
        }

        // 3. Liberar el activo (si estaba asignado)
        await pool.request()
            .input('Id',        sql.Int, id)
            .input('IdUsuario', sql.Int, idUsuario || null)
            .query(`
                UPDATE af SET
                    IdEstatus = (
                        SELECT TOP 1 IdEstatus
                        FROM ActivoFijoEstatus
                        WHERE UPPER(Nombre) = CASE
                            WHEN NULLIF(LTRIM(RTRIM(af.UsuarioAsignado)), '') IS NULL THEN 'DISPONIBLE'
                            ELSE 'ASIGNADO'
                        END
                          AND Activo = 1
                        ORDER BY IdEstatus
                    ),
                    IdUsuarioModificacion = @IdUsuario,
                    FechaModificacion = GETDATE()
                FROM ActivoFijoEquipos af
                WHERE af.IdActivoFijoEQ IN (
                    SELECT IdActivoFijoEQ FROM ActivoFijoResponsivas
                    WHERE IdResponsiva = @Id
                )
                  AND NOT EXISTS (
                      SELECT 1 FROM ActivoFijoResponsivas r
                      WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                        AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                  )
            `);

        return {
            ok: true,
            mensaje: 'Responsiva cancelada. El activo queda libre para una nueva responsiva y conserva su usuario de inventario. La responsiva queda como histórico.'
        };
    } catch (err) {
        return { ok: false, mensaje: 'Error al cancelar: ' + err.message };
    }
}

/* =========================================================
   CATÁLOGOS AUXILIARES
   ========================================================= */
async function listarCarteras() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdCartera, Nombre FROM ActivoFijoCarteras WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

async function listarPuestos() {
    const pool = await getPool();
    const r = await pool.request().query(
        'SELECT IdPuesto, Nombre FROM ActivoFijoPuestos WHERE Activo = 1 ORDER BY Nombre'
    );
    return r.recordset;
}

module.exports = {
    listar, obtener, obtenerParaPDF,
    activosDisponibles, crear, actualizar, devolver, eliminar,
    listarCarteras, listarPuestos, listarUsuariosEntrega,
    listarCatalogoResponsiva, crearCatalogoResponsiva, actualizarCatalogoResponsiva, eliminarCatalogoResponsiva,
};