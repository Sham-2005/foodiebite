'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class NotificationPage extends BasePage {
  constructor(driver) {
    super(driver, '/notifications');
    this.emailPreferenceToggle = By.css('input[type="checkbox"][name="dailyEmail"]');
    this.campaignList = By.css('.campaign-history-row');
  }
}

module.exports = NotificationPage;
