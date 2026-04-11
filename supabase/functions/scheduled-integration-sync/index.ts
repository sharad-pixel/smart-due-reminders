import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SCHEDULED-SYNC] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep('Starting scheduled integration sync check');

    const now = new Date();

    // Find all integration_sync_settings where auto_sync is enabled
    // and next_sync_due_at <= now
    const { data: dueSettings, error: fetchError } = await supabase
      .from('integration_sync_settings')
      .select('id, user_id, integration_type, sync_time, sync_timezone, next_sync_due_at, last_manual_sync_at')
      .eq('auto_sync_enabled', true)
      .lte('next_sync_due_at', now.toISOString())
      .order('next_sync_due_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      logStep('Error fetching due settings', { error: fetchError.message });
      throw fetchError;
    }

    logStep('Found due syncs', { count: dueSettings?.length || 0 });

    const results: Array<{ userId: string; type: string; success: boolean; error?: string }> = [];

    for (const setting of dueSettings || []) {
      try {
        // Skip if user already synced manually today (in user's timezone)
        if (setting.last_manual_sync_at) {
          const userTz = setting.sync_timezone || 'UTC';
          const todayInUserTz = new Intl.DateTimeFormat('en-CA', { timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
          const manualSyncDayInUserTz = new Intl.DateTimeFormat('en-CA', { timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(setting.last_manual_sync_at));
          if (manualSyncDayInUserTz === todayInUserTz) {
            logStep('Skipping - user already synced manually today', { 
              userId: setting.user_id, 
              type: setting.integration_type,
              lastManualSync: setting.last_manual_sync_at 
            });
            // Still advance next_sync_due_at to tomorrow
            await updateNextSyncDue(supabase, setting.id, setting.sync_time, setting.sync_timezone);
            results.push({ userId: setting.user_id, type: setting.integration_type, success: true, error: 'Skipped: manual sync already done today' });
            continue;
          }
        }

        logStep('Processing sync', { userId: setting.user_id, type: setting.integration_type });

        // Determine which sync function to call
        let syncUrl: string;
        if (setting.integration_type === 'stripe') {
          syncUrl = `${supabaseUrl}/functions/v1/sync-stripe-invoices`;
        } else if (setting.integration_type === 'quickbooks') {
          syncUrl = `${supabaseUrl}/functions/v1/sync-quickbooks-data`;
        } else if (setting.integration_type === 'salesforce') {
          syncUrl = `${supabaseUrl}/functions/v1/sync-salesforce-accounts`;
        } else if (setting.integration_type === 'hubspot') {
          syncUrl = `${supabaseUrl}/functions/v1/sync-hubspot-data`;
        } else {
          logStep('Unknown integration type, skipping', { type: setting.integration_type });
          continue;
        }

        logStep('Calling sync function', { url: syncUrl, userId: setting.user_id });

        // Call the sync function with service role key and scheduled user ID
        const syncRes = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'x-scheduled-sync-user-id': setting.user_id,
          },
          body: JSON.stringify({ 
            scheduled: true,
            userId: setting.user_id,
          }),
        });

        const syncResultText = await syncRes.text();
        const success = syncRes.ok;

        logStep('Sync response received', { 
          userId: setting.user_id, 
          type: setting.integration_type, 
          status: syncRes.status,
          success,
          responsePreview: syncResultText.substring(0, 500),
        });

        // ONLY update last_auto_sync_at if the sync actually succeeded
        if (success) {
          await supabase
            .from('integration_sync_settings')
            .update({ last_auto_sync_at: now.toISOString() })
            .eq('id', setting.id);
          logStep('Updated last_auto_sync_at', { userId: setting.user_id });
        } else {
          logStep('Sync failed - NOT updating last_auto_sync_at', { 
            userId: setting.user_id, 
            status: syncRes.status,
            error: syncResultText.substring(0, 300),
          });
        }

        // Always advance next_sync_due_at to prevent retry storms
        await updateNextSyncDue(supabase, setting.id, setting.sync_time, setting.sync_timezone);

        results.push({ 
          userId: setting.user_id, 
          type: setting.integration_type, 
          success,
          error: success ? undefined : syncResultText.substring(0, 200),
        });

      } catch (syncError) {
        logStep('Error processing sync', { userId: setting.user_id, error: String(syncError) });
        results.push({ 
          userId: setting.user_id, 
          type: setting.integration_type, 
          success: false, 
          error: String(syncError).substring(0, 200),
        });
        
        // Still advance to next day so we don't retry endlessly
        await updateNextSyncDue(supabase, setting.id, setting.sync_time, setting.sync_timezone);
      }
    }

    logStep('Scheduled sync complete', { 
      total: results.length, 
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Fatal error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Calculate and update the next sync due time (tomorrow at the user's preferred time)
 */
async function updateNextSyncDue(
  supabase: any, 
  settingId: string, 
  syncTime: string, 
  syncTimezone: string
) {
  try {
    const nextDue = calculateNextSyncTime(syncTime, syncTimezone);
    
    await supabase
      .from('integration_sync_settings')
      .update({ next_sync_due_at: nextDue.toISOString() })
      .eq('id', settingId);
      
    logStep('Updated next sync due', { settingId, nextDue: nextDue.toISOString() });
  } catch (e) {
    logStep('Error updating next sync due', { settingId, error: String(e) });
  }
}

/**
 * Calculate the next sync time based on user's preferred time and timezone.
 * Returns a UTC Date for tomorrow at the specified local time.
 */
function calculateNextSyncTime(syncTime: string, syncTimezone: string): Date {
  const [hours, minutes] = syncTime.split(':').map(Number);
  
  // Get tomorrow's date
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  
  // Create a date string for tomorrow at the desired time in the target timezone
  const year = tomorrow.getUTCFullYear();
  const month = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getUTCDate()).padStart(2, '0');
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  
  // Use Intl to convert timezone to UTC offset
  try {
    const baseDate = new Date(`${year}-${month}-${day}T${timeStr}Z`);
    
    const utcParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).formatToParts(baseDate);
    
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: syncTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).formatToParts(baseDate);
    
    const getVal = (parts: Intl.DateTimeFormatPart[], type: string) => 
      parseInt(parts.find(p => p.type === type)?.value || '0');
    
    const utcHour = getVal(utcParts, 'hour');
    const tzHour = getVal(tzParts, 'hour');
    const utcDay = getVal(utcParts, 'day');
    const tzDay = getVal(tzParts, 'day');
    
    let offsetHours = tzHour - utcHour;
    if (tzDay > utcDay) offsetHours += 24;
    if (tzDay < utcDay) offsetHours -= 24;
    
    const targetUtc = new Date(`${year}-${month}-${day}T${timeStr}Z`);
    targetUtc.setUTCHours(targetUtc.getUTCHours() - offsetHours);
    
    return targetUtc;
  } catch {
    return new Date(`${year}-${month}-${day}T${timeStr}Z`);
  }
}
