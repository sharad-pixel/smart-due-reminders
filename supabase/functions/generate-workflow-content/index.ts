// ⚠️ EMAIL DOMAIN WARNING ⚠️
// This function generates email templates.
// Any FROM email MUST use verified domain: send.inbound.services.recouply.ai
// DO NOT change to @recouply.ai - it will fail!
// See: supabase/functions/_shared/emailConfig.ts

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { stepId, agingBucket, tone, channel, dayOffset } = await req.json();

    // Get branding settings
    const { data: branding } = await supabaseClient
      .from('branding_settings')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();

    const businessName = branding?.business_name || 'Your Company';
    
    // Create AI prompt based on parameters
    const systemPrompt = `You are an expert collection message writer. Generate professional, ${tone} collection messages for ${agingBucket} invoices. Keep messages clear, actionable, and respectful.`;
    
    const userPrompt = channel === 'email' 
      ? `Write a ${tone} email subject line and body for a collection message sent ${dayOffset} days after the due date for ${agingBucket}. 
         Business name: ${businessName}
         Format: Return JSON with "subject" and "body" fields.
         Include placeholders: {{debtor_name}}, {{invoice_number}}, {{amount}}, {{due_date}}`
       : `Write a ${tone} email subject line and body for a collection message sent ${dayOffset} days after the due date for ${agingBucket}.
         Business name: ${businessName}
         Format: Return JSON with "subject" and "body" fields.
         Include placeholders: {{debtor_name}}, {{invoice_number}}, {{amount}}, {{due_date}}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;

    let subject = null;
    let body = generatedContent;

    // Try to parse JSON if it's an email (clean up markdown code blocks first)
    if (channel === 'email') {
      try {
        // Remove markdown code blocks if present
        let cleanContent = generatedContent.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }
        
        const parsed = JSON.parse(cleanContent);
        subject = parsed.subject;
        body = parsed.body;
      } catch {
        // If not JSON, use as-is
        const lines = generatedContent.split('\n');
        subject = lines[0].replace(/^(Subject:|Re:)/i, '').trim();
        body = lines.slice(1).join('\n').trim();
      }
    }

    // Update the workflow step
    const updateData: any = {
      body_template: body,
    };

    if (channel === 'email' && subject) {
      updateData.subject_template = subject;
    }

    const { error: updateError } = await supabaseClient
      .from('collection_workflow_steps')
      .update(updateData)
      .eq('id', stepId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        content: { subject, body }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-workflow-content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
