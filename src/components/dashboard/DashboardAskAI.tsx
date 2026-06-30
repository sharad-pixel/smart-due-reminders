import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send, Loader2, RotateCcw, BarChart3, Brain, TrendingUp,
  AlertTriangle, DollarSign, Sparkles, ArrowRight, Wand2, Activity,
  ShieldAlert, ListChecks, Clock, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { personaConfig } from "@/lib/personaConfig";
import { useRevenueRisk } from "@/hooks/useRevenueRisk";
import { useCollectionTasks, type CollectionTask } from "@/hooks/useCollectionTasks";
import { formatCurrency } from "@/lib/formatters";
import { NicolasPromptLibrary } from "./NicolasPromptLibrary";

interface Msg { role: "user" | "assistant"; content: string }


const NICOLAS = personaConfig.nicolas;

// Internal route prefixes — any link pointing to these is rewritten to a
// relative SPA route, even if the AI mistakenly returns an absolute URL like
// https://app.recouply.com/debtors/... (which is not a real domain).
const INTERNAL_PREFIXES = ["/debtors/", "/invoices/", "/tasks", "/contracts/", "/outreach", "/dashboard", "/payments"];

const toInternalPath = (href?: string): string | null => {
  if (typeof href !== "string" || !href) return null;
  let path = href.trim();
  // Strip absolute origins so AI hallucinations (app.recouply.com, etc.) still resolve.
  const absMatch = path.match(/^https?:\/\/[^/]+(\/.*)?$/i);
  if (absMatch) path = absMatch[1] || "/";
  if (!path.startsWith("/")) return null;
  return INTERNAL_PREFIXES.some((p) => path.startsWith(p)) ? path : null;
};

