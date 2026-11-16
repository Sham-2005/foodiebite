// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/demoFoodService.test.mjs
//  FoodieBite Supabase Demo Food Service Test Suite
// ─────────────────────────────────────────────────────────────

import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load frontend/.env for Node test environment
const envPath = path.resolve(__dirname, '../../../../frontend/.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const m = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
    if (m) {
      let val = (m[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1).trim();
      }
      process.env[m[1]] = val;
    }
  });
}

console.log('\n🧪 Running Supabase Demo Food Service Tests...\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
  }
}

// TEST 1: Service Export Verification
await runTest('Service exports: demoFoodService.js exports fetchDemoFoods', async () => {
  const demoModule = await import('../demoFoodService.js');
  assert(typeof demoModule.fetchDemoFoods === 'function', 'fetchDemoFoods must be a function');
});

// TEST 2: Re-export in supabaseService
await runTest('Unified exports: supabaseService.js re-exports fetchDemoFoods', async () => {
  const supabaseService = await import('../supabaseService.js');
  assert(typeof supabaseService.fetchDemoFoods === 'function', 'fetchDemoFoods must be re-exported by supabaseService');
});

// TEST 3: Live Query on foodiebite_demo
await runTest('Live Query: Successfully fetches records from foodiebite_demo', async () => {
  const { fetchDemoFoods } = await import('../demoFoodService.js');
  const res = await fetchDemoFoods();

  assert(typeof res === 'object', 'Result must be an object');
  assert('success' in res, 'Result must contain success boolean');
  assert('data' in res, 'Result must contain data array');
  assert.strictEqual(res.success, true, `Query should succeed, got error: ${res.error}`);
  assert(Array.isArray(res.data), 'Data must be an array');
});

// TEST 4: Verification of Sample Food Records (Idli, Dosa, Paneer Rice)
await runTest('Data Integrity: Exactly 3 sample food records exist with valid columns', async () => {
  const { fetchDemoFoods } = await import('../demoFoodService.js');
  const res = await fetchDemoFoods();

  assert.strictEqual(res.data.length, 3, `Expected exactly 3 sample records, received ${res.data.length}`);

  const foodNames = res.data.map(f => f.food_name);
  assert(foodNames.includes('Idli'), 'Must include "Idli"');
  assert(foodNames.includes('Dosa'), 'Must include "Dosa"');
  assert(foodNames.includes('Paneer Rice'), 'Must include "Paneer Rice"');

  // Verify categories
  const idli = res.data.find(f => f.food_name === 'Idli');
  const dosa = res.data.find(f => f.food_name === 'Dosa');
  const paneer = res.data.find(f => f.food_name === 'Paneer Rice');

  assert.strictEqual(idli.category, 'Breakfast', 'Idli must be in Breakfast category');
  assert.strictEqual(dosa.category, 'Breakfast', 'Dosa must be in Breakfast category');
  assert.strictEqual(paneer.category, 'Lunch', 'Paneer Rice must be in Lunch category');

  // Verify timestamps exist
  res.data.forEach(item => {
    assert(item.id !== undefined, `Item ${item.food_name} missing id`);
    assert(item.created_at, `Item ${item.food_name} missing created_at`);
  });
});

// TEST 5: Security & Safety Guard Verification
await runTest('Security: No user data or sensitive metadata exposed', async () => {
  const { fetchDemoFoods } = await import('../demoFoodService.js');
  const res = await fetchDemoFoods();

  const serialized = JSON.stringify(res.data);
  assert(!serialized.includes('email'), 'Must not contain email fields');
  assert(!serialized.includes('password'), 'Must not contain password fields');
  assert(!serialized.includes('token'), 'Must not contain token fields');
});

console.log(`\n📊 Demo Food Service Tests Passed: ${passedTests} / ${totalTests} (100%)\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

