# Stripe-style Left Sidebar + Full-Width App Layout

Today the signed-in app uses `src/components/layout/Layout.tsx` — a top navigation bar with dropdowns, and every page renders inside a `max-w-7xl mx-auto` container, which is why content looks condensed vs. Stripe's edge-to-edge dashboard.

Goal: match the Stripe pattern from your screenshot — a persistent left sidebar with grouped navigation + user/account area, and a main content region that uses the full remaining width of the viewport.

Marketing pages (`MarketingLayout`), the founder `AdminLayout`, and the debtor portal are out of scope — this only changes the authenticated product shell.

## What changes

1. **New shell using shadcn `Sidebar`**
   - New `src/components/layout/AppSidebar.tsx` built on `SidebarProvider` / `Sidebar` / `SidebarGroup` / `SidebarMenu` (already in `src/components/ui/sidebar.tsx`).
   - Sidebar sections mirror today's top-nav grouping so nothing gets lost:
     - **Brand** — Recouply logo + workspace switcher (org name, plan badge).
     - **Revenue Hub** — Overview, Invoices, Payments.
     - **Contract Intelligence** — Contracts, Revenue Library, Revenue Risk.
     - **AI Tools** — AI Workflows, Inbound AI, Tasks, Outreach History, Daily Digest, Alerts (with unread badge), Email Delivery.
     - **Data** — Accounts, Data Center.
     - **Footer (bottom of sidebar)** — Credits wallet, Onboarding progress ring, Notifications bell, User profile menu (avatar, name, plan, Settings, Team, Sign out) — the same items currently in the top-right dropdown.
   - Collapsible via `collapsible="icon"` so it shrinks to a 56px icon rail (Stripe behavior). `SidebarTrigger` lives in a slim top header.
   - Active-route highlighting via `NavLink` / `useLocation`, active group auto-expanded.

2. **Full-width content region**
   - Rewrite `Layout.tsx` to render:
     ```
     <SidebarProvider>
       <AppSidebar />
       <SidebarInset>
         <header> trial banner, support banners, breadcrumbs, SidebarTrigger, search </header>
         <main className="flex-1 w-full p-6"> {children} </main>
       </SidebarInset>
     </SidebarProvider>
     ```
   - Remove the `max-w-7xl mx-auto` wrapper so pages can span the viewport like Stripe's Invoices table.
   - Keep the trial banner, `SupportAccessBanner`, `SupportImpersonationBanner`, `AccountLockoutBanner`, `RequireSubscription`, `NicolasChat`, `FloatingReferralAgent`, `OnboardingWelcome`, and auth-guard logic — just relocated into the new shell.

3. **Page-level width cleanup (targeted)**
   - Individual pages that hard-code `max-w-7xl` / `max-w-6xl` at the top of the page currently double up on the container. Sweep those wrappers in the main product pages so the sidebar-based full-width layout actually reaches the edges:
     - `Invoices`, `PaymentsActivity`, `ARAging`, `Debtors`, `DebtorDetail`, `ContractsHub`, `ActiveContracts`, `RevenueRisk`, `RevenueHub`, `RevenueIntelligenceHub`, `Dashboard`, `Tasks`, `Alerts`, `DailyDigest`, `Settings`, `Profile`, `Team`, `DataCenter`.
   - Reading-heavy pages (Knowledge Base, legal, onboarding wizard) keep a max-width for readability.

4. **Mobile behavior**
   - Sidebar switches to `collapsible="offcanvas"` under `lg`, opened via a hamburger `SidebarTrigger` in the header.
   - Delete the existing bespoke `mobileNavItems` / `mobileMenuOpen` code — the shadcn Sidebar handles it.

5. **Cleanup**
   - Remove the old top-nav JSX, dropdown menus, and mobile-menu state from `Layout.tsx`.
   - Keep `RecouplyLogo`, `NavProfileAvatar`, `CreditsWalletBadge`, `OnboardingProgressRing`, `AlertNotifications` — they get re-mounted inside the sidebar/header instead of the top bar.

## Technical notes

- Uses existing `src/components/ui/sidebar.tsx` (shadcn) — no new dependencies.
- `SidebarProvider` must wrap a `div` (or `SidebarInset`) with `w-full` to avoid layout collapse; `SidebarInset` from the shadcn primitive already handles this.
- All auth/subscription/banner logic in current `Layout.tsx` is preserved 1:1; only the visual shell changes.
- Nothing about routing, data fetching, or business logic changes.

## Out of scope

- No redesign of individual page internals beyond removing the outer max-width wrapper.
- No change to marketing/admin/debtor-portal shells.
- No color/theme changes — sidebar uses the existing `--sidebar-*` tokens already defined in `index.css`.
