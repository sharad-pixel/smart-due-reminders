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
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization")!;
    const { data: userData } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { contract_id } = await req.json();

    const { data: integ } = await supa
      .from("stripe_integrations")
      .select("stripe_secret_key_encrypted")
      .eq("user_id", user.id)
      .eq("is_connected", true)
      .maybeSingle();
    if (!integ?.stripe_secret_key_encrypted) throw new Error("Stripe not connected");

    const stripe = new Stripe(integ.stripe_secret_key_encrypted, { apiVersion: "2025-08-27.basil" });

    const [{ data: contract }, { data: fields }, { data: mappings }, { data: syncRow }] = await Promise.all([
      supa.from("contracts").select("*").eq("id", contract_id).maybeSingle(),
      supa.from("contract_extracted_fields").select("*").eq("import_id", contract_id).limit(1).maybeSingle(),
      supa.from("contract_stripe_product_map").select("*").eq("contract_id", contract_id),
      supa.from("contract_stripe_sync").select("*").eq("contract_id", contract_id).maybeSingle(),
    ]);

    if (!contract) throw new Error("Contract not found");

    // 1. Customer
    const email = (fields as any)?.customer_email || (contract as any)?.debtor_email;
    const name = (fields as any)?.customer_name || (contract as any)?.debtor_name || (contract as any)?.contract_name;
    let stripeCustomerId = syncRow?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      let existing: any = null;
      if (email) {
        const list = await stripe.customers.list({ email, limit: 1 });
        existing = list.data[0];
      }
      const customer = existing ?? await stripe.customers.create({ name, email: email ?? undefined, metadata: { contract_id } });
      stripeCustomerId = customer.id;
    }

    // 2. Ensure prices exist for all mapped items, then create draft invoice items
    const priceIds = (mappings ?? []).filter((m: any) => m.stripe_price_id).map((m: any) => m.stripe_price_id);
    if (priceIds.length === 0) throw new Error("No mapped Stripe prices. Run product mapping first.");

    // 3. Create a subscription (draft) if recurring, else draft invoice
    const billingFreq = ((fields as any)?.billing_frequency || "").toLowerCase();
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
      // one-time draft invoice
      for (const pid of priceIds) {
        await stripe.invoiceItems.create({ customer: stripeCustomerId, price: pid, metadata: { contract_id } });
      }
      await stripe.invoices.create({ customer: stripeCustomerId, collection_method: "send_invoice", days_until_due: 30, metadata: { contract_id } });
    }

    await supa.from("contract_stripe_sync").update({
      status: "synchronized",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscriptionId,
      last_sync_at: new Date().toISOString(),
      last_error: null,
    }).eq("contract_id", contract_id);

    await supa.from("contract_stripe_sync_events").insert({
      user_id: user.id,
      contract_id,
      action: "sync",
      payload: { stripeCustomerId, subscriptionId },
    });

    return new Response(JSON.stringify({ ok: true, stripeCustomerId, subscriptionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
