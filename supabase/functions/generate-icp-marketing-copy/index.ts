import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { industry } = await req.json();
    
    if (!industry) {
      return new Response(
        JSON.stringify({ error: 'Industry parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      return new Response(
        JSON.stringify(existing),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new copy using OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompt = `You are a B2B SaaS marketing strategist writing for small businesses.
You must write clear, benefit-driven, conversion-optimized copy that explains how Recouply.ai helps ${industry} businesses collect overdue invoices without using a collection agency.`;

    const userPrompt = `Write a 3-part copy block for the ${industry} industry:

1. Problem section (the pain): Describe the specific invoice collection challenges faced by ${industry} businesses. Be concrete and relatable. 2-3 paragraphs.

2. Solution section (how Recouply.ai solves it): Explain how our AI-powered invoice collection software helps. Focus on automation, maintaining customer relationships, and keeping everything in-house. Include specific examples relevant to ${industry}. 2-3 paragraphs.

3. Results section (faster payments, fewer awkward conversations, better cash flow): Describe the tangible outcomes businesses can expect. Use specific, believable metrics and benefits. 2-3 paragraphs.

Write in a professional but conversational tone. Focus on benefits, not features. Make it industry-specific with real examples.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const fullCopy = data.choices[0].message.content;

    // Parse the response into three sections
    const sections = fullCopy.split(/\d\.\s*(?:Problem|Solution|Results)/i).filter((s: string) => s.trim());
    
    const problemCopy = sections[0]?.trim() || fullCopy.substring(0, fullCopy.length / 3);
    const solutionCopy = sections[1]?.trim() || fullCopy.substring(fullCopy.length / 3, 2 * fullCopy.length / 3);
    const resultsCopy = sections[2]?.trim() || fullCopy.substring(2 * fullCopy.length / 3);

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
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify(snippet),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-icp-marketing-copy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});