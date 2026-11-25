# Troubleshooting Guide — Live GitHub Pages Deploy & Selenium E2E Automation

Diagnose and resolve common issues encountered during live deployment verification, headless Chrome execution, and GitHub Actions CI/CD workflows.

---

## 1. Localhost Violation Error

### Symptom:
```
[CRITICAL SECURITY & POLICY GATE VIOLATION] Target URL (http://localhost:3000/) is a local server.
MANDATORY REQUIREMENT: Selenium must NEVER run against localhost or local dev servers.
```
### Root Cause:
The framework strictly prohibits running Selenium against local development servers.

### Resolution:
Ensure `BASE_URL` is set to the live production deployment:
```bash
# PowerShell
$env:BASE_URL = "https://<github-username>.github.io/<repository-name>/"

# Bash / Zsh
export BASE_URL="https://<github-username>.github.io/<repository-name>/"
```

---

## 2. Live Deployment Verification Timeout

### Symptom:
```
[DeploymentVerifier] Polling LIVE deployment at: https://username.github.io/project/
[DeploymentVerifier] Attempt 12: Connection pending...
```
### Root Cause:
GitHub Pages deployment takes 30-90 seconds to propagate new static assets after a commit push.

### Resolution:
1. `DeploymentVerifier.waitForDeployment()` polls for up to 120 seconds with 5-second intervals.
2. Verify that GitHub Pages is enabled on the repository under **Settings** -> **Pages** (Source: `gh-pages` branch, `/ root`).
3. Verify that `PUBLIC_URL` was correctly set during build:
   ```bash
   PUBLIC_URL="/<repository-name>/" npm run build
   ```

---

## 3. Chrome WebDriver Binary Mismatch in Headless Mode

### Symptom:
`SessionNotCreatedError: This version of ChromeDriver only supports Chrome version X`

### Resolution:
Selenium WebDriver v4 includes **Selenium Manager**, which automatically downloads and matches the exact ChromeDriver binary for your installed Chrome browser.
Ensure your dependencies are up to date:
```bash
cd automation
npm update selenium-webdriver
```

---

## 4. GitHub Actions Artifact Upload Permissions

### Symptom:
`Resource not accessible by integration` during `peaceiris/actions-gh-pages@v3` or artifact upload.

### Resolution:
Ensure the workflow file `.github/workflows/deploy-and-test.yml` includes elevated write permissions:
```yaml
permissions:
  contents: write
  pages: write
  id-token: write
```
And check **Settings** -> **Actions** -> **General** -> **Workflow permissions** -> **Read and write permissions**.
