/* =========================================================
   GENERADOR DEL ESQUEMA COMPLETO EN SQL  (desarrollo)
   ---------------------------------------------------------
   Reconstruye la base desde cero en un único script .sql:
     · tablas con todas sus columnas (tipo exacto, nulabilidad,
       identidad, computed, collation, sparse, rowguidcol)
     · DEFAULT / PK / UNIQUE / CHECK / índices (con INCLUDE y WHERE)
     · claves foráneas al final, para no depender del orden
     · funciones, vistas (orden topológico), procedimientos y triggers

   Uso:
     npx electron scripts/_generar-ddl.js

   Reutiliza la misma resolución de credenciales que scripts/_run-sql.js
   (safeStorage/DPAPI de la app, luego DB_* del entorno, luego
   .vscode/mcp.json). La contraseña nunca se imprime ni se escribe.
   ========================================================= */

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const sql = require('mssql');

const RAIZ = path.join(__dirname, '..');
const PKG = require(path.join(RAIZ, 'package.json'));
const DESTINO = path.join(RAIZ, 'scripts', 'esquema-bd-desde-cero.sql');

app.setName(PKG.name);
app.setPath('userData', path.join(app.getPath('appData'), PKG.name));

/* ---------- Credenciales (idéntico a _run-sql.js / _esquema-bd.js) ---------- */

function credencialesDeLaApp() {
    const base = app.getPath('appData');
    const candidatos = [
        path.join(base, PKG.name, 'db-credentials.dat'),
        path.join(base, PKG.build?.productName || 'Inventario Equipos', 'db-credentials.dat')
    ];
    for (const ruta of candidatos) {
        if (!fs.existsSync(ruta)) continue;
        try {
            const contenido = JSON.parse(
                safeStorage.decryptString(Buffer.from(fs.readFileSync(ruta, 'utf8'), 'base64'))
            );
            if (contenido?.config?.server) return contenido.config;
        } catch (error) {
            console.warn(`No se pudo leer ${ruta}: ${error.message}`);
        }
    }
    return null;
}

function credencialesDeEntorno() {
    const env = process.env;
    if (!env.DB_SERVER || !env.DB_DATABASE || !env.DB_USER || !env.DB_PASSWORD) return null;
    return {
        server: env.DB_SERVER,
        port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
        database: env.DB_DATABASE,
        user: env.DB_USER,
        password: env.DB_PASSWORD
    };
}

function credencialesDeMcp() {
    const ruta = path.join(RAIZ, '.vscode', 'mcp.json');
    if (!fs.existsSync(ruta)) return null;
    try {
        const crudo = fs.readFileSync(ruta, 'utf8').replace(/^\s*\/\/.*$/gm, '');
        const json = JSON.parse(crudo);
        const env = json?.servers?.['mssql-bsite']?.env || {};
        const password = String(env.SQLSERVER_PASSWORD || '');
        if (!password || password.includes('${input:')) return null;
        return {
            server: env.SQLSERVER_HOST,
            port: env.SQLSERVER_PORT ? Number(env.SQLSERVER_PORT) : undefined,
            database: env.SQLSERVER_DATABASE,
            user: env.SQLSERVER_USER,
            password
        };
    } catch {
        return null;
    }
}

function resolverCredenciales() {
    const config = credencialesDeLaApp() || credencialesDeEntorno() || credencialesDeMcp();
    if (!config) {
        throw new Error('No hay credenciales: guarda la conexión desde la app o define DB_SERVER/DB_DATABASE/DB_USER/DB_PASSWORD.');
    }
    return config;
}

/* ---------- Consultas de metadatos ---------- */

