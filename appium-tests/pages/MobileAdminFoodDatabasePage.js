/**
 * Mobile Admin Food Database Management Page Object
 * Handles Appium Mobile automation for Admin Food Database, search, category chips, and macros on Android
 */
const MobileBasePage = require('./MobileBasePage');

class MobileAdminFoodDatabasePage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      foodDbTab: '//android.widget.TextView[contains(@text, "Food Database") or contains(@text, "Foods") or contains(@text, "Food Management")]',
      totalFoodsBadge: '//android.widget.TextView[contains(@text, "Total Food") or contains(@text, "Total Items")]',
      foodSearchInput: '//android.widget.EditText[contains(@text, "Search food") or contains(@hint, "Search food") or contains(@hint, "Search")]',
      categoryBreakfast: '//android.widget.TextView[@text="Breakfast"]',
      categoryLunch: '//android.widget.TextView[@text="Lunch"]',
      categoryDinner: '//android.widget.TextView[@text="Dinner"]',
      categorySnacks: '//android.widget.TextView[@text="Snacks"]',
      foodGridContainer: '//android.widget.ScrollView | //android.widget.ListView',
      foodCardItem: '//android.view.ViewGroup[descendant::android.widget.TextView[contains(@text, "kcal") or contains(@text, "Calories")]]',
      dietaryBadge: '//android.widget.TextView[contains(@text, "Vegetarian") or contains(@text, "Vegan") or contains(@text, "High Protein") or contains(@text, "Low GI")]',
      paginationNext: '//android.widget.TextView[contains(@text, "Next") or contains(@text, "→")]'
    };
  }

  async tapFoodDatabaseTab() {
    return await this.tap(this.selectors.foodDbTab);
  }

  async searchFood(query) {
    return await this.type(this.selectors.foodSearchInput, query);
  }

  async filterByCategory(category) {
    const sel = `//android.widget.TextView[@text="${category}"]`;
    return await this.tap(sel);
  }
}

module.exports = MobileAdminFoodDatabasePage;
