// ─────────────────────────────────────────────────────────────
//  functions/index.js
//  Cloud Functions for Firebase (v2 API)
//  Unified serverless notifications & Daily Suggestions engine
// ─────────────────────────────────────────────────────────────

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Initialize Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Global configuration: limit scale for cost control
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

// ── DEFAULT NOTIFICATION PREFERENCES ─────────────────────────
const DEFAULT_PREFERENCES = {
  dailySuggestions: true,
  frequency: "daily",
  deliveryTime: "07:00",
  loginAlerts: true,
  securityEmails: true,
  marketingEmails: false
};

// ── GET USER PREFERENCES HELPER ─────────────────────────────
async function checkPreferences(userId) {
  try {
    const docRef = admin.firestore().collection("users").doc(userId).collection("settings").doc("preferences");
    const snap = await docRef.get();
    if (snap.exists) {
      return { ...DEFAULT_PREFERENCES, ...snap.data() };
    }
  } catch (err) {
    logger.warn(`Failed to fetch custom preferences for user ${userId}, using defaults:`, err.message);
  }
  return DEFAULT_PREFERENCES;
}

// ── NODEMAILER TRANSPORTER BUILDER ──────────────────────────
async function createTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || "foodiebite881@gmail.com";
  const rawPass = process.env.SMTP_PASS ? String(process.env.SMTP_PASS).trim().replace(/\s+/g, '') : '';

  if (host && user && rawPass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass: rawPass },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });
  }

  // Fallback to Ephemeral Ethereal test transporter for seamless local & manual verification
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
}

// ── LOG EMAIL HISTORY HELPER ────────────────────────────────
async function logEmailHistory(userId, emailType, subject, status, details = {}) {
  try {
    const ref = admin.firestore().collection("users").doc(userId).collection("emailHistory").doc();
    const historyItem = {
      timestamp: new Date().toISOString(),
      emailType,
      subject,
      deliveryStatus: status,
      ...details
    };
    await ref.set(historyItem);

    // Update global analytics document
    const analyticsRef = admin.firestore().collection("analytics").doc("emailStats");
    await admin.firestore().runTransaction(async (transaction) => {
      const snap = await transaction.get(analyticsRef);
      const data = snap.exists ? snap.data() : { sent: 0, failed: 0, opened: 0 };
      if (status === "success") {
        data.sent += 1;
      } else {
        data.failed += 1;
      }
      transaction.set(analyticsRef, data, { merge: true });
    });
  } catch (err) {
    logger.error("Failed to log email history receipt:", err.message);
  }
}

