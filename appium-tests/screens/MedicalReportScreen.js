'use strict';
const BaseScreen = require('../framework/baseScreen');

class MedicalReportScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'MedicalReportScreen');
    this.uploadDocBtn = '~upload-document-btn';
    this.cameraScanBtn = '~camera-scan-btn';
    this.biomarkerRow = '~biomarker-result-row';
    this.disclaimerText = '~medical-disclaimer-text';
  }
}

module.exports = MedicalReportScreen;
