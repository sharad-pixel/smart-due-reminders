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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    const { system_prompt, user_prompt, channel, tone_modifier, approach_style } = await req.json();

    if (!system_prompt || !user_prompt || !channel) {
      return new Response(
        JSON.stringify({ error: 'system_prompt, user_prompt, and channel are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Tone modifiers to adjust the persona's default tone
    const toneModifiers: Record<string, string> = {
      'standard': '',
      'more_friendly': `
TONE ADJUSTMENT - Make this message MORE FRIENDLY:
- Use warmer, more conversational language
- Add more empathy and understanding
- Soften any direct requests
- Focus on relationship preservation`,
      'more_professional': `
TONE ADJUSTMENT - Make this message MORE PROFESSIONAL:
- Use formal business language
- Be more structured and precise
- Maintain courteous but businesslike tone
- Focus on facts and deadlines`,
      'more_urgent': `
TONE ADJUSTMENT - Make this message MORE URGENT:
- Emphasize time sensitivity
- Be more direct about consequences
- Use action-oriented language
- Include clear deadlines`,
      'more_empathetic': `
TONE ADJUSTMENT - Make this message MORE EMPATHETIC:
- Acknowledge potential difficulties
- Offer flexibility and understanding
- Use compassionate language
- Focus on finding solutions together`,
      'more_direct': `
TONE ADJUSTMENT - Make this message MORE DIRECT:
- Get straight to the point
- Be clear about expectations
- Minimize pleasantries
- Focus on specific action needed`
    };

    // Approach styles to change the message focus
    const approachStyles: Record<string, string> = {
      'standard': '',
      'invoice_reminder': `
APPROACH STYLE - INVOICE REMINDER:
- Focus on invoice details and due date
- Treat as a simple reminder/heads-up
- Assume it may have been overlooked
- Keep tone light and helpful`,
      'payment_request': `
APPROACH STYLE - PAYMENT REQUEST:
- Be clear this is a request for payment
- Include payment options if known
- Set expectation for response
- Professional and action-oriented`,
      'settlement_offer': `
APPROACH STYLE - SETTLEMENT OFFER:
- Mention willingness to discuss payment options
- Open door to payment plans or negotiations
- Focus on finding mutually beneficial resolution
- Be solution-oriented`,
      'final_notice': `
APPROACH STYLE - FINAL NOTICE:
- Clearly state this is a final notice
- Outline potential next steps if no response
- Be firm but professional
- Include clear deadline for response`,
      'relationship_focused': `
APPROACH STYLE - RELATIONSHIP FOCUSED:
- Emphasize value of ongoing business relationship
- Express desire to maintain partnership
- Be understanding of circumstances
- Focus on working together to resolve`
    };

    const selectedTone = toneModifiers[tone_modifier || 'standard'] || '';
    const selectedApproach = approachStyles[approach_style || 'standard'] || '';

    // Augment system prompt with tone and approach adjustments
    const augmentedSystemPrompt = `${system_prompt}
${selectedTone ? `\n${selectedTone}` : ''}
${selectedApproach ? `\n${selectedApproach}` : ''}`;

    console.log('Regenerating draft with AI for channel:', channel);

    // Generate draft using Lovable AI with tool calling
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const tools = channel === 'email' ? [{
      type: 'function',
      function: {
        name: 'create_email_draft',
        description: 'Create an email draft with subject and body',
        parameters: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              description: 'Email subject line'
            },
            body: {
              type: 'string',
              description: 'Email body content'
            }
          },
          required: ['subject', 'body'],
          additionalProperties: false
        }
      }
    }] : [{
      type: 'function',
      function: {
        name: 'create_sms_draft',
        description: 'Create an SMS draft',
        parameters: {
          type: 'object',
          properties: {
            body: {
              type: 'string',
              description: 'SMS message content (max 160 characters)'
            }
          },
          required: ['body'],
          additionalProperties: false
        }
      }
    }];

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: augmentedSystemPrompt },
          { role: 'user', content: user_prompt }
        ],
        tools: tools,
        tool_choice: {
          type: 'function',
          function: {
            name: channel === 'email' ? 'create_email_draft' : 'create_sms_draft'
          }
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI generation failed' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || !toolCall.function?.arguments) {
      return new Response(
        JSON.stringify({ error: 'No content generated from AI' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const subject = parsed.subject || null;
    const messageBody = parsed.body;

    if (!messageBody) {
      return new Response(
        JSON.stringify({ error: 'Empty message body' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_body: messageBody,
        subject: subject,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in regenerate-draft:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
