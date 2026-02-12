import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const body = await req.json().catch(() => ({}));
    const batchId = body.batch_id;

    // Fetch pending payments
    let paymentsQuery = supabaseClient
      .from("payments")
      .select(`
        *,
        debtors (id, company_name, name)
      `)
      .eq("user_id", user.id)
      .in("reconciliation_status", ["pending", "unapplied"]);

    if (batchId) {
      paymentsQuery = paymentsQuery.eq("upload_batch_id", batchId);
    }

    const { data: payments, error: paymentsError } = await paymentsQuery;
    if (paymentsError) throw paymentsError;

    console.log(`Processing ${payments?.length || 0} payments`);

    const results = {
      processed: 0,
      exactMatches: 0,
      heuristicMatches: 0,
      aiSuggested: 0,
      unapplied: 0,
    };

    for (const payment of payments || []) {
      try {
        const matchResult = await matchPayment(supabaseClient, payment, user.id);
        results.processed++;
        
        if (matchResult.method === "exact") results.exactMatches++;
        else if (matchResult.method === "heuristic") results.heuristicMatches++;
        else if (matchResult.method === "ai_suggested") results.aiSuggested++;
        else results.unapplied++;
      } catch (error) {
        console.error(`Error matching payment ${payment.id}:`, error);
        results.unapplied++;
      }
    }

    console.log("Matching results:", results);

    // Recalculate balances for all affected debtors after bulk matching
    const affectedDebtorIds = [...new Set((payments || []).map((p: any) => p.debtor_id).filter(Boolean))];
    console.log(`Recalculating balances for ${affectedDebtorIds.length} debtors`);
    
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    for (const debtorId of affectedDebtorIds) {
      const { data: invoiceStats } = await serviceClient
        .from("invoices")
        .select("amount_outstanding, status")
        .eq("debtor_id", debtorId)
        .in("status", ["Open", "InPaymentPlan", "PartiallyPaid"]);

      const totalBalance = (invoiceStats || []).reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount_outstanding) || 0), 0);
      const openCount = (invoiceStats || []).length;

      await serviceClient
        .from("debtors")
        .update({
          current_balance: totalBalance,
          total_open_balance: totalBalance,
          open_invoices_count: openCount,
        })
        .eq("id", debtorId);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in match-payments:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface MatchResult {
  method: "exact" | "heuristic" | "ai_suggested" | "unapplied";
  confidence: number;
  invoiceMatches: Array<{
    invoiceId: string;
    amountApplied: number;
  }>;
}

