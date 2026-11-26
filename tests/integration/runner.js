/**
 * tests/integration/runner.js
 * FoodieBite Enterprise Cross-Service Integration Test Runner
 * Executes complete multi-step user journeys against live backend services
 * Generates reports/integration/Integration_Test_Report.xlsx
 */
const path = require('path');
const HttpClient = require('../shared/helpers/httpClient');
const StandardExcelReporter = require('../shared/reporting/excelReporter');
const env = require('../shared/configuration/environment');

async function runIntegrationTests() {
  console.log('='.repeat(70));
  console.log('       FOODIEBITE MULTI-STEP E2E INTEGRATION TEST RUNNER');
  console.log('='.repeat(70));
  console.log(` Target API Base URL: ${env.api.baseUrl}`);
  console.log(` Timestamp:           ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const client = new HttpClient(env.api.baseUrl, env.api.timeout);
  const reportPath = path.resolve(__dirname, '../../reports/integration/Integration_Test_Report.xlsx');
  const reporter = new StandardExcelReporter('Cross-Service E2E Integration Suite', reportPath);

  const testEmail = `journey_user_${Date.now()}@foodiebite.dev`;
  const testPassword = 'FoodieBite#2026Integration';
  let token = null;

  // ── USER JOURNEY 1: ONBOARDING, PREFERENCES, FOOD & SEARCH ───────────────
  console.log('\n[Integration Journey 1] Full Consumer Flow: Onboarding -> Discovery -> Search...');

  // Step 1: Registration
  let res = await client.post('/api/auth/register', {
    name: 'Integration Persona',
    email: testEmail,
    password: testPassword,
    dietType: 'Vegetarian',
    preferences: { cuisines: ['mediterranean', 'indian'] }
  });
  token = res.data?.token;
  reporter.recordResult({
    id: 'INT-J1-001',
    module: 'User Journey 1',
    name: 'Step 1: User Registration',
    description: 'Register new consumer account with initial health preferences.',
    preconditions: 'Unique email address provided',
    steps: 'POST /api/auth/register with user profile',
    expected: 'Status 200/201 with session token',
    actual: `HTTP ${res.status}: tokenAcquired=${Boolean(token)}`,
    status: (res.status === 200 || res.status === 201) && Boolean(token) ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Step 2: Login Authentication
  res = await client.post('/api/auth/login', { email: testEmail, password: testPassword });
  if (res.data?.token) token = res.data.token;
  client.setAuthToken(token);
  reporter.recordResult({
    id: 'INT-J1-002',
    module: 'User Journey 1',
    name: 'Step 2: Authenticate & Establish Session',
    description: 'Verify login and establish JWT authorization bearer token.',
    preconditions: 'User registered in Step 1',
    steps: 'POST /api/auth/login with valid credentials',
    expected: 'Status 200 with JWT bearer token',
    actual: `HTTP ${res.status}: tokenAcquired=${Boolean(token)}`,
    status: res.status === 200 && Boolean(token) ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Step 3: Fetch User Profile
  res = await client.get('/api/user/profile');
  reporter.recordResult({
    id: 'INT-J1-003',
    module: 'User Journey 1',
    name: 'Step 3: Retrieve User Dietary Profile',
    description: 'Fetch personalized health restrictions and preferences.',
    preconditions: 'Authenticated session with signed JWT',
    steps: 'GET /api/user/profile with Bearer token',
    expected: 'Status 200 with profile object',
    actual: `HTTP ${res.status}: profileRetrieved=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Step 4: Fetch Personalized Food Recommendations
  res = await client.get('/api/food/recommendations?userId=demo-user');
  reporter.recordResult({
    id: 'INT-J1-004',
    module: 'User Journey 1',
    name: 'Step 4: Retrieve Personalized Recommendations',
    description: 'Fetch real-time food recommendations aligned with user goals.',
    preconditions: 'User profile configured',
    steps: 'GET /api/food/recommendations?userId=demo-user',
    expected: 'Status 200 with array of matching meals',
    actual: `HTTP ${res.status}: receivedRecommendations=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Step 5: Search Food Catalog with Custom Filter
  res = await client.get('/api/food/search?q=quinoa');
  reporter.recordResult({
    id: 'INT-J1-005',
    module: 'User Journey 1',
    name: 'Step 5: Query Specific Nutrient Catalog Dish',
    description: 'Search catalog for specific high-protein dish ("quinoa").',
    preconditions: 'Food catalog loaded',
    steps: 'GET /api/food/search?q=quinoa',
    expected: 'Status 200 with matching items',
    actual: `HTTP ${res.status}: matches=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Step 6: Query Single Food Item by ID
  res = await client.get('/api/food/sample-food-1');
  reporter.recordResult({
    id: 'INT-J1-006',
    module: 'User Journey 1',
    name: 'Step 6: Retrieve Nutritional Detail for Single Dish',
    description: 'Fetch macronutrient breakdown and allergen warnings for dish.',
    preconditions: 'Authenticated session and dish identified',
    steps: 'GET /api/food/sample-food-1',
    expected: 'Status 200 returning dish details',
    actual: `HTTP ${res.status}: itemFound=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // ── USER JOURNEY 2: CLINICAL BIOMARKERS & AI REASONING ───────────────
  console.log('\n[Integration Journey 2] Clinical Workflow: Health Profile -> AI Coach...');

  // Step 7: Retrieve Clinical Health Profile
  res = await client.get('/api/medical/health-profile');
  reporter.recordResult({
    id: 'INT-J2-007',
    module: 'User Journey 2',
    name: 'Step 7: Check Clinical Health Profile',
    description: 'Access user medical profile and historical biomarker flags.',
    preconditions: 'Medical report service active',
    steps: 'GET /api/medical/health-profile',
    expected: 'Status 200 with health profile',
    actual: `HTTP ${res.status}: profileIngested=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Step 8: Consult AI Coach for Clinical Diet Adjustments
  res = await client.post('/api/coach', {
    message: 'What foods should I avoid with an LDL of 165 and borderline glucose?',
    userId: 'demo-user'
  });
  reporter.recordResult({
    id: 'INT-J2-008',
    module: 'User Journey 2',
    name: 'Step 8: AI Coach Clinical Dietary Consultation',
    description: 'Query AI engine for safe substitutions and contraindications.',
    preconditions: 'Clinical data available in session context',
    steps: 'POST /api/coach with health inquiry',
    expected: 'Status 200 with structured dietary guidance',
    actual: `HTTP ${res.status}: advisoryReceived=${Boolean(res.data?.success || res.data?.reply || res.data?.message)}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // ── USER JOURNEY 3: ADMIN OVERSIGHT & CLINICAL AUDITING ───────────────────
  console.log('\n[Integration Journey 3] Administrative Flow: System Telemetry -> User & Medical Audit...');

  // Step 9: Authenticated Admin Overview Metrics Audit
  const adminLoginRes = await client.post('/api/admin/login', {
    email: 'sham111205s@gmail.com',
    passkey: 'foodiebite_ai_live_key_2026'
  });
  const adminToken = adminLoginRes.data?.token;
  client.setAuthToken(adminToken);
  client.setAdminKey('foodiebite_ai_live_key_2026');

  res = await client.get('/api/admin/metrics/overview');
  reporter.recordResult({
    id: 'INT-J3-009',
    module: 'User Journey 3',
    name: 'Step 9: Admin System Metrics & Uptime Audit',
    description: 'Retrieve real-time infrastructure metrics (overview metrics).',
    preconditions: 'Admin authentication established',
    steps: 'GET /api/admin/metrics/overview with admin token',
    expected: 'Status 200 with system telemetry payload',
    actual: `HTTP ${res.status}: metricsAvailable=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Step 10: Admin Reports Audit
  res = await client.get('/api/admin/reports');
  reporter.recordResult({
    id: 'INT-J3-010',
    module: 'User Journey 3',
    name: 'Step 10: Global Administrative Reports Review',
    description: 'Review cross-user report distributions.',
    preconditions: 'Admin access active',
    steps: 'GET /api/admin/reports with admin key',
    expected: 'Status 200 with report summary array',
    actual: `HTTP ${res.status}: reportsAudited=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // ── USER JOURNEY 4: RESILIENCE, SECURITY & EXCEPTION HANDLING ────────────
  console.log('\n[Integration Journey 4] Resilience & Security: Malformed Requests -> Unauthorized Routing...');

  // Step 11: Invalid Malformed JSON Body Handling
  client.setAdminKey(null);
  res = await client.post('/api/auth/login', 'MALFORMED_NON_JSON_RAW_DATA', { 'Content-Type': 'application/json' });
  reporter.recordResult({
    id: 'INT-J4-011',
    module: 'User Journey 4',
    name: 'Step 11: Malformed Body Syntax Handling',
    description: 'Verify system gracefully returns 400 Bad Request on invalid JSON.',
    preconditions: 'None',
    steps: 'Send invalid non-JSON payload with application/json header',
    expected: 'Status 400 Bad Request',
    actual: `HTTP ${res.status}: Handled properly`,
    status: res.status === 400 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Step 12: Unauthorized Protected Route Rejection
  client.setAuthToken('INVALID_EXPIRED_JWT_TOKEN_ABC123');
  res = await client.get('/api/user/profile');
  reporter.recordResult({
    id: 'INT-J4-012',
    module: 'User Journey 4',
    name: 'Step 12: Invalid JWT Rejection & Protected Route Isolation',
    description: 'Verify forged or expired tokens are rejected with HTTP 401/403.',
    preconditions: 'Malformed token injected in Authorization header',
    steps: 'GET /api/user/profile with forged bearer token',
    expected: 'Status 401 Unauthorized or 403 Forbidden',
    actual: `HTTP ${res.status}: Access Denied as expected`,
    status: (res.status === 401 || res.status === 403) ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Compile and export Excel report
  console.log('\n[Integration Test Runner] Compiling Excel and Multi-Format Reports...');
  await reporter.generateWorkbook();

  const stats = reporter.getStats();
  console.log('='.repeat(70));
  console.log(` Integration Test Execution Finished: ${stats.passed}/${stats.total} Passed (${stats.passPercentage}%)`);
  console.log('='.repeat(70));
  return stats;
}

if (require.main === module) {
  runIntegrationTests().catch(err => {
    console.error('Fatal Integration Test Error:', err);
    process.exit(1);
  });
}

module.exports = runIntegrationTests;
