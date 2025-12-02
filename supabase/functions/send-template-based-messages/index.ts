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

          // Only send if days match the template's offset
          if (daysSinceEntered !== template.day_offset) {
            continue;
          }

          // Personalize the template with invoice data
          const debtor = Array.isArray(invoice.debtors) ? invoice.debtors[0] : invoice.debtors;
          const dueDate = new Date(invoice.due_date);
          dueDate.setHours(0, 0, 0, 0);
          const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          let personalizedBody = template.message_body_template
            .replace(/\{\{debtor_name\}\}/g, debtor.name || debtor.company_name)
            .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number)
            .replace(/\{\{amount\}\}/g, invoice.amount.toString())
            .replace(/\{\{currency\}\}/g, invoice.currency || 'USD')
            .replace(/\{\{due_date\}\}/g, invoice.due_date)
            .replace(/\{\{days_past_due\}\}/g, daysPastDue.toString());

          let personalizedSubject = template.subject_template
            ?.replace(/\{\{debtor_name\}\}/g, debtor.name || debtor.company_name)
            ?.replace(/\{\{invoice_number\}\}/g, invoice.invoice_number)
            ?.replace(/\{\{amount\}\}/g, invoice.amount.toString())
            ?.replace(/\{\{currency\}\}/g, invoice.currency || 'USD')
            ?.replace(/\{\{due_date\}\}/g, invoice.due_date)
            ?.replace(/\{\{days_past_due\}\}/g, daysPastDue.toString());

          // Send the email via send-collection-email function
          const { error: sendError } = await supabase.functions.invoke('send-collection-email', {
            body: {
              invoice_id: invoice.id,
              debtor_id: invoice.debtor_id,
              subject: personalizedSubject || `Invoice ${invoice.invoice_number} - Payment Required`,
              message: personalizedBody,
              channel: template.channel,
            }
          });

          if (sendError) {
            console.error(`Failed to send to invoice ${invoice.invoice_number}:`, sendError);
            errors.push(`Failed to send to invoice ${invoice.invoice_number}`);
            continue;
          }

          // Log the sent message
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