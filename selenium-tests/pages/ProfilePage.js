'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class ProfilePage extends BasePage {
  constructor(driver) {
    super(driver, '/profile');
    this.userName = By.css('[data-testid="user-name"], .profile-name');
    this.dietSelect = By.css('select[name="dietType"], [data-testid="diet-selector"]');
    this.saveButton = By.xpath('//button[contains(., "Save")]');
    this.logoutButton = By.xpath('//button[contains(., "Logout") or contains(., "Sign Out")]');
  }
}

module.exports = ProfilePage;
