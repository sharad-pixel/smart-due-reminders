 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { answers } = await req.json();
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     
     if (!LOVABLE_API_KEY) {
       throw new Error("LOVABLE_API_KEY is not configured");
     }
 
     const systemPrompt = `You are a Collection Intelligence expert for Recouply.ai, an AI-powered accounts receivable platform. 
 Based on the user's quiz answers about their business, provide a personalized Collection Intelligence Summary.
 
 Be concise but impactful. Use specific numbers and percentages when possible.
 Structure your response as JSON with these fields:
 - headline: A compelling one-line headline about their situation (max 10 words)
 - riskLevel: "low", "medium", or "high"
 - estimatedRecovery: A dollar range they could recover (e.g., "$5,000 - $15,000/month")
 - keyInsights: Array of 3 short insights (max 15 words each)
 - recommendation: A personalized call-to-action sentence (max 20 words)
 - dsoImpact: Estimated DSO reduction in days (number)`;
 
     const userMessage = `Quiz answers from a potential customer:
 ${JSON.stringify(answers, null, 2)}
 
 Generate a personalized Collection Intelligence Summary for this business.`;
 
     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         Authorization: `Bearer ${LOVABLE_API_KEY}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "google/gemini-3-flash-preview",
         messages: [
           { role: "system", content: systemPrompt },
           { role: "user", content: userMessage },
         ],
         response_format: { type: "json_object" },
       }),
     });
 
     if (!response.ok) {
       if (response.status === 429) {
         return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
           status: 429,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
       if (response.status === 402) {
         return new Response(JSON.stringify({ error: "Payment required" }), {
           status: 402,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
       const errorText = await response.text();
       console.error("AI gateway error:", response.status, errorText);
       throw new Error("AI gateway error");
     }
 
     const data = await response.json();
     const content = data.choices?.[0]?.message?.content;
     
     let summary;
     try {
       summary = JSON.parse(content);
     } catch {
       summary = {
         headline: "Your Cash Flow Needs Attention",
         riskLevel: "medium",
         estimatedRecovery: "$5,000 - $20,000/month",
         keyInsights: [
           "Late payments are impacting your cash flow",
           "AI automation can reduce collection time by 50%",
           "Proactive outreach prevents payment delays"
         ],
         recommendation: "Start your free trial to see your full Collection Intelligence report.",
         dsoImpact: 15
       };
     }
 
     return new Response(JSON.stringify(summary), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error) {
     console.error("Error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });