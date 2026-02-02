import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Company info for compliance
const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  address: "Delaware, USA",
  email: "support@recouply.ai",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const email = url.searchParams.get("email");

    console.log("Unsubscribe request:", { token: token?.substring(0, 8) + "...", email });

    if (!token && !email) {
      return new Response(
        generateUnsubscribePage("Invalid Request", "Missing unsubscribe token or email.", false),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Find the lead by token or email
    let leadEmail = email;
    
    if (token) {
      const { data: lead, error } = await supabase
        .from("marketing_leads")
        .select("email")
        .eq("unsubscribe_token", token)
        .single();

      if (error || !lead) {
        console.log("Token not found in marketing_leads, checking email_unsubscribes");
        
        // Check if already unsubscribed
        const { data: existing } = await supabase
          .from("email_unsubscribes")
          .select("email")
          .eq("token", token)
          .single();

        if (existing) {
          return new Response(
            generateUnsubscribePage("Already Unsubscribed", `${existing.email} has already been unsubscribed.`, true),
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }

        return new Response(
          generateUnsubscribePage("Invalid Link", "This unsubscribe link is invalid or expired.", false),
          { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }

      leadEmail = lead.email;
    }

    if (!leadEmail) {
      return new Response(
        generateUnsubscribePage("Invalid Request", "Could not determine email address.", false),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Record unsubscribe
    const { error: unsubError } = await supabase
      .from("email_unsubscribes")
      .upsert({
        email: leadEmail,
        source: "marketing",
        token: token || undefined,
      }, { onConflict: "email" });

    if (unsubError) {
      console.error("Failed to record unsubscribe:", unsubError);
    }

    // Update lead status
    const { error: updateError } = await supabase
      .from("marketing_leads")
      .update({ status: "unsubscribed" })
      .eq("email", leadEmail);

    if (updateError) {
      console.error("Failed to update lead status:", updateError);
    }

    console.log(`Successfully unsubscribed: ${leadEmail}`);

    return new Response(
      generateUnsubscribePage("Unsubscribed Successfully", `${leadEmail} has been removed from our marketing list.`, true),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error: unknown) {
    console.error("Unsubscribe error:", error);
    return new Response(
      generateUnsubscribePage("Error", "An error occurred. Please try again or contact support.", false),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});

function generateUnsubscribePage(title: string, message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Recouply.ai</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
    }
    .icon.success { background: #dcfce7; }
    .icon.error { background: #fee2e2; }
    h1 {
      font-size: 24px;
      color: #1e293b;
      margin-bottom: 16px;
    }
    p {
      color: #64748b;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
    }
    .footer a { color: #3b82f6; text-decoration: none; }
    .logo {
      font-weight: 700;
      font-size: 18px;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .logo span { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon ${success ? 'success' : 'error'}">${success ? '✓' : '!'}</div>
    <div class="logo">Recouply<span>.ai</span></div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${success ? '<p style="font-size: 14px;">You will no longer receive marketing emails from us.</p>' : ''}
    <div class="footer">
      <p>${COMPANY_INFO.legalName} • ${COMPANY_INFO.address}</p>
      <p>Questions? <a href="mailto:${COMPANY_INFO.email}">${COMPANY_INFO.email}</a></p>
    </div>
  </div>
</body>
</html>`;
}
