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

    const { aging_bucket, tone_modifier, approach_style } = await req.json();

    if (!aging_bucket) {
      return new Response(JSON.stringify({ error: "aging_bucket is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tone modifiers to adjust the persona's default tone
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

    // Approach styles to change the message focus
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

    const selectedTone = toneModifiers[tone_modifier] || '';
    const selectedApproach = approachStyles[approach_style] || '';

    console.log(`Generating drafts for aging bucket: ${aging_bucket}`);

    // Calculate the days past due range for this bucket
    let minDays = -999999; // Allow negative for current invoices
    let maxDays = 999999;
    
    switch (aging_bucket) {
      case 'current':
        minDays = -999999;
        maxDays = 0; // Current = not past due (0 or negative days past due)
        break;
      case 'dpd_1_30':
        minDays = 1;
        maxDays = 30;
        break;
      case 'dpd_31_60':
        minDays = 31;
        maxDays = 60;
        break;
      case 'dpd_61_90':
        minDays = 61;
        maxDays = 90;
        break;
      case 'dpd_91_120':
        minDays = 91;
        maxDays = 120;
        break;
      case 'dpd_120_plus':
      case 'dpd_121_150':
      case 'dpd_150_plus':
        minDays = 121;
        break;
    }

    // Fetch all open invoices in this bucket for this user
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id, 
        invoice_number, 
        amount, 
        currency, 
        due_date, 
        debtor_id,
        debtors!inner(
          id,
          name, 
          company_name
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['Open', 'InPaymentPlan'])
      .order('due_date', { ascending: true });

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    console.log(`Fetched ${invoices?.length || 0} total invoices`);

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No invoices found in ${aging_bucket} bucket`,
        drafts_created: 0,
        invoices_processed: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter invoices by days past due
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filteredInvoices = invoices.filter(invoice => {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`Invoice ${invoice.invoice_number}: ${daysPastDue} days past due (need ${minDays}-${maxDays})`);
      
      return daysPastDue >= minDays && daysPastDue <= maxDays;
    });

    console.log(`Filtered to ${filteredInvoices.length} invoices in range`);

    if (filteredInvoices.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No invoices match the criteria for ${aging_bucket} bucket (${minDays}-${maxDays} days)`,
        drafts_created: 0,
        invoices_processed: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the active workflow for this bucket
    const { data: workflow, error: workflowError } = await supabase
      .from('collection_workflows')
      .select('*, steps:collection_workflow_steps(*)')
      .eq('aging_bucket', aging_bucket)
      .eq('is_active', true)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('user_id', { ascending: false })
      .limit(1)
      .single();

    console.log(`Found workflow:`, workflow?.name, `with ${workflow?.steps?.length || 0} steps`);

    if (workflowError || !workflow) {
      console.error('Workflow error:', workflowError);
      return new Response(JSON.stringify({ 
        error: `No active workflow found for ${aging_bucket}`,
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      return new Response(JSON.stringify({ 
        error: `Workflow has no steps configured`,
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get branding settings
    const { data: branding } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    let draftsCreated = 0;
    let errors: string[] = [];

    // For each invoice, generate drafts for each workflow step that should trigger
    for (const invoice of filteredInvoices) {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Processing invoice ${invoice.invoice_number} (${daysPastDue} days past due)`);

      // Check if a draft already exists for this invoice from any step in this workflow
      const { data: existingDrafts } = await supabase
        .from('ai_drafts')
        .select('workflow_step_id')
        .eq('invoice_id', invoice.id)
        .eq('user_id', user.id)
        .in('status', ['pending_approval', 'approved']);

      console.log(`Found ${existingDrafts?.length || 0} existing drafts for invoice ${invoice.invoice_number}`);

      const existingStepIds = new Set(existingDrafts?.map(d => d.workflow_step_id) || []);

      // Generate drafts for ALL active steps regardless of day_offset
      const applicableSteps = workflow.steps.filter((step: any) => 
        step.is_active && 
        !existingStepIds.has(step.id)
      );

      console.log(`Found ${applicableSteps.length} applicable steps for invoice ${invoice.invoice_number}`);

      if (applicableSteps.length === 0) {
        console.log(`Skipping invoice ${invoice.invoice_number} - all drafts already exist`);
        continue;
      }

      // Generate drafts for ALL applicable steps
      for (const step of applicableSteps) {
        try {
          // Get persona for this bucket
          const { data: persona } = await supabase
            .from('ai_agent_personas')
            .select('id')
            .lte('bucket_min', daysPastDue)
            .or(`bucket_max.is.null,bucket_max.gte.${daysPastDue}`)
            .order('bucket_min', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get persona-specific tone and writing style
          const getPersonaContext = (bucket: string, days: number) => {
            // Current bucket: invoice not yet due - send invoice notification
            if (bucket === 'current' || days <= 0) {
              return {
                name: 'Sam',
                tone: 'Warm, professional, and welcoming',
                style: `You are Sam - a friendly, professional customer success specialist sending an invoice notification. Your tone is warm and helpful.
                
VOICE & STYLE:
- This is an invoice notification, NOT a collection message - the invoice is not due yet
- Use professional but warm language ("Thank you for your business", "Attached please find", "We appreciate your partnership")
- Clearly state the invoice details: number, amount, due date
- Provide helpful payment information or instructions
- Express appreciation for their business
- Offer to help with any questions
- Keep the message professional and informative

EXAMPLE PHRASES:
- "Thank you for your recent order/service"
- "Please find your invoice details below"
- "Payment is due by [due date]"
- "If you have any questions about this invoice, please don't hesitate to reach out"
- "We appreciate your business and look forward to serving you"
- "For your convenience, you can pay via..."
- "Thank you for being a valued customer"`
              };
            } else if (days <= 30 || bucket === 'dpd_1_30') {
              return {
                name: 'Sam',
                tone: 'Warm, friendly, and gentle',
                style: `You are Sam - a friendly, approachable collections specialist who believes in maintaining positive relationships. Your tone is soft and supportive.
                
VOICE & STYLE:
- Use warm, conversational language ("Hi there!", "Hope you're doing well", "Hope all is well")
- Frame the invoice as a simple oversight or a gentle heads-up, never an accusation
- Express genuine willingness to help if there are any issues or questions
- Keep the message light, casual, and non-threatening
- NEVER use words like "urgent", "immediate", "overdue", or "past due" - instead say "outstanding" or "open"
- Use phrases like "just a friendly reminder", "wanted to reach out", "happy to help", "no rush"
- End with an upbeat, helpful, warm closing
- Be understanding that things get busy and invoices can slip through

EXAMPLE PHRASES:
- "I noticed this invoice might have slipped through the cracks"
- "Just a quick note about an open invoice"
- "Please let me know if there's anything I can help clarify"
- "Looking forward to connecting with you"
- "Don't hesitate to reach out if you have any questions"
- "Whenever you get a chance, we'd appreciate..."
- "No worries at all - just wanted to make sure you saw this"`
              };
            } else if (days <= 60 || bucket === 'dpd_31_60') {
              return {
                name: 'James',
                tone: 'Direct but professional',
                style: `You are James - a confident, no-nonsense collections professional who gets straight to the point while remaining courteous.
                
VOICE & STYLE:
- Be direct and clear about the situation without being aggressive
- State facts plainly: invoice number, amount, days overdue
- Convey expectation of payment without ultimatums
- Use professional, business-like language
- Phrases like "Following up on", "This invoice is now X days overdue", "We require payment"
- Maintain respect while being firm about expectations

EXAMPLE PHRASES:
- "I'm following up regarding invoice #X which is now overdue"
- "We need to address this outstanding balance"
- "Please arrange payment at your earliest convenience"
- "I'd appreciate a prompt response regarding payment"`
              };
            } else if (days <= 90 || bucket === 'dpd_61_90') {
              return {
                name: 'Katy',
                tone: 'Serious and focused',
                style: `You are Katy - a serious, focused collections specialist who communicates the importance of immediate resolution.
                
VOICE & STYLE:
- Communicate urgency clearly without being threatening
- Emphasize the growing seriousness of the situation
- Be more assertive about timeline expectations
- Use decisive language that conveys this needs attention NOW
- Reference previous attempts to contact if applicable
- Focus on resolution, not blame

EXAMPLE PHRASES:
- "This matter requires your immediate attention"
- "We've reached out multiple times regarding this overdue balance"
- "It's important we resolve this promptly to avoid further action"
- "Please contact us within 48 hours to discuss payment"`
              };
            } else if (days <= 120 || bucket === 'dpd_91_120') {
              return {
                name: 'Troy',
                tone: 'Very firm but professional',
                style: `You are Troy - a firm, authoritative collections professional who conveys the seriousness of extended delinquency.
                
VOICE & STYLE:
- Be very firm and unambiguous about the situation
- Clearly state this is a serious matter requiring immediate action
- Mention potential consequences without making threats
- Use formal, authoritative language
- Set clear, short deadlines for response
- Maintain professionalism while conveying gravity

EXAMPLE PHRASES:
- "This account is significantly past due and requires immediate resolution"
- "We must receive payment or a response within 5 business days"
- "Failure to respond may result in additional collection activities"
- "This is an urgent matter that cannot be delayed further"`
              };
            } else if (days <= 150 || bucket === 'dpd_121_150') {
              return {
                name: 'Gotti',
                tone: 'Very firm with serious urgency',
                style: `You are Gotti - a highly assertive collections specialist handling severely delinquent accounts with appropriate gravitas.
                
VOICE & STYLE:
- Communicate extreme urgency and seriousness
- Be very direct about the critical nature of this situation
- Reference the extended time this has been outstanding
- Mention escalation possibilities clearly (while staying compliant)
- Use formal, no-nonsense language
- Short, impactful sentences

EXAMPLE PHRASES:
- "Your account is now critically overdue at ${days} days past due"
- "Immediate action is required to prevent escalation"
- "We must hear from you within 3 business days"
- "This is your final opportunity to resolve this directly with us"`
              };
            } else {
              return {
                name: 'Rocco',
                tone: 'Firm and authoritative, high urgency, compliance-focused',
                style: `You are Rocco - the final internal collections specialist handling the most delinquent accounts with authority and compliance awareness.
                
VOICE & STYLE:
- Maximum professionalism with unmistakable urgency
- Clearly state this is a final notice / last opportunity
- Reference potential credit reporting or third-party referral (compliantly)
- Use formal, legal-adjacent but compliant language
- Be absolutely clear about immediate required action
- Short deadline, clear consequences
- Maintain FDCPA/compliance standards

EXAMPLE PHRASES:
- "FINAL NOTICE: Your account balance of $X is now ${days} days past due"
- "This is your final opportunity to resolve this matter internally"
- "Without immediate payment, we will be required to escalate this account"
- "Contact us within 48 hours to discuss immediate resolution options"
- "Continued non-payment may result in reporting to credit bureaus or referral to third-party collections"`
              };
            }
          };

          const personaContext = getPersonaContext(aging_bucket, daysPastDue);
          const businessName = branding?.business_name || 'Your Company';
          const fromName = branding?.from_name || businessName;
          const debtor = Array.isArray(invoice.debtors) ? invoice.debtors[0] : invoice.debtors;
          
          // Fetch contact name from debtor_contacts (source of truth)
          let debtorName = debtor.company_name || debtor.name || 'Customer';
          if (debtor?.id) {
            const { data: contacts } = await supabase
              .from('debtor_contacts')
              .select('name, is_primary, outreach_enabled')
              .eq('debtor_id', debtor.id)
              .eq('outreach_enabled', true)
              .order('is_primary', { ascending: false });
            
            if (contacts && contacts.length > 0) {
              const primaryContact = contacts.find((c: any) => c.is_primary);
              debtorName = primaryContact?.name || contacts[0]?.name || debtorName;
            }
          }

          const systemPrompt = `You are ${personaContext.name}, an AI collections agent for ${businessName}.

${personaContext.style}
${selectedTone ? `\n${selectedTone}` : ''}
${selectedApproach ? `\n${selectedApproach}` : ''}

CRITICAL COMPLIANCE RULES:
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment, threats, or intimidation
- NEVER misrepresent the debt or consequences
- Write as if you are ${businessName}'s accounts receivable team, NOT a third party
- Always offer the customer a chance to respond if they have disputes or issues
- Stay professional regardless of how overdue the invoice is

Your current assignment: Draft a ${personaContext.tone} message for an invoice that is ${daysPastDue} days past due.`;

          const userPrompt = `Generate a ${step.channel === 'email' ? 'professional email' : 'concise SMS (160 chars max)'} with these details:

Business: ${businessName}
From: ${fromName}
Debtor: ${debtorName}
Invoice Number: ${invoice.invoice_number}
Amount: $${invoice.amount} ${invoice.currency}
Original Due Date: ${invoice.due_date}
Days Past Due: ${daysPastDue}
Aging Bucket: ${aging_bucket}
Channel: ${step.channel}
Step Context: ${step.body_template}

${branding?.email_signature ? `\nSignature block to include:\n${branding.email_signature}` : ''}

Generate ${step.channel === 'email' ? 'a complete email message' : 'a concise SMS message (160 characters max)'}.`;

          // Generate content using Lovable AI with tool calling for structured output
          const tools = step.channel === 'email' ? [{
            type: 'function',
            function: {
              name: 'create_email_draft',
              description: 'Create an email draft with subject and body',
              parameters: {
                type: 'object',
                properties: {
                  subject: {
                    type: 'string',
                    description: 'Email subject line'
                  },
                  body: {
                    type: 'string',
                    description: 'Email body content'
                  }
                },
                required: ['subject', 'body'],
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
                { role: 'user', content: userPrompt }
              ],
              tools: tools,
              tool_choice: {
                type: 'function',
                function: {
                  name: step.channel === 'email' ? 'create_email_draft' : 'create_sms_draft'
                }
              }
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error(`AI API error for invoice ${invoice.invoice_number}:`, errorText);
            errors.push(`Failed to generate content for invoice ${invoice.invoice_number}`);
            continue;
          }

          const aiResult = await aiResponse.json();
          const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

          if (!toolCall || !toolCall.function?.arguments) {
            errors.push(`No content generated for invoice ${invoice.invoice_number}`);
            continue;
          }

          // Parse the tool call arguments
          const parsed = JSON.parse(toolCall.function.arguments);
          const messageBody = parsed.body;
          const subject = parsed.subject || null;

          if (!messageBody) {
            errors.push(`Empty message body for invoice ${invoice.invoice_number}`);
            continue;
          }

          // Calculate recommended send date based on due date + step day_offset
          // If already past the step's trigger date, use today
          const stepTriggerDate = new Date(dueDate);
          stepTriggerDate.setDate(stepTriggerDate.getDate() + step.day_offset);
          const recommendedSendDate = stepTriggerDate > today ? stepTriggerDate : today;

          // Insert draft
          const { error: draftError } = await supabase
            .from('ai_drafts')
            .insert({
              user_id: user.id,
              invoice_id: invoice.id,
              workflow_step_id: step.id,
              agent_persona_id: persona?.id,
              channel: step.channel,
              subject: subject,
              message_body: messageBody,
              step_number: step.step_order,
              days_past_due: daysPastDue,
              status: 'pending_approval',
              recommended_send_date: recommendedSendDate.toISOString().split('T')[0],
            });

          if (draftError) {
            console.error(`Error creating draft for invoice ${invoice.invoice_number}:`, draftError);
            errors.push(`Failed to save draft for invoice ${invoice.invoice_number}`);
            continue;
          }

          draftsCreated++;
          console.log(`Created draft for invoice ${invoice.invoice_number}, step ${step.label}`);
        } catch (error: any) {
          console.error(`Error processing invoice ${invoice.invoice_number}, step ${step.label}:`, error);
          errors.push(`Error processing invoice ${invoice.invoice_number}, step ${step.label}: ${error.message}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      drafts_created: draftsCreated,
      invoices_processed: filteredInvoices.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error in generate-bucket-drafts:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
