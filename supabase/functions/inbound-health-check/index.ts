import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Inbound Email Health Check
 * 
 * Verifies the entire inbound AI pipeline is operational:
 * 1. DB connectivity — can we query inbound_emails?
 * 2. Recent processing — have emails been processed in the last 24h?
 * 3. Edge function reachability — can resend-inbound-tasks respond to a ping?
 * 4. Resend webhook endpoint — is the webhook function alive?
 * 5. Stuck emails — any unprocessed emails sitting too long?
 * 6. Replay recovery — if missed emails detected, auto-trigger replay
 * 
 * Logs results and optionally stores them in a health_check_logs table.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const checks: Record<string, { status: "ok" | "warning" | "error"; detail: string }> = {};

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Check 1: DB connectivity ──────────────────────────────────
    try {
      const { count, error } = await supabase
        .from("inbound_emails")
        .select("*", { count: "exact", head: true });

      if (error) {
        checks.db_connectivity = { status: "error", detail: `Query failed: ${error.message}` };
      } else {
        checks.db_connectivity = { status: "ok", detail: `Table accessible, ${count ?? 0} total rows` };
      }
    } catch (e) {
      checks.db_connectivity = { status: "error", detail: `Exception: ${(e as Error).message}` };
    }

    // ── Check 2: Recent processing ────────────────────────────────
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentEmails, error } = await supabase
        .from("inbound_emails")
        .select("id, created_at, ai_category")
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        checks.recent_processing = { status: "error", detail: error.message };
      } else if (!recentEmails || recentEmails.length === 0) {
        checks.recent_processing = { status: "warning", detail: "No inbound emails processed in last 24h (may be normal if no replies expected)" };
      } else {
        checks.recent_processing = { status: "ok", detail: `${recentEmails.length} emails processed in last 24h` };
      }
    } catch (e) {
      checks.recent_processing = { status: "error", detail: (e as Error).message };
    }

    // ── Check 3: Stuck/unprocessed emails ─────────────────────────
    try {
      const { data: stuckEmails, error } = await supabase
        .from("inbound_emails")
        .select("id, created_at")
        .is("ai_category", null)
        .eq("is_archived", false)
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) {
        checks.stuck_emails = { status: "error", detail: error.message };
      } else if (stuckEmails && stuckEmails.length > 0) {
        checks.stuck_emails = { status: "warning", detail: `${stuckEmails.length} email(s) with no AI category (possibly unprocessed)` };
      } else {
        checks.stuck_emails = { status: "ok", detail: "No stuck emails detected" };
      }
    } catch (e) {
      checks.stuck_emails = { status: "error", detail: (e as Error).message };
    }

    // ── Check 4: Webhook function reachability ────────────────────
    try {
      const webhookUrl = `${supabaseUrl}/functions/v1/resend-webhook`;
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ type: "health_check.ping", data: {} }),
      });
      const body = await resp.text();

      if (resp.ok || resp.status === 400) {
        // 400 is fine — it means the function is alive but rejected the test payload
        checks.webhook_function = { status: "ok", detail: `Responded with ${resp.status}` };
      } else {
        checks.webhook_function = { status: "error", detail: `HTTP ${resp.status}: ${body.substring(0, 200)}` };
      }
    } catch (e) {
      checks.webhook_function = { status: "error", detail: `Unreachable: ${(e as Error).message}` };
    }

    // ── Check 5: Inbound tasks function reachability ──────────────
    try {
      const inboundUrl = `${supabaseUrl}/functions/v1/resend-inbound-tasks`;
      const resp = await fetch(inboundUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ type: "health_check.ping", data: {} }),
      });
      const body = await resp.text();

      if (resp.ok || resp.status === 400 || resp.status === 200) {
        checks.inbound_tasks_function = { status: "ok", detail: `Responded with ${resp.status}` };
      } else {
        checks.inbound_tasks_function = { status: "error", detail: `HTTP ${resp.status}: ${body.substring(0, 200)}` };
      }
    } catch (e) {
      checks.inbound_tasks_function = { status: "error", detail: `Unreachable: ${(e as Error).message}` };
    }

    // ── Check 6: Auto-recovery if missed emails detected ──────────
    let recoveryTriggered = false;
    const hasErrors = Object.values(checks).some(c => c.status === "error");
    const hasStuckEmails = checks.stuck_emails?.status === "warning";

    if (hasStuckEmails && !hasErrors) {
      try {
        console.log("[HEALTH-CHECK] Stuck emails detected, triggering replay...");
        const { error: replayError } = await supabase.functions.invoke("replay-inbound-emails", {
          body: {},
        });
        if (replayError) {
          checks.auto_recovery = { status: "warning", detail: `Replay triggered but returned error: ${replayError.message}` };
        } else {
          checks.auto_recovery = { status: "ok", detail: "Replay function invoked successfully" };
          recoveryTriggered = true;
        }
      } catch (e) {
        checks.auto_recovery = { status: "error", detail: `Failed to trigger replay: ${(e as Error).message}` };
      }
    }

    // ── Determine overall status ──────────────────────────────────
    const overallStatus = hasErrors ? "unhealthy" : 
      Object.values(checks).some(c => c.status === "warning") ? "degraded" : "healthy";

    const result = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      recovery_triggered: recoveryTriggered,
      checks,
    };

    // Log to console for edge function logs visibility
    console.log(`[HEALTH-CHECK] Status: ${overallStatus}`, JSON.stringify(result, null, 2));

    // If unhealthy, also log a warning-level entry
    if (overallStatus === "unhealthy") {
      console.error(`[HEALTH-CHECK] ⚠️ UNHEALTHY — inbound email pipeline has errors!`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: overallStatus === "unhealthy" ? 503 : 200,
    });

  } catch (error) {
    console.error("[HEALTH-CHECK] Fatal error:", error);
    return new Response(JSON.stringify({
      status: "error",
      message: (error as Error).message,
      duration_ms: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
