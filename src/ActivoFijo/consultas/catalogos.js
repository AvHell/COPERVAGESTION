/* =========================================================
   ACTIVO FIJO — CATÁLOGOS CRUD
   Soft delete: se marca Activo = 0, no se borra
   ========================================================= */
const { getPool, sql } = require('../../js/db/conexion');

/* =========================================================
   CONFIGURACIÓN DE LOS CATÁLOGOS
   ========================================================= */
const CATALOGOS = {
    /* ---------------------------------------------------
       CATÁLOGOS BASE
       --------------------------------------------------- */
    marcas: {
        tabla: 'ActivoFijoMarcas',
        pk:    'IdMarca',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    },
    tipos: {
        tabla: 'ActivoFijoTipos',
        pk:    'IdTipo',
        campos: [
            { nombre: 'Nombre',                  tipo: 'NVarChar', longitud: 100, requerido: true, unico: true },
            { nombre: 'GrupoSubtipo',            tipo: 'NVarChar', longitud: 50 },
            { nombre: 'RequiereResponsiva',      tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereIMEI',            tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereTelefono',        tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereSitio',           tipo: 'Bit',      default: 1 },
            { nombre: 'RequiereSubtipo',         tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereClasificacion',   tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereTamanio',         tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereCapacidad',       tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereVoltaje',         tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereUsuarioAsignado', tipo: 'Bit',      default: 0 },
            { nombre: 'RequierePrecio',          tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereEspecificaciones',tipo: 'Bit',      default: 0 },
            { nombre: 'RequiereAccesorios',      tipo: 'Bit',      default: 0 }
        ]
    },
    estados: {
        tabla: 'ActivoFijoEstados',
        pk:    'IdEstado',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    estatus: {
        tabla: 'ActivoFijoEstatus',
        pk:    'IdEstatus',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    carteras: {
        tabla: 'ActivoFijoCarteras',
        pk:    'IdCartera',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    },
    puestos: {
        tabla: 'ActivoFijoPuestos',
        pk:    'IdPuesto',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    },
    puestosEntregaResponsiva: {
        tabla: 'ActivoFijoResponsivasPuestosEntrega',
        pk:    'IdPuestoEntregaResponsiva',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    },
    motivosResponsiva: {
        tabla: 'ActivoFijoResponsivasMotivos',
        pk:    'IdMotivoResponsiva',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 150, requerido: true, unico: true }
        ]
    },
    proyectosResponsiva: {
        tabla: 'ActivoFijoResponsivasProyectos',
        pk:    'IdProyectoResponsiva',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 200, requerido: true, unico: true }
        ]
    },
    descripcionesResponsiva: {
        tabla: 'ActivoFijoResponsivasDescripciones',
        pk:    'IdDescripcionResponsiva',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 300, requerido: true, unico: true }
        ]
    },
    areasEntregaResponsiva: {
        tabla: 'ActivoFijoResponsivasAreasEntrega',
        pk:    'IdAreaEntregaResponsiva',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    },

    /* ---------------------------------------------------
       CATÁLOGOS NUEVOS (periféricos)
       --------------------------------------------------- */
    sitios: {
        tabla: 'ActivoFijoSitios',
        pk:    'IdSitio',
        campos: [
            { nombre: 'Nombre',      tipo: 'NVarChar', longitud: 100, requerido: true, unico: true },
            { nombre: 'Descripcion', tipo: 'NVarChar', longitud: 200 }
        ]
    },
    subtipos: {
        tabla: 'ActivoFijoSubtipos',
        pk:    'IdSubtipo',
        campos: [
            { nombre: 'Grupo',       tipo: 'NVarChar', longitud: 50,  requerido: true, unico: false },
            { nombre: 'Nombre',      tipo: 'NVarChar', longitud: 100, requerido: true, unico: false },
            { nombre: 'Descripcion', tipo: 'NVarChar', longitud: 200 }
        ]
    },
    voltajes: {
        tabla: 'ActivoFijoVoltajes',
        pk:    'IdVoltaje',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    clasificaciones: {
        tabla: 'ActivoFijoClasificaciones',
        pk:    'IdClasificacion',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    tamanios: {
        tabla: 'ActivoFijoTamanios',
        pk:    'IdTamanio',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    capacidades: {
        tabla: 'ActivoFijoCapacidades',
        pk:    'IdCapacidad',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    modelos: {
        tabla: 'ActivoFijoModelos',
        pk:    'IdModelo',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 150, requerido: true, unico: true }
        ]
    },
    procesadores: {
        tabla: 'ActivoFijoProcesadores',
        pk:    'IdProcesador',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 150, requerido: true, unico: true }
        ]
    },
    memoriasRam: {
        tabla: 'ActivoFijoMemoriasRAM',
        pk:    'IdMemoriaRAM',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    almacenamientos: {
        tabla: 'ActivoFijoAlmacenamientos',
        pk:    'IdAlmacenamiento',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 50, requerido: true, unico: true }
        ]
    },
    sistemasOperativos: {
        tabla: 'ActivoFijoSistemasOperativos',
        pk:    'IdSistemaOperativo',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 100, requerido: true, unico: true }
        ]
    },
    accesorios: {
        tabla: 'ActivoFijoAccesorios',
        pk:    'IdAccesorio',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 300, requerido: true, unico: true }
        ]
    },
    usuariosAsignados: {
        tabla: 'ActivoFijoUsuariosAsignados',
        pk:    'IdUsuarioAsignado',
        campos: [
            { nombre: 'Nombre', tipo: 'NVarChar', longitud: 200, requerido: true, unico: true }
        ]
    }
};

