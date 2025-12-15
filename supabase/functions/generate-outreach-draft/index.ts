import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPersonaToneByDaysPastDue } from "../_shared/personaTones.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateDraftRequest {
  invoice_id: string;
  tone?: "friendly" | "firm" | "neutral"; // Optional, will use persona if not provided
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

    if (!invoice_id || step_number === undefined) {
      throw new Error("Missing required parameters: invoice_id, step_number");
    }

    // Fetch invoice with debtor information
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select(`
        *,
        debtors (
          id,
          name,
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

    // Fetch primary contact from debtor_contacts table (source of truth for contact names)
    let contactName = invoice.debtors.name; // fallback
    if (invoice.debtors.id) {
      const { data: contacts } = await supabaseClient
        .from('debtor_contacts')
        .select('name, is_primary, outreach_enabled')
        .eq('debtor_id', invoice.debtors.id)
        .eq('outreach_enabled', true)
        .order('is_primary', { ascending: false });
      
      if (contacts && contacts.length > 0) {
        // Use primary contact or first outreach-enabled contact
        const primaryContact = contacts.find((c: any) => c.is_primary);
        contactName = primaryContact?.name || contacts[0]?.name || contactName;
        console.log(`Using contact name from debtor_contacts: ${contactName}`);
      }
    }

    // Fetch payments applied to this invoice
    const { data: paymentLinks } = await supabaseClient
      .from("payment_invoice_links")
      .select("amount_applied, status, payments(payment_date, payment_method, reference)")
      .eq("invoice_id", invoice_id)
      .eq("status", "confirmed");

    const totalPaid = paymentLinks?.reduce((sum, link) => sum + (link.amount_applied || 0), 0) || 0;
    const amountOutstanding = invoice.amount_outstanding ?? (invoice.amount - totalPaid);

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

    // Get persona-specific tone based on days past due (using shared persona system)
    const persona = getPersonaToneByDaysPastDue(daysPastDue === 0 ? 1 : daysPastDue);
    const personaName = persona?.name || 'Collections Agent';
    const personaGuidelines = persona?.systemPromptGuidelines || '';
    
    console.log(`Using persona ${personaName} for ${daysPastDue} days past due`);

    // Also fetch AI agent persona from database for agent_persona_id
    const { data: agentPersona } = await supabaseClient
      .from("ai_agent_personas")
      .select("id, name")
      .lte("bucket_min", daysPastDue === 0 ? 1 : daysPastDue)
      .or(`bucket_max.is.null,bucket_max.gte.${daysPastDue === 0 ? 1 : daysPastDue}`)
      .order("bucket_min", { ascending: false })
      .limit(1)
      .single();

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

      taskContext = `\n\nCRITICAL: The customer has made the following requests or raised these issues:\n${taskDescriptions}\n\nYou MUST acknowledge and address these items in your message. Handle them professionally based on ${personaName}'s tone.`;
    }

    // Prepare prompt data - use contactName from debtor_contacts (source of truth)
    const promptData = {
      business_name: profile.business_name || "Our Business",
      debtor_name: contactName,
      debtor_company: invoice.debtors.company_name,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      amount_outstanding: amountOutstanding,
      total_paid: totalPaid,
      currency: invoice.currency || "USD",
      due_date: new Date(invoice.due_date).toLocaleDateString(),
      days_past_due: daysPastDue,
      payment_link: profile.stripe_payment_link_url || "Please contact us for payment options",
      step_number: step_number,
      task_context: taskContext,
    };

    console.log("Generating draft for invoice:", invoice_id, "persona:", personaName, "step:", step_number, "contact:", contactName, "outstanding:", amountOutstanding);

    // Call Lovable AI API (using persona-specific tone)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are ${personaName}, drafting a professional collections message for ${promptData.business_name} to send to their customer about an overdue invoice.

${personaGuidelines}

CRITICAL COMPLIANCE RULES:
- ALWAYS write in English. Never use any other language.
- Be respectful and non-threatening
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment or intimidation
- Write as if you are ${promptData.business_name}, NOT a third party
- Always include the payment link once in the email
- Encourage the customer to pay or reply if there is a dispute or issue
${promptData.task_context}

${crmAccount ? `Use the CRM account context to adjust tone and recommendations:
- For high-value or at-risk accounts, be more empathetic and relationship-preserving.
- Prefer offering payment plans or gentle reminders over aggressive language.
- Never mention Salesforce, CRM, or any underlying systems.` : ""}

You must respond in JSON format with the following structure:
{
  "email_subject": "string (in English)",
  "email_body": "string (in English)"
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Generate a collection message with the following details:

Business name: ${promptData.business_name}
Customer name: ${promptData.debtor_name}
Customer company: ${promptData.debtor_company}
Invoice number: ${promptData.invoice_number}
Original Amount: $${promptData.amount} ${promptData.currency}
Amount Already Paid: $${promptData.total_paid} ${promptData.currency}
BALANCE DUE: $${promptData.amount_outstanding} ${promptData.currency}
Due date: ${promptData.due_date}
Days past due: ${promptData.days_past_due}
Payment link: ${promptData.payment_link}
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
   - Clearly states the BALANCE DUE ($${promptData.amount_outstanding}) - not the original amount if payments have been made
   - ${promptData.total_paid > 0 ? `Acknowledge the partial payment of $${promptData.total_paid} already received` : "States the full amount due"}
   - Includes the payment link once
   - Invites the customer to contact us if there are any issues or disputes
   - Uses ${personaName}'s ${persona?.tone || 'professional'} tone${crmAccount ? "\n   - Takes into account the customer's value and relationship status" : ""}

Return the response as JSON with fields: email_subject, email_body`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData, null, 2));

    const content = aiData.choices[0].message.content;
    
    // Parse the JSON response from AI
    let parsedContent;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      parsedContent = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
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
        agent_persona_id: agentPersona?.id || null,
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
