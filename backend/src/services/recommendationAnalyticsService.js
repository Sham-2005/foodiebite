// ─────────────────────────────────────────────────────────────
//  backend/src/services/recommendationAnalyticsService.js
//  Feature 1: Recommendation Performance Analysis
//  Calculates CTR, Favorite Conversion, Search Success, Strategy Comparisons & CSV Export
// ─────────────────────────────────────────────────────────────

'use strict';

const { queryEvents, getDailySummaries } = require('./analyticsEventService');
const { FALLBACK_FOODS } = require('./foodiebiteFallbackFoods');

/**
 * Compute comprehensive recommendation performance metrics
 */
function getRecommendationPerformance(options = {}) {
  const {
    startDate,
    endDate,
    foodCategory,
    cuisine,
    dietType,
    recommendationStrategy
  } = options;

  // Retrieve matching events
  const { events } = queryEvents({
    startDate,
    endDate,
    recommendationStrategy,
    limit: 50000
  });

  let filtered = events;
  if (foodCategory && foodCategory !== 'All') {
    filtered = filtered.filter(e => e.metadata?.foodCategory === foodCategory);
  }
  if (cuisine && cuisine !== 'All') {
    filtered = filtered.filter(e => e.metadata?.cuisine === cuisine);
  }
  if (dietType && dietType !== 'All') {
    filtered = filtered.filter(e => e.metadata?.dietType === dietType);
  }

  // Count metrics
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalFavorites = 0;
  let totalSearches = 0;
  let searchSuccesses = 0;
  let feedbackPositive = 0;
  let feedbackNeutral = 0;
  let feedbackNegative = 0;

  const distinctFoodsRecommended = new Set();
  const distinctUsersEngaged = new Set();
  const userEngageCounts = new Map();

  const strategyStats = {
    general: { impressions: 0, clicks: 0, favorites: 0 },
    preference_based: { impressions: 0, clicks: 0, favorites: 0 },
    context_aware: { impressions: 0, clicks: 0, favorites: 0 },
    weather_aware: { impressions: 0, clicks: 0, favorites: 0 }
  };

  const categoryStats = {};
  const cuisineStats = {};

  for (const e of filtered) {
    const strat = e.recommendationStrategy || 'general';
    if (!strategyStats[strat]) {
      strategyStats[strat] = { impressions: 0, clicks: 0, favorites: 0 };
    }

    const cat = e.metadata?.foodCategory || 'Uncategorized';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { impressions: 0, clicks: 0, favorites: 0 };
    }

    const cuis = e.metadata?.cuisine || 'General';
    if (!cuisineStats[cuis]) {
      cuisineStats[cuis] = { impressions: 0, clicks: 0, favorites: 0 };
    }

    const uid = e.anonymousUserId;
    if (uid) {
      userEngageCounts.set(uid, (userEngageCounts.get(uid) || 0) + 1);
    }

    switch (e.eventType) {
      case 'recommendation_impression':
        totalImpressions++;
        strategyStats[strat].impressions++;
        categoryStats[cat].impressions++;
        cuisineStats[cuis].impressions++;
        if (e.foodId) distinctFoodsRecommended.add(e.foodId);
        break;

      case 'recommendation_click':
        totalClicks++;
        strategyStats[strat].clicks++;
        categoryStats[cat].clicks++;
        cuisineStats[cuis].clicks++;
        distinctUsersEngaged.add(uid);
        if (e.foodId) distinctFoodsRecommended.add(e.foodId);
        break;

      case 'food_added_to_favorites':
        totalFavorites++;
        strategyStats[strat].favorites++;
        categoryStats[cat].favorites++;
        break;

      case 'food_search':
        totalSearches++;
        break;

      case 'search_result_click':
        searchSuccesses++;
        break;

      case 'recommendation_feedback': {
        const rating = Number(e.metadata?.rating);
        if (rating >= 4) feedbackPositive++;
        else if (rating === 3) feedbackNeutral++;
        else if (rating > 0) feedbackNegative++;
        break;
      }
    }
  }

  // Key ratios
  const ctr = totalImpressions > 0 
    ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) 
    : 0;

  const favoriteConversionRate = totalImpressions > 0 
    ? Number(((totalFavorites / totalImpressions) * 100).toFixed(2)) 
    : 0;

  const searchSuccessRate = totalSearches > 0 
    ? Number(((searchSuccesses / totalSearches) * 100).toFixed(2)) 
    : 0;

  // Catalog coverage (against fallback foods catalog)
  const totalCatalogFoods = Array.isArray(FALLBACK_FOODS) ? FALLBACK_FOODS.length : 120;
  const coveragePercent = totalCatalogFoods > 0 
    ? Number(((distinctFoodsRecommended.size / totalCatalogFoods) * 100).toFixed(2)) 
    : 0;

  // Repeat engagement rate
  let repeatUsers = 0;
  for (const count of userEngageCounts.values()) {
    if (count > 1) repeatUsers++;
  }
  const totalUsersSeen = userEngageCounts.size;
  const repeatEngagementRate = totalUsersSeen > 0 
    ? Number(((repeatUsers / totalUsersSeen) * 100).toFixed(2)) 
    : 0;

  // Format strategy breakdown with CTR
  const formattedStrategies = Object.entries(strategyStats).map(([strategy, data]) => ({
    strategy,
    label: strategy.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    impressions: data.impressions,
    clicks: data.clicks,
    favorites: data.favorites,
    ctr: data.impressions > 0 ? Number(((data.clicks / data.impressions) * 100).toFixed(2)) : 0
  }));

  // Format category breakdown with CTR
  const formattedCategories = Object.entries(categoryStats)
    .filter(([_, data]) => data.impressions > 0 || data.clicks > 0)
    .map(([category, data]) => ({
      category,
      impressions: data.impressions,
      clicks: data.clicks,
      favorites: data.favorites,
      ctr: data.impressions > 0 ? Number(((data.clicks / data.impressions) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  // Daily Trend series for charting
  const dailyRollups = getDailySummaries(30);

  return {
    kpis: {
      totalImpressions,
      totalClicks,
      ctr,
      totalFavorites,
      favoriteConversionRate,
      totalSearches,
      searchSuccessRate,
      distinctFoodsRecommended: distinctFoodsRecommended.size,
      catalogCoveragePercent: coveragePercent,
      repeatEngagementRate,
      totalUsersObserved: totalUsersSeen
    },
    feedbackDistribution: {
      positive: feedbackPositive,
      neutral: feedbackNeutral,
      negative: feedbackNegative,
      total: feedbackPositive + feedbackNeutral + feedbackNegative
    },
    strategyBreakdown: formattedStrategies,
    categoryBreakdown: formattedCategories,
    dailyTrends: dailyRollups,
    dataFreshness: new Date().toISOString()
  };
}

/**
 * Generate CSV export for recommendation analytics
 */
function generateRecommendationCsv(options = {}) {
  const result = getRecommendationPerformance(options);
  const rows = [
    ['Metric', 'Value', 'Unit/Details'],
    ['Total Impressions', result.kpis.totalImpressions, 'Impressions'],
    ['Total Clicks', result.kpis.totalClicks, 'Clicks'],
    ['Click-Through Rate (CTR)', `${result.kpis.ctr}%`, 'Percentage'],
    ['Favorites Converted', result.kpis.totalFavorites, 'Items Favorited'],
    ['Favorite Conversion Rate', `${result.kpis.favoriteConversionRate}%`, 'Percentage'],
    ['Search Success Rate', `${result.kpis.searchSuccessRate}%`, 'Percentage'],
    ['Distinct Foods Recommended', result.kpis.distinctFoodsRecommended, 'Food items'],
    ['Catalog Coverage', `${result.kpis.catalogCoveragePercent}%`, 'Percentage'],
    ['Repeat Engagement Rate', `${result.kpis.repeatEngagementRate}%`, 'Percentage'],
    [],
    ['Recommendation Strategy', 'Impressions', 'Clicks', 'CTR (%)'],
    ...result.strategyBreakdown.map(s => [s.label, s.impressions, s.clicks, `${s.ctr}%`]),
    [],
    ['Food Category', 'Impressions', 'Clicks', 'CTR (%)'],
    ...result.categoryBreakdown.map(c => [c.category, c.impressions, c.clicks, `${c.ctr}%`])
  ];

  return rows.map(r => r.map(cell => {
    if (cell === null || cell === undefined) return '""';
    const s = String(cell).replace(/"/g, '""');
    return `"${s}"`;
  }).join(',')).join('\n');
}

module.exports = {
  getRecommendationPerformance,
  generateRecommendationCsv
};
