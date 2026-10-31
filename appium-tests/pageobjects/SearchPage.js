/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/SearchPage.js
 *  Page Object for Food Catalog Search, Allergens & Filtering
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class SearchPage extends BasePage {
  constructor() {
    super('SearchScreen');
  }

  get searchInput() {
    return AppiumHelper.byTestId('input-search-query');
  }

  get clearSearchButton() {
    return AppiumHelper.byTestId('button-clear-search');
  }

  get barcodeScanButton() {
    return AppiumHelper.byTestId('button-scan-barcode');
  }

  get filterModalButton() {
    return AppiumHelper.byTestId('button-open-filters');
  }

  get searchResultsList() {
    return AppiumHelper.byTestId('list-search-results');
  }

  get noResultsEmptyState() {
    return AppiumHelper.byTestId('state-no-results-found');
  }

  get firstSearchResultItem() {
    return AppiumHelper.byTestId('item-search-result-0');
  }

  get allergenGlutenFreeToggle() {
    return AppiumHelper.byTestId('toggle-allergen-gluten-free');
  }

  get applyFilterButton() {
    return AppiumHelper.byTestId('button-apply-filters');
  }

  async searchFood(query) {
    await this.searchInput.setValue(query);
    await AppiumHelper.hideKeyboard();
    await this.waitForLoadingToDisappear();
  }

  async selectFirstResult() {
    await this.firstSearchResultItem.click();
    await this.waitForLoadingToDisappear();
  }
}

module.exports = new SearchPage();
