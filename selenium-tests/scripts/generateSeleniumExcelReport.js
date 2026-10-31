/**
 * ─────────────────────────────────────────────────────────────
 *  selenium-tests/scripts/generateSeleniumExcelReport.js
 *  FoodieBite Selenium E2E Web — Styled Excel Report Generator
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Resolve ExcelJS
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch (e1) {
  try {
    ExcelJS = require(path.resolve(__dirname, '../../backend/node_modules/exceljs'));
  } catch (e2) {
    try {
      ExcelJS = require(path.resolve(__dirname, '../../node_modules/exceljs'));
    } catch (e3) {
      console.error('❌ ExcelJS is not installed. Please install exceljs.');
      process.exit(1);
    }
  }
}

const testCases = require('../data/testCasesData');
const OUTPUT_DIR_LOCAL = path.resolve(__dirname, '../reports');
const OUTPUT_DIR_ROOT = path.resolve(__dirname, '../../reports');

[OUTPUT_DIR_LOCAL, OUTPUT_DIR_ROOT].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Color Palette
const C = {
  NAVY_HEADER: 'FF0F172A',
  NAVY_SUBHEADER: 'FF1E293B',
  WHITE: 'FFFFFFFF',
  ZEBRA_BG: 'FFF8FAFC',
  BORDER: 'FFE2E8F0',
  PASS_BG: 'FFDCFCE7',
  PASS_FG: 'FF16A34A',
  FAIL_BG: 'FFFFE4E6',
  FAIL_FG: 'FFE11D48',
  P1_FG: 'FFE11D48',
  P2_FG: 'FFEA580C',
  P3_FG: 'FFD97706',
  P4_FG: 'FF0284C7',
  CARD_BG: 'FFF1F5F9',
  ORANGE_BRAND: 'FFFF6B00'
};

function styleHeaderCell(cell, text) {
  cell.value = text;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_HEADER } };
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.WHITE } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF475569' } },
    bottom: { style: 'medium', color: { argb: 'FF334155' } },
    left: { style: 'thin', color: { argb: 'FF475569' } },
    right: { style: 'thin', color: { argb: 'FF475569' } }
  };
}

function applyStatusBadge(cell, status) {
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  if (status === 'PASS') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.PASS_BG } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.PASS_FG } };
  } else {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.FAIL_BG } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.FAIL_FG } };
  }
}

function applySeverityStyle(cell, sev) {
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  let color = C.P4_FG;
  if (sev.includes('P1')) color = C.P1_FG;
  else if (sev.includes('P2')) color = C.P2_FG;
  else if (sev.includes('P3')) color = C.P3_FG;
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: color } };
}

async function generateReport() {
  console.log('📊 Building FoodieBite Selenium E2E Web Test Excel Report...');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FoodieBite Quality Engineering & Web Automation Team';
  wb.created = new Date();

  const totalTests = testCases.length;
  const passedTests = testCases.filter((t) => t.status === 'PASS').length;
  const failedTests = testCases.filter((t) => t.status === 'FAIL').length;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  const totalDurationMs = testCases.reduce((acc, t) => acc + t.durationMs, 0);
  const totalDurationMin = (totalDurationMs / 60000).toFixed(2);

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: TEST EXECUTION SUMMARY
  // ─────────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Test Execution Summary', { views: [{ showGridLines: true }] });

  // Banner
  ws1.mergeCells('A1:H2');
  const b1 = ws1.getCell('A1');
  b1.value = '🌐 FOODIEBITE WEB FRONTEND — SELENIUM E2E TEST SUMMARY';
  b1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_HEADER } };
  b1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: C.WHITE } };
  b1.alignment = { vertical: 'middle', horizontal: 'center' };

  // KPI Blocks
  ws1.mergeCells('A4:B5');
  const kpi1 = ws1.getCell('A4');
  kpi1.value = `Total E2E Tests\n${totalTests}`;
  kpi1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.CARD_BG } };
  kpi1.font = { size: 13, bold: true, color: { argb: C.NAVY_HEADER } };
  kpi1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  ws1.mergeCells('C4:D5');
  const kpi2 = ws1.getCell('C4');
  kpi2.value = `Passed (${passRate}%)\n${passedTests} / ${totalTests}`;
  kpi2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.PASS_BG } };
  kpi2.font = { size: 13, bold: true, color: { argb: C.PASS_FG } };
  kpi2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  ws1.mergeCells('E4:F5');
  const kpi3 = ws1.getCell('E4');
  kpi3.value = `Failed\n${failedTests}`;
  kpi3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: failedTests === 0 ? C.CARD_BG : C.FAIL_BG } };
  kpi3.font = { size: 13, bold: true, color: { argb: failedTests === 0 ? 'FF64748B' : C.FAIL_FG } };
  kpi3.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  ws1.mergeCells('G4:H5');
  const kpi4 = ws1.getCell('G4');
  kpi4.value = `Total Execution Time\n${totalDurationMin} min`;
  kpi4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.CARD_BG } };
  kpi4.font = { size: 13, bold: true, color: { argb: C.NAVY_HEADER } };
  kpi4.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  ws1.getCell('A7').value = 'Target Environment: Chrome Headless v131 | Selenium WebDriver v4.27 | React Native Web | Port 3000 / 5000';
  ws1.getCell('A7').font = { size: 10, italic: true, color: { argb: 'FF64748B' } };

  // Category Breakdown Table
  const moduleMap = {};
  testCases.forEach((t) => {
    if (!moduleMap[t.module]) {
      moduleMap[t.module] = {
        name: t.module,
        screen: t.screen,
        total: 0,
        passed: 0,
        failed: 0,
        duration: 0
      };
    }
    moduleMap[t.module].total++;
    if (t.status === 'PASS') moduleMap[t.module].passed++;
    else moduleMap[t.module].failed++;
    moduleMap[t.module].duration += t.durationMs;
  });

  const sumHeaders = ['#', 'Test Category / Domain', 'Target Component', 'Total Tests', 'Passed', 'Failed', 'Pass Rate', 'Avg Latency'];
  const hRow = ws1.getRow(9);
  hRow.height = 24;
  sumHeaders.forEach((h, i) => styleHeaderCell(hRow.getCell(i + 1), h));

  let rIdx = 10;
  let counter = 1;
  Object.values(moduleMap).forEach((m) => {
    const row = ws1.getRow(rIdx);
    row.height = 20;
    const isEven = counter % 2 === 0;

    row.getCell(1).value = counter;
    row.getCell(2).value = m.name;
    row.getCell(3).value = m.screen;
    row.getCell(4).value = m.total;
    row.getCell(5).value = m.passed;
    row.getCell(6).value = m.failed;
    row.getCell(7).value = `${((m.passed / m.total) * 100).toFixed(1)}%`;
    row.getCell(8).value = `${Math.round(m.duration / m.total)} ms`;

    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: C.BORDER } },
        bottom: { style: 'thin', color: { argb: C.BORDER } },
        left: { style: 'thin', color: { argb: C.BORDER } },
        right: { style: 'thin', color: { argb: C.BORDER } }
      };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ZEBRA_BG } };
      }
      if (c === 1 || c >= 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (c === 7) {
        cell.font = { bold: true, color: { argb: C.PASS_FG } };
      }
    }
    rIdx++;
    counter++;
  });

  // Grand Total Row
  const totalRow = ws1.getRow(rIdx);
  totalRow.height = 24;
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(2).value = 'All 12 Test Domains Combined';
  totalRow.getCell(3).value = 'Complete Web Authentication Surface';
  totalRow.getCell(4).value = totalTests;
  totalRow.getCell(5).value = passedTests;
  totalRow.getCell(6).value = failedTests;
  totalRow.getCell(7).value = `${passRate}%`;
  totalRow.getCell(8).value = `${Math.round(totalDurationMs / totalTests)} ms`;

  for (let c = 1; c <= 8; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.font = { bold: true, color: { argb: C.NAVY_HEADER } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: C.BORDER } },
      right: { style: 'thin', color: { argb: C.BORDER } }
    };
    if (c === 1 || c >= 4) cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  [6, 32, 28, 14, 12, 12, 14, 16].forEach((w, i) => (ws1.getColumn(i + 1).width = w));

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: GRANULAR TEST CASE DETAILS (322 CASES)
  // ─────────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Test Case Details', { views: [{ showGridLines: true, freezePane: { ySplit: 4 } }] });

  ws2.mergeCells('A1:N2');
  const b2 = ws2.getCell('A1');
  b2.value = `📋 FOODIEBITE SELENIUM WEB E2E TEST EXECUTION MATRIX (${testCases.length} TEST CASES)`;
  b2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_HEADER } };
  b2.font = { name: 'Calibri', size: 14, bold: true, color: { argb: C.WHITE } };
  b2.alignment = { vertical: 'middle', horizontal: 'center' };

  const detailHeaders = [
    '#',
    'Test ID',
    'Category / Domain',
    'Screen / Component',
    'Test Scenario / Objective',
    'Preconditions',
    'Step-by-Step Execution Actions',
    'Test Input / Data',
    'Expected Behavior',
    'Actual Result',
    'Status',
    'Severity',
    'Automation Type',
    'Duration (ms)'
  ];

  const colWidths = [6, 16, 26, 22, 38, 26, 42, 24, 38, 38, 12, 14, 18, 14];

  const hRow2 = ws2.getRow(4);
  hRow2.height = 26;
  detailHeaders.forEach((h, i) => styleHeaderCell(hRow2.getCell(i + 1), h));

  testCases.forEach((t, idx) => {
    const row = ws2.getRow(idx + 5);
    row.height = 22;
    const isEven = idx % 2 === 0;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = t.id;
    row.getCell(3).value = t.module;
    row.getCell(4).value = t.screen;
    row.getCell(5).value = t.title;
    row.getCell(6).value = t.preconditions;
    row.getCell(7).value = t.steps;
    row.getCell(8).value = t.testData;
    row.getCell(9).value = t.expected;
    row.getCell(10).value = t.actual;
    row.getCell(11).value = t.status;
    row.getCell(12).value = t.severity;
    row.getCell(13).value = t.type;
    row.getCell(14).value = t.durationMs;

    for (let c = 1; c <= 14; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: C.BORDER } },
        bottom: { style: 'thin', color: { argb: C.BORDER } },
        left: { style: 'thin', color: { argb: C.BORDER } },
        right: { style: 'thin', color: { argb: C.BORDER } }
      };

      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ZEBRA_BG } };
      }

      if (c === 1 || c === 2 || c === 14) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      if (c === 11) {
        applyStatusBadge(cell, t.status);
      }

      if (c === 12) {
        applySeverityStyle(cell, t.severity);
      }

      if (c === 13) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
  });

  colWidths.forEach((w, i) => (ws2.getColumn(i + 1).width = w));

  // ─────────────────────────────────────────────────────────────
  // SHEET 3: ENVIRONMENT & BROWSER SPECS
  // ─────────────────────────────────────────────────────────────
  const ws3 = wb.addWorksheet('Environment & Browser Specs', { views: [{ showGridLines: true }] });
  ws3.mergeCells('A1:D2');
  const b3 = ws3.getCell('A1');
  b3.value = '⚙️ SELENIUM WEB TEST AUTOMATION ENVIRONMENT SPECIFICATIONS';
  b3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_HEADER } };
  b3.font = { name: 'Calibri', size: 14, bold: true, color: { argb: C.WHITE } };
  b3.alignment = { vertical: 'middle', horizontal: 'center' };

  const envSpecs = [
    ['Automation Framework', 'Selenium WebDriver v4.27.0 (JavaScript / Node.js)'],
    ['Browser Engine', 'Google Chrome v131.0 (Headless / Blink Rendering Engine)'],
    ['Chromedriver', 'chromedriver v131.0.0 (W3C WebDriver Compliant)'],
    ['Target URL', 'http://localhost:3000/signin'],
    ['Reference Viewport', 'Desktop 1920 x 1080 px (FHD) & Mobile 390 x 844 px'],
    ['Frontend Architecture', 'React Native Web 0.19.10, React 18.2.0, Webpack 5'],
    ['Authorized Admin Account', 'sham111205s@gmail.com (Routes to /admin)'],
    ['Standard User Account', 'user@foodiebite.com (Routes to /home)'],
    ['Default Explicit Timeout', '15,000 ms (15 seconds)'],
    ['Implicit Timeout', '0 ms (Explicit until.elementLocated preferred)'],
    ['Page Load Strategy', 'normal (W3C full DOM and resource lifecycle)'],
    ['Report Formats', 'Styled Microsoft Excel (.xlsx) & Interactive Console Dashboard'],
    ['Accessibility Engine', 'axe-core v4.9 / WCAG 2.1 AA Compliance Checker'],
    ['CI/CD Runner', 'GitHub Actions (Ubuntu-latest / Windows-latest Runner)']
  ];

  ws3.getCell('A4').value = 'Configuration Parameter';
  ws3.getCell('B4').value = 'Specification / Configured Value';
  [ws3.getCell('A4'), ws3.getCell('B4')].forEach((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_HEADER } };
    c.font = { bold: true, color: { argb: C.WHITE } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  envSpecs.forEach((spec, idx) => {
    const row = ws3.getRow(idx + 5);
    row.getCell(1).value = spec[0];
    row.getCell(2).value = spec[1];
    for (let c = 1; c <= 2; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: C.BORDER } },
        bottom: { style: 'thin', color: { argb: C.BORDER } },
        left: { style: 'thin', color: { argb: C.BORDER } },
        right: { style: 'thin', color: { argb: C.BORDER } }
      };
      if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ZEBRA_BG } };
    }
  });

  ws3.getColumn(1).width = 32;
  ws3.getColumn(2).width = 62;

  // Save to both locations
  const fileLocal = path.resolve(OUTPUT_DIR_LOCAL, 'FoodieBite_Selenium_E2E_Test_Report.xlsx');
  const fileRoot = path.resolve(OUTPUT_DIR_ROOT, 'FoodieBite_Selenium_E2E_Test_Report.xlsx');

  await wb.xlsx.writeFile(fileLocal);
  await wb.xlsx.writeFile(fileRoot);

  console.log(`✅ Saved Local Excel Report: ${fileLocal}`);
  console.log(`✅ Saved Root Excel Report:  ${fileRoot}`);
}

if (require.main === module) {
  generateReport().catch((err) => {
    console.error('❌ Error generating Selenium Excel report:', err);
    process.exit(1);
  });
}

module.exports = { generateReport };
