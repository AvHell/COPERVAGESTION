/* =========================================================
   ACTIVO FIJO — RENDERER DE IMPORTACIÓN MASIVA (DINÁMICO)
   ========================================================= */
const Swal = window.Swal;

/* =========================================================
   ESTADO
   ========================================================= */
let layoutSeleccionado = null;
let layoutInfo         = null;
let archivoSeleccionado= null;
let filasPreview       = [];

/* =========================================================
   REFERENCIAS DOM
   ========================================================= */
const gridTipos           = document.getElementById('grid-tipos');
const pasoLayout          = document.getElementById('paso-layout');
const pasoArchivo         = document.getElementById('paso-archivo');
const pasoPreview         = document.getElementById('paso-preview');
const pasoResultado       = document.getElementById('paso-resultado');
const zonaDrop            = document.getElementById('zona-drop');
const inputArchivo        = document.getElementById('input-archivo');
const infoArchivo         = document.getElementById('info-archivo');
const archivoNombre       = document.getElementById('archivo-nombre');
const archivoMeta         = document.getElementById('archivo-meta');
const btnQuitarArchivo    = document.getElementById('btn-quitar-archivo');
const btnDescargarPlant   = document.getElementById('btn-descargar-plantilla');
const btnCancelarPreview  = document.getElementById('btn-cancelar-preview');
const btnImportar         = document.getElementById('btn-importar');
const previewHead         = document.getElementById('preview-head');
const previewBody         = document.getElementById('preview-body');
const resumenEl           = document.getElementById('resumen');
const resultadoContenido  = document.getElementById('resultado-contenido');
const btnNuevaImportacion = document.getElementById('btn-nueva-importacion');
const btnIrActivos        = document.getElementById('btn-ir-activos');

/* =========================================================
   UTILIDADES
   ========================================================= */
function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toastExito(titulo) {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success', title: titulo,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
        customClass: { popup: 'cl-toast' },
        didOpen: (t) => {
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function toastError(titulo, texto = '') {
    Swal.fire({
        toast: true, position: 'bottom-end', icon: 'error',
        title: texto ? `${titulo} — ${texto}` : titulo,
        showConfirmButton: false, timer: 3400, timerProgressBar: true,
        customClass: { popup: 'cl-toast' },
        didOpen: (t) => {
            t.addEventListener('mouseenter', Swal.stopTimer);
            t.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

/* =========================================================
   PASO 1 — CARGAR TIPOS DINÁMICOS
   ========================================================= */
async function cargarLayouts() {
    try {
        console.log("Solicitando layouts al backend...");
        const layouts = await window.api.activoFijo.importacion.listarLayouts();
        console.log("Layouts recibidos:", layouts);

        if (!layouts || layouts.length === 0) {
            gridTipos.innerHTML = '<p class="resumen-text">No hay tipos de activos configurados en la base de datos.</p>';
            return;
        }

        gridTipos.innerHTML = layouts.map(l => `
            <button type="button" class="tipo-card" data-clave="${escaparHTML(l.clave)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
                <span>${escaparHTML(l.titulo)}</span>
            </button>
        `).join('');

        gridTipos.querySelectorAll('.tipo-card').forEach(btn => {
            btn.addEventListener('click', () => seleccionarLayout(btn.dataset.clave));
        });
    } catch (err) {
        console.error("Error al cargar layouts:", err);
        toastError('No se pudieron cargar los tipos', err.message);
    }
}

async function seleccionarLayout(clave) {
    gridTipos.querySelectorAll('.tipo-card').forEach(b => {
        b.classList.toggle('activo', b.dataset.clave === clave);
    });

    layoutSeleccionado = clave;
    layoutInfo = await window.api.activoFijo.importacion.obtenerLayout(clave);

    pasoArchivo.classList.remove('oculto');
    pasoPreview.classList.add('oculto');
    pasoResultado.classList.add('oculto');
    limpiarArchivo();
}

/* =========================================================
   DESCARGA DE PLANTILLA DINÁMICA
   ========================================================= */
btnDescargarPlant.addEventListener('click', async () => {
    if (!layoutSeleccionado) {
        toastError('Selecciona un tipo de activo primero');
        return;
    }

    try {
        const layout = layoutInfo;
        if (!layout) { toastError('Layout no disponible'); return; }

        // Encabezados basados en la etiqueta
        const headers = layout.columnas.map(c => c.etiqueta);

        // Fila de ejemplo basada en la etiqueta
        const filaEjemplo = layout.columnas.map(c => layout.ejemplo[c.etiqueta] ?? '');

        // Generar CSV
        const csv = '\uFEFF' + [
            headers.join(','),
            filaEjemplo.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
        ].join('\r\n');

        const nombre = `Plantilla-${layout.titulo.replace(/\s+/g, '_')}.csv`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        a.click();
        URL.revokeObjectURL(url);

        // Mensaje corto para evitar que el toast se haga gigante
        toastExito('Plantilla generada con éxito');
    } catch (err) {
        toastError('Error al generar plantilla', err.message);
    }
});

/* =========================================================
   ZONA DROP
   ========================================================= */
zonaDrop.addEventListener('click', () => inputArchivo.click());

zonaDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    zonaDrop.classList.add('hover');
});
zonaDrop.addEventListener('dragleave', () => zonaDrop.classList.remove('hover'));
zonaDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    zonaDrop.classList.remove('hover');
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
});

inputArchivo.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) procesarArchivo(file);
});

