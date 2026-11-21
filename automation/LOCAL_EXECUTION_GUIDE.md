# Local & Live Execution Guide — Selenium E2E Automation

This guide explains how to execute the 400+ Selenium E2E test suite strictly against the **LIVE GitHub Pages Deployment**.

---

## ⚠️ MANDATORY TESTING POLICY

```
✓ Never run Selenium against localhost.
✓ Never run Selenium against local development servers.
✓ Never run Selenium against preview URLs unless explicitly configured.
✓ Selenium must always execute against the LIVE GitHub Pages deployment.
```

The runner automatically validates `BASE_URL` and throws a fatal exception if localhost or loopback addresses (`127.0.0.1`) are detected.

---

## 1. Prerequisites
- **Node.js**: v18.x, v20.x, or v22.x
- **Google Chrome**: Modern version (v120+) installed on the host.
- Selenium WebDriver v4 automatically manages the ChromeDriver binary via Selenium Manager.

---

## 2. Configuration & Live Deployment Target

The framework reads the deployment URL from `BASE_URL`:

### Windows PowerShell:
```powershell
$env:BASE_URL = "https://sham-2005.github.io/foodiebite/"
```

### Linux / macOS:
```bash
export BASE_URL="https://sham-2005.github.io/foodiebite/"
```

---

## 3. Running the Live Test Suite

Navigate to the `automation/` directory:

```bash
cd s:\files\food_app\automation

# Execute the 420+ live Selenium tests against GitHub Pages:
node runners/liveSeleniumRunner.js
```

---

## 4. Execution Output & Quality Gate

The runner executes:
1. **Stage 6 & 7**: Deployment health verification (polls `BASE_URL`, validates HTTP 200, checks JS/CSS asset integrity).
2. **Stage 8**: Headless Chrome Selenium automation interacting with live routes.
3. **Stage 9 & 10**: Compiles all 4 Excel workbooks, 2 HTML reports, JSON telemetry, and Markdown summaries into `Test Results/`.
4. **Quality Gate**: Evaluates pass percentage ($\ge 95.0\%$ required to pass).
