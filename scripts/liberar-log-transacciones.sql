/*
  ============================================================
  LIBERAR ESPACIO DEL REGISTRO DE TRANSACCIONES (log)
  ------------------------------------------------------------
  Síntoma que corrige este script:

    Error al guardar el documento: The transaction log for
    database 'copervaservicios_' is full due to
    'ACTIVE_TRANSACTION' and the holdup lsn is (...).

  Ese error NO lo produce el archivo que se sube (.drawio, .pdf,
  .png...), sino el estado del log de la base de datos: el registro
  de transacciones llegó a su tamaño máximo y no puede reutilizar
  espacio porque hay una transacción abierta ("holdup lsn") o
  porque nadie hace copias de seguridad del log (modelo FULL).

  Qué hace este script, en orden:
    1. Diagnóstico: modelo de recuperación, tamaño/uso del log y
       las sesiones que están reteniendo el registro.
    2. Libera espacio según el modo elegido en @Modo:
         'SIMPLE' -> cambia el modelo a SIMPLE, hace CHECKPOINT y
                     reduce el archivo de log (recomendado cuando
                     la aplicación no tiene respaldos de log).
         'LOG'    -> hace BACKUP LOG (mantiene el modelo actual).
    3. Deja el archivo de log con un crecimiento razonable
       (porcentaje fijo pequeño en vez de crecimiento automático
       1 MB, que fragmenta y ralentiza las escrituras).

  Ejecutar en la base de datos de la aplicación con un usuario con
  permisos de administrador (db_owner / sysadmin).

  Es idempotente: se puede volver a ejecutar cuando el log vuelva a
  crecer. NO borra datos de las tablas de la aplicación.
  ============================================================
*/

USE [copervaservicios_];   -- <-- ajusta el nombre si es distinto
GO

/* ------------------------------------------------------------
   1. DIAGNÓSTICO: estado del log
   ------------------------------------------------------------ */
PRINT '--- Modelo de recuperación y archivos de la base de datos ---';

SELECT DB_NAME(database_id)              AS BaseDeDatos,
       CASE recovery_model
            WHEN 1 THEN 'FULL (requiere BACKUP LOG)'
            WHEN 2 THEN 'BULK_LOGGED'
            WHEN 3 THEN 'SIMPLE'
       END                               AS ModeloRecuperacion,
       name                              AS ArchivoLogico,
       type_desc                         AS Tipo,
       CAST(size * 8.0 / 1024 AS DECIMAL(12, 1))       AS TamanoMB,
       CAST(FILEPROPERTY(name, 'SpaceUsed') * 8.0 / 1024 AS DECIMAL(12, 1)) AS UsadoMB,
       CASE
            WHEN max_size = -1 THEN 'Sin límite'
            WHEN max_size = 0  THEN 'Sin crecimiento'
            ELSE CAST(CAST(max_size * 8.0 / 1024 AS DECIMAL(12, 1)) AS VARCHAR(30)) + ' MB'
       END                               AS TamanoMaximo,
       CASE is_percent_growth
            WHEN 1 THEN CAST(growth AS VARCHAR(10)) + ' %'
            ELSE CAST(CAST(growth * 8.0 / 1024 AS DECIMAL(12, 1)) AS VARCHAR(30)) + ' MB'
       END                               AS Crecimiento
FROM sys.database_files
WHERE type_desc IN ('LOG', 'ROWS');
GO

PRINT '--- Transacciones abiertas que retienen el log (holdup) ---';

SELECT s.session_id,
       s.login_name,
       s.host_name,
       s.program_name,
       s.status,
       DB_NAME(dt.database_id)                    AS BaseDeDatos,
       dt.database_transaction_begin_time         AS InicioTransaccion,
       DATEDIFF(MINUTE, dt.database_transaction_begin_time, GETDATE()) AS MinutosAbierta,
       dt.database_transaction_log_bytes_used     AS BytesLogUsados,
       r.blocking_session_id                       AS BloqueaA,
       LEFT(t.text, 400)                          AS UltimaSentencia
FROM sys.dm_tran_database_transactions dt
INNER JOIN sys.dm_tran_session_transactions st
        ON st.transaction_id = dt.transaction_id
INNER JOIN sys.dm_exec_sessions s
        ON s.session_id = st.session_id
LEFT JOIN sys.dm_exec_requests r
       ON r.session_id = s.session_id
OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE dt.database_id = DB_ID()
ORDER BY dt.database_transaction_begin_time;
GO

/* Si la consulta anterior lista sesiones de la aplicación, ciérrala
   (o reinicia la app) antes de continuar: mientras esa transacción
   siga abierta, el log no puede reutilizar espacio. */