const Q_COLUMNAS = `
SELECT
    sch.name                                                             AS esquema,
    obj.name                                                             AS tabla,
    col.column_id                                                        AS orden,
    col.name                                                             AS columna,
    tp.name                                                              AS tipo,
    ts.name                                                              AS tipo_esquema,
    col.max_length, col.precision, col.scale,
    col.is_nullable, col.is_identity, col.is_computed,
    col.is_rowguidcol, col.is_sparse, col.collation_name,
    cc.seed_value, cc.increment_value, cc.is_not_for_replication AS ident_nfr,
    comp.definition                                                      AS calculo,
    comp.is_persisted
FROM sys.objects obj
JOIN sys.schemas sch  ON sch.schema_id = obj.schema_id
JOIN sys.columns col  ON col.object_id = obj.object_id
JOIN sys.types tp     ON tp.user_type_id = col.user_type_id
JOIN sys.schemas ts   ON ts.schema_id = tp.schema_id
LEFT JOIN sys.identity_columns cc
       ON cc.object_id = col.object_id AND cc.column_id = col.column_id
LEFT JOIN sys.computed_columns comp
       ON comp.object_id = col.object_id AND comp.column_id = col.column_id
WHERE obj.is_ms_shipped = 0 AND obj.type = 'U'
ORDER BY sch.name, obj.name, col.column_id;`;

const Q_TABLAS = `
SELECT sch.name AS esquema, t.name AS tabla, t.temporal_type_desc AS temporal
FROM sys.tables t
JOIN sys.schemas sch ON sch.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0
ORDER BY sch.name, t.name;`;

const Q_DEFAULTS = `
SELECT sch.name AS esquema, t.name AS tabla, c.name AS columna,
       dc.name AS restriccion, dc.definition AS definicion
FROM sys.default_constraints dc
JOIN sys.tables t   ON t.object_id = dc.parent_object_id
JOIN sys.schemas sch ON sch.schema_id = t.schema_id
JOIN sys.columns c  ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE t.is_ms_shipped = 0
ORDER BY 1, 2, 3;`;

/* PK y UNIQUE creadas como restricción (unique_index_id no nulo). */
const Q_RESTRICCIONES = `
SELECT
    sch.name + '.' + t.name                                              AS tabla,
    kc.name                                                              AS nombre,
    kc.type                                                              AS clase,
    i.type_desc                                                          AS tipo_indice,
    STUFF((
        SELECT ', ' + QUOTENAME(c.name)
             + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END
        FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = kc.parent_object_id
          AND ic.index_id = kc.unique_index_id
          AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '')   AS columnas
FROM sys.key_constraints kc
JOIN sys.tables t    ON t.object_id = kc.parent_object_id
JOIN sys.schemas sch ON sch.schema_id = t.schema_id
JOIN sys.indexes i   ON i.object_id = kc.parent_object_id AND i.index_id = kc.unique_index_id
WHERE t.is_ms_shipped = 0 AND kc.type IN ('PK', 'UQ')
ORDER BY 1, CASE kc.type WHEN 'PK' THEN 0 ELSE 1 END, 2;`;

const Q_INDICES = `
SELECT
    sch.name + '.' + t.name                                              AS tabla,
    i.name                                                               AS indice,
    i.type_desc                                                          AS tipo_indice,
    i.is_unique, ISNULL(i.filter_definition, '')                         AS filtro,
    STUFF((
        SELECT ', ' + QUOTENAME(c.name)
             + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END
        FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '')   AS columnas,
    STUFF((
        SELECT ', ' + QUOTENAME(c.name)
        FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 1
        ORDER BY ic.index_column_id
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '')   AS incluidas
FROM sys.indexes i
JOIN sys.tables t    ON t.object_id = i.object_id
JOIN sys.schemas sch ON sch.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0
  AND i.name IS NOT NULL
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND i.is_hypothetical = 0
ORDER BY tabla, i.index_id;`;

const Q_CHECKS = `
SELECT sch.name + '.' + t.name AS tabla, ck.name AS nombre,
       ck.definition AS definicion, ck.is_disabled, ck.is_not_trusted
FROM sys.check_constraints ck
JOIN sys.tables t    ON t.object_id = ck.parent_object_id
JOIN sys.schemas sch ON sch.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0
ORDER BY tabla, ck.name;`;

