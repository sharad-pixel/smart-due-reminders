import { createClient } from "npm:@supabase/supabase-js@2";
import { isAuthorizedCronRequest, unauthorizedResponse } from "../_shared/cronAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (step: string, details?: any) => {
  console.log(`[SCHEDULED-SHEETS-SYNC] ${step}${details ? ' - ' + JSON.stringify(details) : ''}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    log('Starting scheduled sheets sync');

    // Pull all active templates whose owner still has an active Drive connection
    const { data: templates, error } = await supabase
      .from('google_sheet_templates')
      .select('id, user_id, template_type, sheet_id, sync_status, last_synced_at')
      .eq('status', 'active');

    if (error) throw error;
    log('Templates found', { count: templates?.length || 0 });

    const results: Array<{ id: string; type: string; userId: string; ok: boolean; error?: string }> = [];

    for (const tmpl of templates || []) {
      try {
        // Skip if a sync is already running
        if (tmpl.sync_status === 'syncing') {
          log('Skip - already syncing', { id: tmpl.id });
          continue;
        }

        // Ensure owner still has an active Drive connection
        const { data: conn } = await supabase
          .from('drive_connections')
          .select('id')
          .eq('user_id', tmpl.user_id)
          .eq('is_active', true)
          .maybeSingle();
        if (!conn) {
          log('Skip - no drive connection', { id: tmpl.id, user: tmpl.user_id });
          continue;
        }

        log('Pushing template', { id: tmpl.id, type: tmpl.template_type });

        const res = await fetch(`${supabaseUrl}/functions/v1/google-sheets-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            sheetTemplateId: tmpl.id,
            direction: 'push',
            scheduled: true,
            userId: tmpl.user_id,
          }),
        });
        const ok = res.ok;
        const txt = await res.text();
        log('Result', { id: tmpl.id, status: res.status, ok, preview: txt.substring(0, 200) });

        results.push({
          id: tmpl.id,
          type: tmpl.template_type,
          userId: tmpl.user_id,
          ok,
          error: ok ? undefined : txt.substring(0, 200),
        });
      } catch (e) {
        log('Error for template', { id: tmpl.id, error: String(e) });
        results.push({
          id: tmpl.id,
          type: tmpl.template_type,
          userId: tmpl.user_id,
          ok: false,
          error: String(e).substring(0, 200),
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      succeeded: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log('Fatal', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
