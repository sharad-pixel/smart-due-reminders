# SSO Setup Guide for Recouply.ai

This guide explains how to configure Google OAuth for Recouply.ai.

## ⚠️ CRITICAL: Required Google Cloud Console Configuration

For Google OAuth to work, you MUST add the following redirect URI to your Google Cloud Console:

```
https://kguurazunazhhrhasahd.supabase.co/auth/v1/callback
```

**This is the Supabase callback URL that handles the OAuth response. Without this exact URI configured, you will get a `redirect_uri_mismatch` error.**

## Overview

Recouply.ai uses Supabase Auth to enable enterprise SSO login with:
- **Google Workspace** (Google OAuth)

## Quick Setup Checklist

1. ✅ Create OAuth 2.0 credentials in Google Cloud Console
2. ✅ Add the exact redirect URI: `https://kguurazunazhhrhasahd.supabase.co/auth/v1/callback`
3. ✅ Configure Google OAuth in Lovable Cloud (Users → Auth Settings → Google Settings)
4. ✅ Add authorized JavaScript origins for your app URLs

## Detailed Configuration Steps

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client IDs**
5. Select **Web application** as the application type
6. Configure the following:

**Authorized JavaScript origins:**
- `https://recouply.ai` (production)
- `https://*.lovableproject.com` (preview environments)
- `https://*.lovable.app` (preview environments)

**Authorized redirect URIs (REQUIRED):**
```
https://kguurazunazhhrhasahd.supabase.co/auth/v1/callback
```

7. Copy your **Client ID** and **Client Secret**

### 2. Configure in Lovable Cloud Backend

1. Open your Lovable Cloud backend: **Users → Auth Settings → Google Settings**
2. Enter your Google Client ID
3. Enter your Google Client Secret
4. Save and enable the provider

### 3. Set Authorized Domains

In **Users → Auth Settings → URLs and Redirects**:

**Site URL:** `https://recouply.ai`

**Redirect URLs:**
- `https://recouply.ai`
- `https://recouply.ai/dashboard`
- Your preview URLs (e.g., `https://*.lovableproject.com`)

## Frontend Implementation

The login and signup pages use:

```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: getAuthRedirectUrl('/dashboard'),
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
});
```

**Note:** The `redirectTo` option specifies where users go AFTER OAuth completes successfully. It is NOT the OAuth callback URL.

## Troubleshooting

### Error: `redirect_uri_mismatch`

**Cause:** The redirect URI in Google Cloud Console doesn't match Supabase's callback URL.

**Solution:** 
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. In **Authorized redirect URIs**, add EXACTLY:
   ```
   https://kguurazunazhhrhasahd.supabase.co/auth/v1/callback
   ```
4. Ensure there are no trailing slashes or typos
5. Wait a few minutes for changes to propagate

### Error: "provider is not enabled"

**Solution:** Enable Google OAuth in Lovable Cloud → Users → Auth Settings → Google Settings

### Error: "Invalid OAuth client"

**Solution:** Verify your Client ID and Client Secret are correctly entered in Lovable Cloud

## Security Best Practices

1. **Restrict to Work Emails**: Consider domain validation for corporate emails only
2. **Enable MFA**: Encourage users to enable 2FA through Google
3. **Regular Audits**: Review auth logs regularly
4. **Rotate Secrets**: Periodically rotate OAuth client secrets

## Summary

| Setting | Value |
|---------|-------|
| Supabase Callback URL | `https://kguurazunazhhrhasahd.supabase.co/auth/v1/callback` |
| Production Site URL | `https://recouply.ai` |
| Configure OAuth | Lovable Cloud → Users → Auth Settings → Google Settings |

## Support

For configuration help:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- Contact: support@recouply.ai
