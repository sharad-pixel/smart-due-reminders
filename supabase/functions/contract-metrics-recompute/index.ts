// Recomputes finance-grade MRR/ARR/ACV/TCV for a single live contract import
// (or all imports in the caller's account) and caches the result on
// `live_contract_imports.metrics_jsonb` + `metrics_computed_at`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeContractTotals, type RecurringComponent, type RampYear } from "../_shared/contractMetrics.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const importId: string | undefined = body.import_id;
    const accountId: string | undefined = body.account_id;
    const all: boolean = body.all === true;

    // Resolve target import IDs
    let targetIds: string[] = [];
    if (importId) {
      targetIds = [importId];
    } else if (all || accountId) {
      // Scope to imports belonging to the caller's account(s)
      const { data: memberships } = await admin
        .from("account_users")
        .select("account_id")
        .eq("user_id", userData.user.id);
      const ids = (memberships || []).map((m: any) => m.account_id);
      if (accountId && !ids.includes(accountId)) return json({ error: "forbidden" }, 403);
      const scope = accountId ? [accountId] : ids;
      if (scope.length === 0) return json({ recomputed: 0 });
      const { data: imps } = await admin
        .from("live_contract_imports")
        .select("id")
        .in("account_id", scope);
      targetIds = (imps || []).map((i: any) => i.id);
    } else {
      return json({ error: "import_id or all=true required" }, 400);
    }

    let recomputed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of targetIds) {
      try {
        const [{ data: imp }, { data: fields }, { data: schedules }] = await Promise.all([
          admin.from("live_contract_imports").select("*").eq("id", id).maybeSingle(),
          admin.from("live_contract_extracted_fields").select("*").eq("import_id", id),
          admin.from("contract_invoice_schedules").select("*").eq("import_id", id),
        ]);
        if (!imp) continue;

        // Pull structured components if the extractor stored them under
        // field_group='commercial' / field_key='recurring_components' as JSON.
        let components: RecurringComponent[] | undefined;
        let ramp: RampYear[] | undefined;
        const componentsRow = (fields || []).find(
          (f: any) => f.field_key === "recurring_components",
        );
        if (componentsRow?.field_value) {
          try {
            const parsed = JSON.parse(componentsRow.field_value);
            if (Array.isArray(parsed)) components = parsed as RecurringComponent[];
          } catch (_) {}
        }
        const rampRow = (fields || []).find((f: any) => f.field_key === "ramp_schedule");
        if (rampRow?.field_value) {
          try {
            const parsed = JSON.parse(rampRow.field_value);
            if (Array.isArray(parsed)) ramp = parsed as RampYear[];
          } catch (_) {}
        }

        const totals = computeContractTotals(
          (fields || []) as any,
          imp as any,
          { components, ramp, schedule: (schedules || []) as any },
        );

        await admin
          .from("live_contract_imports")
          .update({
            metrics_jsonb: totals as any,
            metrics_computed_at: new Date().toISOString(),
          })
          .eq("id", id);
        recomputed += 1;
      } catch (e) {
        errors.push({ id, error: String((e as Error).message || e) });
      }
    }

    return json({ recomputed, errors });
  } catch (e) {
    console.error("contract-metrics-recompute error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
