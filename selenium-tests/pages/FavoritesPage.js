'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class FavoritesPage extends BasePage {
  constructor(driver) {
    super(driver, '/favorites');
    this.favoriteItems = By.css('.favorite-item, [data-testid="favorite-card"]');
    this.emptyState = By.xpath('//*[contains(text(), "No favorites saved") or contains(text(), "favorite foods yet")]');
  }
}

module.exports = FavoritesPage;
