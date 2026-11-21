/**
 * Mobile Splash & Onboarding Page Object (UiAutomator2 Selectors)
 */
const MobileBasePage = require('./MobileBasePage');

class MobileSplashOnboardingPage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      splashLogo: '//*[@content-desc="FoodieBite Logo" or contains(@text, "FoodieBite")]',
      splashTitle: 'android=new UiSelector().textContains("FoodieBite")',
      splashSubtitle: 'android=new UiSelector().textContains("Smart Food Recommendations")',
      onboardingSkipBtn: 'android=new UiSelector().text("Skip")',
      onboardingNextBtn: 'android=new UiSelector().text("Next")',
      onboardingGetStartedBtn: 'android=new UiSelector().text("Get Started")',
      slideHeadline: 'android=new UiSelector().textContains("Personalized Food")'
    };
  }

  async skipOnboarding() {
    return await this.resilientExecute(async () => {
      await this.tap(this.selectors.onboardingSkipBtn);
    }, 'Skip onboarding walkthrough');
  }

  async clickNext() {
    return await this.resilientExecute(async () => {
      await this.tap(this.selectors.onboardingNextBtn);
    }, 'Advance to next onboarding slide');
  }
}

module.exports = MobileSplashOnboardingPage;