const CATALOGOS_ESPECIFICACIONES = [
    { clave: 'modelos', tabla: 'ActivoFijoModelos', pk: 'IdModelo', longitud: 150, origen: 'Modelo' },
    { clave: 'procesadores', tabla: 'ActivoFijoProcesadores', pk: 'IdProcesador', longitud: 150, origen: 'Procesador' },
    { clave: 'memoriasRam', tabla: 'ActivoFijoMemoriasRAM', pk: 'IdMemoriaRAM', longitud: 50, origen: 'MemoriaRAM' },
    { clave: 'almacenamientos', tabla: 'ActivoFijoAlmacenamientos', pk: 'IdAlmacenamiento', longitud: 50, origen: 'Almacenamiento' },
    { clave: 'sistemasOperativos', tabla: 'ActivoFijoSistemasOperativos', pk: 'IdSistemaOperativo', longitud: 100, origen: 'SistemaOperativo' },
    { clave: 'accesorios', tabla: 'ActivoFijoAccesorios', pk: 'IdAccesorio', longitud: 300, origen: 'Accesorios' },
    { clave: 'usuariosAsignados', tabla: 'ActivoFijoUsuariosAsignados', pk: 'IdUsuarioAsignado', longitud: 200, origen: 'UsuarioAsignado' }
];

const CATALOGOS_RESPONSIVAS = [
    { tabla: 'ActivoFijoResponsivasMotivos', pk: 'IdMotivoResponsiva', longitud: 150, origen: 'MotivoSalida' },
    { tabla: 'ActivoFijoResponsivasProyectos', pk: 'IdProyectoResponsiva', longitud: 200, origen: 'NombreProyecto' },
    { tabla: 'ActivoFijoResponsivasDescripciones', pk: 'IdDescripcionResponsiva', longitud: 300, origen: 'DescripcionSolicitud' },
    { tabla: 'ActivoFijoResponsivasAreasEntrega', pk: 'IdAreaEntregaResponsiva', longitud: 100, origen: 'AreaEntrega' },
    { tabla: 'ActivoFijoResponsivasPuestosEntrega', pk: 'IdPuestoEntregaResponsiva', longitud: 100, origen: 'PuestoEntrega' }
];

/* Tabla puente equipo ↔ accesorios. Un activo guarda varios conjuntos de
   accesorios (antes iban todos en una sola celda de texto: violación de
   1FN), así que la relación es N:M y necesita esta tabla. */
const TABLA_ACCESORIOS_EQUIPO = 'ActivoFijoEquiposAccesorios';

/* Columnas FK que agrega la normalización 3FN. Se crean aquí de forma
   defensiva para que la aplicación funcione aunque el script
   scripts/activo-fijo-3fn.sql todavía no se haya ejecutado en la base:
   el script se encarga del respaldo de datos, las FK y las vistas. */
const COLUMNAS_3FN = [
    ['ActivoFijoEquipos',    'IdModelo'],
    ['ActivoFijoEquipos',    'IdProcesador'],
    ['ActivoFijoEquipos',    'IdMemoriaRAM'],
    ['ActivoFijoEquipos',    'IdAlmacenamiento'],
    ['ActivoFijoEquipos',    'IdSistemaOperativo'],
    ['ActivoFijoEquipos',    'IdUsuarioAsignado'],
    ['ActivoFijoResponsivas', 'IdMotivoResponsiva'],
    ['ActivoFijoResponsivas', 'IdProyectoResponsiva'],
    ['ActivoFijoResponsivas', 'IdDescripcionResponsiva'],
    ['ActivoFijoResponsivas', 'IdAreaEntregaResponsiva'],
    ['ActivoFijoResponsivas', 'IdPuestoEntregaResponsiva'],
    ['ActivoFijoResponsivas', 'IdUsuarioEntrega'],
    ['ActivoFijoResponsivas', 'IdUsuarioRecibe']
];

/* DDL del catálogo (idempotente) y siembra desde la columna de texto. */
function crearCatalogo(cfg) {
    return `
        IF OBJECT_ID(N'dbo.${cfg.tabla}', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.${cfg.tabla} (
                ${cfg.pk} INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                Nombre NVARCHAR(${cfg.longitud}) NOT NULL,
                Activo BIT NOT NULL CONSTRAINT DF_${cfg.pk}_Activo DEFAULT (1)
            );
        END;
    `;
}

function sembrarCatalogo(cfg, tabla, alias) {
    return `
        INSERT INTO dbo.${cfg.tabla} (Nombre)
        SELECT DISTINCT LTRIM(RTRIM(${alias}.${cfg.origen}))
        FROM dbo.${tabla} ${alias}
        WHERE ${alias}.${cfg.origen} IS NOT NULL
          AND LTRIM(RTRIM(${alias}.${cfg.origen})) <> ''
          AND NOT EXISTS (
              SELECT 1
              FROM dbo.${cfg.tabla} c
              WHERE UPPER(c.Nombre) = UPPER(LTRIM(RTRIM(${alias}.${cfg.origen})))
          );
    `;
}

let inicializacionExtendida;

