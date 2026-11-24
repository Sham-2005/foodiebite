// ─────────────────────────────────────────────────────────────
//  backend/src/routes/coachRoutes.js
//  FoodieBite AI Nutrition Coach & Ollama Model Management Routes
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  handleChatMessage,
  getAIStatusHandler,
  getInstalledModelsHandler,
  setSelectedModelHandler,
  pullModelHandler,
  testAIConnectionHandler
} = require('../controllers/coachController');

// AI Provider & Model Management Endpoints
router.get('/status', getAIStatusHandler);
router.get('/models', getInstalledModelsHandler);
router.post('/model', setSelectedModelHandler);
router.post('/pull', pullModelHandler);
router.post('/test', testAIConnectionHandler);

// Core Chat Completion Endpoint
router.post('/', protect, handleChatMessage);

module.exports = router;
