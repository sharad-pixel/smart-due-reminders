import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if caller is admin
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', callerUser.id)
      .single();

    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Admin ${callerUser.id} initiating deletion of user ${userId}`);

    const deletionResults: { table: string; success: boolean; error?: string }[] = [];

    // Helper function to delete from a table
    const deleteFromTable = async (table: string, column: string = 'user_id') => {
      try {
        const { error } = await supabase.from(table).delete().eq(column, userId);
        if (error) {
          console.log(`Note: Could not delete from ${table} (${column}): ${error.message}`);
          deletionResults.push({ table, success: false, error: error.message });
        } else {
          console.log(`Deleted from ${table} (${column})`);
          deletionResults.push({ table, success: true });
        }
      } catch (e: unknown) {
        console.log(`Skipping ${table}: ${(e as Error).message}`);
        deletionResults.push({ table, success: false, error: (e as Error).message });
      }
    };

    // Delete storage files first (avatars, documents, org-logos)
    try {
      const { data: avatarFiles } = await supabase.storage.from('avatars').list(userId);
      if (avatarFiles?.length) {
        await supabase.storage.from('avatars').remove(avatarFiles.map(f => `${userId}/${f.name}`));
        console.log('Deleted avatar files');
      }
    } catch (e) {
      console.log('No avatar files to delete or error:', e);
    }

    try {
      const { data: docFiles } = await supabase.storage.from('documents').list(userId);
      if (docFiles?.length) {
        await supabase.storage.from('documents').remove(docFiles.map(f => `${userId}/${f.name}`));
        console.log('Deleted document files');
      }
    } catch (e) {
      console.log('No document files to delete or error:', e);
    }

    try {
      const { data: logoFiles } = await supabase.storage.from('org-logos').list(userId);
      if (logoFiles?.length) {
        await supabase.storage.from('org-logos').remove(logoFiles.map(f => `${userId}/${f.name}`));
        console.log('Deleted org logo files');
      }
    } catch (e) {
      console.log('No org logo files to delete or error:', e);
    }

    // Delete in order respecting foreign key constraints
    // Start with child/dependent tables first

    // Data Center related
    await deleteFromTable('data_center_staging_rows', 'upload_id');
    await deleteFromTable('data_center_uploads');
    await deleteFromTable('data_center_source_field_mappings', 'source_id');
    await deleteFromTable('data_center_custom_fields');
    await deleteFromTable('data_center_sources');
    await deleteFromTable('data_retention_notifications');

    // Documents and versions
    await deleteFromTable('document_access_log');
    await deleteFromTable('document_versions');
    await deleteFromTable('documents');

    // DNS and email connection logs
    await deleteFromTable('dns_verification_logs');
    await deleteFromTable('email_connection_logs');

    // Import/update errors and jobs
    await deleteFromTable('invoice_import_errors');
    await deleteFromTable('invoice_status_update_errors');
    await deleteFromTable('invoice_import_jobs');
    await deleteFromTable('invoice_status_update_jobs');

    // Collection related
    await deleteFromTable('collection_outcomes');
    await deleteFromTable('collection_activities');
    await deleteFromTable('collection_tasks');

    // AI related
    await deleteFromTable('ai_drafts');
    await deleteFromTable('ai_workflows');
    await deleteFromTable('ai_command_logs');
    await deleteFromTable('ai_creations');

    // Workflow templates
    await deleteFromTable('draft_templates');
    await deleteFromTable('collection_workflow_steps', 'workflow_id');
    await deleteFromTable('collection_workflows');

    // Payment related
    await deleteFromTable('payment_invoice_links');
    await deleteFromTable('payments');

    // Invoice related
    await deleteFromTable('invoice_line_items');
    await deleteFromTable('invoices');

    // CS Cases
    await deleteFromTable('cs_cases');

    // Debtor/Account related
    await deleteFromTable('debtor_risk_history');
    await deleteFromTable('debtors');

    // CRM related
    await deleteFromTable('crm_accounts');
    await deleteFromTable('crm_connections');

    // Inbound emails
    await deleteFromTable('inbound_emails');
    await deleteFromTable('outreach_logs');

    // Email settings
    await deleteFromTable('email_accounts');
    await deleteFromTable('email_sending_profiles');
    await deleteFromTable('branding_settings');

    // AR related
    await deleteFromTable('ar_summary');
    await deleteFromTable('ar_page_access_logs');
    await deleteFromTable('upload_batches');

    // Daily digests
    await deleteFromTable('daily_digests');
    await deleteFromTable('daily_usage_limits');

    // Notifications
    await deleteFromTable('user_notifications');

    // Rate limiting and security
    await deleteFromTable('rate_limits', 'identifier');
    await deleteFromTable('suspicious_activity_log', 'ip_address');
    await deleteFromTable('image_moderation_logs');

    // Sessions and login tracking
    await deleteFromTable('user_sessions');
    await deleteFromTable('login_attempts', 'email');
    await deleteFromTable('audit_logs');

    // Team/Account management - handle both as user and as account owner
    await deleteFromTable('account_users'); // Where user is a member
    await deleteFromTable('account_users', 'account_id'); // Where user owns the account

    // User roles
    await deleteFromTable('user_roles');

    // Feature overrides and usage
    await deleteFromTable('user_feature_overrides');
    await deleteFromTable('user_monthly_usage');

    // Subscriptions
    await deleteFromTable('subscriptions');

    // Organizations owned by user
    await deleteFromTable('organizations', 'owner_user_id');

    // Admin actions where user is target
    try {
      await supabase.from('admin_user_actions').delete().eq('target_user_id', userId);
      console.log('Deleted admin_user_actions (as target)');
    } catch (e: unknown) {
      console.log(`Skipping admin_user_actions target cleanup: ${(e as Error).message}`);
    }

    // Admin actions by this user (if they were admin)
    await deleteFromTable('admin_user_actions', 'admin_id');

    // Finally delete profile (by id, not user_id)
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) {
        console.log(`Note: Could not delete profile: ${error.message}`);
        deletionResults.push({ table: 'profiles', success: false, error: error.message });
      } else {
        console.log('Deleted profile');
        deletionResults.push({ table: 'profiles', success: true });
      }
    } catch (e: unknown) {
      console.log(`Skipping profile delete: ${(e as Error).message}`);
      deletionResults.push({ table: 'profiles', success: false, error: (e as Error).message });
    }

    // Finally, delete the auth user
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(JSON.stringify({ 
        error: 'Failed to delete auth user', 
        details: deleteAuthError.message,
        dataDeleted: true,
        deletionResults
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the admin action
    await supabase.from('admin_user_actions').insert({
      admin_id: callerUser.id,
      target_user_id: userId,
      action: 'delete_user',
      action_type: 'user_deletion',
      details: { 
        deletion_results: deletionResults,
        deleted_at: new Date().toISOString()
      },
    });

    console.log(`Successfully deleted user ${userId} and all associated data`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User and all associated data deleted successfully',
      deletionResults
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in delete-user function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
