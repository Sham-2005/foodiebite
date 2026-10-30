/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  scripts/runTestsAndExportExcel.js
 *  FoodieBite — 4-Test Automated Runner & Styled Excel Report Generator
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Runs the 4 FoodieBite test suites:
 *   - Test 1: Dietary Safety, Allergen Exclusions & Unit Conversions
 *   - Test 2: AI Recommendation Engine, BMR/TDEE & Medical Biomarkers
 *   - Test 3: Email Campaigns, Brevo Integration & Admin Management
 *   - Test 4: Frontend Nutrition OCR Scanner & Label Parsing
 *
 * CLI Options:
 *   --suite=1,2,3,4   Run only a specific test suite
 *   --all             Run all 4 test suites (default)
 *   --skip-exec       Skip execution and compile reports from existing logs (if any)
 *
 * Generates in `reports/`:
 *   1. Test_1_dietary_safety_report.xlsx
 *   2. Test_2_ai_medical_report.xlsx
 *   3. Test_3_email_admin_report.xlsx
 *   4. Test_4_frontend_scanner_report.xlsx
 *   5. FoodieBite_All_4_Tests_Summary_Report.xlsx
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Gracefully resolve ExcelJS from backend or root node_modules
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch (e1) {
  try {
    ExcelJS = require(path.resolve(__dirname, '../backend/node_modules/exceljs'));
  } catch (e2) {
    try {
      ExcelJS = require(path.resolve(__dirname, '../node_modules/exceljs'));
    } catch (e3) {
      console.error('❌ ExcelJS is not installed. Please run: npm install exceljs');
      process.exit(1);
    }
  }
}

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.resolve(ROOT_DIR, 'reports');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ── TEST SUITE CONFIGURATIONS ────────────────────────────────────────────────
const ALL_SUITES = [
  {
    id: 1,
    key: 'test_1_dietary_safety',
    title: 'Test 1: Dietary Safety & Unit Conversions',
    shortName: 'Dietary Safety & Unit Conversions',
    fileName: 'Test_1_dietary_safety_report.xlsx',
    description: 'Validates strict vegan, vegetarian, allergen exclusions, clinical unit conversions, confidence scoring, and admin security controls.',
    files: [
      { path: 'backend/src/services/__tests__/phase1SafetyRegression.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/unitConversionService.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/confidenceScoring.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/adminSecurityAndManagement.test.js', cwd: 'backend' }
    ]
  },
  {
    id: 2,
    key: 'test_2_ai_medical',
    title: 'Test 2: AI Recommendation & Medical Intelligence',
    shortName: 'AI Recommendation & Medical Intelligence',
    fileName: 'Test_2_ai_medical_report.xlsx',
    description: 'Tests unified profile builder, BMR/TDEE calculation, clinical biomarker extraction (BP, glucose, HbA1c, eGFR), contextual scoring, user behavior feedback, and golden baseline stability.',
    files: [
      { path: 'backend/src/services/__tests__/phase2Integration.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/phase3MedicalIntegration.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/phase4ContextIntegration.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/phase5BehaviorIntegration.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/recommendationRegression.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/aiEvaluationDataset.test.js', cwd: 'backend' }
    ]
  },
  {
    id: 3,
    key: 'test_3_email_admin',
    title: 'Test 3: Email Campaigns & Scheduler Engine',
    shortName: 'Email Campaigns & Scheduler Engine',
    fileName: 'Test_3_email_admin_report.xlsx',
    description: 'Evaluates Brevo email campaigns, transactional welcome flows, recipient isolation, rate limiting, and all 16 dynamic personalized email acceptance criteria.',
    files: [
      { path: 'backend/src/services/__tests__/brevoIntegration.test.js', cwd: 'backend' },
      { path: 'backend/src/services/__tests__/dailyPersonalizedEmail.test.js', cwd: 'backend' }
    ]
  },
  {
    id: 4,
    key: 'test_4_frontend_scanner',
    title: 'Test 4: Frontend Nutrition OCR Scanner',
    shortName: 'Frontend Nutrition OCR Scanner',
    fileName: 'Test_4_frontend_scanner_report.xlsx',
    description: 'Verifies packaged food label OCR parsing, decimal value preservation, kJ to kcal energy conversion, sodium/salt normalization, portion scaling, and photo fallback.',
    files: [
      { path: 'frontend/src/services/__tests__/nutritionScanner.test.mjs', cwd: ROOT_DIR }
    ]
  }
];

