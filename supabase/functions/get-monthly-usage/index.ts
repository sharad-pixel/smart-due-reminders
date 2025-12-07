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

    // Fallback to hardcoded plan limits if no database plan found
    if (!plan) {
      const planTypeLimits: Record<string, number> = {
        'free': 15,
        'starter': 100,
        'growth': 300,
        'professional': 500,
        'pro': 500, // alias for professional
        'enterprise': 10000 // effectively unlimited
      };
      
      const planType = profile?.plan_type || 'free';
      plan = {
        name: planType,
        invoice_limit: planTypeLimits[planType] ?? 15,
        overage_amount: 1.50
      };
      
      logStep("Using fallback plan limits", { planName: plan.name, limit: plan.invoice_limit });
    } else {
      logStep("Plan loaded from database", { planName: plan.name, limit: plan.invoice_limit });
    }

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

    // Count actual Open and InPaymentPlan invoices created this month
    const monthStart = `${currentMonth}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().split('T')[0];

    const { data: countableInvoices, error: countError } = await supabaseClient
      .from('invoices')
      .select('id, is_overage')
      .eq('user_id', user.id)
      .in('status', ['Open', 'InPaymentPlan'])
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd);

    if (countError) {
      throw new Error(`Error counting invoices: ${countError.message}`);
    }

    const actualInvoicesUsed = countableInvoices?.length || 0;
    const overageInvoices = countableInvoices?.filter(inv => inv.is_overage).length || 0;
    const includedInvoicesUsed = actualInvoicesUsed - overageInvoices;

    const includedAllowance = plan.invoice_limit || 0;
    const remaining = Math.max(0, includedAllowance - includedInvoicesUsed);
    const isOverLimit = actualInvoicesUsed > includedAllowance;

    logStep("Actual invoice count", {
      total: actualInvoicesUsed,
      included: includedInvoicesUsed,
      overage: overageInvoices
    });

    return new Response(JSON.stringify({
      month: currentMonth,
      included_allowance: includedAllowance,
      included_invoices_used: includedInvoicesUsed,
      overage_invoices: overageInvoices,
      overage_charges_total: usage.overage_charges_total,
      total_invoices_used: actualInvoicesUsed,
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