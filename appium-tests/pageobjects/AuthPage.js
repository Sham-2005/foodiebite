/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/AuthPage.js
 *  Page Object for SignIn, SignUp, Onboarding & Profile Completion
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class AuthPage extends BasePage {
  constructor() {
    super('AuthScreen');
  }

  // Locators
  get emailInput() {
    return AppiumHelper.byTestId('input-email');
  }

  get passwordInput() {
    return AppiumHelper.byTestId('input-password');
  }

  get confirmPasswordInput() {
    return AppiumHelper.byTestId('input-confirm-password');
  }

  get fullNameInput() {
    return AppiumHelper.byTestId('input-fullname');
  }

  get signInButton() {
    return AppiumHelper.byTestId('button-signin');
  }

  get signUpButton() {
    return AppiumHelper.byTestId('button-signup');
  }

  get googleSignInButton() {
    return AppiumHelper.byTestId('button-google-signin');
  }

  get forgotPasswordLink() {
    return AppiumHelper.byTestId('link-forgot-password');
  }

  get toggleAuthModeLink() {
    return AppiumHelper.byTestId('link-toggle-auth');
  }

  get onboardingGetStartedButton() {
    return AppiumHelper.byTestId('button-onboarding-start');
  }

  get authErrorMessage() {
    return AppiumHelper.byTestId('text-auth-error');
  }

  // Profile Completion Locators
  get dietTypeVegetarian() {
    return AppiumHelper.byTestId('chip-diet-vegetarian');
  }

  get dietTypeVegan() {
    return AppiumHelper.byTestId('chip-diet-vegan');
  }

  get dietTypeNonVeg() {
    return AppiumHelper.byTestId('chip-diet-non-vegetarian');
  }

  get allergyPeanutCheckbox() {
    return AppiumHelper.byTestId('checkbox-allergy-peanuts');
  }

  get completeProfileSaveButton() {
    return AppiumHelper.byTestId('button-save-profile');
  }

  // Actions
  async login(email, password) {
    await this.emailInput.setValue(email);
    await this.passwordInput.setValue(password);
    await AppiumHelper.hideKeyboard();
    await this.signInButton.click();
    await this.waitForLoadingToDisappear();
  }

  async register(name, email, password, confirmPassword) {
    await this.fullNameInput.setValue(name);
    await this.emailInput.setValue(email);
    await this.passwordInput.setValue(password);
    await this.confirmPasswordInput.setValue(confirmPassword);
    await AppiumHelper.hideKeyboard();
    await this.signUpButton.click();
    await this.waitForLoadingToDisappear();
  }

  async selectDietaryPreferences(diet = 'vegetarian', allergy = 'peanuts') {
    if (diet === 'vegetarian') await this.dietTypeVegetarian.click();
    else if (diet === 'vegan') await this.dietTypeVegan.click();
    else await this.dietTypeNonVeg.click();

    if (allergy) {
      await this.allergyPeanutCheckbox.click();
    }
    await this.completeProfileSaveButton.click();
    await this.waitForLoadingToDisappear();
  }
}

module.exports = new AuthPage();
