import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.is_admin) return json({ error: "Forbidden: Admin access required" }, 403);

    const body = await req.json();
    const accountId: string | undefined = body.accountId;
    const amount = Number(body.amount);
    const note: string = (body.note ?? "").toString().slice(0, 500);
    const service: string = body.service ?? "asc606";
    const kind: string = body.kind ?? "adjustment"; // 'adjustment' | 'refund'

    if (!accountId || !Number.isFinite(amount) || amount === 0) {
      return json({ error: "accountId and non-zero amount are required" }, 400);
    }
    if (!["adjustment", "refund"].includes(kind)) {
      return json({ error: "kind must be 'adjustment' or 'refund'" }, 400);
    }

    // Ensure wallet exists
    const { data: existing } = await supabase
      .from("asc606_credit_wallets")
      .select("id, balance_credits, pending_overage_credits")
      .eq("account_id", accountId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("asc606_credit_wallets").insert({
        account_id: accountId,
        balance_credits: 0,
        pending_overage_credits: 0,
      });
    }

    const { data: wallet } = await supabase
      .from("asc606_credit_wallets")
      .select("balance_credits, pending_overage_credits")
      .eq("account_id", accountId)
      .single();

    const currentBalance = Number(wallet?.balance_credits ?? 0);
    const currentOverage = Number(wallet?.pending_overage_credits ?? 0);

    // Insert ledger row
    const { data: ledgerRow, error: ledgerErr } = await supabase
      .from("asc606_credit_ledger")
      .insert({
        account_id: accountId,
        delta: amount,
        kind,
        service,
        unit_price_cents: 100,
        note: note || `Admin ${kind} by ${userData.user.email}`,
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (ledgerErr) return json({ error: ledgerErr.message }, 500);

    // Apply to wallet: positive amounts retire overage first, then add to balance.
    // Negative amounts deduct from balance.
    let newOverage = currentOverage;
    let newBalance = currentBalance;
    if (amount > 0) {
      const applyToOverage = Math.min(currentOverage, amount);
      newOverage = currentOverage - applyToOverage;
      newBalance = currentBalance + (amount - applyToOverage);
    } else {
      newBalance = currentBalance + amount; // amount is negative
    }

    const { error: updErr } = await supabase
      .from("asc606_credit_wallets")
      .update({
        balance_credits: newBalance,
        pending_overage_credits: newOverage,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);

    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      success: true,
      ledger_id: ledgerRow.id,
      balance_credits: newBalance,
      pending_overage_credits: newOverage,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
