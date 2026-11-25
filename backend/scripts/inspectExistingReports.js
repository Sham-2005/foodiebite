const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function inspectWorkbooks() {
  const dir = 's:/files/food_app/Vulnerability Test Results';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
  console.log('Excel files found:', files);

  for (const f of files) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path.join(dir, f));
      console.log(`\nWorkbook [${f}]:`);
      for (const ws of wb.worksheets) {
        console.log(`  - Sheet: "${ws.name}", Rows: ${ws.rowCount}, Columns: ${ws.columnCount}`);
        const header = [];
        ws.getRow(1).eachCell(c => header.push(c.value));
        console.log(`    Header: ${header.join(' | ')}`);
      }
    } catch (e) {
      console.error(`Error reading ${f}:`, e.message);
    }
  }
}

inspectWorkbooks();
