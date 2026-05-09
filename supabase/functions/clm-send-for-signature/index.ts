// Provider-agnostic signature send. DocuSign/Adobe wired as stubs that respond
// with 501 until provider keys are added. Manual + Google Docs paths simply mark sent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const packageId = body?.package_id;
    if (!packageId) return json({ error: "package_id is required" }, 400);

    const { data: pkg, error } = await sb
      .from("clm_signature_packages")
      .select("*, clm_template_instances!inner(account_id, name)")
      .eq("id", packageId)
      .single();
    if (error || !pkg) return json({ error: "package not found" }, 404);

    const provider = pkg.provider as string;

    let envelopeId: string | null = null;
    let externalUrl: string | null = null;

    if (provider === "manual" || provider === "google_docs") {
      // No external send — caller is responsible for the file.
      envelopeId = `local-${packageId}`;
    } else if (provider === "docusign") {
      const docusignKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY");
      if (!docusignKey) {
        return json({
          error: "DocuSign is not configured. Add a DocuSign integration key to enable provider send.",
          code: "PROVIDER_NOT_CONFIGURED",
        }, 501);
      }
      // TODO: implement real DocuSign envelope creation when key is configured.
      envelopeId = `docusign-pending-${packageId}`;
    } else if (provider === "adobe") {
      const adobeKey = Deno.env.get("ADOBE_SIGN_INTEGRATION_KEY");
      if (!adobeKey) {
        return json({
          error: "Adobe Sign is not configured. Add an Adobe Sign integration key to enable provider send.",
          code: "PROVIDER_NOT_CONFIGURED",
        }, 501);
      }
      envelopeId = `adobe-pending-${packageId}`;
    } else {
      return json({ error: `Unknown provider: ${provider}` }, 400);
    }

    const { error: upErr } = await sb
      .from("clm_signature_packages")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        external_envelope_id: envelopeId,
      })
      .eq("id", packageId);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true, package_id: packageId, provider, envelope_id: envelopeId, external_url: externalUrl });
  } catch (e: any) {
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
