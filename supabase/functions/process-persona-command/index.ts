import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Persona definitions matching your system
const PERSONAS = {
  sam: { name: "Sam", bucketMin: 1, bucketMax: 30, tone: "friendly and gentle" },
  james: { name: "James", bucketMin: 31, bucketMax: 60, tone: "direct but professional" },
  katy: { name: "Katy", bucketMin: 61, bucketMax: 90, tone: "assertive and serious" },
  troy: { name: "Troy", bucketMin: 91, bucketMax: 120, tone: "very firm but professional" },
  gotti: { name: "Gotti", bucketMin: 121, bucketMax: null, tone: "very firm with serious urgency" }
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
  
  // Extract invoice ID from command or use context
  const invoiceMatch = commandText.match(/#?(\d+)/);
  const invoiceId = invoiceMatch ? invoiceMatch[1] : contextInvoiceId;
  
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
    
    const { command, contextInvoiceId, contextType } = await req.json();
    
    console.log('Processing command:', command);
    
    // Parse the command
    const parsed = parseCommand(command, contextInvoiceId);
    
    if (!parsed.invoiceId) {
      return new Response(
        JSON.stringify({ error: "Please specify an invoice number or select an invoice" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*, debtors(name, email, company_name)')
      .eq('invoice_number', parsed.invoiceId)
      .eq('user_id', user.id)
      .single();
    
    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: `Invoice #${parsed.invoiceId} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate days past due
    const today = new Date();
    const dueDate = new Date(invoice.due_date);
    const daysPastDue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Resolve persona
    const persona = resolvePersona(daysPastDue, parsed.personaName);
    
    // Get business info
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('business_name, email')
      .eq('id', user.id)
      .single();
    
    const businessName = profile?.business_name || "Your Business";
    
    // Build AI prompt
    const systemPrompt = `You are ${persona.name}, an AI collections assistant representing ${businessName}.\n
Your tone is: ${persona.tone}\n
Rules:\n- Act in this persona's tone and style\n- Write as the business, using full white-label identity\n- NEVER mention Recouply.ai or imply third-party collection services\n- NEVER use threats, legal intimidation, or harassment\n- Keep the message compliant, professional, and appropriate for ${daysPastDue} days past due\n- Include a call to action for payment\n- Offer a polite way for the customer to reply or resolve disputes\n- Be concise but personable`;

    const userPrompt = `Generate a ${parsed.channel} message for:\n
Invoice: #${invoice.invoice_number}\n
Amount: $${invoice.amount}\n
Due Date: ${invoice.due_date}\n
Days Past Due: ${daysPastDue}\n
Customer: ${invoice.debtors?.company_name || invoice.debtors?.name}\n
Email: ${invoice.debtors?.email}\n
Action requested: ${parsed.action}\n
${parsed.channel === "email" ? "Include a subject line." : "Keep it under 160 characters for SMS."}`;

    // Generate draft using Lovable AI
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
      }),
    });
    
    if (!aiResponse.ok) {
      throw new Error(`AI generation failed: ${aiResponse.statusText}`);
    }
    
    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;
    
    // Parse subject and body for email
    let subject = null;
    let messageBody = generatedContent;
    
    if (parsed.channel === "email") {
      const subjectMatch = generatedContent.match(/Subject:\s*(.+?)(?:\n|$)/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        messageBody = generatedContent.replace(/Subject:\s*.+?(?:\n|$)/i, '').trim();
      }
    }
    
    // Find persona ID from database
    const { data: personaRecord } = await supabaseAdmin
      .from('ai_agent_personas')
      .select('id')
      .eq('name', persona.name)
      .single();
    
    // Save draft
    const { data: draft, error: draftError } = await supabaseAdmin
      .from('ai_drafts')
      .insert({
        user_id: user.id,
        invoice_id: invoice.id,
        channel: parsed.channel,
        subject,
        message_body: messageBody,
        status: 'pending_approval',
        step_number: 1,
        days_past_due: daysPastDue,
        agent_persona_id: personaRecord?.id
      })
      .select()
      .single();
    
    if (draftError) {
      throw draftError;
    }
    
    // Log command
    await supabaseAdmin
      .from('ai_command_logs')
      .insert({
        user_id: user.id,
        command_text: command,
        persona_name: persona.name,
        invoice_id: invoice.id,
        draft_id: draft.id,
        context_type: contextType
      });
    
    return new Response(
      JSON.stringify({
        success: true,
        draft,
        persona: persona.name,
        invoiceNumber: invoice.invoice_number
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
