import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cron-invoked worker. Finds broadcasts with pending recipients and asks the
// sender to drain another chunk. Safe to run every minute — sender is bounded.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find broadcasts that still have pending recipients
    const { data: rows } = await supabase
      .from("broadcast_recipients")
      .select("broadcast_id")
      .eq("status", "pending")
      .limit(2000);

    const ids = Array.from(new Set((rows || []).map((r: any) => r.broadcast_id)));
    console.log(`[broadcast-queue] Found ${ids.length} broadcasts with pending recipients`);

    const results: any[] = [];
    for (const broadcastId of ids) {
      try {
        const { data, error } = await supabase.functions.invoke("send-broadcast-email", {
          body: { broadcast_id: broadcastId, resume: true, internal_invoke: true },
        });
        if (error) {
          console.error(`[broadcast-queue] Resume error for ${broadcastId}:`, error);
          results.push({ broadcastId, error: String(error?.message || error) });
        } else {
          results.push({ broadcastId, ...(data || {}) });
        }
      } catch (e: any) {
        console.error(`[broadcast-queue] Exception for ${broadcastId}:`, e);
        results.push({ broadcastId, error: String(e?.message || e) });
      }
    }

    return new Response(JSON.stringify({ processed: ids.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[broadcast-queue] Fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
