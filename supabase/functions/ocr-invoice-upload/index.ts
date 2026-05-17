import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const log = (step: string, details?: any) =>
  console.log(
    `[OCR-INVOICE-UPLOAD] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`,
  );

// Smart Ingestion is billed as 1 platform credit per page.
// Credits are drawn from the unified asc606_credit_wallets balance
// (pre-paid at $0.80/credit, accrued as overage at $1.00/credit).
const CREDITS_PER_PAGE = 1;
const UNIT_PRICE_CENTS = 100; // for activity display only
const PRICE_PER_PAGE_CENTS = UNIT_PRICE_CENTS;

function detectPageCount(pdfBytes: Uint8Array): number {
  try {
    const decoder = new TextDecoder("latin1");
    const pdfText = decoder.decode(pdfBytes);
    const nMatches = [
      ...pdfText.matchAll(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g),
    ]
      .map((m) => parseInt(m[1], 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nMatches.length > 0) return Math.max(...nMatches);
    const pageMatches = pdfText.match(/\/Type\s*\/Page(?!s)/g);
    if (pageMatches && pageMatches.length > 0) return pageMatches.length;
  } catch (_) {
    /* ignore */
  }
  return 1;
}

// Stripe per-page metering removed — usage is now metered via the platform
// credits wallet (see consume_platform_credits RPC).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    

    if (!lovableApiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      pdfBase64,
      fileName,
      contractImportId,
      scheduleId,
      debtorId: debtorIdFromBody,
      createInvoice = true,
    } = body || {};

    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return json({ error: "pdfBase64 required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Decode bytes
    let pdfBytes: Uint8Array;
    try {
      const binary = atob(pdfBase64);
      pdfBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) pdfBytes[i] = binary.charCodeAt(i);
    } catch {
      return json({ error: "Invalid base64" }, 400);
    }
    if (pdfBytes.byteLength > 25 * 1024 * 1024) {
      return json({ error: "File exceeds 25MB" }, 400);
    }

    const pageCount = Math.max(1, detectPageCount(pdfBytes));
    log("Detected pages", { pageCount, fileName });

    // Resolve account / contract context
    let accountId: string | null = null;
    let debtorId: string | null = debtorIdFromBody || null;
    let contract: any = null;
    if (contractImportId) {
      const { data: c } = await supabase
        .from("live_contract_imports")
        .select("id, account_id, debtor_id, contract_name")
        .eq("id", contractImportId)
        .maybeSingle();
      if (c) {
        contract = c;
        accountId = c.account_id;
        debtorId = debtorId || c.debtor_id;
      }
    }
    if (!accountId) accountId = user.id;

    // Run AI extraction (same prompt shape as extract-invoice-pdf)
    const extractionPrompt = `You are an expert invoice data extraction system with built-in OCR.
Extract: invoice_number, invoice_date (YYYY-MM-DD), due_date (YYYY-MM-DD), debtor_name, company_name, amount (number), outstanding_balance (number), po_number, billing_email, address. Return only the JSON via the provided tool.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You extract invoice data and return JSON only." },
          {
            role: "user",
            content: [
              { type: "text", text: extractionPrompt },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              parameters: {
                type: "object",
                properties: {
                  invoice_number: { type: "string" },
                  invoice_date: { type: "string" },
                  due_date: { type: "string" },
                  debtor_name: { type: "string" },
                  company_name: { type: "string" },
                  amount: { type: "number" },
                  outstanding_balance: { type: "number" },
                  po_number: { type: "string" },
                  billing_email: { type: "string" },
                  address: { type: "string" },
                },
                required: ["invoice_number"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
      log("AI failed", { status: aiRes.status, text });
      return json({ error: `AI extraction failed: ${aiRes.status}` }, 502);
    }
    const aiData = await aiRes.json();
    let extracted: any = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch {
        /* ignore */
      }
    }
    log("Extracted", extracted);

    // Optionally create an invoice
    let invoiceId: string | null = null;
    if (createInvoice && (debtorId || extracted.company_name)) {
      const targetDebtorId = debtorId; // contract-attached uploads have a debtor
      if (targetDebtorId) {
        const issue = extracted.invoice_date || new Date().toISOString().slice(0, 10);
        const due = extracted.due_date || issue;
        const amount = Number(extracted.amount || extracted.outstanding_balance || 0);
        const ymd = issue.replace(/-/g, "");
        const rand4 = Math.random().toString(36).slice(2, 6).toUpperCase();
        const refId = `OCR-${ymd}-${rand4}`;
        const invNumber = extracted.invoice_number || `OCR-${ymd}-${rand4}`;

        // Pre-insert duplicate check
        const { data: dupes } = await supabase
          .from("invoices")
          .select("id, invoice_number")
          .eq("debtor_id", targetDebtorId)
          .eq("issue_date", issue)
          .eq("amount", amount)
          .limit(1);

        const { data: inv, error: iErr } = await supabase
          .from("invoices")
          .insert({
            user_id: accountId,
            debtor_id: targetDebtorId,
            invoice_number: invNumber,
            reference_id: refId,
            amount,
            subtotal: amount,
            total_amount: amount,
            amount_outstanding: Number(extracted.outstanding_balance ?? amount),
            amount_original: amount,
            currency: "USD",
            issue_date: issue,
            due_date: due,
            status: "Open",
            source_system: "ocr_upload",
            source_origin: contract ? "ocr_contract" : "ocr_upload",
            source_contract_id: contract?.id || null,
            source_contract_schedule_id: scheduleId || null,
            product_description: contract?.contract_name || extracted.po_number || fileName || "OCR uploaded invoice",
            notes: `OCR-extracted from ${fileName || "uploaded PDF"} (${pageCount} page${pageCount === 1 ? "" : "s"})`,
          })
          .select("id")
          .single();

        if (!iErr && inv) {
          invoiceId = inv.id;
          // Link to schedule if provided
          if (scheduleId) {
            await supabase
              .from("contract_invoice_schedules")
              .update({
                invoice_id: inv.id,
                invoice_created_at: new Date().toISOString(),
                status: "invoice_created",
                attachment_source: "ocr",
              })
              .eq("id", scheduleId);
          }

          // AI / OCR audit trail of every extracted data point
          const auditRows = [
            { field_name: "invoice_number", source_value: extracted.invoice_number || null, applied_value: invNumber },
            { field_name: "amount", source_value: extracted.amount != null ? String(extracted.amount) : null, applied_value: String(amount) },
            { field_name: "outstanding_balance", source_value: extracted.outstanding_balance != null ? String(extracted.outstanding_balance) : null, applied_value: String(extracted.outstanding_balance ?? amount) },
            { field_name: "issue_date", source_value: extracted.invoice_date || null, applied_value: issue },
            { field_name: "due_date", source_value: extracted.due_date || null, applied_value: due },
            { field_name: "po_number", source_value: extracted.po_number || null, applied_value: extracted.po_number || null },
            { field_name: "company_name", source_value: extracted.company_name || null, applied_value: extracted.company_name || null },
          ].map((r) => ({
            ...r,
            invoice_id: inv.id,
            user_id: accountId,
            source_type: contract ? "ocr_contract" : "ai_extract",
            source_contract_id: contract?.id || null,
            source_schedule_id: scheduleId || null,
            source_reference: fileName || "OCR upload",
            duplicate_of_invoice_id: dupes && dupes.length > 0 ? dupes[0].id : null,
            notes: dupes && dupes.length > 0 ? `Possible duplicate of invoice ${dupes[0].invoice_number}` : null,
          }));
          await supabase.from("invoice_data_audit").insert(auditRows);
        } else if ((iErr as any)?.code === "23505") {
          log("Duplicate invoice on OCR upload — treating as success");
        } else if (iErr) {
          log("Invoice insert failed", { error: iErr.message });
        }
      }
    }

    // Charge platform credits (1 credit / page). Auto-accrues to overage if balance is empty.
    const creditsToCharge = pageCount * CREDITS_PER_PAGE;
    let ledgerId: string | null = null;
    let chargeMethod: "credits" | "overage" | null = null;
    let chargeError: string | null = null;
    try {
      const { data: consume, error: consErr } = await supabase.rpc(
        "consume_platform_credits",
        {
          _account_id: accountId,
          _amount: creditsToCharge,
          _service: "smart_ingestion",
          _user_id: user.id,
          _reference_id: invoiceId || contractImportId || null,
          _note: `Smart Ingestion — ${fileName || "document"} (${pageCount} pg)`,
        },
      );
      if (consErr) throw consErr;
      ledgerId = (consume as any)?.ledger_id ?? null;
      chargeMethod = ((consume as any)?.method ?? null) as "credits" | "overage" | null;
    } catch (e: any) {
      chargeError = e?.message || String(e);
      log("Credit consume failed", { error: chargeError });
    }

    // Record activity event (linked to its ledger entry)
    const totalCents = pageCount * UNIT_PRICE_CENTS;
    const { data: usageRow } = await supabase
      .from("ocr_usage_events")
      .insert({
        user_id: user.id,
        account_id: accountId,
        source: contractImportId ? "contract_invoice_upload" : "invoice_upload",
        file_name: fileName || null,
        page_count: pageCount,
        unit_price_cents: UNIT_PRICE_CENTS,
        total_cents: totalCents,
        stripe_reported: ledgerId !== null, // legacy flag — true once metered via credits
        ledger_id: ledgerId,
        contract_id: contractImportId || null,
        invoice_id: invoiceId,
        metadata: chargeError ? { credit_error: chargeError } : { method: chargeMethod },
      })
      .select()
      .single();

    // In-app alert for the uploader
    await supabase.from("user_alerts").insert({
      user_id: user.id,
      alert_type: "ocr_scan_completed",
      severity: "info",
      title: `Smart Ingestion — ${pageCount} page${pageCount === 1 ? "" : "s"} (${creditsToCharge} credit${creditsToCharge === 1 ? "" : "s"})`,
      message: chargeMethod === "overage"
        ? `Scanned ${fileName || "document"}: ${creditsToCharge} credits accrued as overage ($${(totalCents / 100).toFixed(2)}).`
        : `Scanned ${fileName || "document"}: ${creditsToCharge} credits drawn from your balance.`,
      action_url: contractImportId
        ? `/contracts/live/${contractImportId}`
        : invoiceId
          ? `/invoices?invoice=${invoiceId}`
          : "/billing?tab=credits",
      action_label: contractImportId ? "Open contract" : invoiceId ? "View invoice" : "View credits",
      invoice_id: invoiceId,
      metadata: { page_count: pageCount, credits: creditsToCharge, method: chargeMethod },
    });

    return json({
      success: true,
      pageCount,
      creditsCharged: creditsToCharge,
      method: chargeMethod,
      ledgerId,
      totalCents,
      pricePerPageCents: UNIT_PRICE_CENTS,
      extracted,
      invoiceId,
      usageEventId: usageRow?.id,
      chargeError,
    });
  } catch (e: any) {
    console.error("ocr-invoice-upload error", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
