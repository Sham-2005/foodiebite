'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class MedicalReportPage extends BasePage {
  constructor(driver) {
    super(driver, '/medical-reports');
    this.uploadInput = By.css('input[type="file"]');
    this.uploadButton = By.xpath('//button[contains(., "Upload") or contains(., "Scan")]');
    this.analysisResults = By.css('.biomarker-table, [data-testid="biomarker-row"]');
    this.disclaimerBanner = By.xpath('//*[contains(text(), "clinical guidance") or contains(text(), "non-diagnostic")]');
  }
}

module.exports = MedicalReportPage;
