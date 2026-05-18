import { createClient } from "npm:@supabase/supabase-js@2";
import { classifyLineItem, revenueTypeFor } from "../_shared/contractMetrics.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) => console.log(`[LC-EXTRACT] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const UNIT_PRICE_CENTS = 100; // $1.00/page for display; actual billing is 1 credit/page
const CREDITS_PER_PAGE = 1;

function detectPdfPageCount(pdfBytes: Uint8Array): number {
  try {
    const decoder = new TextDecoder("latin1");
    const pdfText = decoder.decode(pdfBytes);
    const nMatches = [...pdfText.matchAll(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nMatches.length > 0) return Math.max(...nMatches);
    const pageMatches = pdfText.match(/\/Type\s*\/Page(?!s)/g);
    if (pageMatches && pageMatches.length > 0) return pageMatches.length;
  } catch (_) { /* ignore */ }
  return 1;
}

/**
 * Records contract OCR usage as a platform-credit consumption.
 * Idempotent per contract import.
 */
async function recordContractUsage(
  supabase: any,
  args: { userId: string; accountId: string; importId: string; fileName: string | null; pageCount: number },
) {
  // Bill every extraction run (including re-scans / re-assessments). Each AI pass
  // consumes a fresh page-count worth of credits.

  const pages = Math.max(1, args.pageCount);
  const credits = pages * CREDITS_PER_PAGE;
  const totalCents = pages * UNIT_PRICE_CENTS;

  let ledgerId: string | null = null;
  let method: string | null = null;
  let chargeError: string | null = null;
  try {
    const { data: consume, error: consErr } = await supabase.rpc(
      "consume_platform_credits",
      {
        _account_id: args.accountId,
        _amount: credits,
        _service: "smart_ingestion",
        _user_id: args.userId,
        _reference_id: args.importId,
        _note: `Smart Ingestion (contract) — ${args.fileName || "document"} (${pages} pg)`,
      },
    );
    if (consErr) throw consErr;
    ledgerId = (consume as any)?.ledger_id ?? null;
    method = (consume as any)?.method ?? null;
  } catch (e: any) {
    chargeError = e?.message || String(e);
    log("Credit consume failed", { error: chargeError });
  }

  const { error } = await supabase.from("ocr_usage_events").insert({
    user_id: args.userId,
    account_id: args.accountId,
    source: "contract_extract",
    file_name: args.fileName,
    page_count: pages,
    unit_price_cents: UNIT_PRICE_CENTS,
    total_cents: totalCents,
    stripe_reported: ledgerId !== null,
    ledger_id: ledgerId,
    contract_id: args.importId,
    metadata: chargeError ? { credit_error: chargeError } : { method },
  });
  if (error) log("Usage insert failed", { error: error.message });
  else log("Usage recorded", { pages, credits, method });
}

function parseJsonFromText(text: string, label: string): any {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();

  if (!cleaned) throw new Error(`${label} returned an empty response`);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[\[{]/);
    if (start === -1) throw new Error(`${label} returned non-JSON content: ${cleaned.slice(0, 180)}`);

    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (end <= start) throw new Error(`${label} returned malformed JSON: ${cleaned.slice(0, 180)}`);

    const candidate = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(candidate);
    } catch (e) {
      throw new Error(`${label} returned invalid JSON: ${String(e)}`);
    }
  }
}

async function parseJsonResponse(res: Response, label: string): Promise<any> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} ${res.status}: ${text.slice(0, 500)}`);
  return parseJsonFromText(text, label);
}

async function refreshToken(supabase: any, conn: any, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: conn.refresh_token, grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh: ${JSON.stringify(data)}`);
  await supabase.from("drive_connections").update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq("id", conn.id);
  return data.access_token;
}

async function fetchDriveFileText(fileId: string, mimeType: string, accessToken: string): Promise<string> {
  // Google Docs → export as text
  if (mimeType === "application/vnd.google-apps.document") {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error(`Drive export failed: ${r.status}`);
    return await r.text();
  }
  // Other files: download bytes; for PDF/DOCX we send to AI as base64-attached note
  // For brevity and reliability, just attempt to interpret as text or return marker
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Drive download failed: ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  // Best-effort text extraction: attempt utf8 decode (works for plain text only).
  // PDFs/DOCX will produce gibberish — we still pass first 200KB to AI which can often pick up textual fragments.
  // (Production OCR is a separate worker; this keeps the function self-contained.)
  try {
    const slice = buf.slice(0, 200_000);
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    return "";
  }
}

