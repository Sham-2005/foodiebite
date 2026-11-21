/**
 * Mobile Admin Portal & Management Page Object
 */
const MobileBasePage = require('./MobileBasePage');

class MobileAdminPortalPage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      adminHeader: 'android=new UiSelector().textContains("Admin Portal")',
      tabOverview: 'android=new UiSelector().text("Overview")',
      tabUsers: 'android=new UiSelector().text("Users")',
      tabEmails: 'android=new UiSelector().textContains("Email")',
      userSearchInput: 'android=new UiSelector().className("android.widget.EditText")',
      statUsersCount: 'android=new UiSelector().textContains("Total Users")'
    };
  }

  async switchTab(name) {
    return await this.resilientExecute(async () => {
      const s = `android=new UiSelector().text("${name}")`;
      await this.tap(s);
    }, `Switch admin tab to ${name}`);
  }
}

module.exports = MobileAdminPortalPage;
