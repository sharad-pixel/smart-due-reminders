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

    const { action, email, userId, role } = await req.json();

    // Check if user has team features enabled
    const { data: effectiveFeatures } = await supabaseClient.functions.invoke(
      'get-effective-features',
      {
        headers: {
          Authorization: authHeader
        }
      }
    );

    if (!effectiveFeatures?.features?.can_have_team_users) {
      return new Response(
        JSON.stringify({
          error: true,
          code: 'FEATURE_NOT_AVAILABLE',
          message: 'Team and role management is available on Professional and Custom plans.',
          required_plan: 'Professional or Custom',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is a member of someone else's account
    // If they are NOT a member anywhere, they are managing their own account as owner
    const { data: membershipCheck, error: membershipError } = await supabaseClient
      .from('account_users')
      .select('role, account_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError && membershipError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine - means they're the account owner
      console.error('Error checking membership:', membershipError);
      throw membershipError;
    }

    // Check if user has owner or admin role with active status
    const isOwnerOrAdmin = membershipCheck && 
      (membershipCheck.role === 'owner' || membershipCheck.role === 'admin') && 
      membershipCheck.status === 'active';
    
    // If no membership record exists, user is managing their own account as standalone owner
    const isStandaloneOwner = !membershipCheck;

    if (!isOwnerOrAdmin && !isStandaloneOwner) {
      return new Response(
        JSON.stringify({ error: 'Only account owners and admins can manage team members' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine which account we're managing
    // If standalone owner, use their own ID; otherwise use the account_id from membership
    const managingAccountId = isStandaloneOwner ? user.id : membershipCheck!.account_id;

    let result;

    switch (action) {
      case 'invite': {
        // Check current team size (excluding owner/account holder)
        const { count: currentTeamCount } = await supabaseClient
          .from('account_users')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', managingAccountId)
          .neq('user_id', managingAccountId)
          .neq('status', 'disabled');

        const maxInvitedUsers = effectiveFeatures?.features?.max_invited_users || 0;

        if (currentTeamCount !== null && currentTeamCount >= maxInvitedUsers) {
          return new Response(
            JSON.stringify({
              error: true,
              code: 'TEAM_LIMIT_REACHED',
              message: `You have already invited the maximum of ${maxInvitedUsers} users on your current plan.`,
              required_plan: 'Upgrade or contact support',
            }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Check if user exists
        const { data: existingUser } = await supabaseClient
          .from('profiles')
          .select('id, email')
          .eq('email', email)
          .maybeSingle();

        if (existingUser) {
          // Check if already a team member
          const { data: existingMember } = await supabaseClient
            .from('account_users')
            .select('id, status')
            .eq('account_id', managingAccountId)
            .eq('user_id', existingUser.id)
            .maybeSingle();

          if (existingMember) {
            return new Response(
              JSON.stringify({ error: 'This user is already a team member' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          // Add existing user to team
          const { data, error } = await supabaseClient
            .from('account_users')
            .insert({
              account_id: managingAccountId,
              user_id: existingUser.id,
              role: role || 'member',
              status: 'active',
              accepted_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) {
            throw error;
          }

          result = { success: true, data, message: 'Team member added successfully' };
        } else {
          // Invite new user via Supabase Auth
          console.log('Inviting new user via email:', email);
          
          const { data: inviteData, error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${Deno.env.get('SITE_URL') || 'https://recouply.ai'}/team?invited=true`,
            data: {
              invited_by: user.id,
              invited_to_account: managingAccountId,
              invited_role: role || 'member',
            }
          });

          if (inviteError) {
            console.error('Error inviting user:', inviteError);
            throw new Error(`Failed to send invitation: ${inviteError.message}`);
          }

          // Create pending account_users entry
          const { data, error } = await supabaseClient
            .from('account_users')
            .insert({
              account_id: managingAccountId,
              user_id: inviteData.user.id,
              role: role || 'member',
              status: 'pending',
            })
            .select()
            .single();

          if (error) {
            console.error('Error creating account_users entry:', error);
            throw error;
          }

          result = { success: true, data, message: 'Invitation sent successfully' };
        }
        break;
      }

      case 'changeRole': {
        if (!effectiveFeatures?.features?.can_manage_roles) {
          return new Response(
            JSON.stringify({
              error: true,
              code: 'FEATURE_NOT_AVAILABLE',
              message: 'Role management is available on Professional and Custom plans.',
              required_plan: 'Professional or Custom',
            }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const { data, error } = await supabaseClient
          .from('account_users')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('account_id', managingAccountId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        result = { success: true, data };
        break;
      }

      case 'disable': {
        const { data, error } = await supabaseClient
          .from('account_users')
          .update({ status: 'disabled', updated_at: new Date().toISOString() })
          .eq('account_id', managingAccountId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        result = { success: true, data };
        break;
      }

      case 'enable': {
        const { data, error } = await supabaseClient
          .from('account_users')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('account_id', managingAccountId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        result = { success: true, data };
        break;
      }

      case 'remove': {
        const { reassignTo } = await req.json().catch(() => ({}));
        
        // Check if user has assigned tasks
        const { data: assignedTasks, error: tasksError } = await supabaseClient
          .from('collection_tasks')
          .select('id')
          .eq('assigned_to', userId);
        
        if (tasksError) {
          console.error('Error checking assigned tasks:', tasksError);
        }
        
        // If user has assigned tasks and reassignTo is provided, reassign them
        if (assignedTasks && assignedTasks.length > 0 && reassignTo) {
          const { error: reassignError } = await supabaseClient
            .from('collection_tasks')
            .update({ 
              assigned_to: reassignTo,
              updated_at: new Date().toISOString()
            })
            .eq('assigned_to', userId);
          
          if (reassignError) {
            console.error('Error reassigning tasks:', reassignError);
            throw new Error('Failed to reassign tasks before removal');
          }
        } else if (assignedTasks && assignedTasks.length > 0 && !reassignTo) {
          // Unassign tasks if no reassignTo provided
          const { error: unassignError } = await supabaseClient
            .from('collection_tasks')
            .update({ 
              assigned_to: null,
              updated_at: new Date().toISOString()
            })
            .eq('assigned_to', userId);
          
          if (unassignError) {
            console.error('Error unassigning tasks:', unassignError);
          }
        }
        
        // Remove from account_users
        const { error: removeError } = await supabaseClient
          .from('account_users')
          .delete()
          .eq('account_id', managingAccountId)
          .eq('user_id', userId);

        if (removeError) {
          throw removeError;
        }

        result = { 
          success: true, 
          message: 'Team member removed successfully',
          tasksReassigned: assignedTasks?.length || 0
        };
        break;
      }

      case 'getAssignedTasksCount': {
        const { data: tasks, error } = await supabaseClient
          .from('collection_tasks')
          .select('id', { count: 'exact' })
          .eq('assigned_to', userId)
          .in('status', ['open', 'in_progress']);
        
        if (error) {
          throw error;
        }
        
        result = { success: true, count: tasks?.length || 0 };
        break;
      }

      case 'list': {
        const { data, error } = await supabaseClient
          .from('account_users')
          .select(`
            *,
            profiles!account_users_user_id_fkey (
              name,
              email
            )
          `)
          .eq('account_id', managingAccountId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        result = { success: true, data };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error managing team:', error);
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