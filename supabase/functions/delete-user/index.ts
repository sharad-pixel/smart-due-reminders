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

    // Delete all user-related data in order (respecting foreign key constraints)
    const tablesToDelete = [
      // First delete tables with foreign keys to other user tables
      'document_access_log',
      'document_versions',
      'documents',
      'dns_verification_logs',
      'email_connection_logs',
      'invoice_import_errors',
      'invoice_status_update_errors',
      'collection_outcomes',
      'collection_activities',
      'collection_tasks',
      'ai_drafts',
      'ai_workflows',
      'ai_command_logs',
      'ai_creations',
      'draft_templates',
      'collection_workflow_steps',
      'collection_workflows',
      'invoice_line_items',
      'invoices',
      'cs_cases',
      'debtors',
      'crm_accounts',
      'crm_connections',
      'inbound_emails',
      'outreach_logs',
      'email_accounts',
      'email_sending_profiles',
      'branding_settings',
      'invoice_import_jobs',
      'invoice_status_update_jobs',
      'user_sessions',
      'login_attempts',
      'audit_logs',
      'account_users',
      'user_feature_overrides',
      'user_monthly_usage',
      'subscriptions',
      'admin_user_actions',
      'profiles',
    ];

    const errors: string[] = [];

    for (const table of tablesToDelete) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId);
        
        if (error) {
          // Some tables might not have user_id column or might fail - log but continue
          console.log(`Note: Could not delete from ${table}: ${error.message}`);
        } else {
          console.log(`Deleted user data from ${table}`);
        }
      } catch (e: unknown) {
        console.log(`Skipping ${table}: ${(e as Error).message}`);
      }
    }

    // Also delete where user might be referenced by 'id' (like profiles)
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (error) {
        console.log(`Note: Could not delete profile by id: ${error.message}`);
      }
    } catch (e: unknown) {
      console.log(`Skipping profile delete by id: ${(e as Error).message}`);
    }

    // Delete from admin_user_actions where user is target
    try {
      await supabase
        .from('admin_user_actions')
        .delete()
        .eq('target_user_id', userId);
    } catch (e: unknown) {
      console.log(`Skipping admin_user_actions target cleanup: ${(e as Error).message}`);
    }

    // Finally, delete the auth user
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(JSON.stringify({ 
        error: 'Failed to delete auth user', 
        details: deleteAuthError.message,
        dataDeleted: true 
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
      details: { tables_cleaned: tablesToDelete },
    });

    console.log(`Successfully deleted user ${userId} and all associated data`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User and all associated data deleted successfully' 
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
