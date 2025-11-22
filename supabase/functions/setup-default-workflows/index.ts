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

    console.log(`[SETUP-DEFAULT-WORKFLOWS] Setting up workflows for user ${user.id}`);

    const { aging_bucket } = await req.json();

    // Check if workflow already exists for this bucket
    const { data: existingWorkflow } = await supabase
      .from('collection_workflows')
      .select('id')
      .eq('aging_bucket', aging_bucket)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingWorkflow) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Workflow already exists for this bucket',
          workflow_id: existingWorkflow.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define workflow details based on bucket
    let workflowName = '';
    let workflowDescription = '';
    let steps: any[] = [];

    if (aging_bucket === 'dpd_120_plus') {
      workflowName = 'Critical Collections (120+ Days)';
      workflowDescription = 'Intensive recovery workflow for severely overdue accounts';
      steps = [
        {
          step_order: 1,
          day_offset: 0,
          channel: 'email',
          label: 'Critical Status Notice',
          ai_template_type: 'payment_reminder',
          trigger_type: 'days_past_due',
          is_active: true,
          body_template: 'Your invoice {{invoice_number}} for ${{amount}} is now {{days_past_due}} days overdue. This is a critical collection notice. Immediate payment is required to avoid further action.',
          subject_template: 'URGENT: Critical Payment Required - {{invoice_number}}',
        },
        {
          step_order: 2,
          day_offset: 3,
          channel: 'sms',
          label: 'Urgent Action Required',
          ai_template_type: 'urgent_notice',
          trigger_type: 'days_past_due',
          is_active: true,
          body_template: 'URGENT: Invoice {{invoice_number}} (${{amount}}) requires immediate payment. Contact us today.',
          sms_template: 'URGENT: Invoice {{invoice_number}} (${{amount}}) requires immediate payment. Contact us today.',
        },
        {
          step_order: 3,
          day_offset: 7,
          channel: 'email',
          label: 'Settlement Offer',
          ai_template_type: 'settlement_offer',
          trigger_type: 'days_past_due',
          is_active: true,
          body_template: 'We are willing to discuss a settlement arrangement for invoice {{invoice_number}}. Please contact us within 7 days to avoid escalation.',
          subject_template: 'Settlement Opportunity - Invoice {{invoice_number}}',
        },
        {
          step_order: 4,
          day_offset: 14,
          channel: 'email',
          label: 'Pre-Legal Warning',
          ai_template_type: 'final_notice',
          trigger_type: 'days_past_due',
          is_active: true,
          body_template: 'This is your final notice before legal action for invoice {{invoice_number}} (${{amount}}). Payment must be received within 7 business days.',
          subject_template: 'FINAL NOTICE - Legal Action Pending - {{invoice_number}}',
        },
        {
          step_order: 5,
          day_offset: 21,
          channel: 'sms',
          label: 'Final Response Request',
          ai_template_type: 'urgent_notice',
          trigger_type: 'days_past_due',
          is_active: true,
          body_template: 'Final notice: Invoice {{invoice_number}} will be sent to collections if not paid immediately.',
          sms_template: 'Final notice: Invoice {{invoice_number}} will be sent to collections if not paid immediately.',
        },
        {
          step_order: 6,
          day_offset: 30,
          channel: 'email',
          label: 'Collections Notice',
          ai_template_type: 'collections_notice',
          trigger_type: 'days_past_due',
          is_active: true,
          body_template: 'Invoice {{invoice_number}} (${{amount}}) has been forwarded to our collections department. This will impact your credit and future business relationships.',
          subject_template: 'Account Sent to Collections - {{invoice_number}}',
        },
      ];
    } else {
      throw new Error('Invalid aging bucket');
    }

    // Create the workflow
    const { data: newWorkflow, error: workflowError } = await supabase
      .from('collection_workflows')
      .insert({
        user_id: user.id,
        aging_bucket,
        name: workflowName,
        description: workflowDescription,
        is_active: true,
        is_locked: false,
      })
      .select()
      .single();

    if (workflowError) throw workflowError;

    // Create workflow steps
    const stepsWithWorkflowId = steps.map(step => ({
      ...step,
      workflow_id: newWorkflow.id,
      user_id: user.id,
    }));

    const { error: stepsError } = await supabase
      .from('collection_workflow_steps')
      .insert(stepsWithWorkflowId);

    if (stepsError) throw stepsError;

    console.log(`[SETUP-DEFAULT-WORKFLOWS] Created workflow ${newWorkflow.id} for bucket ${aging_bucket}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Default workflow created for ${aging_bucket}`,
        workflow_id: newWorkflow.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SETUP-DEFAULT-WORKFLOWS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});