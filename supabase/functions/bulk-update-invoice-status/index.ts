import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateRow {
  external_invoice_id: string;
  new_status: string;
  paid_date?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { job_id, updates } = await req.json();

    if (!job_id || !updates) {
      throw new Error('Missing required fields: job_id, updates');
    }

    console.log(`Processing bulk status update job ${job_id} with ${updates.length} updates`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updates.length; i++) {
      const update: UpdateRow = updates[i];
      const rowNumber = i + 2; // +2 for header row and 0-indexing

      try {
        // Find invoice
        const { data: invoice, error: findError } = await supabase
          .from('invoices')
          .select('id, notes')
          .eq('user_id', user.id)
          .eq('external_invoice_id', update.external_invoice_id)
          .single();

        if (findError || !invoice) {
          throw new Error(`Invoice not found: ${update.external_invoice_id}`);
        }

        // Prepare update data
        const updateData: any = {
          status: update.new_status,
        };

        // If status is Paid and paid_date provided, update payment_date
        if (update.new_status === 'Paid' && update.paid_date) {
          updateData.payment_date = update.paid_date;
          updateData.paid_date = update.paid_date;
        }

        // Append notes if provided
        if (update.notes) {
          const timestamp = new Date().toISOString().split('T')[0];
          const newNote = `[${timestamp}] ${update.notes}`;
          updateData.notes = invoice.notes 
            ? `${invoice.notes}\n${newNote}`
            : newNote;
        }

        // Update invoice
        const { error: updateError } = await supabase
          .from('invoices')
          .update(updateData)
          .eq('id', invoice.id);

        if (updateError) throw updateError;

        successCount++;
      } catch (error: any) {
        console.error(`Error processing row ${rowNumber}:`, error);
        errorCount++;

        // Log error
        await supabase.from('invoice_status_update_errors').insert({
          status_update_job_id: job_id,
          row_number: rowNumber,
          raw_row_json: update,
          error_message: error.message || 'Unknown error',
        });
      }
    }

    // Update job status
    await supabase
      .from('invoice_status_update_jobs')
      .update({
        status: 'COMPLETED',
        success_count: successCount,
        error_count: errorCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job_id);

    console.log(`Bulk status update complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        success_count: successCount,
        error_count: errorCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Bulk update error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
