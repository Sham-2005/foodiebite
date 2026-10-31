/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/HomePage.js
 *  Page Object for Home Feed & AI Recommendation Carousels
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class HomePage extends BasePage {
  constructor() {
    super('HomeScreen');
  }

  get userGreeting() {
    return AppiumHelper.byTestId('text-user-greeting');
  }

  get weatherAdvisoryBanner() {
    return AppiumHelper.byTestId('card-weather-advisory');
  }

  get recommendationsCarousel() {
    return AppiumHelper.byTestId('carousel-daily-recommendations');
  }

  get firstRecommendationCard() {
    return AppiumHelper.byTestId('card-food-recommendation-0');
  }

  get viewAllRecommendationsLink() {
    return AppiumHelper.byTestId('link-view-all-recommendations');
  }

  get aiCoachFloatingButton() {
    return AppiumHelper.byTestId('button-floating-ai-coach');
  }

  get seasonalFoodsSection() {
    return AppiumHelper.byTestId('section-seasonal-foods');
  }

  get categoryBreakfastChip() {
    return AppiumHelper.byTestId('chip-category-breakfast');
  }

  get notificationIcon() {
    return AppiumHelper.byTestId('icon-notifications');
  }

  async openFirstFoodRecommendation() {
    await this.firstRecommendationCard.click();
    await this.waitForLoadingToDisappear();
  }

  async launchAiCoach() {
    await this.aiCoachFloatingButton.click();
    await this.waitForLoadingToDisappear();
  }

  async openAllRecommendations() {
    await this.viewAllRecommendationsLink.click();
    await this.waitForLoadingToDisappear();
  }
}

module.exports = new HomePage();
