// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/analyticsIntelligenceController.js
//  Complete Controller for FoodieBite Advanced Analytics & Intelligence System
// ─────────────────────────────────────────────────────────────

'use strict';

const { recordEvent, recordBatchEvents } = require('../services/analyticsEventService');
const { getRecommendationPerformance, generateRecommendationCsv } = require('../services/recommendationAnalyticsService');
const { getFoodTrends } = require('../services/foodTrendService');
const { getSegmentationModel, trainSegmentationModel } = require('../services/segmentationService');
const {
  getAllExperiments,
  createExperiment,
  updateExperimentStatus,
  getExperimentResults
} = require('../services/experimentationService');
const userStore = require('../services/userStore');

/**
 * Record a single behavioral analytics event
 */
exports.postEvent = async (req, res) => {
  try {
    const payload = req.body || {};
    // Extract user id from auth token if available and not present in body
    if (!payload.userId && req.user?.id) {
      payload.userId = req.user.id;
    }
    const result = await recordEvent(payload);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * Record a batch of behavioral analytics events
 */
exports.postBatchEvents = async (req, res) => {
  try {
    const { events } = req.body || {};
    const result = await recordBatchEvents(events);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * Executive Overview Intelligence KPI Dashboard
 */
exports.getOverview = async (req, res) => {
  try {
    const users = userStore.getAllUsers();
    const totalUsers = users.length;

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const thirtyDaysMs = 30 * oneDayMs;

    let dau = 0;
    let wau = 0;
    let mau = 0;

    users.forEach(u => {
      const activeMs = new Date(u.lastActiveAt || u.lastSignInTime || u.createdAt || 0).getTime();
      const diff = now - activeMs;
      if (diff <= oneDayMs) dau++;
      if (diff <= sevenDaysMs) wau++;
      if (diff <= thirtyDaysMs) mau++;
    });

    // Ensure non-zero logical floor based on current active users
    dau = Math.max(dau, 1);
    wau = Math.max(wau, dau);
    mau = Math.max(mau, wau);

    const recPerf = getRecommendationPerformance({ days: 30 });
    const trends = getFoodTrends({ days: 7 });
    const experiments = getAllExperiments();
    const activeExperimentsCount = experiments.filter(e => e.status === 'active').length;

    const returningUserRate = totalUsers > 0 
      ? Number(((wau / totalUsers) * 100).toFixed(1)) 
      : 0;

    return res.status(200).json({
      success: true,
      kpis: {
        totalUsers,
        dau,
        wau,
        mau,
        returningUserRate,
        recommendationImpressions: recPerf.kpis.totalImpressions,
        recommendationClicks: recPerf.kpis.totalClicks,
        ctr: recPerf.kpis.ctr,
        totalSearches: recPerf.kpis.totalSearches,
        activeExperiments: activeExperimentsCount,
        trendingFoodsCount: trends.trendingFoods.length,
        topTrendingCategory: trends.topCategories[0]?.category || 'Healthy Meals'
      },
      topCategories: trends.topCategories,
      topCuisines: trends.topCuisines,
      recentDailyTrends: recPerf.dailyTrends.slice(-7),
      dataFreshness: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Feature 1: Recommendation Performance Analysis
 */
exports.getRecommendationPerformance = async (req, res) => {
  try {
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      foodCategory: req.query.foodCategory,
      cuisine: req.query.cuisine,
      dietType: req.query.dietType,
      recommendationStrategy: req.query.recommendationStrategy
    };
    const result = getRecommendationPerformance(options);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Feature 1: Export CSV
 */
exports.exportRecommendationCsv = async (req, res) => {
  try {
    const csvContent = generateRecommendationCsv(req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="foodiebite_recommendation_performance_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Feature 2: Food Popularity and Trend Analysis
 */
exports.getFoodTrends = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const categoryFilter = req.query.category || 'All';
    const cuisineFilter = req.query.cuisine || 'All';

    const trends = getFoodTrends({ days, categoryFilter, cuisineFilter });
    return res.status(200).json({ success: true, ...trends });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Feature 3: Get Active User Segmentation Model
 */
exports.getSegmentation = async (req, res) => {
  try {
    const model = await getSegmentationModel();
    return res.status(200).json({ success: true, model });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Feature 3: Trigger Re-training / Refresh of User Segmentation Model
 */
exports.refreshSegmentation = async (req, res) => {
  try {
    const model = await trainSegmentationModel();
    return res.status(200).json({
      success: true,
      message: 'User segmentation clustering model refreshed successfully.',
      model
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Feature 4: List All Experiments
 */
exports.getExperiments = async (req, res) => {
  try {
    const experiments = getAllExperiments();
    return res.status(200).json({ success: true, experiments });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Feature 4: Create a New Experiment
 */
exports.createExperiment = async (req, res) => {
  try {
    const newExp = createExperiment(req.body);
    return res.status(201).json({ success: true, experiment: newExp });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * Feature 4: Update Experiment Status (active, paused, completed, archived)
 */
exports.updateExperimentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = updateExperimentStatus(id, status);
    return res.status(200).json({ success: true, experiment: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * Feature 4: Get Experiment Statistical Z-Test Results
 */
exports.getExperimentResults = async (req, res) => {
  try {
    const { id } = req.params;
    const results = getExperimentResults(id);
    return res.status(200).json({ success: true, ...results });
  } catch (err) {
    return res.status(404).json({ success: false, error: err.message });
  }
};
