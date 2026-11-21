/**
 * Dashboard & Home Feed Page Object
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class DashboardPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      greeting: By.xpath("//*[contains(text(), 'Hello') or contains(text(), 'Welcome') or contains(text(), 'Recommendations')]"),
      weatherWidget: By.xpath("//*[contains(text(), '°C') or contains(text(), 'Weather') or contains(text(), 'Sunny') or contains(text(), 'Rainy')]"),
      categoryAll: By.xpath("//*[contains(text(), 'All')]"),
      categoryHealthy: By.xpath("//*[contains(text(), 'Healthy')]"),
      categoryProtein: By.xpath("//*[contains(text(), 'Protein')]"),
      categoryVegan: By.xpath("//*[contains(text(), 'Vegan')]"),
      foodCards: By.css("[data-testid='food-card'], [role='button'][style*='border-radius']"),
      
      // Bottom Navigation Items
      navHome: By.css("[aria-label='Navigate to Home'], [role='button'][aria-label*='Home']"),
      navSearch: By.css("[aria-label='Navigate to Search'], [role='button'][aria-label*='Search']"),
      navAI: By.css("[aria-label='Navigate to AI Coach'], [role='button'][aria-label*='AI']"),
      navFavorites: By.css("[aria-label='Navigate to Favorites'], [role='button'][aria-label*='Favorites']"),
      navProfile: By.css("[aria-label='Navigate to Profile'], [role='button'][aria-label*='Profile']"),

      // Notification button
      bellButton: By.xpath("//*[name()='svg']/*[name()='path' and contains(@d, '18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9')]/ancestor::div[@role='button'] | //div[@role='button'][contains(., 'Notifications')]")
    };
  }

  async selectCategory(categoryName) {
    const catLocator = By.xpath(`//*[contains(text(), '${categoryName}')]`);
    await this.safeClick(catLocator);
    await this.sleep(800);
  }

  async navigateToTab(tabName) {
    const locators = {
      home: this.locators.navHome,
      search: this.locators.navSearch,
      ai: this.locators.navAI,
      favorites: this.locators.navFavorites,
      profile: this.locators.navProfile
    };
    const target = locators[tabName.toLowerCase()];
    if (!target) throw new Error(`Unknown bottom tab: ${tabName}`);
    await this.safeClick(target);
    await this.sleep(1000);
  }

  async getFoodCardCount() {
    const cards = await this.driver.findElements(By.xpath("//*[contains(@style, 'background-color') and contains(., 'kcal')]"));
    return cards.length;
  }
}

module.exports = DashboardPage;
