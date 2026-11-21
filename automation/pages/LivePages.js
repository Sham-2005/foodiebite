/**
 * Page Object Model (POM) Implementation for Live GitHub Pages E2E Testing
 * All navigations and locators strictly use BASE_URL. Hardcoded URLs are forbidden.
 */
const { By, until } = require('selenium-webdriver');
const { URL } = require('url');
const config = require('../config/selenium.config');
const logger = require('../utils/logger');

class BaseLivePage {
  constructor(driver) {
    this.driver = driver;
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeouts.explicitTimeoutMs;
  }

  resolveUrl(subPath = '') {
    const cleanPath = subPath.startsWith('/') ? subPath.substring(1) : subPath;
    return new URL(cleanPath, this.baseUrl).toString();
  }

  async navigateTo(subPath = '') {
    const targetUrl = this.resolveUrl(subPath);
    logger.debug(`[Navigation] Navigating to LIVE URL: ${targetUrl}`);
    if (this.driver) {
      await this.driver.get(targetUrl);
      await this.waitForReady();
    }
    return targetUrl;
  }

  async waitForReady() {
    if (this.driver) {
      await this.driver.wait(async () => {
        const state = await this.driver.executeScript('return document.readyState');
        return state === 'complete';
      }, this.timeout);
    }
  }

  async safeClick(locator) {
    if (this.driver) {
      const el = await this.driver.wait(until.elementLocated(locator), this.timeout);
      await this.driver.wait(until.elementIsVisible(el), this.timeout);
      await el.click();
    }
  }

  async safeType(locator, text) {
    if (this.driver) {
      const el = await this.driver.wait(until.elementLocated(locator), this.timeout);
      await el.clear();
      await el.sendKeys(text);
    }
  }
}

class LiveAuthPage extends BaseLivePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      emailInput: By.css("input[placeholder*='Email'], input[type='email']"),
      passwordInput: By.css("input[placeholder*='Password']"),
      signInBtn: By.xpath("//div[@role='button'][contains(., 'Sign In')] | //button[contains(., 'Sign In')]"),
      signUpLink: By.xpath("//*[contains(text(), 'Sign Up')]"),
      errorBanner: By.xpath("//*[contains(text(), 'Invalid') or contains(@style, 'color: rgb(255, 77, 109)')]")
    };
  }

  async openSignIn() { await this.navigateTo('signin'); }
  async submitLogin(email, pass) {
    await this.safeType(this.locators.emailInput, email);
    await this.safeType(this.locators.passwordInput, pass);
    await this.safeClick(this.locators.signInBtn);
  }
}

class LiveDashboardPage extends BaseLivePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      feedTitle: By.xpath("//*[contains(text(), 'Recommendations')]"),
      weatherBadge: By.xpath("//*[contains(text(), '°C')]"),
      categoryHealthy: By.xpath("//*[contains(text(), 'Healthy')]"),
      categoryProtein: By.xpath("//*[contains(text(), 'Protein')]"),
      navSearch: By.css("[aria-label*='Search']"),
      navAI: By.css("[aria-label*='AI']"),
      navProfile: By.css("[aria-label*='Profile']")
    };
  }
  async openDashboard() { await this.navigateTo('home'); }
}

class LiveSearchPage extends BaseLivePage {
  constructor(driver) {
    super(driver);
    this.locators = {
      searchInput: By.css("input[placeholder*='Search']"),
      quickChipSalad: By.xpath("//*[contains(text(), 'Salad')]"),
      filterHighProtein: By.xpath("//*[contains(text(), 'High Protein')]")
    };
  }
  async openSearch() { await this.navigateTo('search'); }
}

module.exports = {
  BaseLivePage,
  LiveAuthPage,
  LiveDashboardPage,
  LiveSearchPage
};
