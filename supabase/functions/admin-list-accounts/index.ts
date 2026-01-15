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

    // Check if user is a Recouply.ai admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.user.id)
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

    // Get all account owners (parent accounts) with their subscription data
    let query = supabaseClient
      .from('profiles')
      .select(`
        id,
        email,
        name,
        company_name,
        plan_type,
        plan_id,
        subscription_status,
        stripe_customer_id,
        stripe_subscription_id,
        billing_interval,
        current_period_end,
        cancel_at_period_end,
        invoice_limit,
        overage_rate,
        trial_ends_at,
        is_admin,
        is_suspended,
        suspended_at,
        suspended_reason,
        created_at,
        plans:plan_id (
          id,
          name,
          monthly_price,
          annual_price,
          invoice_limit,
          overage_amount
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    const { data: accounts, error: accountsError, count } = await query;

    if (accountsError) {
      throw accountsError;
    }

    // Get team members for each account
    const accountIds = accounts?.map(a => a.id) || [];
    
    const { data: accountUsers } = await supabaseClient
      .from('account_users')
      .select(`
        id,
        account_id,
        user_id,
        role,
        status,
        is_owner,
        invited_at,
        accepted_at,
        seat_billing_ends_at,
        profiles:user_id (
          id,
          email,
          name,
          avatar_url
        )
      `)
      .in('account_id', accountIds)
      .order('is_owner', { ascending: false });

    // Get invoice counts and usage for each account
    const { data: invoiceCounts } = await supabaseClient
      .from('invoices')
      .select('user_id')
      .in('user_id', accountIds);

    const { data: usageData } = await supabaseClient
      .from('invoice_usage')
      .select('user_id, count, month')
      .in('user_id', accountIds)
      .order('month', { ascending: false });

    // Get blocked status for all accounts
    const accountEmails = accounts?.map((a: any) => a.email?.toLowerCase()).filter(Boolean) || [];
    const { data: blockedUsers } = await supabaseClient
      .from('blocked_users')
      .select('email, blocked_at, reason')
      .in('email', accountEmails);

    const blockedMap = new Map(
      (blockedUsers || []).map((b: any) => [b.email, { blocked_at: b.blocked_at, reason: b.reason }])
    );

    // Count invoices per account
    const invoiceCountMap = new Map<string, number>();
    (invoiceCounts || []).forEach((inv: any) => {
      invoiceCountMap.set(inv.user_id, (invoiceCountMap.get(inv.user_id) || 0) + 1);
    });

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentUsageMap = new Map<string, number>();
    (usageData || []).forEach((usage: any) => {
      if (usage.month === currentMonth) {
        currentUsageMap.set(usage.user_id, usage.count);
      }
    });

    // Group team members by account
    const teamMembersByAccount = new Map<string, any[]>();
    (accountUsers || []).forEach((member: any) => {
      if (!teamMembersByAccount.has(member.account_id)) {
        teamMembersByAccount.set(member.account_id, []);
      }
      teamMembersByAccount.get(member.account_id)?.push(member);
    });

    // Build enriched account data
    const enrichedAccounts = accounts?.map((account: any) => ({
      ...account,
      is_blocked: blockedMap.has(account.email?.toLowerCase()),
      blocked_at: blockedMap.get(account.email?.toLowerCase())?.blocked_at || null,
      blocked_reason: blockedMap.get(account.email?.toLowerCase())?.reason || null,
      invoice_count: invoiceCountMap.get(account.id) || 0,
      current_month_usage: currentUsageMap.get(account.id) || 0,
      team_members: teamMembersByAccount.get(account.id) || [],
      team_member_count: (teamMembersByAccount.get(account.id) || []).filter((m: any) => !m.is_owner).length,
    }));

    return new Response(
      JSON.stringify({
        accounts: enrichedAccounts,
        total: count,
        limit,
        offset,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error listing accounts:', error);
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
