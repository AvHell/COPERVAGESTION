/* Diagnóstico temporal: comprueba si safeStorage puede cifrar/descifrar en
   esta sesión y si el archivo guardado por la app pertenece a este usuario.
   Uso: npx electron scripts/_diag-creds.js  (se puede borrar después) */
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

app.whenReady().then(() => {
    console.log('encryptionAvailable:', safeStorage.isEncryptionAvailable());
    try {
        const prueba = 'hola-mundo';
        const ida = safeStorage.encryptString(prueba);
        const vuelta = safeStorage.decryptString(ida);
        console.log('roundtrip:', vuelta === prueba ? 'OK' : 'FALLO');
        console.log('prefijo blob:', JSON.stringify(Buffer.from(ida).slice(0, 3).toString('utf8')));
    } catch (error) {
        console.log('roundtrip error:', error.message);
    }
    const ruta = path.join(process.env.APPDATA, 'proyectoequipos', 'db-credentials.dat');
    if (fs.existsSync(ruta)) {
        try {
            const texto = fs.readFileSync(ruta, 'utf8');
            const blob = Buffer.from(texto, 'base64');
            console.log('archivo bytes:', blob.length, 'prefijo:', JSON.stringify(blob.slice(0, 3).toString('utf8')));
            console.log('descifrado:', safeStorage.decryptString(blob).slice(0, 40) + '…');
        } catch (error) {
            console.log('descifrado error:', error.message);
        }
    }
    app.exit(0);
});
