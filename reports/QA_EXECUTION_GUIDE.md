# FoodieBite — Enterprise QA & E2E Testing Execution Guide

**Document Version:** 1.0.0  
**Target Platform:** FoodieBite Web Application & Android Mobile Application  
**Author:** Quality Assurance & DevOps Engineering Team  

---

## 1. Quick Start Commands

```bash
# Run Core CI 4-Test Suite & generate individual + consolidated reports
npm run test:all-4

# Run Web Selenium E2E Automation
npm run test:selenium

# Run Android Appium Mobile E2E Automation
npm run test:appium

# Run 100 Virtual Users / 60-second Baseline Load Test
npm run test:load

# Compile All Consolidated Enterprise QA Reports (Excel, HTML, JSON, Markdown)
npm run report:qa
```

---

## 2. Environment Setup & Prerequisites

### 2.1 Web Selenium Environment
- **Node.js:** v18.x or v22.x LTS
- **Google Chrome:** Installed (v120+)
- **ChromeDriver:** Managed automatically via `selenium-webdriver`

```bash
cd selenium-tests
npm install
```

### 2.2 Android Appium Environment
- **Java JDK:** OpenJDK 17 (`JAVA_HOME` configured)
- **Android SDK:** API Level 33 / 34 (`ANDROID_HOME` configured)
- **Appium 2.x:** Installed globally (`npm install -g appium`)
- **Appium Driver:** UiAutomator2 (`appium driver install uiautomator2`)

#### Verification Scripts:
- **Windows (PowerShell):** `powershell -ExecutionPolicy Bypass -File appium-tests/scripts/setupAndroidEnvironment.ps1`
- **Linux / macOS (Bash):** `bash appium-tests/scripts/setupAndroidEnvironment.sh`

---

## 3. Test Suites Overview & Execution

### 3.1 Selenium Web E2E Testing
Located in [`selenium-tests/`](file:///s:/files/food_app/selenium-tests):
- **Framework Architecture:** Page Object Model (POM) with explicit waits, retry manager, and automated failure screenshots.
- **Run Headless:**
  ```bash
  cd selenium-tests && node runner.js --headless
  ```
- **Run Headed (Visual Window):**
  ```bash
  cd selenium-tests && node runner.js --headed
  ```
- **Test Scenarios Covered (502 Total):**
  - Category A: Startup & Layout Integrity
  - Category B: Authentication & Session Persistence
  - Category C: Registration & Input Validation
  - Category D: Home Feed & Contextual Cards
  - Category E: Food Search & Filter Chips
  - Category F: AI Recommendations
  - Category G: Food Details & Macro Breakdown
  - Category H: Favorites CRUD
  - Category I: User Profile & Dietary Safety
  - Category J: Medical Scans & OCR Processing
  - Category K: Protected Admin Dashboard
  - Category L: Transactional Email Campaigns
  - Category M: Deep Route Navigation
  - Category N: Security & WCAG Accessibility

### 3.2 Appium Android Mobile E2E Testing
Located in [`appium-tests/`](file:///s:/files/food_app/appium-tests):
- **Framework Architecture:** Screen Object Model (SOM) with touch gesture helpers, hardware back button testing (`KEYCODE_BACK = 4`), and lifecycle management.
- **Execution:**
  ```bash
  cd appium-tests && node runner.js
  ```
- **Mock/Telemetry Runner:**
  ```bash
  cd appium-tests && node scripts/runMockAppiumRunner.js
  ```
- **Test Scenarios Covered (479 Total):**
  - Native Splash & Onboarding
  - Biometric Authentication Fallback
  - Food Search & Nutri-Score Badges
  - Local Ollama AI Nutritionist Chat
  - Medical Scan Uploads & In-Memory OCR
  - Android AppState Lifecycle (Background/Foreground)
  - TalkBack WCAG 2.1 AA Accessibility

### 3.3 Baseline Load Testing (100 Users / 60 Seconds)
Located in [`scripts/runBaselineLoadTest.js`](file:///s:/files/food_app/scripts/runBaselineLoadTest.js):
- **Execution:**
  ```bash
  node scripts/runBaselineLoadTest.js --concurrency=100 --duration=60 --multi
  ```
- **Quick Smoke Run:**
  ```bash
  node scripts/runBaselineLoadTest.js --concurrency=100 --duration=10 --multi
  ```
- **Endpoints Exercised:**
  1. `/health` (Infrastructure availability)
  2. `/ready` (Readiness and database connection probe)
  3. `/api/debug/ai` (Local Ollama inference engine probe)
  4. `/api/food/recommendations` (Core recommendation algorithm workload)

---

## 4. Test Reports & Artifacts Directory

| Testing Domain | Excel Report | HTML Dashboard | JSON Metrics | Markdown Summary |
| :--- | :--- | :--- | :--- | :--- |
| **Selenium Web E2E** | `selenium-tests/reports/Selenium_Test_Results.xlsx` | `selenium-tests/reports/Selenium_Test_Results.html` | `selenium-tests/reports/Selenium_Test_Results.json` | `selenium-tests/reports/Selenium_Test_Summary.md` |
| **Appium Android E2E** | `appium-tests/reports/Appium_Android_Test_Results.xlsx` | `appium-tests/reports/Appium_Android_Test_Results.html` | `appium-tests/reports/Appium_Android_Test_Results.json` | `appium-tests/reports/Appium_Android_Test_Summary.md` |
| **Baseline Load Test** | `reports/performance/Baseline_Load_Test.xlsx` | `reports/performance/Baseline_Load_Test.html` | `reports/performance/Baseline_Load_Test.json` | `reports/performance/Baseline_Load_Test.md` |
| **Master Consolidated** | `reports/master/FoodieBite_Master_QA_Report.xlsx` | `reports/master/FoodieBite_Master_QA_Report.html` | `reports/master/FoodieBite_Master_QA_Report.json` | `reports/master/FoodieBite_Master_QA_Report.md` |
| **Core 4-Test Suite** | `reports/FoodieBite_All_4_Tests_Summary_Report.xlsx` | N/A | `reports/baseline-load-test-results.json` | `reports/baseline-load-test-report.md` |

---

## 5. GitHub Actions Workflows

All workflows are located in [`.github/workflows/`](file:///s:/files/food_app/.github/workflows) and validated against strict schema linters:
1. `selenium-web-e2e.yml`: Automated headless Chrome build, server boot, live E2E execution, and 30-day artifact retention.
2. `appium-android-e2e.yml`: macOS runner with hardware virtualization, APK validation, and mobile test execution.
3. `performance-load-test.yml`: Parameterized on-demand (`workflow_dispatch`) and weekly cron (`0 4 * * 0`) load tests with Step Summaries.
4. `quality-gate.yml`: Master CI pipeline combining core tests, load benchmarks, and report compilation.
5. `security-review.yml`: DevSecOps pipeline with Semgrep v1, Trivy vulnerability scanning, and license compliance.
6. `tests.yml`: 4-Test Suite runner exporting individual and consolidated Excel workbooks.
