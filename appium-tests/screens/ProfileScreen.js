'use strict';
const BaseScreen = require('../framework/baseScreen');

class ProfileScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'ProfileScreen');
    this.userName = '~profile-user-name';
    this.dietPicker = '~profile-diet-picker';
    this.saveBtn = '~save-profile-btn';
    this.logoutBtn = '~logout-btn';
  }
}

module.exports = ProfileScreen;
