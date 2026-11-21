/**
 * Mobile Profile & Preferences Page Object
 */
const MobileBasePage = require('./MobileBasePage');

class MobileProfilePage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      profileHeader: 'android=new UiSelector().textContains("Profile")',
      userEmailLabel: 'android=new UiSelector().textContains("@")',
      dietaryPrefsRow: 'android=new UiSelector().textContains("Dietary & Health Preferences")',
      emailScheduleRow: 'android=new UiSelector().textContains("Automated Email & Notification Schedule")',
      medicalReportsRow: 'android=new UiSelector().textContains("Medical Reports")',
      signOutBtn: 'android=new UiSelector().text("Sign Out")',
      deleteAccountBtn: 'android=new UiSelector().text("Delete Account")'
    };
  }

  async openEmailSchedule() {
    return await this.resilientExecute(async () => {
      await this.tap(this.selectors.emailScheduleRow);
    }, 'Open email notification schedule settings');
  }

  async signOut() {
    return await this.resilientExecute(async () => {
      await this.tap(this.selectors.signOutBtn);
    }, 'Trigger Mobile Sign Out');
  }
}

module.exports = MobileProfilePage;