async function matchPayment(
  supabase: any,
  payment: any,
  userId: string
): Promise<MatchResult> {
  const debtorId = payment.debtor_id;
  const paymentAmount = parseFloat(payment.amount);
  const currency = payment.currency || "USD";

  // Get candidate invoices (open/partial for this customer)
  const { data: candidateInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, amount_outstanding, due_date, currency")
    .eq("debtor_id", debtorId)
    .eq("user_id", userId)
    .in("status", ["Open", "InPaymentPlan"])
    .gt("amount_outstanding", 0);

  if (!candidateInvoices || candidateInvoices.length === 0) {
    await updatePaymentStatus(supabase, payment.id, "unapplied");
    return { method: "unapplied", confidence: 0, invoiceMatches: [] };
  }

  // 1. Try exact match by invoice number hint
  if (payment.invoice_number_hint) {
    const exactMatch = candidateInvoices.find(
      (inv: any) => inv.invoice_number === payment.invoice_number_hint
    );

    if (exactMatch && Math.abs(exactMatch.amount_outstanding - paymentAmount) < 0.01) {
      await createPaymentLink(supabase, payment.id, exactMatch.id, paymentAmount, 1.0, "exact");
      await updatePaymentStatus(supabase, payment.id, "auto_matched");
      return {
        method: "exact",
        confidence: 1.0,
        invoiceMatches: [{ invoiceId: exactMatch.id, amountApplied: paymentAmount }],
      };
    }
  }

  // 2. Try heuristic amount-based match
  const amountMatches = candidateInvoices.filter(
    (inv: any) => Math.abs(inv.amount_outstanding - paymentAmount) < 1.0
  );

  if (amountMatches.length === 1) {
    const match = amountMatches[0];
    await createPaymentLink(supabase, payment.id, match.id, paymentAmount, 0.9, "heuristic");
    await updatePaymentStatus(supabase, payment.id, "auto_matched");
    return {
      method: "heuristic",
      confidence: 0.9,
      invoiceMatches: [{ invoiceId: match.id, amountApplied: paymentAmount }],
    };
  }

  // 3. Try AI-assisted matching for ambiguous cases
  if (openAIApiKey && candidateInvoices.length > 0) {
    const aiResult = await getAIMatch(payment, candidateInvoices);
    
    if (aiResult && aiResult.matches.length > 0) {
      for (const match of aiResult.matches) {
        await createPaymentLink(
          supabase,
          payment.id,
          match.invoiceId,
          match.amountApplied,
          aiResult.confidence,
          "ai_suggested"
        );
      }

      const status = aiResult.confidence >= 0.9 ? "auto_matched" : 
                     aiResult.confidence >= 0.6 ? "ai_suggested" : "needs_review";
      await updatePaymentStatus(supabase, payment.id, status);

      return {
        method: "ai_suggested",
        confidence: aiResult.confidence,
        invoiceMatches: aiResult.matches,
      };
    }
  }

  // No match found
  await updatePaymentStatus(supabase, payment.id, "unapplied");
  return { method: "unapplied", confidence: 0, invoiceMatches: [] };
}

async function getAIMatch(
  payment: any,
  candidateInvoices: any[]
): Promise<{ confidence: number; matches: Array<{ invoiceId: string; amountApplied: number }> } | null> {
  try {
    const prompt = `You are an AR reconciliation assistant. Match this payment to the most likely invoice(s).

Payment Details:
- Amount: ${payment.currency} ${payment.amount}
- Date: ${payment.payment_date}
- Reference: ${payment.reference || "None"}
- Notes: ${payment.notes || "None"}
- Customer: ${payment.debtors?.company_name || payment.debtors?.name || "Unknown"}

Candidate Invoices:
${candidateInvoices.map((inv: any, idx: number) => 
  `${idx + 1}. Invoice #${inv.invoice_number} - Outstanding: ${inv.currency} ${inv.amount_outstanding} - Due: ${inv.due_date}`
).join("\n")}

Analyze and return the best match(es). Consider:
1. Amount matches (exact or close)
2. Timing (payment date vs due dates)
3. Any reference hints

Return ONLY a JSON object in this exact format:
{
  "confidence": 0.0-1.0,
  "matches": [
    {"invoice_number": "XXX", "amount_applied": 0.00}
  ],
  "reasoning": "Brief explanation"
}

If no good match exists, return confidence 0 and empty matches array.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an AR reconciliation expert. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!parsed.matches || parsed.matches.length === 0) return null;

    // Map invoice numbers back to IDs
    const matches = parsed.matches
      .map((m: any) => {
        const invoice = candidateInvoices.find((inv: any) => inv.invoice_number === m.invoice_number);
        if (!invoice) return null;
        return {
          invoiceId: invoice.id,
          amountApplied: Math.min(m.amount_applied, invoice.amount_outstanding),
        };
      })
      .filter(Boolean);

    return {
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      matches,
    };
  } catch (error) {
    console.error("AI matching error:", error);
    return null;
  }
}

async function createPaymentLink(
  supabase: any,
  paymentId: string,
  invoiceId: string,
  amountApplied: number,
  confidence: number,
  method: string
) {
  const { error } = await supabase.from("payment_invoice_links").insert({
    payment_id: paymentId,
    invoice_id: invoiceId,
    amount_applied: amountApplied,
    match_confidence: confidence,
    match_method: method,
    status: confidence >= 0.9 ? "confirmed" : "pending",
  });

  if (error) {
    console.error("Error creating payment link:", error);
    throw error;
  }
}

async function updatePaymentStatus(supabase: any, paymentId: string, status: string) {
  const { error } = await supabase
    .from("payments")
    .update({ reconciliation_status: status })
    .eq("id", paymentId);

  if (error) {
    console.error("Error updating payment status:", error);
    throw error;
  }
}
