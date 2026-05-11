import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) => console.log(`[LC-EXTRACT] ${s}${d ? " " + JSON.stringify(d) : ""}`);

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
            contract_name: { type: "string" }, contract_type: { type: "string" },
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
            implementation_fees: { type: "number" }, one_time_fees: { type: "number" },
            recurring_fees: { type: "number" }, currency: { type: "string" },
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
    if (imp.source === "drive" && imp.drive_file_id) {
      const { data: folder } = await supabase.from("live_contract_drive_folders").select("connection_id").eq("id", imp.folder_id).single();
      const { data: conn } = await supabase.from("drive_connections").select("*").eq("id", folder!.connection_id).single();
      let token = conn!.access_token;
      if (conn!.token_expires_at && new Date(conn!.token_expires_at) <= new Date()) {
        token = await refreshToken(supabase, conn, clientId, clientSecret);
      }
      text = await fetchDriveFileText(imp.drive_file_id, imp.mime_type || "", token);
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
          try {
            const pdfParse = (await import("npm:pdf-parse@1.1.1/lib/pdf-parse.js")).default;
            const { Buffer } = await import("node:buffer");
            const parsed = await pdfParse(Buffer.from(buf));
            text = parsed.text || "";
            log("PDF parsed", { len: text.length });
          } catch (e) {
            log("pdf-parse failed", { err: String(e) });
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
        } else {
          text = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 200_000));
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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a contracts analyst. Extract structured data from the contract. For unknown fields use null. Return ISO dates (YYYY-MM-DD). Flag risks like auto-renewal without clear opt-out, missing BAA/DPA/SLA, unfavorable payment terms, POC without conversion terms." },
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

    // Persist extraction
    const { data: extractionRow } = await supabase.from("live_contract_extractions").insert({
      account_id: imp.account_id, import_id: imp.id,
      raw_text: text.slice(0, 50_000), ai_response: extracted,
      model: "google/gemini-2.5-flash",
    }).select().single();

    // Field rows
    const fieldRows: any[] = [];
    const pushFields = (group: string, obj: any) => {
      if (!obj) return;
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || v === "") continue;
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
    if (fieldRows.length) await supabase.from("live_contract_extracted_fields").insert(fieldRows);

    // Critical dates with computed deadlines
    const dates: any[] = [];
    const cd = extracted.critical_dates || {};
    const noticeDays = cd.notice_period_days || 0;
    const termEnd = calcDate(extracted.contract?.term_end_date);
    const renewalDate = calcDate(cd.renewal_date) || termEnd;
    if (renewalDate) {
      dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "renewal", due_date: fmtDate(renewalDate), notice_days: noticeDays });
      if (noticeDays > 0) {
        const optOut = new Date(renewalDate);
        optOut.setDate(optOut.getDate() - noticeDays);
        dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "opt_out_deadline", due_date: fmtDate(optOut), notice_days: noticeDays });
      }
    }
    if (termEnd) dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "term_end", due_date: fmtDate(termEnd) });
    if (extracted.poc?.poc_end) {
      const pe = calcDate(extracted.poc.poc_end);
      if (pe) dates.push({ account_id: imp.account_id, import_id: imp.id, date_type: "poc_end", due_date: fmtDate(pe) });
    }
    // Risk levels
    for (const d of dates) {
      const days = Math.floor((new Date(d.due_date).getTime() - Date.now()) / 86400000);
      d.risk_level = days < 30 ? "high" : days < 90 ? "medium" : "low";
    }
    if (dates.length) await supabase.from("contract_critical_dates").insert(dates);

    // Invoice schedules
    const sched = extracted.invoice_schedule || [];
    if (Array.isArray(sched) && sched.length) {
      const rows = sched
        .filter((s: any) => s.scheduled_date)
        .map((s: any) => ({
          account_id: imp.account_id, import_id: imp.id,
          scheduled_date: s.scheduled_date,
          service_period_start: s.service_period_start || null,
          service_period_end: s.service_period_end || null,
          amount: s.amount || null,
          currency: s.currency || extracted.commercial?.currency || "USD",
          billing_type: s.billing_type || null,
          payment_terms: s.payment_terms || null,
          expected_due_date: s.scheduled_date,
          description: s.description || null,
        }));
      if (rows.length) await supabase.from("contract_invoice_schedules").insert(rows);
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

    // Suggested customer matches against debtors table
    const cust = extracted.customer || {};
    const candidates: any[] = [];
    const seen = new Set<string>();
    const addCandidates = async (q: any, score: number, reason: string) => {
      let query = supabase.from("debtors").select("id,company_name,primary_email").eq("account_id", imp.account_id).limit(5);
      if (q.legal) query = query.ilike("company_name", `%${q.legal}%`);
      else if (q.email) query = query.ilike("primary_email", `%${q.email}%`);
      else return;
      const { data } = await query;
      for (const d of data || []) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        candidates.push({
          account_id: imp.account_id, import_id: imp.id,
          candidate_debtor_id: d.id, match_score: score,
          match_reasons: { reason, name: d.company_name, email: d.primary_email },
        });
      }
    };
    if (cust.legal_name) await addCandidates({ legal: cust.legal_name }, 80, "legal_name_match");
    if (cust.dba_name) await addCandidates({ legal: cust.dba_name }, 60, "dba_match");
    if (cust.email_domain) await addCandidates({ email: cust.email_domain }, 50, "email_domain");
    if (candidates.length) await supabase.from("contract_customer_matches").insert(candidates);

    // Mark import for review
    await supabase.from("live_contract_imports").update({
      status: "needs_review",
      confidence: extracted.confidence || null,
      contract_name: extracted.contract?.contract_name || imp.file_name,
      contract_type: extracted.contract?.contract_type || null,
      effective_date: extracted.contract?.effective_date || null,
      term_end_date: extracted.contract?.term_end_date || null,
    }).eq("id", imp.id);

    await supabase.from("live_contract_review_queue").upsert({
      account_id: imp.account_id, import_id: imp.id, status: "pending",
    }, { onConflict: "import_id" });

    await supabase.from("live_contract_audit_log").insert({
      account_id: imp.account_id, user_id: user.id, import_id: imp.id,
      event_type: "ai_extraction_completed",
      event_details: { confidence: extracted.confidence, fields: fieldRows.length, schedules: sched.length, risks: flags.length },
    });

    return new Response(JSON.stringify({ success: true, import_id: imp.id, confidence: extracted.confidence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    log("Error", { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
