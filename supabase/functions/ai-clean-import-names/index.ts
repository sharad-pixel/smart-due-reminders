import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ImportRecord {
  id: string;
  company_name: string | null;
  contact_name: string | null;
}

interface CleanedRecord {
  id: string;
  company_name: string;
  contact_name: string;
  company_changed: boolean;
  contact_changed: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { records } = (await req.json()) as { records: ImportRecord[] };

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ cleaned: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt
    const recordsList = records
      .map(
        (r, i) =>
          `${i + 1}. id="${r.id}" company="${r.company_name || ""}" contact="${r.contact_name || ""}"`
      )
      .join("\n");

    const systemPrompt = `You are a data-cleaning assistant for a B2B accounts receivable platform. Your job is to clean and standardize company names and contact names from imported data.

Rules for company names:
- Proper title case (e.g., "makers mark inc" → "Makers Mark Inc.")
- Standardize suffixes: LLC, Inc., Corp., Ltd., Co., LP
- Remove extra whitespace, fix obvious typos
- Keep abbreviations uppercase (e.g., "IBM", "AWS")
- If the name looks like a person's name rather than a company, keep it as-is

Rules for contact names:
- Proper title case for names (e.g., "matt j" → "Matt J.")
- Fix common name abbreviations (e.g., single letter last names should have a period)
- Remove extra whitespace
- Keep titles if present (e.g., "Dr.", "Mr.")

Return ONLY a JSON array. Each element must have: id, company_name, contact_name.
Do not add any explanation or markdown.`;

    const userPrompt = `Clean these records:\n${recordsList}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_cleaned_records",
                description: "Return the cleaned record names",
                parameters: {
                  type: "object",
                  properties: {
                    records: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          company_name: { type: "string" },
                          contact_name: { type: "string" },
                        },
                        required: ["id", "company_name", "contact_name"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["records"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_cleaned_records" },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[AI-CLEAN] Gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway returned ${response.status}`);
    }

    const aiResult = await response.json();
    console.log("[AI-CLEAN] AI response received");

    // Extract tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call in AI response");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const cleanedRaw = parsed.records || [];

    // Compare with originals and flag changes
    const cleaned: CleanedRecord[] = cleanedRaw.map((c: any) => {
      const original = records.find((r) => r.id === c.id);
      return {
        id: c.id,
        company_name: c.company_name || original?.company_name || "",
        contact_name: c.contact_name || original?.contact_name || "",
        company_changed:
          !!original &&
          (original.company_name || "").trim().toLowerCase() !==
            (c.company_name || "").trim().toLowerCase(),
        contact_changed:
          !!original &&
          (original.contact_name || "").trim().toLowerCase() !==
            (c.contact_name || "").trim().toLowerCase(),
      };
    });

    return new Response(JSON.stringify({ cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[AI-CLEAN] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
