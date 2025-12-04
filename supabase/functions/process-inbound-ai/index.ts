import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * AI PROCESSING FOR INBOUND EMAILS
 * 
 * Processes unprocessed inbound emails and:
 * 1. Detects if sender is a team member (internal communication)
 * 2. Generates AI summary (1-3 sentences)
 * 3. Extracts actionable tasks with structured data
 * 4. Creates tasks in collection_tasks table
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

const INTERNAL_ACTION_TYPES = [
  "ESCALATION",
  "STATUS_UPDATE",
  "INTERNAL_NOTE",
  "REASSIGNMENT_REQUEST",
  "FOLLOW_UP_NEEDED",
  "INFO_REQUEST",
  "APPROVAL_NEEDED",
  "OTHER",
] as const;

const CATEGORIES = [
  "PAYMENT",
  "DISPUTE",
  "DOCUMENTATION",
  "INQUIRY",
  "COMPLAINT",
  "CONFIRMATION",
  "INTERNAL",
  "OTHER",
] as const;

const PRIORITIES = ["high", "medium", "low"] as const;
const SENTIMENTS = ["positive", "neutral", "negative", "urgent"] as const;

// Persona bucket mapping
const PERSONA_BUCKET_MAP: Record<string, string> = {
  dpd_1_30: "Sam",
  dpd_31_60: "James",
  dpd_61_90: "Katy",
  dpd_91_120: "Troy",
  dpd_121_150: "Gotti",
  dpd_150_plus: "Rocco",
};

// Helper function to get recommended actions based on task type
function getRecommendedAction(taskType: string, isInternal: boolean): string {
  if (isInternal) {
    const internalActions: Record<string, string> = {
      ESCALATION: "Review escalation request and take appropriate action",
      STATUS_UPDATE: "Acknowledge status update and update relevant records",
      INTERNAL_NOTE: "Review note and add to customer file if relevant",
      REASSIGNMENT_REQUEST: "Evaluate and reassign task to appropriate team member",
      FOLLOW_UP_NEEDED: "Schedule follow-up action within 24 hours",
      INFO_REQUEST: "Gather requested information and respond to team member",
      APPROVAL_NEEDED: "Review request and provide approval decision",
      OTHER: "Review internal communication and take appropriate action",
    };
    return internalActions[taskType] || "Review and respond to internal communication";
  }

  const externalActions: Record<string, string> = {
    W9_REQUEST: "Send W9 form to customer via secure channel",
    PAYMENT_PLAN_REQUEST: "Contact customer to discuss and set up payment arrangement",
    DISPUTE_CHARGES: "Review disputed charges and prepare documentation for resolution",
    DISPUTE_PO: "Verify purchase order details with customer and internal records",
    NEEDS_CALLBACK: "Call customer within 24 hours at requested time/number",
    PROMISE_TO_PAY: "Note promised payment date and set reminder for follow-up",
    WRONG_CUSTOMER: "Verify account assignment and correct if necessary",
    INVOICE_COPY_REQUEST: "Resend invoice copy to customer via email",
    PAYMENT_CONFIRMATION: "Verify payment receipt and update account status",
    GENERAL_INQUIRY: "Review inquiry and provide appropriate response",
    OTHER: "Review customer communication and determine next steps",
  };
  return externalActions[taskType] || "Review and respond to customer inquiry";
}

