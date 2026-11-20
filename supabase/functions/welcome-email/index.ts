// ─────────────────────────────────────────────────────────────
//  supabase/functions/welcome-email/index.ts
//  FoodieBite Welcome Email Supabase Edge Function
//  Triggered on user account creation & onboarding completion
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmailWithResend } from '../_shared/resend.ts';
import { buildWelcomeEmailTemplate } from '../_shared/templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { userId, email, name, preferences } = body;

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check duplicate prevention in email_preferences
    const { data: prefData } = await supabase
      .from('email_preferences')
      .select('welcome_email_sent, email_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefData?.welcome_email_sent === true) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'welcome_email_already_sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check duplicate prevention in email_delivery_logs
    const { data: existingLog } = await supabase
      .from('email_delivery_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('email_type', 'welcome')
      .in('status', ['sent', 'delivered'])
      .maybeSingle();

    if (existingLog) {
      // Ensure email_preferences flag is synced
      await supabase
        .from('email_preferences')
        .update({ welcome_email_sent: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'welcome_delivery_log_exists' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Assemble personalized content
    const clientAppUrl = Deno.env.get('CLIENT_URL') || 'http://localhost:3000';
    const dietType = preferences?.dietType || 'Balanced';
    const userName = name || email.split('@')[0] || 'Friend';

    const { subject, html, text } = buildWelcomeEmailTemplate({
      userName,
      userEmail: email,
      dietType,
      season: 'Autumn / Winter',
      clientAppUrl,
    });

    // 4. Send email via Resend
    const sendResult = await sendEmailWithResend({
      to: email,
      subject,
      html,
      text,
    });

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    // 5. Log delivery and update state
    if (sendResult.success) {
      // Log successful delivery
      await supabase.from('email_delivery_logs').insert({
        user_id: userId,
        email_type: 'welcome',
        delivery_date: todayDate,
        recipient_email: email,
        status: 'delivered',
        provider_message_id: sendResult.messageId || null,
        sent_at: nowIso,
        metadata: { provider: 'resend', subject },
      });

      // Update email_preferences
      await supabase
        .from('email_preferences')
        .upsert({
          user_id: userId,
          welcome_email_sent: true,
          updated_at: nowIso,
        }, { onConflict: 'user_id' });

      return new Response(
        JSON.stringify({ success: true, messageId: sendResult.messageId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Log failure
      await supabase.from('email_delivery_logs').insert({
        user_id: userId,
        email_type: 'welcome',
        delivery_date: todayDate,
        recipient_email: email,
        status: 'failed',
        error_message: sendResult.error || 'Unknown dispatch failure',
        sent_at: nowIso,
        metadata: { provider: 'resend', subject },
      });

      return new Response(
        JSON.stringify({ success: false, error: sendResult.error }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal Edge Function Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
