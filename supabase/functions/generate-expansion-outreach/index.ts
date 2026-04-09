import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      debtor_id,
      debtor_name,
      current_balance,
      expansion_amount,
      expansion_type,
      risk_assessment,
    } = await req.json();

    if (!debtor_id || !risk_assessment) {
      return new Response(JSON.stringify({ error: "debtor_id and risk_assessment are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch branding for business name
    const { data: branding } = await supabase
      .from("branding_settings")
      .select("business_name, from_name, email_signature")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyName = branding?.business_name || branding?.from_name || "Our Team";
    const signature = branding?.email_signature || companyName;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an AI assistant for ${companyName}, a finance team that manages accounts receivable and customer relationships.

Generate a professional outreach email to a customer (${debtor_name || "the customer"}) that:
1. Acknowledges the customer's interest in expanding their business relationship (${expansion_type || "new purchase/service"} worth $${(expansion_amount || 0).toLocaleString()})
2. References their current outstanding balance of $${(current_balance || 0).toLocaleString()} and requests settlement
3. Proposes the recommended payment terms from the risk assessment
4. Maintains a positive, relationship-building tone while being clear about payment expectations
5. Offers flexible payment options based on the risk assessment recommendations

The tone should be professional and constructive — this is about growing the relationship while protecting cash flow.

Output ONLY valid JSON matching this schema:
{
  "subject": "string (email subject line)",
  "body": "string (full email body, use \\n for line breaks)"
}

Return ONLY valid JSON. No markdown, no code fences.`;

    const userContent = JSON.stringify({
      debtor_name: debtor_name || "Customer",
      current_balance: current_balance || 0,
      expansion_amount: expansion_amount || 0,
      expansion_type: expansion_type || "Not specified",
      risk_level: risk_assessment.risk_level,
      risk_score: risk_assessment.risk_score,
      risk_summary: risk_assessment.risk_summary,
      recommended_terms: risk_assessment.recommended_terms,
      conditions: risk_assessment.conditions,
      expansion_impact: risk_assessment.expansion_impact,
      sender_company: companyName,
      sender_signature: signature,
    });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI gateway error:", aiResponse.status, await aiResponse.text());
      // Fallback message
      return new Response(JSON.stringify({
        subject: `Expansion Opportunity & Account Review — ${debtor_name || "Your Account"}`,
        body: `Dear ${debtor_name || "Valued Customer"},\n\nThank you for your interest in expanding our business relationship with a ${expansion_type || "new"} engagement valued at $${(expansion_amount || 0).toLocaleString()}.\n\nBefore we proceed, we'd like to review your current account. You currently have an outstanding balance of $${(current_balance || 0).toLocaleString()} that we'd like to settle.\n\nWe recommend the following terms for the expansion:\n- Payment Terms: ${risk_assessment.recommended_terms?.payment_terms || "To be discussed"}\n- Billing Structure: ${risk_assessment.recommended_terms?.billing_structure || "To be discussed"}\n- Deposit: ${risk_assessment.recommended_terms?.deposit_recommendation || "To be discussed"}\n\nWe value your business and look forward to growing our partnership. Please reach out to discuss how we can move forward together.\n\nBest regards,\n${signature}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI JSON:", content);
      result = {
        subject: `Expansion Opportunity & Account Review — ${debtor_name || "Your Account"}`,
        body: content || "Unable to generate message. Please try again.",
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-expansion-outreach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});