import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AI-PARSE-CREATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    const { prompt_text } = await req.json();
    if (!prompt_text || prompt_text.trim() === "") {
      throw new Error("Prompt text is required");
    }

    logStep("Prompt received", { length: prompt_text.length });

    // Call Lovable AI to parse the prompt
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an intelligent structured-data extractor for AR & invoicing.
Convert the user's natural-language description into structured fields for:
- Debtor (customer account)
- One or more invoices

Do NOT guess missing data. If required information is missing (like debtor name or invoice amount), leave those fields empty and we will flag them.
Respond ONLY in valid JSON format following the exact schema provided.`;

    const userPrompt = `Use this JSON schema exactly:
{
  "debtor": {
    "name": "",
    "company_name": "",
    "email": "",
    "phone": "",
    "notes": ""
  },
  "invoices": [
    {
      "invoice_number": "",
      "amount": null,
      "currency": "USD",
      "issue_date": "",
      "due_date": "",
      "external_link": "",
      "notes": ""
    }
  ]
}

Only include fields you are reasonably confident about. Leave fields null/empty if not clearly specified.

Parse this prompt:
${prompt_text}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logStep("AI error", { status: aiResponse.status, error: errorText });
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    logStep("AI response received");

    // Parse JSON from AI response
    let parsedData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                        aiContent.match(/(\{[\s\S]*\})/);
      const jsonString = jsonMatch ? jsonMatch[1] : aiContent;
      parsedData = JSON.parse(jsonString);
    } catch (parseError: any) {
      logStep("JSON parse error", { error: parseError?.message || String(parseError), content: aiContent });
      throw new Error("AI returned invalid JSON. Please try rephrasing your prompt with more specific details.");
    }

    if (!parsedData.debtor || !Array.isArray(parsedData.invoices)) {
      throw new Error("Invalid data structure from AI. Please include customer and invoice details.");
    }

    logStep("Data parsed successfully");

    // Validate debtor required fields
    const debtorData = parsedData.debtor;
    const debtorMissingFields = [];
    if (!debtorData.name && !debtorData.company_name) {
      debtorMissingFields.push("name or company_name");
    }

    // Check for duplicate debtors
    let duplicateStatus = "none";
    let matchedDebtorId = null;
    let matchedDebtorName = null;
    let possibleMatches: any[] = [];

    if (debtorData.email && debtorData.email.trim() !== "") {
      const { data: emailMatches } = await supabaseClient
        .from("debtors")
        .select("id, name, company_name, email")
        .eq("user_id", user.id)
        .ilike("email", debtorData.email.trim());

      if (emailMatches && emailMatches.length === 1) {
        duplicateStatus = "existing_match";
        matchedDebtorId = emailMatches[0].id;
        matchedDebtorName = emailMatches[0].name || emailMatches[0].company_name;
      } else if (emailMatches && emailMatches.length > 1) {
        duplicateStatus = "multiple_matches";
        possibleMatches = emailMatches;
      }
    }

    if (duplicateStatus === "none" && debtorData.company_name && debtorData.company_name.trim() !== "") {
      const { data: companyMatches } = await supabaseClient
        .from("debtors")
        .select("id, name, company_name, email")
        .eq("user_id", user.id)
        .ilike("company_name", debtorData.company_name.trim());

      if (companyMatches && companyMatches.length === 1) {
        duplicateStatus = "existing_match";
        matchedDebtorId = companyMatches[0].id;
        matchedDebtorName = companyMatches[0].name || companyMatches[0].company_name;
      } else if (companyMatches && companyMatches.length > 1) {
        duplicateStatus = "multiple_matches";
        possibleMatches = companyMatches;
      }
    }

    logStep("Debtor duplicate check", { status: duplicateStatus });

    // Validate invoices
    const validatedInvoices = [];
    for (const invoice of parsedData.invoices) {
      const invoiceMissingFields = [];
      
      if (!invoice.amount || invoice.amount <= 0) {
        invoiceMissingFields.push("amount");
      }
      if (!invoice.due_date || invoice.due_date.trim() === "") {
        invoiceMissingFields.push("due_date");
      }

      // Check for duplicate invoices
      let duplicateInvoice = false;
      let existingInvoiceId = null;

      if (invoice.invoice_number && invoice.invoice_number.trim() !== "") {
        const { data: invoiceMatches } = await supabaseClient
          .from("invoices")
          .select("id, invoice_number")
          .eq("user_id", user.id)
          .ilike("invoice_number", invoice.invoice_number.trim())
          .limit(1);

        if (invoiceMatches && invoiceMatches.length > 0) {
          duplicateInvoice = true;
          existingInvoiceId = invoiceMatches[0].id;
        }
      }

      validatedInvoices.push({
        data: invoice,
        duplicate_invoice: duplicateInvoice,
        existing_invoice_id: existingInvoiceId,
        missing_required_fields: invoiceMissingFields,
        has_errors: invoiceMissingFields.length > 0
      });
    }

    logStep("Validation complete");

    const response = {
      debtor: {
        data: debtorData,
        duplicate_status: duplicateStatus,
        matched_debtor_id: matchedDebtorId,
        matched_debtor_name: matchedDebtorName,
        possible_matches: possibleMatches,
        missing_required_fields: debtorMissingFields,
        has_errors: debtorMissingFields.length > 0
      },
      invoices: validatedInvoices
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});