const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_contract",
    description: "Extract structured contract data",
    parameters: {
      type: "object",
      properties: {
        confidence: { type: "number", description: "0-100 overall extraction confidence" },
        customer: {
          type: "object",
          properties: {
            legal_name: { type: "string" }, dba_name: { type: "string" },
            billing_entity: { type: "string" }, address: { type: "string" },
            primary_contact: { type: "string" }, billing_contact: { type: "string" },
            legal_contact: { type: "string" }, procurement_contact: { type: "string" },
            email_domain: { type: "string" }, tax_id: { type: "string" },
          },
        },
        contract: {
          type: "object",
          properties: {
            contract_name: { type: "string", description: "Short, human-friendly contract title (e.g. product/service + customer). Avoid concatenating multiple legal entity names." },
            contract_type: { type: "string" },
            product_description: { type: "string", description: "Plain-language summary of the products/services delivered under this contract (1-3 sentences)." },
            contract_value: { type: "number", description: "Total contract value in numeric form (no currency symbol)." },
            effective_date: { type: "string" }, term_start_date: { type: "string" },
            term_end_date: { type: "string" }, initial_term: { type: "string" },
            renewal_term: { type: "string" }, auto_renewal: { type: "boolean" },
            renewal_frequency: { type: "string" }, governing_agreement: { type: "string" },
            parent_agreement: { type: "string" }, contract_status: { type: "string" },
            signed_date: { type: "string" },
          },
        },
        commercial: {
          type: "object",
          properties: {
            arr: { type: "number" }, acv: { type: "number" }, tcv: { type: "number" },
            mrr: { type: "number" }, subscription_fees: { type: "number" },
            platform_fees: { type: "number" }, usage_commitment: { type: "string" },
            minimum_commitment: { type: "number" }, professional_services_fees: { type: "number" },
            implementation_fees: { type: "number", description: "Sum of one-time implementation/setup/onboarding/kickoff/deployment fees. Include even if labeled differently (e.g. 'professional services setup', 'configuration fee', 'enablement fee')." },
            one_time_fees: { type: "number" },
            recurring_fees: { type: "number" }, currency: { type: "string" },
          },
        },
        one_time_fees_breakdown: {
          type: "array",
          description: "Itemized list of every one-time / non-recurring charge in the contract (implementation, setup, onboarding, kickoff, training, migration, professional services, hardware, license activation, etc.). Each row should become its own one-time invoice line.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Human label as it appears in the contract (e.g. 'Implementation Fee', 'Onboarding & Setup')." },
              amount: { type: "number" },
              currency: { type: "string" },
              scheduled_date: { type: "string", description: "When this fee is invoiced. Default to contract effective_date when contract says 'due at signing' / 'invoiced upon execution'." },
              category: { type: "string", description: "implementation | setup | onboarding | professional_services | training | hardware | migration | other_one_time" },
              notes: { type: "string" },
            },
            required: ["label", "amount"],
          },
        },
        critical_dates: {
          type: "object",
          properties: {
            renewal_date: { type: "string" }, opt_out_deadline: { type: "string" },
            non_renewal_deadline: { type: "string" }, termination_notice_deadline: { type: "string" },
            notice_period_days: { type: "number" },
          },
        },
        invoice_schedule: {
          type: "array",
          items: {
            type: "object",
            properties: {
              scheduled_date: { type: "string" }, service_period_start: { type: "string" },
              service_period_end: { type: "string" }, amount: { type: "number" },
              currency: { type: "string" }, billing_type: { type: "string" },
              payment_terms: { type: "string" }, description: { type: "string" },
              product_description: { type: "string" },
              quantity: { type: "number" }, unit_price: { type: "number" },
            },
          },
        },
        legal: {
          type: "object",
          properties: {
            termination_for_convenience: { type: "string" }, termination_for_cause: { type: "string" },
            opt_out_rights: { type: "string" }, non_renewal_language: { type: "string" },
            auto_renewal_language: { type: "string" }, limitation_of_liability: { type: "string" },
            indemnification: { type: "string" }, data_protection: { type: "string" },
            security_obligations: { type: "string" }, sla_obligations: { type: "string" },
            service_credits: { type: "string" }, customer_obligations: { type: "string" },
            vendor_obligations: { type: "string" }, unusual_terms: { type: "string" },
          },
        },
        poc: {
          type: "object",
          properties: {
            is_poc: { type: "boolean" }, poc_start: { type: "string" }, poc_end: { type: "string" },
            conversion_terms: { type: "string" }, pilot_fee: { type: "number" },
            success_criteria: { type: "string" }, termination_rights: { type: "string" },
            conversion_language: { type: "string" },
          },
        },
        risk_flags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              flag_type: { type: "string" }, severity: { type: "string", enum: ["low","medium","high","critical"] },
              description: { type: "string" }, source_field: { type: "string" },
            },
            required: ["flag_type","severity","description"],
          },
        },
      },
      required: ["confidence"],
    },
  },
};

