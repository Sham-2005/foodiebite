/**
 * Authentication Page Object (Sign In & Sign Up)
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class AuthPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      // Sign In
      signInTitle: By.xpath("//*[contains(text(), 'Sign In') or contains(text(), 'Welcome Back')]"),
      emailInput: By.css("input[placeholder*='Email'], input[type='email']"),
      passwordInput: By.css("input[placeholder*='Password'][type='password'], input[placeholder*='Password']"),
      signInButton: By.xpath("//div[@role='button'][contains(., 'Sign In')] | //button[contains(., 'Sign In')]"),
      signUpLink: By.xpath("//*[contains(text(), 'Sign Up')]"),
      errorMessage: By.xpath("//*[contains(@style, 'color: rgb(255, 77, 109)') or contains(@style, 'color: #ff4d6d') or contains(text(), 'Invalid login') or contains(text(), 'credentials')]"),

      // Sign Up
      signUpTitle: By.xpath("//*[contains(text(), 'Create Account')]"),
      fullNameInput: By.css("input[placeholder*='Full Name'], input[placeholder*='Name']"),
      confirmPasswordInput: By.css("input[placeholder*='Confirm Password']"),
      ageInput: By.css("input[placeholder*='Age']"),
      signUpButton: By.xpath("//div[@role='button'][contains(., 'Create Account')] | //button[contains(., 'Create Account')]"),
      signInLink: By.xpath("//*[contains(text(), 'Already have an account?')]"),

      // Admin access link on login screen
      adminPortalLink: By.xpath("//*[contains(text(), 'Administrator Access Portal')]")
    };
  }

  async signIn(email, password) {
    if (await this.isElementPresent(this.locators.emailInput, 4000)) {
      await this.safeType(this.locators.emailInput, email);
    }
    if (await this.isElementPresent(this.locators.passwordInput, 3000)) {
      await this.safeType(this.locators.passwordInput, password);
    }
    const btnLocators = [
      this.locators.signInButton,
      By.xpath("//div[@role='button'][contains(., 'Sign In') or contains(., 'Log In')]"),
      By.xpath("//button[contains(., 'Sign In') or contains(., 'Log In')]"),
      By.xpath("//*[contains(@style, 'background-color') and (contains(., 'Sign In') or contains(., 'Log In'))]")
    ];
    for (const loc of btnLocators) {
      if (await this.isElementPresent(loc, 1500)) {
        try {
          await this.safeClick(loc, 2000);
          break;
        } catch (e) {}
      }
    }
    await this.sleep(1200);
  }

  async register(name, email, password, age = '25') {
    if (await this.isElementPresent(this.locators.fullNameInput, 3000)) {
      await this.safeType(this.locators.fullNameInput, name);
    }
    await this.safeType(this.locators.emailInput, email);
    await this.safeType(this.locators.passwordInput, password);
    if (await this.isElementPresent(this.locators.confirmPasswordInput, 2000)) {
      await this.safeType(this.locators.confirmPasswordInput, password);
    }
    if (await this.isElementPresent(this.locators.ageInput, 2000)) {
      await this.safeType(this.locators.ageInput, age);
    }
    await this.safeClick(this.locators.signUpButton);
    await this.sleep(2000);
  }

  async navigateToSignUp() {
    await this.safeClick(this.locators.signUpLink);
    await this.sleep(800);
  }

  async navigateToSignIn() {
    await this.safeClick(this.locators.signInLink);
    await this.sleep(800);
  }

  async isAuthErrorDisplayed() {
    return await this.isElementPresent(this.locators.errorMessage, 4000);
  }
}

module.exports = AuthPage;
