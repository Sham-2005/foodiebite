'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class SettingsPage extends BasePage {
  constructor(driver) {
    super(driver, '/settings');
    this.themeToggle = By.css('[data-testid="theme-toggle"]');
    this.deleteAccountButton = By.xpath('//button[contains(., "Delete Account")]');
  }
}

module.exports = SettingsPage;
