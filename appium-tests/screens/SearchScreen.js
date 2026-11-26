'use strict';
const BaseScreen = require('../framework/baseScreen');

class SearchScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'SearchScreen');
    this.searchBar = '~search-input';
    this.searchResultItem = '~search-result-item';
    this.emptyResults = '~empty-search-state';
  }

  async search(query) {
    await this.enterText(this.searchBar, query);
  }
}

module.exports = SearchScreen;
