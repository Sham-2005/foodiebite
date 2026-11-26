'use strict';
const BaseScreen = require('../framework/baseScreen');

class FoodDetailsScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'FoodDetailsScreen');
    this.foodTitle = '~food-title';
    this.nutritionSection = '~nutrition-section';
    this.favoriteToggle = '~favorite-toggle-btn';
    this.backBtn = '~back-button';
  }
}

module.exports = FoodDetailsScreen;
