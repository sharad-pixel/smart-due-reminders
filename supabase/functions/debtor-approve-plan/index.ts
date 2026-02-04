import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ApproveRequest {
  planId: string;
  email: string;
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
    const { planId, email, token } = await req.json() as ApproveRequest;

    if (!planId || !email || !token) {
      return new Response(
        JSON.stringify({ success: false, error: "Plan ID, email, and token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[DEBTOR-APPROVE-PLAN] Processing approval for plan:", planId, "by:", email);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the token first
    const { data: tokenData, error: tokenError } = await supabase
      .from("debtor_portal_tokens")
      .select("*")
      .eq("token", token.trim())
      .single();

    if (tokenError || !tokenData) {
      console.log("[DEBTOR-APPROVE-PLAN] Invalid token");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log("[DEBTOR-APPROVE-PLAN] Token expired");
      return new Response(
        JSON.stringify({ success: false, error: "Token has expired. Please request a new link." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify email matches token
    const tokenEmail = (tokenData.email || "").toLowerCase().trim();
    const requestEmail = email.toLowerCase().trim();
    if (tokenEmail !== requestEmail) {
      console.log("[DEBTOR-APPROVE-PLAN] Email mismatch");
      return new Response(
        JSON.stringify({ success: false, error: "Email does not match token" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the payment plan
    const { data: plan, error: planError } = await supabase
      .from("payment_plans")
      .select("id, status, debtor_id, requires_dual_approval, debtor_approved_at, admin_approved_at")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.log("[DEBTOR-APPROVE-PLAN] Plan not found:", planError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Payment plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the debtor's email is linked to this plan's debtor
    const debtorIds = new Set<string>();

    // Check contacts
    const { data: contacts } = await supabase
      .from("contacts")
      .select("debtor_id")
      .ilike("email", requestEmail);
    (contacts || []).forEach(c => c?.debtor_id && debtorIds.add(c.debtor_id));

    // Check debtor_contacts
    const { data: debtorContacts } = await supabase
      .from("debtor_contacts")
      .select("debtor_id")
      .ilike("email", requestEmail);
    (debtorContacts || []).forEach(c => c?.debtor_id && debtorIds.add(c.debtor_id));

    // Check debtors directly
    const { data: directDebtors } = await supabase
      .from("debtors")
      .select("id")
      .ilike("email", requestEmail);
    (directDebtors || []).forEach(d => d?.id && debtorIds.add(d.id));

    if (!debtorIds.has(plan.debtor_id)) {
      console.log("[DEBTOR-APPROVE-PLAN] Debtor not authorized for this plan");
      return new Response(
        JSON.stringify({ success: false, error: "You are not authorized to approve this payment plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already approved by debtor
    if (plan.debtor_approved_at) {
      console.log("[DEBTOR-APPROVE-PLAN] Already approved by debtor");
      return new Response(
        JSON.stringify({ success: true, message: "Payment plan was already approved", alreadyApproved: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check plan status
    if (plan.status !== "proposed" && plan.status !== "draft") {
      console.log("[DEBTOR-APPROVE-PLAN] Invalid plan status for approval:", plan.status);
      return new Response(
        JSON.stringify({ success: false, error: `Cannot approve plan with status: ${plan.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the plan with debtor approval
    const updateData: Record<string, unknown> = {
      debtor_approved_at: new Date().toISOString(),
      debtor_approved_by_email: requestEmail,
    };

    // If admin already approved and this completes dual approval, set to accepted
    if (plan.requires_dual_approval && plan.admin_approved_at) {
      updateData.status = "accepted";
      console.log("[DEBTOR-APPROVE-PLAN] Both approvals complete, setting status to accepted");
    } else if (!plan.requires_dual_approval) {
      // If no dual approval required, set to accepted immediately
      updateData.status = "accepted";
      console.log("[DEBTOR-APPROVE-PLAN] No dual approval required, setting status to accepted");
    }

    const { error: updateError } = await supabase
      .from("payment_plans")
      .update(updateData)
      .eq("id", planId);

    if (updateError) {
      console.error("[DEBTOR-APPROVE-PLAN] Update error:", updateError);
      throw updateError;
    }

    console.log("[DEBTOR-APPROVE-PLAN] Successfully approved plan:", planId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: plan.requires_dual_approval && !plan.admin_approved_at 
          ? "Plan approved! Waiting for admin approval to activate." 
          : "Plan approved and activated!",
        activated: !!updateData.status
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DEBTOR-APPROVE-PLAN] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to approve payment plan" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
