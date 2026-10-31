/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/AIPage.js
 *  Page Object for FoodieBite AI Health Coach Screen
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class AIPage extends BasePage {
  constructor() {
    super('AIScreen');
  }

  get chatMessageInput() {
    return AppiumHelper.byTestId('input-ai-chat-prompt');
  }

  get sendMessageButton() {
    return AppiumHelper.byTestId('button-send-ai-message');
  }

  get chatMessagesList() {
    return AppiumHelper.byTestId('list-ai-chat-messages');
  }

  get latestAssistantResponse() {
    return AppiumHelper.byTestId('message-assistant-latest');
  }

  get quickPromptWeightLoss() {
    return AppiumHelper.byTestId('pill-quick-prompt-weight-loss');
  }

  get quickPromptLowSodium() {
    return AppiumHelper.byTestId('pill-quick-prompt-low-sodium');
  }

  get suggestedMealCard() {
    return AppiumHelper.byTestId('card-ai-suggested-meal');
  }

  async askCoach(query) {
    await this.chatMessageInput.setValue(query);
    await AppiumHelper.hideKeyboard();
    await this.sendMessageButton.click();
    await this.latestAssistantResponse.waitForDisplayed({ timeout: 15000 });
  }
}

module.exports = new AIPage();
