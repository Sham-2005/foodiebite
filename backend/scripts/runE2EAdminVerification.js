const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runE2ETests() {
  console.log('================================================================');
  console.log('--- FoodieBite Admin Dashboard E2E Live Verification Suite ---');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  // 1. CORS Preflight Verification
  console.log('[1. CORS PREFLIGHT VALIDATION]');
  const corsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/foods',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'x-admin-key, content-type'
    }
  });
  assert(corsRes.status === 204, 'CORS preflight returns HTTP 204');
  assert(corsRes.headers['access-control-allow-headers'].includes('x-admin-key'), 'Access-Control-Allow-Headers explicitly permits x-admin-key');

  // 2. Initial Display of 12 Foods
  console.log('\n[2. FOOD DATABASE — INITIAL 12 RECORDS & PAGINATION]');
  const page1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/foods?page=1&limit=12',
    method: 'GET',
    headers: { 'x-admin-key': 'foodiebite_ai_live_key_2026' }
  });
  assert(page1.status === 200, 'Page 1 returns HTTP 200');
  assert(page1.body.success === true, 'Page 1 body reports success: true');
  assert(page1.body.foods.length === 12, `Page 1 returns exactly 12 records (received: ${page1.body.foods.length})`);
  assert(page1.body.total === 1676, `Total records in unified database is 1676 (received: ${page1.body.total})`);
  assert(page1.body.totalPages === Math.ceil(1676 / 12), `Total pages is ${Math.ceil(1676 / 12)} (received: ${page1.body.totalPages})`);

  // 3. Load More Foods (Page 2) & Append Without Duplicates
  console.log('\n[3. LOAD MORE FOODS — PAGE 2 & APPEND VERIFICATION]');
  const page2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/foods?page=2&limit=12',
    method: 'GET',
    headers: { 'x-admin-key': 'foodiebite_ai_live_key_2026' }
  });
  assert(page2.status === 200, 'Page 2 returns HTTP 200');
  assert(page2.body.foods.length === 12, `Page 2 returns exactly 12 records (received: ${page2.body.foods.length})`);

  const p1Ids = new Set(page1.body.foods.map(f => f.id));
  const page2Duplicates = page2.body.foods.filter(f => p1Ids.has(f.id));
  assert(page2Duplicates.length === 0, 'Page 1 and Page 2 records have zero overlapping IDs (disjoint sets)');

  const combined = [...page1.body.foods, ...page2.body.foods];
  assert(combined.length === 24, `Combined appended list has exactly 24 records (received: ${combined.length})`);

  // 4. Food Card Content Validation
  console.log('\n[4. FOOD CARD FIELDS INTEGRITY]');
  const sample = page1.body.foods[0];
  assert(typeof sample.name === 'string' && sample.name.length > 0, `Name exists: "${sample.name}"`);
  assert(typeof sample.image === 'string' && sample.image.startsWith('http'), `Image URL exists: "${sample.image.slice(0, 40)}..."`);
  assert(typeof sample.dietType === 'string', `Dietary type exists: "${sample.dietType}"`);
  assert(typeof sample.category === 'string', `Category exists: "${sample.category}"`);
  assert(typeof sample.cuisine === 'string', `Cuisine exists: "${sample.cuisine}"`);
  assert(typeof sample.spiceLevel === 'string', `Spice level exists: "${sample.spiceLevel}"`);
  assert(typeof sample.calories === 'number', `Calories numeric: ${sample.calories} kcal`);
  assert(typeof sample.protein === 'number', `Protein numeric: ${sample.protein} g`);
  assert(typeof sample.description === 'string', `Description exists: "${sample.description.slice(0, 40)}..."`);

  // 5. Search & Filters
  console.log('\n[5. SEARCH & FILTERS VALIDATION]');
  // Ingredient search
  const ingSearch = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/foods?page=1&limit=12&q=paneer',
    method: 'GET',
    headers: { 'x-admin-key': 'foodiebite_ai_live_key_2026' }
  });
  assert(ingSearch.body.total > 0, `Ingredient search 'paneer' matches ${ingSearch.body.total} items`);

  // Dietary filter
  const vegFilter = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/foods?page=1&limit=12&dietType=Vegetarian',
    method: 'GET',
    headers: { 'x-admin-key': 'foodiebite_ai_live_key_2026' }
  });
  assert(vegFilter.body.foods.every(f => f.dietType.toLowerCase() === 'vegetarian'), 'Diet filter "Vegetarian" only returns vegetarian items');

  // Sorting asc calories
  const calAsc = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/foods?page=1&limit=12&sortBy=calories&sortOrder=asc',
    method: 'GET',
    headers: { 'x-admin-key': 'foodiebite_ai_live_key_2026' }
  });
  let isSorted = true;
  for (let i = 0; i < calAsc.body.foods.length - 1; i++) {
    if (calAsc.body.foods[i].calories > calAsc.body.foods[i + 1].calories) isSorted = false;
  }
  assert(isSorted, 'Calories ascending sort order strictly maintained');

  // 6. Food Detail Modal Data Lookup
  console.log('\n[6. FOOD DETAILS MODAL PAYLOAD]');
  const detailRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/admin/foods/${sample.id}`,
    method: 'GET',
    headers: { 'x-admin-key': 'foodiebite_ai_live_key_2026' }
  });
  assert(detailRes.status === 200, 'Single food detail lookup returns HTTP 200');
  assert(detailRes.body.success === true, 'Detail lookup reports success: true');
  assert(detailRes.body.food.id === sample.id, `Detail food ID matches requested ID (${sample.id})`);
  assert(Array.isArray(detailRes.body.food.allergens), 'Allergens array exists in detail');
  assert(Array.isArray(detailRes.body.food.healthTags), 'Health tags array exists in detail');

  // 7. Medical Reports Section Validation
  console.log('\n[7. USER MANAGEMENT — MEDICAL REPORTS ENDPOINT]');
  const medRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/users/sham111205s@gmail.com/medical-reports',
    method: 'GET',
    headers: { 'x-admin-key': 'foodiebite_ai_live_key_2026' }
  });
  assert(medRes.status === 200, 'Admin medical reports endpoint returns HTTP 200 (not Failed to fetch)');
  assert(medRes.body.success === true, 'Admin medical reports returns success: true');
  assert(Array.isArray(medRes.body.reports), 'Admin medical reports returns an array');
  assert(typeof medRes.body.count === 'number', 'Admin medical reports returns a count property');

  console.log('\n================================================================');
  console.log(`Results: ${passed}/${total} E2E assertions passed`);
  console.log('================================================================');
}

runE2ETests().catch(console.error);
