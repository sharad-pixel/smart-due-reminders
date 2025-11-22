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
    
    const adminUser = userData.user;

    // Check if user is a Recouply.ai admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', adminUser.id)
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

    const { userId, updates, action } = await req.json();

    if (!userId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, action' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let result;
    let actionDetails: any = { action, userId };

    switch (action) {
      case 'update_plan': {
        if (!updates?.plan_id && !updates?.plan_type) {
          return new Response(
            JSON.stringify({ error: 'plan_id or plan_type required for update_plan' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const { data, error } = await supabaseClient
          .from('profiles')
          .update({
            plan_id: updates.plan_id || null,
            plan_type: updates.plan_type || null,
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        actionDetails.plan_id = updates.plan_id;
        actionDetails.plan_type = updates.plan_type;
        break;
      }

      case 'toggle_admin': {
        const { data: currentProfile } = await supabaseClient
          .from('profiles')
          .select('is_admin')
          .eq('id', userId)
          .single();

        const newAdminStatus = !currentProfile?.is_admin;

        const { data, error } = await supabaseClient
          .from('profiles')
          .update({ is_admin: newAdminStatus })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        actionDetails.is_admin = newAdminStatus;
        break;
      }

      case 'set_feature_override': {
        if (!updates?.feature_key || updates?.value === undefined) {
          return new Response(
            JSON.stringify({ error: 'feature_key and value required for set_feature_override' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const { data, error } = await supabaseClient
          .from('user_feature_overrides')
          .upsert({
            user_id: userId,
            feature_key: updates.feature_key,
            value: updates.value,
            updated_by_admin_id: adminUser.id,
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
        actionDetails.feature_key = updates.feature_key;
        actionDetails.value = updates.value;
        break;
      }

      case 'remove_feature_override': {
        if (!updates?.feature_key) {
          return new Response(
            JSON.stringify({ error: 'feature_key required for remove_feature_override' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const { error } = await supabaseClient
          .from('user_feature_overrides')
          .delete()
          .eq('user_id', userId)
          .eq('feature_key', updates.feature_key);

        if (error) throw error;
        result = { success: true };
        actionDetails.feature_key = updates.feature_key;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    // Log admin action
    await supabaseClient
      .from('admin_user_actions')
      .insert({
        admin_id: adminUser.id,
        target_user_id: userId,
        action: action,
        action_type: action,
        details: actionDetails,
      });

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating user:', error);
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
