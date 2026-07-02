import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      integration_source = "stripe",
      error_type = "unknown",
      sample_message = "",
      sample_details = [] as string[],
      count = 1,
    } = body ?? {};

    if (!sample_message && (!sample_details || sample_details.length === 0)) {
      return json({ error: "sample_message or sample_details required" }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI service not configured" }, 500);

    const detailBlock = (sample_details || []).slice(0, 5).map((d: string, i: number) => `#${i + 1}: ${String(d).slice(0, 800)}`).join("\n");

    const prompt = `You are a senior integrations engineer helping a finance operator triage a failing ${integration_source.toUpperCase()} sync error inside Recouply.ai (a Revenue Intelligence platform).

Error type: ${error_type}
Occurrences: ${count}
Sample message: ${String(sample_message).slice(0, 800)}

Raw sample details:
${detailBlock || "(none)"}

Respond ONLY with a compact JSON object of shape:
{
  "root_cause": string,          // 1-2 sentence plain-english diagnosis
  "user_action": string,         // exact next step the user should take, no jargon
  "severity": "low"|"medium"|"high",
  "auto_resolvable": boolean,    // true if a re-run of the sync will likely fix it
  "safe_to_ignore": boolean,     // true if the error is benign (dupes, terminal invoices, etc.)
  "recommended_action": "retry"|"reconnect"|"fix_source"|"ignore"|"contact_support"
}
No prose, no markdown fences.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You return strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({
        error: aiRes.status === 429
          ? "Rate limit reached. Try again shortly."
          : aiRes.status === 402
          ? "AI credits exhausted. Add credits in Settings → Workspace → Usage."
          : `AI service error (${aiRes.status})`,
        detail: txt.slice(0, 400),
      }, aiRes.status);
    }

    const j = await aiRes.json();
    const raw = j?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    if (!parsed || typeof parsed !== "object") {
      return json({ error: "AI returned unparseable response", raw: cleaned.slice(0, 400) }, 502);
    }

    return json({ resolution: parsed });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
