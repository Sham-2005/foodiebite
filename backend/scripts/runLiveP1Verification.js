// ─────────────────────────────────────────────────────────────
//  backend/scripts/runLiveP1Verification.js
//  FoodieBite Phase P1 — Live Integration Verification Harness
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const API_BASE = 'http://localhost:5000/api';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzhxalmixfeqszgwqeqr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'foodiebite_super_secret_key_change_in_production_2024';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Test User Personas ────────────────────────────────────────
const USER_ALPHA = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  email: 'p1_live_alpha@foodiebite.test',
  name: 'Alpha Verified',
  role: 'user'
};

const USER_BETA = {
  id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  email: 'p1_live_beta@foodiebite.test',
  name: 'Beta Isolated',
  role: 'user'
};

const tokenAlpha = jwt.sign(
  {
    sub: USER_ALPHA.id,
    id: USER_ALPHA.id,
    email: USER_ALPHA.email,
    name: USER_ALPHA.name,
    role: 'user',
    aud: 'authenticated',
    iss: `${SUPABASE_URL}/auth/v1`
  },
  JWT_SECRET,
  { expiresIn: '2h' }
);

const tokenBeta = jwt.sign(
  {
    sub: USER_BETA.id,
    id: USER_BETA.id,
    email: USER_BETA.email,
    name: USER_BETA.name,
    role: 'user',
    aud: 'authenticated',
    iss: `${SUPABASE_URL}/auth/v1`
  },
  JWT_SECRET,
  { expiresIn: '2h' }
);

const results = {
  features: [],
  database: [],
  security: [],
  summary: { passed: 0, failed: 0, partial: 0 }
};

