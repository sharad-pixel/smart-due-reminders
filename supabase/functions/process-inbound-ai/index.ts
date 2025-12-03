import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * AI PROCESSING FOR INBOUND EMAILS
 * 
 * Processes unprocessed inbound emails and:
 * 1. Generates AI summary (1-3 sentences)
 * 2. Extracts actionable tasks with structured data
 * 3. Creates tasks in collection_tasks table
 * 
 * Can be triggered:
 * - Via cron (scheduled)
 * - Via manual API call
 * - Via event trigger after email insertion
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTION_TYPES = [
  "W9_REQUEST",
  "PAYMENT_PLAN_REQUEST",
  "DISPUTE_CHARGES",
  "DISPUTE_PO",
  "NEEDS_CALLBACK",
  "PROMISE_TO_PAY",
  "WRONG_CUSTOMER",
  "INVOICE_COPY_REQUEST",
  "PAYMENT_CONFIRMATION",
  "GENERAL_INQUIRY",
  "OTHER",
] as const;

const CATEGORIES = [
  "PAYMENT",
  "DISPUTE",
  "DOCUMENTATION",
  "INQUIRY",
  "COMPLAINT",
  "CONFIRMATION",
  "OTHER",
] as const;

const PRIORITIES = ["high", "medium", "low"] as const;
const SENTIMENTS = ["positive", "neutral", "negative", "urgent"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[AI-PROCESS] Starting batch processing");

    // Fetch unprocessed emails
    const { data: emails, error: fetchError } = await supabase
      .from("inbound_emails")
      .select(`
        id,
        user_id,
        from_email,
        subject,
        text_body,
        html_body,
        debtor_id,
        invoice_id,
        debtors (name, company_name),
        invoices (invoice_number, amount)
      `)
      .is("ai_summary", null)
      .in("status", ["received", "linked"])
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch emails: ${fetchError.message}`);
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No emails to process" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AI-PROCESS] Processing ${emails.length} emails`);
    let processed = 0;
    let errors = 0;

    for (const email of emails) {
      try {
        const debtorInfo = email.debtors as any;
        const invoiceInfo = email.invoices as any;

        const systemPrompt = `You are an AI assistant for Recouply.ai, a collections platform. Analyze customer responses to collection emails and extract:
1. A brief 1-3 sentence summary
2. Category classification
3. Priority level
4. Sentiment analysis
5. Actionable items with type, confidence, and details

Valid action types: ${ACTION_TYPES.join(", ")}
Valid categories: ${CATEGORIES.join(", ")}
Valid priorities: ${PRIORITIES.join(", ")}
Valid sentiments: ${SENTIMENTS.join(", ")}

Return JSON only in this exact format:
{
  "summary": "Brief summary here",
  "category": "PAYMENT",
  "priority": "high",
  "sentiment": "neutral",
  "actions": [
    {
      "type": "W9_REQUEST",
      "confidence": 0.95,
      "details": "Customer needs W9 before processing payment"
    }
  ]
}`;

        const userPrompt = `Analyze this email:

From: ${email.from_email}
Subject: ${email.subject}
${debtorInfo ? `Debtor: ${debtorInfo.name} (${debtorInfo.company_name})` : ""}
${invoiceInfo ? `Invoice: ${invoiceInfo.invoice_number} - $${invoiceInfo.amount}` : ""}

Body:
${email.text_body || email.html_body || "(No body)"}

Extract summary and actions.`;

        // Call Lovable AI
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
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error("No content in AI response");
        }

        // Strip markdown code blocks if present
        let jsonContent = content.trim();
        if (jsonContent.startsWith("```")) {
          jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        }

        // Parse AI response
        const parsed = JSON.parse(jsonContent);
        const summary = parsed.summary || "No summary generated";
        const category = parsed.category || "OTHER";
        const priority = parsed.priority || "medium";
        const sentiment = parsed.sentiment || "neutral";
        const actions = parsed.actions || [];

        // Update inbound_emails with full categorization
        await supabase
          .from("inbound_emails")
          .update({
            ai_summary: summary,
            ai_category: category,
            ai_priority: priority,
            ai_sentiment: sentiment,
            ai_actions: actions,
            ai_processed_at: new Date().toISOString(),
            status: "processed",
            action_status: actions.length > 0 ? "open" : "closed",
          })
          .eq("id", email.id);

        // Create tasks from actions
        if (actions.length > 0 && email.user_id && email.debtor_id) {
          const tasks = actions.map((action: any) => ({
            user_id: email.user_id,
            debtor_id: email.debtor_id,
            invoice_id: email.invoice_id,
            task_type: action.type,
            priority: action.type === "PROMISE_TO_PAY" ? "high" : "normal",
            status: "open",
            summary: `${action.type}: ${email.subject}`,
            details: action.details || "",
            source: "ai_extraction",
          }));

          await supabase.from("collection_tasks").insert(tasks);
        }

        processed++;
        console.log(`[AI-PROCESS] ✅ Processed email ${email.id}`);
      } catch (error: any) {
        console.error(`[AI-PROCESS] ❌ Error processing ${email.id}:`, error.message);
        await supabase
          .from("inbound_emails")
          .update({
            status: "error",
            error_message: `AI processing failed: ${error.message}`,
          })
          .eq("id", email.id);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: emails.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[AI-PROCESS] Fatal error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
