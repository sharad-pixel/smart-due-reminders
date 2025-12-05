import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DAILY-DIGEST] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep('Starting daily digest generation');

    // Get all active users (users with profiles)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, name')
      .not('email', 'is', null);

    if (usersError) throw usersError;
    logStep('Found users', { count: users?.length });

    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const last7DaysStart = new Date(todayStart);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);
    
    const prev7DaysStart = new Date(last7DaysStart);
    prev7DaysStart.setDate(prev7DaysStart.getDate() - 7);

    const digestsCreated: string[] = [];
    const emailsSent: string[] = [];

    for (const user of users || []) {
      try {
        logStep('Processing user', { userId: user.id, email: user.email });

        // Check if digest already exists for today
        const { data: existingDigest } = await supabase
          .from('daily_digests')
          .select('id')
          .eq('user_id', user.id)
          .eq('digest_date', today)
          .single();

        if (existingDigest) {
          logStep('Digest already exists for user', { userId: user.id });
          continue;
        }

        // TASKS METRICS
        const { data: openTasks } = await supabase
          .from('collection_tasks')
          .select('id, due_date, created_at')
          .eq('user_id', user.id)
          .in('status', ['open', 'in_progress']);

        const openTasksCount = openTasks?.length || 0;
        const overdueTasksCount = openTasks?.filter(t => 
          t.due_date && new Date(t.due_date) < todayStart
        ).length || 0;
        const tasksCreatedToday = openTasks?.filter(t => 
          t.created_at && new Date(t.created_at) >= todayStart
        ).length || 0;

        // AR METRICS
        const { data: invoices } = await supabase
          .from('invoices')
          .select('amount, outstanding_amount, aging_bucket, debtor_id, status')
          .eq('user_id', user.id)
          .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid']);

        let totalArOutstanding = 0;
        let arCurrent = 0;
        let ar1_30 = 0;
        let ar31_60 = 0;
        let ar61_90 = 0;
        let ar91_120 = 0;
        let ar120Plus = 0;

        for (const inv of invoices || []) {
          const amount = Number(inv.outstanding_amount || inv.amount || 0);
          totalArOutstanding += amount;

          switch (inv.aging_bucket) {
            case 'current':
              arCurrent += amount;
              break;
            case 'dpd_1_30':
              ar1_30 += amount;
              break;
            case 'dpd_31_60':
              ar31_60 += amount;
              break;
            case 'dpd_61_90':
              ar61_90 += amount;
              break;
            case 'dpd_91_120':
              ar91_120 += amount;
              break;
            case 'dpd_121_150':
            case 'dpd_150_plus':
              ar120Plus += amount;
              break;
          }
        }

        // PAYMENTS METRICS
        const { data: paymentsToday } = await supabase
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .gte('payment_date', today);

        const paymentsCollectedToday = paymentsToday?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        const { data: paymentsLast7 } = await supabase
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .gte('payment_date', last7DaysStart.toISOString());

        const paymentsCollectedLast7Days = paymentsLast7?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        const { data: paymentsPrev7 } = await supabase
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .gte('payment_date', prev7DaysStart.toISOString())
          .lt('payment_date', last7DaysStart.toISOString());

        const paymentsCollectedPrev7Days = paymentsPrev7?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        // Collection trend
        let collectionTrend = 'flat';
        if (paymentsCollectedLast7Days > paymentsCollectedPrev7Days * 1.1) {
          collectionTrend = 'up';
        } else if (paymentsCollectedLast7Days < paymentsCollectedPrev7Days * 0.9) {
          collectionTrend = 'down';
        }

        // RISK METRICS
        const { data: highRiskDebtors } = await supabase
          .from('debtors')
          .select('id, total_open_balance')
          .eq('user_id', user.id)
          .in('risk_tier', ['High', 'Critical']);

        const highRiskCustomersCount = highRiskDebtors?.length || 0;
        const highRiskDebtorIds = highRiskDebtors?.map(d => d.id) || [];

        let highRiskArOutstanding = 0;
        if (highRiskDebtorIds.length > 0) {
          const { data: highRiskInvoices } = await supabase
            .from('invoices')
            .select('outstanding_amount, amount')
            .eq('user_id', user.id)
            .in('debtor_id', highRiskDebtorIds)
            .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid']);

          highRiskArOutstanding = highRiskInvoices?.reduce((sum, inv) => 
            sum + Number(inv.outstanding_amount || inv.amount || 0), 0) || 0;
        }

        // HEALTH SCORE CALCULATION
        let healthScore = 100;

        // If portion of AR in 60+ > 0.5: -20
        const ar60Plus = ar61_90 + ar91_120 + ar120Plus;
        if (totalArOutstanding > 0 && (ar60Plus / totalArOutstanding) > 0.5) {
          healthScore -= 20;
        }

        // If portion of AR in 90+ > 0.3: -20
        const ar90Plus = ar91_120 + ar120Plus;
        if (totalArOutstanding > 0 && (ar90Plus / totalArOutstanding) > 0.3) {
          healthScore -= 20;
        }

        // If collection_trend = "down": -10
        if (collectionTrend === 'down') {
          healthScore -= 10;
        }

        // If high_risk_ar_outstanding / total_ar_outstanding > 0.3: -20
        if (totalArOutstanding > 0 && (highRiskArOutstanding / totalArOutstanding) > 0.3) {
          healthScore -= 20;
        }

        healthScore = Math.max(0, Math.min(100, healthScore));

        // Health label
        let healthLabel = 'Healthy';
        if (healthScore < 40) {
          healthLabel = 'At Risk';
        } else if (healthScore < 60) {
          healthLabel = 'Stressed';
        } else if (healthScore < 80) {
          healthLabel = 'Caution';
        }

        // Insert digest
        const { error: insertError } = await supabase
          .from('daily_digests')
          .insert({
            user_id: user.id,
            digest_date: today,
            open_tasks_count: openTasksCount,
            overdue_tasks_count: overdueTasksCount,
            tasks_created_today: tasksCreatedToday,
            total_ar_outstanding: totalArOutstanding,
            ar_current: arCurrent,
            ar_1_30: ar1_30,
            ar_31_60: ar31_60,
            ar_61_90: ar61_90,
            ar_91_120: ar91_120,
            ar_120_plus: ar120Plus,
            payments_collected_today: paymentsCollectedToday,
            payments_collected_last_7_days: paymentsCollectedLast7Days,
            payments_collected_prev_7_days: paymentsCollectedPrev7Days,
            collection_trend: collectionTrend,
            high_risk_customers_count: highRiskCustomersCount,
            high_risk_ar_outstanding: highRiskArOutstanding,
            health_score: healthScore,
            health_label: healthLabel,
          });

        if (insertError) {
          logStep('Error inserting digest', { error: insertError.message });
          continue;
        }

        digestsCreated.push(user.id);
        logStep('Digest created for user', { userId: user.id });

        // SEND EMAIL (if user has email)
        if (user.email) {
          try {
            const emailBody = generateEmailHtml({
              name: user.name || 'there',
              openTasksCount,
              overdueTasksCount,
              totalArOutstanding,
              paymentsCollectedToday,
              highRiskArOutstanding,
              highRiskCustomersCount,
              healthScore,
              healthLabel,
            });

            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (resendApiKey) {
              const emailRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
                  to: [user.email],
                  subject: 'Recouply.ai – Your Daily Collections Health Summary',
                  html: emailBody,
                }),
              });

              if (emailRes.ok) {
                await supabase
                  .from('daily_digests')
                  .update({ email_sent_at: new Date().toISOString() })
                  .eq('user_id', user.id)
                  .eq('digest_date', today);
                emailsSent.push(user.id);
                logStep('Email sent to user', { userId: user.id });
              }
            }
          } catch (emailError) {
            logStep('Error sending email', { error: String(emailError) });
          }
        }

      } catch (userError) {
        logStep('Error processing user', { userId: user.id, error: String(userError) });
      }
    }

    logStep('Daily digest generation complete', { 
      digestsCreated: digestsCreated.length, 
      emailsSent: emailsSent.length 
    });

    return new Response(JSON.stringify({
      success: true,
      digestsCreated: digestsCreated.length,
      emailsSent: emailsSent.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Fatal error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateEmailHtml(data: {
  name: string;
  openTasksCount: number;
  overdueTasksCount: number;
  totalArOutstanding: number;
  paymentsCollectedToday: number;
  highRiskArOutstanding: number;
  highRiskCustomersCount: number;
  healthScore: number;
  healthLabel: string;
}): string {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const healthColor = data.healthLabel === 'Healthy' ? '#22c55e' :
    data.healthLabel === 'Caution' ? '#eab308' :
    data.healthLabel === 'Stressed' ? '#f97316' : '#ef4444';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Daily Collections Health Summary</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Your Recouply.ai digest for today</p>
    </div>
    
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #374151; margin: 0 0 24px;">Hi ${data.name},</p>
      
      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <div style="display: inline-block; background: ${healthColor}; color: white; padding: 8px 24px; border-radius: 24px; font-weight: 600; font-size: 18px;">
          ${data.healthLabel} (${data.healthScore}/100)
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1f2937; margin: 0 0 12px; font-size: 16px;">📋 Tasks</h3>
        <p style="color: #6b7280; margin: 0; line-height: 1.6;">
          You have <strong style="color: #1f2937;">${data.openTasksCount}</strong> open tasks
          ${data.overdueTasksCount > 0 ? `(<span style="color: #ef4444;">${data.overdueTasksCount} overdue</span>)` : ''}.
        </p>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1f2937; margin: 0 0 12px; font-size: 16px;">💰 Collections</h3>
        <p style="color: #6b7280; margin: 0; line-height: 1.6;">
          Total AR outstanding: <strong style="color: #1f2937;">${formatCurrency(data.totalArOutstanding)}</strong><br>
          Today's collections: <strong style="color: #22c55e;">${formatCurrency(data.paymentsCollectedToday)}</strong>
        </p>
      </div>
      
      <div style="margin-bottom: 32px;">
        <h3 style="color: #1f2937; margin: 0 0 12px; font-size: 16px;">⚠️ Risk</h3>
        <p style="color: #6b7280; margin: 0; line-height: 1.6;">
          High-risk AR: <strong style="color: #ef4444;">${formatCurrency(data.highRiskArOutstanding)}</strong> across ${data.highRiskCustomersCount} accounts
        </p>
      </div>

      <div style="margin-bottom: 24px; background: #fef3c7; border-radius: 8px; padding: 16px;">
        <h3 style="color: #92400e; margin: 0 0 12px; font-size: 16px;">📰 CFO Cash Flow Insights</h3>
        <ul style="margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8;">
          <li><a href="https://recouply.ai/features" style="color: #b45309;">Automate Your AR with AI Agents →</a></li>
          <li><a href="https://recouply.ai/solutions/saas" style="color: #b45309;">SaaS Revenue Recovery Strategies →</a></li>
          <li><a href="https://recouply.ai/solutions/professional-services" style="color: #b45309;">Professional Services Collections Guide →</a></li>
          <li><a href="https://recouply.ai/enterprise" style="color: #b45309;">Enterprise CashOps Platform Overview →</a></li>
        </ul>
      </div>

      <div style="margin-bottom: 24px; background: #dbeafe; border-radius: 8px; padding: 16px;">
        <h3 style="color: #1e40af; margin: 0 0 12px; font-size: 16px;">🤖 CashOps & AR Automation</h3>
        <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.8;">
          <li><a href="https://recouply.ai/settings/ai-workflows" style="color: #2563eb;">Configure Your AI Collection Agents →</a></li>
          <li><a href="https://recouply.ai/data-center" style="color: #2563eb;">Data Center: Import & Reconcile AR →</a></li>
          <li><a href="https://recouply.ai/debtors" style="color: #2563eb;">Manage Accounts & Risk Scores →</a></li>
          <li><a href="https://recouply.ai/collections/tasks" style="color: #2563eb;">Review Collection Tasks →</a></li>
        </ul>
      </div>

      <div style="margin-bottom: 32px; background: #dcfce7; border-radius: 8px; padding: 16px;">
        <h3 style="color: #166534; margin: 0 0 12px; font-size: 16px;">💡 Collection Best Practices</h3>
        <ul style="margin: 0; padding-left: 20px; color: #15803d; line-height: 1.8; font-size: 14px;">
          <li><strong>Follow up within 3-5 days</strong> of invoice due date for best results</li>
          <li><strong>Segment by risk tier</strong> – prioritize High/Critical accounts first</li>
          <li><strong>Use multiple channels</strong> – email sequences with phone follow-up</li>
          <li><strong>Offer payment plans</strong> for accounts 60+ days past due</li>
          <li><strong>Monitor DSO weekly</strong> – target under 45 days for healthy cash flow</li>
        </ul>
        <p style="margin: 12px 0 0; color: #166534; font-size: 13px; font-style: italic;">
          💎 Pro Tip: Let your AI agents handle routine follow-ups while you focus on strategic accounts.
        </p>
      </div>
      
      <div style="text-align: center;">
        <a href="https://recouply.ai/daily-digest" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
          Open Recouply.ai Dashboard
        </a>
      </div>
    </div>
    
    <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; margin: 0; font-size: 14px;">
        © Recouply.ai – AI-Powered Collections
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
