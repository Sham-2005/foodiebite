/**
 * Page Objects for FoodieBite Mobile Automation
 */
const BasePage = require('./BasePage');

class SplashOnboardingPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      splashLogo: '//*[@content-desc="FoodieBite Logo" or contains(@text, "FoodieBite")]',
      splashTitle: 'android=new UiSelector().textContains("FoodieBite")',
      onboardingSkip: 'android=new UiSelector().text("Skip")',
      onboardingNext: 'android=new UiSelector().text("Next")',
      onboardingGetStarted: 'android=new UiSelector().text("Get Started")'
    };
  }
  async skip() { await this.tap(this.selectors.onboardingSkip, 'Onboarding Skip Button'); }
}

class AuthPage extends BasePage {
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
      errorMsg: 'android=new UiSelector().textContains("Invalid")'
    };
  }
  async login(email, pass) {
    await this.type(this.selectors.emailInput, email, 'Email');
    await this.type(this.selectors.passwordInput, pass, 'Password');
    await this.tap(this.selectors.signInBtn, 'Sign In Button');
  }
  async register(name, email, pass, age) {
    await this.tap(this.selectors.signUpLink, 'Sign Up Link');
    await this.type(this.selectors.fullNameInput, name, 'Full Name');
    await this.type(this.selectors.emailInput, email, 'Email');
    await this.type(this.selectors.passwordInput, pass, 'Password');
    await this.type(this.selectors.confirmPasswordInput, pass, 'Confirm Password');
    await this.type(this.selectors.ageInput, age, 'Age');
    await this.tap(this.selectors.createAccountBtn, 'Create Account Button');
  }
}

class DashboardPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      weatherCard: 'android=new UiSelector().textContains("°C")',
      feedTitle: 'android=new UiSelector().textContains("Recommendations")',
      catHealthy: 'android=new UiSelector().text("Healthy")',
      catProtein: 'android=new UiSelector().text("Protein")',
      catVegan: 'android=new UiSelector().text("Vegan")',
      navHome: '~Navigate to Home',
      navSearch: '~Navigate to Search',
      navAI: '~Navigate to AI Coach',
      navFavorites: '~Navigate to Favorites',
      navProfile: '~Navigate to Profile'
    };
  }
  async filterCategory(cat) { await this.tap(`android=new UiSelector().text("${cat}")`, `Category ${cat}`); }
  async gotoTab(tab) { await this.tap(this.selectors[`nav${tab}`] || this.selectors.navHome, `Tab ${tab}`); }
}

class FoodSearchPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      searchInput: 'android=new UiSelector().className("android.widget.EditText")',
      barcodeBtn: '//*[@content-desc="Scan Barcode" or contains(@text, "Scan")]',
      chipChicken: 'android=new UiSelector().text("Chicken")',
      chipSalad: 'android=new UiSelector().text("Salad")',
      filterHighProtein: 'android=new UiSelector().text("High Protein")'
    };
  }
  async search(query) { await this.type(this.selectors.searchInput, query, 'Search Input'); }
  async clickChip(chip) { await this.tap(`android=new UiSelector().text("${chip}")`, `Chip ${chip}`); }
}

class AICoachPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      input: 'android=new UiSelector().className("android.widget.EditText")',
      sendBtn: '//*[@content-desc="Send Message" or contains(@text, "Send")]',
      promptBreakfast: 'android=new UiSelector().textContains("high-protein Indian breakfast")'
    };
  }
  async ask(q) {
    await this.type(this.selectors.input, q, 'AI Question');
    await this.tap(this.selectors.sendBtn, 'Send Button');
  }
  async clickPrompt() { await this.tap(this.selectors.promptBreakfast, 'Quick Prompt'); }
}

class MedicalReportsPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      statusBadge: 'android=new UiSelector().textContains("Connected")',
      selectPdfBtn: 'android=new UiSelector().textContains("Select PDF")',
      scanOcrBtn: 'android=new UiSelector().textContains("Scan Medical Report (OCR)")',
      reportsCount: 'android=new UiSelector().textContains("Saved Medical Reports")'
    };
  }
  async triggerUpload() { await this.tap(this.selectors.selectPdfBtn, 'Select PDF'); }
  async triggerOCR() { await this.tap(this.selectors.scanOcrBtn, 'Scan OCR'); }
}

class ProfilePage extends BasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      preferencesRow: 'android=new UiSelector().textContains("Dietary & Health Preferences")',
      emailScheduleRow: 'android=new UiSelector().textContains("Automated Email & Notification Schedule")',
      signOutBtn: 'android=new UiSelector().text("Sign Out")'
    };
  }
  async openEmailSchedule() { await this.tap(this.selectors.emailScheduleRow, 'Email Schedule'); }
  async signOut() { await this.tap(this.selectors.signOutBtn, 'Sign Out'); }
}

class AdminPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      header: 'android=new UiSelector().textContains("Admin Portal")',
      tabUsers: 'android=new UiSelector().text("Users")',
      tabEmails: 'android=new UiSelector().textContains("Email")',
      userSearch: 'android=new UiSelector().className("android.widget.EditText")'
    };
  }
  async switchTab(tab) { await this.tap(`android=new UiSelector().text("${tab}")`, `Admin Tab ${tab}`); }
}

module.exports = {
  SplashOnboardingPage,
  AuthPage,
  DashboardPage,
  FoodSearchPage,
  AICoachPage,
  MedicalReportsPage,
  ProfilePage,
  AdminPage
};
