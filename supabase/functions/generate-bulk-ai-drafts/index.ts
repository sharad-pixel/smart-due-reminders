import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getPersonaToneByDaysPastDue } from '../_shared/personaTones.ts';
import { cleanupPlaceholders, formatCurrency, formatDate, getInvoiceLink } from '../_shared/draftContentEngine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const { invoice_ids } = await req.json();

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'invoice_ids array is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Generating AI drafts for ${invoice_ids.length} invoices`);

    // Get branding settings
    const { data: branding } = await supabaseClient
      .from('branding_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const results = [];
    const errors = [];

    for (const invoiceId of invoice_ids) {
      try {
        // Get invoice with debtor info
        const { data: invoice, error: invoiceError } = await supabaseClient
          .from('invoices')
          .select(`
            *,
            debtors!inner(
              id,
              name,
              company_name
            )
          `)
          .eq('id', invoiceId)
          .eq('user_id', userId)
          .single();

        if (invoiceError || !invoice) {
          errors.push({ invoice_id: invoiceId, error: 'Invoice not found' });
          continue;
        }

        // Fetch primary contact from debtor_contacts (source of truth)
        let debtorName = invoice.debtors.company_name || invoice.debtors.name || 'Customer';
        
        if (invoice.debtors.id) {
          const { data: contacts } = await supabaseClient
            .from('debtor_contacts')
            .select('name, is_primary, outreach_enabled')
            .eq('debtor_id', invoice.debtors.id)
            .eq('outreach_enabled', true)
            .order('is_primary', { ascending: false });
          
          if (contacts && contacts.length > 0) {
            const primaryContact = contacts.find((c: any) => c.is_primary);
            debtorName = primaryContact?.name || contacts[0]?.name || debtorName;
          }
        }

        // Calculate days past due and aging bucket
        const today = new Date();
        const dueDate = new Date(invoice.due_date);
        const daysPastDue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        let agingBucket = 'current';
        if (daysPastDue > 150) {
          agingBucket = 'dpd_150_plus';
        } else if (daysPastDue > 120) {
          agingBucket = 'dpd_121_150';
        } else if (daysPastDue > 90) {
          agingBucket = 'dpd_91_120';
        } else if (daysPastDue > 60) {
          agingBucket = 'dpd_61_90';
        } else if (daysPastDue > 30) {
          agingBucket = 'dpd_31_60';
        } else if (daysPastDue >= 1) {
          agingBucket = 'dpd_1_30';
        }

        // Get workflow for this aging bucket
        const { data: workflow } = await supabaseClient
          .from('collection_workflows')
          .select(`
            *,
            steps:collection_workflow_steps(*)
          `)
          .eq('aging_bucket', agingBucket)
          .or(`user_id.eq.${userId},user_id.is.null`)
          .eq('is_active', true)
          .order('user_id', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Find the appropriate step based on days past due
        let workflowStep = null;
        if (workflow?.steps) {
          const sortedSteps = workflow.steps
            .filter((s: any) => s.is_active)
            .sort((a: any, b: any) => a.day_offset - b.day_offset);
          
          // Find the step whose day_offset is <= days_past_due
          for (let i = sortedSteps.length - 1; i >= 0; i--) {
            if (sortedSteps[i].day_offset <= daysPastDue) {
              workflowStep = sortedSteps[i];
              break;
            }
          }
          
          // If no step matches, use the first step
          if (!workflowStep && sortedSteps.length > 0) {
            workflowStep = sortedSteps[0];
          }
        }

        // Build AI prompt with persona-specific tone
        const businessName = branding?.business_name || 'Your Company';
        const fromName = branding?.from_name || businessName;
        
        // Get persona-specific tone based on days past due
        const persona = getPersonaToneByDaysPastDue(daysPastDue);
        const personaGuidelines = persona?.systemPromptGuidelines || '';
        const personaName = persona?.name || 'Collections Agent';
        
        console.log(`Using persona ${personaName} for invoice ${invoice.invoice_number} (${daysPastDue} days past due, bucket: ${agingBucket})`);
        
        const systemPrompt = `You are ${personaName}, drafting a professional collections message for ${businessName} to send to their customer about an overdue invoice.

${personaGuidelines}

CRITICAL COMPLIANCE RULES:
- Be respectful and non-threatening
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment or intimidation
- Write as if you are ${businessName}, NOT a third party
- Encourage the customer to pay or reply if there is a dispute or issue`;

        const userPrompt = workflowStep?.body_template || getDefaultTemplate(agingBucket);
        const productDesc = invoice.product_description ? `\n- Product/Service: ${invoice.product_description}` : '';
        
        const contextualPrompt = `${userPrompt}

Context:
- Business: ${businessName}
- From: ${fromName}
- Debtor: ${debtorName}
- Invoice Number: ${invoice.invoice_number}
- Amount: $${invoice.amount} ${invoice.currency || 'USD'}
- Original Due Date: ${invoice.due_date}
- Days Past Due: ${daysPastDue}
- Aging Bucket: ${agingBucket}${productDesc}

${branding?.email_signature ? `\nSignature block to include:\n${branding.email_signature}` : ''}`;

        // Generate draft using Lovable AI with tool calling
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        const channel = workflowStep?.channel || 'email';
        
        const tools = channel === 'email' ? [{
          type: 'function',
          function: {
            name: 'create_email_draft',
            description: 'Create an email draft with body content',
            parameters: {
              type: 'object',
              properties: {
                body: {
                  type: 'string',
                  description: 'Email body content'
                }
              },
              required: ['body'],
              additionalProperties: false
            }
          }
        }] : [{
          type: 'function',
          function: {
            name: 'create_sms_draft',
            description: 'Create an SMS draft',
            parameters: {
              type: 'object',
              properties: {
                body: {
                  type: 'string',
                  description: 'SMS message content (max 160 characters)'
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
              { role: 'user', content: contextualPrompt }
            ],
            tools: tools,
            tool_choice: {
              type: 'function',
              function: {
                name: channel === 'email' ? 'create_email_draft' : 'create_sms_draft'
              }
            }
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', aiResponse.status, errorText);
          errors.push({ invoice_id: invoiceId, error: 'AI generation failed' });
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall || !toolCall.function?.arguments) {
          errors.push({ invoice_id: invoiceId, error: 'No content generated' });
          continue;
        }

        const parsed = JSON.parse(toolCall.function.arguments);
        let generatedContent = parsed.body;

        if (!generatedContent) {
          errors.push({ invoice_id: invoiceId, error: 'Empty message body' });
          continue;
        }

        // CRITICAL: Clean up any remaining placeholders from AI output
        generatedContent = cleanupPlaceholders(generatedContent);

        // Generate subject line
        const subjectPrompt = workflowStep?.subject_template || 
          `Invoice ${invoice.invoice_number} - ${daysPastDue} Days Past Due`;

        // Calculate recommended send date based on due date + step day_offset
        // If already past the step's trigger date, use today
        const stepDayOffset = workflowStep?.day_offset || 0;
        const stepTriggerDate = new Date(dueDate);
        stepTriggerDate.setDate(stepTriggerDate.getDate() + stepDayOffset);
        const recommendedSendDate = stepTriggerDate > today ? stepTriggerDate : today;

        // Create draft in database
        const { data: draft, error: draftError } = await supabaseClient
          .from('ai_drafts')
          .insert({
            user_id: userId,
            invoice_id: invoice.id,
            workflow_step_id: workflowStep?.id || null,
            channel: workflowStep?.channel || 'email',
            step_number: workflowStep?.step_order || 1,
            subject: subjectPrompt,
            message_body: generatedContent,
            status: 'pending_approval',
            recommended_send_date: recommendedSendDate.toISOString().split('T')[0],
            days_past_due: daysPastDue,
          })
          .select()
          .single();

        if (draftError) {
          console.error('Error creating draft:', draftError);
          errors.push({ invoice_id: invoiceId, error: draftError.message });
        } else {
          results.push(draft);
        }

      } catch (error) {
        console.error(`Error processing invoice ${invoiceId}:`, error);
        errors.push({ 
          invoice_id: invoiceId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: results.length,
        errors: errors.length,
        data: results,
        failed: errors,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-bulk-ai-drafts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getDefaultTemplate(bucket: string): string {
  const templates: Record<string, string> = {
    current: 'Generate a friendly reminder that payment is coming due soon. Keep tone positive and helpful.',
    dpd_1_30: 'Generate a warm, friendly follow-up about the outstanding invoice. Use soft language and offer help. Do NOT use urgent or pressure language.',
    dpd_31_60: 'Generate a professional, direct message about the overdue invoice. Be clear about expectations while offering solutions.',
    dpd_61_90: 'Generate a serious, assertive message about the significantly overdue invoice. Emphasize urgency and the need for immediate attention.',
    dpd_91_120: 'Generate a very firm, formal message about the long-overdue invoice. Use final notice language and mention potential escalation.',
    dpd_121_150: 'Generate a legal-tone message about the critically overdue invoice. Reference potential legal remedies while remaining compliant.',
    dpd_150_plus: 'Generate a final internal collections message. Be authoritative and firm, demanding immediate resolution. Do not threaten legal action or third-party collections.',
  };
  return templates[bucket] || templates.current;
}
