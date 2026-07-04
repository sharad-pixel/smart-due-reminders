import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { resolveStripeContext } from "../_shared/stripeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);

function toMinor(amount: any, currency: string): number {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return 0;
  if (ZERO_DECIMAL.has((currency || "usd").toLowerCase())) return Math.round(n);
  return Math.round(n * 100);
}

function mapStripeStatus(s: string | null | undefined): string {
  switch ((s || "").toLowerCase()) {
    case "paid": return "paid";
    case "open": return "open";
    case "draft": return "draft";
    case "uncollectible": return "uncollectible";
    case "void": return "void";
    default: return s || "unknown";
  }
}

function localStatusEquivalent(s: string | null | undefined): string {
  const v = (s || "").toLowerCase();
  if (["paid","open","draft","uncollectible","void"].includes(v)) return v;
  if (v === "overdue" || v === "past_due" || v === "sent") return "open";
  return v;
}

interface Discrepancy {
  key: string;
  type: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  invoice_id?: string | null;
  stripe_invoice_id?: string | null;
  invoice_number?: string | null;
  fixable: "push" | "pull" | "link" | null;
  local?: any;
  stripe?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { supa, accountId, stripeKey } = await resolveStripeContext(req.headers.get("Authorization"));
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Load local invoices for this account
    const { data: debtors } = await supa
      .from("debtors")
      .select("id, stripe_customer_id, company_name, name")
      .eq("user_id", accountId);
    const debtorIds = (debtors ?? []).map((d: any) => d.id);
    const debtorById = new Map((debtors ?? []).map((d: any) => [d.id, d]));

    let localInvoices: any[] = [];
    if (debtorIds.length > 0) {
      // chunk to avoid URL limit
      for (let i = 0; i < debtorIds.length; i += 200) {
        const chunk = debtorIds.slice(i, i + 200);
        const { data } = await supa
          .from("invoices")
          .select("id, invoice_number, status, total_amount, amount, amount_outstanding, currency, due_date, debtor_id, stripe_invoice_id, stripe_customer_id, stripe_hosted_url, stripe_push_status, stripe_push_error")
          .in("debtor_id", chunk);
        localInvoices = localInvoices.concat(data ?? []);
      }
    }

    // Load Stripe invoices (last 12 months, paginated)
    const cutoff = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365;
    const stripeInvoices: Stripe.Invoice[] = [];
    let starting_after: string | undefined = undefined;
    for (let page = 0; page < 20; page++) {
      const res: Stripe.ApiList<Stripe.Invoice> = await stripe.invoices.list({
        limit: 100,
        created: { gte: cutoff },
        ...(starting_after ? { starting_after } : {}),
      });
      stripeInvoices.push(...res.data);
      if (!res.has_more) break;
      starting_after = res.data[res.data.length - 1]?.id;
      if (!starting_after) break;
    }

    // Load dismissals
    const { data: dismissals } = await supa
      .from("stripe_reconciliation_dismissals")
      .select("discrepancy_key")
      .eq("account_id", accountId);
    const dismissedKeys = new Set((dismissals ?? []).map((d: any) => d.discrepancy_key));

    // Index maps
    const stripeById = new Map<string, Stripe.Invoice>();
    stripeInvoices.forEach((si) => stripeById.set(si.id, si));

    const localByStripeId = new Map<string, any>();
    localInvoices.forEach((li) => {
      if (li.stripe_invoice_id) localByStripeId.set(li.stripe_invoice_id, li);
    });

    const discrepancies: Discrepancy[] = [];

