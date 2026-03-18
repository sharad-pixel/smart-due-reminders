/**
 * Shared formatting utilities used across the application.
 * Consolidates duplicate formatCurrency / formatDate patterns.
 */

/**
 * Format a number as currency with exactly 2 decimal places.
 * Supports any ISO 4217 currency code.
 */
export function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined) return getCurrencySymbol(currency) + '0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', JPY: '¥', CHF: 'CHF ' };
  return symbols[currency] || `${currency} `;
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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
