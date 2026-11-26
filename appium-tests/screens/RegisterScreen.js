'use strict';
const BaseScreen = require('../framework/baseScreen');

class RegisterScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'RegisterScreen');
    this.nameField = '~name-input';
    this.emailField = '~email-input';
    this.passwordField = '~password-input';
    this.submitBtn = '~register-button';
  }

  async register(name, email, password) {
    await this.enterText(this.nameField, name);
    await this.enterText(this.emailField, email);
    await this.enterText(this.passwordField, password);
    await this.tap(this.submitBtn);
  }
}

module.exports = RegisterScreen;
