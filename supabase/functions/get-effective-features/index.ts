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

    // Get user's profile first
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('plan_type, subscription_status')
      .eq('id', user.id)
      .single();

    let planType = userProfile?.plan_type || 'free';
    let subscriptionStatus = userProfile?.subscription_status;

    // If user is not the account owner, check if they belong to an account and get owner's plan
    const { data: accountUser } = await supabaseClient
      .from('account_users')
      .select('account_id, is_owner')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (accountUser && !accountUser.is_owner) {
      // User is a team member - get the account owner's plan
      const { data: ownerProfile } = await supabaseClient
        .from('profiles')
        .select('plan_type, subscription_status')
        .eq('id', accountUser.account_id)
        .single();

      if (ownerProfile) {
        planType = ownerProfile.plan_type || 'free';
        subscriptionStatus = ownerProfile.subscription_status;
      }
    }

    // Trial configuration: 7 days, 5 invoices
    const TRIAL_INVOICE_LIMIT = 5;
    
    // Default plan features - all paid plans can have team users
    const planFeatures: Record<string, any> = {
      free: {
        can_use_invoice_line_items: false,
        invoice_limit: TRIAL_INVOICE_LIMIT, // 5 invoices for free/trial
        can_have_team_users: false,
        can_manage_roles: false,
        max_invited_users: 0,
      },
      starter: {
        can_use_invoice_line_items: false,
        invoice_limit: 100,
        can_have_team_users: true,
        can_manage_roles: true,
        max_invited_users: 10,
      },
      growth: {
        can_use_invoice_line_items: true,
        invoice_limit: 300,
        can_have_team_users: true,
        can_manage_roles: true,
        max_invited_users: 25,
      },
      pro: {
        can_use_invoice_line_items: true,
        invoice_limit: 500,
        can_have_team_users: true,
        can_manage_roles: true,
        max_invited_users: 50,
      },
      professional: {
        can_use_invoice_line_items: true,
        invoice_limit: 500,
        can_have_team_users: true,
        can_manage_roles: true,
        max_invited_users: 50,
      },
      enterprise: {
        can_use_invoice_line_items: true,
        invoice_limit: 10000,
        can_have_team_users: true,
        can_manage_roles: true,
        max_invited_users: 100,
      },
    };

    // Use base features for the plan, default to free if unknown
    let basePlanFeatures = planFeatures[planType] || planFeatures.free;

    // If user has an active subscription, ensure team features are enabled
    if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      // Override to ensure paid users have team access
      if (planType !== 'free') {
        basePlanFeatures = {
          ...basePlanFeatures,
          can_have_team_users: true,
          can_manage_roles: true,
        };
      }
    }

    // Get feature overrides
    const { data: overrides } = await supabaseClient
      .from('user_feature_overrides')
      .select('feature_key, value')
      .eq('user_id', user.id);

    // Apply overrides
    const effectiveFeatures = { ...basePlanFeatures };
    if (overrides) {
      for (const override of overrides) {
        effectiveFeatures[override.feature_key] = override.value;
      }
    }

    return new Response(
      JSON.stringify({
        plan_type: planType,
        subscription_status: subscriptionStatus,
        features: effectiveFeatures,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error getting effective features:', error);
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
