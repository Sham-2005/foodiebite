const http = require('http');

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    }).on('error', reject);
  });
}

async function runLiveAdminApiTests() {
  console.log('=== 1. Testing GET /api/admin/foods/stats with x-admin-key ===');
  const statsRes = await makeRequest('/api/admin/foods/stats', {
    'x-admin-key': 'foodiebite_ai_live_key_2026'
  });
  console.log('Status:', statsRes.status);
  console.log('Stats Response:', JSON.stringify(statsRes.data, null, 2));

  console.log('\n=== 2. Testing GET /api/admin/foods (default filters) with x-admin-key ===');
  const foodsRes = await makeRequest('/api/admin/foods?page=1&limit=5', {
    'x-admin-key': 'foodiebite_ai_live_key_2026'
  });
  console.log('Status:', foodsRes.status);
  console.log('Total foods:', foodsRes.data?.total);
  console.log('Returned items count:', foodsRes.data?.foods?.length);
  if (foodsRes.data?.foods?.length > 0) {
    console.log('First food item:', foodsRes.data.foods[0].name, '| Diet:', foodsRes.data.foods[0].dietType);
  }

  console.log('\n=== 3. Testing GET /api/admin/users/kani@gmail.com/medical-reports with x-admin-key ===');
  const medRes = await makeRequest('/api/admin/users/kani@gmail.com/medical-reports', {
    'x-admin-key': 'foodiebite_ai_live_key_2026'
  });
  console.log('Status:', medRes.status);
  console.log('Reports response:', medRes.data);

  console.log('\n=== 4. Testing Normal User Security (No admin key / Normal token) ===');
  const unauthorizedRes = await makeRequest('/api/admin/foods');
  console.log('Unauthorized Status (expected 401):', unauthorizedRes.status);
}

runLiveAdminApiTests().catch(console.error);
