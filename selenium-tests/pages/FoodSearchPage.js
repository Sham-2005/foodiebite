/**
 * Food Catalog & Search Page Object
 */
const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class FoodSearchPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      searchInput: By.css("input[placeholder*='Search Open Food Facts'], input[placeholder*='Search']"),
      quickSearchChips: By.xpath("//*[contains(@style, 'border-radius') and (contains(text(), 'Chicken') or contains(text(), 'Salad') or contains(text(), 'Oats') or contains(text(), 'Quinoa'))]"),
      filterHighProtein: By.xpath("//*[contains(text(), 'High Protein')]"),
      filterLowCalorie: By.xpath("//*[contains(text(), 'Low Calorie')]"),
      filterGradeA: By.xpath("//*[contains(text(), 'Grade A')]"),
      resultsCountText: By.xpath("//*[contains(text(), 'results for')]"),
      foodItemCard: By.xpath("//*[contains(@style, 'box-sizing') and (contains(., 'Grade') or contains(., 'g protein') or contains(., 'kcal'))]"),
      clearSearchBtn: By.xpath("//*[contains(text(), '✕') or contains(@aria-label, 'Clear')]")
    };
  }

  async searchFood(query) {
    await this.safeType(this.locators.searchInput, query);
    await this.sleep(1500); // Allow debounce / API search
  }

  async clickQuickSearch(term = 'Salad') {
    const chip = By.xpath(`//*[contains(text(), '${term}')]`);
    await this.safeClick(chip);
    await this.sleep(1500);
  }

  async applyFilter(filterName) {
    const filterLocator = By.xpath(`//*[contains(text(), '${filterName}')]`);
    await this.safeClick(filterLocator);
    await this.sleep(1000);
  }

  async hasResults() {
    return await this.isElementPresent(this.locators.resultsCountText, 4000);
  }
}

module.exports = FoodSearchPage;
