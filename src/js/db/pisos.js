const { getPool, sql } = require('./conexion');

/* =========================================================
   LISTAR
   ========================================================= */
async function listar() {
    const pool = await getPool();

    const pisosR = await pool.request().query(`
        SELECT IdPiso, Nombre, Filas, Columnas, Activo, FechaAlta
        FROM Pisos WHERE Activo = 1 ORDER BY Nombre
    `);

    const pisos = pisosR.recordset;
    if (pisos.length === 0) return [];

    const ids = pisos.map(p => p.IdPiso).join(',');
    const clientesR = await pool.request().query(`
        SELECT PC.IdPiso, C.IdCliente, C.Codigo, C.Nombre
        FROM PisoClientes PC
        INNER JOIN Clientes C ON C.IdCliente = PC.IdCliente
        WHERE PC.IdPiso IN (${ids})
        ORDER BY C.Nombre
    `);

    const porPiso = {};
    clientesR.recordset.forEach(c => {
        if (!porPiso[c.IdPiso]) porPiso[c.IdPiso] = [];
        porPiso[c.IdPiso].push({ IdCliente: c.IdCliente, Codigo: c.Codigo, Nombre: c.Nombre });
    });

    return pisos.map(p => ({ ...p, clientes: porPiso[p.IdPiso] || [] }));
}

/* =========================================================
   OBTENER
   ========================================================= */
