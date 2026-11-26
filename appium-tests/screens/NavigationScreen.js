'use strict';
const BaseScreen = require('../framework/baseScreen');

class NavigationScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'NavigationScreen');
    this.bottomNavBar = '~bottom-nav-bar';
    this.tabHome = '~tab-home';
    this.tabSearch = '~tab-search';
    this.tabCoach = '~tab-coach';
    this.tabProfile = '~tab-profile';
  }
}

module.exports = NavigationScreen;
