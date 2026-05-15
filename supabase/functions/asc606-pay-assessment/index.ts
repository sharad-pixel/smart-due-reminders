import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { contractId } = await req.json();
    if (!contractId) throw new Error("contractId required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user?.email) throw new Error("Not authenticated");

    const { data: contract, error: cErr } = await admin
      .from("contracts").select("id, account_id, title").eq("id", contractId).single();
    if (cErr || !contract) throw new Error("Contract not found");

    const { data: isAdmin } = await admin.rpc("is_asc606_admin", { _user_id: user.id, _account_id: contract.account_id });
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
          unit_amount: 999,
          product_data: {
            name: "ASC 606 Revenue Risk Assessment",
            description: `One-time assessment for contract: ${contract.title}`,
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/contracts?asc606_paid=${contractId}`,
      cancel_url: `${req.headers.get("origin")}/contracts?asc606_cancelled=${contractId}`,
      metadata: {
        kind: "asc606_assessment",
        account_id: contract.account_id,
        contract_id: contractId,
        user_id: user.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[asc606-pay-assessment]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
