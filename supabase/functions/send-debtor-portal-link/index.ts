import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendPortalLinkRequest {
  email: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { email } = await req.json() as SendPortalLinkRequest;
    
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log("[DEBTOR-PORTAL-LINK] Processing request for email:", normalizedEmail);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check multiple sources for this email:
    // 1. contacts table (synced from integrations)
    // 2. debtor_contacts table (manually managed contacts)
    // 3. debtors table directly (legacy email field)
    
    const debtorIdsSet = new Set<string>();

    // Check contacts table
    const { data: contactsData, error: contactsError } = await supabase
      .from("contacts")
      .select(`id, debtor_id`)
      .ilike("email", normalizedEmail);

    if (contactsError) {
      console.error("[DEBTOR-PORTAL-LINK] Error checking contacts:", contactsError);
    } else if (contactsData) {
      contactsData.forEach(c => debtorIdsSet.add(c.debtor_id));
      console.log(`[DEBTOR-PORTAL-LINK] Found ${contactsData.length} match(es) in contacts table`);
    }

    // Check debtor_contacts table
    const { data: debtorContactsData, error: debtorContactsError } = await supabase
      .from("debtor_contacts")
      .select(`id, debtor_id`)
      .ilike("email", normalizedEmail);

    if (debtorContactsError) {
      console.error("[DEBTOR-PORTAL-LINK] Error checking debtor_contacts:", debtorContactsError);
    } else if (debtorContactsData) {
      debtorContactsData.forEach(c => debtorIdsSet.add(c.debtor_id));
      console.log(`[DEBTOR-PORTAL-LINK] Found ${debtorContactsData.length} match(es) in debtor_contacts table`);
    }

    // Check debtors table directly (email field on debtor record)
    const { data: debtorsData, error: debtorsError } = await supabase
      .from("debtors")
      .select(`id`)
      .ilike("email", normalizedEmail);

    if (debtorsError) {
      console.error("[DEBTOR-PORTAL-LINK] Error checking debtors:", debtorsError);
    } else if (debtorsData) {
      debtorsData.forEach(d => debtorIdsSet.add(d.id));
      console.log(`[DEBTOR-PORTAL-LINK] Found ${debtorsData.length} match(es) in debtors table`);
    }

    const debtorIds = [...debtorIdsSet];
    console.log(`[DEBTOR-PORTAL-LINK] Total unique debtors found: ${debtorIds.length}`);
    
    if (debtorIds.length === 0) {
      console.log("[DEBTOR-PORTAL-LINK] No debtors found for email:", normalizedEmail);
      // Don't reveal whether email exists for security
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If this email is associated with payment plans, you will receive a link shortly." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there are any active payment plans OR open invoices for these debtors.
    // Note: Invoice "overdue" is derived from due_date (DPD), not a database status.

    const { data: activePlans, error: plansError } = await supabase
      .from("payment_plans")
      .select("id, debtor_id, user_id")
      .in("debtor_id", debtorIds)
      .in("status", ["proposed", "accepted", "active"]);

    if (plansError) {
      console.error("[DEBTOR-PORTAL-LINK] Error checking plans:", plansError);
      throw plansError;
    }

    const { data: openInvoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("id, debtor_id, user_id, status, is_on_payment_plan")
      .in("debtor_id", debtorIds)
      .in("status", ["Open", "PartiallyPaid"])
      .eq("is_on_payment_plan", false);

    if (invoicesError) {
      console.error("[DEBTOR-PORTAL-LINK] Error checking invoices:", invoicesError);
      throw invoicesError;
    }

    const hasPlans = (activePlans?.length || 0) > 0;
    const hasInvoices = (openInvoices?.length || 0) > 0;

    if (!hasPlans && !hasInvoices) {
      console.log(
        "[DEBTOR-PORTAL-LINK] No active plans or open invoices for email:",
        normalizedEmail
      );
      return new Response(
        JSON.stringify({
          success: true,
          message:
            "If this email is associated with invoices or payment plans, you will receive a link shortly.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create portal access token
    const { data: tokenData, error: tokenError } = await supabase
      .from("debtor_portal_tokens")
      .insert({
        email: normalizedEmail,
      })
      .select()
      .single();

    if (tokenError) {
      console.error("[DEBTOR-PORTAL-LINK] Error creating token:", tokenError);
      throw tokenError;
    }

    console.log("[DEBTOR-PORTAL-LINK] Token created:", tokenData.id);

    // Get branding from the first matching account owner for email styling
    const planOwnerId = (activePlans?.[0]?.user_id || openInvoices?.[0]?.user_id) as string;
    const { data: branding } = await supabase
      .from("branding_settings")
      .select("business_name, logo_url, primary_color")
      .eq("user_id", planOwnerId)
      .single();

    // Build magic link URL - use production domain
    const portalUrl = `https://recouply.ai/debtor-portal?token=${tokenData.token}`;

    // Send email via send-email function
    const businessName = branding?.business_name || "Recouply.ai";
    const primaryColor = branding?.primary_color || "#1e3a5f";
    const logoUrl = branding?.logo_url || null;

    // Build logo HTML - use branding logo or Recouply default
    const logoHtml = logoUrl 
      ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 48px; max-width: 200px;" />`
      : `<div style="display: inline-flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.24 3 3 0 0 0 .34 5.58 2.5 2.5 0 0 0 2.96 3.08A2.5 2.5 0 0 0 12 19.5a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 12 4.5"/>
            <path d="m15.7 10.4-.9.4"/>
            <path d="m9.2 13.2-.9.4"/>
            <path d="m13.6 15.7-.4-.9"/>
            <path d="m10.8 9.2-.4-.9"/>
            <path d="m15.7 13.5-.9-.4"/>
            <path d="m9.2 10.9-.9-.4"/>
            <path d="m10.4 15.7.4-.9"/>
            <path d="m13.1 9.2.4-.9"/>
          </svg>
          <span style="font-weight: 700; font-size: 20px; color: white;">Recouply.ai</span>
        </div>`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); padding: 32px; text-align: center;">
            ${logoHtml}
          </div>
          <div style="padding: 40px 32px;">
            <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: 600;">Access Your Account Portal</h2>
            <p style="color: #64748b; line-height: 1.7; margin: 0 0 28px; font-size: 16px;">
              Click the button below to securely view your payment plans, outstanding invoices, and make payments.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(30, 58, 95, 0.35);">
                View My Account
              </a>
            </div>
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 28px;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.6;">
                🔒 This secure link will expire in 24 hours. If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
              Powered by <a href="https://recouply.ai" style="color: #64748b; text-decoration: none; font-weight: 500;">Recouply.ai</a> — Accounts Receivable & Collection Intelligence
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send the email
    const { error: sendError } = await supabase.functions.invoke("send-email", {
      body: {
        to: normalizedEmail,
        from: `${businessName} <notifications@send.inbound.services.recouply.ai>`,
        subject: `Access Your Payment Plans - ${businessName}`,
        html: emailHtml,
      },
    });

    if (sendError) {
      console.error("[DEBTOR-PORTAL-LINK] Error sending email:", sendError);
      throw sendError;
    }

    console.log("[DEBTOR-PORTAL-LINK] Magic link sent successfully to:", normalizedEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If this email is associated with payment plans, you will receive a link shortly." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DEBTOR-PORTAL-LINK] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
