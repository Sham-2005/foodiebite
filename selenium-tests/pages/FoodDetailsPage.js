'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class FoodDetailsPage extends BasePage {
  constructor(driver) {
    super(driver, '/food');
    this.foodTitle = By.css('h1, h2, [data-testid="food-title"]');
    this.nutritionTable = By.css('.nutrition-facts, [data-testid="nutrition-table"]');
    this.favoriteButton = By.xpath('//button[contains(., "Favorite") or contains(@aria-label, "favorite")]');
    this.backButton = By.xpath('//button[contains(., "Back")] | //a[contains(@href, "home")]');
  }
}

module.exports = FoodDetailsPage;
