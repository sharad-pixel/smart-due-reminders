import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("[DAILY-INTELLIGENCE] LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[DAILY-INTELLIGENCE] Starting daily intelligence report generation");

    // Fetch all active debtors that have open invoices
    const { data: debtors, error: debtorsError } = await supabase
      .from("debtors")
      .select("id, company_name, name, user_id, organization_id")
      .eq("is_archived", false)
      .eq("is_active", true);

    if (debtorsError) {
      console.error("[DAILY-INTELLIGENCE] Error fetching debtors:", debtorsError);
      return new Response(JSON.stringify({ error: "Failed to fetch accounts" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[DAILY-INTELLIGENCE] Found ${debtors?.length || 0} active accounts to process`);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each debtor
    for (const debtor of debtors || []) {
      try {
        console.log(`[DAILY-INTELLIGENCE] Processing account: ${debtor.company_name || debtor.name} (${debtor.id})`);
        
        // Fetch full debtor data
        const { data: fullDebtor } = await supabase
          .from("debtors")
          .select("*")
          .eq("id", debtor.id)
          .single();

        if (!fullDebtor) continue;

        // Fetch metrics
        const metrics = await fetchMetrics(supabase, debtor.id, fullDebtor);

        // Generate AI intelligence report
        const systemPrompt = `You are a Collection Intelligence analyst for RecouplyAI. Analyze account data and provide actionable intelligence reports.

Your reports should be:
- Concise and actionable
- Risk-focused with clear recommendations
- Based on the data provided
- Written in a professional tone

Structure your response as JSON with these fields:
- riskLevel: "low" | "medium" | "high" | "critical"
- riskScore: number 0-100 (100 = highest risk)
- executiveSummary: 2-3 sentence overview
- keyInsights: array of 3-5 bullet point insights
- recommendations: array of 2-3 specific action items
- paymentBehavior: brief assessment of payment patterns
- communicationSentiment: assessment of customer engagement/sentiment
- collectionStrategy: recommended approach for this account`;

        const userPrompt = `Generate a Collection Intelligence Report for this account:

${JSON.stringify(metrics, null, 2)}

Provide your analysis as a JSON object.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-5-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          console.error(`[DAILY-INTELLIGENCE] AI error for ${debtor.id}:`, aiResponse.status);
          failed++;
          errors.push(`${debtor.company_name || debtor.name}: AI request failed`);
          continue;
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || "";
        
        // Parse AI response
        let intelligence;
        try {
          const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                            aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                            [null, aiContent];
          intelligence = JSON.parse(jsonMatch[1] || aiContent);
        } catch (parseError) {
          console.error(`[DAILY-INTELLIGENCE] Parse error for ${debtor.id}:`, parseError);
          intelligence = {
            riskLevel: "unknown",
            riskScore: 50,
            executiveSummary: aiContent.slice(0, 300),
            keyInsights: ["Unable to parse structured insights"],
            recommendations: ["Manual review recommended"],
            paymentBehavior: "Analysis pending",
            communicationSentiment: "Unknown",
            collectionStrategy: "Standard approach"
          };
        }

        // Cache the report
        const { error: updateError } = await supabase
          .from("debtors")
          .update({
            intelligence_report: intelligence,
            intelligence_report_generated_at: new Date().toISOString()
          })
          .eq("id", debtor.id);

        if (updateError) {
          console.error(`[DAILY-INTELLIGENCE] Update error for ${debtor.id}:`, updateError);
          failed++;
          errors.push(`${debtor.company_name || debtor.name}: Failed to save report`);
        } else {
          processed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`[DAILY-INTELLIGENCE] Error processing ${debtor.id}:`, err);
        failed++;
        errors.push(`${debtor.company_name || debtor.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log(`[DAILY-INTELLIGENCE] Completed. Processed: ${processed}, Failed: ${failed}`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      failed,
      total: debtors?.length || 0,
      errors: errors.slice(0, 10) // Limit error list
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[DAILY-INTELLIGENCE] Fatal error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchMetrics(supabase: any, debtor_id: string, debtor: any) {
  // Fetch invoices for this account
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("debtor_id", debtor_id)
    .eq("is_archived", false);

  // Fetch payments linked to this account's invoices
  const invoiceIds = invoices?.map((i: any) => i.id) || [];
  let payments: any[] = [];
  if (invoiceIds.length > 0) {
    const { data: paymentLinks } = await supabase
      .from("payment_invoice_links")
      .select("*, payments(*)")
      .in("invoice_id", invoiceIds);
    payments = paymentLinks?.map((pl: any) => pl.payments).filter(Boolean) || [];
  }

  // Fetch collection tasks
  const { data: tasks } = await supabase
    .from("collection_tasks")
    .select("*")
    .eq("debtor_id", debtor_id)
    .order("created_at", { ascending: false });

  // Fetch inbound emails for sentiment analysis
  const { data: inboundEmails } = await supabase
    .from("inbound_emails")
    .select("*")
    .eq("debtor_id", debtor_id)
    .order("received_at", { ascending: false })
    .limit(10);

  // Fetch contacts for this account
  const { data: contacts } = await supabase
    .from("debtor_contacts")
    .select("*")
    .eq("debtor_id", debtor_id);

  // Calculate metrics
  const openInvoices = invoices?.filter((i: any) => ["Open", "PartiallyPaid", "InPaymentPlan"].includes(i.status)) || [];
  const totalOpenBalance = openInvoices.reduce((sum: number, inv: any) => sum + (inv.outstanding_amount || inv.amount || 0), 0);
  
  // Calculate DSO
  const paidInvoices = invoices?.filter((i: any) => i.status === "Paid" && i.paid_at) || [];
  let avgDSO = 0;
  if (paidInvoices.length > 0) {
    const dsoValues = paidInvoices.map((inv: any) => {
      const dueDate = new Date(inv.due_date);
      const paidDate = new Date(inv.paid_at);
      return Math.max(0, Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    });
    avgDSO = Math.round(dsoValues.reduce((a: number, b: number) => a + b, 0) / dsoValues.length);
  }

  // Task metrics
  const openTasks = tasks?.filter((t: any) => t.status === "open") || [];
  const completedTasks = tasks?.filter((t: any) => t.status === "done") || [];
  const overdueTasks = openTasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date());

  return {
    account: {
      name: debtor.company_name || debtor.name,
      type: debtor.type,
      paymentScore: debtor.payment_score,
      riskTier: debtor.payment_risk_tier || debtor.risk_tier,
      avgDaysToPay: debtor.avg_days_to_pay,
      creditLimit: debtor.credit_limit
    },
    financials: {
      totalOpenBalance,
      openInvoicesCount: openInvoices.length,
      totalInvoicesCount: invoices?.length || 0,
      paidInvoicesCount: paidInvoices.length,
      avgDSO,
      disputedCount: debtor.disputed_invoices_count || 0,
      writtenOffCount: debtor.written_off_invoices_count || 0
    },
    tasks: {
      openCount: openTasks.length,
      completedCount: completedTasks.length,
      overdueCount: overdueTasks.length,
      recentTypes: tasks?.slice(0, 5).map((t: any) => t.task_type) || []
    },
    communications: {
      inboundCount: inboundEmails?.length || 0,
      recentSentiments: (inboundEmails || []).slice(0, 5).map((e: any) => ({
        date: e.received_at,
        subject: e.subject,
        sentiment: e.sentiment || "unknown",
        category: e.category,
        priority: e.priority
      })),
      lastContactDate: inboundEmails?.[0]?.received_at || null
    },
    contacts: (contacts || []).map((c: any) => ({
      name: c.name,
      title: c.title,
      outreachEnabled: c.outreach_enabled,
      isPrimary: c.is_primary
    })),
    paymentHistory: payments.slice(0, 10).map((p: any) => ({
      date: p.payment_date,
      amount: p.amount,
      method: p.payment_method
    }))
  };
}
