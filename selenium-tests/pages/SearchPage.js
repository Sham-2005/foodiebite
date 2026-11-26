'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class SearchPage extends BasePage {
  constructor(driver) {
    super(driver, '/search');
    this.searchInput = By.css('input[placeholder*="search" i], input[type="search"]');
    this.searchButton = By.xpath('//button[contains(., "Search")]');
    this.resultItems = By.css('.search-result-item, [data-testid="search-result"]');
    this.noResultsBanner = By.xpath('//*[contains(text(), "No foods found") or contains(text(), "No results")]');
  }

  async search(query) {
    await this.type(this.searchInput, query);
    try { await this.click(this.searchButton, 2000); } catch (_) {}
  }

  async hasResults() {
    const items = await this.driver.findElements(this.resultItems);
    return items.length > 0;
  }
}

module.exports = SearchPage;
