/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/ComparePage.js
 *  Page Object for Side-by-Side Nutrition Comparison
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class ComparePage extends BasePage {
  constructor() {
    super('CompareScreen');
  }

  get foodItemOneSlot() {
    return AppiumHelper.byTestId('slot-compare-item-1');
  }

  get foodItemTwoSlot() {
    return AppiumHelper.byTestId('slot-compare-item-2');
  }

  get caloricDifferenceText() {
    return AppiumHelper.byTestId('text-caloric-differential');
  }

  get recommendedHealthierChoiceBadge() {
    return AppiumHelper.byTestId('badge-healthier-choice');
  }

  get swapItemsButton() {
    return AppiumHelper.byTestId('button-swap-compare-items');
  }

  get clearComparisonButton() {
    return AppiumHelper.byTestId('button-clear-comparison');
  }
}

module.exports = new ComparePage();
