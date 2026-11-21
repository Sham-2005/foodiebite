/**
 * User Profile & Settings Page Object
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class ProfilePage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      profileHeader: By.xpath("//*[contains(text(), 'Profile') or contains(text(), 'Account')]"),
      userEmailText: By.xpath("//*[contains(text(), '@')]"),
      dietaryPreferencesRow: By.xpath("//*[contains(text(), 'Preferences') or contains(text(), 'Dietary')]"),
      emailScheduleRow: By.xpath("//*[contains(text(), 'Automated Email') or contains(text(), 'Notifications')]"),
      medicalReportsRow: By.xpath("//*[contains(text(), 'Medical Reports')]"),
      signOutButton: By.xpath("//*[contains(text(), 'Sign Out') or contains(text(), 'Log Out')]"),
      deleteAccountButton: By.xpath("//*[contains(text(), 'Delete Account')]"),
      confirmModal: By.xpath("//*[contains(text(), 'Are you sure') or contains(text(), 'Confirm')]")
    };
  }

  async openDietaryPreferences() {
    await this.safeClick(this.locators.dietaryPreferencesRow);
    await this.sleep(1000);
  }

  async openEmailSchedule() {
    await this.safeClick(this.locators.emailScheduleRow);
    await this.sleep(1000);
  }

  async signOut() {
    await this.safeClick(this.locators.signOutButton);
    await this.sleep(1500);
  }
}

module.exports = ProfilePage;
