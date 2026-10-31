/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/FavoritesPage.js
 *  Page Object for Saved Foods & Favorites Management
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class FavoritesPage extends BasePage {
  constructor() {
    super('FavoritesScreen');
  }

  get favoritesList() {
    return AppiumHelper.byTestId('list-favorite-foods');
  }

  get emptyFavoritesState() {
    return AppiumHelper.byTestId('state-empty-favorites');
  }

  get removeFavoriteButton() {
    return AppiumHelper.byTestId('button-remove-favorite-0');
  }

  get filterFavoritesCategoryChip() {
    return AppiumHelper.byTestId('chip-favorites-category');
  }
}

module.exports = new FavoritesPage();