async function asegurarCatalogosExtendidos() {
    if (!inicializacionExtendida) {
        inicializacionExtendida = (async () => {
            const pool = await getPool();

            /* 1. Columnas FK de la normalización (idempotente). */
            for (const [tabla, columna] of COLUMNAS_3FN) {
                await pool.request().query(`
                    IF OBJECT_ID(N'dbo.${tabla}', N'U') IS NOT NULL
                       AND COL_LENGTH(N'dbo.${tabla}', N'${columna}') IS NULL
                        ALTER TABLE dbo.${tabla} ADD ${columna} INT NULL;
                `);
            }

            /* Las columnas de texto de origen pueden haber sido eliminadas
               por la fase 2 del script 3FN: sólo se siembra el catálogo si
               la columna sigue existiendo. */
            const origenesEquipo = await columnasExistentes(
                'ActivoFijoEquipos',
                CATALOGOS_ESPECIFICACIONES.map(c => c.origen)
            );
            const origenesResponsiva = await columnasExistentes(
                'ActivoFijoResponsivas',
                [...CATALOGOS_RESPONSIVAS.map(c => c.origen), 'NombreRecibe', 'PuestoRecibe']
            );

            for (const cfg of CATALOGOS_ESPECIFICACIONES) {
                await pool.request().query(
                    crearCatalogo(cfg) +
                    (origenesEquipo.has(cfg.origen)
                        ? sembrarCatalogo(cfg, 'ActivoFijoEquipos', 'a')
                        : '')
                );
            }

            for (const cfg of CATALOGOS_RESPONSIVAS) {
                await pool.request().query(
                    crearCatalogo(cfg) +
                    (origenesResponsiva.has(cfg.origen)
                        ? sembrarCatalogo(cfg, 'ActivoFijoResponsivas', 'r')
                        : '')
                );
            }

            /* Tabla puente de accesorios. Se crea aquí (sin FK: las agrega
               scripts/activo-fijo-3fn.sql) para que la aplicación funcione
               incluso si el script todavía no se ejecutó. */
            await pool.request().query(`
                IF OBJECT_ID(N'dbo.${TABLA_ACCESORIOS_EQUIPO}', N'U') IS NULL
                   AND OBJECT_ID(N'dbo.ActivoFijoEquipos', N'U') IS NOT NULL
                   AND OBJECT_ID(N'dbo.ActivoFijoAccesorios', N'U') IS NOT NULL
                    CREATE TABLE dbo.${TABLA_ACCESORIOS_EQUIPO} (
                        IdEquipoAccesorio INT IDENTITY(1,1) NOT NULL
                            CONSTRAINT PK_${TABLA_ACCESORIOS_EQUIPO} PRIMARY KEY,
                        IdActivoFijoEQ INT NOT NULL,
                        IdAccesorio    INT NOT NULL,
                        CONSTRAINT UQ_${TABLA_ACCESORIOS_EQUIPO}
                            UNIQUE (IdActivoFijoEQ, IdAccesorio)
                    );
            `);

            /* Respaldo: los accesorios que sólo existían como texto pasan a
               la tabla puente. Idempotente. */
            if (origenesEquipo.has('Accesorios')) {
                await pool.request().query(`
                    ;WITH objetivo AS (
                        SELECT af.IdActivoFijoEQ, MIN(c.IdAccesorio) AS IdAccesorio
                        FROM dbo.ActivoFijoEquipos af
                        INNER JOIN dbo.ActivoFijoAccesorios c
                                ON UPPER(c.Nombre) = UPPER(LTRIM(RTRIM(af.Accesorios)))
                        WHERE af.Accesorios IS NOT NULL
                          AND LTRIM(RTRIM(af.Accesorios)) <> ''
                        GROUP BY af.IdActivoFijoEQ
                    )
                    INSERT INTO dbo.${TABLA_ACCESORIOS_EQUIPO} (IdActivoFijoEQ, IdAccesorio)
                    SELECT o.IdActivoFijoEQ, o.IdAccesorio
                    FROM objetivo o
                    WHERE NOT EXISTS (
                        SELECT 1 FROM dbo.${TABLA_ACCESORIOS_EQUIPO} ea
                        WHERE ea.IdActivoFijoEQ = o.IdActivoFijoEQ
                          AND ea.IdAccesorio    = o.IdAccesorio
                    );
                `);
            }

            // Coherencia con responsivas: quién recibe se administra desde el
            // catálogo "Usuarios asignados", así que los nombres históricos
            // de las responsivas se integran a ese catálogo.
            if (origenesResponsiva.has('NombreRecibe')) {
                await pool.request().query(`
                    IF OBJECT_ID(N'dbo.ActivoFijoResponsivas', N'U') IS NOT NULL
                       AND OBJECT_ID(N'dbo.ActivoFijoUsuariosAsignados', N'U') IS NOT NULL
                    BEGIN
                        INSERT INTO dbo.ActivoFijoUsuariosAsignados (Nombre)
                        SELECT DISTINCT LTRIM(RTRIM(r.NombreRecibe))
                        FROM dbo.ActivoFijoResponsivas r
                        WHERE r.NombreRecibe IS NOT NULL
                          AND LTRIM(RTRIM(r.NombreRecibe)) <> ''
                          AND NOT EXISTS (
                              SELECT 1
                              FROM dbo.ActivoFijoUsuariosAsignados c
                              WHERE UPPER(c.Nombre) = UPPER(LTRIM(RTRIM(r.NombreRecibe)))
                          );
                    END;
                `);
            }

            if (origenesResponsiva.has('PuestoRecibe')) {
                await pool.request().query(`
                    INSERT INTO dbo.ActivoFijoPuestos (Nombre)
                    SELECT DISTINCT LTRIM(RTRIM(p.Puesto))
                    FROM (
                        SELECT PuestoRecibe AS Puesto FROM dbo.ActivoFijoResponsivas
                    ) p
                    WHERE p.Puesto IS NOT NULL
                      AND LTRIM(RTRIM(p.Puesto)) <> ''
                      AND NOT EXISTS (
                          SELECT 1
                          FROM dbo.ActivoFijoPuestos c
                          WHERE UPPER(c.Nombre) = UPPER(LTRIM(RTRIM(p.Puesto)))
                      );
                `);
            }

            await pool.request().query(`
                UPDATE dbo.ActivoFijoEstatus SET Activo = 1
                WHERE UPPER(Nombre) = 'DISPONIBLE' AND Activo = 0;

                IF NOT EXISTS (
                    SELECT 1 FROM dbo.ActivoFijoEstatus WHERE UPPER(Nombre) = 'DISPONIBLE'
                )
                    INSERT INTO dbo.ActivoFijoEstatus (Nombre, Activo) VALUES ('DISPONIBLE', 1);

                /* PENDIENTE: los triggers de responsivas y el formulario ya lo
                   usan (responsiva capturada pero no entregada). Sin esta fila
                   el UPDATE del trigger dejaba IdEstatus en NULL y fallaba con
                   el error 515. Ver scripts/estatus-pendiente.sql. */
                UPDATE dbo.ActivoFijoEstatus SET Activo = 1
                WHERE UPPER(Nombre) = 'PENDIENTE' AND Activo = 0;

                IF NOT EXISTS (
                    SELECT 1 FROM dbo.ActivoFijoEstatus WHERE UPPER(Nombre) = 'PENDIENTE'
                )
                    INSERT INTO dbo.ActivoFijoEstatus (Nombre, Activo) VALUES ('PENDIENTE', 1);


                UPDATE af SET IdEstatus = disponible.IdEstatus
                FROM dbo.ActivoFijoEquipos af
                INNER JOIN dbo.ActivoFijoEstatus actual ON actual.IdEstatus = af.IdEstatus
                CROSS JOIN (
                    SELECT TOP 1 IdEstatus FROM dbo.ActivoFijoEstatus
                    WHERE UPPER(Nombre) = 'DISPONIBLE' AND Activo = 1
                    ORDER BY IdEstatus
                ) disponible
                WHERE UPPER(actual.Nombre) IN ('STOCK', 'ASIGNADO')
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.ActivoFijoResponsivas r
                      WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                        AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                  );

                UPDATE af SET IdEstatus = asignado.IdEstatus
                FROM dbo.ActivoFijoEquipos af
                CROSS JOIN (
                    SELECT TOP 1 IdEstatus FROM dbo.ActivoFijoEstatus
                    WHERE UPPER(Nombre) = 'ASIGNADO' AND Activo = 1
                    ORDER BY IdEstatus
                ) asignado
                WHERE EXISTS (
                    SELECT 1 FROM dbo.ActivoFijoResponsivas r
                    WHERE r.IdActivoFijoEQ = af.IdActivoFijoEQ
                      AND r.EstatusResponsiva IN ('ASIGNADO', 'PENDIENTE')
                );
            `);
        })().catch(err => {
            inicializacionExtendida = null;
            throw err;
        });
    }

    return inicializacionExtendida;
}

