# Repository Configuration Guide — GitHub Actions & Pages Setup

Follow these configuration steps to enable automated Android E2E CI/CD runs and GitHub Pages report hosting on your GitHub repository.

---

## 1. Configure GitHub Repository Secrets & Variables

Navigate to **Settings** -> **Secrets and variables** -> **Actions**:

### Repository Secrets (Optional overrides)
- `APPIUM_HOST`: Defaults to `127.0.0.1` (no secret needed).
- `APPIUM_PORT`: Defaults to `4723` (no secret needed).
- `SUPABASE_SERVICE_ROLE_KEY`: If backend API tests require elevated administrative role access in CI.

---

## 2. Configure Workflow Permissions

1. Go to **Settings** -> **Actions** -> **General**.
2. Scroll to **Workflow permissions**.
3. Select **Read and write permissions** (required for `peaceiris/actions-gh-pages` to push to the `gh-pages` branch).
4. Check the box: **Allow GitHub Actions to create and approve pull requests**.
5. Click **Save**.

---

## 3. Enable GitHub Pages

1. Navigate to **Settings** -> **Pages**.
2. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `gh-pages` and folder `/ (root)`.
3. Click **Save**.
4. Once the first CI/CD run finishes, your live reports will be active at:
   `https://<github-username>.github.io/<repository-name>/reports/latest/execution-report.html`

---

## 4. Triggering CI/CD Manually

1. Go to the **Actions** tab in your GitHub repository.
2. Select **Android Appium E2E Automation & GitHub Pages CI/CD**.
3. Click **Run workflow** -> Select branch `main` -> Click **Run workflow**.
4. The workflow will execute all 21 stages, generate all 4 Excel workbooks, 3 HTML reports, JSON logs, and output the scorecard summary directly in the Actions run!
