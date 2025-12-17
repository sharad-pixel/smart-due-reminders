import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { getPersonaToneByBucket } from '../_shared/personaTones.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Step definitions for each bucket with AI-appropriate context
const BUCKET_STEPS = {
  dpd_1_30: [
    { step_order: 1, day_offset: 0, label: 'Friendly Reminder', ai_template_type: 'payment_reminder' },
    { step_order: 2, day_offset: 7, label: 'Gentle Follow-Up', ai_template_type: 'followup' },
    { step_order: 3, day_offset: 14, label: 'Warm Final Notice', ai_template_type: 'friendly_final' },
  ],
  dpd_31_60: [
    { step_order: 1, day_offset: 0, label: 'Professional Notice', ai_template_type: 'payment_reminder' },
    { step_order: 2, day_offset: 7, label: 'Direct Follow-Up', ai_template_type: 'urgent_notice' },
    { step_order: 3, day_offset: 14, label: 'Firm Final Notice', ai_template_type: 'final_notice' },
  ],
  dpd_61_90: [
    { step_order: 1, day_offset: 0, label: 'Urgent Notice', ai_template_type: 'urgent_notice' },
    { step_order: 2, day_offset: 7, label: 'Serious Follow-Up', ai_template_type: 'final_notice' },
    { step_order: 3, day_offset: 14, label: 'Escalation Warning', ai_template_type: 'collections_notice' },
  ],
  dpd_91_120: [
    { step_order: 1, day_offset: 0, label: 'Critical Notice', ai_template_type: 'final_notice' },
    { step_order: 2, day_offset: 7, label: 'Pre-Collections Warning', ai_template_type: 'collections_notice' },
    { step_order: 3, day_offset: 14, label: 'Final Internal Notice', ai_template_type: 'collections_notice' },
  ],
  dpd_121_150: [
    { step_order: 1, day_offset: 0, label: 'Legal Notice', ai_template_type: 'collections_notice' },
    { step_order: 2, day_offset: 7, label: 'Settlement Opportunity', ai_template_type: 'settlement_offer' },
    { step_order: 3, day_offset: 14, label: 'Final Legal Warning', ai_template_type: 'final_legal' },
  ],
  dpd_150_plus: [
    { step_order: 1, day_offset: 0, label: 'Final Collection Notice', ai_template_type: 'collections_notice' },
    { step_order: 2, day_offset: 7, label: 'Settlement Offer', ai_template_type: 'settlement_offer' },
    { step_order: 3, day_offset: 14, label: 'Account Closure Warning', ai_template_type: 'account_closure' },
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { buckets } = await req.json();
    const targetBuckets = buckets || Object.keys(BUCKET_STEPS);

    console.log(`[GENERATE-ALL-TEMPLATES] Generating AI templates for user ${user.id}, buckets: ${targetBuckets.join(', ')}`);

    const results: any[] = [];
    let totalTemplatesCreated = 0;

    for (const bucket of targetBuckets) {
      const steps = BUCKET_STEPS[bucket as keyof typeof BUCKET_STEPS];
      if (!steps) {
        console.log(`[GENERATE-ALL-TEMPLATES] Unknown bucket: ${bucket}, skipping`);
        continue;
      }

      const persona = getPersonaToneByBucket(bucket);
      if (!persona) {
        console.log(`[GENERATE-ALL-TEMPLATES] No persona for bucket: ${bucket}, skipping`);
        continue;
      }

      // Check if workflow exists
      let { data: existingWorkflow } = await supabase
        .from('collection_workflows')
        .select('id')
        .eq('aging_bucket', bucket)
        .eq('user_id', user.id)
        .maybeSingle();

      let workflowId: string;

      // Create workflow if doesn't exist
      if (!existingWorkflow) {
        const { data: newWorkflow, error: workflowError } = await supabase
          .from('collection_workflows')
          .insert({
            user_id: user.id,
            aging_bucket: bucket,
            name: `${persona.name}'s ${bucket.replace('dpd_', '').replace('_', '-')} Day Workflow`,
            description: `AI-powered collection workflow using ${persona.name}'s ${persona.tone} approach`,
            is_active: true,
            auto_generate_drafts: true,
          })
          .select()
          .single();

        if (workflowError || !newWorkflow) {
          console.error(`[GENERATE-ALL-TEMPLATES] Error creating workflow for ${bucket}:`, workflowError);
          continue;
        }
        workflowId = newWorkflow.id;
      } else {
        workflowId = existingWorkflow.id;
      }

      // Generate AI templates for each step
      for (const step of steps) {
        try {
          const template = await generateAITemplate(
            lovableApiKey,
            bucket,
            step.step_order,
            step.label,
            step.day_offset,
            steps.length,
            persona
          );

          // Create or update workflow step with AI content
          const { data: existingStep } = await supabase
            .from('collection_workflow_steps')
            .select('id')
            .eq('workflow_id', workflowId)
            .eq('step_order', step.step_order)
            .maybeSingle();

          if (existingStep) {
            await supabase
              .from('collection_workflow_steps')
              .update({
                subject_template: template.subject,
                body_template: template.body,
                label: step.label,
                ai_template_type: step.ai_template_type,
                is_active: true,
              })
              .eq('id', existingStep.id);
          } else {
            await supabase
              .from('collection_workflow_steps')
              .insert({
                workflow_id: workflowId,
                step_order: step.step_order,
                day_offset: step.day_offset,
                channel: 'email',
                label: step.label,
                ai_template_type: step.ai_template_type,
                trigger_type: step.step_order === 1 ? 'relative_to_due' : 'relative_to_last_step',
                is_active: true,
                requires_review: false,
                subject_template: template.subject,
                body_template: template.body,
              });
          }

          totalTemplatesCreated++;
          console.log(`[GENERATE-ALL-TEMPLATES] Created template for ${bucket} step ${step.step_order}`);

        } catch (stepError) {
          console.error(`[GENERATE-ALL-TEMPLATES] Error generating step ${step.step_order} for ${bucket}:`, stepError);
        }
      }

      results.push({
        bucket,
        persona: persona.name,
        workflow_id: workflowId,
        steps_processed: steps.length,
      });
    }

    console.log(`[GENERATE-ALL-TEMPLATES] Completed: ${totalTemplatesCreated} templates created`);

    return new Response(
      JSON.stringify({
        success: true,
        templates_created: totalTemplatesCreated,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GENERATE-ALL-TEMPLATES] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateAITemplate(
  apiKey: string,
  bucket: string,
  stepNumber: number,
  stepLabel: string,
  dayOffset: number,
  totalSteps: number,
  persona: any
): Promise<{ subject: string; body: string }> {
  const isFirstStep = stepNumber === 1;
  const isLastStep = stepNumber === totalSteps;
  const stepContext = isFirstStep 
    ? "This is the FIRST contact in this collection phase."
    : isLastStep 
      ? "This is the FINAL/LAST contact in this collection phase before escalation."
      : `This is follow-up contact ${stepNumber} of ${totalSteps} in this collection phase.`;

  const systemPrompt = `You are an expert collections email copywriter. Your task is to generate professional, compliant collection email templates.

${persona.systemPromptGuidelines}

CRITICAL RULES:
1. ALWAYS write in English
2. Write the email AS the business (first-person), never as a third party
3. Include placeholders: {{customer_name}}, {{company_name}}, {{invoice_number}}, {{amount}}, {{due_date}}, {{days_past_due}}, {{payment_link}}
4. Email body MUST be 3-5 paragraphs - detailed and professional, NOT one-liners
5. Never use harassment, threats, or non-compliant language
6. Include a clear call to action
7. Maintain ${persona.name}'s tone throughout
8. Do NOT include a signature - that's added automatically`;

  const bucketDescriptions: Record<string, string> = {
    dpd_1_30: '1-30 days past due - Early stage, friendly reminder approach',
    dpd_31_60: '31-60 days past due - Mid stage, professional urgency',
    dpd_61_90: '61-90 days past due - Late stage, serious attention required',
    dpd_91_120: '91-120 days past due - Very late, firm consequences',
    dpd_121_150: '121-150 days past due - Pre-legal, maximum professional pressure',
    dpd_150_plus: '150+ days past due - Final internal collection stage',
    dpd_151_plus: '150+ days past due - Final internal collection stage',
  };

  const userPrompt = `Generate a collection email template for ${persona.name}.

CONTEXT:
- Aging Bucket: ${bucket} (${bucketDescriptions[bucket] || 'Collection stage'})
- Step: ${stepNumber} of ${totalSteps} - "${stepLabel}"
- Day Offset: ${dayOffset} days after entering this bucket
- ${stepContext}

PERSONA: ${persona.name}
TONE: ${persona.tone}
APPROACH: ${persona.approach}

Requirements:
- Subject line under 60 characters
- Body must be 3-5 substantial paragraphs
- ${isFirstStep ? 'Opening should be appropriate greeting for this tone level' : 'Reference previous communication attempts'}
- State the invoice details and amount clearly
- ${isLastStep ? 'Emphasize this is the final notice before escalation/next steps' : 'Set expectations for what happens next'}
- End with clear call to action and reference {{payment_link}}

Return JSON format:
{
  "subject": "Subject line",
  "body": "Full email body with paragraphs separated by \\n\\n"
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'create_email_template',
          description: 'Create an email template',
          parameters: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              body: { type: 'string' }
            },
            required: ['subject', 'body'],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'create_email_template' } }
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall?.function?.arguments) {
    throw new Error('No template generated');
  }

  return JSON.parse(toolCall.function.arguments);
}
