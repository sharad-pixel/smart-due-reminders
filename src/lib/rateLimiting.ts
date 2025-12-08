/**
 * Client-side rate limiting utilities for protecting data entry points
 * These work in conjunction with server-side rate limiting in edge functions
 */

// Rate limit configurations by action type
export const RATE_LIMITS = {
  form_submit: { maxRequests: 10, windowMinutes: 5, blockDurationMinutes: 15 },
  ai_command: { maxRequests: 50, windowMinutes: 60, blockDurationMinutes: 30 },
  file_upload: { maxRequests: 20, windowMinutes: 60, blockDurationMinutes: 15 },
  api_call: { maxRequests: 100, windowMinutes: 60, blockDurationMinutes: 15 },
  contact_form: { maxRequests: 3, windowMinutes: 60, blockDurationMinutes: 60 },
  login_attempt: { maxRequests: 5, windowMinutes: 15, blockDurationMinutes: 15 },
  signup_attempt: { maxRequests: 3, windowMinutes: 60, blockDurationMinutes: 60 },
  email_send: { maxRequests: 50, windowMinutes: 60, blockDurationMinutes: 30 },
  data_import: { maxRequests: 10, windowMinutes: 60, blockDurationMinutes: 30 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

// Client-side rate limit tracking (supplementary to server-side)
const clientRateLimits = new Map<string, { count: number; windowStart: number }>();

export function checkClientRateLimit(action: RateLimitAction): { allowed: boolean; remaining: number } {
  const config = RATE_LIMITS[action];
  const key = `${action}`;
  const now = Date.now();
  const windowMs = config.windowMinutes * 60 * 1000;
  
  const existing = clientRateLimits.get(key);
  
  if (!existing || now - existing.windowStart > windowMs) {
    clientRateLimits.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }
  
  if (existing.count >= config.maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  existing.count++;
  return { allowed: true, remaining: config.maxRequests - existing.count };
}

// Reset client rate limit (for testing or after successful auth)
export function resetClientRateLimit(action: RateLimitAction): void {
  clientRateLimits.delete(action);
}
