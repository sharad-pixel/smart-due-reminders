/**
 * Enterprise Email Template for Recouply.ai Platform Communications
 * 
 * Standardized template for ALL direct communications to Recouply.ai users:
 * - Daily Digest
 * - Welcome Email
 * - Password Reset
 * - Email Verification
 * - Team Invitations
 * - Account notifications
 * 
 * Color scheme matches the site design system:
 * - Primary Blue: #3b82f6
 * - Primary Dark: #1d4ed8
 * - Accent Green: #22c55e
 * - Background: #f0f4f8 (light gray from logo)
 * - Wordmark: Blue→Green gradient for "Recouply.ai"
 */

import { INBOUND_EMAIL_DOMAIN } from "./emailConfig.ts";

// Brand constants aligned with site design system + logo screenshot
export const BRAND = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#1d4ed8',
  accent: '#22c55e',
  accentDark: '#16a34a',
  warning: '#f59e0b',
  destructive: '#ef4444',
  background: '#f0f4f8',
  foreground: '#1e293b',
  muted: '#64748b',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  surfaceLight: '#f1f5f9',
} as const;

// Brain SVG icons – email-safe inline SVGs
export const BRAIN_SVG_WHITE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;color:rgba(255,255,255,0.95);"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>`;

export const BRAIN_SVG_BLUE = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;color:#3b82f6;"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>`;

export const BRAIN_SVG_FOOTER = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;color:rgba(255,255,255,0.7);"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>`;

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

/**
 * The Recouply.ai wordmark with blue→green gradient matching the logo
 * "Recouply" in slate-blue, ".ai" in green
 */
function wordmark(size: number = 22, white: boolean = false): string {
  if (white) {
    return `<span style="font-size: ${size}px; font-weight: 800; letter-spacing: -0.5px; font-family: ${FONT_STACK}; color: #ffffff;">Recouply<span style="color: ${BRAND.accent};">.ai</span></span>`;
  }
  // Blue→Green gradient text matching logo screenshot
  return `<span style="font-size: ${size}px; font-weight: 800; letter-spacing: -0.5px; font-family: ${FONT_STACK}; color: #4b7baa;">Recoup<span style="color: #3b82f6;">l</span><span style="color: #45a065;">y</span><span style="color: ${BRAND.accent};">.ai</span></span>`;
}

/**
 * Enterprise header with brain icon + Recouply.ai wordmark
 * Two styles:
 * - 'gradient': Blue gradient background with white wordmark (for digest, password reset)
 * - 'light': Light gray background with colored wordmark (matching logo screenshot)
 */
export function enterpriseHeader(options: {
  style?: 'gradient' | 'light';
  title?: string;
  subtitle?: string;
} = {}): string {
  const { style = 'gradient', title, subtitle } = options;

  if (style === 'light') {
    // Light header matching the logo screenshot exactly
    return `
    <div style="background: ${BRAND.background}; padding: 32px 24px 24px; text-align: center;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="padding-right: 10px; vertical-align: middle;">
            ${BRAIN_SVG_BLUE}
          </td>
          <td style="vertical-align: middle;">
            ${wordmark(24, false)}
          </td>
        </tr>
      </table>
      <p style="color: ${BRAND.muted}; margin: 8px 0 0; font-size: 13px; font-family: ${FONT_STACK};">
        Collection Intelligence Platform
      </p>
      ${title ? `<h1 style="color: ${BRAND.foreground}; margin: 18px 0 4px; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; font-family: ${FONT_STACK};">${title}</h1>` : ''}
      ${subtitle ? `<p style="color: ${BRAND.muted}; margin: 0; font-size: 12px; font-family: ${FONT_STACK};">${subtitle}</p>` : ''}
    </div>`;
  }

  // Gradient header (default) – premium blue gradient with white text
  return `
    <div style="background: linear-gradient(135deg, ${BRAND.primary} 0%, #2563eb 50%, ${BRAND.primaryDark} 100%); padding: 28px 24px 24px; text-align: center;">
      <div style="margin-bottom: 14px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
          <tr>
            <td style="padding-right: 10px; vertical-align: middle;">
              <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 8px; display: inline-block;">
                ${BRAIN_SVG_WHITE}
              </div>
            </td>
            <td style="vertical-align: middle;">
              ${wordmark(22, true)}
            </td>
          </tr>
        </table>
      </div>
      ${title ? `<h1 style="color: white; margin: 0 0 6px; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; font-family: ${FONT_STACK};">${title}</h1>` : ''}
      ${subtitle ? `<p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 12px; font-family: ${FONT_STACK};">${subtitle}</p>` : ''}
    </div>`;
}

/**
 * Enterprise footer with dark gradient, brain icon, nav links, and legal text
 */
export function enterpriseFooter(): string {
  const year = new Date().getFullYear();
  return `
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%); padding: 28px 24px; text-align: center;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 10px;">
        <tr>
          <td style="padding-right: 8px; vertical-align: middle;">
            ${BRAIN_SVG_FOOTER}
          </td>
          <td style="vertical-align: middle;">
            <span style="color: rgba(255,255,255,0.85); font-size: 16px; font-weight: 700; letter-spacing: -0.3px; font-family: ${FONT_STACK};">
              Recouply<span style="color: ${BRAND.accent};">.ai</span>
            </span>
          </td>
        </tr>
      </table>
      <p style="color: #93c5fd; margin: 0 0 12px; font-size: 11px; font-family: ${FONT_STACK};">
        Accounts Receivable &amp; Collection Intelligence Platform
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 14px;">
        <tr>
          <td style="padding: 0 8px;">
            <a href="https://recouply.ai/dashboard" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: ${FONT_STACK};">Dashboard</a>
          </td>
          <td style="color: rgba(255,255,255,0.2); font-size: 11px;">|</td>
          <td style="padding: 0 8px;">
            <a href="https://recouply.ai/settings" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: ${FONT_STACK};">Settings</a>
          </td>
          <td style="color: rgba(255,255,255,0.2); font-size: 11px;">|</td>
          <td style="padding: 0 8px;">
            <a href="mailto:support@${INBOUND_EMAIL_DOMAIN}" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: ${FONT_STACK};">Support</a>
          </td>
          <td style="color: rgba(255,255,255,0.2); font-size: 11px;">|</td>
          <td style="padding: 0 8px;">
            <a href="https://www.linkedin.com/company/recouplyai-inc" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: ${FONT_STACK};">LinkedIn</a>
          </td>
        </tr>
      </table>
      <p style="color: rgba(255,255,255,0.3); margin: 0; font-size: 10px; font-family: ${FONT_STACK};">
        © ${year} RecouplyAI Inc. · Delaware, USA · All rights reserved
      </p>
    </div>`;
}

/**
 * Full enterprise email shell – wraps body content with header + footer
 * 
 * @param body - Inner HTML content
 * @param options - Header configuration
 */
export function wrapEnterpriseEmail(body: string, options: {
  headerStyle?: 'gradient' | 'light';
  title?: string;
  subtitle?: string;
} = {}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="font-family: ${FONT_STACK}; margin: 0; padding: 16px; background-color: ${BRAND.background};">
  <div style="max-width: 560px; margin: 0 auto; background: ${BRAND.cardBg}; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 12px rgba(59,130,246,0.08), 0 1px 3px rgba(0,0,0,0.04);">
    ${enterpriseHeader({ style: options.headerStyle, title: options.title, subtitle: options.subtitle })}
    <div style="padding: 28px 24px;">
      ${body}
    </div>
    ${enterpriseFooter()}
  </div>
</body>
</html>`.trim();
}
