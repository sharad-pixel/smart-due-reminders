import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * DEPRECATED — Smart Ingestion is now billed through the unified Platform Credits wallet.
 * Settle outstanding charges via `asc606-purchase-credits` with `{ mode: "overage" }`.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "Endpoint deprecated. Smart Ingestion now uses Platform Credits.",
      redirect_to: "/billing?tab=credits",
      use_function: "asc606-purchase-credits",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
