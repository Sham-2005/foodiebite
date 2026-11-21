/**
 * Mobile Dashboard & Home Feed Page Object
 */
const MobileBasePage = require('./MobileBasePage');

class MobileDashboardPage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      weatherCard: 'android=new UiSelector().textContains("°C")',
      feedHeader: 'android=new UiSelector().textContains("Recommendations")',
      catAll: 'android=new UiSelector().text("All")',
      catHealthy: 'android=new UiSelector().text("Healthy")',
      catProtein: 'android=new UiSelector().text("Protein")',
      catVegan: 'android=new UiSelector().text("Vegan")',
      navHome: '~Navigate to Home',
      navSearch: '~Navigate to Search',
      navAI: '~Navigate to AI Coach',
      navFavorites: '~Navigate to Favorites',
      navProfile: '~Navigate to Profile',
      foodCard: 'android=new UiSelector().textContains("kcal")'
    };
  }

  async selectCategory(categoryName) {
    return await this.resilientExecute(async () => {
      const selector = `android=new UiSelector().text("${categoryName}")`;
      await this.tap(selector);
    }, `Select Category ${categoryName}`);
  }

  async switchTab(tabKey) {
    const tabs = {
      home: this.selectors.navHome,
      search: this.selectors.navSearch,
      ai: this.selectors.navAI,
      favorites: this.selectors.navFavorites,
      profile: this.selectors.navProfile
    };
    return await this.resilientExecute(async () => {
      await this.tap(tabs[tabKey.toLowerCase()] || tabs.home);
    }, `Switch to tab ${tabKey}`);
  }
}

module.exports = MobileDashboardPage;