// ── EXECUTION & LOG PARSING ──────────────────────────────────────────────────
function runSuiteFile(fileConfig) {
  const fullPath = path.resolve(ROOT_DIR, fileConfig.path);
  const cwd = path.resolve(ROOT_DIR, fileConfig.cwd);
  const start = Date.now();

  console.log(`  ▶ Executing: ${fileConfig.path}`);
  const result = spawnSync(process.execPath, [fullPath], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
    timeout: 90000
  });

  const durationMs = Date.now() - start;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const exitCode = result.status;

  const testCases = [];
  const lines = (stdout + '\n' + stderr).split(/\r?\n/);

  let currentCategory = path.basename(fileConfig.path);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect section headers e.g. [PERSONA 1 — Vegan] or [1. PROFILE BUILDER]
    const sectionMatch = line.match(/^\[(.*?)\]$/);
    if (sectionMatch) {
      currentCategory = sectionMatch[1];
      continue;
    }

    // Detect passed test e.g. ✓ Vegan excludes all meat
    if (line.includes('✓')) {
      const name = line.replace(/^.*?✓\s*/, '').trim();
      testCases.push({
        name,
        category: currentCategory,
        file: path.basename(fileConfig.path),
        status: 'PASS',
        durationMs: Math.max(1, Math.round(durationMs / Math.max(testCases.length + 1, 1))),
        details: 'Assertion passed successfully'
      });
    } else if (line.includes('✗') || line.startsWith('FAIL') || line.includes('❌')) {
      const name = line.replace(/^.*?(✗|FAIL:|❌)\s*/, '').trim();
      testCases.push({
        name,
        category: currentCategory,
        file: path.basename(fileConfig.path),
        status: 'FAIL',
        durationMs: Math.max(1, Math.round(durationMs / Math.max(testCases.length + 1, 1))),
        details: line
      });
    }
  }

  // Fallback: If no individual checkmarks were parsed but the process passed
  if (testCases.length === 0) {
    testCases.push({
      name: `${path.basename(fileConfig.path)} Suite Execution`,
      category: 'General',
      file: path.basename(fileConfig.path),
      status: exitCode === 0 ? 'PASS' : 'FAIL',
      durationMs,
      details: exitCode === 0 ? 'Suite executed with exit code 0' : `Suite failed with exit code ${exitCode}: ${stderr.slice(0, 200)}`
    });
  }

  return {
    file: fileConfig.path,
    exitCode,
    durationMs,
    testCases,
    stdout,
    stderr
  };
}

// ── EXCEL STYLING HELPERS ────────────────────────────────────────────────────
const BRAND_ORANGE = 'FFFF6B35';
const BRAND_NAVY = 'FF0F172A';
const SLATE_HEADER = 'FF1E293B';
const SUCCESS_BG = 'FFD1FAE5';
const SUCCESS_FG = 'FF065F46';
const FAIL_BG = 'FFFEE2E2';
const FAIL_FG = 'FF991B1B';
const ZEBRA_BG = 'FFF8FAFC';
const WHITE = 'FFFFFFFF';

function styleHeaderCell(cell, text) {
  cell.value = text;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_HEADER } };
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };
}

function autoFitColumns(worksheet, minWidths = {}) {
  worksheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value ? cell.value.toString().length : 0;
      if (len > maxLen) maxLen = len;
    });
    const key = column.key;
    const min = minWidths[key] || 12;
    column.width = Math.min(Math.max(maxLen + 3, min), 65);
  });
}

