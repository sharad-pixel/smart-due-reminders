import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ResendRecipient {
  address: string;
  name?: string;
}

interface ResendAttachment {
  filename: string;
  content: string;
  type: string;
  size?: number;
}

interface ResendPayload {
  to?: ResendRecipient[];
  from?: ResendRecipient[];
  subject?: string;
  text?: string;
  html?: string;
  raw?: string;
  headers?: Record<string, string>;
  attachments?: ResendAttachment[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    console.error('Method not allowed:', req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // TODO: Verify Resend webhook signature using RESEND_WEBHOOK_SECRET
    // const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
    // if (webhookSecret) {
    //   const signature = req.headers.get('resend-signature');
    //   // Implement signature verification here
    // }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming Resend webhook payload
    const payload: ResendPayload = await req.json();
    console.log('Received Resend inbound email webhook');

    // Extract from/to addresses safely
    const fromEmail = payload.from?.[0]?.address?.toLowerCase() || '';
    const toEmail = payload.to?.[0]?.address?.toLowerCase() || '';
    const subject = payload.subject || null;
    const htmlBody = payload.html || null;
    const textBody = payload.text || null;
    const rawBody = payload.raw || null;
    const attachments = payload.attachments || [];

    console.log('Processing inbound email:', {
      from: fromEmail,
      to: toEmail,
      subject: subject?.substring(0, 50),
    });

    // Parse the "to" address to extract invoice_id or debtor_id
    let invoiceId: string | null = null;
    let debtorId: string | null = null;
    let routedTo: 'invoice' | 'debtor' | 'generic' = 'generic';

    // Extract local part (before @)
    const atIndex = toEmail.indexOf('@');
    const localPart = atIndex > 0 ? toEmail.substring(0, atIndex) : toEmail;

    // Pattern: invoice+<uuid>@inbound.services.recouply.ai
    if (localPart.startsWith('invoice+')) {
      const extractedId = localPart.substring('invoice+'.length);
      console.log('Extracted potential invoice_id:', extractedId);
      
      if (UUID_REGEX.test(extractedId)) {
        invoiceId = extractedId;
        routedTo = 'invoice';
        console.log('Valid invoice_id:', invoiceId);
        
        // Look up the invoice to get debtor_id for context
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('debtor_id')
          .eq('id', invoiceId)
          .single();

        if (invoice && !invoiceError) {
          debtorId = invoice.debtor_id;
          console.log('Found associated debtor_id:', debtorId);
        } else {
          console.warn('Invoice not found or error:', invoiceError?.message);
        }
      } else {
        console.warn('Invalid UUID format for invoice_id:', extractedId);
      }
    }
    // Pattern: debtor+<uuid>@inbound.services.recouply.ai
    else if (localPart.startsWith('debtor+')) {
      const extractedId = localPart.substring('debtor+'.length);
      console.log('Extracted potential debtor_id:', extractedId);
      
      if (UUID_REGEX.test(extractedId)) {
        debtorId = extractedId;
        routedTo = 'debtor';
        console.log('Valid debtor_id:', debtorId);
      } else {
        console.warn('Invalid UUID format for debtor_id:', extractedId);
      }
    }
    // Generic inbound (e.g., support@inbound.services.recouply.ai)
    else {
      console.log('Generic inbound email, no invoice/debtor routing');
    }

    // Insert into messages table
    const messageData = {
      type: 'inbound' as const,
      invoice_id: invoiceId,
      debtor_id: debtorId,
      user_id: null, // Inbound emails don't have an authenticated user
      from_email: fromEmail,
      to_email: toEmail,
      subject: subject,
      html_body: htmlBody,
      text_body: textBody,
      raw_body: rawBody,
      attachments: attachments,
    };

    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert([messageData])
      .select('id')
      .single();

    if (insertError || !message) {
      console.error('Error inserting message:', insertError?.message);
      return new Response(JSON.stringify({ error: 'Failed to store message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Message stored with id:', message.id);

    // Fire-and-forget: Call internal AI processing
    try {
      console.log('Triggering AI processing for message:', message.id);
      const aiResponse = await supabase.functions.invoke('process-inbound-ai', {
        body: { message_id: message.id },
      });
      
      if (aiResponse.error) {
        console.error('AI processing returned error:', aiResponse.error);
      } else {
        console.log('AI processing triggered successfully');
      }
    } catch (aiError) {
      // Log but don't fail the webhook - fire and forget
      console.error('Error triggering AI processing:', aiError);
    }

    // Success response
    return new Response(JSON.stringify({
      status: 'ok',
      message_id: message.id,
      routed_to: routedTo,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing inbound email:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
