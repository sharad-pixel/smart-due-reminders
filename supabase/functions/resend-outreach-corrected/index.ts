import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { 
  EMAIL_CONFIG, 
  INBOUND_EMAIL_DOMAIN,
  getInvoiceReplyToAddress 
} from "../_shared/emailConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendKey);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse optional parameters
    const { days_back = 3, dry_run = true } = await req.json().catch(() => ({}));

    console.log(`[RESEND-CORRECTED] Starting resend with days_back=${days_back}, dry_run=${dry_run}`);

    // Fetch recent outreach emails that may have had wrong reply-to
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days_back);

    // Only resend for invoices that are still OPEN (not paid/closed)
    const { data: outreachLogs, error: logsError } = await supabase
      .from('outreach_logs')
      .select(`
        id,
        invoice_id,
        debtor_id,
        channel,
        subject,
        message_body,
        sent_to,
        sent_at,
        user_id,
        invoices!inner (
          id,
          invoice_number,
          amount,
          total_amount,
          due_date,
          status
        ),
        debtors!inner (
          id,
          company_name,
          email
        )
      `)
      .eq('channel', 'email')
      .in('invoices.status', ['Open', 'Overdue', 'PartiallyPaid', 'InPaymentPlan'])
      .gte('sent_at', cutoffDate.toISOString())
      .order('sent_at', { ascending: false });

    if (logsError) {
      console.error('[RESEND-CORRECTED] Error fetching logs:', logsError);
      throw logsError;
    }

    console.log(`[RESEND-CORRECTED] Found ${outreachLogs?.length || 0} emails to resend`);

    const results = {
      total: outreachLogs?.length || 0,
      resent: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as any[]
    };

    for (const log of outreachLogs || []) {
      try {
        const recipientEmail = log.sent_to;
        if (!recipientEmail) {
          console.log(`[RESEND-CORRECTED] Skipping log ${log.id} - no recipient email`);
          results.skipped++;
          continue;
        }

        // Get branding settings for this user
        const { data: branding } = await supabase
          .from('branding_settings')
          .select('*')
          .eq('user_id', log.user_id)
          .maybeSingle();

        const businessName = branding?.business_name || 'Recouply';
        const fromAddress = `${businessName} <collections@send.inbound.services.recouply.ai>`;
        
        // CORRECT reply-to using the inbound domain
        const replyTo = log.invoice_id 
          ? getInvoiceReplyToAddress(log.invoice_id)
          : `collections@${INBOUND_EMAIL_DOMAIN}`;

        // Append a note that this is a resend with corrected reply address
        const correctedBody = `${log.message_body}

---
📧 Please reply directly to this email - we've updated our email system to ensure your responses reach us.`;

        const correctedSubject = log.subject;

        const detail = {
          log_id: log.id,
          to: recipientEmail,
          subject: correctedSubject,
          from: fromAddress,
          reply_to: replyTo,
          invoice_number: (log as any).invoices?.invoice_number,
          company: (log as any).debtors?.company_name
        };

        if (dry_run) {
          console.log(`[RESEND-CORRECTED] DRY RUN - Would resend to ${recipientEmail}:`, detail);
          results.details.push({ ...detail, status: 'dry_run' });
          results.resent++;
        } else {
          // Actually send the email
          const emailResult = await resend.emails.send({
            from: fromAddress,
            to: [recipientEmail],
            subject: correctedSubject,
            html: correctedBody.replace(/\n/g, '<br>'),
            reply_to: replyTo
          });

          const resendId = (emailResult as any)?.data?.id || (emailResult as any)?.id || 'unknown';

          // Log this resend
          await supabase.from('outreach_logs').insert({
            user_id: log.user_id,
            invoice_id: log.invoice_id,
            debtor_id: log.debtor_id,
            channel: 'email',
            subject: correctedSubject,
            message_body: correctedBody,
            sent_to: recipientEmail,
            sent_from: fromAddress,
            sent_at: new Date().toISOString(),
            status: 'sent',
            delivery_metadata: { 
              resend_id: resendId,
              is_correction_resend: true,
              original_log_id: log.id,
              corrected_reply_to: replyTo
            }
          });

          results.details.push({ ...detail, status: 'sent', resend_id: resendId });
          results.resent++;
        }
      } catch (emailError: any) {
        console.error(`[RESEND-CORRECTED] Error resending log ${log.id}:`, emailError);
        results.errors.push(`${log.id}: ${emailError.message}`);
      }
    }

    console.log(`[RESEND-CORRECTED] Complete. Resent: ${results.resent}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[RESEND-CORRECTED] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