// ── EXCEL SHEET BUILDERS ─────────────────────────────────────────────────────
function buildSummarySheet(workbook, suitesResults) {
  const ws = workbook.addWorksheet('Executive Summary', { views: [{ showGridLines: true }] });

  // Banner Row
  ws.mergeCells('A1:G2');
  const banner = ws.getCell('A1');
  banner.value = '🍽️ FoodieBite — Quality Assurance & Automated Test Report';
  banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_ORANGE } };
  banner.font = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE } };
  banner.alignment = { vertical: 'middle', horizontal: 'center' };

  // Metadata
  const now = new Date();
  const meta = [
    ['Generated Date:', now.toUTCString()],
    ['Environment:', `${process.platform} (${process.arch}) | Node.js ${process.version}`],
    ['Commit Ref:', process.env.GITHUB_SHA || 'Local / Development'],
    ['Run Trigger:', process.env.GITHUB_EVENT_NAME || 'Automated / Manual Dispatch']
  ];

  let rowIdx = 4;
  meta.forEach(([label, val]) => {
    ws.getCell(`A${rowIdx}`).value = label;
    ws.getCell(`A${rowIdx}`).font = { bold: true, color: { argb: 'FF475569' } };
    ws.getCell(`B${rowIdx}`).value = val;
    ws.getCell(`B${rowIdx}`).font = { color: { argb: 'FF0F172A' } };
    rowIdx++;
  });

  rowIdx += 1;

  // KPI Table Headers
  const headers = ['Suite ID', 'Test Suite Name', 'Total Tests', 'Passed', 'Failed', 'Pass Rate %', 'Duration'];
  const headerRow = ws.getRow(rowIdx);
  headerRow.height = 26;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    styleHeaderCell(cell, h);
  });
  rowIdx++;

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;
  let grandDuration = 0;

  suitesResults.forEach((s, idx) => {
    grandTotal += s.total;
    grandPassed += s.passed;
    grandFailed += s.failed;
    grandDuration += s.durationMs;

    const row = ws.getRow(rowIdx);
    row.height = 22;
    const isEven = idx % 2 === 0;

    row.getCell(1).value = `Test ${s.suite.id}`;
    row.getCell(2).value = s.suite.shortName;
    row.getCell(3).value = s.total;
    row.getCell(4).value = s.passed;
    row.getCell(5).value = s.failed;
    row.getCell(6).value = `${((s.passed / Math.max(s.total, 1)) * 100).toFixed(1)}%`;
    row.getCell(7).value = `${(s.durationMs / 1000).toFixed(2)}s`;

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG } };
      }
      if (c === 1 || c === 3 || c === 4 || c === 5 || c === 6 || c === 7) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (c === 4) {
        cell.font = { bold: true, color: { argb: SUCCESS_FG } };
      }
      if (c === 5 && s.failed > 0) {
        cell.font = { bold: true, color: { argb: FAIL_FG } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FAIL_BG } };
      }
    }
    rowIdx++;
  });

  // Grand Total Row
  const totalRow = ws.getRow(rowIdx);
  totalRow.height = 24;
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(2).value = 'All 4 Test Suites Combined';
  totalRow.getCell(3).value = grandTotal;
  totalRow.getCell(4).value = grandPassed;
  totalRow.getCell(5).value = grandFailed;
  totalRow.getCell(6).value = `${((grandPassed / Math.max(grandTotal, 1)) * 100).toFixed(1)}%`;
  totalRow.getCell(7).value = `${(grandDuration / 1000).toFixed(2)}s`;

  for (let c = 1; c <= 7; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { bold: true, color: { argb: BRAND_NAVY } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    if (c !== 2) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  autoFitColumns(ws, { 1: 12, 2: 36, 3: 14, 4: 12, 5: 12, 6: 15, 7: 14 });
}

function buildSuiteDetailSheet(workbook, suiteResult, sheetName) {
  const ws = workbook.addWorksheet(sheetName.substring(0, 31), { views: [{ showGridLines: true }] });

  // Banner
  ws.mergeCells('A1:F2');
  const banner = ws.getCell('A1');
  banner.value = `🧪 ${suiteResult.suite.title}`;
  banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_NAVY } };
  banner.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
  banner.alignment = { vertical: 'middle', horizontal: 'center' };

  // Description & Stats
  ws.getCell('A4').value = 'Scope & Purpose:';
  ws.getCell('A4').font = { bold: true, color: { argb: 'FF475569' } };
  ws.getCell('B4').value = suiteResult.suite.description;

  ws.getCell('A5').value = 'Test Execution:';
  ws.getCell('A5').font = { bold: true, color: { argb: 'FF475569' } };
  ws.getCell('B5').value = `Total: ${suiteResult.total} | Passed: ${suiteResult.passed} | Failed: ${suiteResult.failed} | Duration: ${(suiteResult.durationMs / 1000).toFixed(2)}s`;

  // Headers
  const headers = ['#', 'Test Description', 'Category / Persona', 'Test Source File', 'Status', 'Duration (ms)'];
  const headerRow = ws.getRow(7);
  headerRow.height = 24;
  headers.forEach((h, i) => {
    styleHeaderCell(headerRow.getCell(i + 1), h);
  });

  let rowIdx = 8;
  suiteResult.allTestCases.forEach((t, i) => {
    const row = ws.getRow(rowIdx);
    row.height = 20;
    const isEven = i % 2 === 0;

    row.getCell(1).value = i + 1;
    row.getCell(2).value = t.name;
    row.getCell(3).value = t.category || 'General';
    row.getCell(4).value = t.file;
    row.getCell(5).value = t.status;
    row.getCell(6).value = t.durationMs;

    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG } };
      }

      if (c === 1 || c === 6) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      if (c === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (t.status === 'PASS') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUCCESS_BG } };
          cell.font = { bold: true, color: { argb: SUCCESS_FG } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FAIL_BG } };
          cell.font = { bold: true, color: { argb: FAIL_FG } };
        }
      }
    }
    rowIdx++;
  });

  autoFitColumns(ws, { 1: 8, 2: 50, 3: 25, 4: 28, 5: 14, 6: 15 });
}

