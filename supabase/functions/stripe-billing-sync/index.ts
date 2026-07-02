import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { resolveStripeContext } from "../_shared/stripeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pickField(fields: any[], keys: string[]): string | null {
  for (const k of keys) {
    const row = fields.find((f) => (f.field_key || "").toLowerCase() === k.toLowerCase());
    const v = row?.field_value ?? row?.field_value_json;
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { supa, user, accountId, stripeKey } = await resolveStripeContext(req.headers.get("Authorization"));
    const { contract_id } = await req.json();
    if (!contract_id) throw new Error("contract_id required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const [{ data: contract }, { data: fields }, { data: mappings }, { data: syncRow }] = await Promise.all([
      supa.from("contracts").select("*").eq("id", contract_id).maybeSingle(),
      supa.from("live_contract_extracted_fields").select("field_key, field_value").eq("import_id", contract_id),
      supa.from("contract_stripe_product_map").select("*").eq("contract_id", contract_id),
      supa.from("contract_stripe_sync").select("*").eq("contract_id", contract_id).maybeSingle(),
    ]);

    if (!contract) throw new Error("Contract not found");
    const fieldRows = fields ?? [];

    const email = pickField(fieldRows, ["customer_email", "email"]) || (contract as any)?.debtor_email;
    const name = pickField(fieldRows, ["customer_name", "customer"]) || (contract as any)?.debtor_name || (contract as any)?.contract_name;

    let stripeCustomerId = syncRow?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      let existing: any = null;
      if (email) {
        const list = await stripe.customers.list({ email, limit: 1 });
        existing = list.data[0];
      }
      const customer = existing ?? await stripe.customers.create({
        name: name ?? undefined,
        email: email ?? undefined,
        metadata: { contract_id },
      });
      stripeCustomerId = customer.id;
    }

    const priceIds = (mappings ?? []).filter((m: any) => m.stripe_price_id).map((m: any) => m.stripe_price_id);
    if (priceIds.length === 0) throw new Error("No mapped Stripe prices. Run product mapping first.");

    const billingFreq = (pickField(fieldRows, ["billing_frequency", "billing_cadence"]) || "").toLowerCase();
    let subscriptionId: string | null = syncRow?.stripe_subscription_id ?? null;

    if (billingFreq && !subscriptionId) {
      const sub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: priceIds.map((p) => ({ price: p })),
        metadata: { contract_id },
        collection_method: "send_invoice",
        days_until_due: 30,
      });
      subscriptionId = sub.id;
    } else if (!billingFreq) {
      for (const pid of priceIds) {
        await stripe.invoiceItems.create({ customer: stripeCustomerId, price: pid, metadata: { contract_id } });
      }
      await stripe.invoices.create({
        customer: stripeCustomerId,
        collection_method: "send_invoice",
        days_until_due: 30,
        metadata: { contract_id },
      });
    }

    await supa.from("contract_stripe_sync").update({
      status: "synchronized",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscriptionId,
      last_sync_at: new Date().toISOString(),
      last_error: null,
    }).eq("contract_id", contract_id);

    await supa.from("contract_stripe_sync_events").insert({
      user_id: accountId,
      contract_id,
      action: "sync",
      payload: { stripeCustomerId, subscriptionId },
    });

    return new Response(JSON.stringify({ ok: true, stripeCustomerId, subscriptionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