/* =========================================================
   HELPERS INTERNOS
   ========================================================= */
function getConfig(clave) {
    const cfg = CATALOGOS[clave];
    if (!cfg) throw new Error(`Catálogo desconocido: ${clave}`);
    return cfg;
}

function tipoSql(tipo, longitud) {
    switch (tipo) {
        case 'NVarChar': return sql.NVarChar(longitud || 100);
        case 'Bit':      return sql.Bit;
        case 'Int':      return sql.Int;
        default:         throw new Error(`Tipo SQL no soportado: ${tipo}`);
    }
}

/* =========================================================
   LISTAR
   - filtros.soloEliminados = true     → sólo Activo = 0
   - filtros.incluirInactivos = true   → activos + inactivos
     (la vista normal del catálogo los muestra juntos para poder
      activar/desactivar con un clic, sin cambiar de pestaña)
   - por omisión                        → sólo Activo = 1
   ========================================================= */
async function listar(clave, filtros = {}) {
    await asegurarCatalogosExtendidos();
    const { tabla, pk } = getConfig(clave);
    const pool = await getPool();

    let where = 'WHERE Activo = 1';
    if (filtros.soloEliminados) {
        where = 'WHERE Activo = 0';
    } else if (filtros.incluirInactivos) {
        where = '';
    }

    /* Los inactivos se muestran al final para no romper el orden natural. */
    const orden = filtros.incluirInactivos ? `Activo DESC, ${pk}` : pk;

    const result = await pool.request().query(
        `SELECT * FROM ${tabla} ${where} ORDER BY ${orden}`
    );
    return result.recordset;
}

/* =========================================================
   CREAR (Activo = 1 por default)
   ========================================================= */
