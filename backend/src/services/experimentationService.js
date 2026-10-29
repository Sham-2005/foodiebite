// ─────────────────────────────────────────────────────────────
//  backend/src/services/experimentationService.js
//  Feature 4: A/B Experimentation Engine for Food Recommendations
//  Deterministic hashing assignment, exposure tracking, and Two-Proportion Z-Test evaluation.
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFirestoreDb } = require('../config/firebase');

const DATA_DIR = path.join(__dirname, '../../data');
const EXPERIMENTS_FILE = path.join(DATA_DIR, 'experiments.json');
const EXPOSURES_FILE = path.join(DATA_DIR, 'experiment_exposures.json');

let experimentsMap = new Map();
let exposuresList = [];

/**
 * Initialize experiments store with a default active experiment
 */
function initStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    if (fs.existsSync(EXPERIMENTS_FILE)) {
      const raw = fs.readFileSync(EXPERIMENTS_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(exp => experimentsMap.set(exp.id, exp));
      }
    }

    if (fs.existsSync(EXPOSURES_FILE)) {
      const raw = fs.readFileSync(EXPOSURES_FILE, 'utf8');
      exposuresList = JSON.parse(raw);
    }

    // Ensure baseline default experiment exists if empty
    if (experimentsMap.size === 0) {
      const defaultExp = {
        id: 'exp_context_aware_v1',
        name: 'Context & Weather Aware Recommendation Evaluation',
        description: 'Evaluates whether weather-aware and seasonality-aware ranking improves recommendation CTR compared to standard preference baseline.',
        status: 'active',
        trafficAllocation: 50, // 50% treatment, 50% control
        primaryMetric: 'ctr',
        secondaryMetrics: ['favorite_conversion', 'search_success'],
        variants: [
          {
            id: 'control',
            name: 'Control (Standard Dietary Preference)',
            description: 'Recommendations scored on diet, health goals, and base nutrition',
            allocation: 50,
            strategy: 'preference_based'
          },
          {
            id: 'treatment',
            name: 'Treatment (Context & Weather Boosted)',
            description: 'Recommendations with additional weather context, time-of-day, and seasonality boosts',
            allocation: 50,
            strategy: 'context_aware'
          }
        ],
        createdAt: '2026-10-20T00:00:00.000Z',
        activatedAt: '2026-10-20T00:00:00.000Z',
        completedAt: null
      };
      experimentsMap.set(defaultExp.id, defaultExp);
      fs.writeFileSync(EXPERIMENTS_FILE, JSON.stringify([defaultExp], null, 2));
    }
  } catch (err) {
    console.warn('⚠️ experimentationService init note:', err.message);
  }
}

initStorage();

function persistExperiments() {
  try {
    fs.writeFileSync(EXPERIMENTS_FILE, JSON.stringify(Array.from(experimentsMap.values()), null, 2));
  } catch (_) {}
}

function persistExposures() {
  try {
    fs.writeFileSync(EXPOSURES_FILE, JSON.stringify(exposuresList.slice(-10000), null, 2));
  } catch (_) {}
}

/**
 * Deterministically assign a pseudonymous user to an experiment variant using SHA-256
 */
function assignVariant(experimentId, anonymousUserId) {
  const exp = experimentsMap.get(experimentId);
  if (!exp || exp.status !== 'active') {
    return { assigned: false, variantId: 'control', reason: 'Experiment not active' };
  }

  // Stable hashing: hash(experimentId + ":" + anonymousUserId) mod 100
  const hash = crypto.createHash('sha256').update(`${experimentId}:${anonymousUserId}`).digest('hex');
  const bucket = parseInt(hash.substring(0, 4), 16) % 100;

  // Variant matching
  let runningTotal = 0;
  for (const v of exp.variants) {
    runningTotal += v.allocation;
    if (bucket < runningTotal) {
      return {
        assigned: true,
        experimentId,
        variantId: v.id,
        variantName: v.name,
        strategy: v.strategy,
        bucket
      };
    }
  }

  // Default to control
  return {
    assigned: true,
    experimentId,
    variantId: 'control',
    strategy: 'preference_based',
    bucket
  };
}

/**
 * Record an actual user exposure to an experiment variant (only when recommendations are rendered)
 */
