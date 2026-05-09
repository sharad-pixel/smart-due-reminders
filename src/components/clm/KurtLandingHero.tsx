import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Sparkles, Scale, MessageSquare, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import kurtAvatar from "@/assets/personas/kurt.png";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "What needs my attention today?",
  "Which workspaces have pending approvals?",
  "Summarize the riskiest open negotiation.",
  "What's a fair fallback for a liability cap?",
];

export const KurtLandingHero = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history once
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("clm_kurt_landing_messages" as any) as any)
        .select("role, content")
        .order("created_at", { ascending: true })
        .limit(60);
      if (data?.length) setMessages(data.map((d: any) => ({ role: d.role, content: d.content })));
      setLoaded(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    })();
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
      const { data, error } = await supabase.functions.invoke("clm-kurt-landing-chat", {
        body: { messages: next },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || "I couldn't form a response.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e?.message || "Kurt couldn't respond");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const reset = async () => {
    const { error } = await (supabase.from("clm_kurt_landing_messages" as any) as any)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return toast.error(error.message);
    setMessages([]);
    toast.success("Conversation cleared");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const hasChat = messages.length > 0;

  return (
    <Card className="overflow-hidden border-indigo-200/60 dark:border-indigo-900/40">
      <div className="bg-gradient-to-br from-indigo-50 via-background to-background dark:from-indigo-950/20 px-5 sm:px-6 pt-5 pb-4 border-b border-indigo-200/60 dark:border-indigo-900/40">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <img src={kurtAvatar} alt="Kurt" className="h-16 w-16 rounded-full object-cover ring-2 ring-indigo-300 shadow-md" />
            <span className="absolute -bottom-1 -right-1 bg-emerald-500 h-3.5 w-3.5 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold flex items-center gap-1.5">
                Kurt <Sparkles className="h-4 w-4 text-indigo-600" />
              </h2>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                <Scale className="h-2.5 w-2.5 mr-1" /> General Counsel
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Hi, I'm your in-house counsel. Ask me anything about your workspaces — what's pending,
              what to approve, where there's risk, or how to draft a clause.
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
          <div ref={scrollRef} className="max-h-[360px] overflow-y-auto px-5 sm:px-6 py-4 space-y-4 bg-muted/20">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
                {m.role === "assistant" && (
                  <img src={kurtAvatar} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5" />
                )}
                <div className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm whitespace-pre-wrap"
                    : "max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap"
                }>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2">
                <img src={kurtAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                <div className="text-sm text-muted-foreground italic flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Kurt is thinking…
                </div>
              </div>
            )}
          </div>
        )}

        {!hasChat && loaded && (
          <div className="px-5 sm:px-6 py-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                onClick={() => send(s)}
                disabled={sending}
                className="text-xs h-8 bg-background hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
              >
                <MessageSquare className="h-3 w-3 mr-1.5 text-indigo-500" /> {s}
              </Button>
            ))}
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
            placeholder="Ask Kurt about a workspace, an approval, or a clause…"
            className="resize-none min-h-[44px] max-h-32 text-sm"
            rows={1}
            disabled={sending}
          />
          <Button
            onClick={() => send()}
            disabled={!input.trim() || sending}
            size="icon"
            className="bg-indigo-700 hover:bg-indigo-800 shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
