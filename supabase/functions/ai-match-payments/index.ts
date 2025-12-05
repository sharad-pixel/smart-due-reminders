import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payment {
  id: string;
  debtor_id: string;
  amount: number;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  invoice_number_hint: string | null;
}

interface Invoice {
  id: string;
  reference_id: string;
  invoice_number: string;
  external_invoice_id: string | null;
  debtor_id: string;
  amount: number;
  amount_outstanding: number;
  due_date: string;
  status: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    // Fetch unmatched payments
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .in("reconciliation_status", ["pending", "unapplied", "needs_review"])
      .order("created_at", { ascending: false });

    if (paymentsError) throw paymentsError;

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unmatched payments found", matched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${payments.length} unmatched payments`);

    // Fetch open invoices for matching
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("id, reference_id, invoice_number, external_invoice_id, debtor_id, amount, amount_outstanding, due_date, status")
      .eq("user_id", user.id)
      .in("status", ["Open", "InPaymentPlan", "PartiallyPaid"])
      .gt("amount_outstanding", 0);

    if (invoicesError) throw invoicesError;

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ message: "No open invoices to match", matched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${invoices.length} open invoices for matching`);

    // Build lookup maps - prioritize Recouply Invoice ID
    const invoiceByRecouplyId = new Map<string, Invoice>();
    const invoiceByExternal = new Map<string, Invoice>();
    const invoiceByNumber = new Map<string, Invoice>();
    const invoicesByDebtor = new Map<string, Invoice[]>();

    invoices.forEach((inv: Invoice) => {
      // Primary: Recouply Invoice ID (reference_id like INV-XXXXX)
      if (inv.reference_id) {
        invoiceByRecouplyId.set(inv.reference_id.toLowerCase().trim(), inv);
      }
      // Secondary: External Invoice ID
      if (inv.external_invoice_id) {
        invoiceByExternal.set(inv.external_invoice_id.toLowerCase().trim(), inv);
      }
      // Tertiary: Invoice Number
      if (inv.invoice_number) {
        invoiceByNumber.set(inv.invoice_number.toLowerCase().trim(), inv);
      }
      // Group by debtor for AI matching
      const debtorInvs = invoicesByDebtor.get(inv.debtor_id) || [];
      debtorInvs.push(inv);
      invoicesByDebtor.set(inv.debtor_id, debtorInvs);
    });

    let matchedCount = 0;
    let aiMatchedCount = 0;

    for (const payment of payments) {
      const hint = (payment.invoice_number_hint || "").trim().toLowerCase();
      let matchedInvoice: Invoice | null = null;
      let matchMethod = "unknown";
      let confidence = 0;

      // PRIORITY 1: Match by Recouply Invoice ID (reference_id)
      if (hint && invoiceByRecouplyId.has(hint)) {
        matchedInvoice = invoiceByRecouplyId.get(hint)!;
        matchMethod = "recouply_id_exact";
        confidence = 100;
        console.log(`Payment ${payment.id}: Matched by Recouply Invoice ID: ${hint}`);
      }

      // PRIORITY 2: Match by External Invoice ID
      if (!matchedInvoice && hint && invoiceByExternal.has(hint)) {
        matchedInvoice = invoiceByExternal.get(hint)!;
        matchMethod = "external_id_exact";
        confidence = 95;
        console.log(`Payment ${payment.id}: Matched by External Invoice ID: ${hint}`);
      }

      // PRIORITY 3: Match by Invoice Number
      if (!matchedInvoice && hint && invoiceByNumber.has(hint)) {
        matchedInvoice = invoiceByNumber.get(hint)!;
        matchMethod = "invoice_number_exact";
        confidence = 90;
        console.log(`Payment ${payment.id}: Matched by Invoice Number: ${hint}`);
      }

      // PRIORITY 4: Exact amount match within same debtor
      if (!matchedInvoice && payment.debtor_id) {
        const debtorInvoices = invoicesByDebtor.get(payment.debtor_id) || [];
        const exactAmountMatch = debtorInvoices.find(
          inv => Math.abs(inv.amount_outstanding - payment.amount) < 0.01
        );
        if (exactAmountMatch) {
          matchedInvoice = exactAmountMatch;
          matchMethod = "amount_exact";
          confidence = 80;
          console.log(`Payment ${payment.id}: Matched by exact amount: ${payment.amount}`);
        }
      }

      // PRIORITY 5: AI-powered matching for remaining payments
      if (!matchedInvoice && payment.debtor_id) {
        const debtorInvoices = invoicesByDebtor.get(payment.debtor_id) || [];
        
        if (debtorInvoices.length > 0) {
          try {
            const aiMatch = await getAIMatch(payment, debtorInvoices, LOVABLE_API_KEY);
            if (aiMatch) {
              matchedInvoice = debtorInvoices.find(inv => inv.id === aiMatch.invoiceId) || null;
              if (matchedInvoice) {
                matchMethod = "ai_suggested";
                confidence = aiMatch.confidence;
                aiMatchedCount++;
                console.log(`Payment ${payment.id}: AI matched to invoice ${matchedInvoice.invoice_number} with ${confidence}% confidence`);
              }
            }
          } catch (aiError) {
            console.error(`AI matching failed for payment ${payment.id}:`, aiError);
          }
        }
      }

      // Create match if found
      if (matchedInvoice) {
        const amountToApply = Math.min(payment.amount, matchedInvoice.amount_outstanding);

        // Create payment-invoice link
        const { error: linkError } = await supabase
          .from("payment_invoice_links")
          .upsert({
            payment_id: payment.id,
            invoice_id: matchedInvoice.id,
            amount_applied: amountToApply,
            match_confidence: confidence / 100,
            match_method: matchMethod,
            status: confidence >= 90 ? "confirmed" : "pending",
          }, {
            onConflict: "payment_id,invoice_id",
          });

        if (linkError) {
          console.error(`Failed to create link for payment ${payment.id}:`, linkError);
          continue;
        }

        // Update payment status
        const newStatus = confidence >= 90 ? "auto_matched" : "ai_suggested";
        await supabase
          .from("payments")
          .update({ reconciliation_status: newStatus })
          .eq("id", payment.id);

        // If auto-matched with high confidence, apply to invoice
        if (confidence >= 90) {
          const newOutstanding = Math.max(0, matchedInvoice.amount_outstanding - amountToApply);
          await supabase
            .from("invoices")
            .update({
              amount_outstanding: newOutstanding,
              status: newOutstanding === 0 ? "Paid" : "PartiallyPaid",
              payment_date: newOutstanding === 0 ? payment.payment_date : null,
            })
            .eq("id", matchedInvoice.id);
        }

        matchedCount++;
      } else {
        // Mark as needs review if no match found
        await supabase
          .from("payments")
          .update({ reconciliation_status: "unapplied" })
          .eq("id", payment.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Matched ${matchedCount} of ${payments.length} payments`,
        matched: matchedCount,
        aiMatched: aiMatchedCount,
        total: payments.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI match payments error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getAIMatch(
  payment: Payment,
  candidateInvoices: Invoice[],
  apiKey: string
): Promise<{ invoiceId: string; confidence: number } | null> {
  if (candidateInvoices.length === 0) return null;

  const prompt = `You are an accounts receivable AI assistant. Match this payment to the most likely invoice.

PAYMENT:
- Amount: ${payment.amount}
- Date: ${payment.payment_date}
- Reference: ${payment.reference || "None"}
- Notes: ${payment.notes || "None"}
- Invoice Hint: ${payment.invoice_number_hint || "None"}

CANDIDATE INVOICES:
${candidateInvoices.map((inv, i) => `
${i + 1}. Recouply ID: ${inv.reference_id}
   Invoice #: ${inv.invoice_number}
   External ID: ${inv.external_invoice_id || "None"}
   Outstanding: ${inv.amount_outstanding}
   Due Date: ${inv.due_date}
`).join("")}

Match the payment to an invoice. Consider:
1. Recouply Invoice ID matches (highest priority)
2. External Invoice ID matches
3. Invoice number patterns in reference/notes
4. Amount similarity
5. Due date proximity to payment date`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an AR specialist. Return structured invoice matching results." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "match_invoice",
              description: "Match a payment to an invoice with confidence score",
              parameters: {
                type: "object",
                properties: {
                  invoice_id: { type: "string", description: "The ID of the matched invoice" },
                  confidence: { type: "number", description: "Match confidence from 0-100" },
                  reasoning: { type: "string", description: "Brief explanation for the match" },
                },
                required: ["invoice_id", "confidence", "reasoning"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "match_invoice" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      const matchedInvoice = candidateInvoices.find(inv => 
        inv.id === args.invoice_id || 
        inv.reference_id === args.invoice_id ||
        inv.invoice_number === args.invoice_id
      );
      
      if (matchedInvoice && args.confidence >= 50) {
        console.log(`AI reasoning: ${args.reasoning}`);
        return {
          invoiceId: matchedInvoice.id,
          confidence: args.confidence,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("AI match error:", error);
    return null;
  }
}
