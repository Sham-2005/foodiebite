/**
 * Admin Medical Report & Clinical Intelligence Page Object
 * Handles Selenium automation for Admin User Management -> Medical Reports section
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class AdminMedicalReportPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      userManagementTab: By.xpath("//*[contains(text(), 'Users') or contains(text(), 'User Management')]"),
      userRow: By.css("[data-testid='user-row'], .user-table-row, tr"),
      userSelectButton: By.xpath("//*[contains(text(), 'View Details') or contains(text(), 'Manage User') or contains(text(), 'Select')]"),
      medicalSectionHeader: By.xpath("//*[contains(text(), 'Medical Reports') and contains(text(), 'Clinical')]"),
      reportCountBadge: By.xpath("//*[contains(text(), 'Report') and (contains(text(), '1') or contains(text(), 'Count'))]"),
      reportCard: By.css("[data-testid='medical-report-card'], .medical-report-item, .report-card"),
      generateSummaryBtn: By.xpath("//button[contains(., 'Generate') and contains(., 'Summary')] | //div[@role='button'][contains(., 'Generate Health Summary')]"),
      summaryContainer: By.css("[data-testid='clinical-summary-container'], .clinical-summary-box, .ai-summary"),
      viewDocumentBtn: By.xpath("//*[contains(text(), 'View Document') or contains(text(), 'View Scanned') or contains(text(), 'Open Report')]"),
      documentModal: By.css("[data-testid='document-modal'], .modal-content, [role='dialog']"),
      rawTextBtn: By.xpath("//*[contains(text(), 'Raw OCR Text') or contains(text(), 'Extracted Text')]"),
      rawTextModal: By.css("[data-testid='raw-text-modal'], .raw-text-container"),
      statusBadge: By.xpath("//*[contains(text(), 'analyzed') or contains(text(), 'completed') or contains(text(), 'Uploaded')]")
    };
  }

  async navigateToUserMedicalReports(userId) {
    await this.navigateTo(`/admin/users/${userId}/medical-reports`);
    await this.sleep(1500);
  }

  async clickGenerateSummary() {
    if (await this.isElementPresent(this.locators.generateSummaryBtn, 4000)) {
      await this.safeClick(this.locators.generateSummaryBtn);
      await this.sleep(3000); // Wait for Ollama AI local summary generation
      return true;
    }
    return false;
  }

  async openDocumentViewer() {
    if (await this.isElementPresent(this.locators.viewDocumentBtn, 3000)) {
      await this.safeClick(this.locators.viewDocumentBtn);
      await this.sleep(1200);
      return true;
    }
    return false;
  }

  async openRawTextInspector() {
    if (await this.isElementPresent(this.locators.rawTextBtn, 3000)) {
      await this.safeClick(this.locators.rawTextBtn);
      await this.sleep(1000);
      return true;
    }
    return false;
  }
}

module.exports = AdminMedicalReportPage;