async function crear(clave, datos) {
    try {
        await asegurarCatalogosExtendidos();
        const cfg = getConfig(clave);
        const pool = await getPool();

        // Validar duplicado en campo único (solo entre ACTIVOS)
        for (const campo of cfg.campos) {
            if (campo.unico && datos[campo.nombre] !== undefined) {
                const dup = await pool.request()
                    .input('Valor', tipoSql(campo.tipo, campo.longitud), datos[campo.nombre])
                    .query(`SELECT 1 FROM ${cfg.tabla} WHERE ${campo.nombre} = @Valor AND Activo = 1`);
                if (dup.recordset.length > 0) {
                    return { ok: false, mensaje: `Ya existe un registro activo con ${campo.nombre} = "${datos[campo.nombre]}".` };
                }
            }
        }

        // Validación especial: subtipos (Grupo + Nombre único entre activos)
        if (clave === 'subtipos') {
            const dup = await pool.request()
                .input('Grupo',  sql.NVarChar(50),  datos.Grupo)
                .input('Nombre', sql.NVarChar(100), datos.Nombre)
                .query(`SELECT 1 FROM ActivoFijoSubtipos WHERE Grupo = @Grupo AND Nombre = @Nombre AND Activo = 1`);
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un subtipo activo "${datos.Nombre}" en el grupo "${datos.Grupo}".` };
            }
        }

        // Construir INSERT dinámico
        const columnas = [];
        const valores  = [];
        const request  = pool.request();

        cfg.campos.forEach((campo, i) => {
            const valor = datos[campo.nombre] !== undefined ? datos[campo.nombre] : campo.default;
            if (valor === undefined) return;
            const paramName = `p${i}`;
            request.input(paramName, tipoSql(campo.tipo, campo.longitud), valor);
            columnas.push(campo.nombre);
            valores.push(`@${paramName}`);
        });

        // Forzar Activo = 1 al crear
        columnas.push('Activo');
        valores.push('1');

        await request.query(
            `INSERT INTO ${cfg.tabla} (${columnas.join(', ')}) VALUES (${valores.join(', ')})`
        );

        return { ok: true, mensaje: 'Registro creado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un registro con ese valor único.' };
        }
        return { ok: false, mensaje: 'Error al crear: ' + err.message };
    }
}

/* =========================================================
   ACTUALIZAR
   ========================================================= */
async function actualizar(clave, id, datos) {
    try {
        await asegurarCatalogosExtendidos();
        const cfg = getConfig(clave);
        const pool = await getPool();

        // Validar duplicado en campo único (solo entre ACTIVOS, excluyendo el propio)
        for (const campo of cfg.campos) {
            if (campo.unico && datos[campo.nombre] !== undefined) {
                const dup = await pool.request()
                    .input('Valor', tipoSql(campo.tipo, campo.longitud), datos[campo.nombre])
                    .input('Id',    sql.Int, id)
                    .query(`SELECT 1 FROM ${cfg.tabla}
                            WHERE ${campo.nombre} = @Valor AND ${cfg.pk} <> @Id AND Activo = 1`);
                if (dup.recordset.length > 0) {
                    return { ok: false, mensaje: `Ya existe otro registro activo con ${campo.nombre} = "${datos[campo.nombre]}".` };
                }
            }
        }

        // Validación especial: subtipos
        if (clave === 'subtipos') {
            const dup = await pool.request()
                .input('Grupo',  sql.NVarChar(50),  datos.Grupo)
                .input('Nombre', sql.NVarChar(100), datos.Nombre)
                .input('Id',     sql.Int, id)
                .query(`SELECT 1 FROM ActivoFijoSubtipos
                        WHERE Grupo = @Grupo AND Nombre = @Nombre AND IdSubtipo <> @Id AND Activo = 1`);
            if (dup.recordset.length > 0) {
                return { ok: false, mensaje: `Ya existe un subtipo activo "${datos.Nombre}" en el grupo "${datos.Grupo}".` };
            }
        }

        const sets     = [];
        const request  = pool.request();
        request.input('Id', sql.Int, id);

        cfg.campos.forEach((campo, i) => {
            if (datos[campo.nombre] === undefined) return;
            const paramName = `p${i}`;
            request.input(paramName, tipoSql(campo.tipo, campo.longitud), datos[campo.nombre]);
            sets.push(`${campo.nombre} = @${paramName}`);
        });

        if (sets.length === 0) {
            return { ok: false, mensaje: 'No hay campos para actualizar.' };
        }

        const result = await request.query(
            `UPDATE ${cfg.tabla} SET ${sets.join(', ')} WHERE ${cfg.pk} = @Id`
        );

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El registro ya no existe.' };
        }

        return { ok: true, mensaje: 'Registro actualizado correctamente.' };
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return { ok: false, mensaje: 'Ya existe un registro con ese valor único.' };
        }
        return { ok: false, mensaje: 'Error al actualizar: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR (Soft delete) — Marca Activo = 0
   Valida que no esté en uso en el módulo de activos
   ========================================================= */
async function eliminar(clave, id) {
    try {
        await asegurarCatalogosExtendidos();
        const cfg = getConfig(clave);
        const pool = await getPool();

        // Validación de uso: si algún activo u otra entidad lo usa, no se puede dar de baja
        // Nota: NO bloqueamos la baja si está en uso. Solo la permitimos si Activo=1.
        // Si el usuario quiere bloqueo, se puede añadir después.

        const result = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                UPDATE ${cfg.tabla}
                SET Activo = 0
                WHERE ${cfg.pk} = @Id AND Activo = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El registro ya estaba dado de baja o no existe.' };
        }

        return { ok: true, mensaje: 'Registro dado de baja. Puedes verlo en la pestaña "Eliminados".' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al dar de baja: ' + err.message };
    }
}

/* =========================================================
   RESTAURAR — Saca de baja lógica (Activo = 0 → 1)
   ========================================================= */
async function restaurar(clave, id) {
    try {
        await asegurarCatalogosExtendidos();
        const cfg = getConfig(clave);
        const pool = await getPool();

        const result = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                UPDATE ${cfg.tabla}
                SET Activo = 1
                WHERE ${cfg.pk} = @Id AND Activo = 0
            `);

        if (result.rowsAffected[0] === 0) {
            return { ok: false, mensaje: 'El registro no está dado de baja o no existe.' };
        }

        return { ok: true, mensaje: 'Registro restaurado. Vuelve al listado activo.' };
    } catch (err) {
        return { ok: false, mensaje: 'Error al restaurar: ' + err.message };
    }
}

/* =========================================================
   ELIMINAR DEFINITIVAMENTE (purga física)
   ---------------------------------------------------------
   Complemento del soft delete: sólo se permite sobre registros
   que ya están dados de baja (Activo = 0) y que ninguna otra
   tabla referencia. Las referencias se descubren en el catálogo
   del sistema (sys.foreign_keys) para no quedar desfasadas si
   mañana se añade otra FK a alguno de los catálogos.
   ========================================================= */
const ETIQUETAS_REFERENCIA = {
    ActivoFijoEquipos:           'activo(s) del inventario',
    ActivoFijoEquiposAccesorios: 'equipo(s) con este accesorio',
    ActivoFijoResponsivas:       'responsiva(s)',
    ActivoFijoHistoricos:        'movimiento(s) de histórico',
    ActivoFijoAsignacionesHist:  'asignación(es) de histórico'
};

function etiquetaReferencia(tabla) {
    return ETIQUETAS_REFERENCIA[tabla] || `registro(s) de ${tabla}`;
}

/* Tablas de HISTORIAL. Su referencia es un retrato del pasado (el
   histórico sigue siendo válido aunque el catálogo desaparezca), así que
   no impiden la purga: al borrar el registro se desvinculan. Son
   columnas NULL-ables; si alguna no lo fuera, se bloquea como cualquier
   referencia viva. */
