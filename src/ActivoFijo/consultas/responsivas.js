/* =========================================================
   ACTIVO FIJO — CRUD DE RESPONSIVAS
   Soft delete: al cancelar NO se borra, queda como histórico
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');
const catalogosDB = require('./catalogos');

/* Columnas de texto que la fase 2 de scripts/activo-fijo-3fn.sql elimina
   cuando ya quedaron respaldadas por su FK. Las escrituras las piden sólo
   si siguen existiendo, así el módulo funciona antes y después de la
   limpieza. */
const COLUMNAS_TEXTO_RESPONSIVA = [
    'MotivoSalida', 'NombreProyecto', 'DescripcionSolicitud',
    'NombreRecibe', 'PuestoRecibe',
    'NombreEntrega', 'PuestoEntrega', 'AreaEntrega'
];

async function columnasTextoResponsiva() {
    return catalogosDB.columnasExistentes('ActivoFijoResponsivas', COLUMNAS_TEXTO_RESPONSIVA);
}

/* Nombre completo de un usuario del sistema (tabla Usuarios), con
   NombreUsuario como respaldo cuando faltan nombres o apellidos. */
function nombreUsuarioSql(alias) {
    return `COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(${alias}.Nombres, ' ', ${alias}.Apellidos))), ''), ${alias}.NombreUsuario)`;
}

/* Nombres del equipo (marca no: esa ya venía por JOIN) leídos de sus
   catálogos. Se usa solo en las consultas que no traen la responsiva. */
async function prepararLecturaEquipo() {
    return catalogosDB.unirNombresCatalogo(
        await catalogosDB.prepararNombresCatalogo(
            'ActivoFijoEquipos', 'af', catalogosDB.camposEspecificaciones3FN()),
        await catalogosDB.prepararAccesoriosEquipo('af')
    );
}

/* Prepara la lectura 3FN de una responsiva: los nombres salen de sus
   catálogos (motivo, proyecto, descripción, área, puesto de entrega,
   quién recibe y quién entrega) y las especificaciones del equipo
   también. Mientras las columnas de texto sigan existiendo se usan como
   respaldo de las filas históricas sin FK; si la fase 2 de
   scripts/activo-fijo-3fn.sql ya las eliminó, sólo se lee el catálogo. */
async function prepararLecturaResponsiva() {
    const [equipo, responsiva, columnasTexto] = await Promise.all([
        prepararLecturaEquipo(),
        catalogosDB.prepararNombresCatalogo(
            'ActivoFijoResponsivas', 'r', catalogosDB.camposResponsiva3FN()),
        catalogosDB.columnasExistentes('ActivoFijoResponsivas', ['NombreEntrega'])
    ]);

    /* Quién entrega es un usuario del sistema, no un catálogo simple. */
    const hayTextoEntrega = columnasTexto.has('NombreEntrega');
    const entrega = {
        joins: ['LEFT JOIN dbo.Usuarios ue ON ue.IdUsuario = r.IdUsuarioEntrega'],
        columnas: [hayTextoEntrega
            ? `COALESCE(${nombreUsuarioSql('ue')}, r.NombreEntrega) AS NombreEntregaCatalogo`
            : `${nombreUsuarioSql('ue')} AS NombreEntregaCatalogo`],
        aplicar: fila => {
            if (!fila) return fila;
            fila.NombreEntrega = fila.NombreEntregaCatalogo ?? fila.NombreEntrega ?? null;
            delete fila.NombreEntregaCatalogo;
            return fila;
        }
    };

    const lectura = catalogosDB.unirNombresCatalogo(equipo, responsiva, entrega);

    /* La FK manda; el nombre sólo se usa como respaldo de filas viejas. */
    lectura.idUsuarioEntrega = hayTextoEntrega
        ? `COALESCE(r.IdUsuarioEntrega, (
               SELECT TOP 1 u.IdUsuario
               FROM Usuarios u
               WHERE u.Activo = 1
                 AND UPPER(${nombreUsuarioSql('u')}) = UPPER(LTRIM(RTRIM(r.NombreEntrega)))
               ORDER BY u.IdUsuario
           )) AS IdUsuarioEntrega`
        : 'r.IdUsuarioEntrega AS IdUsuarioEntrega';

    return lectura;
}


