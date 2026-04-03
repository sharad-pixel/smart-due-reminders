import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-SALESFORCE-CASES] ${step}${detailsStr}`);
};

async function refreshSalesforceToken(supabaseAdmin: any, connection: any): Promise<string> {
  const clientId = Deno.env.get('SALESFORCE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('SALESFORCE_CLIENT_SECRET')!;
  const loginUrl = Deno.env.get('SALESFORCE_LOGIN_URL') || 'https://login.salesforce.com';

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${data.error || res.status}`);
  }

  // Update stored token
  await supabaseAdmin
    .from('crm_connections')
    .update({ access_token: data.access_token, updated_at: new Date().toISOString() })
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
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Determine user - either from JWT or scheduled sync header
    let userId: string;
    const scheduledUserId = req.headers.get('x-scheduled-sync-user-id');
    const authHeader = req.headers.get('Authorization') || '';

    if (scheduledUserId && authHeader.includes(serviceKey)) {
      userId = scheduledUserId;
      logStep('Scheduled sync mode', { userId });
    } else {
      const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = user.id;
    }

    // Get Salesforce connection
    const { data: connection, error: connErr } = await supabaseAdmin
      .from('crm_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('crm_type', 'salesforce')
      .maybeSingle();

    if (connErr || !connection) {
      logStep('No Salesforce connection found', { userId });
      return new Response(JSON.stringify({ error: 'Salesforce not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let accessToken = connection.access_token;
    const instanceUrl = connection.instance_url;

    // Query Salesforce Cases via REST API
    const soqlQuery = encodeURIComponent(
      `SELECT Id, CaseNumber, Subject, Description, Status, Priority, Type, Origin, 
              CreatedDate, ClosedDate, Account.Name, Account.Id, Contact.Name, Contact.Email,
              Owner.Name
       FROM Case 
       ORDER BY CreatedDate DESC 
       LIMIT 200`
    );

    let sfRes = await fetch(`${instanceUrl}/services/data/v59.0/query?q=${soqlQuery}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // If 401, try refresh
    if (sfRes.status === 401) {
      logStep('Token expired, refreshing');
      accessToken = await refreshSalesforceToken(supabaseAdmin, connection);
      sfRes = await fetch(`${instanceUrl}/services/data/v59.0/query?q=${soqlQuery}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    if (!sfRes.ok) {
      const errText = await sfRes.text();
      logStep('Salesforce API error', { status: sfRes.status, body: errText.substring(0, 300) });
      throw new Error(`Salesforce API error: ${sfRes.status}`);
    }

    const sfData = await sfRes.json();
    const cases = sfData.records || [];
    logStep('Fetched cases', { count: cases.length });

    let upserted = 0;
    let matched = 0;
    let errors = 0;

    for (const sfCase of cases) {
      try {
        // Try to match Account.Name to an existing debtor
        let debtorId: string | null = null;
        const accountName = sfCase.Account?.Name;

        if (accountName) {
          const { data: debtor } = await supabaseAdmin
            .from('debtors')
            .select('id')
            .eq('user_id', userId)
            .or(`company_name.ilike.%${accountName}%,name.ilike.%${accountName}%`)
            .limit(1)
            .maybeSingle();

          if (debtor) {
            debtorId = debtor.id;
            matched++;
          }
        }

        if (!debtorId) {
          // Skip cases without a matched debtor - we can't create cs_cases without debtor_id
          logStep('No debtor match, skipping', { caseNumber: sfCase.CaseNumber, accountName });
          continue;
        }

        // Upsert into cs_cases
        const { error: upsertErr } = await supabaseAdmin
          .from('cs_cases')
          .upsert({
            user_id: userId,
            debtor_id: debtorId,
            external_case_id: sfCase.Id,
            case_number: sfCase.CaseNumber,
            subject: sfCase.Subject || 'No Subject',
            description: sfCase.Description,
            status: sfCase.Status,
            priority: sfCase.Priority,
            case_type: sfCase.Type,
            case_origin: sfCase.Origin,
            assigned_to: sfCase.Owner?.Name,
            opened_at: sfCase.CreatedDate,
            closed_at: sfCase.ClosedDate,
            source_system: 'salesforce',
            raw_json: sfCase,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'external_case_id',
            ignoreDuplicates: false,
          });

        if (upsertErr) {
          // If upsert fails (e.g. no unique constraint on external_case_id), try insert
          logStep('Upsert error, trying insert', { caseNumber: sfCase.CaseNumber, error: upsertErr.message });
          
          // Check if already exists
          const { data: existing } = await supabaseAdmin
            .from('cs_cases')
            .select('id')
            .eq('external_case_id', sfCase.Id)
            .eq('user_id', userId)
            .maybeSingle();

          if (existing) {
            await supabaseAdmin.from('cs_cases').update({
              subject: sfCase.Subject || 'No Subject',
              description: sfCase.Description,
              status: sfCase.Status,
              priority: sfCase.Priority,
              case_type: sfCase.Type,
              case_origin: sfCase.Origin,
              assigned_to: sfCase.Owner?.Name,
              closed_at: sfCase.ClosedDate,
              raw_json: sfCase,
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id);
          } else {
            await supabaseAdmin.from('cs_cases').insert({
              user_id: userId,
              debtor_id: debtorId,
              external_case_id: sfCase.Id,
              case_number: sfCase.CaseNumber,
              subject: sfCase.Subject || 'No Subject',
              description: sfCase.Description,
              status: sfCase.Status,
              priority: sfCase.Priority,
              case_type: sfCase.Type,
              case_origin: sfCase.Origin,
              assigned_to: sfCase.Owner?.Name,
              opened_at: sfCase.CreatedDate,
              closed_at: sfCase.ClosedDate,
              source_system: 'salesforce',
              raw_json: sfCase,
            });
          }
        }

        upserted++;
      } catch (caseErr) {
        logStep('Error processing case', { caseNumber: sfCase.CaseNumber, error: String(caseErr) });
        errors++;
      }
    }

    // Update last_sync_at
    await supabaseAdmin
      .from('crm_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    const result = {
      success: true,
      total_fetched: cases.length,
      upserted,
      matched_to_debtors: matched,
      errors,
    };

    logStep('Sync complete', result);

    return new Response(JSON.stringify(result), {
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
