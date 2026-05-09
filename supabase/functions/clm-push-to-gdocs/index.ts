// Push a CLM workspace to Google Docs (create or update the same doc).
// Reuses the user's existing Google OAuth from drive_connections.
// Requires the `documents` scope — if missing, returns { needs_reconsent: true }.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function refreshIfNeeded(supabase: any, conn: any) {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return conn.access_token as string;
  if (!conn.refresh_token) throw new Error("Google connection missing refresh token — please reconnect.");

  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google client credentials not configured");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tok = await r.json();
  if (!r.ok) throw new Error(`Token refresh failed: ${tok.error_description || tok.error || r.status}`);

  await supabase
    .from("drive_connections")
    .update({
      access_token: tok.access_token,
      token_expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", conn.user_id);
  return tok.access_token as string;
}

async function checkDocsScope(token: string): Promise<boolean> {
  const r = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
  if (!r.ok) return false;
  const info = await r.json();
  const scopes = String(info.scope || "").split(/\s+/);
  return scopes.includes("https://www.googleapis.com/auth/documents");
}

function buildBatchRequests(sections: any[], workspaceName: string) {
  // We delete entire body, then insert from index 1.
  // Build text to insert and style ranges.
  const reqs: any[] = [];
  let cursor = 1;
  const insertText = (text: string) => {
    if (!text) return;
    reqs.push({ insertText: { location: { index: cursor }, text } });
    cursor += text.length;
  };
  const styleHeading = (start: number, end: number, level: 1 | 2) => {
    reqs.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType: level === 1 ? "HEADING_1" : "HEADING_2" },
        fields: "namedStyleType",
      },
    });
  };

  // Title as heading 1
  const titleStart = cursor;
  insertText(`${workspaceName}\n`);
  styleHeading(titleStart, cursor - 1, 1);

  // Subtitle
  const subStart = cursor;
  insertText(`Synced from Recouply Contract Intelligence · ${new Date().toUTCString()}\n\n`);
  reqs.push({
    updateParagraphStyle: {
      range: { startIndex: subStart, endIndex: cursor - 1 },
      paragraphStyle: { namedStyleType: "SUBTITLE" },
      fields: "namedStyleType",
    },
  });

  for (const s of sections) {
    const hStart = cursor;
    insertText(`${s.title || "Section"}\n`);
    styleHeading(hStart, cursor - 1, 2);

    const bodyStart = cursor;
    insertText(`${(s.body ?? "").trim() || "—"}\n\n`);
    // ensure normal paragraph styling
    reqs.push({
      updateParagraphStyle: {
        range: { startIndex: bodyStart, endIndex: cursor - 1 },
        paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        fields: "namedStyleType",
      },
    });
  }
  return reqs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Not authenticated" });

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json(401, { error: "Invalid token" });

    const { instanceId } = await req.json().catch(() => ({}));
    if (!instanceId) return json(400, { error: "instanceId required" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: conn, error: cErr } = await admin
      .from("drive_connections")
      .select("user_id, access_token, refresh_token, token_expires_at, is_active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!conn || !conn.is_active) {
      return json(200, { needs_connection: true, message: "Connect Google Drive first." });
    }

    const accessToken = await refreshIfNeeded(admin, conn);
    const hasDocs = await checkDocsScope(accessToken);
    if (!hasDocs) {
      return json(200, {
        needs_reconsent: true,
        message: "Google Docs scope is missing. Please reconnect Google to grant document access.",
      });
    }

    const { data: instance, error: iErr } = await admin
      .from("clm_template_instances")
      .select("id, name, gdoc_document_id")
      .eq("id", instanceId)
      .single();
    if (iErr) throw iErr;

    const { data: sections, error: sErr } = await admin
      .from("clm_instance_sections")
      .select("title, body, order_index")
      .eq("instance_id", instanceId)
      .order("order_index");
    if (sErr) throw sErr;

    let documentId = instance.gdoc_document_id as string | null;

    // Create the document if not yet pushed
    if (!documentId) {
      const cr = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: instance.name }),
      });
      const cd = await cr.json();
      if (!cr.ok) throw new Error(`Create doc failed: ${cd.error?.message || cr.status}`);
      documentId = cd.documentId;
    }

    // Read current length to delete existing content (preserves trailing newline)
    const getRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}?fields=body(content(endIndex))`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const docMeta = await getRes.json();
    if (!getRes.ok) throw new Error(`Read doc failed: ${docMeta.error?.message || getRes.status}`);
    const lastEnd =
      docMeta?.body?.content?.[docMeta.body.content.length - 1]?.endIndex ?? 2;

    const requests: any[] = [];
    if (lastEnd > 2) {
      requests.push({
        deleteContentRange: { range: { startIndex: 1, endIndex: lastEnd - 1 } },
      });
    }
    requests.push(...buildBatchRequests(sections ?? [], instance.name));

    const upRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      },
    );
    const upBody = await upRes.json();
    if (!upRes.ok) throw new Error(`batchUpdate failed: ${upBody.error?.message || upRes.status}`);

    const url = `https://docs.google.com/document/d/${documentId}/edit`;
    await admin
      .from("clm_template_instances")
      .update({
        gdoc_document_id: documentId,
        gdoc_url: url,
        gdoc_synced_at: new Date().toISOString(),
        gdoc_synced_by: user.id,
      })
      .eq("id", instanceId);

    return json(200, { success: true, documentId, url });
  } catch (e) {
    console.error("[clm-push-to-gdocs]", e);
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
