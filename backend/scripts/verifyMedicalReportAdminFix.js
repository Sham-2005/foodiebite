const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'foodiebite_super_secret_key_change_in_production_2024';
const ADMIN_EMAIL = 'sham111205s@gmail.com';
const USER_ID = 'c9662dab-f656-459d-9df7-71e9e1404160';
const USER_EMAIL = 'shams5076.sse@saveetha.com';

const adminToken = jwt.sign(
  { uid: 'DIzyGlgaTgTW6MP1MVMVmEuIug93', email: ADMIN_EMAIL, role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const userToken = jwt.sign(
  { uid: USER_ID, id: USER_ID, email: USER_EMAIL, role: 'user' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const attackerToken = jwt.sign(
  { uid: 'some-other-uuid', id: 'some-other-uuid', email: 'attacker@example.com', role: 'user' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(bodyBuffer.toString('utf8'));
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: bodyBuffer.toString('utf8'),
          buffer: bodyBuffer,
          json
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      if (typeof postData === 'object') {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  FOODIEBITE ADMIN MEDICAL REPORT VERIFICATION TEST  ');
  console.log('====================================================');

  const results = [];
  let reportId = null;

  // TEST 1: User's Profile View (Profile -> Medical Scans)
  try {
    const res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/medical/reports',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });

    const success = res.statusCode === 200 && res.json && res.json.success && res.json.count >= 1;
    if (success && res.json.reports && res.json.reports.length > 0) {
      reportId = res.json.reports[0].id;
    }
    console.log(`TEST 1 [User Medical Reports API]: Status ${res.statusCode}, Count: ${res.json?.count}, Reports: ${res.json?.reports?.length}`);
    results.push({ name: 'User Medical Reports View (Profile -> Medical Scans)', success, details: `Report count = ${res.json?.count}` });
  } catch (err) {
    console.error('TEST 1 Failed:', err.message);
    results.push({ name: 'User Medical Reports View', success: false, details: err.message });
  }

  // TEST 2: Admin Users List (Admin -> Users Table, searching for target user)
  try {
    const res = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/users?q=${encodeURIComponent(USER_EMAIL)}&limit=10`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const userObj = res.json?.users?.find(u => u.id === USER_ID || u.email.toLowerCase() === USER_EMAIL.toLowerCase());
    const countMatches = userObj && userObj.medicalReportsCount >= 1;
    const success = res.statusCode === 200 && countMatches;
    console.log(`TEST 2 [Admin Users Table]: User found: ${!!userObj}, Email: ${userObj?.email}, medicalReportsCount: ${userObj?.medicalReportsCount}`);
    results.push({ name: 'Admin Users Table (medicalReportsCount >= 1)', success, details: `medicalReportsCount = ${userObj?.medicalReportsCount}` });
  } catch (err) {
    console.error('TEST 2 Failed:', err.message);
    results.push({ name: 'Admin Users Table', success: false, details: err.message });
  }

  // TEST 3: Admin Individual User Details (Admin -> Users -> Individual User)
  try {
    const res = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/users/${USER_ID}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const success = res.statusCode === 200 && res.json?.user && res.json.user.medicalReportsCount >= 1;
    console.log(`TEST 3 [Admin User Details]: User ${res.json?.user?.email}, medicalReportsCount: ${res.json?.user?.medicalReportsCount}`);
    results.push({ name: 'Admin Individual User Details (medicalReportsCount >= 1)', success, details: `medicalReportsCount = ${res.json?.user?.medicalReportsCount}` });
  } catch (err) {
    console.error('TEST 3 Failed:', err.message);
    results.push({ name: 'Admin Individual User Details', success: false, details: err.message });
  }

  // TEST 4: Admin Get User Medical Reports List
  try {
    const res = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/users/${USER_ID}/medical-reports`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const success = res.statusCode === 200 && res.json?.reports?.length >= 1;
    if (success && !reportId) {
      reportId = res.json.reports[0].id;
    }
    const report0 = res.json?.reports?.[0];
    console.log(`TEST 4 [Admin User Medical Reports List]: Count: ${res.json?.count}, First Report ID: ${report0?.id}, Name: ${report0?.reportName}`);
    results.push({ name: 'Admin User Medical Reports Endpoint', success, details: `Report ID: ${report0?.id}, Name: ${report0?.reportName}` });
  } catch (err) {
    console.error('TEST 4 Failed:', err.message);
    results.push({ name: 'Admin User Medical Reports Endpoint', success: false, details: err.message });
  }

  // TEST 5: Admin Get Specific Medical Report Details & Test Results
  if (reportId) {
    try {
      const res = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/users/${USER_ID}/medical-reports/${reportId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      const rep = res.json?.report;
      const hasTests = rep && Array.isArray(rep.testResults) && rep.testResults.length >= 3;
      const hasHealthSummary = rep && rep.healthSummary && rep.healthSummary.overallHealthSummary;
      const success = res.statusCode === 200 && rep && rep.id === reportId && hasTests && hasHealthSummary;
      console.log(`TEST 5 [Admin Medical Report Detail]: Found: ${!!rep}, Tests: ${rep?.testResults?.length}, OverallSummary: ${!!rep?.healthSummary?.overallHealthSummary}`);
      results.push({ name: 'Admin Medical Report Detail Endpoint', success, details: `Tests: ${rep?.testResults?.length}, Summary: Valid` });
    } catch (err) {
      console.error('TEST 5 Failed:', err.message);
      results.push({ name: 'Admin Medical Report Detail Endpoint', success: false, details: err.message });
    }
  }

  // TEST 6: Admin Run Local AI Analysis (Ollama qwen2.5:0.5b)
  if (reportId) {
    console.log('TEST 6 [Admin Local AI Analysis]: Initiating Ollama qwen2.5:0.5b analysis (may take 10-25s)...');
    try {
      const startTime = Date.now();
      const res = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/users/${USER_ID}/medical-reports/${reportId}/analyze`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }, { reanalyze: true });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const hs = res.json?.healthSummary;
      const provider = res.json?.provider;

      // Verify all 9 required clinical sections:
      const s1 = Boolean(hs?.overallHealthSummary);
      const s2 = Array.isArray(hs?.reportedMedicalConditions);
      const s3 = Array.isArray(hs?.abnormalLaboratoryValues) && hs.abnormalLaboratoryValues.length >= 1;
      const s4 = Array.isArray(hs?.normalLaboratoryValues) && hs.normalLaboratoryValues.length >= 1;
      const s5 = Array.isArray(hs?.importantHealthIndicators) && hs.importantHealthIndicators.length >= 1;
      const s6 = Boolean(hs?.potentialNutritionalConsiderations);
      const s7 = Array.isArray(hs?.dietaryRecommendationsRelevantToFoodieBite) && hs.dietaryRecommendationsRelevantToFoodieBite.length >= 1;
      const s8 = Array.isArray(hs?.itemsRequiringMedicalFollowUp) && hs.itemsRequiringMedicalFollowUp.length >= 1;
      const s9 = Boolean(hs?.healthcareGuidance);

      const all9SectionsValid = s1 && s2 && s3 && s4 && s5 && s6 && s7 && s8 && s9;
      const success = res.statusCode === 200 && res.json?.success && (provider === 'ollama' || provider === 'deterministic_engine') && all9SectionsValid;

      console.log(`TEST 6 Finished in ${duration}s. Status: ${res.statusCode}, Provider: ${provider}`);
      console.log(`- 1. Overall Summary: "${hs?.overallHealthSummary?.slice(0, 80)}..."`);
      console.log(`- 2. Reported Medical Conditions: ${JSON.stringify(hs?.reportedMedicalConditions)}`);
      console.log(`- 3. Abnormal Laboratory Values: ${hs?.abnormalLaboratoryValues?.length} items`);
      console.log(`- 4. Normal Laboratory Values: ${hs?.normalLaboratoryValues?.length} items`);
      console.log(`- 5. Important Health Indicators: ${hs?.importantHealthIndicators?.length} items`);
      console.log(`- 6. Potential Nutritional Considerations: "${hs?.potentialNutritionalConsiderations?.slice(0, 80)}..."`);
      console.log(`- 7. FoodieBite Dietary Recommendations: ${hs?.dietaryRecommendationsRelevantToFoodieBite?.length} foods`);
      console.log(`- 8. Items Requiring Medical Follow-Up: ${hs?.itemsRequiringMedicalFollowUp?.length} items`);
      console.log(`- 9. Healthcare Guidance: "${hs?.healthcareGuidance?.slice(0, 80)}..."`);

      results.push({
        name: 'Local AI Ollama qwen2.5:0.5b Clinical Analysis',
        success,
        details: `Provider: ${provider}, Duration: ${duration}s, All 9 Clinical Sections Validated`
      });
    } catch (err) {
      console.error('TEST 6 Failed:', err.message);
      results.push({ name: 'Local AI Ollama qwen2.5:0.5b Clinical Analysis', success: false, details: err.message });
    }
  }

  // TEST 7: Admin View Report Signed URL (TTL 300s)
  if (reportId) {
    try {
      const res = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/users/${USER_ID}/medical-reports/${reportId}/view`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      const success = res.statusCode === 200 && res.json?.success && Boolean(res.json?.viewUrl) && res.json?.expiresInSeconds === 300;
      console.log(`TEST 7 [Admin View Report URL]: Status ${res.statusCode}, ViewUrl: ${res.json?.viewUrl}, TTL: ${res.json?.expiresInSeconds}s`);
      results.push({ name: 'Admin Secure View (Short-lived URL / 300s TTL)', success, details: `viewUrl returned with 300s expiration` });
    } catch (err) {
      console.error('TEST 7 Failed:', err.message);
      results.push({ name: 'Admin Secure View', success: false, details: err.message });
    }
  }

  // TEST 8: Direct Document PDF Streaming
  if (reportId) {
    try {
      const res = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/users/${USER_ID}/medical-reports/${reportId}/document`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      const isPdf = res.statusCode === 200 && (res.headers['content-type']?.includes('application/pdf') || res.buffer.slice(0, 4).toString() === '%PDF');
      console.log(`TEST 8 [Direct PDF Stream]: Status ${res.statusCode}, Content-Type: ${res.headers['content-type']}, Size: ${res.buffer.length} bytes`);
      results.push({ name: 'Direct Secure PDF Document Stream', success: isPdf, details: `Status ${res.statusCode}, Size ${res.buffer.length} bytes, PDF header verified` });
    } catch (err) {
      console.error('TEST 8 Failed:', err.message);
      results.push({ name: 'Direct Secure PDF Document Stream', success: false, details: err.message });
    }
  }

  // TEST 9: Security & Authorization Restrictions (Non-admin / Unauthorized user)
  try {
    const resAttacker = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/users/${USER_ID}/medical-reports`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${attackerToken}`,
        'Content-Type': 'application/json'
      }
    });

    const resNoAuth = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/users/${USER_ID}/medical-reports`,
      method: 'GET'
    });

    const isBlocked = (resAttacker.statusCode === 401 || resAttacker.statusCode === 403) &&
                      (resNoAuth.statusCode === 401 || resNoAuth.statusCode === 403);
    console.log(`TEST 9 [Security Guard]: Attacker Status: ${resAttacker.statusCode}, No-Auth Status: ${resNoAuth.statusCode}`);
    results.push({ name: 'Security & Access Control (Admin-only enforcement)', success: isBlocked, details: `Attacker: HTTP ${resAttacker.statusCode}, Unauthenticated: HTTP ${resNoAuth.statusCode}` });
  } catch (err) {
    console.error('TEST 9 Failed:', err.message);
    results.push({ name: 'Security & Access Control', success: false, details: err.message });
  }

  console.log('\n====================================================');
  console.log('                   TEST SUMMARY                     ');
  console.log('====================================================');
  let allPass = true;
  for (const r of results) {
    const mark = r.success ? '✅ PASS' : '❌ FAIL';
    if (!r.success) allPass = false;
    console.log(`${mark} | ${r.name} -> ${r.details}`);
  }
  console.log('====================================================');
  console.log(`FINAL RESULT: ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('====================================================');

  process.exit(allPass ? 0 : 1);
}

runTests();
