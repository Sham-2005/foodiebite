'use strict';
const BaseScreen = require('../framework/baseScreen');

class LoginScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'LoginScreen');
    this.emailField = '~email-input';
    this.passwordField = '~password-input';
    this.signInBtn = '~signin-button';
    this.signUpLink = '~signup-link';
    this.errorMsg = '~auth-error-message';
  }

  async login(email, password) {
    await this.enterText(this.emailField, email);
    await this.enterText(this.passwordField, password);
    await this.tap(this.signInBtn);
  }
}

module.exports = LoginScreen;
