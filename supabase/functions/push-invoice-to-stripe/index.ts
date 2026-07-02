import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization")!;
    const { data: userData } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { invoice_id, finalize } = await req.json();
    if (!invoice_id) throw new Error("invoice_id required");

    const { data: integ } = await supa
      .from("stripe_integrations")
      .select("stripe_secret_key_encrypted")
      .eq("user_id", user.id)
      .eq("is_connected", true)
      .maybeSingle();
    if (!integ?.stripe_secret_key_encrypted) throw new Error("Stripe not connected");

    const stripe = new Stripe(integ.stripe_secret_key_encrypted, { apiVersion: "2025-08-27.basil" });

    const { data: inv } = await supa.from("invoices").select("*").eq("id", invoice_id).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    if (inv.stripe_invoice_id) {
      return new Response(JSON.stringify({ ok: true, already: inv.stripe_invoice_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: debtor } = await supa
      .from("debtors")
      .select("id, company_name, email, stripe_customer_id")
      .eq("id", inv.debtor_id)
      .maybeSingle();

    // Resolve / create Stripe customer
    let customerId: string | null = (debtor as any)?.stripe_customer_id ?? null;
    if (!customerId) {
      if (debtor?.email) {
        const list = await stripe.customers.list({ email: debtor.email, limit: 1 });
        if (list.data.length) customerId = list.data[0].id;
      }
      if (!customerId) {
        const c = await stripe.customers.create({
          name: debtor?.company_name ?? undefined,
          email: debtor?.email ?? undefined,
          metadata: { recouply_debtor_id: debtor?.id ?? "" },
        });
        customerId = c.id;
      }
      await supa.from("debtors").update({ stripe_customer_id: customerId } as any).eq("id", inv.debtor_id);
    }

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

    const dueDate = inv.due_date ? Math.floor(new Date(inv.due_date).getTime() / 1000) : undefined;
    const stripeInvoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      due_date: dueDate,
      metadata: { recouply_invoice_id: invoice_id, recouply_invoice_number: inv.invoice_number },
      auto_advance: false,
    });

    if (finalize) {
      await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    }

    await supa.from("invoices").update({
      stripe_invoice_id: stripeInvoice.id,
      pushed_to_stripe_at: new Date().toISOString(),
      stripe_push_status: finalize ? "finalized" : "draft",
      stripe_push_error: null,
    } as any).eq("id", invoice_id);

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