// ═════════════════════════════════════════════════════════════
//  1. ON ACTIVITY LOG CREATED (Signup Welcome & Security Reset Emails)
// ═════════════════════════════════════════════════════════════
exports.onActivityLogCreated = onDocumentCreated("users/{userId}/activityLogs/{logId}", async (event) => {
  const userId = event.params.userId;
  const logData = event.data.data();
  if (!logData) return;

  const emailType = logData.type; // "signup" or "password_reset"
  const email = logData.email || "";

  try {
    const preferences = await checkPreferences(userId);
    const transporter = await createTransporter();
    const fromAddress = process.env.SMTP_FROM || '"FoodieBite Support" <support@foodiebite.com>';

    if (emailType === "signup") {
      // Deprecated in favor of the new sendWelcomeEmail Firestore onDocumentCreated trigger
      logger.info(`Signup activity log recorded for user ${userId}. Legacy welcome email dispatch skipped.`);
    } 
        <div style="background-color: #12141a; color: #fff; padding: 30px; font-family: sans-serif; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); max-width: 600px; margin: 0 auto;">
          <h1 style="color: #FF6B35; margin: 0 0 16px 0;">Welcome to FoodieBite! 🍏</h1>
          <p>Hi <strong>${logData.name || "FoodieBite User"}</strong>,</p>
          <p>Thank you for creating an account on FoodieBite! We are excited to support you on your daily wellness and nutrition journey.</p>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0;" />
          <p style="font-size: 13px; color: #888;">
            <strong>Account Email:</strong> ${email}<br/>
            <strong>Registration Date:</strong> ${new Date(logData.timestamp).toLocaleString()}
          </p>
          <p style="font-size: 12px; color: #555; margin-top: 24px;">
            <strong>Security Notice:</strong> Keep your credentials secure. If you did not register for this account, please ignore this email.
          </p>
        </div>
      `;

      const info = await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        html: htmlContent
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(`Signup Welcome email sent! previewUrl: ${previewUrl || "N/A"}`);
      // Clean up log is done
    } 
    
    else if (emailType === "password_reset") {
      // Respect optional security emails setting
      if (preferences.securityEmails === false) {
        logger.info(`Skipping password reset security email notification due to settings for: ${userId}`);
        return;
      }

      logger.info(`Sending password reset security alert to: ${email}`);
      const subject = "Password Reset Requested";
      const htmlContent = `
        <div style="background-color: #12141a; color: #fff; padding: 30px; font-family: sans-serif; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff4d6d; margin: 0 0 16px 0;">Security Alert: Password Reset</h2>
          <p>We received a request to reset the password associated with your FoodieBite account.</p>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0;" />
          <p style="font-size: 13px; color: #cbd5e1;">
            <strong>Request Time:</strong> ${new Date(logData.timestamp).toLocaleString()}<br/>
            <strong>Email Address:</strong> ${email}
          </p>
          <p style="font-size: 12px; color: #ff4d6d; margin-top: 20px; font-weight: bold;">
            If you did not make this request, please reset your password immediately inside the app or contact support.
          </p>
        </div>
      `;

      const info = await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        html: htmlContent
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(`Password reset warning email sent! previewUrl: ${previewUrl || "N/A"}`);
      await logEmailHistory(userId, "security_alert", subject, "success", { previewUrl });
    }
  } catch (error) {
    logger.error(`Failed to dispatch activity log email for ${userId}:`, error);
    await logEmailHistory(userId, emailType, "Failed Dispatch", "failed", { error: error.message });
  }
});

// ═════════════════════════════════════════════════════════════
//  2. ON LOGIN HISTORY CREATED (Login Alert Warning Emails)
// ═════════════════════════════════════════════════════════════
exports.onLoginHistoryCreated = onDocumentCreated("users/{userId}/loginHistory/{loginId}", async (event) => {
  const userId = event.params.userId;
  const loginData = event.data.data();
  if (!loginData) return;

  try {
    const preferences = await checkPreferences(userId);
    // Strict Toggle Check
    if (preferences.loginAlerts === false) {
      logger.info(`Skipping login alert email notification due to settings for: ${userId}`);
      return;
    }

    const userSnap = await admin.firestore().collection("users").doc(userId).get();
    if (!userSnap.exists) return;
    const userData = userSnap.data();

    const email = userData.email;
    logger.info(`Sending successful login notification to: ${email}`);

    const transporter = await createTransporter();
    const fromAddress = process.env.SMTP_FROM || '"FoodieBite Security" <security@foodiebite.com>';
    const subject = "New Login Detected - FoodieBite";

    const htmlContent = `
      <div style="background-color: #12141a; color: #fff; padding: 30px; font-family: sans-serif; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF6B35; margin: 0 0 16px 0;">New Sign-In Detected 🔒</h2>
        <p>Hi <strong>${userData.name || "FoodieBite User"}</strong>,</p>
        <p>A new login was successfully recorded for your FoodieBite account.</p>
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0;" />
        <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
          <strong>Date/Time:</strong> ${new Date(loginData.timestamp).toLocaleString()}<br/>
          <strong>Provider:</strong> ${loginData.provider || "email"}<br/>
          <strong>Device:</strong> ${loginData.deviceInfo || "Unknown Device"}<br/>
          <strong>Browser:</strong> ${loginData.browserInfo || "Unknown Browser"}<br/>
          <strong>Account Email:</strong> ${email}
        </p>
        <p style="font-size: 12px; color: #ff4d6d; margin-top: 24px; font-weight: bold; background: rgba(255,77,109,0.08); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,77,109,0.2);">
          Security Warning: If this was not you, reset your password immediately.
        </p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject,
      html: htmlContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info(`Login warning alert email sent! previewUrl: ${previewUrl || "N/A"}`);
    await logEmailHistory(userId, "login_alert", subject, "success", { previewUrl });
  } catch (error) {
    logger.error(`Failed to dispatch login history email warning for ${userId}:`, error);
  }
});

