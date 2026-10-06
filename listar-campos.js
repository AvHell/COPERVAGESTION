const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function listarCampos(rutaPDF) {
    const bytes = fs.readFileSync(rutaPDF);
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    const campos = form.getFields();

    console.log('\n📋 Campos encontrados en:', rutaPDF);
    console.log('═'.repeat(70));
    campos.forEach((campo, i) => {
        const tipo = campo.constructor.name;
        const nombre = campo.getName();
        console.log(`${String(i + 1).padStart(3, ' ')}. [${tipo}] ${nombre}`);
    });
    console.log('═'.repeat(70));
    console.log(`Total: ${campos.length} campos\n`);
}

listarCampos('./Formatos/ResponsivaCelulares.pdf').catch(err => {
    console.error('Error:', err.message);
});