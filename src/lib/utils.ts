import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency with exactly 2 decimal places.
 * Always displays xx.xx format - never rounds or truncates decimals.
 */
const SYMBOL_TO_CODE: Record<string, string> = {
  '$': 'USD', 'US$': 'USD', 'USD$': 'USD',
  '€': 'EUR', '£': 'GBP', '¥': 'JPY',
  'CA$': 'CAD', 'A$': 'AUD', 'CHF': 'CHF',
};

function normalizeCurrencyCode(currency?: string | null): string {
  if (!currency) return 'USD';
  const trimmed = String(currency).trim();
  if (!trimmed) return 'USD';
  if (SYMBOL_TO_CODE[trimmed]) return SYMBOL_TO_CODE[trimmed];
  // Valid ISO codes are 3 alpha chars
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return 'USD';
}

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
    return getCurrencySymbol(code) + amount.toFixed(2);
  }
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
