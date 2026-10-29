// ─────────────────────────────────────────────────────────────
//  backend/src/services/foodTrendService.js
//  Feature 2: Food Popularity and Trend Analysis
//  Computes popularity rankings, growth metrics, zero-baseline safe logic,
//  and trend classification (Trending Up, Trending Down, Stable, Newly Emerging, Insufficient Data).
// ─────────────────────────────────────────────────────────────

'use strict';

const { queryEvents } = require('./analyticsEventService');
const { FALLBACK_FOODS } = require('./foodiebiteFallbackFoods');

// Configurable minimum volume threshold to prevent single-event noise
const MIN_VOLUME_THRESHOLD = 3;

/**
 * Classify trend based on current vs previous period volume
 */
function classifyTrend(currentVol, prevVol, minThreshold = MIN_VOLUME_THRESHOLD) {
  if (currentVol < minThreshold && prevVol < minThreshold) {
    return {
      classification: 'Insufficient Data',
      badgeColor: '#64748b',
      percentageChange: 0,
      absoluteChange: currentVol - prevVol,
      description: 'Volume below analytical threshold'
    };
  }

  // Zero baseline handling: avoid division by zero
  if (prevVol === 0) {
    if (currentVol >= minThreshold) {
      return {
        classification: 'Newly Emerging',
        badgeColor: '#38BDF8',
        percentageChange: null, // Zero baseline
        absoluteChange: currentVol,
        description: 'New food interest detected without prior period baseline'
      };
    }
    return {
      classification: 'Stable',
      badgeColor: '#94a3b8',
      percentageChange: 0,
      absoluteChange: currentVol,
      description: 'Minimal baseline observed'
    };
  }

  const absChange = currentVol - prevVol;
  const pctChange = Number(((absChange / prevVol) * 100).toFixed(1));

  if (pctChange >= 20 && currentVol >= minThreshold) {
    return {
      classification: 'Trending Up',
      badgeColor: '#10B981',
      percentageChange: pctChange,
      absoluteChange: absChange,
      description: `Surged +${pctChange}% over previous period`
    };
  }

  if (pctChange <= -20) {
    return {
      classification: 'Trending Down',
      badgeColor: '#EF4444',
      percentageChange: pctChange,
      absoluteChange: absChange,
      description: `Decreased ${pctChange}% compared to previous period`
    };
  }

  return {
    classification: 'Stable',
    badgeColor: '#94a3b8',
    percentageChange: pctChange,
    absoluteChange: absChange,
    description: 'Steady discovery pattern'
  };
}

/**
 * Analyze food trends across current and previous periods
 */