/* =========================================================
   LISTAR
   - filtros.idEstatus        → filtra por ese estatus exacto
   - filtros.soloCancelados   → solo CANCELADO
   - por defecto              → oculta CANCELADO
   ========================================================= */
async function listar(filtros = {}) {
    await catalogosDB.asegurarCatalogosExtendidos();
    const lectura = await prepararLecturaResponsiva();
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
            r.Observaciones,
            r.CorreoRecibe,
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
            af.PrecioActivo,

            ${lectura.idUsuarioEntrega},
            m.Nombre     AS Marca,
            t.Nombre     AS Tipo,
            es.Nombre    AS Estado,
            st.Nombre    AS EstatusActivo,

            c.Nombre     AS Cartera,

            /* Nombres 3FN: motivo, proyecto, descripción, área y puesto de
               entrega, quién recibe, quién entrega y las especificaciones
               del equipo salen de sus catálogos. */
            ${lectura.columnas.join(',\n            ')}
        FROM ActivoFijoResponsivas r
        INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
        INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
        INNER JOIN ActivoFijoEstados es ON es.IdEstado = af.IdEstado
        INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
        LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
        LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera
        ${lectura.joins.join('\n        ')}
        WHERE ${where}
        ORDER BY r.IdResponsiva DESC
    `);
    return result.recordset.map(lectura.aplicar);
}

/* =========================================================
   OBTENER POR ID
   ========================================================= */
async function obtener(id) {
    await catalogosDB.asegurarCatalogosExtendidos();
    const lectura = await prepararLecturaResponsiva();
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
                r.Observaciones,
                r.CorreoRecibe,
                r.IdCartera,
                r.IdPuesto,
                af.NoSerie,
                af.IMEI1,
                af.IMEI2,
                af.NoTelefono,
                af.PrecioActivo,
                m.Nombre  AS Marca,
                t.Nombre  AS Tipo,
                t.RequiereIMEI,
                t.RequiereTelefono,

                ${lectura.columnas.join(',\n                ')}
            FROM ActivoFijoResponsivas r
            INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
            INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
            LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
            ${lectura.joins.join('\n            ')}
            WHERE r.IdResponsiva = @Id
        `);
    return lectura.aplicar(r.recordset[0] ?? null);
}

/* =========================================================
   OBTENER DATOS COMPLETOS PARA PDF
   ========================================================= */
