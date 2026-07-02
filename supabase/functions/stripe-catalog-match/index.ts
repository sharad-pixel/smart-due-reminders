import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function signature(item: any) {
  const name = (item.description || item.name || item.product_name || "").toLowerCase().trim();
  const amount = Number(item.amount) || 0;
  return `${name}::${amount.toFixed(2)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization")!;
    const { data: userData } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { contract_id, create_for_item_id } = await req.json();

    const { data: integ } = await supa
      .from("stripe_integrations")
      .select("stripe_secret_key_encrypted")
      .eq("user_id", user.id)
      .eq("is_connected", true)
      .maybeSingle();
    if (!integ?.stripe_secret_key_encrypted) throw new Error("Stripe not connected");

    const stripe = new Stripe(integ.stripe_secret_key_encrypted, { apiVersion: "2025-08-27.basil" });

    const { data: items } = await supa
      .from("contract_revenue_items")
      .select("*")
      .eq("import_id", contract_id);

    const stripeProducts = await stripe.products.list({ limit: 100, active: true });

    const results: any[] = [];
    for (const item of items ?? []) {
      if (create_for_item_id && item.id !== create_for_item_id) continue;

      const sig = signature(item);
      const { data: existingMap } = await supa
        .from("contract_stripe_product_map")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_signature", sig)
        .maybeSingle();

      if (existingMap?.stripe_product_id && !create_for_item_id) {
        await supa.from("contract_stripe_product_map").upsert({
          id: existingMap.id,
          contract_id,
          contract_revenue_item_id: item.id,
          user_id: user.id,
          product_signature: sig,
          stripe_product_id: existingMap.stripe_product_id,
          stripe_price_id: existingMap.stripe_price_id,
          mapping_status: "mapped",
        });
        continue;
      }

      const name = item.description || item.name || item.product_name || "Contract Item";
      let productId: string | null = null;
      let priceId: string | null = null;
      let status = "not_mapped";

      if (create_for_item_id) {
        const product = await stripe.products.create({ name });
        const price = await stripe.prices.create({
          product: product.id,
          currency: (item.currency || "usd").toLowerCase(),
          unit_amount: Math.round((Number(item.amount) || 0) * 100),
        });
        productId = product.id;
        priceId = price.id;
        status = "mapped";
      } else {
        const matches = stripeProducts.data.filter((p) => p.name.toLowerCase() === name.toLowerCase());
        if (matches.length === 1) {
          productId = matches[0].id;
          const prices = await stripe.prices.list({ product: productId, limit: 5 });
          priceId = prices.data[0]?.id ?? null;
          status = priceId ? "mapped" : "needs_review";
        } else if (matches.length > 1) {
          status = "multiple_matches";
        }
      }

      await supa.from("contract_stripe_product_map").upsert({
        contract_id,
        contract_revenue_item_id: item.id,
        user_id: user.id,
        product_signature: sig,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        mapping_status: status,
      }, { onConflict: "contract_revenue_item_id" as any });

      results.push({ item_id: item.id, status, productId, priceId });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
