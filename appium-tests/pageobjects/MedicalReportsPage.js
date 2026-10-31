/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/MedicalReportsPage.js
 *  Page Object for Medical Reports, Biomarkers & Clinical Flags
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class MedicalReportsPage extends BasePage {
  constructor() {
    super('MedicalReportsScreen');
  }

  get uploadReportButton() {
    return AppiumHelper.byTestId('button-upload-medical-pdf');
  }

  get reportsHistoryList() {
    return AppiumHelper.byTestId('list-reports-history');
  }

  get fastingGlucoseBiomarker() {
    return AppiumHelper.byTestId('biomarker-fasting-glucose');
  }

  get totalCholesterolBiomarker() {
    return AppiumHelper.byTestId('biomarker-total-cholesterol');
  }

  get hba1cBiomarker() {
    return AppiumHelper.byTestId('biomarker-hba1c');
  }

  get abnormalFlagBadge() {
    return AppiumHelper.byTestId('badge-abnormal-marker');
  }

  get clinicalDietaryAdviceCard() {
    return AppiumHelper.byTestId('card-clinical-diet-advice');
  }

  get deleteReportButton() {
    return AppiumHelper.byTestId('button-delete-report');
  }
}

module.exports = new MedicalReportsPage();
