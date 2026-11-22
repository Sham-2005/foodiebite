const assert = require('assert');

// Simulate various environment variables
const testScenarios = [
  {
    name: 'REACT_APP_API_URL with /api',
    env: { REACT_APP_API_URL: 'https://foodiebite-backend.onrender.com/api' },
    expectedApi: 'https://foodiebite-backend.onrender.com/api',
    expectedRoot: 'https://foodiebite-backend.onrender.com'
  },
  {
    name: 'NEXT_PUBLIC_API_URL with /api',
    env: { NEXT_PUBLIC_API_URL: 'https://foodiebite-backend.onrender.com/api' },
    expectedApi: 'https://foodiebite-backend.onrender.com/api',
    expectedRoot: 'https://foodiebite-backend.onrender.com'
  },
  {
    name: 'REACT_APP_API_URL without /api',
    env: { REACT_APP_API_URL: 'https://foodiebite-backend.onrender.com' },
    expectedApi: 'https://foodiebite-backend.onrender.com/api',
    expectedRoot: 'https://foodiebite-backend.onrender.com'
  },
  {
    name: 'Default fallback (empty env)',
    env: {},
    expectedApi: 'https://foodiebite-backend.onrender.com/api',
    expectedRoot: 'https://foodiebite-backend.onrender.com'
  }
];

function testApiUrlResolution(env) {
  const rawEnv = (env.REACT_APP_API_URL || env.NEXT_PUBLIC_API_URL || env.API_URL || '').trim();
  let base = 'https://foodiebite-backend.onrender.com';
  if (rawEnv) {
    base = rawEnv.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  const apiBase = `${base}/api`;
  return { base, apiBase };
}

console.log('Testing API URL resolution across environment variables:');
testScenarios.forEach(s => {
  const res = testApiUrlResolution(s.env);
  assert.strictEqual(res.apiBase, s.expectedApi, `${s.name} apiBase mismatch`);
  assert.strictEqual(res.base, s.expectedRoot, `${s.name} base mismatch`);
  console.log(`  ✓ ${s.name} -> Base: ${res.base} | API: ${res.apiBase}`);
});

console.log('✅ ALL API CONFIGURATION PATH TESTS PASSED!');
