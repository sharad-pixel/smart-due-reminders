/**
 * UNIFIED DRAFT CONTENT ENGINE
 * 
 * This is the SINGLE SOURCE OF TRUTH for all draft content generation and template processing.
 * All edge functions that generate or process drafts MUST use this engine.
 * 
 * Features:
 * - Consistent template variable replacement
 * - Currency formatting
 * - Date formatting
 * - Placeholder cleanup (removes any unreplaced {{...}} patterns)
 * - Invoice/payment link handling
 * - Signature handling
 */

// ============================================================================
// TYPES
// ============================================================================

export interface InvoiceData {
  id: string;
  invoice_number: string;
  amount: number;
  amount_outstanding?: number;
  currency?: string;
  due_date: string;
  status?: string;
  product_description?: string;
  external_link?: string;
  stripe_hosted_url?: string;
  integration_url?: string;
}

export interface DebtorData {
  id?: string;
  name?: string;
  company_name?: string;
}

export interface BrandingData {
  business_name?: string;
  from_name?: string;
  email_signature?: string;
  email_footer?: string;
  stripe_payment_link?: string;
  ar_page_public_token?: string;
  ar_page_enabled?: boolean;
  escalation_contact_name?: string;
  escalation_contact_email?: string;
  escalation_contact_phone?: string;
}

export interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  is_primary?: boolean;
}

export interface DraftContentInput {
  template: string;
  subjectTemplate?: string;
  invoice: InvoiceData;
  debtor: DebtorData;
  branding: BrandingData;
  contactName?: string;
  personaName?: string;
  daysPastDue?: number;
  includeInvoiceLink?: boolean;
  includePaymentLink?: boolean;
  includeArPortal?: boolean;
  includeSignature?: boolean;
}

export interface DraftContentOutput {
  body: string;
  subject: string;
  cleanedBody: string;
  cleanedSubject: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format a date in a human-readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Calculate days past due from a due date
 */
export function calculateDaysPastDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - due.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Get the best available invoice link
 */
export function getInvoiceLink(invoice: InvoiceData): string {
  return invoice.external_link || invoice.stripe_hosted_url || invoice.integration_url || '';
}

/**
 * Build AR portal URL from branding settings
 */
export function getArPortalUrl(branding: BrandingData): string {
  if (branding.ar_page_public_token && branding.ar_page_enabled) {
    return `https://recouply.ai/ar/${branding.ar_page_public_token}`;
  }
  return '';
}

/**
 * CRITICAL: Remove all unreplaced placeholders from text
 * This is the safety net that ensures no {{...}} patterns ever reach end users
 */
export function cleanupPlaceholders(text: string): string {
  if (!text) return text;
  // Remove any remaining {{...}} placeholders
  let result = text.replace(/\{\{[^}]+\}\}/g, '');
  
  // CRITICAL: Clean up malformed greetings where name is missing
  // Handle various patterns: "Hello ," "Hello  ," "Hello," with extra spaces
  // Convert to proper greeting with fallback
  result = result.replace(/\bHi\s*,\s*/gi, 'Hi there, ');
  result = result.replace(/\bHello\s*,\s*/gi, 'Hello, ');
  result = result.replace(/\bDear\s*,\s*/gi, 'Dear Customer, ');
  
  // Handle "Hi [empty]," patterns more aggressively - any greeting followed by just comma
  result = result.replace(/\b(Hi|Hello|Dear)\s+,/gi, '$1 there,');
  
  // Clean up double spaces that result from placeholder removal
  result = result.replace(/\s{2,}/g, ' ');
  
  // Clean up "at ." or "with ." patterns where company name is missing
  result = result.replace(/\bat\s*\./gi, 'with your company.');
  result = result.replace(/\bwith you at\s*\./gi, 'with you.');
  result = result.replace(/\brelationship with\s*\./gi, 'relationship.');
  
