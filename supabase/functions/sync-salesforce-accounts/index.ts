import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-SF-ACCOUNTS] ${step}${detailsStr}`);
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

  await supabaseAdmin
    .from('crm_connections')
    .update({ access_token: data.access_token, updated_at: new Date().toISOString() })
    .eq('id', connection.id);

  return data.access_token;
}

function mapEmployeeCount(count: number | null): string {
  if (!count) return '';
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 1000) return '201-1000';
  return '1001+';
}

function mapAnnualRevenue(revenue: number | null): string {
  if (!revenue) return '';
  if (revenue < 100000) return '<100K';
  if (revenue < 500000) return '100K-500K';
  if (revenue < 1000000) return '500K-1M';
  if (revenue < 10000000) return '1M-10M';
  if (revenue < 50000000) return '10M-50M';
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

    // Get Salesforce connection
    const { data: connection, error: connErr } = await supabaseAdmin
      .from('crm_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('crm_type', 'salesforce')
      .maybeSingle();

    if (connErr || !connection) {
      return new Response(JSON.stringify({ error: 'Salesforce not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let accessToken = connection.access_token;
    const instanceUrl = connection.instance_url;

    // Query Salesforce Accounts
    const soqlQuery = encodeURIComponent(
      `SELECT Id, Name, AccountNumber, Industry, NumberOfEmployees, AnnualRevenue,
              Type, Rating, Description, Website, Phone, BillingCity, BillingState,
              Owner.Name, CreatedDate
       FROM Account
       WHERE IsDeleted = false
       ORDER BY CreatedDate DESC
       LIMIT 500`
    );

    let sfRes = await fetch(`${instanceUrl}/services/data/v59.0/query?q=${soqlQuery}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

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
    const accounts = sfData.records || [];
    logStep('Fetched accounts', { count: accounts.length });

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

    for (const acct of accounts) {
      try {
        // Upsert into crm_accounts
        const crmPayload = {
          user_id: userId,
          crm_account_id: acct.Id,
          crm_type: 'salesforce',
          name: acct.Name || 'Unknown',
          account_number: acct.AccountNumber,
          industry: acct.Industry,
          status: acct.Type || acct.Rating,
          owner_name: acct.Owner?.Name,
          customer_since: acct.CreatedDate,
          segment: acct.Rating,
          raw_json: acct,
          updated_at: new Date().toISOString(),
        };

        // Map AnnualRevenue to MRR estimate (divide by 12)
        if (acct.AnnualRevenue) {
          (crmPayload as any).mrr = Math.round(acct.AnnualRevenue / 12);
          (crmPayload as any).lifetime_value = acct.AnnualRevenue;
        }

        const { data: existing } = await supabaseAdmin
          .from('crm_accounts')
          .select('id')
          .eq('crm_account_id', acct.Id)
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

        // Try to match to a debtor by name
        const { data: debtor } = await supabaseAdmin
          .from('debtors')
          .select('id, crm_account_id')
          .eq('user_id', userId)
          .or(`company_name.ilike.%${acct.Name}%,name.ilike.%${acct.Name}%`)
          .limit(1)
          .maybeSingle();

        if (debtor) {
          matched++;

          // Link debtor to CRM account if not already linked
          if (!debtor.crm_account_id && crmAccountId) {
            await supabaseAdmin
              .from('debtors')
              .update({ crm_account_id: crmAccountId })
              .eq('id', debtor.id);
          }

          // Auto-enrich debtor_ai_context (fill-only-if-empty strategy)
          const { data: existingCtx } = await supabaseAdmin
            .from('debtor_ai_context')
            .select('*')
            .eq('debtor_id', debtor.id)
            .maybeSingle();

          const enrichUpdates: Record<string, string> = {};

          if (!existingCtx?.industry && acct.Industry) {
            enrichUpdates.industry = acct.Industry;
          }
          if (!existingCtx?.decision_maker && acct.Owner?.Name) {
            enrichUpdates.decision_maker = acct.Owner.Name;
          }
          if (!existingCtx?.employee_count && acct.NumberOfEmployees) {
            enrichUpdates.employee_count = mapEmployeeCount(acct.NumberOfEmployees);
          }
          if (!existingCtx?.annual_revenue && acct.AnnualRevenue) {
            enrichUpdates.annual_revenue = mapAnnualRevenue(acct.AnnualRevenue);
          }

          // Build relationship notes
          const relParts: string[] = [];
          if (acct.Type) relParts.push(`Type: ${acct.Type}`);
          if (acct.Rating) relParts.push(`Rating: ${acct.Rating}`);
          if (acct.CreatedDate) relParts.push(`SF Account Created: ${new Date(acct.CreatedDate).toLocaleDateString()}`);
          if (!existingCtx?.business_relationship && relParts.length > 0) {
            enrichUpdates.business_relationship = `[From Salesforce] ${relParts.join('. ')}`;
          }

          // Financial health from revenue
          if (!existingCtx?.financial_health_notes && acct.AnnualRevenue) {
            enrichUpdates.financial_health_notes = `[From Salesforce] Annual Revenue: $${acct.AnnualRevenue.toLocaleString()}`;
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
      } catch (acctErr) {
        logStep('Error processing account', { name: acct.Name, error: String(acctErr) });
      }
    }

    // Update last_sync_at
    await supabaseAdmin
      .from('crm_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    const result = {
      success: true,
      total_fetched: accounts.length,
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
