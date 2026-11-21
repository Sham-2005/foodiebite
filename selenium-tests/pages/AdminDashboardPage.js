/**
 * Admin Dashboard & Management Portal Page Object
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class AdminDashboardPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      adminHeader: By.xpath("//*[contains(text(), 'Admin Portal') or contains(text(), 'Administration') or contains(text(), 'Dashboard')]"),
      tabOverview: By.xpath("//*[contains(text(), 'Overview') or contains(text(), 'Metrics')]"),
      tabUsers: By.xpath("//*[contains(text(), 'Users') or contains(text(), 'User Management')]"),
      tabEmails: By.xpath("//*[contains(text(), 'Email Campaign') or contains(text(), 'Emails')]"),
      tabAudit: By.xpath("//*[contains(text(), 'Audit Logs') or contains(text(), 'Logs')]"),
      statTotalUsers: By.xpath("//*[contains(text(), 'Total Users') or contains(text(), 'Active Accounts')]"),
      userSearchInput: By.css("input[placeholder*='Search user'], input[placeholder*='Search']"),
      adminLogoutBtn: By.xpath("//*[contains(text(), 'Logout') or contains(text(), 'Exit Admin')]")
    };
  }

  async switchTab(tabName) {
    const tabLocator = By.xpath(`//*[contains(text(), '${tabName}')]`);
    await this.safeClick(tabLocator);
    await this.sleep(1200);
  }

  async searchUser(query) {
    if (await this.isElementPresent(this.locators.userSearchInput, 3000)) {
      await this.safeType(this.locators.userSearchInput, query);
      await this.sleep(1000);
    }
  }
}

module.exports = AdminDashboardPage;
