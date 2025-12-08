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
      .select('id, email, name, welcome_email_sent_at')
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
    const welcomeEmailsSent: string[] = [];

    for (const user of users || []) {
      try {
        logStep('Processing user', { userId: user.id, email: user.email });

        // Get effective account ID for this user (team members should use owner's data)
        const { data: effectiveAccountId } = await supabase
          .rpc('get_effective_account_id', { p_user_id: user.id });
        
        const accountId = effectiveAccountId || user.id;
        const isTeamMember = accountId !== user.id;
        
        logStep('Effective account resolved', { 
          userId: user.id, 
          effectiveAccountId: accountId,
          isTeamMember 
        });

        // Check if user needs welcome email (welcome_email_sent_at is null)
        if (user.email && !user.welcome_email_sent_at) {
          try {
            logStep('Sending welcome email to user', { userId: user.id, email: user.email });
            
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (resendApiKey) {
              const welcomeHtml = generateWelcomeEmailHtml(user.name || 'there');
              
              const welcomeRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'Sharad Chanana - Recouply.ai <notifications@send.inbound.services.recouply.ai>',
                  to: [user.email],
                  reply_to: 'sharad@recouply.ai',
                  subject: '🎉 Welcome to Recouply.ai – You\'re on Your Way to CashOps Excellence!',
                  html: welcomeHtml,
                }),
              });

              if (welcomeRes.ok) {
                // Mark welcome email as sent
                await supabase
                  .from('profiles')
                  .update({ welcome_email_sent_at: new Date().toISOString() })
                  .eq('id', user.id);
                welcomeEmailsSent.push(user.id);
                logStep('Welcome email sent to user', { userId: user.id });
              }
            }
          } catch (welcomeError) {
            logStep('Error sending welcome email', { userId: user.id, error: String(welcomeError) });
          }
        }

        // Check if digest already exists for today
        const { data: existingDigest } = await supabase
          .from('daily_digests')
          .select('id')
          .eq('user_id', user.id)
          .eq('digest_date', today)
          .maybeSingle();

        const existingDigestId = existingDigest?.id;

        // TASKS METRICS - Use effective account ID for data queries
        const { data: openTasks } = await supabase
          .from('collection_tasks')
          .select('id, due_date, created_at')
          .eq('user_id', accountId)
          .in('status', ['open', 'in_progress']);

        const openTasksCount = openTasks?.length || 0;
        const overdueTasksCount = openTasks?.filter(t => 
          t.due_date && new Date(t.due_date) < todayStart
        ).length || 0;
        const tasksCreatedToday = openTasks?.filter(t => 
          t.created_at && new Date(t.created_at) >= todayStart
        ).length || 0;

        // AR METRICS - Use effective account ID
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select('amount, amount_outstanding, aging_bucket, debtor_id, status')
          .eq('user_id', accountId)
          .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid']);

        logStep('Fetched invoices for user', { 
          userId: user.id, 
          invoiceCount: invoices?.length || 0,
          error: invoicesError?.message 
        });

        let totalArOutstanding = 0;
        let arCurrent = 0;
        let ar1_30 = 0;
        let ar31_60 = 0;
        let ar61_90 = 0;
        let ar91_120 = 0;
        let ar120Plus = 0;

        for (const inv of invoices || []) {
          const amount = Number(inv.amount_outstanding || inv.amount || 0);
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

        // PAYMENTS METRICS - Use effective account ID
        const { data: paymentsToday } = await supabase
          .from('payments')
          .select('amount')
          .eq('user_id', accountId)
          .gte('payment_date', today);

        const paymentsCollectedToday = paymentsToday?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        const { data: paymentsLast7 } = await supabase
          .from('payments')
          .select('amount')
          .eq('user_id', accountId)
          .gte('payment_date', last7DaysStart.toISOString());

        const paymentsCollectedLast7Days = paymentsLast7?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        const { data: paymentsPrev7 } = await supabase
          .from('payments')
          .select('amount')
          .eq('user_id', accountId)
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

        // RISK METRICS - Use effective account ID
        const { data: highRiskDebtors } = await supabase
          .from('debtors')
          .select('id, total_open_balance')
          .eq('user_id', accountId)
          .in('risk_tier', ['High', 'Critical']);

        const highRiskCustomersCount = highRiskDebtors?.length || 0;
        const highRiskDebtorIds = highRiskDebtors?.map(d => d.id) || [];

        let highRiskArOutstanding = 0;
        if (highRiskDebtorIds.length > 0) {
          const { data: highRiskInvoices } = await supabase
            .from('invoices')
            .select('amount_outstanding, amount')
            .eq('user_id', accountId)
            .in('debtor_id', highRiskDebtorIds)
            .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid']);

          highRiskArOutstanding = highRiskInvoices?.reduce((sum, inv) => 
            sum + Number(inv.amount_outstanding || inv.amount || 0), 0) || 0;
        }

        // HEALTH SCORE CALCULATION - Enterprise Risk Scoring System
        // Uses weighted factors aligned with risk-engine scoring:
        // - 40% Outstanding Balance & Aging Concentration
        // - 30% Days Past Due Distribution
        // - 20% Collection Trend Performance
        // - 10% High-Risk Account Exposure

        // 1. Outstanding Balance & Aging Concentration Score (0-100)
        // Higher concentration in older buckets = lower score
        let agingScore = 100;
        if (totalArOutstanding > 0) {
          const ar60Plus = ar61_90 + ar91_120 + ar120Plus;
          const ar90Plus = ar91_120 + ar120Plus;
          const ar120PlusRatio = ar120Plus / totalArOutstanding;
          const ar90PlusRatio = ar90Plus / totalArOutstanding;
          const ar60PlusRatio = ar60Plus / totalArOutstanding;

          // Penalty based on aging concentration (max -60 points)
          agingScore -= Math.min(20, ar120PlusRatio * 100 * 0.4); // 120+ days: up to -20
          agingScore -= Math.min(20, ar90PlusRatio * 100 * 0.3);  // 90+ days: up to -20
          agingScore -= Math.min(20, ar60PlusRatio * 100 * 0.2);  // 60+ days: up to -20
        }
        agingScore = Math.max(0, agingScore);

        // 2. Days Past Due Distribution Score (0-100)
        // Based on weighted average DPD across all invoices
        let dpdScore = 100;
        if (totalArOutstanding > 0) {
          // Calculate weighted average days past due
          const bucketWeights = {
            current: 0,
            dpd_1_30: 15,    // avg 15 days
            dpd_31_60: 45,   // avg 45 days
            dpd_61_90: 75,   // avg 75 days
            dpd_91_120: 105, // avg 105 days
            dpd_120_plus: 150 // avg 150+ days
          };
          
          const weightedDPD = (
            (arCurrent * 0) +
            (ar1_30 * 15) +
            (ar31_60 * 45) +
            (ar61_90 * 75) +
            (ar91_120 * 105) +
            (ar120Plus * 150)
          ) / totalArOutstanding;

          // Score decreases as weighted DPD increases (max 150 = 0 score)
          dpdScore = Math.max(0, 100 - (weightedDPD / 150 * 100));
        }

        // 3. Collection Trend Score (0-100)
        let trendScore = 70; // Base score
        if (paymentsCollectedPrev7Days > 0) {
          const trendRatio = paymentsCollectedLast7Days / paymentsCollectedPrev7Days;
          if (trendRatio >= 1.2) {
            trendScore = 100; // Strong upward trend
          } else if (trendRatio >= 1.0) {
            trendScore = 85; // Stable/slight improvement
          } else if (trendRatio >= 0.8) {
            trendScore = 60; // Slight decline
          } else if (trendRatio >= 0.5) {
            trendScore = 40; // Moderate decline
          } else {
            trendScore = 20; // Significant decline
          }
        } else if (paymentsCollectedLast7Days > 0) {
          trendScore = 100; // New collections where none before
        }

        // 4. High-Risk Exposure Score (0-100)
        let riskExposureScore = 100;
        if (totalArOutstanding > 0) {
          const highRiskRatio = highRiskArOutstanding / totalArOutstanding;
          // Score decreases as high-risk ratio increases
          riskExposureScore = Math.max(0, 100 - (highRiskRatio * 100));
        }

        // Combine weighted scores
        const healthScore = Math.round(
          (agingScore * 0.40) +      // 40% weight
          (dpdScore * 0.30) +         // 30% weight
          (trendScore * 0.20) +       // 20% weight
          (riskExposureScore * 0.10)  // 10% weight
        );

        // Health tier labels (aligned with enterprise scoring)
        let healthLabel = 'Healthy';
        if (healthScore < 40) {
          healthLabel = 'Critical';
        } else if (healthScore < 55) {
          healthLabel = 'At Risk';
        } else if (healthScore < 70) {
          healthLabel = 'Needs Attention';
        } else if (healthScore < 85) {
          healthLabel = 'Caution';
        }

        // Upsert digest (insert or update if exists)
        const digestData = {
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
          updated_at: new Date().toISOString(),
        };

        logStep('Digest data prepared', { 
          userId: user.id, 
          totalAr: totalArOutstanding,
          arCurrent,
          ar1_30,
          ar61_90,
          ar120Plus
        });

        if (existingDigestId) {
          // Update existing digest
          const { error: updateError } = await supabase
            .from('daily_digests')
            .update(digestData)
            .eq('id', existingDigestId);

          if (updateError) {
            logStep('Error updating digest', { error: updateError.message });
            continue;
          }
          logStep('Digest updated for user', { userId: user.id });
        } else {
          // Insert new digest
          const { error: insertError } = await supabase
            .from('daily_digests')
            .insert(digestData);

          if (insertError) {
            logStep('Error inserting digest', { error: insertError.message });
            continue;
          }
          logStep('Digest created for user', { userId: user.id });
        }

        digestsCreated.push(user.id);

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
      emailsSent: emailsSent.length,
      welcomeEmailsSent: welcomeEmailsSent.length
    });

    return new Response(JSON.stringify({
      success: true,
      digestsCreated: digestsCreated.length,
      emailsSent: emailsSent.length,
      welcomeEmailsSent: welcomeEmailsSent.length,
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
    data.healthLabel === 'Needs Attention' ? '#f97316' :
    data.healthLabel === 'At Risk' ? '#ea580c' : '#ef4444'; // Critical

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

function generateWelcomeEmailHtml(displayName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td style="padding: 32px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px 12px 0 0;">
              <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Recouply.ai</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px; color: #1e293b; font-size: 15px;">
              <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
                🎉 Welcome to CashOps Excellence!
              </h2>
              
              <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
                Hi ${displayName},
              </p>

              <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
                I'm <strong>Sharad Chanana</strong>, founder of Recouply.ai, and I'm personally thrilled to welcome you to our platform. <strong>You're on your way to CashOps Excellence!</strong>
              </p>

              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px; padding: 28px; margin: 28px 0; text-align: center;">
                <p style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                  🚀 Your Journey to CashOps Excellence Starts Now
                </p>
                <p style="margin: 12px 0 0; color: #93c5fd; font-size: 15px;">
                  Six AI agents are ready to transform your collections
                </p>
              </div>

              <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
                At Recouply.ai, we believe that managing cash flow shouldn't be a headache. That's why we've built an AI-powered CashOps platform that handles collections intelligently, preserves customer relationships, and gets you paid faster.
              </p>

              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px; color: #1e3a5f; font-size: 18px; font-weight: 600;">
                  🤖 What Makes Recouply Different
                </h3>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 15px; line-height: 2;">
                  <li><strong>Six specialized AI agents</strong> working around the clock</li>
                  <li><strong>Intelligent escalation</strong> based on invoice aging and customer behavior</li>
                  <li><strong>Sentiment-aware messaging</strong> that preserves relationships</li>
                  <li><strong>Continuous learning</strong> – our agents get smarter with every interaction</li>
                  <li><strong>Complete visibility</strong> into your collections health</li>
                </ul>
              </div>

              <h3 style="margin: 24px 0 16px; color: #1e293b; font-size: 18px; font-weight: 600;">
                🎯 Get Started in 3 Easy Steps
              </h3>
              <ol style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 15px; line-height: 2.2;">
                <li><strong>Import your accounts & invoices</strong> – Upload a CSV or add them manually</li>
                <li><strong>Let AI configure your workflows</strong> – Automatic persona assignment by aging bucket</li>
                <li><strong>Watch your cash flow improve</strong> – Get paid faster with less effort</li>
              </ol>

              <div style="text-align: center; margin: 32px 0;">
<a href="https://recouply.ai/dashboard" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 17px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
                  Start Your CashOps Journey →
                </a>
              </div>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>💡 Pro Tip:</strong> You'll also receive a Daily Collections Health Digest every morning with key metrics, AI insights, and recommended actions to keep your cash flow on track.
                </p>
              </div>

              <p style="margin: 24px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                I personally read every response. If you have questions, feedback, or just want to chat about how to optimize your CashOps strategy, hit reply – I'd love to hear from you.
              </p>

              <p style="margin: 0 0 8px; color: #475569; font-size: 15px; line-height: 1.7;">
                Here's to getting paid on time, every time. ✨
              </p>

              <div style="margin: 28px 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">
                  Sharad Chanana
                </p>
                <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">
                  Founder & CEO, Recouply.ai
                </p>
                <p style="margin: 4px 0 0; color: #64748b; font-size: 13px; font-style: italic;">
                  "Transforming how businesses manage cash flow"
                </p>
              </div>
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
