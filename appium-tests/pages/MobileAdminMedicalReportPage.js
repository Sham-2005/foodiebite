/**
 * Mobile Admin Medical Report & Clinical Intelligence Page Object
 * Handles Appium Mobile automation for Admin User Management -> Medical Reports on Android
 */
const MobileBasePage = require('./MobileBasePage');

class MobileAdminMedicalReportPage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      userManagementTab: '//android.widget.TextView[contains(@text, "Users") or contains(@text, "User Management")]',
      userRow: '//android.view.ViewGroup[@content-desc="user-row"] | //android.widget.TextView[contains(@text, "@")]',
      viewDetailsBtn: '//android.widget.TextView[contains(@text, "View Details") or contains(@text, "Manage User")]',
      medicalSectionHeader: '//android.widget.TextView[contains(@text, "Medical Reports") and contains(@text, "Clinical")]',
      reportCountBadge: '//android.widget.TextView[contains(@text, "Report") and (contains(@text, "1") or contains(@text, "Count"))]',
      reportCard: '//android.view.ViewGroup[@content-desc="medical-report-card"] | //android.view.ViewGroup[descendant::android.widget.TextView[contains(@text, ".pdf")]]',
      generateSummaryBtn: '//android.widget.TextView[contains(@text, "Generate Health Summary") or contains(@text, "Generate Summary")]',
      summaryContainer: '//android.view.ViewGroup[@content-desc="clinical-summary-container"] | //android.widget.TextView[contains(@text, "Clinical Assessment") or contains(@text, "Health Summary")]',
      viewDocumentBtn: '//android.widget.TextView[contains(@text, "View Document") or contains(@text, "View Scanned") or contains(@text, "Open Report")]',
      documentModal: '//android.view.ViewGroup[@content-desc="document-modal"] | //android.widget.ImageView',
      rawTextBtn: '//android.widget.TextView[contains(@text, "Raw OCR Text") or contains(@text, "Extracted Text")]',
      rawTextModal: '//android.view.ViewGroup[@content-desc="raw-text-modal"]',
      statusBadge: '//android.widget.TextView[contains(@text, "analyzed") or contains(@text, "completed") or contains(@text, "Uploaded")]'
    };
  }

  async tapUserManagement() {
    return await this.tap(this.selectors.userManagementTab);
  }

  async selectUser() {
    return await this.tap(this.selectors.viewDetailsBtn);
  }

  async tapGenerateSummary() {
    return await this.tap(this.selectors.generateSummaryBtn);
  }

  async tapViewDocument() {
    return await this.tap(this.selectors.viewDocumentBtn);
  }

  async tapRawTextInspector() {
    return await this.tap(this.selectors.rawTextBtn);
  }
}

module.exports = MobileAdminMedicalReportPage;
