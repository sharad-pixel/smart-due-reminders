import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-HUBSPOT] ${step}${detailsStr}`);
};

async function refreshHubSpotToken(supabaseAdmin: any, connection: any): Promise<string> {
  const clientId = Deno.env.get('HUBSPOT_CLIENT_ID')!;
  const clientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET')!;

  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
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
    throw new Error(`HubSpot token refresh failed: ${data.message || res.status}`);
  }

  await supabaseAdmin
    .from('crm_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || connection.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return data.access_token;
}

function mapEmployeeCount(count: string | number | null): string {
  if (!count) return '';
  const n = typeof count === 'string' ? parseInt(count, 10) : count;
  if (isNaN(n)) return '';
  if (n <= 10) return '1-10';
  if (n <= 50) return '11-50';
  if (n <= 200) return '51-200';
  if (n <= 1000) return '201-1000';
  return '1001+';
}

function mapAnnualRevenue(revenue: string | number | null): string {
  if (!revenue) return '';
  const n = typeof revenue === 'string' ? parseFloat(revenue) : revenue;
  if (isNaN(n)) return '';
  if (n < 100000) return '<100K';
  if (n < 500000) return '100K-500K';
  if (n < 1000000) return '500K-1M';
  if (n < 10000000) return '1M-10M';
  if (n < 50000000) return '10M-50M';
  return '50M+';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Determine user
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

    // Get HubSpot connection
    const { data: connection, error: connErr } = await supabaseAdmin
      .from('crm_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('crm_type', 'hubspot')
      .maybeSingle();

    if (connErr || !connection) {
      return new Response(JSON.stringify({ error: 'HubSpot not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let accessToken = connection.access_token;

    // Fetch companies from HubSpot
    const properties = [
      'name', 'domain', 'industry', 'numberofemployees', 'annualrevenue',
      'type', 'description', 'phone', 'city', 'state', 'country',
      'hubspot_owner_id', 'createdate', 'hs_lead_status', 'lifecyclestage',
    ].join(',');

    let hsRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies?limit=500&properties=${properties}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (hsRes.status === 401) {
      logStep('Token expired, refreshing');
      accessToken = await refreshHubSpotToken(supabaseAdmin, connection);
      hsRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/companies?limit=500&properties=${properties}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    }

    if (!hsRes.ok) {
      const errText = await hsRes.text();
      logStep('HubSpot API error', { status: hsRes.status, body: errText.substring(0, 300) });
      throw new Error(`HubSpot API error: ${hsRes.status}`);
    }

    const hsData = await hsRes.json();
    const companies = hsData.results || [];
    logStep('Fetched companies', { count: companies.length });

    let synced = 0;
    let enriched = 0;
    let matched = 0;

    // Get user's org id
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle();
    const orgId = orgData?.id;

    for (const company of companies) {
      try {
        const props = company.properties || {};
        const companyName = props.name || 'Unknown';
        const annualRevenue = props.annualrevenue ? parseFloat(props.annualrevenue) : null;
        const employeeCount = props.numberofemployees ? parseInt(props.numberofemployees, 10) : null;

        // Upsert into crm_accounts
        const crmPayload: Record<string, any> = {
          user_id: userId,
          crm_account_id: company.id,
          crm_type: 'hubspot',
          name: companyName,
          industry: props.industry,
          status: props.lifecyclestage || props.hs_lead_status,
          owner_name: null, // Would need additional owner lookup
          customer_since: props.createdate,
          segment: props.lifecyclestage,
          raw_json: company,
          updated_at: new Date().toISOString(),
        };

        if (annualRevenue) {
          crmPayload.mrr = Math.round(annualRevenue / 12);
          crmPayload.lifetime_value = annualRevenue;
        }

        const { data: existing } = await supabaseAdmin
          .from('crm_accounts')
          .select('id')
          .eq('crm_account_id', company.id)
          .eq('user_id', userId)
          .maybeSingle();

        let crmAccountId: string;
        if (existing) {
          await supabaseAdmin.from('crm_accounts').update(crmPayload).eq('id', existing.id);
          crmAccountId = existing.id;
        } else {
          const { data: inserted } = await supabaseAdmin.from('crm_accounts').insert(crmPayload).select('id').single();
          crmAccountId = inserted?.id;
        }
        synced++;

        // Match to debtor by company name
        const { data: debtor } = await supabaseAdmin
          .from('debtors')
          .select('id, crm_account_id')
          .eq('user_id', userId)
          .or(`company_name.ilike.%${companyName}%,name.ilike.%${companyName}%`)
          .limit(1)
          .maybeSingle();

        if (debtor) {
          matched++;

          // Link debtor to CRM account
          if (!debtor.crm_account_id && crmAccountId) {
            await supabaseAdmin
              .from('debtors')
              .update({ crm_account_id: crmAccountId })
              .eq('id', debtor.id);
          }

          // Auto-enrich debtor_ai_context (fill-only-if-empty)
          const { data: existingCtx } = await supabaseAdmin
            .from('debtor_ai_context')
            .select('*')
            .eq('debtor_id', debtor.id)
            .maybeSingle();

          const enrichUpdates: Record<string, string> = {};

          if (!existingCtx?.industry && props.industry) {
            enrichUpdates.industry = props.industry;
          }
          if (!existingCtx?.employee_count && employeeCount) {
            enrichUpdates.employee_count = mapEmployeeCount(employeeCount);
          }
          if (!existingCtx?.annual_revenue && annualRevenue) {
            enrichUpdates.annual_revenue = mapAnnualRevenue(annualRevenue);
          }

          // Build relationship notes
          const relParts: string[] = [];
          if (props.type) relParts.push(`Type: ${props.type}`);
          if (props.lifecyclestage) relParts.push(`Lifecycle: ${props.lifecyclestage}`);
          if (props.hs_lead_status) relParts.push(`Lead Status: ${props.hs_lead_status}`);
          if (props.createdate) relParts.push(`HS Created: ${new Date(props.createdate).toLocaleDateString()}`);
          if (!existingCtx?.business_relationship && relParts.length > 0) {
            enrichUpdates.business_relationship = `[From HubSpot] ${relParts.join('. ')}`;
          }

          // Financial health
          if (!existingCtx?.financial_health_notes && annualRevenue) {
            enrichUpdates.financial_health_notes = `[From HubSpot] Annual Revenue: $${annualRevenue.toLocaleString()}`;
          }

          if (Object.keys(enrichUpdates).length > 0) {
            if (existingCtx) {
              await supabaseAdmin
                .from('debtor_ai_context')
                .update({ ...enrichUpdates, updated_at: new Date().toISOString() })
                .eq('debtor_id', debtor.id);
            } else {
              await supabaseAdmin
                .from('debtor_ai_context')
                .insert({
                  debtor_id: debtor.id,
                  user_id: userId,
                  organization_id: orgId,
                  ...enrichUpdates,
                });
            }
            enriched++;
          }
        }
      } catch (companyErr) {
        logStep('Error processing company', { id: company.id, error: String(companyErr) });
      }
    }

    // Update last_sync_at
    await supabaseAdmin
      .from('crm_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    const result = {
      success: true,
      total_fetched: companies.length,
      synced,
      matched_to_debtors: matched,
      intelligence_enriched: enriched,
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
