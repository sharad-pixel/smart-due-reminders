import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "What is revenue leakage and how does it start in the contract?",
  "Explain ASC 606 revenue recognition for SaaS in plain terms.",
  "What's the difference between Contract Intelligence and CLM?",
  "How does AI reduce DSO in B2B collections?",
];

export default function AskRevenueAgent() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    // Placeholder assistant message we'll stream into
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resources-ask`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data:")) continue;
          const data = trimmedLine.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) {
              assistantText += delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: assistantText };
                return copy;
              });
            }
          } catch {
            // ignore partial JSON chunks
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && !last.content) copy.pop();
        return copy;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <section
      id="ask-agent"
      aria-label="Ask Revenue Questions"
      className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-accent/[0.04] shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 md:px-8 py-6 border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Ask Revenue Questions
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              An AI agent trained on contract-to-cash, Revenue Intelligence, ASC 606, and SaaS
              finance. Ask anything.
            </p>
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[220px] overflow-y-auto px-6 md:px-8 py-6 space-y-6"
      >
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Try one of these to get started:
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="flex gap-3">
            <div
              className={`flex-shrink-0 h-8 w-8 rounded-full grid place-items-center ${
                m.role === "user"
                  ? "bg-foreground/10 text-foreground"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {m.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {m.role === "user" ? "You" : "Revenue Agent"}
              </div>
              {m.content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-p:text-foreground/90">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : streaming && i === messages.length - 1 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border/60 bg-card/40 backdrop-blur p-4 md:p-5"
      >
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask about revenue leakage, ASC 606, contract intelligence, DSO…"
            rows={2}
            className="resize-none min-h-[52px] max-h-40 bg-background"
            disabled={streaming}
          />
          <Button
            type="submit"
            size="icon"
            disabled={streaming || !input.trim()}
            className="h-[52px] w-[52px] flex-shrink-0"
            aria-label="Send"
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          AI-generated. For legal, tax, or audit questions, consult your own advisors.
        </p>
      </form>
    </section>
  );
}
