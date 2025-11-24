import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DocumentAnalysisRequest {
  documentId: string;
  category: string;
  fileName: string;
}

interface ValidationIssue {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  recommendation: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { documentId, category, fileName }: DocumentAnalysisRequest = await req.json();

    console.log(`Analyzing document: ${documentId}, category: ${category}, file: ${fileName}`);

    // Get document details
    const { data: document, error: docError } = await supabaseClient
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError) {
      throw new Error(`Document not found: ${docError.message}`);
    }

    // Analyze document based on category using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const analysisPrompt = getAnalysisPrompt(category, fileName);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a document validation expert specializing in financial and compliance documents. Analyze documents for completeness, accuracy, and compliance issues."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "document_validation_results",
            description: "Return document validation findings",
            parameters: {
              type: "object",
              properties: {
                issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                      description: { type: "string" },
                      recommendation: { type: "string" }
                    },
                    required: ["type", "severity", "description", "recommendation"]
                  }
                },
                suggestedTasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      summary: { type: "string" },
                      details: { type: "string" },
                      priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
                      task_type: { type: "string" },
                      ai_reasoning: { type: "string" }
                    },
                    required: ["summary", "details", "priority", "task_type", "ai_reasoning"]
                  }
                },
                shouldVerify: { type: "boolean" },
                expirationDate: { type: "string" }
              },
              required: ["issues", "suggestedTasks", "shouldVerify"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "document_validation_results" } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls[0];
    const analysis = JSON.parse(toolCall.function.arguments);

    console.log("Analysis results:", analysis);

    // Update document metadata with analysis results
    const { error: updateError } = await supabaseClient
      .from("documents")
      .update({
        metadata: {
          ...document.metadata,
          analysis: {
            issues: analysis.issues,
            analyzedAt: new Date().toISOString(),
            analyzedBy: "ai"
          }
        },
        status: analysis.shouldVerify ? "pending_review" : document.status,
        expires_at: analysis.expirationDate || null
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Error updating document:", updateError);
    }

    // Create collection tasks for each suggested task
    const tasksToCreate = [];
    for (const task of analysis.suggestedTasks) {
      tasksToCreate.push({
        debtor_id: document.debtor_id,
        user_id: user.id,
        summary: task.summary,
        details: task.details,
        priority: task.priority,
        task_type: task.task_type,
        ai_reasoning: task.ai_reasoning,
        status: "open"
      });
    }

    if (tasksToCreate.length > 0) {
      const { data: createdTasks, error: tasksError } = await supabaseClient
        .from("collection_tasks")
        .insert(tasksToCreate)
        .select();

      if (tasksError) {
        console.error("Error creating tasks:", tasksError);
      } else {
        console.log(`Created ${createdTasks.length} tasks`);
      }
    }

    // Log the document analysis action
    await supabaseClient.rpc("log_document_access", {
      p_document_id: documentId,
      p_action: "analyze",
      p_metadata: { issues_found: analysis.issues.length, tasks_created: tasksToCreate.length }
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          issues: analysis.issues,
          tasksCreated: tasksToCreate.length,
          shouldVerify: analysis.shouldVerify
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-document function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

function getAnalysisPrompt(category: string, fileName: string): string {
  const basePrompt = `Analyze this ${category} document named "${fileName}".`;

  const categoryInstructions: Record<string, string> = {
    ACH: `
Check for:
- Missing or incomplete bank routing number (must be 9 digits)
- Missing or incomplete account number
- Missing account holder name or signature
- Missing account type (checking/savings)
- Missing authorization signature
- Outdated or expired authorization date
- Bank name and address completeness
- Authorization language compliance

Create tasks for any missing or invalid fields.
`,
    WIRE: `
Check for:
- Missing beneficiary bank name and SWIFT/BIC code
- Missing beneficiary account number and name
- Missing intermediary bank information (if international)
- Missing routing/ABA number
- Missing bank address
- Currency specification
- Special instructions or reference codes

Create tasks for incomplete wire instructions.
`,
    W9: `
Check for:
- Missing or invalid TIN/EIN/SSN
- Name mismatch between business and TIN
- Missing signature
- Outdated W-9 form version (current version is 2024)
- Missing business entity classification
- Missing address
- Exempt payee code issues
- FATCA reporting requirements

W-9 forms typically expire after 3 years. Check if update is needed.
`,
    EIN: `
Check for:
- Valid EIN format (XX-XXXXXXX)
- IRS letter authenticity
- Name match with business records
- Date of issuance
- Business structure confirmation

Create task if EIN doesn't match business name on file.
`,
    PROOF_OF_BUSINESS: `
Check for:
- Document type (business license, articles of incorporation, etc.)
- Current and not expired
- Business name matches records
- State/jurisdiction information
- Registration numbers visible

Create task if document appears expired or name mismatch.
`,
    CONTRACT: `
Check for:
- Signatures from all parties
- Effective date and term
- Payment terms clearly defined
- Scope of work or deliverables
- Termination clauses
- Missing exhibits or schedules

Create tasks for unsigned contracts or missing payment terms.
`,
    BANKING_INFO: `
Check for:
- Complete bank account details
- Account ownership verification
- Bank statement or voided check
- Currency and account type
- Authorization for ACH/Wire

Create task if banking information is incomplete.
`,
    TAX_DOCUMENT: `
Check for:
- Tax year relevance (is this current?)
- Proper tax form type
- Signatures and dates
- Business entity match
- State vs Federal classification

Create task if tax year is outdated or form incomplete.
`,
    OTHER: `
Analyze this document for:
- Completeness of information
- Signatures and dates
- Relevance to business operations
- Any missing critical information
- Expiration dates or validity periods

Create appropriate tasks based on findings.
`
  };

  const instruction = categoryInstructions[category] || categoryInstructions.OTHER;

  return `${basePrompt}\n\n${instruction}\n\nBased on the filename and category, identify likely issues and recommend specific, actionable tasks to resolve them. For each issue, specify severity (high/medium/low) and provide clear recommendations.`;
}
