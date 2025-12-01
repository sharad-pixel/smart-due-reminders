import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto-send approved drafts...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get all approved drafts that haven't been sent yet
    const { data: approvedDrafts, error: draftsError } = await supabaseAdmin
      .from('ai_drafts')
      .select(`
        *,
        invoices!inner(
          id,
          status,
          due_date,
          aging_bucket,
          invoice_number,
          amount,
          currency,
          debtors!inner(
            name,
            company_name,
            email
          )
        )
      `)
      .eq('status', 'approved')
      .is('sent_at', null);

    if (draftsError) {
      console.error('Error fetching approved drafts:', draftsError);
      throw draftsError;
    }

    console.log(`Found ${approvedDrafts?.length || 0} approved drafts to process`);

    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const draft of approvedDrafts || []) {
      const invoice = draft.invoices as any;
      
      // Only process Open or InPaymentPlan invoices
      if (invoice.status !== 'Open' && invoice.status !== 'InPaymentPlan') {
        console.log(`Skipping draft ${draft.id}: invoice ${invoice.id} status is ${invoice.status}`);
        skippedCount++;
        continue;
      }

      // Calculate days past due to verify the invoice is still in the right bucket
      const dueDate = new Date(invoice.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Processing draft ${draft.id} for invoice ${invoice.invoice_number}, ${daysPastDue} days past due`);

      try {
        // Send the draft via the send-ai-draft function
        const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke(
          'send-ai-draft',
          {
            body: {
              draft_id: draft.id
            }
          }
        );

        if (sendError) {
          console.error(`Error sending draft ${draft.id}:`, sendError);
          errors.push(`Draft ${draft.id}: ${sendError.message}`);
          continue;
        }

        console.log(`Successfully sent draft ${draft.id} for invoice ${invoice.invoice_number}`);
        sentCount++;

        // Update draft status to sent (the send-ai-draft function should handle this, but double-check)
        await supabaseAdmin
          .from('ai_drafts')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', draft.id);

      } catch (error) {
        console.error(`Exception sending draft ${draft.id}:`, error);
        errors.push(`Draft ${draft.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`Auto-send completed: ${sentCount} drafts sent, ${skippedCount} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Sent ${sentCount} approved drafts, skipped ${skippedCount}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in auto-send-approved-drafts:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
