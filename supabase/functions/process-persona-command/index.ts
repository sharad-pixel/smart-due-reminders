import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 50,
  windowMinutes: 60,
  blockDurationMinutes: 30,
};

// Persona definitions matching your system
const PERSONAS = {
  sam: { name: "Sam", bucketMin: 1, bucketMax: 30, tone: "friendly and gentle" },
  james: { name: "James", bucketMin: 31, bucketMax: 60, tone: "direct but professional" },
  katy: { name: "Katy", bucketMin: 61, bucketMax: 90, tone: "assertive and serious" },
  troy: { name: "Troy", bucketMin: 91, bucketMax: 120, tone: "very firm but professional" },
  jimmy: { name: "Jimmy", bucketMin: 121, bucketMax: 150, tone: "very firm with serious urgency" },
  rocco: { name: "Rocco", bucketMin: 151, bucketMax: null, tone: "firm and authoritative, compliance-focused" }
};

interface ParsedCommand {
  action: string;
  personaName?: string;
  invoiceId?: string;
  channel: "email" | "sms";
}

function parseCommand(commandText: string, contextInvoiceId?: string): ParsedCommand {
  const lowerCommand = commandText.toLowerCase();

  // Detect persona
  let personaName: string | undefined;
  for (const [key, persona] of Object.entries(PERSONAS)) {
    if (lowerCommand.includes(persona.name.toLowerCase())) {
      personaName = persona.name;
      break;
    }
  }

  // Detect action type
  let action = "draft_message";
  if (lowerCommand.includes("remind") || lowerCommand.includes("reminder")) {
    action = "remind_customer";
  } else if (lowerCommand.includes("follow up") || lowerCommand.includes("follow-up")) {
    action = "follow_up";
  } else if (lowerCommand.includes("escalate")) {
    action = "escalate";
  }

  // Detect channel
  const channel = lowerCommand.includes("sms") || lowerCommand.includes("text") ? "sms" : "email";

  // Extract invoice identifier
  // IMPORTANT: if caller supplies a UUID invoice ID, always prefer it (prevents accidentally extracting trailing digits like "0069").
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hasUuidContext = !!(contextInvoiceId && uuidRe.test(contextInvoiceId));

  let invoiceId: string | undefined;
  if (hasUuidContext) {
    invoiceId = contextInvoiceId;
  } else {
    // Try to capture invoice numbers like "TEST-INV-0069" first
    const invoiceLabelMatch = commandText.match(/invoice\s*#?\s*([A-Za-z0-9][A-Za-z0-9\-_/]{2,})/i);
    if (invoiceLabelMatch?.[1]) {
      invoiceId = invoiceLabelMatch[1];
    } else {
      // Fall back to any numeric reference
      const digitsMatch = commandText.match(/#?(\d{3,})/);
      invoiceId = digitsMatch ? digitsMatch[1] : contextInvoiceId;
    }
  }

  return { action, personaName, invoiceId, channel };
}

function resolvePersona(daysPastDue: number, explicitPersonaName?: string) {
  // If explicitly mentioned, use that
  if (explicitPersonaName) {
    const persona = Object.values(PERSONAS).find(p => p.name === explicitPersonaName);
    if (persona) return persona;
  }
  
  // Otherwise, use aging bucket logic
  for (const persona of Object.values(PERSONAS)) {
    if (persona.bucketMax === null) {
      if (daysPastDue >= persona.bucketMin) return persona;
    } else {
      if (daysPastDue >= persona.bucketMin && daysPastDue <= persona.bucketMax) {
        return persona;
      }
    }
  }
  
  return PERSONAS.sam; // Default
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Rate limiting check
    const { data: rateLimitResult } = await supabaseAdmin.rpc('check_action_rate_limit', {
      p_identifier: user.id,
      p_action_type: 'ai_command',
      p_max_requests: RATE_LIMIT.maxRequests,
      p_window_minutes: RATE_LIMIT.windowMinutes,
      p_block_duration_minutes: RATE_LIMIT.blockDurationMinutes,
    });
    
    if (rateLimitResult && !rateLimitResult.allowed) {
      console.log('Rate limit exceeded for user:', user.id);
      return new Response(
        JSON.stringify({
          error: rateLimitResult.message || 'Rate limit exceeded. Please try again later.',
          blocked_until: rateLimitResult.blocked_until,
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '1800' } 
        }
      );
    }
    
    const { command, contextInvoiceId, contextDebtorId, contextType, senderEmail, emailSubject, paymentContext, reasoning } = await req.json();
    
    // Basic input validation
    if (!command || typeof command !== 'string') {
      throw new Error('Command is required');
    }
    
    if (command.length > 2000) {
      throw new Error('Command too long (max 2000 characters)');
    }
    
    console.log('Processing command:', command);
    console.log('Context - invoiceId:', contextInvoiceId, 'debtorId:', contextDebtorId);
    console.log('Payment context:', paymentContext);
    
    // Parse the command
    const parsed = parseCommand(command, contextInvoiceId);
    
    // Get business info
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('business_name, email')
      .eq('id', user.id)
      .single();
    
    const businessName = profile?.business_name || "Your Business";
    
    let invoice: any = null;
    let debtor: any = null;
    let daysPastDue = 0;
    let taskContext = '';
    let paymentActivityContext = '';
    
    // Try to get invoice context if available
    if (parsed.invoiceId) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.invoiceId || '');
      
      console.log('Looking up invoice - isUUID:', isUUID, 'invoiceId:', parsed.invoiceId, 'userId:', user.id);
      
      let invoiceQuery = supabaseAdmin
        .from('invoices')
        .select('*, debtors(id, name, email, company_name)')
        .eq('user_id', user.id);
      
      if (isUUID) {
        invoiceQuery = invoiceQuery.eq('id', parsed.invoiceId);
      } else {
        invoiceQuery = invoiceQuery.eq('invoice_number', parsed.invoiceId);
      }
      
      const { data: invoiceData, error: invoiceError } = await invoiceQuery.single();
      
      if (invoiceError) {
        console.error('Invoice lookup error:', invoiceError);
      } else {
        console.log('Invoice found:', invoiceData?.id, invoiceData?.invoice_number);
      }
      
      invoice = invoiceData;
      debtor = invoice?.debtors;
      
      if (invoice) {
        const today = new Date();
        const dueDate = new Date(invoice.due_date);
        daysPastDue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Fetch any open tasks for this invoice
        const { data: openTasks } = await supabaseAdmin
          .from('collection_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('invoice_id', invoice.id)
          .in('status', ['open', 'in_progress'])
          .order('priority', { ascending: false });
        
        if (openTasks && openTasks.length > 0) {
          const taskLabels: Record<string, string> = {
            w9_request: 'W9 tax form request',
            payment_plan_needed: 'payment arrangement request',
            incorrect_po: 'dispute about wrong PO number',
            dispute_charges: 'dispute about incorrect charges',
            invoice_copy_request: 'request to resend invoice',
            billing_address_update: 'billing address correction needed',
            payment_method_update: 'payment details update needed',
            service_not_delivered: 'claim that service/product not received',
            overpayment_inquiry: 'question about double charge or overpayment',
            paid_verification: 'claim that invoice already paid',
            extension_request: 'request for payment deadline extension',
            callback_required: 'request for phone call or meeting'
          };

          const taskDescriptions = openTasks.map(task => {
            const label = taskLabels[task.task_type] || task.task_type;
            return `- ${label}: ${task.summary}${task.recommended_action ? ` (Recommended: ${task.recommended_action})` : ''}`;
          }).join('\n');

          taskContext = `\n\nIMPORTANT CONTEXT - Customer has made the following requests/raised these issues:\n${taskDescriptions}\n\nYou MUST acknowledge and address these open items in your message. Reference them naturally and provide appropriate responses or next steps.`;
        }
      }
    }
    
    // If no invoice, try to get debtor context
    if (!invoice && contextDebtorId) {
      const { data: debtorData } = await supabaseAdmin
        .from('debtors')
        .select('*')
        .eq('id', contextDebtorId)
        .eq('user_id', user.id)
        .single();
      
      debtor = debtorData;
      
      // Try to get the most recent open invoice for this debtor
      if (debtor) {
        const { data: recentInvoice } = await supabaseAdmin
          .from('invoices')
          .select('*')
          .eq('debtor_id', debtor.id)
          .eq('user_id', user.id)
          .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid'])
          .order('due_date', { ascending: false })
          .limit(1)
          .single();
        
        if (recentInvoice) {
          invoice = recentInvoice;
          const today = new Date();
          const dueDate = new Date(invoice.due_date);
          daysPastDue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        }
        
        // Get open tasks for this debtor
        const { data: openTasks } = await supabaseAdmin
          .from('collection_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('debtor_id', debtor.id)
          .in('status', ['open', 'in_progress'])
          .order('priority', { ascending: false });
        
        if (openTasks && openTasks.length > 0) {
          const taskLabels: Record<string, string> = {
            w9_request: 'W9 tax form request',
            payment_plan_needed: 'payment arrangement request',
            incorrect_po: 'dispute about wrong PO number',
            dispute_charges: 'dispute about incorrect charges',
            invoice_copy_request: 'request to resend invoice',
            billing_address_update: 'billing address correction needed',
            payment_method_update: 'payment details update needed',
            service_not_delivered: 'claim that service/product not received',
            overpayment_inquiry: 'question about double charge or overpayment',
            paid_verification: 'claim that invoice already paid',
            extension_request: 'request for payment deadline extension',
            callback_required: 'request for phone call or meeting'
          };

          const taskDescriptions = openTasks.map(task => {
            const label = taskLabels[task.task_type] || task.task_type;
            return `- ${label}: ${task.summary}${task.recommended_action ? ` (Recommended: ${task.recommended_action})` : ''}`;
          }).join('\n');

          taskContext = `\n\nIMPORTANT CONTEXT - Customer has made the following requests/raised these issues:\n${taskDescriptions}\n\nYou MUST acknowledge and address these open items in your message. Reference them naturally and provide appropriate responses or next steps.`;
        }
      }
    }
    
    // If still no debtor, try to find by sender email in debtor_contacts
    if (!debtor && senderEmail) {
      // Search debtor_contacts for matching email
      const { data: contactMatch } = await supabaseAdmin
        .from('debtor_contacts')
        .select('debtor_id')
        .eq('user_id', user.id)
        .ilike('email', senderEmail)
        .limit(1)
        .single();
      
      if (contactMatch?.debtor_id) {
        const { data: debtorByContact } = await supabaseAdmin
          .from('debtors')
          .select('*')
          .eq('id', contactMatch.debtor_id)
          .eq('user_id', user.id)
          .single();
        
        debtor = debtorByContact;
      }
      
      if (debtor) {
        // Try to get the most recent open invoice for this debtor
        const { data: recentInvoice } = await supabaseAdmin
          .from('invoices')
          .select('*')
          .eq('debtor_id', debtor.id)
          .eq('user_id', user.id)
          .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid'])
          .order('due_date', { ascending: false })
          .limit(1)
          .single();
        
        if (recentInvoice) {
          invoice = recentInvoice;
          const today = new Date();
          const dueDate = new Date(invoice.due_date);
          daysPastDue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }
    }
    
    // Get contact email from debtor_contacts for prompt context
    let contactEmail = senderEmail || 'Unknown';
    if (debtor?.id) {
      const { data: contacts } = await supabaseAdmin
        .from('debtor_contacts')
        .select('email, is_primary')
        .eq('debtor_id', debtor.id)
        .eq('outreach_enabled', true)
        .order('is_primary', { ascending: false });
      
      if (contacts && contacts.length > 0) {
        const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];
        contactEmail = primaryContact?.email || contactEmail;
      }
    }
    
    // Resolve persona (default to Sam for general responses)
    const persona = resolvePersona(daysPastDue, parsed.personaName);
    
    // Build payment activity context if provided
    if (paymentContext) {
      const { invoiceAmount, outstandingAmount, isPaidInFull, recentPayments, companyName } = paymentContext;
      
      if (recentPayments?.length > 0) {
        const paymentDetails = recentPayments.map((p: any) => 
          `- $${p.amount?.toLocaleString() || 0} on ${p.date || 'unknown date'}${p.method ? ` via ${p.method}` : ''}`
        ).join('\n');
        
        paymentActivityContext = `\n\nPAYMENT CONTEXT - Use this to craft an appropriate payment acknowledgment:\n${isPaidInFull 
          ? `Invoice has been PAID IN FULL. Customer ${companyName || 'the customer'} has completed payment of $${invoiceAmount?.toLocaleString() || 0}.`
          : `Partial payment received. Original invoice: $${invoiceAmount?.toLocaleString() || 0}. Remaining balance: $${outstandingAmount?.toLocaleString() || 0}.`
        }\n\nRecent payment activity:\n${paymentDetails}\n\n${reasoning ? 'REASONING REQUIRED: Think through why this customer paid and how to maintain the positive relationship. Consider thanking them appropriately based on their payment behavior.' : ''}`;
      }
    }
    
    // Build AI prompt based on available context
    let systemPrompt = `You are ${persona.name}, an AI collections assistant representing ${businessName}.\n
Your tone is: ${persona.tone}\n
Rules:\n- Act in this persona's tone and style\n- Write as the business, using full white-label identity\n- NEVER mention Recouply.ai or imply third-party collection services\n- NEVER use threats, legal intimidation, or harassment\n- Keep the message professional and helpful\n- Include a clear next step or call to action\n- Offer a polite way for the customer to reply or resolve their inquiry\n- Be concise but personable\n- If there are open customer requests or issues, acknowledge them professionally and address them${taskContext}${paymentActivityContext}`;

    let userPrompt: string;
    
    if (paymentContext) {
      // Payment acknowledgment mode - use warmer, thankful tone
      const { isPaidInFull, companyName, invoiceAmount, outstandingAmount } = paymentContext;
      const customerName = companyName || 'the customer';
      userPrompt = isPaidInFull
        ? `Generate a warm, professional thank-you email acknowledging that ${customerName} has paid their invoice in full. Express genuine gratitude for the payment of $${invoiceAmount?.toLocaleString() || 0}. Reinforce the positive business relationship and invite future collaboration. Keep it concise but heartfelt.\n\nIMPORTANT: The email subject line MUST include "${customerName}" - for example "Thank You for Your Payment, ${customerName}" or "Payment Received - Thank You, ${customerName}!"`
        : `Generate a professional email acknowledging a partial payment from ${customerName}. Thank them for their payment and gently remind them of the remaining balance of $${outstandingAmount?.toLocaleString() || 0}. Maintain a positive tone while making the remaining balance clear. Offer to discuss payment options if needed.\n\nIMPORTANT: The email subject line MUST include "${customerName}" - for example "Payment Received - Thank You, ${customerName}" or "Thank You for Your Payment, ${customerName}"`;
    } else if (invoice) {
      userPrompt = `Generate a ${parsed.channel} response for:

Invoice: #${invoice.invoice_number}
Amount: $${invoice.amount}
Due Date: ${invoice.due_date}
Days Past Due: ${daysPastDue}
Customer: ${debtor?.company_name || debtor?.name || 'Customer'}
Email: ${contactEmail}
Action requested: ${parsed.action}`;
    } else if (debtor) {
      userPrompt = `Generate a ${parsed.channel} response for a customer inquiry:

Customer: ${debtor.company_name || debtor.name}
Email: ${contactEmail}
Total Outstanding Balance: $${debtor.total_open_balance || 0}
Open Invoices: ${debtor.open_invoices_count || 0}

Please craft a helpful response addressing their inquiry. If they have outstanding invoices, you may politely reference their account status.`;
    } else {
      // No invoice or debtor context - generate a general professional response
      userPrompt = `Generate a professional ${parsed.channel} response to a customer inquiry.

Sender Email: ${senderEmail || 'Unknown'}
Subject: ${emailSubject || 'Customer Inquiry'}

Please craft a helpful, professional response. Since we don't have specific account details, keep the response general but offer to help with their inquiry. Ask for clarification if needed to better assist them.`;
    }

    // Generate draft using Lovable AI with tool calling
    const tools = parsed.channel === 'email' ? [{
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

    console.log('Calling AI with prompt:', userPrompt);

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
        tools: tools,
        tool_choice: {
          type: 'function',
          function: {
            name: parsed.channel === 'email' ? 'create_email_draft' : 'create_sms_draft'
          }
        }
      }),
    });
    
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI response error:', errorText);
      throw new Error(`AI generation failed: ${aiResponse.statusText}`);
    }
    
    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error('No content generated from AI');
    }

    const aiParsed = JSON.parse(toolCall.function.arguments);
    const subject = aiParsed.subject || null;
    const messageBody = aiParsed.body;

    if (!messageBody) {
      throw new Error('Empty message body from AI');
    }
    
    // Find persona ID from database
    const { data: personaRecord } = await supabaseAdmin
      .from('ai_agent_personas')
      .select('id')
      .eq('name', persona.name)
      .single();
    
    // Save draft - invoice_id is optional now
    const draftData: any = {
      user_id: user.id,
      channel: parsed.channel,
      subject,
      message_body: messageBody,
      status: 'pending_approval',
      step_number: 1,
      days_past_due: daysPastDue,
      agent_persona_id: personaRecord?.id
    };
    
    // Only add invoice_id if we have one
    if (invoice) {
      draftData.invoice_id = invoice.id;
      console.log('Linking draft to invoice:', invoice.id, invoice.invoice_number);
    } else {
      console.warn('No invoice found to link draft - invoice_id will be null');
    }
    
    const { data: draft, error: draftError } = await supabaseAdmin
      .from('ai_drafts')
      .insert(draftData)
      .select()
      .single();
    
    if (draftError) {
      console.error('Draft save error:', draftError);
      throw draftError;
    }
    
    console.log('Draft created successfully:', draft.id, 'with invoice_id:', draft.invoice_id);
    
    // Log command
    await supabaseAdmin
      .from('ai_command_logs')
      .insert({
        user_id: user.id,
        command_text: command,
        persona_name: persona.name,
        invoice_id: invoice?.id || null,
        draft_id: draft.id,
        context_type: contextType
      });
    
    return new Response(
      JSON.stringify({
        success: true,
        draft,
        persona: persona.name,
        invoiceNumber: invoice?.invoice_number || null,
        debtorName: debtor?.company_name || debtor?.name || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error processing command:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
