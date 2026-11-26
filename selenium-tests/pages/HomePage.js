'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class HomePage extends BasePage {
  constructor(driver) {
    super(driver, '/');
    this.headerLogo = By.xpath('//img[contains(@src, "logo")] | //*[contains(text(), "FoodieBite")]');
    this.navMenu = By.css('nav, [role="navigation"]');
    this.recommendationCards = By.css('[data-testid="food-card"], .food-card, [role="article"]');
    this.profileTab = By.xpath('//a[contains(@href, "profile")] | //div[contains(text(), "Profile")]');
    this.searchTab = By.xpath('//a[contains(@href, "search")] | //div[contains(text(), "Search")]');
    this.coachTab = By.xpath('//a[contains(@href, "coach")] | //div[contains(text(), "Coach")]');
  }

  async getCardCount() {
    const cards = await this.driver.findElements(this.recommendationCards);
    return cards.length;
  }
}

module.exports = HomePage;
