'use strict';
const { By } = require('selenium-webdriver');
const BasePage = require('../framework/basePage');

class RegisterPage extends BasePage {
  constructor(driver) {
    super(driver, '/signup');
    this.nameInput = By.css('input[name="name"], input[placeholder*="name" i]');
    this.emailInput = By.css('input[type="email"], input[name="email"]');
    this.passwordInput = By.css('input[type="password"], input[name="password"]');
    this.signUpButton = By.xpath('//button[contains(., "Sign Up") or contains(., "Create")] | //div[@role="button"][contains(., "Sign Up")]');
  }

  async register(name, email, password) {
    await this.type(this.nameInput, name);
    await this.type(this.emailInput, email);
    await this.type(this.passwordInput, password);
    await this.click(this.signUpButton);
  }
}

module.exports = RegisterPage;
