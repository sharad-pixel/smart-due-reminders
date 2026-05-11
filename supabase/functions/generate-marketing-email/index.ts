import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  email_type: "product_update" | "feature_announcement" | "newsletter" | "promotion" | "custom";
  topic: string;
  key_points?: string[];
  tone?: "professional" | "friendly" | "excited" | "urgent";
  cta_text?: string;
  cta_link?: string;
}

// Lovable AI gateway endpoint
// NOTE: This requires LOVABLE_API_KEY (auto-provisioned in Lovable Cloud)
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

     const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
     if (!lovableApiKey) {
       return new Response(
         JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: GenerateRequest = await req.json();
    const {
      email_type,
      topic,
      key_points = [],
      tone = "professional",
      cta_text,
      cta_link,
    } = payload;

    console.log("Generating marketing email with Lovable AI:", { email_type, topic, tone });

    const toneDescriptions: Record<string, string> = {
      professional: "formal, business-appropriate, and authoritative",
      friendly: "warm, approachable, and conversational",
      excited: "enthusiastic, energetic, and celebratory",
      urgent: "time-sensitive, action-oriented, and compelling",
    };

    const emailTypeDescriptions: Record<string, string> = {
      product_update: "a product update email highlighting new features and improvements",
      feature_announcement: "a feature announcement email introducing a specific new capability",
      newsletter: "a monthly newsletter covering multiple updates and industry insights",
      promotion: "a promotional email offering special deals or limited-time offers",
      custom: "a custom marketing email",
    };

    const systemPrompt = `You are an expert email marketing copywriter for Recouply.ai, a Revenue Intelligence Platform that helps businesses collect money more effectively using AI.

Your task is to write ${emailTypeDescriptions[email_type]}.

Brand voice & style:
- Speak as Recouply.ai (never "we at [generic vendor]"). Mention the product by name once, naturally.
- Tagline to evoke when relevant: "Revenue Intelligence Platform".
- Tone: ${toneDescriptions[tone]}.
- Confident, modern B2B fintech — no hype, no emojis, no exclamation overload.

Personalization tokens (use 1-2 max where natural):
- {{first_name}} — recipient's first name (fallback: "there")
- {{company}} — recipient's company (fallback: "your company")

Guidelines:
- Concise but impactful (250-450 words for body)
- Compelling subject line (50-60 chars). May include {{first_name}} or {{company}}.
- Use clear headings, short paragraphs, and bullet points where appropriate
- End with ONE clear call-to-action
- Do NOT include unsubscribe links, footers, or company address — these are added automatically by the Recouply.ai branded wrapper
- Do NOT wrap content in <html>, <head>, or <body> tags — only inner content (<h2>, <p>, <ul>, <strong>, <a>)

Return your response as a JSON object with this structure:
{
  "subject": "The email subject line",
  "preheader": "A short preview text (40-90 characters)",
  "body_html": "Inner HTML body (no <html>/<body> wrapper, no footer, no unsubscribe)",
  "body_text": "Plain text version of the email"
}`;

    const userPrompt = `Create a marketing email about: ${topic}

${key_points.length > 0 ? `Key points to cover:\n${key_points.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}

${cta_text ? `Call-to-action button text: ${cta_text}` : ""}
${cta_link ? `Call-to-action link: ${cta_link}` : ""}

Generate the email content now.`;

    // Use Lovable AI gateway
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4000,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Lovable AI error:", errorData);
      return new Response(
        JSON.stringify({
          error:
            response.status === 429
              ? "AI rate limit exceeded. Please try again in a minute."
              : response.status === 402
                ? "AI credits exhausted. Please add credits to continue."
                : "Failed to generate email content",
        }),
        { status: response.status === 429 || response.status === 402 ? response.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the JSON response
    let emailContent;
    try {
      // Strip markdown code fences if present
      let jsonString = content.trim();
      const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) jsonString = fenceMatch[1].trim();
      emailContent = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse AI response, attempting recovery:", parseError, content);
      // Recovery: extract fields with regex from raw content
      try {
        const subj = content.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? "Recouply.ai update";
        const pre = content.match(/"preheader"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? "";
        const html = content.match(/"body_html"\s*:\s*"((?:[^"\\]|\\.)*)"/s)?.[1] ?? "";
        const text = content.match(/"body_text"\s*:\s*"((?:[^"\\]|\\.)*)"/s)?.[1] ?? "";
        const unescape = (s: string) => s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        emailContent = {
          subject: unescape(subj),
          preheader: unescape(pre),
          body_html: unescape(html),
          body_text: unescape(text),
        };
        if (!emailContent.body_html) throw new Error("No body recovered");
      } catch (recoveryError) {
        console.error("Recovery failed:", recoveryError);
        return new Response(
          JSON.stringify({ error: "Failed to parse generated content. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Add CTA button if provided
    if (cta_text && cta_link) {
      emailContent.body_html += `
<p style="text-align: center; margin-top: 24px;">
  <a href="${cta_link}" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">${cta_text}</a>
</p>`;
      emailContent.body_text += `\n\n${cta_text}: ${cta_link}`;
    }

    console.log("Marketing email generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        email: emailContent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating marketing email:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});