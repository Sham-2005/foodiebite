const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getRecommendations, 
  searchFoods, 
  getFoodById, 
  getDeliveryLink,
  compareFoods,
  getMoodRecommendations,
  getWeatherRecommendations,
  getDnaRecommendations,
  scanNutrition
} = require('../controllers/foodController');

router.post('/scan-nutrition', scanNutrition);

router.get('/recommendations', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    return protect(req, res, () => next());
  }
  next();
}, getRecommendations);

router.get('/search', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    return protect(req, res, () => next());
  }
  next();
}, searchFoods);

router.get('/delivery-link', getDeliveryLink);
router.post('/compare', protect, compareFoods);
router.get('/mood', protect, getMoodRecommendations);
router.get('/weather', protect, getWeatherRecommendations);
router.get('/dna', protect, getDnaRecommendations);
router.get('/:barcode', getFoodById);

module.exports = router;
