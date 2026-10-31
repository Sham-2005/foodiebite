/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/BasePage.js
 *  Base Page Object for FoodieBite Mobile & Hybrid Screens
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const AppiumHelper = require('../helpers/appiumHelper');

class BasePage {
  constructor(screenName) {
    this.screenName = screenName;
  }

  get headerTitle() {
    return AppiumHelper.byTestId('screen-header-title');
  }

  get backButton() {
    return AppiumHelper.byTestId('header-back-button');
  }

  get bottomNavHome() {
    return AppiumHelper.byTestId('nav-tab-home');
  }

  get bottomNavSearch() {
    return AppiumHelper.byTestId('nav-tab-search');
  }

  get bottomNavScanner() {
    return AppiumHelper.byTestId('nav-tab-scanner');
  }

  get bottomNavFavorites() {
    return AppiumHelper.byTestId('nav-tab-favorites');
  }

  get bottomNavProfile() {
    return AppiumHelper.byTestId('nav-tab-profile');
  }

  get loadingIndicator() {
    return AppiumHelper.byTestId('loading-spinner');
  }

  get errorBanner() {
    return AppiumHelper.byTestId('error-banner-message');
  }

  async waitForLoadingToDisappear(timeout = 10000) {
    const spinner = this.loadingIndicator;
    try {
      if (await spinner.isDisplayed()) {
        await spinner.waitForDisplayed({ timeout, reverse: true });
      }
    } catch (_) {}
  }

  async clickBack() {
    await this.backButton.click();
  }

  async navigateToTab(tabName) {
    const tabs = {
      home: this.bottomNavHome,
      search: this.bottomNavSearch,
      scanner: this.bottomNavScanner,
      favorites: this.bottomNavFavorites,
      profile: this.bottomNavProfile
    };
    if (tabs[tabName]) {
      await tabs[tabName].click();
      await this.waitForLoadingToDisappear();
    }
  }
}

module.exports = BasePage;
