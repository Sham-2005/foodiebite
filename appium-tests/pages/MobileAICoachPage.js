/**
 * Mobile AI Nutrition Coach Page Object
 */
const MobileBasePage = require('./MobileBasePage');

class MobileAICoachPage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      coachTitle: 'android=new UiSelector().textContains("FoodieBite AI")',
      chatInput: 'android=new UiSelector().className("android.widget.EditText")',
      sendButton: '//*[@content-desc="Send Message" or contains(@text, "Send")]',
      quickPromptBreakfast: 'android=new UiSelector().textContains("high-protein Indian breakfast")',
      botMessageBubble: 'android=new UiSelector().textContains("FoodieBite")',
      clearChatBtn: '//*[@content-desc="Clear Conversation" or contains(@text, "Clear")]'
    };
  }

  async askNutritionQuestion(question) {
    return await this.resilientExecute(async () => {
      await this.type(this.selectors.chatInput, question);
      await this.tap(this.selectors.sendButton);
    }, `Ask question: ${question}`);
  }

  async tapQuickPrompt() {
    return await this.resilientExecute(async () => {
      await this.tap(this.selectors.quickPromptBreakfast);
    }, 'Tap quick prompt breakfast');
  }
}

module.exports = MobileAICoachPage;
