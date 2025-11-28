import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateDraftRequest {
  invoice_id: string;
  tone: "friendly" | "firm" | "neutral";
  step_number: number;
}

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

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { invoice_id, tone, step_number }: GenerateDraftRequest = await req.json();

    if (!invoice_id || !tone || step_number === undefined) {
      throw new Error("Missing required parameters: invoice_id, tone, step_number");
    }

    // Fetch invoice with debtor information
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select(`
        *,
        debtors (
          name,
          email,
          company_name,
          crm_account_id
        )
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice fetch error:", invoiceError);
      throw new Error("Invoice not found");
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("business_name, stripe_payment_link_url")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      throw new Error("User profile not found");
    }

    // Fetch CRM account if linked
    let crmAccount = null;
    if (invoice.debtors.crm_account_id) {
      const { data: crmData, error: crmError } = await supabaseClient
        .from("crm_accounts")
        .select("*")
        .eq("id", invoice.debtors.crm_account_id)
        .single();
      
      if (!crmError && crmData) {
        crmAccount = crmData;
        console.log("CRM account found:", crmAccount.name);
      }
    }

    // Calculate days past due
    const today = new Date();
    const dueDate = new Date(invoice.due_date);
    const diffTime = today.getTime() - dueDate.getTime();
    const daysPastDue = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Fetch the appropriate AI agent persona based on days past due
    // If not past due (daysPastDue = 0), use the first persona (Sam)
    const queryDays = daysPastDue === 0 ? 1 : daysPastDue;
    
    const { data: agentPersona, error: agentError } = await supabaseClient
      .from("ai_agent_personas")
      .select("*")
      .lte("bucket_min", queryDays)
      .or(`bucket_max.is.null,bucket_max.gte.${queryDays}`)
      .order("bucket_min", { ascending: false })
      .limit(1)
      .single();

    if (agentError || !agentPersona) {
      console.error("Agent persona fetch error:", agentError);
      throw new Error("Could not determine appropriate collection agent");
    }

    console.log(`Using agent ${agentPersona.name} for ${daysPastDue} days past due`);

    // Fetch any open tasks for this invoice
    const { data: openTasks } = await supabaseClient
      .from('collection_tasks')
      .select('*')
      .eq('invoice_id', invoice_id)
      .in('status', ['open', 'in_progress'])
      .order('priority', { ascending: false });
    
    // Build task context
    let taskContext = '';
    if (openTasks && openTasks.length > 0) {
      const taskLabels: Record<string, string> = {
        w9_request: 'W9 tax form request',
        payment_plan_needed: 'payment arrangement request',
        incorrect_po: 'dispute about wrong PO number',
        dispute_charges: 'dispute about incorrect charges',
        invoice_copy_request: 'request to resend invoice',
        billing_address_update: 'billing address correction needed',
        payment_method_update: 'payment details update needed',
        service_not_delivered: 'claim that service/product not received',
        overpayment_inquiry: 'question about double charge or overpayment',
        paid_verification: 'claim that invoice already paid',
        extension_request: 'request for payment deadline extension',
        callback_required: 'request for phone call or meeting'
      };

      const taskDescriptions = openTasks.map(task => {
        const label = taskLabels[task.task_type] || task.task_type;
        return `- ${label}: ${task.summary}${task.recommended_action ? ` (Action needed: ${task.recommended_action})` : ''}`;
      }).join('\n');

      taskContext = `\n\nCRITICAL: The customer has made the following requests or raised these issues:\n${taskDescriptions}\n\nYou MUST acknowledge and address these items in your message. Handle them professionally based on ${agentPersona.name}'s ${agentPersona.tone_guidelines} tone.`;
    }

    // Prepare prompt data
    const promptData = {
      business_name: profile.business_name || "Our Business",
      debtor_name: invoice.debtors.name,
      debtor_company: invoice.debtors.company_name,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      currency: invoice.currency || "USD",
      due_date: new Date(invoice.due_date).toLocaleDateString(),
      days_past_due: daysPastDue,
      payment_link: profile.stripe_payment_link_url || "Please contact us for payment options",
      tone: tone,
      step_number: step_number,
      task_context: taskContext,
    };

    console.log("Generating draft for invoice:", invoice_id, "tone:", tone, "step:", step_number);

    // Call OpenAI API
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an assistant helping a business collect its own overdue invoices while preserving the customer relationship.
You are NOT a collection agency and you must never imply that you are.
Messages are sent from the business itself.
No legal threats. No harassment. No false statements. No mention of Recouply.ai or any third-party.
Always include the payment link once in the email.
${promptData.task_context}

${crmAccount ? `Use the CRM account context to adjust tone and recommendations:
- For high-value or at-risk accounts, be more empathetic and relationship-preserving.
- Prefer offering payment plans or gentle reminders over aggressive language.
- Never mention Salesforce, CRM, or any underlying systems.` : ""}

You must respond in JSON format with the following structure:
{
  "email_subject": "string",
  "email_body": "string"
}`,
          },
          {
            role: "user",
            content: `Generate a collection message with the following details:

Business name: ${promptData.business_name}
Debtor name: ${promptData.debtor_name}
Debtor company: ${promptData.debtor_company}
Invoice number: ${promptData.invoice_number}
Amount due: $${promptData.amount} ${promptData.currency}
Due date: ${promptData.due_date}
Days past due: ${promptData.days_past_due}
Payment link: ${promptData.payment_link}
Tone: ${promptData.tone}
Step number in cadence: ${promptData.step_number}
${crmAccount ? `
CRM Account Context:
- Segment: ${crmAccount.segment || "N/A"}
- Monthly Recurring Revenue (MRR): $${crmAccount.mrr?.toLocaleString() || "N/A"}
- Lifetime Value: $${crmAccount.lifetime_value?.toLocaleString() || "N/A"}
- Customer Since: ${crmAccount.customer_since ? new Date(crmAccount.customer_since).toLocaleDateString() : "N/A"}
- Health Score: ${crmAccount.health_score || "N/A"}
- Status: ${crmAccount.status || "N/A"}
` : ""}
Please generate:
1. An email subject line
2. An email body that:
   - Clearly states the balance and due date
   - Includes the payment link once
   - Invites the customer to contact us if there are any issues or disputes
   - Uses a ${promptData.tone} tone${crmAccount ? "\n   - Takes into account the customer's value and relationship status" : ""}

Return the response as JSON with fields: email_subject, email_body`,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 1000,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    console.log("OpenAI response:", JSON.stringify(openAIData, null, 2));

    const content = openAIData.choices[0].message.content;
    
    // Parse the JSON response from OpenAI
    let parsedContent;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      parsedContent = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Failed to parse AI response. Please try again.");
    }

    const { email_subject, email_body } = parsedContent;

    if (!email_subject || !email_body) {
      throw new Error("Invalid AI response format");
    }

    const today_date = new Date().toISOString().split("T")[0];

    // Create email draft
    const { data: emailDraft, error: emailError } = await supabaseClient
      .from("ai_drafts")
      .insert({
        user_id: user.id,
        invoice_id: invoice_id,
        step_number: step_number,
        channel: "email",
        subject: email_subject,
        message_body: email_body,
        recommended_send_date: today_date,
        status: "pending_approval",
        agent_persona_id: agentPersona.id,
        days_past_due: daysPastDue,
      })
      .select()
      .single();

    if (emailError) {
      console.error("Error creating email draft:", emailError);
      throw new Error("Failed to create email draft");
    }

    console.log("Draft created successfully:", emailDraft.id);

    return new Response(
      JSON.stringify({
        success: true,
        email_draft: emailDraft,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in generate-outreach-draft function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate draft" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
