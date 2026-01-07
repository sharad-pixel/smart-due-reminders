import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2025-08-27.basil";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-UPCOMING-CHARGES] ${step}${detailsStr}`);
};

type StripeList<T> = { data: T[] };

type StripeError = {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
};

function buildQuery(params?: Record<string, string | number | boolean | null | undefined>) {
  const qp = new URLSearchParams();
  if (!params) return qp;
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    qp.set(k, String(v));
  }
  return qp;
}

async function stripeGetJson<T>(stripeKey: string, path: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
  const qs = buildQuery(params);
  const url = qs.toString() ? `${STRIPE_API_BASE}${path}?${qs.toString()}` : `${STRIPE_API_BASE}${path}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
    },
  });

  if (!res.ok) {
    let body: StripeError | null = null;
    try {
      body = (await res.json()) as StripeError;
    } catch {
      // ignore
    }

    const err = new Error(body?.error?.message || `Stripe API error (${res.status})`);
    (err as any).status = res.status;
    (err as any).code = body?.error?.code;
    (err as any).type = body?.error?.type;
    throw err;
  }

  return (await res.json()) as T;
}

async function stripeTryGetJson<T>(stripeKey: string, path: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<T | null> {
  try {
    return await stripeGetJson<T>(stripeKey, path, params);
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

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
    const { data: effectiveAccountId } = await supabaseClient.rpc("get_effective_account_id", {
      p_user_id: user.id,
    });

    const accountId = effectiveAccountId || user.id;
    const isTeamMember = accountId !== user.id;

    logStep("Effective account determined", { accountId, isTeamMember });

    // Get account owner's profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("email, stripe_customer_id, stripe_subscription_id, plan_type, current_period_end, billing_interval")
      .eq("id", accountId)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    if (!stripeKey) {
      logStep("STRIPE_SECRET_KEY missing; falling back to profile");
      const subscriptionFromProfile = profile.current_period_end
        ? {
            current_period_start: null,
            current_period_end: profile.current_period_end || null,
            billing_interval: profile.billing_interval || "month",
            cancel_at_period_end: false,
            status: profile.plan_type === "free" ? "inactive" : "active",
          }
        : null;

      return new Response(
        JSON.stringify({
          has_upcoming_invoice: false,
          subscription: subscriptionFromProfile,
          message: "Billing is not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Find Stripe customer
    let customerId: string | null = profile.stripe_customer_id || null;

    if (!customerId && profile.email) {
      const customers = await stripeGetJson<StripeList<{ id: string }>>(stripeKey, "/customers", {
        email: profile.email,
        limit: 1,
      });

      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    if (!customerId) {
      logStep("No Stripe customer found");

      let subscriptionFromProfile: any = null;
      if (profile.stripe_subscription_id || profile.current_period_end) {
        subscriptionFromProfile = {
          current_period_start: null,
          current_period_end: profile.current_period_end || null,
          billing_interval: profile.billing_interval || "month",
          cancel_at_period_end: false,
          status: profile.plan_type === "free" ? "inactive" : "active",
        };
      }

      return new Response(
        JSON.stringify({
          has_upcoming_invoice: false,
          subscription: subscriptionFromProfile,
          message: "No billing account found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    logStep("Stripe customer found", { customerId });

    // Verify customer exists
    const customer = await stripeTryGetJson<any>(stripeKey, `/customers/${customerId}`);
    if (!customer) {
      logStep("Stripe customer not found in Stripe, clearing reference");

      let subscriptionFromProfile: any = null;
      if (profile.stripe_subscription_id || profile.current_period_end) {
        subscriptionFromProfile = {
          current_period_start: null,
          current_period_end: profile.current_period_end || null,
          billing_interval: profile.billing_interval || "month",
          cancel_at_period_end: false,
          status: "inactive",
        };
      }

      return new Response(
        JSON.stringify({
          has_upcoming_invoice: false,
          subscription: subscriptionFromProfile,
          message: "Billing account needs to be re-established",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get subscription details for term dates (best-effort)
    let subscriptionDetails: any = null;
    if (profile.stripe_subscription_id) {
      try {
        const subscription = await stripeGetJson<any>(stripeKey, `/subscriptions/${profile.stripe_subscription_id}`);
        subscriptionDetails = {
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          billing_cycle_anchor: subscription.billing_cycle_anchor
            ? new Date(subscription.billing_cycle_anchor * 1000).toISOString()
            : null,
          cancel_at_period_end: !!subscription.cancel_at_period_end,
          status: subscription.status,
          billing_interval:
            subscription.items?.data?.[0]?.price?.recurring?.interval || profile.billing_interval || "month",
        };
        logStep("Subscription details retrieved", subscriptionDetails);
      } catch (subErr) {
        logStep("Error fetching subscription details", { error: subErr });
      }
    }

    if (!subscriptionDetails && profile.current_period_end) {
      subscriptionDetails = {
        current_period_start: null,
        current_period_end: profile.current_period_end,
        billing_interval: profile.billing_interval || "month",
        cancel_at_period_end: false,
        status: profile.plan_type === "free" ? "inactive" : "active",
      };
    }

    // Get upcoming invoice
    let upcomingInvoice: any = null;

    try {
      const drafts = await stripeGetJson<StripeList<any>>(stripeKey, "/invoices", {
        customer: customerId,
        status: "draft",
        limit: 1,
      });

      if (drafts.data.length > 0) {
        upcomingInvoice = drafts.data[0];
        // Ensure lines are present (fetch full line list)
        try {
          const lines = await stripeGetJson<StripeList<any>>(stripeKey, `/invoices/${upcomingInvoice.id}/lines`, {
            limit: 100,
          });
          upcomingInvoice.lines = lines;
        } catch (lineErr) {
          logStep("Error fetching invoice lines", { error: lineErr });
        }
      } else {
        const subscriptions = await stripeGetJson<StripeList<any>>(stripeKey, "/subscriptions", {
          customer: customerId,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0];
          const items = sub.items?.data || [];
          const totalAmount = items.reduce(
            (sum: number, item: any) => sum + (item?.price?.unit_amount || 0) * (item?.quantity || 1),
            0
          );

          upcomingInvoice = {
            amount_due: totalAmount,
            subtotal: totalAmount,
            tax: 0,
            total: totalAmount,
            currency: sub.currency,
            period_start: sub.current_period_start,
            period_end: sub.current_period_end,
            next_payment_attempt: sub.current_period_end,
            lines: {
              data: items.map((item: any) => ({
                description: item?.price?.nickname || item?.price?.product || "Subscription",
                amount: (item?.price?.unit_amount || 0) * (item?.quantity || 1),
                quantity: item?.quantity || 1,
                price: item?.price,
                period: { start: sub.current_period_start, end: sub.current_period_end },
                proration: false,
              })),
            },
          };
        } else {
          throw new Error("No upcoming invoices");
        }
      }
    } catch (err: any) {
      const noUpcoming = err?.code === "invoice_upcoming_none" || String(err?.message || "").includes("No upcoming invoices");

      if (noUpcoming) {
        logStep("No upcoming invoice; checking for open invoices", { customerId });

        const openInvoices = await stripeGetJson<StripeList<any>>(stripeKey, "/invoices", {
          customer: customerId,
          status: "open",
          limit: 1,
        });

        const draftInvoices = openInvoices.data.length === 0
          ? await stripeGetJson<StripeList<any>>(stripeKey, "/invoices", { customer: customerId, status: "draft", limit: 1 })
          : { data: [] as any[] };

        const invoiceOnAccount = openInvoices.data[0] || draftInvoices.data[0] || null;

        if (invoiceOnAccount) {
          return new Response(
            JSON.stringify({
              has_upcoming_invoice: false,
              has_open_invoice: true,
              subscription: subscriptionDetails,
              open_invoice: {
                id: invoiceOnAccount.id,
                status: invoiceOnAccount.status,
                amount_due: (invoiceOnAccount.amount_due || invoiceOnAccount.total || 0) / 100,
                currency: (invoiceOnAccount.currency || "USD").toUpperCase(),
                hosted_invoice_url: invoiceOnAccount.hosted_invoice_url || null,
                invoice_pdf: invoiceOnAccount.invoice_pdf || null,
                due_date: invoiceOnAccount.due_date ? new Date(invoiceOnAccount.due_date * 1000).toISOString() : null,
                created_at: invoiceOnAccount.created ? new Date(invoiceOnAccount.created * 1000).toISOString() : null,
              },
              message: "Invoice on account",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }

        return new Response(
          JSON.stringify({
            has_upcoming_invoice: false,
            has_open_invoice: false,
            subscription: subscriptionDetails,
            message: "No upcoming invoice",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      throw err;
    }

    logStep("Retrieved upcoming invoice", {
      amountDue: upcomingInvoice.amount_due,
      lineItemsCount: upcomingInvoice?.lines?.data?.length,
    });

    // Parse line items
    const lineItems = (upcomingInvoice?.lines?.data || []).map((item: any) => ({
      description: item.description || item?.price?.nickname || "Subscription",
      amount: (item.amount || 0) / 100,
      quantity: item.quantity || 1,
      price_id: item?.price?.id,
      period_start: item?.period?.start ? new Date(item.period.start * 1000).toISOString() : null,
      period_end: item?.period?.end ? new Date(item.period.end * 1000).toISOString() : null,
      is_proration: !!item.proration,
      type: item?.price?.recurring ? "recurring" : "one_time",
    }));

    const baseSubscription = lineItems.filter(
      (item: any) =>
        !item.description?.toLowerCase().includes("seat") &&
        !item.description?.toLowerCase().includes("overage") &&
        !item.description?.toLowerCase().includes("invoice") &&
        item.type === "recurring"
    );

    const seatCharges = lineItems.filter(
      (item: any) => item.description?.toLowerCase().includes("seat") || item.description?.toLowerCase().includes("user")
    );

    const overageCharges = lineItems.filter(
      (item: any) => item.description?.toLowerCase().includes("overage") || item.description?.toLowerCase().includes("invoice")
    );

    const prorations = lineItems.filter((item: any) => item.is_proration);

    // Get current period usage
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const { data: usageData } = await supabaseClient
      .from("invoice_usage")
      .select("*")
      .eq("user_id", accountId)
      .eq("month", currentMonth)
      .single();

    // Count active team members for seat consumption
    const { count: seatCount } = await supabaseClient
      .from("account_users")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "active")
      .eq("is_owner", false);

    // Fetch recent Stripe invoices
    let recentInvoices: any[] = [];
    try {
      const invoicesResponse = await stripeGetJson<StripeList<any>>(stripeKey, "/invoices", {
        customer: customerId,
        limit: 10,
      });

      recentInvoices = invoicesResponse.data.map((inv: any) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amount_due: (inv.amount_due || 0) / 100,
        amount_paid: (inv.amount_paid || 0) / 100,
        amount_remaining: (inv.amount_remaining || 0) / 100,
        total: (inv.total || 0) / 100,
        currency: (inv.currency || "USD").toUpperCase(),
        created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
        due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
        paid_at: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
        period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
        period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
        description: inv.description || `Invoice ${inv.number || inv.id.slice(-8)}`,
      }));

      logStep("Recent invoices retrieved", { count: recentInvoices.length });
    } catch (invErr) {
      logStep("Error fetching recent invoices", { error: invErr });
    }

    const response = {
      has_upcoming_invoice: true,
      upcoming_invoice: {
        id: upcomingInvoice.id || null,
        number: upcomingInvoice.number || null,
        status: upcomingInvoice.status || "upcoming",
        hosted_invoice_url: upcomingInvoice.hosted_invoice_url || null,
        invoice_pdf: upcomingInvoice.invoice_pdf || null,
        created_at: upcomingInvoice.created ? new Date(upcomingInvoice.created * 1000).toISOString() : null,
        amount_due: (upcomingInvoice.amount_due || 0) / 100,
        subtotal: (upcomingInvoice.subtotal || 0) / 100,
        tax: ((upcomingInvoice.tax || 0) as number) / 100,
        total: (upcomingInvoice.total || 0) / 100,
        currency: (upcomingInvoice.currency || "USD").toUpperCase(),
        period_start: upcomingInvoice.period_start ? new Date(upcomingInvoice.period_start * 1000).toISOString() : null,
        period_end: upcomingInvoice.period_end ? new Date(upcomingInvoice.period_end * 1000).toISOString() : null,
        next_payment_attempt: upcomingInvoice.next_payment_attempt
          ? new Date(upcomingInvoice.next_payment_attempt * 1000).toISOString()
          : null,
      },
      subscription: subscriptionDetails,
      invoices: recentInvoices,
      breakdown: {
        base_subscription: {
          items: baseSubscription,
          total: baseSubscription.reduce((sum: number, item: any) => sum + item.amount, 0),
        },
        seat_charges: {
          items: seatCharges,
          total: seatCharges.reduce((sum: number, item: any) => sum + item.amount, 0),
          seat_count: seatCount || 0,
        },
        overage_charges: {
          items: overageCharges,
          total: overageCharges.reduce((sum: number, item: any) => sum + item.amount, 0),
          invoice_overages: usageData?.overage_invoices || 0,
        },
        prorations: {
          items: prorations,
          total: prorations.reduce((sum: number, item: any) => sum + item.amount, 0),
        },
      },
      consumption: {
        invoices: {
          used: usageData?.included_invoices_used || 0,
          overage: usageData?.overage_invoices || 0,
          overage_charges: usageData?.overage_charges_total || 0,
        },
        seats: {
          billable: seatCount || 0,
        },
        period: currentMonth,
      },
      is_team_member: isTeamMember,
    };

    logStep("Response prepared", {
      amountDue: response.upcoming_invoice.amount_due,
      hasOverages: response.breakdown.overage_charges.total > 0,
    });

    return new Response(JSON.stringify(response), {
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
