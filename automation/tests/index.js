/**
 * Master Index of All 14 Live Selenium E2E Test Suites (420 Total Test Cases)
 */
const suites = [
  require('./01_authentication.test'),
  require('./02_authorization.test'),
  require('./03_navigation.test'),
  require('./04_ui_validation.test'),
  require('./05_forms.test'),
  require('./06_crud_operations.test'),
  require('./07_input_validation.test'),
  require('./08_error_handling.test'),
  require('./09_session_management.test'),
  require('./10_file_upload.test'),
  require('./11_accessibility.test'),
  require('./12_responsive_design.test'),
  require('./13_performance_smoke_tests.test'),
  require('./14_regression.test')
];

async function runAllSuites(driver) {
  let allResults = [];
  for (const suite of suites) {
    const res = await suite.runSuite(driver);
    allResults = allResults.concat(res);
  }
  return allResults;
}

module.exports = {
  suites,
  runAllSuites,
  totalCases: suites.reduce((acc, s) => acc + s.count, 0)
};
