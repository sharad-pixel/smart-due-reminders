import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetTemplateRequest {
  template_key: string;
  variables?: Record<string, string>;
}

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  category: string;
  subject_template: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  is_active: boolean;
}

// Replace variables in template content
function replaceVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  });
  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { template_key, variables = {} }: GetTemplateRequest = await req.json();

    if (!template_key) {
      return new Response(
        JSON.stringify({ error: "template_key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching email template: ${template_key}`);

    // Fetch the template
    const { data: template, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", template_key)
      .eq("is_active", true)
      .single();

    if (error || !template) {
      console.error("Template not found:", error);
      return new Response(
        JSON.stringify({ error: `Template '${template_key}' not found or inactive` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Replace variables in the template
    const processedTemplate = {
      ...template,
      subject: replaceVariables(template.subject_template, variables),
      body_html: replaceVariables(template.body_html, variables),
      body_text: template.body_text ? replaceVariables(template.body_text, variables) : null,
    };

    console.log(`Template '${template_key}' processed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        template: processedTemplate,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error fetching template:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
