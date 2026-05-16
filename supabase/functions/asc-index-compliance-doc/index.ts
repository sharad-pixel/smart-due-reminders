import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an accounting policy librarian. The user is uploading a compliance / policy / standards reference document that will be used as ongoing context for ASC (US GAAP) revenue and lease assessments. Read the document and return STRICT JSON ONLY:
{
  "summary": "<3-6 sentence executive summary>",
  "doc_category": "<Revenue Policy|Lease Policy|Contract Template|SSP Methodology|Internal Memo|Standard Excerpt|Other>",
  "key_policies": [
    { "topic": "...", "policy_statement": "...", "asc_step": "Step 1|Step 2|Step 3|Step 4|Step 5|N/A" }
  ],
  "applies_to": ["ASC 606", "ASC 842", ...],
  "extracted_text": "<plain text reference extract, max ~6000 chars, capturing the operative policy language>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let docId: string | null = null;
  let admin: any = null;
  try {
    const { documentId, paymentMethod } = await req.json();
    if (!documentId) throw new Error("documentId required");
    const method = (paymentMethod ?? "credits") as "credits" | "overage";

    admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Not authenticated");

    const { data: doc, error: dErr } = await admin.from("compliance_documents").select("*").eq("id", documentId).maybeSingle();
    if (dErr || !doc) throw new Error("Document not found");
    docId = doc.id;

    const { data: isAdmin } = await admin.rpc("is_asc606_admin", { _user_id: user.id, _account_id: doc.account_id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Owner or Admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (doc.status === "indexed") {
      return new Response(JSON.stringify({ ok: true, alreadyIndexed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("compliance_documents").update({ status: "indexing", error: null }).eq("id", docId);

    // Download file
    const { data: file, error: fErr } = await admin.storage.from("compliance-documents").download(doc.storage_path);
    if (fErr || !file) throw new Error(`Failed to download document: ${fErr?.message ?? "missing"}`);
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Page count (PDF only). For non-PDF assume 1 page.
    let pageCount = 1;
    const isPdf = (doc.mime_type ?? "").includes("pdf") || (doc.file_name ?? "").toLowerCase().endsWith(".pdf");
    if (isPdf) {
      try {
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        pageCount = pdf.getPageCount();
      } catch (e) {
        console.warn("[index-compliance-doc] pdf-lib failed, defaulting to 1 page:", e);
      }
    }
    pageCount = Math.max(1, pageCount);

    // Charge credits = pageCount
    const { data: cons, error: consErr } = await admin.rpc("consume_asc606_credits", {
      _account_id: doc.account_id,
      _amount: pageCount,
      _contract_id: null,
      _assessment_id: null,
      _user_id: user.id,
    });
    if (consErr) {
      await admin.from("compliance_documents").update({ status: "failed", error: consErr.message }).eq("id", docId);
      return new Response(JSON.stringify({ error: consErr.message }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const actualMethod = (cons as any)?.method ?? method;

    // Tag the most recent ledger row for this doc
    await admin.from("asc606_credit_ledger").insert({
      account_id: doc.account_id,
      delta: 0,
      kind: "compliance_doc_indexing",
      reference_id: docId,
      service: "asc606",
      created_by: user.id,
      note: `Indexed compliance doc "${doc.title}" — ${pageCount} page(s)`,
    });

    // Call Gemini with the file inline
    const b64 = bytesToBase64(bytes);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("AI service is not configured");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Document title: ${doc.title}\nASC standard scope: ${doc.asc_standard}\nIndex this for ongoing policy reference.` },
              isPdf
                ? { type: "file", file: { filename: doc.file_name, file_data: `data:${doc.mime_type ?? "application/pdf"};base64,${b64}` } }
                : { type: "text", text: `(non-PDF upload, raw bytes omitted — base summary on title and category)` },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`AI service error (${resp.status}): ${txt.slice(0, 300)}`);
    }
    const aiJson = await resp.json();
    let parsed: any = {};
    try { parsed = JSON.parse(aiJson.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = { summary: aiJson.choices?.[0]?.message?.content ?? "" }; }

    await admin.from("compliance_documents").update({
      status: "indexed",
      page_count: pageCount,
      summary: parsed.summary ?? null,
      extracted_text: parsed.extracted_text ?? null,
      key_policies: parsed.key_policies ?? null,
      doc_category: parsed.doc_category ?? doc.doc_category,
      credits_charged: pageCount,
      payment_method: actualMethod,
      model_version: MODEL,
      indexed_at: new Date().toISOString(),
      error: null,
    }).eq("id", docId);

    return new Response(JSON.stringify({ ok: true, pageCount, method: actualMethod }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[asc-index-compliance-doc]", e);
    if (docId && admin) {
      await admin.from("compliance_documents").update({ status: "failed", error: e instanceof Error ? e.message : String(e) }).eq("id", docId);
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
