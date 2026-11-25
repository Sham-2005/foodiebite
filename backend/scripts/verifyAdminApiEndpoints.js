const http = require('http');

function fetchJson(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'foodiebite_ai_live_key_2026',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verify() {
  console.log('--- Probing FoodieBite Admin Endpoints ---');

  // 1. Food DB initial 12 records
  const foodRes = await fetchJson('/api/admin/foods?page=1&limit=12');
  console.log(`[Food DB Page 1] Status: ${foodRes.status}, Success: ${foodRes.body?.success}`);
  console.log(`[Food DB Page 1] Returned items count: ${foodRes.body?.foods?.length}`);
  console.log(`[Food DB Page 1] Total foods in catalog: ${foodRes.body?.total}`);
  console.log(`[Food DB Page 1] Total pages: ${foodRes.body?.totalPages}`);
  if (foodRes.body?.foods?.[0]) {
    const f = foodRes.body.foods[0];
    console.log(`[Sample Item] Name: "${f.name}", Diet: "${f.dietType}", Category: "${f.category}", Cuisine: "${f.cuisine}", Calories: ${f.calories}, Protein: ${f.protein}`);
  }

  // 2. Food DB search by ingredient
  const searchRes = await fetchJson('/api/admin/foods?page=1&limit=12&q=paneer');
  console.log(`\n[Food DB Search 'paneer'] Status: ${searchRes.status}, Returned: ${searchRes.body?.foods?.length}, Total matches: ${searchRes.body?.total}`);

  // 3. User Medical Reports
  const medRes = await fetchJson('/api/admin/users/test_user_id_123/medical-reports');
  console.log(`\n[User Medical Reports] Status: ${medRes.status}, Success: ${medRes.body?.success}, Count: ${medRes.body?.count}`);

  console.log('\n--- Verification Completed ---');
}

verify().catch(console.error);
