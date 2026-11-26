/**
 * scripts/testing/runAllTests.js
 * Master Test Suite Orchestrator for FoodieBite Enterprise QA Infrastructure
 * Runs all suites across API, Integration, Security, Selenium, Appium, Load, and compiles Master Report.
 */
const path = require('path');
const validateWorkflows = require('./validateWorkflows');
const runApiTests = require('../../tests/api/runner');
const runIntegrationTests = require('../../tests/integration/runner');
const runSecurityTests = require('../../tests/security/runner');
const runSeleniumTests = require('../../tests/selenium/runner');
const runAppiumTests = require('../../tests/appium/runner');
const runPerformanceTests = require('../../tests/performance/runner');
const generateMasterReport = require('./generateMasterReport');
const validateAllReports = require('./validateTestResults');

async function main() {
  console.log('#'.repeat(74));
  console.log('   FOODIEBITE COMPLETE ENTERPRISE QA AUTOMATION MASTER ORCHESTRATION');
  console.log('#'.repeat(74));
  console.log(` Starting comprehensive test execution across all layers...`);
  console.log(` Timestamp: ${new Date().toISOString()}\n`);

  const startTime = Date.now();

  try {
    // 1. Workflows Validation
    console.log('\n>>> PHASE 1: GitHub Actions CI/CD Workflows Audit & Validation <<<');
    validateWorkflows();

    // 2. REST API Integration Tests
    console.log('\n>>> PHASE 2: Live Backend REST API Tests <<<');
    await runApiTests();

    // 3. Multi-Step User Journey Integration Tests
    console.log('\n>>> PHASE 3: Cross-Service E2E Integration User Journeys <<<');
    await runIntegrationTests();

    // 4. DevSecOps & Security Vulnerability Tests
    console.log('\n>>> PHASE 4: Security & DevSecOps Audit Scans <<<');
    await runSecurityTests();

    // 5. Selenium Web Application E2E Tests
    console.log('\n>>> PHASE 5: Web Application Selenium E2E Tests (POM) <<<');
    await runSeleniumTests();

    // 6. Appium Android Mobile E2E Tests
    console.log('\n>>> PHASE 6: Android Mobile Appium E2E Tests (SOM) <<<');
    await runAppiumTests();

    // 7. Baseline Load Testing
    console.log('\n>>> PHASE 7: Baseline Performance & Load Testing (100 VUs) <<<');
    await runPerformanceTests();

    // 8. Consolidated Master Report Generation
    console.log('\n>>> PHASE 8: Consolidated Master QA Report Compilation <<<');
    await generateMasterReport();

    // 9. Independent Artifact Verification
    console.log('\n>>> PHASE 9: Independent QA Verification & Disk Artifact Audit <<<');
    validateAllReports();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '#'.repeat(74));
    console.log(`   ✨ ALL TESTING PHASES COMPLETED SUCCESSFULLY IN ${elapsed}s! ✨`);
    console.log('#'.repeat(74));
  } catch (err) {
    console.error('\n[FATAL ERROR IN TEST ORCHESTRATION]:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