async function obtenerParaPDF(id) {
    await catalogosDB.asegurarCatalogosExtendidos();
    const lectura = await prepararLecturaResponsiva();
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
                r.Observaciones,
                r.CorreoRecibe,

                af.IdActivoFijoEQ,
                af.NoSerie,
                af.IMEI1,
                af.IMEI2,
                af.NoTelefono,
                af.PrecioActivo,

                m.Nombre  AS Marca,
                t.Nombre  AS Tipo,
                t.RequiereIMEI,
                t.RequiereTelefono,

                c.Nombre  AS Cartera,

                ${lectura.columnas.join(',\n                ')}
            FROM ActivoFijoResponsivas r
            INNER JOIN ActivoFijoEquipos af ON af.IdActivoFijoEQ = r.IdActivoFijoEQ
            INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
            LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
            LEFT  JOIN ActivoFijoCarteras c ON c.IdCartera = r.IdCartera
            ${lectura.joins.join('\n            ')}
            WHERE r.IdResponsiva = @Id
        `);
    return lectura.aplicar(r.recordset[0] ?? null);
}

/* =========================================================
   ACTIVOS DISPONIBLES PARA ASIGNAR
   Excluye los que ya tienen responsiva activa
   ========================================================= */
async function activosDisponibles() {
    await catalogosDB.asegurarCatalogosExtendidos();
    const lectura = await prepararLecturaEquipo();
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT
            af.IdActivoFijoEQ,
            af.NoSerie,
            af.IMEI1,
            af.IMEI2,
            af.NoTelefono,
            af.PrecioActivo,
            m.Nombre  AS Marca,
            t.Nombre  AS Tipo,
            t.RequiereIMEI,
            t.RequiereTelefono,
            st.Nombre AS Estatus,
            af.Observaciones,

            ${lectura.columnas.join(',\n            ')}
        FROM ActivoFijoEquipos af
        INNER JOIN ActivoFijoTipos   t  ON t.IdTipo = af.IdTipo
        INNER JOIN ActivoFijoEstatus st ON st.IdEstatus = af.IdEstatus
        LEFT  JOIN ActivoFijoMarcas  m  ON m.IdMarca = af.IdMarca
        ${lectura.joins.join('\n        ')}
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
    return r.recordset.map(lectura.aplicar);
}

/* Convierte los textos de catálogo de la responsiva en sus FK (3FN).
   Usa resolverId, que da de alta el valor si es nuevo y REACTIVA el
   registro si estaba dado de baja: así se puede capturar una responsiva
   con un motivo, proyecto, descripción o persona nuevas sin tener que ir
   antes a Catálogos a crearlas o a restaurarlas. Las columnas de texto se
   siguen guardando como respaldo legible. */
async function resolverCatalogosResponsiva(datos) {
    const [IdMotivoResponsiva, IdProyectoResponsiva, IdDescripcionResponsiva, IdUsuarioRecibe] =
        await Promise.all([
            catalogosDB.resolverId('motivosResponsiva',       datos.MotivoSalida),
            catalogosDB.resolverId('proyectosResponsiva',     datos.NombreProyecto),
            catalogosDB.resolverId('descripcionesResponsiva', datos.DescripcionSolicitud),
            catalogosDB.resolverId('usuariosAsignados',       datos.NombreRecibe)
        ]);

    return {
        IdMotivoResponsiva,
        IdProyectoResponsiva,
        IdDescripcionResponsiva,
        IdUsuarioRecibe,
        /* Estos ya llegan como Id desde el formulario (selects del modal) */
        IdAreaEntregaResponsiva:   datos.IdAreaEntregaResponsiva || null,
        IdPuestoEntregaResponsiva: datos.IdPuestoEntrega || null,
        IdUsuarioEntrega:          datos.IdUsuarioEntrega || null
    };
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

        if (!await validarCarteraActiva(datos.IdCartera)) {
            return { ok: false, mensaje: 'Selecciona una cartera activa del catálogo.' };
        }

        /* Resuelve (crea o reactiva si hace falta) los catálogos de
           motivo, proyecto, descripción y persona que recibe. */
        const catalogo = await resolverCatalogosResponsiva(datos);

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

        /* Las columnas de texto legado pueden haber sido eliminadas por la
           fase 2 del script 3FN: se escriben sólo las que siguen existiendo.
           Las FK de catálogo van siempre. */
        const hayTexto = await columnasTextoResponsiva();
        const request  = new sql.Request(tx);
        const columnas = [];
        const valores  = [];

        const agregar = (columna, tipo, valor) => {
            if (COLUMNAS_TEXTO_RESPONSIVA.includes(columna) && !hayTexto.has(columna)) return;
            const param = `p${columnas.length}`;
            request.input(param, tipo, valor);
            columnas.push(columna);
            valores.push('@' + param);
        };

        agregar('FolioTicket',                sql.NVarChar(50),  datos.FolioTicket);
        agregar('IdActivoFijoEQ',             sql.Int,           datos.IdActivoFijoEQ);
        agregar('TipoResponsiva',             sql.NVarChar(50),  datos.TipoResponsiva);
        agregar('FechaAsignacion',            sql.Date,          datos.FechaAsignacion);
        agregar('FechaDevolucionProgramada',  sql.Date,          datos.FechaDevolucionProgramada || null);
        agregar('EstatusResponsiva',          sql.NVarChar(30),  estatusResponsiva);
        agregar('MotivoSalida',               sql.NVarChar(150), datos.MotivoSalida || null);
        agregar('NombreProyecto',             sql.NVarChar(200), datos.NombreProyecto || null);
        agregar('DescripcionSolicitud',       sql.NVarChar(300), datos.DescripcionSolicitud || null);
        agregar('Observaciones',              sql.NVarChar(500), datos.Observaciones || null);
        agregar('NombreRecibe',               sql.NVarChar(200), datos.NombreRecibe);
        agregar('PuestoRecibe',               sql.NVarChar(100), puestoRecibe);
        agregar('CorreoRecibe',               sql.NVarChar(150), datos.CorreoRecibe || null);
        agregar('IdCartera',                  sql.Int,           datos.IdCartera || null);
        agregar('IdPuesto',                   sql.Int,           datos.IdPuesto || null);
        agregar('NombreEntrega',              sql.NVarChar(200), entrega.nombre);
        agregar('PuestoEntrega',              sql.NVarChar(100), entrega.puesto);
        agregar('AreaEntrega',                sql.NVarChar(100), entrega.area);
        agregar('IdMotivoResponsiva',         sql.Int,           catalogo.IdMotivoResponsiva);
        agregar('IdProyectoResponsiva',       sql.Int,           catalogo.IdProyectoResponsiva);
        agregar('IdDescripcionResponsiva',    sql.Int,           catalogo.IdDescripcionResponsiva);
        agregar('IdAreaEntregaResponsiva',    sql.Int,           catalogo.IdAreaEntregaResponsiva);
        agregar('IdPuestoEntregaResponsiva',  sql.Int,           catalogo.IdPuestoEntregaResponsiva);
        agregar('IdUsuarioEntrega',           sql.Int,           catalogo.IdUsuarioEntrega);
        agregar('IdUsuarioRecibe',            sql.Int,           catalogo.IdUsuarioRecibe);
        agregar('IdUsuarioCreacion',          sql.Int,           idUsuario || null);

        const result = await request.query(`
            INSERT INTO ActivoFijoResponsivas (${columnas.join(', ')})
            VALUES (${valores.join(', ')});
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

        if (!await validarCarteraActiva(datos.IdCartera)) {
            return { ok: false, mensaje: 'Selecciona una cartera activa del catálogo.' };
        }
        /* Igual que en crear(): los textos de catálogo se enlazan a su FK. */
        const catalogo = await resolverCatalogosResponsiva(datos);
        await registrarUsuarioAsignado(datos.NombreRecibe);
        if (!datos.IdUsuarioEntrega) return { ok: false, mensaje: 'Selecciona quién entrega el activo.' };

        const entrega = await obtenerDatosEntrega(datos.IdUsuarioEntrega, datos.IdPuestoEntrega, datos.IdAreaEntregaResponsiva);
        if (!entrega.ok) return { ok: false, mensaje: entrega.mensaje };
        const puestoRecibe = await obtenerNombrePorIdCatalogo('puestos', datos.IdPuesto);

        /* Igual que en crear(): sólo se tocan las columnas de texto que aún
           existen y las FK de catálogo siempre. */
        const hayTexto = await columnasTextoResponsiva();
        const request  = pool.request();
        request.input('Id', sql.Int, id);

        const sets = [];
        const asignar = (columna, tipo, valor) => {
            if (COLUMNAS_TEXTO_RESPONSIVA.includes(columna) && !hayTexto.has(columna)) return;
            const param = `p${sets.length}`;
            request.input(param, tipo, valor);
            sets.push(`${columna} = @${param}`);
        };

        asignar('FolioTicket',               sql.NVarChar(50),  datos.FolioTicket);
        asignar('FechaAsignacion',           sql.Date,          datos.FechaAsignacion);
        asignar('FechaDevolucionProgramada', sql.Date,          datos.FechaDevolucionProgramada || null);
        asignar('FechaDevolucionReal',       sql.Date,          datos.FechaDevolucionReal || null);
        asignar('EstatusResponsiva',         sql.NVarChar(30),  datos.EstatusResponsiva);
        asignar('MotivoSalida',              sql.NVarChar(150), datos.MotivoSalida || null);
        asignar('NombreProyecto',            sql.NVarChar(200), datos.NombreProyecto || null);
        asignar('DescripcionSolicitud',      sql.NVarChar(300), datos.DescripcionSolicitud || null);
        asignar('Observaciones',             sql.NVarChar(500), datos.Observaciones || null);
        asignar('NombreRecibe',              sql.NVarChar(200), datos.NombreRecibe);
        asignar('PuestoRecibe',              sql.NVarChar(100), puestoRecibe);
        asignar('CorreoRecibe',              sql.NVarChar(150), datos.CorreoRecibe || null);
        asignar('IdCartera',                 sql.Int,           datos.IdCartera || null);
        asignar('IdPuesto',                  sql.Int,           datos.IdPuesto || null);
        asignar('NombreEntrega',             sql.NVarChar(200), entrega.nombre);
        asignar('PuestoEntrega',             sql.NVarChar(100), entrega.puesto);
        asignar('AreaEntrega',               sql.NVarChar(100), entrega.area);
        asignar('IdMotivoResponsiva',        sql.Int,           catalogo.IdMotivoResponsiva);
        asignar('IdProyectoResponsiva',      sql.Int,           catalogo.IdProyectoResponsiva);
        asignar('IdDescripcionResponsiva',   sql.Int,           catalogo.IdDescripcionResponsiva);
        asignar('IdAreaEntregaResponsiva',   sql.Int,           catalogo.IdAreaEntregaResponsiva);
        asignar('IdPuestoEntregaResponsiva', sql.Int,           catalogo.IdPuestoEntregaResponsiva);
        asignar('IdUsuarioEntrega',          sql.Int,           catalogo.IdUsuarioEntrega);
        asignar('IdUsuarioRecibe',           sql.Int,           catalogo.IdUsuarioRecibe);
        asignar('IdUsuarioModificacion',     sql.Int,           idUsuario || null);

        sets.push('FechaModificacion = GETDATE()');

        const result = await request.query(`
            UPDATE ActivoFijoResponsivas SET
                ${sets.join(',\n                ')}
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

/* ¿El activo conserva un usuario de inventario asignado? La FK manda;
   mientras exista la columna de texto se usa como respaldo, porque la
   fase 2 de scripts/activo-fijo-3fn.sql puede eliminarla. */
async function sqlTieneUsuarioAsignado(alias = 'af') {
    const columnas = await catalogosDB.columnasExistentes('ActivoFijoEquipos', ['UsuarioAsignado']);
    const porFk = `${alias}.IdUsuarioAsignado IS NOT NULL`;
    return columnas.has('UsuarioAsignado')
        ? `(${porFk} OR NULLIF(LTRIM(RTRIM(${alias}.UsuarioAsignado)), '') IS NOT NULL)`
        : `(${porFk})`;
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
        const tieneUsuario = await sqlTieneUsuarioAsignado('af');
        await pool.request()
            .input('Id', sql.Int, id)
            .input('IdUsuario', sql.Int, idUsuario || null)
            .query(`
                UPDATE af SET
                    IdEstatus = (
                        SELECT TOP 1 IdEstatus
                        FROM ActivoFijoEstatus
                        WHERE UPPER(Nombre) = CASE
                            WHEN ${tieneUsuario} THEN 'ASIGNADO'
                            ELSE 'DISPONIBLE'
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
        const tieneUsuario = await sqlTieneUsuarioAsignado('af');
        await pool.request()
            .input('Id',        sql.Int, id)
            .input('IdUsuario', sql.Int, idUsuario || null)
            .query(`
                UPDATE af SET
                    IdEstatus = (
                        SELECT TOP 1 IdEstatus
                        FROM ActivoFijoEstatus
                        WHERE UPPER(Nombre) = CASE
                            WHEN ${tieneUsuario} THEN 'ASIGNADO'
                            ELSE 'DISPONIBLE'
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
   ELIMINAR DEFINITIVAMENTE (purga física)

   Sólo para responsivas que ya están CANCELADAS: la cancelación es el
   paso reversible y deja rastro; la purga es la excepción para limpiar
   folios creados por error. Igual que en activos, las tablas hijas se
   descubren en el catálogo del sistema (sys.foreign_keys) para no quedar
   desfasadas si mañana se añade otra tabla que apunte a la responsiva.
   ========================================================= */
async function tablasHijasResponsiva(tx) {
    const r = await new sql.Request(tx).query(`
        SELECT OBJECT_NAME(fk.parent_object_id)                         AS Tabla,
               COL_NAME(fkc.parent_object_id, fkc.parent_column_id)     AS Columna
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc
                ON fkc.constraint_object_id = fk.object_id
        WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.ActivoFijoResponsivas')
    `);
    return r.recordset;
}

async function eliminarDefinitivo(id, idUsuario) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        const actual = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query(`
                SELECT IdResponsiva, FolioTicket, EstatusResponsiva
                FROM ActivoFijoResponsivas WITH (UPDLOCK, HOLDLOCK)
                WHERE IdResponsiva = @Id
            `);

        if (actual.recordset.length === 0) {
            await tx.rollback();
            return { ok: false, mensaje: 'La responsiva ya no existe.' };
        }

        const estatus = String(actual.recordset[0].EstatusResponsiva || '').toUpperCase();
        if (estatus !== 'CANCELADO') {
            await tx.rollback();
            return {
                ok: false,
                mensaje: 'Sólo se pueden eliminar definitivamente las responsivas canceladas. Cancélala primero.'
            };
        }

        const hijas = await tablasHijasResponsiva(tx);
        const borradas = {};
        for (const h of hijas) {
            if (!h.Tabla || !h.Columna) continue;
            const r = await new sql.Request(tx)
                .input('Id', sql.Int, id)
                .query(`
                    DELETE FROM dbo.${h.Tabla}
                    WHERE ${h.Columna} = @Id
                `);
            borradas[h.Tabla] = (borradas[h.Tabla] || 0) + (r.rowsAffected[0] || 0);
        }

        const r = await new sql.Request(tx)
            .input('Id', sql.Int, id)
            .query('DELETE FROM dbo.ActivoFijoResponsivas WHERE IdResponsiva = @Id');

        if (r.rowsAffected[0] === 0) {
            await tx.rollback();
            return { ok: false, mensaje: 'La responsiva ya no existe.' };
        }

        await tx.commit();

        const detalle = Object.entries(borradas)
            .filter(([, n]) => n > 0)
            .map(([tabla, n]) => `${tabla}: ${n}`)
            .join(', ');
        console.log(`🗑️  Responsiva #${id} eliminada definitivamente` +
            (idUsuario ? ` por el usuario ${idUsuario}` : '') +
            (detalle ? ` (${detalle})` : ''));

        return { ok: true, mensaje: 'Responsiva eliminada definitivamente.' };
    } catch (err) {
        try { await tx.rollback(); } catch (_) { /* la transacción ya estaba cerrada */ }
        if (err.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar: hay registros asociados a la responsiva.' };
        }
        return { ok: false, mensaje: 'Error al eliminar definitivamente: ' + err.message };
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
    activosDisponibles, crear, actualizar, devolver, eliminar, eliminarDefinitivo,
    listarCarteras, listarPuestos, listarUsuariosEntrega,
    listarCatalogoResponsiva, crearCatalogoResponsiva, actualizarCatalogoResponsiva, eliminarCatalogoResponsiva,
};