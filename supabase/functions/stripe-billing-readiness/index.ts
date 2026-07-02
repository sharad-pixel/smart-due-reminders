import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pickField(fields: any[], keys: string[]): string | null {
  for (const k of keys) {
    const row = fields.find((f) => (f.field_key || "").toLowerCase() === k.toLowerCase());
    const v = row?.field_value ?? row?.field_value_json;
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return null;
}

const REQUIRED: Array<{ key: string; label: string; check: (ctx: any) => boolean }> = [
  { key: "customer", label: "Customer", check: (c) => !!c.customer },
  { key: "products", label: "Products", check: (c) => c.revenueItems.length > 0 },
  { key: "pricing", label: "Pricing", check: (c) => c.totalValue > 0 },
  { key: "billing_frequency", label: "Billing Frequency", check: (c) => !!c.billingFrequency },
  { key: "subscription_term", label: "Subscription Term", check: (c) => !!c.term },
  { key: "contract_start", label: "Contract Start", check: (c) => !!c.startDate },
  { key: "contract_end", label: "Contract End", check: (c) => !!c.endDate },
  { key: "currency", label: "Currency", check: (c) => !!c.currency },
  { key: "payment_terms", label: "Payment Terms", check: (c) => !!c.paymentTerms },
  { key: "invoice_schedule", label: "Invoice Schedule", check: (c) => c.schedules.length > 0 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No authorization header");
    const { data: userData } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { contract_id } = await req.json();
    if (!contract_id) throw new Error("contract_id required");

    const [{ data: fields }, { data: revenueItems }, { data: schedules }, { data: contract }] = await Promise.all([
      supa.from("live_contract_extracted_fields").select("field_key, field_value, field_value_json").eq("import_id", contract_id),
      supa.from("contract_revenue_items").select("*").eq("import_id", contract_id),
      supa.from("contract_invoice_schedules").select("*").eq("import_id", contract_id),
      supa.from("contracts").select("*").eq("id", contract_id).maybeSingle(),
    ]);

    const fieldRows = fields ?? [];
    const ctx = {
      customer: pickField(fieldRows, ["customer_name", "customer", "debtor_name"]) || (contract as any)?.debtor_name || null,
      billingFrequency: pickField(fieldRows, ["billing_frequency", "billing_cadence"]),
      term: pickField(fieldRows, ["subscription_term", "term_months", "term"]),
      startDate: pickField(fieldRows, ["contract_start_date", "start_date", "effective_date"]),
      endDate: pickField(fieldRows, ["contract_end_date", "end_date", "expiration_date"]),
      currency: pickField(fieldRows, ["currency"]) || "USD",
      paymentTerms: pickField(fieldRows, ["payment_terms", "net_terms"]),
      revenueItems: revenueItems ?? [],
      schedules: schedules ?? [],
      totalValue: (revenueItems ?? []).reduce((a: number, r: any) => a + (Number(r.amount) || 0), 0),
    };

    const blocking: Array<{ field: string; message: string }> = [];
    let passed = 0;
    for (const r of REQUIRED) {
      if (r.check(ctx)) passed++;
      else blocking.push({ field: r.key, message: `${r.label} is missing` });
    }
    const score = Math.round((passed / REQUIRED.length) * 100);
    const status = score === 100 ? "ready_for_stripe" : score >= 80 ? "ready" : "pending_review";

    const { data: existing } = await supa
      .from("contract_stripe_sync")
      .select("id, stripe_subscription_id")
      .eq("contract_id", contract_id)
      .maybeSingle();

    const row = {
      contract_id,
      user_id: user.id,
      status: existing?.stripe_subscription_id ? "synchronized" : status,
      readiness_score: score,
      blocking_issues: blocking,
    };
    if (existing) {
      await supa.from("contract_stripe_sync").update(row).eq("id", (existing as any).id);
    } else {
      await supa.from("contract_stripe_sync").insert(row);
    }

    return new Response(JSON.stringify({ score, blocking, status: row.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
