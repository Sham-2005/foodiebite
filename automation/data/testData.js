/**
 * Enterprise Test Data Framework
 * Dynamic fixtures, boundary values, security payloads, and user profiles.
 */
module.exports = {
  validUsers: {
    standardUser: {
      email: 'user_e2e_tester@foodiebite.com',
      password: 'SecurePassword123!',
      name: 'Standard Foodie Tester',
      age: '27',
      dietary: 'Vegetarian',
      gender: 'Female'
    },
    adminUser: {
      email: 'sham111205s@gmail.com',
      password: 'AdminPassword123!',
      name: 'FoodieBite Administrator',
      role: 'admin'
    }
  },
  invalidCredentials: [
    { email: 'nonexistent@foodiebite.test', password: 'WrongPassword!', label: 'Unregistered Email' },
    { email: 'user@domain', password: 'Password123!', label: 'Malformed Email' },
    { email: '', password: 'Password123!', label: 'Empty Email' },
    { email: 'user_e2e_tester@foodiebite.com', password: '', label: 'Empty Password' },
    { email: 'user_e2e_tester@foodiebite.com', password: '123', label: 'Short Password' }
  ],
  securityPayloads: [
    { payload: "' OR '1'='1", label: 'SQL Injection in Login' },
    { payload: '<script>alert(1)</script>', label: 'Cross-Site Scripting (XSS)' },
    { payload: 'A'.repeat(500), label: 'Buffer Overflow String' },
    { payload: '../../etc/passwd', label: 'Path Traversal Filename' }
  ],
  searchQueries: [
    { query: 'Chicken Salad', expectedMinResults: 1 },
    { query: 'Palak Paneer', expectedMinResults: 1 },
    { query: 'Oats Porridge', expectedMinResults: 1 },
    { query: 'Quinoa', expectedMinResults: 1 },
    { query: 'NonExistentProductZ999', expectedMinResults: 0 }
  ],
  dietaryFilters: ['All', 'Healthy', 'Protein', 'Low Carb', 'Vegan'],
  macroThresholds: {
    highProteinGrams: 10,
    lowCalorieKcal: 200,
    lowCarbGrams: 15
  }
};