// ═════════════════════════════════════════════════════════════
//  3. CORE PERSONALIZED HEALTH SUGGESTIONS GENERATOR ENGINE
// ═════════════════════════════════════════════════════════════
function generateHealthPlanHtml(user, settings) {
  const name = user.name || "FoodieBite Champion";
  const age = parseInt(user.age || 28);
  const gender = user.gender || "Female";
  const weight = parseFloat(user.weight || 62); // in kg
  const height = parseFloat(user.height || 165); // in cm
  const activityLevel = user.activityLevel || "Moderate";
  const dietType = user.dietType || "Vegetarian";
  const allergies = user.allergies || [];
  const favoriteFoods = user.favoriteFoods || [];

  // Mifflin-St Jeor Equation for BMR
  let bmr = 0;
  if (gender.toLowerCase().includes("male")) {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // TDEE Activity Multiplier
  let multiplier = 1.375; // Lightly Active default
  if (activityLevel.toLowerCase().includes("sedentary")) multiplier = 1.2;
  else if (activityLevel.toLowerCase().includes("light")) multiplier = 1.375;
  else if (activityLevel.toLowerCase().includes("mod")) multiplier = 1.55;
  else if (activityLevel.toLowerCase().includes("active")) multiplier = 1.725;
  else if (activityLevel.toLowerCase().includes("very")) multiplier = 1.9;

  const tdee = Math.round(bmr * multiplier);
  const proteinTarget = Math.round(weight * (multiplier > 1.5 ? 1.8 : 1.4)); // in grams
  const waterTarget = Math.round((weight * 35) / 1000 * 10) / 10; // in Liters

  // Personalized Meal Plan based on Diet Preference
  let meals = {
    breakfast: "Oatmeal with berries and chia seeds",
    lunch: "Quinoa salad bowl with chickpeas and lemon tahini dressing",
    dinner: "Stir-fried tofu with broccoli and brown rice",
    snack: "Mixed nuts and an apple",
    exercise: "30-minute moderate brisk walk or light jog",
  };

  if (dietType.toLowerCase().includes("vegan")) {
    meals.breakfast = "Chia pudding with coconut milk and fresh strawberries";
    meals.lunch = "Lentil soup with a side of mixed greens";
    meals.dinner = "Tempeh buddha bowl with spinach and sweet potatoes";
    meals.snack = "Pumpkin seeds and carrots with hummus";
  } else if (dietType.toLowerCase().includes("egg")) {
    meals.breakfast = "Scrambled eggs with spinach and whole grain toast";
    meals.lunch = "Egg salad wrap with lettuce and bell peppers";
  } else if (dietType.toLowerCase().includes("non")) {
    meals.breakfast = "Avocado toast with poached egg";
    meals.lunch = "Grilled chicken breast with roasted sweet potatoes and asparagus";
    meals.dinner = "Baked salmon with quinoa and steamed green beans";
    meals.snack = "Greek yogurt with blueberries";
    meals.exercise = "45-minute resistance training followed by stretching";
  }

  // Favorite Food Incorporator
  let favSectionHtml = "";
  if (favoriteFoods.length > 0) {
    const favItem = favoriteFoods[Math.floor(Math.random() * favoriteFoods.length)];
    favSectionHtml = `
      <div style="background-color: rgba(255, 107, 53, 0.06); border: 1px solid rgba(255, 107, 53, 0.15); border-radius: 12px; padding: 14px; margin-top: 16px;">
        <span style="font-size: 13px; font-weight: 700; color: #FF6B35; display: block; margin-bottom: 4px;">💡 Favorite Food Integration</span>
        <span style="font-size: 12px; color: #cbd5e1;">Enjoy your favorite <strong>${favItem.name || favItem.product_name || "food"}</strong> in moderation today! Try pairing it with a high-protein side to balance your macronutrient profile.</span>
      </div>
    `;
  }

  // Pre-flight check: Strip marketing if settings.marketingEmails is false
  const showMarketing = settings.marketingEmails !== false;
  
  let marketingHtml = "";
  if (showMarketing) {
    marketingHtml = `
      <!-- Recipe of the Day -->
      <h3 style="color: #ffffff; margin: 24px 0 12px 0; font-size: 15px; font-weight: 700; border-bottom: 1px solid #2e3440; padding-bottom: 6px;">🥑 Healthy Recipe of the Day</h3>
      <div style="background-color: #1e222b; border: 1px solid #2e3440; border-radius: 12px; padding: 14px;">
        <h4 style="color: #FF6B35; margin: 0 0 6px 0; font-size: 14px;">Avocado & Chickpea Green Salad Bowl</h4>
        <p style="color: #cbd5e1; margin: 0; font-size: 12px; line-height: 1.5;">Mash avocado with fresh lemon juice, olive oil, salt, and pepper. Toss in rinsed canned chickpeas, chopped cucumbers, cherry tomatoes, and baby spinach for an immediate high-protein, heart-healthy fiber bowl.</p>
      </div>

      <!-- Seasonal & Weather Suggestions -->
      <h3 style="color: #ffffff; margin: 24px 0 12px 0; font-size: 15px; font-weight: 700; border-bottom: 1px solid #2e3440; padding-bottom: 6px;">🌦️ Weather-Theme Health Tip</h3>
      <p style="color: #cbd5e1; margin: 0; font-size: 12px; line-height: 1.5;">It is a warm and dry season! Hydration is vital for muscle repair and joint lubrication. Sip water consistently throughout your day, aiming to hit your target before 8:00 PM.</p>
      
      <!-- Motivational Quote -->
      <p style="color: #8892b0; margin: 24px 0 0 0; font-size: 12px; font-style: italic; text-align: center;">
        "Health is a relationship between you and your body. Nourish it daily."
      </p>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Daily FoodieBite Health Plan</title>
</head>
<body style="margin: 0; padding: 0; background-color: #171a20; font-family: sans-serif; color: #fff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #171a20; padding: 20px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #12141a; border-radius: 20px; border: 1px solid #2e3440; overflow: hidden; padding: 24px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); padding: 28px; text-align: center; border-radius: 14px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">FoodieBite Plan 🍎</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Bespoke Nutritional AI Coaching</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 0 0 0;">
              <h2 style="color: #ffffff; margin: 0 0 6px 0; font-size: 18px;">Good Morning ${name}! 👋</h2>
              <p style="color: #8892b0; margin: 0 0 20px 0; font-size: 13px;">Here is your highly personalized, scientifically calculated daily biological profile and diet suggestions.</p>
            </td>
          </tr>

          <!-- TDEE Calorie Board -->
          <tr>
            <td>
              <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <div style="flex: 1; background-color: #1e222b; border: 1px solid #2e3440; border-radius: 12px; padding: 14px; text-align: center;">
                  <span style="font-size: 20px; font-weight: 800; color: #FF6B35; display: block;">🔥 ${tdee}</span>
                  <span style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: 700;">Daily Calories</span>
                </div>
                <div style="flex: 1; background-color: #1e222b; border: 1px solid #2e3440; border-radius: 12px; padding: 14px; text-align: center;">
                  <span style="font-size: 20px; font-weight: 800; color: #3b82f6; display: block;">💪 ${proteinTarget}g</span>
                  <span style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: 700;">Protein Target</span>
                </div>
                <div style="flex: 1; background-color: #1e222b; border: 1px solid #2e3440; border-radius: 12px; padding: 14px; text-align: center;">
                  <span style="font-size: 20px; font-weight: 800; color: #10b981; display: block;">💧 ${waterTarget}L</span>
                  <span style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: 700;">Water Intake</span>
                </div>
              </div>
            </td>
          </tr>

          <!-- Suggestions List -->
          <tr>
            <td>
              <h3 style="color: #ffffff; margin: 0 0 12px 0; font-size: 15px; font-weight: 700; border-bottom: 1px solid #2e3440; padding-bottom: 6px;">🍽️ Personalized Meals of the Day</h3>
              <p style="color: #8892b0; margin: -6px 0 16px 0; font-size: 11px;">Formulated for: <strong style="color:#FF6B35;">${dietType}</strong> diet and <strong style="color:#FF6B35;">${activityLevel}</strong> lifestyle.</p>
              
              <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
                <div style="background-color: #1e222b; border-radius: 10px; padding: 12px; border: 1px solid #2e3440;">
                  <strong>🍳 Breakfast:</strong> <span style="color:#cbd5e1;">${meals.breakfast}</span>
                </div>
                <div style="background-color: #1e222b; border-radius: 10px; padding: 12px; border: 1px solid #2e3440;">
                  <strong>🍱 Lunch:</strong> <span style="color:#cbd5e1;">${meals.lunch}</span>
                </div>
                <div style="background-color: #1e222b; border-radius: 10px; padding: 12px; border: 1px solid #2e3440;">
                  <strong>🍲 Dinner:</strong> <span style="color:#cbd5e1;">${meals.dinner}</span>
                </div>
                <div style="background-color: #1e222b; border-radius: 10px; padding: 12px; border: 1px solid #2e3440;">
                  <strong>🍎 Snack:</strong> <span style="color:#cbd5e1;">${meals.snack}</span>
                </div>
                <div style="background-color: #1e222b; border-radius: 10px; padding: 12px; border: 1px solid #2e3440;">
                  <strong>🏃 Exercise suggestion:</strong> <span style="color:#cbd5e1;">${meals.exercise}</span>
                </div>
              </div>

              ${favSectionHtml}

              ${marketingHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0 0 0; text-align: center; border-top: 1px solid #2e3440; margin-top: 24px;">
              <p style="color: #444b5a; font-size: 10px; margin: 0;">This email was sent dynamically based on your suggestions scheduling inside FoodieBite.</p>
              <p style="color: #444b5a; font-size: 10px; margin: 6px 0 0 0;">To disable, turn off suggestions in your <a href="#" style="color:#FF6B35; text-decoration:none;">Profile Settings</a>.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ═════════════════════════════════════════════════════════════
//  4. INTERACTIVE TEST SUGGESTION DISPATCHER (HTTPS TRIGGER)
// ═════════════════════════════════════════════════════════════
exports.sendTestSmartNutritionEmail = onRequest({ cors: true }, async (req, res) => {
  try {
    logger.info("Test Smart Nutrition Suggestions email triggered");

    // 1. Verify Authentication token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Unauthorized. Missing ID token." });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // 2. Fetch full user document
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, message: "User document not found in database." });
      return;
    }
    const userData = userDoc.data();

    // 3. Extract favorites directly from the user document array
    const favoriteFoods = userData.favoriteFoods || [];
    const completeUserData = { ...userData, favoriteFoods };

    // 4. Fetch notification settings
    const settings = await checkPreferences(userId);

    // Strict Check: Abort sending completely if dailySuggestions is turned off or frequency is set to never
    if (settings.dailySuggestions === false || settings.frequency === "never") {
      res.status(400).json({ 
        success: false, 
        message: "Suggestions are currently disabled in your Notification Settings. Change preferences to enable." 
      });
      return;
    }

    // 5. Generate and dispatch health plan email
    const subject = "Your Daily FoodieBite Health Plan 🍎";
    const htmlContent = generateHealthPlanHtml(completeUserData, settings);
    const transporter = await createTransporter();
    const fromAddress = process.env.SMTP_FROM || '"FoodieBite Coach" <coach@foodiebite.com>';

    const info = await transporter.sendMail({
      from: fromAddress,
      to: userData.email,
      subject,
      html: htmlContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info(`Test Health Plan suggestions email dispatched! MessageId: ${info.messageId}`);
    
    // Log to emailHistory
    await logEmailHistory(userId, "daily_suggestions", subject, "success", { previewUrl });

    res.status(200).json({
      success: true,
      message: "Personalized Daily suggestions email sent successfully!",
      previewUrl: previewUrl || null
    });
  } catch (error) {
    logger.error("Error dispatching test suggestions email:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═════════════════════════════════════════════════════════════
//  5. SCHEDULER: HOURLY SUGGESTIONS DISPATCH CRON JOB
// ═════════════════════════════════════════════════════════════
exports.dailyNutritionDispatcher = onSchedule("0 * * * *", async (event) => {
  try {
    const currentHourString = new Date().toISOString().substring(11, 13) + ":00"; // e.g. "07:00"
    logger.info(`Starting daily suggestions dispatcher cron for scheduled hour: ${currentHourString}`);

    // Query active users
    const usersSnap = await admin.firestore().collection("users").get();
    
    let processedCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      if (!userData.email) continue;

      // Check user preferences
      const settings = await checkPreferences(userId);

      // Rule 1: Abort if dailySuggestions is false
      if (settings.dailySuggestions === false) continue;

      // Rule 2: Abort if frequency is never
      if (settings.frequency === "never") continue;

      // Hour Match Check
      if (settings.deliveryTime !== currentHourString) continue;

      // Generate personalization parameters directly from the user document array
      const favoriteFoods = userData.favoriteFoods || [];
      const completeUserData = { ...userData, favoriteFoods };

      const subject = "Your Daily FoodieBite Health Plan 🍎";
      const htmlContent = generateHealthPlanHtml(completeUserData, settings);
      const transporter = await createTransporter();
      const fromAddress = process.env.SMTP_FROM || '"FoodieBite Coach" <coach@foodiebite.com>';

      try {
        const info = await transporter.sendMail({
          from: fromAddress,
          to: userData.email,
          subject,
          html: htmlContent
        });
        
        const previewUrl = nodemailer.getTestMessageUrl(info);
        await logEmailHistory(userId, "daily_suggestions", subject, "success", { previewUrl });
        processedCount++;
      } catch (sendErr) {
        logger.error(`Failed to send daily scheduled email to ${userData.email}:`, sendErr.message);
        await logEmailHistory(userId, "daily_suggestions", subject, "failed", { error: sendErr.message });
      }
    }

    logger.info(`Scheduled daily nutrition suggestions run complete. Dispatched emails to ${processedCount} users.`);
  } catch (error) {
    logger.error("Error running hourly suggestions dispatcher:", error);
  }
});

// ═════════════════════════════════════════════════════════════
//  6. SECURE LOGGED-OUT PASSWORD RESET SECURITY ALERT TRIGGER
// ═════════════════════════════════════════════════════════════
exports.sendPasswordResetAlert = onRequest({ cors: true }, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: "Email is required." });
      return;
    }

    // Lookup user by email securely
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email.toLowerCase().trim());
    } catch (err) {
      // Abort silently without revealing email existence (security best practice)
      res.status(200).json({ success: true });
      return;
    }

    const userId = userRecord.uid;

    // Push security log via Admin SDK (bypasses client security restrictions)
    const ref = admin.firestore().collection("users").doc(userId).collection("activityLogs").doc();
    await ref.set({
      type: "password_reset",
      email: email.toLowerCase().trim(),
      timestamp: new Date().toISOString()
    });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error sending password reset warning:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═════════════════════════════════════════════════════════════
//  7. SEND WELCOME EMAIL (Triggered once on user document creation)
// ═════════════════════════════════════════════════════════════
exports.sendWelcomeEmail = onDocumentCreated("users/{userId}", async (event) => {
  const userId = event.params.userId;
  const userData = event.data.data();
  if (!userData) return;

  // Send ONLY ONCE per user
  if (userData.welcomeEmailSent === true) {
    logger.info(`Welcome email already sent for user: ${userId}`);
    return;
  }

  const email = userData.email;
  const name = userData.name || "FoodieBite User";

  try {
    logger.info(`Sending welcome email to: ${email}`);
    const transporter = await createTransporter();
    const fromAddress = process.env.SMTP_FROM || '"FoodieBite Team" <welcome@foodiebite.com>';
    const subject = "Welcome to FoodieBite!";

    const htmlContent = `
      <div style="background-color: #12141a; color: #fff; padding: 30px; font-family: sans-serif; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); max-width: 600px; margin: 0 auto;">
        <h1 style="color: #FF6B35; margin: 0 0 16px 0; font-size: 20px;">Welcome to FoodieBite!</h1>
        <p>Hi ${name},</p>
        <p>Welcome to FoodieBite.</p>
        <p>Thank you for joining our nutrition and wellness platform.</p>
        <p>You can now:</p>
        <ul style="padding-left: 20px; line-height: 1.8;">
          <li>✓ Discover healthier food choices</li>
          <li>✓ Save favorite foods</li>
          <li>✓ Upload medical reports</li>
          <li>✓ Receive personalized health suggestions</li>
          <li>✓ Track your nutrition journey</li>
        </ul>
        <p>We are excited to be part of your health journey.</p>
        <br/>
        <p style="margin: 0; font-weight: bold; color: #FF6B35;">FoodieBite Team</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject,
      html: htmlContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info(`Welcome email successfully sent! previewUrl: ${previewUrl || "N/A"}`);
    
    // Set welcomeEmailSent: true in the user document
    await admin.firestore().collection("users").doc(userId).update({
      welcomeEmailSent: true
    });

    await logEmailHistory(userId, "welcome", subject, "success", { previewUrl });
  } catch (error) {
    logger.error(`Failed to dispatch welcome email for ${userId}:`, error);
    await logEmailHistory(userId, "welcome", "Failed Welcome Dispatch", "failed", { error: error.message });
  }
});