const Q_FKS = `
SELECT
    fk.name                                                              AS nombre,
    sch.name + '.' + t.name                                              AS tabla,
    rsch.name + '.' + rt.name                                            AS tabla_destino,
    STUFF((
        SELECT ', ' + QUOTENAME(COL_NAME(fkc.parent_object_id, fkc.parent_column_id))
        FROM sys.foreign_key_columns fkc
        WHERE fkc.constraint_object_id = fk.object_id
        ORDER BY fkc.constraint_column_id
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '')   AS columnas,
    STUFF((
        SELECT ', ' + QUOTENAME(COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id))
        FROM sys.foreign_key_columns fkc
        WHERE fkc.constraint_object_id = fk.object_id
        ORDER BY fkc.constraint_column_id
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '')   AS columnas_destino,
    fk.delete_referential_action_desc                                    AS al_borrar,
    fk.update_referential_action_desc                                    AS al_actualizar,
    fk.is_disabled, fk.is_not_trusted, fk.is_not_for_replication
FROM sys.foreign_keys fk
JOIN sys.tables t     ON t.object_id = fk.parent_object_id
JOIN sys.schemas sch  ON sch.schema_id = t.schema_id
JOIN sys.tables rt    ON rt.object_id = fk.referenced_object_id
JOIN sys.schemas rsch ON rsch.schema_id = rt.schema_id
WHERE t.is_ms_shipped = 0
ORDER BY tabla, nombre;`;

const Q_MODULOS = `
SELECT
    sch.name                            AS esquema,
    o.name                              AS objeto,
    o.object_id                         AS id,
    CASE o.type
        WHEN 'V'  THEN 'VIEW'
        WHEN 'P'  THEN 'PROC'
        WHEN 'FN' THEN 'FUNC'
        WHEN 'IF' THEN 'FUNC'
        WHEN 'TF' THEN 'FUNC'
        WHEN 'TR' THEN 'TRIGGER'
        WHEN 'SN' THEN 'SYNONYM'
    END                                 AS clase,
    RTRIM(o.type)                       AS tipo,
    m.definition                        AS definicion,
    m.uses_ansi_nulls                   AS ansi_nulls,
    m.uses_quoted_identifier            AS quoted_identifier,
    CAST(ISNULL(OBJECTPROPERTY(o.object_id, 'ExecIsQuotedIdentOn'), 1) AS bit) AS exec_quoted,
    tr.is_disabled                      AS trigger_deshabilitado,
    tr.is_instead_of_trigger            AS instead_of,
    OBJECT_SCHEMA_NAME(tr.parent_id) + '.' + OBJECT_NAME(tr.parent_id) AS trigger_tabla,
    CAST(ISNULL(OBJECTPROPERTY(o.object_id, 'IsSchemaBound'), 0) AS bit) AS schema_bound
FROM sys.objects o
JOIN sys.schemas sch   ON sch.schema_id = o.schema_id
LEFT JOIN sys.sql_modules m ON m.object_id = o.object_id
LEFT JOIN sys.triggers tr   ON tr.object_id = o.object_id
WHERE o.is_ms_shipped = 0
  AND o.type IN ('V', 'P', 'FN', 'IF', 'TF', 'TR', 'SN')
ORDER BY clase, esquema, objeto;`;

const Q_DEPENDENCIAS = `
SELECT DISTINCT d.referencing_id AS de, d.referenced_id AS a
FROM sys.sql_expression_dependencies d
WHERE d.referencing_id IS NOT NULL AND d.referenced_id IS NOT NULL
  AND d.referencing_id <> d.referenced_id;`;

/* ---------- Formato de tipos y literales ---------- */

const esc = nombre => '[' + String(nombre).replace(/]/g, ']]') + ']';
const cualificado = (esquema, objeto) => esc(esquema) + '.' + esc(objeto);
const sinEsquema = nombre => String(nombre).replace(/^[^.]+\./, '');

