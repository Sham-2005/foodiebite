// Test local CORS validator logic against production domains
const standardOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://sham-2005.github.io',
  'https://sham-2005.github.io/foodiebite',
  'https://foodiebite-backend.onrender.com',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost'
];

const allowedOrigins = new Set(standardOrigins);

function testOrigin(origin) {
  if (!origin) return true;
  const cleanOrigin = origin.trim().replace(/\/+$/, '');

  if (
    allowedOrigins.has(cleanOrigin) ||
    cleanOrigin === 'https://sham-2005.github.io' ||
    cleanOrigin.endsWith('.github.io') ||
    cleanOrigin.endsWith('.onrender.com') ||
    cleanOrigin.endsWith('.vercel.app') ||
    cleanOrigin.includes('.vercel.app') ||
    cleanOrigin.startsWith('http://localhost:') ||
    cleanOrigin.startsWith('http://127.0.0.1:')
  ) {
    return true;
  }
  return false;
}

const testCases = [
  { origin: 'https://foodiebite.vercel.app', expected: true },
  { origin: 'https://foodiebite-app.vercel.app', expected: true },
  { origin: 'https://foodiebite-git-main-user.vercel.app', expected: true },
  { origin: 'https://sham-2005.github.io', expected: true },
  { origin: 'https://foodiebite-backend.onrender.com', expected: true },
  { origin: 'http://localhost:3000', expected: true },
  { origin: 'capacitor://localhost', expected: true },
  { origin: null, expected: true },
  { origin: 'https://malicious-site.com', expected: false }
];

console.log('Testing CORS origin validation logic:');
let allPassed = true;
testCases.forEach(tc => {
  const result = testOrigin(tc.origin);
  const pass = result === tc.expected;
  if (!pass) allPassed = false;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] Origin: "${tc.origin}" -> Allowed: ${result} (Expected: ${tc.expected})`);
});

if (allPassed) {
  console.log('✅ ALL CORS ORIGIN TESTS PASSED PERFECTLY!');
} else {
  console.error('❌ Some CORS origin checks failed');
  process.exit(1);
}
