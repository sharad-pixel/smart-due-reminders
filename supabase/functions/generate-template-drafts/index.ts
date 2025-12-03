import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { aging_bucket } = await req.json();

    if (!aging_bucket) {
      return new Response(JSON.stringify({ error: "aging_bucket is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating draft templates for aging bucket: ${aging_bucket}`);

    // Get the active workflow for this bucket
    const { data: workflow, error: workflowError } = await supabase
      .from('collection_workflows')
      .select('*, steps:collection_workflow_steps(*)')
      .eq('aging_bucket', aging_bucket)
      .eq('is_active', true)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('user_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (workflowError) {
      console.error('Workflow query error:', workflowError);
      return new Response(JSON.stringify({ 
        error: `Database error querying workflow: ${workflowError.message}`,
        success: false
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let activeWorkflow = workflow;
    
    if (!activeWorkflow) {
      console.log(`No active workflow found for ${aging_bucket}, creating default workflow for user: ${user.id}`);
      
      // Define default workflow configuration based on aging bucket
      const workflowConfigs: Record<string, { name: string; description: string; steps: Array<{ day_offset: number; label: string; template_type: string }> }> = {
        'dpd_1_30': {
          name: '1-30 Days Past Due Workflow',
          description: 'Friendly reminders for recently overdue invoices',
          steps: [
            { day_offset: 3, label: 'Initial Reminder', template_type: 'friendly_reminder' },
            { day_offset: 7, label: 'Second Reminder', template_type: 'follow_up' },
            { day_offset: 14, label: 'Final Reminder', template_type: 'urgent_reminder' },
          ]
        },
        'dpd_31_60': {
          name: '31-60 Days Past Due Workflow',
          description: 'Firm follow-ups for overdue invoices',
          steps: [
            { day_offset: 3, label: 'Initial Follow-up', template_type: 'firm_reminder' },
            { day_offset: 7, label: 'Payment Request', template_type: 'payment_request' },
            { day_offset: 14, label: 'Escalation Notice', template_type: 'escalation_notice' },
          ]
        },
        'dpd_61_90': {
          name: '61-90 Days Past Due Workflow',
          description: 'Urgent collection notices',
          steps: [
            { day_offset: 3, label: 'Urgent Notice', template_type: 'urgent_notice' },
            { day_offset: 7, label: 'Final Warning', template_type: 'final_warning' },
            { day_offset: 14, label: 'Collection Notice', template_type: 'collection_notice' },
          ]
        },
        'dpd_91_120': {
          name: '91-120 Days Past Due Workflow',
          description: 'Final notices before escalation',
          steps: [
            { day_offset: 3, label: 'Pre-Escalation Notice', template_type: 'pre_escalation' },
            { day_offset: 7, label: 'Final Demand', template_type: 'final_demand' },
            { day_offset: 14, label: 'Last Chance Notice', template_type: 'last_chance' },
          ]
        },
        'dpd_121_150': {
          name: '121-150 Days Past Due Workflow',
          description: 'Escalated collection actions',
          steps: [
            { day_offset: 3, label: 'Escalation Notice', template_type: 'escalation_action' },
            { day_offset: 7, label: 'Credit Report Warning', template_type: 'credit_warning' },
            { day_offset: 14, label: 'Final Resolution', template_type: 'final_resolution' },
          ]
        },
        'dpd_150_plus': {
          name: '150+ Days Past Due Workflow',
          description: 'Final collection and compliance actions',
          steps: [
            { day_offset: 3, label: 'Final Notice', template_type: 'final_notice' },
            { day_offset: 7, label: 'Compliance Notice', template_type: 'compliance_notice' },
            { day_offset: 14, label: 'Resolution Deadline', template_type: 'resolution_deadline' },
          ]
        },
      };

      const config = workflowConfigs[aging_bucket];
      if (!config) {
        return new Response(JSON.stringify({ 
          error: `Invalid aging bucket: ${aging_bucket}`,
          success: false
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create the workflow
      const { data: newWorkflow, error: createWorkflowError } = await supabase
        .from('collection_workflows')
        .insert({
          user_id: user.id,
          name: config.name,
          description: config.description,
          aging_bucket: aging_bucket,
          is_active: true,
          is_default: false,
          is_locked: false,
          auto_generate_drafts: false,
        })
        .select()
        .single();

      if (createWorkflowError || !newWorkflow) {
        console.error('Failed to create workflow:', createWorkflowError);
        return new Response(JSON.stringify({ 
          error: `Failed to create workflow: ${createWorkflowError?.message}`,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create workflow steps
      const stepsToInsert = config.steps.map((step, index) => ({
        workflow_id: newWorkflow.id,
        step_order: index + 1,
        day_offset: step.day_offset,
        label: step.label,
        channel: 'email',
        trigger_type: 'days_past_due',
        ai_template_type: step.template_type,
        body_template: `Generate a ${step.template_type.replace(/_/g, ' ')} message`,
        is_active: true,
        requires_review: true,
      }));

      const { data: newSteps, error: createStepsError } = await supabase
        .from('collection_workflow_steps')
        .insert(stepsToInsert)
        .select();

      if (createStepsError) {
        console.error('Failed to create workflow steps:', createStepsError);
        return new Response(JSON.stringify({ 
          error: `Failed to create workflow steps: ${createStepsError.message}`,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Created new workflow ${newWorkflow.id} with ${newSteps?.length || 0} steps`);
      activeWorkflow = { ...newWorkflow, steps: newSteps || [] };
    }

    if (!activeWorkflow.steps || activeWorkflow.steps.length === 0) {
      return new Response(JSON.stringify({ 
        error: `Workflow has no steps configured`,
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Query for the exact persona that matches this bucket range
    const { data: persona } = await supabase
      .from('ai_agent_personas')
      .select('id, name, tone_guidelines, persona_summary')
      .lte('bucket_min', minDays)
      .or(`bucket_max.is.null,bucket_max.gte.${minDays}`)
      .order('bucket_min', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get branding settings
    const { data: branding } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    let templatesCreated = 0;
    let errors: string[] = [];

    // Check for existing templates (any status) - don't auto-delete
    const { data: existingTemplates } = await supabase
      .from('draft_templates')
      .select('workflow_step_id')
      .eq('workflow_id', activeWorkflow.id)
      .eq('aging_bucket', aging_bucket)
      .eq('user_id', user.id);

    const existingStepIds = new Set(existingTemplates?.map(t => t.workflow_step_id) || []);
    console.log(`Found ${existingStepIds.size} existing templates for workflow ${activeWorkflow.id}`);

    // Generate template for each workflow step
    for (const step of activeWorkflow.steps) {
      if (!step.is_active) {
        console.log(`Skipping step ${step.label} - inactive`);
        continue;
      }

      // Skip if this step already has a template (any status)
      if (existingStepIds.has(step.id)) {
        console.log(`Skipping step ${step.label} - already has template`);
        continue;
      }

      // Only generate email templates by default, skip SMS
      if (step.channel === 'sms') {
        console.log(`Skipping step ${step.label} - SMS templates not generated by default`);
        continue;
      }

      try {
        const getToneForBucket = (bucket: string): string => {
          switch (bucket) {
            case 'current': return 'friendly reminder';
            case 'dpd_1_30': return 'firm but friendly';
            case 'dpd_31_60': return 'firm and direct';
            case 'dpd_61_90': return 'urgent and direct but respectful';
            case 'dpd_91_120': return 'very firm, urgent, and compliant';
            case 'dpd_120_plus': return 'extremely firm, urgent, final notice tone';
            default: return 'professional';
          }
        };

        const businessName = branding?.business_name || 'Your Company';
        const fromName = branding?.from_name || businessName;

        const personaContext = persona?.name === 'Rocco' 
          ? `You are ${persona.name}, ${persona.persona_summary || 'a compliance-focused collections specialist'}. ${persona.tone_guidelines}. Reference credit reporting, delinquency procedures, and the possibility of legal action as appropriate for this stage.`
          : `You are ${persona?.name || 'a professional collections specialist'}. ${persona?.tone_guidelines || 'professional'}`;

        const systemPrompt = `You are drafting a professional collections message TEMPLATE for ${businessName}.

CRITICAL RULES:
- Create a TEMPLATE that will be personalized later with specific invoice data
- Use placeholders like {{debtor_name}}, {{invoice_number}}, {{amount}}, {{currency}}, {{due_date}}, {{days_past_due}}
- Be firm, clear, and professional
- Be respectful and non-threatening
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment or intimidation
- Write as if you are ${businessName}, NOT a third party
- Encourage the customer to pay or reply if there is a dispute or issue
- Use a ${getToneForBucket(aging_bucket)} tone

PERSONA CONTEXT:
${personaContext}`;

        const userPrompt = `Generate a professional collection message TEMPLATE with the following context:

Business: ${businessName}
From: ${fromName}
Aging Bucket: ${aging_bucket}
Channel: ${step.channel}
Step: ${step.label} (Day ${step.day_offset})
Template Context: ${step.body_template}

${branding?.email_signature ? `\nSignature block to include:\n${branding.email_signature}` : ''}

Use these placeholders in your template:
- {{debtor_name}} - The customer's name
- {{invoice_number}} - The invoice number
- {{amount}} - The invoice amount
- {{currency}} - Currency (e.g., USD)
- {{due_date}} - Original due date
- {{days_past_due}} - Days overdue

Generate ${step.channel === 'email' ? 'a complete email template' : 'a concise SMS template (160 characters max)'}.`;

        // Generate content using Lovable AI with tool calling
        const tools = step.channel === 'email' ? [{
          type: 'function',
          function: {
            name: 'create_email_template',
            description: 'Create an email template with subject and body',
            parameters: {
              type: 'object',
              properties: {
                subject: {
                  type: 'string',
                  description: 'Email subject line template'
                },
                body: {
                  type: 'string',
                  description: 'Email body template with placeholders'
                }
              },
              required: ['subject', 'body'],
              additionalProperties: false
            }
          }
        }] : [{
          type: 'function',
          function: {
            name: 'create_sms_template',
            description: 'Create an SMS template',
            parameters: {
              type: 'object',
              properties: {
                body: {
                  type: 'string',
                  description: 'SMS message template (max 160 characters)'
                }
              },
              required: ['body'],
              additionalProperties: false
            }
          }
        }];

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            tools: tools,
            tool_choice: {
              type: 'function',
              function: {
                name: step.channel === 'email' ? 'create_email_template' : 'create_sms_template'
              }
            }
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for step ${step.label}:`, errorText);
          errors.push(`Failed to generate template for ${step.label}`);
          continue;
        }

        const aiResult = await aiResponse.json();
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall || !toolCall.function?.arguments) {
          errors.push(`No content generated for ${step.label}`);
          continue;
        }

        const parsed = JSON.parse(toolCall.function.arguments);
        const messageBody = parsed.body;
        const subject = parsed.subject || null;

        if (!messageBody) {
          errors.push(`Empty message body for ${step.label}`);
          continue;
        }

        // Insert template
        const { error: templateError } = await supabase
          .from('draft_templates')
          .insert({
            user_id: user.id,
            workflow_id: activeWorkflow.id,
            workflow_step_id: step.id,
            agent_persona_id: persona?.id,
            aging_bucket: aging_bucket,
            channel: step.channel,
            subject_template: subject,
            message_body_template: messageBody,
            step_number: step.step_order,
            day_offset: step.day_offset,
            status: 'pending_approval',
          });

        if (templateError) {
          console.error(`Error creating template for ${step.label}:`, templateError);
          errors.push(`Failed to save template for ${step.label}`);
          continue;
        }

        templatesCreated++;
        console.log(`Created template for step ${step.label}`);
      } catch (error: any) {
        console.error(`Error processing step ${step.label}:`, error);
        errors.push(`Error processing step ${step.label}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      templates_created: templatesCreated,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error in generate-template-drafts:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});