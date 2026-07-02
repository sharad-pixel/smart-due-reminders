// Link a Recouply debtor (account) to a Stripe customer.
// Supports actions: search, link, create, unlink.
// Prevents duplicates: unique index on (user_id, stripe_customer_id) + email dedupe on create.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { resolveStripeContext } from "../_shared/stripeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supa, accountId, stripeKey } = await resolveStripeContext(
      req.headers.get("Authorization"),
    );
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "search";
    const debtorId: string | undefined = body.debtor_id;
    if (!debtorId) return json({ error: "debtor_id is required" }, 400);

    // Load debtor scoped to effective account
    const { data: debtor, error: debtorErr } = await supa
      .from("debtors")
      .select("id, user_id, name, company_name, email, stripe_customer_id")
      .eq("id", debtorId)
      .eq("user_id", accountId)
      .maybeSingle();

    if (debtorErr) throw debtorErr;
    if (!debtor) return json({ error: "Debtor not found" }, 404);

    // ---------- SEARCH ----------
    if (action === "search") {
      const query: string = (body.query || debtor.email || debtor.company_name || debtor.name || "").trim();
      if (!query) return json({ candidates: [], current: debtor.stripe_customer_id });

      let candidates: Array<any> = [];

      // Direct id lookup (cus_...)
      if (/^cus_[A-Za-z0-9]+$/.test(query)) {
        try {
          const c = await stripe.customers.retrieve(query);
          if (c && !(c as any).deleted) candidates.push(c);
        } catch (_) { /* ignore */ }
      }

      // Email exact
      if (query.includes("@")) {
        const byEmail = await stripe.customers.list({ email: query, limit: 10 });
        candidates.push(...byEmail.data);
      }

      // Fuzzy search by name/email substring
      try {
        const esc = query.replace(/'/g, "\\'");
        const search = await stripe.customers.search({
          query: `name~'${esc}' OR email~'${esc}'`,
          limit: 10,
        });
        candidates.push(...search.data);
      } catch (_) { /* search index may be cold */ }

      // Dedupe by id
      const seen = new Set<string>();
      candidates = candidates.filter((c) => (c.id && !seen.has(c.id) && seen.add(c.id)));

      // Mark which are already linked to another debtor in this account
      const ids = candidates.map((c) => c.id);
      let takenMap = new Map<string, string>();
      if (ids.length) {
        const { data: taken } = await supa
          .from("debtors")
          .select("id, name, company_name, stripe_customer_id")
          .eq("user_id", accountId)
          .in("stripe_customer_id", ids);
        (taken || []).forEach((d: any) => {
          if (d.id !== debtor.id) takenMap.set(d.stripe_customer_id, d.company_name || d.name || d.id);
        });
      }

      return json({
        current: debtor.stripe_customer_id,
        candidates: candidates.map((c) => ({
          id: c.id,
          email: c.email,
          name: c.name,
          created: c.created,
          taken_by: takenMap.get(c.id) || null,
        })),
      });
    }

    // ---------- LINK existing ----------
    if (action === "link") {
      const customerId: string = body.stripe_customer_id;
      if (!customerId) return json({ error: "stripe_customer_id required" }, 400);

      // Verify it exists in Stripe
      const c = await stripe.customers.retrieve(customerId);
      if (!c || (c as any).deleted) return json({ error: "Customer not found in Stripe" }, 404);

      // Duplicate check within this account
      const { data: dup } = await supa
        .from("debtors")
        .select("id, name, company_name")
        .eq("user_id", accountId)
        .eq("stripe_customer_id", customerId)
        .neq("id", debtor.id)
        .maybeSingle();
      if (dup) {
        return json({
          error: `This Stripe customer is already linked to "${dup.company_name || dup.name}".`,
        }, 409);
      }

      const { error: upErr } = await supa
        .from("debtors")
        .update({
          stripe_customer_id: customerId,
          stripe_customer_linked_at: new Date().toISOString(),
        })
        .eq("id", debtor.id)
        .eq("user_id", accountId);
      if (upErr) throw upErr;

      return json({ ok: true, stripe_customer_id: customerId });
    }

    // ---------- CREATE new (dedupe by email first) ----------
    if (action === "create") {
      const email = (body.email || debtor.email || "").trim();
      const name = (body.name || debtor.company_name || debtor.name || "").trim();
      if (!name) return json({ error: "Customer name required" }, 400);

      // Dedupe: check by email first
      if (email) {
        const existing = await stripe.customers.list({ email, limit: 1 });
        if (existing.data.length && !body.force_create) {
          return json({
            duplicate: true,
            candidate: {
              id: existing.data[0].id,
              email: existing.data[0].email,
              name: existing.data[0].name,
            },
            message: "A Stripe customer with this email already exists. Link it instead or confirm to create a new one.",
          }, 200);
        }
      }

      const created = await stripe.customers.create({
        email: email || undefined,
        name,
        metadata: {
          recouply_debtor_id: debtor.id,
          recouply_account_id: accountId,
        },
      });

      const { error: upErr } = await supa
        .from("debtors")
        .update({
          stripe_customer_id: created.id,
          stripe_customer_linked_at: new Date().toISOString(),
        })
        .eq("id", debtor.id)
        .eq("user_id", accountId);
      if (upErr) throw upErr;

      return json({ ok: true, stripe_customer_id: created.id, created: true });
    }

    // ---------- UNLINK ----------
    if (action === "unlink") {
      const { error: upErr } = await supa
        .from("debtors")
        .update({ stripe_customer_id: null, stripe_customer_linked_at: null })
        .eq("id", debtor.id)
        .eq("user_id", accountId);
      if (upErr) throw upErr;
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[link-debtor-to-stripe]", msg);
    return json({ error: msg }, 500);
  }
});
