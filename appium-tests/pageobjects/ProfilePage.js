/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/ProfilePage.js
 *  Page Object for User Profile, Preferences & Settings
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class ProfilePage extends BasePage {
  constructor() {
    super('ProfileScreen');
  }

  get userProfileName() {
    return AppiumHelper.byTestId('text-profile-user-name');
  }

  get userProfileEmail() {
    return AppiumHelper.byTestId('text-profile-user-email');
  }

  get editPersonalInformationLink() {
    return AppiumHelper.byTestId('link-edit-personal-info');
  }

  get dietaryPreferencesLink() {
    return AppiumHelper.byTestId('link-dietary-preferences');
  }

  get medicalReportsLink() {
    return AppiumHelper.byTestId('link-medical-reports');
  }

  get feedbackLink() {
    return AppiumHelper.byTestId('link-feedback-support');
  }

  get privacyPolicyLink() {
    return AppiumHelper.byTestId('link-privacy-policy');
  }

  get logoutButton() {
    return AppiumHelper.byTestId('button-user-logout');
  }

  get confirmLogoutButton() {
    return AppiumHelper.byTestId('button-confirm-logout-modal');
  }

  async logout() {
    await this.logoutButton.click();
    await this.confirmLogoutButton.click();
    await this.waitForLoadingToDisappear();
  }
}

module.exports = new ProfilePage();
