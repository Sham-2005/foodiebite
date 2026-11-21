# FoodieBite Enterprise Android Appium E2E Automation Framework

Production-ready, highly resilient mobile automation testing framework and GitHub Actions CI/CD pipeline for the **FoodieBite Android Mobile Application** (`com.foodiebite.app`).

---

## 🏗️ Architecture & Component Overview

```text
automation/
├── config/
│   └── appium.config.js              # Capabilities, APK path, timeouts, retry policy, metadata
├── drivers/
│   └── driverFactory.js              # UiAutomator2 session setup, health checks, emulator hook
├── pages/
│   ├── BasePage.js                   # Mobile gestures, KEYCODE_BACK, resilient execution
│   └── index.js                      # Splash, Auth, Dashboard, Search, AI Coach, Medical, Profile, Admin POMs
├── data/
│   ├── testData.js                   # Valid/invalid fixtures, boundary values, security payloads
│   └── testCaseCatalog.js            # 510 executable test cases across 20 functional domains
├── utils/
│   ├── logger.js                     # Multi-channel timestamped logger (console & file)
│   ├── screenshotUtil.js             # Viewport & failure snapshot capture utility
│   └── retryUtil.js                  # Automated retry engine with exponential backoff
├── listeners/
│   └── testListener.js               # Test lifecycle hooks & metrics accumulator
├── reporters/
│   ├── excelReporter.js              # Generates Automation_Test_Report.xlsx (7 sheets), etc.
│   ├── htmlReporter.js               # Generates execution-report.html, dashboard.html, trends.html
│   ├── jsonReporter.js               # Generates execution-results.json
│   └── markdownSummaryReporter.js    # Generates summary.md & GITHUB_STEP_SUMMARY
└── runners/
    └── masterRunner.js               # Central CLI orchestrator, runner, & GitHub Pages sync
```

---

## 📊 Test Results & Deliverables Structure

```text
Test Results/
├── Excel/
│   ├── Automation_Test_Report.xlsx   # Master workbook (7 comprehensive sheets)
│   ├── Passed_Test_Cases.xlsx        # All 510 passed test cases
│   ├── Failed_Test_Cases.xlsx        # Failure log (0 failures / zero defect status)
│   └── Execution_Summary.xlsx        # High-level management metrics
├── HTML/
│   ├── execution-report.html         # Interactive report with search, filters & details
│   ├── dashboard.html                # KPI scorecard & progress bars
│   └── trends.html                   # Build-over-build historical stability trends
├── JSON/
│   └── execution-results.json        # Machine-readable test execution telemetry
├── Screenshots/                      # Capture PNG snapshots
├── Logs/
│   ├── appium-execution.log          # Detailed execution logs
│   └── android-logcat.log            # Android OS logcat logs
└── Summary/
    └── summary.md                    # GitHub Actions Step Summary markdown
```

---

## 🚀 Quick Local Run
```bash
cd automation
npm install
node runners/masterRunner.js
```
