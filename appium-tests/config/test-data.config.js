'use strict';
const path = require('path');
const dataDir = path.resolve(__dirname, '../test-data');
module.exports = {
  usersFile: path.join(dataDir, 'users.json'),
  dietsFile: path.join(dataDir, 'dietaryPreferences.json'),
  foodsFile: path.join(dataDir, 'foods.json'),
  searchFile: path.join(dataDir, 'searchQueries.json'),
  medicalFile: path.join(dataDir, 'syntheticMedicalReports.json'),
  campaignsFile: path.join(dataDir, 'emailCampaigns.json')
};
