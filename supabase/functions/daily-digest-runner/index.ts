// ⚠️ EMAIL DOMAIN WARNING ⚠️
// This function sends emails via Resend.
// The FROM email MUST use verified domain: send.inbound.services.recouply.ai
// DO NOT change to @recouply.ai - it will fail!
// See: supabase/functions/_shared/emailConfig.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { VERIFIED_EMAIL_DOMAIN, INBOUND_EMAIL_DOMAIN } from "../_shared/emailConfig.ts";
import { BRAND, logoImage, enterpriseFooter } from "../_shared/enterpriseEmailTemplate.ts";

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

    // Parse request body to check for force flag, userId, and skipEmail
    let forceRegenerate = false;
    let targetUserId: string | null = null;
    let skipEmail = false;
    try {
      const body = await req.json();
      forceRegenerate = body?.force === true;
      targetUserId = body?.userId || null;
      skipEmail = body?.skipEmail === true; // Skip email sending for manual syncs
    } catch {
      // No body or invalid JSON, use defaults
    }

    logStep('Starting daily digest generation', { forceRegenerate, targetUserId, skipEmail });

    // If userId is provided, only process that specific user (customer-level sync)
    // Otherwise, process all users (platform-level cron job only)
    let usersQuery = supabase
      .from('profiles')
      .select('id, email, name, welcome_email_sent_at, daily_digest_email_enabled, subscription_status, plan_type, trial_ends_at')
      .not('email', 'is', null);
    
    if (targetUserId) {
      usersQuery = usersQuery.eq('id', targetUserId);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) throw usersError;
    logStep('Found users', { count: users?.length, targetUserId });

    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Prior day window (yesterday 00:00 → today 00:00)
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

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

        // Skip this user if digest already exists and not forcing regeneration
        if (existingDigestId && !forceRegenerate) {
          logStep('Digest already exists for today, skipping', { userId: user.id });
          continue;
        }

        // TASKS METRICS - Use effective account ID for data queries
        const { data: openTasks } = await supabase
          .from('collection_tasks')
          .select('id, due_date, created_at, priority, summary, debtor_id, task_type')
          .eq('user_id', accountId)
          .in('status', ['open', 'in_progress']);

        const openTasksCount = openTasks?.length || 0;
        const overdueTasksCount = openTasks?.filter(t => 
          t.due_date && new Date(t.due_date) < todayStart
        ).length || 0;
        const tasksCreatedToday = openTasks?.filter(t => 
          t.created_at && new Date(t.created_at) >= todayStart
        ).length || 0;
        
        // Get HIGH PRIORITY tasks (priority = 'high' or 'critical')
        const highPriorityTasks = openTasks?.filter(t => 
          t.priority === 'high' || t.priority === 'critical'
        ).slice(0, 5) || []; // Limit to top 5 for email
        
        // Get debtor names for high priority tasks
        const highPriorityTaskDebtorIds = [...new Set(highPriorityTasks.map(t => t.debtor_id).filter(Boolean))];
        let debtorNames: Record<string, string> = {};
        
        if (highPriorityTaskDebtorIds.length > 0) {
          const { data: debtors } = await supabase
            .from('debtors')
            .select('id, company_name')
            .in('id', highPriorityTaskDebtorIds);
          
          debtorNames = (debtors || []).reduce((acc, d) => {
            acc[d.id] = d.company_name || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
        
        // Enrich high priority tasks with debtor names
        const enrichedHighPriorityTasks = highPriorityTasks.map(t => ({
          summary: t.summary || 'Collection Task',
          priority: t.priority,
          debtorName: debtorNames[t.debtor_id] || 'Unknown Account',
          taskType: t.task_type || 'follow_up',
          dueDate: t.due_date,
        }));

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

        // PAYMENTS METRICS - Use invoice_transactions table for accurate payment tracking
        // This captures both integration payments (Stripe, QuickBooks) and manual entries
        const { data: paymentsToday } = await supabase
          .from('invoice_transactions')
          .select('amount')
          .eq('user_id', accountId)
          .in('transaction_type', ['payment', 'credit'])
          .gte('transaction_date', todayStart.toISOString());

        const paymentsCollectedToday = paymentsToday?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        // Prior day (yesterday 00:00 → today 00:00)
        const { data: paymentsYesterday } = await supabase
          .from('invoice_transactions')
          .select('amount')
          .eq('user_id', accountId)
          .in('transaction_type', ['payment', 'credit'])
          .gte('transaction_date', yesterdayStart.toISOString())
          .lt('transaction_date', todayStart.toISOString());

        const paymentsCollectedYesterday = paymentsYesterday?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        const { data: paymentsLast7 } = await supabase
          .from('invoice_transactions')
          .select('amount')
          .eq('user_id', accountId)
          .in('transaction_type', ['payment', 'credit'])
          .gte('transaction_date', last7DaysStart.toISOString());

        const paymentsCollectedLast7Days = paymentsLast7?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        const { data: paymentsPrev7 } = await supabase
          .from('invoice_transactions')
          .select('amount')
          .eq('user_id', accountId)
          .in('transaction_type', ['payment', 'credit'])
          .gte('transaction_date', prev7DaysStart.toISOString())
          .lt('transaction_date', last7DaysStart.toISOString());

        const paymentsCollectedPrev7Days = paymentsPrev7?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        // Collection trend
        let collectionTrend = 'flat';
        if (paymentsCollectedLast7Days > paymentsCollectedPrev7Days * 1.1) {
          collectionTrend = 'up';
        } else if (paymentsCollectedLast7Days < paymentsCollectedPrev7Days * 0.9) {
          collectionTrend = 'down';
        }

        // RISK METRICS - High-risk accounts = ALL delinquent accounts with AR 60+ days past due
        const sixtyPlusBuckets = ['dpd_61_90', 'dpd_91_120', 'dpd_121_150', 'dpd_150_plus'];
        const { data: sixtyPlusInvoices } = await supabase
          .from('invoices')
          .select('debtor_id, amount_outstanding, amount')
          .eq('user_id', accountId)
          .in('aging_bucket', sixtyPlusBuckets)
          .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid']);
        
        // Get unique debtor IDs with 60+ day invoices
        const highRiskDebtorIds = [...new Set(sixtyPlusInvoices?.map(inv => inv.debtor_id).filter(Boolean) || [])];
        const highRiskCustomersCount = highRiskDebtorIds.length;
        
        // Calculate total AR outstanding for these high-risk/delinquent accounts (60+ days)
        const highRiskArOutstanding = sixtyPlusInvoices?.reduce((sum, inv) => 
          sum + Number(inv.amount_outstanding || inv.amount || 0), 0) || 0;
        
        logStep('High-risk metrics calculated', { 
          highRiskCustomersCount, 
          highRiskArOutstanding,
          sixtyPlusInvoicesCount: sixtyPlusInvoices?.length || 0 
        });

        // ==========================================
        // COLLECTION ALERTS DATA
        // ==========================================
        // Check user's receive_collection_alerts preference
        const { data: alertPref } = await supabase
          .from('profiles')
          .select('receive_collection_alerts')
          .eq('id', user.id)
          .single();
        
        const collectAlerts = alertPref?.receive_collection_alerts !== false; // default true
        let collectionAlertsSummary: any = null;

        if (collectAlerts) {
          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);

          // 1. Payments received in last 24h (with debtor info)
          const { data: recentPayments } = await supabase
            .from('invoice_transactions')
            .select('amount, transaction_date, invoices!inner(invoice_number, debtor_id, debtors!inner(company_name))')
            .eq('user_id', accountId)
            .in('transaction_type', ['payment', 'credit'])
            .gte('transaction_date', yesterdayStart.toISOString())
            .order('amount', { ascending: false })
            .limit(10);

          const paymentsReceived = (recentPayments || []).map((p: any) => ({
            amount: Number(p.amount || 0),
            date: p.transaction_date,
            invoiceNumber: p.invoices?.invoice_number || 'N/A',
            debtorName: p.invoices?.debtors?.company_name || 'Unknown',
          }));

          // 2. Overdue milestones - invoices that crossed 30/60/90/120 day thresholds yesterday
          // We detect this by checking invoices whose due_date + milestone = yesterday
          const milestoneDays = [30, 60, 90, 120];
          const overdueMilestones: Array<{days: number, invoiceNumber: string, debtorName: string, amount: number}> = [];
          
          for (const milestone of milestoneDays) {
            const milestoneDate = new Date(todayStart);
            milestoneDate.setDate(milestoneDate.getDate() - milestone);
            const milestoneDateStr = milestoneDate.toISOString().split('T')[0];
            
            const { data: milestoneInvoices } = await supabase
              .from('invoices')
              .select('invoice_number, amount_outstanding, amount, debtors!inner(company_name)')
              .eq('user_id', accountId)
              .eq('due_date', milestoneDateStr)
              .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid'])
              .limit(5);

            for (const inv of milestoneInvoices || []) {
              overdueMilestones.push({
                days: milestone,
                invoiceNumber: inv.invoice_number || 'N/A',
                debtorName: (inv as any).debtors?.company_name || 'Unknown',
                amount: Number(inv.amount_outstanding || inv.amount || 0),
              });
            }
          }

          // 3. Debtor responses (inbound emails in last 24h)
          const { data: inboundEmails } = await supabase
            .from('inbound_emails')
            .select('id, from_email, subject, received_at, debtor_id, debtors!inner(company_name)')
            .eq('user_id', accountId)
            .gte('received_at', yesterdayStart.toISOString())
            .eq('is_archived', false)
            .order('received_at', { ascending: false })
            .limit(10);

          const debtorResponses = (inboundEmails || []).map((e: any) => ({
            fromEmail: e.from_email,
            subject: e.subject || '(No subject)',
            debtorName: e.debtors?.company_name || 'Unknown',
            receivedAt: e.received_at,
          }));

          // 4. Risk tier changes - check debtors whose risk_score changed (using collection_intelligence)
          const { data: riskChanges } = await supabase
            .from('collection_intelligence')
            .select('debtor_id, risk_tier, previous_risk_tier, debtors!inner(company_name)')
            .eq('user_id', accountId)
            .not('previous_risk_tier', 'is', null)
            .gte('updated_at', yesterdayStart.toISOString())
            .limit(10);

          const riskTierChanges = (riskChanges || [])
            .filter((r: any) => r.risk_tier !== r.previous_risk_tier)
            .map((r: any) => ({
              debtorName: r.debtors?.company_name || 'Unknown',
              from: r.previous_risk_tier,
              to: r.risk_tier,
            }));

          const totalAlerts = paymentsReceived.length + overdueMilestones.length + debtorResponses.length + riskTierChanges.length;

          collectionAlertsSummary = {
            payments_received: paymentsReceived,
            overdue_milestones: overdueMilestones,
            debtor_responses: debtorResponses,
            risk_tier_changes: riskTierChanges,
            total_alerts: totalAlerts,
          };

          logStep('Collection alerts gathered', { 
            payments: paymentsReceived.length,
            milestones: overdueMilestones.length,
            responses: debtorResponses.length,
            riskChanges: riskTierChanges.length,
          });
        }

        // ==========================================
        // PAYDEX / CREDIT INTELLIGENCE SCORING
        // ==========================================
        // Fetch all debtors with PAYDEX scores for this account
        const { data: debtorsWithPaydex } = await supabase
          .from('debtors')
          .select('id, company_name, paydex_score, paydex_rating, payment_trend, credit_limit_recommendation, total_open_balance')
          .eq('user_id', accountId)
          .not('paydex_score', 'is', null);

        // Calculate portfolio-level PAYDEX metrics
        let avgPaydexScore: number | null = null;
        let avgPaydexRating = 'N/A';
        let accountsPromptPayers = 0;
        let accountsSlowPayers = 0;
        let accountsDelinquent = 0;
        let avgPaymentTrend = 'Stable';
        let totalCreditLimitRecommended = 0;
        let portfolioRiskSummary: any = null;

        if (debtorsWithPaydex && debtorsWithPaydex.length > 0) {
          // Calculate average PAYDEX score
          const totalPaydex = debtorsWithPaydex.reduce((sum, d) => sum + (d.paydex_score || 0), 0);
          avgPaydexScore = Math.round(totalPaydex / debtorsWithPaydex.length);

          // Determine overall portfolio rating based on avg PAYDEX
          if (avgPaydexScore >= 80) {
            avgPaydexRating = 'Prompt';
          } else if (avgPaydexScore >= 70) {
            avgPaydexRating = 'Slow 1-15';
          } else if (avgPaydexScore >= 60) {
            avgPaydexRating = 'Slow 16-30';
          } else if (avgPaydexScore >= 50) {
            avgPaydexRating = 'Slow 31-60';
          } else if (avgPaydexScore >= 40) {
            avgPaydexRating = 'Slow 61-90';
          } else if (avgPaydexScore >= 20) {
            avgPaydexRating = 'Slow 91+';
          } else {
            avgPaydexRating = 'Severely Delinquent';
          }

          // Count accounts by payment behavior
          for (const debtor of debtorsWithPaydex) {
            const score = debtor.paydex_score || 0;
            if (score >= 80) {
              accountsPromptPayers++;
            } else if (score >= 50) {
              accountsSlowPayers++;
            } else {
              accountsDelinquent++;
            }

            // Sum credit limit recommendations
            totalCreditLimitRecommended += Number(debtor.credit_limit_recommendation || 0);
          }

          // Determine overall payment trend
          const trendCounts = { Improving: 0, Stable: 0, Declining: 0 };
          for (const debtor of debtorsWithPaydex) {
            if (debtor.payment_trend && trendCounts[debtor.payment_trend as keyof typeof trendCounts] !== undefined) {
              trendCounts[debtor.payment_trend as keyof typeof trendCounts]++;
            }
          }
          
          if (trendCounts.Declining > trendCounts.Improving && trendCounts.Declining > trendCounts.Stable) {
            avgPaymentTrend = 'Declining';
          } else if (trendCounts.Improving > trendCounts.Declining && trendCounts.Improving > trendCounts.Stable) {
            avgPaymentTrend = 'Improving';
          } else {
            avgPaymentTrend = 'Stable';
          }

          // Build portfolio risk summary
          portfolioRiskSummary = {
            total_accounts_scored: debtorsWithPaydex.length,
            prompt_payers_pct: Math.round((accountsPromptPayers / debtorsWithPaydex.length) * 100),
            slow_payers_pct: Math.round((accountsSlowPayers / debtorsWithPaydex.length) * 100),
            delinquent_pct: Math.round((accountsDelinquent / debtorsWithPaydex.length) * 100),
            avg_score: avgPaydexScore,
            rating: avgPaydexRating,
            trend: avgPaymentTrend,
            total_ar_at_risk: debtorsWithPaydex
              .filter(d => (d.paydex_score || 0) < 50)
              .reduce((sum, d) => sum + Number(d.total_open_balance || 0), 0),
          };

          logStep('PAYDEX portfolio metrics calculated', {
            avgPaydexScore,
            avgPaydexRating,
            accountsPromptPayers,
            accountsSlowPayers,
            accountsDelinquent,
            avgPaymentTrend,
            totalCreditLimitRecommended
          });
        }

        // ==========================================
        // REVENUE RISK & ECL INTELLIGENCE
        // ==========================================
        let revenueRiskSummary: any = null;

        const { data: riskProfiles } = await supabase
          .from('debtor_risk_profiles')
          .select('debtor_id, overall_collectability_score, total_ecl, total_open_balance, risk_classification, total_engagement_adjusted_ecl')
          .eq('user_id', accountId);

        if (riskProfiles && riskProfiles.length > 0) {
          const totalEcl = riskProfiles.reduce((sum, r) => sum + Number(r.total_engagement_adjusted_ecl || r.total_ecl || 0), 0);
          const totalOpenBalance = riskProfiles.reduce((sum, r) => sum + Number(r.total_open_balance || 0), 0);
          const avgCollectability = riskProfiles.reduce((sum, r) => sum + Number(r.overall_collectability_score || 0), 0) / riskProfiles.length;

          const riskTiers = { low: 0, moderate: 0, at_risk: 0, high_risk: 0 };
          for (const r of riskProfiles) {
            const score = Number(r.overall_collectability_score || 0);
            if (score >= 80) riskTiers.low++;
            else if (score >= 60) riskTiers.moderate++;
            else if (score >= 40) riskTiers.at_risk++;
            else riskTiers.high_risk++;
          }

          // Get top risk accounts (lowest collectability)
          const sortedByRisk = [...riskProfiles]
            .filter(r => r.overall_collectability_score !== null)
            .sort((a, b) => Number(a.overall_collectability_score || 0) - Number(b.overall_collectability_score || 0))
            .slice(0, 5);

          // Fetch debtor names for top risk accounts
          const topRiskDebtorIds = sortedByRisk.map(r => r.debtor_id);
          let topRiskDebtorNames: Record<string, string> = {};
          if (topRiskDebtorIds.length > 0) {
            const { data: topDebtors } = await supabase
              .from('debtors')
              .select('id, company_name')
              .in('id', topRiskDebtorIds);
            topRiskDebtorNames = (topDebtors || []).reduce((acc, d) => {
              acc[d.id] = d.company_name || 'Unknown';
              return acc;
            }, {} as Record<string, string>);
          }

          const topRiskAccounts = sortedByRisk.map(r => ({
            company_name: topRiskDebtorNames[r.debtor_id] || 'Unknown',
            collectability_score: Number(r.overall_collectability_score || 0),
            ecl: Number(r.total_engagement_adjusted_ecl || r.total_ecl || 0),
            open_balance: Number(r.total_open_balance || 0),
            risk_classification: r.risk_classification || 'Unknown',
          }));

          revenueRiskSummary = {
            total_ecl: totalEcl,
            total_open_balance: totalOpenBalance,
            avg_collectability_score: Math.round(avgCollectability),
            accounts_scored: riskProfiles.length,
            risk_tiers: riskTiers,
            top_risk_accounts: topRiskAccounts,
          };

          logStep('Revenue risk summary calculated', {
            totalEcl,
            avgCollectability: Math.round(avgCollectability),
            accountsScored: riskProfiles.length,
            riskTiers,
          });
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

        // ==========================================
        // SUBSCRIPTION & USAGE METRICS
        // ==========================================
        const subscriptionStatus = user.subscription_status || 'inactive';
        const planType = user.plan_type || 'free';
        const trialEndsAt = user.trial_ends_at || null;

        // Fetch Stripe subscription term info via get-upcoming-charges pattern
        let currentPeriodStart: string | null = null;
        let currentPeriodEnd: string | null = null;
        let billingInterval: string | null = null;
        let cancelAtPeriodEnd = false;

        // Look up the Stripe customer to get subscription term
        const { data: stripeMapping } = await supabase
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('user_id', accountId)
          .maybeSingle();

        if (stripeMapping?.stripe_customer_id) {
          const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
          if (stripeKey) {
            try {
              const subRes = await fetch(
                `https://api.stripe.com/v1/subscriptions?customer=${stripeMapping.stripe_customer_id}&limit=1&status=all`,
                { headers: { 'Authorization': `Bearer ${stripeKey}` } }
              );
              const subData = await subRes.json();
              const sub = subData?.data?.[0];
              if (sub) {
                currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
                currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
                billingInterval = sub.items?.data?.[0]?.price?.recurring?.interval || 'month';
                cancelAtPeriodEnd = sub.cancel_at_period_end || false;
              }
            } catch (stripeErr) {
              logStep('Error fetching Stripe subscription for digest', { error: String(stripeErr) });
            }
          }
        }

        // Fetch invoice usage metrics
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Get plan limit
        let invoiceAllowance = 5; // default free
        const planTypeLimits: Record<string, number> = {
          'free': 5, 'solo_pro': 25, 'starter': 100, 'growth': 300,
          'professional': 500, 'pro': 500, 'enterprise': 10000
        };

        // Check profile for admin override
        const { data: acctProfile } = await supabase
          .from('profiles')
          .select('plan_id, plan_type, invoice_limit, admin_override')
          .eq('id', accountId)
          .single();

        if (acctProfile?.admin_override && acctProfile?.invoice_limit) {
          invoiceAllowance = acctProfile.invoice_limit;
        } else if (acctProfile?.plan_id) {
          const { data: planData } = await supabase
            .from('plans')
            .select('invoice_limit')
            .eq('id', acctProfile.plan_id)
            .single();
          if (planData?.invoice_limit) invoiceAllowance = planData.invoice_limit;
        } else {
          invoiceAllowance = planTypeLimits[planType] ?? 5;
        }

        // Count active invoices
        const { count: activeInvoiceCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', accountId)
          .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid']);

        const invoicesUsed = activeInvoiceCount || 0;
        const digestOverageInvoices = Math.max(0, invoicesUsed - invoiceAllowance);
        const digestRemainingQuota = Math.max(0, invoiceAllowance - Math.min(invoicesUsed, invoiceAllowance));
        const digestIsOverLimit = invoicesUsed > invoiceAllowance;

        logStep('Subscription & usage metrics', {
          subscriptionStatus, planType, invoiceAllowance, invoicesUsed,
          digestOverageInvoices, currentPeriodEnd
        });

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
          // PAYDEX / Credit Intelligence fields
          avg_paydex_score: avgPaydexScore,
          avg_paydex_rating: avgPaydexRating !== 'N/A' ? avgPaydexRating : null,
          accounts_prompt_payers: accountsPromptPayers,
          accounts_slow_payers: accountsSlowPayers,
          accounts_delinquent: accountsDelinquent,
          avg_payment_trend: avgPaymentTrend,
          total_credit_limit_recommended: totalCreditLimitRecommended,
          portfolio_risk_summary: portfolioRiskSummary,
          // Subscription & Usage fields
          subscription_status: subscriptionStatus,
          plan_type: planType,
          trial_ends_at: trialEndsAt,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          billing_interval: billingInterval,
          cancel_at_period_end: cancelAtPeriodEnd,
          invoice_allowance: invoiceAllowance,
          invoices_used: invoicesUsed,
          overage_invoices: digestOverageInvoices,
          remaining_quota: digestRemainingQuota,
          is_over_limit: digestIsOverLimit,
          // Collection Alerts
          collection_alerts_summary: collectionAlertsSummary,
          // Revenue Risk & ECL Intelligence
          revenue_risk_summary: revenueRiskSummary,
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

        // SEND EMAIL only if:
        // 1. User has email
        // 2. User has daily_digest_email_enabled = true (default is true)
        // 3. Email hasn't been sent for today's digest yet
        // IMPORTANT: Email is sent ONLY ONCE per day - force regeneration does NOT resend email
        const digestEmailEnabled = user.daily_digest_email_enabled !== false; // Default to true
        
        // Check if email was already sent for today - this is a STRICT check
        // Even if forceRegenerate is true, we do NOT resend the email
        const { data: existingDigestWithEmail } = await supabase
          .from('daily_digests')
          .select('email_sent_at')
          .eq('user_id', user.id)
          .eq('digest_date', today)
          .not('email_sent_at', 'is', null)
          .maybeSingle();
        
        const emailAlreadySent = !!existingDigestWithEmail?.email_sent_at;
        
        // Log if we're skipping email due to already sent
        if (emailAlreadySent) {
          logStep('Email already sent today, skipping email send', { userId: user.id, date: today });
        }
        
        if (user.email && digestEmailEnabled && !emailAlreadySent && !skipEmail) {
          try {
            // Log the exact data being sent to email generator
            const emailData = {
              name: user.name || 'there',
              openTasksCount,
              overdueTasksCount,
              highPriorityTasks: enrichedHighPriorityTasks,
              totalArOutstanding,
              paymentsCollectedToday,
              highRiskArOutstanding,
              highRiskCustomersCount,
              healthScore,
              healthLabel,
              subscriptionStatus: (user as any).subscription_status || null,
              planType: (user as any).plan_type || 'free',
              trialEndsAt: (user as any).trial_ends_at || null,
              collectionAlerts: collectionAlertsSummary,
              // Credit Intelligence / PAYDEX data
              avgPaydexScore,
              avgPaydexRating: avgPaydexRating !== 'N/A' ? avgPaydexRating : null,
              accountsPromptPayers,
              accountsSlowPayers,
              accountsDelinquent,
              avgPaymentTrend,
              totalCreditLimitRecommended,
              portfolioRiskSummary,
              // Revenue Risk & ECL
              revenueRiskSummary,
            };
            
            logStep('Email data prepared for user', {
              userId: user.id,
              email: user.email,
              emailData: emailData
            });

            const emailBody = generateEmailHtml(emailData);
            
            // Log a preview of the generated email body to verify data interpolation
            logStep('Email body preview', {
              userId: user.id,
              bodyPreview: emailBody.substring(0, 500),
              containsHealthScore: emailBody.includes(String(healthScore)),
              containsTotalAR: emailBody.includes(String(totalArOutstanding))
            });

            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (!resendApiKey) {
              logStep('RESEND_API_KEY not configured, skipping email', { userId: user.id });
            } else {
              // Retry logic for transient failures
              const maxRetries = 3;
              let lastError: string | null = null;
              let emailSent = false;

              for (let attempt = 1; attempt <= maxRetries && !emailSent; attempt++) {
                try {
                  logStep('Attempting to send email', { userId: user.id, attempt, maxRetries });
                  
                  const emailRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${resendApiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
                      to: [user.email],
                      subject: `📊 Daily Collections Health: ${emailData.healthLabel} (${emailData.healthScore}/100) - ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(emailData.totalArOutstanding)} AR Outstanding`,
                      html: emailBody,
                    }),
                  });

                  if (emailRes.ok) {
                    const { error: updateError } = await supabase
                      .from('daily_digests')
                      .update({ email_sent_at: new Date().toISOString() })
                      .eq('user_id', user.id)
                      .eq('digest_date', today);
                    
                    if (updateError) {
                      logStep('Email sent but failed to update digest record', { 
                        userId: user.id, 
                        error: updateError.message 
                      });
                    }
                    
                    emailsSent.push(user.id);
                    emailSent = true;
                    logStep('Email sent successfully', { userId: user.id, attempt });
                  } else {
                    // Log the actual error response from Resend
                    const errorBody = await emailRes.text();
                    lastError = `HTTP ${emailRes.status}: ${errorBody}`;
                    logStep('Email send failed', { 
                      userId: user.id, 
                      attempt,
                      status: emailRes.status,
                      error: errorBody
                    });
                    
                    // Only retry on 5xx errors or rate limits (429)
                    if (emailRes.status >= 500 || emailRes.status === 429) {
                      // Exponential backoff: 1s, 2s, 4s
                      const delayMs = Math.pow(2, attempt - 1) * 1000;
                      logStep('Retrying after delay', { userId: user.id, delayMs });
                      await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                      // Don't retry on 4xx errors (except 429)
                      break;
                    }
                  }
                } catch (fetchError) {
                  lastError = String(fetchError);
                  logStep('Email fetch error', { 
                    userId: user.id, 
                    attempt,
                    error: lastError 
                  });
                  
                  // Retry on network errors
                  if (attempt < maxRetries) {
                    const delayMs = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                  }
                }
              }

              if (!emailSent) {
                logStep('EMAIL SEND FAILED AFTER ALL RETRIES', { 
                  userId: user.id, 
                  email: user.email,
                  lastError 
                });
              }
            }
          } catch (emailError) {
            logStep('Critical error in email sending block', { 
              userId: user.id, 
              error: String(emailError),
              stack: emailError instanceof Error ? emailError.stack : undefined
            });
          }
        } else {
          logStep('Skipping email', { 
            userId: user.id, 
            reason: !digestEmailEnabled ? 'disabled by user' : emailAlreadySent ? 'already sent today' : 'no email'
          });
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
  highPriorityTasks: Array<{
    summary: string;
    priority: string;
    debtorName: string;
    taskType: string;
    dueDate: string | null;
  }>;
  totalArOutstanding: number;
  paymentsCollectedToday: number;
  highRiskArOutstanding: number;
  highRiskCustomersCount: number;
  healthScore: number;
  healthLabel: string;
  subscriptionStatus?: string | null;
  planType?: string | null;
  trialEndsAt?: string | null;
  collectionAlerts?: {
    payments_received: Array<{ amount: number; date: string; invoiceNumber: string; debtorName: string }>;
    overdue_milestones: Array<{ days: number; invoiceNumber: string; debtorName: string; amount: number }>;
    debtor_responses: Array<{ fromEmail: string; subject: string; debtorName: string; receivedAt: string }>;
    risk_tier_changes: Array<{ debtorName: string; from: string; to: string }>;
    total_alerts: number;
  } | null;
  // Credit Intelligence / PAYDEX
  avgPaydexScore?: number | null;
  avgPaydexRating?: string | null;
  accountsPromptPayers?: number;
  accountsSlowPayers?: number;
  accountsDelinquent?: number;
  avgPaymentTrend?: string | null;
  totalCreditLimitRecommended?: number;
  portfolioRiskSummary?: {
    total_accounts_scored: number;
    prompt_payers_pct: number;
    slow_payers_pct: number;
    delinquent_pct: number;
    avg_score: number;
    rating: string;
    trend: string;
    total_ar_at_risk: number;
  } | null;
  revenueRiskSummary?: {
    total_ecl: number;
    total_open_balance: number;
    avg_collectability_score: number;
    accounts_scored: number;
    risk_tiers: { low: number; moderate: number; at_risk: number; high_risk: number };
    top_risk_accounts: Array<{
      company_name: string;
      collectability_score: number;
      ecl: number;
      open_balance: number;
      risk_classification: string;
    }>;
  } | null;
}): string {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Determine if account has subscription issues
  const hasSubscriptionIssue = ['past_due', 'canceled', 'expired', 'inactive'].includes(data.subscriptionStatus || '');
  const isPastDue = data.subscriptionStatus === 'past_due';
  const isCanceled = data.subscriptionStatus === 'canceled';
  const isExpired = data.subscriptionStatus === 'expired' || (data.subscriptionStatus === 'inactive' && data.planType !== 'free');
  
  // Format trial end date if applicable
  const trialEndFormatted = data.trialEndsAt 
    ? new Date(data.trialEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Generate subscription status banner HTML if needed
  let subscriptionBannerHtml = '';
  if (isPastDue) {
    subscriptionBannerHtml = `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 3px solid ${BRAND.destructive}; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px;">
        <p style="color: #991b1b; margin: 0 0 6px; font-size: 12px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⚠️ Payment Past Due</p>
        <p style="color: #b91c1c; margin: 0 0 10px; font-size: 11.5px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Please update your payment method to restore full access.
        </p>
        <a href="https://recouply.ai/billing" style="display: inline-block; background: ${BRAND.destructive}; color: white; text-decoration: none; padding: 7px 16px; border-radius: 5px; font-weight: 600; font-size: 11.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Update Payment →
        </a>
      </div>
    `;
  } else if (isCanceled) {
    subscriptionBannerHtml = `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 3px solid ${BRAND.destructive}; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px;">
        <p style="color: #991b1b; margin: 0 0 6px; font-size: 12px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⚠️ Subscription Canceled</p>
        <p style="color: #b91c1c; margin: 0 0 10px; font-size: 11.5px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Reactivate now to continue using all features.
        </p>
        <a href="https://recouply.ai/upgrade" style="display: inline-block; background: ${BRAND.destructive}; color: white; text-decoration: none; padding: 7px 16px; border-radius: 5px; font-weight: 600; font-size: 11.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Reactivate →
        </a>
      </div>
    `;
  } else if (isExpired) {
    subscriptionBannerHtml = `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 3px solid ${BRAND.destructive}; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px;">
        <p style="color: #991b1b; margin: 0 0 6px; font-size: 12px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⚠️ Subscription Expired</p>
        <p style="color: #b91c1c; margin: 0 0 10px; font-size: 11.5px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Renew now to restore full access to Recouply.ai.
        </p>
        <a href="https://recouply.ai/upgrade" style="display: inline-block; background: ${BRAND.destructive}; color: white; text-decoration: none; padding: 7px 16px; border-radius: 5px; font-weight: 600; font-size: 11.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Renew →
        </a>
      </div>
    `;
  } else if (data.subscriptionStatus === 'trialing' && trialEndFormatted) {
    subscriptionBannerHtml = `
      <div style="background: #fefce8; border: 1px solid #fde047; border-left: 3px solid ${BRAND.warning}; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px;">
        <p style="color: #854d0e; margin: 0 0 6px; font-size: 12px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">🎯 Free Trial Active</p>
        <p style="color: #a16207; margin: 0 0 10px; font-size: 11.5px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Trial ends <strong>${trialEndFormatted}</strong>. Upgrade to keep collecting faster.
        </p>
        <a href="https://recouply.ai/upgrade" style="display: inline-block; background: ${BRAND.warning}; color: white; text-decoration: none; padding: 7px 16px; border-radius: 5px; font-weight: 600; font-size: 11.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Upgrade Now →
        </a>
      </div>
    `;
  }

  const healthColor = data.healthLabel === 'Healthy' ? BRAND.accent :
    data.healthLabel === 'Caution' ? BRAND.warning :
    data.healthLabel === 'Needs Attention' ? '#fb923c' :
    data.healthLabel === 'At Risk' ? '#f97316' : BRAND.destructive; // Critical

  // Generate high priority tasks HTML
  let highPriorityTasksHtml = '';
  if (data.highPriorityTasks && data.highPriorityTasks.length > 0) {
    const taskItems = data.highPriorityTasks.map(task => {
      const priorityColor = task.priority === 'critical' ? BRAND.destructive : '#fb923c';
      const priorityLabel = task.priority === 'critical' ? 'CRITICAL' : 'HIGH';
      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
      
      return `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid ${BRAND.border};">
            <span style="display: inline-block; background: ${priorityColor}20; color: ${priorityColor}; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 3px; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${priorityLabel}
            </span>
            <p style="margin: 6px 0 3px; color: ${BRAND.foreground}; font-size: 12.5px; font-weight: 600; line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${task.summary}
            </p>
            <p style="margin: 0; color: ${BRAND.muted}; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${task.debtorName} · ${isOverdue ? `<span style="color: ${BRAND.destructive};">Overdue</span>` : `Due ${formatDate(task.dueDate)}`}
            </p>
          </td>
        </tr>
      `;
    }).join('');

    highPriorityTasksHtml = `
      <div style="margin-bottom: 20px;">
        <div style="background: ${BRAND.cardBg}; border: 1px solid #fecaca; border-radius: 10px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, ${BRAND.destructive}18 0%, #fb923c18 100%); padding: 10px 16px; border-bottom: 1px solid #fecaca;">
            <p style="color: ${BRAND.destructive}; margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              🚨 PRIORITY TASKS
            </p>
          </div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: white;">
            ${taskItems}
          </table>
          <div style="padding: 10px 14px; text-align: center;">
            <a href="https://recouply.ai/tasks?priority=high,critical" style="color: ${BRAND.primary}; font-size: 11.5px; font-weight: 600; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              View All ${data.highPriorityTasks.length > 5 ? `${data.highPriorityTasks.length}+ ` : ''}Priority Tasks →
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // Generate Collection Alerts HTML
  let collectionAlertsHtml = '';
  const alerts = data.collectionAlerts;
  if (alerts && alerts.total_alerts > 0) {
    let alertItems = '';
    
    // Payment received alerts
    for (const p of (alerts.payments_received || []).slice(0, 5)) {
      alertItems += `
        <tr>
          <td style="padding: 8px 14px; border-bottom: 1px solid ${BRAND.border};">
            <span style="display: inline-block; background: #dcfce720; color: ${BRAND.accent}; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 3px; letter-spacing: 0.5px;">PAYMENT</span>
            <p style="margin: 4px 0 2px; color: ${BRAND.foreground}; font-size: 12px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              💰 ${formatCurrency(p.amount)} received from ${p.debtorName}
            </p>
            <p style="margin: 0; color: ${BRAND.muted}; font-size: 10.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              Invoice ${p.invoiceNumber}
            </p>
          </td>
        </tr>`;
    }

    // Risk tier change alerts
    for (const r of (alerts.risk_tier_changes || []).slice(0, 5)) {
      const isWorse = ['Critical', 'High'].includes(r.to) && !['Critical', 'High'].includes(r.from);
      const riskColor = isWorse ? BRAND.destructive : BRAND.accent;
      alertItems += `
        <tr>
          <td style="padding: 8px 14px; border-bottom: 1px solid ${BRAND.border};">
            <span style="display: inline-block; background: ${riskColor}20; color: ${riskColor}; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 3px; letter-spacing: 0.5px;">RISK CHANGE</span>
            <p style="margin: 4px 0 2px; color: ${BRAND.foreground}; font-size: 12px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${isWorse ? '⚠️' : '✅'} ${r.debtorName}: ${r.from} → ${r.to}
            </p>
          </td>
        </tr>`;
    }

    // Overdue milestone alerts
    for (const m of (alerts.overdue_milestones || []).slice(0, 5)) {
      alertItems += `
        <tr>
          <td style="padding: 8px 14px; border-bottom: 1px solid ${BRAND.border};">
            <span style="display: inline-block; background: #fb923c20; color: #fb923c; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 3px; letter-spacing: 0.5px;">${m.days} DAYS</span>
            <p style="margin: 4px 0 2px; color: ${BRAND.foreground}; font-size: 12px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              🕐 ${m.debtorName} – Invoice ${m.invoiceNumber} hit ${m.days}-day mark
            </p>
            <p style="margin: 0; color: ${BRAND.muted}; font-size: 10.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${formatCurrency(m.amount)} outstanding
            </p>
          </td>
        </tr>`;
    }

    // Debtor response alerts
    for (const d of (alerts.debtor_responses || []).slice(0, 3)) {
      alertItems += `
        <tr>
          <td style="padding: 8px 14px; border-bottom: 1px solid ${BRAND.border};">
            <span style="display: inline-block; background: ${BRAND.primary}20; color: ${BRAND.primary}; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 3px; letter-spacing: 0.5px;">RESPONSE</span>
            <p style="margin: 4px 0 2px; color: ${BRAND.foreground}; font-size: 12px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              📩 Reply from ${d.debtorName}
            </p>
            <p style="margin: 0; color: ${BRAND.muted}; font-size: 10.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${d.subject}
            </p>
          </td>
        </tr>`;
    }

    collectionAlertsHtml = `
      <div style="margin-bottom: 20px;">
        <div style="background: ${BRAND.cardBg}; border: 1px solid ${BRAND.border}; border-radius: 10px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, ${BRAND.primary}18 0%, ${BRAND.accent}18 100%); padding: 10px 16px; border-bottom: 1px solid ${BRAND.border};">
            <p style="color: ${BRAND.primary}; margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              🔔 COLLECTION ALERTS (${alerts.total_alerts})
            </p>
          </div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: white;">
            ${alertItems}
          </table>
          <div style="padding: 10px 14px; text-align: center;">
            <a href="https://recouply.ai/dashboard" style="color: ${BRAND.primary}; font-size: 11.5px; font-weight: 600; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              View All Activity →
            </a>
          </div>
        </div>
      </div>
    `;
  }
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 16px; background-color: ${BRAND.background};">
    <div style="max-width: 560px; margin: 0 auto; background: ${BRAND.cardBg}; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 12px rgba(59,130,246,0.08), 0 1px 3px rgba(0,0,0,0.04);">
    
    <!-- Header with Recouply.ai Brand -->
    <div style="background: linear-gradient(135deg, ${BRAND.primary} 0%, #2563eb 50%, ${BRAND.primaryDark} 100%); padding: 28px 24px 24px; text-align: center;">
      <!-- Logo Row -->
      <div style="margin-bottom: 14px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
          <tr>
            <td style="padding-right: 10px; vertical-align: middle;">
              ${logoImage(40, true)}
            </td>
            <td style="vertical-align: middle;">
              <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Recouply<span style="color: #22c55e;">.ai</span>
              </span>
            </td>
          </tr>
        </table>
      </div>
      <!-- Title -->
      <h1 style="color: white; margin: 0 0 6px; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Daily Collections Health
      </h1>
      <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
    
    <div style="padding: 24px 22px;">
      <p style="font-size: 13px; color: ${BRAND.foreground}; margin: 0 0 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Good morning, <strong>${data.name}</strong> — here's your collections snapshot.
      </p>
      
      ${subscriptionBannerHtml}
      
      <!-- Health Score Card -->
      <div style="background: linear-gradient(135deg, ${BRAND.surfaceLight} 0%, #dbeafe 100%); border: 1px solid ${BRAND.border}; border-radius: 10px; padding: 18px; margin-bottom: 20px; text-align: center;">
        <p style="margin: 0 0 8px; color: ${BRAND.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Overall Health Score
        </p>
        <div style="display: inline-block; background: ${healthColor}; color: white; padding: 8px 24px; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 2px 8px ${healthColor}30; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          ${data.healthLabel} · ${data.healthScore}/100
        </div>
      </div>
      
      ${highPriorityTasksHtml}
      
      <!-- Metrics Grid -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
        <tr>
          <td width="50%" style="padding-right: 6px;">
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0 0 2px; color: ${BRAND.primary}; font-size: 20px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${data.openTasksCount}
              </p>
              <p style="margin: 0; color: ${BRAND.muted}; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Open Tasks
              </p>
              ${data.overdueTasksCount > 0 ? `<p style="margin: 3px 0 0; color: ${BRAND.destructive}; font-size: 10px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${data.overdueTasksCount} overdue</p>` : ''}
            </div>
          </td>
          <td width="50%" style="padding-left: 6px;">
            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0 0 2px; color: ${BRAND.accentDark}; font-size: 20px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${formatCurrency(data.paymentsCollectedToday)}
              </p>
              <p style="margin: 0; color: ${BRAND.muted}; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Collected Today
              </p>
            </div>
          </td>
        </tr>
      </table>
      
      ${collectionAlertsHtml}
      
      <!-- AR & Risk Section -->
      <div style="margin-bottom: 20px;">
        <div style="background: ${BRAND.cardBg}; border: 1px solid ${BRAND.border}; border-radius: 10px; overflow: hidden;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid ${BRAND.border};">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td>
                      <p style="margin: 0; color: ${BRAND.muted}; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Total AR Outstanding</p>
                    </td>
                    <td align="right">
                      <p style="margin: 0; color: ${BRAND.foreground}; font-size: 15px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${formatCurrency(data.totalArOutstanding)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #fef2f2;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td>
                      <p style="margin: 0; color: #b91c1c; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⚠️ High-Risk AR (60+ days)</p>
                    </td>
                    <td align="right">
                      <p style="margin: 0; color: ${BRAND.destructive}; font-size: 15px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${formatCurrency(data.highRiskArOutstanding)}</p>
                      <p style="margin: 1px 0 0; color: #b91c1c; font-size: 9.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${data.highRiskCustomersCount} accounts</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Credit Intelligence / PAYDEX Section -->
      ${(() => {
        const totalAccounts = (data.accountsPromptPayers || 0) + (data.accountsSlowPayers || 0) + (data.accountsDelinquent || 0);
        if (totalAccounts === 0 && !data.avgPaydexScore) return '';
        
        const paydexScore = data.avgPaydexScore ?? 0;
        const paydexColor = paydexScore >= 80 ? '#22c55e' : paydexScore >= 60 ? '#eab308' : paydexScore >= 40 ? '#f97316' : '#ef4444';
        const trendIcon = data.avgPaymentTrend === 'Improving' ? '📈' : data.avgPaymentTrend === 'Declining' ? '📉' : '➡️';
        const trendColor = data.avgPaymentTrend === 'Improving' ? '#16a34a' : data.avgPaymentTrend === 'Declining' ? '#dc2626' : BRAND.muted;
        
        const promptPct = totalAccounts > 0 ? Math.round(((data.accountsPromptPayers || 0) / totalAccounts) * 100) : 0;
        const slowPct = totalAccounts > 0 ? Math.round(((data.accountsSlowPayers || 0) / totalAccounts) * 100) : 0;
        const delinquentPct = totalAccounts > 0 ? Math.round(((data.accountsDelinquent || 0) / totalAccounts) * 100) : 0;

        return `
        <div style="margin-bottom: 20px;">
          <div style="background: ${BRAND.cardBg}; border: 1px solid ${BRAND.border}; border-radius: 10px; overflow: hidden;">
            <!-- Top color bar -->
            <div style="height: 4px; background: ${paydexColor};"></div>
            <div style="padding: 10px 16px; border-bottom: 1px solid ${BRAND.border};">
              <p style="color: ${BRAND.foreground}; margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                🛡️ CREDIT INTELLIGENCE
              </p>
            </div>
            
            <!-- PAYDEX Score -->
            <div style="padding: 16px; text-align: center; border-bottom: 1px solid ${BRAND.border};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding-right: 16px; vertical-align: middle;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: ${paydexColor}; color: white; font-weight: 700; font-size: 20px; line-height: 56px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ${data.avgPaydexScore ?? '—'}
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <p style="margin: 0 0 2px; color: ${BRAND.foreground}; font-size: 14px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Portfolio PAYDEX
                      ${data.avgPaydexRating ? `<span style="display: inline-block; background: ${paydexColor}20; color: ${paydexColor}; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 3px; margin-left: 6px; vertical-align: middle;">${data.avgPaydexRating}</span>` : ''}
                    </p>
                    <p style="margin: 0; color: ${trendColor}; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ${trendIcon} Payment Trend: ${data.avgPaymentTrend || 'Stable'}
                    </p>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Account Distribution -->
            <div style="padding: 12px 16px; border-bottom: 1px solid ${BRAND.border};">
              <p style="margin: 0 0 8px; color: ${BRAND.muted}; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Account Payment Behavior · ${totalAccounts} scored
              </p>
              <!-- Distribution bar -->
              <div style="height: 8px; border-radius: 4px; overflow: hidden; background: ${BRAND.surfaceLight}; margin-bottom: 10px;">
                <div style="display: flex; height: 100%;">
                  ${promptPct > 0 ? `<div style="width: ${promptPct}%; background: #22c55e;"></div>` : ''}
                  ${slowPct > 0 ? `<div style="width: ${slowPct}%; background: #eab308;"></div>` : ''}
                  ${delinquentPct > 0 ? `<div style="width: ${delinquentPct}%; background: #ef4444;"></div>` : ''}
                </div>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td width="33%" style="text-align: center;">
                    <p style="margin: 0; color: #16a34a; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${data.accountsPromptPayers || 0}</p>
                    <p style="margin: 2px 0 0; color: #15803d; font-size: 9px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">✅ Prompt (80+)</p>
                  </td>
                  <td width="33%" style="text-align: center;">
                    <p style="margin: 0; color: #ca8a04; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${data.accountsSlowPayers || 0}</p>
                    <p style="margin: 2px 0 0; color: #a16207; font-size: 9px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⏳ Slow (50-79)</p>
                  </td>
                  <td width="33%" style="text-align: center;">
                    <p style="margin: 0; color: #dc2626; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${data.accountsDelinquent || 0}</p>
                    <p style="margin: 2px 0 0; color: #b91c1c; font-size: 9px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⚠️ Delinquent (&lt;50)</p>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Credit Limit & AR at Risk -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="50%" style="padding: 12px 16px; border-right: 1px solid ${BRAND.border};">
                  <p style="margin: 0 0 2px; color: ${BRAND.muted}; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">💳 Recommended Credit</p>
                  <p style="margin: 0; color: ${BRAND.foreground}; font-size: 14px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${formatCurrency(data.totalCreditLimitRecommended || 0)}</p>
                </td>
                <td width="50%" style="padding: 12px 16px;">
                  <p style="margin: 0 0 2px; color: ${BRAND.muted}; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⚠️ AR at Risk</p>
                  <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${formatCurrency(data.portfolioRiskSummary?.total_ar_at_risk || 0)}</p>
                </td>
              </tr>
            </table>
          </div>
        </div>`;
      })()}

      <!-- Revenue Risk & ECL Intelligence -->
      ${(() => {
        const rr = data.revenueRiskSummary;
        if (!rr || rr.accounts_scored === 0) return '';
        
        const eclPct = rr.total_open_balance > 0 ? ((rr.total_ecl / rr.total_open_balance) * 100).toFixed(1) : '0.0';
        const scoreColor = rr.avg_collectability_score >= 80 ? '#22c55e' : rr.avg_collectability_score >= 60 ? '#eab308' : rr.avg_collectability_score >= 40 ? '#f97316' : '#ef4444';
        
        let topRiskHtml = '';
        if (rr.top_risk_accounts && rr.top_risk_accounts.length > 0) {
          const rows = rr.top_risk_accounts.slice(0, 3).map(a => {
            const aColor = a.collectability_score >= 80 ? '#22c55e' : a.collectability_score >= 60 ? '#eab308' : a.collectability_score >= 40 ? '#f97316' : '#ef4444';
            return '<tr><td style="padding: 8px 14px; border-bottom: 1px solid ' + BRAND.border + ';"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td width="36" style="vertical-align: middle;"><div style="width: 28px; height: 28px; border-radius: 50%; background: ' + aColor + '; color: white; font-weight: 700; font-size: 11px; line-height: 28px; text-align: center;">' + Math.round(a.collectability_score) + '</div></td><td style="vertical-align: middle; padding-left: 8px;"><p style="margin: 0; color: ' + BRAND.foreground + '; font-size: 12px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">' + a.company_name + '</p><p style="margin: 2px 0 0; color: ' + BRAND.muted + '; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">' + a.risk_classification + '</p></td><td align="right" style="vertical-align: middle;"><p style="margin: 0; color: #dc2626; font-size: 12px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">' + formatCurrency(a.ecl) + '</p><p style="margin: 1px 0 0; color: ' + BRAND.muted + '; font-size: 9px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">of ' + formatCurrency(a.open_balance) + '</p></td></tr></table></td></tr>';
          }).join('');
          
          topRiskHtml = '<div style="border-bottom: 1px solid ' + BRAND.border + ';"><div style="padding: 8px 14px;"><p style="margin: 0; color: ' + BRAND.muted + '; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">Top Risk Accounts</p></div><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">' + rows + '</table></div>';
        }

        return '<div style="margin-bottom: 20px;"><div style="background: ' + BRAND.cardBg + '; border: 1px solid #f59e0b40; border-radius: 10px; overflow: hidden;"><div style="height: 4px; background: ' + scoreColor + ';"></div><div style="padding: 10px 16px; border-bottom: 1px solid ' + BRAND.border + ';"><p style="color: #b45309; margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.3px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">🛡️ REVENUE RISK &amp; ECL INTELLIGENCE</p></div><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td width="33%" style="padding: 14px; text-align: center; border-right: 1px solid ' + BRAND.border + ';"><div style="width: 44px; height: 44px; border-radius: 50%; background: ' + scoreColor + '; color: white; font-weight: 700; font-size: 16px; line-height: 44px; text-align: center; margin: 0 auto 4px;">' + Math.round(rr.avg_collectability_score) + '</div><p style="margin: 0; color: ' + BRAND.muted + '; font-size: 9px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">Avg Collectability</p></td><td width="33%" style="padding: 14px; text-align: center; border-right: 1px solid ' + BRAND.border + ';"><p style="margin: 0 0 2px; color: #dc2626; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">' + formatCurrency(rr.total_ecl) + '</p><p style="margin: 0; color: ' + BRAND.muted + '; font-size: 9px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">Total ECL</p></td><td width="33%" style="padding: 14px; text-align: center;"><p style="margin: 0 0 2px; color: ' + BRAND.foreground + '; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">' + eclPct + '%</p><p style="margin: 0; color: ' + BRAND.muted + '; font-size: 9px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">ECL Rate</p></td></tr></table><div style="padding: 12px 16px; border-top: 1px solid ' + BRAND.border + '; border-bottom: 1px solid ' + BRAND.border + ';"><p style="margin: 0 0 8px; color: ' + BRAND.muted + '; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">Risk Distribution · ' + rr.accounts_scored + ' accounts</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td width="25%" style="text-align: center;"><p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 700;">' + rr.risk_tiers.low + '</p><p style="margin: 2px 0 0; color: #15803d; font-size: 8px;">Low</p></td><td width="25%" style="text-align: center;"><p style="margin: 0; color: #ca8a04; font-size: 14px; font-weight: 700;">' + rr.risk_tiers.moderate + '</p><p style="margin: 2px 0 0; color: #a16207; font-size: 8px;">Moderate</p></td><td width="25%" style="text-align: center;"><p style="margin: 0; color: #ea580c; font-size: 14px; font-weight: 700;">' + rr.risk_tiers.at_risk + '</p><p style="margin: 2px 0 0; color: #c2410c; font-size: 8px;">At Risk</p></td><td width="25%" style="text-align: center;"><p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 700;">' + rr.risk_tiers.high_risk + '</p><p style="margin: 2px 0 0; color: #b91c1c; font-size: 8px;">High Risk</p></td></tr></table></div>' + topRiskHtml + '<div style="padding: 10px 14px; text-align: center;"><a href="https://recouply.ai/revenue-risk" style="color: #b45309; font-size: 11.5px; font-weight: 600; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">View Full Revenue Risk Report →</a></div></div></div>';
      })()}

      <div style="margin-bottom: 20px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 16px;">
        <p style="color: ${BRAND.primaryDark}; margin: 0 0 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Quick Actions
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom: 7px;">
              <a href="https://recouply.ai/tasks" style="color: ${BRAND.primary}; font-size: 12px; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                📋 Review Collection Tasks →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 7px;">
              <a href="https://recouply.ai/settings/ai-workflows" style="color: ${BRAND.primary}; font-size: 12px; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                🤖 Configure AI Agents →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 7px;">
              <a href="https://recouply.ai/debtors" style="color: ${BRAND.primary}; font-size: 12px; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                📊 View Risk Scores →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 7px;">
              <a href="https://recouply.ai/revenue-risk" style="color: ${BRAND.primary}; font-size: 12px; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                🛡️ Revenue Risk & ECL Report →
              </a>
            </td>
          </tr>
          <tr>
            <td>
              <a href="https://recouply.ai/data-center" style="color: ${BRAND.primary}; font-size: 12px; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                📥 Import & Reconcile AR →
              </a>
            </td>
          </tr>
        </table>
      </div>

      <!-- Pro Tips -->
      <div style="margin-bottom: 22px; background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 16px;">
        <p style="color: #166534; margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          💡 Best Practices
        </p>
        <ul style="margin: 0; padding-left: 16px; color: #15803d; line-height: 1.7; font-size: 11.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <li>Follow up within <strong>3-5 days</strong> of invoice due date</li>
          <li><strong>Segment by risk tier</strong> – prioritize High/Critical first</li>
          <li>Use <strong>multiple channels</strong> for best results</li>
        </ul>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="https://recouply.ai/dashboard" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 10px rgba(59,130,246,0.25); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Open Dashboard →
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%); padding: 28px 24px; text-align: center;">
      <!-- Footer Logo -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 10px;">
        <tr>
          <td style="padding-right: 8px; vertical-align: middle;">
            ${logoImage(28, true)}
          </td>
          <td style="vertical-align: middle;">
            <span style="color: rgba(255,255,255,0.85); font-size: 16px; font-weight: 700; letter-spacing: -0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              Recouply<span style="color: #22c55e;">.ai</span>
            </span>
          </td>
        </tr>
      </table>
      <p style="color: #93c5fd; margin: 0 0 12px; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Collections & Risk Intelligence Platform
      </p>
      <!-- Links -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 14px;">
        <tr>
          <td style="padding: 0 8px;">
            <a href="https://recouply.ai/dashboard" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Dashboard</a>
          </td>
          <td style="color: rgba(255,255,255,0.2); font-size: 11px;">|</td>
          <td style="padding: 0 8px;">
            <a href="https://recouply.ai/settings" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Settings</a>
          </td>
          <td style="color: rgba(255,255,255,0.2); font-size: 11px;">|</td>
          <td style="padding: 0 8px;">
            <a href="mailto:support@${INBOUND_EMAIL_DOMAIN}" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Support</a>
          </td>
          <td style="color: rgba(255,255,255,0.2); font-size: 11px;">|</td>
          <td style="padding: 0 8px;">
            <a href="https://www.linkedin.com/company/recouplyai-inc" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">LinkedIn</a>
          </td>
        </tr>
      </table>
      <p style="color: rgba(255,255,255,0.3); margin: 0; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        © ${new Date().getFullYear()} RecouplyAI Inc. · Delaware, USA · All rights reserved
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
            <td style="padding: 28px 32px; background: linear-gradient(135deg, ${BRAND.primary} 0%, #2563eb 50%, ${BRAND.primaryDark} 100%); border-radius: 12px 12px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding-right: 10px; vertical-align: middle;">
                    ${logoImage(40, true)}
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Recouply<span style="color: #22c55e;">.ai</span></span>
                  </td>
                </tr>
              </table>
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

              <div style="background: linear-gradient(135deg, ${BRAND.primary} 0%, #2563eb 50%, ${BRAND.primaryDark} 100%); border-radius: 12px; padding: 28px; margin: 28px 0; text-align: center;">
                <p style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                  🚀 Your Journey to CashOps Excellence Starts Now
                </p>
                <p style="margin: 12px 0 0; color: rgba(255,255,255,0.7); font-size: 15px;">
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
