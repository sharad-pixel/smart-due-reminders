import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`[APPLY-WORKFLOW-TO-INVOICES] Starting for user ${user.id}`);

    // Get all open invoices for this user with their debtors
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, amount, due_date, aging_bucket, status,
        debtors(id, company_name, email, contact_name)
      `)
      .eq('user_id', user.id)
      .in('status', ['Open', 'InPaymentPlan'])
      .not('aging_bucket', 'is', null)
      .not('aging_bucket', 'eq', 'current')
      .not('aging_bucket', 'eq', 'paid');

    if (invoicesError) {
      throw new Error(`Failed to fetch invoices: ${invoicesError.message}`);
    }

    console.log(`[APPLY-WORKFLOW-TO-INVOICES] Found ${invoices?.length || 0} open invoices`);

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No open invoices to process', draftsCreated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's active workflows with their steps
    const { data: workflows, error: workflowsError } = await supabase
      .from('collection_workflows')
      .select(`
        id, aging_bucket, is_active,
        collection_workflow_steps(id, step_order, label, subject_template, body_template, channel, day_offset)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (workflowsError) {
      throw new Error(`Failed to fetch workflows: ${workflowsError.message}`);
    }

    console.log(`[APPLY-WORKFLOW-TO-INVOICES] Found ${workflows?.length || 0} active workflows`);

    // Create a map of bucket -> workflow steps
    const workflowMap = new Map<string, any[]>();
    workflows?.forEach(wf => {
      const steps = wf.collection_workflow_steps || [];
      if (steps.length > 0) {
        workflowMap.set(wf.aging_bucket, steps.sort((a: any, b: any) => a.step_order - b.step_order));
      }
    });

    let draftsCreated = 0;
    let skippedExisting = 0;
    const errors: string[] = [];

    // Process each invoice
    for (const invoice of invoices) {
      const bucket = invoice.aging_bucket;
      const steps = workflowMap.get(bucket);

      if (!steps || steps.length === 0) {
        console.log(`[APPLY-WORKFLOW-TO-INVOICES] No workflow steps for bucket ${bucket}`);
        continue;
      }

      const debtor = invoice.debtors as any;
      const daysPastDue = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)));

      // Get the first step (initial contact)
      const step = steps[0];

      if (!step.subject_template || !step.body_template || step.body_template === 'Template placeholder') {
        console.log(`[APPLY-WORKFLOW-TO-INVOICES] Step has no valid templates for ${bucket}`);
        continue;
      }

      // Check if draft already exists for this invoice
      const { data: existingDraft } = await supabase
        .from('ai_drafts')
        .select('id')
        .eq('invoice_id', invoice.id)
        .in('status', ['pending_approval', 'approved', 'sent'])
        .limit(1)
        .maybeSingle();

      if (existingDraft) {
        skippedExisting++;
        continue;
      }

      // Replace placeholders in templates
      const replacements: Record<string, string> = {
        '{{customer_name}}': debtor?.contact_name || debtor?.company_name || 'Valued Customer',
        '{{company_name}}': debtor?.company_name || 'Customer',
        '{{invoice_number}}': invoice.invoice_number || '',
        '{{amount}}': `$${(invoice.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        '{{due_date}}': invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US') : '',
        '{{days_past_due}}': daysPastDue.toString(),
        '{{payment_link}}': '[Payment Link]',
        '{{debtor_name}}': debtor?.contact_name || debtor?.company_name || 'Valued Customer',
        '{{currency}}': 'USD',
      };

      let subject = step.subject_template || '';
      let body = step.body_template || '';

      Object.entries(replacements).forEach(([key, value]) => {
        const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
      });

      // Create the draft in ai_drafts table
      const { error: insertError } = await supabase
        .from('ai_drafts')
        .insert({
          user_id: user.id,
          invoice_id: invoice.id,
          workflow_step_id: step.id,
          step_number: step.step_order,
          channel: step.channel || 'email',
          subject: subject,
          message_body: body,
          status: 'pending_approval',
          recommended_send_date: new Date().toISOString().split('T')[0],
          days_past_due: daysPastDue,
        });

      if (insertError) {
        console.error(`[APPLY-WORKFLOW-TO-INVOICES] Error creating draft for ${invoice.invoice_number}:`, insertError);
        errors.push(`Invoice ${invoice.invoice_number}: ${insertError.message}`);
      } else {
        draftsCreated++;
        console.log(`[APPLY-WORKFLOW-TO-INVOICES] Created draft for invoice ${invoice.invoice_number}`);
      }
    }

    console.log(`[APPLY-WORKFLOW-TO-INVOICES] Completed: ${draftsCreated} drafts created, ${skippedExisting} skipped (existing)`);

    return new Response(
      JSON.stringify({
        success: true,
        draftsCreated,
        skippedExisting,
        totalInvoices: invoices.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[APPLY-WORKFLOW-TO-INVOICES] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
