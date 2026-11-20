// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/uiImprovementAndBugFixes.test.mjs
//  Verification suite for:
//    1. Restricting Nearby Restaurant and Camera strictly to Home Page
//    2. Fixing Medical Report Application Crashes & In-App PDF Preview
//    3. Implementing Smooth Navigation Transitions across the entire app
// ─────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('\n🧪 Running FoodieBite UI Improvement & Bug Fixing Verification Suite...\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${total}. ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${total}. ${name}: ${err.message}`);
  }
}

// ── TEST GROUP 1: Restrict Nearby & Camera to Home Page ──

test('AppLayout restricts floating Camera and Nearby buttons to isHomeScreen', () => {
  const content = fs.readFileSync('frontend/src/components/AppLayout.js', 'utf8');
  assert.ok(content.includes('isHomeScreen'), 'AppLayout must check isHomeScreen');
  assert.ok(content.includes('isHomeScreen && !hideNearby && !panelOpen'), 'Floating buttons must be conditional on isHomeScreen');
  assert.ok(content.includes('isHomeScreen && panelOpen'), 'Discovery drawer must be conditional on isHomeScreen');
});

test('HomeScreen explicitly activates Home layout mode (isHome={true})', () => {
  const content = fs.readFileSync('frontend/src/screens/HomeScreen.js', 'utf8');
  assert.ok(content.includes('<AppLayout isHome={true}>'), 'HomeScreen must pass isHome={true} to AppLayout');
});

test('BottomNav contains only standard 5 items and no Camera or Nearby actions', () => {
  const content = fs.readFileSync('frontend/src/components/BottomNav.js', 'utf8');
  assert.ok(!content.includes('Camera'), 'BottomNav must not contain Camera icon');
  assert.ok(!content.includes('NutritionScanner'), 'BottomNav must not route to NutritionScanner');
  assert.ok(!content.includes('Nearby'), 'BottomNav must not contain Nearby trigger');
});

test('AIScreen navigates to Home when nearbyIntent is detected', () => {
  const content = fs.readFileSync('frontend/src/screens/AIScreen.js', 'utf8');
  assert.ok(content.includes("navigation.navigate('Home')"), 'AIScreen must navigate to Home for nearby intent');
});

// ── TEST GROUP 2: Medical Report Crash Fix & In-App PDF Preview ──

test('MedicalReportsScreen contains NO raw HTML elements (div, span, table, etc.)', () => {
  const content = fs.readFileSync('frontend/src/screens/MedicalReportsScreen.js', 'utf8');
  const lines = content.split('\n');
  const htmlTagRegex = /<\/?(div|span|p|table|thead|tbody|tr|td|th)\b/i;
  const invalid = [];
  lines.forEach((l, i) => {
    if (htmlTagRegex.test(l)) {
      invalid.push(`Line ${i + 1}: ${l.trim()}`);
    }
  });
  assert.strictEqual(invalid.length, 0, `Found raw HTML tags:\n${invalid.join('\n')}`);
});

test('CompareScreen contains NO raw HTML div tags', () => {
  const content = fs.readFileSync('frontend/src/screens/CompareScreen.js', 'utf8');
  const lines = content.split('\n');
  const htmlTagRegex = /<\/?div\b/i;
  const invalid = [];
  lines.forEach((l, i) => {
    if (htmlTagRegex.test(l)) {
      invalid.push(`Line ${i + 1}: ${l.trim()}`);
    }
  });
  assert.strictEqual(invalid.length, 0, `Found raw HTML tags in CompareScreen:\n${invalid.join('\n')}`);
});

test('MedicalReportsScreen includes In-App PDF Preview Modal and safe BackHandler', () => {
  const content = fs.readFileSync('frontend/src/screens/MedicalReportsScreen.js', 'utf8');
  assert.ok(content.includes('previewModalVisible'), 'Must manage previewModalVisible state');
  assert.ok(content.includes('<Modal'), 'Must render in-app Modal for document viewing');
  assert.ok(content.includes('BackHandler.addEventListener'), 'Must listen to hardwareBackPress');
  assert.ok(content.includes('navigation.canGoBack()'), 'Must check navigation.canGoBack() before popping');
  assert.ok(content.includes("navigation.navigate('Home')"), 'Must fallback to Home if stack is empty');
});

test('MedicalReportsScreen handles deletion safely across mobile and web', () => {
  const content = fs.readFileSync('frontend/src/screens/MedicalReportsScreen.js', 'utf8');
  assert.ok(content.includes('Alert.alert'), 'Must use native Alert.alert on Android');
  assert.ok(content.includes("Platform.OS === 'web'"), 'Must guard web confirmation');
});

test('File uploads guard instanceof File check to prevent ReferenceError in Hermes', () => {
  const apiContent = fs.readFileSync('frontend/src/services/api.js', 'utf8');
  const serviceContent = fs.readFileSync('frontend/src/services/medicalReportsService.js', 'utf8');
  assert.ok(apiContent.includes("typeof File !== 'undefined'"), 'api.js must guard File with typeof');
  assert.ok(serviceContent.includes("typeof File !== 'undefined'"), 'medicalReportsService.js must guard File with typeof');
});

// ── TEST GROUP 3: Smooth Navigation & Screen Transitions ──

test('App.js implements subtle fade-in + horizontal slide (200-250ms) transition', () => {
  const content = fs.readFileSync('frontend/src/App.js', 'utf8');
  assert.ok(content.includes('cardStyleInterpolator'), 'Must provide custom cardStyleInterpolator');
  assert.ok(content.includes('translateX'), 'Must interpolate translateX for horizontal slide');
  assert.ok(content.includes('opacity'), 'Must interpolate opacity for fade-in');
  assert.ok(content.includes('duration: 250'), 'Must configure smooth ~250ms open transition');
  assert.ok(content.includes('duration: 220'), 'Must configure smooth ~220ms close transition');
});

test('App.js respects reduced motion accessibility preferences', () => {
  const content = fs.readFileSync('frontend/src/App.js', 'utf8');
  assert.ok(content.includes('AccessibilityInfo.isReduceMotionEnabled'), 'Must query reduced motion');
  assert.ok(content.includes('reduceMotionChanged'), 'Must listen to reduceMotionChanged events');
});

test('App.js wraps lazy screens with ScreenErrorBoundary and provides dark cardStyle', () => {
  const content = fs.readFileSync('frontend/src/App.js', 'utf8');
  assert.ok(content.includes('class ScreenErrorBoundary'), 'Must define ScreenErrorBoundary');
  assert.ok(content.includes('<ScreenErrorBoundary>'), 'Must wrap lazy screens with ScreenErrorBoundary');
  assert.ok(content.includes("backgroundColor: '#111318'"), 'Must specify dark cardStyle to prevent white flashes');
});

console.log(`\n📊 Bug Fixing & UI Verification: ${passed} / ${total} Passed (${Math.round((passed / total) * 100)}%)\n`);

if (passed !== total) {
  process.exit(1);
}
