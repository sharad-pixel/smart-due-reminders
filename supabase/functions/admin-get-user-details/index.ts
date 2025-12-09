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
    
    const user = userData.user;

    // Check if user is a Recouply.ai admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get userId from request body or query params
    let userId: string | null = null;
    
    // Try to get from body first (POST request)
    try {
      const body = await req.json();
      userId = body.userId;
    } catch {
      // If no body, try query params (GET request)
      const url = new URL(req.url);
      userId = url.searchParams.get('userId');
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId parameter required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get user profile with plan details
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select(`
        *,
        plans:plan_id (
          id,
          name,
          monthly_price,
          invoice_limit,
          overage_amount,
          feature_flags
        )
      `)
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Get feature overrides
    const { data: overrides } = await supabaseClient
      .from('user_feature_overrides')
      .select('*')
      .eq('user_id', userId);

    // Get recent admin actions on this user
    const { data: actions } = await supabaseClient
      .from('admin_user_actions')
      .select(`
        *,
        admin:admin_id (
          email,
          name
        )
      `)
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get usage statistics
    const { data: invoiceUsage } = await supabaseClient
      .from('invoice_usage')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(3);

    const { count: invoiceCount } = await supabaseClient
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: debtorCount } = await supabaseClient
      .from('debtors')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return new Response(
      JSON.stringify({
        profile: userProfile,
        overrides: overrides || [],
        actions: actions || [],
        stats: {
          invoice_count: invoiceCount || 0,
          debtor_count: debtorCount || 0,
          usage_history: invoiceUsage || [],
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error getting user details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