// ═════════════════════════════════════════════════════════════
//  8. SEND DAILY SUGGESTIONS (HTTPS onRequest trigger for user health recommendations)
// ═════════════════════════════════════════════════════════════
exports.sendDailySuggestions = onRequest({ cors: true }, async (req, res) => {
  try {
    logger.info("sendDailySuggestions HTTPS trigger called");

    const { userId } = req.body || {};
    
    let usersQuery;
    if (userId) {
      const doc = await admin.firestore().collection("users").doc(userId).get();
      if (!doc.exists) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }
      usersQuery = [doc];
    } else {
      const snap = await admin.firestore().collection("users").get();
      usersQuery = snap.docs;
    }

    let processedCount = 0;
    let skippedCount = 0;
    const transporter = await createTransporter();
    const fromAddress = process.env.SMTP_FROM || '"FoodieBite Coach" <coach@foodiebite.com>';

    for (const userDoc of usersQuery) {
      const uId = userDoc.id;
      const userData = userDoc.data();
      if (!userData || !userData.email) continue;

      // Fetch preferences from settings subcollection
      const settingsSub = await checkPreferences(uId);
      
      // Resolve daily suggestions flags
      const dailySuggestionsEnabled = 
        (userData.notificationSettings && userData.notificationSettings.dailySuggestions === true) || 
        settingsSub.dailySuggestions === true;

      const emailNotificationsEnabled = 
        (userData.preferences && userData.preferences.emailNotifications === true) ||
        (userData.preferences && userData.preferences.emailNotifications !== false); // fallback default to true

      // If notifications are OFF: DO NOT SEND EMAILS
      if (!dailySuggestionsEnabled && !emailNotificationsEnabled) {
        logger.info(`Skipping daily suggestions for user ${uId} because notifications are OFF`);
        skippedCount++;
        continue;
      }

      // Generate personalization parameters
      const favoriteFoods = userData.favoriteFoods || [];
      const completeUserData = { ...userData, favoriteFoods };

      const subject = "Your Daily FoodieBite Health Plan 🍎";
      const htmlContent = generateHealthPlanHtml(completeUserData, settingsSub);

      try {
        const info = await transporter.sendMail({
          from: fromAddress,
          to: userData.email,
          subject,
          html: htmlContent
        });
        
        const previewUrl = nodemailer.getTestMessageUrl(info);
        await logEmailHistory(uId, "daily_suggestions", subject, "success", { previewUrl });
        processedCount++;
      } catch (sendErr) {
        logger.error(`Failed to send daily suggestions email to ${userData.email}:`, sendErr.message);
        await logEmailHistory(uId, "daily_suggestions", subject, "failed", { error: sendErr.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Daily suggestions processing complete. Dispatched: ${processedCount}, Skipped: ${skippedCount}`
    });
  } catch (error) {
    logger.error("Error in sendDailySuggestions trigger:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ═════════════════════════════════════════════════════════════
//  9. DEFICIENCY DETECTION TRIGGER (HTTPS TRIGGER)
// ═════════════════════════════════════════════════════════════
exports.detectUserDeficiencies = onRequest({ cors: true }, async (req, res) => {
  try {
    logger.info("detectUserDeficiencies triggered");

    // 1. Authenticate Request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Unauthorized. Missing token." });
      return;
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, message: "User profile not found." });
      return;
    }
    const userData = userDoc.data();
    const weight = parseFloat(userData.weight || "70");

    // 2. Fetch Meal Logs for past 14 Days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);
    const cutoffIso = cutoffDate.toISOString();

    const logsSnap = await admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("mealLogs")
      .where("loggedAt", ">=", cutoffIso)
      .get();

    // Sum up nutrient values
    let totals = { protein: 0, iron: 0, calcium: 0, fiber: 0 };
    let loggedDays = new Set();

    logsSnap.forEach(doc => {
      const data = doc.data();
      const dateStr = (data.loggedAt || "").split("T")[0];
      loggedDays.add(dateStr);

      totals.protein += data.protein || 0;
      totals.iron += data.iron || 0;
      totals.calcium += data.calcium || 0;
      totals.fiber += data.fiber || 0;
    });

    const activeDays = loggedDays.size || 1;
    const averages = {
      protein: totals.protein / activeDays,
      iron: totals.iron / activeDays,
      calcium: totals.calcium / activeDays,
      fiber: totals.fiber / activeDays
    };

    // Standard daily RDAs
    const rda = {
      protein: Math.max(46, weight * 0.8), // standard g based on body weight
      iron: userData.gender?.toLowerCase().includes("female") ? 18 : 8, // in mg
      calcium: 1000, // in mg
      fiber: 25 // in g
    };

    const deficienciesAlerts = [];
    const deficienciesRef = admin.firestore().collection("users").doc(userId).collection("deficiencies");

    // Check each target nutrient
    for (const nutrient of ["protein", "iron", "calcium", "fiber"]) {
      const avg = averages[nutrient];
      const target = rda[nutrient];
      const percentage = (avg / target) * 100;

      const querySnap = await deficienciesRef.where("nutrient", "==", nutrient).where("resolved", "==", false).get();

      if (percentage < 65) {
        // Deficiency detected
        const severity = percentage < 45 ? "CRITICAL" : "WARNING";
        const alertData = {
          nutrient,
          flaggedAt: new Date().toISOString(),
          averageIntake: Math.round(avg * 10) / 10,
          requiredRda: Math.round(target * 10) / 10,
          severity,
          resolved: false
        };

        if (querySnap.empty) {
          // Log a new deficiency alert
          const newDocRef = deficienciesRef.doc();
          await newDocRef.set({ id: newDocRef.id, ...alertData });
          deficienciesAlerts.push({ nutrient, action: "CREATED", severity });
        } else {
          // Update existing deficiency severity
          const docId = querySnap.docs[0].id;
          await deficienciesRef.doc(docId).update({ severity, averageIntake: Math.round(avg * 10) / 10 });
          deficienciesAlerts.push({ nutrient, action: "UPDATED", severity });
        }
      } else {
        // Nutrient intake is healthy. Resolve any existing alerts.
        if (!querySnap.empty) {
          for (const doc of querySnap.docs) {
            await deficienciesRef.doc(doc.id).update({ resolved: true, resolvedAt: new Date().toISOString() });
          }
          deficienciesAlerts.push({ nutrient, action: "RESOLVED" });
        }
      }
    }

    res.status(200).json({
      success: true,
      activeDays,
      averages,
      rda,
      alertsProcessed: deficienciesAlerts
    });
  } catch (error) {
    logger.error("Error in detectUserDeficiencies trigger:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


