## Goal
Add an admin-only `/dev/cleanup` page that lets you pick any `.ts`/`.tsx` file from `src/`, stream a Claude Sonnet 4.5 refactor of it, view a before/after diff, see token usage + cost, and copy the result. No files are written back automatically.

## What gets built

### 1. Secret
- Request `ANTHROPIC_API_KEY` via the secret tool (used only in the edge function).

### 2. Edge function: `supabase/functions/anthropic-cleanup/index.ts`
- Auth: requires logged-in user with `admin` role (uses existing `has_role` RPC). Rejects otherwise.
- Input: `{ filename: string, code: string }`.
- Calls Anthropic Messages API:
  - `model: "claude-sonnet-4-5"`
  - `stream: true`
  - System prompt = the exact prompt you supplied (verbatim).
  - User message contains filename + code.
- Proxies the SSE stream straight back to the browser (`text/event-stream`), preserving `content_block_delta` and `message_delta` events so the client can render tokens live and read final `usage` (input/output tokens) from `message_delta` / `message_stop`.
- CORS headers + standard error handling (surfaces 401/429/insufficient_credits clearly).

### 3. Frontend utility: `src/utils/codeCleanup.ts`
- `streamCleanup({ filename, code, onToken, onUsage, signal })` — uses `supabase.functions.invoke` URL + user JWT, parses the SSE stream, calls `onToken(delta)` for each text delta and `onUsage({ inputTokens, outputTokens })` when the final usage frame arrives. Returns the full cleaned string on completion.
- `estimateCost(inputTokens, outputTokens)` — Sonnet 4.5 pricing: $3 / 1M input, $15 / 1M output.

### 4. Dev page: `src/pages/DevCleanup.tsx` at route `/dev/cleanup`
- Wrapped in an `AdminGuard` (reuses existing admin role check pattern in the project). Non-admins get redirected.
- File list built at compile time with `import.meta.glob('/src/**/*.{ts,tsx}', { as: 'raw', eager: false })` — lazily loads file contents only when a row is expanded/cleaned, so bundle stays reasonable.
- Layout:
  - Header banner: "Dev tool — Code Cleanup (Claude Sonnet 4.5). Review and copy only; nothing is written to disk."
  - Left: scrollable, searchable file list (path + size). Each row has a **Clean with Claude** button.
  - Right: split diff view (uses `react-diff-viewer-continued`, added via `bun add`) showing original vs streaming output. Tokens stream into the "after" pane live.
  - Footer of right pane: input tokens, output tokens, estimated cost (USD, 4 decimals), elapsed time, **Copy cleaned code** button, **Cancel** button (aborts stream).
- Route registered in `src/App.tsx` after existing admin routes; intentionally not linked from any nav.

### 5. Not changed
- No auto file writes. No changes to existing admin nav. `claude-sonnet-4-5` is the real current Opus-tier-quality Anthropic coding model; "claude-opus-4-6" doesn't exist as of today.

## Technical notes
- Streaming uses native `fetch` against the edge function URL (not `functions.invoke`, which buffers) with `Authorization: Bearer <session.access_token>` and `apikey` header — same pattern used elsewhere in the project for SSE.
- Admin gate is enforced both client-side (route guard) and server-side (edge function checks `has_role(auth.uid(),'admin')`).
- Files matched: `src/**/*.ts` and `src/**/*.tsx`, excluding `src/integrations/supabase/types.ts` and `src/integrations/supabase/client.ts` (auto-generated, must not be cleaned).

## Files
- new: `supabase/functions/anthropic-cleanup/index.ts`
- new: `supabase/config.toml` entry for the function (verify_jwt = true)
- new: `src/utils/codeCleanup.ts`
- new: `src/pages/DevCleanup.tsx`
- edit: `src/App.tsx` (add `/dev/cleanup` route)
- dep: `bun add react-diff-viewer-continued`
- secret: `ANTHROPIC_API_KEY` (requested via tool)
