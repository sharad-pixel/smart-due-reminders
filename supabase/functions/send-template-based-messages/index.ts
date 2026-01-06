// ⚠️ EMAIL DOMAIN WARNING ⚠️
// This function sends emails via Resend.
// The FROM email MUST use verified domain: send.inbound.services.recouply.ai
// DO NOT change to @recouply.ai - it will fail!
// See: supabase/functions/_shared/emailConfig.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOutreachContacts } from "../_shared/contactUtils.ts";
import { generateBrandedEmail, getEmailFromAddress } from "../_shared/emailSignature.ts";
import { INBOUND_EMAIL_DOMAIN } from "../_shared/emailConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache branding settings per user to avoid repeated queries
const brandingCache = new Map<string, any>();

// Process a batch of invoices for a template
async function processInvoiceBatch(
  supabase: any,
  template: any,
  invoices: any[],
  today: Date,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Get all invoice IDs to check which were already sent in bulk
  const invoiceIds = invoices.map(inv => inv.id);
  const { data: alreadySentRecords } = await supabase
    .from('sent_template_messages')
    .select('invoice_id')
    .eq('template_id', template.id)
    .in('invoice_id', invoiceIds);

  const alreadySentSet = new Set((alreadySentRecords || []).map((r: any) => r.invoice_id));

  for (const invoice of invoices) {
    if (alreadySentSet.has(invoice.id)) {
      skipped++;
      continue;
    }

    // Calculate days since invoice entered bucket
    const bucketEnteredDate = new Date(invoice.bucket_entered_at || invoice.created_at);
    bucketEnteredDate.setHours(0, 0, 0, 0);
    const daysSinceEntered = Math.floor((today.getTime() - bucketEnteredDate.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Invoice ${invoice.invoice_number}: ${daysSinceEntered} days in bucket, template offset: ${template.day_offset}`);

    // For day_offset 0, send if invoice is at or past day 0 (same day or later)
    // For other offsets, only send on the exact day
    const shouldSend = template.day_offset === 0 
      ? daysSinceEntered >= 0 
      : daysSinceEntered === template.day_offset;

    if (!shouldSend) {
      continue;
    }

    // Personalize the template with invoice data
    const debtor = Array.isArray(invoice.debtors) ? invoice.debtors[0] : invoice.debtors;
    
    // Fetch all outreach-enabled contacts with fallback to debtor record
    const outreachContacts = await getOutreachContacts(supabase, debtor?.id, debtor);
    const allEmails = outreachContacts.emails;
    const contactName = outreachContacts.primaryName || debtor?.name || debtor?.company_name || "";
    
    if (allEmails.length === 0) {
      console.log(`No outreach-enabled contact with email for debtor on invoice ${invoice.invoice_number}, skipping`);
      continue;
    }

    // Fetch branding settings for this user (cached)
    let branding = brandingCache.get(template.user_id);
    if (!branding) {
      const { data: brandingData } = await supabase
        .from('branding_settings')
        .select('logo_url, business_name, from_name, email_signature, email_footer, primary_color, ar_page_public_token, ar_page_enabled, stripe_payment_link')
        .eq('user_id', template.user_id)
        .maybeSingle();
      branding = brandingData || {};
      brandingCache.set(template.user_id, branding);
    }

    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let personalizedBody = template.message_body_template
      .replace(/\{\{debtor_name\}\}/g, contactName)
      .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number)
      .replace(/\{\{amount\}\}/g, invoice.amount.toString())
      .replace(/\{\{currency\}\}/g, invoice.currency || 'USD')
      .replace(/\{\{due_date\}\}/g, invoice.due_date)
      .replace(/\{\{days_past_due\}\}/g, daysPastDue.toString());

    let personalizedSubject = template.subject_template
      ?.replace(/\{\{debtor_name\}\}/g, contactName)
      ?.replace(/\{\{invoice_number\}\}/g, invoice.invoice_number)
      ?.replace(/\{\{amount\}\}/g, invoice.amount.toString())
      ?.replace(/\{\{currency\}\}/g, invoice.currency || 'USD')
      ?.replace(/\{\{due_date\}\}/g, invoice.due_date)
      ?.replace(/\{\{days_past_due\}\}/g, daysPastDue.toString());

    const replyToEmail = `invoice+${invoice.id}@${INBOUND_EMAIL_DOMAIN}`;

    // Generate From address with user's branding (falls back to Recouply.ai if no branding)
    const fromEmail = getEmailFromAddress(branding);

    // Format body with line breaks
    const formattedBody = personalizedBody.replace(/\n/g, "<br>");

    // Generate fully branded email HTML (uses Recouply.ai branding as fallback)
    const emailHtml = generateBrandedEmail(
      formattedBody,
      branding,
      {
        invoiceId: invoice.id,
        amount: invoice.amount,
      }
    );

    console.log(`Sending branded email from ${fromEmail} to ${allEmails.join(', ')} for invoice ${invoice.invoice_number}`);

    try {
      // Send email to ALL outreach-enabled contacts
      const sendEmailResponse = await fetch(
        `${supabaseUrl}/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            to: allEmails,
            from: fromEmail,
            reply_to: replyToEmail,
            subject: personalizedSubject || `Invoice ${invoice.invoice_number} - Payment Required`,
            html: emailHtml,
          }),
        }
      );

      const sendResult = await sendEmailResponse.json();

      if (!sendEmailResponse.ok) {
        console.error(`Failed to send to invoice ${invoice.invoice_number}:`, sendResult);
        errors.push(`Failed to send to invoice ${invoice.invoice_number}`);
        continue;
      }

      console.log(`Email sent to ${allEmails.length} recipient(s) for invoice ${invoice.invoice_number}`);

      // Log the collection activity
      await supabase
        .from('collection_activities')
        .insert({
          user_id: template.user_id,
          debtor_id: invoice.debtor_id,
          invoice_id: invoice.id,
          activity_type: 'outreach',
          direction: 'outbound',
          channel: 'email',
          subject: personalizedSubject || `Invoice ${invoice.invoice_number} - Payment Required`,
          message_body: personalizedBody,
          sent_at: new Date().toISOString(),
          metadata: {
            from_email: fromEmail,
            from_name: branding?.business_name || 'Recouply.ai',
            reply_to_email: replyToEmail,
            template_id: template.id,
            platform_send: true,
            branded: true,
          },
        });

      // Log the sent message to prevent duplicates
      await supabase
        .from('sent_template_messages')
        .insert({
          user_id: template.user_id,
          template_id: template.id,
          invoice_id: invoice.id,
          debtor_id: invoice.debtor_id,
          channel: template.channel,
          subject: personalizedSubject,
          personalized_body: personalizedBody,
        });

      sent++;
      console.log(`Sent personalized message to invoice ${invoice.invoice_number}`);
    } catch (error: any) {
      console.error(`Error sending to invoice ${invoice.invoice_number}:`, error);
      errors.push(`Error sending to invoice ${invoice.invoice_number}: ${error.message}`);
    }
  }

  return { sent, skipped, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for optional limit parameter
    let limit = 50; // Default limit per run to prevent timeout
    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === 'number') {
        limit = Math.min(body.limit, 100); // Cap at 100
      }
    } catch {
      // No body or invalid JSON, use default limit
    }

    console.log(`Starting template-based message sending (limit: ${limit})`);

    // Get all approved templates
    const { data: templates, error: templatesError } = await supabase
      .from('draft_templates')
      .select(`
        *,
        workflow:collection_workflows!inner(*),
        step:collection_workflow_steps!inner(*)
      `)
      .eq('status', 'approved');

    if (templatesError) throw templatesError;

    console.log(`Found ${templates?.length || 0} approved templates`);

    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No approved templates to process',
        sent: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSent = 0;
    let totalSkipped = 0;
    let allErrors: string[] = [];
    let processedCount = 0;

    // Process each template with limit
    for (const template of templates) {
      if (processedCount >= limit) {
        console.log(`Reached limit of ${limit} invoices, stopping`);
        break;
      }

      try {
        // Find invoices in this aging bucket that should receive this template
        // Limit the query to avoid processing too many
        const remainingLimit = limit - processedCount;
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            *,
            debtors!inner(*)
          `)
          .eq('user_id', template.user_id)
          .eq('aging_bucket', template.aging_bucket)
          .in('status', ['Open', 'InPaymentPlan'])
          .limit(remainingLimit);

        if (invoicesError) throw invoicesError;

        if (!invoices || invoices.length === 0) continue;

        console.log(`Processing template ${template.id} for ${invoices.length} invoices`);

        const result = await processInvoiceBatch(
          supabase,
          template,
          invoices,
          today,
          supabaseUrl,
          supabaseKey
        );

        totalSent += result.sent;
        totalSkipped += result.skipped;
        allErrors = allErrors.concat(result.errors);
        processedCount += invoices.length;

      } catch (error: any) {
        console.error(`Error processing template ${template.id}:`, error);
        allErrors.push(`Error processing template: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: totalSent,
      skipped: totalSkipped,
      processed: processedCount,
      limit,
      hasMore: processedCount >= limit,
      errors: allErrors.length > 0 ? allErrors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error in send-template-based-messages:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});