# CI/CD Execution Guide — GitHub Actions & GitHub Pages

This guide outlines how the automated CI/CD pipeline executes across 21 stages on every push, pull request, nightly schedule, and manual dispatch.

---

## 🔄 21-Stage Pipeline Execution Order

```mermaid
flowchart TD
    S1["1. Checkout Repo"] --> S2["2. Setup Java 17"]
    S2 --> S3["3. Setup Android SDK"]
    S3 --> S4["4. Install Dependencies"]
    S4 --> S5["5. Build Android APK"]
    S5 --> S6["6. Start Android Emulator (API 34)"]
    S6 --> S7["7. Verify Emulator Readiness"]
    S7 --> S8["8. Install APK via ADB"]
    S8 --> S9["9. Start Appium Server"]
    S9 --> S10["10. Verify Appium Health Check"]
    S10 --> S11["11. Execute 510 E2E Tests"]
    S11 --> S12["12. Capture Screenshots"]
    S12 --> S13["13. Capture Logcat & Appium Logs"]
    S13 --> S14["14. Generate 4 Excel Reports"]
    S14 --> S15["15. Generate 3 HTML Reports"]
    S15 --> S16["16. Generate JSON Telemetry"]
    S16 --> S17["17. Generate Markdown Summary"]
    S17 --> S18["18. Upload Artifacts (30d retention)"]
    S18 --> S19["19. Publish to GitHub Pages"]
    S19 --> S20["20. Update Historical Archive"]
    S20 --> S21["21. Output $GITHUB_STEP_SUMMARY"]
```

---

## ⚙️ Workflow File: `.github/workflows/android-e2e.yml`

### Triggers
1. **Push** to `main` or `master`
2. **Pull Request** to `main` or `master`
3. **Workflow Dispatch**: Run manually from GitHub Actions UI
4. **Nightly Cron**: Every night at 02:00 UTC (`cron: '0 2 * * *'`)

### Runner Environment
The pipeline runs on **`macos-13`** runners because macOS GitHub Actions runners natively support **nested hardware virtualization (HAXM/Hypervisor.framework)**, allowing Android emulators to boot in under 60 seconds with GPU acceleration!

---

## 🌐 GitHub Pages Deployment & Historical Archiving

When the pipeline succeeds on `main`:
1. Artifacts from `reports/` are pushed to the `gh-pages` branch via `peaceiris/actions-gh-pages@v3`.
2. The latest report is hosted at:
   `https://<github-username>.github.io/<repository-name>/reports/latest/execution-report.html`
3. Historical runs are archived under:
   `https://<github-username>.github.io/<repository-name>/reports/history/build-N/`
4. The root URL redirects visitors automatically to the latest execution report.

---

## 🛡️ Failure & Quality Gate Criteria
- **Pass Gate:** Pass percentage $\ge 95.0\%$.
- **Fail Gate:** If infrastructure fails (Emulator, APK install, Appium crash) or pass percentage $< 95.0\%$, the workflow fails.
