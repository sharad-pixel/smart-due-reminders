import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";
import { EMAIL_CONFIG, getVerifiedFromAddress } from "../_shared/emailConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendIntroRequest {
  debtorIds: string[];
  customMessage?: string;
  businessName: string;
  replyTo: string;
}

// Helper to batch .in() queries to avoid URL length limits
async function batchInQuery(
  supabase: any,
  table: string,
  column: string,
  ids: string[],
  selectCols: string,
  extraFilters?: (q: any) => any,
  batchSize = 100
) {
  const results: any[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    let query = supabase.from(table).select(selectCols).in(column, chunk);
    if (extraFilters) query = extraFilters(query);
    const { data, error } = await query;
    if (error) throw error;
    if (data) results.push(...data);
  }
  return results;
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
  let requestBody: any;

  if (isServiceRole) {
    requestBody = await req.json();
    userId = requestBody.userId;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId required for service role calls" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
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
    requestBody = await req.json();
  }

  const { debtorIds, customMessage, businessName, replyTo }: SendIntroRequest = requestBody;

  if (!debtorIds?.length) {
    return new Response(
      JSON.stringify({ error: "No debtor IDs provided" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!replyTo?.trim()) {
    return new Response(
      JSON.stringify({ error: "Reply-to email address is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Fetch branding & invoice template for logo + address ──
  const { data: brandingData } = await supabase
    .from("branding_settings")
    .select("logo_url, primary_color, accent_color")
    .eq("user_id", userId)
    .single();

  const { data: templateData } = await supabase
    .from("invoice_templates")
    .select("company_address, company_phone, company_website")
    .eq("user_id", userId)
    .single();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("organization_id, business_address_line1, business_address_line2, business_city, business_state, business_postal_code, business_phone")
    .eq("id", userId)
    .single();

  const orgId = profileData?.organization_id || null;
  const logoUrl = brandingData?.logo_url || null;
  const primaryColor = brandingData?.primary_color || BRAND.primary;
  const accentColor = brandingData?.accent_color || BRAND.accent;

  const companyAddress = templateData?.company_address ||
    [profileData?.business_address_line1, profileData?.business_address_line2,
     [profileData?.business_city, profileData?.business_state].filter(Boolean).join(", "),
     profileData?.business_postal_code].filter(Boolean).join("\n");

  const companyPhone = templateData?.company_phone || profileData?.business_phone || null;
  const companyWebsite = templateData?.company_website || null;

  // ── Fetch debtor contact emails (batched to avoid URL length limits) ──
  let contacts: any[];
  try {
    contacts = await batchInQuery(
      supabase,
      "debtor_contacts",
      "debtor_id",
      debtorIds,
      "debtor_id, email, name, is_primary",
      (q: any) => q.eq("outreach_enabled", true).order("is_primary", { ascending: false })
    );
  } catch (contactError) {
    console.error("Error fetching contacts:", contactError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch debtor contacts" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Check which debtor_ids have already been sent for this user (batched) ──
  let alreadySent: any[];
  try {
    alreadySent = await batchInQuery(
      supabase,
      "ar_introduction_emails",
      "debtor_id",
      debtorIds,
      "debtor_id, debtor_email",
      (q: any) => q.eq("user_id", userId)
    );
  } catch {
    alreadySent = [];
  }

  const sentDebtorSet = new Set(alreadySent.map((r: any) => r.debtor_id));
  const sentEmailSet = new Set(alreadySent.map((r: any) => r.debtor_email?.toLowerCase()).filter(Boolean));

  // Also check ALL emails this user has ever sent intros to
  const { data: allSentEmails } = await supabase
    .from("ar_introduction_emails")
    .select("debtor_email")
    .eq("user_id", userId);
  for (const row of allSentEmails || []) {
    if (row.debtor_email) sentEmailSet.add(row.debtor_email.toLowerCase());
  }

  const fromAddress = getVerifiedFromAddress(businessName, "notifications");
  const portalUrl = "https://recouply.ai/debtor-portal";

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  // ── Group contacts by debtor (primary first) ──
  const debtorContactMap = new Map<string, { email: string; name: string | null }>();
  for (const c of contacts) {
    if (!debtorContactMap.has(c.debtor_id) && c.email) {
      debtorContactMap.set(c.debtor_id, { email: c.email, name: c.name });
    }
  }

  const batchSentEmails = new Set<string>();

  for (const debtorId of debtorIds) {
    if (sentDebtorSet.has(debtorId)) {
      skipped++;
      continue;
    }

    const contact = debtorContactMap.get(debtorId);
    if (!contact?.email) {
      skipped++;
      continue;
    }

    const emailLower = contact.email.toLowerCase();

    if (sentEmailSet.has(emailLower) || batchSentEmails.has(emailLower)) {
      await supabase.from("ar_introduction_emails").insert({
        debtor_id: debtorId,
        user_id: userId,
        organization_id: orgId,
        debtor_email: contact.email,
        business_name: businessName,
      }).then(() => {}).catch(() => {});
      skipped++;
      continue;
    }

    const recipientName = contact.name || "Valued Client";

    const logoHtml = logoUrl
      ? `<div style="text-align: center; margin: 0 0 24px;">
           <img src="${logoUrl}" alt="${businessName}" style="max-height: 60px; max-width: 200px;" />
         </div>`
      : "";

    const addressHtml = companyAddress
      ? `<p style="margin: 4px 0 0; color: ${BRAND.muted}; font-size: 12px; white-space: pre-line;">${companyAddress}</p>`
      : "";

    const phoneHtml = companyPhone
      ? `<p style="margin: 2px 0 0; color: ${BRAND.muted}; font-size: 12px;">📞 ${companyPhone}</p>`
      : "";

    const websiteHtml = companyWebsite
      ? `<p style="margin: 2px 0 0; color: ${BRAND.muted}; font-size: 12px;">🌐 <a href="${companyWebsite}" style="color: ${primaryColor}; text-decoration: none;">${companyWebsite}</a></p>`
      : "";

    const bodyContent = `
      ${logoHtml}

      <h2 style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700;">
        Enhanced Accounts Receivable Communication
      </h2>

      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        Dear ${recipientName},
      </p>

      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        We are writing to inform you that <strong>${businessName}</strong> has implemented an enhanced accounts receivable management system powered by <strong>Recouply.ai</strong> — a Collections &amp; Risk Intelligence Platform designed to improve client communication, transparency, and efficiency.
      </p>

      <div style="background-color: ${primaryColor}; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
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
      <div style="background: #f8fafc; border-left: 4px solid ${primaryColor}; border-radius: 4px; padding: 16px; margin: 24px 0;">
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
        <a href="${portalUrl}" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 14px; font-weight: 600;">
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
        ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 36px; max-width: 140px; margin-bottom: 8px;" />` : ""}
        <p style="margin: 0; color: ${BRAND.foreground}; font-size: 15px; font-weight: 600;">
          ${businessName}
        </p>
        <p style="margin: 4px 0 0; color: ${BRAND.muted}; font-size: 13px;">
          Accounts Receivable Department
        </p>
        ${addressHtml}
        ${phoneHtml}
        ${websiteHtml}
        <p style="margin: 8px 0 0; color: ${primaryColor}; font-size: 12px; font-style: italic;">
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
          reply_to: replyTo,
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

      await supabase.from("ar_introduction_emails").insert({
        debtor_id: debtorId,
        user_id: userId,
        organization_id: orgId,
        debtor_email: contact.email,
        business_name: businessName,
      });

      batchSentEmails.add(emailLower);
      sent++;

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
