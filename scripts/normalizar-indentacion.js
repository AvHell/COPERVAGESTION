/* Normaliza la indentación de la línea que insertó el helper Vivo.
   Script de un solo uso: se elimina al terminar. */
const fs = require('fs');
const path = require('path');

const carpetas = ['src/html', 'src/ActivoFijo/html'];
let tocados = 0;

for (const carpeta of carpetas) {
    for (const archivo of fs.readdirSync(carpeta)) {
        if (!archivo.endsWith('.html')) continue;
        const ruta = path.join(carpeta, archivo);
        const original = fs.readFileSync(ruta, 'utf8');
        const normalizado = original.replace(
            /^<script src="((?:\.\.\/)+js\/permisos-ui\.js)"><\/script>/gm,
            '    <script src="$1"></script>'
        );
        if (normalizado !== original) {
            fs.writeFileSync(ruta, normalizado);
            tocados += 1;
        }
    }
}

console.log('archivos normalizados:', tocados);
