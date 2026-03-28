import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // Check admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let daysInactive = 7;
    try {
      const body = await req.json();
      daysInactive = parseInt(body.daysInactive) || 7;
    } catch (_e) {}

    const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000).toISOString();

    // Get all profiles created before cutoff
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, email, name, company_name, created_at, subscription_status, plan_type, stripe_subscription_id, is_suspended')
      .lte('created_at', cutoffDate)
      .eq('is_suspended', false)
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ staleUsers: [], stats: { total: 0, noInvoices: 0, noDebtors: 0, noBoth: 0 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = profiles.map((p: any) => p.id);

    // Get invoice counts per user
    const { data: invoiceCounts } = await supabaseClient
      .rpc('', {}) // Can't use rpc easily, use raw queries via select
      .from('invoices')
      .select('user_id')
      .in('user_id', userIds);
    
    // Actually, let's do it differently - get users who have invoices
    const { data: usersWithInvoices } = await supabaseClient
      .from('invoices')
      .select('user_id')
      .in('user_id', userIds);

    const { data: usersWithDebtors } = await supabaseClient
      .from('debtors')
      .select('user_id')
      .in('user_id', userIds);

    const invoiceUserSet = new Set((usersWithInvoices || []).map((r: any) => r.user_id));
    const debtorUserSet = new Set((usersWithDebtors || []).map((r: any) => r.user_id));

    // Get last_sign_in_at from auth for these users
    const authUserMap = new Map<string, string | null>();
    try {
      const { data: authListData } = await supabaseClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (authListData?.users) {
        for (const au of authListData.users) {
          if (userIds.includes(au.id)) {
            authUserMap.set(au.id, au.last_sign_in_at || null);
          }
        }
      }
    } catch (_e) {
      console.error('Error fetching auth users:', _e);
    }

    // Filter to stale users: no invoices AND no debtors
    const staleUsers = profiles
      .filter((p: any) => !invoiceUserSet.has(p.id) && !debtorUserSet.has(p.id))
      .map((p: any) => ({
        ...p,
        last_sign_in_at: authUserMap.get(p.id) || null,
        has_invoices: false,
        has_debtors: false,
      }));

    // Also include users who have debtors but no invoices (partial engagement)
    const partialUsers = profiles
      .filter((p: any) => !invoiceUserSet.has(p.id) && debtorUserSet.has(p.id))
      .map((p: any) => ({
        ...p,
        last_sign_in_at: authUserMap.get(p.id) || null,
        has_invoices: false,
        has_debtors: true,
      }));

    const allInactive = [...staleUsers, ...partialUsers];

    return new Response(
      JSON.stringify({
        staleUsers: allInactive,
        stats: {
          total: allInactive.length,
          noInvoices: allInactive.filter((u: any) => !u.has_invoices).length,
          noDebtors: staleUsers.length,
          partialEngagement: partialUsers.length,
          totalProfiles: profiles.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[admin-stale-users] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
