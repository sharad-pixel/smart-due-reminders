import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Lock, FileCheck2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  contractId: string;
  contractTitle: string;
  onOpenAssessment?: () => void;
}

type ChatMsg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Identify the performance obligations in this contract",
  "How should revenue be recognized under ASC 606?",
  "Are there variable consideration risks I should flag?",
  "Summarize the top 3 ASC 606 risks for this contract",
];

export function Asc606ChatPanel({ contractId, contractTitle, onOpenAssessment }: Props) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: latest, isLoading } = useQuery({
    queryKey: ["asc606-latest-assessment", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data } = await supabase
        .from("asc606_assessments")
        .select("id, status, risk_band, risk_score, completed_at")
        .eq("contract_id", contractId)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: storedGuidance = [] } = useQuery({
    queryKey: ["asc606-guidance-messages", contractId, latest?.id],
    enabled: !!contractId && !!latest,
    queryFn: async () => {
      const { data } = await supabase
        .from("asc606_guidance_messages" as any)
        .select("id, prompt, guidance, created_at")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as any[]) ?? [];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("asc606-contract-chat", {
        body: { contractId, messages: next },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply ?? "";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      queryClient.invalidateQueries({ queryKey: ["asc606-guidance-messages", contractId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to get a response");
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't generate a response. Please try again." }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          ASC 606 AI Advisor
          {latest?.risk_band && (
            <Badge variant="outline" className="ml-1 text-[10px]">
              {latest.risk_band}{latest.risk_score != null ? ` · ${latest.risk_score}/100` : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !latest ? (
          <div className="border rounded-md p-4 bg-muted/30 flex items-start gap-3">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">AI prompts are locked</div>
              <div className="text-xs text-muted-foreground mt-1">
                Purchase and run an ASC 606 Compliance assessment for this contract to unlock AI Q&amp;A on its revenue recognition, performance obligations, and risks.
              </div>
              <div className="mt-3 flex gap-2">
                {onOpenAssessment && (
                  <Button size="sm" onClick={onOpenAssessment}>
                    <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Run ASC 606 Assessment
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <Link to="/billing/asc606-credits">Buy credits</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              ref={scrollRef}
              className="max-h-80 overflow-y-auto space-y-3 pr-1"
            >
              {messages.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Ask anything about ASC 606 compliance for <span className="font-medium text-foreground">{contractTitle}</span>. Try:
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        className="h-auto py-1 text-xs font-normal"
                        onClick={() => send(s)}
                        disabled={sending}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                    {m.role === "user" ? (
                      <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap">
                        {m.content}
                      </div>
                    ) : (
                      <div className="text-sm text-foreground whitespace-pre-wrap">{m.content}</div>
                    )}
                  </div>
                ))
              )}
              {sending && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              )}
            </div>
            <div className="flex items-end gap-2 border-t pt-3">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about performance obligations, revenue timing, variable consideration…"
                className="min-h-[44px] max-h-32 resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                disabled={sending}
              />
              <Button onClick={() => send(input)} disabled={sending || !input.trim()} size="icon">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