async function triggerWorkflowEngagement(
  supabase: any,
  apiKey: string,
  invoiceId: string,
  userId: string,
  debtorId: string | null,
  emailContext: {
    inboundEmailId: string;
    fromEmail: string;
    subject: string;
    summary: string;
    actions: any[];
  }
) {
  console.log(`[WORKFLOW] Checking workflow engagement for invoice ${invoiceId}`);

  // Fetch invoice with debtor info
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      amount,
      due_date,
      aging_bucket,
      status,
      debtors (id, name, company_name, email)
    `)
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    console.log(`[WORKFLOW] Invoice not found: ${invoiceId}`);
    return;
  }

  if (!invoice.aging_bucket || invoice.aging_bucket === "current" || invoice.aging_bucket === "paid") {
    console.log(`[WORKFLOW] Invoice not in active aging bucket: ${invoice.aging_bucket}`);
    return;
  }

  if (invoice.status !== "Open" && invoice.status !== "InPaymentPlan") {
    console.log(`[WORKFLOW] Invoice status not eligible: ${invoice.status}`);
    return;
  }

  // Check for active workflow in this aging bucket
  const { data: workflow, error: workflowError } = await supabase
    .from("collection_workflows")
    .select("id, name, aging_bucket, auto_generate_drafts")
    .eq("aging_bucket", invoice.aging_bucket)
    .eq("is_active", true)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("user_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  if (workflowError || !workflow) {
    console.log(`[WORKFLOW] No active workflow for bucket ${invoice.aging_bucket}`);
    return;
  }

  console.log(`[WORKFLOW] Found active workflow: ${workflow.name} for bucket ${invoice.aging_bucket}`);

  // Get the appropriate persona for this bucket
  const personaName = PERSONA_BUCKET_MAP[invoice.aging_bucket] || "Sam";

  // Fetch persona details
  const { data: persona } = await supabase
    .from("ai_agent_personas")
    .select("id, name, tone_guidelines, persona_summary")
    .eq("name", personaName)
    .single();

  if (!persona) {
    console.log(`[WORKFLOW] Persona ${personaName} not found`);
    return;
  }

  // Check if we already have a pending response draft for this invoice
  const { data: existingDraft } = await supabase
    .from("ai_drafts")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("status", "pending_approval")
    .limit(1);

  if (existingDraft && existingDraft.length > 0) {
    console.log(`[WORKFLOW] Pending draft already exists for invoice ${invoiceId}`);
    return;
  }

  // Generate response draft using AI
  const debtor = invoice.debtors as any;
  const systemPrompt = `You are ${persona.name}, an AI collections agent for Recouply.ai. ${persona.persona_summary}

Tone guidelines: ${persona.tone_guidelines}

Generate a professional follow-up email response based on the customer's inbound communication. The response should:
1. Acknowledge their message/concern
2. Address any specific issues or requests they mentioned
3. Move the conversation toward resolution/payment
4. Maintain the appropriate tone for the aging bucket

Keep the response concise and professional.`;

  const userPrompt = `Generate a follow-up response email for:

Customer: ${debtor?.name || "Customer"} (${debtor?.company_name || ""})
Invoice: ${invoice.invoice_number} - $${invoice.amount}
Due Date: ${invoice.due_date}
Aging Bucket: ${invoice.aging_bucket}

Customer's Original Email Subject: ${emailContext.subject}
AI Summary of Customer's Email: ${emailContext.summary}
${emailContext.actions.length > 0 ? `Detected Action Items: ${emailContext.actions.map((a: any) => a.type).join(", ")}` : ""}

Generate a subject line and email body that appropriately responds to this communication.

Return JSON only:
{
  "subject": "Re: Subject line here",
  "body": "Email body here"
}`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in AI response for draft");
  }

  // Parse response
  let jsonContent = content.trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const draftContent = JSON.parse(jsonContent);

  // Create the draft
  const { error: draftError } = await supabase.from("ai_drafts").insert({
    user_id: userId,
    invoice_id: invoiceId,
    agent_persona_id: persona.id,
    step_number: 0, // Response draft, not part of regular workflow steps
    channel: "email",
    subject: draftContent.subject || `Re: ${emailContext.subject}`,
    message_body: draftContent.body || "Thank you for your response. We will review and get back to you shortly.",
    status: "pending_approval",
    recommended_send_date: new Date().toISOString().split("T")[0],
    days_past_due: Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)),
  });

  if (draftError) {
    throw new Error(`Failed to create draft: ${draftError.message}`);
  }

  console.log(`[WORKFLOW] ✅ Created response draft for invoice ${invoiceId} using ${personaName}`);
}

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

        // Check if sender is a team member (internal communication)
        const fromEmailLower = email.from_email?.toLowerCase().trim() || "";
        let isInternalCommunication = false;
        let teamMemberName = "";

        if (email.user_id && fromEmailLower) {
          const { data: teamMember } = await supabase
            .from("team_members")
            .select("name, email")
            .eq("user_id", email.user_id)
            .eq("is_active", true)
            .ilike("email", fromEmailLower)
            .maybeSingle();

          if (teamMember) {
            isInternalCommunication = true;
            teamMemberName = teamMember.name;
            console.log(`[AI-PROCESS] Detected internal communication from team member: ${teamMemberName}`);
          }
        }

        let systemPrompt: string;
        let userPrompt: string;

        if (isInternalCommunication) {
          // Internal communication prompt
          systemPrompt = `You are an AI assistant for Recouply.ai, a collections platform. This email is from an INTERNAL team member (${teamMemberName}), NOT a customer/debtor.

Analyze internal team communications about collection tasks/invoices and extract:
1. A brief 1-3 sentence summary of what the team member is communicating
2. Category classification (always use INTERNAL for team communications)
3. Priority level based on urgency
4. Sentiment analysis
5. Actionable items for the collections team

Valid internal action types: ${INTERNAL_ACTION_TYPES.join(", ")}
Valid categories: INTERNAL
Valid priorities: ${PRIORITIES.join(", ")}
Valid sentiments: ${SENTIMENTS.join(", ")}

Return JSON only in this exact format:
{
  "summary": "Brief summary here",
  "category": "INTERNAL",
  "priority": "medium",
  "sentiment": "neutral",
  "is_internal": true,
  "team_member_name": "${teamMemberName}",
  "actions": [
    {
      "type": "STATUS_UPDATE",
      "confidence": 0.95,
      "details": "Team member provided update on customer contact"
    }
  ]
}`;

          userPrompt = `Analyze this INTERNAL team member email:

From: ${teamMemberName} (${email.from_email})
Subject: ${email.subject}
${debtorInfo ? `Related Debtor: ${debtorInfo.name} (${debtorInfo.company_name})` : ""}
${invoiceInfo ? `Related Invoice: ${invoiceInfo.invoice_number} - $${invoiceInfo.amount}` : ""}

Body:
${email.text_body || email.html_body || "(No body)"}

Extract summary and internal action items. Remember this is internal team communication, not a customer response.`;
        } else {
          // External/customer communication prompt (original)
          systemPrompt = `You are an AI assistant for Recouply.ai, a collections platform. Analyze customer responses to collection emails and extract:
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

          userPrompt = `Analyze this email:

From: ${email.from_email}
Subject: ${email.subject}
${debtorInfo ? `Debtor: ${debtorInfo.name} (${debtorInfo.company_name})` : ""}
${invoiceInfo ? `Invoice: ${invoiceInfo.invoice_number} - $${invoiceInfo.amount}` : ""}

Body:
${email.text_body || email.html_body || "(No body)"}

Extract summary and actions.`;
        }

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
        const category = isInternalCommunication ? "INTERNAL" : (parsed.category || "OTHER");
        const priority = parsed.priority || "medium";
        const sentiment = parsed.sentiment || "neutral";
        const actions = parsed.actions || [];

        // Update inbound_emails with full categorization
        await supabase
          .from("inbound_emails")
          .update({
            ai_summary: isInternalCommunication 
              ? `[INTERNAL - ${teamMemberName}] ${summary}` 
              : summary,
            ai_category: category,
            ai_priority: priority,
            ai_sentiment: sentiment,
            ai_actions: actions,
            ai_processed_at: new Date().toISOString(),
            status: "processed",
            action_status: actions.length > 0 ? "open" : "closed",
          })
          .eq("id", email.id);

        // Create tasks from actions with full context for follow-up
        if (actions.length > 0 && email.user_id && email.debtor_id) {
          // Calculate due date based on priority (high: 1 day, medium: 3 days, low: 7 days)
          const getDueDate = (actionPriority: string) => {
            const daysMap: Record<string, number> = { high: 1, medium: 3, low: 7 };
            const days = daysMap[actionPriority] || 3;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + days);
            return dueDate.toISOString().split("T")[0];
          };

          const tasks = actions.map((action: any) => {
            const taskPriority = action.type === "PROMISE_TO_PAY" || action.type === "ESCALATION" ? "high" : 
                                action.confidence >= 0.9 ? "high" : "normal";
            
            return {
              user_id: email.user_id,
              debtor_id: email.debtor_id,
              invoice_id: email.invoice_id,
              task_type: action.type,
              priority: taskPriority,
              status: "open",
              summary: isInternalCommunication 
                ? `[Internal] ${action.type}: ${email.subject}`
                : `${action.type}: ${email.subject}`,
              details: isInternalCommunication
                ? `From team member ${teamMemberName}: ${action.details || ""}`
                : (action.details || ""),
              source: isInternalCommunication ? "internal_communication" : "ai_extraction",
              from_email: email.from_email,
              subject: email.subject,
              raw_email: (email.text_body || email.html_body || "").substring(0, 5000), // Truncate for storage
              ai_reasoning: `AI extracted action with ${Math.round((action.confidence || 0.8) * 100)}% confidence. Category: ${category}, Sentiment: ${sentiment}`,
              recommended_action: getRecommendedAction(action.type, isInternalCommunication),
              due_date: getDueDate(taskPriority),
              inbound_email_id: email.id, // Link task to source inbound email
            };
          });

          const { error: taskError } = await supabase.from("collection_tasks").insert(tasks);
          if (taskError) {
            console.error(`[AI-PROCESS] Error creating tasks:`, taskError.message);
          } else {
            console.log(`[AI-PROCESS] Created ${tasks.length} tasks for email ${email.id}`);
          }
          console.log(`[AI-PROCESS] Created ${tasks.length} tasks for email ${email.id}`);
        }

        // Trigger automatic workflow engagement for external emails linked to invoices
        if (!isInternalCommunication && email.invoice_id && email.user_id) {
          try {
            await triggerWorkflowEngagement(
              supabase,
              LOVABLE_API_KEY,
              email.invoice_id,
              email.user_id,
              email.debtor_id,
              {
                inboundEmailId: email.id,
                fromEmail: email.from_email,
                subject: email.subject,
                summary,
                actions,
              }
            );
          } catch (wfError: any) {
            console.error(`[AI-PROCESS] Workflow engagement failed for email ${email.id}:`, wfError.message);
            // Don't fail the whole processing if workflow fails
          }
        }

        processed++;
        console.log(`[AI-PROCESS] ✅ Processed email ${email.id} (internal: ${isInternalCommunication})`);
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
