## Revenue Intelligence Hub — /resources

Transform the existing `/blog` experience into an enterprise Resource Center at `/resources` (keeping `/blog` as a redirect), with a new hero, richer taxonomy, 5 cornerstone articles, upgraded article layout, and an "Ask Revenue Questions" AI agent powered by Lovable AI.

### 1. Routing & structure
- New route `/resources` → `ResourcesIndex.tsx` (replaces the marketing role of `BlogIndex`).
- Keep `/blog` and `/blog/:slug` working; add `/resources/:slug` as the canonical path. Redirect `/blog` → `/resources` (301-style client redirect) and mirror slugs.
- Update `MarketingFooter` + `EnterpriseNav` links from Blog → Resources.
- Extend `src/lib/blogConfig.ts` → rename conceptually to `resourceConfig` (keep file, add fields): `contentType` (article | guide | whitepaper | playbook | case-study), `series?`, `topics: string[]`, `popularity?: number`, `editorsPick?: boolean`, `toc?: {id,title,level}[]`, `faq?: {q,a}[]`.

### 2. Hero section (ResourcesIndex)
- Headline: "Revenue Intelligence Starts With Better Contracts"
- Subheadline as specified.
- CTAs: **Read Articles** (scrolls to grid), **Book a Demo** (→ Sharad's Calendly).
- Background: layered gradient + subtle SVG motifs (contract lines, dashboard bars, workflow nodes) using existing design tokens. No new heavy image — use `framer-motion` for subtle entrance.

### 3. Ask Revenue Questions AI agent
- Component `AskRevenueAgent.tsx` placed prominently below the hero.
- Chat UI (input + streamed answer + suggested prompts like "What is revenue leakage?", "Explain ASC 606 for SaaS", "How does contract intelligence work?").
- Backend: new Supabase edge function `resources-ask` using Lovable AI Gateway (`google/gemini-2.5-flash`) with a system prompt scoped to Recouply's Revenue/Contract/Collections Intelligence domain and a short knowledge blurb about the platform. Streams via `toUIMessageStreamResponse`. Uses `useChat` on the client.
- Handles 429 / 402 errors with toasts.

### 4. Discovery: search + filters + sorting
- Global search box (title, excerpt, topics).
- Category chips (existing categories + new: Revenue Intelligence, Contract Intelligence, Collections Intelligence, Revenue Operations, Finance Automation, ASC 606, SaaS Metrics, AI, OCR, Risk Intelligence).
- Sort: Newest / Most Popular / Editor's Picks.
- Featured section: **The Revenue Intelligence Series** (5 cornerstone articles below).

### 5. Cornerstone articles (5 new)
Add to `blogConfig.ts` + create page components under `src/pages/blog/`:
1. `hidden-cost-of-contract-oversight`
2. `every-revenue-problem-starts-with-a-contract`
3. `order-forms-as-structured-data`
4. `reactive-revenue-operations-costing-millions`
5. `from-ocr-to-revenue-intelligence`

Each uses the new `ArticleLayout` (below) with H1, intro, H2/H3, pull quotes, callout stat cards, bullet lists, workflow diagrams (ASCII/flex box), summary, and CTA.

### 6. Article layout upgrade (`ArticleLayout.tsx`)
- Large hero image, category badge, reading time, publish date, author card (Sharad).
- Sticky **left** Table of Contents (desktop) auto-generated from `toc` field with scroll-spy active state.
- Right rail: share buttons (LinkedIn, X, Copy link), reading progress bar at top.
- Body typography: `prose` with tuned tokens.
- After article: **CTA banner** ("Stop Revenue Leakage Before It Happens" — Book Demo / Start Free Trial), **Related articles** (by shared category/topic), **About Recouply.ai**, **Newsletter signup** (posts to existing `notifications` capture or new `newsletter_subscribers` table — MVP: simple form → toast).
- Reusable components: `PullQuote`, `StatCallout`, `WorkflowDiagram`, `FAQAccordion`.

### 7. SEO
- `<SEOHead>` per page with title, description, keywords, canonical `https://recouply.ai/resources/<slug>`.
- Structured data: `BlogPosting`, `BreadcrumbList`, `Person` (author), `FAQPage` (when `faq` present).
- Update `public/sitemap.xml` to include `/resources` and each new article slug.

### 8. Internal linking
- In article footer, render "Related product pages" chips linking to `/pillar/*`, `/solutions/*`, `/pricing`, and Book Demo — chosen by article's `topics`.

### 9. Future-proof surface
- `contentType` filter tabs on `/resources`: Articles | Guides | Playbooks | Case Studies | Whitepapers (empty states shown when none yet).
- Sidebar link "Resources" placed where "Blog" was.

### Technical notes
- New edge function `supabase/functions/resources-ask/index.ts` following `classic-ai-chat` pattern (no auth required, CORS open, `verify_jwt=false` in `supabase/config.toml`).
- Client uses `@ai-sdk/react` `useChat` + `DefaultChatTransport` pointed at the function URL with the publishable key.
- No DB schema changes required for MVP; newsletter is a fire-and-forget form (can wire to a table later).
- Keep changes additive — existing blog posts continue to render through the new layout automatically.
