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

    // Check if user is blocked
    const { data: blockedUser } = await supabaseClient
      .from('blocked_users')
      .select('email, blocked_at, reason')
      .eq('email', userProfile.email?.toLowerCase())
      .maybeSingle();

    // Get account relationships (where this user is a member)
    const { data: accountRelationships } = await supabaseClient
      .from('account_users')
      .select(`
        id,
        account_id,
        user_id,
        role,
        status,
        is_owner,
        email,
        accepted_at,
        invited_at
      `)
      .eq('user_id', userId);

    // Get account owner details for each relationship
    const accountRelationshipsWithOwners = [];
    if (accountRelationships) {
      for (const rel of accountRelationships) {
        if (!rel.is_owner && rel.account_id) {
          const { data: ownerProfile } = await supabaseClient
            .from('profiles')
            .select('id, name, email, company_name')
            .eq('id', rel.account_id)
            .single();
          
          accountRelationshipsWithOwners.push({
            ...rel,
            account_owner: ownerProfile,
          });
        } else {
          accountRelationshipsWithOwners.push({
            ...rel,
            account_owner: null,
          });
        }
      }
    }

    // Get team members if this user is an account owner
    const { data: teamMembers } = await supabaseClient
      .from('account_users')
      .select(`
        id,
        user_id,
        email,
        role,
        status,
        is_owner,
        accepted_at,
        profiles:user_id (
          id,
          email,
          name,
          avatar_url
        )
      `)
      .eq('account_id', userId);

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

    // Get usage statistics - get more months
    const { data: invoiceUsage } = await supabaseClient
      .from('invoice_usage')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(12);

    const { count: invoiceCount } = await supabaseClient
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: debtorCount } = await supabaseClient
      .from('debtors')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Merge blocked status into user profile
    const enrichedUser = {
      ...userProfile,
      is_blocked: !!blockedUser,
      blocked_at: blockedUser?.blocked_at || null,
      blocked_reason: blockedUser?.reason || null,
    };

    return new Response(
      JSON.stringify({
        user: enrichedUser,
        accountRelationships: accountRelationshipsWithOwners || [],
        teamMembers: teamMembers || [],
        usageData: (invoiceUsage || []).map((u: any) => ({ 
          month: u.month, 
          count: (u.included_invoices_used || 0) + (u.overage_invoices || 0),
          included_invoices_used: u.included_invoices_used || 0,
          overage_invoices: u.overage_invoices || 0
        })),
        adminActions: (actions || []).map((a: any) => ({
          id: a.id,
          action: a.action,
          action_type: a.action_type,
          details: a.details,
          created_at: a.created_at,
          admin_id: a.admin_id,
        })),
        overrides: overrides || [],
        stats: {
          invoice_count: invoiceCount || 0,
          debtor_count: debtorCount || 0,
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
