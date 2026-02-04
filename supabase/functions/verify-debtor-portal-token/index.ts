import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyTokenRequest {
  token: string;
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
    const { token: rawToken } = await req.json() as VerifyTokenRequest;
    
    // Clean the token - email clients sometimes add trailing chars or encode
    const token = rawToken ? rawToken.trim() : null;
    
    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[VERIFY-DEBTOR-TOKEN] Verifying token:", token.substring(0, 8) + "...");

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find and validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("debtor_portal_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.log("[VERIFY-DEBTOR-TOKEN] Token not found in database, error:", tokenError?.message);
      console.log("[VERIFY-DEBTOR-TOKEN] Token length:", token.length);
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid or expired link" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    console.log("[VERIFY-DEBTOR-TOKEN] Token expires at:", expiresAt.toISOString(), "Current time:", now.toISOString());
    
    if (expiresAt < now) {
      console.log("[VERIFY-DEBTOR-TOKEN] Token expired by", Math.round((now.getTime() - expiresAt.getTime()) / 1000 / 60), "minutes");
      return new Response(
        JSON.stringify({ valid: false, error: "This link has expired. Please request a new one." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = (tokenData.email || "").toLowerCase().trim();
    console.log("[VERIFY-DEBTOR-TOKEN] Token valid for email:", email);

    // Mark token as used (optional - could allow multiple uses within expiry)
    await supabase
      .from("debtor_portal_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    // Find debtor accounts linked to this email across multiple sources:
    // 1) contacts (synced), 2) debtor_contacts (manual), 3) debtors.email (legacy)
    const debtorIdsSet = new Set<string>();

    // 1) contacts table (also provides debtor metadata via join)
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select(`
        id,
        email,
        debtor_id,
        debtors!inner (
          id,
          company_name,
          reference_id,
          user_id
        )
      `)
      .ilike("email", email);

    if (contactsError) {
      console.error("[VERIFY-DEBTOR-TOKEN] Error fetching contacts:", contactsError);
      throw contactsError;
    }

    (contacts || []).forEach((c) => {
      if (c?.debtor_id) debtorIdsSet.add(c.debtor_id);
    });
    console.log("[VERIFY-DEBTOR-TOKEN] contacts matches:", contacts?.length || 0);

    // 2) debtor_contacts table
    const { data: debtorContacts, error: debtorContactsError } = await supabase
      .from("debtor_contacts")
      .select("id, email, debtor_id")
      .ilike("email", email);

    if (debtorContactsError) {
      console.error("[VERIFY-DEBTOR-TOKEN] Error fetching debtor_contacts:", debtorContactsError);
      throw debtorContactsError;
    }

    (debtorContacts || []).forEach((c) => {
      if (c?.debtor_id) debtorIdsSet.add(c.debtor_id);
    });
    console.log("[VERIFY-DEBTOR-TOKEN] debtor_contacts matches:", debtorContacts?.length || 0);

    // 3) debtors table (direct email field)
    const { data: directDebtors, error: directDebtorsError } = await supabase
      .from("debtors")
      .select("id, company_name, reference_id, user_id")
      .ilike("email", email);

    if (directDebtorsError) {
      console.error("[VERIFY-DEBTOR-TOKEN] Error fetching debtors by email:", directDebtorsError);
      throw directDebtorsError;
    }

    (directDebtors || []).forEach((d) => {
      if (d?.id) debtorIdsSet.add(d.id);
    });
    console.log("[VERIFY-DEBTOR-TOKEN] direct debtors matches:", directDebtors?.length || 0);

    const debtorIds = [...debtorIdsSet];
    console.log("[VERIFY-DEBTOR-TOKEN] Total unique debtors found:", debtorIds.length);

    if (debtorIds.length === 0) {
      return new Response(
        JSON.stringify({ valid: true, email, paymentPlans: [], invoices: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active payment plans with installments (include dual approval fields)
    const { data: plans, error: plansError } = await supabase
      .from("payment_plans")
      .select(`
        id,
        plan_name,
        total_amount,
        number_of_installments,
        installment_amount,
        frequency,
        start_date,
        status,
        public_token,
        notes,
        proposed_at,
        created_at,
        debtor_id,
        user_id,
        requires_dual_approval,
        debtor_approved_at,
        debtor_approved_by_email,
        admin_approved_at,
        admin_approved_by
      `)
      .in("debtor_id", debtorIds)
      .in("status", ["proposed", "accepted", "active", "draft"])
      .order("created_at", { ascending: false });

    if (plansError) {
      console.error("[VERIFY-DEBTOR-TOKEN] Error fetching plans:", plansError);
      throw plansError;
    }

    // Fetch open invoices for all debtors (not on a payment plan)
    // Invoice "overdue" is derived from due_date (DPD), not a database status.
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        amount,
        amount_paid,
        due_date,
        status,
        description,
        debtor_id,
        user_id,
        is_on_payment_plan,
        created_at
      `)
      .in("debtor_id", debtorIds)
      .in("status", ["Open", "PartiallyPaid"])
      .eq("is_on_payment_plan", false)
      .order("due_date", { ascending: true });

    if (invoicesError) {
      console.error("[VERIFY-DEBTOR-TOKEN] Error fetching invoices:", invoicesError);
      throw invoicesError;
    }

    // Build a debtor metadata map (so we can render company_name/reference_id even if the
    // email match came from debtor_contacts or debtors.email rather than contacts).
    const debtorsById = new Map<
      string,
      { id: string; company_name: string | null; reference_id: string | null; user_id: string | null }
    >();

    (directDebtors || []).forEach((d) => {
      debtorsById.set(d.id, {
        id: d.id,
        company_name: d.company_name ?? null,
        reference_id: d.reference_id ?? null,
        user_id: (d as unknown as { user_id?: string | null }).user_id ?? null,
      });
    });

    (contacts || []).forEach((c) => {
      // Supabase nested relations sometimes come back as object or array; normalize.
      const rel = (c as unknown as { debtors?: unknown })?.debtors;
      const debtorObj = Array.isArray(rel) ? (rel[0] as any) : (rel as any);

      if (c?.debtor_id && debtorObj?.id) {
        debtorsById.set(c.debtor_id, {
          id: String(debtorObj.id),
          company_name: debtorObj.company_name ?? null,
          reference_id: debtorObj.reference_id ?? null,
          user_id: debtorObj.user_id ?? null,
        });
      }
    });

    // Enrich plans with debtor info and installments
    const enrichedPlans = await Promise.all((plans || []).map(async (plan) => {
      const debtorData = debtorsById.get(plan.debtor_id);
      
      // Get installments
      const { data: installments } = await supabase
        .from("payment_plan_installments")
        .select("*")
        .eq("payment_plan_id", plan.id)
        .order("installment_number");

      // Get branding
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("business_name, logo_url, primary_color, stripe_payment_link")
        .eq("user_id", plan.user_id)
        .single();

      return {
        ...plan,
        debtor: debtorData ? {
          company_name: debtorData.company_name,
          reference_id: debtorData.reference_id,
        } : null,
        installments: installments || [],
        branding: branding || null,
      };
    }));

    // Enrich invoices with debtor info and branding
    const enrichedInvoices = await Promise.all((invoices || []).map(async (invoice) => {
      const debtorData = debtorsById.get(invoice.debtor_id);

      // Get branding for the invoice owner
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("business_name, logo_url, primary_color, stripe_payment_link")
        .eq("user_id", invoice.user_id)
        .single();

      // Calculate days past due
      const dueDate = new Date(invoice.due_date);
      const today = new Date();
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...invoice,
        days_past_due: daysPastDue,
        balance_due: invoice.amount - (invoice.amount_paid || 0),
        debtor: debtorData ? {
          company_name: debtorData.company_name,
          reference_id: debtorData.reference_id,
        } : null,
        branding: branding || null,
      };
    }));

    console.log("[VERIFY-DEBTOR-TOKEN] Returning", enrichedPlans.length, "active plans and", enrichedInvoices.length, "open invoices");

    return new Response(
      JSON.stringify({ 
        valid: true, 
        email,
        paymentPlans: enrichedPlans,
        invoices: enrichedInvoices,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[VERIFY-DEBTOR-TOKEN] Error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Failed to verify token" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
