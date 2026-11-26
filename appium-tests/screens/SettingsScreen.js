'use strict';
const BaseScreen = require('../framework/baseScreen');

class SettingsScreen extends BaseScreen {
  constructor(driver) {
    super(driver, 'SettingsScreen');
    this.notificationsToggle = '~settings-notifications-toggle';
    this.deleteAccountBtn = '~settings-delete-account-btn';
  }
}

module.exports = SettingsScreen;
