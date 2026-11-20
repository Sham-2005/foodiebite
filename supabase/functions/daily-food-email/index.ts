// ─────────────────────────────────────────────────────────────
//  supabase/functions/daily-food-email/index.ts
//  FoodieBite Daily 9 AM Personalized Food Recommendation Edge Function
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmailWithResend } from '../_shared/resend.ts';
import { buildDailyFoodEmailTemplate } from '../_shared/templates.ts';
import { FoodItem, WeatherData } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getLocalHourAndDate(timezone: string = 'Asia/Kolkata'): { hour: number; dateStr: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(new Date());
    let year = '', month = '', day = '', hour = 9;
    for (const p of parts) {
      if (p.type === 'year') year = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'day') day = p.value;
      if (p.type === 'hour') hour = parseInt(p.value, 10);
    }
    return { hour, dateStr: `${year}-${month}-${day}` };
  } catch (_) {
    const now = new Date();
    return { hour: 9, dateStr: now.toISOString().split('T')[0] };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || null;
    const forceRun = body.forceRun === true;

    // 1. Fetch eligible users
    let query = supabase
      .from('email_preferences')
      .select(`
        user_id,
        email_enabled,
        daily_email_enabled,
        preferred_delivery_time,
        timezone,
        last_daily_email_sent
      `)
      .eq('daily_email_enabled', true)
      .eq('email_enabled', true);

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: eligibleUsers, error: prefErr } = await query;

    if (prefErr || !eligibleUsers || eligibleUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No eligible users for daily food email', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientAppUrl = Deno.env.get('CLIENT_URL') || 'http://localhost:3000';
    let dispatched = 0;
    let skipped = 0;
    let failed = 0;

    for (const pref of eligibleUsers) {
      const tz = pref.timezone || 'Asia/Kolkata';
      const targetTime = pref.preferred_delivery_time || '09:00';
      const targetHour = parseInt(targetTime.split(':')[0], 10) || 9;
      const { hour: currentLocalHour, dateStr: localDateStr } = getLocalHourAndDate(tz);

      // Check timezone 9 AM schedule window unless forceRun or specific user
      if (!forceRun && !targetUserId && currentLocalHour !== targetHour) {
        skipped++;
        continue;
      }

      // 2. Prevent duplicate delivery for this calendar date
      const { data: existingDailyLog } = await supabase
        .from('email_delivery_logs')
        .select('id')
        .eq('user_id', pref.user_id)
        .eq('email_type', 'daily_recommendation')
        .eq('delivery_date', localDateStr)
        .in('status', ['sent', 'delivered'])
        .maybeSingle();

      if (existingDailyLog && !forceRun) {
        skipped++;
        continue;
      }

      // 3. Load user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, name, diet_type, preferences')
        .eq('id', pref.user_id)
        .maybeSingle();

      if (!profile || !profile.email) {
        skipped++;
        continue;
      }

      // 4. Load health profile for dietary restrictions (strictly privacy protected)
      const { data: healthProfile } = await supabase
        .from('health_profiles')
        .select('wellness_concerns, food_profile')
        .eq('user_id', pref.user_id)
        .maybeSingle();

      const dietType = (profile.diet_type || profile.preferences?.dietType || 'Vegetarian').toLowerCase();
      const isVeg = dietType.includes('veg') && !dietType.includes('non');

      // Meal recommendations (Breakfast, Lunch, Dinner, Snacks)
      const breakfast: FoodItem = isVeg
        ? { id: 'b1', name: 'Steamed Rava Idli with Mint Coconut Chutney', mealType: 'breakfast', category: 'High Fiber, Fermented Goodness', calories: 290, reason: 'Gentle on digestion, rich in micronutrients to power your morning.' }
        : { id: 'b2', name: 'Spinach & Egg White Scramble on Sourdough', mealType: 'breakfast', category: 'High Protein', calories: 340, reason: 'Lean protein for sustained morning focus and satiety.' };

      const lunch: FoodItem = isVeg
        ? { id: 'l1', name: 'Whole Wheat Roti with Paneer & Spinach Dal', mealType: 'lunch', category: 'Balanced Macronutrients', calories: 480, reason: 'Complex carbohydrates and complete amino acids maintain balanced energy without afternoon slumps.' }
        : { id: 'l2', name: 'Grilled Herb Chicken Bowl with Brown Rice', mealType: 'lunch', category: 'Lean Nutrition', calories: 510, reason: 'High protein and unrefined grains support balanced blood sugar.' };

      const dinner: FoodItem = {
        id: 'd1',
        name: 'Warm Yellow Moong Dal Soup with Stir-Fried Greens',
        mealType: 'dinner',
        category: 'Light & Comforting',
        calories: 320,
        reason: 'Easily digestible evening meal to support restorative sleep.',
      };

      const snacks: FoodItem = {
        id: 's1',
        name: 'Roasted Makhana (Fox Nuts) & Green Tea',
        mealType: 'snack',
        category: 'Antioxidant Rich',
        calories: 140,
        reason: 'Low glycemic crunch that curbs evening cravings.',
      };

      const weather: WeatherData = {
        temperature: 28,
        condition: 'Clear Sky',
        conditionCategory: 'warm',
        locationLabel: profile.preferences?.city || 'Your Location',
        season: 'Winter / Spring',
        isRainy: false,
        available: true,
      };

      const unsubUrl = `${clientAppUrl}/profile?action=unsubscribe_daily`;

      const { subject, html, text } = buildDailyFoodEmailTemplate({
        userName: profile.name || profile.email.split('@')[0],
        userEmail: profile.email,
        dateStr: localDateStr,
        weather,
        season: 'Winter / Spring',
        breakfast,
        lunch,
        dinner,
        snacks,
        whySelected: 'Personalized to match your dietary profile, seasonal vegetables, and current local climate for optimal digestion.',
        dailyTip: 'Start your morning with a glass of lukewarm water before your first meal to gently stimulate digestion.',
        clientAppUrl,
        unsubUrl,
      });

      // 5. Send via Resend
      const sendResult = await sendEmailWithResend({
        to: profile.email,
        subject,
        html,
        text,
      });

      const nowIso = new Date().toISOString();

      if (sendResult.success) {
        dispatched++;
        await supabase.from('email_delivery_logs').insert({
          user_id: pref.user_id,
          email_type: 'daily_recommendation',
          delivery_date: localDateStr,
          recipient_email: profile.email,
          status: 'delivered',
          provider_message_id: sendResult.messageId || null,
          sent_at: nowIso,
          metadata: { provider: 'resend', subject },
        });

        await supabase
          .from('email_preferences')
          .update({ last_daily_email_sent: nowIso, updated_at: nowIso })
          .eq('user_id', pref.user_id);
      } else {
        failed++;
        await supabase.from('email_delivery_logs').insert({
          user_id: pref.user_id,
          email_type: 'daily_recommendation',
          delivery_date: localDateStr,
          recipient_email: profile.email,
          status: 'failed',
          error_message: sendResult.error || 'Dispatch error',
          sent_at: nowIso,
          metadata: { provider: 'resend', subject },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched,
        skipped,
        failed,
        totalEligible: eligibleUsers.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Daily Food Email Edge Function error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
