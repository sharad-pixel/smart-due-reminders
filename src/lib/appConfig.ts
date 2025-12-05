// App configuration for redirects and URLs
// Use custom domain for production, fallback to current origin for development

const PRODUCTION_DOMAIN = 'https://recouply.ai';

// Supabase project configuration
export const SUPABASE_PROJECT_ID = 'kguurazunazhhrhasahd';
export const SUPABASE_CALLBACK_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/auth/v1/callback`;

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
    if (origin.includes('lovable.app') || origin.includes('lovableproject.com') || origin.includes('localhost')) {
      return origin;
    }
  }
  // Default to production domain
  return PRODUCTION_DOMAIN;
};

// Get redirect URL for auth callbacks (where user goes AFTER OAuth completes)
export const getAuthRedirectUrl = (path: string = '/dashboard'): string => {
  return `${getAppUrl()}${path}`;
};

// Check if an error is a redirect_uri_mismatch error from Google OAuth
export const isRedirectUriMismatchError = (error: any): boolean => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toLowerCase() || '';
  return (
    errorMessage.includes('redirect_uri_mismatch') ||
    errorMessage.includes('redirect uri') ||
    errorCode.includes('redirect_uri_mismatch')
  );
};

// Get the list of redirect URIs that need to be configured in Google Cloud Console
export const getRequiredGoogleRedirectUris = (): string[] => {
  const uris = [SUPABASE_CALLBACK_URL];
  return uris;
};
