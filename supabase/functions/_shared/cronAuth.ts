// Shared authorization for cron / scheduled edge functions.
// Accepts requests authenticated via:
//   1. X-Cron-Secret header matching the CRON_SECRET env var (for scheduler-triggered calls)
//   2. Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (server-to-server)
//   3. A valid Supabase user JWT (so manual triggers from authenticated app code work)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function isAuthorizedCronRequest(req: Request): Promise<boolean> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("X-Cron-Secret");
  if (cronSecret && provided && provided === cronSecret) return true;

  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return true;

  if (authHeader.startsWith("Bearer ")) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) return true;
    } catch (_e) {
      // fall through
    }
  }

  return false;
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
