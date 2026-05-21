import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) => console.log(`[LC-SCAN] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const CONTRACT_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.google-apps.document",
  "application/msword",
];
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

const PENDING_STATUSES = ["found", "queued"];

function triggerExtraction(args: {
  supabaseUrl: string;
  anonKey: string;
  authHeader: string;
  importId: string;
}) {
  return fetch(`${args.supabaseUrl}/functions/v1/live-contract-extract`, {
    method: "POST",
    headers: {
      Authorization: args.authHeader,
      apikey: args.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ importId: args.importId }),
  }).then(async (res) => {
    if (!res.ok) console.error(`[LC-SCAN] extraction trigger failed ${res.status}: ${await res.text()}`);
  }).catch((e) => console.error("[LC-SCAN] extraction trigger error", e));
}

async function refreshToken(supabase: any, conn: any, clientId: string, clientSecret: string) {
  if (!conn.refresh_token) throw new Error("No refresh token");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  await supabase
    .from("drive_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);
  return data.access_token;
}

async function listContractFilesRecursive(accessToken: string, rootFolderId: string, maxDepth = 8) {
  const files: any[] = [];
  const seenFolders = new Set<string>();
  const contractMimeSet = new Set(CONTRACT_MIMES);
  const searchableMimes = [...CONTRACT_MIMES, FOLDER_MIME, SHORTCUT_MIME];

  async function walk(folderId: string, depth: number) {
    if (depth > maxDepth || seenFolders.has(folderId)) return;
    seenFolders.add(folderId);
    let pageToken: string | undefined;
    const mimeQuery = searchableMimes.map((m) => `mimeType='${m}'`).join(" or ");
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and (${mimeQuery}) and trashed=false`,
        fields: "nextPageToken,files(id,name,size,mimeType,createdTime,modifiedTime,shortcutDetails)",
        pageSize: "100",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Drive API: ${JSON.stringify(data)}`);
      for (const item of data.files || []) {
        if (item.mimeType === FOLDER_MIME) {
          await walk(item.id, depth + 1);
        } else if (item.mimeType === SHORTCUT_MIME && contractMimeSet.has(item.shortcutDetails?.targetMimeType)) {
          files.push({
            ...item,
            id: item.shortcutDetails.targetId,
            mimeType: item.shortcutDetails.targetMimeType,
            name: item.name,
          });
        } else if (contractMimeSet.has(item.mimeType)) {
          files.push(item);
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  await walk(rootFolderId, 0);
  return files;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "scan";

    const { data: accountId } = await supabase.rpc("get_effective_account_id", { p_user_id: user.id });
    if (!accountId) throw new Error("No account");

    if (action === "list_folders") {
      const { data } = await supabase
        .from("live_contract_drive_folders")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify({ folders: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "add_folder") {
      const { folderId, folderName, connectionId } = body;
      if (!folderId || !connectionId) return new Response(JSON.stringify({ error: "folderId and connectionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data, error } = await supabase
        .from("live_contract_drive_folders")
        .upsert({
          account_id: accountId,
          user_id: user.id,
          connection_id: connectionId,
          folder_id: folderId,
          folder_name: folderName,
          is_active: true,
        }, { onConflict: "account_id,folder_id" })
        .select()
        .single();
      if (error && error.code !== "23505") throw error;
      await supabase.from("live_contract_audit_log").insert({
        account_id: accountId, user_id: user.id, event_type: "folder_connected",
        event_details: { folder_id: folderId, folder_name: folderName },
      });
      return new Response(JSON.stringify({ folder: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SCAN
    const folderRowId = body.folderRowId;
    if (!folderRowId) return new Response(JSON.stringify({ error: "folderRowId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: folder } = await supabase
      .from("live_contract_drive_folders")
      .select("*")
      .eq("id", folderRowId)
      .eq("account_id", accountId)
      .single();
    if (!folder) throw new Error("Folder not found");

    const { data: conn } = await supabase
      .from("drive_connections")
      .select("*")
      .eq("id", folder.connection_id)
      .single();
    if (!conn) throw new Error("Drive connection not found");

    let accessToken = conn.access_token;
    if (conn.token_expires_at && new Date(conn.token_expires_at) <= new Date()) {
      accessToken = await refreshToken(supabase, conn, clientId, clientSecret);
    }

    const { data: jobRow } = await supabase
      .from("live_contract_scan_jobs")
      .insert({
        account_id: accountId,
        folder_id: folder.id,
        triggered_by: user.id,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    log("Scanning", { folderId: folder.folder_id });

    const allFiles: any[] = [];
    let pageToken: string | undefined;
    const mimeQuery = CONTRACT_MIMES.map((m) => `mimeType='${m}'`).join(" or ");
    do {
      const params = new URLSearchParams({
        q: `'${folder.folder_id}' in parents and (${mimeQuery}) and trashed=false`,
        fields: "nextPageToken,files(id,name,size,mimeType,createdTime,modifiedTime)",
        pageSize: "100",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Drive API: ${JSON.stringify(data)}`);
      allFiles.push(...(data.files || []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    const { data: existing } = await supabase
      .from("live_contract_imports")
      .select("drive_file_id")
      .eq("account_id", accountId)
      .not("drive_file_id", "is", null);
    const existingIds = new Set((existing || []).map((r: any) => r.drive_file_id));

    const newFiles = allFiles.filter((f) => !existingIds.has(f.id));
    const dup = allFiles.length - newFiles.length;

    if (newFiles.length > 0) {
      const rows = newFiles.map((f) => ({
        account_id: accountId,
        user_id: user.id,
        source: "drive",
        folder_id: folder.id,
        scan_job_id: jobRow.id,
        drive_file_id: f.id,
        file_name: f.name,
        mime_type: f.mimeType,
        file_size: f.size ? parseInt(f.size) : null,
        status: "queued",
      }));
      const { error: insErr } = await supabase.from("live_contract_imports").insert(rows);
      if (insErr && insErr.code !== "23505") log("Insert error", { code: insErr.code, msg: insErr.message });
    }

    const { data: pendingImports, error: pendingErr } = await supabase
      .from("live_contract_imports")
      .select("id, file_name, status")
      .eq("account_id", accountId)
      .eq("folder_id", folder.id)
      .eq("source", "drive")
      .in("status", PENDING_STATUSES);
    if (pendingErr) throw pendingErr;

    const extractionJobs = (pendingImports || []).map((imp: any) =>
      triggerExtraction({ supabaseUrl, anonKey, authHeader, importId: imp.id })
    );
    if (extractionJobs.length) {
      log("Triggering extraction", { count: extractionJobs.length });
      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (edgeRuntime?.waitUntil) extractionJobs.forEach((job) => edgeRuntime.waitUntil(job));
      else await Promise.allSettled(extractionJobs);
    }

    await supabase
      .from("live_contract_scan_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        files_found: allFiles.length,
        files_new: newFiles.length,
        files_duplicate: dup,
      })
      .eq("id", jobRow.id);

    await supabase
      .from("live_contract_drive_folders")
      .update({ last_scanned_at: new Date().toISOString() })
      .eq("id", folder.id);

    await supabase.from("live_contract_audit_log").insert({
      account_id: accountId, user_id: user.id, event_type: "folder_scanned",
      event_details: { folder_id: folder.folder_id, total: allFiles.length, new: newFiles.length, dup, extraction_triggered: extractionJobs.length },
    });

    return new Response(JSON.stringify({
      success: true, total_files: allFiles.length, new_files: newFiles.length, duplicates: dup, extraction_triggered: extractionJobs.length, job_id: jobRow.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    log("Error", { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
