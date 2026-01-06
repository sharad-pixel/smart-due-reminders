import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const payload = await req.json();
    console.log('[RESEND-WEBHOOK] Received event:', payload.type);

    const { type, data } = payload;
    const emailId = data?.email_id;

    if (!emailId) {
      console.log('[RESEND-WEBHOOK] No email_id in payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Map Resend event types to our status
    let updateData: Record<string, unknown> = {};
    
    switch (type) {
      case 'email.delivered':
        updateData = {
          status: 'delivered',
          delivered_at: new Date().toISOString()
        };
        console.log(`[RESEND-WEBHOOK] Email ${emailId} delivered`);
        break;

      case 'email.opened':
        updateData = {
          status: 'opened',
          opened_at: new Date().toISOString()
        };
        console.log(`[RESEND-WEBHOOK] Email ${emailId} opened`);
        break;

      case 'email.clicked':
        updateData = {
          status: 'clicked'
        };
        console.log(`[RESEND-WEBHOOK] Email ${emailId} clicked`);
        break;

      case 'email.bounced':
        updateData = {
          status: 'bounced',
          bounced_at: new Date().toISOString(),
          bounce_type: data?.bounce?.type || 'unknown',
          error_message: data?.bounce?.message || 'Email bounced'
        };
        console.log(`[RESEND-WEBHOOK] Email ${emailId} bounced: ${data?.bounce?.message}`);
        break;

      case 'email.complained':
        updateData = {
          status: 'complained',
          error_message: 'Recipient marked as spam'
        };
        console.log(`[RESEND-WEBHOOK] Email ${emailId} marked as spam`);
        break;

      default:
        console.log(`[RESEND-WEBHOOK] Unhandled event type: ${type}`);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Update the outreach_log record
    const { error } = await supabase
      .from('outreach_log')
      .update(updateData)
      .eq('resend_id', emailId);

    if (error) {
      console.error('[RESEND-WEBHOOK] Failed to update outreach_log:', error);
    } else {
      console.log(`[RESEND-WEBHOOK] Updated outreach_log for ${emailId}`);
    }

    return new Response(JSON.stringify({ received: true, updated: !error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RESEND-WEBHOOK] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
