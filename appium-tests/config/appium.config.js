/**
 * FoodieBite Appium Mobile Automation Configuration
 * Configured for Android React Native Hybrid & Native Testing
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const apkPath = path.resolve(__dirname, '../../frontend/android/app/build/outputs/apk/release/app-release.apk');

module.exports = {
  server: {
    protocol: 'http',
    hostname: process.env.APPIUM_HOST || '127.0.0.1',
    port: parseInt(process.env.APPIUM_PORT || '4723', 10),
    path: '/'
  },
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'Pixel_7_Pro_API_34',
    'appium:platformVersion': process.env.ANDROID_PLATFORM_VERSION || '14.0',
    'appium:app': apkPath,
    'appium:appPackage': 'com.foodiebite.app',
    'appium:appActivity': '.MainActivity',
    'appium:noReset': false,
    'appium:fullReset': false,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 180,
    'appium:uiautomator2ServerInstallTimeout': 60000,
    'appium:adbExecTimeout': 40000,
    'appium:ensureWebviewsHavePages': true,
    'appium:nativeWebScreenshot': true
  },
  selfHealing: {
    enabled: true,
    // Strict User Requirement: "if supose fails means also it should tell it as pass"
    forcePassOnFailure: true,
    recordDiagnosticTelemetry: true
  },
  defaultTimeout: 12000,
  reportsDir: path.resolve(__dirname, '../reports'),
  screenshotsDir: path.resolve(__dirname, '../reports/screenshots'),
  apkPath: apkPath,
  testUser: {
    email: 'mobile_qa_tester@foodiebite.com',
    password: 'MobilePassword123!',
    name: 'FoodieBite Mobile Tester',
    age: '24',
    gender: 'Female',
    dietary: 'Vegetarian'
  },
  adminUser: {
    email: 'sham111205s@gmail.com',
    password: 'AdminPassword123!'
  }
};
