import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeContext } from "../_shared/stripeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { supa, stripeKey } = await resolveStripeContext(req.headers.get("Authorization"));
    const { invoice_id, finalize } = await req.json();
    if (!invoice_id) throw new Error("invoice_id required");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: inv } = await supa.from("invoices").select("*").eq("id", invoice_id).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    if (inv.stripe_invoice_id) {
      return new Response(JSON.stringify({ ok: true, already: inv.stripe_invoice_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedup guard: check Stripe for any invoice already tagged with this recouply_invoice_id
    // (covers cases where a prior push created the Stripe invoice but failed to persist the link).
    try {
      const existing = await stripe.invoices.search({
        query: `metadata['recouply_invoice_id']:'${invoice_id}'`,
        limit: 1,
      });
      if (existing.data.length > 0) {
        const found = existing.data[0];
        await supa.from("invoices").update({
          stripe_invoice_id: found.id,
          pushed_to_stripe_at: new Date().toISOString(),
          stripe_push_status: found.status === "draft" ? "draft" : "finalized",
          stripe_push_error: null,
        } as any).eq("id", invoice_id);
        return new Response(JSON.stringify({ ok: true, already: found.id, recovered: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_searchErr) { /* search unavailable — proceed to create */ }


    // Only posted (open / active) invoices are eligible to push to Stripe.
    // Drafts, disputed, and terminal statuses are blocked to prevent syncing
    // provisional or already-closed records into the billing system.
    const POSTED_STATUSES = new Set(["Open", "InPaymentPlan", "PartiallyPaid"]);
    if (!POSTED_STATUSES.has(String(inv.status || ""))) {
      return new Response(JSON.stringify({
        error: `Only posted invoices can be pushed to Stripe. This invoice is "${inv.status}".`,
        code: "invoice_not_posted",
        status: inv.status,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    if (!inv.debtor_id) {
      return new Response(JSON.stringify({
        error: "This invoice isn't linked to a Recouply account.",
        code: "invoice_not_linked_to_debtor",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: debtor } = await supa
      .from("debtors")
      .select("id, company_name, name, email, stripe_customer_id")
      .eq("id", inv.debtor_id)
      .maybeSingle();

    // Hard requirement: the Recouply account must be explicitly linked to a Stripe
    // customer via the account page. We no longer fall back to email lookup or
    // auto-create, because both create silent wrong-customer / duplicate risks.
    if (!debtor?.stripe_customer_id) {
      const label = (debtor as any)?.company_name || (debtor as any)?.name || "this account";
      return new Response(JSON.stringify({
        error: `Account "${label}" is not linked to a Stripe customer. Open the account and link it before pushing invoices.`,
        code: "debtor_not_linked_to_stripe",
        debtor_id: inv.debtor_id,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const customerId: string = debtor.stripe_customer_id;

    // Line items — prefer invoice_line_items, else single line from invoice
    const { data: lineItems } = await supa.from("invoice_line_items").select("*").eq("invoice_id", invoice_id).order("sort_order");
    const currency = (inv.currency || "usd").toLowerCase();

    if (lineItems && lineItems.length > 0) {
      for (const li of lineItems) {
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: Math.round(Number(li.line_total) * 100),
          currency,
          description: li.description,
          metadata: { recouply_invoice_id: invoice_id },
        });
      }
    } else {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(Number(inv.total_amount ?? inv.amount) * 100),
        currency,
        description: inv.product_description || inv.invoice_number,
        metadata: { recouply_invoice_id: invoice_id },
      });
    }

    // Stripe requires due_date to be in the future. If the invoice is already
    // past due, bump the Stripe due_date to tomorrow so the push succeeds; the
    // real original due date is preserved in metadata for reference.
    const nowSec = Math.floor(Date.now() / 1000);
    const tomorrowSec = nowSec + 24 * 60 * 60;
    const rawDueSec = inv.due_date ? Math.floor(new Date(inv.due_date).getTime() / 1000) : undefined;
    const dueDate = rawDueSec ? (rawDueSec > nowSec ? rawDueSec : tomorrowSec) : tomorrowSec;
    const stripeInvoice = await stripe.invoices.create({
      customer: customerId,
      currency,
      collection_method: "send_invoice",
      due_date: dueDate,
      pending_invoice_items_behavior: "include",
      description: inv.product_description || `Recouply invoice ${inv.invoice_number}`,
      footer: inv.invoice_number ? `Recouply reference: ${inv.invoice_number}` : undefined,
      metadata: {
        recouply_invoice_id: invoice_id,
        recouply_invoice_number: inv.invoice_number ?? "",
        recouply_original_due_date: inv.due_date || "",
        recouply_due_date_adjusted: rawDueSec && rawDueSec <= nowSec ? "true" : "false",
      },
      auto_advance: false,
    });

    // Immediately persist the link BEFORE finalize, so a finalize failure can't
    // orphan a Stripe invoice with no reference in Recouply (prevents duplicates
    // on retry).
    await supa.from("invoices").update({
      stripe_invoice_id: stripeInvoice.id,
      pushed_to_stripe_at: new Date().toISOString(),
      stripe_push_status: "draft",
      stripe_push_error: null,
    } as any).eq("id", invoice_id);

    if (finalize) {
      await stripe.invoices.finalizeInvoice(stripeInvoice.id);
      await supa.from("invoices").update({
        stripe_push_status: "finalized",
      } as any).eq("id", invoice_id);
    }

    return new Response(JSON.stringify({ ok: true, stripe_invoice_id: stripeInvoice.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    try {
      const supa2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const body = await req.clone().json().catch(() => ({}));
      if (body?.invoice_id) {
        await supa2.from("invoices").update({ stripe_push_status: "error", stripe_push_error: msg } as any).eq("id", body.invoice_id);
      }
    } catch { /* noop */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