btnQuitarArchivo.addEventListener('click', limpiarArchivo);

function limpiarArchivo() {
    archivoSeleccionado = null;
    filasPreview = [];
    inputArchivo.value = '';
    infoArchivo.classList.add('oculto');
    pasoPreview.classList.add('oculto');
    zonaDrop.style.display = '';
}

/* =========================================================
   PROCESAR ARCHIVO
   ========================================================= */
async function procesarArchivo(file) {
    const nombre = file.name.toLowerCase();
    if (!nombre.endsWith('.csv') && !nombre.endsWith('.xlsx') && !nombre.endsWith('.xls')) {
        toastError('Formato no soportado', 'Usa CSV o XLSX');
        return;
    }

    try {
        const filas = await leerArchivo(file);
        if (filas.length === 0) {
            toastError('Archivo vacío');
            return;
        }

        archivoSeleccionado = file;
        filasPreview = filas;

        archivoNombre.textContent = file.name;
        archivoMeta.textContent = `${filas.length} fila(s) · ${(file.size / 1024).toFixed(1)} KB`;
        infoArchivo.classList.remove('oculto');
        zonaDrop.style.display = 'none';

        await renderPreview();
    } catch (err) {
        toastError('Error al leer archivo', err.message);
    }
}

/* =========================================================
   LECTURA DE CSV / XLSX
   ========================================================= */
async function leerArchivo(file) {
    const nombre = file.name.toLowerCase();

    if (nombre.endsWith('.csv')) {
        const texto = await file.text();
        return parsearCSV(texto);
    }

    // XLSX / XLS
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datos = XLSX.utils.sheet_to_json(hoja, { defval: '' });
    return datos;
}

function parsearCSV(texto) {
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);

    const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lineas.length < 2) return [];

    const sep = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ';' : ',';

    const headers = parsearLineaCSV(lineas[0], sep);

    return lineas.slice(1).map(linea => {
        const valores = parsearLineaCSV(linea, sep);
        const fila = {};
        headers.forEach((h, i) => {
            fila[h.trim()] = (valores[i] ?? '').trim();
        });
        return fila;
    });
}

function parsearLineaCSV(linea, sep) {
    const valores = [];
    let actual = '';
    let enComillas = false;

    for (let i = 0; i < linea.length; i++) {
        const ch = linea[i];
        if (ch === '"') {
            if (enComillas && linea[i + 1] === '"') {
                actual += '"';
                i++;
            } else {
                enComillas = !enComillas;
            }
        } else if (ch === sep && !enComillas) {
            valores.push(actual);
            actual = '';
        } else {
            actual += ch;
        }
    }
    valores.push(actual);
    return valores;
}

/* =========================================================
   PREVIEW Y VALIDACIÓN
   ========================================================= */
