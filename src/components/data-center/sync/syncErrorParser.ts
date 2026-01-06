/**
 * Utilities for parsing and grouping sync errors into human-readable messages
 */

export interface ParsedSyncError {
  type: string;
  message: string;
  count: number;
  details?: string[];
}

export interface GroupedErrors {
  summary: string;
  groups: ParsedSyncError[];
  totalCount: number;
}

// Common error patterns to match and humanize
const ERROR_PATTERNS: { pattern: RegExp; type: string; getMessage: (match: RegExpMatchArray) => string }[] = [
  {
    pattern: /invalid input value for enum.*status.*"([^"]+)"/i,
    type: 'unsupported_status',
    getMessage: (match) => `Unsupported status: ${match[1]}`
  },
  {
    pattern: /INVOICE_UPSERT_FAILED.*ext_invoice_id=([^:]+).*invalid input value.*"([^"]+)"/i,
    type: 'invoice_status_error',
    getMessage: (match) => `Invoice status not supported: "${match[2]}"`
  },
  {
    pattern: /CONTACT_UPSERT_FAILED.*qb_customer_id=([^:]+)/i,
    type: 'contact_error',
    getMessage: () => `Contact sync failed`
  },
  {
    pattern: /foreign key.*debtors/i,
    type: 'missing_customer',
    getMessage: () => `Customer not found in system`
  },
  {
    pattern: /violates not-null constraint/i,
    type: 'missing_field',
    getMessage: () => `Required field missing`
  },
  {
    pattern: /duplicate key.*unique constraint/i,
    type: 'duplicate',
    getMessage: () => `Duplicate record`
  },
  {
    pattern: /timeout/i,
    type: 'timeout',
    getMessage: () => `Request timed out`
  },
  {
    pattern: /rate limit/i,
    type: 'rate_limit',
    getMessage: () => `Rate limit exceeded`
  },
];

export function parseErrorMessage(error: string): { type: string; message: string } {
  for (const { pattern, type, getMessage } of ERROR_PATTERNS) {
    const match = error.match(pattern);
    if (match) {
      return { type, message: getMessage(match) };
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
  const grouped = new Map<string, { message: string; count: number; details: string[] }>();

  for (const error of errorStrings) {
    const parsed = parseErrorMessage(error);
    const key = parsed.type;
    
    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      existing.count++;
      if (existing.details.length < 3) {
        existing.details.push(error);
      }
    } else {
      grouped.set(key, {
        message: parsed.message,
        count: 1,
        details: [error]
      });
    }
  }

  const groups: ParsedSyncError[] = Array.from(grouped.entries()).map(([type, data]) => ({
    type,
    message: data.message,
    count: data.count,
    details: data.details
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
    missing_customer: 'Missing Customer',
    missing_field: 'Missing Required Field',
    duplicate: 'Duplicate Record',
    timeout: 'Timeout',
    rate_limit: 'Rate Limit',
    unknown: 'Other Error'
  };
  return labels[type] || 'Error';
}

export function getErrorTypeIcon(type: string): 'warning' | 'error' | 'info' {
  const severeTypes = ['timeout', 'rate_limit', 'missing_customer'];
  const infoTypes = ['duplicate'];
  
  if (severeTypes.includes(type)) return 'error';
  if (infoTypes.includes(type)) return 'info';
  return 'warning';
}