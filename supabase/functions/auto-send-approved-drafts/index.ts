// ⚠️ EMAIL DOMAIN WARNING ⚠️
// This function sends emails via Resend.
// Uses deterministic sender selection from renderBrandedEmail.ts
// See: supabase/functions/_shared/renderBrandedEmail.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { 
  getSenderIdentity, 
  captureBrandSnapshot, 
  renderEmail,
  BrandingConfig 
} from "../_shared/renderBrandedEmail.ts";
import { getOutreachContacts } from "../_shared/contactUtils.ts";
import { INBOUND_EMAIL_DOMAIN, getDebtorReplyToAddress } from "../_shared/emailConfig.ts";
import { sanitizeSubjectLine } from "../_shared/draftContentEngine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Replace template variables in subject and body
 */
function replaceTemplateVars(
  text: string, 
  invoice: any, 
  debtor: any, 
  branding: any,
  daysPastDue: number
): string {
  if (!text) return text;
  
  const customerName = debtor?.name || debtor?.company_name || 'Valued Customer';
  const invoiceNumber = invoice?.invoice_number || invoice?.reference_id || '';
  const amount = `$${(invoice?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const dueDate = invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const paymentLink = branding?.stripe_payment_link || '';
  // Prefer Stripe hosted invoice URL / public link over internal dashboard URL
  const invoiceLink = invoice?.external_link || invoice?.stripe_hosted_url || invoice?.integration_url || '';
  const productDescription = invoice?.product_description || '';
  // CRITICAL: Get business name with proper fallback chain
  // Priority: business_name > from_name > 'Your Company' (never use empty string)
  const businessName = branding?.business_name?.trim() || branding?.from_name?.trim() || 'Your Company';
  
  // Build AR portal URL
  const arPageUrl = branding?.ar_page_public_token && branding?.ar_page_enabled 
    ? `https://recouply.ai/ar/${branding.ar_page_public_token}` 
    : '';
  
  let result = text
    // Company/Business name (sender's company) - MUST come before customer name
    .replace(/\{\{company_name\}\}/gi, businessName)
    .replace(/\{\{company name\}\}/gi, businessName)
    .replace(/\{\{business_name\}\}/gi, businessName)
    .replace(/\{\{business name\}\}/gi, businessName)
    // Customer/Debtor name variations (recipient)
    .replace(/\{\{customer_name\}\}/gi, customerName)
    .replace(/\{\{customer name\}\}/gi, customerName)
    .replace(/\{\{debtor_name\}\}/gi, customerName)
    .replace(/\{\{debtor name\}\}/gi, customerName)
    .replace(/\{\{name\}\}/gi, customerName)
    // Invoice number variations
    .replace(/\{\{invoice_number\}\}/gi, invoiceNumber)
    .replace(/\{\{invoice number\}\}/gi, invoiceNumber)
    .replace(/\{\{invoiceNumber\}\}/gi, invoiceNumber)
    // Amount variations
    .replace(/\{\{amount\}\}/gi, amount)
    .replace(/\{\{balance\}\}/gi, amount)
    .replace(/\{\{total\}\}/gi, amount)
    .replace(/\{\{invoice_amount\}\}/gi, amount)
    // Due date variations
    .replace(/\{\{due_date\}\}/gi, dueDate)
    .replace(/\{\{due date\}\}/gi, dueDate)
    .replace(/\{\{dueDate\}\}/gi, dueDate)
    // Days past due
    .replace(/\{\{days_past_due\}\}/gi, String(daysPastDue))
    .replace(/\{\{days past due\}\}/gi, String(daysPastDue))
    .replace(/\{\{daysPastDue\}\}/gi, String(daysPastDue))
    // Payment link variations
    .replace(/\{\{payment_link\}\}/gi, paymentLink)
    .replace(/\{\{payment link\}\}/gi, paymentLink)
    .replace(/\{\{paymentLink\}\}/gi, paymentLink)
    .replace(/\{\{pay_link\}\}/gi, paymentLink)
    .replace(/\{\{stripe_link\}\}/gi, paymentLink)
    // Invoice link variations (external system link)
    .replace(/\{\{invoice_link\}\}/gi, invoiceLink)
    .replace(/\{\{invoice link\}\}/gi, invoiceLink)
    .replace(/\{\{invoiceLink\}\}/gi, invoiceLink)
    .replace(/\{\{external_link\}\}/gi, invoiceLink)
    .replace(/\{\{integration_url\}\}/gi, invoiceLink)
    // AR Portal link
    .replace(/\{\{ar_portal_link\}\}/gi, arPageUrl)
    .replace(/\{\{portal_link\}\}/gi, arPageUrl)
    // Product/Service description variations
    .replace(/\{\{product_description\}\}/gi, productDescription)
    .replace(/\{\{product description\}\}/gi, productDescription)
    .replace(/\{\{productDescription\}\}/gi, productDescription)
    .replace(/\{\{service_description\}\}/gi, productDescription)
    .replace(/\{\{description\}\}/gi, productDescription);
  
  // Auto-append invoice link if it exists and isn't already in the message
  if (invoiceLink && !result.includes(invoiceLink)) {
    result += `\n\nView your invoice: ${invoiceLink}`;
  }
  
  return result;
}

