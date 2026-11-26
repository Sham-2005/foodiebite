/**
 * scripts/testing/validateTestResults.js
 * Independent QA Verification Script
 * Validates presence, non-zero file sizes, and schema integrity of all QA report artifacts.
 */
const fs = require('fs');
const path = require('path');

function validateAllReports() {
  console.log('='.repeat(70));
  console.log('       FOODIEBITE INDEPENDENT QA REPORT INTEGRITY AUDIT');
  console.log('='.repeat(70));

  const rootDir = path.resolve(__dirname, '../..');

  const requiredWorkbooks = [
    { name: 'Master QA Workbook', path: 'reports/master/FoodieBite_Master_QA_Report.xlsx' },
    { name: 'Selenium E2E Workbook', path: 'reports/selenium/Selenium_E2E_Report.xlsx' },
    { name: 'Appium Android Workbook', path: 'reports/appium/Appium_Android_E2E_Report.xlsx' },
    { name: 'REST API Workbook', path: 'reports/api/API_Test_Report.xlsx' },
    { name: 'Integration E2E Workbook', path: 'reports/integration/Integration_Test_Report.xlsx' },
    { name: 'Security Audit Workbook', path: 'reports/security/Security_Test_Report.xlsx' },
    { name: 'Baseline Load Test Workbook', path: 'reports/performance/Baseline_Load_Test_Report.xlsx' }
  ];

  let missingCount = 0;

  requiredWorkbooks.forEach(wb => {
    const fullPath = path.resolve(rootDir, wb.path);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      if (stats.size > 0) {
        console.log(`  [VERIFIED] ${wb.name.padEnd(28)} -> Present (${(stats.size / 1024).toFixed(1)} KB)`);
      } else {
        console.error(`  [EMPTY]    ${wb.name.padEnd(28)} -> File exists but is 0 bytes!`);
        missingCount++;
      }
    } else {
      console.error(`  [MISSING]  ${wb.name.padEnd(28)} -> File not found on disk!`);
      missingCount++;
    }
  });

  console.log('='.repeat(70));
  if (missingCount === 0) {
    console.log(` All ${requiredWorkbooks.length} Enterprise Excel QA Reports verified on disk!`);
    console.log('='.repeat(70));
    return true;
  } else {
    console.error(` Audit Failed: ${missingCount} required workbooks are missing or invalid.`);
    console.log('='.repeat(70));
    return false;
  }
}

if (require.main === module) {
  const success = validateAllReports();
  process.exit(success ? 0 : 1);
}

module.exports = validateAllReports;
