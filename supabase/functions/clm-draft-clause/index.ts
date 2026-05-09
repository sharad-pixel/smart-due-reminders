import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a senior contracts attorney drafting and revising clauses for a SaaS company's commercial agreement.
Rules:
- Plain-English, modern legal drafting. No archaic "WHEREAS" unless asked.
- Match the existing document's tone, capitalization of defined terms, and numbering style.
- When the user asks for a clause type (e.g., "limitation of liability", "indemnification", "termination for convenience"), produce a balanced, market-standard SaaS clause unless the user specifies a position (pro-customer / pro-vendor).
- When asked to revise, preserve the user's intent and only change what is necessary.
- Output ONLY the clause text. No preamble, no markdown headers, no commentary, no quotes around the output.
- Keep length proportional to the request: a short instruction returns a tight clause, a long instruction returns more.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Auth check (any signed-in user can use)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const {
      mode = "insert",            // "insert" | "replace" | "revise"
      instruction = "",
      section_title = "",
      current_body = "",
      selection = "",
      document_context = "",
    } = await req.json();

    if (!instruction.trim()) {
      return new Response(JSON.stringify({ error: "instruction is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userPrompt = `Section: ${section_title || "(untitled)"}
Mode: ${mode}

User instruction:
"""
${instruction}
"""

${document_context ? `Wider document context (for tone/defined terms):\n"""\n${document_context.slice(0, 4000)}\n"""\n\n` : ""}${
      mode === "revise" && selection
        ? `Revise the following selected text:\n"""\n${selection}\n"""\n`
        : mode === "replace"
        ? `Replace the entire current section body. Current body:\n"""\n${current_body}\n"""\n`
        : `Draft a new clause to insert into the section. Current body for context:\n"""\n${current_body}\n"""\n`
    }
Return only the clause text.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway ${resp.status}: ${t}`);
    }

    const data = await resp.json();
    let text: string = data.choices?.[0]?.message?.content ?? "";
    text = text.trim().replace(/^"+|"+$/g, "").trim();

    return new Response(JSON.stringify({ success: true, text, mode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clm-draft-clause error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
