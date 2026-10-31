/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/pageobjects/AdminDashboardPage.js
 *  Page Object for Admin Metrics, Campaigns & User Management
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const BasePage = require('./BasePage');
const AppiumHelper = require('../helpers/appiumHelper');

class AdminDashboardPage extends BasePage {
  constructor() {
    super('AdminDashboardScreen');
  }

  get adminMasterKeyInput() {
    return AppiumHelper.byTestId('input-admin-master-key');
  }

  get adminSignInButton() {
    return AppiumHelper.byTestId('button-admin-sign-in');
  }

  get totalUsersMetricCard() {
    return AppiumHelper.byTestId('metric-total-registered-users');
  }

  get totalRecommendationsMetricCard() {
    return AppiumHelper.byTestId('metric-total-recommendations');
  }

  get triggerDailyCampaignButton() {
    return AppiumHelper.byTestId('button-trigger-daily-email-campaign');
  }

  get campaignDispatchSuccessBanner() {
    return AppiumHelper.byTestId('banner-campaign-dispatch-success');
  }

  get usersDataTable() {
    return AppiumHelper.byTestId('table-admin-users-list');
  }

  get searchUserInput() {
    return AppiumHelper.byTestId('input-admin-search-users');
  }
}

module.exports = new AdminDashboardPage();
