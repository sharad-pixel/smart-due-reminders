/**
 * Shared formatting utilities used across the application.
 * Consolidates duplicate formatCurrency / formatDate patterns.
 */

/**
 * Format a number as currency with exactly 2 decimal places.
 * Supports any ISO 4217 currency code.
 */
export function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  const code = normalizeCurrencyCode(currency);
  if (amount === null || amount === undefined) return getCurrencySymbol(code) + '0.00';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${getCurrencySymbol(code)}${amount.toFixed(2)}`;
  }
}

/**
 * Normalize free-form currency input ("$", "usd", "US$") into an ISO 4217 code.
 */
export function normalizeCurrencyCode(input: string | null | undefined): string {
  if (!input) return 'USD';
  const raw = String(input).trim();
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  const symbolMap: Record<string, string> = {
    '$': 'USD', 'US$': 'USD', 'USD$': 'USD', 'C$': 'CAD', 'CA$': 'CAD', 'A$': 'AUD',
    '€': 'EUR', '£': 'GBP', '¥': 'JPY', 'CN¥': 'CNY', '₹': 'INR', 'CHF': 'CHF',
  };
  if (symbolMap[raw]) return symbolMap[raw];
  const upper = raw.toUpperCase();
  if (symbolMap[upper]) return symbolMap[upper];
  const match = upper.match(/[A-Z]{3}/);
  return match ? match[0] : 'USD';
}

/**
 * Get currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency: string = 'USD'): string {
  const code = normalizeCurrencyCode(currency);
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', JPY: '¥', CHF: 'CHF ' };
  return symbols[code] || `${code} `;
}

/**
 * Format a number with exactly 2 decimal places (without currency symbol).
 */
export function formatDecimal(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string to a short readable format: "MMM d, yyyy" (e.g. "Jan 5, 2024")
 * Uses date-fns format internally but exposed here to avoid inline duplication.
 */
export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    // YYYY-MM-DD (date-only) → format in UTC to avoid timezone shifting the day
    // (e.g. "2025-12-30" parsed as UTC midnight would display as Dec 29 in negative offsets).
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateString);
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...(dateOnly ? { timeZone: 'UTC' } : {}),
    });
  } catch {
    return 'N/A';
  }
}


/**
 * Format a date string to include time: "MMM d, yyyy h:mm a"
 */
export function formatDateTimeFull(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
}
