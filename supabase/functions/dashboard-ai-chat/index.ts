import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage { role: "user" | "assistant" | "system"; content: string }

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

    // ---- Aggregate account-wide context ----
    const [
      debtorsRes, invoicesRes, tasksRes, paymentsRes,
    ] = await Promise.all([
      supabase.from("debtors")
        .select("id, name, email, current_balance, total_overdue, collectability_score, ecl_amount, risk_category, average_dpd, primary_currency, status")
        .eq("account_id", accountId).limit(200),
      supabase.from("invoices")
        .select("id, debtor_id, invoice_number, amount, balance, status, due_date, currency, days_overdue")
        .eq("account_id", accountId).in("status", ["Open", "Overdue", "InPaymentPlan", "PartiallyPaid"]).limit(500),
      supabase.from("collection_tasks")
        .select("id, summary, task_type, priority, status, due_date, debtor_id")
        .eq("account_id", accountId).in("status", ["pending", "in_progress"]).limit(200),
      supabase.from("payments")
        .select("id, debtor_id, amount, payment_date, currency")
        .eq("account_id", accountId).order("payment_date", { ascending: false }).limit(100),
    ]);

    const debtors = debtorsRes.data || [];
    const invoices = invoicesRes.data || [];
    const tasks = tasksRes.data || [];
    const payments = paymentsRes.data || [];

    // Top-line aggregates
    const totalAR = invoices.reduce((s, i: any) => s + (Number(i.balance) || 0), 0);
    const totalOverdue = invoices.filter((i: any) => i.status === "Overdue")
      .reduce((s, i: any) => s + (Number(i.balance) || 0), 0);
    const overdueCount = invoices.filter((i: any) => i.status === "Overdue").length;
    const totalECL = debtors.reduce((s, d: any) => s + (Number(d.ecl_amount) || 0), 0);
    const avgScore = debtors.length
      ? debtors.reduce((s, d: any) => s + (Number(d.collectability_score) || 0), 0) / debtors.length
      : 0;

    const riskBreakdown: Record<string, number> = {};
    for (const d of debtors) {
      const k = (d as any).risk_category || "unscored";
      riskBreakdown[k] = (riskBreakdown[k] || 0) + 1;
    }

    // Top risk debtors
    const topRisk = [...debtors]
      .filter((d: any) => Number(d.current_balance) > 0)
      .sort((a: any, b: any) => (Number(b.ecl_amount) || 0) - (Number(a.ecl_amount) || 0))
      .slice(0, 15)
      .map((d: any) => ({
        name: d.name,
        balance: Number(d.current_balance) || 0,
        overdue: Number(d.total_overdue) || 0,
        score: d.collectability_score,
        ecl: Number(d.ecl_amount) || 0,
        risk: d.risk_category,
        avg_dpd: d.average_dpd,
      }));

    // Top open invoices
    const topInvoices = [...invoices]
      .sort((a: any, b: any) => (Number(b.balance) || 0) - (Number(a.balance) || 0))
      .slice(0, 20)
      .map((i: any) => {
        const d = debtors.find((x: any) => x.id === i.debtor_id);
        return {
          invoice: i.invoice_number,
          debtor: d?.name,
          balance: Number(i.balance) || 0,
          status: i.status,
          due_date: i.due_date,
          days_overdue: i.days_overdue,
          currency: i.currency,
        };
      });

    const taskSummary = {
      total_open: tasks.length,
      by_priority: tasks.reduce((acc: Record<string, number>, t: any) => {
        acc[t.priority || "normal"] = (acc[t.priority || "normal"] || 0) + 1;
        return acc;
      }, {}),
      sample: tasks.slice(0, 10).map((t: any) => ({
        summary: t.summary, priority: t.priority, due_date: t.due_date,
      })),
    };

    const paymentSummary = {
      recent_count: payments.length,
      recent_total: payments.reduce((s, p: any) => s + (Number(p.amount) || 0), 0),
      last_payment_date: payments[0]?.payment_date || null,
    };

    const context = {
      portfolio: {
        debtor_count: debtors.length,
        total_ar_open: Math.round(totalAR * 100) / 100,
        total_overdue: Math.round(totalOverdue * 100) / 100,
        overdue_invoice_count: overdueCount,
        total_expected_credit_loss: Math.round(totalECL * 100) / 100,
        avg_collectability_score: Math.round(avgScore * 10) / 10,
        risk_breakdown: riskBreakdown,
      },
      top_risk_accounts: topRisk,
      top_open_invoices: topInvoices,
      tasks: taskSummary,
      recent_payments: paymentSummary,
    };

    const system = `You are Recouply's Revenue Intelligence assistant. The user is asking questions about their entire AR portfolio. Use ONLY the JSON CONTEXT below to answer — do not invent numbers. Be concise, structured, and actionable. Use markdown (headings, bullets, bold). When discussing risk, reference Collectability Score (0–100, higher = better) and Expected Credit Loss (ECL). When relevant, recommend specific debtors or invoices to act on by name. If the answer is not in context, say so.

CONTEXT:
${JSON.stringify(context)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please retry shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway: ${aiRes.status} ${t}`);
    }

    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't form a response.";

    return new Response(JSON.stringify({ reply, context_summary: context.portfolio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dashboard-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
