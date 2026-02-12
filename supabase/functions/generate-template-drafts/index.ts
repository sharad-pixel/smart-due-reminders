import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pre-written templates for each aging bucket and step
const defaultTemplates: Record<string, Array<{ subject: string; body: string }>> = {
  'dpd_1_30': [
    {
      subject: 'Friendly Reminder - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

This is a friendly reminder that invoice {{invoice_number}} for {{currency}} {{amount}} was due on {{due_date}}.

If you have already sent payment, please disregard this message. If not, we kindly ask that you arrange payment at your earliest convenience.

If you have any questions or concerns regarding this invoice, please don't hesitate to contact us.

Thank you for your prompt attention to this matter.

Best regards`
    },
    {
      subject: 'Follow-Up: Invoice {{invoice_number}} Payment Reminder',
      body: `Dear {{debtor_name}},

We are following up on our previous reminder regarding invoice {{invoice_number}} for {{currency}} {{amount}}, which is now {{days_past_due}} days past due.

We understand that oversights happen, but we would appreciate your attention to this matter. Please arrange payment or contact us if you need to discuss payment options.

Thank you for your cooperation.

Best regards`
    },
    {
      subject: 'Urgent: Payment Required - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

This is an urgent notice regarding invoice {{invoice_number}} for {{currency}} {{amount}}, which is now significantly overdue.

Please arrange payment immediately to avoid any further action. If there are issues preventing payment, please contact us right away to discuss a resolution.

We value your business and look forward to resolving this matter promptly.

Best regards`
    }
  ],
  'dpd_31_60': [
    {
      subject: 'Overdue Notice - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

Your account has an outstanding balance. Invoice {{invoice_number}} for {{currency}} {{amount}} is now {{days_past_due}} days past due.

This matter requires your immediate attention. Please arrange payment or contact us to discuss payment arrangements.

Failure to respond may result in further collection activity.

Best regards`
    },
    {
      subject: 'Second Notice: Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

Despite our previous communications, invoice {{invoice_number}} for {{currency}} {{amount}} remains unpaid.

Please contact us immediately to resolve this matter. We are willing to discuss payment options if you are experiencing financial difficulties.

Please note that continued non-payment may affect your account status.

Best regards`
    },
    {
      subject: 'Final Notice Before Escalation - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

This is your final notice regarding invoice {{invoice_number}} for {{currency}} {{amount}}.

Payment must be received within 7 days to avoid escalation of this matter. If you are unable to pay in full, please contact us immediately to arrange a payment plan.

We strongly urge you to address this matter without delay.

Best regards`
    }
  ],
  'dpd_61_90': [
    {
      subject: 'URGENT: Seriously Overdue - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

Your account is seriously delinquent. Invoice {{invoice_number}} for {{currency}} {{amount}} is now {{days_past_due}} days past due.

This is a critical matter requiring your immediate attention. Please contact us today to arrange payment.

Continued non-payment will result in escalation to our collections process.

Best regards`
    },
    {
      subject: 'Escalation Warning - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

We have not received a response regarding the seriously overdue invoice {{invoice_number}} for {{currency}} {{amount}}.

This account is scheduled for escalation if we do not hear from you within the next 5 business days. Please contact us immediately to prevent further action.

Best regards`
    },
    {
      subject: 'FINAL NOTICE: Invoice {{invoice_number}} - Collections Pending',
      body: `Dear {{debtor_name}},

This is your final opportunity to resolve invoice {{invoice_number}} for {{currency}} {{amount}} before we proceed with formal collection activities.

To avoid escalation, you must contact us within 48 hours. We are still willing to discuss reasonable payment arrangements.

Failure to respond will result in this matter being referred for further collection action.

Best regards`
    }
  ],
  'dpd_91_120': [
    {
      subject: 'CRITICAL: Invoice {{invoice_number}} - Immediate Action Required',
      body: `Dear {{debtor_name}},

Invoice {{invoice_number}} for {{currency}} {{amount}} is approaching 120 days overdue. This is a critical situation requiring your immediate response.

Your account is at risk of being referred to an external collection agency. To prevent this, please contact us today to make payment arrangements.

This is an urgent matter that cannot be delayed further.

Best regards`
    },
    {
      subject: 'Pre-Collections Notice - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

Your account will be referred for further collection action if invoice {{invoice_number}} for {{currency}} {{amount}} is not resolved immediately.

This may have serious consequences for your credit standing. Please contact us within 3 business days to discuss resolution options.

Best regards`
    },
    {
      subject: 'FINAL NOTICE: Invoice {{invoice_number}} - Collections Pending',
      body: `Dear {{debtor_name}},

This is your absolute final notice for invoice {{invoice_number}} for {{currency}} {{amount}} before external collections proceedings begin.

You have 48 hours to contact us and make payment arrangements. After this time, your account will be transferred to our collections department.

Best regards`
    }
  ],
  'dpd_121_150': [
    {
      subject: 'CRITICAL STATUS: Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

Invoice {{invoice_number}} for {{currency}} {{amount}} is now in critical status. Your account may be sent to an external collection agency if not resolved immediately.

Please contact us today. We may still be able to arrange a settlement or payment plan to avoid further action.

Best regards`
    },
    {
      subject: 'Settlement Opportunity - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

We are offering you a final opportunity to settle invoice {{invoice_number}} for {{currency}} {{amount}} before external collection action.

Contact us within 5 business days to discuss settlement options. This offer will not remain available indefinitely.

Best regards`
    },
    {
      subject: 'FINAL NOTICE: Invoice {{invoice_number}} - External Collections',
      body: `Dear {{debtor_name}},

This is your final notice before invoice {{invoice_number}} for {{currency}} {{amount}} is referred to external collections.

Once this referral occurs, you will be dealing with a third-party collection agency. Contact us immediately if you wish to resolve this matter directly.

Best regards`
    }
  ],
  'dpd_150_plus': [
    {
      subject: 'URGENT: Critical Payment Required - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

Invoice {{invoice_number}} for {{currency}} {{amount}} is now {{days_past_due}} days overdue. This is a critical collection notice.

Immediate payment is required to avoid further action, including potential referral to external collections and credit reporting.

Please contact us immediately.

Best regards`
    },
    {
      subject: 'URGENT: Invoice {{invoice_number}} - Immediate Action Required',
      body: `Dear {{debtor_name}},

URGENT: Invoice {{invoice_number}} for {{currency}} {{amount}} requires immediate payment.

Your account is at serious risk. Contact us today to discuss resolution options before further action is taken.

Best regards`
    },
    {
      subject: 'Settlement Opportunity - Invoice {{invoice_number}}',
      body: `Dear {{debtor_name}},

We are willing to discuss a settlement arrangement for invoice {{invoice_number}} for {{currency}} {{amount}}.

Please contact us within 7 days to discuss settlement options. This may be your final opportunity to resolve this matter before escalation.

Best regards`
    }
  ]
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

    const { aging_bucket, tone_modifier, approach_style } = await req.json();

    if (!aging_bucket) {
      return new Response(JSON.stringify({ error: "aging_bucket is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const useAIGeneration = (tone_modifier && tone_modifier !== 'standard') || (approach_style && approach_style !== 'standard');

    console.log(`Creating draft templates for aging bucket: ${aging_bucket}`);

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

    // If no workflow exists or workflow has no steps, create them
    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      console.log(`No workflow or no steps for ${aging_bucket} - calling setup-default-workflows`);
      
      // Call setup-default-workflows to create the workflow with steps and templates
      const setupResponse = await supabase.functions.invoke('setup-default-workflows', {
        body: { aging_bucket },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (setupResponse.error) {
        return new Response(JSON.stringify({ 
          error: `Failed to setup workflow: ${setupResponse.error.message}`,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        templates_created: 3,
        message: 'Default workflow and templates created'
      }), {
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

    const { data: persona } = await supabase
      .from('ai_agent_personas')
      .select('id')
      .lte('bucket_min', minDays)
      .or(`bucket_max.is.null,bucket_max.gte.${minDays}`)
      .order('bucket_min', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check for existing templates
    const { data: existingTemplates } = await supabase
      .from('draft_templates')
      .select('workflow_step_id')
      .eq('workflow_id', workflow.id)
      .eq('aging_bucket', aging_bucket)
      .eq('user_id', user.id);

    const existingStepIds = new Set(existingTemplates?.map(t => t.workflow_step_id) || []);
    console.log(`Found ${existingStepIds.size} existing templates for workflow ${workflow.id}`);

    // Get the pre-written templates for this bucket
    const bucketTemplates = defaultTemplates[aging_bucket] || defaultTemplates['dpd_1_30'];

    // Tone and approach modifiers for AI generation
    const toneModifiers: Record<string, string> = {
      'standard': '',
      'more_friendly': `
TONE ADJUSTMENT - Make this message MORE FRIENDLY:
- Use warmer, more conversational language
- Add more empathy and understanding
- Soften any direct requests
- Focus on relationship preservation`,
      'more_professional': `
TONE ADJUSTMENT - Make this message MORE PROFESSIONAL:
- Use formal business language
- Be more structured and precise
- Maintain courteous but businesslike tone
- Focus on facts and deadlines`,
      'more_urgent': `
TONE ADJUSTMENT - Make this message MORE URGENT:
- Emphasize time sensitivity
- Be more direct about consequences
- Use action-oriented language
- Include clear deadlines`,
      'more_empathetic': `
TONE ADJUSTMENT - Make this message MORE EMPATHETIC:
- Acknowledge potential difficulties
- Offer flexibility and understanding
- Use compassionate language
- Focus on finding solutions together`,
      'more_direct': `
TONE ADJUSTMENT - Make this message MORE DIRECT:
- Get straight to the point
- Be clear about expectations
- Minimize pleasantries
- Focus on specific action needed`
    };

    const approachStyles: Record<string, string> = {
      'standard': '',
      'invoice_reminder': `
APPROACH STYLE - INVOICE REMINDER:
- Focus on invoice details and due date
- Treat as a simple reminder/heads-up
- Assume it may have been overlooked
- Keep tone light and helpful`,
      'payment_request': `
APPROACH STYLE - PAYMENT REQUEST:
- Be clear this is a request for payment
- Include payment options if known
- Set expectation for response
- Professional and action-oriented`,
      'settlement_offer': `
APPROACH STYLE - SETTLEMENT OFFER:
- Mention willingness to discuss payment options
- Open door to payment plans or negotiations
- Focus on finding mutually beneficial resolution
- Be solution-oriented`,
      'final_notice': `
APPROACH STYLE - FINAL NOTICE:
- Clearly state this is a final notice
- Outline potential next steps if no response
- Be firm but professional
- Include clear deadline for response`,
      'relationship_focused': `
APPROACH STYLE - RELATIONSHIP FOCUSED:
- Emphasize value of ongoing business relationship
- Express desire to maintain partnership
- Be understanding of circumstances
- Focus on working together to resolve`
    };

    const selectedTone = toneModifiers[tone_modifier || 'standard'] || '';
    const selectedApproach = approachStyles[approach_style || 'standard'] || '';

    let templatesCreated = 0;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Get branding settings for AI generation
    const { data: branding } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Create templates for steps that don't have them
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      
      if (!step.is_active) continue;
      if (existingStepIds.has(step.id)) continue;

      let templateSubject: string;
      let templateBody: string;

      if (useAIGeneration && LOVABLE_API_KEY) {
        // Use AI to generate with tone/approach modifiers
        const businessName = branding?.business_name || 'Your Company';
        const personaName = minDays <= 30 ? 'Sam' : minDays <= 60 ? 'James' : minDays <= 90 ? 'Katy' : minDays <= 120 ? 'Troy' : minDays <= 150 ? 'Gotti' : 'Rocco';
        
        const systemPrompt = `You are ${personaName}, an AI collections agent for ${businessName}.

Generate a professional collection email template. Use placeholders like {{debtor_name}}, {{invoice_number}}, {{amount}}, {{currency}}, {{due_date}}, {{days_past_due}} for dynamic content.
${selectedTone}
${selectedApproach}

CRITICAL RULES:
- NEVER claim to be a "collection agency" or legal authority
- NEVER use harassment, threats, or intimidation
- Write as the company's accounts receivable team
- Always offer a chance to respond for disputes or issues
- Stay professional`;

        const userPrompt = `Generate an email template for Step ${step.step_order} (Day ${step.day_offset}) of the ${aging_bucket} collection workflow.

The template should include placeholders for:
- {{debtor_name}} - Customer/debtor name
- {{invoice_number}} - Invoice number
- {{amount}} - Invoice amount
- {{currency}} - Currency code
- {{due_date}} - Original due date
- {{days_past_due}} - Days past due

Generate a complete email with subject line and body.`;

        try {
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
              tools: [{
                type: 'function',
                function: {
                  name: 'create_email_template',
                  description: 'Create an email template with subject and body',
                  parameters: {
                    type: 'object',
                    properties: {
                      subject: { type: 'string', description: 'Email subject line template' },
                      body: { type: 'string', description: 'Email body template' }
                    },
                    required: ['subject', 'body'],
                    additionalProperties: false
                  }
                }
              }],
              tool_choice: { type: 'function', function: { name: 'create_email_template' } }
            }),
          });

          if (aiResponse.ok) {
            const aiResult = await aiResponse.json();
            const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall?.function?.arguments) {
              const parsed = JSON.parse(toolCall.function.arguments);
              templateSubject = parsed.subject || bucketTemplates[i]?.subject || bucketTemplates[0].subject;
              templateBody = parsed.body || bucketTemplates[i]?.body || bucketTemplates[0].body;
              console.log(`AI generated template for step ${step.label} with tone: ${tone_modifier}, approach: ${approach_style}`);
            } else {
              // Fallback to pre-written
              const templateContent = bucketTemplates[i] || bucketTemplates[0];
              templateSubject = templateContent.subject;
              templateBody = templateContent.body;
            }
          } else {
            // Fallback to pre-written
            const templateContent = bucketTemplates[i] || bucketTemplates[0];
            templateSubject = templateContent.subject;
            templateBody = templateContent.body;
            console.log(`AI generation failed, using pre-written template for step ${step.label}`);
          }
        } catch (aiError) {
          // Fallback to pre-written
          const templateContent = bucketTemplates[i] || bucketTemplates[0];
          templateSubject = templateContent.subject;
          templateBody = templateContent.body;
          console.error(`AI error, using pre-written template:`, aiError);
        }
      } else {
        // Use pre-written templates
        const templateContent = bucketTemplates[i] || bucketTemplates[0];
        templateSubject = templateContent.subject;
        templateBody = templateContent.body;
      }

      const { error: templateError } = await supabase
        .from('draft_templates')
        .insert({
          user_id: user.id,
          workflow_id: workflow.id,
          workflow_step_id: step.id,
          agent_persona_id: persona?.id || null,
          aging_bucket: aging_bucket,
          channel: step.channel,
          subject_template: templateSubject,
          message_body_template: templateBody,
          step_number: step.step_order,
          day_offset: step.day_offset,
          status: 'pending_approval', // Pending approval when AI generated with customizations
        });

      if (templateError) {
        console.error(`Error creating template for step ${step.label}:`, templateError);
        continue;
      }

      templatesCreated++;
      console.log(`Created template for step ${step.label}`);
    }

    return new Response(JSON.stringify({
      success: true,
      templates_created: templatesCreated,
      ai_generated: useAIGeneration,
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
