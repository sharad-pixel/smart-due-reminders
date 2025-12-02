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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;

    // Get optional debtor_id from query params
    const url = new URL(req.url);
    const debtorId = url.searchParams.get('debtor_id');

    // Get all open/in-payment-plan invoices with aging calculation
    let query = supabaseClient
      .from('invoices')
      .select(`
        *,
        debtors!inner(
          id,
          name,
          company_name,
          email,
          risk_tier
        )
      `)
      .eq('user_id', userId)
      .in('status', ['Open', 'InPaymentPlan']);

    // Filter by debtor if provided
    if (debtorId) {
      query = query.eq('debtor_id', debtorId);
    }

    const { data: invoices, error: invoicesError } = await query.order('due_date', { ascending: true });

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    // Calculate days past due and categorize by aging bucket
    const today = new Date();
    const categorized: {
      current: { invoices: any[], count: number, total_amount: number },
      dpd_1_30: { invoices: any[], count: number, total_amount: number },
      dpd_31_60: { invoices: any[], count: number, total_amount: number },
      dpd_61_90: { invoices: any[], count: number, total_amount: number },
      dpd_91_120: { invoices: any[], count: number, total_amount: number },
      dpd_121_150: { invoices: any[], count: number, total_amount: number },
      dpd_150_plus: { invoices: any[], count: number, total_amount: number },
    } = {
      current: { invoices: [], count: 0, total_amount: 0 },
      dpd_1_30: { invoices: [], count: 0, total_amount: 0 },
      dpd_31_60: { invoices: [], count: 0, total_amount: 0 },
      dpd_61_90: { invoices: [], count: 0, total_amount: 0 },
      dpd_91_120: { invoices: [], count: 0, total_amount: 0 },
      dpd_121_150: { invoices: [], count: 0, total_amount: 0 },
      dpd_150_plus: { invoices: [], count: 0, total_amount: 0 },
    };

    for (const invoice of invoices || []) {
      const dueDate = new Date(invoice.due_date);
      const daysPastDue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      let bucket: keyof typeof categorized = 'current';
      if (daysPastDue >= 151) {
        bucket = 'dpd_150_plus';
      } else if (daysPastDue >= 121) {
        bucket = 'dpd_121_150';
      } else if (daysPastDue >= 91) {
        bucket = 'dpd_91_120';
      } else if (daysPastDue >= 61) {
        bucket = 'dpd_61_90';
      } else if (daysPastDue >= 31) {
        bucket = 'dpd_31_60';
      } else if (daysPastDue >= 1) {
        bucket = 'dpd_1_30';
      }

      const enrichedInvoice = {
        ...invoice,
        days_past_due: daysPastDue,
        aging_bucket: bucket,
      };

      categorized[bucket].invoices.push(enrichedInvoice);
      categorized[bucket].count++;
      categorized[bucket].total_amount += Number(invoice.amount || 0);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: categorized,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-aging-bucket-invoices:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
