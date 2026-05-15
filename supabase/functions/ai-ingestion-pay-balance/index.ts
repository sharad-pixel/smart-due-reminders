import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user?.email) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull all unbilled events the user can see (RLS-style filter via user_id OR shared account)
    const { data: events, error: evErr } = await admin
      .from("ocr_usage_events")
      .select("id, account_id, user_id, page_count, total_cents")
      .eq("stripe_reported", false)
      .or(`user_id.eq.${user.id}`);
    if (evErr) throw evErr;

    if (!events || events.length === 0) {
      return json({ status: "noop", amount: 0, message: "No outstanding balance" });
    }

    const totalCents = events.reduce((s, e) => s + (e.total_cents || 0), 0);
    const totalPages = events.reduce((s, e) => s + (e.page_count || 0), 0);
    const accountId = events.find((e) => e.account_id)?.account_id ?? null;

    if (totalCents <= 0) return json({ status: "noop", amount: 0 });

    // Stripe minimum charge is $0.50 — surface a clear message instead of failing
    if (totalCents < 50) {
      return json({ error: `Minimum chargeable balance is $0.50 (current balance ${(totalCents / 100).toFixed(2)})` }, 400);
    }

    // Look up Stripe customer for this user (via user_subscriptions table)
    const { data: sub } = await admin
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let customerId = sub?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) customerId = existing.data[0].id;
      else {
        const created = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
        customerId = created.id;
      }
      await admin.from("user_subscriptions").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
    }

    // Create payment record (pending)
    const { data: paymentRow, error: payErr } = await admin
      .from("ocr_invoice_payments")
      .insert({
        account_id: accountId,
        user_id: user.id,
        amount: (totalCents / 100).toFixed(2),
        page_count: totalPages,
        event_count: events.length,
        status: "pending",
      })
      .select("id")
      .single();
    if (payErr) throw payErr;
    const paymentId = paymentRow.id;

    // Tag events with this payment up-front so concurrent scans can't sneak in
    await admin
      .from("ocr_usage_events")
      .update({ payment_id: paymentId })
      .in("id", events.map((e) => e.id));

    // Check whether the customer has a default payment method
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const hasPM = !!(customer.invoice_settings?.default_payment_method
      || (customer as any).default_source);

    if (!hasPM) {
      // Fall back to a one-off Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: `AI Smart Ingestion — ${totalPages} pages` },
            unit_amount: totalCents,
          },
          quantity: 1,
        }],
        success_url: `${req.headers.get("origin") || "https://recouply.ai"}/ai-ingestion?paid=1`,
        cancel_url: `${req.headers.get("origin") || "https://recouply.ai"}/ai-ingestion?canceled=1`,
        metadata: { ocr_payment_id: paymentId },
      });
      await admin.from("ocr_invoice_payments")
        .update({ status: "requires_action", hosted_invoice_url: session.url })
        .eq("id", paymentId);
      return json({ status: "requires_action", checkout_url: session.url, hosted_invoice_url: session.url, amount: totalCents / 100 });
    }

    // Add invoice item, finalize, and pay immediately
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: totalCents,
      currency: "usd",
      description: `AI Smart Ingestion — ${totalPages} pages across ${events.length} scan${events.length === 1 ? "" : "s"}`,
    });
    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: false,
      collection_method: "charge_automatically",
      metadata: { ocr_payment_id: paymentId, kind: "ai_smart_ingestion" },
    });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    let paid: Stripe.Invoice;
    try {
      paid = await stripe.invoices.pay(finalized.id);
    } catch (payError: any) {
      await admin.from("ocr_invoice_payments")
        .update({ status: "failed", error: payError.message, stripe_invoice_id: finalized.id, hosted_invoice_url: finalized.hosted_invoice_url })
        .eq("id", paymentId);
      // Release events so the user can retry
      await admin.from("ocr_usage_events").update({ payment_id: null }).eq("payment_id", paymentId);
      return json({ error: payError.message, hosted_invoice_url: finalized.hosted_invoice_url }, 402);
    }

    await admin.from("ocr_invoice_payments")
      .update({
        status: "paid",
        stripe_invoice_id: paid.id,
        stripe_payment_intent_id: typeof paid.payment_intent === "string" ? paid.payment_intent : paid.payment_intent?.id ?? null,
        hosted_invoice_url: paid.hosted_invoice_url,
        paid_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    await admin.from("ocr_usage_events")
      .update({ stripe_reported: true })
      .eq("payment_id", paymentId);

    return json({
      status: "paid",
      amount: totalCents / 100,
      hosted_invoice_url: paid.hosted_invoice_url,
      invoice_id: paid.id,
    });
  } catch (e: any) {
    console.error("ai-ingestion-pay-balance error", e);
    return json({ error: e.message || "Payment failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
