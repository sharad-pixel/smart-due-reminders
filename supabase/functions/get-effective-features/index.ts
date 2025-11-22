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
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's profile to determine plan
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan_type')
      .eq('id', user.id)
      .single();

    const planType = profile?.plan_type || 'free';

    // Default plan features
    const planFeatures: Record<string, any> = {
      free: {
        can_use_invoice_line_items: false,
        invoice_limit: 5,
        can_have_team_users: false,
        can_manage_roles: false,
      },
      starter: {
        can_use_invoice_line_items: false,
        invoice_limit: 50,
        can_have_team_users: false,
        can_manage_roles: false,
      },
      growth: {
        can_use_invoice_line_items: false,
        invoice_limit: 200,
        can_have_team_users: true,
        can_manage_roles: true,
      },
      pro: {
        can_use_invoice_line_items: true,
        invoice_limit: null,
        can_have_team_users: false,
        can_manage_roles: false,
      },
    };

    const basePlanFeatures = planFeatures[planType] || planFeatures.free;

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