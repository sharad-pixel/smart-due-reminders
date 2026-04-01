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
    const siteUrl = Deno.env.get('SITE_URL') || 'https://smart-due-reminders.lovable.app';

    if (error || !code || !state) {
      return new Response(redirectHtml(siteUrl, '/data-center', 'error', error || 'Missing authorization code'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const { userId } = JSON.parse(atob(state));
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
      console.error('Token exchange failed:', tokenData);
      return new Response(redirectHtml(siteUrl, '/data-center', 'error', 'Token exchange failed'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

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
      // If conflict on user_id doesn't work, try insert
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
        // Update existing
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

    return new Response(redirectHtml(siteUrl, '/data-center', 'success', 'Google Drive connected successfully'), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    console.error('Callback error:', err);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://smart-due-reminders.lovable.app';
    return new Response(redirectHtml(siteUrl, '/data-center', 'error', String(err)), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

function redirectHtml(base: string, path: string, status: string, message: string) {
  const url = `${base}${path}?drive_status=${status}&drive_message=${encodeURIComponent(message)}`;
  return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${url}"><script>window.location.href="${url}";</script></head><body>Redirecting...</body></html>`;
}
