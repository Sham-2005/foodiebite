'use strict';
require('dotenv').config();

module.exports = {
  appiumHost: process.env.APPIUM_HOST || '127.0.0.1',
  appiumPort: parseInt(process.env.APPIUM_PORT, 10) || 4723,
  appiumPath: process.env.APPIUM_PATH || '/',
  apkPath: path.resolve(__dirname, '../../frontend/android/app/build/outputs/apk/debug/app-debug.apk'),
  isMockRunner: process.env.APPIUM_MOCK === 'true'
};