const TABLAS_HISTORIAL = new Set(['ActivoFijoHistoricos', 'ActivoFijoAsignacionesHist']);

/* Tablas cuyas FK apuntan a la tabla indicada. */
async function referenciasDeTabla(tx, tabla) {
    const r = await new sql.Request(tx).query(`
        SELECT OBJECT_NAME(fk.parent_object_id)                     AS Tabla,
               COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Columna,
               COLUMNPROPERTY(fkc.parent_object_id,
                              COL_NAME(fkc.parent_object_id, fkc.parent_column_id),
                              'AllowsNull')                         AS Nulable
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc
                ON fkc.constraint_object_id = fk.object_id
        WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.${tabla}')
    `);
    return r.recordset;
}

async function eliminarDefinitivo(clave, id) {
    try {
        await asegurarCatalogosExtendidos();
        const cfg = getConfig(clave);
        const pool = await getPool();
        const tx = new sql.Transaction(pool);
        await tx.begin();

        try {
            const actual = await new sql.Request(tx)
                .input('Id', sql.Int, id)
                .query(`
                    SELECT *
                    FROM ${cfg.tabla} WITH (UPDLOCK, HOLDLOCK)
                    WHERE ${cfg.pk} = @Id
                `);

            if (actual.recordset.length === 0) {
                await tx.rollback();
                return { ok: false, mensaje: 'El registro ya no existe.' };
            }

            if (actual.recordset[0].Activo) {
                await tx.rollback();
                return {
                    ok: false,
                    mensaje: 'Sólo se pueden eliminar definitivamente los registros dados de baja. Desactívalo primero.'
                };
            }

            /* ¿Algo lo está usando? Se agrupa por tabla porque varias FK
               de la misma tabla (estatus anterior / estatus nuevo del
               histórico) apuntan al mismo catálogo y antes se contaban dos
               veces, duplicando el mensaje. */
            const referencias = await referenciasDeTabla(tx, cfg.tabla);
            const porTabla = new Map();
            for (const ref of referencias) {
                if (!ref.Tabla || !ref.Columna) continue;
                if (!porTabla.has(ref.Tabla)) porTabla.set(ref.Tabla, []);
                porTabla.get(ref.Tabla).push({ columna: ref.Columna, nulable: ref.Nulable === 1 });
            }

            const usos    = [];   // referencias vivas: bloquean la purga
            const enlaces = [];   // referencias de historial: se desvinculan
            for (const [tabla, cols] of porTabla) {
                const filtro = cols.map(c => `${c.columna} = @Id`).join(' OR ');
                const conteo = await new sql.Request(tx)
                    .input('Id', sql.Int, id)
                    .query(`SELECT COUNT(*) AS Total FROM dbo.${tabla} WHERE ${filtro}`);
                const total = conteo.recordset[0]?.Total || 0;
                if (total === 0) continue;

                if (TABLAS_HISTORIAL.has(tabla) && cols.every(c => c.nulable)) {
                    enlaces.push({ tabla, cols: cols.map(c => c.columna), total });
                } else {
                    usos.push(`${total} ${etiquetaReferencia(tabla)}`);
                }
            }

            if (usos.length > 0) {
                await tx.rollback();
                return {
                    ok: false,
                    mensaje: `No se puede eliminar definitivamente: lo usan ${usos.join(', ')}.`
                };
            }

            /* El historial no estorba: se conserva la fila y sólo se
               suelta el vínculo con este registro. */
            let desvinculados = 0;
            for (const { tabla, cols, total } of enlaces) {
                const sets   = cols.map(c => `${c} = NULL`).join(', ');
                const filtro = cols.map(c => `${c} = @Id`).join(' OR ');
                await new sql.Request(tx)
                    .input('Id', sql.Int, id)
                    .query(`UPDATE dbo.${tabla} SET ${sets} WHERE ${filtro}`);
                desvinculados += total;
            }

            const borrado = await new sql.Request(tx)
                .input('Id', sql.Int, id)
                .query(`DELETE FROM ${cfg.tabla} WHERE ${cfg.pk} = @Id AND Activo = 0`);

            if (borrado.rowsAffected[0] === 0) {
                await tx.rollback();
                return { ok: false, mensaje: 'El registro ya no existe o volvió a estar activo.' };
            }

            await tx.commit();
            return {
                ok: true,
                mensaje: 'Registro eliminado definitivamente.' +
                    (desvinculados > 0
                        ? ` Se conservaron ${desvinculados} movimiento(s) de histórico, ya sin este vínculo.`
                        : '')
            };
        } catch (err) {
            try { await tx.rollback(); } catch (_) { /* la transacción ya estaba cerrada */ }
            throw err;
        }
    } catch (err) {
        if (err.number === 547) {
            return { ok: false, mensaje: 'No se puede eliminar definitivamente: hay registros que lo usan.' };
        }
        return { ok: false, mensaje: 'Error al eliminar definitivamente: ' + err.message };
    }
}

/* =========================================================
   RESOLVER ID DE CATÁLOGO (get-or-create)
   Convierte un nombre capturado en texto libre al Id de su
   catálogo. Es la pieza que permite que el formulario de activos
   registre "usuario asignado", modelo, procesador, etc. sin
   obligar al usuario a ir a Catálogos primero.

   Reglas:
     - Compara sin distinguir mayúsculas ni espacios sobrantes,
       así "HP", "hp" y "  Hp " son el mismo registro.
     - Si el registro existe pero está dado de baja, lo REACTIVA
       automáticamente: es justo el caso "lo vuelvo a necesitar"
       y no tiene sentido mandar al usuario a la pestaña
       Eliminados a restaurarlo a mano.
     - Si no existe, lo crea.
   Devuelve null si el texto viene vacío.
   ========================================================= */
