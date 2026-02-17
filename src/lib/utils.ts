import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency with exactly 2 decimal places.
 * Always displays xx.xx format - never rounds or truncates decimals.
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
