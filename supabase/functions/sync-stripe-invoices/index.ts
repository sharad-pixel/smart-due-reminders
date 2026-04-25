import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit, rateLimitExceededResponse } from '../_shared/rateLimiting.ts';

type StripeInvoice = any;
type StripeCustomer = any;
type StripePaymentIntent = any;
type StripeRefund = any;
type StripeCreditNote = any;

type StripeListResponse<T> = { data: T[] };

const STRIPE_API_BASE = "https://api.stripe.com";

// Stripe API timeout - 15 seconds per request
const STRIPE_TIMEOUT_MS = 15000;

// Batch size for processing invoices to prevent memory issues
const INVOICE_BATCH_SIZE = 25;

const buildStripeUrl = (path: string, params: Array<[string, string]> = []) => {
  const url = new URL(`${STRIPE_API_BASE}${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  return url;
};

async function stripeGetJson<T = any>(stripeKey: string, path: string, params: Array<[string, string]> = []): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);
  
  try {
    const res = await fetch(buildStripeUrl(path, params), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Stripe API error (${res.status}) GET ${path}: ${text || res.statusText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE-INVOICES] ${step}${detailsStr}`);
};

// Decrypt a value using AES-GCM
async function decryptValue(encryptedValue: string): Promise<string> {
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const encryptedData = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));
  const iv = encryptedData.slice(0, 12);
  const data = encryptedData.slice(12);

  const keyMaterial = encoder.encode(encryptionKey);
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial.slice(0, 32),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return decoder.decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    
    // Support scheduled sync: if called with service role key and x-scheduled-sync-user-id header,
    // use that user ID directly instead of authenticating via token
    const scheduledUserId = req.headers.get("x-scheduled-sync-user-id");
    let userId: string;
    
    if (scheduledUserId && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      // Scheduled sync via service role - trust the provided user ID
      userId = scheduledUserId;
      logStep("Scheduled sync authenticated", { userId });
    } else {
      // Normal user-initiated sync
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError) throw new Error(`Authentication error: ${userError.message}`);
      const user = userData.user;
      if (!user?.id) throw new Error("User not authenticated");
      userId = user.id;
      logStep("User authenticated", { userId });
    }

    // Rate limiting - sync is a heavy operation, limit to 10 per hour
    // Skip rate limiting for scheduled syncs
    if (!scheduledUserId) {
      const rateLimitResult = await checkRateLimit(userId, 'data_import');
      if (!rateLimitResult.allowed) {
        logStep("Rate limit exceeded", { userId });
        return rateLimitExceededResponse(rateLimitResult, corsHeaders);
      }
    }

    // Get the effective account ID for team support
    const { data: effectiveAccountData } = await supabaseClient.rpc('get_effective_account_id', { p_user_id: userId });
    const effectiveAccountId = effectiveAccountData || userId;
    logStep("Effective account ID", { effectiveAccountId });

    // Get the user's Stripe credentials
    const { data: integration, error: integrationError } = await supabaseClient
      .from('stripe_integrations')
      .select('stripe_secret_key_encrypted')
      .eq('user_id', effectiveAccountId)
      .maybeSingle();

    if (integrationError) {
      throw new Error(`Failed to fetch Stripe integration: ${integrationError.message}`);
    }

    let stripeKey: string;
    
    if (integration?.stripe_secret_key_encrypted) {
      // Use user's own Stripe key
      stripeKey = await decryptValue(integration.stripe_secret_key_encrypted);
      logStep("Using user-provided Stripe key");
    } else {
      throw new Error("No Stripe API key configured. Please add your Stripe secret key in Settings.");
    }

    // Update sync status to 'syncing'
    await supabaseClient
      .from('stripe_integrations')
      .upsert({
        user_id: effectiveAccountId,
        is_connected: true,
        sync_status: 'syncing',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    // Create sync log entry
    let syncLogId: string | null = null;
    try {
      const { data: insertedLog } = await supabaseClient.from('stripe_sync_log').insert({
        user_id: effectiveAccountId,
        sync_type: 'full',
        status: 'running',
        errors: []
      }).select('id').single();
      syncLogId = insertedLog?.id || null;
      logStep('STRIPE_SYNC_LOG_CREATED', { syncLogId });
    } catch (e) {
      logStep('STRIPE_SYNCLOG_INSERT_FAILED', { error: String(e) });
    }

    // Fetch invoices from Stripe - all statuses for complete sync
    // Use a Map to deduplicate invoices by ID (in case same invoice appears in multiple lists)
    const invoiceMap = new Map<string, StripeInvoice>();

    const listInvoices = async (status: string) => {
      const resp = await stripeGetJson<StripeListResponse<StripeInvoice>>(stripeKey, "/v1/invoices", [
        ["status", status],
        ["limit", "100"],
        ["expand[]", "data.customer"],
        // PERF: expand payment_intent + discounts inline so we don't need a per-invoice GET later
        ["expand[]", "data.payment_intent"],
        ["expand[]", "data.discounts"],
      ]);
      return resp.data || [];
    };

    // PERF: fetch all 4 status lists in parallel instead of sequentially
    const [openInvoices, paidInvoices, voidInvoices, uncollectibleInvoices] = await Promise.all([
      listInvoices("open"),
      listInvoices("paid"),
      listInvoices("void"),
      listInvoices("uncollectible"),
    ]);

    for (const inv of openInvoices) invoiceMap.set(inv.id, inv);
    logStep("Fetched open invoices", { count: openInvoices.length });

    // Paid takes priority - overwrites any prior entry
    for (const inv of paidInvoices) invoiceMap.set(inv.id, inv);
    logStep("Fetched paid invoices", { count: paidInvoices.length });

    // Void: only add if not already paid
    for (const inv of voidInvoices) {
      const existing = invoiceMap.get(inv.id);
      if (!existing || existing.status !== "paid") invoiceMap.set(inv.id, inv);
    }
    logStep("Fetched void invoices", { count: voidInvoices.length });

    // Uncollectible: only add if not already paid/void
    for (const inv of uncollectibleInvoices) {
      const existing = invoiceMap.get(inv.id);
      if (!existing || (existing.status !== "paid" && existing.status !== "void")) {
        invoiceMap.set(inv.id, inv);
      }
    }
    logStep("Fetched uncollectible invoices", { count: uncollectibleInvoices.length });

    // Convert map to array for processing
    const invoices = Array.from(invoiceMap.values());
    logStep("Total unique invoices to process", { count: invoices.length });
    
    // ============================================================
    // ONE-DIRECTIONAL SYNC: Stripe → Recouply (READ-ONLY)
    // Recouply NEVER writes back to Stripe
    // ============================================================
    
    let syncedCount = 0;
    let createdDebtors = 0;
    let transactionsLogged = 0;
    let newInvoicesCreated = 0;
    let conflictsDetected = 0;
    let conflictsResolved = 0;
    let overridesReset = 0;
    let terminalSkipped = 0;
    let paidWithoutPayment = 0;
    let statusUpdates = { paid: 0, partial: 0, canceled: 0, voided: 0, open: 0, terminal: 0 };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Normalized status mapping for collection logic
    interface NormalizedInvoice {
      status: 'Open' | 'Paid' | 'PartiallyPaid' | 'Canceled' | 'Voided';
      normalizedStatus: 'open' | 'paid' | 'partially_paid' | 'terminal';
      isCollectible: boolean;
      terminalReason: string | null;
      paymentOrigin: string | null;
    }

    // Defensive: ensure we only ever write valid enum values to invoices.status.
    // (We’ve seen older logs where lowercase values like "paid" slipped through.)
    type InvoiceStatusEnum =
      | 'Open'
      | 'Paid'
      | 'Disputed'
      | 'Settled'
      | 'InPaymentPlan'
      | 'Canceled'
      | 'FinalInternalCollections'
      | 'PartiallyPaid'
      | 'Voided';

    const INVOICE_STATUS_CANONICAL: Record<string, InvoiceStatusEnum> = {
      open: 'Open',
      paid: 'Paid',
      disputed: 'Disputed',
      settled: 'Settled',
      inpaymentplan: 'InPaymentPlan',
      canceled: 'Canceled',
      cancelled: 'Canceled',
      voided: 'Voided',
      void: 'Voided',
      partiallypaid: 'PartiallyPaid',
      partially_paid: 'PartiallyPaid',
      finalinternalcollections: 'FinalInternalCollections',
    };

    const canonicalizeInvoiceStatus = (value: unknown): InvoiceStatusEnum => {
      const raw = String(value ?? 'Open');
      const key = raw.replace(/[^a-z_]/gi, '').toLowerCase();
      return INVOICE_STATUS_CANONICAL[key] ?? 'Open';
    };

    // Helper function to map Stripe status with normalized fields
    // Recouply treats void/uncollectible as TERMINAL - not sync failures
    const mapStripeStatus = (stripeInvoice: StripeInvoice): NormalizedInvoice => {
      const amountPaid = stripeInvoice.amount_paid || 0;
      const amountDue = stripeInvoice.amount_due || 0;
      const amountRemaining = stripeInvoice.amount_remaining || 0;
      const hasPaymentIntent = !!stripeInvoice.payment_intent;

      switch (stripeInvoice.status) {
        case 'paid':
          // Handle paid invoices - may or may not have PaymentIntent
          // Stripe invoices can be paid via credits, manual payments, or external methods
          const paymentOrigin = hasPaymentIntent ? 'stripe_payment' : 'external_settlement';
          if (!hasPaymentIntent) {
            paidWithoutPayment++;
            warnings.push(`Invoice ${stripeInvoice.id} paid without Stripe payment object (external/manual settlement)`);
          }
          
          if (amountPaid > 0 && amountPaid < amountDue && amountRemaining === 0) {
            return {
              status: 'PartiallyPaid',
              normalizedStatus: 'partially_paid',
              isCollectible: false,
              terminalReason: null,
              paymentOrigin
            };
          }
          return {
            status: 'Paid',
            normalizedStatus: 'paid',
            isCollectible: false,
            terminalReason: null,
            paymentOrigin
          };
          
        case 'void':
          // Voided invoices are TERMINAL - not a sync error
          terminalSkipped++;
          return {
            status: 'Voided',
            normalizedStatus: 'terminal',
            isCollectible: false,
            terminalReason: 'voided_in_stripe',
            paymentOrigin: 'voided'
          };
          
        case 'uncollectible':
          // Uncollectible invoices are TERMINAL - written off
          terminalSkipped++;
          return {
            status: 'Canceled',
            normalizedStatus: 'terminal',
            isCollectible: false,
            terminalReason: 'written_off_in_stripe',
            paymentOrigin: 'written_off'
          };
          
        case 'open':
        default:
          if (amountPaid > 0 && amountRemaining > 0) {
            return {
              status: 'PartiallyPaid',
              normalizedStatus: 'partially_paid',
              isCollectible: true,
              terminalReason: null,
              paymentOrigin: null
            };
          }
          return {
            status: 'Open',
            normalizedStatus: 'open',
            isCollectible: true,
            terminalReason: null,
            paymentOrigin: null
          };
      }
    };

    // ============================================================
    // PERF: Batch upfront lookups to eliminate N+1 query patterns
    // ============================================================
    const customerIds = new Set<string>();
    const stripeInvoiceIds = new Set<string>();
    const invoiceNumbers = new Set<string>();
    for (const inv of invoices) {
      const cust = typeof inv.customer === 'string' ? null : inv.customer;
      if (cust?.id) customerIds.add(cust.id);
      if (inv.id) stripeInvoiceIds.add(inv.id);
      const num = inv.number || inv.id;
      if (num) invoiceNumbers.add(num);
    }

    // Build legacy + scoped reference IDs in one pass for IN-list lookup
    const allReferenceIds: string[] = [];
    for (const cid of customerIds) {
      allReferenceIds.push(`STRIPE-${cid.slice(-8).toUpperCase()}`);
      allReferenceIds.push(`STRIPE-${effectiveAccountId.slice(0, 8).toUpperCase()}-${cid}`);
    }

    // Bulk fetch existing debtors (by external_customer_id OR reference_id)
    const debtorByCustomerId = new Map<string, string>(); // customer_id -> debtor.id
    const debtorByReferenceId = new Map<string, string>();
    if (customerIds.size > 0) {
      const { data: debtorRows } = await supabaseClient
        .from('debtors')
        .select('id, external_customer_id, reference_id')
        .eq('user_id', effectiveAccountId)
        .or(
          `external_customer_id.in.(${Array.from(customerIds).join(',')}),reference_id.in.(${allReferenceIds.map(r => `"${r}"`).join(',')})`
        );
      for (const d of debtorRows || []) {
        if (d.external_customer_id) debtorByCustomerId.set(d.external_customer_id, d.id);
        if (d.reference_id) debtorByReferenceId.set(d.reference_id, d.id);
      }
      logStep("Bulk debtor lookup complete", { found: debtorRows?.length || 0 });
    }

    // Bulk fetch existing invoices (by stripe_invoice_id, invoice_number, external_invoice_id)
    type ExistingInvRow = {
      id: string;
      status: string;
      amount?: number;
      due_date?: string;
      has_local_overrides?: boolean;
      override_count?: number;
      stripe_invoice_id?: string;
      invoice_number?: string;
      external_invoice_id?: string;
    };
    const invoiceByStripeId = new Map<string, ExistingInvRow>();
    const invoiceByNumber = new Map<string, ExistingInvRow>();
    const invoiceByExternalId = new Map<string, ExistingInvRow>();
    if (stripeInvoiceIds.size > 0) {
      const idList = Array.from(stripeInvoiceIds);
      const numList = Array.from(invoiceNumbers);
      const { data: invRows } = await supabaseClient
        .from('invoices')
        .select('id, status, amount, due_date, has_local_overrides, override_count, stripe_invoice_id, invoice_number, external_invoice_id')
        .eq('user_id', effectiveAccountId)
        .or(
          `stripe_invoice_id.in.(${idList.join(',')}),external_invoice_id.in.(${idList.join(',')}),invoice_number.in.(${numList.map(n => `"${n}"`).join(',')})`
        );
      for (const r of (invRows || []) as ExistingInvRow[]) {
        if (r.stripe_invoice_id) invoiceByStripeId.set(r.stripe_invoice_id, r);
        if (r.invoice_number) invoiceByNumber.set(r.invoice_number, r);
        if (r.external_invoice_id) invoiceByExternalId.set(r.external_invoice_id, r);
      }
      logStep("Bulk invoice lookup complete", { found: invRows?.length || 0 });
    }

    // PERF: Process invoices in parallel chunks instead of strictly sequentially.
    // Each chunk runs concurrently; chunks run sequentially to bound DB connections.
    const PARALLEL_CHUNK_SIZE = 10;
    const processInvoice = async (stripeInvoice: StripeInvoice) => {
      try {
        if (!stripeInvoice.customer) return;

        const customer = typeof stripeInvoice.customer === 'string'
          ? null
          : (stripeInvoice.customer as StripeCustomer);

        if (!customer) return;

        const customerEmail = customer.email || `${customer.id}@stripe-customer.local`;
        const customerName = customer.name || customer.id;

        // Check if debtor exists ONLY by Stripe customer ID or reference_id - NEVER by email
        // This prevents cross-account matching when different customers share an email
        // NOTE: reference_id is globally unique in our DB, so we prefix it to avoid collisions across users.
        const legacyReferenceId = `STRIPE-${customer.id.slice(-8).toUpperCase()}`;
        const referenceId = `STRIPE-${effectiveAccountId.slice(0, 8).toUpperCase()}-${customer.id}`;

        // PERF: use prefetched debtor map (was N+1 lookup)
        let prefetchedDebtorId: string | undefined =
          debtorByCustomerId.get(customer.id) ||
          debtorByReferenceId.get(referenceId) ||
          debtorByReferenceId.get(legacyReferenceId);

        let debtorId: string;

        if (!prefetchedDebtorId) {
          const { data: newDebtor, error: debtorError } = await supabaseClient
            .from('debtors')
            .insert({
              user_id: effectiveAccountId,
              company_name: customerName,
              name: customerName,
              email: customerEmail,
              phone: customer.phone || null,
              external_customer_id: customer.id,
              external_system: 'stripe',
              reference_id: referenceId
            })
            .select('id')
            .single();

          if (debtorError) {
            // Treat duplicate reference_id as a warning and skip this invoice (we don't want sync to hard-fail).
            logStep('Error creating debtor', { error: debtorError.message, customerId: customer.id });
            warnings.push(`Debtor already exists or could not be created for ${customerEmail}: ${debtorError.message}`);
            return;
          }
          debtorId = newDebtor.id;
          // Cache so other invoices in this run reuse it
          debtorByCustomerId.set(customer.id, debtorId);
          debtorByReferenceId.set(referenceId, debtorId);

          // Create a proper contact entry for outreach
          const { error: contactError } = await supabaseClient
            .from('debtor_contacts')
            .insert({
              debtor_id: debtorId,
              user_id: effectiveAccountId,
              name: customerName,
              email: customerEmail,
              phone: customer.phone || null,
              is_primary: true,
              outreach_enabled: true
            });

          if (contactError) {
            logStep('Error creating contact', { error: contactError.message, debtorId });
          }

          createdDebtors++;
          logStep('Created new debtor with contact', { debtorId, customerEmail });
        } else {
          debtorId = prefetchedDebtorId;
          
          // Only update primary contact email if different in Stripe
          if (customerEmail) {
            const { data: existingContact } = await supabaseClient
              .from('debtor_contacts')
              .select('email')
              .eq('debtor_id', debtorId)
              .eq('is_primary', true)
              .limit(1)
              .maybeSingle();
            
            if (existingContact && existingContact.email !== customerEmail) {
              const { error: updateContactError } = await supabaseClient
                .from('debtor_contacts')
                .update({ 
                  email: customerEmail,
                  updated_at: new Date().toISOString()
                })
                .eq('debtor_id', debtorId)
                .eq('is_primary', true);
              
              if (updateContactError) {
                logStep('Error updating contact email', { error: updateContactError.message, debtorId });
              } else {
                logStep('Updated primary contact email from Stripe', { debtorId, oldEmail: existingContact.email, newEmail: customerEmail });
              }
            }
          }
        }

        const normalizedInvoice = mapStripeStatus(stripeInvoice);
        
        // Track status breakdown
        if (normalizedInvoice.status === 'Paid') statusUpdates.paid++;
        else if (normalizedInvoice.status === 'PartiallyPaid') statusUpdates.partial++;
        else if (normalizedInvoice.status === 'Canceled') statusUpdates.canceled++;
        else if (normalizedInvoice.status === 'Voided') statusUpdates.voided++;
        else statusUpdates.open++;
        
        if (normalizedInvoice.normalizedStatus === 'terminal') statusUpdates.terminal++;

        let paymentDate: string | null = null;
        let paidDate: string | null = null;
        if (stripeInvoice.status === 'paid' && stripeInvoice.status_transitions?.paid_at) {
          const paidAt = new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString().split('T')[0];
          paymentDate = paidAt;
          paidDate = paidAt;
        }

        // PERF: use prefetched invoice maps (was up to 3 sequential queries)
        const invoiceNumber = stripeInvoice.number || stripeInvoice.id;
        let existingInvoice: ExistingInvRow | null =
          invoiceByStripeId.get(stripeInvoice.id) ||
          invoiceByNumber.get(invoiceNumber) ||
          invoiceByExternalId.get(stripeInvoice.id) ||
          null;

        const stripeAmount = (stripeInvoice.amount_due || 0) / 100;
        const stripeDueDate = stripeInvoice.due_date 
          ? new Date(stripeInvoice.due_date * 1000).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0];
        const stripeIntegrationUrl = `https://dashboard.stripe.com/invoices/${stripeInvoice.id}`;

        const invoiceData: Record<string, any> = {
          user_id: effectiveAccountId,
          debtor_id: debtorId,
          sync_log_id: syncLogId,
          invoice_number: stripeInvoice.number || stripeInvoice.id,
          amount: stripeAmount,
          amount_outstanding: (stripeInvoice.amount_remaining || 0) / 100,
          amount_original: (stripeInvoice.total || 0) / 100,
          currency: stripeInvoice.currency?.toUpperCase() || 'USD',
          issue_date: stripeInvoice.created ? new Date(stripeInvoice.created * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          due_date: stripeDueDate,
          status: canonicalizeInvoiceStatus(normalizedInvoice.status),
          // Normalized fields for collection logic
          normalized_status: normalizedInvoice.normalizedStatus,
          is_collectible: normalizedInvoice.isCollectible,
          terminal_reason: normalizedInvoice.terminalReason,
          payment_origin: normalizedInvoice.paymentOrigin,
          // Source system tracking (READ-ONLY from Stripe)
          source_system: 'stripe',
          stripe_invoice_id: stripeInvoice.id,
          stripe_customer_id: customer.id,
          stripe_hosted_url: stripeInvoice.hosted_invoice_url || null,
          external_invoice_id: stripeInvoice.id,
          external_link: stripeInvoice.hosted_invoice_url || null,
          product_description: stripeInvoice.description || stripeInvoice.lines?.data?.[0]?.description || 'Stripe Invoice',
          reference_id: stripeInvoice.number || stripeInvoice.id,
          // Source-of-truth integration fields
          integration_source: 'stripe',
          integration_id: stripeInvoice.id,
          integration_url: stripeIntegrationUrl,
          original_amount: stripeAmount,
          original_due_date: stripeDueDate,
          last_synced_at: new Date().toISOString()
        };

        if (paymentDate) {
          invoiceData.payment_date = paymentDate;
          invoiceData.paid_date = paidDate;
        }

        // Add notes based on status - informational, not errors
        if (stripeInvoice.status === 'void') {
          invoiceData.notes = `[TERMINAL] Voided in Stripe - excluded from collections`;
        } else if (stripeInvoice.status === 'uncollectible') {
          invoiceData.notes = `[TERMINAL] Written off in Stripe - excluded from collections`;
        } else if (normalizedInvoice.status === 'PartiallyPaid') {
          const amountPaid = (stripeInvoice.amount_paid || 0) / 100;
          invoiceData.notes = `Partially paid - $${amountPaid.toFixed(2)} received via Stripe`;
        } else if (normalizedInvoice.status === 'Paid') {
          const settlementType = normalizedInvoice.paymentOrigin === 'external_settlement' 
            ? ' (external/manual settlement)' 
            : '';
          invoiceData.notes = `Paid in full${settlementType}${paidDate ? ` on ${paidDate}` : ''}`;
        }

        let invoiceRecordId: string;
        let isNewInvoice = false;
        
        if (existingInvoice) {
          // Check for local overrides that need to be resolved
          if (existingInvoice.has_local_overrides) {
            const conflicts: Record<string, { recouply_value: any; stripe_value: any }> = {};
            
            // Compare amount
            if (existingInvoice.amount !== undefined && existingInvoice.amount !== stripeAmount) {
              conflicts.amount = {
                recouply_value: existingInvoice.amount,
                stripe_value: stripeAmount
              };
            }
            
            // Compare due_date
            if (existingInvoice.due_date && existingInvoice.due_date !== stripeDueDate) {
              conflicts.due_date = {
                recouply_value: existingInvoice.due_date,
                stripe_value: stripeDueDate
              };
            }
            
            // Log conflicts if any
            if (Object.keys(conflicts).length > 0) {
              conflictsDetected++;
              
              // Insert sync conflict record
              await supabaseClient
                .from('invoice_sync_conflicts')
                .insert({
                  invoice_id: existingInvoice.id,
                  user_id: effectiveAccountId,
                  integration_source: 'stripe',
                  conflicts,
                  resolved: true // Auto-resolved by sync
                });
              
              // Log override reset in override_log
              for (const [fieldName, values] of Object.entries(conflicts)) {
                await supabaseClient
                  .from('invoice_override_log')
                  .insert({
                    invoice_id: existingInvoice.id,
                    user_id: effectiveAccountId,
                    field_name: fieldName,
                    original_value: String(values.stripe_value),
                    new_value: String(values.stripe_value),
                    acknowledged_warning: true,
                    integration_source: 'stripe'
                  });
              }
              
              conflictsResolved++;
              overridesReset += existingInvoice.override_count || 0;
              
              logStep("Override conflict resolved", { 
                invoiceId: stripeInvoice.id, 
                conflicts,
                overridesReset: existingInvoice.override_count 
              });
            }
            
            // Reset override flags since Stripe data is source of truth
            invoiceData.has_local_overrides = false;
            invoiceData.override_count = 0;
          }

          const { error: updateError } = await supabaseClient
            .from('invoices')
            .update(invoiceData)
            .eq('id', existingInvoice.id);

          if (updateError) {
            errors.push(`Failed to update invoice ${stripeInvoice.id}: ${updateError.message}`);
            continue;
          }
          
          invoiceRecordId = existingInvoice.id;
          
          if (existingInvoice.status !== normalizedInvoice.status) {
            logStep("Status updated", { 
              invoiceId: stripeInvoice.id, 
              oldStatus: existingInvoice.status, 
              newStatus: normalizedInvoice.status 
            });
          }
        } else {
          // New invoice - set initial override state
          invoiceData.has_local_overrides = false;
          invoiceData.override_count = 0;
          invoiceData.is_new_from_sync = true;

          const { data: newInvoice, error: insertError } = await supabaseClient
            .from('invoices')
            .insert(invoiceData)
            .select('id')
            .single();

          if (insertError) {
            // If this is a duplicate, treat it as "already exists" and update the existing record instead.
            // This makes sync idempotent and ensures we still ingest credits/payments/status changes.
            if (/duplicate key.*unique constraint/i.test(insertError.message)) {
              const invoiceNumber = stripeInvoice.number || stripeInvoice.id;

              const { data: existingByNumber, error: existingByNumberError } = await supabaseClient
                .from('invoices')
                .select('id')
                .eq('user_id', effectiveAccountId)
                .eq('invoice_number', invoiceNumber)
                .limit(1);

              if (!existingByNumberError && existingByNumber?.[0]?.id) {
                const { error: dupUpdateError } = await supabaseClient
                  .from('invoices')
                  .update({ ...invoiceData, stripe_invoice_id: stripeInvoice.id, external_invoice_id: stripeInvoice.id })
                  .eq('id', existingByNumber[0].id);

                if (!dupUpdateError) {
                  invoiceRecordId = existingByNumber[0].id;
                  isNewInvoice = false;
                } else {
                  errors.push(`Failed to update existing duplicate invoice ${stripeInvoice.id}: ${dupUpdateError.message}`);
                  continue;
                }
              } else {
                errors.push(`Failed to locate duplicate invoice ${stripeInvoice.id} after insert conflict`);
                continue;
              }
            } else {
              errors.push(`Failed to create invoice ${stripeInvoice.id}: ${insertError.message}`);
              continue;
            }
          } else {
            invoiceRecordId = newInvoice.id;
            isNewInvoice = true;
            newInvoicesCreated++;
          }
        }

        // Sync transaction history from Stripe
        try {
          const { data: existingTxs } = await supabaseClient
            .from('invoice_transactions')
            .select('reference_number')
            .eq('invoice_id', invoiceRecordId);
          
          const existingRefs = new Set((existingTxs || []).map(tx => tx.reference_number).filter(Boolean));

           let paymentLoggedViaIntent = false;

           if (stripeInvoice.payment_intent) {
             const paymentIntentId = typeof stripeInvoice.payment_intent === 'string'
               ? stripeInvoice.payment_intent
               : stripeInvoice.payment_intent.id;

             try {
               const paymentIntent = await stripeGetJson<StripePaymentIntent>(
                 stripeKey,
                 `/v1/payment_intents/${paymentIntentId}`
               );

               if (paymentIntent.status === 'succeeded' && (paymentIntent.amount_received || 0) > 0) {
                 const paymentRef = `stripe_pi_${paymentIntentId}`;
                 if (!existingRefs.has(paymentRef)) {
                   const amountPaid = (paymentIntent.amount_received || 0) / 100;
                   const balanceAfter = (stripeInvoice.amount_remaining || 0) / 100;

                    await supabaseClient
                      .from('invoice_transactions')
                      .insert({
                        invoice_id: invoiceRecordId,
                        user_id: effectiveAccountId,
                        sync_log_id: syncLogId,
                       transaction_type: 'payment',
                       amount: amountPaid,
                       balance_after: balanceAfter,
                       payment_method: paymentIntent.payment_method_types?.[0] || 'card',
                       reference_number: paymentRef,
                       transaction_date: new Date((paymentIntent.created || 0) * 1000).toISOString().split('T')[0],
                       notes: `Payment via Stripe`,
                       source_system: 'stripe',
                       external_transaction_id: paymentIntentId,
                       metadata: {
                         stripe_payment_intent_id: paymentIntentId,
                         stripe_invoice_id: stripeInvoice.id,
                         source: 'stripe_sync'
                       }
                     });

                   transactionsLogged++;
                   existingRefs.add(paymentRef);
                   paymentLoggedViaIntent = true;
                 } else {
                   paymentLoggedViaIntent = true; // Already exists
                 }
               }

               // Check for refunds
               const refundsResp = await stripeGetJson<StripeListResponse<StripeRefund>>(
                 stripeKey,
                 '/v1/refunds',
                 [
                   ['payment_intent', paymentIntentId],
                   ['limit', '100'],
                 ]
               );

               for (const refund of refundsResp.data || []) {
                 const refundRef = `stripe_refund_${refund.id}`;
                 if (!existingRefs.has(refundRef)) {
                   const refundAmount = (refund.amount || 0) / 100;

                    await supabaseClient
                      .from('invoice_transactions')
                      .insert({
                        invoice_id: invoiceRecordId,
                        user_id: effectiveAccountId,
                        sync_log_id: syncLogId,
                       transaction_type: 'refund',
                       amount: -refundAmount,
                       payment_method: 'refund',
                       reference_number: refundRef,
                       transaction_date: new Date((refund.created || 0) * 1000).toISOString().split('T')[0],
                       notes: `Refund via Stripe${refund.reason ? `: ${refund.reason}` : ''}`,
                       source_system: 'stripe',
                       external_transaction_id: refund.id,
                       metadata: {
                         stripe_refund_id: refund.id,
                         stripe_invoice_id: stripeInvoice.id,
                         source: 'stripe_sync'
                       }
                     });

                   transactionsLogged++;
                   existingRefs.add(refundRef);
                 }
               }
             } catch (piError) {
               logStep("Error fetching payment intent", { paymentIntentId, error: String(piError) });
             }
           }

           // Fallback: Log payment for paid/partially paid invoices without payment_intent
           // This covers invoices paid via credit balance, bank transfers, or manual payments
           if (!paymentLoggedViaIntent && stripeInvoice.amount_paid > 0) {
             const fallbackRef = `stripe_inv_payment_${stripeInvoice.id}`;
             if (!existingRefs.has(fallbackRef)) {
               const amountPaid = (stripeInvoice.amount_paid || 0) / 100;
               const balanceAfter = (stripeInvoice.amount_remaining || 0) / 100;
               
               // Determine payment date from status_transitions or invoice creation
               let paymentTransactionDate: string;
               if (stripeInvoice.status_transitions?.paid_at) {
                 paymentTransactionDate = new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString().split('T')[0];
               } else if (stripeInvoice.status_transitions?.finalized_at) {
                 paymentTransactionDate = new Date(stripeInvoice.status_transitions.finalized_at * 1000).toISOString().split('T')[0];
               } else {
                 paymentTransactionDate = new Date(stripeInvoice.created * 1000).toISOString().split('T')[0];
               }

                await supabaseClient
                  .from('invoice_transactions')
                  .insert({
                    invoice_id: invoiceRecordId,
                    user_id: effectiveAccountId,
                    sync_log_id: syncLogId,
                   transaction_type: 'payment',
                   amount: amountPaid,
                   balance_after: balanceAfter,
                   payment_method: 'stripe',
                   reference_number: fallbackRef,
                   transaction_date: paymentTransactionDate,
                   notes: `Payment via Stripe${stripeInvoice.payment_intent ? '' : ' (no payment intent)'}`,
                   source_system: 'stripe',
                   external_transaction_id: stripeInvoice.id,
                   metadata: {
                     stripe_invoice_id: stripeInvoice.id,
                     source: 'stripe_sync',
                     fallback_payment: true
                   }
                 });

               transactionsLogged++;
               existingRefs.add(fallbackRef);
               logStep("Logged fallback payment for invoice", { invoiceId: stripeInvoice.id, amountPaid });
             }
           }

           // Check for credit notes
           try {
             const creditNotesResp = await stripeGetJson<StripeListResponse<StripeCreditNote>>(
               stripeKey,
               '/v1/credit_notes',
               [
                 ['invoice', stripeInvoice.id],
                 ['limit', '100'],
               ]
             );

             for (const creditNote of creditNotesResp.data || []) {
               const cnRef = `stripe_cn_${creditNote.id}`;
               if (!existingRefs.has(cnRef)) {
                 const creditAmount = (creditNote.amount || 0) / 100;

                  await supabaseClient
                    .from('invoice_transactions')
                    .insert({
                      invoice_id: invoiceRecordId,
                      user_id: effectiveAccountId,
                      sync_log_id: syncLogId,
                     transaction_type: 'credit',
                     amount: -creditAmount,
                     payment_method: 'credit_note',
                     reference_number: cnRef,
                     transaction_date: new Date((creditNote.created || 0) * 1000).toISOString().split('T')[0],
                     notes: `Credit note via Stripe${creditNote.reason ? `: ${creditNote.reason}` : ''}`,
                     source_system: 'stripe',
                     external_transaction_id: creditNote.id,
                     metadata: {
                       stripe_credit_note_id: creditNote.id,
                       stripe_invoice_id: stripeInvoice.id,
                       source: 'stripe_sync'
                     }
                   });

                 transactionsLogged++;
                 existingRefs.add(cnRef);
               }
             }
           } catch (cnError) {
             logStep("Error fetching credit notes", { invoiceId: stripeInvoice.id, error: String(cnError) });
           }

          // Log discounts
          if (stripeInvoice.discount) {
            const discount = stripeInvoice.discount;
            const discountRef = `stripe_discount_${stripeInvoice.id}_${discount.coupon?.id || 'unknown'}`;
            if (!existingRefs.has(discountRef)) {
              const discountAmount = (stripeInvoice.total_discount_amounts?.[0]?.amount || 0) / 100;
              if (discountAmount > 0) {
                await supabaseClient
                  .from('invoice_transactions')
                  .insert({
                    invoice_id: invoiceRecordId,
                    user_id: effectiveAccountId,
                    sync_log_id: syncLogId,
                    transaction_type: 'discount',
                    amount: -discountAmount,
                    payment_method: 'discount',
                    reference_number: discountRef,
                    transaction_date: new Date(stripeInvoice.created * 1000).toISOString().split('T')[0],
                    notes: `Discount: ${discount.coupon?.name || discount.coupon?.id || 'Applied discount'}`,
                    source_system: 'stripe',
                    external_transaction_id: discount.coupon?.id || stripeInvoice.id,
                    metadata: { 
                      stripe_invoice_id: stripeInvoice.id,
                      source: 'stripe_sync'
                    }
                  });
                
                transactionsLogged++;
              }
            }
          }

          // Log write-offs
          if (stripeInvoice.status === 'uncollectible') {
            const woRef = `stripe_writeoff_${stripeInvoice.id}`;
            if (!existingRefs.has(woRef)) {
              const woAmount = (stripeInvoice.amount_remaining || 0) / 100;
              if (woAmount > 0) {
                await supabaseClient
                  .from('invoice_transactions')
                  .insert({
                    invoice_id: invoiceRecordId,
                    user_id: effectiveAccountId,
                    sync_log_id: syncLogId,
                    transaction_type: 'write_off',
                    amount: -woAmount,
                    balance_after: 0,
                    payment_method: 'write_off',
                    reference_number: woRef,
                    transaction_date: new Date().toISOString().split('T')[0],
                    notes: 'Marked as uncollectible in Stripe',
                    source_system: 'stripe',
                    external_transaction_id: stripeInvoice.id,
                    metadata: { 
                      stripe_invoice_id: stripeInvoice.id,
                      source: 'stripe_sync'
                    }
                  });
                
                transactionsLogged++;
              }
            }
          }

        } catch (txError) {
          logStep("Error syncing transactions", { invoiceId: stripeInvoice.id, error: String(txError) });
        }

        // ============================================================
        // SYNC LINE ITEMS: Stripe invoice.lines → invoice_line_items
        // ============================================================
        try {
          const stripeLines = stripeInvoice.lines?.data || [];
          if (stripeLines.length > 0) {
            // Delete existing synced line items for this invoice to avoid duplicates
            await supabaseClient
              .from('invoice_line_items')
              .delete()
              .eq('invoice_id', invoiceRecordId)
              .eq('user_id', effectiveAccountId);

            const lineItemsToInsert = stripeLines.map((line: any, index: number) => ({
              invoice_id: invoiceRecordId,
              user_id: effectiveAccountId,
              description: line.description || line.plan?.nickname || 'Stripe line item',
              quantity: line.quantity || 1,
              unit_price: (line.unit_amount || line.price?.unit_amount || 0) / 100,
              line_total: (line.amount || 0) / 100,
              sort_order: index,
            }));

            const { error: lineItemsError } = await supabaseClient
              .from('invoice_line_items')
              .insert(lineItemsToInsert);

            if (lineItemsError) {
              logStep("Error syncing line items", { invoiceId: stripeInvoice.id, error: lineItemsError.message });
            } else {
              logStep("Line items synced", { invoiceId: stripeInvoice.id, count: lineItemsToInsert.length });
            }

            // Update invoice subtotal from line items
            const subtotal = lineItemsToInsert.reduce((sum: number, item: any) => sum + item.line_total, 0);
            await supabaseClient
              .from('invoices')
              .update({ subtotal })
              .eq('id', invoiceRecordId);
          }
        } catch (lineItemError) {
          logStep("Error syncing line items", { invoiceId: stripeInvoice.id, error: String(lineItemError) });
        }

        syncedCount++;
      } catch (invoiceError) {
        const errorMsg = invoiceError instanceof Error ? invoiceError.message : String(invoiceError);
        errors.push(`Error processing invoice ${stripeInvoice.id}: ${errorMsg}`);
        logStep("Error processing invoice", { invoiceId: stripeInvoice.id, error: errorMsg });
      }
    }

    logStep("Status breakdown", statusUpdates);

    // Update integration status
    await supabaseClient
      .from('stripe_integrations')
      .update({
        is_connected: true,
        sync_status: errors.length > 0 ? 'partial' : 'success',
        last_sync_at: new Date().toISOString(),
        last_sync_error: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
        invoices_synced_count: syncedCount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', effectiveAccountId);

    logStep("Sync completed", { 
      syncedCount, 
      createdDebtors, 
      transactionsLogged, 
      newInvoicesCreated, 
      conflictsDetected,
      conflictsResolved,
      overridesReset,
      errorCount: errors.length 
    });

    // AUTOMATICALLY trigger ensure-invoice-workflows after sync
    // This assigns workflows to newly synced invoices
    let workflowResult: any = null;
    if (newInvoicesCreated > 0 || statusUpdates.open > 0) {
      logStep("Triggering workflow assignment for new/open invoices...");
      try {
        const { data, error: workflowError } = await supabaseClient.functions.invoke(
          'ensure-invoice-workflows',
          { body: {} }
        );

        if (workflowError) {
          logStep("Error calling ensure-invoice-workflows", { error: workflowError.message });
        } else {
          workflowResult = data;
          logStep("Workflow assignment completed", { 
            workflowsCreated: workflowResult?.workflowsCreated,
            drafted: workflowResult?.schedulerResult?.drafted
          });
        }
      } catch (err) {
        logStep("Exception calling ensure-invoice-workflows", { error: String(err) });
      }
    }

    // Update sync log with detailed metrics
    // Terminal invoices are NOT failures - they're valid states from source system
    const totalSynced = syncedCount + transactionsLogged;
    const totalFailed = errors.length;
    // Only count as partial/failed if there are actual errors, not just terminal invoices
    const finalStatus = totalFailed > 0 ? (totalSynced > 0 ? 'partial' : 'failed') : 'success';
    
    if (syncLogId) {
      try {
        await supabaseClient.from('stripe_sync_log').update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          records_synced: totalSynced,
          records_failed: totalFailed,
          invoices_synced: syncedCount,
          invoices_terminal: terminalSkipped,
          paid_without_payment: paidWithoutPayment,
          customers_synced: createdDebtors,
          new_invoices_created: newInvoicesCreated,
          new_transactions_created: transactionsLogged,
          updated_invoices_count: syncedCount - newInvoicesCreated,
          errors: errors.slice(0, 20)
        }).eq('id', syncLogId);
      } catch (e) {
        logStep('STRIPE_SYNCLOG_UPDATE_FAILED', { error: String(e) });
      }
    }

    // Log warnings for transparency (not failures)
    if (warnings.length > 0) {
      logStep("Sync warnings (informational)", { count: warnings.length, sample: warnings.slice(0, 3) });
    }

    return new Response(JSON.stringify({
      success: true,
      // One-directional sync indicator
      sync_direction: 'stripe_to_recouply',
      read_only: true,
      invoices_synced: syncedCount,
      transactions_synced: transactionsLogged,
      // Terminal invoices are valid, not failures
      terminal_invoices: terminalSkipped,
      paid_without_payment: paidWithoutPayment,
      conflicts_detected: conflictsDetected,
      conflicts_resolved: conflictsResolved,
      overrides_reset: overridesReset,
      created_debtors: createdDebtors,
      new_invoices_created: newInvoicesCreated,
      total_invoices: invoices.length,
      status_breakdown: statusUpdates,
      workflow_result: workflowResult ? {
        workflows_assigned: workflowResult.workflowsCreated || 0,
        drafts_generated: workflowResult.schedulerResult?.drafted || 0,
        drafts_sent: workflowResult.schedulerResult?.sent || 0
      } : null,
      warnings: warnings.slice(0, 5),
      errors: errors.slice(0, 5)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabaseClient.auth.getUser(token);
        if (userData?.user?.id) {
          const { data: effectiveAccountData } = await supabaseClient.rpc('get_effective_account_id', { p_user_id: userData.user.id });
          await supabaseClient
            .from('stripe_integrations')
            .update({
              sync_status: 'error',
              last_sync_error: errorMessage,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', effectiveAccountData || userData.user.id);
        }
      }
    } catch (e) {
      // Ignore errors when updating status
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
