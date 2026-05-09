## Kurt — General Counsel AI Agent for CLM

Add a dedicated AI agent named **Kurt** who lives inside the CLM workspace and helps owners/approvers reason about contract changes, recommends accept/reject decisions, and offers best-practice guidance. Kurt mirrors the look-and-feel of the Collection Agents (Sam, James, Katy, Nicolas, etc.) but is scoped to CLM, not collections.

### 1. Persona & avatar

- Add Kurt to `src/lib/personaConfig.ts` as a special agent (like Nicolas — `bucketMin/Max = -999` so he never appears in collections routing).
  - Name: Kurt
  - Role: "(Special Agent) General Counsel — CLM Guidance"
  - Tone: Professional, precise, plain-English legal commentary
  - Color: deep navy/indigo to differentiate from Nicolas (purple) and the collections palette
- Generate a Kurt avatar with the same illustrated style as the existing personas and save it to `src/assets/personas/kurt.png`.
- Add Kurt to the Nicolas-style exclusion lists already used elsewhere so collections logic continues to skip special agents.

### 2. Where Kurt appears in the UI

- **Workspace detail (`ClmInstanceDetail.tsx`)**: floating "Ask Kurt" button + side drawer chat, plus a "Kurt's Review" badge next to each pending revision.
- **Approvals panel**: when a reviewer opens a pending amendment, show a Kurt recommendation card: `Recommend: Approve / Request changes / Reject` with a 1–3 sentence rationale and a "Why?" expand showing the bullet points he weighed (clarity, risk, deviation from template, missing clauses, tone).
- **Section edit dialog (Diff tab)**: inline "Kurt's take" panel summarizing what changed and any flags (ambiguous language, removed protections, indemnity/liability shifts, undefined terms).
- **Portal (`ClmPortal.tsx`)**: external editors get a lighter Kurt panel with best-practice tips while drafting (no internal recommendations exposed).

### 3. Kurt's capabilities

- **Change tracking commentary** — Given the section diff (old body vs new body) and template guidance, summarize what changed in plain English.
- **Accept / Reject recommendation** — Classify each pending revision as `approve`, `request_changes`, or `reject` with a confidence score and rationale.
- **Best-practice guidance** — On demand, answer questions about the workspace contract: missing standard clauses, unusual terms, risk hot-spots, suggested fallback language.
- **History awareness** — Pulls the section's prior revisions and comments so guidance reflects the negotiation history.
- **Audit log entries** — Every Kurt recommendation is written to `audit_logs` with `action_type='clm_kurt_recommendation'` so reviewers can see Kurt's suggestion alongside the human decision.

### 4. Server side (edge functions)

- `clm-kurt-review` — invoked when a revision is submitted (and on demand). Loads section, prior body, new body, template guidance, comments. Calls Lovable AI Gateway (`google/gemini-2.5-flash`) with a structured-output schema returning `{ recommendation, confidence, summary, key_changes[], risks[], suggested_edits[] }`. Persists result to a new `clm_kurt_recommendations` table keyed by `revision_id`.
- `clm-kurt-chat` — streaming chat endpoint scoped to a workspace; system prompt includes workspace metadata, current section bodies, recent revisions, and Kurt's persona. Uses Vercel AI SDK `streamText` and returns `toUIMessageStreamResponse`.
- DB trigger `trg_clm_revision_kurt`: on insert into `clm_section_revisions` enqueue a job so `clm-kurt-review` runs automatically (cron drains the queue, similar to existing `clm_notification_queue`).

### 5. Database

New migration:
- `clm_kurt_recommendations` (`revision_id` FK, `recommendation` enum, `confidence` numeric, `summary` text, `key_changes` jsonb, `risks` jsonb, `suggested_edits` jsonb, `model` text). RLS: workspace contributors can read; service role writes.
- `clm_kurt_chat_messages` (`workspace_id`, `user_id`, `role`, `content`, `created_at`) so internal users keep per-workspace chat history. RLS scoped to workspace contributors.
- Trigger + queue entry for auto-review on revision submission.

### 6. Frontend pieces

- `src/components/clm/KurtRecommendationCard.tsx` — used in `ApprovalsPanel`, section detail, and Diff tab.
- `src/components/clm/KurtChatDrawer.tsx` — slide-in chat using AI Elements (`Conversation`, `Message`, `MessageResponse`, `PromptInput*`, `Shimmer`) wired to `clm-kurt-chat` via `useChat`.
- `src/hooks/useKurtRecommendation.ts` — TanStack Query hook to fetch/refresh recommendations.
- Hook Kurt into `ClmInstanceDetail.tsx`, `ApprovalsPanel.tsx`, `SectionEditDialog.tsx` (Diff tab), and `ClmPortal.tsx`.

### 7. Out of scope

- Binding legal advice / e-signature.
- Auto-approving or auto-rejecting revisions — Kurt only recommends; humans decide.
- Multi-jurisdiction legal rules engine.

### Files to add / edit (technical)

- Add: `src/assets/personas/kurt.png`, `src/components/clm/KurtRecommendationCard.tsx`, `src/components/clm/KurtChatDrawer.tsx`, `src/hooks/useKurtRecommendation.ts`, `supabase/functions/clm-kurt-review/index.ts`, `supabase/functions/clm-kurt-chat/index.ts`, new migration for tables + trigger.
- Edit: `src/lib/personaConfig.ts`, `src/pages/ClmInstanceDetail.tsx`, `src/components/clm/ApprovalsPanel.tsx`, `src/components/clm/SectionEditDialog.tsx`, `src/pages/ClmPortal.tsx`, `supabase/config.toml` (cron for `clm-kurt-review`).