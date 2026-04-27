import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: any) => {
  console.log(`[EXTRACT-PDF] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

async function refreshAccessToken(supabase: any, connection: any) {
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!;
  
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Token refresh failed');

  await supabase.from('drive_connections').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('id', connection.id);

  return data.access_token;
}

function calculateConfidence(extracted: any): { score: number; breakdown: any } {
  const breakdown: any = {};
  let total = 0;
  let max = 0;

  const checks = [
    { field: 'invoice_number', weight: 20, check: () => !!extracted.invoice_number },
    { field: 'invoice_date', weight: 15, check: () => !!extracted.invoice_date },
    { field: 'due_date', weight: 15, check: () => !!extracted.due_date },
    { field: 'amount', weight: 20, check: () => extracted.amount != null && extracted.amount > 0 },
    { field: 'debtor_name', weight: 15, check: () => !!(extracted.debtor_name || extracted.company_name) },
    { field: 'billing_email', weight: 5, check: () => !!extracted.billing_email },
    { field: 'po_number', weight: 5, check: () => !!extracted.po_number },
    { field: 'date_consistency', weight: 5, check: () => {
      if (!extracted.invoice_date || !extracted.due_date) return true;
      return new Date(extracted.due_date) >= new Date(extracted.invoice_date);
    }},
  ];

  for (const c of checks) {
    max += c.weight;
    const passed = c.check();
    breakdown[c.field] = { passed, weight: c.weight };
    if (passed) total += c.weight;
  }

  return { score: Math.round((total / max) * 100), breakdown };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { scannedFileId } = await req.json();
    if (!scannedFileId) {
      return new Response(JSON.stringify({ error: 'scannedFileId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get file details
    const { data: scannedFile, error: fileErr } = await supabase
      .from('ingestion_scanned_files')
      .select('*, drive_connections(*)')
      .eq('id', scannedFileId)
      .eq('user_id', user.id)
      .single();

    if (fileErr || !scannedFile) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as processing
    await supabase.from('ingestion_scanned_files').update({
      processing_status: 'processing',
      processing_started_at: new Date().toISOString(),
    }).eq('id', scannedFileId);

    logStep('Processing file', { fileName: scannedFile.file_name });

    // Get access token
    const connection = scannedFile.drive_connections;
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      accessToken = await refreshAccessToken(supabase, connection);
    }

    // Download PDF content from Google Drive
    const pdfRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${scannedFile.file_id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!pdfRes.ok) {
      throw new Error(`Failed to download PDF: ${pdfRes.status}`);
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    // Detect PDF page count by scanning the raw PDF for page objects.
    // Supports standard PDFs; defaults to 1 if detection fails.
    let pageCount = 1;
    try {
      const decoder = new TextDecoder('latin1');
      const pdfText = decoder.decode(pdfBytes);
      // Try /N (page tree count) first — most reliable
      const nMatches = [...pdfText.matchAll(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g)]
        .map((m) => parseInt(m[1], 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (nMatches.length > 0) {
        pageCount = Math.max(...nMatches);
      } else {
        // Fallback: count /Type /Page (not /Pages) occurrences
        const pageMatches = pdfText.match(/\/Type\s*\/Page(?!s)/g);
        if (pageMatches && pageMatches.length > 0) {
          pageCount = pageMatches.length;
        }
      }
    } catch (e) {
      logStep('Page count detection failed, defaulting to 1', { error: String(e) });
    }
    pageCount = Math.max(1, pageCount);

    // Persist page count for billing
    await supabase.from('ingestion_scanned_files').update({
      page_count: pageCount,
    }).eq('id', scannedFileId);

    logStep('Downloaded PDF', { size: pdfBuffer.byteLength, pageCount });

    // Use Lovable AI with vision + OCR to extract invoice data.
    // Gemini 2.5 Flash natively performs OCR on scanned/image-based PDFs as well as
    // digital PDFs, so we explicitly instruct it to read all visible text including
    // handwritten notes, stamps, and low-quality scans.
    const extractionPrompt = `You are an expert invoice data extraction system with built-in OCR (Optical Character Recognition).

The attached file may be:
- A digital/text-based PDF
- A scanned paper invoice (image-based PDF)
- A photo of an invoice
- A low-resolution or skewed scan

Use OCR to read ALL visible text in the document — including printed text, stamps, handwritten notes, and low-quality scans. If the document is rotated or skewed, mentally rotate it before reading.

Extract the following fields precisely:

1. invoice_number - The invoice number or reference
2. invoice_date - The invoice/issue date (YYYY-MM-DD format)
3. due_date - The payment due date (YYYY-MM-DD format)
4. debtor_name - The customer/client name (individual)
5. company_name - The customer/client company name
6. amount - The total invoice amount (number only, no currency symbols)
7. outstanding_balance - Outstanding/remaining balance if shown (number only)
8. po_number - Purchase order or reference number
9. billing_email - Customer email address if visible
10. address - Customer billing address if visible

Return ONLY a JSON object with these fields. Use null for fields you cannot find. Dates must be in YYYY-MM-DD format.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You extract structured data from invoice PDFs. Always respond with valid JSON only.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: extractionPrompt },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
            ],
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_invoice_data',
            description: 'Extract structured invoice data from a PDF',
            parameters: {
              type: 'object',
              properties: {
                invoice_number: { type: 'string', description: 'Invoice number' },
                invoice_date: { type: 'string', description: 'Invoice date in YYYY-MM-DD' },
                due_date: { type: 'string', description: 'Due date in YYYY-MM-DD' },
                debtor_name: { type: 'string', description: 'Customer name' },
                company_name: { type: 'string', description: 'Customer company name' },
                amount: { type: 'number', description: 'Total invoice amount' },
                outstanding_balance: { type: 'number', description: 'Outstanding balance' },
                po_number: { type: 'string', description: 'PO/reference number' },
                billing_email: { type: 'string', description: 'Customer email' },
                address: { type: 'string', description: 'Customer address' },
              },
              required: ['invoice_number'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_invoice_data' } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) {
        await supabase.from('ingestion_scanned_files').update({
          processing_status: 'pending',
          error_message: 'Rate limited, will retry',
        }).eq('id', scannedFileId);
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI extraction failed: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    let extracted: any = {};

    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch {
        // Try parsing from content
        const content = aiData.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
      }
    }

    logStep('Extracted data', extracted);

    // Calculate confidence
    const { score, breakdown } = calculateConfidence(extracted);

    // Update scanned file
    await supabase.from('ingestion_scanned_files').update({
      processing_status: 'processed',
      processing_completed_at: new Date().toISOString(),
      extraction_result: extracted,
      confidence_score: score,
    }).eq('id', scannedFileId);

    // Check for duplicate invoices by invoice number
    let isDuplicate = false;
    let duplicateInvoiceId: string | null = null;

    if (extracted.invoice_number) {
      const { data: dupes } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('user_id', user.id)
        .eq('invoice_number', extracted.invoice_number)
        .limit(1);

      if (dupes && dupes.length > 0) {
        isDuplicate = true;
        duplicateInvoiceId = dupes[0].id;
      }
    }

    // If duplicate, skip review queue entirely — mark file as skipped
    if (isDuplicate) {
      await supabase.from('ingestion_scanned_files').update({
        processing_status: 'skipped_duplicate',
        processing_completed_at: new Date().toISOString(),
        extraction_result: extracted,
        confidence_score: score,
        error_message: `Invoice ${extracted.invoice_number} already exists (ID: ${duplicateInvoiceId})`,
      }).eq('id', scannedFileId);

      // Audit log
      await supabase.from('ingestion_audit_log').insert({
        user_id: user.id,
        organization_id: orgId,
        scanned_file_id: scannedFileId,
        event_type: 'file_skipped_duplicate',
        event_details: {
          invoice_number: extracted.invoice_number,
          existing_invoice_id: duplicateInvoiceId,
          confidence_score: score,
        },
      });

      logStep('Skipped duplicate invoice', { invoiceNumber: extracted.invoice_number, existingId: duplicateInvoiceId });

      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'duplicate',
        invoice_number: extracted.invoice_number,
        existing_invoice_id: duplicateInvoiceId,
        extracted,
        confidence_score: score,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create review queue item only for non-duplicate invoices
    const { error: reviewErr } = await supabase
      .from('ingestion_review_queue')
      .insert({
        user_id: user.id,
        organization_id: orgId,
        scanned_file_id: scannedFileId,
        extracted_invoice_number: extracted.invoice_number || null,
        extracted_invoice_date: extracted.invoice_date || null,
        extracted_due_date: extracted.due_date || null,
        extracted_debtor_name: extracted.debtor_name || null,
        extracted_company_name: extracted.company_name || null,
        extracted_amount: extracted.amount || null,
        extracted_outstanding_balance: extracted.outstanding_balance || null,
        extracted_po_number: extracted.po_number || null,
        extracted_billing_email: extracted.billing_email || null,
        extracted_address: extracted.address || null,
        confidence_score: score,
        confidence_breakdown: breakdown,
        matched_debtor_id: matchedDebtorId,
        debtor_match_confidence: debtorMatchConfidence,
        is_duplicate: false,
        duplicate_invoice_id: null,
        validation_errors: validationErrors.length > 0 ? validationErrors : null,
        review_status: 'pending',
      });

    if (reviewErr) {
      logStep('Error creating review item', { error: reviewErr.message });
    }

    // Audit log
    await supabase.from('ingestion_audit_log').insert({
      user_id: user.id,
      organization_id: orgId,
      scanned_file_id: scannedFileId,
      event_type: 'file_extracted',
      event_details: {
        confidence_score: score,
        is_duplicate: isDuplicate,
        validation_errors: validationErrors,
        debtor_matched: !!matchedDebtorId,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      extracted,
      confidence_score: score,
      confidence_breakdown: breakdown,
      is_duplicate: isDuplicate,
      matched_debtor_id: matchedDebtorId,
      debtor_match_confidence: debtorMatchConfidence,
      validation_errors: validationErrors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Error', { error: String(error) });

    // Try to mark file as error
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.scannedFileId) {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await supabase.from('ingestion_scanned_files').update({
          processing_status: 'error',
          error_message: String(error),
        }).eq('id', body.scannedFileId);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
