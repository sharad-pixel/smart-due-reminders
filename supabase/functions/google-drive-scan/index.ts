import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: any) => {
  console.log(`[DRIVE-SCAN] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

async function refreshAccessToken(supabase: any, connection: any, clientId: string, clientSecret: string) {
  if (!connection.refresh_token) throw new Error('No refresh token available');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  await supabase
    .from('drive_connections')
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!;

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'scan'; // scan, get_picker_token, set_folder

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user's drive connection
    const { data: connection, error: connErr } = await supabase
      .from('drive_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (connErr || !connection) {
      return new Response(JSON.stringify({ error: 'No active Google Drive connection' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh token if expired
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      logStep('Refreshing expired token');
      accessToken = await refreshAccessToken(supabase, connection, clientId, clientSecret);
    }

    if (action === 'get_picker_token') {
      // Returns a fresh OAuth access token + Picker config so the browser can launch
      // the Google Picker. Picker grants per-folder/file access under drive.file scope.
      const apiKey = Deno.env.get('GOOGLE_API_KEY') || null;
      // App ID = Google Cloud project number, derived from the OAuth client ID prefix
      const appId = clientId.split('-')[0] || null;
      logStep('Issuing picker token', { hasApiKey: !!apiKey });

      return new Response(JSON.stringify({
        access_token: accessToken,
        api_key: apiKey,
        app_id: appId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set_folder') {
      const { folderId, folderName } = body;
      if (!folderId) {
        return new Response(JSON.stringify({ error: 'folderId is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('drive_connections')
        .update({ folder_id: folderId, folder_name: folderName, updated_at: new Date().toISOString() })
        .eq('id', connection.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SCAN action: find PDFs in the selected folder
    if (!connection.folder_id) {
      return new Response(JSON.stringify({ error: 'No folder selected. Please select a folder first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep('Scanning folder', { folderId: connection.folder_id });

    // List all PDF files in the folder
    let allFiles: any[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: `'${connection.folder_id}' in parents and mimeType='application/pdf' and trashed=false`,
        fields: 'nextPageToken,files(id,name,size,createdTime,modifiedTime)',
        pageSize: '100',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Drive API error: ${JSON.stringify(data)}`);

      allFiles.push(...(data.files || []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    logStep('Found PDF files', { count: allFiles.length });

    // Get existing file IDs AND file names to skip duplicates (by ID or filename)
    const { data: existingFiles } = await supabase
      .from('ingestion_scanned_files')
      .select('file_id, file_name')
      .eq('connection_id', connection.id);

    const existingIds = new Set((existingFiles || []).map((f: any) => f.file_id));
    const existingNames = new Set((existingFiles || []).map((f: any) => (f.file_name || '').toLowerCase().trim()));
    const newFiles = allFiles.filter(f => {
      if (existingIds.has(f.id)) return false;
      if (existingNames.has((f.name || '').toLowerCase().trim())) return false;
      return true;
    });

    logStep('New files to track', { count: newFiles.length, skippedById: allFiles.filter(f => existingIds.has(f.id)).length, skippedByName: allFiles.filter(f => !existingIds.has(f.id) && existingNames.has((f.name || '').toLowerCase().trim())).length });

    // Get org ID
    const { data: orgId } = await supabase.rpc('get_user_organization_id', { p_user_id: user.id });

    // Insert new files as pending
    if (newFiles.length > 0) {
      const rows = newFiles.map(f => ({
        user_id: user.id,
        organization_id: orgId,
        connection_id: connection.id,
        file_id: f.id,
        file_name: f.name,
        folder_path: connection.folder_name || '',
        mime_type: 'application/pdf',
        file_size: f.size ? parseInt(f.size) : null,
        processing_status: 'pending',
      }));

      const { error: insertErr } = await supabase
        .from('ingestion_scanned_files')
        .insert(rows);

      if (insertErr) {
        logStep('Error inserting scanned files', { error: insertErr.message });
      }
    }

    // Update last sync
    await supabase
      .from('drive_connections')
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', connection.id);

    // Log audit event
    await supabase.from('ingestion_audit_log').insert({
      user_id: user.id,
      organization_id: orgId,
      event_type: 'folder_scanned',
      event_details: {
        folder_id: connection.folder_id,
        total_files: allFiles.length,
        new_files: newFiles.length,
        skipped: allFiles.length - newFiles.length,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      total_files: allFiles.length,
      new_files: newFiles.length,
      already_tracked: allFiles.length - newFiles.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
