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

    // Get query parameters
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query for profiles
    let query = supabaseClient
      .from('profiles')
      .select(`
        id,
        email,
        name,
        company_name,
        plan_type,
        plan_id,
        is_admin,
        is_suspended,
        suspended_at,
        suspended_reason,
        suspended_by,
        created_at,
        trial_ends_at,
        stripe_customer_id,
        stripe_subscription_id,
        plans:plan_id (
          name,
          monthly_price,
          invoice_limit
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add search filter if provided
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query;

    if (error) {
      throw error;
    }

    // Fetch blocked status for all users
    const userEmails = users?.map((u: any) => u.email?.toLowerCase()).filter(Boolean) || [];
    const { data: blockedUsers } = await supabaseClient
      .from('blocked_users')
      .select('email, blocked_at, reason')
      .in('email', userEmails);

    // Create a map for quick lookup
    const blockedMap = new Map(
      (blockedUsers || []).map((b: any) => [b.email, { blocked_at: b.blocked_at, reason: b.reason }])
    );

    // Merge blocked status into users
    const usersWithBlockStatus = users?.map((user: any) => ({
      ...user,
      is_blocked: blockedMap.has(user.email?.toLowerCase()),
      blocked_at: blockedMap.get(user.email?.toLowerCase())?.blocked_at || null,
      blocked_reason: blockedMap.get(user.email?.toLowerCase())?.reason || null,
    }));

    return new Response(
      JSON.stringify({
        users: usersWithBlockStatus,
        total: count,
        limit,
        offset,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error listing users:', error);
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
