// ⚠️ EMAIL WEBHOOK - RESEND DELIVERY EVENTS
// This function processes email delivery events from Resend.
// Creates user_alerts for bounces/complaints and updates debtor email status.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

interface DebtorData {
  id: string;
  user_id: string;
  company_name: string | null;
  name: string | null;
  email_bounce_count: number | null;
  organization_id: string | null;
}

interface InvoiceData {
  id: string;
  invoice_number: string | null;
}

interface ContactData {
  debtor_id: string;
}

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
    const { type: eventType, data } = payload;
    const emailId = data?.email_id;
    const recipientEmail = Array.isArray(data?.to) ? data.to[0] : data?.to;

    console.log(`[RESEND-WEBHOOK] Event: ${eventType}, Email ID: ${emailId}, Recipient: ${recipientEmail}`);

    if (!emailId) {
      console.log('[RESEND-WEBHOOK] No email_id in payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update outreach_log with delivery status
    let updateData: Record<string, unknown> = {};
    
    switch (eventType) {
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
        console.log(`[RESEND-WEBHOOK] Unhandled event type: ${eventType}`);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Update outreach_log record
    const { error: updateError } = await supabase
      .from('outreach_logs')
      .update(updateData)
      .eq('resend_id', emailId);

    if (updateError) {
      console.error('[RESEND-WEBHOOK] Failed to update outreach_logs:', updateError);
    } else {
      console.log(`[RESEND-WEBHOOK] Updated outreach_logs for ${emailId}`);
    }

    // Also update email_activity_log if exists
    const activityUpdateData: Record<string, unknown> = {};
    if (eventType === 'email.delivered') {
      activityUpdateData.status = 'delivered';
      activityUpdateData.delivered_at = new Date().toISOString();
    } else if (eventType === 'email.opened') {
      activityUpdateData.status = 'opened';
      activityUpdateData.opened_at = new Date().toISOString();
    } else if (eventType === 'email.clicked') {
      activityUpdateData.status = 'clicked';
      activityUpdateData.clicked_at = new Date().toISOString();
    } else if (eventType === 'email.bounced') {
      activityUpdateData.status = 'bounced';
      activityUpdateData.failed_at = new Date().toISOString();
      activityUpdateData.failure_reason = data?.bounce?.message || 'Email bounced';
    } else if (eventType === 'email.complained') {
      activityUpdateData.status = 'complained';
      activityUpdateData.failed_at = new Date().toISOString();
      activityUpdateData.failure_reason = 'Marked as spam';
    }

    if (Object.keys(activityUpdateData).length > 0) {
      await supabase
        .from('email_activity_log')
        .update(activityUpdateData)
        .eq('resend_email_id', emailId);
    }

    // For bounces and complaints, find debtor and create alerts
    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      await handleEmailFailure(supabase, eventType, data, recipientEmail);
    }

    // For successful delivery, mark debtor email as valid
    if (eventType === 'email.delivered' && recipientEmail) {
      await markEmailValid(supabase, recipientEmail);
    }

    return new Response(JSON.stringify({ received: true, event: eventType }), {
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

async function markEmailValid(supabase: SupabaseClient, email: string) {
  try {
    // Find debtor by email
    const { data: debtor } = await supabase
      .from('debtors')
      .select('id, email_status')
      .eq('email', email)
      .single();

    if (debtor && (debtor as { email_status: string }).email_status !== 'valid') {
      await supabase
        .from('debtors')
        .update({ 
          email_status: 'valid',
          email_status_updated_at: new Date().toISOString()
        })
        .eq('id', (debtor as { id: string }).id);
      console.log(`[RESEND-WEBHOOK] Marked email as valid for debtor ${(debtor as { id: string }).id}`);
    }

    // Also check contacts table
    const { data: contact } = await supabase
      .from('contacts')
      .select('debtor_id')
      .eq('email', email)
      .limit(1)
      .single();

    if (contact) {
      await supabase
        .from('debtors')
        .update({ 
          email_status: 'valid',
          email_status_updated_at: new Date().toISOString()
        })
        .eq('id', (contact as ContactData).debtor_id);
    }
  } catch (err) {
    console.error('[RESEND-WEBHOOK] Error marking email valid:', err);
  }
}

async function handleEmailFailure(
  supabase: SupabaseClient,
  eventType: string,
  data: Record<string, unknown>,
  recipientEmail: string
) {
  try {
    // Find debtor by email
    let debtor: DebtorData | null = null;
    
    // First check debtors table
    const { data: directDebtor } = await supabase
      .from('debtors')
      .select('id, user_id, company_name, name, email_bounce_count, organization_id')
      .eq('email', recipientEmail)
      .single();

    if (directDebtor) {
      debtor = directDebtor as DebtorData;
    } else {
      // Check contacts table
      const { data: contact } = await supabase
        .from('contacts')
        .select('debtor_id')
        .eq('email', recipientEmail)
        .limit(1)
        .single();

      if (contact) {
        const { data: contactDebtor } = await supabase
          .from('debtors')
          .select('id, user_id, company_name, name, email_bounce_count, organization_id')
          .eq('id', (contact as ContactData).debtor_id)
          .single();
        debtor = contactDebtor as DebtorData;
      }
    }

    if (!debtor) {
      console.log(`[RESEND-WEBHOOK] No debtor found for email ${recipientEmail}`);
      return;
    }

    const debtorName = debtor.company_name || debtor.name || 'Unknown';
    const bounceData = data.bounce as Record<string, unknown> | undefined;
    const bounceType = (bounceData?.type as string) || 'hard';
    const bounceReason = (bounceData?.message as string) || 'Email address not found';

    if (eventType === 'email.bounced') {
      // Update debtor email status
      await supabase
        .from('debtors')
        .update({ 
          email_status: 'bounced',
          email_status_updated_at: new Date().toISOString(),
          email_bounce_count: (debtor.email_bounce_count || 0) + 1,
          last_bounce_reason: bounceReason
        })
        .eq('id', debtor.id);

      // Find and pause outreach for this debtor's open invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('debtor_id', debtor.id)
        .eq('status', 'Open');

      const invoiceList = (invoices || []) as InvoiceData[];

      if (invoiceList.length > 0) {
        const invoiceIds = invoiceList.map(i => i.id);
        await supabase
          .from('invoice_outreach')
          .update({ 
            is_active: false,
            paused_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .in('invoice_id', invoiceIds);
        console.log(`[RESEND-WEBHOOK] Paused outreach for ${invoiceIds.length} invoices`);
      }

      // Create user alert
      await supabase
        .from('user_alerts')
        .insert({
          user_id: debtor.user_id,
          organization_id: debtor.organization_id,
          alert_type: 'email_bounced',
          severity: bounceType === 'hard' ? 'error' : 'warning',
          title: `📧 Email Bounced: ${debtorName}`,
          message: `Email to ${recipientEmail} bounced: ${bounceReason}. Outreach paused until email is fixed.`,
          invoice_id: invoiceList[0]?.id || null,
          debtor_id: debtor.id,
          action_url: `/debtors/${debtor.id}`,
          action_label: 'Update Email',
          metadata: { 
            recipient_email: recipientEmail, 
            bounce_reason: bounceReason,
            bounce_type: bounceType
          }
        });

      console.log(`[RESEND-WEBHOOK] Created bounce alert for user ${debtor.user_id}`);

    } else if (eventType === 'email.complained') {
      // Update debtor - they marked as spam
      await supabase
        .from('debtors')
        .update({ 
          email_status: 'complained',
          email_status_updated_at: new Date().toISOString()
        })
        .eq('id', debtor.id);

      // Pause ALL outreach for this debtor
      const { data: allInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('debtor_id', debtor.id);

      const allInvoiceList = (allInvoices || []) as { id: string }[];

      if (allInvoiceList.length > 0) {
        await supabase
          .from('invoice_outreach')
          .update({ 
            is_active: false, 
            paused_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .in('invoice_id', allInvoiceList.map(i => i.id));
      }

      // Also pause at debtor level
      await supabase
        .from('debtors')
        .update({ outreach_enabled: false })
        .eq('id', debtor.id);

      // Create user alert
      await supabase
        .from('user_alerts')
        .insert({
          user_id: debtor.user_id,
          organization_id: debtor.organization_id,
          alert_type: 'email_complained',
          severity: 'error',
          title: `⚠️ Spam Complaint: ${debtorName}`,
          message: `${debtorName} marked your email as spam. All outreach stopped to protect sender reputation.`,
          debtor_id: debtor.id,
          action_url: `/debtors/${debtor.id}`,
          action_label: 'View Account'
        });

      console.log(`[RESEND-WEBHOOK] Created spam complaint alert for user ${debtor.user_id}`);
    }

  } catch (err) {
    console.error('[RESEND-WEBHOOK] Error handling email failure:', err);
  }
}
