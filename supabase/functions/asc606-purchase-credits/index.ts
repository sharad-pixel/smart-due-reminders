import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRE_PAID_UNIT_CENTS = 80; // $0.80 / credit (20% off post-paid $1.00)
const ALLOWED_PACKS = [25, 100, 250];
const MIN_CUSTOM = 10;
const MAX_CUSTOM = 10000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { credits, accountId, successUrl, cancelUrl } = await req.json();
    const c = Math.floor(Number(credits));
    if (!Number.isFinite(c) || c < MIN_CUSTOM || c > MAX_CUSTOM) {
      return new Response(JSON.stringify({ error: "Invalid credit amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user?.email) throw new Error("Not authenticated");

    const { data: isAdmin } = await admin.rpc("is_asc606_admin", { _user_id: user.id, _account_id: accountId });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Owner or Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: PRE_PAID_UNIT_CENTS,
          product_data: {
            name: "ASC 606 Assessment Credit",
            description: "Pre-paid credit (20% off). 10 credits = 1 contract assessment.",
          },
        },
        quantity: c,
      }],
      mode: "payment",
      success_url: successUrl || `${req.headers.get("origin")}/billing/asc606-credits?purchase=success`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/billing/asc606-credits?purchase=cancelled`,
      metadata: {
        kind: "asc606_credits",
        account_id: accountId,
        user_id: user.id,
        credits: String(c),
        is_pack: ALLOWED_PACKS.includes(c) ? "true" : "false",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[asc606-purchase-credits]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
