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
  audience?: "all_active" | "paid_only" | "free_only" | "specific_emails" | "all_leads";
  specific_emails?: string[];
  test_mode?: boolean;
  test_email?: string;
}

// Company info for CAN-SPAM compliance
const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  address: "Delaware, USA",
  email: "support@recouply.ai",
  website: "https://recouply.ai",
};

const PLATFORM_FROM_EMAIL = "Recouply.ai <notifications@send.inbound.services.recouply.ai>";

/**
 * Generate CAN-SPAM compliant email footer with unsubscribe link
 */
function generateComplianceFooter(unsubscribeUrl: string, email: string): string {
  return `
<!-- CAN-SPAM Compliant Footer -->
<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="text-align: center; padding: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
          You received this email because you subscribed to updates from Recouply.ai
        </p>
        <p style="margin: 0 0 16px; font-size: 12px; color: #64748b;">
          ${COMPANY_INFO.legalName} • ${COMPANY_INFO.address}
        </p>
        <p style="margin: 0;">
          <a href="${unsubscribeUrl}" style="color: #3b82f6; font-size: 13px; text-decoration: underline;">
            Unsubscribe from marketing emails
          </a>
        </p>
        <p style="margin: 8px 0 0; font-size: 11px; color: #94a3b8;">
          This email was sent to ${email}
        </p>
      </td>
    </tr>
  </table>
</div>`;
}

function generateComplianceFooterText(unsubscribeUrl: string, email: string): string {
  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You received this email because you subscribed to updates from Recouply.ai
${COMPANY_INFO.legalName} • ${COMPANY_INFO.address}

Unsubscribe from marketing emails: ${unsubscribeUrl}

This email was sent to ${email}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
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

    // Fetch unsubscribed emails to exclude
    const { data: unsubscribed } = await supabase
      .from("email_unsubscribes")
      .select("email");
    const unsubscribedEmails = new Set((unsubscribed || []).map(u => u.email.toLowerCase()));

    // Test mode - send to single email
    if (test_mode) {
      const targetEmail = test_email || user.email;
      console.log(`Test mode: Sending to ${targetEmail}`);

      // Generate test unsubscribe URL
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe?email=${encodeURIComponent(targetEmail!)}`;
      const htmlWithFooter = emailHtml + generateComplianceFooter(unsubscribeUrl, targetEmail!);
      const textWithFooter = (emailText || "") + generateComplianceFooterText(unsubscribeUrl, targetEmail!);

      const { error: sendError } = await supabase.functions.invoke("send-email", {
        body: {
          to: targetEmail,
          from: PLATFORM_FROM_EMAIL,
          subject: `[TEST] ${emailSubject}`,
          html: htmlWithFooter,
          text: textWithFooter,
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
    let recipients: { email: string; name: string | null; unsubscribe_token?: string | null }[] = [];

    if (audience === "specific_emails" && specific_emails?.length) {
      recipients = specific_emails
        .filter(e => !unsubscribedEmails.has(e.toLowerCase()))
        .map((email) => ({ email, name: null }));
    } else if (audience === "all_leads") {
      // Fetch from marketing_leads table
      const { data: leads, error: leadsError } = await supabase
        .from("marketing_leads")
        .select("email, name, unsubscribe_token")
        .eq("status", "active");

      if (leadsError) {
        console.error("Failed to fetch leads:", leadsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch leads" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recipients = (leads || [])
        .filter((l) => l.email && !unsubscribedEmails.has(l.email.toLowerCase()))
        .map((l) => ({ email: l.email!, name: l.name, unsubscribe_token: l.unsubscribe_token }));
    } else {
      // Build query based on audience (existing user profiles)
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
        .filter((p) => p.email && !unsubscribedEmails.has(p.email.toLowerCase()))
        .map((p) => ({ email: p.email!, name: p.name }));
    }

    console.log(`Sending broadcast to ${recipients.length} recipients (excluding ${unsubscribedEmails.size} unsubscribed)`);

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
            let personalizedHtml = emailHtml!.replace(/\{\{user_name\}\}/g, recipient.name || "there");
            let personalizedText = emailText?.replace(/\{\{user_name\}\}/g, recipient.name || "there");

            // Generate personalized unsubscribe URL
            const unsubscribeUrl = recipient.unsubscribe_token
              ? `${supabaseUrl}/functions/v1/handle-unsubscribe?token=${recipient.unsubscribe_token}`
              : `${supabaseUrl}/functions/v1/handle-unsubscribe?email=${encodeURIComponent(recipient.email)}`;

            // Add CAN-SPAM compliant footer
            personalizedHtml += generateComplianceFooter(unsubscribeUrl, recipient.email);
            personalizedText = (personalizedText || "") + generateComplianceFooterText(unsubscribeUrl, recipient.email);

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