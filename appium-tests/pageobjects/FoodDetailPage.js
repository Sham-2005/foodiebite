/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/FoodDetailPage.js
 *  Page Object for Food Item Details, Macronutrients & Favorites
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class FoodDetailPage extends BasePage {
  constructor() {
    super('FoodDetailScreen');
  }

  get foodTitle() {
    return AppiumHelper.byTestId('text-food-title');
  }

  get calorieCountBadge() {
    return AppiumHelper.byTestId('badge-calorie-count');
  }

  get proteinValue() {
    return AppiumHelper.byTestId('text-protein-value');
  }

  get carbsValue() {
    return AppiumHelper.byTestId('text-carbs-value');
  }

  get fatsValue() {
    return AppiumHelper.byTestId('text-fats-value');
  }

  get allergenWarningBanner() {
    return AppiumHelper.byTestId('banner-allergen-warning');
  }

  get favoriteToggleButton() {
    return AppiumHelper.byTestId('button-toggle-favorite');
  }

  get compareAddButton() {
    return AppiumHelper.byTestId('button-add-to-compare');
  }

  get ingredientsList() {
    return AppiumHelper.byTestId('section-ingredients-list');
  }

  async toggleFavorite() {
    await this.favoriteToggleButton.click();
  }

  async addToCompare() {
    await this.compareAddButton.click();
  }
}

module.exports = new FoodDetailPage();
