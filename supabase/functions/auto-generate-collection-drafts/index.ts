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
        debtors(
          id,
          name,
          company_name
        )
      `)
      .in('status', ['Open', 'InPaymentPlan']);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    console.log(`Found ${invoices?.length || 0} active invoices`);

    let draftsCreated = 0;
    let skipped = 0;

    for (const invoice of invoices || []) {
      try {
        // Calculate days past due
        const dueDate = new Date(invoice.due_date);
        const daysPastDue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Determine aging bucket
        let agingBucket = 'current';
        if (daysPastDue > 150) {
          agingBucket = 'dpd_150_plus';
        } else if (daysPastDue > 120) {
          agingBucket = 'dpd_121_150';
        } else if (daysPastDue > 90) {
          agingBucket = 'dpd_91_120';
        } else if (daysPastDue > 60) {
          agingBucket = 'dpd_61_90';
        } else if (daysPastDue > 30) {
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
        const debtor = Array.isArray(invoice.debtors) ? invoice.debtors[0] : invoice.debtors;
        let debtorName = 'Customer'; // Default fallback
        let companyName = debtor?.company_name || debtor?.name || 'Customer';
        
        if (debtor?.id) {
          const { data: contacts } = await supabaseAdmin
            .from('debtor_contacts')
            .select('name, is_primary, outreach_enabled')
            .eq('debtor_id', debtor.id)
            .eq('outreach_enabled', true)
            .order('is_primary', { ascending: false });
          
          if (contacts && contacts.length > 0) {
            // Use primary contact or first outreach-enabled contact (this is the source of truth)
            const primaryContact = contacts.find((c: any) => c.is_primary);
            debtorName = primaryContact?.name || contacts[0]?.name || companyName;
            console.log(`Using contact name from debtor_contacts: ${debtorName}`);
          } else {
            // No outreach-enabled contacts found, use company name
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
        
        const systemPrompt = `You are ${personaName}, drafting a professional collections message for ${businessName} to send to their customer about an overdue invoice.

${personaGuidelines}

CRITICAL COMPLIANCE RULES:
- Be respectful and non-threatening
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment or intimidation
- Write as if you are ${businessName}, NOT a third party
- Encourage the customer to pay or reply if there is a dispute or issue`;

        const userPrompt = nextStep.body_template || getDefaultTemplate(agingBucket);
        
        const contextualPrompt = `${userPrompt}

Context:
- Business: ${businessName}
- From: ${fromName}
- Customer: ${debtorName}
- Invoice Number: ${invoice.invoice_number}
- Amount: $${invoice.amount} ${invoice.currency || 'USD'}
- Original Due Date: ${invoice.due_date}
- Days Past Due: ${daysPastDue}
- Aging Bucket: ${agingBucket}
- This is outreach step ${nextStep.step_order} of ${activeSteps.length}

${branding?.email_signature ? `\nSignature block to include:\n${branding.email_signature}` : ''}`;

        // Generate draft using Lovable AI
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        console.log(`Generating AI draft for invoice ${invoice.invoice_number}, step ${nextStep.step_order}...`);
        
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
              { role: 'user', content: contextualPrompt }
            ],
            temperature: 0.7,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', aiResponse.status, errorText);
          continue;
        }

        const aiData = await aiResponse.json();
        const generatedContent = aiData.choices?.[0]?.message?.content || '';

        // Generate subject line
        const subjectPrompt = nextStep.subject_template || 
          `Invoice ${invoice.invoice_number} - Payment Reminder`;

        // Create draft in database
        const { error: draftError } = await supabaseAdmin
          .from('ai_drafts')
          .insert({
            user_id: invoice.user_id,
            invoice_id: invoice.id,
            workflow_step_id: nextStep.id,
            channel: nextStep.channel,
            step_number: nextStep.step_order,
            subject: subjectPrompt,
            message_body: generatedContent,
            status: 'pending_approval',
            recommended_send_date: new Date().toISOString(),
            days_past_due: daysPastDue,
          });

        if (draftError) {
          console.error(`Error creating draft for invoice ${invoice.id}:`, draftError);
        } else {
          console.log(`✓ Created draft for invoice ${invoice.invoice_number}, step ${nextStep.step_order} (${nextStep.label})`);
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

function getDefaultTemplate(bucket: string): string {
  const templates: Record<string, string> = {
    current: 'Generate a friendly reminder that payment is coming due soon. Keep tone positive and helpful.',
    dpd_1_30: 'Generate a warm, friendly follow-up about the outstanding invoice. Use soft language and offer help. Do NOT use urgent or pressure language.',
    dpd_31_60: 'Generate a professional, direct message about the overdue invoice. Be clear about expectations while offering solutions.',
    dpd_61_90: 'Generate a serious, assertive message about the significantly overdue invoice. Emphasize urgency and the need for immediate attention.',
    dpd_91_120: 'Generate a very firm, formal message about the long-overdue invoice. Use final notice language and mention potential escalation.',
    dpd_121_150: 'Generate a legal-tone message about the critically overdue invoice. Reference potential legal remedies while remaining compliant.',
    dpd_150_plus: 'Generate a final internal collections message. Be authoritative and firm, demanding immediate resolution. Do not threaten legal action or third-party collections.',
  };
  return templates[bucket] || templates.current;
}
