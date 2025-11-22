import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-MONTHLY-USAGE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    logStep("Checking usage for month", { month: currentMonth });

    // Get user's profile and plan
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('plan_id, plan_type')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error("User profile not found");
    }

    let plan;
    
    // Try to get plan by plan_id first, fall back to plan_type
    if (profile?.plan_id) {
      const { data: planData, error: planError } = await supabaseClient
        .from('plans')
        .select('*')
        .eq('id', profile.plan_id)
        .single();
      
      if (!planError && planData) {
        plan = planData;
      }
    }
    
    // Fallback: look up by plan_type if plan_id didn't work
    if (!plan && profile?.plan_type) {
      const { data: planData, error: planError } = await supabaseClient
        .from('plans')
        .select('*')
        .eq('name', profile.plan_type)
        .single();
      
      if (!planError && planData) {
        plan = planData;
      }
    }

    if (!plan) {
      throw new Error("Plan details not found");
    }

    logStep("Plan loaded", { planName: plan.name, limit: plan.invoice_limit });

    // Get or create usage record for current month
    let { data: usage, error: usageError } = await supabaseClient
      .from('invoice_usage')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      throw new Error(`Error fetching usage: ${usageError.message}`);
    }

    if (!usage) {
      // Create usage record if it doesn't exist
      const { data: newUsage, error: createError } = await supabaseClient
        .from('invoice_usage')
        .insert({
          user_id: user.id,
          month: currentMonth,
          included_invoices_used: 0,
          overage_invoices: 0,
          overage_charges_total: 0
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Error creating usage record: ${createError.message}`);
      }
      usage = newUsage;
      logStep("Created new usage record");
    }

    const totalInvoicesUsed = usage.included_invoices_used + usage.overage_invoices;
    const includedAllowance = plan.invoice_limit || 0;
    const remaining = Math.max(0, includedAllowance - usage.included_invoices_used);
    const isOverLimit = totalInvoicesUsed > includedAllowance;

    logStep("Usage calculated", {
      totalUsed: totalInvoicesUsed,
      includedUsed: usage.included_invoices_used,
      overageCount: usage.overage_invoices,
      remaining
    });

    return new Response(JSON.stringify({
      month: currentMonth,
      included_allowance: includedAllowance,
      included_invoices_used: usage.included_invoices_used,
      overage_invoices: usage.overage_invoices,
      overage_charges_total: usage.overage_charges_total,
      total_invoices_used: totalInvoicesUsed,
      remaining_quota: remaining,
      is_over_limit: isOverLimit,
      plan_name: plan.name,
      overage_rate: plan.overage_amount || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});