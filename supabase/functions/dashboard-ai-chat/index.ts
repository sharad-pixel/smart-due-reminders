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
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    const [debtorsRes, invoicesRes, tasksRes, paymentsRes] = await Promise.all([
      supabase.from("debtors")
        .select("id, name, email, current_balance, total_open_balance, avg_risk_score, max_risk_score, risk_tier, risk_tier_detailed, collections_health_score, collections_risk_score, health_tier, payment_score, avg_days_to_pay, max_days_past_due, open_invoices_count, disputed_invoices_count, industry, ai_sentiment_category, outreach_paused, is_archived")
        .eq("user_id", accountId).eq("is_archived", false).limit(300),
      supabase.from("invoices")
        .select("id, debtor_id, invoice_number, amount, amount_outstanding, total_amount, status, due_date, currency, aging_bucket, is_archived")
        .eq("user_id", accountId).eq("is_archived", false)
        .in("status", ["Open", "PartiallyPaid"]).limit(500),
      supabase.from("collection_tasks")
        .select("id, summary, task_type, priority, status, due_date, debtor_id")
        .eq("user_id", accountId).in("status", ["pending", "in_progress"]).limit(200),
      supabase.from("payments")
        .select("id, debtor_id, amount, payment_date, currency")
        .eq("user_id", accountId).order("payment_date", { ascending: false }).limit(100),
    ]);

    if (debtorsRes.error) log("debtors error", debtorsRes.error);
    if (invoicesRes.error) log("invoices error", invoicesRes.error);
    if (tasksRes.error) log("tasks error", tasksRes.error);
    if (paymentsRes.error) log("payments error", paymentsRes.error);

    const debtors = debtorsRes.data || [];
    const invoices = invoicesRes.data || [];
    const tasks = tasksRes.data || [];
    const payments = paymentsRes.data || [];

    log("counts", { debtors: debtors.length, invoices: invoices.length, tasks: tasks.length, payments: payments.length });

    const balOf = (i: any) => Number(i.amount_outstanding ?? i.amount ?? 0);
    const isOverdue = (i: any) => i.due_date && i.due_date < todayISO && balOf(i) > 0.005;
    const dpd = (i: any) => i.due_date ? Math.max(0, Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000)) : 0;

    const totalAR = invoices.reduce((s, i: any) => s + balOf(i), 0);
    const overdueInvoices = invoices.filter(isOverdue);
    const totalOverdue = overdueInvoices.reduce((s, i: any) => s + balOf(i), 0);

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

    // Top risk accounts (highest balance + risk tier)
    const debtorBalanceMap: Record<string, number> = {};
    for (const i of invoices as any[]) {
      if (!i.debtor_id) continue;
      debtorBalanceMap[i.debtor_id] = (debtorBalanceMap[i.debtor_id] || 0) + balOf(i);
    }
    const topRisk = (debtors as any[])
      .map((d) => ({
        id: d.id,
        name: d.name,
        balance: Math.round((debtorBalanceMap[d.id] ?? Number(d.total_open_balance ?? d.current_balance ?? 0)) * 100) / 100,
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

    // Top open invoices by balance
    const debtorNameMap = new Map((debtors as any[]).map((d) => [d.id, d.name]));
    const topInvoices = [...invoices]
      .filter((i: any) => balOf(i) > 0)
      .sort((a: any, b: any) => balOf(b) - balOf(a))
      .slice(0, 20)
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

    const last30 = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const recent30 = (payments as any[]).filter((p) => p.payment_date >= last30);
    const paymentSummary = {
      total_recent_count: payments.length,
      recent_30d_count: recent30.length,
      recent_30d_total: Math.round(recent30.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100,
      last_payment_date: (payments[0] as any)?.payment_date || null,
    };

    const portfolio = {
      debtor_count: debtors.length,
      active_debtors_with_balance: Object.values(debtorBalanceMap).filter((b) => b > 0).length,
      total_ar_open: Math.round(totalAR * 100) / 100,
      total_overdue: Math.round(totalOverdue * 100) / 100,
      open_invoice_count: invoices.length,
      overdue_invoice_count: overdueInvoices.length,
      avg_collections_risk_score: avgRisk,
      risk_tier_breakdown: riskBreakdown,
      aging_buckets: Object.fromEntries(
        Object.entries(agingBuckets).map(([k, v]) => [k, { count: v.count, balance: Math.round(v.balance * 100) / 100 }]),
      ),
    };

    const context = {
      as_of: todayISO,
      portfolio,
      top_risk_accounts: topRisk,
      top_open_invoices: topInvoices,
      tasks: taskSummary,
      recent_payments: paymentSummary,
    };

    log("portfolio", portfolio);

    const system = `You are Recouply's Revenue Intelligence agent (persona: Nicolas). Answer the user's question about their AR portfolio using ONLY the JSON CONTEXT below — never invent numbers, debtor names, or invoices.

Style: warm, expert, decisive. Use markdown (## headings, **bold**, bullet lists, tables when helpful). Reference real debtor names, invoice numbers, and dollar amounts from CONTEXT. When discussing risk, use the risk_tier and collections_risk_score (0-100, higher = riskier). When recommending actions, be specific (which debtor, which invoice, what to do, why).

If the portfolio has no data (zero debtors, zero invoices), say so plainly and suggest the user import or sync data.

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