/**
 * Process message body to ensure it has contact info, signature, and links
 */
function ensureMessageHasContactInfo(
  body: string,
  branding: any
): string {
  let result = body;
  
  const arPageUrl = branding?.ar_page_public_token && branding?.ar_page_enabled 
    ? `https://recouply.ai/ar/${branding.ar_page_public_token}` 
    : '';
  const paymentLink = branding?.stripe_payment_link || '';
  const signature = branding?.email_signature || '';
  const contactName = branding?.escalation_contact_name || '';
  const contactEmail = branding?.escalation_contact_email || '';
  const contactPhone = branding?.escalation_contact_phone || '';
  // CRITICAL: Use proper fallback chain for business name
  const businessName = branding?.business_name?.trim() || branding?.from_name?.trim() || 'Your Company';
  
  // Append AR portal link if available and not already in body
  if (arPageUrl && !result.includes(arPageUrl)) {
    result += `\n\n📄 Access your account portal: ${arPageUrl}`;
  }
  
  // Append payment link if available and not already in body
  if (paymentLink && !result.includes(paymentLink)) {
    result += `\n\n💳 Make a payment: ${paymentLink}`;
  }
  
  // Add signature/contact info if not already in body
  if (signature && !result.includes(signature)) {
    result += `\n\n---\n${signature}`;
  } else if (!signature) {
    // Add contact info from escalation settings
    let contactSection = '';
    if (contactName) contactSection += `\n${contactName}`;
    if (contactEmail) contactSection += `\nEmail: ${contactEmail}`;
    if (contactPhone) contactSection += `\nPhone: ${contactPhone}`;
    if (contactSection || businessName) {
      result += `\n\n---${contactSection}\n${businessName}`;
    }
  }
  
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to check for specific draft IDs
    let requestedDraftIds: string[] | null = null;
    try {
      const body = await req.json();
      if (body?.draftIds && Array.isArray(body.draftIds) && body.draftIds.length > 0) {
        requestedDraftIds = body.draftIds as string[];
        console.log(`[AUTO-SEND] Requested specific draft IDs: ${(requestedDraftIds as string[]).join(', ')}`);
      }
    } catch {
      // No body or invalid JSON - process all eligible drafts
    }

    console.log('[AUTO-SEND] Starting auto-send approved drafts...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get all approved drafts that haven't been sent yet
    // Include drafts where recommended_send_date is today or in the past (catch-up)
    // Process in batches to avoid timeouts
    const today = new Date().toISOString().split('T')[0];
    const TOTAL_BATCH_SIZE = 50;
    const INVOICE_BATCH_SIZE = requestedDraftIds && requestedDraftIds.length > 0 ? TOTAL_BATCH_SIZE : 25;
    const ACCOUNT_BATCH_SIZE = requestedDraftIds && requestedDraftIds.length > 0 ? TOTAL_BATCH_SIZE : 25;

    const extractDebtorIdFromSnapshot = (snapshot: any): string | null => {
      if (!snapshot || typeof snapshot !== 'object') return null;
      const context = (snapshot as any).context || {};
      const invoices = (context as any).invoices || [];

      return (
        (snapshot as any).debtor_id ||
        (context as any).debtor_id ||
        (Array.isArray(invoices) && invoices.length > 0 ? invoices[0]?.debtor_id : null) ||
        null
      );
    };

    // ------------------------------
    // Fetch INVOICE-LEVEL drafts
    // ------------------------------
    let invoiceDraftQuery = supabaseAdmin
      .from('ai_drafts')
      .select(`
        *,
        invoices!inner(
          id,
          status,
          due_date,
          aging_bucket,
          invoice_number,
          reference_id,
          amount,
          currency,
          user_id,
          integration_url,
          stripe_hosted_url,
          external_link,
          product_description,
          is_on_payment_plan,
          debtors!inner(
            id,
            name,
            company_name,
            email,
            phone
          )
        )
      `)
      .eq('status', 'approved')
      .is('sent_at', null)
      .not('invoice_id', 'is', null);

    if (requestedDraftIds && requestedDraftIds.length > 0) {
      invoiceDraftQuery = invoiceDraftQuery.in('id', requestedDraftIds);
    } else {
      invoiceDraftQuery = invoiceDraftQuery.lte('recommended_send_date', today);
    }

    const { data: invoiceDrafts, error: invoiceDraftsError } = await invoiceDraftQuery
      .order('recommended_send_date', { ascending: true })
      .limit(INVOICE_BATCH_SIZE);

    if (invoiceDraftsError) {
      console.error('[AUTO-SEND] Error fetching invoice-level drafts:', invoiceDraftsError);
      throw invoiceDraftsError;
    }

    // ------------------------------
    // Fetch ACCOUNT-LEVEL drafts (invoice_id is null)
    // These are created by account-level outreach flows (e.g. send-account-summary)
    // ------------------------------
    // For account-level drafts, include those with NULL recommended_send_date (send immediately)
    // or where recommended_send_date <= today
    let accountDrafts: any[] = [];
    let accountDraftsError: any = null;

    if (requestedDraftIds && requestedDraftIds.length > 0) {
      // When specific IDs requested, just filter by those
      const { data, error } = await supabaseAdmin
        .from('ai_drafts')
        .select(`
          id,
          user_id,
          subject,
          message_body,
          status,
          channel,
          recommended_send_date,
          applied_brand_snapshot,
          created_at,
          updated_at
        `)
        .eq('status', 'approved')
        .is('sent_at', null)
        .is('invoice_id', null)
        .in('id', requestedDraftIds)
        .order('recommended_send_date', { ascending: true, nullsFirst: true })
        .limit(ACCOUNT_BATCH_SIZE);
      accountDrafts = data || [];
      accountDraftsError = error;
    } else {
      // For automated runs: include NULL recommended_send_date (immediate) OR date <= today
      const { data: nullDateDrafts, error: nullError } = await supabaseAdmin
        .from('ai_drafts')
        .select(`
          id,
          user_id,
          subject,
          message_body,
          status,
          channel,
          recommended_send_date,
          applied_brand_snapshot,
          created_at,
          updated_at
        `)
        .eq('status', 'approved')
        .is('sent_at', null)
        .is('invoice_id', null)
        .is('recommended_send_date', null)
        .order('created_at', { ascending: true })
        .limit(ACCOUNT_BATCH_SIZE);

      const { data: scheduledDrafts, error: scheduledError } = await supabaseAdmin
        .from('ai_drafts')
        .select(`
          id,
          user_id,
          subject,
          message_body,
          status,
          channel,
          recommended_send_date,
          applied_brand_snapshot,
          created_at,
          updated_at
        `)
        .eq('status', 'approved')
        .is('sent_at', null)
        .is('invoice_id', null)
        .not('recommended_send_date', 'is', null)
        .lte('recommended_send_date', today)
        .order('recommended_send_date', { ascending: true })
        .limit(ACCOUNT_BATCH_SIZE);

      accountDraftsError = nullError || scheduledError;
      // Combine and dedupe
      const combined = [...(nullDateDrafts || []), ...(scheduledDrafts || [])];
      const seen = new Set<string>();
      accountDrafts = combined.filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      }).slice(0, ACCOUNT_BATCH_SIZE);
    }

    if (accountDraftsError) {
      console.error('[AUTO-SEND] Error fetching account-level drafts:', accountDraftsError);
      throw accountDraftsError;
    }

    const invoiceCount = invoiceDrafts?.length || 0;
    const accountCount = accountDrafts?.length || 0;
    const totalCount = invoiceCount + accountCount;

    console.log(
      `[AUTO-SEND] Found ${totalCount} approved drafts to process (${invoiceCount} invoice-level, ${accountCount} account-level)`
    );

    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // ============================================================
    // Process INVOICE-LEVEL drafts
    // ============================================================
    for (const draft of invoiceDrafts || []) {
      const invoice = (draft as any).invoices as any;
      const debtor = invoice?.debtors as any;

      // Only process active invoice statuses - mark others as skipped
      if (invoice?.status !== 'Open' && invoice?.status !== 'InPaymentPlan' && invoice?.status !== 'PartiallyPaid') {
        console.log(`[AUTO-SEND] Skipping invoice draft ${draft.id}: invoice ${invoice?.id} status is ${invoice?.status}`);

        // Mark draft as skipped so it doesn't keep appearing
        await supabaseAdmin
          .from('ai_drafts')
          .update({
            status: 'skipped',
            updated_at: new Date().toISOString(),
          })
          .eq('id', (draft as any).id);

        skippedCount++;
        continue;
      }

      // Skip invoices on payment plans - they use account-level outreach
      if (invoice?.is_on_payment_plan === true) {
        console.log(`[AUTO-SEND] Skipping invoice draft ${draft.id}: invoice ${invoice?.id} is on payment plan`);

        // Mark draft as skipped - payment plans have their own outreach
        await supabaseAdmin
          .from('ai_drafts')
          .update({
            status: 'skipped',
            updated_at: new Date().toISOString(),
          })
          .eq('id', (draft as any).id);

        skippedCount++;
        continue;
      }

      // Validate we have debtor info
      if (!debtor || !debtor.id) {
        console.log(`[AUTO-SEND] Skipping invoice draft ${draft.id}: no debtor found`);
        skippedCount++;
        continue;
      }

      console.log(`[AUTO-SEND] Processing invoice draft ${draft.id} for invoice ${invoice.invoice_number}`);

      try {
        // Get outreach contacts for this debtor
        const outreachContacts = await getOutreachContacts(supabaseAdmin, debtor.id, debtor);
        const allEmails = outreachContacts.emails;

        if (allEmails.length === 0) {
          console.log(`[AUTO-SEND] Skipping invoice draft ${draft.id}: no email addresses found for debtor ${debtor.id}`);
          skippedCount++;
          continue;
        }

        // Get effective account ID for branding
        const { data: effectiveAccountId } = await supabaseAdmin.rpc('get_effective_account_id', {
          p_user_id: invoice.user_id,
        });
        const brandingOwnerId = effectiveAccountId || invoice.user_id;

        // Fetch full branding settings for deterministic sender selection
        const { data: branding } = await supabaseAdmin
          .from('branding_settings')
          .select('*')
          .eq('user_id', brandingOwnerId)
          .single();

        // Build branding config for deterministic sender selection
        const brandingConfig: BrandingConfig = {
          business_name: branding?.business_name || 'Recouply',
          from_name: branding?.from_name || branding?.business_name || 'Recouply',
          logo_url: branding?.logo_url,
          primary_color: branding?.primary_color || '#111827',
          accent_color: branding?.accent_color || '#6366f1',
          sending_mode: branding?.sending_mode || 'recouply_default',
          from_email: branding?.from_email,
          from_email_verified: branding?.from_email_verified || false,
          verified_from_email: branding?.verified_from_email,
          reply_to_email: branding?.reply_to_email,
          email_signature: branding?.email_signature,
          email_footer: branding?.email_footer,
          footer_disclaimer: branding?.footer_disclaimer,
          ar_page_public_token: branding?.ar_page_public_token,
          ar_page_enabled: branding?.ar_page_enabled,
          stripe_payment_link: branding?.stripe_payment_link,
          email_format: (branding?.email_format as 'simple' | 'enhanced') || 'simple',
        };

        // Get deterministic sender identity
        const sender = getSenderIdentity(brandingConfig);
        const brandSnapshot = captureBrandSnapshot(brandingConfig, sender);

        // Always use invoice-specific reply-to for routing inbound responses
        const replyToAddress = `invoice+${invoice.id}@${INBOUND_EMAIL_DOMAIN}`;

        console.log(`[AUTO-SEND] Sender for invoice draft ${draft.id}:`, {
          mode: sender.sendingMode,
          from: sender.fromEmail,
          fallback: sender.usedFallback,
        });

        // Calculate days past due for template replacement
        const dueDate = new Date(invoice.due_date);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.max(
          0,
          Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        // Replace template variables in draft content
        // CRITICAL: Sanitize subject to remove any URLs - they should only appear in email body
        const processedSubject = sanitizeSubjectLine(replaceTemplateVars(draft.subject || 'Payment Reminder', invoice, debtor, branding, daysPastDue));
        let processedBody = replaceTemplateVars(draft.message_body, invoice, debtor, branding, daysPastDue);

        // Ensure message has contact info, signature, and links
        processedBody = ensureMessageHasContactInfo(processedBody, branding);

        // Render branded HTML email using standardized wrapper
        const emailHtml = renderEmail({
          brand: brandingConfig,
          subject: processedSubject,
          bodyHtml: processedBody.replace(/\n/g, '<br>'),
          cta: branding?.stripe_payment_link
            ? {
                label: `💳 Pay Now $${invoice.amount?.toLocaleString()}`,
                url: branding.stripe_payment_link,
              }
            : undefined,
          meta: {
            invoiceId: invoice.id,
            debtorId: debtor.id,
          },
        });

        console.log(`[AUTO-SEND] Sending invoice email from ${sender.fromEmail} to ${allEmails.join(', ')}`);

        // Send email via platform send-email function
        const sendEmailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            to: allEmails,
            from: sender.fromEmail,
            reply_to: replyToAddress,
            subject: processedSubject,
            html: emailHtml,
          }),
        });

        const emailResult = await sendEmailResponse.json();

        if (!sendEmailResponse.ok) {
          console.error(`[AUTO-SEND] Email send error for invoice draft ${draft.id}:`, emailResult);
          errors.push(`Draft ${draft.id}: ${emailResult.error || 'Email send failed'}`);
          continue;
        }

        console.log(`[AUTO-SEND] Email sent successfully for invoice draft ${draft.id}`);

        // Log the outreach
        await supabaseAdmin.from('outreach_logs').insert({
          user_id: invoice.user_id,
          invoice_id: invoice.id,
          debtor_id: debtor.id,
          channel: draft.channel || 'email',
          subject: processedSubject,
          message_body: processedBody,
          sent_to: allEmails.join(', '),
          sent_from: sender.fromEmail,
          status: 'sent',
          sent_at: new Date().toISOString(),
          delivery_metadata: {
            draft_id: draft.id,
            reply_to: replyToAddress,
            platform_send: true,
            recipients_count: allEmails.length,
            auto_sent: true,
            brand_snapshot: brandSnapshot,
          },
        });

        // Log collection activity
        await supabaseAdmin.from('collection_activities').insert({
          user_id: invoice.user_id,
          debtor_id: debtor.id,
          invoice_id: invoice.id,
          linked_draft_id: draft.id,
          activity_type: 'outreach',
          direction: 'outbound',
          channel: 'email',
          subject: processedSubject,
          message_body: processedBody,
          sent_at: new Date().toISOString(),
          metadata: {
            from_email: sender.fromEmail,
            from_name: sender.fromName,
            reply_to_email: replyToAddress,
            sending_mode: sender.sendingMode,
            used_fallback: sender.usedFallback,
            platform_send: true,
            auto_sent: true,
            recipients: allEmails,
            brand_snapshot: brandSnapshot,
          },
        });

        // Update invoice last_contact_date
        await supabaseAdmin
          .from('invoices')
          .update({ last_contact_date: new Date().toISOString().split('T')[0] })
          .eq('id', invoice.id);

        // Mark draft as sent with status, timestamp, and brand snapshot for auditing
        await supabaseAdmin
          .from('ai_drafts')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            applied_brand_snapshot: brandSnapshot,
          })
          .eq('id', draft.id);

        sentCount++;
        console.log(`[AUTO-SEND] Successfully processed invoice draft ${draft.id} for invoice ${invoice.invoice_number}`);
      } catch (error) {
        console.error(`[AUTO-SEND] Exception processing invoice draft ${draft.id}:`, error);
        errors.push(`Draft ${draft.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // ============================================================
    // Process ACCOUNT-LEVEL drafts
    // ============================================================
    for (const draft of accountDrafts || []) {
      const existingSnapshot =
        (draft as any).applied_brand_snapshot &&
        typeof (draft as any).applied_brand_snapshot === 'object' &&
        !Array.isArray((draft as any).applied_brand_snapshot)
          ? (draft as any).applied_brand_snapshot
          : {};

      const debtorId = extractDebtorIdFromSnapshot(existingSnapshot);
      if (!debtorId) {
        console.log(`[AUTO-SEND] Skipping account draft ${draft.id}: no debtor_id found in applied_brand_snapshot`);

        await supabaseAdmin
          .from('ai_drafts')
          .update({
            status: 'skipped',
            updated_at: new Date().toISOString(),
          })
          .eq('id', (draft as any).id);

        skippedCount++;
        continue;
      }

      console.log(`[AUTO-SEND] Processing account draft ${draft.id} for debtor ${debtorId}`);

      try {
        const { data: debtor, error: debtorError } = await supabaseAdmin
          .from('debtors')
          .select('id, name, company_name, email, phone')
          .eq('id', debtorId)
          .single();

        if (debtorError || !debtor) {
          console.log(`[AUTO-SEND] Skipping account draft ${draft.id}: debtor not found (${debtorError?.message || 'unknown'})`);
          skippedCount++;
          continue;
        }

        // Get outreach contacts for this debtor
        const outreachContacts = await getOutreachContacts(supabaseAdmin, debtor.id, debtor);
        const allEmails = outreachContacts.emails;

        if (allEmails.length === 0) {
          console.log(`[AUTO-SEND] Skipping account draft ${draft.id}: no email addresses found for debtor ${debtor.id}`);
          skippedCount++;
          continue;
        }

        // Branding for the draft owner (team-safe)
        const { data: effectiveAccountId } = await supabaseAdmin.rpc('get_effective_account_id', {
          p_user_id: (draft as any).user_id,
        });
        const brandingOwnerId = effectiveAccountId || (draft as any).user_id;

        const { data: branding } = await supabaseAdmin
          .from('branding_settings')
          .select('*')
          .eq('user_id', brandingOwnerId)
          .single();

        const brandingConfig: BrandingConfig = {
          business_name: branding?.business_name || 'Recouply',
          from_name: branding?.from_name || branding?.business_name || 'Recouply',
          logo_url: branding?.logo_url,
          primary_color: branding?.primary_color || '#111827',
          accent_color: branding?.accent_color || '#6366f1',
          sending_mode: branding?.sending_mode || 'recouply_default',
          from_email: branding?.from_email,
          from_email_verified: branding?.from_email_verified || false,
          verified_from_email: branding?.verified_from_email,
          reply_to_email: branding?.reply_to_email,
          email_signature: branding?.email_signature,
          email_footer: branding?.email_footer,
          footer_disclaimer: branding?.footer_disclaimer,
          ar_page_public_token: branding?.ar_page_public_token,
          ar_page_enabled: branding?.ar_page_enabled,
          stripe_payment_link: branding?.stripe_payment_link,
          email_format: (branding?.email_format as 'simple' | 'enhanced') || 'simple',
        };

        const sender = getSenderIdentity(brandingConfig);
        const brandSnapshot = captureBrandSnapshot(brandingConfig, sender);

        // For account-level outreach, route replies by debtor
        const replyToAddress = getDebtorReplyToAddress(debtor.id);

        // Replace template variables in draft content (invoice vars will be empty)
        // CRITICAL: Sanitize subject to remove any URLs - they should only appear in email body
        const processedSubject = sanitizeSubjectLine(replaceTemplateVars(draft.subject || 'Account Summary', {}, debtor, branding, 0));
        let processedBody = replaceTemplateVars(draft.message_body || '', {}, debtor, branding, 0);
        processedBody = ensureMessageHasContactInfo(processedBody, branding);

        const emailHtml = renderEmail({
          brand: brandingConfig,
          subject: processedSubject,
          bodyHtml: processedBody.replace(/\n/g, '<br>'),
          meta: {
            debtorId: debtor.id,
          },
        });

        console.log(`[AUTO-SEND] Sending account email from ${sender.fromEmail} to ${allEmails.join(', ')}`);

        const sendEmailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            to: allEmails,
            from: sender.fromEmail,
            reply_to: replyToAddress,
            subject: processedSubject,
            html: emailHtml,
          }),
        });

        const emailResult = await sendEmailResponse.json();

        if (!sendEmailResponse.ok) {
          console.error(`[AUTO-SEND] Email send error for account draft ${draft.id}:`, emailResult);
          errors.push(`Draft ${draft.id}: ${emailResult.error || 'Email send failed'}`);
          continue;
        }

        // Log outreach
        await supabaseAdmin.from('outreach_logs').insert({
          user_id: (draft as any).user_id,
          invoice_id: null,
          debtor_id: debtor.id,
          channel: (draft as any).channel || 'email',
          subject: processedSubject,
          message_body: processedBody,
          sent_to: allEmails.join(', '),
          sent_from: sender.fromEmail,
          status: 'sent',
          sent_at: new Date().toISOString(),
          delivery_metadata: {
            draft_id: (draft as any).id,
            reply_to: replyToAddress,
            platform_send: true,
            recipients_count: allEmails.length,
            auto_sent: true,
            outreach_type: 'account_level',
            brand_snapshot: brandSnapshot,
          },
        });

        // Log activity
        await supabaseAdmin.from('collection_activities').insert({
          user_id: (draft as any).user_id,
          debtor_id: debtor.id,
          invoice_id: null,
          linked_draft_id: (draft as any).id,
          activity_type: 'account_level_outreach',
          direction: 'outbound',
          channel: 'email',
          subject: processedSubject,
          message_body: processedBody,
          sent_at: new Date().toISOString(),
          metadata: {
            from_email: sender.fromEmail,
            from_name: sender.fromName,
            reply_to_email: replyToAddress,
            sending_mode: sender.sendingMode,
            used_fallback: sender.usedFallback,
            platform_send: true,
            auto_sent: true,
            recipients: allEmails,
            outreach_type: 'account_level',
            brand_snapshot: brandSnapshot,
          },
        });

        // Preserve the existing snapshot (which contains debtor/invoice context) and append brand snapshot
        const mergedSnapshot = {
          ...existingSnapshot,
          brand_snapshot: brandSnapshot,
        };

        // Mark draft as sent
        await supabaseAdmin
          .from('ai_drafts')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            applied_brand_snapshot: mergedSnapshot,
          })
          .eq('id', (draft as any).id);

        sentCount++;
        console.log(`[AUTO-SEND] Successfully processed account draft ${draft.id} for debtor ${debtor.id}`);
      } catch (error) {
        console.error(`[AUTO-SEND] Exception processing account draft ${draft.id}:`, error);
        errors.push(`Draft ${draft.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[AUTO-SEND] Completed: ${sentCount} drafts sent, ${skippedCount} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Sent ${sentCount} approved drafts, skipped ${skippedCount}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[AUTO-SEND] Error in auto-send-approved-drafts:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
