import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { query, type } = await req.json();
    console.log(`[AUTOCOMPLETE] Looking up ${type} for: ${query}`);

    // Call Lovable AI to search for business information
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a business information lookup assistant. Search for accurate, current business information from reliable sources. Return structured data.`
          },
          {
            role: 'user',
            content: type === 'business_profile' 
              ? `Find detailed business information for "${query}". Include: business name, full address (street, city, state, postal code, country), phone number, and any other relevant details.`
              : `Find detailed business/customer information for "${query}". Include: name/company name, full address (street, city, state, postal code, country), phone number, email if available, and type (B2B or B2C).`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: type === 'business_profile' ? 'return_business_profile' : 'return_debtor_info',
            description: 'Return structured business or customer information',
            parameters: {
              type: 'object',
              properties: type === 'business_profile' ? {
                business_name: { type: 'string', description: 'Official business name' },
                address_line1: { type: 'string', description: 'Street address line 1' },
                address_line2: { type: 'string', description: 'Street address line 2 (suite, unit, etc.)' },
                city: { type: 'string', description: 'City name' },
                state: { type: 'string', description: 'State or province' },
                postal_code: { type: 'string', description: 'ZIP or postal code' },
                country: { type: 'string', description: 'Country name' },
                phone: { type: 'string', description: 'Business phone number' }
              } : {
                name: { type: 'string', description: 'Customer or company name' },
                company_name: { type: 'string', description: 'Company name (for B2B)' },
                type: { type: 'string', enum: ['B2B', 'B2C'], description: 'Customer type' },
                email: { type: 'string', description: 'Email address' },
                phone: { type: 'string', description: 'Phone number' },
                address_line1: { type: 'string', description: 'Street address line 1' },
                address_line2: { type: 'string', description: 'Street address line 2' },
                city: { type: 'string', description: 'City name' },
                state: { type: 'string', description: 'State or province' },
                postal_code: { type: 'string', description: 'ZIP or postal code' },
                country: { type: 'string', description: 'Country name' }
              },
              required: type === 'business_profile' 
                ? ['business_name', 'address_line1', 'city', 'state', 'country']
                : ['name', 'type'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { 
          type: 'function', 
          function: { 
            name: type === 'business_profile' ? 'return_business_profile' : 'return_debtor_info' 
          } 
        }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error('No structured data returned from AI');
    }

    const businessInfo = JSON.parse(toolCall.function.arguments);
    console.log('[AUTOCOMPLETE] Found business info:', businessInfo);

    return new Response(
      JSON.stringify({ success: true, data: businessInfo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AUTOCOMPLETE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to lookup business information' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
