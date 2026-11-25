const ExcelJS = require('exceljs');
const path = require('path');

async function check() {
  const file = path.resolve(__dirname, '../../Test Results/Excel/Automation_Test_Report.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  console.log('Worksheet Verification for: Automation_Test_Report.xlsx');
  wb.eachSheet((s) => {
    console.log(` - Sheet: "${s.name}" | Row Count: ${s.rowCount}`);
  });
}

check().catch(console.error);
