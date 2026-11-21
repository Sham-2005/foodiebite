/**
 * Medical Reports & OCR Page Object
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class MedicalReportsPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      headerTitle: By.xpath("//*[contains(text(), 'Medical Reports') or contains(text(), 'Health Intelligence')]"),
      uploadButton: By.xpath("//*[contains(text(), 'Upload') or contains(text(), 'Select PDF') or contains(text(), 'Scan Medical Report')]"),
      savedReportsHeader: By.xpath("//*[contains(text(), 'Saved Medical Reports') or contains(text(), 'Reports')]"),
      supabaseStatus: By.xpath("//*[contains(text(), 'Connected') or contains(text(), 'Supabase')]"),
      ocrScanButton: By.xpath("//*[contains(text(), 'Scan Medical Report') or contains(text(), 'OCR')]"),
      healthMetricsCard: By.xpath("//*[contains(text(), 'Deficiencies') or contains(text(), 'Cholesterol') or contains(text(), 'Glucose')]")
    };
  }

  async clickUploadTrigger() {
    if (await this.isElementPresent(this.locators.uploadButton, 3000)) {
      await this.safeClick(this.locators.uploadButton);
      await this.sleep(1000);
      return true;
    }
    return false;
  }

  async hasSupabaseConnectionBadge() {
    return await this.isElementPresent(this.locators.supabaseStatus, 4000);
  }
}

module.exports = MedicalReportsPage;
