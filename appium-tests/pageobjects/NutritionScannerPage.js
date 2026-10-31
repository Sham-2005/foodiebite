/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/NutritionScannerPage.js
 *  Page Object for Camera OCR Nutrition Label Scanning
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class NutritionScannerPage extends BasePage {
  constructor() {
    super('NutritionScannerScreen');
  }

  get cameraPreview() {
    return AppiumHelper.byTestId('view-camera-preview');
  }

  get shutterCaptureButton() {
    return AppiumHelper.byTestId('button-capture-photo');
  }

  get galleryUploadButton() {
    return AppiumHelper.byTestId('button-upload-from-gallery');
  }

  get ocrProcessingIndicator() {
    return AppiumHelper.byTestId('view-ocr-scanning-progress');
  }

  get parsedCaloriesResult() {
    return AppiumHelper.byTestId('result-parsed-calories');
  }

  get parsedProteinResult() {
    return AppiumHelper.byTestId('result-parsed-protein');
  }

  get healthSafetyVerdict() {
    return AppiumHelper.byTestId('verdict-health-safety');
  }

  get retakeScanButton() {
    return AppiumHelper.byTestId('button-retake-scan');
  }

  async captureAndScan() {
    await this.shutterCaptureButton.click();
    await this.ocrProcessingIndicator.waitForDisplayed({ timeout: 15000, reverse: true });
  }
}

module.exports = new NutritionScannerPage();
