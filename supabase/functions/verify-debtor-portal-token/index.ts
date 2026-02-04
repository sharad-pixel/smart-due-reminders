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

    const email = tokenData.email;
    console.log("[VERIFY-DEBTOR-TOKEN] Token valid for email:", email);

    // Mark token as used (optional - could allow multiple uses within expiry)
    await supabase
      .from("debtor_portal_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    // Get active payment plans for this email's debtors
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

    const debtorIds = [...new Set(contacts?.map(c => c.debtor_id) || [])];

    if (debtorIds.length === 0) {
      return new Response(
        JSON.stringify({ valid: true, email, paymentPlans: [], invoices: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active payment plans with installments
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
        user_id
      `)
      .in("debtor_id", debtorIds)
      .in("status", ["proposed", "accepted", "active"])
      .order("created_at", { ascending: false });

    if (plansError) {
      console.error("[VERIFY-DEBTOR-TOKEN] Error fetching plans:", plansError);
      throw plansError;
    }

    // Fetch open invoices for all debtors (not on a payment plan)
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
      .in("status", ["open", "overdue", "partial"])
      .eq("is_on_payment_plan", false)
      .order("due_date", { ascending: true });

    if (invoicesError) {
      console.error("[VERIFY-DEBTOR-TOKEN] Error fetching invoices:", invoicesError);
      throw invoicesError;
    }

    // Enrich plans with debtor info and installments
    const enrichedPlans = await Promise.all((plans || []).map(async (plan) => {
      // Get debtor info - debtors is an object from the inner join
      const contact = contacts?.find(c => c.debtor_id === plan.debtor_id);
      const debtorData = contact?.debtors as { id: string; company_name: string; reference_id: string; user_id: string } | undefined;
      
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
      const contact = contacts?.find(c => c.debtor_id === invoice.debtor_id);
      const debtorData = contact?.debtors as { id: string; company_name: string; reference_id: string; user_id: string } | undefined;

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
