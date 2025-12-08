import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@18.5.0';

/**
 * Handle Payment Failure Edge Function
 * 
 * Called by cron job to process accounts with past_due status.
 * Sends warning emails 3 days before lockout and locks accounts after grace period.
 * 
 * Timeline:
 * - Day 0: Payment fails, status becomes past_due, first warning sent
 * - Day 1-2: Reminder emails sent
 * - Day 3: Account locked, all users notified
 * - After payment: Account unlocked automatically via webhook
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRACE_PERIOD_DAYS = 3;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'notifications@send.inbound.services.recouply.ai';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[HANDLE-PAYMENT-FAILURE] ${step}${detailsStr}`);
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    logStep('Skipping email - no RESEND_API_KEY');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Recouply.ai <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logStep('Email send failed', { error });
      return false;
    }

    logStep('Email sent', { to, subject });
    return true;
  } catch (error) {
    logStep('Email error', { error: error instanceof Error ? error.message : error });
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Starting payment failure processing');

    // Get all accounts with past_due subscription status
    const { data: pastDueAccounts, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('id, email, display_name, subscription_status, payment_failure_notice_sent_at, is_account_locked, payment_failure_count')
      .eq('subscription_status', 'past_due');

    if (fetchError) throw fetchError;

    logStep('Found past due accounts', { count: pastDueAccounts?.length || 0 });

    const results = {
      processed: 0,
      warningsSent: 0,
      accountsLocked: 0,
      errors: [] as string[],
    };

    for (const account of pastDueAccounts || []) {
      try {
        const now = new Date();
        const noticeSentAt = account.payment_failure_notice_sent_at 
          ? new Date(account.payment_failure_notice_sent_at) 
          : null;

        // If no notice sent yet, send first warning
        if (!noticeSentAt) {
          logStep('Sending first warning', { accountId: account.id });

          await sendEmail(
            account.email,
            '⚠️ Payment Failed - Action Required',
            `
            <h2>Payment Failed</h2>
            <p>Hi ${account.display_name || 'there'},</p>
            <p>We were unable to process your payment for Recouply.ai. Please update your payment method to avoid service interruption.</p>
            <p><strong>Your account will be locked in ${GRACE_PERIOD_DAYS} days if payment is not received.</strong></p>
            <p><a href="https://recouply.ai/billing" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a></p>
            <p>If you have any questions, please contact support@recouply.ai</p>
            <p>— The Recouply.ai Team</p>
            `
          );

          await supabaseClient
            .from('profiles')
            .update({ 
              payment_failure_notice_sent_at: now.toISOString(),
              payment_failure_count: 1,
            })
            .eq('id', account.id);

          results.warningsSent++;
        } else {
          // Calculate days since first notice
          const daysSinceNotice = Math.floor((now.getTime() - noticeSentAt.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSinceNotice >= GRACE_PERIOD_DAYS && !account.is_account_locked) {
            // Lock the account
            logStep('Locking account', { accountId: account.id, daysSinceNotice });

            await supabaseClient
              .from('profiles')
              .update({ 
                is_account_locked: true,
                account_locked_at: now.toISOString(),
              })
              .eq('id', account.id);

            // Get all team members to notify
            const { data: teamMembers } = await supabaseClient
              .from('account_users')
              .select('profiles:user_id(email, display_name)')
              .eq('account_id', account.id)
              .eq('status', 'active');

            // Send lockout notification to owner
            await sendEmail(
              account.email,
              '🔒 Account Locked - Payment Required',
              `
              <h2>Your Account Has Been Locked</h2>
              <p>Hi ${account.display_name || 'there'},</p>
              <p>Your Recouply.ai account has been locked due to failed payment. All users on your account have lost access.</p>
              <p>To restore access immediately, please update your payment method:</p>
              <p><a href="https://recouply.ai/billing" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Restore Access Now</a></p>
              <p>If you believe this is an error, please contact support@recouply.ai immediately.</p>
              <p>— The Recouply.ai Team</p>
              `
            );

            // Notify all team members
            for (const member of teamMembers || []) {
              const memberProfile = member.profiles as any;
              if (memberProfile?.email && memberProfile.email !== account.email) {
                await sendEmail(
                  memberProfile.email,
                  '⚠️ Recouply.ai Access Suspended',
                  `
                  <h2>Your Access Has Been Suspended</h2>
                  <p>Hi ${memberProfile.display_name || 'there'},</p>
                  <p>Your access to Recouply.ai has been suspended because the account owner's payment has failed.</p>
                  <p>Please contact your account administrator (${account.email}) to resolve this issue.</p>
                  <p>Access will be restored automatically once payment is received.</p>
                  <p>— The Recouply.ai Team</p>
                  `
                );
              }
            }

            results.accountsLocked++;
          } else if (daysSinceNotice < GRACE_PERIOD_DAYS && (account.payment_failure_count || 0) <= daysSinceNotice) {
            // Send daily reminder
            const daysRemaining = GRACE_PERIOD_DAYS - daysSinceNotice;
            
            await sendEmail(
              account.email,
              `⏰ ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} until account lockout`,
              `
              <h2>Payment Still Required</h2>
              <p>Hi ${account.display_name || 'there'},</p>
              <p>This is a reminder that your Recouply.ai payment is still past due.</p>
              <p><strong>Your account will be locked in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} if payment is not received.</strong></p>
              <p><a href="https://recouply.ai/billing" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a></p>
              <p>— The Recouply.ai Team</p>
              `
            );

            await supabaseClient
              .from('profiles')
              .update({ payment_failure_count: daysSinceNotice + 1 })
              .eq('id', account.id);

            results.warningsSent++;
          }
        }

        results.processed++;
      } catch (error) {
        results.errors.push(`Account ${account.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logStep('Processing complete', results);

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
