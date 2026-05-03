// DEPRECATED: Email/code support login has been disabled.
// Support login is Google SSO only — see /support/login and support-oauth-check.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "Email/code support login is disabled. Use Google SSO at /support/login." }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
