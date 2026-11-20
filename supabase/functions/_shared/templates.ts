// ─────────────────────────────────────────────────────────────
//  supabase/functions/_shared/templates.ts
//  FoodieBite Standardized Responsive Email Templates
//  Compliant with Gmail, Apple Mail, Outlook, and mobile clients.
// ─────────────────────────────────────────────────────────────

import { FoodItem, WeatherData } from './types.ts';

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  dietType?: string;
  cuisines?: string[];
  weather?: WeatherData | null;
  season?: string;
  recommendedFoods?: FoodItem[];
  clientAppUrl?: string;
}

export interface DailyFoodEmailData {
  userName: string;
  userEmail: string;
  dateStr: string;
  weather?: WeatherData | null;
  season?: string;
  breakfast: FoodItem;
  lunch: FoodItem;
  dinner: FoodItem;
  snacks?: FoodItem | null;
  whySelected: string;
  dailyTip: string;
  clientAppUrl?: string;
  unsubUrl?: string;
}

/**
 * ─────────────────────────────────────────────────────────────
 * FEATURE 1: WELCOME EMAIL TEMPLATE
 * ─────────────────────────────────────────────────────────────
 */
export function buildWelcomeEmailTemplate(data: WelcomeEmailData) {
  const subject = 'Welcome to FoodieBite! Your personalized food journey begins.';
  const name = escapeHtml(data.userName || 'Food Explorer');
  const clientUrl = data.clientAppUrl || 'http://localhost:3000';
  const diet = escapeHtml(data.dietType || 'Balanced');
  const season = escapeHtml(data.season || 'Current Season');

  const foods = data.recommendedFoods && data.recommendedFoods.length > 0
    ? data.recommendedFoods
    : [
        { id: '1', name: 'Steamed Idli with Sambar', mealType: 'breakfast' as const, category: 'Healthy Indian Breakfast', calories: 280 },
        { id: '2', name: 'Quinoa Veggie Bowl with Avocado', mealType: 'lunch' as const, category: 'Nutrient Dense', calories: 420 },
        { id: '3', name: 'Warm Lentil Soup with Roasted Veggies', mealType: 'dinner' as const, category: 'Comfort Dining', calories: 350 },
      ];

  // Weather section
  let weatherHtml = '';
  let weatherText = '';
  if (data.weather && data.weather.available) {
    weatherHtml = `
      <div style="background-color: #1e2430; border-radius: 12px; padding: 16px 20px; margin: 20px 0; border: 1px solid #2d3748;">
        <p style="margin: 0; color: #f97316; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Today's Climate in ${escapeHtml(data.weather.locationLabel)}</p>
        <p style="margin: 4px 0 0 0; color: #ffffff; font-size: 15px; font-weight: 600;">
          ${data.weather.temperature}°C &bull; ${escapeHtml(data.weather.condition)} &bull; ${season}
        </p>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; line-height: 1.4;">
          Your meal suggestions naturally harmonize with today's weather to keep your digestion light and your energy steady.
        </p>
      </div>
    `;
    weatherText = `\nToday's Climate (${data.weather.locationLabel}): ${data.weather.temperature}°C, ${data.weather.condition} (${season})\n`;
  }

  const foodCardsHtml = foods.map((f, idx) => `
    <div style="background-color: #161b26; border: 1px solid #283042; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <span style="display: inline-block; background-color: rgba(249, 115, 22, 0.15); color: #f97316; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
              ${escapeHtml(f.mealType || 'Handcrafted Pick')}
            </span>
            <h4 style="margin: 6px 0 2px 0; color: #ffffff; font-size: 15px; font-weight: 700;">${escapeHtml(f.name)}</h4>
            <p style="margin: 0; color: #94a3b8; font-size: 12px;">${escapeHtml(f.category || 'Nutrient Balanced')}${f.calories ? ` &bull; ~${f.calories} kcal` : ''}</p>
          </td>
        </tr>
      </table>
    </div>
  `).join('');

  const foodCardsText = foods.map(f => `  - [${(f.mealType || 'pick').toUpperCase()}] ${f.name} (${f.category || 'Healthy'}${f.calories ? `, ~${f.calories} kcal` : ''})`).join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f17; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #121722; border-radius: 16px; border: 1px solid #232c3d; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.45);">
          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px 24px; text-align: center;">
              <div style="font-size: 36px; line-height: 1; margin-bottom: 8px;">🍽️</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FoodieBite</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Smart Personalized Nutrition</p>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="color: #ffffff; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Hello ${name},</h2>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                Welcome to <strong>FoodieBite</strong>! We are delighted to accompany you on your journey toward balanced eating, smart meal planning, and vibrant wellness.
              </p>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                FoodieBite bridges clinical nutrition awareness and daily culinary enjoyment. Whether exploring restaurants, scanning nutrition labels, or tailoring meals to your dietary preferences, your food recommendations are always personalized just for you.
              </p>

              ${weatherHtml}

              <h3 style="color: #f97316; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 24px 0 12px 0;">
                Handpicked Starters for Your Profile (${diet}):
              </h3>
              ${foodCardsHtml}

              <!-- Health and Daily Intro Callout -->
              <div style="background-color: rgba(249, 115, 22, 0.08); border-left: 3px solid #f97316; border-radius: 8px; padding: 14px 18px; margin: 24px 0;">
                <p style="margin: 0 0 6px 0; color: #f97316; font-size: 12px; font-weight: 700; text-transform: uppercase;">Daily 9:00 AM Food Guide</p>
                <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
                  Every morning at <strong>9:00 AM</strong>, FoodieBite curates fresh breakfast, lunch, and dinner suggestions crafted for your current weather and saved dietary preferences. You can customize your delivery time anytime in your Profile.
                </p>
              </div>

              <div style="background-color: #1a202c; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  🔒 <em>Your recommendations consider your saved dietary preferences. FoodieBite safeguards your privacy and never exposes personal health parameters in email communications.</em>
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${clientUrl}/home" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 36px; border-radius: 28px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                  Open FoodieBite &rarr;
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0f17; padding: 20px 28px; text-align: center; border-top: 1px solid #1e2638;">
              <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 0 0 6px 0;">
                FoodieBite provides nutritional insights and suggestions. For medical conditions, always consult a licensed healthcare professional.
              </p>
              <p style="color: #64748b; font-size: 11px; margin: 0;">
                Manage preferences at <a href="${clientUrl}/profile" style="color: #94a3b8; text-decoration: underline;">Profile Settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Welcome to FoodieBite! Your personalized food journey begins.

Hello ${data.userName || 'Food Explorer'},

Thank you for joining FoodieBite! We are delighted to accompany you on your journey toward balanced eating, smart meal planning, and vibrant wellness.

FoodieBite bridges clinical nutrition awareness and daily culinary enjoyment. Your food recommendations are always personalized for your dietary profile (${data.dietType || 'Balanced'}).
${weatherText}
Starter Recommendations For You:
${foodCardsText}

Daily 9:00 AM Recommendation Guide:
Every morning at 9:00 AM, FoodieBite curates fresh breakfast, lunch, and dinner suggestions crafted for your current weather and saved dietary preferences.

Notice: Your recommendations consider your saved dietary preferences. FoodieBite safeguards your privacy and never exposes personal health parameters in email communications.

Start exploring FoodieBite: ${clientUrl}/home

To manage your email preferences or notification delivery time, visit: ${clientUrl}/profile
  `.trim();

  return { subject, html, text };
}

/**
 * ─────────────────────────────────────────────────────────────
 * FEATURE 2: DAILY FOOD RECOMMENDATION EMAIL TEMPLATE
 * ─────────────────────────────────────────────────────────────
 */
export function buildDailyFoodEmailTemplate(data: DailyFoodEmailData) {
  const subject = "Good morning! Here's what you should eat today.";
  const name = escapeHtml(data.userName || 'Foodie');
  const dateFormatted = escapeHtml(data.dateStr);
  const clientUrl = data.clientAppUrl || 'http://localhost:3000';
  const unsubUrl = data.unsubUrl || `${clientUrl}/profile`;
  const season = escapeHtml(data.season || 'Current Season');

  // Weather block
  let weatherHtml = '';
  let weatherText = '';
  if (data.weather && data.weather.available) {
    weatherHtml = `
      <div style="background-color: #1e2430; border-radius: 12px; padding: 14px 18px; margin: 18px 0; border: 1px solid #2d3748;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="color: #ffffff; font-size: 14px; font-weight: 600;">
              🌡️ ${data.weather.temperature}°C &bull; ${escapeHtml(data.weather.condition)} &bull; ${season}
            </td>
            <td align="right" style="color: #94a3b8; font-size: 11px;">
              ${escapeHtml(data.weather.locationLabel)}
            </td>
          </tr>
        </table>
      </div>
    `;
    weatherText = `Climate: ${data.weather.temperature}°C, ${data.weather.condition} in ${data.weather.locationLabel} (${season})\n`;
  } else {
    weatherHtml = `
      <div style="background-color: #1e2430; border-radius: 12px; padding: 12px 18px; margin: 18px 0; border: 1px solid #2d3748;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">Season: ${season} (Live weather currently unavailable)</p>
      </div>
    `;
    weatherText = `Season: ${season}\n`;
  }

  // Meal Cards
  const mealSections = [
    { label: 'Breakfast', icon: '🌅', item: data.breakfast },
    { label: 'Lunch', icon: '☀️', item: data.lunch },
    { label: 'Dinner', icon: '🌙', item: data.dinner },
    ...(data.snacks ? [{ label: 'Snacks / Refreshment', icon: '🍎', item: data.snacks }] : [])
  ];

  const mealCardsHtml = mealSections.map(m => `
    <div style="background-color: #161b26; border: 1px solid #283042; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <span style="display: inline-block; background-color: rgba(249, 115, 22, 0.15); color: #f97316; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
              ${m.icon} ${m.label}
            </span>
            <h3 style="margin: 8px 0 2px 0; color: #ffffff; font-size: 16px; font-weight: 700;">${escapeHtml(m.item.name)}</h3>
            <p style="margin: 0; color: #94a3b8; font-size: 12px;">
              ${escapeHtml(m.item.category || 'Nutrient Balanced')}${m.item.calories ? ` &bull; ~${m.item.calories} kcal` : ''}
            </p>
            ${m.item.reason ? `
              <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 12px; line-height: 1.4;">
                <span style="color: #f97316; font-weight: 600;">Why:</span> ${escapeHtml(m.item.reason)}
              </p>
            ` : ''}
          </td>
        </tr>
      </table>
    </div>
  `).join('');

  const mealCardsText = mealSections.map(m => `
${m.label.toUpperCase()}:
- ${m.item.name} (${m.item.category || 'Balanced'}${m.item.calories ? `, ~${m.item.calories} kcal` : ''})
  Why: ${m.item.reason || 'Nutrient profile matches your daily goals'}
  `.trim()).join('\n\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f17; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #121722; border-radius: 16px; border: 1px solid #232c3d; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.45);">
          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 28px 24px; text-align: center;">
              <span style="font-size: 32px; display: inline-block;">🥗</span>
              <h1 style="color: #ffffff; margin: 4px 0 0 0; font-size: 22px; font-weight: 800;">Daily Food Guide</h1>
              <p style="color: rgba(255,255,255,0.92); margin: 4px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${dateFormatted}</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 24px;">
              <h2 style="color: #ffffff; margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">Good morning ${name},</h2>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0 0 14px 0;">
                Here is your personalized nutrition blueprint for today, tailored to your dietary preferences, today's climate, and wellness goals.
              </p>

              ${weatherHtml}

              <h3 style="color: #f97316; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 12px 0;">
                Recommended Meals For Today:
              </h3>
              ${mealCardsHtml}

              <!-- Why Selected Section -->
              <div style="background-color: rgba(249, 115, 22, 0.08); border-left: 3px solid #f97316; padding: 14px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 4px 0; color: #f97316; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Why These Recommendations?</p>
                <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${escapeHtml(data.whySelected)}</p>
              </div>

              <!-- Daily Tip -->
              <div style="background-color: #1a2232; border-radius: 8px; padding: 14px 18px; margin: 18px 0; border: 1px solid #253348;">
                <p style="margin: 0 0 4px 0; color: #38bdf8; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">💡 Daily Nutrition &amp; Hydration Tip</p>
                <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${escapeHtml(data.dailyTip)}</p>
              </div>

              <div style="background-color: #141923; border-radius: 8px; padding: 10px 14px; margin: 14px 0;">
                <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.4; text-align: center;">
                  🔒 <em>Your recommendations consider your saved dietary preferences. No raw clinical or medical details are ever included in emails.</em>
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${clientUrl}/home" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 32px; border-radius: 24px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);">
                  Explore Recipes &amp; Restaurants &rarr;
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer with Unsubscribe -->
          <tr>
            <td style="background-color: #0b0f17; padding: 20px 24px; text-align: center; border-top: 1px solid #1e2638;">
              <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 0 0 8px 0;">
                You are receiving this daily recommendation because you are subscribed to FoodieBite daily meal guides.
              </p>
              <p style="color: #64748b; font-size: 11px; margin: 0;">
                <a href="${unsubUrl}" style="color: #94a3b8; text-decoration: underline; margin-right: 14px;">Unsubscribe from daily emails</a>
                <a href="${clientUrl}/profile" style="color: #94a3b8; text-decoration: underline;">Update notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Good morning! Here's what you should eat today.
Date: ${data.dateStr}

Hello ${data.userName || 'Foodie'},

Here is your personalized nutrition blueprint for today:
${weatherText}

${mealCardsText}

Why These Recommendations?
${data.whySelected}

Today's Nutrition & Hydration Tip:
${data.dailyTip}

Notice: Your recommendations consider your saved dietary preferences. No raw clinical details are ever included in emails.

Explore on FoodieBite: ${clientUrl}/home

---
To unsubscribe from daily recommendations: ${unsubUrl}
Manage your delivery settings: ${clientUrl}/profile
  `.trim();

  return { subject, html, text };
}