  // CRITICAL: Replace generic "Our Company" with nothing or proper fallback
  // This handles cases where branding.business_name was not set
  result = result.replace(/\bfrom Our Company\b/gi, '');
  result = result.replace(/\bOur Company family\b/gi, 'our valued customers');
  result = result.replace(/\bOur Company\b/gi, 'our team');
  
  // Clean up raw numbers that should be currency (pattern like "for 2995" or "of 2995")
  result = result.replace(/\b(for|of|is|totaling|totals)\s+(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)\b(?!\.\d)/gi, (match, preposition, num) => {
    const cleanNum = parseFloat(num.replace(/,/g, ''));
    if (!isNaN(cleanNum) && cleanNum > 100) {
      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cleanNum);
      return `${preposition} ${formatted}`;
    }
    return match;
  });
  
  return result;
}

/**
 * Strip URLs from a subject line - URLs should only appear in email body
 */
export function sanitizeSubjectLine(subject: string): string {
  if (!subject) return subject;
  let result = subject;
  // Remove URLs
  result = result.replace(/https?:\/\/[^\s<>"]+/gi, '').trim();
  // Clean up any leftover "View your invoice:" text without URL
  result = result.replace(/View your invoice:\s*/gi, '').trim();
  // Clean up extra whitespace
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

// ============================================================================
// MAIN TEMPLATE REPLACEMENT FUNCTION
// ============================================================================

/**
 * Replace all template variables with actual values
 * This is the SINGLE function that handles ALL template variable replacement
 */
export function replaceTemplateVariables(
  text: string,
  input: {
    invoice: InvoiceData;
    debtor: DebtorData;
    branding: BrandingData;
    contactName?: string;
    personaName?: string;
    daysPastDue?: number;
  }
): string {
  if (!text) return text;

  const { invoice, debtor, branding, contactName, personaName, daysPastDue: providedDpd } = input;

  // Resolve values with proper fallbacks
  // CRITICAL: customerName is the contact/person name, customerCompany is the ACCOUNT company name
  const customerName = contactName || debtor.name || debtor.company_name || 'Valued Customer';
  const customerCompany = debtor.company_name || debtor.name || 'Customer';
  
  // CRITICAL: businessName is the SENDER's company (from branding), not the customer's company
  // Never fall back to generic "Our Company" - use the actual branding value or a more specific fallback
  const businessName = branding.business_name || branding.from_name || '';
  const fromName = branding.from_name || businessName || 'Collections Team';
  
  // Calculate days past due if not provided
  const daysPastDue = providedDpd ?? calculateDaysPastDue(invoice.due_date);
  
  // Format currency amounts
  const currency = invoice.currency || 'USD';
  const formattedAmount = formatCurrency(invoice.amount || 0, currency);
  const formattedOutstanding = formatCurrency(invoice.amount_outstanding ?? invoice.amount ?? 0, currency);
  
  // Format date
  const formattedDueDate = formatDate(invoice.due_date);
  
  // Get links
  const invoiceLink = getInvoiceLink(invoice);
  const paymentLink = branding.stripe_payment_link || '';
  const arPortalUrl = getArPortalUrl(branding);
  const productDescription = invoice.product_description || '';
  
  // Agent/Persona name
  const agentName = personaName || 'Collections Team';

  // Build comprehensive replacement map (case-insensitive)
  // CRITICAL DISTINCTION:
  // - customer_name, customer_company, debtor_* = the RECIPIENT (who owes money)
  // - business_name, company_name, from_name = the SENDER (who is collecting)
  const replacements: Record<string, string> = {
    // ========================================
    // RECIPIENT (Customer/Debtor) variables
    // ========================================
    '{{customer_name}}': customerName,
    '{{customer name}}': customerName,
    '{{debtor_name}}': customerName,
    '{{debtor name}}': customerName,
    '{{name}}': customerName,
    '{{contact_name}}': customerName,
    
    // Customer company - the company that OWES money
    '{{customer_company}}': customerCompany,
    '{{customer company}}': customerCompany,
    '{{debtor_company}}': customerCompany,
    '{{debtor company}}': customerCompany,
    '{{account_name}}': customerCompany,
    
    // ========================================
    // SENDER (Your Business) variables
    // ========================================
    // CRITICAL: These refer to the SENDER's business from branding settings
    '{{company_name}}': businessName,
    '{{company name}}': businessName,
    '{{business_name}}': businessName,
    '{{businessName}}': businessName,
    '{{sender_company}}': businessName,
    '{{your_company}}': businessName,
    '{{our_company}}': businessName,
    '{{from_name}}': fromName,
    '{{fromName}}': fromName,
    '{{sender_name}}': fromName,
    
    // Invoice number variations
    '{{invoice_number}}': invoice.invoice_number,
    '{{invoice number}}': invoice.invoice_number,
    '{{invoiceNumber}}': invoice.invoice_number,
    '{{invoice_id}}': invoice.invoice_number,
    
    // Amount variations (all use formatted currency)
    '{{amount}}': formattedAmount,
    '{{balance}}': formattedOutstanding,
    '{{total}}': formattedAmount,
    '{{invoice_amount}}': formattedAmount,
    '{{amount_outstanding}}': formattedOutstanding,
    '{{outstanding_balance}}': formattedOutstanding,
    '{{amount_due}}': formattedOutstanding,
    
    // Currency - remove standalone since amounts are formatted
    '{{currency}}': '',
    
    // Due date variations
    '{{due_date}}': formattedDueDate,
    '{{due date}}': formattedDueDate,
    '{{dueDate}}': formattedDueDate,
    
    // Days past due variations
    '{{days_past_due}}': String(daysPastDue),
    '{{days past due}}': String(daysPastDue),
    '{{daysPastDue}}': String(daysPastDue),
    '{{dpd}}': String(daysPastDue),
    
    // Payment link variations
    '{{payment_link}}': paymentLink,
    '{{payment link}}': paymentLink,
    '{{paymentLink}}': paymentLink,
    '{{pay_link}}': paymentLink,
    '{{stripe_link}}': paymentLink,
    '{{stripe_payment_link}}': paymentLink,
    
    // Invoice link variations
    '{{invoice_link}}': invoiceLink,
    '{{invoice link}}': invoiceLink,
    '{{invoiceLink}}': invoiceLink,
    '{{external_link}}': invoiceLink,
    '{{integration_url}}': invoiceLink,
    '{{view_invoice}}': invoiceLink,
    
    // AR Portal link
    '{{ar_portal_link}}': arPortalUrl,
    '{{portal_link}}': arPortalUrl,
    '{{ar_page_link}}': arPortalUrl,
    
    // Product/Service description variations
    '{{product_description}}': productDescription,
    '{{product description}}': productDescription,
    '{{productDescription}}': productDescription,
    '{{service_description}}': productDescription,
    '{{description}}': productDescription,
    '{{service}}': productDescription,
    '{{product}}': productDescription,
    
    // Agent/Persona name (for email signatures)
    '{{agent_name}}': agentName,
    '{{persona_name}}': agentName,
  };

  let result = text;
  
  // Apply all replacements (case-insensitive)
  for (const [placeholder, value] of Object.entries(replacements)) {
    // Create case-insensitive regex for each placeholder
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedPlaceholder, 'gi'), value);
  }

  return result;
}

// ============================================================================
// MAIN DRAFT CONTENT PROCESSOR
// ============================================================================

/**
 * Process draft content with full template replacement and cleanup
 * This is the MAIN function that should be called for all draft generation
 */
export function processDraftContent(input: DraftContentInput): DraftContentOutput {
  const {
    template,
    subjectTemplate,
    invoice,
    debtor,
    branding,
    contactName,
    personaName,
    daysPastDue,
    includeInvoiceLink = true,
    includePaymentLink = true,
    includeArPortal = true,
    includeSignature = true,
  } = input;

  // Step 1: Replace all template variables
  let body = replaceTemplateVariables(template, {
    invoice,
    debtor,
    branding,
    contactName,
    personaName,
    daysPastDue,
  });

  let subject = subjectTemplate 
    ? replaceTemplateVariables(subjectTemplate, {
        invoice,
        debtor,
        branding,
        contactName,
        personaName,
        daysPastDue,
      })
    : `Invoice ${invoice.invoice_number} - Payment Reminder`;

  // Step 2: Auto-append useful links if not already present
  const invoiceLink = getInvoiceLink(invoice);
  const paymentLink = branding.stripe_payment_link || '';
  const arPortalUrl = getArPortalUrl(branding);

  if (includeInvoiceLink && invoiceLink && !body.includes(invoiceLink)) {
    body += `\n\nView your invoice: ${invoiceLink}`;
  }

  if (includePaymentLink && paymentLink && !body.includes(paymentLink)) {
    body += `\n\n💳 Make a payment: ${paymentLink}`;
  }

  if (includeArPortal && arPortalUrl && !body.includes(arPortalUrl)) {
    body += `\n\n📄 Access your account portal: ${arPortalUrl}`;
  }

  // Step 3: Add signature if available and requested
  if (includeSignature && branding.email_signature && !body.includes(branding.email_signature)) {
    body += `\n\n---\n${branding.email_signature}`;
  } else if (includeSignature && !branding.email_signature) {
    // Default signature using persona/business name
    // CRITICAL: Never use generic "Our Company" fallback
    const agentName = personaName || 'Collections Team';
    const senderBusinessName = branding.business_name || branding.from_name || '';
    
    let contactSection = `\n\n---\nBest regards,\n${agentName}`;
    if (senderBusinessName) {
      contactSection += `\n${senderBusinessName}`;
    }
    if (branding.escalation_contact_email) {
      contactSection += `\nEmail: ${branding.escalation_contact_email}`;
    }
    if (branding.escalation_contact_phone) {
      contactSection += `\nPhone: ${branding.escalation_contact_phone}`;
    }
    
    body += contactSection;
  }

  // Step 4: CRITICAL - Clean up any remaining placeholders
  const cleanedBody = cleanupPlaceholders(body);
  // CRITICAL: Also sanitize subject line to remove any URLs (they should only be in body)
  const cleanedSubject = sanitizeSubjectLine(cleanupPlaceholders(subject));

  return {
    body,
    subject,
    cleanedBody,
    cleanedSubject,
  };
}

// ============================================================================
// CONVENIENCE FUNCTION FOR SIMPLE REPLACEMENT + CLEANUP
// ============================================================================

/**
 * Quick replacement and cleanup for existing content
 * Use this when you already have draft content that just needs cleanup
 */
export function cleanAndReplaceContent(
  text: string,
  invoice: InvoiceData,
  debtor: DebtorData,
  branding: BrandingData,
  contactName?: string,
  personaName?: string
): string {
  // First replace any remaining variables
  const replaced = replaceTemplateVariables(text, {
    invoice,
    debtor,
    branding,
    contactName,
    personaName,
  });
  
  // Then clean up any that couldn't be replaced
  return cleanupPlaceholders(replaced);
}

/**
 * Clean and sanitize a subject line specifically
 * Removes placeholders AND URLs from subjects
 */
export function cleanSubjectLine(
  subject: string,
  invoice: InvoiceData,
  debtor: DebtorData,
  branding: BrandingData,
  contactName?: string,
  personaName?: string
): string {
  // First replace any remaining variables
  const replaced = replaceTemplateVariables(subject, {
    invoice,
    debtor,
    branding,
    contactName,
    personaName,
  });
  
  // Clean placeholders then sanitize for subject (removes URLs)
  return sanitizeSubjectLine(cleanupPlaceholders(replaced));
}
