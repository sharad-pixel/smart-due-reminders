import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are Kurt, a senior General Counsel AI for Recouply's CLM platform.
Style: warm, professional, plain-English. Be concise (2-5 sentences unless asked for detail).
You help users navigate their contract workspaces:
- Summarize what's happening across workspaces (pending approvals, stalled negotiations, signature-ready)
- Explain a specific workspace's status, sections, collaborators, or pending amendments
- Compare workspaces and recommend where to focus attention next
- Answer general CLM/legal best-practice questions
You RECOMMEND only. Humans decide. Never claim to give binding legal advice.
When referencing a workspace, mention it by name and link with the path /contracts/instances/<id>.`;

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
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve account scope (use the same workspaces the user can see via RLS through the user-scoped client)
    const { data: instances } = await supabaseClient
      .from("clm_template_instances")
      .select("id, name, status, created_at, account_id, template_id, clm_templates(name)")
      .not("status", "in", "(archived,deleted)")
      .order("created_at", { ascending: false })
      .limit(50);

    const ids = (instances ?? []).map((i: any) => i.id);
    let pendingByInstance = new Map<string, any[]>();
    let collabByInstance = new Map<string, number>();
    if (ids.length) {
      const { data: pending } = await admin
        .from("clm_section_revisions")
        .select("instance_id, section_title, change_summary, edited_by_name, created_at")
        .in("instance_id", ids)
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false })
        .limit(200);
      (pending ?? []).forEach((p: any) => {
        const arr = pendingByInstance.get(p.instance_id) ?? [];
        arr.push(p);
        pendingByInstance.set(p.instance_id, arr);
      });
      const { data: collabs } = await admin
        .from("clm_instance_contacts" as any)
        .select("instance_id")
        .in("instance_id", ids);
      (collabs ?? []).forEach((c: any) => {
        collabByInstance.set(c.instance_id, (collabByInstance.get(c.instance_id) ?? 0) + 1);
      });
    }

    const workspaceLines = (instances ?? []).map((i: any) => {
      const pend = pendingByInstance.get(i.id) ?? [];
      const collabs = collabByInstance.get(i.id) ?? 0;
      const tmpl = i.clm_templates?.name ?? "—";
      const top = pend.slice(0, 3).map((p: any) => `   • ${p.section_title}: ${p.change_summary || "no note"} (by ${p.edited_by_name || "?"})`).join("\n");
      return `- [${i.name}] /contracts/instances/${i.id}\n   status=${i.status} · template=${tmpl} · collaborators=${collabs} · pending=${pend.length}${top ? `\n${top}` : ""}`;
    }).join("\n");

    const contextBlocks = [
      `USER WORKSPACES (${(instances ?? []).length}):`,
      workspaceLines || "(none yet)",
    ].join("\n");

    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    if (lastUser) {
      await admin.from("clm_kurt_landing_messages").insert({
        user_id: user.id, role: "user", content: String(lastUser.content || "").slice(0, 4000),
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
          ...messages.slice(-20).map((m: any) => ({ role: m.role, content: String(m.content || "") })),
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

    await admin.from("clm_kurt_landing_messages").insert({
      user_id: user.id, role: "assistant", content: reply.slice(0, 4000),
    });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[clm-kurt-landing-chat]", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