function calcDate(d?: string): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function fmtDate(d: Date): string { return d.toISOString().slice(0, 10); }

function normalizeCompanyName(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|llc|l\.l\.c|corp|corporation|co|company|ltd|limited|plc|systems|system)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmailDomain(value?: string | null): string | null {
  const text = String(value || "").toLowerCase();
  const match = text.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i);
  if (match?.[1]) return match[1].replace(/^www\./, "");
  const domain = text.replace(/^@/, "").replace(/^www\./, "").trim();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? domain : null;
}

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter((t) => t.length > 2));
  const bTokens = new Set(b.split(" ").filter((t) => t.length > 2));
  if (!aTokens.size || !bTokens.size) return 0;
  let matches = 0;
  for (const token of aTokens) if (bTokens.has(token)) matches += 1;
  return matches / Math.max(aTokens.size, bTokens.size);
}

function scoreCustomerMatch(cust: any, debtor: any): { score: number; reason: string } {
  const extractedNames = [cust.legal_name, cust.dba_name, cust.billing_entity].filter(Boolean).map(normalizeCompanyName);
  const debtorNames = [debtor.company_name, debtor.name].filter(Boolean).map(normalizeCompanyName);
  let best = { score: 0, reason: "" };

  for (const extracted of extractedNames) {
    for (const candidate of debtorNames) {
      if (!extracted || !candidate) continue;
      if (extracted === candidate) best = { score: Math.max(best.score, 95), reason: "company_name_exact" };
      else if (extracted.length > 6 && candidate.length > 6 && (extracted.includes(candidate) || candidate.includes(extracted))) {
        best = { score: Math.max(best.score, 85), reason: "company_name_partial" };
      } else {
        const overlap = tokenOverlap(extracted, candidate);
        if (overlap >= 0.75) best = { score: Math.max(best.score, 75), reason: "company_name_token_match" };
        else if (overlap >= 0.5) best = { score: Math.max(best.score, 60), reason: "company_name_possible_match" };
      }
    }
  }

  const extractedDomains = [cust.email_domain, cust.billing_contact, cust.primary_contact, cust.legal_contact, cust.procurement_contact]
    .map(extractEmailDomain)
    .filter(Boolean);
  const debtorDomain = extractEmailDomain(debtor.email);
  if (debtorDomain && extractedDomains.includes(debtorDomain) && !["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"].includes(debtorDomain)) {
    best = { score: Math.max(best.score, 90), reason: best.score ? `${best.reason}+email_domain` : "email_domain" };
  }

  return best;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { importId } = await req.json();
    if (!importId) throw new Error("importId required");

    const { data: imp } = await supabase.from("live_contract_imports").select("*").eq("id", importId).single();
    if (!imp) throw new Error("Import not found");

    await supabase.from("live_contract_imports").update({ status: "ai_extracting" }).eq("id", imp.id);

    // Get document text
    let text = "";
    let pageCount = 1; // for AI Smart Ingestion usage tracking
    if (imp.source === "drive" && imp.drive_file_id) {
      const { data: folder } = await supabase.from("live_contract_drive_folders").select("connection_id").eq("id", imp.folder_id).single();
      const { data: conn } = await supabase.from("drive_connections").select("*").eq("id", folder!.connection_id).single();
      let token = conn!.access_token;
      if (conn!.token_expires_at && new Date(conn!.token_expires_at) <= new Date()) {
        token = await refreshToken(supabase, conn, clientId, clientSecret);
      }
      text = await fetchDriveFileText(imp.drive_file_id, imp.mime_type || "", token);
      // Estimate pages from extracted text length (~3000 chars/page) for Drive sources
      pageCount = Math.max(1, Math.ceil((text?.length || 0) / 3000));
    } else if (imp.storage_path) {
      const { data: file } = await supabase.storage.from("live-contracts").download(imp.storage_path);
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const mime = (imp.mime_type || "").toLowerCase();
        const name = (imp.file_name || "").toLowerCase();
        const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
        const isDocx = mime.includes("officedocument.wordprocessingml") || name.endsWith(".docx");

        if (isPdf) {
          await supabase.from("live_contract_imports").update({ status: "ocr_processing" }).eq("id", imp.id);
          // Detect pages from raw bytes (works even if pdf-parse fails)
          pageCount = detectPdfPageCount(buf);
          try {
            const pdfParse = (await import("npm:pdf-parse@1.1.1/lib/pdf-parse.js")).default;
            const { Buffer } = await import("node:buffer");
            const parsed = await pdfParse(Buffer.from(buf));
            text = parsed.text || "";
            if (parsed.numpages && parsed.numpages > 0) pageCount = parsed.numpages;
            log("PDF parsed", { len: text.length, pages: pageCount });
          } catch (e) {
            log("pdf-parse failed", { err: String(e), pages: pageCount });
          }

          // OCR fallback via Lovable AI Gateway (Gemini multimodal) for scanned PDFs
          const letters = (text.match(/[a-zA-Z]/g) || []).length;
          if (text.length < 500 || letters < 100) {
            log("Native PDF text low-quality, trying vision OCR");
            try {
              let bin = "";
              for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
              const b64 = btoa(bin);
              const visionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [{
                    role: "user",
                    content: [
                      { type: "text", text: "Extract ALL text from this contract PDF. Return only the raw extracted text, preserving order." },
                      { type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } },
                    ],
                  }],
                }),
              });
              if (visionRes.ok) {
                const vd = await parseJsonResponse(visionRes, "Vision OCR");
                const visionText = vd.choices?.[0]?.message?.content || "";
                if (visionText.length > text.length) text = visionText;
                log("Vision OCR done", { len: text.length });
              } else {
                log("Vision OCR failed", { status: visionRes.status, body: await visionRes.text() });
              }
            } catch (e) {
              log("Vision OCR error", { err: String(e) });
            }
          }
        } else if (isDocx) {
          // DOCX: best-effort, decode embedded XML strings
          text = new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          pageCount = Math.max(1, Math.ceil(text.length / 3000));
        } else {
          text = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 200_000));
          pageCount = Math.max(1, Math.ceil(text.length / 3000));
        }
      }
    }

    if (!text || text.length < 50) {
      await supabase.from("live_contract_imports").update({ status: "failed", error: "Could not extract text from file" }).eq("id", imp.id);
      throw new Error("No extractable text. The PDF appears to be empty or unreadable.");
    }

    log("Calling AI", { textLen: text.length });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "You are a senior contracts analyst. Extract structured data from the contract with rigor. For unknown fields use null. Return ISO dates (YYYY-MM-DD).\n\nCRITICAL — ONE-TIME / IMPLEMENTATION FEES: Many SaaS and services contracts contain non-recurring charges that are easy to miss because they sit inside a pricing table or schedule. You MUST surface EVERY one-time charge in BOTH (a) `commercial.implementation_fees` (sum) and (b) `one_time_fees_breakdown` (itemized). Look for headings/labels like: Implementation Fee, Setup Fee, Onboarding Fee, Kickoff Fee, Activation Fee, Configuration Fee, Enablement Fee, Deployment Fee, Migration Fee, Training Fee, Hardware Charge, License Activation, Professional Services (when listed as a fixed amount rather than hourly recurring), Statement of Work Fixed Fee, Travel & Expense estimate. Treat these as one-time invoices on the contract effective_date unless the contract specifies a different invoicing date. ALSO emit them inside `invoice_schedule` with billing_type=\"one_time\".\n\nRisk-flag any of: auto-renewal without clear opt-out, missing BAA/DPA/SLA, unfavorable payment terms (>net 45), POC without conversion terms, uncapped indemnity, missing liability cap.\n\nINVOICE SCHEDULE DISCIPLINE: list each scheduled invoice exactly once. Do NOT duplicate a prepaid/upfront invoice as both a one-time prepaid line and as the first period of the recurring schedule — pick one representation. Two schedule entries must never share the same scheduled_date AND amount unless the contract explicitly issues two separate invoices on that date." },
          { role: "user", content: `Contract text:\n\n${text.slice(0, 100_000)}` },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "function", function: { name: "extract_contract" } },
      }),
    });

    let aiData: any;
    try {
      aiData = await parseJsonResponse(aiRes, "AI extraction");
    } catch (e) {
      await supabase.from("live_contract_imports").update({ status: "failed", error: String(e).slice(0, 500) }).eq("id", imp.id);
      throw e;
    }
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");
    const extracted = typeof toolCall.function.arguments === "string"
      ? parseJsonFromText(toolCall.function.arguments, "AI tool arguments")
      : toolCall.function.arguments;

    // Idempotency: clear derived rows that are safe to fully regenerate on re-extract.
    // NOTE: We intentionally DO NOT wipe `contract_invoice_schedules` or
    // `contract_critical_dates` here — those are merged below so user edits
    // (category overrides, notification settings, attached invoices) survive.
    // We also DO NOT wipe risk flags the user resolved/dismissed, and we
    // preserve user-edited extracted_fields (edited_by_user IS NOT NULL).
    const { data: preservedFields } = await supabase
      .from("live_contract_extracted_fields")
      .select("field_group, field_key, field_value, field_value_json, edited_by_user, approved")
      .eq("import_id", imp.id)
      .not("edited_by_user", "is", null);
    const preservedFieldKeys = new Set<string>(
      (preservedFields || []).map((r: any) => `${r.field_group}|${r.field_key}`),
    );

    await Promise.all([
      supabase.from("live_contract_extracted_fields").delete().eq("import_id", imp.id),
      supabase.from("contract_risk_flags").delete().eq("import_id", imp.id).eq("resolved", false),
      supabase.from("contract_poc_details").delete().eq("import_id", imp.id),
      supabase.from("contract_customer_matches").delete().eq("import_id", imp.id),
      supabase.from("live_contract_extractions").delete().eq("import_id", imp.id),
    ]);

    // Persist extraction
    const { data: extractionRow, error: extractionErr } = await supabase.from("live_contract_extractions").insert({
      account_id: imp.account_id, import_id: imp.id,
      raw_text: text.slice(0, 50_000), ai_response: extracted,
      model: "google/gemini-2.5-pro",
    }).select().single();
    if (extractionErr || !extractionRow) {
      const msg = `Failed to persist extraction: ${extractionErr?.message || "no row returned"}`;
      log("Persist extraction failed", { error: extractionErr });
      await supabase.from("live_contract_imports").update({ status: "failed", error: msg.slice(0, 500) }).eq("id", imp.id);
      throw new Error(msg);
    }

    // Field rows
    const fieldRows: any[] = [];
    const pushFields = (group: string, obj: any) => {
      if (!obj) return;
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || v === "") continue;
        if (preservedFieldKeys.has(`${group}|${k}`)) continue; // user edited — skip AI overwrite
        fieldRows.push({
          account_id: imp.account_id, extraction_id: extractionRow.id, import_id: imp.id,
          field_group: group, field_key: k,
          field_value: typeof v === "object" ? null : String(v),
          field_value_json: typeof v === "object" ? v : null,
          confidence: extracted.confidence || null,
        });
      }
    };
    pushFields("customer", extracted.customer);
    pushFields("contract", extracted.contract);
    pushFields("commercial", extracted.commercial);
    pushFields("dates", extracted.critical_dates);
    pushFields("legal", extracted.legal);
    pushFields("poc", extracted.poc);
    // Restore user-edited rows verbatim.
    for (const r of preservedFields || []) {
      fieldRows.push({
        account_id: imp.account_id, extraction_id: extractionRow.id, import_id: imp.id,
        field_group: r.field_group, field_key: r.field_key,
        field_value: r.field_value, field_value_json: r.field_value_json,
        confidence: null, edited_by_user: r.edited_by_user, approved: r.approved,
      });
    }
    if (fieldRows.length) await supabase.from("live_contract_extracted_fields").insert(fieldRows);

    // Fold one_time_fees_breakdown into invoice_schedule (so each appears as its own line)
    if (Array.isArray(extracted.one_time_fees_breakdown) && extracted.one_time_fees_breakdown.length) {
      const fallbackDate = extracted.contract?.effective_date || extracted.contract?.signed_date || new Date().toISOString().slice(0, 10);
      extracted.invoice_schedule = extracted.invoice_schedule || [];
      for (const fee of extracted.one_time_fees_breakdown) {
        if (!fee?.amount) continue;
        extracted.invoice_schedule.push({
          scheduled_date: fee.scheduled_date || fallbackDate,
          amount: fee.amount,
          currency: fee.currency || extracted.commercial?.currency || "USD",
          billing_type: "one_time",
          description: fee.label || "One-time fee",
          product_description: fee.label || fee.notes || "One-time fee",
          product_category: fee.category || "implementation",
        });
      }
    }

    // Industry hint for line-item classification fallback
    const industryHint =
      extracted.contract?.industry ||
      extracted.business?.industry ||
      extracted.customer?.industry ||
      extracted.commercial?.industry ||
      null;

    // Critical dates with computed deadlines
    const dates: any[] = [];
    const cd = extracted.critical_dates || {};
    // Default to a 90-day non-renewal notice window when the contract doesn't
    // explicitly state one — every contract should have a notice-window alert.
    const rawNoticeDays = Number(cd.notice_period_days) || 0;
    const noticeDays = rawNoticeDays > 0 ? rawNoticeDays : 90;
    const noticeDefaulted = rawNoticeDays <= 0;
    const termStart = calcDate(extracted.contract?.effective_date);
    const termEnd = calcDate(extracted.contract?.term_end_date);
    const renewalDate = calcDate(cd.renewal_date) || termEnd;
    if (termStart) dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "term_start", due_date: fmtDate(termStart) });
    if (renewalDate) {
      dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "renewal", due_date: fmtDate(renewalDate), notice_days: noticeDays });
      const optOut = new Date(renewalDate);
      optOut.setDate(optOut.getDate() - noticeDays);
      dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "opt_out_deadline", due_date: fmtDate(optOut), notice_days: noticeDays });
      // "Non-renewal notice period start" — opens the notice window so the team
      // has a reminder to begin preparing the non-renewal letter. Always added
      // (using a 90-day default) so every contract has this alert capability.
      dates.push({
        account_id: imp.account_id,
        import_id: imp.id,
        date_type: "non_renewal_notice_start",
        due_date: fmtDate(optOut),
        notice_days: noticeDays,
      });
    }
    if (termEnd) dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "term_end", due_date: fmtDate(termEnd) });
    if (extracted.poc?.poc_end) {
      const pe = calcDate(extracted.poc.poc_end);
      if (pe) dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "poc_end", due_date: fmtDate(pe) });
    }
    // Risk levels + dedupe
    const seenDate = new Set<string>();
    const dedupedDates = dates.filter((d) => {
      const k = `${d.date_type}|${d.due_date}`;
      if (seenDate.has(k)) return false;
      seenDate.add(k);
      return true;
    });
    for (const d of dedupedDates) {
      const days = Math.floor((new Date(d.due_date).getTime() - Date.now()) / 86400000);
      d.risk_level = days < 30 ? "high" : days < 90 ? "medium" : "low";
    }
    // Merge critical dates: update existing rows by (date_type, due_date) and
    // insert only missing rows. Preserves user-configured notify_emails /
    // notify_channel / alert_enabled / alert_lead_days.
    {
      const { data: existingDates } = await supabase
        .from("contract_critical_dates")
        .select("id, date_type, due_date, notify_emails, notify_channel, alert_enabled, alert_lead_days")
        .eq("import_id", imp.id);
      const existingMap = new Map<string, any>();
      (existingDates || []).forEach((r: any) => existingMap.set(`${r.date_type}|${r.due_date}`, r));
      const newKeys = new Set<string>();
      const toInsert: any[] = [];
      for (const d of dedupedDates) {
        const key = `${d.date_type}|${d.due_date}`;
        newKeys.add(key);
        const existing = existingMap.get(key);
        if (existing) {
          await supabase.from("contract_critical_dates").update({
            notice_days: d.notice_days ?? null,
            risk_level: d.risk_level,
          }).eq("id", existing.id);
        } else {
          toInsert.push(d);
        }
      }
      if (toInsert.length) await supabase.from("contract_critical_dates").insert(toInsert);
      // Remove stale rows ONLY if user has not configured notifications on them.
      const stale = (existingDates || []).filter((r: any) => {
        if (newKeys.has(`${r.date_type}|${r.due_date}`)) return false;
        const hasCustom = (Array.isArray(r.notify_emails) && r.notify_emails.length > 0)
          || (r.notify_channel && r.notify_channel !== "in_app")
          || r.alert_enabled === true;
        return !hasCustom;
      }).map((r: any) => r.id);
      if (stale.length) await supabase.from("contract_critical_dates").delete().in("id", stale);
    }

    // Invoice schedules — MERGE not replace. On reassessment we want to capture
    // changes against the existing schedule, not regenerate a new event/workflow.
    const sched = extracted.invoice_schedule || [];
    if (Array.isArray(sched) && sched.length) {
      const normDesc = (s: string | null | undefined) =>
        (s || "").toLowerCase().replace(/\s+/g, " ").trim();
      const keyOf = (r: { scheduled_date: string; amount: any; product_description: any; service_period_start?: any }) => {
        const amt = r.amount == null ? "null" : Number(r.amount).toFixed(2);
        return `${r.scheduled_date}|${amt}|${normDesc(r.product_description)}|${r.service_period_start || ""}`;
      };
      const seen = new Set<string>();
      const rows = sched
        .filter((s: any) => s.scheduled_date)
        .map((s: any) => {
          const desc = s.product_description || s.description || extracted.contract?.product_description || null;
          let category: string | null = s.product_category || s.category || null;
          let categorySource: "extracted" | "industry_default" | "keyword" | null = category ? "extracted" : null;
          if (!category) {
            const cls = classifyLineItem({ description: desc, billing_type: s.billing_type, industry: industryHint });
            if (cls.category) {
              category = cls.category;
              categorySource = cls.source === "industry" ? "industry_default" : "keyword";
            }
          }
          const revenueType = category ? revenueTypeFor(category as any) : null;
          return {
            account_id: imp.account_id, import_id: imp.id,
            scheduled_date: s.scheduled_date,
            service_period_start: s.service_period_start || null,
            service_period_end: s.service_period_end || null,
            amount: s.amount || null,
            currency: s.currency || extracted.commercial?.currency || "USD",
            billing_type: s.billing_type || null,
            payment_terms: s.payment_terms || null,
            expected_due_date: s.scheduled_date,
            description: s.description || s.product_description || null,
            product_description: desc,
            quantity: s.quantity ?? null,
            unit_price: s.unit_price ?? null,
            product_category: category,
            revenue_type: revenueType,
            category_source: categorySource,
          };
        })
        // In-batch dedup: identical (date + amount + description) collapses;
        // also collapse a null-amount row when a same-date+description row with
        // an amount already exists.
        .filter((r) => {
          const key = keyOf(r);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      // Collapse null-amount duplicates that pair with a priced row on the
      // same date + description (common AI artefact, e.g. "Prepaid Services"
      // emitted twice — once with the amount, once as a placeholder).
      const pricedDescDates = new Set(
        rows.filter((r) => r.amount != null).map((r) => `${r.scheduled_date}|${normDesc(r.product_description)}`)
      );
      const dedupedRows = rows.filter(
        (r) => !(r.amount == null && pricedDescDates.has(`${r.scheduled_date}|${normDesc(r.product_description)}`))
      );

      // Fetch existing rows for this import that are still editable (no invoice issued yet).
      const { data: existing } = await supabase
        .from("contract_invoice_schedules")
        .select("id, scheduled_date, amount, product_description, description, service_period_start, category_source, invoice_id")
        .eq("import_id", imp.id);
      const existingEditable = (existing || []).filter((r: any) => !r.invoice_id);
      const existingByKey = new Map<string, any>();
      for (const r of existingEditable) {
        existingByKey.set(
          keyOf({
            scheduled_date: r.scheduled_date,
            amount: r.amount,
            product_description: r.product_description || r.description,
            service_period_start: r.service_period_start,
          }),
          r,
        );
      }

      const newKeys = new Set<string>();
      const toInsert: any[] = [];
      for (const r of dedupedRows) {
        const k = keyOf(r);
        newKeys.add(k);
        const ex = existingByKey.get(k);
        if (ex) {
          // Update non-user-overridden fields. Preserve category if user set it.
          const patch: any = {
            currency: r.currency,
            billing_type: r.billing_type,
            payment_terms: r.payment_terms,
            expected_due_date: r.expected_due_date,
            service_period_end: r.service_period_end,
            quantity: r.quantity,
            unit_price: r.unit_price,
          };
          if (ex.category_source !== "user") {
            patch.product_category = r.product_category;
            patch.revenue_type = r.revenue_type;
            patch.category_source = r.category_source;
          }
          await supabase.from("contract_invoice_schedules").update(patch).eq("id", ex.id);
        } else {
          toInsert.push(r);
        }
      }
      if (toInsert.length) {
        await supabase.from("contract_invoice_schedules").insert(toInsert);
      }
      // Remove stale extracted rows that are no longer in the new schedule,
      // but never touch user-edited rows or rows tied to an invoice.
      const staleIds = existingEditable
        .filter((r: any) => {
          if (r.category_source === "user") return false;
          const k = keyOf({
            scheduled_date: r.scheduled_date,
            amount: r.amount,
            product_description: r.product_description || r.description,
            service_period_start: r.service_period_start,
          });
          return !newKeys.has(k);
        })
        .map((r: any) => r.id);
      if (staleIds.length) {
        await supabase.from("contract_invoice_schedules").delete().in("id", staleIds);
      }
    }

    // Risk flags
    const flags = extracted.risk_flags || [];
    if (Array.isArray(flags) && flags.length) {
      await supabase.from("contract_risk_flags").insert(
        flags.map((f: any) => ({
          account_id: imp.account_id, import_id: imp.id,
          flag_type: f.flag_type, severity: f.severity || "medium",
          description: f.description, source_field: f.source_field || null,
        }))
      );
    }

    // POC details
    if (extracted.poc?.is_poc) {
      await supabase.from("contract_poc_details").insert({
        account_id: imp.account_id, import_id: imp.id,
        poc_start: extracted.poc.poc_start || null,
        poc_end: extracted.poc.poc_end || null,
        conversion_terms: extracted.poc.conversion_terms || null,
        pilot_fee: extracted.poc.pilot_fee || null,
        success_criteria: extracted.poc.success_criteria || null,
        conversion_language: extracted.poc.conversion_language || null,
        termination_rights: extracted.poc.termination_rights || null,
      });
    }

    // Suggested customer matches against debtors table. Pull a bounded account list and
    // score in-code so minor legal suffix/name variations still match existing customers.
    const cust = extracted.customer || {};
    const { data: accountDebtors, error: debtorLookupError } = await supabase
      .from("debtors")
      .select("id,company_name,name,email")
      .eq("user_id", imp.account_id)
      .limit(1000);
    if (debtorLookupError) throw new Error(`Customer match lookup failed: ${debtorLookupError.message}`);
    const candidates = (accountDebtors || [])
      .map((d: any) => ({ debtor: d, match: scoreCustomerMatch(cust, d) }))
      .filter(({ match }: any) => match.score >= 50)
      .sort((a: any, b: any) => b.match.score - a.match.score)
      .slice(0, 5)
      .map(({ debtor, match }: any) => ({
        account_id: imp.account_id,
        import_id: imp.id,
        candidate_debtor_id: debtor.id,
        match_score: match.score,
        match_reasons: { reason: match.reason, name: debtor.company_name || debtor.name, email: debtor.email },
      }));
    if (candidates.length) {
      const { error: matchInsertError } = await supabase.from("contract_customer_matches").insert(candidates);
      if (matchInsertError) throw new Error(`Save customer matches failed: ${matchInsertError.message}`);
    }

    // Mark import for review
    const rawName = (extracted.contract?.contract_name || "").trim();
    // Guard against the model echoing concatenated party names — keep titles tidy.
    const cleanName =
      rawName && rawName.length <= 120
        ? rawName
        : rawName
          ? rawName.split(/\s+(?:and|&|\/)\s+/i)[0].slice(0, 120).trim()
          : (imp.file_name || "Untitled Contract");
    const industryRaw =
      extracted.contract?.industry ||
      extracted.business?.industry ||
      extracted.customer?.industry ||
      extracted.commercial?.industry ||
      null;
    await supabase.from("live_contract_imports").update({
      status: "needs_review",
      confidence: extracted.confidence || null,
      contract_name: cleanName,
      contract_type: extracted.contract?.contract_type || null,
      product_description: extracted.contract?.product_description || null,
      industry: industryRaw ? String(industryRaw).slice(0, 120) : null,
      contract_value:
        extracted.contract?.contract_value ??
        extracted.commercial?.tcv ??
        extracted.commercial?.acv ??
        null,
      effective_date: extracted.contract?.effective_date || null,
      term_end_date: extracted.contract?.term_end_date || null,
    }).eq("id", imp.id);

    await supabase.from("live_contract_review_queue").upsert({
      account_id: imp.account_id, import_id: imp.id, status: "pending",
    }, { onConflict: "import_id" });

    await supabase.from("live_contract_audit_log").insert({
      account_id: imp.account_id, user_id: user.id, import_id: imp.id,
      event_type: "ai_extraction_completed",
      event_details: { confidence: extracted.confidence, fields: fieldRows.length, schedules: sched.length, risks: flags.length, page_count: pageCount },
    });

    // Record AI Smart Ingestion usage (idempotent per contract import)
    await recordContractUsage(supabase, {
      userId: imp.user_id || user.id,
      accountId: imp.account_id,
      importId: imp.id,
      fileName: imp.file_name || null,
      pageCount,
    });

    // Fire-and-forget reconciliation against existing Recouply invoices.
    // Tasks are NOT created until contract is published (handled inside contract-reconcile).
    try {
      await fetch(`${supabaseUrl}/functions/v1/contract-reconcile`, {
        method: "POST",
        headers: {
          Authorization: req.headers.get("Authorization") || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ importId: imp.id, generateTasks: false }),
      });
    } catch (e) {
      log("reconcile invoke failed", { e: String(e) });
    }

    return new Response(JSON.stringify({ success: true, import_id: imp.id, confidence: extracted.confidence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    log("Error", { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
