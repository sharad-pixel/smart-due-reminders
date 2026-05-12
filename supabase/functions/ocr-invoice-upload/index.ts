import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

const PRICE_PER_PAGE_CENTS = 75;
const STRIPE_METER_EVENT_NAME = "ocr_pages";

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

async function reportStripeMeter(params: {
  stripeKey: string;
  email: string;
  pages: number;
}): Promise<{ id?: string; reported: boolean; error?: string }> {
  try {
    const stripe = new Stripe(params.stripeKey, {
      apiVersion: "2025-08-27.basil",
    });
    // Resolve the customer
    const customers = await stripe.customers.list({
      email: params.email,
      limit: 1,
    });
    if (customers.data.length === 0) {
      return { reported: false, error: "No Stripe customer found" };
    }
    const customer = customers.data[0];
    // Use modern billing meter events
    const ev = await (stripe as any).billing.meterEvents.create({
      event_name: STRIPE_METER_EVENT_NAME,
      payload: {
        stripe_customer_id: customer.id,
        value: String(params.pages),
      },
    });
    return { id: ev.identifier || ev.id, reported: true };
  } catch (e: any) {
    log("Stripe meter report failed", { error: e?.message || String(e) });
    return { reported: false, error: e?.message || String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

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
        const refId = `OCR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const invNumber = extracted.invoice_number || refId;

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
        } else if ((iErr as any)?.code === "23505") {
          log("Duplicate invoice on OCR upload — treating as success");
        } else if (iErr) {
          log("Invoice insert failed", { error: iErr.message });
        }
      }
    }

    // Report Stripe meter (best effort)
    let meterResult: { id?: string; reported: boolean; error?: string } = { reported: false };
    if (stripeKey) {
      meterResult = await reportStripeMeter({
        stripeKey,
        email: user.email,
        pages: pageCount,
      });
    }

    // Record usage event (source of truth, regardless of Stripe success)
    const totalCents = pageCount * PRICE_PER_PAGE_CENTS;
    const { data: usageRow } = await supabase
      .from("ocr_usage_events")
      .insert({
        user_id: user.id,
        account_id: accountId,
        source: contractImportId ? "contract_invoice_upload" : "invoice_upload",
        file_name: fileName || null,
        page_count: pageCount,
        unit_price_cents: PRICE_PER_PAGE_CENTS,
        total_cents: totalCents,
        stripe_meter_event_id: meterResult.id || null,
        stripe_reported: meterResult.reported,
        contract_id: contractImportId || null,
        invoice_id: invoiceId,
        metadata: meterResult.error ? { stripe_error: meterResult.error } : null,
      })
      .select()
      .single();

    // In-app alert for the uploader
    await supabase.from("user_alerts").insert({
      user_id: user.id,
      alert_type: "ocr_scan_completed",
      severity: "info",
      title: `OCR scan complete — ${pageCount} page${pageCount === 1 ? "" : "s"}`,
      message: `Scanned ${fileName || "document"}: $${(totalCents / 100).toFixed(2)} ($${(PRICE_PER_PAGE_CENTS / 100).toFixed(2)}/page).`,
      action_url: contractImportId
        ? `/contracts/live/${contractImportId}`
        : invoiceId
          ? `/invoices?invoice=${invoiceId}`
          : "/settings/billing",
      action_label: contractImportId ? "Open contract" : invoiceId ? "View invoice" : "View usage",
      invoice_id: invoiceId,
      metadata: { page_count: pageCount, total_cents: totalCents },
    });

    return json({
      success: true,
      pageCount,
      totalCents,
      pricePerPageCents: PRICE_PER_PAGE_CENTS,
      extracted,
      invoiceId,
      stripeReported: meterResult.reported,
      stripeError: meterResult.error || null,
      usageEventId: usageRow?.id,
    });
  } catch (e: any) {
    console.error("ocr-invoice-upload error", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
