# FoodieBite — Comprehensive Repository QA Audit & Remediation Plan

**Audit Date:** November 26, 2026  
**Auditor:** Senior Software QA Automation Engineer, DevOps Architect & SDET Lead  
**Repository:** FoodieBite (`s:\files\food_app`)  
**Assessment Framework:** OWASP Top 10 API, ISO/IEC 25010 Software Quality, Web Content Accessibility Guidelines (WCAG 2.1 AA)

---

## 1. Executive Summary

An exhaustive repository-wide inspection of the FoodieBite monorepo was executed. FoodieBite is a multi-platform clinical nutrition, personalized food recommendation, and dietary safety application comprising a Node.js/Express REST backend, a React Native Web (Webpack) frontend, and an Android Capacitor/Native mobile packaging layer.

While core business logic (dietary safety exclusions, medical biomarker extraction, and BMR/TDEE calculations) demonstrates strong algorithmic foundations, several critical integration, build pipeline, and automated testing deficiencies were identified.

---

## 2. Architecture Overview

### 2.1 Backend Architecture
- **Runtime:** Node.js v22.x, Express.js REST API.
- **Data Stores:** Dual persistence architecture utilizing Supabase PostgreSQL (primary auth, user profiles, medical records) and Firebase Firestore (legacy real-time sync and campaign event streams).
- **AI & Clinical Engine:** Local Ollama service (`qwen2.5:0.5b`) integrated with in-memory grounded food database (`foodKnowledge.js`, `foodiebiteFallbackFoods.js`), BMR/TDEE math services, and OCR medical scan parsing (Tesseract.js / PDF-parse).
- **Communication Gateway:** Transactional email via Resend and Brevo (Sendinblue) with unsubscribe HMAC cryptographic tokens and rate-limiting queues.

### 2.2 Web Application Architecture
- **Framework:** React 18.2 with `react-native-web` (0.19.10) for cross-platform component parity.
- **Build System:** Custom Webpack 5 pipeline (`frontend/webpack.config.js`) bundling JSX, CSS loaders, and polyfills for crypto/stream/url.
- **Deployment Target:** GitHub Pages static site hosting (`https://<owner>.github.io/foodiebite/`) and Render web service.

### 2.3 Android Mobile Architecture
- **Runtime:** Android SDK 34 / Java 17, React Native 0.73.6, with Capacitor 5 and native bridge wrappers for camera and document pickers.
- **Package ID:** `com.foodiebite.app`
- **Native Capabilities:** Camera capture, document storage access, biometrics, hardware back-button navigation.

---

## 3. Discovered Failures & Root Cause Analysis

### Issue A: Stage 4 Static Analysis Failure in CI/CD (`FATAL: static bundle directory missing`)
- **Location:** `.github/workflows/deploy-and-test.yml` (Line 65)
- **Root Cause:** The CI workflow asserts the presence of `frontend/build/static` (a Create React App directory convention). However, FoodieBite uses a custom Webpack configuration (`frontend/webpack.config.js`) which outputs bundles directly to `frontend/build/` without a `static/` subfolder.
- **Remediation:** Configure `frontend/webpack.config.js` to emit JavaScript and asset chunks into `static/js/[name].[contenthash:8].js` and update the workflow check to verify both `index.html` and `static/js/` bundles.

### Issue B: Brevo Account Quota Live Verification Failure in CI
- **Location:** `backend/src/services/__tests__/brevoIntegration.test.js` & `security-review.yml`
- **Root Cause:** In GitHub Actions cloud runners, external API keys (`BREVO_API_KEY`) are intentionally not exposed to untrusted PR forks, causing `getBrevoAccountStatus()` to throw network/auth errors and return `{ configured: false }`.
- **Remediation:** Implement deterministic mocking for unit test runs in CI (`NODE_ENV=test`), and separate live Brevo API quota probes into dedicated live integration suites that report `ENVIRONMENTAL/BLOCKED` when external credentials are not supplied.

### Issue C: Discrepancies in 4-Test Suite Execution
- **Root Cause:** Certain test runners (`dailyPersonalizedEmail.test.js` and `adminMedicalIntelligence.test.js`) execute complex asynchronous multi-user batches or live local Ollama completions which exceed default synchronous child-process timeouts (30s) or expect specific database seeds.
- **Remediation:** Harden test isolation, provide mock-grounded fallback fixtures for high-volume stress tests, and configure appropriate timeout buffers.

---

## 4. Testing Infrastructure Gap Analysis

| Layer | Existing Status | Target State | Action Required |
| :--- | :--- | :--- | :--- |
| **Unit / Service Tests** | 22 test files in backend; 23 in frontend | Consolidated, standardized execution | Standardize in root package scripts |
| **Web Selenium E2E** | Existing scripts in `selenium-tests/` | Enterprise Page Object Model covering Categories A–N | Refactor into modular POM framework |
| **Mobile Appium E2E** | Scripts in `appium-tests/` | Full Android Screen Object Model with setup scripts | Complete Screen Objects and specs |
| **Performance Testing** | Standalone script in `scripts/runBaselineLoadTest.js` | Dedicated CLI with multi-format reports in `reports/performance/` | Add HTML, Excel, and JSON outputs |
| **Master Reporting** | Fragmented spreadsheets | Single Master QA Dashboard | Compile `FoodieBite_Master_QA_Report.xlsx` |

---

## 5. Remediation Roadmap

1. **Phase 1:** Correct `frontend/webpack.config.js` and build pipeline to guarantee `build/static` asset generation.
2. **Phase 2:** Harden `brevoService.js` and email tests with resilient offline mocking.
3. **Phase 3:** Reorganize `selenium-tests/` into enterprise POM architecture (`config/`, `framework/`, `pages/`, `tests/`).
4. **Phase 4:** Reorganize `appium-tests/` into enterprise Screen Object Model (`screens/`, `tests/`, `scripts/`).
5. **Phase 5:** Standardize load testing into `reports/performance/` with HTML, Excel, and Markdown reports.
6. **Phase 6:** Build unified Master QA Dashboard in `reports/master/`.
7. **Phase 7:** Implement dedicated GitHub Actions workflows for Selenium, Appium, Load Testing, and Quality Gate.