    // 1. Compare linked invoices
    for (const li of localInvoices) {
      if (!li.stripe_invoice_id) continue;
      const si = stripeById.get(li.stripe_invoice_id);
      if (!si) {
        discrepancies.push({
          key: `missing_in_stripe:${li.id}`,
          type: "missing_in_stripe",
          severity: "error",
          title: `Invoice ${li.invoice_number || li.id.slice(0, 8)} not found in Stripe`,
          detail: `Local invoice links to Stripe ID ${li.stripe_invoice_id}, but Stripe returned no matching invoice.`,
          invoice_id: li.id,
          stripe_invoice_id: li.stripe_invoice_id,
          invoice_number: li.invoice_number,
          fixable: "push",
          local: li,
        });
        continue;
      }
      const currency = li.currency || si.currency || "usd";
      const localTotalMinor = toMinor(li.total_amount ?? li.amount, currency);
      const stripeTotalMinor = si.total ?? 0;
      if (localTotalMinor !== stripeTotalMinor) {
        discrepancies.push({
          key: `amount_mismatch:${li.id}`,
          type: "amount_mismatch",
          severity: "error",
          title: `Amount mismatch on ${li.invoice_number || li.id.slice(0, 8)}`,
          detail: `Local total ${(localTotalMinor / 100).toFixed(2)} ${currency.toUpperCase()} vs Stripe ${(stripeTotalMinor / 100).toFixed(2)} ${(si.currency || "").toUpperCase()}.`,
          invoice_id: li.id,
          stripe_invoice_id: si.id,
          invoice_number: li.invoice_number,
          fixable: "pull",
          local: li,
          stripe: { total: si.total, currency: si.currency },
        });
      }

      const localSt = localStatusEquivalent(li.status);
      const stripeSt = mapStripeStatus(si.status);
      if (localSt && stripeSt && localSt !== stripeSt) {
        discrepancies.push({
          key: `status_mismatch:${li.id}`,
          type: "status_mismatch",
          severity: "warning",
          title: `Status mismatch on ${li.invoice_number || li.id.slice(0, 8)}`,
          detail: `Local status "${li.status}" vs Stripe "${si.status}".`,
          invoice_id: li.id,
          stripe_invoice_id: si.id,
          invoice_number: li.invoice_number,
          fixable: "pull",
          local: { status: li.status },
          stripe: { status: si.status },
        });
      }

      // Due date
      const localDue = li.due_date ? new Date(li.due_date).toISOString().slice(0, 10) : null;
      const stripeDueTs = si.due_date;
      const stripeDue = stripeDueTs ? new Date(stripeDueTs * 1000).toISOString().slice(0, 10) : null;
      if (localDue && stripeDue && localDue !== stripeDue) {
        discrepancies.push({
          key: `due_date_mismatch:${li.id}`,
          type: "due_date_mismatch",
          severity: "warning",
          title: `Due date mismatch on ${li.invoice_number || li.id.slice(0, 8)}`,
          detail: `Local due ${localDue} vs Stripe due ${stripeDue}.`,
          invoice_id: li.id,
          stripe_invoice_id: si.id,
          invoice_number: li.invoice_number,
          fixable: "pull",
        });
      }

      // Customer link
      const debtor = debtorById.get(li.debtor_id);
      const debtorStripeCust = (debtor as any)?.stripe_customer_id || li.stripe_customer_id;
      const stripeCust = typeof si.customer === "string" ? si.customer : si.customer?.id;
      if (stripeCust && debtorStripeCust && debtorStripeCust !== stripeCust) {
        discrepancies.push({
          key: `customer_mismatch:${li.id}`,
          type: "customer_mismatch",
          severity: "warning",
          title: `Customer mismatch on ${li.invoice_number || li.id.slice(0, 8)}`,
          detail: `Local debtor's Stripe customer ${debtorStripeCust} does not match invoice's Stripe customer ${stripeCust}.`,
          invoice_id: li.id,
          stripe_invoice_id: si.id,
          invoice_number: li.invoice_number,
          fixable: "link",
        });
      }
    }

    // 2. Local invoices with push errors but no stripe_invoice_id
    for (const li of localInvoices) {
      if (!li.stripe_invoice_id && li.stripe_push_status === "error") {
        discrepancies.push({
          key: `push_failed:${li.id}`,
          type: "push_failed",
          severity: "error",
          title: `Push to Stripe failed for ${li.invoice_number || li.id.slice(0, 8)}`,
          detail: li.stripe_push_error || "Unknown push error.",
          invoice_id: li.id,
          invoice_number: li.invoice_number,
          fixable: "push",
        });
      }
    }

    // 3. Orphans in Stripe (invoice exists in Stripe under a linked customer but no local record)
    const linkedStripeCustomers = new Set(
      (debtors ?? []).filter((d: any) => d.stripe_customer_id).map((d: any) => d.stripe_customer_id),
    );
    for (const si of stripeInvoices) {
      const cust = typeof si.customer === "string" ? si.customer : si.customer?.id;
      if (!cust || !linkedStripeCustomers.has(cust)) continue;
      if (localByStripeId.has(si.id)) continue;
      // Skip drafts to keep noise down
      if (si.status === "draft") continue;
      discrepancies.push({
        key: `orphan_in_stripe:${si.id}`,
        type: "orphan_in_stripe",
        severity: "warning",
        title: `Stripe invoice ${si.number || si.id} not in Recouply`,
        detail: `Stripe invoice for a linked customer has no matching Recouply record.`,
        stripe_invoice_id: si.id,
        invoice_number: si.number,
        fixable: "pull",
        stripe: { total: si.total, currency: si.currency, status: si.status },
      });
    }

    // Filter out dismissed
    const active = discrepancies.filter((d) => !dismissedKeys.has(d.key));

    const summary = {
      total: active.length,
      byType: active.reduce((acc: Record<string, number>, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      }, {}),
      stripeInvoiceCount: stripeInvoices.length,
      localInvoiceCount: localInvoices.length,
      linkedInvoiceCount: localByStripeId.size,
      dismissedCount: dismissedKeys.size,
    };

    return new Response(
      JSON.stringify({ ok: true, discrepancies: active, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
