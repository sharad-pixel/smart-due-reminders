import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { resolveStripeContext } from "../_shared/stripeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { supa, accountId, stripeKey } = await resolveStripeContext(req.headers.get("Authorization"));
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let imported = 0;
    let updated = 0;
    let cursor: string | undefined;
    do {
      const page: any = await stripe.products.list({ limit: 100, active: true, starting_after: cursor });
      for (const product of page.data) {
        const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
        const defaultPrice = prices.data.find((p) => p.id === (product.default_price as string)) || prices.data[0];
        if (!defaultPrice) continue;
        const unitCost = (defaultPrice.unit_amount ?? 0) / 100;
        const currency = (defaultPrice.currency || "usd").toUpperCase();
        const unitType = defaultPrice.recurring?.interval || "each";
        const desc = product.name;

        const { data: existing } = await supa
          .from("product_catalog")
          .select("id")
          .eq("user_id", accountId)
          .eq("stripe_price_id", defaultPrice.id)
          .maybeSingle();

        if (existing) {
          await supa.from("product_catalog").update({
            description: desc,
            unit_cost: unitCost,
            currency,
            unit_type: unitType,
            stripe_product_id: product.id,
            source: "stripe",
            active: product.active,
            stripe_synced_at: new Date().toISOString(),
          }).eq("id", existing.id);
          updated++;
        } else {
          await supa.from("product_catalog").insert({
            user_id: accountId,
            description: desc,
            unit_cost: unitCost,
            currency,
            unit_type: unitType,
            stripe_product_id: product.id,
            stripe_price_id: defaultPrice.id,
            source: "stripe",
            active: product.active,
            stripe_synced_at: new Date().toISOString(),
          });
          imported++;
        }
      }
      cursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
    } while (cursor);

    return new Response(JSON.stringify({ imported, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
