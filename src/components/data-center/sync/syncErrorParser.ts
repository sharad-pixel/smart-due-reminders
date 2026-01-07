/**
 * Utilities for parsing and grouping sync errors into human-readable messages
 * with remediation suggestions for enterprise-grade error handling
 */

export interface ParsedSyncError {
  type: string;
  message: string;
  count: number;
  details?: string[];
  remedy?: string;
}

export interface GroupedErrors {
  summary: string;
  groups: ParsedSyncError[];
  totalCount: number;
}

// Common error patterns to match, humanize, and provide remediation
const ERROR_PATTERNS: { 
  pattern: RegExp; 
  type: string; 
  getMessage: (match: RegExpMatchArray) => string;
  getRemedy?: (match: RegExpMatchArray) => string;
}[] = [
  {
    pattern: /invalid input value for enum.*status.*"([^"]+)"/i,
    type: 'unsupported_status',
    getMessage: (match) => `Unsupported status: ${match[1]}`,
    getRemedy: (match) => `The status "${match[1]}" from your billing system is not yet mapped. This has been fixed - please re-run sync.`
  },
  {
    pattern: /INVOICE_UPSERT_FAILED.*qb_invoice_id=([^:]+).*doc=([^:]+).*invalid input value.*"([^"]+)"/i,
    type: 'invoice_status_error',
    getMessage: (match) => `Invoice ${match[2]}: Status "${match[3]}" not supported`,
    getRemedy: () => `QuickBooks invoice has an unmapped status. Please re-run sync - this issue has been fixed.`
  },
  {
    pattern: /INVOICE_UPSERT_FAILED.*stripe_invoice_id=([^:]+).*invalid input value.*"([^"]+)"/i,
    type: 'invoice_status_error',
    getMessage: (match) => `Stripe invoice: Status "${match[2]}" not supported`,
    getRemedy: () => `Stripe invoice has an unmapped status. Please re-run sync - this issue has been fixed.`
  },
  {
    pattern: /there is no unique or exclusion constraint matching the ON CONFLICT/i,
    type: 'constraint_error',
    getMessage: () => `Database constraint missing`,
    getRemedy: () => `A required database constraint was missing. This has been fixed - please re-run sync.`
  },
  {
    pattern: /CONTACT_UPSERT_FAILED.*qb_customer_id=([^:]+)/i,
    type: 'contact_error',
    getMessage: () => `Contact sync failed`,
    getRemedy: () => `A database constraint issue has been fixed. Please re-run sync to import contacts.`
  },
  {
    pattern: /CUSTOMER_UPSERT_FAILED.*qb_customer_id=([^:]+).*name=([^:]+)/i,
    type: 'customer_error',
    getMessage: (match) => `Customer sync failed: ${match[2]}`,
    getRemedy: () => `The customer record has missing or invalid data. Verify the customer in QuickBooks has a valid name and email.`
  },
  {
    pattern: /PAYMENT_UPSERT_FAILED.*qb_payment_id=([^:]+)/i,
    type: 'payment_error',
    getMessage: () => `Payment sync failed`,
    getRemedy: () => `The payment could not be matched to an invoice. Ensure the payment is linked to a synced invoice in QuickBooks.`
  },
  {
    pattern: /No matching customer/i,
    type: 'missing_customer',
    getMessage: () => `Invoice has no matching customer`,
    getRemedy: () => `The invoice references a customer not yet synced. Re-run sync to ensure customers are imported first.`
  },
  {
    pattern: /foreign key.*debtors/i,
    type: 'missing_customer',
    getMessage: () => `Customer not found in system`,
    getRemedy: () => `The invoice references a customer that doesn't exist. Re-sync to import all customers.`
  },
  {
    pattern: /violates not-null constraint.*"([^"]+)"/i,
    type: 'missing_field',
    getMessage: (match) => `Required field missing: ${match[1]}`,
    getRemedy: (match) => `The ${match[1]} field is required but was empty. Check the source record in your billing system.`
  },
  {
    pattern: /duplicate key.*unique constraint/i,
    type: 'duplicate',
    getMessage: () => `Duplicate record`,
    getRemedy: () => `This record already exists. No action needed - the existing record is preserved.`
  },
  {
    pattern: /timeout/i,
    type: 'timeout',
    getMessage: () => `Request timed out`,
    getRemedy: () => `The sync took too long. Try syncing again - partial syncs will resume where they left off.`
  },
  {
    pattern: /rate limit/i,
    type: 'rate_limit',
    getMessage: () => `Rate limit exceeded`,
    getRemedy: () => `Too many requests were made. Wait a few minutes and try again.`
  },
  {
    pattern: /Failed to refresh token/i,
    type: 'auth_expired',
    getMessage: () => `Authentication expired`,
    getRemedy: () => `Your connection to the billing system has expired. Please reconnect your account in Settings.`
  },
];

