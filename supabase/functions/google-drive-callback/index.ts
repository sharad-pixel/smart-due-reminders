import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!;

    // Parse state to extract origin and userId
    let stateData: { userId?: string; origin?: string } = {};
    let effectiveSiteUrl = 'https://recouply.ai';

    if (state) {
      try {
        stateData = JSON.parse(atob(state));
        console.log('[DRIVE-CALLBACK] State decoded:', JSON.stringify({ 
          userId: stateData.userId, 
          origin: stateData.origin 
        }));
        if (stateData.origin) {
          effectiveSiteUrl = stateData.origin;
        }
      } catch (parseErr) {
        console.error('[DRIVE-CALLBACK] Failed to parse state:', parseErr);
      }
    }

    if (error || !code || !state) {
      console.error('[DRIVE-CALLBACK] OAuth error or missing params:', { error, hasCode: !!code, hasState: !!state });
      return new Response(redirectHtml(effectiveSiteUrl, '/data-center', 'error', error || 'Missing authorization code'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const userId = stateData.userId;
    if (!userId) {
      console.error('[DRIVE-CALLBACK] No userId in state');
      return new Response(redirectHtml(effectiveSiteUrl, '/data-center', 'error', 'Invalid state: missing user'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-drive-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('[DRIVE-CALLBACK] Token exchange failed:', tokenData);
      return new Response(redirectHtml(effectiveSiteUrl, '/data-center', 'error', 'Token exchange failed: ' + (tokenData.error_description || tokenData.error || 'unknown')), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.log('[DRIVE-CALLBACK] Token exchange successful for user:', userId);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user's org
    const { data: orgId } = await supabase.rpc('get_user_organization_id', { p_user_id: userId });

    // Upsert drive connection
    const { error: upsertError } = await supabase
      .from('drive_connections')
      .upsert({
        user_id: userId,
        organization_id: orgId,
        provider: 'google_drive',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        is_active: true,
      }, { onConflict: 'user_id' })
      .select();

    if (upsertError) {
      console.warn('[DRIVE-CALLBACK] Upsert failed, trying insert/update:', upsertError.message);
      const { error: insertError } = await supabase
        .from('drive_connections')
        .insert({
          user_id: userId,
          organization_id: orgId,
          provider: 'google_drive',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          is_active: true,
        });
      
      if (insertError) {
        await supabase
          .from('drive_connections')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || undefined,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }
    }

    const redirectUrl = `${effectiveSiteUrl}/data-center?drive_status=success&drive_message=${encodeURIComponent('Google Drive connected successfully')}`;
    console.log('[DRIVE-CALLBACK] Success, redirecting to:', redirectUrl);
    return Response.redirect(redirectUrl, 302);
  } catch (err) {
    console.error('[DRIVE-CALLBACK] Unhandled error:', err);
    return new Response(redirectHtml('https://recouply.ai', '/data-center', 'error', String(err)), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

function redirectHtml(base: string, path: string, status: string, message: string) {
  const url = `${base}${path}?drive_status=${status}&drive_message=${encodeURIComponent(message)}`;
  return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${url}"><script>window.location.href="${url}";</script></head><body>Redirecting...</body></html>`;
}
