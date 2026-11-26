'use strict';
const BaseScreen = require('../framework/baseScreen');

class HomeScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'HomeScreen');
    this.headerGreeting = '~home-greeting';
    this.foodCards = '~food-recommendation-card';
    this.searchTab = '~tab-search';
    this.profileTab = '~tab-profile';
    this.coachTab = '~tab-coach';
  }
}

module.exports = HomeScreen;
