import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send, Loader2, RotateCcw, BarChart3, Brain, TrendingUp,
  AlertTriangle, DollarSign, Sparkles, ArrowRight, Wand2, Activity,
  History, Trash2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { personaConfig } from "@/lib/personaConfig";

interface Msg { role: "user" | "assistant"; content: string }

const NICOLAS = personaConfig.nicolas;

const MD_COMPONENTS = {
  a: ({ href, children }: any) => {
    const isInternal = typeof href === "string" && href.startsWith("/");
    if (isInternal) {
      return (
        <Link
          to={href}
          className="inline-flex items-baseline font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary hover:bg-primary/5 rounded px-0.5 -mx-0.5 transition"
        >
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
        {children}
      </a>
    );
  },
  table: ({ children }: any) => (
    <div className="my-3 -mx-1 overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }: any) => (
    <th className="text-left font-semibold px-2.5 py-1.5 border-b text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-2.5 py-1.5 border-b border-border/50 align-top">{children}</td>
  ),
  tr: ({ children }: any) => <tr className="hover:bg-muted/30 transition">{children}</tr>,
  h2: ({ children }: any) => <h2 className="text-base font-semibold mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-semibold mt-2.5 mb-1">{children}</h3>,
  ul: ({ children }: any) => <ul className="my-1.5 space-y-0.5 list-disc pl-5">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-1.5 space-y-0.5 list-decimal pl-5">{children}</ol>,
  p: ({ children }: any) => <p className="my-1.5 leading-relaxed">{children}</p>,
  code: ({ children }: any) => (
    <code className="px-1 py-0.5 rounded bg-muted text-[12px] font-mono">{children}</code>
  ),
};

const NicolasMarkdown = ({ content }: { content: string }) => (
  <div className="prose prose-sm max-w-none dark:prose-invert">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
      {content}
    </ReactMarkdown>
  </div>
);

const GREETING = `Hi, I'm **Nicolas** — your Revenue Intelligence agent. I've already pulled your portfolio: balances, ECL, overdue invoices, open tasks, and recent payments.

Where do you want to start? Pick a prompt below, or just ask me anything — I'll dig into the accounts and come back with a recommendation.`;

const STARTERS: { icon: any; label: string; prompt: string; tone: string }[] = [
  { icon: AlertTriangle, label: "Top risk right now", prompt: "Which 5 accounts are highest risk right now and what should I do about each one?", tone: "from-red-500/10 to-red-500/0 border-red-500/20" },
  { icon: DollarSign, label: "AR exposure & ECL", prompt: "Break down my total AR exposure, overdue balance, and Expected Credit Loss. Where is the concentration?", tone: "from-emerald-500/10 to-emerald-500/0 border-emerald-500/20" },
  { icon: TrendingUp, label: "Where to focus this week", prompt: "Based on open tasks and overdue invoices, where should I focus collection efforts this week? Give me a prioritized action list.", tone: "from-blue-500/10 to-blue-500/0 border-blue-500/20" },
  { icon: Brain, label: "Portfolio health", prompt: "Summarize the financial health of my portfolio — collectability, aging, payment momentum, and any red flags.", tone: "from-purple-500/10 to-purple-500/0 border-purple-500/20" },
];

const FOLLOWUPS = [
  "Draft outreach for the top 3 accounts.",
  "Which invoices crossed 60+ DPD?",
  "What changed since last week?",
  "Show me accounts with no recent activity.",
  "Which payments came in this week?",
];

interface ChatSession { id: string; title: string; updatedAt: number; messages: Msg[] }
const HISTORY_KEY = "nicolas_revenuehub_history_v1";
const MAX_SESSIONS = 5;

function loadHistory(): ChatSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_SESSIONS) : [];
  } catch { return []; }
}
function saveHistory(sessions: ChatSession[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS))); } catch {}
}

