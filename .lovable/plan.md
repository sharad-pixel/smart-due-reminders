## Update Contract Intelligence messaging across marketing

Rewrite the Contract Intelligence positioning everywhere it appears to match the new line:

> "Extract contract data and orchestrate automation. Renewal and opt-out date reminders and custom triggers so you never miss a key event. The only platform designed as a Finance CRM."

### Files to update

1. **`src/components/marketing/ContractIntelligenceTeaser.tsx`** (landing page animated section)
   - Replace hero headline + subcopy with the new messaging.
   - Keep the 3 pillars but retitle/reword them to align:
     - "Extract Contract Data" (AI ingestion of terms, dates, obligations)
     - "Renewal & Opt-Out Reminders" (never miss a key event)
     - "Custom Triggers & Automation" (Finance CRM orchestration)
   - Add "The only platform designed as a Finance CRM" as a badge/tagline.

2. **`src/pages/ContractIntelligence.tsx`** — hero, SEO title/description, and pillar copy updated to same wording.

3. **`src/pages/RevenueIntelligenceHub.tsx`** — Contract Intelligence card blurb + bullets rewritten to match.

4. **`src/components/layout/OnboardingWelcome.tsx`** — any Contract Intelligence step copy aligned to the new positioning (extract data, reminders, triggers, Finance CRM).

5. Quick grep for any other "Contract Intelligence" descriptive copy (e.g. footer blurbs, feature cards, blog teasers) and align lead sentences to the new phrasing so branding is consistent.

### Out of scope
- No layout, animation, component structure, or route changes.
- No backend / edge function changes.
- Purely copy edits.