function recordExposure(payload) {
  const { experimentId, variantId, anonymousUserId, sessionId, strategy } = payload;
  if (!experimentId || !variantId || !anonymousUserId) return;

  const exposureKey = `${experimentId}:${variantId}:${anonymousUserId}:${sessionId || ''}`;
  const now = new Date().toISOString();

  // Deduplicate exposures within the same session
  const alreadyExposed = exposuresList.some(e => 
    e.experimentId === experimentId && 
    e.anonymousUserId === anonymousUserId && 
    e.sessionId === sessionId
  );

  if (!alreadyExposed) {
    exposuresList.push({
      exposureId: `exp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      experimentId,
      variantId,
      anonymousUserId,
      sessionId: sessionId || 'default',
      strategy: strategy || 'general',
      exposedAt: now
    });
    persistExposures();
  }
}

/**
 * Standard Normal Cumulative Distribution Function (error function approximation)
 */
function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Two-Proportion Z-Test calculation with confidence intervals and sample size checks
 */
function calculateTwoProportionZTest(controlN, controlConversions, treatmentN, treatmentConversions) {
  const pControl = controlN > 0 ? controlConversions / controlN : 0;
  const pTreatment = treatmentN > 0 ? treatmentConversions / treatmentN : 0;

  const absoluteDiff = pTreatment - pControl;
  const relativeImprovement = pControl > 0 ? (absoluteDiff / pControl) * 100 : 0;

  // Minimum sample size requirement
  if (controlN < 15 || treatmentN < 15) {
    return {
      controlRate: Number((pControl * 100).toFixed(2)),
      treatmentRate: Number((pTreatment * 100).toFixed(2)),
      absoluteDiff: Number((absoluteDiff * 100).toFixed(2)),
      relativeImprovement: Number(relativeImprovement.toFixed(2)),
      zScore: 0,
      pValue: 1.0,
      isStatisticallySignificant: false,
      confidenceInterval95: [0, 0],
      verdict: 'Inconclusive: Sample size too small for statistical significance (minimum 15 exposures required per variant).',
      badgeColor: '#64748b'
    };
  }

  // Pooled probability
  const pooledP = (controlConversions + treatmentConversions) / (controlN + treatmentN);
  const sePooled = Math.sqrt(pooledP * (1 - pooledP) * ((1 / controlN) + (1 / treatmentN)));

  let zScore = 0;
  let pValue = 1.0;
  if (sePooled > 0) {
    zScore = absoluteDiff / sePooled;
    pValue = 2 * (1 - normalCdf(Math.abs(zScore)));
  }

  // 95% Confidence Interval
  const seDiff = Math.sqrt((pControl * (1 - pControl) / controlN) + (pTreatment * (1 - pTreatment) / treatmentN));
  const ciLow = Number(((absoluteDiff - 1.96 * seDiff) * 100).toFixed(2));
  const ciHigh = Number(((absoluteDiff + 1.96 * seDiff) * 100).toFixed(2));

  const isSignificant = pValue < 0.05;
  let verdict = '';
  let badgeColor = '#94a3b8';

  if (isSignificant) {
    if (absoluteDiff > 0) {
      verdict = `Statistically Significant Winner: Treatment outperformed Control by +${(absoluteDiff * 100).toFixed(2)}% (p=${pValue.toFixed(4)} < 0.05).`;
      badgeColor = '#10B981';
    } else {
      verdict = `Statistically Significant Decline: Treatment underperformed Control by ${(absoluteDiff * 100).toFixed(2)}% (p=${pValue.toFixed(4)} < 0.05).`;
      badgeColor = '#EF4444';
    }
  } else {
    verdict = `No Statistically Significant Difference: The observed variation (p=${pValue.toFixed(4)}) is consistent with random chance.`;
    badgeColor = '#F59E0B';
  }

  return {
    controlRate: Number((pControl * 100).toFixed(2)),
    treatmentRate: Number((pTreatment * 100).toFixed(2)),
    absoluteDiff: Number((absoluteDiff * 100).toFixed(2)),
    relativeImprovement: Number(relativeImprovement.toFixed(2)),
    zScore: Number(zScore.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    isStatisticallySignificant: isSignificant,
    confidenceInterval95: [ciLow, ciHigh],
    verdict,
    badgeColor
  };
}

/**
 * Get statistical results for an experiment
 */
function getExperimentResults(experimentId) {
  const exp = experimentsMap.get(experimentId);
  if (!exp) throw new Error(`Experiment ${experimentId} not found.`);

  const { queryEvents } = require('./analyticsEventService');
  const { events } = queryEvents({ experimentId, limit: 50000 });

  // Separate exposures and outcomes by variant
  const variantStats = {
    control: { exposures: 0, clicks: 0, favorites: 0 },
    treatment: { exposures: 0, clicks: 0, favorites: 0 }
  };

  for (const e of events) {
    const vId = e.variantId === 'treatment' ? 'treatment' : 'control';
    if (!variantStats[vId]) variantStats[vId] = { exposures: 0, clicks: 0, favorites: 0 };

    switch (e.eventType) {
      case 'recommendation_impression':
        variantStats[vId].exposures++;
        break;
      case 'recommendation_click':
        variantStats[vId].clicks++;
        break;
      case 'food_added_to_favorites':
        variantStats[vId].favorites++;
        break;
    }
  }

  // Count exposures from dedicated store if events are sparse
  const expExposures = exposuresList.filter(e => e.experimentId === experimentId);
  for (const ex of expExposures) {
    const vId = ex.variantId === 'treatment' ? 'treatment' : 'control';
    if (variantStats[vId] && variantStats[vId].exposures === 0) {
      variantStats[vId].exposures++;
    }
  }

  // Primary metric evaluation (CTR)
  const ctrZTest = calculateTwoProportionZTest(
    variantStats.control.exposures,
    variantStats.control.clicks,
    variantStats.treatment.exposures,
    variantStats.treatment.clicks
  );

  // Secondary metric evaluation (Favorites)
  const favZTest = calculateTwoProportionZTest(
    variantStats.control.exposures,
    variantStats.control.favorites,
    variantStats.treatment.exposures,
    variantStats.treatment.favorites
  );

  return {
    experiment: exp,
    metrics: {
      control: {
        exposures: variantStats.control.exposures,
        clicks: variantStats.control.clicks,
        favorites: variantStats.control.favorites,
        ctr: ctrZTest.controlRate,
        favoriteRate: favZTest.controlRate
      },
      treatment: {
        exposures: variantStats.treatment.exposures,
        clicks: variantStats.treatment.clicks,
        favorites: variantStats.treatment.favorites,
        ctr: ctrZTest.treatmentRate,
        favoriteRate: favZTest.treatmentRate
      }
    },
    primaryAnalysis: {
      metric: 'Recommendation Click-Through Rate (CTR)',
      ...ctrZTest
    },
    secondaryAnalysis: {
      metric: 'Favorite Conversion Rate',
      ...favZTest
    },
    dataFreshness: new Date().toISOString()
  };
}

/**
 * Create a new experiment
 */
function createExperiment(data) {
  const { name, description, trafficAllocation = 50, primaryMetric = 'ctr' } = data;
  if (!name || !name.trim()) throw new Error('Experiment name is required.');

  const id = `exp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const newExp = {
    id,
    name: name.trim(),
    description: description || '',
    status: 'draft',
    trafficAllocation: Number(trafficAllocation) || 50,
    primaryMetric,
    secondaryMetrics: ['favorite_conversion'],
    variants: [
      { id: 'control', name: 'Control (Standard)', allocation: 100 - (Number(trafficAllocation) || 50), strategy: 'preference_based' },
      { id: 'treatment', name: 'Treatment (Alternative)', allocation: Number(trafficAllocation) || 50, strategy: 'context_aware' }
    ],
    createdAt: new Date().toISOString(),
    activatedAt: null,
    completedAt: null
  };

  experimentsMap.set(id, newExp);
  persistExperiments();
  return newExp;
}

/**
 * Transition experiment lifecycle state (draft -> active -> paused -> completed -> archived)
 */
function updateExperimentStatus(experimentId, newStatus) {
  const exp = experimentsMap.get(experimentId);
  if (!exp) throw new Error(`Experiment ${experimentId} not found.`);

  const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid experiment status: ${newStatus}`);
  }

  exp.status = newStatus;
  if (newStatus === 'active' && !exp.activatedAt) {
    exp.activatedAt = new Date().toISOString();
  }
  if (newStatus === 'completed' || newStatus === 'archived') {
    exp.completedAt = new Date().toISOString();
  }

  experimentsMap.set(experimentId, exp);
  persistExperiments();
  return exp;
}

/**
 * List all experiments
 */
function getAllExperiments() {
  return Array.from(experimentsMap.values());
}

/**
 * Get active experiment for runtime recommendation assignment
 */
function getActiveExperiment() {
  for (const exp of experimentsMap.values()) {
    if (exp.status === 'active') return exp;
  }
  return null;
}

module.exports = {
  assignVariant,
  recordExposure,
  calculateTwoProportionZTest,
  getExperimentResults,
  createExperiment,
  updateExperimentStatus,
  getAllExperiments,
  getActiveExperiment
};