async function resolverId(clave, nombre) {
    if (nombre === null || nombre === undefined) return null;

    const cfg = getConfig(clave);

    /* Nombre es único por catálogo, salvo en subtipos (único por
       Grupo + Nombre): ahí no se puede resolver sólo con el nombre. */
    if (clave === 'subtipos') {
        throw new Error('resolverId no admite el catálogo "subtipos": use Grupo + Nombre.');
    }

    const campoNombre = cfg.campos.find(c => c.nombre === 'Nombre') || {};
    const longitud = campoNombre.longitud || 100;

    /* Se recorta al largo real de la columna para no provocar un
       error de truncamiento si el texto viene más largo. */
    const texto = String(nombre).trim().slice(0, longitud);
    if (!texto) return null;

    await asegurarCatalogosExtendidos();
    const pool = await getPool();

    const buscar = () =>
        pool.request()
            .input('Nombre', sql.NVarChar(300), texto)
            .query(`
                SELECT TOP 1 ${cfg.pk} AS Id, Activo
                FROM ${cfg.tabla}
                WHERE UPPER(LTRIM(RTRIM(Nombre))) = UPPER(LTRIM(RTRIM(@Nombre)))
                ORDER BY ${cfg.pk}
            `);

    const existente = await buscar();

    if (existente.recordset.length > 0) {
        const fila = existente.recordset[0];
        if (!fila.Activo) {
            await pool.request()
                .input('Id', sql.Int, fila.Id)
                .query(`UPDATE ${cfg.tabla} SET Activo = 1 WHERE ${cfg.pk} = @Id`);
        }
        return fila.Id;
    }

    const insertado = await pool.request()
        .input('Nombre', tipoSql('NVarChar', longitud), texto)
        .query(`
            INSERT INTO ${cfg.tabla} (Nombre, Activo)
            OUTPUT INSERTED.${cfg.pk} AS Id
            VALUES (@Nombre, 1)
        `);

    return insertado.recordset[0].Id;
}

async function esValorActivo(clave, nombre) {
    if (!nombre) return false;
    await asegurarCatalogosExtendidos();
    const cfg = getConfig(clave);
    const pool = await getPool();
    const result = await pool.request()
        .input('Nombre', sql.NVarChar(300), String(nombre).trim())
        .query(`SELECT TOP 1 1 AS Existe FROM ${cfg.tabla} WHERE UPPER(Nombre) = UPPER(@Nombre) AND Activo = 1`);
    return result.recordset.length > 0;
}

async function listarEspecificaciones() {
    await asegurarCatalogosExtendidos();
    const resultados = await Promise.all(CATALOGOS_ESPECIFICACIONES.map(async cfg => ({
        clave: cfg.clave,
        registros: await listar(cfg.clave)
    })));
    return Object.fromEntries(resultados.map(item => [item.clave, item.registros]));
}

/* =========================================================
   LECTURA 3FN — NOMBRES DESDE EL CATÁLOGO
   ---------------------------------------------------------
   Las columnas de texto originales (Modelo, MotivoSalida, ...) se
   conservan como respaldo hasta que la fase 2 de
   scripts/activo-fijo-3fn.sql las elimine. Estas utilidades arman los
   JOIN y las columnas del SELECT en un solo lugar para que cada módulo
   de consultas no repita la misma lógica.
   ========================================================= */
const cacheColumnas = new Map();

/* Qué columnas de texto siguen existiendo en la tabla. Se recuerda por
   tabla: el esquema no cambia mientras la app está abierta. */
async function columnasExistentes(tabla, columnas) {
    const lista = columnas.filter(Boolean);
    if (lista.length === 0) return new Set();

    const llave = `${tabla}|${lista.join(',')}`;
    if (cacheColumnas.has(llave)) return cacheColumnas.get(llave);

    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = N'dbo'
          AND TABLE_NAME   = N'${tabla}'
          AND COLUMN_NAME IN (${lista.map(c => `N'${c}'`).join(', ')})
    `);
    const set = new Set(r.recordset.map(f => f.COLUMN_NAME));
    cacheColumnas.set(llave, set);
    return set;
}

/* ¿Existe la tabla? Se recuerda igual que las columnas. */
const cacheTablas = new Map();

async function tablaExiste(tabla) {
    if (cacheTablas.has(tabla)) return cacheTablas.get(tabla);
    const pool = await getPool();
    const r = await pool.request().query(
        `SELECT OBJECT_ID(N'dbo.${tabla}', N'U') AS IdObjeto`);
    const existe = r.recordset[0]?.IdObjeto != null;
    cacheTablas.set(tabla, existe);
    return existe;
}

/* Accesorios del equipo leídos como UNA columna de texto, igual que antes
   (el renderer no cambia): se agregan los conjuntos de la tabla puente y,
   mientras la columna de respaldo siga existiendo, se usa como respaldo de
   las filas que aún no tienen filas puente. */
async function prepararAccesoriosEquipo(aliasOrigen = 'af', tablaOrigen = 'ActivoFijoEquipos') {
    const [conPuente, columnasTexto] = await Promise.all([
        tablaExiste(TABLA_ACCESORIOS_EQUIPO),
        columnasExistentes(tablaOrigen, ['Accesorios'])
    ]);
    const hayTexto = columnasTexto.has('Accesorios');

    const agregado = `(
        SELECT STRING_AGG(ca.Nombre, N', ') WITHIN GROUP (ORDER BY ca.Nombre)
        FROM dbo.${TABLA_ACCESORIOS_EQUIPO} ea
        INNER JOIN dbo.ActivoFijoAccesorios ca ON ca.IdAccesorio = ea.IdAccesorio
        WHERE ea.IdActivoFijoEQ = ${aliasOrigen}.IdActivoFijoEQ
    )`;

    let expresion;
    if (conPuente && hayTexto) expresion = `COALESCE(${agregado}, ${aliasOrigen}.Accesorios)`;
    else if (conPuente)        expresion = agregado;
    else if (hayTexto)         expresion = `${aliasOrigen}.Accesorios`;
    else                       expresion = 'CAST(NULL AS NVARCHAR(300))';

    return {
        joins: [],
        columnas: [`${expresion} AS AccesoriosCatalogo`],
        aplicar: fila => {
            if (!fila) return fila;
            fila.Accesorios = fila.AccesoriosCatalogo ?? fila.Accesorios ?? null;
            delete fila.AccesoriosCatalogo;
            return fila;
        }
    };
}

/* Deja la tabla puente igual a lo capturado en el formulario: el texto se
   registra (o reactiva) en el catálogo de accesorios y se reemplazan las
   filas del equipo. Sin la migración aplicada no hace nada. */
async function sincronizarAccesoriosEquipo(idEquipo, textoAccesorios) {
    if (!idEquipo) return;
    if (!(await tablaExiste(TABLA_ACCESORIOS_EQUIPO))) return;

    const texto = String(textoAccesorios ?? '').trim();
    const pool = await getPool();

    await pool.request()
        .input('Id', sql.Int, idEquipo)
        .query(`DELETE FROM dbo.${TABLA_ACCESORIOS_EQUIPO} WHERE IdActivoFijoEQ = @Id`);

    if (!texto) return;

    const IdAccesorio = await resolverId('accesorios', texto);
    if (!IdAccesorio) return;

    await pool.request()
        .input('Id', sql.Int, idEquipo)
        .input('IdAccesorio', sql.Int, IdAccesorio)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM dbo.${TABLA_ACCESORIOS_EQUIPO}
                WHERE IdActivoFijoEQ = @Id AND IdAccesorio = @IdAccesorio
            )
                INSERT INTO dbo.${TABLA_ACCESORIOS_EQUIPO} (IdActivoFijoEQ, IdAccesorio)
                VALUES (@Id, @IdAccesorio);
        `);
}

