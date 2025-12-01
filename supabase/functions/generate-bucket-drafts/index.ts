import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { aging_bucket } = await req.json();

    if (!aging_bucket) {
      return new Response(JSON.stringify({ error: "aging_bucket is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating drafts for aging bucket: ${aging_bucket}`);

    // Calculate the days past due range for this bucket
    let minDays = 0;
    let maxDays = 999999;
    
    switch (aging_bucket) {
      case 'current':
        maxDays = -1;
        break;
      case 'dpd_1_30':
        minDays = 1;
        maxDays = 30;
        break;
      case 'dpd_31_60':
        minDays = 31;
        maxDays = 60;
        break;
      case 'dpd_61_90':
        minDays = 61;
        maxDays = 90;
        break;
      case 'dpd_91_120':
        minDays = 91;
        maxDays = 120;
        break;
      case 'dpd_120_plus':
        minDays = 121;
        break;
    }

    // Fetch all open invoices in this bucket for this user
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id, 
        invoice_number, 
        amount, 
        currency, 
        due_date, 
        debtor_id,
        debtors!inner(
          name, 
          company_name, 
          email
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['Open', 'InPaymentPlan'])
      .order('due_date', { ascending: true });

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No invoices found in ${aging_bucket} bucket`,
        drafts_created: 0,
        invoices_processed: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter invoices by days past due
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filteredInvoices = invoices.filter(invoice => {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysPastDue >= minDays && daysPastDue <= maxDays;
    });

    if (filteredInvoices.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No invoices match the criteria for ${aging_bucket} bucket`,
        drafts_created: 0,
        invoices_processed: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the active workflow for this bucket
    const { data: workflow, error: workflowError } = await supabase
      .from('collection_workflows')
      .select('*, steps:collection_workflow_steps(*)')
      .eq('aging_bucket', aging_bucket)
      .eq('is_active', true)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('user_id', { ascending: false })
      .limit(1)
      .single();

    if (workflowError || !workflow) {
      return new Response(JSON.stringify({ 
        error: `No active workflow found for ${aging_bucket}`,
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      return new Response(JSON.stringify({ 
        error: `Workflow has no steps configured`,
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get branding settings
    const { data: branding } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    let draftsCreated = 0;
    let errors: string[] = [];

    // For each invoice, generate drafts for each workflow step that should trigger
    for (const invoice of filteredInvoices) {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Check if a draft already exists for this invoice from any step in this workflow
      const { data: existingDrafts } = await supabase
        .from('ai_drafts')
        .select('workflow_step_id')
        .eq('invoice_id', invoice.id)
        .eq('user_id', user.id)
        .in('status', ['pending_approval', 'approved']);

      const existingStepIds = new Set(existingDrafts?.map(d => d.workflow_step_id) || []);

      // Find steps that should trigger based on day_offset
      const applicableSteps = workflow.steps.filter((step: any) => 
        step.is_active && 
        step.day_offset <= daysPastDue &&
        !existingStepIds.has(step.id)
      );

      if (applicableSteps.length === 0) {
        continue;
      }

      // Use the most recent applicable step (highest day_offset that's <= daysPastDue)
      const step = applicableSteps.sort((a: any, b: any) => b.day_offset - a.day_offset)[0];

      try {
        // Get persona for this bucket
        const { data: persona } = await supabase
          .from('ai_agent_personas')
          .select('id')
          .lte('bucket_min', daysPastDue)
          .or(`bucket_max.is.null,bucket_max.gte.${daysPastDue}`)
          .order('bucket_min', { ascending: false })
          .limit(1)
          .maybeSingle();

        const getToneForBucket = (bucket: string): string => {
          switch (bucket) {
            case 'current': return 'friendly reminder';
            case 'dpd_1_30': return 'firm but friendly';
            case 'dpd_31_60': return 'firm and direct';
            case 'dpd_61_90': return 'urgent and direct but respectful';
            case 'dpd_91_120': return 'very firm, urgent, and compliant';
            case 'dpd_120_plus': return 'extremely firm, urgent, final notice tone';
            default: return 'professional';
          }
        };

        const businessName = branding?.business_name || 'Your Company';
        const fromName = branding?.from_name || businessName;
        const debtor = Array.isArray(invoice.debtors) ? invoice.debtors[0] : invoice.debtors;
        const debtorName = debtor.name || debtor.company_name;

        const systemPrompt = `You are drafting a professional collections message for ${businessName} to send to their customer about an overdue invoice.

CRITICAL RULES:
- Be firm, clear, and professional
- Be respectful and non-threatening
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment or intimidation
- Write as if you are ${businessName}, NOT a third party
- Encourage the customer to pay or reply if there is a dispute or issue
- Use a ${getToneForBucket(aging_bucket)} tone appropriate for ${daysPastDue} days past due`;

        const userPrompt = `Generate a professional collection message with the following context:

Business: ${businessName}
From: ${fromName}
Debtor: ${debtorName}
Invoice Number: ${invoice.invoice_number}
Amount: $${invoice.amount} ${invoice.currency}
Original Due Date: ${invoice.due_date}
Days Past Due: ${daysPastDue}
Aging Bucket: ${aging_bucket}
Channel: ${step.channel}
Step Context: ${step.body_template}

${branding?.email_signature ? `\nSignature block to include:\n${branding.email_signature}` : ''}

Generate ${step.channel === 'email' ? 'a complete email message' : 'a concise SMS message (160 characters max)'}.
${step.channel === 'email' ? 'Return JSON with "subject" and "body" fields.' : 'Return JSON with "body" field only.'}`;

        // Generate content using Lovable AI
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
              { role: 'user', content: userPrompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for invoice ${invoice.invoice_number}:`, errorText);
          errors.push(`Failed to generate content for invoice ${invoice.invoice_number}`);
          continue;
        }

        const aiResult = await aiResponse.json();
        const generatedContent = aiResult.choices?.[0]?.message?.content;

        if (!generatedContent) {
          errors.push(`No content generated for invoice ${invoice.invoice_number}`);
          continue;
        }

        // Try to parse JSON response
        let messageBody = generatedContent;
        let subject = null;

        try {
          const parsed = JSON.parse(generatedContent);
          messageBody = parsed.body || parsed.message || generatedContent;
          subject = parsed.subject || null;
        } catch {
          // If not JSON, use as-is
          messageBody = generatedContent;
        }

        // Generate subject if email and not provided
        if (step.channel === 'email' && !subject) {
          subject = `Payment Reminder: Invoice ${invoice.invoice_number} - ${daysPastDue} days overdue`;
        }

        // Insert draft
        const { error: draftError } = await supabase
          .from('ai_drafts')
          .insert({
            user_id: user.id,
            invoice_id: invoice.id,
            workflow_step_id: step.id,
            agent_persona_id: persona?.id,
            channel: step.channel,
            subject: subject,
            message_body: messageBody,
            step_number: step.step_order,
            days_past_due: daysPastDue,
            status: 'pending_approval',
            recommended_send_date: new Date().toISOString().split('T')[0],
          });

        if (draftError) {
          console.error(`Error creating draft for invoice ${invoice.invoice_number}:`, draftError);
          errors.push(`Failed to save draft for invoice ${invoice.invoice_number}`);
          continue;
        }

        draftsCreated++;
        console.log(`Created draft for invoice ${invoice.invoice_number}`);
      } catch (error: any) {
        console.error(`Error processing invoice ${invoice.invoice_number}:`, error);
        errors.push(`Error processing invoice ${invoice.invoice_number}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      drafts_created: draftsCreated,
      invoices_processed: filteredInvoices.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error in generate-bucket-drafts:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
