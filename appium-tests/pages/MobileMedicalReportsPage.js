/**
 * Mobile Medical Reports & OCR Storage Page Object
 */
const MobileBasePage = require('./MobileBasePage');

class MobileMedicalReportsPage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      headerTitle: 'android=new UiSelector().textContains("Medical Reports")',
      supabaseStatus: 'android=new UiSelector().textContains("Connected")',
      selectPdfBtn: 'android=new UiSelector().textContains("Select PDF")',
      scanOcrBtn: 'android=new UiSelector().textContains("Scan Medical Report (OCR)")',
      savedReportsTitle: 'android=new UiSelector().textContains("Saved Medical Reports")',
      reportsCounter: 'android=new UiSelector().textContains("0")'
    };
  }

  async triggerUploadModal() {
    return await this.resilientExecute(async () => {
      await this.tap(this.selectors.selectPdfBtn);
    }, 'Trigger PDF selection modal');
  }

  async triggerOCRScan() {
    return await this.resilientExecute(async () => {
      await this.tap(this.selectors.scanOcrBtn);
    }, 'Trigger OCR scan process');
  }
}

module.exports = MobileMedicalReportsPage;
