import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPersonaToneByDaysPastDue } from "../_shared/personaTones.ts";
import { 
  processDraftContent,
  cleanupPlaceholders,
  type InvoiceData,
  type DebtorData,
  type BrandingData
} from "../_shared/draftContentEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateDraftRequest {
  invoice_id: string;
  tone?: "friendly" | "firm" | "neutral";
  step_number: number;
  use_ai_generation?: boolean; // If true, use AI instead of template
  preview_only?: boolean; // If true, generate content but DO NOT create an ai_drafts row
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

    const { invoice_id, tone, step_number, use_ai_generation, preview_only }: GenerateDraftRequest = await req.json();

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
    
    // Extract invoice link for external system
    // Prefer Stripe hosted invoice URL / public link over internal dashboard URL
    const invoiceLink = invoice?.external_link || invoice?.stripe_hosted_url || invoice?.integration_url || '';
    if (invoiceError || !invoice) {
      console.error("Invoice fetch error:", invoiceError);
      throw new Error("Invoice not found");
    }

    // CRITICAL: Block draft generation for settled invoices
    const settledStatuses = ['Paid', 'Canceled', 'Voided', 'Credited', 'Written Off', 'paid', 'canceled', 'voided', 'credited', 'written off'];
    if (settledStatuses.includes(invoice.status)) {
      console.log(`Blocking draft generation: invoice ${invoice_id} has status ${invoice.status}`);
      return new Response(
        JSON.stringify({
          error: `Cannot generate outreach for ${invoice.status} invoices`,
          invoice_status: invoice.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use the invoice owner as the source of truth for templates/branding (supports team members)
    const templateOwnerId: string = invoice.user_id || user.id;

    // Fetch primary contact from debtor_contacts table
    let contactName = invoice.debtors.name;
    if (invoice.debtors.id) {
      const { data: contacts } = await supabaseClient
        .from('debtor_contacts')
        .select('name, is_primary, outreach_enabled')
        .eq('debtor_id', invoice.debtors.id)
        .eq('outreach_enabled', true)
        .order('is_primary', { ascending: false });
      
      if (contacts && contacts.length > 0) {
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

    // Fetch profile + branding settings for the template owner
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("business_name, stripe_payment_link_url")
      .eq("id", templateOwnerId)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      throw new Error("User profile not found");
    }

    const { data: branding } = await supabaseClient
      .from("branding_settings")
      .select("*")
      .eq("user_id", templateOwnerId)
      .maybeSingle();

    // Calculate days past due
    const today = new Date();
    const dueDate = new Date(invoice.due_date);
    const diffTime = today.getTime() - dueDate.getTime();
    const daysPastDue = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Determine aging bucket
    let agingBucket = 'current';
    if (daysPastDue >= 151) {
      agingBucket = 'dpd_150_plus';
    } else if (daysPastDue >= 121) {
      agingBucket = 'dpd_121_150';
    } else if (daysPastDue >= 91) {
      agingBucket = 'dpd_91_120';
    } else if (daysPastDue >= 61) {
      agingBucket = 'dpd_61_90';
    } else if (daysPastDue >= 31) {
      agingBucket = 'dpd_31_60';
    } else if (daysPastDue >= 1) {
      agingBucket = 'dpd_1_30';
    }

    // Get persona-specific tone based on days past due
    const persona = getPersonaToneByDaysPastDue(daysPastDue === 0 ? 1 : daysPastDue);
    const personaName = persona?.name || 'Collections Agent';
    const personaGuidelines = persona?.systemPromptGuidelines || '';

    // Get agent persona from database
    const { data: agentPersona } = await supabaseClient
      .from("ai_agent_personas")
      .select("id, name")
      .lte("bucket_min", daysPastDue === 0 ? 1 : daysPastDue)
      .or(`bucket_max.is.null,bucket_max.gte.${daysPastDue === 0 ? 1 : daysPastDue}`)
      .order("bucket_min", { ascending: false })
      .limit(1)
      .single();

    // PRIORITY: Check for invoice-level custom template override first
    let email_subject: string;
    let email_body: string;
    let templateSource: string;
    let autoApprove = false; // Drafts from approved templates should be auto-approved

    const businessName = branding?.business_name || profile.business_name || "Our Business";

    if (invoice.use_custom_template && invoice.custom_template_body) {
      // Use invoice-level custom template - auto-approve since user explicitly set it
      email_subject = invoice.custom_template_subject || `Invoice ${invoice.invoice_number} - Payment Reminder`;
      email_body = invoice.custom_template_body;
      templateSource = 'invoice-level override';
      autoApprove = true;
      console.log(`Using invoice-level custom template for ${invoice.invoice_number}`);
    } else if (!use_ai_generation) {
      // Look for approved draft template
      // First, get the workflow step for this aging bucket and step number
      const { data: workflow } = await supabaseClient
        .from('collection_workflows')
        .select(`
          id,
          steps:collection_workflow_steps(*)
        `)
        .eq('aging_bucket', agingBucket)
        .or(`user_id.eq.${templateOwnerId},user_id.is.null`)
        .eq('is_active', true)
        .order('user_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      const workflowStep = workflow?.steps?.find((s: any) => s.step_order === step_number);

      // Look for approved template matching this step
      let approvedTemplate = null;
      if (workflowStep) {
        const { data: stepTemplate } = await supabaseClient
          .from('draft_templates')
          .select('*')
          .eq('workflow_step_id', workflowStep.id)
          .eq('user_id', templateOwnerId)
          .eq('status', 'approved')
          .maybeSingle();
        
        approvedTemplate = stepTemplate;
      }

      // Fallback: Check for approved template for this aging bucket
      if (!approvedTemplate) {
        const { data: bucketTemplate } = await supabaseClient
          .from('draft_templates')
          .select('*')
          .eq('aging_bucket', agingBucket)
          .eq('user_id', templateOwnerId)
          .eq('status', 'approved')
          .eq('step_number', step_number)
          .maybeSingle();
        
        approvedTemplate = bucketTemplate;
      }

      if (approvedTemplate) {
        // Use unified draft content engine for template processing
        const invoiceData: InvoiceData = {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: invoice.amount || 0,
          amount_outstanding: amountOutstanding,
          currency: invoice.currency || 'USD',
          due_date: invoice.due_date,
          product_description: invoice.product_description,
          external_link: invoice.external_link,
          stripe_hosted_url: invoice.stripe_hosted_url,
          integration_url: invoice.integration_url,
        };

        const debtorData: DebtorData = {
          id: invoice.debtors.id,
          name: contactName,
          company_name: invoice.debtors.company_name,
        };

        const brandingData: BrandingData = {
          business_name: businessName,
          from_name: branding?.from_name,
          email_signature: branding?.email_signature,
          stripe_payment_link: profile.stripe_payment_link_url,
          ar_page_public_token: branding?.ar_page_public_token,
          ar_page_enabled: branding?.ar_page_enabled,
        };

        // Process with unified engine
        const processedContent = processDraftContent({
          template: approvedTemplate.message_body_template,
          subjectTemplate: approvedTemplate.subject_template || `Invoice ${invoice.invoice_number} - Payment Reminder`,
          invoice: invoiceData,
          debtor: debtorData,
          branding: brandingData,
          contactName: contactName,
          personaName: personaName,
          daysPastDue: daysPastDue,
          includeInvoiceLink: true,
          includePaymentLink: true,
          includeArPortal: true,
          includeSignature: true,
        });

        email_subject = processedContent.cleanedSubject;
        email_body = processedContent.cleanedBody;

        templateSource = `approved template (ID: ${approvedTemplate.id})`;
        autoApprove = true; // Auto-approve since we're using an approved template
        console.log(`Using approved draft template: ${approvedTemplate.id}`);
      } else {
        // No approved template found - return error requiring template
        throw new Error(`No approved template found for ${agingBucket} step ${step_number}. Please create and approve a template first, or enable AI generation.`);
      }
    } else {
      // AI generation requested - generate with AI
      console.log(`AI generation requested for invoice ${invoice_id}, step ${step_number}`);
      
      // Fetch CRM account if linked
      let crmAccount = null;
      if (invoice.debtors.crm_account_id) {
        const { data: crmData } = await supabaseClient
          .from("crm_accounts")
          .select("*")
          .eq("id", invoice.debtors.crm_account_id)
          .single();
        
        if (crmData) {
          crmAccount = crmData;
        }
      }

      // Fetch open tasks
      const { data: openTasks } = await supabaseClient
        .from('collection_tasks')
        .select('*')
        .eq('invoice_id', invoice_id)
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: false });
      
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

        taskContext = `\n\nCRITICAL: The customer has made the following requests or raised these issues:\n${taskDescriptions}\n\nYou MUST acknowledge and address these items in your message.`;
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY not configured");
      }

      // Format amounts properly
      const formatCurrency = (amt: number, curr: string = 'USD') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, minimumFractionDigits: 2 }).format(amt);
      };
      
      const formattedAmount = formatCurrency(invoice.amount || 0, invoice.currency || 'USD');
      const formattedPaid = formatCurrency(totalPaid, invoice.currency || 'USD');
      const formattedBalance = formatCurrency(amountOutstanding, invoice.currency || 'USD');
      const formattedDueDate = new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      
      const systemPrompt = `You are ${personaName}, drafting a professional collections message for ${businessName} to send to their customer about an overdue invoice.

${personaGuidelines}

CRITICAL COMPLIANCE RULES:
- ALWAYS write in English. Never use any other language.
- Be respectful and non-threatening
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment or intimidation
- Write as if you are ${businessName}, NOT a third party
- Include the payment link once in the email BODY if available
- Encourage the customer to pay or reply if there is a dispute or issue
- If a Product/Service description is provided, mention it briefly (one short clause) to reduce confusion

ABSOLUTELY CRITICAL - USE REAL VALUES, NO PLACEHOLDERS:
- DO NOT USE ANY PLACEHOLDERS like {{variable}}, {variable}, [Name], [Your Name], or similar
- Use these EXACT values in your message:
  * Customer Name: ${contactName}
  * Business Name: ${businessName}
  * Invoice Number: ${invoice.invoice_number}
  * Amount Due: ${formattedBalance}
  * Due Date: ${formattedDueDate}
  * Days Past Due: ${daysPastDue}
- Sign the email as "${personaName}" from "${businessName}"
${taskContext}

EMAIL SUBJECT RULES:
- The subject should be SHORT and professional (under 60 characters ideal)
- NEVER include URLs, links, or long identifiers in the subject
- Good subject examples: "Payment Reminder: Invoice ${invoice.invoice_number}", "Outstanding Balance Reminder"
- BAD subject examples: Including full invoice URLs or links

OUTPUT FORMAT:
- Use simple, clean HTML with <p> tags for paragraphs
- Use <br> for line breaks within paragraphs
- Keep formatting minimal and professional

You must respond in JSON format with the following structure:
{
  "email_subject": "string (SHORT, in English, no placeholders, NO URLs)",
  "email_body": "string (in English, simple HTML, no placeholders)"
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
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate a collection message using these EXACT values (no placeholders):

Customer name: ${contactName}
Customer company: ${invoice.debtors.company_name || contactName}
Invoice number: ${invoice.invoice_number}
Original Amount: ${formattedAmount}
Amount Already Paid: ${formattedPaid}
BALANCE DUE: ${formattedBalance}
Due date: ${formattedDueDate}
Days past due: ${daysPastDue}
${profile.stripe_payment_link_url ? `Payment link: ${profile.stripe_payment_link_url}` : ''}
${invoiceLink ? `Invoice link: ${invoiceLink}` : ''}
${invoice.product_description ? `Product/Service: ${invoice.product_description}` : ''}
Your business name: ${businessName}
Agent name (sign as): ${personaName}

Return JSON with email_subject and email_body fields. Use the actual values above, NOT placeholders.`,
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
      const content = aiData.choices[0].message.content;
      
      let parsedContent;
      try {
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        parsedContent = JSON.parse(jsonString);
      } catch (parseError) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Failed to parse AI response. Please try again.");
      }

      email_subject = parsedContent.email_subject;
      email_body = parsedContent.email_body;
      
      // CRITICAL: Use unified engine to clean up any remaining placeholders from AI output
      email_subject = cleanupPlaceholders(email_subject);
      email_body = cleanupPlaceholders(email_body);
      
      // CRITICAL: Strip any URLs from subject line - they should only be in the body
      email_subject = email_subject.replace(/https?:\/\/[^\s<>"]+/gi, '').trim();
      // Clean up any leftover "View your invoice:" text without URL
      email_subject = email_subject.replace(/View your invoice:\s*/gi, '').trim();
      
      templateSource = 'AI generated';
      // AI-generated content requires human review - do not auto-approve
    }

    if (!email_subject || !email_body) {
      throw new Error("Invalid response format - missing subject or body");
    }

    // If this is just a preview, do not create a draft row
    if (preview_only) {
      console.log(`Preview-only generation using ${templateSource}`);
      return new Response(
        JSON.stringify({
          success: true,
          email_subject,
          email_body,
          template_source: templateSource,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const today_date = new Date().toISOString().split("T")[0];

    // Create email draft - auto-approve if using approved template or invoice override
    const draftStatus = autoApprove ? "approved" : "pending_approval";
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
        status: draftStatus,
        agent_persona_id: agentPersona?.id || null,
        days_past_due: daysPastDue,
      })
      .select()
      .single();

    if (emailError) {
      console.error("Error creating email draft:", emailError);
      throw new Error("Failed to create email draft");
    }

    console.log(`Draft created successfully using ${templateSource}: ${emailDraft.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        email_draft: emailDraft,
        template_source: templateSource,
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
