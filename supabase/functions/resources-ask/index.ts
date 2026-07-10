// Ask Revenue Questions — streaming AI agent for the Revenue Intelligence Hub.
// Powered by Lovable AI Gateway (Gemini 2.5 Flash).
// No auth required — public marketing endpoint.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are the Revenue Intelligence Agent for Recouply.ai.

Recouply.ai is an AI-Native Revenue Intelligence platform that connects Contract Intelligence, Revenue Intelligence, and Collections Intelligence into a single contract-to-cash workflow. It reads every contract, tracks every obligation, and turns every receivable into a real-time signal.

Your job is to answer visitor questions about:
- Revenue Intelligence, Contract Intelligence, Collections Intelligence
- Revenue Operations, Deal Desk, Quote-to-Cash
- Contract-to-cash lifecycle: order forms, ARR/ACV/TCV, ramps, renewals, expansion
- ASC 606 revenue recognition (educational, not legal advice)
- SaaS finance metrics (DSO, CEI, ADD, ARR waterfall)
- AI/OCR applied to contracts and receivables
- Revenue leakage, risk intelligence, forecasting

Style:
- Concise, expert, executive-grade. Use short paragraphs and markdown lists when helpful.
- Ground answers in how Recouply.ai thinks about the problem when relevant, but be genuinely educational — never a sales pitch.
- If asked something outside revenue/finance/contracts, briefly redirect back to the domain.
- If asked for legal/tax/audit advice, remind the user to consult their own advisors.
- Never invent product features. If unsure, say so and suggest booking a demo at https://calendly.com/sharad-recouply/30min.`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap history to keep requests bounded
    const trimmed = messages.slice(-12).map((m) => ({
      role: m.role,
      content: String(m.content ?? "").slice(0, 4000),
    }));

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
      }),
    });

    if (upstream.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (upstream.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return new Response(JSON.stringify({ error: "AI request failed", detail: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Proxy the SSE stream straight through.
    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("resources-ask error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
