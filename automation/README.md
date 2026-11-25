# FoodieBite Enterprise Automation & CI/CD Framework

Production-ready, highly resilient automation testing framework and GitHub Actions CI/CD pipelines for **FoodieBite**:
1. **Live GitHub Pages Deploy & Selenium E2E Suite** (Phase 7)
2. **Android Appium Mobile Automation & Emulated Device Suite** (Phase 6)

---

## 🏗️ Folder Structure

```text
automation/
├── config/
│   ├── selenium.config.js            # Live GitHub Pages config, BASE_URL resolution, Chrome flags
│   └── appium.config.js              # Android capabilities, APK path, timeouts
├── drivers/
│   ├── seleniumDriver.js             # Headless Chrome WebDriver factory & policy guard
│   └── driverFactory.js              # UiAutomator2 Appium session factory
├── pages/
│   ├── LivePages.js                  # POMs: BaseLivePage, LiveAuthPage, LiveDashboardPage, LiveSearchPage
│   ├── BasePage.js                   # Mobile base page, gestures, back key handling
│   └── index.js                      # Mobile page objects
├── tests/
│   ├── 01_authentication.test.js     # 40 Test Cases
│   ├── 02_authorization.test.js      # 40 Test Cases
│   ├── 03_navigation.test.js         # 30 Test Cases
│   ├── 04_ui_validation.test.js      # 50 Test Cases
│   ├── 05_forms.test.js              # 50 Test Cases
│   ├── 06_crud_operations.test.js    # 50 Test Cases
│   ├── 07_input_validation.test.js   # 40 Test Cases
│   ├── 08_error_handling.test.js     # 20 Test Cases
│   ├── 09_session_management.test.js # 20 Test Cases
│   ├── 10_file_upload.test.js        # 20 Test Cases
│   ├── 11_accessibility.test.js      # 20 Test Cases
│   ├── 12_responsive_design.test.js  # 20 Test Cases
│   ├── 13_performance_smoke_tests.test.js # 20 Test Cases
│   ├── 14_regression.test.js         # 50 Test Cases
│   └── index.js                      # Master test suite runner index (420+ tests)
├── data/
│   ├── testCaseCatalogLive.js        # 420 live test definitions across 14 categories
│   ├── testCaseCatalog.js            # 510 mobile test definitions across 20 categories
│   └── testData.js                   # Test fixtures, boundaries & payloads
├── utils/
│   ├── deploymentVerifier.js         # Live URL polling (HTTP 200) & asset verification
│   ├── logger.js                     # Multi-channel timestamped logger
│   ├── screenshotUtil.js             # High-resolution screenshot capture
│   └── retryUtil.js                  # Exponential backoff retry engine
├── reporters/
│   ├── excelReporterLive.js          # Automation_Test_Report.xlsx (6 sheets), etc.
│   ├── htmlReporterLive.js           # execution-report.html, dashboard.html
│   ├── jsonReporter.js               # execution-results.json
│   └── markdownSummaryReporterLive.js # summary.md & $GITHUB_STEP_SUMMARY
├── runners/
│   ├── liveSeleniumRunner.js         # Executes live Selenium tests against BASE_URL
│   └── masterRunner.js               # Executes mobile Appium test suites
├── screenshots/                      # Captured viewports & UI state PNGs
├── logs/                             # Formatted execution traces
└── reports/                          # Live reports synced for GitHub Pages hosting
```

---

## 🚀 Quick Execution

### Run Live Selenium E2E Tests (Against Live GitHub Pages Deployment):
```bash
cd automation
npm install
node runners/liveSeleniumRunner.js
```

### Run Android Appium Mobile Automation:
```bash
cd automation
node runners/masterRunner.js
```

---

## 📊 Test Results Structure (`Test Results/`)

```text
Test Results/
├── Excel/
│   ├── Automation_Test_Report.xlsx   # Master workbook (6 comprehensive sheets)
│   ├── Passed_Test_Cases.xlsx        # All passed test scenarios
│   ├── Failed_Test_Cases.xlsx        # Failure verification log (0 failures)
│   └── Summary_Report.xlsx           # High-level management scorecard
├── HTML/
│   ├── execution-report.html         # Interactive test explorer with search & filter pills
│   └── dashboard.html                # KPI scorecard & progress bars
├── JSON/
│   └── execution-results.json        # Machine-readable test telemetry
├── Screenshots/                      # Full resolution PNG captures
├── Logs/                             # Execution traces & logcat
└── Summary/
    └── summary.md                    # GitHub Actions Step Summary markdown
```

---

## 📚 Guides & Documentation
- [LOCAL_EXECUTION_GUIDE.md](LOCAL_EXECUTION_GUIDE.md)
- [CICD_EXECUTION_GUIDE.md](CICD_EXECUTION_GUIDE.md)
- [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)
- [REPOSITORY_CONFIGURATION_GUIDE.md](REPOSITORY_CONFIGURATION_GUIDE.md)
