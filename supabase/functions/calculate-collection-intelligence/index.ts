import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScoreResult {
  debtor_id: string;
  score: number;
  healthTier: string;
  touchpoint_count: number;
  inbound_email_count: number;
  response_rate: number;
  avg_response_sentiment: string;
  avg_days_to_pay: number;
}

function calculateScore(
  debtorId: string,
  invoices: any[],
  outreachLogs: any[],
  inboundEmails: any[],
  activities: any[],
  tasks: any[],
): ScoreResult {
  let score = 100;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ===== INVOICE ACTIVITY (30 pts) =====
  const openInvoices = invoices.filter(i => ["Open", "PartiallyPaid", "InPaymentPlan", "Overdue"].includes(i.status));
  const overdueInvoices = invoices.filter(i => {
    if (!i.due_date) return false;
    return new Date(i.due_date) < now && !["Paid", "Canceled", "Settled"].includes(i.status);
  });
  const paidLast30Days = invoices.filter(i =>
    i.status === "Paid" && i.paid_at && new Date(i.paid_at) >= thirtyDaysAgo
  ).length;

  const overdueAmount = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_outstanding || inv.amount || 0), 0);

  let maxDaysPastDue = 0;
  overdueInvoices.forEach((inv: any) => {
    if (inv.due_date) {
      const dpd = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
      if (dpd > maxDaysPastDue) maxDaysPastDue = dpd;
    }
  });

  if (overdueInvoices.length > 0) {
    score -= Math.min(overdueInvoices.length * 8, 30);
  }

  if (maxDaysPastDue >= 90) score -= 25;
  else if (maxDaysPastDue >= 60) score -= 15;
  else if (maxDaysPastDue >= 30) score -= 10;
  else if (maxDaysPastDue > 0) score -= 5;

  if (overdueAmount > 10000) score -= 20;
  else if (overdueAmount > 5000) score -= 12;
  else if (overdueAmount > 1000) score -= 5;

  if (paidLast30Days > 0) {
    score += Math.min(paidLast30Days * 3, 10);
  }

  // ===== PAYMENT PRACTICES (25 pts) =====
  const paidInvoices = invoices.filter(i => i.status === "Paid" && i.paid_at && i.issue_date);
  let avgDaysToPay = 0;
  let onTimePayments = 0;

  if (paidInvoices.length > 0) {
    const daysToPay = paidInvoices.map((inv: any) => {
      const issueDate = new Date(inv.issue_date);
      const paidDate = new Date(inv.paid_at);
      const days = Math.max(0, Math.floor((paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (inv.due_date && paidDate <= new Date(inv.due_date)) onTimePayments++;
      return days;
    });
    avgDaysToPay = Math.round(daysToPay.reduce((a: number, b: number) => a + b, 0) / daysToPay.length);
  }

  if (paidInvoices.length === 0 && overdueInvoices.length > 0) score -= 15;

  if (avgDaysToPay > 60) score -= 15;
  else if (avgDaysToPay > 30) score -= 8;
  else if (avgDaysToPay <= 0 && paidInvoices.length > 0) score += 10;

  // Payment trend
  if (paidInvoices.length >= 6) {
    const recentPayments = paidInvoices.slice(0, 3);
    const olderPayments = paidInvoices.slice(3, 6);
    const recentAvg = recentPayments.reduce((sum: number, inv: any) => {
      return sum + (new Date(inv.paid_at).getTime() - new Date(inv.due_date || inv.issue_date).getTime());
    }, 0) / recentPayments.length;
    const olderAvg = olderPayments.reduce((sum: number, inv: any) => {
      return sum + (new Date(inv.paid_at).getTime() - new Date(inv.due_date || inv.issue_date).getTime());
    }, 0) / olderPayments.length;

    if (recentAvg < olderAvg * 0.8) score += 5;
    else if (recentAvg > olderAvg * 1.2) score -= 5;
  }

  // ===== TOUCHPOINT & RESPONSE (25 pts) =====
  const totalTouchpoints = outreachLogs.length + activities.filter((a: any) => a.direction === "outbound").length;
  const outboundMessages = outreachLogs.length;
  const inboundResponses = inboundEmails.length;
  const responseRate = outboundMessages > 0 ? Math.min((inboundResponses / outboundMessages) * 100, 100) : 0;

  if (responseRate >= 50) score += 10;
  else if (responseRate >= 20) score += 5;
  else if (outboundMessages > 5 && responseRate < 10) score -= 10;

  // ===== SENTIMENT (20 pts) =====
  const sentiments = inboundEmails.filter((e: any) => e.sentiment).map((e: any) => (e.sentiment || "").toLowerCase());
  const positiveCount = sentiments.filter((s: string) => s === "positive").length;
  const negativeCount = sentiments.filter((s: string) => s === "negative" || s === "hostile" || s === "delaying").length;

  let avgSentiment = "neutral";
  if (sentiments.length > 0) {
    if (positiveCount > negativeCount * 2) { avgSentiment = "positive"; score += 10; }
    else if (negativeCount > positiveCount * 2) { avgSentiment = "negative"; score -= 10; }
  }

  // ===== TASKS =====
  const openTasks = tasks.filter((t: any) => t.status === "open" || t.status === "in_progress");
  const overdueTasks = openTasks.filter((t: any) => t.due_date && new Date(t.due_date) < now);
  if (overdueTasks.length > 0) score -= Math.min(overdueTasks.length * 3, 10);

  // Disputed invoices
  const disputedCount = invoices.filter((i: any) => i.status === "Disputed").length;
  if (disputedCount > 0) score -= disputedCount * 5;

  score = Math.max(0, Math.min(100, score));

  let healthTier: string;
  if (score >= 75) healthTier = "Healthy";
  else if (score >= 50) healthTier = "Watch";
  else if (score >= 25) healthTier = "At Risk";
  else healthTier = "Critical";

  return {
    debtor_id: debtorId,
    score,
    healthTier,
    touchpoint_count: totalTouchpoints,
    inbound_email_count: inboundEmails.length,
    response_rate: Math.round(responseRate),
    avg_response_sentiment: avgSentiment,
    avg_days_to_pay: avgDaysToPay,
  };
}

// Paginated fetch helper — fetches all rows beyond the 1000 default limit
async function fetchAll(supabase: any, table: string, column: string, values: string[], selectCols: string, extraFilters?: (q: any) => any) {
  const allRows: any[] = [];
  // Chunk the IN values to avoid URI too long
  for (let i = 0; i < values.length; i += 100) {
    const chunk = values.slice(i, i + 100);
    let query = supabase.from(table).select(selectCols).in(column, chunk);
    if (extraFilters) query = extraFilters(query);
    
    // Paginate within each chunk
    let offset = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
      if (error) { console.error(`Error fetching ${table}:`, error.message); break; }
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return allRows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { debtor_id, recalculate_all } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine debtor IDs to process
    let debtorIds: string[] = [];
    if (debtor_id && !recalculate_all) {
      debtorIds = [debtor_id];
    } else {
      // Fetch all active debtor IDs for this user
      const { data: debtors } = await supabase
        .from("debtors")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_archived", false);
      debtorIds = (debtors || []).map((d: any) => d.id);
    }

    if (debtorIds.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[COLLECTION-INTELLIGENCE] Bulk scoring ${debtorIds.length} debtors for user ${user.id}`);

    // ===== BULK FETCH all data in ~5 queries =====
    const [allInvoices, allOutreach, allInbound, allActivities, allTasks] = await Promise.all([
      fetchAll(supabase, "invoices", "debtor_id", debtorIds,
        "id, debtor_id, status, amount, amount_outstanding, due_date, issue_date, paid_at, paid_date",
        (q: any) => q.eq("is_archived", false)),
      fetchAll(supabase, "outreach_logs", "debtor_id", debtorIds,
        "id, debtor_id, sent_at"),
      fetchAll(supabase, "inbound_emails", "debtor_id", debtorIds,
        "id, debtor_id, sentiment, ai_sentiment, received_at"),
      fetchAll(supabase, "collection_activities", "debtor_id", debtorIds,
        "id, debtor_id, direction"),
      fetchAll(supabase, "collection_tasks", "debtor_id", debtorIds,
        "id, debtor_id, status, due_date"),
    ]);

    console.log(`[COLLECTION-INTELLIGENCE] Fetched: ${allInvoices.length} invoices, ${allOutreach.length} outreach, ${allInbound.length} inbound, ${allActivities.length} activities, ${allTasks.length} tasks`);

    // ===== GROUP by debtor_id =====
    const groupBy = (arr: any[]) => {
      const map = new Map<string, any[]>();
      for (const item of arr) {
        const key = item.debtor_id;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
      return map;
    };

    const invoicesByDebtor = groupBy(allInvoices);
    const outreachByDebtor = groupBy(allOutreach);
    const inboundByDebtor = groupBy(allInbound);
    const activitiesByDebtor = groupBy(allActivities);
    const tasksByDebtor = groupBy(allTasks);

    // ===== CALCULATE scores in-memory =====
    const results: ScoreResult[] = [];
    for (const dId of debtorIds) {
      try {
        const result = calculateScore(
          dId,
          invoicesByDebtor.get(dId) || [],
          outreachByDebtor.get(dId) || [],
          inboundByDebtor.get(dId) || [],
          activitiesByDebtor.get(dId) || [],
          tasksByDebtor.get(dId) || [],
        );
        results.push(result);
      } catch (err) {
        console.error(`[COLLECTION-INTELLIGENCE] Score calc error for ${dId}:`, err);
      }
    }

    // ===== BATCH UPDATE debtors table (chunks of 50) =====
    const BATCH_SIZE = 50;
    let updatedCount = 0;
    const timestamp = new Date().toISOString();

    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);
      const updatePromises = batch.map(r =>
        supabase.from("debtors").update({
          collection_intelligence_score: r.score,
          collection_health_tier: r.healthTier,
          touchpoint_count: r.touchpoint_count,
          inbound_email_count: r.inbound_email_count,
          response_rate: r.response_rate,
          avg_response_sentiment: r.avg_response_sentiment,
          avg_days_to_pay: r.avg_days_to_pay,
          collection_score_updated_at: timestamp,
        }).eq("id", r.debtor_id)
      );
      await Promise.all(updatePromises);
      updatedCount += batch.length;
    }

    console.log(`[COLLECTION-INTELLIGENCE] Bulk complete: ${updatedCount} debtors scored`);

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results: results.map(r => ({ debtor_id: r.debtor_id, score: r.score, healthTier: r.healthTier })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[COLLECTION-INTELLIGENCE] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
