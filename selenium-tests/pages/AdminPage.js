'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class AdminPage extends BasePage {
  constructor(driver) {
    super(driver, '/admin');
    this.userManagementTab = By.xpath('//*[contains(text(), "Users") or contains(text(), "User Management")]');
    this.foodDatabaseTab = By.xpath('//*[contains(text(), "Food Database") or contains(text(), "Catalog")]');
    this.medicalReportsTab = By.xpath('//*[contains(text(), "Medical Reports") or contains(text(), "Clinical Intelligence")]');
    this.statsCards = By.css('.stat-card, [data-testid="stat-metric"]');
  }
}

module.exports = AdminPage;
