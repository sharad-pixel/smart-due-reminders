import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage { role: "user" | "assistant" | "system"; content: string }

const log = (...a: unknown[]) => console.log("[dashboard-ai-chat]", ...a);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: accountId } = await supabase.rpc("get_effective_account_id", { p_user_id: user.id });
    if (!accountId) throw new Error("No account");

    const body = await req.json().catch(() => ({}));
    const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) throw new Error("messages required");

    log("user", user.id, "account", accountId, "msgs", messages.length);

    // ---- Aggregate account-wide context ----
    const now = new Date();
    const asOfDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayISO = asOfDate.toISOString().slice(0, 10);

    const [debtorsRes, invoicesRes, tasksRes, paymentsRes, contractsRes, schedulesRes, draftsRes, sentOutreachRes] = await Promise.all([
      supabase.from("debtors")
        .select("id, name, email, current_balance, total_open_balance, avg_risk_score, max_risk_score, risk_tier, risk_tier_detailed, collections_health_score, collections_risk_score, health_tier, payment_score, avg_days_to_pay, max_days_past_due, open_invoices_count, disputed_invoices_count, industry, ai_sentiment_category, outreach_paused, is_archived")
        .eq("user_id", accountId).eq("is_archived", false).limit(300),
      supabase.from("invoices")
        .select("id, debtor_id, invoice_number, amount, amount_outstanding, total_amount, status, due_date, issue_date, currency, aging_bucket, is_archived, source_system, integration_source, payment_method, payment_terms")
        .eq("user_id", accountId).eq("is_archived", false)
        .in("status", ["Open", "PartiallyPaid", "InPaymentPlan", "Disputed"]).limit(500),
      supabase.from("collection_tasks")
        .select("id, summary, task_type, priority, status, due_date, debtor_id")
        .eq("user_id", accountId).in("status", ["pending", "in_progress"]).limit(200),
      supabase.from("payments")
        .select("id, debtor_id, invoice_id, amount, payment_date, currency, reference, reconciliation_status, source_system, notes")
        .eq("user_id", accountId).order("payment_date", { ascending: false }).limit(100),
      supabase.from("live_contract_imports")
        .select("id, debtor_id, contract_name, contract_type, status, staging_status, effective_date, term_end_date, contract_value, product_description, industry, confidence, file_name, metrics_jsonb, created_at")
        .eq("account_id", accountId)
        .not("status", "in", "(archived,deleted)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("contract_invoice_schedules")
        .select("id, import_id, debtor_id, scheduled_date, expected_due_date, amount, currency, billing_type, revenue_type, product_category, product_description, description, reconciliation_status, invoice_id, completion_status")
        .eq("account_id", accountId)
        .order("scheduled_date", { ascending: true })
        .limit(500),
      // Planned/scheduled AI outreach drafts (not yet sent)
      supabase.from("ai_drafts")
        .select("id, invoice_id, step_number, channel, subject, status, recommended_send_date, days_past_due, sent_at, auto_approved, created_at")
        .eq("user_id", accountId)
        .is("sent_at", null)
        .in("status", ["pending_approval", "approved"])
        .order("recommended_send_date", { ascending: true, nullsFirst: false })
        .limit(300),
      // Recent sent outreach (last 30d) for context on cadence
      supabase.from("outreach_logs")
        .select("id, invoice_id, debtor_id, channel, subject, status, sent_at, created_at")
        .eq("user_id", accountId)
        .order("created_at", { ascending: false })
        .limit(150),
    ]);


    if (debtorsRes.error) log("debtors error", debtorsRes.error);
    if (invoicesRes.error) log("invoices error", invoicesRes.error);
    if (tasksRes.error) log("tasks error", tasksRes.error);
    if (paymentsRes.error) log("payments error", paymentsRes.error);
    if (contractsRes.error) log("contracts error", contractsRes.error);
    if (schedulesRes.error) log("schedules error", schedulesRes.error);
    if (draftsRes.error) log("drafts error", draftsRes.error);
    if (sentOutreachRes.error) log("outreach error", sentOutreachRes.error);

    const debtors = debtorsRes.data || [];
    const invoices = invoicesRes.data || [];
    const tasks = tasksRes.data || [];
    const payments = paymentsRes.data || [];
    const contracts = contractsRes.data || [];
    const schedules = schedulesRes.data || [];
    const plannedDrafts = draftsRes.data || [];
    const sentOutreach = sentOutreachRes.data || [];

    log("counts", { debtors: debtors.length, invoices: invoices.length, tasks: tasks.length, payments: payments.length, contracts: contracts.length, schedules: schedules.length, plannedDrafts: plannedDrafts.length, sentOutreach: sentOutreach.length });

    const balOf = (i: any) => Number(i.amount_outstanding ?? i.balance ?? i.amount_due ?? i.total_amount ?? i.amount ?? 0);
    const dueISO = (i: any) => i.due_date ? String(i.due_date).slice(0, 10) : null;
    const dueDateUtc = (i: any) => {
      const value = dueISO(i);
      if (!value) return null;
      const [year, month, day] = value.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    };
    const isOverdue = (i: any) => !!dueISO(i) && dueISO(i)! < todayISO && balOf(i) > 0.005;
    const isArBacklog = (i: any) => (!dueISO(i) || dueISO(i)! >= todayISO) && balOf(i) > 0.005;
    const dpd = (i: any) => {
      const due = dueDateUtc(i);
      return due ? Math.max(0, Math.floor((asOfDate.getTime() - due.getTime()) / 86400000)) : 0;
    };

    const totalAR = invoices.reduce((s, i: any) => s + balOf(i), 0);
    const overdueInvoices = invoices.filter(isOverdue);
    const arBacklogInvoices = invoices.filter(isArBacklog);
    const totalOverdue = overdueInvoices.reduce((s, i: any) => s + balOf(i), 0);
    const totalArBacklog = arBacklogInvoices.reduce((s, i: any) => s + balOf(i), 0);

    // Aging buckets from invoices
    const agingBuckets: Record<string, { count: number; balance: number }> = {
      current: { count: 0, balance: 0 },
      "1-30": { count: 0, balance: 0 },
      "31-60": { count: 0, balance: 0 },
      "61-90": { count: 0, balance: 0 },
      "91-120": { count: 0, balance: 0 },
      "120+": { count: 0, balance: 0 },
    };
    for (const i of invoices as any[]) {
      const b = balOf(i);
      if (b <= 0.005) continue;
      const d = dpd(i);
      const k = !i.due_date || d <= 0 ? "current" : d <= 30 ? "1-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : d <= 120 ? "91-120" : "120+";
      agingBuckets[k].count++;
      agingBuckets[k].balance += b;
    }

    // Risk tier breakdown
    const riskBreakdown: Record<string, number> = {};
    let totalCollectionsRisk = 0, scoredCount = 0;
    for (const d of debtors as any[]) {
      const tier = d.risk_tier_detailed || d.risk_tier || d.health_tier || "unscored";
      riskBreakdown[tier] = (riskBreakdown[tier] || 0) + 1;
      if (d.collections_risk_score != null) {
        totalCollectionsRisk += Number(d.collections_risk_score);
        scoredCount++;
      }
    }
    const avgRisk = scoredCount ? Math.round((totalCollectionsRisk / scoredCount) * 10) / 10 : null;

    // Account balances split by invoice date classification.
    const debtorBalanceMap: Record<string, number> = {};
    const debtorPastDueMap: Record<string, { balance: number; count: number }> = {};
    const debtorBacklogMap: Record<string, { balance: number; count: number }> = {};
    for (const i of invoices as any[]) {
      if (!i.debtor_id) continue;
      const balance = balOf(i);
      debtorBalanceMap[i.debtor_id] = (debtorBalanceMap[i.debtor_id] || 0) + balance;
      if (isOverdue(i)) {
        const current = debtorPastDueMap[i.debtor_id] || { balance: 0, count: 0 };
        debtorPastDueMap[i.debtor_id] = { balance: current.balance + balance, count: current.count + 1 };
      } else if (isArBacklog(i)) {
        const current = debtorBacklogMap[i.debtor_id] || { balance: 0, count: 0 };
        debtorBacklogMap[i.debtor_id] = { balance: current.balance + balance, count: current.count + 1 };
      }
    }

    // Per-debtor list of past-due invoices so the AI can always cite & link the
    // specific invoice driving an account's risk — even when it falls outside
    // the global top_past_due_invoices list.
    const debtorPastDueInvoiceMap: Record<string, Array<{
      id: string;
      invoice: string | null;
      balance: number;
      due_date: string | null;
      days_overdue: number;
    }>> = {};
    for (const i of invoices as any[]) {
      if (!isOverdue(i)) continue;
      const list = debtorPastDueInvoiceMap[i.debtor_id] || (debtorPastDueInvoiceMap[i.debtor_id] = []);
      list.push({
        id: i.id,
        invoice: i.invoice_number || null,
        balance: Math.round(balOf(i) * 100) / 100,
        due_date: i.due_date || null,
        days_overdue: dpd(i),
      });
    }
    // Sort each debtor's invoices by balance desc, cap at 5 per account
    for (const k of Object.keys(debtorPastDueInvoiceMap)) {
      debtorPastDueInvoiceMap[k] = debtorPastDueInvoiceMap[k]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5);
    }

    const topRisk = (debtors as any[])
      .map((d) => ({
        id: d.id,
        name: d.name,
        balance: Math.round((debtorPastDueMap[d.id]?.balance || 0) * 100) / 100,
        past_due_balance: Math.round((debtorPastDueMap[d.id]?.balance || 0) * 100) / 100,
        past_due_invoice_count: debtorPastDueMap[d.id]?.count || 0,
        past_due_invoices: debtorPastDueInvoiceMap[d.id] || [],
        ar_backlog_balance: Math.round((debtorBacklogMap[d.id]?.balance || 0) * 100) / 100,
        ar_backlog_invoice_count: debtorBacklogMap[d.id]?.count || 0,
        risk_tier: d.risk_tier_detailed || d.risk_tier || "unscored",
        health_tier: d.health_tier,
        risk_score: d.collections_risk_score,
        health_score: d.collections_health_score,
        payment_score: d.payment_score,
        avg_days_to_pay: d.avg_days_to_pay,
        max_dpd: d.max_days_past_due,
        open_invoice_count: d.open_invoices_count,
        industry: d.industry,
        sentiment: d.ai_sentiment_category,
      }))
      .filter((d) => d.balance > 0)
      .sort((a, b) => (Number(b.risk_score) || 0) * b.balance - (Number(a.risk_score) || 0) * a.balance)
      .slice(0, 15);

    const topArBacklogAccounts = (debtors as any[])
      .map((d) => ({
        id: d.id,
        name: d.name,
        ar_backlog_balance: Math.round((debtorBacklogMap[d.id]?.balance || 0) * 100) / 100,
        ar_backlog_invoice_count: debtorBacklogMap[d.id]?.count || 0,
        past_due_balance: Math.round((debtorPastDueMap[d.id]?.balance || 0) * 100) / 100,
      }))
      .filter((d) => d.ar_backlog_balance > 0)
      .sort((a, b) => b.ar_backlog_balance - a.ar_backlog_balance)
      .slice(0, 15);

    // Top past-due invoices by balance
    const debtorNameMap = new Map((debtors as any[]).map((d) => [d.id, d.name]));
    const topPastDueInvoices = [...invoices]
      .filter((i: any) => isOverdue(i))
      .sort((a: any, b: any) => balOf(b) - balOf(a))
      .slice(0, 50)
      .map((i: any) => ({
        id: i.id,
        invoice: i.invoice_number,
        debtor_id: i.debtor_id,
        debtor: debtorNameMap.get(i.debtor_id) || "—",
        balance: Math.round(balOf(i) * 100) / 100,
        status: i.status,
        due_date: i.due_date,
        days_overdue: dpd(i),
        currency: i.currency,
        aging: i.aging_bucket,
        ar_classification: "Past Due",
        source: i.source_system || i.integration_source || "manual",
        payment_terms: i.payment_terms,
        issue_date: i.issue_date,
      }));

    const topArBacklogInvoices = [...invoices]
      .filter((i: any) => isArBacklog(i))
      .sort((a: any, b: any) => balOf(b) - balOf(a))
      .slice(0, 50)
      .map((i: any) => ({
        id: i.id,
        invoice: i.invoice_number,
        debtor_id: i.debtor_id,
        debtor: debtorNameMap.get(i.debtor_id) || "—",
        balance: Math.round(balOf(i) * 100) / 100,
        status: i.status,
        due_date: i.due_date,
        days_overdue: 0,
        currency: i.currency,
        aging: i.aging_bucket,
        ar_classification: "AR Backlog",
        source: i.source_system || i.integration_source || "manual",
        payment_terms: i.payment_terms,
        issue_date: i.issue_date,
      }));

    const taskSummary = {
      total_open: tasks.length,
      by_priority: tasks.reduce((acc: Record<string, number>, t: any) => {
        acc[t.priority || "normal"] = (acc[t.priority || "normal"] || 0) + 1;
        return acc;
      }, {}),
      sample: (tasks as any[]).slice(0, 12).map((t) => ({
        summary: t.summary,
        type: t.task_type,
        priority: t.priority,
        due_date: t.due_date,
        debtor: debtorNameMap.get(t.debtor_id) || null,
      })),
    };

    const invoiceSourceBreakdown = (invoices as any[]).reduce((acc: Record<string, { count: number; balance: number }>, i: any) => {
      const src = i.source_system || i.integration_source || "manual";
      if (!acc[src]) acc[src] = { count: 0, balance: 0 };
      acc[src].count += 1;
      acc[src].balance += balOf(i);
      return acc;
    }, {});
    for (const k of Object.keys(invoiceSourceBreakdown)) {
      invoiceSourceBreakdown[k].balance = Math.round(invoiceSourceBreakdown[k].balance * 100) / 100;
    }

    const paymentSourceBreakdown = (payments as any[]).reduce((acc: Record<string, number>, p: any) => {
      const src = p.source_system || "manual";
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});

    const last30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const last7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const recent30 = (payments as any[]).filter((p) => p.payment_date >= last30);
    const recent7 = (payments as any[]).filter((p) => p.payment_date >= last7);
    const invoiceNumberMap = new Map((invoices as any[]).map((i: any) => [i.id, i.invoice_number]));
    const reconciliationBreakdown = (payments as any[]).reduce((acc: Record<string, number>, p: any) => {
      const k = p.reconciliation_status || "unreconciled";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const paymentSummary = {
      total_recent_count: payments.length,
      recent_7d_count: recent7.length,
      recent_7d_total: Math.round(recent7.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100,
      recent_30d_count: recent30.length,
      recent_30d_total: Math.round(recent30.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100,
      last_payment_date: (payments[0] as any)?.payment_date || null,
      reconciliation_breakdown: reconciliationBreakdown,
    };
    const recentPaymentsSample = (payments as any[]).slice(0, 50).map((p: any) => ({
      id: p.id,
      debtor_id: p.debtor_id,
      debtor: debtorNameMap.get(p.debtor_id) || null,
      invoice_id: p.invoice_id,
      invoice: p.invoice_id ? (invoiceNumberMap.get(p.invoice_id) || null) : null,
      amount: Math.round(Number(p.amount || 0) * 100) / 100,
      currency: p.currency,
      payment_date: p.payment_date,
      reference: p.reference,
      reconciliation_status: p.reconciliation_status || "unreconciled",
      source: p.source_system || "manual",
      notes: p.notes,
    }));


    const portfolio = {
      debtor_count: debtors.length,
      active_debtors_with_balance: Object.values(debtorBalanceMap).filter((b) => b > 0).length,
      total_ar_open: Math.round(totalAR * 100) / 100,
      total_overdue: Math.round(totalOverdue * 100) / 100,
      total_ar_backlog: Math.round(totalArBacklog * 100) / 100,
      open_invoice_count: invoices.length,
      overdue_invoice_count: overdueInvoices.length,
      ar_backlog_invoice_count: arBacklogInvoices.length,
      avg_collections_risk_score: avgRisk,
      risk_tier_breakdown: riskBreakdown,
      aging_buckets: Object.fromEntries(
        Object.entries(agingBuckets).map(([k, v]) => [k, { count: v.count, balance: Math.round(v.balance * 100) / 100 }]),
      ),
    };

    // ---- Live Contracts library summary (full lifecycle, not just 90d) ----
    const todayMs = asOfDate.getTime();
    const horizonDays = (n: number) => new Date(todayMs + n * 86400000).toISOString().slice(0, 10);
    const in30 = horizonDays(30);
    const in90 = horizonDays(90);
    const in180 = horizonDays(180);
    const in365 = horizonDays(365);
    const in730 = horizonDays(730);
    const contractsByStatus: Record<string, number> = {};
    let totalContractValue = 0;
    const expiringSoon: any[] = [];          // next 90d (kept for back-compat)
    const expiringNext30: any[] = [];
    const expiringNext180: any[] = [];
    const expiringNext12mo: any[] = [];      // next 365d
    const expiringNext24mo: any[] = [];      // next 730d
    const expiredOpen: any[] = [];
    const renewalsNext12mo: any[] = [];
    for (const c of contracts as any[]) {
      const k = c.staging_status || c.status || "unknown";
      contractsByStatus[k] = (contractsByStatus[k] || 0) + 1;
      if (c.contract_value) totalContractValue += Number(c.contract_value) || 0;
      if (c.term_end_date) {
        const end = String(c.term_end_date).slice(0, 10);
        if (end < todayISO) expiredOpen.push(c);
        else {
          if (end <= in30) expiringNext30.push(c);
          if (end <= in90) expiringSoon.push(c);
          if (end <= in180) expiringNext180.push(c);
          if (end <= in365) expiringNext12mo.push(c);
          if (end <= in730) expiringNext24mo.push(c);
        }
      }
      // Renewal detection: explicit renewal date OR term_end (proxy for renewal moment)
      const renewalDate = (c as any).renewal_date || (c as any).next_renewal_date || c.term_end_date;
      if (renewalDate) {
        const r = String(renewalDate).slice(0, 10);
        if (r >= todayISO && r <= in365) renewalsNext12mo.push(c);
      }
    }
    const contractList = (contracts as any[]).slice(0, 100).map((c) => ({
      id: c.id,
      name: c.contract_name || c.file_name,
      debtor: debtorNameMap.get(c.debtor_id) || null,
      debtor_id: c.debtor_id,
      type: c.contract_type,
      status: c.staging_status || c.status,
      effective_date: c.effective_date,
      term_end_date: c.term_end_date,
      renewal_date: (c as any).renewal_date || (c as any).next_renewal_date || null,
      auto_renewal: (c as any).auto_renewal ?? null,
      contract_value: c.contract_value ? Math.round(Number(c.contract_value) * 100) / 100 : null,
      industry: c.industry,
      product: c.product_description,
    }));

    // Schedule reconciliation summary (full lifecycle of schedule rows)
    const scheduleStatus: Record<string, number> = { matched: 0, partial: 0, unclear: 0, missing: 0, pending: 0 };
    let upcomingBillings = 0, upcomingBillingValue = 0;
    let upcomingBillings12mo = 0, upcomingBillingValue12mo = 0;
    for (const s of schedules as any[]) {
      const k = (s.reconciliation_status || "pending") as keyof typeof scheduleStatus;
      scheduleStatus[k] = (scheduleStatus[k] ?? 0) + 1;
      if (s.scheduled_date) {
        const sd = String(s.scheduled_date).slice(0, 10);
        if (sd >= todayISO) {
          upcomingBillings++;
          upcomingBillingValue += Number(s.amount || 0);
          if (sd <= in365) {
            upcomingBillings12mo++;
            upcomingBillingValue12mo += Number(s.amount || 0);
          }
        }
      }
    }

    const contractPortfolio = {
      total_contracts: contracts.length,
      by_status: contractsByStatus,
      total_contract_value: Math.round(totalContractValue * 100) / 100,
      expiring_next_30d_count: expiringNext30.length,
      expiring_next_90d_count: expiringSoon.length,
      expiring_next_180d_count: expiringNext180.length,
      expiring_next_12mo_count: expiringNext12mo.length,
      expiring_next_24mo_count: expiringNext24mo.length,
      renewals_next_12mo_count: renewalsNext12mo.length,
      expired_count: expiredOpen.length,
      schedule_reconciliation: scheduleStatus,
      upcoming_billings_count: upcomingBillings,
      upcoming_billings_value: Math.round(upcomingBillingValue * 100) / 100,
      upcoming_billings_next_12mo_count: upcomingBillings12mo,
      upcoming_billings_next_12mo_value: Math.round(upcomingBillingValue12mo * 100) / 100,
    };

    // ---- Planned outreach (AI drafts not yet sent) + recent sent cadence ----
    const invoiceById = new Map((invoices as any[]).map((i: any) => [i.id, i]));
    const in7 = horizonDays(7);
    const in30Out = horizonDays(30);
    const plannedByStatus: Record<string, number> = {};
    const plannedByDebtor: Record<string, { debtor_id: string; debtor: string | null; count: number; next_send: string | null }> = {};
    let plannedNext7 = 0, plannedNext30 = 0, plannedOverdueToSend = 0;
    const plannedSample = (plannedDrafts as any[])
      .slice(0, 50)
      .map((d: any) => {
        const inv = invoiceById.get(d.invoice_id);
        const debtorId = inv?.debtor_id || null;
        plannedByStatus[d.status] = (plannedByStatus[d.status] || 0) + 1;
        const send = d.recommended_send_date ? String(d.recommended_send_date).slice(0, 10) : null;
        if (send && send <= in7 && send >= todayISO) plannedNext7++;
        if (send && send <= in30Out && send >= todayISO) plannedNext30++;
        if (send && send < todayISO) plannedOverdueToSend++;
        if (debtorId) {
          const existing = plannedByDebtor[debtorId];
          if (!existing) {
            plannedByDebtor[debtorId] = { debtor_id: debtorId, debtor: debtorNameMap.get(debtorId) || null, count: 1, next_send: send };
          } else {
            existing.count++;
            if (send && (!existing.next_send || send < existing.next_send)) existing.next_send = send;
          }
        }
        return {
          id: d.id,
          invoice_id: d.invoice_id,
          invoice: inv?.invoice_number || null,
          debtor_id: debtorId,
          debtor: debtorId ? (debtorNameMap.get(debtorId) || null) : null,
          step: d.step_number,
          channel: d.channel,
          subject: d.subject,
          status: d.status,
          recommended_send_date: send,
          days_past_due: d.days_past_due,
          auto_approved: d.auto_approved,
          balance: inv ? Math.round(balOf(inv) * 100) / 100 : null,
        };
      });

    const sentLast30Cutoff = new Date(now.getTime() - 30 * 86400000).toISOString();
    const sentLast30 = (sentOutreach as any[]).filter((o) => (o.sent_at || o.created_at) >= sentLast30Cutoff);
    const sentChannelBreakdown = sentLast30.reduce((acc: Record<string, number>, o: any) => {
      acc[o.channel || "unknown"] = (acc[o.channel || "unknown"] || 0) + 1;
      return acc;
    }, {});

    const outreachPlan = {
      planned_total: plannedDrafts.length,
      planned_next_7d: plannedNext7,
      planned_next_30d: plannedNext30,
      planned_overdue_to_send: plannedOverdueToSend,
      planned_by_status: plannedByStatus,
      sent_last_30d_count: sentLast30.length,
      sent_last_30d_by_channel: sentChannelBreakdown,
      accounts_with_planned_outreach: Object.keys(plannedByDebtor).length,
      top_accounts_with_planned_outreach: Object.values(plannedByDebtor)
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    };


    const context = {
      as_of: todayISO,
      portfolio,
      top_risk_accounts: topRisk,
      top_ar_backlog_accounts: topArBacklogAccounts,
      top_past_due_invoices: topPastDueInvoices,
      top_ar_backlog_invoices: topArBacklogInvoices,
      tasks: taskSummary,
      recent_payments: paymentSummary,
      recent_payments_sample: recentPaymentsSample,

      invoice_source_breakdown: invoiceSourceBreakdown,
      payment_source_breakdown: paymentSourceBreakdown,
      contracts_library: contractPortfolio,
      contracts_sample: contractList,
      contracts_expiring_next_90d: expiringSoon.slice(0, 25).map((c) => ({
        id: c.id, name: c.contract_name || c.file_name, debtor: debtorNameMap.get(c.debtor_id) || null,
        debtor_id: c.debtor_id, term_end_date: c.term_end_date, contract_value: c.contract_value,
      })),
      contracts_renewals_next_12mo: renewalsNext12mo.slice(0, 50).map((c) => ({
        id: c.id, name: c.contract_name || c.file_name, debtor: debtorNameMap.get(c.debtor_id) || null,
        debtor_id: c.debtor_id, term_end_date: c.term_end_date,
        renewal_date: (c as any).renewal_date || (c as any).next_renewal_date || c.term_end_date,
        auto_renewal: (c as any).auto_renewal ?? null,
        contract_value: c.contract_value,
      })),
      contracts_expiring_next_24mo: expiringNext24mo.slice(0, 50).map((c) => ({
        id: c.id, name: c.contract_name || c.file_name, debtor: debtorNameMap.get(c.debtor_id) || null,
        debtor_id: c.debtor_id, term_end_date: c.term_end_date, contract_value: c.contract_value,
      })),
      outreach_plan: outreachPlan,
      planned_outreach_sample: plannedSample,
    };

    log("portfolio", portfolio, "contracts", contractPortfolio);

    const system = `You are Recouply's Revenue Intelligence agent (persona: Nicolas). Answer the user's question about their AR portfolio using ONLY the JSON CONTEXT below — never invent numbers, debtor names, or invoices.

Style: warm, expert, decisive. Use clean GitHub-flavored markdown.

FORMAT RULES (very important):
- Open with a short 1-2 sentence headline answer. No filler like "Okay, let's...".
- Prefer concise bullet lists or compact tables over walls of text. Never paste more than 10 rows in a table — show the top 10 and summarize the rest in one sentence.
- ALWAYS hyperlink debtor names and invoice numbers using these exact patterns:
   * Debtor link:  [Debtor Name](/debtors/{debtor_id})
   * Invoice link: [INVOICE-NUMBER](/invoices/{invoice_id})
   * Contract link: [Contract Name](/contracts/live/{contract_id})
- Links MUST be relative paths starting with "/". NEVER prepend a domain or scheme — do not output https://, http://, recouply.ai, app.recouply.com, or any host. Just "/debtors/<uuid>" or "/invoices/<uuid>".
- Use the \`id\` field from debtor arrays for debtor links and the \`id\` field from invoice arrays for invoice links. If an id is missing, render plain bold text instead — never invent an id.
- When you discuss a specific account's risk, overdue balance, or "why is X high risk", you MUST link the actual invoice(s) driving that risk. Look up the debtor in \`top_risk_accounts\` and use its \`past_due_invoices[]\` array (each item has \`id\` + \`invoice\` number) to render an invoice link for every past-due invoice you mention. Do NOT say "the specific invoice is not in the top list" — \`past_due_invoices\` contains the records for that account; use them. Only fall back to a plain debtor link when \`past_due_invoices\` is empty.
- Format money as $1,234 (no decimals unless < $10). Format dates as YYYY-MM-DD.
- End with a short **Recommended next step** line (1 sentence) when the question is action-oriented.

CLASSIFICATION RULES (critical):
- Past due/overdue/risk exposure means invoice \`due_date\` is strictly before CONTEXT.as_of and balance is positive.
- Open invoices with no due date or with \`due_date\` on/after CONTEXT.as_of are AR Backlog, not overdue and not risk exposure.
- Use \`portfolio.total_overdue\`, \`portfolio.overdue_invoice_count\`, \`top_risk_accounts\`, and \`top_past_due_invoices\` for risk/overdue answers.
- Use \`portfolio.total_ar_backlog\`, \`portfolio.ar_backlog_invoice_count\`, \`top_ar_backlog_accounts\`, and \`top_ar_backlog_invoices\` for future-dated open AR.
- Never describe AR Backlog invoices as overdue/open risk exposure. If an account has only AR Backlog and zero past-due balance, state that clearly.

CONTRACTS LIBRARY (covers full contract lifecycle, not just 90 days):
- \`contracts_library\` contains horizon counts: expiring_next_30d, expiring_next_90d, expiring_next_180d, expiring_next_12mo, expiring_next_24mo, renewals_next_12mo, expired_count, plus upcoming billings totals (all-time and next 12mo).
- \`contracts_sample\` includes up to 100 contracts with effective_date, term_end_date, renewal_date, and auto_renewal.
- For "how many renewals in the next 12 months" use \`contracts_library.renewals_next_12mo_count\` and list specifics from \`contracts_renewals_next_12mo\`.
- For multi-year horizon questions use \`contracts_expiring_next_24mo\` or filter \`contracts_sample\` by term_end_date / renewal_date.
- Cross-reference \`debtor_id\` with \`top_risk_accounts\` to surface contract-driven revenue risk. Link contracts using /contracts/live/{id}.

INVOICE & PAYMENT SOURCES:
- Every invoice and payment carries a \`source\` (one of: stripe, quickbooks, netsuite, sage, xero, google_sheets, csv_upload, smart_ingestion, contract_extraction, manual, etc.).
- Use \`invoice_source_breakdown\` and \`payment_source_breakdown\` to answer "where is this data coming from?", "how many Stripe invoices?", or "which integration generated this AR?".
- When listing invoices, mention the source if the user asks about provenance, integration health, or sync coverage. Never claim the source is unknown if a value is present in the invoice's \`source\` field.

PLANNED OUTREACH:
- \`outreach_plan\` summarizes AI drafts that have NOT been sent yet (pending_approval, approved, scheduled, queued). Use it for "what outreach is planned/scheduled", "which accounts have upcoming emails", "how many drafts are queued".
- Fields: planned_total, planned_next_7d, planned_next_30d, planned_overdue_to_send (recommended_send_date in the past but not yet sent), planned_by_status, sent_last_30d_count, sent_last_30d_by_channel, accounts_with_planned_outreach, top_accounts_with_planned_outreach.
- \`planned_outreach_sample\` lists up to 50 individual planned drafts with invoice/debtor, step, channel, recommended_send_date, days_past_due. Use this to name specific accounts/invoices and their next send date.
- When listing planned outreach by account, link debtors using /debtors/{debtor_id} and invoices using /invoices/{invoice_id}.

PAYMENTS:
- \`recent_payments\` summarizes payment activity (last 7d count/total, last 30d count/total, last payment date, reconciliation_breakdown by status).
- \`recent_payments_sample\` lists up to 50 individual recent payments with debtor, invoice, amount, currency, payment_date, reference, reconciliation_status, source, and notes. Use this to answer "who paid recently", "did <Acme> pay", "payments over $X", "unreconciled payments", "payment for invoice INV-123", or any specific payment lookup.
- When listing payments, link debtors with /debtors/{debtor_id} and invoices with /invoices/{invoice_id}. Always cite amount, date (YYYY-MM-DD), and source. Flag \`reconciliation_status\` other than "matched" so the user can act on it.
- If the user asks about a payment not in \`recent_payments_sample\`, say it's not in the recent 50 and suggest checking /payments.

NATIVE INVOICING (important):
- Recouply has its own native invoicing for users without an ERP, Stripe, QuickBooks, NetSuite, Sage, or Xero source system. Do NOT default to telling users to "create the invoice in your ERP or Stripe" — first offer the native option.
- If the user asks to generate, create, draft, or issue a new invoice: direct them to the [Invoices page](/invoices) and click **"Create Invoice"** (top right), or open a specific account at /debtors/{debtor_id} and click **"Create Invoice"** there to pre-fill the customer.
- Native invoices support line items, the product catalog (managed in /data-center), payment terms, payment processing fees, and send via the debtor portal.
- Only recommend creating the invoice in Stripe/QuickBooks/NetSuite/Sage/Xero when the user explicitly says revenue is recognized there or they want the invoice to flow back into that source system (Recouply will then sync it on the next integration run).

If the portfolio has no data (zero debtors, zero invoices, zero contracts), say so plainly and suggest the user import or sync data.


CONTEXT (as of ${todayISO}):
${JSON.stringify(context)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...messages.slice(-12)],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      log("ai gateway error", aiRes.status, t.slice(0, 500));
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Nicolas is busy — please retry in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway: ${aiRes.status} ${t.slice(0, 200)}`);
    }

    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      log("empty reply", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({
        error: "Nicolas couldn't form a response. Try a more specific question.",
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ reply, context_summary: portfolio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[dashboard-ai-chat] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
