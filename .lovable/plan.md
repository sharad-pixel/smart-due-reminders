# Personable Founder Welcome + Contract Intelligence Branding

## Goal

1. Rewrite the two welcome surfaces in Sharad's voice (founder), more personable.
2. Add **Contract Intelligence** alongside Collections as a core service in the intro.
3. Remove the "CLM" acronym from all **user-facing** branding and copy — replace with "Contract Intelligence".

## Scope

### 1. `src/components/layout/OnboardingWelcome.tsx` (first-login modal)

Replace Nicolas avatar/copy with a founder-led welcome:

- Avatar → `src/assets/founder-sharad.jpg`
- Header: "Welcome to Recouply.ai — I'm glad you're here."
- Subhead badge: "A personal note from Sharad, Founder"
- Intro paragraph (personable, ~3 sentences) explaining the two pillars:
  - 🟦 **Collections Intelligence** — AI-prioritized, tone-matched outreach with you in the loop
  - 🟩 **Contract Intelligence** — engagement workspaces, templates, signature packages, watchers
- Expand from 4 → **5 steps**:
  1. Import your data → `/data-center`
  2. Set up Contract Intelligence → `/contracts` (icon: `FileSignature`)
  3. Configure AI Workflows → `/settings/ai-workflows`
  4. Review & approve drafts → `/outreach`
  5. Track tasks & responses → `/tasks`
- Footer line: "Email me at sharad@recouply.ai — I read every note. — Sharad"

### 2. `src/components/demo/DemoWelcome.tsx` (demo mode landing)

- Reframe header + subtitle in Sharad's voice with a small founder-note card (avatar + 2-sentence intro signed by Sharad).
- Update the `DemoTutorialCallout` description to mention Contract Intelligence as a second service pillar alongside collections (without expanding the 14-step demo grid, since the demo flow itself is unchanged).

### 3. Remove "CLM" from user-facing branding

Pure copy/UX rename — **no functional, route, schema, hook, or file-name changes**. Only visible strings users read.

In-scope files to scrub for visible "CLM" strings (replace with "Contract Intelligence" or "Contracts" as context dictates):

- `src/components/clm/RequireClmAccess.tsx` (any user-facing text)
- `src/components/clm/ClmBrandedHeader.tsx`
- `src/components/clm/WorkspaceTemplateTabs.tsx`
- `src/components/clm/wizard/EngagementSetupWizard.tsx`
- `src/components/clm/ExternalPortalAccessPanel.tsx`
- `src/components/dashboard/ClmQuickAccessCard.tsx`
- `src/pages/Contracts.tsx`, `ContractIntelligence.tsx`, `ClmInstanceDetail.tsx`, `ClmTemplateDetail.tsx`, `ClmPortal.tsx`
- `src/components/billing/panels/CreditsPanel.tsx` (any "CLM" label)

Out of scope (keep as-is — internal identifiers):
- File names, route paths (`/clm-*` if any internal), hook names (`useClmTemplates`, etc.), DB tables, type names, prop names.

## Memory Update

Update `mem://marketing/branding-and-positioning` (and core brand rule) to add: *"Use 'Contract Intelligence' in user-facing copy. Never expose 'CLM' acronym to users."*

## Out of Scope

- No changes to contract functionality, routes, schemas, or hooks.
- No new image assets — reusing `founder-sharad.jpg`.
- Marketing pages (`/contracts` marketing site, pricing) — separate pass if you want.

## Draft Copy (locked-in for OnboardingWelcome)

> **Welcome to Recouply.ai — I'm glad you're here.**
> *A personal note from Sharad, Founder*
>
> Hey — Sharad here. I built Recouply.ai after 15+ years inside revenue and billing teams at Workday, ServiceTitan, Contentful, and Chegg, watching brilliant finance folks drown in spreadsheets and lose contracts in email threads. You deserve better tooling, and that's what we're handing you today.
>
> Recouply is your **Revenue Intelligence Platform** — two services, one source of truth:
> • **Collections Intelligence** — AI agents prioritize by risk and draft tone-matched outreach. You stay in the loop.
> • **Contract Intelligence** — engagement workspaces, templates, signatures, and renewal watchers so no contract slips through.
>
> Four steps to live in ~15 minutes. If anything feels off, email me at **sharad@recouply.ai** — I read every note.
>
> — Sharad
