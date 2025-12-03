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
      .select('id, steps:collection_workflow_steps(*)')
      .eq('aging_bucket', aging_bucket)
      .eq('user_id', user.id)
      .maybeSingle();

    // If workflow exists, check if it has templates and create them if missing
    if (existingWorkflow) {
      // Check for existing templates
      const { data: existingTemplates } = await supabase
        .from('draft_templates')
        .select('id')
        .eq('workflow_id', existingWorkflow.id)
        .eq('user_id', user.id);

      // If templates already exist, return success
      if (existingTemplates && existingTemplates.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Workflow and templates already exist for this bucket',
            workflow_id: existingWorkflow.id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Templates don't exist - create them for existing workflow
      console.log(`[SETUP-DEFAULT-WORKFLOWS] Workflow exists but no templates - creating templates for ${aging_bucket}`);
      
      // Get persona for this bucket
      let minDays = 0;
      switch (aging_bucket) {
        case 'dpd_1_30': minDays = 1; break;
        case 'dpd_31_60': minDays = 31; break;
        case 'dpd_61_90': minDays = 61; break;
        case 'dpd_91_120': minDays = 91; break;
        case 'dpd_121_150': minDays = 121; break;
        case 'dpd_150_plus': minDays = 151; break;
      }

      const { data: persona } = await supabase
        .from('ai_agent_personas')
        .select('id')
        .lte('bucket_min', minDays)
        .or(`bucket_max.is.null,bucket_max.gte.${minDays}`)
        .order('bucket_min', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If workflow has steps, create templates for them
      if (existingWorkflow.steps && existingWorkflow.steps.length > 0) {
        const draftTemplates = existingWorkflow.steps.map((step: any) => ({
          user_id: user.id,
          workflow_id: existingWorkflow.id,
          workflow_step_id: step.id,
          agent_persona_id: persona?.id || null,
          aging_bucket: aging_bucket,
          channel: step.channel,
          subject_template: step.subject_template,
          message_body_template: step.body_template,
          step_number: step.step_order,
          day_offset: step.day_offset,
          status: 'approved',
        }));

        const { error: templatesError } = await supabase
          .from('draft_templates')
          .insert(draftTemplates);

        if (templatesError) {
          console.error('[SETUP-DEFAULT-WORKFLOWS] Error creating templates:', templatesError);
        } else {
          console.log(`[SETUP-DEFAULT-WORKFLOWS] Created ${draftTemplates.length} draft templates for existing workflow`);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Templates created for existing workflow',
            workflow_id: existingWorkflow.id,
            templates_created: draftTemplates.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Workflow exists but has NO steps - create steps and templates for it
      console.log(`[SETUP-DEFAULT-WORKFLOWS] Workflow exists but has no steps - creating steps for ${aging_bucket}`);
      
      // Define steps based on bucket
      let stepsToCreate: any[] = [];
      switch (aging_bucket) {
        case 'dpd_1_30':
          stepsToCreate = [
            { step_order: 1, day_offset: 0, channel: 'email', label: 'Initial Reminder', ai_template_type: 'payment_reminder', trigger_type: 'relative_to_due', is_active: true, body_template: 'Friendly reminder about invoice {{invoice_number}} for {{amount}}. Payment was due on {{due_date}}.', subject_template: 'Payment Reminder - Invoice {{invoice_number}}' },
            { step_order: 2, day_offset: 7, channel: 'email', label: 'Follow-Up Notice', ai_template_type: 'followup', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'This is a follow-up regarding invoice {{invoice_number}}. Please contact us if you need assistance.', subject_template: 'Follow-Up: Invoice {{invoice_number}}' },
            { step_order: 3, day_offset: 14, channel: 'email', label: 'Final Notice', ai_template_type: 'urgent_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'Urgent: Invoice {{invoice_number}} is now significantly overdue. Please arrange payment.', subject_template: 'Urgent: Payment Required - {{invoice_number}}' },
          ];
          break;
        case 'dpd_31_60':
          stepsToCreate = [
            { step_order: 1, day_offset: 0, channel: 'email', label: 'Initial Reminder', ai_template_type: 'payment_reminder', trigger_type: 'relative_to_due', is_active: true, body_template: 'Your account is significantly overdue. Invoice {{invoice_number}} requires immediate attention.', subject_template: 'Overdue Notice - Invoice {{invoice_number}}' },
            { step_order: 2, day_offset: 7, channel: 'email', label: 'Follow-Up Notice', ai_template_type: 'urgent_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'Second notice regarding invoice {{invoice_number}}. Please contact us to discuss payment options.', subject_template: 'Second Notice: Invoice {{invoice_number}}' },
            { step_order: 3, day_offset: 14, channel: 'email', label: 'Final Notice', ai_template_type: 'final_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'This is your final notice for invoice {{invoice_number}}. Payment must be received to avoid further action.', subject_template: 'Final Notice: Invoice {{invoice_number}}' },
          ];
          break;
        case 'dpd_61_90':
          stepsToCreate = [
            { step_order: 1, day_offset: 0, channel: 'email', label: 'Initial Reminder', ai_template_type: 'urgent_notice', trigger_type: 'relative_to_due', is_active: true, body_template: 'Urgent: Your account is seriously overdue. Invoice {{invoice_number}} must be paid immediately.', subject_template: 'URGENT: Seriously Overdue - {{invoice_number}}' },
            { step_order: 2, day_offset: 7, channel: 'email', label: 'Follow-Up Notice', ai_template_type: 'final_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'This account will be escalated if payment is not received. Invoice {{invoice_number}} requires immediate settlement.', subject_template: 'Escalation Warning: Invoice {{invoice_number}}' },
            { step_order: 3, day_offset: 14, channel: 'email', label: 'Final Notice', ai_template_type: 'collections_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'Final opportunity to resolve invoice {{invoice_number}} before escalation to collections.', subject_template: 'FINAL NOTICE: Invoice {{invoice_number}}' },
          ];
          break;
        case 'dpd_91_120':
          stepsToCreate = [
            { step_order: 1, day_offset: 0, channel: 'email', label: 'Initial Reminder', ai_template_type: 'final_notice', trigger_type: 'relative_to_due', is_active: true, body_template: 'Critical: Invoice {{invoice_number}} is approaching 120 days overdue. Immediate action required.', subject_template: 'CRITICAL: Invoice {{invoice_number}} - Immediate Action Required' },
            { step_order: 2, day_offset: 7, channel: 'email', label: 'Follow-Up Notice', ai_template_type: 'final_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'Your account will be referred for further action if invoice {{invoice_number}} is not resolved immediately.', subject_template: 'Pre-Collections Notice: Invoice {{invoice_number}}' },
            { step_order: 3, day_offset: 14, channel: 'email', label: 'Final Notice', ai_template_type: 'collections_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'This is your absolute final notice for invoice {{invoice_number}} before external collections.', subject_template: 'FINAL NOTICE: Invoice {{invoice_number}} - Collections Pending' },
          ];
          break;
        case 'dpd_121_150':
          stepsToCreate = [
            { step_order: 1, day_offset: 0, channel: 'email', label: 'Initial Reminder', ai_template_type: 'collections_notice', trigger_type: 'relative_to_due', is_active: true, body_template: 'Invoice {{invoice_number}} is now in critical status. This account may be sent to external collections.', subject_template: 'CRITICAL STATUS: Invoice {{invoice_number}}' },
            { step_order: 2, day_offset: 7, channel: 'email', label: 'Follow-Up Notice', ai_template_type: 'final_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'Settlement options available for invoice {{invoice_number}}. Contact us immediately.', subject_template: 'Settlement Offer: Invoice {{invoice_number}}' },
            { step_order: 3, day_offset: 14, channel: 'email', label: 'Final Notice', ai_template_type: 'collections_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'Final notice before external collections for invoice {{invoice_number}}.', subject_template: 'FINAL NOTICE: Invoice {{invoice_number}}' },
          ];
          break;
        case 'dpd_150_plus':
          stepsToCreate = [
            { step_order: 1, day_offset: 0, channel: 'email', label: 'Initial Reminder', ai_template_type: 'payment_reminder', trigger_type: 'relative_to_due', is_active: true, body_template: 'Your invoice {{invoice_number}} for {{amount}} is now {{days_past_due}} days overdue. This is a critical collection notice.', subject_template: 'URGENT: Critical Payment Required - {{invoice_number}}' },
            { step_order: 2, day_offset: 7, channel: 'email', label: 'Follow-Up Notice', ai_template_type: 'urgent_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'URGENT: Invoice {{invoice_number}} ({{amount}}) requires immediate payment. Contact us today.', subject_template: 'URGENT: Invoice {{invoice_number}} - Immediate Action Required' },
            { step_order: 3, day_offset: 14, channel: 'email', label: 'Final Notice', ai_template_type: 'settlement_offer', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'We are willing to discuss a settlement arrangement for invoice {{invoice_number}}. Please contact us within 7 days.', subject_template: 'Settlement Opportunity - Invoice {{invoice_number}}' },
          ];
          break;
        default:
          stepsToCreate = [
            { step_order: 1, day_offset: 0, channel: 'email', label: 'Initial Reminder', ai_template_type: 'payment_reminder', trigger_type: 'relative_to_due', is_active: true, body_template: 'Reminder about invoice {{invoice_number}}.', subject_template: 'Payment Reminder - Invoice {{invoice_number}}' },
            { step_order: 2, day_offset: 7, channel: 'email', label: 'Follow-Up Notice', ai_template_type: 'followup', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'Follow-up for invoice {{invoice_number}}.', subject_template: 'Follow-Up: Invoice {{invoice_number}}' },
            { step_order: 3, day_offset: 14, channel: 'email', label: 'Final Notice', ai_template_type: 'urgent_notice', trigger_type: 'relative_to_last_step', is_active: true, body_template: 'Final notice for invoice {{invoice_number}}.', subject_template: 'Final Notice: Invoice {{invoice_number}}' },
          ];
      }

      // Insert steps for existing workflow
      const stepsWithWorkflowId = stepsToCreate.map(step => ({
        ...step,
        workflow_id: existingWorkflow.id,
      }));

      const { data: createdSteps, error: stepsError } = await supabase
        .from('collection_workflow_steps')
        .insert(stepsWithWorkflowId)
        .select();

      if (stepsError) {
        console.error('[SETUP-DEFAULT-WORKFLOWS] Error creating steps:', stepsError);
        throw stepsError;
      }

      // Now create templates for the new steps
      if (createdSteps && createdSteps.length > 0) {
        const draftTemplates = createdSteps.map((step: any) => ({
          user_id: user.id,
          workflow_id: existingWorkflow.id,
          workflow_step_id: step.id,
          agent_persona_id: persona?.id || null,
          aging_bucket: aging_bucket,
          channel: step.channel,
          subject_template: step.subject_template,
          message_body_template: step.body_template,
          step_number: step.step_order,
          day_offset: step.day_offset,
          status: 'approved',
        }));

        const { error: templatesError } = await supabase
          .from('draft_templates')
          .insert(draftTemplates);

        if (templatesError) {
          console.error('[SETUP-DEFAULT-WORKFLOWS] Error creating templates:', templatesError);
        } else {
          console.log(`[SETUP-DEFAULT-WORKFLOWS] Created ${draftTemplates.length} draft templates`);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Steps and templates created for existing workflow',
          workflow_id: existingWorkflow.id,
          steps_created: createdSteps?.length || 0,
          templates_created: createdSteps?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define workflow details based on bucket
    let workflowName = '';
    let workflowDescription = '';
    let steps: any[] = [];

    switch (aging_bucket) {
      case 'dpd_1_30':
        workflowName = 'Early Collections (1-30 Days)';
        workflowDescription = 'Friendly reminder workflow for early-stage collections';
        steps = [
          {
            step_order: 1,
            day_offset: 0,
            channel: 'email',
            label: 'Initial Reminder',
            ai_template_type: 'payment_reminder',
            trigger_type: 'relative_to_due',
            is_active: true,
            body_template: 'Friendly reminder about invoice {{invoice_number}} for {{amount}}. Payment was due on {{due_date}}.',
            subject_template: 'Payment Reminder - Invoice {{invoice_number}}',
          },
          {
            step_order: 2,
            day_offset: 7,
            channel: 'email',
            label: 'Follow-Up Notice',
            ai_template_type: 'followup',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'This is a follow-up regarding invoice {{invoice_number}}. Please contact us if you need assistance.',
            subject_template: 'Follow-Up: Invoice {{invoice_number}}',
          },
          {
            step_order: 3,
            day_offset: 14,
            channel: 'email',
            label: 'Final Notice',
            ai_template_type: 'urgent_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'Urgent: Invoice {{invoice_number}} is now significantly overdue. Please arrange payment.',
            subject_template: 'Urgent: Payment Required - {{invoice_number}}',
          },
        ];
        break;

      case 'dpd_31_60':
        workflowName = 'Mid-Stage Collections (31-60 Days)';
        workflowDescription = 'Firm collection workflow for accounts 31-60 days overdue';
        steps = [
          {
            step_order: 1,
            day_offset: 0,
            channel: 'email',
            label: 'Initial Reminder',
            ai_template_type: 'payment_reminder',
            trigger_type: 'relative_to_due',
            is_active: true,
            body_template: 'Your account is significantly overdue. Invoice {{invoice_number}} requires immediate attention.',
            subject_template: 'Overdue Notice - Invoice {{invoice_number}}',
          },
          {
            step_order: 2,
            day_offset: 7,
            channel: 'email',
            label: 'Follow-Up Notice',
            ai_template_type: 'urgent_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'Second notice regarding invoice {{invoice_number}}. Please contact us to discuss payment options.',
            subject_template: 'Second Notice: Invoice {{invoice_number}}',
          },
          {
            step_order: 3,
            day_offset: 14,
            channel: 'email',
            label: 'Final Notice',
            ai_template_type: 'final_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'This is your final notice for invoice {{invoice_number}}. Payment must be received to avoid further action.',
            subject_template: 'Final Notice: Invoice {{invoice_number}}',
          },
        ];
        break;

      case 'dpd_61_90':
        workflowName = 'Late Collections (61-90 Days)';
        workflowDescription = 'Urgent collection workflow for seriously overdue accounts';
        steps = [
          {
            step_order: 1,
            day_offset: 0,
            channel: 'email',
            label: 'Initial Reminder',
            ai_template_type: 'urgent_notice',
            trigger_type: 'relative_to_due',
            is_active: true,
            body_template: 'Urgent: Your account is seriously overdue. Invoice {{invoice_number}} must be paid immediately.',
            subject_template: 'URGENT: Seriously Overdue - {{invoice_number}}',
          },
          {
            step_order: 2,
            day_offset: 7,
            channel: 'email',
            label: 'Follow-Up Notice',
            ai_template_type: 'final_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'This account will be escalated if payment is not received. Invoice {{invoice_number}} requires immediate settlement.',
            subject_template: 'Escalation Warning: Invoice {{invoice_number}}',
          },
          {
            step_order: 3,
            day_offset: 14,
            channel: 'email',
            label: 'Final Notice',
            ai_template_type: 'collections_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'Final opportunity to resolve invoice {{invoice_number}} before escalation to collections.',
            subject_template: 'FINAL NOTICE: Invoice {{invoice_number}}',
          },
        ];
        break;

      case 'dpd_91_120':
        workflowName = 'Advanced Collections (91-120 Days)';
        workflowDescription = 'Firm collection workflow for accounts approaching critical status';
        steps = [
          {
            step_order: 1,
            day_offset: 0,
            channel: 'email',
            label: 'Initial Reminder',
            ai_template_type: 'final_notice',
            trigger_type: 'relative_to_due',
            is_active: true,
            body_template: 'Critical: Invoice {{invoice_number}} is approaching 120 days overdue. Immediate action required.',
            subject_template: 'CRITICAL: Invoice {{invoice_number}} - Immediate Action Required',
          },
          {
            step_order: 2,
            day_offset: 7,
            channel: 'email',
            label: 'Follow-Up Notice',
            ai_template_type: 'final_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'Your account will be referred for further action if invoice {{invoice_number}} is not resolved immediately.',
            subject_template: 'Pre-Collections Notice: Invoice {{invoice_number}}',
          },
          {
            step_order: 3,
            day_offset: 14,
            channel: 'email',
            label: 'Final Notice',
            ai_template_type: 'collections_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'This is your absolute final notice for invoice {{invoice_number}} before external collections.',
            subject_template: 'FINAL NOTICE: Invoice {{invoice_number}} - Collections Pending',
          },
        ];
        break;

      case 'dpd_121_150':
        workflowName = 'Critical Collections (121-150 Days)';
        workflowDescription = 'Critical recovery workflow for severely overdue accounts';
        steps = [
          {
            step_order: 1,
            day_offset: 0,
            channel: 'email',
            label: 'Initial Reminder',
            ai_template_type: 'collections_notice',
            trigger_type: 'relative_to_due',
            is_active: true,
            body_template: 'Invoice {{invoice_number}} is now in critical status. This account may be sent to external collections.',
            subject_template: 'CRITICAL STATUS: Invoice {{invoice_number}}',
          },
          {
            step_order: 2,
            day_offset: 7,
            channel: 'email',
            label: 'Follow-Up Notice',
            ai_template_type: 'final_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'Settlement options available for invoice {{invoice_number}}. Contact us immediately.',
            subject_template: 'Settlement Offer: Invoice {{invoice_number}}',
          },
          {
            step_order: 3,
            day_offset: 14,
            channel: 'email',
            label: 'Final Notice',
            ai_template_type: 'collections_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'Final notice before external collections for invoice {{invoice_number}}.',
            subject_template: 'FINAL NOTICE: Invoice {{invoice_number}}',
          },
        ];
        break;

      case 'dpd_150_plus':
      case 'dpd_120_plus':
        workflowName = 'Critical Collections (150+ Days)';
        workflowDescription = 'Intensive recovery workflow for severely overdue accounts';
        steps = [
          {
            step_order: 1,
            day_offset: 0,
            channel: 'email',
            label: 'Initial Reminder',
            ai_template_type: 'payment_reminder',
            trigger_type: 'relative_to_due',
            is_active: true,
            body_template: 'Your invoice {{invoice_number}} for {{amount}} is now {{days_past_due}} days overdue. This is a critical collection notice. Immediate payment is required to avoid further action.',
            subject_template: 'URGENT: Critical Payment Required - {{invoice_number}}',
          },
          {
            step_order: 2,
            day_offset: 7,
            channel: 'email',
            label: 'Follow-Up Notice',
            ai_template_type: 'urgent_notice',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'URGENT: Invoice {{invoice_number}} ({{amount}}) requires immediate payment. Contact us today.',
            subject_template: 'URGENT: Invoice {{invoice_number}} - Immediate Action Required',
          },
          {
            step_order: 3,
            day_offset: 14,
            channel: 'email',
            label: 'Final Notice',
            ai_template_type: 'settlement_offer',
            trigger_type: 'relative_to_last_step',
            is_active: true,
            body_template: 'We are willing to discuss a settlement arrangement for invoice {{invoice_number}}. Please contact us within 7 days to avoid escalation.',
            subject_template: 'Settlement Opportunity - Invoice {{invoice_number}}',
          },
        ];
        break;

      default:
        throw new Error(`Unsupported aging bucket: ${aging_bucket}`);
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
    }));

    const { data: createdSteps, error: stepsError } = await supabase
      .from('collection_workflow_steps')
      .insert(stepsWithWorkflowId)
      .select();

    if (stepsError) throw stepsError;

    // Get persona for this bucket
    let minDays = 0;
    switch (aging_bucket) {
      case 'dpd_1_30': minDays = 1; break;
      case 'dpd_31_60': minDays = 31; break;
      case 'dpd_61_90': minDays = 61; break;
      case 'dpd_91_120': minDays = 91; break;
      case 'dpd_121_150': minDays = 121; break;
      case 'dpd_150_plus': minDays = 151; break;
    }

    const { data: persona } = await supabase
      .from('ai_agent_personas')
      .select('id')
      .lte('bucket_min', minDays)
      .or(`bucket_max.is.null,bucket_max.gte.${minDays}`)
      .order('bucket_min', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Create draft templates with pre-written content
    if (createdSteps && createdSteps.length > 0) {
      const draftTemplates = createdSteps.map((step: any) => ({
        user_id: user.id,
        workflow_id: newWorkflow.id,
        workflow_step_id: step.id,
        agent_persona_id: persona?.id || null,
        aging_bucket: aging_bucket,
        channel: step.channel,
        subject_template: step.subject_template,
        message_body_template: step.body_template,
        step_number: step.step_order,
        day_offset: step.day_offset,
        status: 'approved', // Pre-approved since these are default templates
      }));

      const { error: templatesError } = await supabase
        .from('draft_templates')
        .insert(draftTemplates);

      if (templatesError) {
        console.error('[SETUP-DEFAULT-WORKFLOWS] Error creating templates:', templatesError);
        // Don't fail the workflow creation, just log the error
      } else {
        console.log(`[SETUP-DEFAULT-WORKFLOWS] Created ${draftTemplates.length} draft templates`);
      }
    }

    console.log(`[SETUP-DEFAULT-WORKFLOWS] Created workflow ${newWorkflow.id} for bucket ${aging_bucket}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Default workflow created for ${aging_bucket}`,
        workflow_id: newWorkflow.id,
        templates_created: createdSteps?.length || 0
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