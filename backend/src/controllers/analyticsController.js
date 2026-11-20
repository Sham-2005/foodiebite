// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/analyticsController.js
//  FoodieBite Nutrition & Meal Analytics (Strict Supabase PostgreSQL)
// ─────────────────────────────────────────────────────────────

'use strict';

const { getUserSupabaseClient, getSupabaseClient, getSupabaseAdmin } = require('../config/supabase');

exports.getAnalyticsSummary = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const { range = '7' } = req.query; // '7' or '30' days
    const daysCount = parseInt(range, 10) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysCount);
    const cutoffIso = cutoffDate.toISOString();

    // ── Build empty day buckets ───────────────────────────────
    const dailyData = {};
    const dateList = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      dateList.push(dStr);
      dailyData[dStr] = {
        date: dStr,
        calories: 0, protein: 0, carbs: 0,
        fat: 0, fiber: 0, sodium: 0, sugar: 0,
        healthScores: [], mealCount: 0
      };
    }

    let totalCalories = 0;
    let totalProtein  = 0;
    let totalCarbs    = 0;
    let totalFat      = 0;
    const loggedDaysSet = new Set();
    let waterTarget   = 2500;

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      try {
        // 1. Fetch meal logs from Supabase public.user_meal_logs
        const { data: logs, error: logsErr } = await client
          .from('user_meal_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('logged_at', cutoffIso);

        if (!logsErr && logs) {
          logs.forEach(log => {
            const loggedTime = log.logged_at || log.created_at || '';
            const dStr = loggedTime.split('T')[0];
            if (dailyData[dStr]) {
              const nutrition = log.nutrition || {};
              const calories = Number(log.calories || nutrition.calories || 0);
              const protein = Number(log.protein || nutrition.protein || 0);
              const carbs = Number(log.carbs || nutrition.carbs || 0);
              const fat = Number(log.fat || nutrition.fat || 0);
              const fiber = Number(nutrition.fiber || 0);
              const sodium = Number(nutrition.sodium || 0);
              const sugar = Number(nutrition.sugar || 0);
              const healthScore = log.health_score !== undefined ? log.health_score : log.healthScore;

              dailyData[dStr].calories += calories;
              dailyData[dStr].protein  += protein;
              dailyData[dStr].carbs    += carbs;
              dailyData[dStr].fat      += fat;
              dailyData[dStr].fiber    += fiber;
              dailyData[dStr].sodium   += sodium;
              dailyData[dStr].sugar    += sugar;
              dailyData[dStr].mealCount += 1;

              if (healthScore !== undefined && healthScore !== null) {
                dailyData[dStr].healthScores.push(Number(healthScore));
              }

              totalCalories += calories;
              totalProtein  += protein;
              totalCarbs    += carbs;
              totalFat      += fat;
              loggedDaysSet.add(dStr);
            }
          });
        }
      } catch (err) {
        console.warn('⚠️ [analyticsController] user_meal_logs query note:', err.message);
      }

      // 2. Fetch user profile for weight/water target
      try {
        const { data: profile } = await client
          .from('profiles')
          .select('weight, preferences')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          const weight = parseFloat(profile.weight || profile.preferences?.weight || '70');
          waterTarget = Math.round(weight * 35); // ml
        }
      } catch (err) {
        console.warn('⚠️ [analyticsController] profile fetch note:', err.message);
      }
    }

    // ── Build chart data ──────────────────────────────────────
    const chartData = dateList.map(date => {
      const day = dailyData[date];
      const scores = day.healthScores;
      const avgScore = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0;
      return {
        date,
        calories: Math.round(day.calories),
        protein:  Math.round(day.protein  * 10) / 10,
        carbs:    Math.round(day.carbs    * 10) / 10,
        fat:      Math.round(day.fat      * 10) / 10,
        fiber:    Math.round(day.fiber    * 10) / 10,
        sodium:   Math.round(day.sodium),
        sugar:    Math.round(day.sugar    * 10) / 10,
        averageHealthScore: avgScore,
        mealCount: day.mealCount
      };
    });

    const activeDays = loggedDaysSet.size || 1;

    return res.status(200).json({
      success: true,
      source: 'supabase',
      range: daysCount,
      summary: {
        avgDailyCalories: Math.round(totalCalories / activeDays),
        avgDailyProtein:  Math.round((totalProtein  / activeDays) * 10) / 10,
        avgDailyCarbs:    Math.round((totalCarbs    / activeDays) * 10) / 10,
        avgDailyFat:      Math.round((totalFat      / activeDays) * 10) / 10,
        waterTargetMl: waterTarget
      },
      chartData
    });
  } catch (err) {
    next(err);
  }
};
