# SSO Setup Guide for Recouply.ai

This guide explains how to configure Google Workspace and Microsoft 365 SSO for Recouply.ai.

## Overview

Recouply.ai uses Supabase Auth to enable enterprise SSO login with:
- **Google Workspace** (Google OAuth)
- **Microsoft 365** (Azure AD / Microsoft OAuth)

## Configuration Steps

### 1. Access Backend Settings

Open your Lovable Cloud backend to configure OAuth providers:

**Users → Auth Settings**

### 2. Configure Google OAuth (Google Workspace)

1. Navigate to **Auth Settings → Google Settings**
2. Follow the Supabase setup wizard
3. You'll need to create OAuth credentials in Google Cloud Console:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs (provided by Supabase)

**Required Information:**
- Google Client ID
- Google Client Secret
- Authorized JavaScript origins: `https://your-app-url.lovable.app`
- Authorized redirect URIs: `https://kguurazunazhhrhasahd.supabase.co/auth/v1/callback`

### 3. Configure Microsoft OAuth (Microsoft 365 / Azure AD)

1. Navigate to **Auth Settings → Azure Settings**
2. Follow the Supabase setup wizard
3. You'll need to register an app in Azure Portal:
   - Go to [Azure Portal](https://portal.azure.com/)
   - Navigate to Azure Active Directory → App registrations
   - Create a new registration
   - Add redirect URI (provided by Supabase)
   - Create a client secret

**Required Information:**
- Azure Application (client) ID
- Azure Client Secret
- Azure Directory (tenant) ID
- Redirect URI: `https://kguurazunazhhrhasahd.supabase.co/auth/v1/callback`

### 4. Set Authorized Domains

In the Lovable Cloud backend:

**Users → Auth Settings → URLs and Redirects**

Add your application URLs:
- Preview URL: `https://your-preview-url.lovable.app`
- Production URL: `https://your-custom-domain.com` (if applicable)

**Site URL:** Set to your main application URL
**Redirect URLs:** Add all URLs where users can be redirected after authentication

## Frontend Implementation

The login and signup pages already include SSO buttons that call:

```typescript
// Google OAuth
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/dashboard`,
  }
});

// Microsoft OAuth
await supabase.auth.signInWithOAuth({
  provider: 'azure',
  options: {
    redirectTo: `${window.location.origin}/dashboard`,
  }
});
```

## Testing SSO

1. Ensure OAuth providers are fully configured in backend
2. Navigate to `/login` or `/signup`
3. Click "Continue with Google" or "Continue with Microsoft"
4. Complete OAuth flow with your work account
5. You should be redirected to `/dashboard` upon success

## Troubleshooting

### Error: "Unsupported provider: provider is not enabled"

This means the OAuth provider is not enabled in Supabase. Ensure you've:
1. Configured the provider in **Auth Settings**
2. Added Client ID and Client Secret
3. Saved and enabled the provider

### Error: "redirect_uri_mismatch"

The redirect URI in Google Cloud Console or Azure Portal doesn't match Supabase's callback URL. Make sure:
- The exact Supabase callback URL is added to authorized redirect URIs
- No trailing slashes or protocol mismatches

### Email/Password Still Works

Email/password authentication remains available as a fallback method. SSO is positioned as the primary option in the UI, but users can still sign up with email if needed.

## Security Best Practices

1. **Use Work Emails Only**: Consider adding domain validation to only allow corporate email domains
2. **Enable MFA**: Encourage users to enable MFA through their identity provider (Google/Microsoft)
3. **Regular Audits**: Review auth logs in the backend regularly
4. **Rotate Secrets**: Periodically rotate OAuth client secrets

## Environment Variables

The following environment variables are automatically managed by Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

OAuth provider credentials are stored securely in Supabase and don't need to be added to environment variables.

## Support

For configuration help, refer to:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Microsoft OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-azure)
