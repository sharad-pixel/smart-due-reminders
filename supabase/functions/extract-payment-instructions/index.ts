// Extract bank/wire/ACH/check payment instructions from an uploaded
// document (PDF or image) using the Lovable AI Gateway (Gemini-2.5-Flash).
// Returns formatted text blocks suitable for the invoice template fields.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const log = (s: string, d?: unknown) =>
  console.log(`[EXTRACT-PAY-INSTR] ${s}${d ? ` - ${JSON.stringify(d)}` : ''}`);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null) as
      | { fileBase64: string; mimeType: string; fileName?: string }
      | null;

    if (!body?.fileBase64 || !body?.mimeType) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 and mimeType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { fileBase64, mimeType, fileName } = body;
    log('Extracting', { mimeType, fileName, sizeKB: Math.round(fileBase64.length / 1024) });

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    if (!isImage && !isPdf) {
      return new Response(
        JSON.stringify({ error: 'Only PDF or image files are supported.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const userContent: any[] = [
      {
        type: 'text',
        text:
          'Extract banking and payment information from this document. ' +
          'Return ONLY a JSON object matching the provided schema. ' +
          'Do not invent fields. If a field is missing, leave it as an empty string.',
      },
      isImage
        ? { type: 'image_url', image_url: { url: dataUrl } }
        : { type: 'file', file: { filename: fileName || 'doc.pdf', file_data: dataUrl } },
    ];

    const tool = {
      type: 'function',
      function: {
        name: 'return_payment_instructions',
        description: 'Return the extracted payment / banking instructions',
        parameters: {
          type: 'object',
          properties: {
            bank_name: { type: 'string' },
            account_name: { type: 'string', description: 'Beneficiary / account holder name' },
            account_number: { type: 'string' },
            routing_number: { type: 'string', description: 'ABA / ACH routing number' },
            swift_code: { type: 'string' },
            iban: { type: 'string' },
            bank_address: { type: 'string' },
            wire_intermediary: { type: 'string', description: 'Intermediary / correspondent bank info if present' },
            check_payable_to: { type: 'string' },
            check_mailing_address: { type: 'string', description: 'Full mailing address for check payments' },
            reference_instructions: { type: 'string', description: 'Memo / reference / invoice note instructions' },
            notes: { type: 'string' },
          },
          required: [
            'bank_name', 'account_name', 'account_number', 'routing_number',
            'swift_code', 'iban', 'bank_address', 'wire_intermediary',
            'check_payable_to', 'check_mailing_address', 'reference_instructions', 'notes',
          ],
          additionalProperties: false,
        },
      },
    };

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at reading bank letters, voided checks, ACH/wire instruction forms, ' +
              'and remittance pages. Extract only information that is clearly present in the document.',
          },
          { role: 'user', content: userContent },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'return_payment_instructions' } },
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      log('AI error', { status: aiRes.status, errTxt });
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'AI rate limit reached. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in Workspace settings.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI extraction failed', detail: errTxt }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      log('No tool call returned', aiJson);
      return new Response(JSON.stringify({ error: 'Could not extract payment information from the document.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let extracted: Record<string, string> = {};
    try {
      extracted = JSON.parse(argsStr);
    } catch (e) {
      log('Parse error', { argsStr, e: String(e) });
      return new Response(JSON.stringify({ error: 'Invalid AI response' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format into the two textarea blocks used on the invoice template
    const wireLines: string[] = [];
    if (extracted.bank_name) wireLines.push(`Bank: ${extracted.bank_name}`);
    if (extracted.account_name) wireLines.push(`Account Name: ${extracted.account_name}`);
    if (extracted.routing_number) wireLines.push(`Routing / ABA: ${extracted.routing_number}`);
    if (extracted.account_number) wireLines.push(`Account #: ${extracted.account_number}`);
    if (extracted.swift_code) wireLines.push(`SWIFT: ${extracted.swift_code}`);
    if (extracted.iban) wireLines.push(`IBAN: ${extracted.iban}`);
    if (extracted.bank_address) wireLines.push(`Bank Address: ${extracted.bank_address}`);
    if (extracted.wire_intermediary) wireLines.push(`Intermediary: ${extracted.wire_intermediary}`);
    if (extracted.reference_instructions) wireLines.push(`Reference: ${extracted.reference_instructions}`);

    const checkLines: string[] = [];
    if (extracted.check_payable_to) checkLines.push(`Payable to: ${extracted.check_payable_to}`);
    if (extracted.check_mailing_address) checkLines.push(extracted.check_mailing_address);

    return new Response(
      JSON.stringify({
        success: true,
        raw: extracted,
        wire_text: wireLines.join('\n'),
        check_text: checkLines.join('\n'),
        notes: extracted.notes || '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    log('Error', { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
