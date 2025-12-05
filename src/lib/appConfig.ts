// App configuration for redirects and URLs
// Use custom domain for production, fallback to current origin for development

const PRODUCTION_DOMAIN = 'https://recouply.ai';

// Use production domain if deployed, otherwise use current origin (for preview/dev)
export const getAppUrl = (): string => {
  // In production builds or when on custom domain, use the production URL
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // If already on the custom domain, use it
    if (origin.includes('recouply.ai')) {
      return PRODUCTION_DOMAIN;
    }
    // For Lovable preview URLs, use the current origin
    if (origin.includes('lovable.app') || origin.includes('localhost')) {
      return origin;
    }
  }
  // Default to production domain
  return PRODUCTION_DOMAIN;
};

// Get redirect URL for auth callbacks
export const getAuthRedirectUrl = (path: string = '/dashboard'): string => {
  return `${getAppUrl()}${path}`;
};