/* ------------------------------------------------------------
   2. LIBERAR ESPACIO
   ------------------------------------------------------------
   @Modo = 'SIMPLE'  -> pasa la base a modelo SIMPLE (sin cadena de
                        respaldos de log), hace CHECKPOINT y reduce
                        el log. Es lo correcto cuando la aplicación
                        nunca ha hecho BACKUP LOG: en FULL el log sólo
                        se vacía con copias de seguridad del log.
   @Modo = 'LOG'     -> hace BACKUP LOG a @RutaRespaldo y reduce el
                        log. Úsalo si ya hay una rutina de respaldos
                        y quieres conservar la recuperación a un
                        punto en el tiempo.
   ------------------------------------------------------------ */
DECLARE @Modo        VARCHAR(10) = 'SIMPLE';   -- 'SIMPLE' o 'LOG'
DECLARE @TamanoLogMB INT         = 512;        -- tamaño objetivo del log
DECLARE @RutaRespaldo NVARCHAR(400) =
        N'C:\RespaldoTemp\' + DB_NAME() + N'_log.trn';  -- sólo para @Modo = 'LOG'

DECLARE @Base        SYSNAME      = DB_NAME();
DECLARE @ArchivoLog  SYSNAME;
DECLARE @Sentencia   NVARCHAR(MAX);

SELECT @ArchivoLog = name
FROM sys.database_files
WHERE type_desc = 'LOG';

IF @ArchivoLog IS NULL
BEGIN
    PRINT 'No se encontró el archivo de log de la base de datos.';
END
ELSE
BEGIN
    IF @Modo = 'LOG'
    BEGIN
        PRINT '--- Copia de seguridad del log ---';
        BEGIN TRY
            BACKUP LOG @Base TO DISK = @RutaRespaldo WITH NOFORMAT, NOINIT,
                   NAME = N'Respaldo de log para liberar espacio', SKIP, NOREWIND, NOUNLOAD;
            PRINT 'Copia del log generada en: ' + @RutaRespaldo;
        END TRY
        BEGIN CATCH
            PRINT 'No se pudo crear la copia del log: ' + ERROR_MESSAGE();
            PRINT 'Cambia @RutaRespaldo por una ruta válida del servidor o usa @Modo = ''SIMPLE''.';
        END CATCH
    END
    ELSE IF @Modo = 'SIMPLE'
    BEGIN
        /* Cambiar a SIMPLE sólo es seguro si la aplicación no necesita
           recuperación punto en el tiempo (escenario habitual aquí). */
        PRINT '--- Pasando la base a modelo SIMPLE ---';
        SET @Sentencia = N'ALTER DATABASE ' + QUOTENAME(@Base) + N' SET RECOVERY SIMPLE WITH NO_WAIT;';
        EXEC sp_executesql @Sentencia;
    END

    PRINT '--- CHECKPOINT y reducción del archivo de log ---';
    CHECKPOINT;

    SET @Sentencia = N'DBCC SHRINKFILE (N' + QUOTENAME(@ArchivoLog, '''') + N', '
                   + CAST(@TamanoLogMB AS NVARCHAR(10)) + N');';
    EXEC sp_executesql @Sentencia;
END;
GO

/* ------------------------------------------------------------
   3. CRECIMIENTO RAZONABLE DEL LOG
   ------------------------------------------------------------
   Evita el crecimiento aditivo de 1 MB (miles de fragmentos) y deja
   un margen suficiente para subir archivos grandes al módulo de
   Documentación sin que vuelva a quedarse sin espacio.
   ------------------------------------------------------------ */
DECLARE @Base       SYSNAME = DB_NAME();
DECLARE @ArchivoLog SYSNAME;
DECLARE @Sentencia  NVARCHAR(MAX);

SELECT @ArchivoLog = name
FROM sys.database_files
WHERE type_desc = 'LOG';

IF @ArchivoLog IS NOT NULL
BEGIN
    SET @Sentencia = N'ALTER DATABASE ' + QUOTENAME(@Base)
                   + N' MODIFY FILE (NAME = N' + QUOTENAME(@ArchivoLog, '''')
                   + N', FILEGROWTH = 256MB);';
    EXEC sp_executesql @Sentencia;
    PRINT 'Crecimiento del log ajustado a 256 MB.';
END;
GO

PRINT '--- Estado final del log ---';

SELECT name                                    AS ArchivoLogico,
       CAST(size * 8.0 / 1024 AS DECIMAL(12, 1)) AS TamanoMB,
       CAST(FILEPROPERTY(name, 'SpaceUsed') * 8.0 / 1024 AS DECIMAL(12, 1)) AS UsadoMB
FROM sys.database_files
WHERE type_desc = 'LOG';
GO
