# Inventario de Equipos

Aplicación de escritorio Electron para administrar equipos, pisos, activo fijo y responsivas.

## Requisitos

- Windows 10/11 para la configuración de credenciales cifradas.
- Node.js y npm para desarrollo.
- Acceso de red al servidor SQL Server configurado por la organización.

## Inicio de sesión y conexión a SQL Server

Las credenciales de base de datos no se guardan en el código ni en un archivo `.env`. En el primer inicio, la aplicación solicita servidor, instancia (opcional), base de datos, usuario y contraseña; prueba la conexión y guarda el bloque cifrado mediante `safeStorage` de Electron, respaldado por el almacenamiento seguro del sistema operativo (DPAPI en Windows).

El archivo cifrado se guarda en el directorio de datos de usuario de Electron (`app.getPath('userData')`), fuera de la carpeta de instalación y del repositorio. Por ello, instalar una actualización no elimina la conexión guardada. La configuración queda ligada al perfil de Windows que la creó: ejecuta la aplicación con ese mismo usuario. No copies el archivo cifrado a otra computadora o perfil.

Para desarrollo o despliegues administrados se admite una configuración inicial por variables de entorno: `DB_SERVER`, `DB_DATABASE`, `DB_USER` y `DB_PASSWORD`; `DB_INSTANCE` es opcional. Si están completas y todavía no hay una configuración cifrada, se guardan cifradas al iniciar. La configuración visual de primer inicio es la opción recomendada. No guardes estas variables en el repositorio, scripts compartidos, logs ni archivos `.env` distribuidos.

Para cambiar las credenciales guardadas, elimina **solo** `db-credentials.dat` del directorio de datos de usuario de la aplicación y vuelve a iniciarla para abrir el asistente de configuración. No es necesario reinstalar ni borrar otros datos de usuario.

### Actualizaciones desde versiones anteriores

La versión 3.0.0 ya no contiene la credencial que usaban versiones antiguas. En la primera ejecución después de actualizar, configura y valida de nuevo la conexión una sola vez. Las actualizaciones posteriores conservan la configuración cifrada mientras se use el mismo perfil de Windows y no se desinstalen/borran los datos de usuario.

### Límite de seguridad importante

El cifrado local protege las credenciales almacenadas en reposo y evita publicarlas junto al código. No puede ocultar una contraseña que una aplicación de escritorio necesita usar: un usuario con control de la computadora puede inspeccionar el proceso o la conexión en ejecución. La solución recomendada para producción con usuarios no confiables es mover el acceso SQL a una API/backend controlado, guardar el secreto únicamente en el servidor (por ejemplo, un gestor de secretos) y autenticar cada usuario frente a esa API. Usa una cuenta SQL de mínimo privilegio. La conexión mantiene la opción TLS compatible con la versión anterior (`trustServerCertificate`); para validar certificados, instala un certificado confiable en SQL Server y cambia esa opción a `false`.

Si una credencial se incluyó alguna vez en un commit o en un repositorio remoto, quitarla del archivo actual no la elimina del historial. Rota/revoca esa contraseña en SQL Server y, si el repositorio fue público, limpia el historial y coordina la invalidación de clones y artefactos antiguos.

## Desarrollo y empaquetado

```powershell
npm install
npm start
npm run dist
```

La versión de la aplicación se mantiene en `package.json` y `package-lock.json`. El publicador de actualizaciones está configurado en la sección `build.publish` de `package.json`.
