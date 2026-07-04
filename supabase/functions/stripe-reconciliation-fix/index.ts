import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { resolveStripeContext } from "../_shared/stripeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);
function fromMinor(minor: number | null | undefined, currency: string): number {
  const n = Number(minor ?? 0);
  if (ZERO_DECIMAL.has((currency || "usd").toLowerCase())) return n;
  return n / 100;
}
function mapStripeStatus(s: string | null | undefined): string {
  const v = (s || "").toLowerCase();
  if (["paid","open","draft","uncollectible","void"].includes(v)) return v;
  return v || "open";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { supa, accountId, stripeKey } = await resolveStripeContext(req.headers.get("Authorization"));
    const body = await req.json();
    const action: string = body.action;
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    if (action === "dismiss") {
      const { discrepancy_key, discrepancy_type, note } = body;
      if (!discrepancy_key) throw new Error("discrepancy_key required");
      const { data: userData } = await supa.auth.getUser(
        (req.headers.get("Authorization") || "").replace("Bearer ", ""),
      );
      const { error } = await supa.from("stripe_reconciliation_dismissals").upsert({
        account_id: accountId,
        user_id: userData.user?.id ?? accountId,
        discrepancy_key,
        discrepancy_type: discrepancy_type || "unknown",
        note: note ?? null,
      }, { onConflict: "account_id,discrepancy_key" });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "undismiss") {
      const { discrepancy_key } = body;
      await supa.from("stripe_reconciliation_dismissals")
        .delete()
        .eq("account_id", accountId)
        .eq("discrepancy_key", discrepancy_key);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pull") {
      const { stripe_invoice_id, invoice_id } = body;
      if (!stripe_invoice_id) throw new Error("stripe_invoice_id required");
      const si = await stripe.invoices.retrieve(stripe_invoice_id);
      const currency = (si.currency || "usd").toLowerCase();
      const patch: any = {
        status: mapStripeStatus(si.status),
        total_amount: fromMinor(si.total, currency),
        amount_outstanding: fromMinor(si.amount_due, currency),
        currency,
        stripe_invoice_id: si.id,
        stripe_hosted_url: si.hosted_invoice_url ?? null,
        stripe_customer_id: typeof si.customer === "string" ? si.customer : si.customer?.id ?? null,
        due_date: si.due_date ? new Date(si.due_date * 1000).toISOString().slice(0, 10) : null,
      };
      if (invoice_id) {
        const { error } = await supa.from("invoices").update(patch).eq("id", invoice_id);
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true, updated: invoice_id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Orphan pull: find debtor by stripe_customer_id
      const stripeCust = patch.stripe_customer_id;
      if (!stripeCust) throw new Error("No customer on Stripe invoice");
      const { data: debtor } = await supa.from("debtors")
        .select("id").eq("user_id", accountId).eq("stripe_customer_id", stripeCust).maybeSingle();
      if (!debtor) throw new Error("No matching Recouply account for this Stripe customer");
      const { data: existing } = await supa.from("invoices")
        .select("id").eq("stripe_invoice_id", si.id).maybeSingle();
      if (existing) {
        const { error } = await supa.from("invoices").update(patch).eq("id", existing.id);
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true, updated: existing.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: inserted, error } = await supa.from("invoices").insert({
        ...patch,
        debtor_id: debtor.id,
        invoice_number: si.number ?? `STRIPE-${si.id.slice(-8)}`,
        amount: patch.total_amount,
      }).select("id").single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, created: inserted.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "push") {
      const { invoice_id } = body;
      if (!invoice_id) throw new Error("invoice_id required");
      const res = await supa.functions.invoke("push-invoice-to-stripe", {
        body: { invoice_id },
        headers: { Authorization: req.headers.get("Authorization") || "" },
      });
      if (res.error) throw new Error(res.error.message || "Push failed");
      return new Response(JSON.stringify({ ok: true, data: res.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
