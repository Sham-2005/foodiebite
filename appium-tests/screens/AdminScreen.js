'use strict';
const BaseScreen = require('../framework/baseScreen');

class AdminScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'AdminScreen');
    this.adminOverview = '~admin-overview-header';
    this.userList = '~admin-user-row';
    this.foodCatalogTab = '~admin-food-catalog-tab';
  }
}

module.exports = AdminScreen;
