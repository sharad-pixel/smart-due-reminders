import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scale, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import kurtAvatar from "@/assets/personas/kurt.png";
import { toast } from "sonner";


interface Msg { role: "user" | "assistant"; content: string }

export const KurtChatDrawer = ({ instanceId, instanceName }: { instanceId: string; instanceName?: string }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load greeting & history on open
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (messages.length) return;
    (async () => {
      const { data } = await (supabase.from("clm_kurt_chat_messages" as any) as any)
        .select("role, content")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: true })
        .limit(40);
      if (data?.length) {
        setMessages(data.map((d: any) => ({ role: d.role, content: d.content })));
      } else {
        setMessages([{
          role: "assistant",
          content: `Hi — I'm **Kurt**, your General Counsel for **${instanceName || "this contract"}**.\n\nI can help you:\n- Decide whether to approve, reject, or request changes on amendments\n- Spot risk in proposed redlines (liability, indemnity, IP, payment terms)\n- Suggest standard fallback language\n\nWhat would you like to look at?`,
        }]);
      }
    })();
  }, [open, instanceId, instanceName, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("clm-kurt-chat", {
        body: { instanceId, messages: next },
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

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-2 bg-indigo-700 hover:bg-indigo-800 text-white"
      >
        <Scale className="h-4 w-4" /> Ask Kurt
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <div className="flex items-center gap-3">
              <img src={kurtAvatar} alt="Kurt" className="h-12 w-12 rounded-full object-cover ring-2 ring-indigo-300" />
              <div>
                <SheetTitle className="text-base flex items-center gap-1.5">
                  Kurt <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                </SheetTitle>
                <SheetDescription className="text-[11px]">
                  General Counsel · CLM guidance for {instanceName || "this workspace"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-5" ref={scrollRef as any}>
            <div className="py-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
                  {m.role === "assistant" && (
                    <img src={kurtAvatar} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5" />
                  )}
                  <div className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm"
                      : "max-w-[85%] text-sm prose prose-sm dark:prose-invert leading-relaxed"
                  }>
                    {m.role === "assistant"
                      ? <div className="whitespace-pre-wrap">{m.content}</div>
                      : m.content}
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
          </ScrollArea>

          <div className="border-t p-3 flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Ask Kurt about a clause, redline, or best practice…"
              className="resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
            />
            <Button onClick={send} disabled={!input.trim() || sending} size="icon" className="bg-indigo-700 hover:bg-indigo-800">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
