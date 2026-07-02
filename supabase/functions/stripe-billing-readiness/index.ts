import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_FIELDS: Array<{ key: string; label: string; check: (f: any, ctx: any) => boolean }> = [
  { key: "customer", label: "Customer", check: (f) => !!(f?.customer_name || f?.debtor_name) },
  { key: "products", label: "Products", check: (_f, ctx) => ctx.revenueItems.length > 0 },
  { key: "pricing", label: "Pricing", check: (_f, ctx) => ctx.totalValue > 0 },
  { key: "billing_frequency", label: "Billing Frequency", check: (f) => !!f?.billing_frequency },
  { key: "subscription_term", label: "Subscription Term", check: (f) => !!(f?.term_months || f?.subscription_term) },
  { key: "contract_start", label: "Contract Start", check: (f) => !!(f?.start_date || f?.contract_start_date) },
  { key: "contract_end", label: "Contract End", check: (f) => !!(f?.end_date || f?.contract_end_date) },
  { key: "currency", label: "Currency", check: (f) => !!f?.currency },
  { key: "payment_terms", label: "Payment Terms", check: (f) => !!f?.payment_terms },
  { key: "invoice_schedule", label: "Invoice Schedule", check: (_f, ctx) => ctx.schedules.length > 0 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization")!;
    const { data: userData } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { contract_id } = await req.json();
    if (!contract_id) throw new Error("contract_id required");

    const [{ data: fields }, { data: revenueItems }, { data: schedules }] = await Promise.all([
      supa.from("contract_extracted_fields").select("*").eq("import_id", contract_id).limit(1).maybeSingle(),
      supa.from("contract_revenue_items").select("*").eq("import_id", contract_id),
      supa.from("contract_invoice_schedules").select("*").eq("import_id", contract_id),
    ]);

    const ctx = {
      revenueItems: revenueItems ?? [],
      schedules: schedules ?? [],
      totalValue: (revenueItems ?? []).reduce((a: number, r: any) => a + (Number(r.amount) || 0), 0),
    };

    const blocking: Array<{ field: string; message: string }> = [];
    let passed = 0;
    for (const r of REQUIRED_FIELDS) {
      if (r.check(fields ?? {}, ctx)) passed++;
      else blocking.push({ field: r.key, message: `${r.label} is missing` });
    }
    const score = Math.round((passed / REQUIRED_FIELDS.length) * 100);
    const status = score === 100 ? "ready_for_stripe" : score >= 80 ? "ready" : "pending_review";

    const { data: existing } = await supa
      .from("contract_stripe_sync")
      .select("id, stripe_customer_id, stripe_subscription_id")
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
      await supa.from("contract_stripe_sync").update(row).eq("id", existing.id);
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
