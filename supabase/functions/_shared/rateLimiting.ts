import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Server-side rate limiting utilities for edge functions
 * Uses database-backed rate limiting with automatic blocking
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
  blockDurationMinutes: number;
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  form_submit: { maxRequests: 10, windowMinutes: 5, blockDurationMinutes: 15 },
  ai_command: { maxRequests: 50, windowMinutes: 60, blockDurationMinutes: 30 },
  file_upload: { maxRequests: 20, windowMinutes: 60, blockDurationMinutes: 15 },
  api_call: { maxRequests: 100, windowMinutes: 60, blockDurationMinutes: 15 },
  contact_form: { maxRequests: 3, windowMinutes: 60, blockDurationMinutes: 60 },
  login_attempt: { maxRequests: 5, windowMinutes: 15, blockDurationMinutes: 15 },
  signup_attempt: { maxRequests: 3, windowMinutes: 60, blockDurationMinutes: 60 },
  email_send: { maxRequests: 50, windowMinutes: 60, blockDurationMinutes: 30 },
  data_import: { maxRequests: 10, windowMinutes: 60, blockDurationMinutes: 30 },
};

export interface RateLimitResult {
  allowed: boolean;
  blocked?: boolean;
  blocked_until?: string;
  remaining?: number;
  message?: string;
}

/**
 * Check rate limit for an action
 * @param identifier - IP address, user ID, or composite key
 * @param actionType - Type of action being rate limited
 * @param customConfig - Optional custom rate limit configuration
 */
export async function checkRateLimit(
  identifier: string,
  actionType: string,
  customConfig?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const config = { ...RATE_LIMIT_CONFIGS[actionType], ...customConfig };
  
  if (!config.maxRequests) {
    // Default fallback config
    config.maxRequests = 100;
    config.windowMinutes = 60;
    config.blockDurationMinutes = 15;
  }

  const { data, error } = await supabaseClient.rpc('check_action_rate_limit', {
    p_identifier: identifier,
    p_action_type: actionType,
    p_max_requests: config.maxRequests,
    p_window_minutes: config.windowMinutes,
    p_block_duration_minutes: config.blockDurationMinutes,
  });

  if (error) {
    console.error('Rate limit check error:', error);
    // Fail open but log for monitoring
    return { allowed: true, remaining: 0 };
  }

  return data as RateLimitResult;
}

/**
 * Get client IP from request headers
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Create rate limit exceeded response
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: result.message || 'Rate limit exceeded. Please try again later.',
      blocked_until: result.blocked_until,
      retry_after: result.blocked_until 
        ? Math.ceil((new Date(result.blocked_until).getTime() - Date.now()) / 1000)
        : 900,
    }),
    {
      status: 429,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Retry-After': '900',
      },
    }
  );
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
  userId: string | null,
  ipAddress: string,
  actionType: string,
  details: Record<string, unknown>,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<void> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  await supabaseClient.from('suspicious_activity_log').insert({
    user_id: userId,
    ip_address: ipAddress,
    action_type: actionType,
    details,
    severity,
  });
}

/**
 * Validate honeypot field (should be empty)
 */
export function validateHoneypot(value: string | undefined | null): boolean {
  return !value || value.trim() === '';
}

/**
 * Check for bot-like behavior patterns
 */
export function detectBotBehavior(req: Request): { isBot: boolean; reason?: string } {
  const userAgent = req.headers.get('user-agent') || '';
  
  // Check for missing or suspicious user agents
  if (!userAgent || userAgent.length < 10) {
    return { isBot: true, reason: 'missing_user_agent' };
  }
  
  // Known bot patterns
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /httpie/i,
  ];
  
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    return { isBot: true, reason: 'bot_user_agent' };
  }
  
  return { isBot: false };
}
