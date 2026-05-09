import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are Kurt, a senior General Counsel AI for a SaaS contracts platform.
Style: warm, professional, plain-English. Be concise (2-5 sentences unless asked for detail).
You help workspace owners and approvers:
- understand pending amendments
- weigh accept / reject / request-changes
- spot risks (liability, indemnity, IP, data, term, payment, exclusivity)
- recall best-practice clauses
You RECOMMEND only. Humans decide. Never claim to give binding legal advice.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { instanceId, messages } = await req.json();
    if (!instanceId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "instanceId and messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Build context
    const { data: instance } = await admin.from("clm_template_instances")
      .select("id, name, account_id, template_id").eq("id", instanceId).maybeSingle();
    if (!instance) return new Response(JSON.stringify({ error: "Workspace not found" }), { status: 404, headers: corsHeaders });

    const { data: sections } = await admin.from("clm_instance_sections")
      .select("title, body, position").eq("instance_id", instanceId).order("position");

    const { data: pending } = await admin.from("clm_section_revisions")
      .select("section_title, change_summary, edited_by_name, created_at, approval_status")
      .eq("instance_id", instanceId).eq("approval_status", "pending").order("created_at", { ascending: false }).limit(10);

    const contextBlocks = [
      `WORKSPACE: ${instance.name}`,
      `SECTIONS:\n${(sections ?? []).map((s: any) => `--- ${s.title} ---\n${(s.body ?? "").slice(0, 2000)}`).join("\n\n")}`,
      pending?.length
        ? `PENDING AMENDMENTS:\n${pending.map((p: any) => `• ${p.section_title} — ${p.change_summary || "no note"} (by ${p.edited_by_name || "?"})`).join("\n")}`
        : "PENDING AMENDMENTS: none",
    ].join("\n\n");

    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    if (lastUser) {
      await admin.from("clm_kurt_chat_messages").insert({
        instance_id: instanceId, user_id: user.id, role: "user", content: String(lastUser.content || "").slice(0, 4000),
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey! },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `${SYSTEM}\n\n${contextBlocks}` },
          ...messages.map((m: any) => ({ role: m.role, content: String(m.content || "") })),
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      const status = resp.status;
      return new Response(JSON.stringify({
        error: status === 429 ? "Kurt is busy — please retry in a moment." :
               status === 402 ? "AI credits exhausted. Please add credits to keep using Kurt." :
               `Kurt failed: ${txt}`,
      }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content ?? "I couldn't generate a response.";

    await admin.from("clm_kurt_chat_messages").insert({
      instance_id: instanceId, user_id: user.id, role: "assistant", content: reply.slice(0, 4000),
    });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[clm-kurt-chat]", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
