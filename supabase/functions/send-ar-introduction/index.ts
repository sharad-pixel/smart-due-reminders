import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";
import { EMAIL_CONFIG, getVerifiedFromAddress } from "../_shared/emailConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendIntroRequest {
  debtorIds: string[];       // Array of debtor IDs to send to
  customMessage?: string;    // Optional custom message from the user
  businessName: string;      // The creditor's business name
  replyTo?: string;          // Optional user-defined reply-to address
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const isServiceRole = supabaseServiceKey && token === supabaseServiceKey;

  let userId: string;

  if (isServiceRole) {
    const body = await req.json();
    userId = body.userId;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId required for service role calls" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    var requestBody = body;
  } else {
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    userId = user.id;
    var requestBody = await req.json();
  }

  const { debtorIds, customMessage, businessName, replyTo }: SendIntroRequest = requestBody;

  if (!debtorIds?.length) {
    return new Response(
      JSON.stringify({ error: "No debtor IDs provided" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch debtor contact emails
  const { data: contacts, error: contactError } = await supabase
    .from("debtor_contacts")
    .select("debtor_id, email, name, is_primary")
    .in("debtor_id", debtorIds)
    .eq("outreach_enabled", true)
    .order("is_primary", { ascending: false });

  if (contactError) {
    console.error("Error fetching contacts:", contactError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch debtor contacts" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check which have already been sent
  const { data: alreadySent } = await supabase
    .from("ar_introduction_emails")
    .select("debtor_id")
    .eq("user_id", userId)
    .in("debtor_id", debtorIds);

  const sentSet = new Set((alreadySent || []).map((r: any) => r.debtor_id));

  // Get org ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();

  const orgId = profile?.organization_id || null;
  const fromAddress = getVerifiedFromAddress(businessName, "notifications");
  const portalUrl = "https://recouply.ai/debtor-portal";

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  // Group contacts by debtor (pick primary or first available)
  const debtorContactMap = new Map<string, { email: string; name: string | null }>();
  for (const c of contacts || []) {
    if (!debtorContactMap.has(c.debtor_id) && c.email) {
      debtorContactMap.set(c.debtor_id, { email: c.email, name: c.name });
    }
  }

  for (const debtorId of debtorIds) {
    if (sentSet.has(debtorId)) {
      skipped++;
      continue;
    }

    const contact = debtorContactMap.get(debtorId);
    if (!contact?.email) {
      skipped++;
      continue;
    }

    const recipientName = contact.name || "Valued Client";

    const bodyContent = `
      <h2 style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700;">
        Enhanced Accounts Receivable Communication
      </h2>

      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        Dear ${recipientName},
      </p>

      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        We are writing to inform you that <strong>${businessName}</strong> has implemented an enhanced accounts receivable management system powered by <strong>Recouply.ai</strong> — a Collections &amp; Risk Intelligence Platform designed to improve client communication, transparency, and efficiency.
      </p>

      <div style="background-color: ${BRAND.primary}; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">
          What This Means for You
        </p>
        <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.85); font-size: 14px;">
          Streamlined communication &bull; Secure payment portal &bull; Real-time account visibility
        </p>
      </div>

      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        As part of our commitment to delivering an exceptional client experience, we have adopted a co-pilot approach to accounts receivable management. This means you may receive communications from Recouply.ai on behalf of <strong>${businessName}</strong>. These communications are legitimate, authorized, and designed to serve as a single source of record for all receivables-related correspondence.
      </p>

      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #86efac;">
        <h3 style="margin: 0 0 14px; color: #166534; font-size: 16px; font-weight: 600;">
          ✅ Please Trust Communications From Recouply.ai
        </h3>
        <ul style="margin: 0; padding: 0 0 0 18px; color: #15803d; font-size: 14px; line-height: 2;">
          <li>Emails will come from verified <strong>@recouply.ai</strong> addresses</li>
          <li>All messages are authorized by <strong>${businessName}</strong></li>
          <li>We use <strong>256-bit encryption</strong> for all communications</li>
          <li>Your data privacy and security are our top priorities</li>
        </ul>
      </div>

      ${customMessage ? `
      <div style="background: #f8fafc; border-left: 4px solid ${BRAND.primary}; border-radius: 4px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 8px; color: ${BRAND.foreground}; font-size: 13px; font-weight: 600;">
          A message from ${businessName}:
        </p>
        <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.7;">
          ${customMessage}
        </p>
      </div>
      ` : ""}

      <h3 style="margin: 24px 0 14px; color: ${BRAND.foreground}; font-size: 16px; font-weight: 600;">
        🔒 Your Secure Payment Portal
      </h3>
      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        You now have access to a secure, encrypted portal where you can view outstanding balances, review invoice details, and communicate directly with our team. Simply use the email address this message was sent to for instant, password-free access.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${portalUrl}" style="display: inline-block; background-color: ${BRAND.accent}; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 14px; font-weight: 600;">
          Access Your Payment Portal →
        </a>
        <p style="margin: 10px 0 0; color: ${BRAND.muted}; font-size: 12px;">
          🔐 256-bit encrypted · Powered by Recouply.ai
        </p>
      </div>

      <p style="margin: 24px 0 0; color: #475569; font-size: 14px; line-height: 1.7;">
        If you have any questions about this transition, please don't hesitate to reach out. We are committed to maintaining the highest standards of service and communication.
      </p>

      <p style="margin: 20px 0 0; color: #475569; font-size: 14px; line-height: 1.7;">
        Thank you for your continued partnership.
      </p>

      <div style="margin: 24px 0 0; padding-top: 18px; border-top: 1px solid ${BRAND.border};">
        <p style="margin: 0; color: ${BRAND.foreground}; font-size: 15px; font-weight: 600;">
          ${businessName}
        </p>
        <p style="margin: 4px 0 0; color: ${BRAND.muted}; font-size: 13px;">
          Accounts Receivable Department
        </p>
        <p style="margin: 4px 0 0; color: ${BRAND.primary}; font-size: 12px; font-style: italic;">
          Powered by Recouply.ai — Collections &amp; Risk Intelligence
        </p>
      </div>
    `;

    const htmlContent = wrapEnterpriseEmail(bodyContent, {
      headerStyle: "gradient",
      title: "Important Notice",
      subtitle: `A message from ${businessName}`,
    });

    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [contact.email],
          reply_to: EMAIL_CONFIG.DEFAULT_REPLY_TO,
          subject: `Important: ${businessName} — Enhanced Accounts Receivable Communication`,
          html: htmlContent,
        }),
      });

      if (!resendResponse.ok) {
        const errData = await resendResponse.text();
        console.error(`Failed to send to ${contact.email}:`, errData);
        errors.push(`${contact.email}: ${errData}`);
        failed++;
        continue;
      }

      // Record success
      await supabase.from("ar_introduction_emails").insert({
        debtor_id: debtorId,
        user_id: userId,
        organization_id: orgId,
        debtor_email: contact.email,
        business_name: businessName,
      });

      sent++;

      // Small delay to avoid rate limits
      if (debtorIds.length > 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      console.error(`Error sending to ${contact.email}:`, err);
      errors.push(`${contact.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ success: true, sent, skipped, failed, errors: errors.length > 0 ? errors : undefined }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