function getFoodTrends(options = {}) {
  const {
    days = 7,
    categoryFilter = 'All',
    cuisineFilter = 'All'
  } = options;

  const now = new Date();
  const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const prevPeriodStart = new Date(now.getTime() - (days * 2) * 24 * 60 * 60 * 1000).toISOString();
  const prevPeriodEnd = currentPeriodStart;

  // Query events for current and previous periods
  const { events: allEvents } = queryEvents({
    startDate: prevPeriodStart,
    limit: 50000
  });

  const currentEvents = allEvents.filter(e => e.occurredAt >= currentPeriodStart);
  const prevEvents = allEvents.filter(e => e.occurredAt >= prevPeriodStart && e.occurredAt < prevPeriodEnd);

  // Aggregation maps: foodKey -> stats
  const currentFoodMap = new Map();
  const prevFoodMap = new Map();

  const currentCategoryMap = new Map();
  const currentCuisineMap = new Map();
  const searchQueriesMap = new Map();
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat

  function processEvent(e, targetMap) {
    const foodId = e.foodId || e.metadata?.foodName;
    const foodName = e.metadata?.foodName || (foodId ? String(foodId) : null);
    if (!foodName) return;

    if (!targetMap.has(foodName)) {
      targetMap.set(foodName, {
        foodId: foodId || foodName,
        foodName,
        category: e.metadata?.foodCategory || 'Uncategorized',
        cuisine: e.metadata?.cuisine || 'General',
        totalVolume: 0,
        searches: 0,
        clicks: 0,
        views: 0,
        favorites: 0
      });
    }

    const item = targetMap.get(foodName);
    item.totalVolume++;

    switch (e.eventType) {
      case 'food_search':
        item.searches++;
        break;
      case 'recommendation_click':
        item.clicks++;
        break;
      case 'food_detail_view':
        item.views++;
        break;
      case 'food_added_to_favorites':
        item.favorites++;
        break;
    }
  }

  // Populate maps
  currentEvents.forEach(e => {
    processEvent(e, currentFoodMap);

    const cat = e.metadata?.foodCategory;
    if (cat) currentCategoryMap.set(cat, (currentCategoryMap.get(cat) || 0) + 1);

    const cuis = e.metadata?.cuisine;
    if (cuis) currentCuisineMap.set(cuis, (currentCuisineMap.get(cuis) || 0) + 1);

    if (e.eventType === 'food_search' && e.metadata?.query) {
      const q = String(e.metadata.query).trim().toLowerCase();
      if (q.length > 1) {
        searchQueriesMap.set(q, (searchQueriesMap.get(q) || 0) + 1);
      }
    }

    // Day of week
    try {
      const dow = new Date(e.occurredAt).getUTCDay();
      dayOfWeekCounts[dow]++;
    } catch (_) {}
  });

  prevEvents.forEach(e => {
    processEvent(e, prevFoodMap);
  });

  // Compile combined food trending list
  const allObservedFoods = new Set([...currentFoodMap.keys(), ...prevFoodMap.keys()]);
  const trendingFoods = [];

  for (const name of allObservedFoods) {
    const current = currentFoodMap.get(name) || {
      foodId: name,
      foodName: name,
      category: 'Uncategorized',
      cuisine: 'General',
      totalVolume: 0,
      searches: 0,
      clicks: 0,
      views: 0,
      favorites: 0
    };
    const prev = prevFoodMap.get(name) || { totalVolume: 0 };

    if (categoryFilter !== 'All' && current.category !== categoryFilter) continue;
    if (cuisineFilter !== 'All' && current.cuisine !== cuisineFilter) continue;

    const trendMeta = classifyTrend(current.totalVolume, prev.totalVolume);

    trendingFoods.push({
      foodId: current.foodId,
      foodName: current.foodName,
      category: current.category,
      cuisine: current.cuisine,
      currentVolume: current.totalVolume,
      previousVolume: prev.totalVolume,
      searches: current.searches,
      clicks: current.clicks,
      views: current.views,
      favorites: current.favorites,
      ...trendMeta
    });
  }

  // Sort by current volume descending
  trendingFoods.sort((a, b) => b.currentVolume - a.currentVolume);

  // Top rankings
  const topSearched = [...trendingFoods].sort((a, b) => b.searches - a.searches).slice(0, 10);
  const mostClicked = [...trendingFoods].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  const mostFavorited = [...trendingFoods].sort((a, b) => b.favorites - a.favorites).slice(0, 10);
  const mostViewed = [...trendingFoods].sort((a, b) => b.views - a.views).slice(0, 10);

  // Rising vs Declining
  const risingTrends = trendingFoods.filter(f => f.classification === 'Trending Up' || f.classification === 'Newly Emerging').slice(0, 8);
  const decliningTrends = trendingFoods.filter(f => f.classification === 'Trending Down').slice(0, 8);

  // Categories & Cuisines
  const topCategories = Array.from(currentCategoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topCuisines = Array.from(currentCuisineMap.entries())
    .map(([cuisine, count]) => ({ cuisine, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Fastest growing search queries
  const topSearchQueries = Array.from(searchQueriesMap.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Day of week heatmap data
  const daysLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeekActivity = daysLabels.map((day, idx) => ({
    day,
    count: dayOfWeekCounts[idx]
  }));

  return {
    period: {
      days,
      currentPeriodStart,
      prevPeriodStart,
      totalObservedFoods: trendingFoods.length
    },
    trendingFoods: trendingFoods.slice(0, 25),
    topSearched,
    mostClicked,
    mostFavorited,
    mostViewed,
    risingTrends,
    decliningTrends,
    topCategories,
    topCuisines,
    topSearchQueries,
    dayOfWeekActivity,
    dataFreshness: new Date().toISOString()
  };
}

module.exports = {
  MIN_VOLUME_THRESHOLD,
  classifyTrend,
  getFoodTrends
};