/** Texto listo para un literal N'...' (comillas simples duplicadas). */
const literal = texto => 'N' + "'" + String(texto).replace(/'/g, "''") + "'";

/** Devuelve el tipo con sus argumentos, o null si hay que usar nombre cualificado. */
function tipoSql(col) {
    const largo = col.max_length;
    const nombre = col.tipo;
    switch (nombre) {
        case 'varchar':
        case 'char':
        case 'varbinary':
        case 'binary':
            return `${nombre}(${largo === -1 ? 'max' : largo})`;
        case 'nvarchar':
        case 'nchar':
            return `${nombre}(${largo === -1 ? 'max' : largo / 2})`;
        case 'decimal':
        case 'numeric':
            return `${nombre}(${col.precision},${col.scale})`;
        case 'datetime2':
        case 'datetimeoffset':
        case 'time':
            return `${nombre}(${col.scale})`;
        case 'float':
            return col.precision !== 53 ? `float(${col.precision})` : 'float';
        default:
            /* Tipo de usuario (alias type): hay que cualificarlo. */
            return col.tipo_esquema && col.tipo_esquema !== 'sys'
                ? cualificado(col.tipo_esquema, nombre)
                : nombre;
    }
}

/* ---------- Bloque DDL de una tabla ---------- */

function bloqueTabla(esquema, tabla, columnas, defaults, collationBd) {
    const lineas = [];
    const porNombre = new Map(defaults.map(d => [d.columna, d]));

    for (const col of columnas) {
        const partes = [esc(col.columna)];
        if (col.is_computed) {
            partes.push('AS ' + col.calculo);
            if (col.is_persisted) partes.push('PERSISTED');
            lineas.push('    ' + partes.join(' '));
            continue;
        }
        partes.push(tipoSql(col));
        if (col.collation_name && col.collation_name !== collationBd) {
            partes.push('COLLATE ' + col.collation_name);
        }
        if (col.is_rowguidcol) partes.push('ROWGUIDCOL');
        if (col.is_sparse) partes.push('SPARSE');
        if (col.is_identity) {
            const semilla = col.seed_value ?? 1;
            const salto = col.increment_value ?? 1;
            partes.push(`IDENTITY(${semilla},${salto})`);
        }
        partes.push(col.is_nullable ? 'NULL' : 'NOT NULL');

        const def = porNombre.get(col.columna);
        if (def) {
            partes.push(`CONSTRAINT ${esc(def.restriccion)} DEFAULT ${def.definicion}`);
        }
        lineas.push('    ' + partes.join(' '));
    }

    const cuerpo = `CREATE TABLE ${cualificado(esquema, tabla)} (\n${lineas.join(',\n')}\n);`;
    return `IF OBJECT_ID(${literal(cualificado(esquema, tabla))}, N'U') IS NULL\n${cuerpo}\nGO\n`;
}

/* ---------- Orden topológico de módulos ---------- */

function ordenarPorDependencias(modulos, dependencias) {
    const porId = new Map(modulos.map(m => [m.id, m]));
    const pendientes = new Map();
    for (const m of modulos) {
        const deps = dependencias
            .filter(d => d.de === m.id && porId.has(d.a))
            .map(d => d.a);
        pendientes.set(m.id, new Set(deps));
    }

    const resultado = [];
    const hechos = new Set();
    let restantes = [...modulos];

    while (restantes.length) {
        const listos = restantes.filter(m => [...pendientes.get(m.id)].every(d => hechos.has(d)));
        const lote = listos.length ? listos : restantes; // ciclo: no bloquear la salida
        for (const m of lote) {
            resultado.push(m);
            hechos.add(m.id);
        }
        const ids = new Set(lote.map(m => m.id));
        restantes = restantes.filter(m => !ids.has(m.id));
    }
    return resultado;
}

/* ---------- Programa principal ---------- */

async function main() {
    const config = resolverCredenciales();
    console.log(`Servidor ${config.server}${config.port ? `:${config.port}` : ''} · base ${config.database}`);

    const pool = await new sql.ConnectionPool({
        server: config.server,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
        requestTimeout: 120000,
        connectionTimeout: 30000
    }).connect();

    try {
        const collationBd = (await pool.request().query(
            'SELECT CAST(DATABASEPROPERTYEX(DB_NAME(), \'Collation\') AS nvarchar(128)) AS col'
        )).recordset[0].col;

        const [rColumnas, rTablas, rDefaults, rRestric, rIndices, rChecks, rFks, rModulos, rDeps] =
            await Promise.all([
                pool.request().query(Q_COLUMNAS),
                pool.request().query(Q_TABLAS),
                pool.request().query(Q_DEFAULTS),
                pool.request().query(Q_RESTRICCIONES),
                pool.request().query(Q_INDICES),
                pool.request().query(Q_CHECKS),
                pool.request().query(Q_FKS),
                pool.request().query(Q_MODULOS),
                pool.request().query(Q_DEPENDENCIAS)
            ]);

        /* sysdiagrams es la tabla de soporte de los diagramas de SSMS, no del modelo. */
        const tablas = (rTablas.recordset || []).filter(t => t.tabla !== 'sysdiagrams');
        const excluir = new Set(['sysdiagrams']);

        const columnas = new Map();
        for (const col of rColumnas.recordset || []) {
            if (excluir.has(col.tabla)) continue;
            const llave = col.esquema + '.' + col.tabla;
            if (!columnas.has(llave)) columnas.set(llave, []);
            columnas.get(llave).push(col);
        }

        const defaults = new Map();
        for (const d of rDefaults.recordset || []) {
            if (excluir.has(d.tabla)) continue;
            const llave = d.esquema + '.' + d.tabla;
            if (!defaults.has(llave)) defaults.set(llave, []);
            defaults.get(llave).push(d);
        }

        const restricciones = new Map();
        for (const r of rRestric.recordset || []) {
            if (excluir.has(sinEsquema(r.tabla))) continue;
            if (!restricciones.has(r.tabla)) restricciones.set(r.tabla, []);
            restricciones.get(r.tabla).push(r);
        }

        const idxs = new Map();
        for (const i of rIndices.recordset || []) {
            if (excluir.has(sinEsquema(i.tabla))) continue;
            if (!idxs.has(i.tabla)) idxs.set(i.tabla, []);
            idxs.get(i.tabla).push(i);
        }

        const checks = (rChecks.recordset || []).filter(c => !excluir.has(sinEsquema(c.tabla)));
        const fks = (rFks.recordset || []).filter(f => !excluir.has(sinEsquema(f.tabla)));
        /* o.type es CHAR(2): llega con espacio de relleno ('V ', 'P ').
           Se excluyen los objetos de soporte de diagramas de SSMS: dependen de
           dbo.sysdiagrams, que aquí no se migra (SSMS los recrea al abrir el
           diseñador: Database Diagrams → New Database Diagram). */
        const SOPORTE_DIAGRAMAS = new Set([
            'sp_alterdiagram', 'sp_creatediagram', 'sp_dropdiagram',
            'sp_helpdiagramdefinition', 'sp_helpdiagrams', 'sp_renamediagram',
            'sp_upgraddiagrams', 'fn_diagramobjects'
        ]);
        const todosModulos = (rModulos.recordset || [])
            .map(m => ({ ...m, tipo: String(m.tipo).trim() }))
            .filter(m => !SOPORTE_DIAGRAMAS.has(String(m.objeto).toLowerCase()));
        const sinDefinicion = todosModulos.filter(m => !m.definicion);
        const modulos = todosModulos.filter(m => m.definicion);
        const dependencias = rDeps.recordset || [];

        const salida = [];
        const emitir = (...lineas) => salida.push(...lineas);

        /* ---------- Cabecera ---------- */
        emitir(
            '/* =========================================================',
            '   ESQUEMA COMPLETO — migración desde cero',
            '   ---------------------------------------------------------',
            `   Base de datos : ${config.database}`,
            `   Servidor      : ${config.server}${config.port ? ':' + config.port : ''}`,
            `   Generado      : ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
            `   Collation     : ${collationBd}`,
            '   ---------------------------------------------------------',
            `   Tablas: ${tablas.length} · FKs: ${fks.length} · CHECK: ${checks.length}` +
                ` · Índices: ${[...idxs.values()].reduce((n, l) => n + l.length, 0)}` +
                ` · Módulos: ${modulos.length}`,
            '   ---------------------------------------------------------',
            '   Generar de nuevo con:  npx electron scripts/_generar-ddl.js',
            '',
            '   ORDEN DEL SCRIPT',
            '     1. Base de datos (opcional, ver abajo)',
            '     2. Tablas con sus DEFAULT, columnas calculadas e IDENTITY',
            '     3. PK / UNIQUE / índices / CHECK',
            '     4. Claves foraneas (al final, sin depender del orden)',
            '     5. Funciones, vistas, procedimientos y triggers',
            '   NO se migran: dbo.sysdiagrams ni los sp_*diagram / fn_diagramobjects',
            '   de soporte de SSMS (los recrea SSMS al abrir Database Diagrams).',
            '   ========================================================= */',
            '',
            'SET NOCOUNT ON;',
            'SET XACT_ABORT ON;',
            'GO',
            '',
            '/* 1) BASE DE DATOS',
            '   En hospedajes compartidos (p. ej. sql.bsite.net) la base ya existe y',
            '   NO se puede crear por script: deja las dos líneas comentadas y apunta',
            '   el USE a tu base. En un servidor propio, descoméntalas. */',
            '-- CREATE DATABASE ' + esc(config.database) + ';',
            '-- GO',
            'USE ' + esc(config.database) + ';',
            'GO',
            '',
            'SET ANSI_NULLS ON;',
            'SET QUOTED_IDENTIFIER ON;',
            'GO',
            '',
            '/* 2) TABLAS',
            '   Cada tabla se crea con todas sus columnas, sus DEFAULT (con el nombre',
            '   real de la restricción) y su IDENTITY. Las claves y demás restricciones',
            '   van después, para que ninguna tabla dependa del orden de creación. */',
            ''
        );

        const tablasOrdenadas = [...tablas].sort((a, b) =>
            (a.esquema + '.' + a.tabla).localeCompare(b.esquema + '.' + b.tabla));

        for (const t of tablasOrdenadas) {
            const llave = t.esquema + '.' + t.tabla;
            const cols = columnas.get(llave) || [];
            if (!cols.length) continue;
            if (t.temporal && t.temporal !== 'NON_TEMPORAL_TABLE') {
                emitir(`/* AVISO: ${llave} es una tabla temporal del sistema (${t.temporal});`);
                emitir('   su historial no se replica en este script. */');
            }
            emitir(`/* ---- ${llave} (${cols.length} columnas) ---- */`);
            emitir(bloqueTabla(t.esquema, t.tabla, cols, defaults.get(llave) || [], collationBd));
        }

        /* ---------- 3. Claves, índices y CHECK ---------- */
        emitir(
            '/* 3) CLAVES PRIMARIAS, UNIQUE, ÍNDICES Y CHECK */',
            ''
        );

        for (const [llave, lista] of [...restricciones.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const tabla = cualificado(llave.split('.')[0], sinEsquema(llave));
            for (const r of lista) {
                const tipo = r.clase === 'PK'
                    ? `PRIMARY KEY ${r.tipo_indice === 'CLUSTERED' ? 'CLUSTERED' : 'NONCLUSTERED'}`
                    : `UNIQUE ${r.tipo_indice === 'CLUSTERED' ? 'CLUSTERED' : 'NONCLUSTERED'}`;
                emitir(`IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = ${literal(r.nombre)})`);
                emitir(`    ALTER TABLE ${tabla} ADD CONSTRAINT ${esc(r.nombre)} ${tipo} (${r.columnas});`);
                emitir('GO');
            }
        }

        emitir('');
        for (const [llave, lista] of [...idxs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const tabla = cualificado(llave.split('.')[0], sinEsquema(llave));
            for (const i of lista) {
                const tipoIndice = (i.tipo_indice || '').toUpperCase();
                if (!['CLUSTERED', 'NONCLUSTERED'].includes(tipoIndice)) {
                    emitir(`/* OMITIDO: índice ${esc(i.indice)} sobre ${tabla} de tipo ${i.tipo_indice}`);
                    emitir('   (columnstore / XML / espacial: créalo a mano si lo necesitas). */');
                    continue;
                }
                let ddl = `CREATE ${i.is_unique ? 'UNIQUE ' : ''}${tipoIndice} INDEX ${esc(i.indice)} ON ${tabla} (${i.columnas})`;
                if (i.incluidas) ddl += ` INCLUDE (${i.incluidas})`;
                if (i.filtro) ddl += ` WHERE ${i.filtro}`;
                emitir(ddl + ';');
                emitir('GO');
            }
        }

        emitir('');
        for (const c of checks) {
            const tabla = cualificado(c.tabla.split('.')[0], sinEsquema(c.tabla));
            const conCheck = c.is_not_trusted || c.is_disabled ? 'WITH NOCHECK' : 'WITH CHECK';
            emitir(`ALTER TABLE ${tabla} ${conCheck} ADD CONSTRAINT ${esc(c.nombre)} CHECK ${c.definicion};`);
            emitir('GO');
        }

        /* ---------- 4. Claves foráneas ---------- */
        emitir(
            '',
            '/* 4) CLAVES FORÁNEAS (van al final: así el orden de creación da igual) */',
            ''
        );
        for (const fk of fks.sort((a, b) => (a.tabla + a.nombre).localeCompare(b.tabla + b.nombre))) {
            const origen = cualificado(fk.tabla.split('.')[0], sinEsquema(fk.tabla));
            const destino = cualificado(fk.tabla_destino.split('.')[0], sinEsquema(fk.tabla_destino));
            let ddl = `ALTER TABLE ${origen} WITH CHECK ADD CONSTRAINT ${esc(fk.nombre)} ` +
                `FOREIGN KEY (${fk.columnas}) REFERENCES ${destino} (${fk.columnas_destino})`;
            if (fk.al_borrar && fk.al_borrar !== 'NO_ACTION') ddl += ` ON DELETE ${fk.al_borrar.replace('_', ' ')}`;
            if (fk.al_actualizar && fk.al_actualizar !== 'NO_ACTION') ddl += ` ON UPDATE ${fk.al_actualizar.replace('_', ' ')}`;
            emitir(ddl + ';');
            emitir(fk.is_disabled
                ? `ALTER TABLE ${origen} NOCHECK CONSTRAINT ${esc(fk.nombre)};`
                : `ALTER TABLE ${origen} CHECK CONSTRAINT ${esc(fk.nombre)};`);
            emitir('GO');
        }

        /* ---------- 5. Módulos ---------- */
        const funciones = modulos.filter(m => m.tipo === 'FN' || m.tipo === 'IF' || m.tipo === 'TF');
        const vistas = modulos.filter(m => m.tipo === 'V');
        const procs = modulos.filter(m => m.tipo === 'P');
        const triggers = modulos.filter(m => m.tipo === 'TR');
        const sinonimos = modulos.filter(m => m.tipo === 'SN');

        const bloqueModulo = (m, etiqueta) => {
            emitir(`/* ---- ${etiqueta} ${m.esquema}.${m.objeto} ---- */`);
            emitir(`SET ANSI_NULLS ${m.ansi_nulls ? 'ON' : 'OFF'};`);
            emitir(`SET QUOTED_IDENTIFIER ${m.quoted_identifier ? 'ON' : 'OFF'};`);
            emitir('GO');
            emitir(String(m.definicion).replace(/\r\n/g, '\n').replace(/\s*$/, ''));
            emitir('GO');
            if (m.tipo === 'TR' && m.trigger_deshabilitado) {
                const base = String(m.trigger_tabla || '').split('.');
                if (base.length === 2) {
                    emitir(`DISABLE TRIGGER ${esc(m.objeto)} ON ${cualificado(base[0], base[1])};`);
                    emitir('GO');
                }
            }
            emitir('');
        };

        emitir(
            '/* 5) FUNCIONES, VISTAS, PROCEDIMIENTOS Y TRIGGERS',
            '   El orden respeta las dependencias reales (sys.sql_expression_dependencies).',
            '   Si creas objetos nuevos que se usan entre sí, vuelve a generar este script. */',
            ''
        );


        if (sinDefinicion.length) {
            emitir('/* AVISO: los objetos siguientes existen en la base, pero el usuario de la');
            emitir('   conexión no puede leer su definición (falta permiso VIEW DEFINITION).');
            emitir('   Reconstrúyelos a mano o vuelve a generar con un usuario que sí lo tenga: */');
            for (const s of sinDefinicion) emitir(`-- ${s.clase} ${s.esquema}.${s.objeto}`);
            emitir('');
        }

        for (const m of ordenarPorDependencias(funciones, dependencias)) bloqueModulo(m, 'FUNCIÓN');
        for (const m of ordenarPorDependencias(vistas, dependencias)) bloqueModulo(m, 'VISTA');
        for (const m of ordenarPorDependencias(procs, dependencias)) bloqueModulo(m, 'PROCEDIMIENTO');
        for (const m of ordenarPorDependencias(triggers, dependencias)) bloqueModulo(m, 'TRIGGER');

        if (sinonimos.length) {
            emitir('/* SINÓNIMOS: sys.sql_modules no guarda su destino; créalos a mano. */');
            for (const s of sinonimos) emitir(`-- ${s.esquema}.${s.objeto}`);
            emitir('');
        }

        emitir('/* =========================================================');
        emitir('   FIN DEL SCRIPT');
        emitir('   ---------------------------------------------------------');
        emitir('   Comprobación rápida tras ejecutarlo:');
        emitir('     SELECT (SELECT COUNT(*) FROM sys.tables  WHERE is_ms_shipped = 0) AS tablas,');
        emitir('            (SELECT COUNT(*) FROM sys.foreign_keys)                    AS fks,');
        emitir('            (SELECT COUNT(*) FROM sys.views)                           AS vistas,');
        emitir('            (SELECT COUNT(*) FROM sys.procedures)                      AS procs,');
        emitir('            (SELECT COUNT(*) FROM sys.triggers WHERE is_ms_shipped = 0) AS triggers;');
        emitir('   ========================================================= */');

        fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
        fs.writeFileSync(DESTINO, salida.join('\n') + '\n', 'utf8');

        const lineas = salida.length;
        console.log(`Escrito ${DESTINO} (${lineas} líneas)`);
        console.log(
            `Tablas ${tablas.length} · PK/UNIQUE ${[...restricciones.values()].reduce((n, l) => n + l.length, 0)}` +
            ` · Índices ${[...idxs.values()].reduce((n, l) => n + l.length, 0)}` +
            ` · CHECK ${checks.length} · FK ${fks.length}` +
            ` · Funciones ${funciones.length} · Vistas ${vistas.length}` +
            ` · Procs ${procs.length} · Triggers ${triggers.length}`
        );
    } finally {
        await pool.close();
    }
}

app.whenReady().then(async () => {
    try {
        await main();
        app.exit(0);
    } catch (error) {
        console.error(`Fallo: ${error.message}`);
        app.exit(1);
    }
});