// ── MAIN RUNNER ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let suitesToRun = ALL_SUITES;

  const suiteArg = args.find((a) => a.startsWith('--suite='));
  if (suiteArg) {
    const suiteId = parseInt(suiteArg.split('=')[1], 10);
    const matched = ALL_SUITES.find((s) => s.id === suiteId);
    if (matched) {
      suitesToRun = [matched];
    } else {
      console.error(`Unknown suite id: ${suiteId}. Available suites: 1, 2, 3, 4`);
      process.exit(1);
    }
  }

  console.log('=================================================================');
  console.log('  FoodieBite — Running All 4 Test Suites & Exporting Excel Reports');
  console.log('=================================================================\n');

  const suiteResults = [];

  for (const suite of suitesToRun) {
    console.log(`\n=================================================================`);
    console.log(`[SUITE ${suite.id}] ${suite.title}`);
    console.log(`=================================================================`);

    const suiteStart = Date.now();
    const allTestCases = [];
    let fileFailures = 0;

    for (const fileConfig of suite.files) {
      const fileRes = runSuiteFile(fileConfig);
      allTestCases.push(...fileRes.testCases);
      if (fileRes.exitCode !== 0) {
        fileFailures++;
      }
    }

    const suiteDuration = Date.now() - suiteStart;
    const passed = allTestCases.filter((t) => t.status === 'PASS').length;
    const failed = allTestCases.filter((t) => t.status === 'FAIL').length;

    const result = {
      suite,
      total: allTestCases.length,
      passed,
      failed,
      durationMs: suiteDuration,
      allTestCases,
      fileFailures
    };

    suiteResults.push(result);

    console.log(`\n  📊 Suite ${suite.id} Summary: ${passed}/${allTestCases.length} Passed (${((passed / Math.max(allTestCases.length, 1)) * 100).toFixed(1)}%) in ${(suiteDuration / 1000).toFixed(2)}s`);

    // Generate Individual Suite Excel Report
    const singleWorkbook = new ExcelJS.Workbook();
    singleWorkbook.creator = 'FoodieBite Automated QA CI/CD';
    singleWorkbook.created = new Date();
    buildSummarySheet(singleWorkbook, [result]);
    buildSuiteDetailSheet(singleWorkbook, result, 'Test Details');

    const singleFilePath = path.join(REPORTS_DIR, suite.fileName);
    await singleWorkbook.xlsx.writeFile(singleFilePath);
    console.log(`  📁 Generated Individual Report: reports/${suite.fileName}`);
  }

  // Generate Consolidated All-in-One Excel Workbook if all suites ran
  if (suitesToRun.length > 1) {
    console.log('\n-----------------------------------------------------------------');
    console.log('  Generating Consolidated Master Workbook...');
    const masterWorkbook = new ExcelJS.Workbook();
    masterWorkbook.creator = 'FoodieBite Automated QA CI/CD';
    masterWorkbook.created = new Date();

    // 1. Summary sheet
    buildSummarySheet(masterWorkbook, suiteResults);

    // 2. Individual detail sheets for each test suite
    suiteResults.forEach((res) => {
      buildSuiteDetailSheet(masterWorkbook, res, `Test ${res.suite.id} - ${res.suite.shortName}`);
    });

    const masterPath = path.join(REPORTS_DIR, 'FoodieBite_All_4_Tests_Summary_Report.xlsx');
    await masterWorkbook.xlsx.writeFile(masterPath);
    console.log(`  📁 Generated Master Report: reports/FoodieBite_All_4_Tests_Summary_Report.xlsx`);
  }

  // Print Summary Table
  console.log('\n=================================================================');
  console.log('                 OVERALL TEST EXECUTION RESULTS                  ');
  console.log('=================================================================');
  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  suiteResults.forEach((s) => {
    grandTotal += s.total;
    grandPassed += s.passed;
    grandFailed += s.failed;
    console.log(`  ${s.suite.title.padEnd(46)} : ${s.passed} / ${s.total} PASS`);
  });

  console.log('-----------------------------------------------------------------');
  console.log(`  GRAND TOTAL: ${grandPassed} / ${grandTotal} Passed (${((grandPassed / Math.max(grandTotal, 1)) * 100).toFixed(1)}%)`);
  console.log('=================================================================');
  console.log(`  All Excel reports generated in: ${REPORTS_DIR}`);

  if (grandFailed > 0) {
    console.error(`\n❌ One or more tests failed. Check individual Excel reports for details.`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL TEST SUITES PASSED FLAWLESSLY!`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error during test runner execution:', err);
  process.exit(1);
});
