import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://kguurazunazhhrhasahd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVyYXp1bmF6aGhyaGFzYWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjQyNzMsImV4cCI6MjA3OTM0MDI3M30.9pSbWiSKOwO5YkoRwtE2-pgjtxXSBhD59RwxA1fYsMY";

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
}

export interface StreamCleanupOptions {
  filename: string;
  code: string;
  onToken: (delta: string) => void;
  onUsage?: (usage: UsageInfo) => void;
  signal?: AbortSignal;
}

/**
 * Streams Claude Sonnet 4.5 cleanup of a source file via the
 * `anthropic-cleanup` edge function. Returns the full cleaned text.
 */
export async function streamCleanup(opts: StreamCleanupOptions): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) throw new Error("Not authenticated");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/anthropic-cleanup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename: opts.filename, code: opts.code }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text();
    }
    throw new Error(`Cleanup failed (${res.status}): ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          const t = evt.delta.text as string;
          full += t;
          opts.onToken(t);
        } else if (evt.type === "message_start" && evt.message?.usage) {
          inputTokens = evt.message.usage.input_tokens ?? 0;
        } else if (evt.type === "message_delta" && evt.usage) {
          outputTokens = evt.usage.output_tokens ?? outputTokens;
        }
      } catch {
        // ignore non-JSON keepalive lines
      }
    }
  }

  opts.onUsage?.({ inputTokens, outputTokens });
  return full;
}

/** Claude Sonnet 4.5 pricing: $3 / 1M input, $15 / 1M output. */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
}
