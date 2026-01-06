// ⚠️ EMAIL DOMAIN WARNING ⚠️
// This function sends emails via Resend.
// The FROM email MUST use verified domain: send.inbound.services.recouply.ai
// DO NOT change to @recouply.ai - it will fail!
// See: supabase/functions/_shared/emailConfig.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { VERIFIED_EMAIL_DOMAIN, getVerifiedFromAddress } from "../_shared/emailConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET_CONFIG: Record<string, { min: number; max: number; agent: string }> = {
  'dpd_1_30': { min: 1, max: 30, agent: 'Sam' },
  'dpd_31_60': { min: 31, max: 60, agent: 'James' },
  'dpd_61_90': { min: 61, max: 90, agent: 'Katy' },
  'dpd_91_120': { min: 91, max: 120, agent: 'Jimmy' },
  'dpd_121_150': { min: 121, max: 150, agent: 'Troy' },
  'dpd_150_plus': { min: 151, max: 9999, agent: 'Rocco' },
};

function getBucketForDays(daysPastDue: number): string {
  if (daysPastDue >= 1 && daysPastDue <= 30) return 'dpd_1_30';
  if (daysPastDue >= 31 && daysPastDue <= 60) return 'dpd_31_60';
  if (daysPastDue >= 61 && daysPastDue <= 90) return 'dpd_61_90';
  if (daysPastDue >= 91 && daysPastDue <= 120) return 'dpd_91_120';
  if (daysPastDue >= 121 && daysPastDue <= 150) return 'dpd_121_150';
  return 'dpd_150_plus';
}

function getStepForDaysInBucket(daysInBucket: number): number | null {
  if (daysInBucket === 0) return 1;
  if (daysInBucket === 7) return 2;
  if (daysInBucket === 14) return 3;
  return null; // Not a send day
}

