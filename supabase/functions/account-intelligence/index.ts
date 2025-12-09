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
    const { debtor_id } = await req.json();
    
    if (!debtor_id) {
      return new Response(JSON.stringify({ error: "debtor_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch debtor details
    const { data: debtor, error: debtorError } = await supabase
      .from("debtors")
      .select("*")
      .eq("id", debtor_id)
      .single();

    if (debtorError || !debtor) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoices for this account
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("debtor_id", debtor_id)
      .eq("is_archived", false);

    // Fetch payments linked to this account's invoices
    const invoiceIds = invoices?.map(i => i.id) || [];
    let payments: any[] = [];
    if (invoiceIds.length > 0) {
      const { data: paymentLinks } = await supabase
        .from("payment_invoice_links")
        .select("*, payments(*)")
        .in("invoice_id", invoiceIds);
      payments = paymentLinks?.map(pl => pl.payments).filter(Boolean) || [];
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
    const openInvoices = invoices?.filter(i => ["Open", "PartiallyPaid", "InPaymentPlan"].includes(i.status)) || [];
    const totalOpenBalance = openInvoices.reduce((sum, inv) => sum + (inv.outstanding_amount || inv.amount || 0), 0);
    
    // Calculate DSO (Days Sales Outstanding)
    const paidInvoices = invoices?.filter(i => i.status === "Paid" && i.paid_at) || [];
    let avgDSO = 0;
    if (paidInvoices.length > 0) {
      const dsoValues = paidInvoices.map(inv => {
        const dueDate = new Date(inv.due_date);
        const paidDate = new Date(inv.paid_at);
        return Math.max(0, Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      });
      avgDSO = Math.round(dsoValues.reduce((a, b) => a + b, 0) / dsoValues.length);
    }

    // Task metrics
    const openTasks = tasks?.filter(t => t.status === "open") || [];
    const completedTasks = tasks?.filter(t => t.status === "done") || [];
    const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());

    // Sentiment from inbound emails
    const sentimentSummary = inboundEmails?.map(e => ({
      date: e.received_at,
      subject: e.subject,
      sentiment: e.sentiment || "unknown",
      category: e.category,
      priority: e.priority
    })) || [];

    // Payment history summary
    const paymentHistory = payments.map(p => ({
      date: p.payment_date,
      amount: p.amount,
      method: p.payment_method
    }));

    // Build context for AI
    const contextData = {
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
        recentTypes: tasks?.slice(0, 5).map(t => t.task_type) || []
      },
      communications: {
        inboundCount: inboundEmails?.length || 0,
        recentSentiments: sentimentSummary.slice(0, 5),
        lastContactDate: inboundEmails?.[0]?.received_at || null
      },
      contacts: contacts?.map(c => ({
        name: c.name,
        title: c.title,
        outreachEnabled: c.outreach_enabled,
        isPrimary: c.is_primary
      })) || [],
      paymentHistory: paymentHistory.slice(0, 10)
    };

    // Generate AI intelligence report
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "AI service not configured",
        data: contextData 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

${JSON.stringify(contextData, null, 2)}

Provide your analysis as a JSON object.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later", data: contextData }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted", data: contextData }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI analysis failed", data: contextData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Parse AI response
    let intelligence;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                        aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, aiContent];
      intelligence = JSON.parse(jsonMatch[1] || aiContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
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

    return new Response(JSON.stringify({
      success: true,
      intelligence,
      metrics: contextData,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Account intelligence error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
