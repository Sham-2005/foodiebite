// ─────────────────────────────────────────────────────────────
//  supabase/functions/_shared/resend.ts
//  Secure Resend Email Dispatcher for Supabase Edge Functions
// ─────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmailWithResend(options: SendEmailOptions): Promise<SendEmailResponse> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured in Supabase Secrets',
    };
  }

  const sender = options.from || Deno.env.get('RESEND_FROM') || 'FoodieBite <onboarding@resend.dev>';
  const cleanTo = options.to.trim().toLowerCase();

  const payload: Record<string, any> = {
    from: sender,
    to: [cleanTo],
    subject: options.subject,
    html: options.html,
  };

  if (options.text) {
    payload.text = options.text;
  }
  if (options.replyTo) {
    payload.reply_to = options.replyTo;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.message || `Resend dispatch failed with status ${res.status}`,
      };
    }

    return {
      success: true,
      messageId: data.id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network exception during Resend dispatch',
    };
  }
}
