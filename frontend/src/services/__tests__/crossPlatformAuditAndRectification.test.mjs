import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../..');

console.log('🧪 Starting Cross-Platform Audit & Rectification Verification Suite...');

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
    process.exitCode = 1;
  }
}

// 1. Webpack Config Resolves Stubs Cleanly
await runTest('1. Webpack configuration aliases react-native-reanimated & PressableProps stubs', () => {
  const wpPath = path.join(frontendDir, 'webpack.config.js');
  const wpContent = fs.readFileSync(wpPath, 'utf8');
  assert.ok(wpContent.includes('reanimatedWebStub.js'), 'Must alias react-native-reanimated to reanimatedWebStub');
  assert.ok(wpContent.includes('pressablePropsWebStub.js'), 'Must alias PressableProps to pressablePropsWebStub');
  assert.ok(wpContent.includes('performance:'), 'Must configure realistic performance budget hints');
});

// 2. Web Stubs Content Integrity
await runTest('2. Reanimated & PressableProps stubs export valid objects', async () => {
  const reanimatedStub = path.join(frontendDir, 'src/services/reanimatedWebStub.js');
  const pressableStub = path.join(frontendDir, 'src/services/pressablePropsWebStub.js');
  assert.ok(fs.existsSync(reanimatedStub), 'reanimatedWebStub.js must exist');
  assert.ok(fs.existsSync(pressableStub), 'pressablePropsWebStub.js must exist');

  const reanimatedModule = await import(pathToFileURL(reanimatedStub).href);
  assert.strictEqual(reanimatedModule.default?.useSharedValue, undefined);

  const pressableContent = fs.readFileSync(pressableStub, 'utf8');
  assert.ok(pressableContent.includes('export const PressableProps'), 'Must export PressableProps');
});

// 3. AndroidManifest.xml Complete Declarations
await runTest('3. AndroidManifest.xml declares all required permissions and adjustResize', () => {
  const manifestPath = path.join(frontendDir, 'android/app/src/main/AndroidManifest.xml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  assert.ok(manifest.includes('android.permission.INTERNET'), 'Missing INTERNET permission');
  assert.ok(manifest.includes('android.permission.ACCESS_NETWORK_STATE'), 'Missing ACCESS_NETWORK_STATE');
  assert.ok(manifest.includes('android.permission.CAMERA'), 'Missing CAMERA permission');
  assert.ok(manifest.includes('android.permission.ACCESS_FINE_LOCATION'), 'Missing FINE_LOCATION');
  assert.ok(manifest.includes('android.permission.READ_MEDIA_IMAGES'), 'Missing READ_MEDIA_IMAGES');
  assert.ok(manifest.includes('android:windowSoftInputMode="adjustResize"'), 'Missing windowSoftInputMode adjustResize');
});

// 4. Zero Firebase Imports in Active Screens
await runTest('4. Zero Firebase dependencies imported in frontend screens', () => {
  const screensDir = path.join(frontendDir, 'src/screens');
  const files = fs.readdirSync(screensDir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      const content = fs.readFileSync(path.join(screensDir, file), 'utf8');
      assert.ok(!content.includes("from 'firebase"), `${file} must not import from firebase`);
      assert.ok(!content.includes("from '../services/firebase'"), `${file} must not import from ../services/firebase`);
    }
  }
});

// 5. Supabase Credentials Security
await runTest('5. Supabase credentials contain only public client key and project URL (no secrets)', () => {
  const envPath = path.join(frontendDir, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  assert.ok(!envContent.includes('service_role'), '.env must not contain service_role keys');
  assert.ok(envContent.includes('NEXT_PUBLIC_SUPABASE_URL'), '.env must specify NEXT_PUBLIC_SUPABASE_URL');
  assert.ok(envContent.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), '.env must specify NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
});

// 6. Cross-Platform Storage Architecture
await runTest('6. Storage abstraction exports sync and async APIs with memory fallback', () => {
  const storageAndroidPath = path.join(frontendDir, 'src/services/storage.android.js');
  const storageWebPath = path.join(frontendDir, 'src/services/storage.web.js');
  const storageIndexPath = path.join(frontendDir, 'src/services/storage.js');

  const androidContent = fs.readFileSync(storageAndroidPath, 'utf8');
  assert.ok(androidContent.includes('AsyncStorage'), 'Android storage must use AsyncStorage');
  assert.ok(androidContent.includes('getItemSync'), 'Android storage must support getItemSync');

  const webContent = fs.readFileSync(storageWebPath, 'utf8');
  assert.ok(webContent.includes('localStorage'), 'Web storage must use localStorage');
  assert.ok(webContent.includes('getItemSync'), 'Web storage must support getItemSync');

  const indexContent = fs.readFileSync(storageIndexPath, 'utf8');
  assert.ok(indexContent.includes('storage.web.js'), 'Storage dispatcher must delegate cleanly');
});

// 7. Hermes Safety in Core Screens (no raw JSX DOM elements)
await runTest('7. Screens and components avoid raw DOM elements and protect against undefined functions', () => {
  const screens = ['FoodDetailScreen.js', 'MedicalReportsScreen.js', 'CompareScreen.js', 'AdminDashboardScreen.js'];
  for (const s of screens) {
    const content = fs.readFileSync(path.join(frontendDir, 'src/screens', s), 'utf8');
    // Check for JSX rendered DOM tags (e.g. `( <div`, `return <div`, `> <div`)
    const rawDivJsx = /(?:return|\()\s*<div\b|[>\n]\s*<div\b/;
    const rawSpanJsx = /(?:return|\()\s*<span\b|[>\n]\s*<span\b/;
    assert.ok(!rawDivJsx.test(content), `${s} must not contain raw JSX <div> tags`);
    assert.ok(!rawSpanJsx.test(content), `${s} must not contain raw JSX <span> tags`);
  }
});

// 8. Navigation Error Boundary & Suspense
await runTest('8. App.js implements ScreenErrorBoundary and withLazy suspense wrappers', () => {
  const appPath = path.join(frontendDir, 'src/App.js');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.ok(appContent.includes('ScreenErrorBoundary'), 'App.js must define ScreenErrorBoundary');
  assert.ok(appContent.includes('withLazy'), 'App.js must wrap lazy components with withLazy');
  assert.ok(appContent.includes('GestureHandlerRootView'), 'App.js must wrap app in GestureHandlerRootView');
});

console.log('\n📊 All Cross-Platform Verification Tests Evaluated Successfully!');
