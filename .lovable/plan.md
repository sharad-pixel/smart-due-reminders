# Engagement Setup Wizard

Add a guided, intelligent wizard that configures a CLM workspace based on customer industry, engagement type, business model, and compliance needs — then renders an "Engagement Overview" card on the workspace.

## Scope

- Replace the current `NewWorkspaceDialog` quick-create flow with a multi-step `EngagementSetupWizard` (still launchable from the same entry points).
- Drive everything from a single config file (`src/lib/clm/engagementConfig.ts`) so industries, engagement types, business models, document recommendations, compliance flags, and approval routing live in one editable source.
- Persist the resulting profile on the workspace and surface it in the workspace UI.
- Additive DB only — no destructive changes.

## User Flow (7 steps)

1. **Customer Information** — name, legal entity, company size, region, customer type (new/existing), CRM account link, account owner, opportunity ID.
2. **Industry** — multi-select from 20 industries (Healthcare, SaaS, AI, FinServ, Manufacturing, Retail, Logistics, Pro Services, Gov, Education, Insurance, Life Sciences, Telecom, Construction, Energy, Hospitality, Media, Marketplace, Consumer Goods, Other).
3. **Engagement Type** — SaaS Subscription, License, AI Platform, Services, Pro Services, Managed Services, Product Sale, Distributor, Marketplace, Vendor, Partner, Pilot, POC, Renewal, Amendment, Expansion, Procurement.
4. **Business Model** — Subscription, Usage, Per Seat, Consumption, Goods, Milestone, T&M, Fixed Fee, Annual Commit, Multi-Year Ramp, Platform+Credits, Hybrid.
5. **Required Documents (smart)** — auto-recommended from industry + engagement + model (e.g. Healthcare AI → MSA, Order Form, BAA, DPA, Security Addendum, SLA). User can accept / remove / add custom.
6. **Compliance & Security** — auto-surfaced flags (HIPAA/BAA, SOC2, data residency, AI usage terms, training-data restrictions, etc.) with toggle to confirm/skip.
7. **Approval Workflow** — auto-suggested routing (Legal, Finance, Security, Exec, Procurement, Deal Desk) based on risk; editable.

Final step creates the workspace, document checklist, recommended template list, approval routing, compliance checklist, and writes an audit-trail entry.

## Workspace Dashboard Changes

Add `EngagementOverviewCard` at the top of `ClmInstanceDetail`:
- Industry chips, engagement type, business model
- Risk level badge (Low/Medium/High derived from compliance + deal size)
- Required vs missing documents (count + progress bar)
- Compliance requirements checklist
- Pending approvals
- Security review status
- Signature readiness

## Technical Plan

**New files**
- `src/lib/clm/engagementConfig.ts` — industries, engagement types, models, recommendation rules (pure data + small resolver functions).
- `src/components/clm/wizard/EngagementSetupWizard.tsx` — shell with stepper, progress bar, prev/next.
- `src/components/clm/wizard/steps/Step1Customer.tsx` … `Step7Approvals.tsx`.
- `src/components/clm/EngagementOverviewCard.tsx`.
- `src/hooks/useEngagementProfile.ts` — load/save profile for an instance.

**Edited**
- `src/components/clm/NewWorkspaceDialog.tsx` — wraps the wizard (legacy quick form removed; same trigger).
- `src/pages/ClmInstanceDetail.tsx` — render `EngagementOverviewCard` above the 4-tab layout.
- `src/pages/Contracts.tsx` — launch wizard for "New Workspace".

**Database (additive migration)**
- `clm_engagement_profiles` (workspace_instance_id PK, customer_info jsonb, industries text[], engagement_type text, business_model text, risk_level text, account_id, created_by, timestamps) — RLS: account-scoped.
- `clm_workspace_required_documents` (id, workspace_instance_id, document_type, source `recommended|custom`, status `pending|in_progress|complete`, account_id) — RLS: account-scoped.
- `clm_workspace_compliance_requirements` (id, workspace_instance_id, requirement_key, label, status `required|confirmed|waived`, account_id) — RLS: account-scoped.
- `clm_workspace_approval_routing` (id, workspace_instance_id, approver_role, required boolean, reason text, account_id) — RLS: account-scoped.

All tables get `account_id` and policies that delegate to the existing `clm_template_instances` access (same pattern as `clm_section_revisions`).

**Recommendation engine** lives in `engagementConfig.ts` as pure functions:
```ts
recommendDocuments(industries, engagementType, model) → DocType[]
recommendCompliance(industries, engagementType) → ComplianceFlag[]
recommendApprovals(industries, model, riskHints) → ApproverRole[]
deriveRiskLevel(industries, model, compliance) → 'low'|'medium'|'high'
```

## Out of Scope
- Kurt AI changes, e-signature provider, billing.
- Editing existing workspaces through the wizard (v2). Existing workspaces just show the overview card with whatever profile data exists (or an empty state with "Run setup wizard" CTA).
