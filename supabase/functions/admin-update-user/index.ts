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

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Default action for backwards compatibility
    const effectiveAction = action || 'update_profile';

    let result;
    let actionDetails: any = { action: effectiveAction, userId };

    switch (effectiveAction) {
      case 'update_profile': {
        // Build the update object dynamically with only provided fields
        const profileUpdates: Record<string, any> = {};
        
        if (updates?.name !== undefined) profileUpdates.name = updates.name;
        if (updates?.company_name !== undefined) profileUpdates.company_name = updates.company_name;
        if (updates?.plan_type !== undefined) profileUpdates.plan_type = updates.plan_type;
        if (updates?.invoice_limit !== undefined) profileUpdates.invoice_limit = updates.invoice_limit;
        if (updates?.subscription_status !== undefined) profileUpdates.subscription_status = updates.subscription_status;
        if (updates?.trial_ends_at !== undefined) profileUpdates.trial_ends_at = updates.trial_ends_at;
        if (updates?.current_period_end !== undefined) profileUpdates.current_period_end = updates.current_period_end;
        
        // Set trial_used_at if we're setting trial status
        if (updates?.subscription_status === 'trialing' && updates?.trial_ends_at) {
          const { data: currentProfile } = await supabaseClient
            .from('profiles')
            .select('trial_used_at')
            .eq('id', userId)
            .single();
          
          if (!currentProfile?.trial_used_at) {
            profileUpdates.trial_used_at = new Date().toISOString();
          }
        }

        if (Object.keys(profileUpdates).length === 0) {
          return new Response(
            JSON.stringify({ error: 'No valid updates provided' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const { data, error } = await supabaseClient
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        actionDetails.updates = profileUpdates;
        break;
      }
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
          }, {
            onConflict: 'user_id,feature_key'
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

      case 'suspend_user': {
        const { data, error } = await supabaseClient
          .from('profiles')
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspended_reason: updates?.reason || 'Suspended by admin',
            suspended_by: adminUser.id,
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        actionDetails.reason = updates?.reason;
        break;
      }

      case 'unsuspend_user': {
        const { data, error } = await supabaseClient
          .from('profiles')
          .update({
            is_suspended: false,
            suspended_at: null,
            suspended_reason: null,
            suspended_by: null,
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case 'block_user': {
        // Get user email
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single();

        if (!userProfile?.email) {
          return new Response(
            JSON.stringify({ error: 'User email not found' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Add to blocked_users
        const { data, error } = await supabaseClient
          .from('blocked_users')
          .upsert({
            email: userProfile.email.toLowerCase(),
            reason: updates?.reason || 'Blocked by admin',
            blocked_by: adminUser.id,
            blocked_at: new Date().toISOString(),
            expires_at: updates?.expires_at || null,
          }, {
            onConflict: 'email'
          })
          .select()
          .single();

        if (error) throw error;

        // Also suspend the user
        await supabaseClient
          .from('profiles')
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspended_reason: updates?.reason || 'Blocked by admin',
            suspended_by: adminUser.id,
          })
          .eq('id', userId);

        result = data;
        actionDetails.email = userProfile.email;
        actionDetails.reason = updates?.reason;
        actionDetails.expires_at = updates?.expires_at;
        break;
      }

      case 'unblock_user': {
        // Get user email
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single();

        if (userProfile?.email) {
          // Remove from blocked_users
          await supabaseClient
            .from('blocked_users')
            .delete()
            .eq('email', userProfile.email.toLowerCase());
        }

        // Also unsuspend the user
        const { data, error } = await supabaseClient
          .from('profiles')
          .update({
            is_suspended: false,
            suspended_at: null,
            suspended_reason: null,
            suspended_by: null,
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        actionDetails.email = userProfile?.email;
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
        action: effectiveAction,
        action_type: effectiveAction,
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
