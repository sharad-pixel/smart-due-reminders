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

    // Check if there are active payment plans for these debtors
    const { data: activePlans, error: plansError } = await supabase
      .from("payment_plans")
      .select("id, debtor_id, user_id")
      .in("debtor_id", debtorIds)
      .in("status", ["proposed", "accepted", "active"]);

    if (plansError) {
      console.error("[DEBTOR-PORTAL-LINK] Error checking plans:", plansError);
      throw plansError;
    }

    if (!activePlans || activePlans.length === 0) {
      console.log("[DEBTOR-PORTAL-LINK] No active plans for email:", normalizedEmail);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If this email is associated with payment plans, you will receive a link shortly." 
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

    // Get branding from the first plan's owner for email styling
    const planOwnerId = activePlans[0].user_id;
    const { data: branding } = await supabase
      .from("branding_settings")
      .select("business_name, logo_url, primary_color")
      .eq("user_id", planOwnerId)
      .single();

    // Build magic link URL
    const origin = req.headers.get("origin") || "https://smart-due-reminders.lovable.app";
    const portalUrl = `${origin}/debtor-portal?token=${tokenData.token}`;

    // Send email via send-email function
    const businessName = branding?.business_name || "Recouply";
    const primaryColor = branding?.primary_color || "#1e3a5f";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: ${primaryColor}; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${businessName}</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="margin: 0 0 16px; color: #333;">Access Your Payment Plans</h2>
            <p style="color: #666; line-height: 1.6; margin: 0 0 24px;">
              Click the button below to view your active payment plans and make payments.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${portalUrl}" style="display: inline-block; background-color: ${primaryColor}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600;">
                View Payment Plans
              </a>
            </div>
            <p style="color: #999; font-size: 14px; margin: 24px 0 0;">
              This link will expire in 24 hours. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
          <div style="background-color: #f9f9f9; padding: 16px; text-align: center; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Powered by Recouply.ai
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
