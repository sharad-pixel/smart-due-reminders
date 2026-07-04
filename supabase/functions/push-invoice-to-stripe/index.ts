import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeContext } from "../_shared/stripeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMinorUnits(value: unknown, currency: string): number {
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
  return Math.round(toNumber(value) * factor);
}

function invoiceExpectedCents(inv: any, lineItems: any[] | null | undefined, currency: string): number {
  const direct = [inv.total_amount, inv.amount, inv.subtotal_amount, inv.amount_outstanding]
    .map((value) => toMinorUnits(value, currency))
    .find((amount) => amount > 0);
  if (direct) return direct;

  return (lineItems || []).reduce((sum, li) => sum + lineItemCents(li, currency), 0);
}

function lineItemCents(li: any, currency: string): number {
  const explicitTotal = toMinorUnits(li.line_total, currency);
  if (explicitTotal !== 0) return explicitTotal;

  const quantity = toNumber(li.quantity) || 1;
  const unitPrice = toNumber(li.unit_price);
  return toMinorUnits(quantity * unitPrice, currency);
}

async function deleteDraftInvoice(stripe: Stripe, invoiceId: string) {
  try {
    await stripe.invoices.del(invoiceId);
  } catch (_deleteErr) {
    // If Stripe no longer allows deletion, leave the linked ID for traceability.
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { supa, stripeKey } = await resolveStripeContext(req.headers.get("Authorization"));
    const { invoice_id, finalize } = await req.json();
    if (!invoice_id) throw new Error("invoice_id required");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: inv } = await supa.from("invoices").select("*").eq("id", invoice_id).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    const currency = (inv.currency || "usd").toLowerCase();
    const { data: lineItems } = await supa.from("invoice_line_items").select("*").eq("invoice_id", invoice_id).order("sort_order");
    const expectedCents = invoiceExpectedCents(inv, lineItems, currency);
    if (expectedCents <= 0) {
      return new Response(JSON.stringify({
        error: "Invoice total is zero in Recouply, so it was not pushed to Stripe.",
        code: "invoice_total_zero",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (inv.stripe_invoice_id) {
      try {
        const existingInvoice = await stripe.invoices.retrieve(inv.stripe_invoice_id, { expand: ["lines"] });
        if (existingInvoice.status !== "draft") {
          const existingTotal = typeof existingInvoice.total === "number" ? existingInvoice.total : 0;
          const existingDue = typeof existingInvoice.amount_due === "number" ? existingInvoice.amount_due : existingTotal;
          if (existingTotal <= 0 || existingDue <= 0) {
            await supa.from("invoices").update({
              stripe_push_status: "error",
              stripe_push_error: "Linked Stripe invoice is finalized at $0.00; clear/reverse the Stripe credit balance or void that invoice before retrying.",
            } as any).eq("id", invoice_id);
            return new Response(JSON.stringify({
              error: "This invoice is already linked to a finalized Stripe invoice with $0.00 due. Stripe customer credits may have been applied; void that Stripe invoice or remove the credit before retrying.",
              code: "linked_stripe_invoice_zero",
              stripe_invoice_id: inv.stripe_invoice_id,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (_retrieveErr) { /* Keep legacy behavior if the linked invoice cannot be read. */ }

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
    if (String(inv.posting_state || "").toLowerCase() === "draft") {
      return new Response(JSON.stringify({
        error: "This invoice is a Draft. Post it before pushing to Stripe.",
        code: "invoice_is_draft",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
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
    const stripeCustomer = await stripe.customers.retrieve(customerId);
    if (!stripeCustomer.deleted && typeof stripeCustomer.balance === "number" && stripeCustomer.balance < 0) {
      return new Response(JSON.stringify({
        error: "Stripe has a credit balance on this customer. Stripe automatically applies customer credits to invoices, which can make the invoice push in at $0.00. Remove or reverse the Stripe customer credit before pushing.",
        code: "stripe_customer_credit_balance",
        stripe_customer_id: customerId,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Stripe requires due_date to be in the future. If the invoice is already
    // past due, bump the Stripe due_date to tomorrow so the push succeeds; the
    // real original due date is preserved in metadata for reference.
    const nowSec = Math.floor(Date.now() / 1000);
    const tomorrowSec = nowSec + 24 * 60 * 60;
    const rawDueSec = inv.due_date ? Math.floor(new Date(inv.due_date).getTime() / 1000) : undefined;
    const dueDate = rawDueSec ? (rawDueSec > nowSec ? rawDueSec : tomorrowSec) : tomorrowSec;

    // Create the Stripe invoice FIRST (empty), then attach line items to it
    // directly. This guarantees attachment regardless of Stripe's default
    // `pending_invoice_items_behavior`, which has changed across API versions
    // and previously caused $0 invoices when items ended up orphaned on the
    // customer instead of the invoice.
    const stripeInvoice = await stripe.invoices.create({
      customer: customerId,
      currency,
      collection_method: "send_invoice",
      due_date: dueDate,
      pending_invoice_items_behavior: "exclude",
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

    // Persist the link IMMEDIATELY so a failure below can't orphan a Stripe
    // invoice with no reference in Recouply (prevents duplicates on retry).
    await supa.from("invoices").update({
      stripe_invoice_id: stripeInvoice.id,
      pushed_to_stripe_at: new Date().toISOString(),
      stripe_push_status: "draft",
      stripe_push_error: null,
    } as any).eq("id", invoice_id);

    // Attach line items directly to this invoice
    let attachedTotalCents = 0;
    if (lineItems && lineItems.length > 0) {
      for (const li of lineItems) {
        const cents = lineItemCents(li, currency);
        if (!cents) continue;
        await stripe.invoiceItems.create({
          customer: customerId,
          invoice: stripeInvoice.id,
          amount: cents,
          currency,
          description: li.description || inv.invoice_number || "Invoice line",
          metadata: { recouply_invoice_id: invoice_id },
        });
        attachedTotalCents += cents;
      }
    }

    // Fallback: no line items OR line items summed to 0 — attach the invoice total
    if (attachedTotalCents === 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: stripeInvoice.id,
        amount: expectedCents,
        currency,
        description: inv.product_description || inv.invoice_number || "Invoice",
        metadata: { recouply_invoice_id: invoice_id },
      });
      attachedTotalCents = expectedCents;
    }

    // If line items represent the subtotal but Recouply has a processing fee,
    // tax, or other total adjustment, add one balancing line so Stripe total
    // exactly matches the trusted invoice total in the database.
    const deltaCents = expectedCents - attachedTotalCents;
    if (deltaCents !== 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: stripeInvoice.id,
        amount: deltaCents,
        currency,
        description: deltaCents > 0 ? "Invoice total adjustment" : "Invoice credit adjustment",
        metadata: { recouply_invoice_id: invoice_id, recouply_adjustment: "true" },
      });
      attachedTotalCents += deltaCents;
    }

    const draftCheck = await stripe.invoices.retrieve(stripeInvoice.id, { expand: ["lines"] });
    const draftTotal = typeof draftCheck.total === "number" ? draftCheck.total : 0;
    const draftDue = typeof draftCheck.amount_due === "number" ? draftCheck.amount_due : draftTotal;
    if (draftTotal <= 0 || draftDue <= 0) {
      await deleteDraftInvoice(stripe, stripeInvoice.id);
      await supa.from("invoices").update({
        stripe_invoice_id: null,
        pushed_to_stripe_at: null,
        stripe_push_status: "error",
        stripe_push_error: "Stripe calculated the invoice at $0.00 before finalization; push stopped to avoid creating a paid $0 invoice.",
      } as any).eq("id", invoice_id);
      return new Response(JSON.stringify({
        error: "Stripe calculated this invoice at $0.00 before finalization, so Recouply stopped the push. Check the linked Stripe customer for credits/balance settings, then retry.",
        code: "stripe_calculated_zero",
        stripe_invoice_id: stripeInvoice.id,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (finalize) {
      const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
      if ((finalized.total ?? 0) <= 0 || (finalized.amount_due ?? finalized.total ?? 0) <= 0) {
        await supa.from("invoices").update({
          stripe_push_status: "error",
          stripe_push_error: "Stripe finalized the invoice at $0.00; customer credits may have been applied.",
        } as any).eq("id", invoice_id);
        return new Response(JSON.stringify({
          error: "Stripe finalized this invoice at $0.00. The linked Stripe customer likely has credits that Stripe auto-applied.",
          code: "stripe_finalized_zero",
          stripe_invoice_id: stripeInvoice.id,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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
