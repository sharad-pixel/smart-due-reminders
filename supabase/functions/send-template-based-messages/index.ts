import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FROM_EMAIL = "Recouply.ai <notifications@send.inbound.services.recouply.ai>";
const PLATFORM_INBOUND_DOMAIN = "inbound.services.recouply.ai";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting template-based message sending');

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

    let sent = 0;
    let skipped = 0;
    let errors: string[] = [];

    // Process each template
    for (const template of templates) {
      try {
        // Find invoices in this aging bucket that should receive this template
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            *,
            debtors!inner(*)
          `)
          .eq('user_id', template.user_id)
          .eq('aging_bucket', template.aging_bucket)
          .in('status', ['Open', 'InPaymentPlan']);

        if (invoicesError) throw invoicesError;

        console.log(`Processing template ${template.id} for ${invoices?.length || 0} invoices`);

        for (const invoice of invoices || []) {
          // Check if already sent for this template + invoice combo
          const { data: alreadySent } = await supabase
            .from('sent_template_messages')
            .select('id')
            .eq('template_id', template.id)
            .eq('invoice_id', invoice.id)
            .maybeSingle();

          if (alreadySent) {
            console.log(`Already sent template ${template.id} to invoice ${invoice.invoice_number}`);
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
          
          // Fetch primary contact from debtor_contacts (source of truth)
          let contactEmail = "";
          let contactName = debtor?.name || debtor?.company_name || "";
          if (debtor?.id) {
            const { data: contacts } = await supabase
              .from("debtor_contacts")
              .select("name, email, is_primary, outreach_enabled")
              .eq("debtor_id", debtor.id)
              .eq("outreach_enabled", true)
              .order("is_primary", { ascending: false });
            
            if (contacts && contacts.length > 0) {
              const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];
              contactEmail = primaryContact?.email || "";
              contactName = primaryContact?.name || contactName;
            }
          }
          
          if (!contactEmail) {
            console.log(`No outreach-enabled contact with email for debtor on invoice ${invoice.invoice_number}, skipping`);
            continue;
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

          const replyToEmail = `invoice+${invoice.id}@${PLATFORM_INBOUND_DOMAIN}`;

          console.log(`Sending email to ${contactEmail} for invoice ${invoice.invoice_number}`);

          // Send email directly via send-email function
          const sendEmailResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                to: contactEmail,
                from: PLATFORM_FROM_EMAIL,
                reply_to: replyToEmail,
                subject: personalizedSubject || `Invoice ${invoice.invoice_number} - Payment Required`,
                html: personalizedBody,
              }),
            }
          );

          const sendResult = await sendEmailResponse.json();

          if (!sendEmailResponse.ok) {
            console.error(`Failed to send to invoice ${invoice.invoice_number}:`, sendResult);
            errors.push(`Failed to send to invoice ${invoice.invoice_number}`);
            continue;
          }

          console.log(`Email sent to ${contactEmail} for invoice ${invoice.invoice_number}`);

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
                from_email: PLATFORM_FROM_EMAIL,
                reply_to_email: replyToEmail,
                template_id: template.id,
                platform_send: true,
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
        }
      } catch (error: any) {
        console.error(`Error processing template ${template.id}:`, error);
        errors.push(`Error processing template: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
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