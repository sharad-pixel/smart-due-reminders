import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResendInboundEmail {
  from: string[];
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  raw?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    content_type: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the inbound email payload
    const payload: ResendInboundEmail = await req.json();
    console.log('Received inbound email:', JSON.stringify(payload, null, 2));

    const fromEmail = payload.from?.[0] || '';
    const toEmail = payload.to?.[0] || '';
    const subject = payload.subject || '';
    const htmlBody = payload.html || null;
    const textBody = payload.text || null;
    const rawBody = payload.raw || null;
    const attachments = payload.attachments || [];

    // Parse the to address to extract invoice_id or debtor_id
    let invoiceId: string | null = null;
    let debtorId: string | null = null;
    let userId: string | null = null;

    // Pattern: invoice+<uuid>@inbound.services.recouply.ai
    const invoiceMatch = toEmail.match(/^invoice\+([a-f0-9-]{36})@/i);
    if (invoiceMatch) {
      invoiceId = invoiceMatch[1];
      console.log('Extracted invoice_id:', invoiceId);

      // Look up the invoice to get user_id and debtor_id
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('user_id, debtor_id')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        userId = invoice.user_id;
        debtorId = invoice.debtor_id;
      } else {
        console.error('Invoice not found:', invoiceId, invoiceError);
      }
    }

    // Pattern: debtor+<uuid>@inbound.services.recouply.ai
    const debtorMatch = toEmail.match(/^debtor\+([a-f0-9-]{36})@/i);
    if (debtorMatch && !invoiceId) {
      debtorId = debtorMatch[1];
      console.log('Extracted debtor_id:', debtorId);

      // Look up the debtor to get user_id
      const { data: debtor, error: debtorError } = await supabase
        .from('debtors')
        .select('user_id')
        .eq('id', debtorId)
        .single();

      if (debtor) {
        userId = debtor.user_id;
      } else {
        console.error('Debtor not found:', debtorId, debtorError);
      }
    }

    // If we couldn't determine the user, try to match by sender email
    if (!userId) {
      console.log('No user_id found from to address, trying sender email match');
      
      // Try to find a debtor with matching email
      const { data: matchedDebtor } = await supabase
        .from('debtors')
        .select('id, user_id')
        .eq('email', fromEmail)
        .limit(1)
        .single();

      if (matchedDebtor) {
        userId = matchedDebtor.user_id;
        debtorId = matchedDebtor.id;
        console.log('Matched debtor by email:', debtorId);
      }
    }

    // If still no user_id, we cannot process
    if (!userId) {
      console.error('Could not determine user_id for inbound email');
      return new Response(JSON.stringify({ 
        status: 'error', 
        message: 'Could not determine recipient user' 
      }), {
        status: 200, // Return 200 to prevent Resend retries
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert into messages table
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        type: 'inbound',
        invoice_id: invoiceId,
        debtor_id: debtorId,
        user_id: userId,
        from_email: fromEmail,
        to_email: toEmail,
        subject: subject,
        html_body: htmlBody,
        text_body: textBody,
        raw_body: rawBody,
        attachments: attachments,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return new Response(JSON.stringify({ 
        status: 'error', 
        message: 'Failed to store message' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Message stored with id:', message.id);

    // Call internal AI processing route
    try {
      const aiResponse = await supabase.functions.invoke('process-inbound-ai', {
        body: { message_id: message.id },
      });
      console.log('AI processing response:', aiResponse);
    } catch (aiError) {
      console.error('Error calling AI processing:', aiError);
      // Don't fail the webhook if AI processing fails
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error processing inbound email:', error);
    return new Response(JSON.stringify({ 
      status: 'error', 
      message: error?.message || 'Unknown error'
    }), {
      status: 200, // Return 200 to prevent Resend retries
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
