import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getPersonaToneByDaysPastDue } from '../_shared/personaTones.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto-generate-collection-drafts scheduler...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all Open or InPaymentPlan invoices with debtor info
    // Skip invoices or accounts with outreach_paused = true
    const { data: invoices, error: invoicesError } = await supabaseAdmin
      .from('invoices')
      .select(`
        id,
        invoice_number,
        amount,
        currency,
        due_date,
        status,
        user_id,
        debtor_id,
        aging_bucket,
        bucket_entered_at,
        outreach_paused,
        use_custom_template,
        custom_template_subject,
        custom_template_body,
        debtors(
          id,
          name,
          company_name,
          outreach_paused,
          account_outreach_enabled
        )
      `)
      .in('status', ['Open', 'InPaymentPlan'])
      .eq('outreach_paused', false);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    console.log(`Found ${invoices?.length || 0} active invoices`);

    let draftsCreated = 0;
    let skipped = 0;

    for (const invoice of invoices || []) {
      try {
        // Skip if the account has outreach paused
        const debtor = Array.isArray(invoice.debtors) ? invoice.debtors[0] : invoice.debtors;
        if (debtor?.outreach_paused) {
          console.log(`Skipping invoice ${invoice.invoice_number}: account outreach is paused`);
          skipped++;
          continue;
        }

        // Skip if account-level outreach is enabled (invoice workflows are bypassed)
        if (debtor?.account_outreach_enabled) {
          console.log(`Skipping invoice ${invoice.invoice_number}: account-level outreach is enabled, individual invoice workflows bypassed`);
          skipped++;
          continue;
        }

        // Calculate days past due
        const dueDate = new Date(invoice.due_date);
        const daysPastDue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Determine aging bucket - use >= for inclusive boundaries matching persona configs
        let agingBucket = 'current';
        if (daysPastDue >= 151) {
          agingBucket = 'dpd_150_plus';
        } else if (daysPastDue >= 121) {
          agingBucket = 'dpd_121_150';
        } else if (daysPastDue >= 91) {
          agingBucket = 'dpd_91_120';
        } else if (daysPastDue >= 61) {
          agingBucket = 'dpd_61_90';
        } else if (daysPastDue >= 31) {
          agingBucket = 'dpd_31_60';
        } else if (daysPastDue >= 1) {
          agingBucket = 'dpd_1_30';
        }

        console.log(`Processing invoice ${invoice.invoice_number}: ${daysPastDue} days past due, bucket: ${agingBucket}`);

        // Skip current invoices (not past due yet)
        if (agingBucket === 'current') {
          console.log(`Skipping invoice ${invoice.invoice_number}: not past due`);
          skipped++;
          continue;
        }

        // Get active workflow for this aging bucket
        const { data: workflow } = await supabaseAdmin
          .from('collection_workflows')
          .select(`
            *,
            steps:collection_workflow_steps(*)
          `)
          .eq('aging_bucket', agingBucket)
          .or(`user_id.eq.${invoice.user_id},user_id.is.null`)
          .eq('is_active', true)
          .order('user_id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!workflow || !workflow.steps) {
          console.log(`No active workflow found for bucket ${agingBucket}`);
          skipped++;
          continue;
        }

        // FIXED LOGIC: Find steps that should have been triggered (day_offset <= daysPastDue)
        // This creates catch-up drafts for missed steps
        const activeSteps = workflow.steps
          .filter((s: any) => s.is_active && s.day_offset <= daysPastDue)
          .sort((a: any, b: any) => a.step_order - b.step_order);

        if (activeSteps.length === 0) {
          console.log(`No workflow steps applicable for ${daysPastDue} days past due`);
          continue;
        }

        // Get existing drafts and activities for this invoice to avoid duplicates
        const { data: existingDrafts } = await supabaseAdmin
          .from('ai_drafts')
          .select('workflow_step_id')
          .eq('invoice_id', invoice.id);

        const existingStepIds = new Set((existingDrafts || []).map((d: any) => d.workflow_step_id));

        // Get existing outbound activities count
        const { count: existingOutreachCount } = await supabaseAdmin
          .from('collection_activities')
          .select('id', { count: 'exact' })
          .eq('invoice_id', invoice.id)
          .eq('direction', 'outbound');

        // Find the next step that hasn't been done yet
        const pendingSteps = activeSteps.filter((s: any) => !existingStepIds.has(s.id));
        
        // Only create one draft at a time (the next pending step)
        const nextStep = pendingSteps[0];
        
        if (!nextStep) {
          console.log(`All applicable steps already have drafts for invoice ${invoice.invoice_number}`);
          continue;
        }

        // Skip SMS drafts if Twilio is not configured
        if (nextStep.channel === 'sms') {
          const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('twilio_account_sid, twilio_auth_token, twilio_from_number')
            .eq('id', invoice.user_id)
            .single();

          if (!userProfile?.twilio_account_sid || !userProfile?.twilio_auth_token || !userProfile?.twilio_from_number) {
            console.log(`Skipping SMS draft for invoice ${invoice.id} - Twilio not configured`);
            continue;
          }
        }

        // Get branding settings
        const { data: branding } = await supabaseAdmin
          .from('branding_settings')
          .select('*')
          .eq('user_id', invoice.user_id)
          .maybeSingle();

        // Fetch primary contact from debtor_contacts (source of truth for contact names)
        let debtorName = 'Customer';
        let companyName = debtor?.company_name || debtor?.name || 'Customer';
        
        if (debtor?.id) {
          const { data: contacts } = await supabaseAdmin
            .from('debtor_contacts')
            .select('name, is_primary, outreach_enabled')
            .eq('debtor_id', debtor.id)
            .eq('outreach_enabled', true)
            .order('is_primary', { ascending: false });
          
          if (contacts && contacts.length > 0) {
            const primaryContact = contacts.find((c: any) => c.is_primary);
            debtorName = primaryContact?.name || contacts[0]?.name || companyName;
            console.log(`Using contact name from debtor_contacts: ${debtorName}`);
          } else {
            debtorName = companyName;
            console.log(`No outreach-enabled contacts, using company name: ${debtorName}`);
          }
        } else {
          debtorName = companyName;
        }

        // Build context
        const businessName = branding?.business_name || 'Your Company';
        const fromName = branding?.from_name || businessName;

        // Get persona-specific tone based on days past due
        const persona = getPersonaToneByDaysPastDue(daysPastDue);
        const personaGuidelines = persona?.systemPromptGuidelines || '';
        const personaName = persona?.name || 'Collections Agent';

        // PRIORITY: Check for invoice-level custom template override first
        let subjectTemplate: string;
        let bodyTemplate: string;
        let templateSource: string;

        if (invoice.use_custom_template && invoice.custom_template_body) {
          // Use invoice-level custom override
          subjectTemplate = invoice.custom_template_subject || `Invoice ${invoice.invoice_number} - Payment Reminder`;
          bodyTemplate = invoice.custom_template_body;
          templateSource = 'invoice-level override';
          console.log(`Using invoice-level custom template for ${invoice.invoice_number}`);
        } else {
          // Look for approved draft template matching this workflow step
          const { data: approvedTemplate } = await supabaseAdmin
            .from('draft_templates')
            .select('*')
            .eq('workflow_step_id', nextStep.id)
            .eq('user_id', invoice.user_id)
            .eq('status', 'approved')
            .maybeSingle();

          if (approvedTemplate) {
            // Use the approved draft template
            subjectTemplate = approvedTemplate.subject_template || nextStep.subject_template || `Invoice ${invoice.invoice_number} - Payment Reminder`;
            bodyTemplate = approvedTemplate.message_body_template;
            templateSource = `approved template (ID: ${approvedTemplate.id})`;
            console.log(`Using approved draft template for step ${nextStep.step_order}: ${approvedTemplate.id}`);
          } else {
            // Fallback: Check for any approved template for this aging bucket and user
            const { data: bucketTemplate } = await supabaseAdmin
              .from('draft_templates')
              .select('*')
              .eq('aging_bucket', agingBucket)
              .eq('user_id', invoice.user_id)
              .eq('status', 'approved')
              .eq('step_number', nextStep.step_order)
              .maybeSingle();

            if (bucketTemplate) {
              subjectTemplate = bucketTemplate.subject_template || nextStep.subject_template || `Invoice ${invoice.invoice_number} - Payment Reminder`;
              bodyTemplate = bucketTemplate.message_body_template;
              templateSource = `approved bucket template (ID: ${bucketTemplate.id})`;
              console.log(`Using approved bucket template for ${agingBucket} step ${nextStep.step_order}`);
            } else {
              // No approved template found - skip this invoice (require approved templates)
              console.log(`No approved template found for invoice ${invoice.invoice_number}, bucket ${agingBucket}, step ${nextStep.step_order}. Skipping - approved templates required.`);
              skipped++;
              continue;
            }
          }
        }

        // Replace template variables
        const templateVars: Record<string, string> = {
          '{{debtor_name}}': debtorName,
          '{{company_name}}': companyName,
          '{{invoice_number}}': invoice.invoice_number,
          '{{amount}}': invoice.amount?.toString() || '0',
          '{{currency}}': invoice.currency || 'USD',
          '{{due_date}}': invoice.due_date,
          '{{days_past_due}}': daysPastDue.toString(),
          '{{business_name}}': businessName,
          '{{from_name}}': fromName,
        };

        let processedBody = bodyTemplate;
        let processedSubject = subjectTemplate;
        
        for (const [key, value] of Object.entries(templateVars)) {
          processedBody = processedBody.replace(new RegExp(key, 'g'), value);
          processedSubject = processedSubject.replace(new RegExp(key, 'g'), value);
        }

        // Add signature if available
        if (branding?.email_signature) {
          processedBody += `\n\n${branding.email_signature}`;
        }

        // Calculate recommended send date based on due date + step day_offset
        const stepTriggerDate = new Date(dueDate);
        stepTriggerDate.setDate(stepTriggerDate.getDate() + nextStep.day_offset);
        const recommendedSendDate = stepTriggerDate > today ? stepTriggerDate : today;

        // Get agent persona ID
        const { data: agentPersona } = await supabaseAdmin
          .from('ai_agent_personas')
          .select('id')
          .lte('bucket_min', daysPastDue === 0 ? 1 : daysPastDue)
          .or(`bucket_max.is.null,bucket_max.gte.${daysPastDue === 0 ? 1 : daysPastDue}`)
          .order('bucket_min', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Create draft in database using the approved template
        const { error: draftError } = await supabaseAdmin
          .from('ai_drafts')
          .insert({
            user_id: invoice.user_id,
            invoice_id: invoice.id,
            workflow_step_id: nextStep.id,
            agent_persona_id: agentPersona?.id || null,
            channel: nextStep.channel,
            step_number: nextStep.step_order,
            subject: processedSubject,
            message_body: processedBody,
            status: 'pending_approval',
            recommended_send_date: recommendedSendDate.toISOString().split('T')[0],
            days_past_due: daysPastDue,
          });

        if (draftError) {
          console.error(`Error creating draft for invoice ${invoice.id}:`, draftError);
        } else {
          console.log(`✓ Created draft for invoice ${invoice.invoice_number}, step ${nextStep.step_order} (${nextStep.label}) using ${templateSource}`);
          draftsCreated++;
        }

      } catch (error) {
        console.error(`Error processing invoice ${invoice.id}:`, error);
        skipped++;
      }
    }

    console.log(`Scheduler completed: ${draftsCreated} drafts created, ${skipped} invoices skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        draftsCreated,
        skipped,
        message: `Processed ${invoices?.length || 0} invoices, created ${draftsCreated} drafts`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in auto-generate-collection-drafts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