async function obtener(idPiso) {
    const pool = await getPool();
    const pisoR = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`SELECT IdPiso, Nombre, Filas, Columnas, Activo FROM Pisos WHERE IdPiso = @IdPiso`);

    if (!pisoR.recordset[0]) return null;

    const clientesR = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT C.IdCliente, C.Codigo, C.Nombre
            FROM PisoClientes PC
            INNER JOIN Clientes C ON C.IdCliente = PC.IdCliente
            WHERE PC.IdPiso = @IdPiso
            ORDER BY C.Nombre
        `);

    return { ...pisoR.recordset[0], clientes: clientesR.recordset };
}

/* =========================================================
   LISTAR POR CLIENTE
   (pisos a los que un cliente tiene acceso)
   ========================================================= */
async function listarPorCliente(idCliente) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdCliente', sql.Int, idCliente)
        .query(`
            SELECT P.IdPiso, P.Nombre, P.Filas, P.Columnas
            FROM Pisos P
            INNER JOIN PisoClientes PC ON PC.IdPiso = P.IdPiso
            WHERE PC.IdCliente = @IdCliente AND P.Activo = 1
            ORDER BY P.Nombre
        `);
    return r.recordset;
}

/* =========================================================
   CREAR (con clientes)
   ========================================================= */
async function crear(nombre, filas, columnas, idsClientes = []) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        const insR = await new sql.Request(tx)
            .input('Nombre',   sql.NVarChar(100), nombre)
            .input('Filas',    sql.Int, filas)
            .input('Columnas', sql.Int, columnas)
            .query(`
                INSERT INTO Pisos (Nombre, Filas, Columnas)
                OUTPUT INSERTED.IdPiso
                VALUES (@Nombre, @Filas, @Columnas)
            `);

        const idPiso = insR.recordset[0].IdPiso;

        for (const idCliente of idsClientes) {
            await new sql.Request(tx)
                .input('IdPiso',    sql.Int, idPiso)
                .input('IdCliente', sql.Int, idCliente)
                .query(`INSERT INTO PisoClientes (IdPiso, IdCliente) VALUES (@IdPiso, @IdCliente)`);
        }

        await tx.commit();
        return { ok: true, IdPiso: idPiso, mensaje: 'Piso creado' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/* =========================================================
   ACTUALIZAR CON CLIENTES (todo en una transacción)
   - Actualiza nombre/filas/columnas
   - Sincroniza clientes (agrega/quita)
   - Bloquea si intenta quitar un cliente con equipos en el piso
   ========================================================= */
async function actualizarConClientes(idPiso, nombre, filas, columnas, idsClientes) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        // 1. Actualizar datos básicos
        await new sql.Request(tx)
            .input('IdPiso',   sql.Int, idPiso)
            .input('Nombre',   sql.NVarChar(100), nombre)
            .input('Filas',    sql.Int, filas)
            .input('Columnas', sql.Int, columnas)
            .query(`
                UPDATE Pisos SET Nombre = @Nombre, Filas = @Filas, Columnas = @Columnas
                WHERE IdPiso = @IdPiso
            `);

        // 2. Clientes actuales
        const actualesR = await new sql.Request(tx)
            .input('IdPiso', sql.Int, idPiso)
            .query(`SELECT IdCliente FROM PisoClientes WHERE IdPiso = @IdPiso`);
        const actuales = actualesR.recordset.map(r => Number(r.IdCliente));

        const nuevos = idsClientes.map(Number);

        const aAgregar = nuevos.filter(id => !actuales.includes(id));
        const aQuitar  = actuales.filter(id => !nuevos.includes(id));

        // 3. Validar que los clientes a quitar NO tengan equipos en el piso
        if (aQuitar.length > 0) {
            const checkR = await new sql.Request(tx)
                .input('IdPiso', sql.Int, idPiso)
                .query(`
                    SELECT DISTINCT E.IdCliente, C.Codigo
                    FROM Equipos E
                    INNER JOIN Clientes C ON C.IdCliente = E.IdCliente
                    WHERE E.IdPiso = @IdPiso AND E.IdCliente IN (${aQuitar.join(',')})
                `);

            if (checkR.recordset.length > 0) {
                const nombres = checkR.recordset.map(x => x.Codigo).join(', ');
                throw new Error(`No se puede quitar del piso a: ${nombres}. Tienen equipos asignados.`);
            }
        }

        // 4. Agregar
        for (const idCliente of aAgregar) {
            await new sql.Request(tx)
                .input('IdPiso',    sql.Int, idPiso)
                .input('IdCliente', sql.Int, idCliente)
                .query(`INSERT INTO PisoClientes (IdPiso, IdCliente) VALUES (@IdPiso, @IdCliente)`);
        }

        // 5. Quitar
        for (const idCliente of aQuitar) {
            await new sql.Request(tx)
                .input('IdPiso',    sql.Int, idPiso)
                .input('IdCliente', sql.Int, idCliente)
                .query(`DELETE FROM PisoClientes WHERE IdPiso = @IdPiso AND IdCliente = @IdCliente`);
        }

        await tx.commit();
        return { ok: true, mensaje: 'Piso actualizado' };
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

/* =========================================================
   ELIMINAR
   ========================================================= */
async function eliminar(idPiso) {
    const pool = await getPool();

    const eqR = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query('SELECT COUNT(*) AS total FROM Equipos WHERE IdPiso = @IdPiso');

    if (eqR.recordset[0].total > 0) {
        throw new Error('No se puede eliminar: el piso tiene equipos asignados.');
    }

    await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query('DELETE FROM Pisos WHERE IdPiso = @IdPiso');

    return { ok: true, mensaje: 'Piso eliminado' };
}

/* =========================================================
   CLIENTES DE UN PISO
   ========================================================= */
async function clientesDePiso(idPiso) {
    const pool = await getPool();
    const r = await pool.request()
        .input('IdPiso', sql.Int, idPiso)
        .query(`
            SELECT C.IdCliente, C.Codigo, C.Nombre
            FROM PisoClientes PC
            INNER JOIN Clientes C ON C.IdCliente = PC.IdCliente
            WHERE PC.IdPiso = @IdPiso
            ORDER BY C.Nombre
        `);
    return r.recordset;
}

module.exports = {
    listar,
    obtener,
    listarPorCliente,
    crear,
    actualizarConClientes,
    eliminar,
    clientesDePiso
};