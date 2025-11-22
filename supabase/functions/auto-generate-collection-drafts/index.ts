import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // Get all Open or InPaymentPlan invoices
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
        debtors!inner(
          id,
          name,
          company_name,
          email,
          contact_name
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
        if (daysPastDue >= 91) {
          agingBucket = 'dpd_91_120';
        } else if (daysPastDue >= 61) {
          agingBucket = 'dpd_61_90';
        } else if (daysPastDue >= 31) {
          agingBucket = 'dpd_31_60';
        } else if (daysPastDue >= 1) {
          agingBucket = 'dpd_1_30';
        }

        console.log(`Processing invoice ${invoice.invoice_number}: ${daysPastDue} days past due, bucket: ${agingBucket}`);

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

        // Find workflow steps that should trigger today
        const activeSteps = workflow.steps
          .filter((s: any) => s.is_active && s.day_offset === daysPastDue)
          .sort((a: any, b: any) => a.step_order - b.step_order);

        if (activeSteps.length === 0) {
          console.log(`No workflow steps trigger at day ${daysPastDue}`);
          continue;
        }

        for (const step of activeSteps) {
          // Check if draft already exists for this invoice and step
          const { data: existingDrafts } = await supabaseAdmin
            .from('ai_drafts')
            .select('id')
            .eq('invoice_id', invoice.id)
            .eq('workflow_step_id', step.id)
            .limit(1);

          if (existingDrafts && existingDrafts.length > 0) {
            console.log(`Draft already exists for invoice ${invoice.id}, step ${step.id}`);
            continue;
          }

          // Get branding settings
          const { data: branding } = await supabaseAdmin
            .from('branding_settings')
            .select('*')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

          // Build AI prompt
          const businessName = branding?.business_name || 'Your Company';
          const fromName = branding?.from_name || businessName;
          const debtorName = invoice.debtors.contact_name || invoice.debtors.name || invoice.debtors.company_name;
          
          const systemPrompt = `You are drafting a professional collections message for ${businessName} to send to their customer about an overdue invoice.

CRITICAL RULES:
- Be firm, clear, and professional
- Be respectful and non-threatening
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment or intimidation
- Write as if you are ${businessName}, NOT a third party
- Encourage the customer to pay or reply if there is a dispute or issue
- Use a ${getToneForBucket(agingBucket)} tone appropriate for ${daysPastDue} days past due`;

          const userPrompt = step.body_template || getDefaultTemplate(agingBucket);
          
          const contextualPrompt = `${userPrompt}

Context:
- Business: ${businessName}
- From: ${fromName}
- Debtor: ${debtorName}
- Invoice Number: ${invoice.invoice_number}
- Amount: $${invoice.amount} ${invoice.currency || 'USD'}
- Original Due Date: ${invoice.due_date}
- Days Past Due: ${daysPastDue}
- Aging Bucket: ${agingBucket}

${branding?.email_signature ? `\nSignature block to include:\n${branding.email_signature}` : ''}`;

          // Generate draft using Lovable AI
          const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
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
          const subjectPrompt = step.subject_template || 
            `Invoice ${invoice.invoice_number} - ${daysPastDue} Days Past Due`;

          // Create draft in database
          const { error: draftError } = await supabaseAdmin
            .from('ai_drafts')
            .insert({
              user_id: invoice.user_id,
              invoice_id: invoice.id,
              workflow_step_id: step.id,
              channel: step.channel,
              step_number: step.step_order,
              subject: subjectPrompt,
              message_body: generatedContent,
              status: 'pending_approval',
              recommended_send_date: new Date().toISOString(),
            });

          if (draftError) {
            console.error(`Error creating draft for invoice ${invoice.id}:`, draftError);
          } else {
            console.log(`✓ Created draft for invoice ${invoice.invoice_number}, step ${step.step_order}`);
            draftsCreated++;
          }
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

function getToneForBucket(bucket: string): string {
  switch (bucket) {
    case 'current': return 'friendly reminder';
    case 'dpd_1_30': return 'firm but friendly';
    case 'dpd_31_60': return 'firm and direct';
    case 'dpd_61_90': return 'urgent and direct but respectful';
    case 'dpd_91_120': return 'very firm, urgent, and compliant';
    default: return 'professional';
  }
}

function getDefaultTemplate(bucket: string): string {
  const templates: Record<string, string> = {
    current: 'Generate a friendly reminder that payment is coming due soon. Keep tone positive and helpful.',
    dpd_1_30: 'Generate a firm but friendly follow-up about the overdue invoice. Mention the invoice details and request prompt payment.',
    dpd_31_60: 'Generate a firm and direct message about the seriously overdue invoice. Express concern and request immediate payment or communication about any issues.',
    dpd_61_90: 'Generate an urgent message about the significantly overdue invoice. Be direct about the seriousness while remaining professional. Request immediate action.',
    dpd_91_120: 'Generate a very firm, urgent message about the long-overdue invoice. Be clear about the serious nature while remaining compliant and professional. Request immediate payment or contact.',
  };
  return templates[bucket] || templates.current;
}
