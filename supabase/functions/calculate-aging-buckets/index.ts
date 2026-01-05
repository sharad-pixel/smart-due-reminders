import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BucketChange {
  from: string | null;
  to: string;
  count: number;
}

interface Result {
  invoicesUpdated: number;
  bucketChanges: BucketChange[];
  escalations: number;
  errors: number;
}

function calculateAgingBucket(daysPastDue: number): string {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return 'dpd_1_30';
  if (daysPastDue <= 60) return 'dpd_31_60';
  if (daysPastDue <= 90) return 'dpd_61_90';
  if (daysPastDue <= 120) return 'dpd_91_120';
  if (daysPastDue <= 150) return 'dpd_121_150';
  return 'dpd_150_plus';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: Result = {
    invoicesUpdated: 0,
    bucketChanges: [],
    escalations: 0,
    errors: 0,
  };

  const bucketChangeMap: Record<string, number> = {};

  try {
    console.log('[AGING-BUCKETS] Starting daily aging bucket calculation...');

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Process in batches
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;
    let totalProcessed = 0;

    while (hasMore) {
      const { data: invoices, error } = await supabaseAdmin
        .from('invoices')
        .select('id, due_date, aging_bucket, user_id, status')
        .in('status', ['Open', 'InPaymentPlan'])
        .range(offset, offset + BATCH_SIZE - 1)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('[AGING-BUCKETS] Error fetching invoices:', error);
        throw error;
      }

      const batchCount = invoices?.length || 0;
      console.log(`[AGING-BUCKETS] Processing batch: ${batchCount} invoices`);

      if (batchCount === 0) {
        hasMore = false;
        break;
      }

      for (const invoice of invoices || []) {
        try {
          const dueDate = new Date(invoice.due_date);
          dueDate.setHours(0, 0, 0, 0);
          const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          const newBucket = calculateAgingBucket(daysPastDue);

          if (invoice.aging_bucket !== newBucket) {
            // Update the invoice
            const { error: updateError } = await supabaseAdmin
              .from('invoices')
              .update({
                aging_bucket: newBucket,
                bucket_entered_at: new Date().toISOString()
              })
              .eq('id', invoice.id);

            if (updateError) {
              console.error(`[AGING-BUCKETS] Error updating invoice ${invoice.id}:`, updateError);
              result.errors++;
              continue;
            }

            result.invoicesUpdated++;
            
            // Track bucket changes
            const changeKey = `${invoice.aging_bucket || 'null'}->${newBucket}`;
            bucketChangeMap[changeKey] = (bucketChangeMap[changeKey] || 0) + 1;

            // Check if this is an escalation (moving to higher priority bucket)
            const bucketOrder = ['current', 'dpd_1_30', 'dpd_31_60', 'dpd_61_90', 'dpd_91_120', 'dpd_121_150', 'dpd_150_plus'];
            const oldIndex = bucketOrder.indexOf(invoice.aging_bucket || 'current');
            const newIndex = bucketOrder.indexOf(newBucket);
            
            if (newIndex > oldIndex) {
              result.escalations++;
              console.log(`[AGING-BUCKETS] Escalation: Invoice ${invoice.id}: ${invoice.aging_bucket} -> ${newBucket}`);
            }
          }

          totalProcessed++;
        } catch (err) {
          console.error(`[AGING-BUCKETS] Error processing invoice ${invoice.id}:`, err);
          result.errors++;
        }
      }

      offset += BATCH_SIZE;
      if (batchCount < BATCH_SIZE) {
        hasMore = false;
      }

      // Safety limit
      if (totalProcessed >= 100000) {
        console.log('[AGING-BUCKETS] Reached safety limit');
        hasMore = false;
      }
    }

    // Convert bucket change map to array
    for (const [key, count] of Object.entries(bucketChangeMap)) {
      const [from, to] = key.split('->');
      result.bucketChanges.push({
        from: from === 'null' ? null : from,
        to,
        count
      });
    }

    console.log(`[AGING-BUCKETS] Complete: ${result.invoicesUpdated} updated, ${result.escalations} escalations`);

    // If there were bucket changes (escalations), trigger workflow reassignment
    if (result.escalations > 0) {
      console.log('[AGING-BUCKETS] Triggering workflow assignment for escalated invoices...');
      
      try {
        const { data, error } = await supabaseAdmin.functions.invoke('ensure-invoice-workflows', {
          body: {}
        });
        
        if (error) {
          console.error('[AGING-BUCKETS] Workflow assignment error:', error);
        } else {
          console.log('[AGING-BUCKETS] Workflow assignment result:', data);
        }
      } catch (err) {
        console.error('[AGING-BUCKETS] Workflow assignment exception:', err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoicesUpdated: result.invoicesUpdated,
        bucketChanges: result.bucketChanges,
        escalations: result.escalations,
        errors: result.errors,
        message: `Updated ${result.invoicesUpdated} invoices, ${result.escalations} escalations`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[AGING-BUCKETS] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
