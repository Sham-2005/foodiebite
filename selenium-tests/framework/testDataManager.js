'use strict';
const fs = require('fs');
const config = require('../config/test-data.config');

class TestDataManager {
  static getUsers() {
    return JSON.parse(fs.readFileSync(config.usersFile, 'utf8'));
  }

  static getFoods() {
    return JSON.parse(fs.readFileSync(config.foodsFile, 'utf8'));
  }

  static getDiets() {
    return JSON.parse(fs.readFileSync(config.dietsFile, 'utf8'));
  }

  static getSearchQueries() {
    return JSON.parse(fs.readFileSync(config.searchFile, 'utf8'));
  }

  static getMedicalReports() {
    return JSON.parse(fs.readFileSync(config.medicalFile, 'utf8'));
  }

  static getCampaigns() {
    return JSON.parse(fs.readFileSync(config.campaignsFile, 'utf8'));
  }
}

module.exports = TestDataManager;
