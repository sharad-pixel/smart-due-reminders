import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Sparkles, RotateCcw, BarChart3, Brain, TrendingUp, AlertTriangle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  { icon: AlertTriangle, label: "Which accounts are highest risk right now?" },
  { icon: DollarSign, label: "What's my total AR exposure and ECL?" },
  { icon: TrendingUp, label: "Where should I focus collection efforts this week?" },
  { icon: Brain, label: "Summarize the financial health of my portfolio" },
];

export function DashboardAskAI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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
      toast.error(e?.message || "Failed to get answer");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const reset = () => {
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const hasChat = messages.length > 0;

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="bg-gradient-to-br from-primary/5 via-background to-background px-5 sm:px-6 pt-5 pb-4 border-b border-primary/20">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Ask Recouply</h2>
              <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
                <BarChart3 className="h-2.5 w-2.5 mr-1" /> Revenue Intelligence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Ask anything about your accounts — risk, financial health, transactions, overdue balances, or which debtors need attention.
            </p>
          </div>
          {hasChat && (
            <Button size="sm" variant="ghost" onClick={reset} className="shrink-0 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      <CardContent className="p-0">
        {hasChat && (
          <div ref={scrollRef} className="max-h-[480px] overflow-y-auto px-5 sm:px-6 py-4 space-y-4 bg-muted/20">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
                {m.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm whitespace-pre-wrap break-words"
                    : "max-w-[88%] rounded-2xl rounded-tl-sm bg-background border px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm"
                }>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-sm text-muted-foreground italic flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analyzing your accounts…
                </div>
              </div>
            )}
          </div>
        )}

        {!hasChat && (
          <div className="px-5 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <Button
                  key={s.label}
                  variant="outline"
                  onClick={() => send(s.label)}
                  disabled={sending}
                  className="text-sm h-auto py-3 justify-start text-left whitespace-normal"
                >
                  <Icon className="h-4 w-4 mr-2 text-primary shrink-0" />
                  <span className="flex-1">{s.label}</span>
                </Button>
              );
            })}
          </div>
        )}

        <div className="border-t p-3 flex gap-2 bg-background">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask about risk, overdue accounts, financial health, or specific debtors…"
            className="resize-none min-h-[44px] max-h-32 text-sm"
            rows={1}
            disabled={sending}
          />
          <Button onClick={() => send()} disabled={!input.trim() || sending} size="icon" className="shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