export function DashboardAskAI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [history, setHistory] = useState<ChatSession[]>(() => loadHistory());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Persist current chat to history (upsert) whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const title = (firstUser?.content || "New chat").slice(0, 60);
    setHistory((prev) => {
      const others = prev.filter((s) => s.id !== sessionId);
      const next: ChatSession[] = [
        { id: sessionId, title, updatedAt: Date.now(), messages },
        ...others,
      ].slice(0, MAX_SESSIONS);
      saveHistory(next);
      return next;
    });
  }, [messages, sessionId]);

  const send = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || sending) return;
    const next = [...messages, { role: "user" as const, content: value }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("dashboard-ai-chat", {
        body: { messages: next },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply || "I couldn't form a response.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e?.message || "Nicolas hit a snag — try again");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const reset = () => {
    setMessages([]);
    setSessionId(crypto.randomUUID());
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const loadSession = (s: ChatSession) => {
    setSessionId(s.id);
    setMessages(s.messages);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const deleteSession = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveHistory(next);
      return next;
    });
    if (id === sessionId) {
      setMessages([]);
      setSessionId(crypto.randomUUID());
    }
  };

  const clearAllHistory = () => {
    saveHistory([]);
    setHistory([]);
    setMessages([]);
    setSessionId(crypto.randomUUID());
  };

  const hasChat = messages.length > 0;

  // Rotate follow-up suggestions after each reply
  const followups = useMemo(() => {
    const seed = messages.length;
    const shuffled = [...FOLLOWUPS].sort(() => 0.5 - ((seed * 9301 + 49297) % 233280) / 233280);
    return shuffled.slice(0, 3);
  }, [messages.length]);

  return (
    <Card className="overflow-hidden border-primary/20 shadow-lg">
      {/* Hero header with Nicolas */}
      <div className="relative bg-gradient-to-br from-primary/10 via-purple-500/5 to-background px-5 sm:px-7 pt-6 pb-5 border-b border-primary/20">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0, transparent 50%), radial-gradient(circle at 80% 60%, #8b5cf6 0, transparent 50%)",
        }} />
        <div className="relative flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" />
            <img
              src={NICOLAS.avatar}
              alt="Nicolas — Revenue Intelligence Agent"
              className="relative h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-full object-cover ring-2 ring-primary/40 shadow-xl"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold tracking-tight">Nicolas</h2>
              <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary">
                <BarChart3 className="h-2.5 w-2.5 mr-1" /> Revenue Intelligence Agent
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <Activity className="h-2.5 w-2.5 mr-1" /> Live
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              I've reviewed every account in your portfolio. Ask me about risk, exposure, what to do next — or hand me a debtor and I'll build you a plan.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {history.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-xs">
                    <History className="h-3 w-3 mr-1" /> Recent ({history.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="text-xs">Last {MAX_SESSIONS} chats</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {history.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onSelect={(e) => { e.preventDefault(); loadSession(s); }}
                      className="flex items-start gap-2 cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {s.id === sessionId ? "● " : ""}{s.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(s.updatedAt).toLocaleString()} · {s.messages.length} msg
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        aria-label="Delete chat"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); clearAllHistory(); }} className="text-xs text-destructive">
                    <Trash2 className="h-3 w-3 mr-2" /> Clear all history
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {hasChat && (
              <Button size="sm" variant="ghost" onClick={reset} className="text-xs">
                <RotateCcw className="h-3 w-3 mr-1" /> New chat
              </Button>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        {/* Greeting + starters when empty */}
        {!hasChat && (
          <div className="px-5 sm:px-7 py-6 space-y-5">
            <div className="flex gap-3">
              <img src={NICOLAS.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/30 shrink-0 mt-0.5" />
              <div className="flex-1 rounded-2xl rounded-tl-sm bg-muted/50 border px-4 py-3 text-sm leading-relaxed">
                <NicolasMarkdown content={GREETING} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                <Wand2 className="h-3 w-3" /> Suggested starters
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STARTERS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      onClick={() => send(s.prompt)}
                      disabled={sending}
                      className={`group text-left rounded-xl border bg-gradient-to-br ${s.tone} p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-background/80 border flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium leading-tight">{s.label}</div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.prompt}</div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Chat transcript */}
        {hasChat && (
          <div ref={scrollRef} className="max-h-[520px] overflow-y-auto px-5 sm:px-7 py-5 space-y-4 bg-gradient-to-b from-muted/20 to-background">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2.5"}>
                {m.role === "assistant" && (
                  <img src={NICOLAS.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/30 shrink-0 mt-0.5" />
                )}
                <div className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm"
                    : "flex-1 min-w-0 rounded-2xl rounded-tl-sm bg-background border px-4 py-3 text-sm leading-relaxed break-words shadow-sm"
                }>
                  {m.role === "assistant" ? (
                    <NicolasMarkdown content={m.content} />
                  ) : m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2.5">
                <img src={NICOLAS.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/30 shrink-0" />
                <div className="rounded-2xl rounded-tl-sm bg-background border px-4 py-3 text-sm text-muted-foreground italic flex items-center gap-2 shadow-sm">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  Nicolas is reviewing your accounts…
                </div>
              </div>
            )}

            {/* Follow-up chips after last assistant reply */}
            {!sending && messages[messages.length - 1]?.role === "assistant" && (
              <div className="flex flex-wrap gap-1.5 pt-1 pl-10">
                {followups.map((f) => (
                  <button
                    key={f}
                    onClick={() => send(f)}
                    className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-primary/5 hover:border-primary/40 transition text-muted-foreground hover:text-foreground"
                  >
                    <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Composer */}
        <div className="border-t p-3 sm:p-4 flex gap-2 bg-background">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask Nicolas about risk, overdue accounts, financial health, or specific debtors…"
            className="resize-none min-h-[48px] max-h-32 text-sm"
            rows={1}
            disabled={sending}
          />
          <Button onClick={() => send()} disabled={!input.trim() || sending} size="icon" className="shrink-0 h-12 w-12">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
