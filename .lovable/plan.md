# Plan: Upgrade Ask AI Dashboard with Personalized Welcome + Critical Insights

Enhance `src/components/dashboard/DashboardAskAI.tsx` so the empty state feels less like a blank chat box and more like an AI control room — greeting the user by name, surfacing the most urgent items in their portfolio with deep links, and giving Nicolas a more "AI-friendly" visual treatment.

## What changes

### 1. Personalized welcome message
- Pull the current user's first name from `profiles` (already used elsewhere) and the live time of day → "Good morning, Alex 👋".
- Replace the static `GREETING` constant with a dynamic intro that mentions:
  - Number of accounts reviewed
  - Total open AR / overdue balance
  - Number of urgent tasks waiting
- Fall back gracefully to the current generic greeting if any data is missing or still loading.

### 2. New "Critical right now" panel (above starter prompts, only on empty state)
A compact 2-column grid with live data pulled via existing hooks (`useRevenueRisk`, `useCollectionTasks`):

- **Top 3 risk accounts** — name, risk tier badge, exposure, each links to `/debtors/:id`.
- **Top 3 urgent/overdue tasks** — title, due date, priority chip, each links to `/tasks` (with task id query param so the existing modal auto-opens, consistent with the alert system memory).
- Each card has an "Ask Nicolas about this" mini-button that pre-fills the chat with a contextual prompt (e.g. `"Walk me through {Account Name} — why is it high risk and what should I do next?"`) and sends it.

If the user has zero risk/tasks, show a calm "All clear" state instead of empty cards.

### 3. More AI-friendly UI polish (visual only)
- Add a subtle animated gradient ring + soft glow behind Nicolas' avatar in the hero (CSS only, no new deps).
- Add a thin "AI is monitoring" status strip under the hero showing 3 live metrics (Accounts, Open AR, Tasks) with the existing Live badge style.
- Tighten the starters grid: keep the 4 existing prompts but render them with a subtle shimmer on hover and a small "Try this" affordance.
- Use existing semantic tokens (`primary`, `muted`, `emerald-500/10`, etc.) — no new colors.

### 4. Linking behavior
- Reuse the existing `toInternalPath` + `MD_COMPONENTS.a` so any links Nicolas returns continue to render as in-app links.
- New cards use `<Link>` directly to `/debtors/:id`, `/tasks?taskId=...`, `/revenue-risk`.

## Files touched

- `src/components/dashboard/DashboardAskAI.tsx` — main edits (welcome, critical panel, polish).
- Possibly a small new component `src/components/dashboard/AskAICriticalPanel.tsx` to keep the file readable.
- No backend, schema, or edge function changes.

## Out of scope

- No changes to `dashboard-ai-chat` edge function or its prompts.
- No changes to the underlying risk/task data sources.
- No new routes or DB migrations.
