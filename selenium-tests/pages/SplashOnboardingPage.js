/**
 * Splash and Onboarding Page Object
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class SplashOnboardingPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      splashTitle: By.xpath("//*[contains(text(), 'FoodieBite')]"),
      splashSubtitle: By.xpath("//*[contains(text(), 'Smart Food Recommendations')]"),
      onboardingSkip: By.xpath("//*[contains(text(), 'Skip')]"),
      onboardingNext: By.xpath("//*[contains(text(), 'Next')]"),
      onboardingGetStarted: By.xpath("//*[contains(text(), 'Get Started')]"),
      onboardingHeadline: By.xpath("//*[contains(text(), 'Personalized Food') or contains(text(), 'Smart Weather') or contains(text(), 'Fuel Your')]")
    };
  }

  async waitForSplashOrOnboarding() {
    await this.sleep(1000);
    const hasSplash = await this.isElementPresent(this.locators.splashTitle, 3000);
    return hasSplash;
  }

  async skipOnboarding() {
    if (await this.isElementPresent(this.locators.onboardingSkip, 4000)) {
      await this.safeClick(this.locators.onboardingSkip);
      await this.sleep(1000);
      return true;
    }
    return false;
  }

  async clickNextSlide() {
    if (await this.isElementPresent(this.locators.onboardingNext, 3000)) {
      await this.safeClick(this.locators.onboardingNext);
      await this.sleep(500);
      return true;
    }
    return false;
  }
}

module.exports = SplashOnboardingPage;