function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const results = {
    invoices_processed: 0,
    emails_sent: 0,
    bucket_transitions: 0,
    new_outreach_started: 0,
    errors: [] as string[],
  };

  try {
    console.log(`[OUTREACH] Starting daily outreach processing for ${todayStr}`);

    // 1. Get ALL past-due Open invoices with debtor info
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, amount, amount_outstanding, due_date, 
        user_id, debtor_id, integration_url, organization_id,
        debtors!inner(id, name, email, company_name)
      `)
      .eq('status', 'Open')
      .lt('due_date', todayStr);

    if (invoicesError) {
      console.error('[OUTREACH] Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    if (!invoices || invoices.length === 0) {
      console.log('[OUTREACH] No past-due invoices to process');
      return new Response(JSON.stringify({ 
        message: 'No past-due invoices to process',
        ...results 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[OUTREACH] Processing ${invoices.length} past-due invoices`);

    for (const invoice of invoices) {
      try {
        results.invoices_processed++;

        const debtorData = invoice.debtors as any;
        const debtor = { 
          id: debtorData?.id || '', 
          name: debtorData?.name || '', 
          email: debtorData?.email || '', 
          company_name: debtorData?.company_name || '' 
        };
        if (!debtor?.email) {
          results.errors.push(`Invoice ${invoice.invoice_number}: No debtor email`);
          continue;
        }

        // Calculate days past due
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysPastDue < 1) continue; // Not past due yet

        const currentBucket = getBucketForDays(daysPastDue);
        const agentName = BUCKET_CONFIG[currentBucket].agent;

        // 2. Get or create invoice_outreach record
        let { data: outreach, error: outreachError } = await supabase
          .from('invoice_outreach')
          .select('*')
          .eq('invoice_id', invoice.id)
          .maybeSingle();

        if (outreachError) {
          console.error(`[OUTREACH] Error fetching outreach for ${invoice.invoice_number}:`, outreachError);
          results.errors.push(`Invoice ${invoice.invoice_number}: Error fetching outreach`);
          continue;
        }

        if (!outreach) {
          // NEW: Invoice just became past due - create tracking record
          const { data: newOutreach, error: createError } = await supabase
            .from('invoice_outreach')
            .insert({
              invoice_id: invoice.id,
              user_id: invoice.user_id,
              current_bucket: currentBucket,
              bucket_entered_at: todayStr,
              is_active: true
            })
            .select()
            .single();

          if (createError) {
            console.error(`[OUTREACH] Error creating outreach for ${invoice.invoice_number}:`, createError);
            results.errors.push(`Invoice ${invoice.invoice_number}: Error creating outreach`);
            continue;
          }
          outreach = newOutreach;
          results.new_outreach_started++;
          console.log(`[OUTREACH] Created outreach tracking for invoice ${invoice.invoice_number} - ${agentName}`);
        } else if (outreach.current_bucket !== currentBucket) {
          // BUCKET TRANSITION: Invoice aged to new bucket
          const { error: updateError } = await supabase
            .from('invoice_outreach')
            .update({
              current_bucket: currentBucket,
              bucket_entered_at: todayStr,
              step_1_sent_at: null,
              step_2_sent_at: null,
              step_3_sent_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', outreach.id);

          if (updateError) {
            console.error(`[OUTREACH] Error updating bucket for ${invoice.invoice_number}:`, updateError);
            results.errors.push(`Invoice ${invoice.invoice_number}: Error updating bucket`);
            continue;
          }
          
          outreach.current_bucket = currentBucket;
          outreach.bucket_entered_at = todayStr;
          outreach.step_1_sent_at = null;
          outreach.step_2_sent_at = null;
          outreach.step_3_sent_at = null;
          
          results.bucket_transitions++;
          console.log(`[OUTREACH] Invoice ${invoice.invoice_number} transitioned to ${currentBucket} (${agentName})`);
        }

        // Skip if outreach is paused or completed
        if (!outreach.is_active) {
          console.log(`[OUTREACH] Skipping ${invoice.invoice_number} - outreach inactive`);
          continue;
        }

        // 3. Calculate days in current bucket
        const bucketEnteredDate = new Date(outreach.bucket_entered_at);
        bucketEnteredDate.setHours(0, 0, 0, 0);
        const daysInBucket = Math.floor((today.getTime() - bucketEnteredDate.getTime()) / (1000 * 60 * 60 * 24));

        // 4. Determine if email should be sent today
        const stepToSend = getStepForDaysInBucket(daysInBucket);
        if (stepToSend === null) {
          // Not a send day (not 0, 7, or 14)
          continue;
        }

        // Check if this step was already sent
        const stepField = `step_${stepToSend}_sent_at` as keyof typeof outreach;
        if (outreach[stepField]) {
          // Already sent this step
          continue;
        }

        console.log(`[OUTREACH] Invoice ${invoice.invoice_number}: Day ${daysInBucket} in ${currentBucket}, sending step ${stepToSend}`);

        // 5. Get template for this user/bucket/step
        let { data: template, error: templateError } = await supabase
          .from('outreach_templates')
          .select('*')
          .eq('user_id', invoice.user_id)
          .eq('aging_bucket', currentBucket)
          .eq('step_number', stepToSend)
          .eq('is_active', true)
          .maybeSingle();

        if (templateError) {
          console.error(`[OUTREACH] Error fetching template:`, templateError);
        }

        if (!template) {
          // Create default templates if missing
          console.log(`[OUTREACH] No templates found for user ${invoice.user_id}, creating defaults...`);
          const { error: rpcError } = await supabase.rpc('create_default_outreach_templates', { 
            p_user_id: invoice.user_id 
          });
          
          if (rpcError) {
            console.error(`[OUTREACH] Error creating default templates:`, rpcError);
            results.errors.push(`Invoice ${invoice.invoice_number}: Error creating templates`);
            continue;
          }
          
          // Retry getting template
          const { data: retryTemplate, error: retryError } = await supabase
            .from('outreach_templates')
            .select('*')
            .eq('user_id', invoice.user_id)
            .eq('aging_bucket', currentBucket)
            .eq('step_number', stepToSend)
            .eq('is_active', true)
            .maybeSingle();
          
          if (retryError || !retryTemplate) {
            console.error(`[OUTREACH] Still no template after creation:`, retryError);
            results.errors.push(`Invoice ${invoice.invoice_number}: No template for ${currentBucket} step ${stepToSend}`);
            continue;
          }
          template = retryTemplate;
        }

        // 6. Prepare email content with variable replacement
        const amountDue = invoice.amount_outstanding || invoice.amount || 0;
        const templateVars: Record<string, string> = {
          debtor_name: debtor.name || debtor.company_name || 'Valued Customer',
          company_name: debtor.company_name || debtor.name || '',
          invoice_number: invoice.invoice_number || '',
          amount_due: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountDue),
          due_date: new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          days_overdue: daysPastDue.toString(),
          invoice_link: invoice.integration_url ? `\n\nView Invoice: ${invoice.integration_url}` : '',
        };

        const subject = replaceTemplateVars(template.subject_template, templateVars);
        const body = replaceTemplateVars(template.body_template, templateVars);

        // 7. Send email via Resend
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (!resendKey) {
          console.error('[OUTREACH] RESEND_API_KEY not configured');
          results.errors.push('RESEND_API_KEY not configured');
          continue;
        }

        // Get branding for from email
        const { data: branding } = await supabase
          .from('branding_settings')
          .select('from_email, from_name, business_name')
          .eq('user_id', invoice.user_id)
          .maybeSingle();

        // IMPORTANT: Use verified Resend domain from shared config
        const fromName = branding?.from_name || branding?.business_name || 'Recouply';
        const fromEmail = getVerifiedFromAddress(fromName, 'collections');

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: debtor.email,
            subject: subject,
            text: body,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`[OUTREACH] Email failed for ${invoice.invoice_number}:`, errorText);
          
          // Log the failed attempt
          await supabase
            .from('outreach_log')
            .insert({
              invoice_id: invoice.id,
              user_id: invoice.user_id,
              agent_name: agentName,
              aging_bucket: currentBucket,
              step_number: stepToSend,
              cadence_day: stepToSend === 1 ? 0 : (stepToSend === 2 ? 7 : 14),
              subject: subject,
              body: body,
              recipient_email: debtor.email,
              status: 'failed',
              error_message: errorText,
              invoice_link: invoice.integration_url
            });
          
          results.errors.push(`Invoice ${invoice.invoice_number}: Email failed - ${errorText.substring(0, 100)}`);
          continue;
        }

        // Parse response to get Resend email ID
        const emailResult = await emailResponse.json();
        const resendId = emailResult.id;
        console.log(`[OUTREACH] Resend ID: ${resendId}`);

        // 8. Update invoice_outreach with sent timestamp
        const { error: updateOutreachError } = await supabase
          .from('invoice_outreach')
          .update({
            [stepField]: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', outreach.id);

        if (updateOutreachError) {
          console.error(`[OUTREACH] Error updating outreach record:`, updateOutreachError);
          results.errors.push(`Invoice ${invoice.invoice_number}: Failed to update outreach record`);
        }

        // 9. Log to outreach_log for audit trail (with resend_id for webhook tracking)
        const { error: logError } = await supabase
          .from('outreach_log')
          .insert({
            invoice_id: invoice.id,
            user_id: invoice.user_id,
            agent_name: agentName,
            aging_bucket: currentBucket,
            step_number: stepToSend,
            cadence_day: stepToSend === 1 ? 0 : (stepToSend === 2 ? 7 : 14),
            subject: subject,
            body: body,
            recipient_email: debtor.email,
            status: 'sent',
            resend_id: resendId,
            invoice_link: invoice.integration_url
          });

        if (logError) {
          console.error(`[OUTREACH] Error logging outreach:`, logError);
        }

        // 10. Also log to email_activity_log for the Email Delivery Report
        await supabase
          .from('email_activity_log')
          .insert({
            user_id: invoice.user_id,
            organization_id: invoice.organization_id,
            debtor_id: invoice.debtor_id,
            invoice_id: invoice.id,
            recipient_email: debtor.email,
            subject: subject,
            agent_name: agentName,
            template_type: currentBucket,
            status: 'sent',
            resend_email_id: resendId,
            sent_at: new Date().toISOString()
          });

        results.emails_sent++;
        console.log(`[OUTREACH] ✅ Sent ${agentName} Step ${stepToSend} to ${debtor.email} for invoice ${invoice.invoice_number}`);

      } catch (invoiceError: any) {
        console.error(`[OUTREACH] Error processing invoice ${invoice.invoice_number}:`, invoiceError);
        results.errors.push(`Invoice ${invoice.invoice_number}: ${invoiceError.message}`);
      }
    }

    console.log(`[OUTREACH] Complete: ${results.emails_sent} emails sent, ${results.bucket_transitions} transitions, ${results.new_outreach_started} new outreach started`);

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[OUTREACH] Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      ...results 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
