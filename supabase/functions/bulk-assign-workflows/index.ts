import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkAssignRequest {
  invoice_ids: string[];
  action: 'assign' | 'unassign';
  aging_bucket?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { invoice_ids, action, aging_bucket }: BulkAssignRequest = await req.json();

    console.log(`Processing ${action} for ${invoice_ids.length} invoices`);

    if (action === 'unassign') {
      // Deactivate all workflows for these invoices
      const { error } = await supabase
        .from('ai_workflows')
        .update({ is_active: false })
        .in('invoice_id', invoice_ids)
        .eq('user_id', user.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: `${invoice_ids.length} invoices removed from workflows` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'assign') {
      if (!aging_bucket) {
        throw new Error('aging_bucket is required for assign action');
      }

      // Find the workflow for this aging bucket
      const { data: workflow, error: workflowError } = await supabase
        .from('collection_workflows')
        .select('*')
        .eq('aging_bucket', aging_bucket)
        .eq('is_active', true)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('user_id', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (workflowError) {
        throw new Error(`Error fetching workflow: ${workflowError.message}`);
      }

      if (!workflow) {
        return new Response(
          JSON.stringify({ 
            error: `No active workflow exists for the "${aging_bucket}" aging bucket. Please set up a workflow for this bucket in the AI Workflows settings first.`,
            user_friendly: true 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // First, deactivate existing workflows for these invoices
      await supabase
        .from('ai_workflows')
        .update({ is_active: false })
        .in('invoice_id', invoice_ids)
        .eq('user_id', user.id);

      // Create new workflow assignments
      const workflowInserts = invoice_ids.map(invoice_id => ({
        invoice_id,
        user_id: user.id,
        is_active: true,
        cadence_days: [],
        tone: 'friendly' as const,
      }));

      const { error: insertError } = await supabase
        .from('ai_workflows')
        .insert(workflowInserts);

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `${invoice_ids.length} invoices assigned to ${aging_bucket} workflow` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Error in bulk-assign-workflows:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});