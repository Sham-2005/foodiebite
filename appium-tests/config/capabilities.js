/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/config/capabilities.js
 *  Appium Desired Capabilities for FoodieBite Android & Web
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const path = require('path');
const { APP_PACKAGE, APP_ACTIVITY } = require('./constants');

module.exports = {
  // Android Emulator / Physical Device (UiAutomator2)
  androidCapabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'Pixel_7_API_34',
    'appium:platformVersion': process.env.ANDROID_PLATFORM_VERSION || '14.0',
    'appium:appPackage': APP_PACKAGE,
    'appium:appActivity': APP_ACTIVITY,
    'appium:noReset': false,
    'appium:fullReset': false,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 240,
    'appium:uiautomator2ServerInstallTimeout': 60000,
    'appium:uiautomator2ServerLaunchTimeout': 60000,
    'appium:adbExecTimeout': 40000,
    'appium:app': process.env.APK_PATH || path.resolve(__dirname, '../../frontend/android/app/build/outputs/apk/debug/app-debug.apk')
  },

  // Android Web / Chrome Browser Mode
  androidChromeCapabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Pixel_7_API_34',
    'browserName': 'Chrome',
    'appium:chromedriverAutodownload': true
  },

  // Headless Web / Mobile Viewport for CI/CD Pipeline
  mobileWebCapabilities: {
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: [
        '--headless',
        '--disable-gpu',
        '--window-size=412,915',
        '--user-agent=Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      ]
    }
  }
};
