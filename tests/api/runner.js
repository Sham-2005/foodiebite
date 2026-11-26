/**
 * tests/api/runner.js
 * FoodieBite Enterprise API Test Suite Runner
 * Executes real live HTTP tests against backend endpoints and exports API_Test_Report.xlsx
 */
const path = require('path');
const HttpClient = require('../shared/helpers/httpClient');
const StandardExcelReporter = require('../shared/reporting/excelReporter');
const env = require('../shared/configuration/environment');

async function runApiTests() {
  console.log('='.repeat(70));
  console.log('          FOODIEBITE REST API & INTEGRATION TEST RUNNER');
  console.log('='.repeat(70));
  console.log(` Target API Base URL: ${env.api.baseUrl}`);
  console.log(` Timestamp:           ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const client = new HttpClient(env.api.baseUrl, env.api.timeout);
  const reportPath = path.resolve(__dirname, '../../reports/api/API_Test_Report.xlsx');
  const reporter = new StandardExcelReporter('REST API Integration Suite', reportPath);

  let authToken = null;
  const testEmail = `qa_test_${Date.now()}@foodiebite.dev`;
  const testPassword = 'FoodieBite#2026Test';

  // ── MODULE 1: HEALTH & OPERATIONAL PROBES ─────────────
  console.log('\n[API Suite 1] Testing Operational & Health Endpoints...');

  // TC-API-01: Health Probe
  let res = await client.get('/health');
  reporter.recordResult({
    id: 'API-HLTH-001',
    module: 'Infrastructure',
    name: 'GET /health Infrastructure Probe',
    description: 'Verify system liveness probe returns HTTP 200 and healthy JSON status.',
    preconditions: 'Backend server is running on target port',
    steps: 'Send HTTP GET to /health',
    expected: 'Status 200, success: true, status: "pass"',
    actual: `HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 60)}...`,
    status: res.status === 200 && res.data?.success ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-02: Readiness Probe
  res = await client.get('/ready');
  reporter.recordResult({
    id: 'API-RDY-002',
    module: 'Infrastructure',
    name: 'GET /ready Readiness Probe',
    description: 'Verify service readiness for AI engine and nearby discovery.',
    preconditions: 'Backend internal micro-services initialized',
    steps: 'Send HTTP GET to /ready',
    expected: 'Status 200, ready: true',
    actual: `HTTP ${res.status}: ready=${res.data?.ready}`,
    status: res.status === 200 && res.data?.ready ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-03: Local AI Engine Debug Probe
  res = await client.get('/api/debug/ai');
  reporter.recordResult({
    id: 'API-AI-003',
    module: 'AI Diagnostics',
    name: 'GET /api/debug/ai Engine Status',
    description: 'Verify FoodieBite deterministic local AI engine configuration.',
    preconditions: 'Local AI engine active',
    steps: 'Send HTTP GET to /api/debug/ai',
    expected: 'Status 200, configured: true, externalAiCalls: 0',
    actual: `HTTP ${res.status}: provider=${res.data?.provider}, configured=${res.data?.configured}`,
    status: res.status === 200 && res.data?.configured ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // ── MODULE 2: AUTHENTICATION & ACCESS CONTROL ──────────
  console.log('\n[API Suite 2] Testing Authentication & Access Control...');

  // TC-API-04: User Registration
  res = await client.post('/api/auth/register', {
    name: 'QA Test Persona',
    email: testEmail,
    password: testPassword,
    dietType: 'Vegetarian',
    preferences: { cuisines: ['mediterranean', 'indian'] }
  });
  if (res.data?.token) {
    authToken = res.data.token;
  }
  reporter.recordResult({
    id: 'API-AUTH-004',
    module: 'Authentication',
    name: 'POST /api/auth/register New User',
    description: 'Register a synthetic test user with dietary preferences.',
    preconditions: 'Unique email address provided',
    steps: 'Send HTTP POST with valid user credentials to /api/auth/register',
    expected: 'Status 200 or 201 with success: true and JWT token',
    actual: `HTTP ${res.status}: tokenPresent=${Boolean(res.data?.token)}`,
    status: (res.status === 200 || res.status === 201) && Boolean(res.data?.token) ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-05: Duplicate Registration Rejection
  res = await client.post('/api/auth/register', {
    name: 'QA Duplicate',
    email: testEmail,
    password: testPassword
  });
  reporter.recordResult({
    id: 'API-AUTH-005',
    module: 'Authentication',
    name: 'POST /api/auth/register Duplicate Email Rejection',
    description: 'Verify system rejects registration with an existing email.',
    preconditions: 'User already registered with testEmail',
    steps: 'Re-send HTTP POST with identical email to /api/auth/register',
    expected: 'Status 400 Bad Request with duplicate user error message',
    actual: `HTTP ${res.status}: message="${res.data?.message || res.data?.error}"`,
    status: res.status === 400 || res.status === 409 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-06: User Login
  res = await client.post('/api/auth/login', {
    email: testEmail,
    password: testPassword
  });
  if (res.data?.token) {
    authToken = res.data.token;
  }
  reporter.recordResult({
    id: 'API-AUTH-006',
    module: 'Authentication',
    name: 'POST /api/auth/login Valid Credentials',
    description: 'Authenticate synthetic user and receive valid JWT bearer token.',
    preconditions: 'User registered in database',
    steps: 'Send HTTP POST with email and password to /api/auth/login',
    expected: 'Status 200 OK with session token',
    actual: `HTTP ${res.status}: tokenReceived=${Boolean(authToken)}`,
    status: res.status === 200 && Boolean(authToken) ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-07: Invalid Credentials Login
  res = await client.post('/api/auth/login', {
    email: `non_existent_${Date.now()}@foodiebite.dev`,
    password: 'WrongPassword#123'
  });
  reporter.recordResult({
    id: 'API-AUTH-007',
    module: 'Authentication',
    name: 'POST /api/auth/login Invalid Credentials Rejection',
    description: 'Verify authentication fails with HTTP 401 when account does not exist.',
    preconditions: 'Non-existent account email',
    steps: 'Send HTTP POST with unknown credentials to /api/auth/login',
    expected: 'Status 401 Unauthorized',
    actual: `HTTP ${res.status}: ${res.data?.message || 'Invalid credentials'}`,
    status: res.status === 401 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-08: Authenticated User Profile
  client.setAuthToken(authToken);
  res = await client.get('/api/user/profile');
  reporter.recordResult({
    id: 'API-USR-008',
    module: 'User Profile',
    name: 'GET /api/user/profile Authenticated Fetch',
    description: 'Retrieve profile details for current authenticated session.',
    preconditions: 'Valid JWT token in Authorization header',
    steps: 'Send HTTP GET with Bearer token to /api/user/profile',
    expected: 'Status 200 OK with profile object',
    actual: `HTTP ${res.status}: success=${Boolean(res.data?.success || res.data?.user || res.data?.data)}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // ── MODULE 3: FOOD CATALOG & RECOMMENDATIONS ───────────
  console.log('\n[API Suite 3] Testing Food Catalog, Search & Recommendations...');

  // TC-API-09: Personalized Recommendations
  res = await client.get('/api/food/recommendations?userId=demo-user');
  reporter.recordResult({
    id: 'API-FOOD-009',
    module: 'Food Recommendations',
    name: 'GET /api/food/recommendations Live Workload',
    description: 'Retrieve algorithmic food recommendations tailored to preferences.',
    preconditions: 'Food database populated with nutritional catalog',
    steps: 'Send HTTP GET to /api/food/recommendations?userId=demo-user',
    expected: 'Status 200 OK returning recommended dishes',
    actual: `HTTP ${res.status}: success=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-10: Multi-Facet Food Search
  res = await client.get('/api/food/search?q=salad');
  reporter.recordResult({
    id: 'API-FOOD-010',
    module: 'Food Search',
    name: 'GET /api/food/search Query Filtering',
    description: 'Execute fuzzy text search across dish titles and ingredients.',
    preconditions: 'Search index operational',
    steps: 'Send HTTP GET with query "salad" to /api/food/search',
    expected: 'Status 200 OK returning matching food items',
    actual: `HTTP ${res.status}: matches=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-11: Empty Search Query Handling
  res = await client.get('/api/food/search?q=');
  reporter.recordResult({
    id: 'API-FOOD-011',
    module: 'Food Search',
    name: 'GET /api/food/search Empty Query Resilience',
    description: 'Verify graceful rejection or default listing when search parameter is empty.',
    preconditions: 'None',
    steps: 'Send HTTP GET with empty query string to /api/food/search',
    expected: 'Status 200 OK or 400 Bad Request with validation message',
    actual: `HTTP ${res.status}: handled=${res.status === 200 || res.status === 400}`,
    status: (res.status === 200 || res.status === 400) ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // ── MODULE 4: AI COACH & MEDICAL INTELLIGENCE ──────────
  console.log('\n[API Suite 4] Testing AI Coach & Medical Intelligence...');

  // TC-API-12: AI Coach Chat Inference
  res = await client.post('/api/coach', {
    message: 'Can I eat avocado if I have mild acid reflux?',
    userId: 'demo-user'
  });
  reporter.recordResult({
    id: 'API-AI-012',
    module: 'AI Nutrition Coach',
    name: 'POST /api/coach Clinical Inquiry',
    description: 'Submit dietary health inquiry to local AI reasoning engine.',
    preconditions: 'Local AI engine active and user authenticated',
    steps: 'Send HTTP POST with question to /api/coach',
    expected: 'Status 200 OK with clinical advisory message',
    actual: `HTTP ${res.status}: success=${Boolean(res.data?.success || res.data?.reply || res.data?.message)}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-13: Medical Health Profile
  res = await client.get('/api/medical/health-profile');
  reporter.recordResult({
    id: 'API-MED-013',
    module: 'Medical Intelligence',
    name: 'GET /api/medical/health-profile User Health Profile',
    description: 'Verify biomarker parser and health profile availability.',
    preconditions: 'Medical report service initialized and user authenticated',
    steps: 'Send HTTP GET to /api/medical/health-profile',
    expected: 'Status 200 OK with health profile',
    actual: `HTTP ${res.status}: success=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // ── MODULE 5: ADMIN PORTAL & SECURITY CONTROLS ────────
  console.log('\n[API Suite 5] Testing Admin Portal & Security Controls...');

  // TC-API-14: Admin Route Unauthorized Rejection
  client.setAdminKey(null);
  client.setAuthToken(null);
  res = await client.get('/api/admin/users');
  reporter.recordResult({
    id: 'API-ADM-014',
    module: 'Admin Security',
    name: 'GET /api/admin/users Unauthorized Rejection',
    description: 'Verify protected admin endpoints reject unauthenticated requests.',
    preconditions: 'No admin key header provided',
    steps: 'Send HTTP GET without x-admin-key to /api/admin/users',
    expected: 'Status 401 Unauthorized or 403 Forbidden',
    actual: `HTTP ${res.status}: Access Denied as expected`,
    status: (res.status === 401 || res.status === 403) ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-15: Admin Route Authorized Access
  const adminLoginRes = await client.post('/api/admin/login', {
    email: 'sham111205s@gmail.com',
    passkey: 'foodiebite_ai_live_key_2026'
  });
  const adminToken = adminLoginRes.data?.token;
  client.setAuthToken(adminToken);
  client.setAdminKey('foodiebite_ai_live_key_2026');

  res = await client.get('/api/admin/users');
  reporter.recordResult({
    id: 'API-ADM-015',
    module: 'Admin Security',
    name: 'GET /api/admin/users Authorized Fetch',
    description: 'Verify admin endpoint returns user records with valid admin key and token.',
    preconditions: 'Valid admin authentication established',
    steps: 'Send HTTP GET with admin token to /api/admin/users',
    expected: 'Status 200 OK with users array',
    actual: `HTTP ${res.status}: records=${Array.isArray(res.data?.users || res.data) ? (res.data?.users || res.data).length : 'authorized'}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-16: Admin Global Reports Audit
  res = await client.get('/api/admin/reports');
  reporter.recordResult({
    id: 'API-ADM-016',
    module: 'Admin Reports',
    name: 'GET /api/admin/reports Global Audit',
    description: 'Verify admin access to global audit reports summary.',
    preconditions: 'Admin credentials authenticated',
    steps: 'Send HTTP GET with admin key to /api/admin/reports',
    expected: 'Status 200 OK',
    actual: `HTTP ${res.status}: reportsChecked=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // ── MODULE 6: EMAIL CAMPAIGNS & SERVICE INTEGRITY ─────
  console.log('\n[API Suite 6] Testing Email Campaigns & Service Status...');

  // TC-API-17: Email System Status Check
  res = await client.get('/api/email/status');
  reporter.recordResult({
    id: 'API-EML-017',
    module: 'Email System',
    name: 'GET /api/email/status Service Check',
    description: 'Verify Brevo REST API and email scheduler status.',
    preconditions: 'Admin credentials authenticated',
    steps: 'Send HTTP GET with admin key to /api/email/status',
    expected: 'Status 200 OK with provider status',
    actual: `HTTP ${res.status}: success=${res.status === 200}`,
    status: res.status === 200 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // TC-API-18: Non-Existent Endpoint 404 Handling
  res = await client.get('/api/non-existent-route-404');
  reporter.recordResult({
    id: 'API-ERR-018',
    module: 'Error Handling',
    name: 'GET /api/non-existent-route 404 Not Found',
    description: 'Verify unmapped endpoints return standard 404 status.',
    preconditions: 'Route does not exist',
    steps: 'Send HTTP GET to /api/non-existent-route-404',
    expected: 'Status 404 Not Found',
    actual: `HTTP ${res.status}: Handled properly`,
    status: res.status === 404 ? 'PASS' : 'FAIL',
    duration: res.durationMs
  });

  // Compile and write Excel workbook
  console.log('\n[API Test Runner] Compiling Excel and Multi-Format Reports...');
  await reporter.generateWorkbook();

  const stats = reporter.getStats();
  console.log('='.repeat(70));
  console.log(` REST API Test Execution Finished: ${stats.passed}/${stats.total} Passed (${stats.passPercentage}%)`);
  console.log('='.repeat(70));
  return stats;
}

if (require.main === module) {
  runApiTests().catch(err => {
    console.error('Fatal API Test Error:', err);
    process.exit(1);
  });
}

module.exports = runApiTests;
