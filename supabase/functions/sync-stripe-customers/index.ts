// Pull all customers from the connected Stripe account into Recouply debtors.
// - Skips customers already linked (by stripe_customer_id or reference_id)
// - Links existing debtors that match on external_customer_id
// - Otherwise creates a new debtor + primary contact
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

    // Page through Stripe customers (cap for safety)
    const MAX_CUSTOMERS = 1000;
    const customers: Stripe.Customer[] = [];
    let starting_after: string | undefined;
    while (customers.length < MAX_CUSTOMERS) {
      const page = await stripe.customers.list({
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });
      customers.push(...page.data.filter((c) => !(c as any).deleted));
      if (!page.has_more || page.data.length === 0) break;
      starting_after = page.data[page.data.length - 1].id;
    }

    if (customers.length === 0) {
      return json({ ok: true, scanned: 0, created: 0, linked: 0, skipped: 0 });
    }

    // Prefetch existing debtors in this account. Chunked to keep URL small
    // and avoid PostgREST OR-clause quirks.
    const customerIds = customers.map((c) => c.id);
    const CHUNK = 100;
    const byStripeId = new Map<string, any>();
    const byExternalId = new Map<string, any>();
    for (let i = 0; i < customerIds.length; i += CHUNK) {
      const slice = customerIds.slice(i, i + CHUNK);
      const [{ data: aRows }, { data: bRows }] = await Promise.all([
        supa.from("debtors")
          .select("id, stripe_customer_id, external_customer_id, email")
          .eq("user_id", accountId)
          .in("stripe_customer_id", slice),
        supa.from("debtors")
          .select("id, stripe_customer_id, external_customer_id, email")
          .eq("user_id", accountId)
          .in("external_customer_id", slice),
      ]);
      for (const d of aRows || []) {
        if (d.stripe_customer_id) byStripeId.set(d.stripe_customer_id, d);
      }
      for (const d of bRows || []) {
        if (d.external_customer_id) byExternalId.set(d.external_customer_id, d);
      }
    }


    let created = 0;
    let linked = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const c of customers) {
      try {
        // Already linked
        if (byStripeId.has(c.id)) { skipped++; continue; }

        const name = (c.name || c.email || `Stripe Customer ${c.id.slice(-6)}`).trim();
        const email = (c.email || "").trim() || null;
        const phone = (c.phone || "").trim() || null;

        // Existing debtor imported via invoices? Attach stripe_customer_id.
        const existingDebtor = byExternalId.get(c.id);
        if (existingDebtor) {
          const { error: upErr } = await supa
            .from("debtors")
            .update({
              stripe_customer_id: c.id,
              stripe_customer_linked_at: new Date().toISOString(),
            })
            .eq("id", existingDebtor.id)
            .eq("user_id", accountId);
          if (upErr) throw upErr;
          linked++;
          continue;
        }

        // Create new debtor
        const referenceId = `STRIPE-${accountId.slice(0, 8).toUpperCase()}-${c.id}`;
        const { data: newDebtor, error: insErr } = await supa
          .from("debtors")
          .insert({
            user_id: accountId,
            company_name: name,
            name,
            email,
            phone,
            external_customer_id: c.id,
            external_system: "stripe",
            reference_id: referenceId,
            stripe_customer_id: c.id,
            stripe_customer_linked_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        if (email) {
          await supa.from("debtor_contacts").insert({
            debtor_id: newDebtor.id,
            user_id: accountId,
            name,
            email,
            phone,
            is_primary: true,
            outreach_enabled: true,
          });
        }
        created++;
      } catch (e) {
        errors.push(`${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Stamp last_sync_at on the integration row
    await supa
      .from("stripe_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", accountId);

    return json({
      ok: true,
      scanned: customers.length,
      created,
      linked,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-stripe-customers]", msg);
    return json({ error: msg }, 500);
  }
});
