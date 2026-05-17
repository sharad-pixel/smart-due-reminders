import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fallback verification for ASC 606 / Platform Credit checkout sessions.
 * Called from the success URL — applies the same ledger + wallet updates
 * the Stripe webhook would apply, idempotently keyed on session id /
 * payment intent. Protects users when the webhook never fires or fails.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ status: "unpaid", payment_status: session.payment_status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kind = session.metadata?.kind;
    const accountId = session.metadata?.account_id;
    const credits = Number(session.metadata?.credits ?? 0);
    const userId = session.metadata?.user_id ?? null;
    const pi = (session.payment_intent as string | null) ?? null;

    if (!accountId || credits <= 0 || !kind) {
      return new Response(JSON.stringify({ error: "Session metadata incomplete" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: bail if this session already produced a ledger row
    const { data: existing } = await admin
      .from("asc606_credit_ledger")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ status: "already_applied" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind === "asc606_credits") {
      const { error: ledErr } = await admin.from("asc606_credit_ledger").insert({
        account_id: accountId,
        delta: credits,
        kind: "purchase",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: pi,
        unit_price_cents: 80,
        note: `Pre-paid pack: ${credits} credits`,
        created_by: userId,
        service: "asc606",
      });
      if (ledErr && ledErr.code !== "23505") throw ledErr;

      await admin.from("asc606_credit_wallets").upsert(
        { account_id: accountId, stripe_customer_id: (session.customer as string) ?? null },
        { onConflict: "account_id", ignoreDuplicates: true },
      );
      const { data: w } = await admin.from("asc606_credit_wallets")
        .select("*").eq("account_id", accountId).single();
      if (w) {
        await admin.from("asc606_credit_wallets").update({
          balance_credits: Number(w.balance_credits) + credits,
          lifetime_purchased: Number(w.lifetime_purchased) + credits,
          stripe_customer_id: w.stripe_customer_id ?? ((session.customer as string) ?? null),
        }).eq("account_id", accountId);
      }
      return new Response(JSON.stringify({ status: "credits_applied", credits }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind === "asc606_overage_payment") {
      const { error: ledErr } = await admin.from("asc606_credit_ledger").insert({
        account_id: accountId,
        delta: 0,
        kind: "overage_payment",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: pi,
        unit_price_cents: 100,
        note: `Overage settled: ${credits} credits ($${credits.toFixed(2)})`,
        created_by: userId,
        service: "asc606",
      });
      if (ledErr && ledErr.code !== "23505") throw ledErr;

      const { data: w } = await admin.from("asc606_credit_wallets")
        .select("pending_overage_credits").eq("account_id", accountId).maybeSingle();
      if (w) {
        const remaining = Math.max(0, Number(w.pending_overage_credits) - credits);
        await admin.from("asc606_credit_wallets").update({
          pending_overage_credits: remaining,
        }).eq("account_id", accountId);
      }
      return new Response(JSON.stringify({ status: "overage_settled", credits }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "ignored", kind }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[verify-asc606-purchase]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
