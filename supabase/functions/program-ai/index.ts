// Program Management AI: ingest RAID/RACI/KDD text into structured items, and summarize program health.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TYPES = ["risk", "assumption", "issue", "dependency", "raci", "decision"];

async function ai(apiKey: string, system: string, user: string) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) {
    const msg = r.status === 429 ? "AI is busy, please try again shortly." : r.status === 402 ? "AI credits are used up. Add credits in Settings → Plans & credits." : `AI request failed (${r.status})`;
    throw Object.assign(new Error(msg), { status: r.status === 429 || r.status === 402 ? r.status : 502 });
  }
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text.replace(/^```json\s*|```$/g, ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI service not configured" }, 500);
    const authHeader = req.headers.get("Authorization") ?? "";
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const { action, programId, text } = await req.json();
    const { data: program } = await db.from("programs").select("*").eq("id", programId).maybeSingle();
    if (!program) return json({ error: "Program not found" }, 404);
    const { data: wss } = await db.from("program_workstreams").select("*").eq("program_id", programId);

    if (action === "ingest") {
      const input = String(text ?? "").slice(0, 60000);
      if (input.trim().length < 10) return json({ error: "Paste or upload some RAID, RACI or decision content first." }, 400);
      const out = await ai(apiKey,
        `You extract program-management data. Return json: {"items":[{"item_type":one of ${TYPES.join("|")},"workstream":string|null,"title":string,"description":string|null,"owner":string|null,"status":string|null,"severity":"low"|"medium"|"high"|"critical"|null,"due_date":"YYYY-MM-DD"|null,"responsible":string|null,"accountable":string|null,"consulted":string|null,"informed":string|null,"rationale":string|null}]}.
RAID rows -> risk/assumption/issue/dependency. RACI rows -> raci (one per activity, title = activity). Key decisions (KDD) -> decision (rationale = why). Use only facts in the input; never invent owners or dates. Existing workstreams: ${(wss ?? []).map((w) => w.name).join(", ") || "none"}.`,
        input);
      const items = Array.isArray(out.items) ? out.items.filter((i: any) => TYPES.includes(i.item_type) && i.title) : [];
      const wsMap = new Map((wss ?? []).map((w) => [w.name.toLowerCase(), w.id]));
      for (const name of new Set(items.map((i: any) => i.workstream?.trim()).filter(Boolean))) {
        if (!wsMap.has((name as string).toLowerCase())) {
          const { data: w, error } = await db.from("program_workstreams").insert({ program_id: programId, name }).select().single();
          if (error) throw error;
          wsMap.set((name as string).toLowerCase(), w.id);
        }
      }
      const rows = items.map((i: any) => ({
        program_id: programId, workstream_id: i.workstream ? wsMap.get(i.workstream.trim().toLowerCase()) ?? null : null,
        item_type: i.item_type, title: String(i.title).slice(0, 300), description: i.description, owner: i.owner,
        status: i.status || "open", severity: i.severity, due_date: /^\d{4}-\d{2}-\d{2}$/.test(i.due_date ?? "") ? i.due_date : null,
        responsible: i.responsible, accountable: i.accountable, consulted: i.consulted, informed: i.informed, rationale: i.rationale, source: "ai_ingest",
      }));
      if (rows.length) { const { error } = await db.from("program_items").insert(rows); if (error) throw error; }
      return json({ created: rows.length });
    }

    if (action === "summary") {
      const { data: items } = await db.from("program_items").select("item_type,title,owner,status,severity,due_date,workstream_id,accountable").eq("program_id", programId).limit(400);
      const wsName = new Map((wss ?? []).map((w) => [w.id, w.name]));
      const out = await ai(apiKey,
        `You are a transformation program advisor. Return json: {"summary":"markdown, max 250 words: overall health, top risks/issues by workstream, gaps (e.g. RACI activities without an accountable owner, overdue items, decisions pending), and 3-5 concrete AI automation opportunities for this program"}. Base everything only on the data given; today is ${new Date().toISOString().slice(0, 10)}.`,
        JSON.stringify({ program: program.name, description: program.description, items: (items ?? []).map((i) => ({ ...i, workstream: wsName.get(i.workstream_id) ?? null, workstream_id: undefined })) }));
      const summary = String(out.summary ?? "");
      await db.from("programs").update({ ai_summary: summary, ai_summary_at: new Date().toISOString() }).eq("id", programId);
      return json({ summary });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("program-ai", e);
    return json({ error: e.message ?? "Failed" }, e.status ?? 500);
  }
});
