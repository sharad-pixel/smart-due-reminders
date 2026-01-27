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

// Lovable AI endpoint - no API key required
const LOVABLE_AI_URL = "https://ai-gateway.lovable.ai/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const systemPrompt = `You are an expert email marketing copywriter for Recouply.ai, a Collection Intelligence Platform that helps businesses collect money more effectively using AI.

Your task is to write ${emailTypeDescriptions[email_type]}.

Guidelines:
- Write in a ${toneDescriptions[tone]} tone
- Keep the email concise but impactful (300-500 words for body)
- Use clear headings and bullet points where appropriate
- Include a compelling subject line (50-60 characters max)
- Focus on value and benefits to the reader
- Make the content scannable
- End with a clear call-to-action
- IMPORTANT: Do NOT include unsubscribe links in the body - these will be added automatically

Return your response as a JSON object with this structure:
{
  "subject": "The email subject line",
  "preheader": "A short preview text (40-90 characters)",
  "body_html": "The HTML email body with proper formatting (<h1>, <h2>, <p>, <ul>, <li>, <strong>, <a> tags)",
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Lovable AI error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to generate email content" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the JSON response
    let emailContent;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      emailContent = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, content);
      return new Response(
        JSON.stringify({ error: "Failed to parse generated content" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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