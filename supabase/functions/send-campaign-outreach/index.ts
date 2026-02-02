import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCampaignOutreachRequest {
  campaign_id: string;
  step_number?: number; // If provided, send specific step only; otherwise send next due step
  lead_ids?: string[]; // If provided, send to specific leads; otherwise all active leads
  test_mode?: boolean;
}

const PLATFORM_FROM_EMAIL = "Recouply.ai <notifications@send.inbound.services.recouply.ai>";

/**
 * Convert plain text with line breaks to proper HTML with paragraphs
 * Preserves the visual structure of the original text
 */
function formatBodyAsHtml(body: string): string {
  if (!body) return "";
  
  // If already contains HTML tags, return as-is
  if (/<[a-z][\s\S]*>/i.test(body)) {
    return body;
  }
  
  // Split by double newlines to create paragraphs
  const paragraphs = body.split(/\n\n+/);
  
  return paragraphs
    .map(paragraph => {
      // Convert single newlines within a paragraph to <br>
      const lines = paragraph.trim().split(/\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length === 0) return "";
      return `<p style="margin: 0 0 16px 0; line-height: 1.6;">${lines.join("<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

// CAN-SPAM compliant footer
function generateComplianceFooter(unsubscribeUrl: string): string {
  return `
<!-- CAN-SPAM Compliant Footer -->
<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="text-align: center; padding: 20px 0;">
        <p style="margin: 0 0 12px; font-size: 12px; color: #64748b;">
          RecouplyAI Inc. • Delaware, USA
        </p>
        <p style="margin: 0 0 8px;">
          <a href="${unsubscribeUrl}" style="color: #3b82f6; font-size: 12px; text-decoration: underline;">
            Unsubscribe
          </a>
        </p>
      </td>
    </tr>
  </table>
</div>`;
}

function generateComplianceFooterText(unsubscribeUrl: string): string {
  return `

---
RecouplyAI Inc. • Delaware, USA
Unsubscribe: ${unsubscribeUrl}`;
}

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

    const payload: SendCampaignOutreachRequest = await req.json();
    const { campaign_id, step_number, lead_ids, test_mode = false } = payload;

    console.log("Processing campaign outreach:", { campaign_id, step_number, lead_ids, test_mode });

    // Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the outreach email template for the requested step
    const targetStep = step_number ?? 0;
    const { data: emailTemplate, error: templateError } = await supabase
      .from("campaign_outreach_emails")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("step_number", targetStep)
      .in("status", ["approved", "active"]) // Allow both approved and active (already sent once)
      .single();

    if (templateError || !emailTemplate) {
      console.log("Template query error:", templateError);
      return new Response(
        JSON.stringify({ error: `No approved email template found for step ${targetStep}. Please create and approve the template first.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Using template for step ${targetStep}:`, emailTemplate.subject);

    // Get leads for this campaign
    let leadsQuery = supabase
      .from("marketing_leads")
      .select("id, email, name, unsubscribe_token, status")
      .eq("campaign_id", campaign_id)
      .neq("status", "unsubscribed");

    if (lead_ids && lead_ids.length > 0) {
      leadsQuery = leadsQuery.in("id", lead_ids);
    }

    const { data: leads, error: leadsError } = await leadsQuery;

    if (leadsError || !leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No eligible leads found for this campaign" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get lead progress to filter who needs this step
    const { data: progressRecords } = await supabase
      .from("lead_campaign_progress")
      .select("*")
      .eq("campaign_id", campaign_id)
      .in("lead_id", leads.map(l => l.id));

    const progressMap = new Map(
      (progressRecords || []).map(p => [p.lead_id, p])
    );

    // Filter leads that need this step sent
    const eligibleLeads = leads.filter(lead => {
      const progress = progressMap.get(lead.id);
      if (!progress) return true; // No progress record = needs step 0
      if (targetStep === 0) return !progress.step_0_sent_at;
      if (targetStep === 1) return progress.step_0_sent_at && !progress.step_1_sent_at;
      if (targetStep === 2) return progress.step_1_sent_at && !progress.step_2_sent_at;
      return false;
    });

    if (eligibleLeads.length === 0) {
      return new Response(
        JSON.stringify({ error: `No leads eligible for step ${targetStep} (already sent or prerequisites not met)` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test mode - send to admin only
    if (test_mode) {
      const testEmail = user.email!;
      console.log(`Test mode: Sending step ${targetStep} to ${testEmail}`);

      const unsubscribeUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe?email=${encodeURIComponent(testEmail)}`;
      const personalizedSubject = `[TEST] ${emailTemplate.subject?.replace(/\{\{user_name\}\}/g, "Test User") || "No Subject"}`;
      const formattedBody = formatBodyAsHtml((emailTemplate.body_html || "").replace(/\{\{user_name\}\}/g, "Test User"));
      const personalizedHtml = formattedBody + generateComplianceFooter(unsubscribeUrl);
      const personalizedText = (emailTemplate.body_text || emailTemplate.body_html || "").replace(/\{\{user_name\}\}/g, "Test User") + 
        generateComplianceFooterText(unsubscribeUrl);

      const { error: sendError } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          from: PLATFORM_FROM_EMAIL,
          subject: personalizedSubject,
          html: personalizedHtml,
          text: personalizedText,
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
        JSON.stringify({ success: true, message: `Test email for step ${targetStep} sent to ${testEmail}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send emails to all eligible leads
    let sentCount = 0;
    let failedCount = 0;
    const batchSize = 10;

    for (let i = 0; i < eligibleLeads.length; i += batchSize) {
      const batch = eligibleLeads.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (lead) => {
          try {
            const personalizedSubject = (emailTemplate.subject || "").replace(/\{\{user_name\}\}/g, lead.name || "there");
            const unsubscribeUrl = lead.unsubscribe_token
              ? `${supabaseUrl}/functions/v1/handle-unsubscribe?token=${lead.unsubscribe_token}`
              : `${supabaseUrl}/functions/v1/handle-unsubscribe?email=${encodeURIComponent(lead.email)}`;

            const formattedBody = formatBodyAsHtml((emailTemplate.body_html || "").replace(/\{\{user_name\}\}/g, lead.name || "there"));
            const personalizedHtml = formattedBody + generateComplianceFooter(unsubscribeUrl);
            const personalizedText = (emailTemplate.body_text || emailTemplate.body_html || "").replace(/\{\{user_name\}\}/g, lead.name || "there") +
              generateComplianceFooterText(unsubscribeUrl);

            const { error: sendError } = await supabase.functions.invoke("send-email", {
              body: {
                to: lead.email,
                from: PLATFORM_FROM_EMAIL,
                subject: personalizedSubject,
                html: personalizedHtml,
                text: personalizedText,
              },
            });

            if (sendError) {
              console.error(`Failed to send to ${lead.email}:`, sendError);
              failedCount++;
              return;
            }

            // Update lead progress
            const progress = progressMap.get(lead.id);
            const now = new Date().toISOString();

            if (progress) {
              const updateData: Record<string, unknown> = {
                current_step: targetStep + 1,
                updated_at: now,
              };
              if (targetStep === 0) updateData.step_0_sent_at = now;
              if (targetStep === 1) updateData.step_1_sent_at = now;
              if (targetStep === 2) {
                updateData.step_2_sent_at = now;
                updateData.status = "completed";
              }

              // Calculate next send date (3 or 4 days for next step)
              if (targetStep < 2) {
                const nextDays = targetStep === 0 ? 3 : 4;
                const nextSendDate = new Date();
                nextSendDate.setDate(nextSendDate.getDate() + nextDays);
                updateData.next_send_at = nextSendDate.toISOString();
              } else {
                updateData.next_send_at = null;
              }

              await supabase
                .from("lead_campaign_progress")
                .update(updateData)
                .eq("id", progress.id);
            } else {
              // Create new progress record
              const nextSendDate = new Date();
              nextSendDate.setDate(nextSendDate.getDate() + 3);

              await supabase
                .from("lead_campaign_progress")
                .insert({
                  lead_id: lead.id,
                  campaign_id: campaign_id,
                  current_step: 1,
                  step_0_sent_at: now,
                  next_send_at: nextSendDate.toISOString(),
                  status: "active",
                });
            }

            // Update lead's last_engaged_at
            await supabase
              .from("marketing_leads")
              .update({ last_engaged_at: now })
              .eq("id", lead.id);

            sentCount++;
          } catch (err) {
            console.error(`Error sending to ${lead.email}:`, err);
            failedCount++;
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < eligibleLeads.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update campaign stats
    const { data: campaignStats } = await supabase
      .from("marketing_campaigns")
      .select("emails_sent")
      .eq("id", campaign_id)
      .single();

    await supabase
      .from("marketing_campaigns")
      .update({
        emails_sent: (campaignStats?.emails_sent || 0) + sentCount,
      })
      .eq("id", campaign_id);

    // Mark email template as "active" (sent at least once)
    await supabase
      .from("campaign_outreach_emails")
      .update({ status: "active" })
      .eq("id", emailTemplate.id);

    console.log(`Campaign outreach complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        step_number: targetStep,
        total_eligible: eligibleLeads.length,
        sent_count: sentCount,
        failed_count: failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Campaign outreach error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
