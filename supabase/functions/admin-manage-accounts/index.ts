import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyAdmin(supabaseClient: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Unauthorized');

  const token = authHeader.replace('Bearer ', '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  // Allow service role key
  if (token === serviceKey) return { id: 'service-role' };

  const { data: userData, error } = await supabaseClient.auth.getUser(token);
  if (error || !userData.user) throw new Error('Unauthorized');

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();

  if (!profile?.is_admin) throw new Error('Forbidden: Admin access required');
  return userData.user;
}

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

    const admin = await verifyAdmin(supabaseClient, req);
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'merge_accounts': {
        // Move all data from source account under target parent account
        const { sourceAccountId, targetAccountId } = body;
        if (!sourceAccountId || !targetAccountId) {
          throw new Error('sourceAccountId and targetAccountId are required');
        }
        if (sourceAccountId === targetAccountId) {
          throw new Error('Cannot merge an account into itself');
        }

        // Verify both accounts exist
        const [sourceProfile, targetProfile] = await Promise.all([
          supabaseClient.from('profiles').select('id, email, name').eq('id', sourceAccountId).single(),
          supabaseClient.from('profiles').select('id, email, name').eq('id', targetAccountId).single(),
        ]);

        if (!sourceProfile.data) throw new Error('Source account not found');
        if (!targetProfile.data) throw new Error('Target account not found');

        // Get target's organization
        const { data: targetOrg } = await supabaseClient
          .from('organizations')
          .select('id')
          .eq('owner_user_id', targetAccountId)
          .single();

        const targetOrgId = targetOrg?.id || null;

        // Tables that have user_id to reassign
        const userIdTables = [
          'debtors', 'invoices', 'payments', 'ai_drafts', 'ai_workflows',
          'collection_activities', 'collection_tasks', 'collection_outcomes',
          'branding_settings', 'outreach_logs', 'ar_summary',
          'collection_campaigns', 'campaign_accounts', 'cached_reports',
          'daily_digests', 'daily_usage_limits', 'ai_command_logs',
          'ai_creations', 'ar_introduction_emails', 'cs_cases',
          'contacts', 'invoice_outreach', 'outreach_templates',
        ];

        let totalMoved = 0;

        for (const table of userIdTables) {
          try {
            const updateData: any = { user_id: targetAccountId };
            // Also update organization_id if the table has it
            if (targetOrgId) {
              updateData.organization_id = targetOrgId;
            }
            const { count } = await supabaseClient
              .from(table)
              .update(updateData)
              .eq('user_id', sourceAccountId)
              .select('id', { count: 'exact', head: true });
            totalMoved += count || 0;
          } catch (e) {
            // Some tables may not have organization_id, retry without it
            try {
              const { count } = await supabaseClient
                .from(table)
                .update({ user_id: targetAccountId })
                .eq('user_id', sourceAccountId)
                .select('id', { count: 'exact', head: true });
              totalMoved += count || 0;
            } catch (_) {
              console.log(`Skipping table ${table}: not found or no user_id column`);
            }
          }
        }

        // Move any team members from source to target account
        await supabaseClient
          .from('account_users')
          .update({ account_id: targetAccountId, organization_id: targetOrgId })
          .eq('account_id', sourceAccountId)
          .neq('is_owner', true);

        // Remove source's own owner entry
        await supabaseClient
          .from('account_users')
          .delete()
          .eq('account_id', sourceAccountId)
          .eq('user_id', sourceAccountId)
          .eq('is_owner', true);

        // Add source as a member of target (if not already)
        const { data: existingMembership } = await supabaseClient
          .from('account_users')
          .select('id')
          .eq('account_id', targetAccountId)
          .eq('user_id', sourceAccountId)
          .maybeSingle();

        if (!existingMembership) {
          await supabaseClient
            .from('account_users')
            .insert({
              account_id: targetAccountId,
              user_id: sourceAccountId,
              email: sourceProfile.data.email,
              role: 'member',
              status: 'active',
              is_owner: false,
              accepted_at: new Date().toISOString(),
              organization_id: targetOrgId,
            });
        }

        // Audit log
        await supabaseClient.from('audit_logs').insert({
          user_id: admin.id,
          action_type: 'admin_merge_accounts',
          resource_type: 'account',
          resource_id: sourceAccountId,
          old_values: { source_account: sourceAccountId },
          new_values: { target_account: targetAccountId, records_moved: totalMoved },
          metadata: { admin_action: true },
        });

        return new Response(JSON.stringify({
          success: true,
          message: `Merged ${sourceProfile.data.email} into ${targetProfile.data.email}. ${totalMoved} records moved.`,
          recordsMoved: totalMoved,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'assign_parent': {
        // Assign a user as a child of a parent account
        const { childUserId, parentAccountId, role } = body;
        if (!childUserId || !parentAccountId) {
          throw new Error('childUserId and parentAccountId are required');
        }
        if (childUserId === parentAccountId) {
          throw new Error('Cannot assign a user as their own child');
        }

        const assignRole = role || 'member';

        // Enforce one owner per hierarchy
        if (assignRole === 'owner') {
          throw new Error('Only one owner is allowed per account hierarchy. Use a different role.');
        }

        // Get parent's organization
        const { data: parentOrg } = await supabaseClient
          .from('organizations')
          .select('id')
          .eq('owner_user_id', parentAccountId)
          .single();

        // Remove any existing non-owner membership the child has in other accounts
        await supabaseClient
          .from('account_users')
          .delete()
          .eq('user_id', childUserId)
          .eq('is_owner', false);

        // Check if child already has membership in this parent
        const { data: existing } = await supabaseClient
          .from('account_users')
          .select('id')
          .eq('account_id', parentAccountId)
          .eq('user_id', childUserId)
          .eq('is_owner', false)
          .maybeSingle();

        if (existing) {
          // Update existing
          await supabaseClient
            .from('account_users')
            .update({
              role: assignRole,
              status: 'active',
              organization_id: parentOrg?.id || null,
              accepted_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          // Get child's email
          const { data: childProfile } = await supabaseClient
            .from('profiles')
            .select('email')
            .eq('id', childUserId)
            .single();

          await supabaseClient
            .from('account_users')
            .insert({
              account_id: parentAccountId,
              user_id: childUserId,
              email: childProfile?.email,
              role: assignRole,
              status: 'active',
              is_owner: false,
              accepted_at: new Date().toISOString(),
              organization_id: parentOrg?.id || null,
            });
        }

        // Audit log
        await supabaseClient.from('audit_logs').insert({
          user_id: admin.id,
          action_type: 'admin_assign_parent',
          resource_type: 'account_users',
          resource_id: childUserId,
          new_values: { parent_account: parentAccountId, role: assignRole },
          metadata: { admin_action: true },
        });

        return new Response(JSON.stringify({
          success: true,
          message: `User assigned to parent account with role: ${assignRole}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'change_role': {
        // Change a team member's role (enforce one owner per hierarchy)
        const { membershipId, newRole } = body;
        if (!membershipId || !newRole) {
          throw new Error('membershipId and newRole are required');
        }

        // Get the membership record
        const { data: membership } = await supabaseClient
          .from('account_users')
          .select('id, account_id, user_id, is_owner, role')
          .eq('id', membershipId)
          .single();

        if (!membership) throw new Error('Membership not found');

        // Cannot change the owner's role
        if (membership.is_owner) {
          throw new Error('Cannot change the role of the account owner');
        }

        // Enforce: only one owner per hierarchy
        if (newRole === 'owner') {
          throw new Error('Only one owner is allowed per account hierarchy. The owner role cannot be assigned to team members.');
        }

        await supabaseClient
          .from('account_users')
          .update({ role: newRole, updated_at: new Date().toISOString() })
          .eq('id', membershipId);

        // Audit log
        await supabaseClient.from('audit_logs').insert({
          user_id: admin.id,
          action_type: 'admin_change_role',
          resource_type: 'account_users',
          resource_id: membershipId,
          old_values: { role: membership.role },
          new_values: { role: newRole },
          metadata: { admin_action: true, account_id: membership.account_id },
        });

        return new Response(JSON.stringify({
          success: true,
          message: `Role changed to ${newRole}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'remove_from_parent': {
        // Remove a child from parent hierarchy (make them standalone again)
        const { membershipId } = body;
        if (!membershipId) throw new Error('membershipId is required');

        const { data: membership } = await supabaseClient
          .from('account_users')
          .select('id, account_id, user_id, is_owner')
          .eq('id', membershipId)
          .single();

        if (!membership) throw new Error('Membership not found');
        if (membership.is_owner) throw new Error('Cannot remove the account owner');

        await supabaseClient
          .from('account_users')
          .delete()
          .eq('id', membershipId);

        // Audit log
        await supabaseClient.from('audit_logs').insert({
          user_id: admin.id,
          action_type: 'admin_remove_from_parent',
          resource_type: 'account_users',
          resource_id: membershipId,
          old_values: { account_id: membership.account_id, user_id: membership.user_id },
          metadata: { admin_action: true },
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'User removed from parent account',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Admin manage accounts error:', error);
    const status = error.message?.includes('Unauthorized') ? 401
      : error.message?.includes('Forbidden') ? 403
      : 400;
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
