/**
 * Mobile Food Search Page Object
 */
const MobileBasePage = require('./MobileBasePage');

class MobileFoodSearchPage extends MobileBasePage {
  constructor(driver) {
    super(driver);
    this.selectors = {
      searchInput: 'android=new UiSelector().className("android.widget.EditText")',
      barcodeScannerBtn: '//*[@content-desc="Scan Barcode" or contains(@text, "Scan")]',
      quickChipSalad: 'android=new UiSelector().text("Salad")',
      quickChipChicken: 'android=new UiSelector().text("Chicken")',
      filterHighProtein: 'android=new UiSelector().text("High Protein")',
      filterLowCalorie: 'android=new UiSelector().text("Low Calorie")',
      resultsIndicator: 'android=new UiSelector().textContains("results for")',
      foodCardItem: 'android=new UiSelector().textContains("Grade")'
    };
  }

  async searchFood(term) {
    return await this.resilientExecute(async () => {
      await this.type(this.selectors.searchInput, term);
    }, `Search food ${term}`);
  }

  async tapQuickChip(name) {
    return await this.resilientExecute(async () => {
      const s = `android=new UiSelector().text("${name}")`;
      await this.tap(s);
    }, `Tap quick chip ${name}`);
  }
}

module.exports = MobileFoodSearchPage;
