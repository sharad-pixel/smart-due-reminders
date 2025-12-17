import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { getPersonaToneByBucket } from '../_shared/personaTones.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateRequest {
  aging_bucket: string;
  step_number: number;
  step_label: string;
  day_offset: number;
  total_steps: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { aging_bucket, step_number, step_label, day_offset, total_steps }: TemplateRequest = await req.json();

    console.log(`[GENERATE-WORKFLOW-TEMPLATES] Generating template for ${aging_bucket}, step ${step_number}/${total_steps}`);

    // Get persona for this bucket
    const persona = getPersonaToneByBucket(aging_bucket);
    if (!persona) {
      throw new Error(`No persona found for bucket: ${aging_bucket}`);
    }

    // Determine step context
    const isFirstStep = step_number === 1;
    const isLastStep = step_number === total_steps;
    const stepContext = isFirstStep 
      ? "This is the FIRST contact in this collection phase."
      : isLastStep 
        ? "This is the FINAL/LAST contact in this collection phase before escalation."
        : `This is follow-up contact ${step_number} of ${total_steps} in this collection phase.`;

    // Build the AI prompt
    const systemPrompt = `You are an expert collections email copywriter. Your task is to generate professional, compliant collection email templates that match a specific tone and persona.

${persona.systemPromptGuidelines}

IMPORTANT RULES:
1. ALWAYS write in English
2. Write the email AS the business (first-person), never as a third party
3. Include personalization placeholders: {{customer_name}}, {{company_name}}, {{invoice_number}}, {{amount}}, {{due_date}}, {{days_past_due}}, {{payment_link}}
4. Email body must be 3-5 paragraphs minimum - NO ONE-LINERS
5. Be professional and compliant - never use harassment or threats
6. Include a clear call to action
7. Maintain the persona's specific tone throughout
8. Do not include a signature - that will be added automatically`;

    const userPrompt = `Generate a collection email template for the "${persona.name}" persona.

CONTEXT:
- Aging Bucket: ${aging_bucket} (${getBucketDescription(aging_bucket)})
- Step: ${step_number} of ${total_steps} - "${step_label}"
- Day Offset: ${day_offset} days after entering this bucket
- ${stepContext}

PERSONA TONE: ${persona.tone}
APPROACH: ${persona.approach}

Generate a professional email with:
1. A compelling subject line (no longer than 60 characters)
2. An email body that is 3-5 paragraphs long

The email should:
- Open with a ${isFirstStep ? 'warm/appropriate introduction' : 'reference to previous communication'}
- Clearly state the purpose and amount owed
- Include the specific tone for ${persona.name}
- ${isLastStep ? 'Emphasize this is the final notice before escalation' : 'Set expectations for next steps'}
- End with a clear call to action and payment link reference

Return your response in this exact JSON format:
{
  "subject": "Subject line here",
  "body": "Full email body here with line breaks as \\n"
}`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
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
            description: 'Create an email template with subject and body',
            parameters: {
              type: 'object',
              properties: {
                subject: {
                  type: 'string',
                  description: 'Email subject line (max 60 characters)'
                },
                body: {
                  type: 'string',
                  description: 'Email body content (3-5 paragraphs)'
                }
              },
              required: ['subject', 'body'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: {
          type: 'function',
          function: { name: 'create_email_template' }
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[GENERATE-WORKFLOW-TEMPLATES] AI error:', errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || !toolCall.function?.arguments) {
      console.error('[GENERATE-WORKFLOW-TEMPLATES] No tool call in response');
      throw new Error('No content generated from AI');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    
    console.log(`[GENERATE-WORKFLOW-TEMPLATES] Generated template for ${persona.name}, step ${step_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        persona: persona.name,
        subject: parsed.subject,
        body: parsed.body
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GENERATE-WORKFLOW-TEMPLATES] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getBucketDescription(bucket: string): string {
  switch (bucket) {
    case 'dpd_1_30': return '1-30 days past due - Early stage, friendly reminder';
    case 'dpd_31_60': return '31-60 days past due - Mid stage, professional urgency';
    case 'dpd_61_90': return '61-90 days past due - Late stage, serious attention required';
    case 'dpd_91_120': return '91-120 days past due - Very late, firm consequences';
    case 'dpd_121_150': return '121-150 days past due - Pre-legal, maximum pressure';
    case 'dpd_150_plus':
    case 'dpd_151_plus': return '150+ days past due - Final internal collection stage';
    default: return 'Unknown stage';
  }
}
