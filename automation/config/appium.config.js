/**
 * Enterprise Appium Automation Configuration
 * Standardized for Local Development & GitHub Actions CI/CD Headless Emulator Execution
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const apkPath = path.resolve(__dirname, '../../frontend/android/app/build/outputs/apk/release/app-release.apk');
const projectRoot = path.resolve(__dirname, '../..');
const resultsRoot = path.resolve(projectRoot, 'Test Results');

module.exports = {
  // Appium Server Connection
  server: {
    protocol: 'http',
    hostname: process.env.APPIUM_HOST || '127.0.0.1',
    port: parseInt(process.env.APPIUM_PORT || '4723', 10),
    path: '/'
  },

  // Android UiAutomator2 Capabilities
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'emulator-5554',
    'appium:platformVersion': process.env.ANDROID_PLATFORM_VERSION || '14.0',
    'appium:app': apkPath,
    'appium:appPackage': 'com.foodiebite.app',
    'appium:appActivity': '.MainActivity',
    'appium:noReset': false,
    'appium:fullReset': false,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 300,
    'appium:uiautomator2ServerInstallTimeout': 60000,
    'appium:adbExecTimeout': 40000,
    'appium:ensureWebviewsHavePages': true,
    'appium:nativeWebScreenshot': true,
    'appium:skipUnlock': true,
    'appium:ignoreHiddenApiPolicyError': true
  },

  // Execution & Retry Policies
  execution: {
    parallelWorkers: parseInt(process.env.TEST_WORKERS || '1', 10),
    maxRetries: 2,
    retryDelayMs: 1000,
    implicitWaitMs: 8000,
    explicitTimeoutMs: 15000,
    pageLoadTimeoutMs: 30000
  },

  // Target Artifact Paths
  paths: {
    apkPath: apkPath,
    projectRoot: projectRoot,
    resultsRoot: resultsRoot,
    excelDir: path.join(resultsRoot, 'Excel'),
    htmlDir: path.join(resultsRoot, 'HTML'),
    jsonDir: path.join(resultsRoot, 'JSON'),
    screenshotsDir: path.join(resultsRoot, 'Screenshots'),
    logsDir: path.join(resultsRoot, 'Logs'),
    summaryDir: path.join(resultsRoot, 'Summary'),
    pagesDir: path.join(projectRoot, 'reports')
  },

  // Environment & Build Metadata
  buildMetadata: {
    appName: 'FoodieBite Mobile',
    appVersion: '1.0.0',
    buildNumber: process.env.GITHUB_RUN_NUMBER || '42',
    gitCommit: (process.env.GITHUB_SHA || 'd3a9b1c').substring(0, 7),
    branch: process.env.GITHUB_REF_NAME || 'main',
    androidApiVersion: '34 (Android 14.0)',
    deviceModel: 'Google Pixel 7 Pro (Emulator)',
    ciPipeline: process.env.GITHUB_ACTIONS ? 'GitHub Actions CI/CD' : 'Local Enterprise Runner'
  }
};
