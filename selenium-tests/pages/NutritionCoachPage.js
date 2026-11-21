/**
 * AI Nutrition Coach Page Object
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class NutritionCoachPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      headerTitle: By.xpath("//*[contains(text(), 'FoodieBite AI') or contains(text(), 'AI Nutrition Coach')]"),
      chatInput: By.css("input[placeholder*='Ask about diet'], input[placeholder*='nutrition']"),
      sendButton: By.xpath("//div[@role='button'][descendant::*[name()='svg']] | //button[contains(., 'Send')]"),
      quickPrompt: By.xpath("//*[contains(text(), 'Suggest a high-protein') or contains(text(), 'Palak Paneer')]"),
      botMessageBubble: By.xpath("//*[contains(@style, 'border-radius') and contains(., 'FoodieBite')]"),
      typingIndicator: By.css("[style*='opacity']")
    };
  }

  async askCoach(question) {
    await this.safeType(this.locators.chatInput, question);
    await this.safeClick(this.locators.sendButton);
    await this.sleep(2000); // Wait for AI response
  }

  async clickQuickPrompt() {
    await this.safeClick(this.locators.quickPrompt);
    await this.sleep(2500);
  }

  async isResponseReceived() {
    return await this.isElementPresent(By.xpath("//*[contains(text(), 'protein') or contains(text(), 'calorie') or contains(text(), 'diet') or contains(text(), 'FoodieBite')]"), 6000);
  }
}

module.exports = NutritionCoachPage;
