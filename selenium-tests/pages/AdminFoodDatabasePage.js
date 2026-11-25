/**
 * Admin Food Database Management Page Object
 * Handles Selenium automation for Admin Food Database, search, category filters, and nutritional inspection
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class AdminFoodDatabasePage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      foodDbTab: By.xpath("//*[contains(text(), 'Food Database') or contains(text(), 'Foods') or contains(text(), 'Food Management')]"),
      totalFoodsBadge: By.xpath("//*[contains(text(), 'Total Food') or contains(text(), 'Total Items')]"),
      foodSearchInput: By.css("input[placeholder*='Search food'], input[placeholder*='Search by name'], input[placeholder*='filter']"),
      categoryDropdown: By.xpath("//*[contains(text(), 'Category') or contains(text(), 'All Categories')]"),
      categoryBreakfast: By.xpath("//*[contains(text(), 'Breakfast')]"),
      categoryLunch: By.xpath("//*[contains(text(), 'Lunch')]"),
      categoryDinner: By.xpath("//*[contains(text(), 'Dinner')]"),
      categorySnacks: By.xpath("//*[contains(text(), 'Snacks')]"),
      foodGridContainer: By.css("[data-testid='food-grid'], .food-database-grid, table"),
      foodRowItem: By.css("[data-testid='food-row'], tr, .food-card"),
      dietaryBadge: By.xpath("//*[contains(text(), 'Vegetarian') or contains(text(), 'Vegan') or contains(text(), 'High Protein') or contains(text(), 'Low GI')]"),
      paginationNext: By.xpath("//*[contains(text(), 'Next') or contains(text(), '→')]"),
      paginationPrev: By.xpath("//*[contains(text(), 'Previous') or contains(text(), '←')]")
    };
  }

  async navigateToFoodDatabase() {
    await this.navigateTo('/admin/foods');
    await this.sleep(1500);
  }

  async searchFood(query) {
    if (await this.isElementPresent(this.locators.foodSearchInput, 3000)) {
      await this.safeType(this.locators.foodSearchInput, query);
      await this.sleep(800);
    }
  }

  async filterByCategory(categoryName) {
    const catBtn = By.xpath(`//*[contains(text(), '${categoryName}')]`);
    if (await this.isElementPresent(catBtn, 3000)) {
      await this.safeClick(catBtn);
      await this.sleep(1000);
    }
  }
}

module.exports = AdminFoodDatabasePage;
