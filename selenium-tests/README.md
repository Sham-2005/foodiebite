# FoodieBite Web Application — Selenium WebDriver E2E Test Suite

Professional, production-ready End-to-End (E2E) automated testing suite built with **Selenium WebDriver (Node.js)** for the **FoodieBite Web Application**.

Includes comprehensive Page Object Models (POM), multi-scenario test suites covering all 8 core application modules, automated screenshot capture on failures, and styled multi-sheet **Excel Analysis Reports** (`.xlsx`).

---

## 📁 Project Structure

```text
selenium-tests/
├── config/
│   └── selenium.config.js          # Base URL, viewport sizes, timeouts, user fixtures
├── drivers/
│   └── driverFactory.js            # Chrome WebDriver setup with headless/headed options
├── pages/                          # Page Object Model (POM) layer
│   ├── BasePage.js                 # Reusable WebDriver wrappers & helpers
│   ├── SplashOnboardingPage.js     # Splash & Onboarding slides POM
│   ├── AuthPage.js                 # Sign In, Sign Up, & Validation POM
│   ├── DashboardPage.js            # Home Feed, Weather, & Category Tabs POM
│   ├── FoodSearchPage.js           # Search input, Filter chips, & Product grid POM
│   ├── NutritionCoachPage.js       # AI Nutritionist chat interface POM
│   ├── MedicalReportsPage.js       # Supabase medical reports & OCR upload POM
│   ├── ProfilePage.js              # User Profile, Preferences, & Sign Out POM
│   └── AdminDashboardPage.js       # Protected Admin Portal & Audit logs POM
├── tests/                          # End-to-End Test Suites (32 Scenarios)
│   ├── 01_auth_onboarding.test.js  # Authentication & onboarding flow
│   ├── 02_dashboard_feed.test.js   # Recommendations, weather, & bottom navigation
│   ├── 03_food_catalog_search.test.js # OpenFoodFacts search & dietary filters
│   ├── 04_ai_nutrition_coach.test.js  # Interactive AI nutrition coaching dialog
│   ├── 05_medical_reports.test.js  # Medical reports storage view & OCR trigger
│   ├── 06_profile_preferences.test.js # Dietary preferences & email schedule
│   ├── 07_admin_portal.test.js     # Protected admin route, user table & logs
│   └── 08_responsive_crosscheck.test.js # Mobile (375x812) & Desktop (1440x900)
├── reporters/
│   └── excelReporter.js            # Styled 5-sheet Excel analysis report builder
├── reports/                        # Output directory for generated reports & screenshots
│   ├── FoodieBite_Selenium_E2E_Analysis_Report.xlsx
│   └── screenshots/
├── runner.js                       # Master CLI test runner
├── package.json                    # Node.js dependencies & scripts
└── README.md                       # This user documentation
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.x, v20.x, or v22.x
- **Google Chrome**: Modern version (v120+) installed on the host machine.
- Selenium WebDriver v4+ automatically manages the required ChromeDriver binary via built-in Selenium Manager.

### 2. Install Dependencies
```bash
cd selenium-tests
npm install
```

### 3. Run All End-to-End Tests
```bash
# Run full suite in headless Chrome:
npm test

# Run full suite in visible Chrome browser window (headed):
npm run test:headed

# Generate or refresh Excel Analysis Report only:
npm run report
```

---

## 📊 Excel Analysis Report Breakdown

Each test execution automatically generates a styled Excel analysis workbook at:
- `selenium-tests/reports/FoodieBite_Selenium_E2E_Analysis_Report.xlsx`
- (Also synchronized to `Vulnerability Test Results/FoodieBite_Selenium_E2E_Analysis_Report.xlsx`)

### Workbook Sheets:
1. **Sheet 1 — Executive Dashboard**: Summary KPI scorecard with Pass/Fail counts, success rate %, total execution time, environment configuration, and overall QA verdict.
2. **Sheet 2 — E2E Test Execution**: Detailed row-by-row log of all 32 test scenarios with Test ID, Module, Action Steps, Expected Result, Actual Result, Status (`PASS` / `FAIL`), and Execution Duration in milliseconds.
3. **Sheet 3 — Feature Coverage Matrix**: All 8 application modules mapped against functional requirements, test scenario counts, critical path indicators, and QA sign-off status.
4. **Sheet 4 — Performance & Latency**: Screen-by-screen render times and action latencies evaluated against industry standard SLAs.
5. **Sheet 5 — Defect & Failure Log**: Structured issue logging with severity levels, reproduction steps, root causes, and remediation guidance.

---

## 🧪 Modules & Test Coverage Summary

| Module | Test Suite File | Scenarios | Target Verification |
| :--- | :--- | :---: | :--- |
| **Authentication** | `01_auth_onboarding.test.js` | 5 | Splash timing, onboarding skip, sign in, sign up, invalid credential errors |
| **Home Dashboard** | `02_dashboard_feed.test.js` | 4 | Food recommendations, weather widget, dietary category tabs, bottom nav |
| **Food Search** | `03_food_catalog_search.test.js` | 4 | OpenFoodFacts queries, quick search chips, high-protein filter, text debounce |
| **AI Nutrition Coach** | `04_ai_nutrition_coach.test.js` | 4 | Chat interface, quick diet prompts, optimistic UI bubble, thread persistence |
| **Medical Reports** | `05_medical_reports.test.js` | 4 | Supabase storage status badge, OCR scan trigger, saved reports count |
| **Profile & Settings** | `06_profile_preferences.test.js` | 4 | Account details, dietary preferences link, email notification schedule, sign out |
| **Admin Portal** | `07_admin_portal.test.js` | 4 | RBAC route guard, admin KPI cards, user management table, email delivery logs |
| **Responsive Viewports** | `08_responsive_crosscheck.test.js` | 3 | Mobile viewport (375x812), Tablet (768x1024), Desktop container centering |
| **Total Test Suite** | **8 Test Suites** | **32** | **100% Critical Flow Coverage** |
