import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-ICP-MARKETING] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    const { industry } = await req.json();
    
    if (!industry) {
      return new Response(
        JSON.stringify({ error: 'Industry parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep("Industry requested", { industry });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if snippet already exists
    const { data: existing } = await supabase
      .from('marketing_snippets')
      .select('*')
      .eq('industry', industry)
      .single();

    if (existing) {
      logStep("Existing snippet found");
      return new Response(
        JSON.stringify(existing),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep("Generating new copy with Lovable AI");

    // Generate new copy using Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Generate industry-specific prompts
    let systemPrompt = `You are a B2B SaaS marketing strategist writing for small businesses.
You must write clear, benefit-driven, conversion-optimized copy that explains how Recouply.ai helps ${industry} businesses collect overdue invoices without using a collection agency.`;

    let userPrompt = `Write a 3-part copy block for the ${industry} industry:

1. Problem section (the pain): Describe the specific invoice collection challenges faced by ${industry} businesses. Be concrete and relatable. 2-3 paragraphs.

2. Solution section (how Recouply.ai solves it): Explain how our AI-powered invoice collection software helps. Focus on automation, maintaining customer relationships, and keeping everything in-house. Include specific examples relevant to ${industry}. 2-3 paragraphs.

3. Results section (faster payments, fewer awkward conversations, better cash flow): Describe the tangible outcomes businesses can expect. Use specific, believable metrics and benefits. 2-3 paragraphs.

Write in a professional but conversational tone. Focus on benefits, not features. Make it industry-specific with real examples.`;

    // Special handling for SaaS industry
    if (industry.toLowerCase() === 'saas') {
      systemPrompt = `You are a B2B SaaS marketing strategist writing for mid-market SaaS companies. Your goal is to explain how Recouply.ai helps SaaS companies automate collections, reduce ARR leakage, and reduce the burden on small finance and CSM teams.`;
      
      userPrompt = `Write a 3-part marketing copy block for SaaS companies:

1. Problem: SaaS companies lack collections resources; CSMs and AEs chase payments manually; usage billing creates overdue invoices; ARR leaks due to delays. Describe disorganized shared inboxes, no consistent follow-up, cash flow unpredictability, and lack of scalable collections processes. 2-3 paragraphs.

2. Solution: Show how AI-driven workflows, CRM context, and safe outreach automate collections without harming relationships. Highlight AI-generated sequences, self-service payment workflows, CRM-connected context-aware outreach, automated promise-to-pay and renewal reminders, customer-safe language, and reporting (DSO, aging, recovery rates). Use examples relevant to SaaS (annual contracts, expansions, renewals, usage-based true-ups, NetSuite/Stripe/Chargebee billing). 2-3 paragraphs.

3. Results: Faster payments (20-40% faster collections), reduced DSO, saved hours for CSMs and Finance teams, recovered ARR, lower churn risk from polite tone, real-time receivables visibility, no need to hire collections team. 2-3 paragraphs.

Write in a professional but conversational tone. Focus on tangible business outcomes and be specific about SaaS use cases.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStep("AI Gateway error", { status: response.status, error: errorText });
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to your Lovable workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const fullCopy = data.choices[0].message.content;
    logStep("AI generation completed", { length: fullCopy.length });

    // Parse the response into three sections
    const sections = fullCopy.split(/\d\.\s*(?:Problem|Solution|Results)/i).filter((s: string) => s.trim());
    
    const problemCopy = sections[0]?.trim() || fullCopy.substring(0, fullCopy.length / 3);
    const solutionCopy = sections[1]?.trim() || fullCopy.substring(fullCopy.length / 3, 2 * fullCopy.length / 3);
    const resultsCopy = sections[2]?.trim() || fullCopy.substring(2 * fullCopy.length / 3);

    logStep("Saving to database");

    // Save to database
    const { data: snippet, error: insertError } = await supabase
      .from('marketing_snippets')
      .insert({
        industry,
        problem_copy: problemCopy,
        solution_copy: solutionCopy,
        results_copy: resultsCopy,
      })
      .select()
      .single();

    if (insertError) {
      logStep("Database insert error", insertError);
      throw insertError;
    }

    logStep("Success");
    return new Response(
      JSON.stringify(snippet),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logStep("ERROR", { message: error?.message || String(error) });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});