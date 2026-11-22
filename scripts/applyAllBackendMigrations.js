const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// ── 1. Update frontend/src/services/api.js ──────────────────
const apiJsPath = path.join(ROOT_DIR, 'frontend/src/services/api.js');
let apiJs = fs.readFileSync(apiJsPath, 'utf8');

if (!apiJs.includes("from '../config/apiConfig.js'")) {
  apiJs = apiJs.replace(
    "import { isSupabaseConfigured, getSupabaseClient } from '../config/supabaseClient.js';",
    "import { isSupabaseConfigured, getSupabaseClient } from '../config/supabaseClient.js';\nimport { API_BASE_URL, BACKEND_BASE_URL, getApiUrl, getBackendUrl, getApiBaseUrl } from '../config/apiConfig.js';"
  );
}

apiJs = apiJs.replace(/\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"]\}/g, '${API_BASE_URL}');
apiJs = apiJs.replace(/const API_BASE = process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"];/g, 'const API_BASE = API_BASE_URL;');
apiJs = apiJs.replace(/const MEDICAL_API_BASE = process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"];/g, 'const MEDICAL_API_BASE = API_BASE_URL;');
apiJs = apiJs.replace(/const baseUrl = process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"];/g, 'const baseUrl = API_BASE_URL;');
apiJs = apiJs.replace(/const EMAIL_API_BASE = `\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"]\}\/email`;/g, 'const EMAIL_API_BASE = `${API_BASE_URL}/email`;');
apiJs = apiJs.replace(/const ANALYTICS_BASE = `\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000\/api['"]\}\/analytics`;/g, 'const ANALYTICS_BASE = `${API_BASE_URL}/analytics`;');
apiJs = apiJs.replace(
  "const isLocalhost = !(process.env.REACT_APP_API_URL) || process.env.REACT_APP_API_URL.includes('localhost');",
  "const isLocalhost = API_BASE_URL.includes('localhost');"
);
fs.writeFileSync(apiJsPath, apiJs, 'utf8');
console.log('✔ Migrated frontend/src/services/api.js');

// ── 2. Update frontend/src/services/openFoodFacts.js ────────
const offPath = path.join(ROOT_DIR, 'frontend/src/services/openFoodFacts.js');
let off = fs.readFileSync(offPath, 'utf8');
if (!off.includes("from '../config/apiConfig.js'")) {
  off = off.replace(
    "import { getItemSync } from './storage.js';",
    "import { getItemSync } from './storage.js';\nimport { getApiUrl } from '../config/apiConfig.js';"
  );
}
off = off.replace(/`http:\/\/localhost:5000\/api\/foods\/search\?q=\$\{encodeURIComponent\(term\)\}&pageSize=\$\{pageSize\}`/g, "getApiUrl(`/foods/search?q=${encodeURIComponent(term)}&pageSize=${pageSize}`)");
off = off.replace(/`http:\/\/localhost:5000\/api\/foods\/\$\{barcode\}`/g, "getApiUrl(`/foods/${barcode}`)");
off = off.replace(/`http:\/\/localhost:5000\/api\/foods\/recommendations\?\$\{queryParams\.toString\(\)\}`/g, "getApiUrl(`/foods/recommendations?${queryParams.toString()}`)");
off = off.replace(/`http:\/\/localhost:5000\/api\/foods\/search\?\$\{queryParams\.toString\(\)\}`/g, "getApiUrl(`/foods/search?${queryParams.toString()}`)");
fs.writeFileSync(offPath, off, 'utf8');
console.log('✔ Migrated frontend/src/services/openFoodFacts.js');

// ── 3. Update frontend/src/screens/MedicalReportsScreen.js ──
const medPath = path.join(ROOT_DIR, 'frontend/src/screens/MedicalReportsScreen.js');
let med = fs.readFileSync(medPath, 'utf8');
if (!med.includes("from '../config/apiConfig.js'")) {
  med = med.replace(
    "import { C, BackHeader } from '../components/UI';",
    "import { C, BackHeader } from '../components/UI';\nimport { BACKEND_BASE_URL } from '../config/apiConfig.js';"
  );
}
med = med.replace(
  /const backendBase = \(typeof process !== 'undefined' && process\.env\?\.REACT_APP_API_URL\)[\s\S]*?: 'http:\/\/localhost:5000';/,
  "const backendBase = BACKEND_BASE_URL;"
);
fs.writeFileSync(medPath, med, 'utf8');
console.log('✔ Migrated frontend/src/screens/MedicalReportsScreen.js');

// ── 4. Update frontend/src/services/analyticsEventService.js ─
const analyticsPath = path.join(ROOT_DIR, 'frontend/src/services/analyticsEventService.js');
let analytics = fs.readFileSync(analyticsPath, 'utf8');
if (!analytics.includes("from '../config/apiConfig.js'")) {
  analytics = "import { getApiUrl } from '../config/apiConfig.js';\n" + analytics;
}
analytics = analytics.replace(
  "const apiUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api') + '/analytics/events/batch';",
  "const apiUrl = getApiUrl('/analytics/events/batch');"
);
fs.writeFileSync(analyticsPath, analytics, 'utf8');
console.log('✔ Migrated frontend/src/services/analyticsEventService.js');

// ── 5. Update frontend/src/services/emailPreferencesService.js ─
const emailPrefPath = path.join(ROOT_DIR, 'frontend/src/services/emailPreferencesService.js');
let emailPref = fs.readFileSync(emailPrefPath, 'utf8');
if (!emailPref.includes("from '../config/apiConfig.js'")) {
  emailPref = emailPref.replace(
    "import { getSupabaseClient, isSupabaseConfigured, getSupabaseInitError } from '../config/supabaseClient.js';",
    "import { getSupabaseClient, isSupabaseConfigured, getSupabaseInitError } from '../config/supabaseClient.js';\nimport { API_BASE_URL } from '../config/apiConfig.js';"
  );
}
emailPref = emailPref.replace(
  "const API_BASE = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) || 'http://localhost:5000/api';",
  "const API_BASE = API_BASE_URL;"
);
fs.writeFileSync(emailPrefPath, emailPref, 'utf8');
console.log('✔ Migrated frontend/src/services/emailPreferencesService.js');

// ── 6. Update frontend/src/services/foodHelpers.js ───────────
const foodHelpersPath = path.join(ROOT_DIR, 'frontend/src/services/foodHelpers.js');
let foodHelpers = fs.readFileSync(foodHelpersPath, 'utf8');
if (!foodHelpers.includes("from '../config/apiConfig.js'")) {
  foodHelpers = "import { BACKEND_BASE_URL } from '../config/apiConfig.js';\n" + foodHelpers;
}
foodHelpers = foodHelpers.replace(
  "const apiOrigin = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\\/api\\/?$/, '');",
  "const apiOrigin = BACKEND_BASE_URL;"
);
fs.writeFileSync(foodHelpersPath, foodHelpers, 'utf8');
console.log('✔ Migrated frontend/src/services/foodHelpers.js');

// ── 7. Update frontend/src/App.js linking prefixes ───────────
const appJsPath = path.join(ROOT_DIR, 'frontend/src/App.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');
if (!appJs.includes('https://sham-2005.github.io')) {
  appJs = appJs.replace(
    "prefixes: [\n    'http://localhost:3000',\n    'http://127.0.0.1:3000',",
    "prefixes: [\n    'https://sham-2005.github.io/foodiebite',\n    'https://sham-2005.github.io',\n    'http://localhost:3000',\n    'http://127.0.0.1:3000',"
  );
  fs.writeFileSync(appJsPath, appJs, 'utf8');
  console.log('✔ Updated frontend/src/App.js linking prefixes');
}

// ── 8. Update frontend/webpack.config.js ──────────────────────
const webpackPath = path.join(ROOT_DIR, 'frontend/webpack.config.js');
let webpackContent = fs.readFileSync(webpackPath, 'utf8');
if (!webpackContent.includes('foodiebite-backend.onrender.com')) {
  webpackContent = webpackContent.replace(
    "const envKeys = Object.keys(env).reduce((prev, next) => {",
    `// Enforce Render production backend in production builds if not explicitly overridden\nconst isProdBuild = process.env.NODE_ENV === 'production' || process.argv.includes('production') || process.argv.includes('--mode=production');\nif (isProdBuild && (!env.REACT_APP_API_URL || env.REACT_APP_API_URL.includes('localhost'))) {\n  env.REACT_APP_API_URL = 'https://foodiebite-backend.onrender.com/api';\n}\n\nconst envKeys = Object.keys(env).reduce((prev, next) => {`
  );
  fs.writeFileSync(webpackPath, webpackContent, 'utf8');
  console.log('✔ Updated frontend/webpack.config.js with Render backend fallback');
}

// ── 9. Update backend/src/server.js CORS ─────────────────────
const serverPath = path.join(ROOT_DIR, 'backend/src/server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

const oldCorsBlock = `const allowedOrigins = new Set([
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(\`CORS blocked origin: \${origin}\`));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));`;

const newCorsBlock = `const standardOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://sham-2005.github.io',
  'https://sham-2005.github.io/foodiebite',
  'https://foodiebite-backend.onrender.com',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost'
];

if (process.env.CLIENT_URL) {
  standardOrigins.push(process.env.CLIENT_URL.trim().replace(/\\/+$/, ''));
}

const allowedOrigins = new Set(standardOrigins);

app.use(cors({
  origin(origin, callback) {
    // Mobile apps, server-to-server, curl, Postman send no Origin header
    if (!origin) {
      callback(null, true);
      return;
    }

    const cleanOrigin = origin.trim().replace(/\\/+$/, '');

    // Direct match in whitelist or matching domain
    if (
      allowedOrigins.has(cleanOrigin) ||
      cleanOrigin === 'https://sham-2005.github.io' ||
      cleanOrigin.endsWith('.github.io') ||
      cleanOrigin.endsWith('.onrender.com') ||
      cleanOrigin.startsWith('http://localhost:') ||
      cleanOrigin.startsWith('http://127.0.0.1:')
    ) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-correlation-id'],
}));`;

if (serverContent.includes('const allowedOrigins = new Set([')) {
  serverContent = serverContent.replace(oldCorsBlock, newCorsBlock);
  fs.writeFileSync(serverPath, serverContent, 'utf8');
  console.log('✔ Updated backend/src/server.js CORS whitelist');
}

// ── 10. Update AndroidManifest.xml deep links ────────────────
const manifestPath = path.join(ROOT_DIR, 'frontend/android/app/src/main/AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:scheme="foodiebite"')) {
  const launcherIntent = `        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>`;
  const deepLinkIntent = `${launcherIntent}
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="foodiebite" />
        </intent-filter>`;
  manifest = manifest.replace(launcherIntent, deepLinkIntent);
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('✔ Added foodiebite:// deep-link intent filter to AndroidManifest.xml');
}

// ── 11. Update environment files ─────────────────────────────
const envPaths = [
  path.join(ROOT_DIR, '.env'),
  path.join(ROOT_DIR, 'frontend/.env')
];

envPaths.forEach(ep => {
  if (fs.existsSync(ep)) {
    let envContent = fs.readFileSync(ep, 'utf8');
    envContent = envContent.replace(
      'REACT_APP_API_URL=http://localhost:5000/api',
      'REACT_APP_API_URL=https://foodiebite-backend.onrender.com/api'
    );
    fs.writeFileSync(ep, envContent, 'utf8');
    console.log(`✔ Updated ${path.relative(ROOT_DIR, ep)} to Render backend`);
  }
});

console.log('\nAll migrations applied successfully!');
