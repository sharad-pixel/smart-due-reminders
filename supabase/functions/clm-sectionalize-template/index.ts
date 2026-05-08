import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { template_id } = await req.json();
    if (!template_id) return json({ error: "template_id required" }, 400);

    const { data: tmpl, error: tErr } = await supabase
      .from("clm_templates").select("*").eq("id", template_id).single();
    if (tErr || !tmpl) return json({ error: "Template not found" }, 404);

    await supabase.from("clm_templates").update({ status: "parsing", parse_error: null }).eq("id", template_id);

    // Get text content
    let rawText = tmpl.raw_text ?? "";
    if (!rawText && tmpl.source_storage_path) {
      const { data: file, error: dErr } = await supabase.storage.from("clm-templates").download(tmpl.source_storage_path);
      if (dErr || !file) {
        await supabase.from("clm_templates").update({ status: "failed", parse_error: "Could not download source file" }).eq("id", template_id);
        return json({ error: "download failed" }, 500);
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      // Decode as UTF-8 — works for .txt; for PDF/DOCX it yields binary noise but the AI can still extract structure from any embedded text. Best results when clients upload .txt or .md or pre-extracted text.
      rawText = new TextDecoder("utf-8", { fatal: false }).decode(buf).slice(0, 80000);
      await supabase.from("clm_templates").update({ raw_text: rawText }).eq("id", template_id);
    }

    if (!rawText.trim()) {
      await supabase.from("clm_templates").update({ status: "failed", parse_error: "Empty document" }).eq("id", template_id);
      return json({ error: "empty document" }, 400);
    }

    // Call Lovable AI Gateway (Gemini 2.5 Flash per project standards)
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
      "body": "Verbatim or near-verbatim text of that section. If the section isn't present, leave body empty.",
      "ai_summary": "1-2 sentence plain-English summary",
      "risk_flags": ["short risk note", "..."]
    }
  ]
}
Return all 12 keys in the listed order, even when body is empty. Risk flags are optional (empty array allowed).`,
          },
          { role: "user", content: `Contract text:\n\n${rawText}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      await supabase.from("clm_templates").update({ status: "failed", parse_error: `AI error: ${aiResp.status}` }).eq("id", template_id);
      return json({ error: "ai_failed", details: txt.slice(0, 500) }, 502);
    }

    const aiJson = await aiResp.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch {
      await supabase.from("clm_templates").update({ status: "failed", parse_error: "AI returned non-JSON" }).eq("id", template_id);
      return json({ error: "bad_ai_json" }, 502);
    }

    const sections: any[] = Array.isArray(parsed.sections) ? parsed.sections : [];

    // Replace existing sections
    await supabase.from("clm_template_sections").delete().eq("template_id", template_id);

    const rows = sections.map((s, idx) => ({
      template_id,
      section_key: String(s.key ?? `section_${idx}`).slice(0, 80),
      title: String(s.title ?? "Untitled").slice(0, 200),
      body: String(s.body ?? ""),
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

    return json({ success: true, sections_count: rows.length });
  } catch (e: any) {
    console.error("clm-sectionalize-template error", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
