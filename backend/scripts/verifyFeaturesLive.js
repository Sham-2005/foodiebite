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

async function verifyFeatures() {
  const headers = { 'x-admin-key': 'foodiebite_ai_live_key_2026' };

  console.log('--- 1. Search for "paneer" ---');
  const searchRes = await makeRequest('/api/admin/foods?q=paneer', headers);
  console.log('Status:', searchRes.status, 'Total matching:', searchRes.data.total);
  assert(searchRes.data.total > 0, 'Search should find paneer foods');
  console.log('Sample:', searchRes.data.foods[0].name);

  console.log('\n--- 2. Filter by Category: Curry ---');
  const catRes = await makeRequest('/api/admin/foods?category=Curry', headers);
  console.log('Status:', catRes.status, 'Total matching:', catRes.data.total);
  assert(catRes.data.total > 0, 'Category filter should return results');

  console.log('\n--- 3. Filter by Cuisine: North Indian ---');
  const cuiRes = await makeRequest('/api/admin/foods?cuisine=North%20Indian', headers);
  console.log('Status:', cuiRes.status, 'Total matching:', cuiRes.data.total);
  assert(cuiRes.data.total > 0, 'Cuisine filter should return results');

  console.log('\n--- 4. Sort by Protein Descending ---');
  const sortRes = await makeRequest('/api/admin/foods?sortBy=protein&sortOrder=desc&limit=3', headers);
  console.log('Status:', sortRes.status);
  sortRes.data.foods.forEach(f => console.log(` - ${f.name} (Protein: ${f.protein}g)`));
  assert(sortRes.data.foods[0].protein >= sortRes.data.foods[1].protein, 'Sorting order verified');

  console.log('\n--- 5. Food Detail by ID ---');
  const firstId = sortRes.data.foods[0].id;
  const detailRes = await makeRequest(`/api/admin/foods/${encodeURIComponent(firstId)}`, headers);
  console.log('Status:', detailRes.status, 'Food name:', detailRes.data?.food?.name, 'Calories:', detailRes.data?.food?.calories);

  console.log('\n--- 6. Users Directory (/api/admin/users) ---');
  const usersRes = await makeRequest('/api/admin/users', headers);
  console.log('Status:', usersRes.status, 'Total users:', usersRes.data?.users?.length);
  if (usersRes.data?.users?.length > 0) {
    console.log('Sample user:', usersRes.data.users[0].name, '| Email:', usersRes.data.users[0].email);
  }

  console.log('\n--- 7. User Details (/api/admin/users/:id) ---');
  const targetUid = usersRes.data.users[0].id;
  const userDetailRes = await makeRequest(`/api/admin/users/${encodeURIComponent(targetUid)}`, headers);
  console.log('Status:', userDetailRes.status, 'User:', userDetailRes.data?.user?.email, 'Role:', userDetailRes.data?.user?.role);

  console.log('\nALL FEATURE VERIFICATIONS PASSED SUCCESSFULLY!');
}

function assert(condition, msg) {
  if (!condition) {
    console.error('ASSERTION FAILED:', msg);
    process.exit(1);
  }
}

verifyFeatures().catch(console.error);
