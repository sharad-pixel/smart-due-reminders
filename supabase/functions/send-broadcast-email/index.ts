import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BroadcastRequest {
  broadcast_id?: string;
  template_key?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  audience?: "all_active" | "paid_only" | "free_only" | "specific_emails";
  specific_emails?: string[];
  test_mode?: boolean;
  test_email?: string;
}

const PLATFORM_FROM_EMAIL = "Recouply.ai <notifications@send.inbound.services.recouply.ai>";

serve(async (req) => {
  // Handle CORS preflight
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

    const payload: BroadcastRequest = await req.json();
    const {
      broadcast_id,
      template_key,
      subject,
      body_html,
      body_text,
      audience = "all_active",
      specific_emails,
      test_mode = false,
      test_email,
    } = payload;

    console.log("Processing broadcast:", { template_key, audience, test_mode });

    // Get email content
    let emailSubject = subject;
    let emailHtml = body_html;
    let emailText = body_text;

    // If using a template, fetch it
    if (template_key) {
      const { data: template, error: templateError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_key", template_key)
        .eq("is_active", true)
        .single();

      if (templateError || !template) {
        return new Response(
          JSON.stringify({ error: `Template '${template_key}' not found` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      emailSubject = emailSubject || template.subject_template;
      emailHtml = emailHtml || template.body_html;
      emailText = emailText || template.body_text;
    }

    if (!emailSubject || !emailHtml) {
      return new Response(
        JSON.stringify({ error: "Subject and body_html are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test mode - send to single email
    if (test_mode) {
      const targetEmail = test_email || user.email;
      console.log(`Test mode: Sending to ${targetEmail}`);

      const { error: sendError } = await supabase.functions.invoke("send-email", {
        body: {
          to: targetEmail,
          from: PLATFORM_FROM_EMAIL,
          subject: `[TEST] ${emailSubject}`,
          html: emailHtml,
          text: emailText,
        },
      });

      if (sendError) {
        console.error("Test email failed:", sendError);
        return new Response(
          JSON.stringify({ error: "Failed to send test email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: `Test email sent to ${targetEmail}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recipient list based on audience
    let recipients: { email: string; name: string | null }[] = [];

    if (audience === "specific_emails" && specific_emails?.length) {
      recipients = specific_emails.map((email) => ({ email, name: null }));
    } else {
      // Build query based on audience
      let query = supabase
        .from("profiles")
        .select("email, name, plan_type, subscription_status")
        .eq("is_suspended", false)
        .not("email", "is", null);

      if (audience === "paid_only") {
        query = query.in("subscription_status", ["active", "trialing"]);
      } else if (audience === "free_only") {
        query = query.or("subscription_status.is.null,plan_type.eq.free");
      }

      const { data: profiles, error: profilesError } = await query;

      if (profilesError) {
        console.error("Failed to fetch recipients:", profilesError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch recipients" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recipients = (profiles || [])
        .filter((p) => p.email)
        .map((p) => ({ email: p.email!, name: p.name }));
    }

    console.log(`Sending broadcast to ${recipients.length} recipients`);

    // Update broadcast record if provided
    if (broadcast_id) {
      await supabase
        .from("email_broadcasts")
        .update({
          status: "sending",
          total_recipients: recipients.length,
        })
        .eq("id", broadcast_id);
    }

    // Send emails in batches
    let sentCount = 0;
    let failedCount = 0;
    const batchSize = 10;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (recipient) => {
          try {
            // Replace user-specific variables
            const personalizedSubject = emailSubject!.replace(/\{\{user_name\}\}/g, recipient.name || "there");
            const personalizedHtml = emailHtml!.replace(/\{\{user_name\}\}/g, recipient.name || "there");
            const personalizedText = emailText?.replace(/\{\{user_name\}\}/g, recipient.name || "there");

            const { error: sendError } = await supabase.functions.invoke("send-email", {
              body: {
                to: recipient.email,
                from: PLATFORM_FROM_EMAIL,
                subject: personalizedSubject,
                html: personalizedHtml,
                text: personalizedText,
              },
            });

            if (sendError) {
              console.error(`Failed to send to ${recipient.email}:`, sendError);
              failedCount++;
            } else {
              sentCount++;
            }
          } catch (err) {
            console.error(`Error sending to ${recipient.email}:`, err);
            failedCount++;
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Update broadcast record
    if (broadcast_id) {
      await supabase
        .from("email_broadcasts")
        .update({
          status: "completed",
          sent_at: new Date().toISOString(),
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq("id", broadcast_id);
    }

    console.log(`Broadcast complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_recipients: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Broadcast error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
