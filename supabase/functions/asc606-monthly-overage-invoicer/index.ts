import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// $1.00 per credit post-paid
const POST_PAID_UNIT_CENTS = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const { data: wallets } = await admin
      .from("asc606_credit_wallets")
      .select("*")
      .gt("pending_overage_credits", 0);

    const results: any[] = [];
    for (const w of wallets ?? []) {
      try {
        // Need a Stripe customer — find via account owner profile
        let customerId = w.stripe_customer_id;
        if (!customerId) {
          const { data: owner } = await admin.from("account_users")
            .select("user_id").eq("account_id", w.account_id).eq("is_owner", true).maybeSingle();
          if (owner?.user_id) {
            const { data: profile } = await admin.from("profiles")
              .select("stripe_customer_id").eq("id", owner.user_id).maybeSingle();
            customerId = profile?.stripe_customer_id ?? null;
          }
        }
        if (!customerId) {
          results.push({ account_id: w.account_id, skipped: "no stripe customer" });
          continue;
        }

        const credits = Number(w.pending_overage_credits);
        const amountCents = Math.round(credits * POST_PAID_UNIT_CENTS);

        // Create draft invoice
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: "charge_automatically",
          auto_advance: true,
          description: `ASC 606 Assessment overage — ${credits} credits @ $1.00`,
          metadata: { kind: "asc606_overage", account_id: w.account_id, credits: String(credits) },
        });
        await stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id,
          unit_amount: POST_PAID_UNIT_CENTS,
          currency: "usd",
          quantity: credits,
          description: "ASC 606 assessment credit (post-paid)",
        });
        const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

        // Zero pending and ledger
        await admin.from("asc606_credit_wallets")
          .update({ pending_overage_credits: 0 })
          .eq("account_id", w.account_id);

        await admin.from("asc606_credit_ledger").insert({
          account_id: w.account_id,
          delta: 0,
          kind: "overage_invoice",
          stripe_invoice_id: finalized.id,
          unit_price_cents: POST_PAID_UNIT_CENTS,
          note: `Invoiced ${credits} overage credits ($${(amountCents / 100).toFixed(2)})`,
        });

        results.push({ account_id: w.account_id, invoice_id: finalized.id, credits, amount_cents: amountCents });
      } catch (e) {
        console.error("[asc606-overage]", w.account_id, e);
        results.push({ account_id: w.account_id, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[asc606-monthly-overage-invoicer]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
