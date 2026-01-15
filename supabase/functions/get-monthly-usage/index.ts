import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-MONTHLY-USAGE] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
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

    // Get effective account ID for team members
    const { data: effectiveAccountId, error: effectiveError } = await supabaseClient
      .rpc('get_effective_account_id', { p_user_id: user.id });
    
    if (effectiveError) {
      logStep("Error getting effective account, using user ID", { error: effectiveError.message });
    }
    
    const accountId = effectiveAccountId || user.id;
    const isTeamMember = accountId !== user.id;
    
    logStep("Effective account determined", { accountId, isTeamMember });

    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    logStep("Checking usage for month", { month: currentMonth });

    // Get account owner's profile and plan (use effective account ID)
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('plan_id, plan_type, subscription_status')
      .eq('id', accountId)
      .single();

    if (profileError) {
      throw new Error("Account profile not found");
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
    const OVERAGE_RATE = 1.99; // $1.99 per invoice overage
    
    if (!plan) {
      const planTypeLimits: Record<string, number> = {
        'free': 5, // Free tier now has 5 invoice limit (same as trial)
        'starter': 100,
        'growth': 300,
        'professional': 500,
        'pro': 500, // alias for professional
        'enterprise': 10000 // effectively unlimited
      };
      
      const planType = profile?.plan_type || 'free';
      plan = {
        name: planType,
        invoice_limit: planTypeLimits[planType] ?? 5,
        overage_amount: OVERAGE_RATE
      };
      
      logStep("Using fallback plan limits", { planName: plan.name, limit: plan.invoice_limit });
    } else {
      // Override overage amount to always use $1.99
      plan.overage_amount = OVERAGE_RATE;
      logStep("Plan loaded from database", { planName: plan.name, limit: plan.invoice_limit });
    }

    // Get or create usage record for current month (use effective account ID)
    let { data: usage, error: usageError } = await supabaseClient
      .from('invoice_usage')
      .select('*')
      .eq('user_id', accountId)
      .eq('month', currentMonth)
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      throw new Error(`Error fetching usage: ${usageError.message}`);
    }

    if (!usage) {
      // Create usage record if it doesn't exist (only for account owner)
      const { data: newUsage, error: createError } = await supabaseClient
        .from('invoice_usage')
        .insert({
          user_id: accountId,
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

    // IMPORTANT: If subscription is inactive and we have a populated usage record (e.g. subscription expired billing),
    // treat invoice_usage as the source of truth so the UI can show account-level overages.
    const subscriptionStatus = profile?.subscription_status || 'inactive';
    const isInactiveSubscription = !['active', 'trialing'].includes(subscriptionStatus);
    const planType = profile?.plan_type || 'free';
    const isFreeTier = planType === 'free';

    if (
      isInactiveSubscription &&
      isFreeTier &&
      ((usage.included_invoices_used ?? 0) > 0 || (usage.overage_invoices ?? 0) > 0)
    ) {
      // IMPORTANT: use the plan invoice_limit as the allowance; if missing, default to Free (5)
      const includedAllowance = plan.invoice_limit ?? 5;

      // invoice_usage may be populated by older logic that only increments included_invoices_used.
      // Derive a clean breakdown so UI shows e.g. 5/5 +10 overage (instead of 15/5).
      const rawIncluded = usage.included_invoices_used ?? 0;
      const rawOverage = usage.overage_invoices ?? 0;
      const totalInvoicesUsed = rawIncluded + rawOverage;

      const includedInvoicesUsed = Math.min(totalInvoicesUsed, includedAllowance);
      const overageInvoices = Math.max(0, totalInvoicesUsed - includedAllowance);
      const remaining = Math.max(0, includedAllowance - includedInvoicesUsed);
      const isOverLimit = totalInvoicesUsed > includedAllowance;

      logStep("Using invoice_usage record for account-level overages", {
        subscriptionStatus,
        includedInvoicesUsed,
        overageInvoices,
        overageChargesTotal: usage.overage_charges_total,
      });

      return new Response(JSON.stringify({
        month: currentMonth,
        included_allowance: includedAllowance,
        included_invoices_used: includedInvoicesUsed,
        overage_invoices: overageInvoices,
        overage_charges_total: usage.overage_charges_total,
        total_invoices_used: totalInvoicesUsed,
        remaining_quota: remaining,
        is_over_limit: isOverLimit,
        plan_name: plan.name,
        overage_rate: plan.overage_amount || 0,
        is_team_member: isTeamMember,
        billing_mode: 'account_overages'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Count actual Open and InPaymentPlan invoices created this month (use effective account ID)
    const monthStart = `${currentMonth}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().split('T')[0];

    const { data: countableInvoices, error: countError } = await supabaseClient
      .from('invoices')
      .select('id, is_overage')
      .eq('user_id', accountId)
      .in('status', ['Open', 'InPaymentPlan'])
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd);

    if (countError) {
      throw new Error(`Error counting invoices: ${countError.message}`);
    }

    const actualInvoicesUsed = countableInvoices?.length || 0;
    const overageInvoices = countableInvoices?.filter((inv: { is_overage?: boolean | null }) => !!inv.is_overage).length || 0;
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
      overage_rate: plan.overage_amount || 0,
      is_team_member: isTeamMember
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