function recordResult(category, testName, status, details) {
  const item = { testName, status, details };
  if (category === 'feature') results.features.push(item);
  else if (category === 'database') results.database.push(item);
  else if (category === 'security') results.security.push(item);

  if (status === 'PASS') results.summary.passed++;
  else if (status === 'FAIL') results.summary.failed++;
  else results.summary.partial++;

  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} [${status}] ${testName}`);
  if (details) console.log(`     Details: ${typeof details === 'object' ? JSON.stringify(details) : details}`);
}

async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  let json = null;
  try {
    json = await res.json();
  } catch (_) {}
  return { status: res.status, ok: res.ok, data: json };
}

async function runLiveVerification() {
  console.log('\n======================================================');
  console.log('--- FOODIEBITE P1 LIVE INTEGRATION VERIFICATION ---');
  console.log('======================================================');
  console.log(`Backend API: ${API_BASE}`);
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  // ════════════════════════════════════════════════════════════
  // 1. FEATURE-WISE LIVE API VERIFICATION
  // ════════════════════════════════════════════════════════════
  console.log('\n[1. USER PROFILE RETRIEVAL & UPDATES]');
  {
    // Profile Get
    const getRes = await apiRequest('/user/profile', 'GET', null, tokenAlpha);
    const getOk = getRes.status === 200 && getRes.data?.success;

    // Profile Update
    const updateRes = await apiRequest('/user/profile', 'PUT', {
      name: 'Alpha Updated Live',
      age: 29,
      gender: 'female',
      dietType: 'Vegan'
    }, tokenAlpha);
    const updateOk = updateRes.status === 200 && updateRes.data?.profile?.diet_type === 'Vegan';

    recordResult('feature', 'User Profile Retrieval and Updates', (getOk && updateOk) ? 'PASS' : 'FAIL', {
      getHttpStatus: getRes.status,
      updateHttpStatus: updateRes.status,
      updatedDietType: updateRes.data?.profile?.diet_type
    });
  }

  console.log('\n[2. USER PREFERENCES RETRIEVAL & UPDATES]');
  {
    const updatePrefRes = await apiRequest('/user/preferences', 'PUT', {
      dietType: 'Keto',
      spiceLevel: 'High',
      cuisines: ['mexican', 'mediterranean'],
      allergies: ['peanuts', 'gluten']
    }, tokenAlpha);

    const getPrefRes = await apiRequest('/user/preferences', 'GET', null, tokenAlpha);
    const prefOk = getPrefRes.status === 200 && getPrefRes.data?.preferences?.dietType === 'Keto';

    recordResult('feature', 'User Preferences Retrieval and Updates', prefOk ? 'PASS' : 'FAIL', {
      updateStatus: updatePrefRes.status,
      getStatus: getPrefRes.status,
      preferences: getPrefRes.data?.preferences
    });
  }

  console.log('\n[3. ADDING AND REMOVING FAVORITES]');
  const testFoodItem = {
    foodId: 'live-test-food-999',
    foodName: 'Avocado Quinoa Power Bowl',
    cuisine: 'mexican',
    category: 'salad',
    calories: 380,
    protein: 12
  };
  {
    const addRes = await apiRequest('/user/favorites/food', 'POST', testFoodItem, tokenAlpha);
    const getRes = await apiRequest('/user/favorites', 'GET', null, tokenAlpha);
    const hasItem = Array.isArray(getRes.data?.favoriteFoods) &&
      getRes.data.favoriteFoods.some(f => (f.foodId || f.id) === testFoodItem.foodId);

    const delRes = await apiRequest(`/user/favorites/food/${testFoodItem.foodId}`, 'DELETE', null, tokenAlpha);
    const getAfterDel = await apiRequest('/user/favorites', 'GET', null, tokenAlpha);
    const itemGone = Array.isArray(getAfterDel.data?.favoriteFoods) &&
      !getAfterDel.data.favoriteFoods.some(f => (f.foodId || f.id) === testFoodItem.foodId);

    recordResult('feature', 'Adding and Removing Favorites', (addRes.ok && hasItem && delRes.ok && itemGone) ? 'PASS' : 'FAIL', {
      addStatus: addRes.status,
      delStatus: delRes.status,
      itemPresentBeforeDel: hasItem,
      itemRemovedAfterDel: itemGone
    });
  }

  console.log('\n[4. FAVORITES PERSISTENCE AFTER LOGOUT & LOGIN]');
  {
    // Step 1: Add favorite
    await apiRequest('/user/favorites/food', 'POST', testFoodItem, tokenAlpha);

    // Step 2: Simulate session logout / drop token
    let sessionToken = null;

    // Step 3: Re-authenticate Alpha (simulating fresh login with new token)
    sessionToken = jwt.sign(
      { sub: USER_ALPHA.id, id: USER_ALPHA.id, email: USER_ALPHA.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Step 4: Verify favorites are persisted
    const verifyFav = await apiRequest('/user/favorites', 'GET', null, sessionToken);
    const persisted = Array.isArray(verifyFav.data?.favoriteFoods) &&
      verifyFav.data.favoriteFoods.some(f => (f.foodId || f.id) === testFoodItem.foodId);

    recordResult('feature', 'Favorites Persistence after Logout & Login', persisted ? 'PASS' : 'FAIL', {
      persisted,
      favoriteCount: verifyFav.data?.favoriteFoods?.length
    });
  }

  console.log('\n[5. CREATING AND RETRIEVING SEARCH HISTORY]');
  {
    const addSearchRes = await apiRequest('/user/search-history', 'POST', {
      query: 'organic matcha green tea',
      filters: { diet: 'Vegan', maxCalories: 30 },
      resultCount: 8
    }, tokenAlpha);

    const getSearchRes = await apiRequest('/user/search-history', 'GET', null, tokenAlpha);
    const searchRecorded = Array.isArray(getSearchRes.data?.history) &&
      getSearchRes.data.history.some(h => h.query === 'organic matcha green tea');

    recordResult('feature', 'Creating and Retrieving Search History', (addSearchRes.ok && searchRecorded) ? 'PASS' : 'FAIL', {
      addStatus: addSearchRes.status,
      getStatus: getSearchRes.status,
      searchRecorded,
      count: getSearchRes.data?.history?.length
    });
  }

  console.log('\n[6. CLEARING SEARCH HISTORY]');
  {
    const clearRes = await apiRequest('/user/search-history', 'DELETE', null, tokenAlpha);
    const getSearchAfter = await apiRequest('/user/search-history', 'GET', null, tokenAlpha);
    const cleared = Array.isArray(getSearchAfter.data?.history) && getSearchAfter.data.history.length === 0;

    recordResult('feature', 'Clearing Search History', (clearRes.ok && cleared) ? 'PASS' : 'FAIL', {
      clearStatus: clearRes.status,
      historyCountAfterClear: getSearchAfter.data?.history?.length
    });
  }

  console.log('\n[7 & 8. AI COACH CONVERSATION CREATION & MESSAGE PERSISTENCE]');
  let activeThreadId = null;
  {
    // Message 1
    const coachRes1 = await apiRequest('/coach', 'POST', {
      threadId: 'default',
      message: 'Hello, what are good sources of plant protein?'
    }, tokenAlpha);

    activeThreadId = coachRes1.data?.threadId;
    const msg1Ok = coachRes1.status === 200 && coachRes1.data?.success && coachRes1.data?.reply;

    // Message 2 in same thread
    const coachRes2 = await apiRequest('/coach', 'POST', {
      threadId: activeThreadId,
      message: 'Can you recommend specific dishes using lentils and chickpeas?'
    }, tokenAlpha);

    const msg2Ok = coachRes2.status === 200 && coachRes2.data?.success && coachRes2.data?.reply;

    recordResult('feature', 'AI Coach Conversation Creation', msg1Ok ? 'PASS' : 'FAIL', {
      threadId: activeThreadId,
      replySample: coachRes1.data?.reply?.substring(0, 80)
    });

    recordResult('feature', 'AI Coach Message Persistence', msg2Ok ? 'PASS' : 'FAIL', {
      threadId: coachRes2.data?.threadId,
      persistedFlag: coachRes2.data?.persisted,
      replySample: coachRes2.data?.reply?.substring(0, 80)
    });
  }

  console.log('\n[9. AI COACH CONVERSATION RETRIEVAL / CONTINUITY]');
  {
    // Query coach again referencing the resolved threadId
    const followUpRes = await apiRequest('/coach', 'POST', {
      threadId: activeThreadId,
      message: 'Which of those dishes has the highest fiber?'
    }, tokenAlpha);

    const followUpOk = followUpRes.status === 200 && followUpRes.data?.success;
    recordResult('feature', 'AI Coach Conversation Retrieval Continuity', followUpOk ? 'PASS' : 'FAIL', {
      threadId: activeThreadId,
      responseReceived: !!followUpRes.data?.reply
    });
  }

  console.log('\n[10. MEDICAL REPORT UPLOAD & METADATA PERSISTENCE]');
  let uploadedReportId = null;
  {
    const samplePdfPath = path.resolve(__dirname, '../scratch/sample_medical_report.pdf');
    if (fs.existsSync(samplePdfPath)) {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const fileData = fs.readFileSync(samplePdfPath);

      let bodyBuffer = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reportName"\r\n\r\nAnnual Health Checkup 2026\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="notes"\r\n\r\nRoutine annual fasting profile\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="report"; filename="sample_medical_report.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        fileData,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const uploadRes = await fetch(`${API_BASE}/medical/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenAlpha}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: bodyBuffer
      });

      const uploadJson = await uploadRes.json();
      uploadedReportId = uploadJson.report?.id;
      const uploadOk = uploadRes.status === 201 && uploadJson.success && uploadedReportId;

      const listRes = await apiRequest('/medical/reports', 'GET', null, tokenAlpha);
      const reportInList = Array.isArray(listRes.data?.reports) &&
        listRes.data.reports.some(r => r.id === uploadedReportId);

      recordResult('feature', 'Medical Report Upload and Metadata Persistence', (uploadOk && reportInList) ? 'PASS' : 'FAIL', {
        uploadStatus: uploadRes.status,
        reportId: uploadedReportId,
        biomarkerCount: Object.keys(uploadJson.report?.analysis?.biomarkers || {}).length,
        inReportsList: reportInList
      });
    } else {
      recordResult('feature', 'Medical Report Upload and Metadata Persistence', 'SKIP', 'Sample PDF file not found');
    }
  }

  console.log('\n[11. HEALTH PROFILE RETRIEVAL & UPDATES]');
  {
    const hpGetRes = await apiRequest('/medical/health-profile', 'GET', null, tokenAlpha);
    const hpGetOk = hpGetRes.status === 200 && hpGetRes.data?.success && hpGetRes.data?.healthProfile;

    const manualValRes = await apiRequest('/medical/manual-values', 'POST', {
      values: {
        fastingGlucose: '105',
        totalCholesterol: '195',
        hba1c: '5.6',
        vitaminD: '28'
      },
      notes: 'Quarterly biomarker monitoring'
    }, tokenAlpha);
    const manualOk = manualValRes.status === 200 && manualValRes.data?.success;

    const hpAfterRes = await apiRequest('/medical/health-profile', 'GET', null, tokenAlpha);
    const scorePresent = typeof hpAfterRes.data?.healthProfile?.overallScore === 'number';

    recordResult('feature', 'Health Profile Retrieval and Updates', (hpGetOk && manualOk && scorePresent) ? 'PASS' : 'FAIL', {
      getStatus: hpGetRes.status,
      manualStatus: manualValRes.status,
      overallScore: hpAfterRes.data?.healthProfile?.overallScore,
      wellnessConcernsCount: hpAfterRes.data?.healthProfile?.wellnessConcerns?.length
    });
  }

  console.log('\n[12. USER DATA ISOLATION BETWEEN TEST ACCOUNTS]');
  {
    // User Beta attempts to read User Alpha's favorites
    const betaFavsRes = await apiRequest('/user/favorites', 'GET', null, tokenBeta);
    const betaSeesAlphaFav = Array.isArray(betaFavsRes.data?.favoriteFoods) &&
      betaFavsRes.data.favoriteFoods.some(f => (f.foodId || f.id) === testFoodItem.foodId);

    // User Beta attempts to read User Alpha's medical reports
    const betaReportsRes = await apiRequest('/medical/reports', 'GET', null, tokenBeta);
    const betaSeesAlphaReport = Array.isArray(betaReportsRes.data?.reports) &&
      betaReportsRes.data.reports.some(r => r.id === uploadedReportId);

    // User Beta attempts direct report access by Alpha's reportId
    const betaDirectReportRes = await apiRequest(`/medical/report/${uploadedReportId}`, 'GET', null, tokenBeta);
    const betaReportBlocked = betaDirectReportRes.status === 404;

    const isolationEnforced = !betaSeesAlphaFav && !betaSeesAlphaReport && betaReportBlocked;

    recordResult('feature', 'User Data Isolation (Alpha vs Beta)', isolationEnforced ? 'PASS' : 'FAIL', {
      betaSeesAlphaFavorites: betaSeesAlphaFav,
      betaSeesAlphaReportsList: betaSeesAlphaReport,
      betaDirectReportAccessBlocked: betaReportBlocked,
      betaReportHttpStatus: betaDirectReportRes.status
    });
  }

  // ════════════════════════════════════════════════════════════
  // 2. REMOTE SUPABASE DATABASE DIRECT INSPECTION
  // ════════════════════════════════════════════════════════════
  console.log('\n======================================================');
  console.log('--- REMOTE SUPABASE DATABASE TABLE VERIFICATION ---');
  console.log('======================================================');

  const supabaseTables = [
    { name: 'profiles', primaryKey: 'id', userCol: 'id' },
    { name: 'user_favorites', primaryKey: 'id', userCol: 'user_id' },
    { name: 'user_search_history', primaryKey: 'id', userCol: 'user_id' },
    { name: 'coach_threads', primaryKey: 'id', userCol: 'user_id' },
    { name: 'coach_messages', primaryKey: 'id', userCol: 'user_id' },
    { name: 'medical_reports', primaryKey: 'id', userCol: 'user_id' },
    { name: 'health_profiles', primaryKey: 'user_id', userCol: 'user_id' }
  ];

  for (const table of supabaseTables) {
    try {
      const { data, error, count } = await supabaseClient
        .from(table.name)
        .select('*', { count: 'exact' })
        .limit(5);

      if (error) {
        if (error.message.includes('schema cache')) {
          recordResult('database', `Supabase table: ${table.name}`, 'FAIL', {
            existsInRemoteDb: false,
            error: error.message,
            reason: 'Table definition has not been deployed to the remote database schema'
          });
        } else {
          recordResult('database', `Supabase table: ${table.name}`, 'PARTIAL', {
            existsInRemoteDb: true,
            error: error.message,
            note: 'Table exists but query encountered an error or RLS restriction'
          });
        }
      } else {
        recordResult('database', `Supabase table: ${table.name}`, 'PASS', {
          existsInRemoteDb: true,
          rowCount: count,
          sampleReturned: data ? data.length : 0
        });
      }
    } catch (dbErr) {
      recordResult('database', `Supabase table: ${table.name}`, 'FAIL', {
        exception: dbErr.message
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // 3. SECURITY & PRIVILEGE ENFORCEMENT VERIFICATION
  // ════════════════════════════════════════════════════════════
  console.log('\n======================================================');
  console.log('--- SECURITY, PRIVILEGE & RLS VERIFICATION ---');
  console.log('======================================================');

  // Test: Privilege Escalation Attempt
  {
    const exploitRes = await apiRequest('/user/profile', 'PUT', {
      name: 'Exploiter Attempt',
      role: 'admin',
      disabled: true,
      account_status: 'disabled'
    }, tokenAlpha);

    const roleProtected = exploitRes.data?.profile?.role === 'user';
    const disabledProtected = exploitRes.data?.profile?.disabled === false;

    recordResult('security', 'Privilege Escalation Defense (role / disabled)', (roleProtected && disabledProtected) ? 'PASS' : 'FAIL', {
      returnedRole: exploitRes.data?.profile?.role,
      returnedDisabled: exploitRes.data?.profile?.disabled,
      escalationBlocked: roleProtected && disabledProtected
    });
  }

  // Test: Unauthenticated Request Rejection
  {
    const unauthProfile = await apiRequest('/user/profile', 'GET', null, null);
    const unauthReports = await apiRequest('/medical/reports', 'GET', null, null);
    const unauthCoach = await apiRequest('/coach', 'POST', { message: 'hello' }, null);

    const blocked401 = unauthProfile.status === 401 && unauthReports.status === 401 && unauthCoach.status === 401;
    recordResult('security', 'Unauthenticated Access Rejection (HTTP 401)', blocked401 ? 'PASS' : 'FAIL', {
      profileStatus: unauthProfile.status,
      medicalStatus: unauthReports.status,
      coachStatus: unauthCoach.status
    });
  }

  // Test: Medical Reports Public Exposure Denial
  {
    const unauthReportFetch = await fetch(`${API_BASE}/medical/report/${uploadedReportId || 'unknown'}`);
    const denied = unauthReportFetch.status === 401;
    recordResult('security', 'Medical Report Confidentiality (Never Exposed Publicly)', denied ? 'PASS' : 'FAIL', {
      unauthenticatedFetchStatus: unauthReportFetch.status
    });
  }

  // ════════════════════════════════════════════════════════════
  // 4. SUMMARY
  // ════════════════════════════════════════════════════════════
  console.log('\n======================================================');
  console.log(`LIVE VERIFICATION COMPLETE`);
  console.log(`Passed: ${results.summary.passed} | Failed: ${results.summary.failed} | Partial/Skip: ${results.summary.partial}`);
  console.log('======================================================\n');

  // Save JSON report for Markdown generation
  fs.writeFileSync(
    path.resolve(__dirname, '../scratch/live_verification_raw_results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  return results;
}

runLiveVerification().catch(err => {
  console.error('Live verification harness failed:', err);
  process.exit(1);
});

