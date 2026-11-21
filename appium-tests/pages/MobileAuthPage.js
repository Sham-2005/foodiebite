/**
 * Mobile Authentication Page Object (Android React Native)
 */
const MobileBasePage = require('./MobileBasePage');

class MobileAuthPage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      emailInput: 'android=new UiSelector().className("android.widget.EditText").instance(0)',
      passwordInput: 'android=new UiSelector().className("android.widget.EditText").instance(1)',
      signInBtn: 'android=new UiSelector().text("Sign In")',
      signUpLink: 'android=new UiSelector().textContains("Sign Up")',
      fullNameInput: 'android=new UiSelector().textContains("Full Name")',
      confirmPasswordInput: 'android=new UiSelector().textContains("Confirm Password")',
      ageInput: 'android=new UiSelector().textContains("Age")',
      createAccountBtn: 'android=new UiSelector().text("Create Account")',
      adminPortalLink: 'android=new UiSelector().textContains("Administrator Access Portal")',
      googleSignInBtn: 'android=new UiSelector().textContains("Continue with Google")'
    };
  }

  async signIn(email, password) {
    return await this.resilientExecute(async () => {
      await this.type(this.selectors.emailInput, email);
      await this.type(this.selectors.passwordInput, password);
      await this.tap(this.selectors.signInBtn);
    }, `Sign In as ${email}`);
  }

  async registerUser(name, email, password) {
    return await this.resilientExecute(async () => {
      await this.tap(this.selectors.signUpLink);
      await this.type(this.selectors.fullNameInput, name);
      await this.type(this.selectors.emailInput, email);
      await this.type(this.selectors.passwordInput, password);
      await this.tap(this.selectors.createAccountBtn);
    }, `Register User ${name}`);
  }
}

module.exports = MobileAuthPage;
