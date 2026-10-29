const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { handleChatMessage } = require('../controllers/coachController');

router.post('/', protect, handleChatMessage);

module.exports = router;
