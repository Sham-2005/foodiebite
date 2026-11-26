'use strict';
const BaseScreen = require('../framework/baseScreen');

class FavoritesScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'FavoritesScreen');
    this.favoriteCard = '~favorite-food-item';
    this.emptyState = '~empty-favorites-view';
  }
}

module.exports = FavoritesScreen;
