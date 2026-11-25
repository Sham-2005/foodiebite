# Local & Live Execution Guide — Enterprise Selenium E2E Automation

This guide explains how to configure, execute, and verify the 400+ Selenium E2E test suite strictly against the **LIVE GitHub Pages Deployment**.

---

## ⚠️ MANDATORY TESTING POLICY

```
✓ Never run Selenium against localhost.
✓ Never run Selenium against local development servers.
✓ Never run Selenium against preview URLs unless explicitly configured.
✓ Selenium must always execute against the LIVE GitHub Pages deployment.
```

The runner automatically validates `BASE_URL` and throws a fatal exception if localhost or loopback addresses (`127.0.0.1`, `0.0.0.0`) are detected.

---

## 1. Prerequisites

Before executing the live Selenium test suite, ensure the following tools are available:

| Tool | Recommended Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | v18.x, v20.x, or v22.x | `node -v` |
| **npm** | v9.x or v10.x | `npm -v` |
| **Google Chrome** | Modern Version (v120+) | `google-chrome --version` / `chrome.exe -v` |
| **ChromeDriver** | Managed automatically via `selenium-webdriver` v4 Selenium Manager | Built-in |

---

## 2. Environment Configuration

The framework dynamically resolves the live target application from `BASE_URL`.

### Windows (PowerShell):
```powershell
$env:BASE_URL = "https://sham-2005.github.io/foodiebite/"
```

### Linux / macOS (Bash / Zsh):
```bash
export BASE_URL="https://sham-2005.github.io/foodiebite/"
```

*Note: Hardcoded URLs are strictly forbidden. If `BASE_URL` is omitted, it defaults to the verified production deployment `https://sham-2005.github.io/foodiebite/`.*

---

## 3. Running the Live Test Suite

Navigate to the `automation/` directory and install dependencies:
```bash
cd s:\files\food_app\automation
npm install
```

### Execute the 400+ Live Selenium Test Cases:
```bash
node runners/liveSeleniumRunner.js
# Or via npm script:
npm run test:live
```

### Execution Lifecycle:
1. **Stage 6 & 7: Deployment Verification**
   - Polls `BASE_URL` with HTTP GET requests until HTTP 200 is received.
   - Inspects DOM for production bundles, JS assets, and CSS stylesheets.
2. **Stage 8: Selenium WebDriver Execution**
   - Launches Google Chrome in `--headless=new` mode with 1920x1080 resolution.
   - Executes all 470 test scenarios across 14 modules.
   - Intercepts potential glitches with resilient fallback wrappers.
3. **Stage 9 & 10: Multi-Format Report Compilation**
   - Compiles all 4 Excel workbooks into `Test Results/Excel/`.
   - Generates interactive HTML reports in `Test Results/HTML/`.
   - Emits structured JSON telemetry into `Test Results/JSON/`.
   - Generates GitHub Step Summary markdown in `Test Results/Summary/`.
4. **Stage 13: Historical Evidence Synchronization**
   - Automatically syncs reports into `reports/latest/` and `reports/history/build-N/`.

---

## 4. Viewing Test Reports

All deliverables are generated into `Test Results/`:

- **Excel Workbooks (`Test Results/Excel/`):**
  - `Automation_Test_Report.xlsx` (6 sheets: Executed Test Cases, Passed Tests, Failed Tests, Skipped Tests, Execution Metrics, Defect Summary)
  - `Passed_Test_Cases.xlsx`
  - `Failed_Test_Cases.xlsx`
  - `Summary_Report.xlsx`
- **Interactive HTML Dashboards (`Test Results/HTML/`):**
  - `execution-report.html` (Interactive search, filter pills, step expansions)
  - `dashboard.html` (Executive KPI scorecard)
- **JSON Telemetry (`Test Results/JSON/`):**
  - `execution-results.json`
- **Summary (`Test Results/Summary/`):**
  - `summary.md`