async function renderPreview() {
    pasoPreview.classList.remove('oculto');

    const layout = layoutInfo;
    const columnas = layout.columnas;

    // Encabezados
    previewHead.innerHTML = '<tr>' +
        '<th>#</th>' +
        columnas.map(c => `<th>${escaparHTML(c.etiqueta)}</th>`).join('') +
        '<th>Estado</th>' +
        '</tr>';

    previewBody.innerHTML = filasPreview.map((fila, idx) => {
        const celdas = columnas.map(c => {
            // Buscar primero por etiqueta, luego por key
            const val = fila[c.etiqueta] ?? fila[c.key] ?? '';
            return `<td>${escaparHTML(val)}</td>`;
        }).join('');
        const num = idx + 2;
        return `<tr data-fila="${num}">
            <td><strong>${num}</strong></td>
            ${celdas}
            <td><span class="celda-estado">Listo</span></td>
        </tr>`;
    }).join('');

    const total = filasPreview.length;
    resumenEl.innerHTML = `Se procesarán <strong>${total}</strong> fila(s) para el tipo <strong>${escaparHTML(layout.titulo)}</strong>.`;
}

btnCancelarPreview.addEventListener('click', limpiarArchivo);

/* =========================================================
   IMPORTAR
   ========================================================= */
btnImportar.addEventListener('click', async () => {
    if (!layoutSeleccionado || filasPreview.length === 0) {
        toastError('No hay datos para importar');
        return;
    }

    const conf = await Swal.fire({
        icon: 'question',
        title: '¿Confirmar importación?',
        html: `Se van a importar <strong>${filasPreview.length}</strong> fila(s) como <strong>${escaparHTML(layoutInfo.titulo)}</strong>.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, importar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
            popup: 'cl-confirm',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled'
        }
    });
    if (!conf.isConfirmed) return;

    btnImportar.disabled = true;
    const originalHTML = btnImportar.innerHTML;
    btnImportar.innerHTML = 'Importando...';

    try {
        const res = await window.api.activoFijo.importacion.importar({
            layout: layoutSeleccionado,
            filas: filasPreview
        });

        mostrarResultado(res);
    } catch (err) {
        toastError('Error al importar', err.message);
    } finally {
        btnImportar.disabled = false;
        btnImportar.innerHTML = originalHTML;
    }
});

/* =========================================================
   RESULTADO
   ========================================================= */
function mostrarResultado(res) {
    pasoPreview.classList.add('oculto');
    pasoArchivo.classList.add('oculto');
    pasoLayout.classList.add('oculto');
    pasoResultado.classList.remove('oculto');

    if (!res || !res.ok) {
        resultadoContenido.innerHTML = `
            <div class="resultado-error">
                <div class="resultado-titulo">Error en la importación</div>
                <p>${escaparHTML(res?.mensaje || 'Error desconocido')}</p>
            </div>
        `;
        return;
    }

    const exitosos = res.insertados || [];
    const errores  = res.errores || [];

    let html = '';

    if (exitosos.length > 0) {
        html += `
            <div class="resultado-ok">
                <div class="resultado-titulo">✓ ${exitosos.length} activo(s) importado(s)</div>
                <p>Se crearon correctamente en el inventario.</p>
            </div>
        `;
    }

    if (errores.length > 0) {
        html += `
            <div class="resultado-error">
                <div class="resultado-titulo">✗ ${errores.length} fila(s) con errores</div>
                <ul class="lista-errores">
                    ${errores.map(e => `<li><strong>Fila ${e.fila}:</strong> ${escaparHTML(e.mensaje)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    if (exitosos.length === 0 && errores.length === 0) {
        html = `<div class="resultado-error"><p>No se procesó ninguna fila.</p></div>`;
    }

    resultadoContenido.innerHTML = html;
}

btnNuevaImportacion.addEventListener('click', () => {
    layoutSeleccionado = null;
    layoutInfo = null;
    archivoSeleccionado = null;
    filasPreview = [];

    gridTipos.querySelectorAll('.tipo-card').forEach(b => b.classList.remove('activo'));

    pasoLayout.classList.remove('oculto');
    pasoArchivo.classList.add('oculto');
    pasoPreview.classList.add('oculto');
    pasoResultado.classList.add('oculto');
    infoArchivo.classList.add('oculto');
    zonaDrop.style.display = '';
    inputArchivo.value = '';
});

btnIrActivos.addEventListener('click', () => {
    window.api.abrirActivoFijoActivos();
});

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
document.getElementById('btn-volver').addEventListener('click', () => {
    window.api.volverMenu();
});

/* =========================================================
   INICIO
   ========================================================= */
(async () => {
    await cargarLayouts();
})();