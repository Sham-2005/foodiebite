// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/storageAbstraction.test.mjs
//  Unit & Integration Test Suite for Centralized Platform Storage Abstraction
// ─────────────────────────────────────────────────────────────

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
    testsFailed++;
    throw err;
  }
}

console.log('\n🧪 Running Platform Storage Abstraction Test Suite...\n');

// Mock localStorage environment for Web storage testing
const webMem = {};
global.window = {
  localStorage: {
    getItem: (k) => webMem[k] !== undefined ? webMem[k] : null,
    setItem: (k, v) => { webMem[k] = String(v); },
    removeItem: (k) => { delete webMem[k]; },
    clear: () => { for (const k in webMem) delete webMem[k]; },
    key: (i) => Object.keys(webMem)[i] || null,
    get length() { return Object.keys(webMem).length; }
  }
};
global.localStorage = global.window.localStorage;

const webStorage = await import('../storage.web.js');

await runTest('Test 1: Web storage getItem, setItem, and removeItem', async () => {
  await webStorage.setItem('test_key_1', 'hello_world');
  const val = await webStorage.getItem('test_key_1');
  assert.strictEqual(val, 'hello_world');

  await webStorage.removeItem('test_key_1');
  const valAfter = await webStorage.getItem('test_key_1');
  assert.strictEqual(valAfter, null);
});

await runTest('Test 2: Web storage JSON serialization and safe parsing', async () => {
  const sampleObj = { id: 'usr_1', preferences: { diet: 'vegan', calories: 2200 } };
  await webStorage.setJSON('test_json_key', sampleObj);

  const parsed = await webStorage.getJSON('test_json_key');
  assert.deepStrictEqual(parsed, sampleObj);

  const syncParsed = webStorage.getJSONSync('test_json_key');
  assert.deepStrictEqual(syncParsed, sampleObj);

  // Corrupt value to verify safe error handling
  webStorage.setItemSync('test_corrupt_key', '{ bad json ...');
  const fallback = webStorage.getJSONSync('test_corrupt_key', { fallback: true });
  assert.deepStrictEqual(fallback, { fallback: true }, 'Must return default value when JSON is malformed');
});

await runTest('Test 3: Web storage multiGet, multiSet, multiRemove', async () => {
  await webStorage.multiSet([
    ['multi_1', 'val_1'],
    ['multi_2', 'val_2']
  ]);

  const results = await webStorage.multiGet(['multi_1', 'multi_2', 'multi_missing']);
  assert.deepStrictEqual(results, [
    ['multi_1', 'val_1'],
    ['multi_2', 'val_2'],
    ['multi_missing', null]
  ]);

  await webStorage.multiRemove(['multi_1', 'multi_2']);
  assert.strictEqual(await webStorage.getItem('multi_1'), null);
  assert.strictEqual(await webStorage.getItem('multi_2'), null);
});

await runTest('Test 4: Universal storage.js delegates to active platform abstraction', async () => {
  const universalStorage = await import('../storage.js');
  universalStorage.setItemSync('universal_test', 'persisted');
  assert.strictEqual(universalStorage.getItemSync('universal_test'), 'persisted');
  universalStorage.removeItemSync('universal_test');
  assert.strictEqual(universalStorage.getItemSync('universal_test'), null);
});

await runTest('Test 5: Android storage exports safe defensive global shim', async () => {
  // Ensure Android storage module can be imported without crashing
  const androidStorage = await import('../storage.android.js');
  assert(typeof androidStorage.initStorage === 'function');
  assert(typeof androidStorage.getItem === 'function');
  assert(typeof androidStorage.setItem === 'function');
  assert(typeof androidStorage.getItemSync === 'function');
  assert(typeof androidStorage.setItemSync === 'function');
});

await runTest('Test 6: Missing storage keys return null without throwing', async () => {
  const missing = await webStorage.getItem('definitely_nonexistent_key_999');
  assert.strictEqual(missing, null);

  const missingSync = webStorage.getItemSync('definitely_nonexistent_key_999');
  assert.strictEqual(missingSync, null);
});

console.log(`\n📊 Platform Storage Abstraction Tests Passed: ${testsPassed} / ${testsPassed + testsFailed} (100%)\n`);
