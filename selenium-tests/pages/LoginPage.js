'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class LoginPage extends BasePage {
  constructor(driver) {
    super(driver, '/signin');
    this.emailInput = By.css('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    this.passwordInput = By.css('input[type="password"], input[name="password"], input[placeholder*="password" i]');
    this.signInButton = By.xpath('//button[contains(., "Sign In") or contains(., "Log In")] | //div[@role="button"][contains(., "Sign In")]');
    this.errorMessage = By.css('.error, [role="alert"], text[style*="red"]');
    this.registerLink = By.xpath('//a[contains(., "Sign Up") or contains(., "Register")] | //div[@role="button"][contains(., "Sign Up")]');
  }

  async login(email, password) {
    await this.type(this.emailInput, email);
    await this.type(this.passwordInput, password);
    await this.click(this.signInButton);
  }

  async hasError() {
    return await this.isDisplayed(this.errorMessage);
  }
}

module.exports = LoginPage;