export function parseErrorMessage(error: string): { type: string; message: string; remedy?: string } {
  for (const { pattern, type, getMessage, getRemedy } of ERROR_PATTERNS) {
    const match = error.match(pattern);
    if (match) {
      return { 
        type, 
        message: getMessage(match),
        remedy: getRemedy ? getRemedy(match) : undefined
      };
    }
  }
  
  // Truncate long generic errors
  const truncated = error.length > 100 ? error.substring(0, 100) + '...' : error;
  return { type: 'unknown', message: truncated };
}

export function groupSyncErrors(errors: (string | object)[] | null | undefined): GroupedErrors | null {
  if (!errors || !Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  const errorStrings = errors.map(e => typeof e === 'string' ? e : JSON.stringify(e));
  const grouped = new Map<string, { message: string; count: number; details: string[]; remedy?: string }>();

  for (const error of errorStrings) {
    const parsed = parseErrorMessage(error);
    const key = parsed.type;
    
    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      existing.count++;
      if (existing.details.length < 5) {
        existing.details.push(error);
      }
    } else {
      grouped.set(key, {
        message: parsed.message,
        count: 1,
        details: [error],
        remedy: parsed.remedy
      });
    }
  }

  const groups: ParsedSyncError[] = Array.from(grouped.entries()).map(([type, data]) => ({
    type,
    message: data.message,
    count: data.count,
    details: data.details,
    remedy: data.remedy
  }));

  // Sort by count descending
  groups.sort((a, b) => b.count - a.count);

  const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
  const topIssue = groups[0];
  
  let summary = `${totalCount} issue${totalCount !== 1 ? 's' : ''} detected`;
  if (topIssue && totalCount > 1) {
    summary = `${topIssue.count} ${topIssue.count === 1 ? 'record' : 'records'} failed: ${topIssue.message}`;
    if (groups.length > 1) {
      summary += ` (+${totalCount - topIssue.count} other issues)`;
    }
  } else if (topIssue) {
    summary = topIssue.message;
  }

  return { summary, groups, totalCount };
}

export function getErrorTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    unsupported_status: 'Unsupported Status',
    invoice_status_error: 'Invoice Status Error',
    contact_error: 'Contact Sync Error',
    customer_error: 'Customer Sync Error',
    payment_error: 'Payment Sync Error',
    missing_customer: 'Missing Customer',
    missing_field: 'Missing Required Field',
    duplicate: 'Duplicate Record',
    timeout: 'Timeout',
    rate_limit: 'Rate Limit',
    auth_expired: 'Authentication Expired',
    constraint_error: 'Database Constraint',
    unknown: 'Other Error'
  };
  return labels[type] || 'Error';
}

export function getErrorTypeIcon(type: string): 'warning' | 'error' | 'info' {
  const severeTypes = ['timeout', 'rate_limit', 'missing_customer', 'auth_expired'];
  const infoTypes = ['duplicate'];
  
  if (severeTypes.includes(type)) return 'error';
  if (infoTypes.includes(type)) return 'info';
  return 'warning';
}
