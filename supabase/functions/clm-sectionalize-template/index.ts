import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import mammoth from "npm:mammoth@1.8.0";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECTION_KEYS = [
  "parties", "term", "scope_of_services", "fees_payment_terms",
  "intellectual_property", "confidentiality", "warranties",
  "indemnification", "limitation_of_liability", "termination",
  "governing_law_dispute", "miscellaneous",
];

// Cap text sent to AI — Gemini Flash handles this in ~10s vs 60s+ for full docs
const MAX_AI_CHARS = 35000;

async function extractTextFromBuffer(buf: Uint8Array, mime: string, filename: string): Promise<string> {
  const lower = (filename || "").toLowerCase();
  const isDocx = mime?.includes("wordprocessingml") || lower.endsWith(".docx");
  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
  const isDoc = lower.endsWith(".doc") && !isDocx;

  if (isDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value ?? "";
    } catch (e) {
      console.error("mammoth failed", e);
      throw new Error(`DOCX extraction failed: ${(e as Error).message}`);
    }
  }

  if (isPdf) {
    try {
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      return Array.isArray(text) ? text.join("\n") : String(text ?? "");
    } catch (e) {
      console.error("unpdf failed", e);
      throw new Error(`PDF extraction failed: ${(e as Error).message}`);
    }
  }

  if (isDoc) {
    throw new Error("Legacy .doc files are not supported. Please save as .docx or .pdf and re-upload.");
  }

  // Plain text / markdown / unknown — best-effort UTF-8
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let template_id: string | undefined;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    template_id = body.template_id;
    if (!template_id) return json({ error: "template_id required" }, 400);

    const { data: tmpl, error: tErr } = await supabase
      .from("clm_templates").select("*").eq("id", template_id).single();
    if (tErr || !tmpl) return json({ error: "Template not found" }, 404);

    await supabase.from("clm_templates").update({ status: "parsing", parse_error: null }).eq("id", template_id);

    // 1. Extract text
    let rawText = (tmpl.raw_text ?? "").trim();
    if (!rawText && tmpl.source_storage_path) {
      const { data: file, error: dErr } = await supabase.storage.from("clm-templates").download(tmpl.source_storage_path);
      if (dErr || !file) {
        await supabase.from("clm_templates").update({ status: "failed", parse_error: "Could not download source file" }).eq("id", template_id);
        return json({ error: "download failed" }, 500);
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      try {
        rawText = (await extractTextFromBuffer(buf, tmpl.mime_type ?? "", tmpl.source_file_name ?? "")).trim();
      } catch (e: any) {
        await supabase.from("clm_templates").update({ status: "failed", parse_error: e.message }).eq("id", template_id);
        return json({ error: e.message }, 400);
      }
      // Persist truncated copy for inspection
      await supabase.from("clm_templates").update({ raw_text: rawText.slice(0, 200000) }).eq("id", template_id);
    }

    if (!rawText) {
      await supabase.from("clm_templates").update({ status: "failed", parse_error: "No text could be extracted from the document" }).eq("id", template_id);
      return json({ error: "empty document" }, 400);
    }

    // Smart trim: keep head + tail (signatures/governing law often live at the end)
    let aiInput = rawText;
    if (rawText.length > MAX_AI_CHARS) {
      const head = rawText.slice(0, Math.floor(MAX_AI_CHARS * 0.7));
      const tail = rawText.slice(-Math.floor(MAX_AI_CHARS * 0.3));
      aiInput = `${head}\n\n[... middle truncated for length ...]\n\n${tail}`;
    }

    // 2. Call Lovable AI Gateway (Gemini 2.5 Flash)
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a contract analyst. Break the provided contract/MSA into standard sections. Return JSON only with this shape:
{
  "sections": [
    { "key": "<one of: ${SECTION_KEYS.join(", ")}>",
      "title": "Human readable title",
      "body": "Concise excerpt or near-verbatim text of that section. Trim filler. If the section isn't present, leave body empty.",
      "ai_summary": "1-2 sentence plain-English summary",
      "risk_flags": ["short risk note", "..."]
    }
  ]
}
Return all 12 keys in the listed order, even when body is empty. Keep each body under ~1500 chars. Risk flags optional.`,
          },
          { role: "user", content: `Contract text:\n\n${aiInput}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      const msg = aiResp.status === 429
        ? "AI rate limit — please retry in a moment"
        : aiResp.status === 402
          ? "AI credits exhausted — add credits in Settings"
          : `AI error ${aiResp.status}`;
      await supabase.from("clm_templates").update({ status: "failed", parse_error: msg }).eq("id", template_id);
      return json({ error: msg, details: txt.slice(0, 500) }, 502);
    }

    const aiJson = await aiResp.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch {
      await supabase.from("clm_templates").update({ status: "failed", parse_error: "AI returned non-JSON" }).eq("id", template_id);
      return json({ error: "bad_ai_json" }, 502);
    }

    const sections: any[] = Array.isArray(parsed.sections) ? parsed.sections : [];

    await supabase.from("clm_template_sections").delete().eq("template_id", template_id);

    const rows = sections.map((s, idx) => ({
      template_id,
      section_key: String(s.key ?? `section_${idx}`).slice(0, 80),
      title: String(s.title ?? "Untitled").slice(0, 200),
      body: String(s.body ?? "").slice(0, 8000),
      order_index: idx,
      ai_summary: s.ai_summary ?? null,
      risk_flags: Array.isArray(s.risk_flags) ? s.risk_flags : [],
    }));

    if (rows.length) {
      const { error: insErr } = await supabase.from("clm_template_sections").insert(rows);
      if (insErr) {
        await supabase.from("clm_templates").update({ status: "failed", parse_error: insErr.message }).eq("id", template_id);
        return json({ error: insErr.message }, 500);
      }
    }

    await supabase.from("clm_templates").update({ status: "ready" }).eq("id", template_id);

    // Fire-and-forget GPT-5 assessment
    supabase.functions.invoke("clm-assess-template", {
      body: { template_id },
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    }).catch((e) => console.error("assess invoke error", e));

    return json({ success: true, sections_count: rows.length });
  } catch (e: any) {
    console.error("clm-sectionalize-template error", e);
    if (template_id) {
      await supabase.from("clm_templates").update({
        status: "failed",
        parse_error: (e?.message ?? "Unknown error").slice(0, 500),
      }).eq("id", template_id);
    }
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