const MD_COMPONENTS = {
  a: ({ href, children }: any) => {
    const internal = toInternalPath(href);
    if (internal) {
      return (
        <Link
          to={internal}
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

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Working late";
}

function buildGreeting(firstName: string | null, stats: {
  accounts?: number; overdue?: number; urgentTasks?: number;
}): string {
  const hi = `${timeGreeting()}${firstName ? `, **${firstName}**` : ""} 👋`;
  const lines: string[] = [
    `${hi} — I'm **Nicolas**, your Revenue Intelligence agent.`,
  ];
  const bits: string[] = [];
  if (stats.accounts) bits.push(`reviewed **${stats.accounts.toLocaleString()} accounts**`);
  if (stats.overdue && stats.overdue > 0) bits.push(`flagged **${formatCurrency(stats.overdue)}** overdue`);
  if (stats.urgentTasks && stats.urgentTasks > 0) bits.push(`queued **${stats.urgentTasks} urgent task${stats.urgentTasks === 1 ? "" : "s"}**`);
  if (bits.length) {
    lines.push(`Since you last checked in, I've ${bits.join(", ")}.`);
  } else {
    lines.push(`I've already pulled your portfolio: balances, ECL, overdue invoices, open tasks, and recent payments.`);
  }
  lines.push(`Tap a card below to dive in, or just ask me anything.`);
  return lines.join("\n\n");
}


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
  const [firstName, setFirstName] = useState<string | null>(null);
  const [urgentTasks, setUrgentTasks] = useState<CollectionTask[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Risk + tasks for the welcome panel
  const { data: riskData } = useRevenueRisk();
  const { fetchTasks } = useCollectionTasks();

  // Lightweight, fast top-risk pull (independent of heavy revenue-risk engine)
  const { data: fastTopRisks } = useQuery({
    queryKey: ["dashboard-top-risk-fast"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtors")
        .select("id, name, total_open_balance, payment_score")
        .eq("is_archived", false)
        .not("payment_score", "is", null)
        .gt("total_open_balance", 0)
        .order("payment_score", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        debtor_id: d.id,
        debtor_name: d.name,
        balance: Number(d.total_open_balance) || 0,
        collectability_score: Number(d.payment_score) || 0,
      }));
    },
  });

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  // Load current user's first name once
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      const raw = (prof?.name || user.user_metadata?.name || user.email || "").toString().trim();
      const first = raw.split(/[\s@]/)[0];
      if (first) setFirstName(first.charAt(0).toUpperCase() + first.slice(1));
    })();
  }, []);

  // Load top urgent/open tasks
  useEffect(() => {
    (async () => {
      try {
        const all = await fetchTasks({ status: "open" });
        const ranked = [...all].sort((a, b) => {
          const p = (x: CollectionTask) => ({ urgent: 0, high: 1, normal: 2, low: 3 }[x.priority] ?? 2);
          if (p(a) !== p(b)) return p(a) - p(b);
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return da - db;
        });
        setUrgentTasks(ranked.slice(0, 3));
      } catch { /* silent */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Derived intelligence stats for the welcome message + monitoring strip
  const agg = riskData?.aggregate;
  const topRisks = (fastTopRisks && fastTopRisks.length > 0)
    ? fastTopRisks
    : (riskData?.top_risk_accounts || []).slice(0, 3);
  const urgentCount = useMemo(
    () => urgentTasks.filter((t) => t.priority === "urgent" || t.priority === "high").length || urgentTasks.length,
    [urgentTasks]
  );
  const greeting = useMemo(
    () => buildGreeting(firstName, {
      accounts: agg?.debtor_count,
      overdue: agg?.overdue_ar,
      urgentTasks: urgentCount,
    }),
    [firstName, agg?.debtor_count, agg?.overdue_ar, urgentCount]
  );

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
        <div className="relative flex items-start gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" />
            <img
              src={NICOLAS.avatar}
              alt="Nicolas — Revenue Intelligence Agent"
              className="relative h-12 w-12 sm:h-[72px] sm:w-[72px] rounded-full object-cover ring-2 ring-primary/40 shadow-xl"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </span>
          </div>
          <div className="flex-1 min-w-0 basis-[calc(100%-4rem)] sm:basis-auto">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Nicolas</h2>
              <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary whitespace-nowrap">
                <BarChart3 className="h-2.5 w-2.5 mr-1" /> Revenue Intelligence Agent
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                <Activity className="h-2.5 w-2.5 mr-1" /> Live
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
              I've reviewed every account in your portfolio. Ask me about risk, exposure, what to do next — or hand me a debtor and I'll build you a plan.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end order-3 sm:order-none -mt-1 sm:mt-0">
...
            {hasChat && (
              <Button size="sm" variant="ghost" onClick={reset} className="text-xs">
                <RotateCcw className="h-3 w-3 mr-1" /> New chat
              </Button>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        {/* Greeting + critical insights + starters when empty */}
        {!hasChat && (
          <div className="px-5 sm:px-7 py-6 space-y-5">
            {/* Live monitoring strip */}
            {agg && (
              <div className="grid grid-cols-3 gap-2 -mt-1">
                <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Accounts</div>
                    <div className="text-sm font-semibold tabular-nums truncate">{agg.debtor_count.toLocaleString()}</div>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Overdue AR</div>
                    <div className="text-sm font-semibold tabular-nums truncate">{formatCurrency(agg.overdue_ar || 0)}</div>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-2">
                  <ListChecks className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Open tasks</div>
                    <div className="text-sm font-semibold tabular-nums truncate">{urgentTasks.length}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Welcome message */}
            <div className="flex gap-3">
              <img src={NICOLAS.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/30 shrink-0 mt-0.5" />
              <div className="flex-1 rounded-2xl rounded-tl-sm bg-muted/50 border px-4 py-3 text-sm leading-relaxed">
                <NicolasMarkdown content={greeting} />
              </div>
            </div>

            {/* Critical right now */}
            {(topRisks.length > 0 || urgentTasks.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <ShieldAlert className="h-3 w-3 text-red-500" /> Critical right now
                  </div>
                  <Link to="/revenue-risk" className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5">
                    Full risk view <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Top risk accounts */}
                  <div className="rounded-xl border bg-gradient-to-br from-red-500/5 to-transparent border-red-500/20 overflow-hidden">
                    <div className="px-3 py-2 border-b border-red-500/20 bg-red-500/5 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs font-semibold">Top risk accounts</span>
                    </div>
                    {topRisks.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No high-risk accounts right now.
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {topRisks.map((r) => (
                          <li key={r.debtor_id} className="group flex items-center gap-2 px-3 py-2 hover:bg-red-500/5 transition">
                            <Link to={`/debtors/${r.debtor_id}`} className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate group-hover:text-primary transition">{r.debtor_name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(r.balance)}</span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className="text-[10px] text-red-600 dark:text-red-400 font-medium tabular-nums">{Math.round(r.collectability_score)} score</span>
                              </div>
                            </Link>
                            <button
                              onClick={() => send(`Walk me through ${r.debtor_name} — why is it high risk and what should I do next?`)}
                              disabled={sending}
                              className="opacity-0 group-hover:opacity-100 transition text-[10px] px-1.5 py-1 rounded border bg-background hover:border-primary/40 hover:text-primary inline-flex items-center gap-1 shrink-0"
                              title="Ask Nicolas about this account"
                            >
                              <Sparkles className="h-2.5 w-2.5" /> Ask
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Urgent tasks */}
                  <div className="rounded-xl border bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/20 overflow-hidden">
                    <div className="px-3 py-2 border-b border-amber-500/20 bg-amber-500/5 flex items-center gap-1.5">
                      <ListChecks className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-semibold">Tasks needing you</span>
                    </div>
                    {urgentTasks.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> All caught up — no open tasks.
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {urgentTasks.map((t) => {
                          const overdue = t.due_date && new Date(t.due_date).getTime() < Date.now();
                          return (
                            <li key={t.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-amber-500/5 transition">
                              <Link to={`/tasks?taskId=${t.id}`} className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate group-hover:text-primary transition">{t.summary}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${
                                    t.priority === "urgent" ? "text-red-500" :
                                    t.priority === "high" ? "text-amber-600 dark:text-amber-400" :
                                    "text-muted-foreground"
                                  }`}>{t.priority}</span>
                                  {t.due_date && (
                                    <>
                                      <span className="text-[10px] text-muted-foreground">·</span>
                                      <span className={`text-[10px] inline-flex items-center gap-0.5 ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                        <Clock className="h-2.5 w-2.5" />
                                        {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </Link>
                              <button
                                onClick={() => send(`Help me handle this task: "${t.summary}". What's the best next step?`)}
                                disabled={sending}
                                className="opacity-0 group-hover:opacity-100 transition text-[10px] px-1.5 py-1 rounded border bg-background hover:border-primary/40 hover:text-primary inline-flex items-center gap-1 shrink-0"
                                title="Ask Nicolas about this task"
                              >
                                <Sparkles className="h-2.5 w-2.5" /> Ask
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

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
        <div className="border-t bg-background">
          <div className="flex items-center justify-between px-3 sm:px-4 pt-2">
            <NicolasPromptLibrary
              currentDraft={input}
              onPick={(p) => {
                setInput(p);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
            />
            <span className="text-[10px] text-muted-foreground">Enter to send · Shift+Enter for newline</span>
          </div>
          <div className="p-3 sm:p-4 pt-2 flex gap-2">
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
        </div>
      </CardContent>
    </Card>
  );
}