/* campos: [{ campo, tabla, pk, fk, alias }]
     campo = columna de texto de origen (la que ya lee el renderer)
     fk    = columna FK en la tabla que se está consultando
   Devuelve { joins, columnas, aplicar }: las dos primeras se inyectan en
   el SQL y `aplicar` deja cada fila con las claves de siempre, así los
   renderers no cambian. */
async function prepararNombresCatalogo(tablaOrigen, aliasOrigen, campos) {
    const existentes = await columnasExistentes(tablaOrigen, campos.map(c => c.campo));

    const joins = campos.map(c =>
        `LEFT JOIN ${c.tabla} ${c.alias} ON ${c.alias}.${c.pk} = ${aliasOrigen}.${c.fk}`);

    const columnas = campos.map(c => {
        const nombre = `${c.alias}.Nombre`;
        return existentes.has(c.campo)
            ? `COALESCE(${nombre}, ${aliasOrigen}.${c.campo}) AS ${c.campo}Catalogo`
            : `${nombre} AS ${c.campo}Catalogo`;
    });

    const aplicar = fila => {
        if (!fila) return fila;
        for (const c of campos) {
            const clave = `${c.campo}Catalogo`;
            fila[c.campo] = fila[clave] ?? fila[c.campo] ?? null;
            delete fila[clave];
        }
        return fila;
    };

    return { joins, columnas, aplicar };
}

/* Une varias lecturas (p. ej. especificaciones del equipo + catálogos de
   la responsiva) en un solo juego de JOINs y columnas. */
function unirNombresCatalogo(...lecturas) {
    const validas = lecturas.filter(Boolean);
    return {
        joins:    validas.flatMap(l => l.joins),
        columnas: validas.flatMap(l => l.columnas),
        aplicar:  fila => validas.reduce((f, l) => l.aplicar(f), fila)
    };
}

/* Descriptor de un campo que pasó de texto a FK, tomando la tabla y la PK
   de la configuración del catálogo. */
function campoCatalogo(campo, clave, fk) {
    const cfg = getConfig(clave);
    return { campo, tabla: cfg.tabla, pk: cfg.pk, fk, alias: 'cat' + fk.replace(/^Id/, '') };
}

/* Especificaciones del activo que ya son FK. Accesorios queda fuera:
   guarda varios valores en una celda y sigue siendo texto libre. */
function camposEspecificaciones3FN() {
    return CATALOGOS_ESPECIFICACIONES
        .filter(c => c.clave !== 'accesorios')
        .map(c => campoCatalogo(c.origen, c.clave, c.pk));
}

/* Catálogos de la responsiva (motivo, proyecto, descripción, área, puesto
   de entrega y usuario que recibe). */
function camposResponsiva3FN() {
    const campos = CATALOGOS_RESPONSIVAS.map(c => ({
        campo: c.origen,
        tabla: c.tabla,
        pk:    c.pk,
        fk:    c.pk,
        alias: 'cat' + c.pk.replace(/^Id/, '')
    }));

    campos.push({
        campo: 'NombreRecibe',
        tabla: 'ActivoFijoUsuariosAsignados',
        pk:    'IdUsuarioAsignado',
        fk:    'IdUsuarioRecibe',
        alias: 'catUsuarioRecibe'
    });

    /* El puesto de quien recibe también se normalizó (FK IdPuesto). */
    campos.push({
        campo: 'PuestoRecibe',
        tabla: 'ActivoFijoPuestos',
        pk:    'IdPuesto',
        fk:    'IdPuesto',
        alias: 'catPuestoRecibe'
    });

    return campos;
}

module.exports = {
    listar, crear, actualizar, eliminar, restaurar, eliminarDefinitivo, CATALOGOS,
    asegurarCatalogosExtendidos, esValorActivo, listarEspecificaciones,
    resolverId,
    prepararNombresCatalogo, unirNombresCatalogo, columnasExistentes,
    camposEspecificaciones3FN, camposResponsiva3FN,
    tablaExiste, prepararAccesoriosEquipo, sincronizarAccesoriosEquipo,
    TABLA_ACCESORIOS_EQUIPO
};