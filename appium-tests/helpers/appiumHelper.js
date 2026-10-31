/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/helpers/appiumHelper.js
 *  Appium & WebdriverIO Gesture, Selector & Interaction Helpers
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

class AppiumHelper {
  /**
   * Find element by React Native testID / accessibilityLabel
   */
  static byTestId(testId) {
    if (browser.isMobile) {
      return $(`~${testId}`);
    }
    return $(`[data-testid="${testId}"]`);
  }

  /**
   * Find element by Android UIAutomator text contains
   */
  static byAndroidText(text) {
    return $(`android=new UiSelector().textContains("${text}")`);
  }

  /**
   * Wait for element to be visible and clickable with timeout
   */
  static async waitForElement(element, timeout = 10000) {
    await element.waitForDisplayed({ timeout });
    return element;
  }

  /**
   * Scroll down until text is visible (Android UiScrollable)
   */
  static async scrollToText(text) {
    if (browser.isAndroid) {
      const scrollSelector = `android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().textContains("${text}").instance(0))`;
      return $(scrollSelector);
    }
    // Web fallback
    const el = $(`//*[contains(text(), '${text}')]`);
    await el.scrollIntoView();
    return el;
  }

  /**
   * Perform vertical swipe from bottom to top
   */
  static async swipeUp(distancePercent = 0.5) {
    if (browser.isMobile) {
      const { width, height } = await browser.getWindowSize();
      const startX = width / 2;
      const startY = height * 0.8;
      const endY = height * (0.8 - distancePercent);

      await browser.performActions([{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: startX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerMove', duration: 600, x: startX, y: endY },
          { type: 'pointerUp', button: 0 }
        ]
      }]);
    } else {
      await browser.execute(`window.scrollBy(0, ${window.innerHeight * distancePercent})`);
    }
  }

  /**
   * Hide soft keyboard safely if displayed
   */
  static async hideKeyboard() {
    try {
      if (browser.isMobile && await browser.isKeyboardShown()) {
        await browser.hideKeyboard();
      }
    } catch (_) {}
  }
}

module.exports = AppiumHelper;
