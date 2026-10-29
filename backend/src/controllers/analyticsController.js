const admin = require('firebase-admin');

// ── Lazy Firestore getter — never crashes on module load ──────
function getDb() {
  try {
    return admin.firestore();
  } catch (err) {
    console.warn('⚠️ analyticsController: Firestore unavailable:', err.message);
    return null;
  }
}

exports.getAnalyticsSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { range = '7' } = req.query; // '7' or '30' days

    const daysCount = parseInt(range) || 7;
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
    let loggedDaysSet = new Set();
    let waterTarget   = 2500;

    // ── Firestore queries (gracefully skipped if unavailable) ─
    const db = getDb();
    if (db) {
      try {
        // 1. Fetch meal logs
        const logsSnap = await db
          .collection('users').doc(userId)
          .collection('mealLogs')
          .where('loggedAt', '>=', cutoffIso)
          .get();

        logsSnap.forEach(doc => {
          const log = doc.data();
          const dStr = (log.loggedAt || '').split('T')[0];
          if (dailyData[dStr]) {
            dailyData[dStr].calories  += log.calories  || 0;
            dailyData[dStr].protein   += log.protein   || 0;
            dailyData[dStr].carbs     += log.carbs     || 0;
            dailyData[dStr].fat       += log.fat       || 0;
            dailyData[dStr].fiber     += log.fiber     || 0;
            dailyData[dStr].sodium    += log.sodium    || 0;
            dailyData[dStr].sugar     += log.sugar     || 0;
            dailyData[dStr].mealCount += 1;
            if (log.healthScore !== undefined) dailyData[dStr].healthScores.push(log.healthScore);
            totalCalories += log.calories || 0;
            totalProtein  += log.protein  || 0;
            totalCarbs    += log.carbs    || 0;
            totalFat      += log.fat      || 0;
            loggedDaysSet.add(dStr);
          }
        });
      } catch (err) {
        console.warn('⚠️ analyticsController: mealLogs query failed (safe):', err.message);
      }

      // 2. Fetch user water target
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const weight = parseFloat(userDoc.data().weight || '70');
          waterTarget = Math.round(weight * 35); // ml
        }
      } catch (err) {
        console.warn('⚠️ analyticsController: userDoc fetch failed (safe):', err.message);
      }
    } else {
      console.warn('⚠️ analyticsController: Firestore unavailable — returning fallback analytics');
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

    res.status(200).json({
      success: true,
      source: db ? 'firestore' : 'fallback',
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
