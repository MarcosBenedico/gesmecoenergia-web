#!/usr/bin/env node

import ExcelJS from 'exceljs';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Uso: node inspect-excel.mjs <ruta-archivo>');
  process.exit(1);
}

async function inspectExcel() {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    console.log('\n' + '='.repeat(80));
    console.log('📊 ESTRUCTURA DEL EXCEL DE PEDRO');
    console.log('='.repeat(80));

    for (const worksheet of workbook.worksheets) {
      console.log(`\n📄 HOJA: ${worksheet.name}`);
      console.log('-'.repeat(80));

      worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
        console.log(`\nFila ${rowNum}:`);
        row.eachCell({ includeEmpty: false }, (cell, colNum) => {
          const colLetter = String.fromCharCode(64 + colNum);
          console.log(
            `  ${colLetter}${rowNum}: "${cell.value}" ` +
              `| Font: ${cell.font?.bold ? 'BOLD' : 'normal'}, ` +
              `Size: ${cell.font?.size || 11}, ` +
              `Fill: ${cell.fill?.fgColor?.rgb || 'none'}, ` +
              `Align: ${cell.alignment?.horizontal || 'default'}, ` +
              `Merged: ${cell.isMerged ? 'YES' : 'NO'}`
          );
        });
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Análisis completado');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

inspectExcel();
