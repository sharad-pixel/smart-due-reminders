## Support Access Feature

Lets account owners grant the Recouply.ai support / solutions team scoped, time-limited access into their workspace to test functionality, troubleshoot issues, or assist with setup — fully audited and revocable in one click.

### How it works (user view)

On **Settings → Team** (and a new card on **Settings → Security**), owners see a **Support Access** panel:

- **Status badge**: "No access granted" / "Active until <date>" / "Expired"
- **Grant Access** button opens a modal:
  - Duration: 24 hours / 7 days / 30 days (default 7 days)
  - Scope: "View only" or "Full access (can make changes)"
  - Reason (optional free text — e.g., "Help with QuickBooks sync")
  - Checkbox: "I authorize Recouply support staff to access my workspace data for the selected duration"
- **Active grants** show: granted by, scope, expires at, "Revoke now" button
- **Activity log** shows which support agent accessed what and when (last 90 days)

When access is granted, an email goes to `support@recouply.ai` with the customer's name, account, scope, expiry, and a one-click link to open the workspace in support mode. A persistent banner appears at the top of the customer's app: *"Recouply Support has access until <date> — Revoke"* so the customer always knows.

### Technical design

**New table `support_access_grants`** (RLS, owner-managed):
- `id`, `account_id` (owner's user_id), `granted_by` (user_id), `scope` ('read' | 'write'), `reason`, `expires_at`, `revoked_at`, `created_at`
- Index on `(account_id, expires_at)` and `(revoked_at)`
- RLS: account owners/admins can SELECT/INSERT/UPDATE their own; `is_recouply_admin()` can SELECT all

**New table `support_access_log`** (audit trail):
- `id`, `grant_id`, `support_user_id`, `account_id`, `action`, `route`, `details` jsonb, `created_at`
- RLS: owners can SELECT for their account; recouply admins can SELECT all + INSERT

**Helper function `has_active_support_access(account_id)`** → boolean
- Returns true if a non-revoked grant exists with `expires_at > now()`
- Used inside RLS policies on sensitive tables to extend access to support staff via a new `is_support_with_access(auth.uid(), account_id)` SECURITY DEFINER function that checks `is_recouply_admin(auth.uid())` AND `has_active_support_access(account_id)`

**Scheduled cleanup**: extend the existing data retention cron to auto-mark expired grants and prune log entries >90 days.

**Edge function `grant-support-access`**:
- Validates owner/admin role, creates grant row, emails `support@recouply.ai` (Resend) with grant details and a deep link `/admin/support-impersonate?account=<id>` for the support team to use.
- Logs action to `admin_user_actions` for compliance.

**Edge function `revoke-support-access`**:
- Sets `revoked_at = now()`, emails support, logs action.

**Support-side access** (admin app):
- New page `src/pages/admin/AdminSupportAccess.tsx` listing active grants across all customers
- "Open as support" button sets a session flag that scopes queries to that account_id (read-only or write per grant scope) — leverages existing `get_effective_account_id` pattern but gated by `is_support_with_access`.

**UI components**:
- `src/components/team/SupportAccessCard.tsx` — main grant/revoke UI on Team and Security pages
- `src/components/security/SupportAccessBanner.tsx` — persistent top banner when active
- `src/hooks/useSupportAccess.tsx` — query active grant + mutations

### Files to create
- migration: `support_access_grants`, `support_access_log`, helper functions, RLS policies
- `supabase/functions/grant-support-access/index.ts`
- `supabase/functions/revoke-support-access/index.ts`
- `src/components/team/SupportAccessCard.tsx`
- `src/components/security/SupportAccessBanner.tsx`
- `src/hooks/useSupportAccess.tsx`
- `src/pages/admin/AdminSupportAccess.tsx` (+ route)

### Files to edit
- `src/pages/Team.tsx` — add SupportAccessCard
- `src/pages/SecurityDashboard.tsx` — add SupportAccessCard
- `src/App.tsx` — mount `SupportAccessBanner` globally for authed routes; add `/admin/support-access` route
- `src/components/admin/AdminLayout.tsx` — nav link "Support Access"

### Security & compliance
- Default duration cap: 30 days max (server-enforced)
- Only `owner` or `admin` roles can grant/revoke (server-enforced via `is_account_manager`)
- Every support action logged to `support_access_log` and `admin_user_actions`
- Banner is always visible to the customer while active — no silent access
- Auto-expires; revoke is instant (RLS re-checks on every query)
- Add a Trust Center mention on `src/pages/trust/AccessControl.tsx`

### Out of scope (can be follow-ups)
- Granular per-table scope (just read vs write for v1)
- Customer-side notification email when support actually logs in (can add later)
