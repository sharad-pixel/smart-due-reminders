import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[admin-list-users] Request received');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[admin-list-users] No auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      console.log('[admin-list-users] Auth failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const user = userData.user;
    console.log('[admin-list-users] User:', user.id);

    // Check if user is a Recouply.ai admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      console.log('[admin-list-users] Not admin');
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get parameters from body (POST) or URL params (GET)
    let search = '';
    let limit = 50;
    let offset = 0;
    
    try {
      const body = await req.json();
      search = body.search || '';
      limit = parseInt(body.limit) || 50;
      offset = parseInt(body.offset) || 0;
      console.log('[admin-list-users] Body params:', { search, limit, offset });
    } catch (_e) {
      const url = new URL(req.url);
      search = url.searchParams.get('search') || '';
      limit = parseInt(url.searchParams.get('limit') || '50');
      offset = parseInt(url.searchParams.get('offset') || '0');
      console.log('[admin-list-users] URL params:', { search, limit, offset });
    }

    // Build query for profiles
    let query = supabaseClient
      .from('profiles')
      .select(`
        id,
        email,
        name,
        company_name,
        plan_type,
        plan_id,
        is_admin,
        is_suspended,
        suspended_at,
        suspended_reason,
        suspended_by,
        created_at,
        trial_ends_at,
        subscription_status,
        stripe_customer_id,
        stripe_subscription_id,
        quickbooks_realm_id,
        plans:plan_id (
          name,
          monthly_price,
          invoice_limit
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add search filter if provided
    if (search) {
      const sanitized = search.replace(/[,%.()]/g, '').substring(0, 100);
      if (sanitized) {
        query = query.or(`email.ilike.%${sanitized}%,name.ilike.%${sanitized}%,company_name.ilike.%${sanitized}%`);
      }
    }

    const { data: users, error, count } = await query;

    console.log('[admin-list-users] Query result:', { userCount: users?.length, total: count, error: error?.message });

    if (error) {
      throw error;
    }

    // Fetch blocked status for all users
    const userEmails = users?.map((u: any) => u.email?.toLowerCase()).filter(Boolean) || [];
    const { data: blockedUsers } = await supabaseClient
      .from('blocked_users')
      .select('email, blocked_at, reason')
      .in('email', userEmails);

    // Create a map for quick lookup
    const blockedMap = new Map(
      (blockedUsers || []).map((b: any) => [b.email, { blocked_at: b.blocked_at, reason: b.reason }])
    );

    // Fetch last_sign_in_at from auth.users for each user via admin API
    const userIds = users?.map((u: any) => u.id).filter(Boolean) || [];
    const authUserMap = new Map<string, { last_sign_in_at: string | null }>();
    
    // Batch fetch auth users - use listUsers with per_page to get all at once
    try {
      const { data: authListData } = await supabaseClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      
      if (authListData?.users) {
        for (const authUser of authListData.users) {
          if (userIds.includes(authUser.id)) {
            authUserMap.set(authUser.id, {
              last_sign_in_at: authUser.last_sign_in_at || null,
            });
          }
        }
      }
    } catch (authErr) {
      console.error('[admin-list-users] Error fetching auth users:', authErr);
    }

    // Batch fetch onboarding & usage data for all users in this page
    // 1. Invoice counts per user
    const { data: invoiceCounts } = await supabaseClient
      .rpc('admin_count_by_user', undefined)
      .select('*');

    // Since RPC may not exist, fall back to per-user counts via raw queries
    // We'll use a more efficient approach: fetch counts grouped by user_id
    const invoiceCountMap = new Map<string, number>();
    const debtorCountMap = new Map<string, number>();
    const workflowCountMap = new Map<string, number>();
    const brandingMap = new Map<string, { logo_url: string | null; business_name: string | null; stripe_payment_link: string | null; supported_payment_methods: any }>();

    // Fetch invoice counts for these users
    try {
      for (const uid of userIds) {
        // We'll batch these - but Supabase doesn't have GROUP BY easily
        // So fetch counts in parallel for efficiency
      }
      
      // Use Promise.all for parallel fetching
      const [invoiceResults, debtorResults, workflowResults, brandingResults] = await Promise.all([
        // Invoice counts
        Promise.all(userIds.map(async (uid: string) => {
          const { count } = await supabaseClient
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid);
          return { uid, count: count || 0 };
        })),
        // Debtor counts
        Promise.all(userIds.map(async (uid: string) => {
          const { count } = await supabaseClient
            .from('debtors')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid);
          return { uid, count: count || 0 };
        })),
        // Active workflow counts
        Promise.all(userIds.map(async (uid: string) => {
          const { count } = await supabaseClient
            .from('collection_workflows')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .eq('is_active', true);
          return { uid, count: count || 0 };
        })),
        // Branding settings
        supabaseClient
          .from('branding_settings')
          .select('user_id, logo_url, business_name, stripe_payment_link, supported_payment_methods')
          .in('user_id', userIds),
      ]);

      for (const r of invoiceResults) invoiceCountMap.set(r.uid, r.count);
      for (const r of debtorResults) debtorCountMap.set(r.uid, r.count);
      for (const r of workflowResults) workflowCountMap.set(r.uid, r.count);
      
      for (const b of (brandingResults.data || [])) {
        brandingMap.set(b.user_id, {
          logo_url: b.logo_url,
          business_name: b.business_name,
          stripe_payment_link: b.stripe_payment_link,
          supported_payment_methods: b.supported_payment_methods,
        });
      }
    } catch (statsErr) {
      console.error('[admin-list-users] Error fetching usage stats:', statsErr);
    }

    // Merge all data into users
    const usersWithBlockStatus = users?.map((user: any) => {
      const branding = brandingMap.get(user.id);
      const hasLogo = !!branding?.logo_url;
      const hasBranding = !!branding?.business_name;
      const hasPaymentLink = !!branding?.stripe_payment_link;
      const pm = branding?.supported_payment_methods;
      const hasPaymentMethods = Array.isArray(pm) ? pm.length > 0 : (!!pm && typeof pm === 'object' && Object.keys(pm).length > 0);
      const hasAccounts = (debtorCountMap.get(user.id) || 0) > 0;
      const hasInvoices = (invoiceCountMap.get(user.id) || 0) > 0;
      const hasWorkflows = (workflowCountMap.get(user.id) || 0) > 0;
      const hasQB = !!user.quickbooks_realm_id;

      // Calculate onboarding steps (matches useOnboardingCompletion logic)
      const steps = [
        hasBranding,         // Business name configured
        hasLogo,             // Logo uploaded
        hasPaymentLink || hasPaymentMethods, // Payment instructions
        hasAccounts,         // At least one account
        hasInvoices,         // At least one invoice
        hasWorkflows,        // Active workflow
      ];
      const completedSteps = steps.filter(Boolean).length;
      const totalSteps = steps.length;
      const onboardingPct = Math.round((completedSteps / totalSteps) * 100);

      return {
        ...user,
        is_blocked: blockedMap.has(user.email?.toLowerCase()),
        blocked_at: blockedMap.get(user.email?.toLowerCase())?.blocked_at || null,
        blocked_reason: blockedMap.get(user.email?.toLowerCase())?.reason || null,
        last_login: authUserMap.get(user.id)?.last_sign_in_at || null,
        // Usage stats
        invoice_count: invoiceCountMap.get(user.id) || 0,
        debtor_count: debtorCountMap.get(user.id) || 0,
        // Onboarding
        onboarding_pct: onboardingPct,
        onboarding_completed: completedSteps,
        onboarding_total: totalSteps,
      };
    });

    console.log('[admin-list-users] Returning', usersWithBlockStatus?.length, 'users');

    return new Response(
      JSON.stringify({
        users: usersWithBlockStatus,
        total: count,
        limit,
        offset,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[admin-list-users] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
