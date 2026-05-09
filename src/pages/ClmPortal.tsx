import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, Mail, Loader2, FileText, Check, X, ArrowLeft, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import SEO from "@/components/seo/SEO";

const STORAGE_KEY = "clm_portal_token";

export default function ClmPortal() {
  const [params, setParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(
    () => params.get("token") || sessionStorage.getItem(STORAGE_KEY),
  );
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeWs, setActiveWs] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token);
      load(token);
    }
  }, [token]);

  const load = async (t: string) => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("clm-external-portal", {
      body: { action: "access", token: t },
    });
    setLoading(false);
    if (error || (res as any)?.error) {
      toast.error((res as any)?.error || error?.message || "Invalid or expired link");
      sessionStorage.removeItem(STORAGE_KEY);
      setToken(null);
      setParams({});
      return;
    }
    setData(res);
    if ((res as any)?.workspaces?.length) setActiveWs((res as any).workspaces[0].id);
  };

  const signOut = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setData(null);
    setParams({});
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SEO title="CLM Portal | Recouply" description="Secure contract collaboration portal" />
      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <div>
              <p className="text-xs uppercase tracking-wide opacity-70">Recouply CLM</p>
              <p className="font-semibold">Secure Collaboration Portal</p>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-3 text-sm">
              <SessionCountdown expiresAt={data.identity.expires_at} onExpire={signOut} />
              <span className="opacity-80 hidden sm:inline">{data.identity.email}</span>
              <Button variant="secondary" size="sm" onClick={signOut}>Sign out</Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!token || !data ? (
          <SignInCard onTokenSet={setToken} loading={loading} />
        ) : (
          <PortalView data={data} activeWs={activeWs} setActiveWs={setActiveWs} token={token} reload={() => load(token)} />
        )}
      </main>
    </div>
  );
}

function SignInCard({ onTokenSet, loading }: { onTokenSet: (t: string) => void; loading: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const request = async () => {
    const t = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return toast.error("Enter a valid email");
    setBusy(true);
    const { error } = await supabase.functions.invoke("clm-external-portal", {
      body: { action: "request_link", email: t },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Sign in to your portal</CardTitle>
        <CardDescription>
          Enter your email and we'll send a secure single-purpose link to all the contract workspaces you've been invited to.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sent ? (
          <div className="rounded border bg-emerald-500/5 p-4 text-sm">
            <p className="font-medium text-emerald-700">✓ Check your inbox</p>
            <p className="text-muted-foreground mt-1">If your email is registered, you'll receive a portal link in a moment.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <Button onClick={request} className="w-full" disabled={busy || loading}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send secure link"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              🔒 Tokens are single-purpose, scoped to your email, and expire automatically.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PortalView({
  data, activeWs, setActiveWs, token, reload,
}: { data: any; activeWs: string | null; setActiveWs: (id: string) => void; token: string; reload: () => void }) {
  const ws = data.workspaces.find((w: any) => w.id === activeWs);
  const role = data.identity.role;

  const wsSections = data.sections.filter((s: any) => s.instance_id === activeWs);
  const wsRevisions = data.revisions.filter((r: any) => r.instance_id === activeWs);
  const wsComments = data.comments.filter((c: any) => c.instance_id === activeWs);
  const wsTasks = data.tasks.filter((t: any) => t.instance_id === activeWs);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Your workspaces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {data.workspaces.map((w: any) => {
              const myAccess = data.accessByInstance.find((a: any) => a.instance_id === w.id);
              const taskCount = data.tasks.filter((t: any) => t.instance_id === w.id).length;
              return (
                <button
                  key={w.id}
                  onClick={() => setActiveWs(w.id)}
                  className={`w-full text-left rounded p-2 hover:bg-muted/60 transition ${
                    activeWs === w.id ? "bg-muted border-l-2 border-primary" : ""
                  }`}
                >
                  <p className="text-sm font-medium truncate">{w.name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {myAccess?.role} · {w.status?.replace("_", " ")}
                  </p>
                  {taskCount > 0 && (
                    <Badge variant="outline" className="mt-1 bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]">
                      {taskCount} pending
                    </Badge>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 text-xs space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Signed in</p>
            <p className="text-muted-foreground break-all">{data.identity.email}</p>
            <p className="text-muted-foreground">Role: <span className="capitalize text-foreground">{role}</span></p>
          </CardContent>
        </Card>
      </aside>

      <section className="min-w-0">
        {!ws ? (
          <p className="text-sm text-muted-foreground">Select a workspace to begin.</p>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{ws.name}</CardTitle>
                  <CardDescription>
                    Based on {ws.template_name_snapshot || "template"} · created {formatDistanceToNow(new Date(ws.created_at), { addSuffix: true })}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">{ws.status?.replace("_", " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="tasks">
                <TabsList>
                  <TabsTrigger value="tasks">Tasks ({wsTasks.length})</TabsTrigger>
                  <TabsTrigger value="sections">Sections ({wsSections.length})</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="mt-4 space-y-2">
                  {wsTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nothing assigned to you right now.</p>
                  ) : (
                    wsTasks.map((rev: any) => (
                      <PortalTaskCard key={rev.id} rev={rev} role={role} token={token} reload={reload} />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="sections" className="mt-4">
                  <Accordion type="multiple">
                    {wsSections.map((s: any) => {
                      const cmts = wsComments.filter((c: any) => c.section_key === s.section_key);
                      return (
                        <AccordionItem key={s.id} value={s.id}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">{s.title}</span>
                              {cmts.length > 0 && <Badge variant="secondary" className="text-[10px]">{cmts.length}</Badge>}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {s.body && (
                              <div className="rounded border p-3 bg-muted/30 mb-3">
                                <pre className="whitespace-pre-wrap font-sans text-sm">{s.body}</pre>
                              </div>
                            )}
                            <PortalCommentForm
                              token={token}
                              instanceId={activeWs!}
                              sectionKey={s.section_key}
                              role={role}
                              reload={reload}
                            />
                            {cmts.length > 0 && (
                              <div className="mt-3 space-y-1.5">
                                {cmts.map((c: any) => (
                                  <div key={c.id} className="rounded border bg-card p-2">
                                    <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </TabsContent>

                <TabsContent value="activity" className="mt-4 space-y-1.5">
                  {wsRevisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
                  ) : (
                    wsRevisions.slice(0, 30).map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between rounded border p-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.section_title || r.section_key}</p>
                          <p className="text-muted-foreground">
                            {r.edited_by_name || "Someone"} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize shrink-0">{r.approval_status}</Badge>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function PortalTaskCard({
  rev, role, token, reload,
}: { rev: any; role: string; token: string; reload: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const canApprove = role === "approver" || role === "signer";

  const submit = async (decision: "approved" | "rejected") => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("clm-external-portal", {
      body: { action: "act", kind: "review", token, revision_id: rev.id, decision, note },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Approved" : "Changes requested");
    reload();
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{rev.section_title || rev.section_key}</p>
          <p className="text-[11px] text-muted-foreground">
            {rev.edited_by_name || "Someone"} · {formatDistanceToNow(new Date(rev.created_at), { addSuffix: true })}
          </p>
          {rev.change_summary && <p className="text-xs italic mt-1">"{rev.change_summary}"</p>}
        </div>
        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 shrink-0">
          <Clock className="h-3 w-3 mr-1" /> Awaiting you
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border bg-muted/30 p-2 max-h-40 overflow-y-auto">
          <p className="font-semibold text-rose-600 mb-1">Before</p>
          <pre className="whitespace-pre-wrap font-sans">{rev.previous_body || <em>empty</em>}</pre>
        </div>
        <div className="rounded border bg-emerald-500/5 p-2 max-h-40 overflow-y-auto">
          <p className="font-semibold text-emerald-700 mb-1">After</p>
          <pre className="whitespace-pre-wrap font-sans">{rev.new_body || <em>empty</em>}</pre>
        </div>
      </div>
      {canApprove ? (
        <>
          <Input placeholder="Optional note…" value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-xs" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => submit("rejected")} disabled={busy}>
              <X className="h-3.5 w-3.5 mr-1" /> Request changes
            </Button>
            <Button size="sm" className="flex-1" onClick={() => submit("approved")} disabled={busy}>
              <Check className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">Your role allows review only — please leave a comment with feedback.</p>
      )}
    </div>
  );
}

function PortalCommentForm({
  token, instanceId, sectionKey, role, reload,
}: { token: string; instanceId: string; sectionKey: string; role: string; reload: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (role === "viewer") return null;

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("clm-external-portal", {
      body: { action: "act", kind: "comment", token, instance_id: instanceId, section_key: sectionKey, message: text },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setText("");
    reload();
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Add a comment for the team…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="text-sm"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={busy || !text.trim()}>
          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Post comment
        </Button>
      </div>
    </div>
  );
}

function SessionCountdown({ expiresAt, onExpire }: { expiresAt?: string; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  // Only show countdown for short-lived tokens (<= ~25h to cover session links)
  const TWENTY_FIVE_HRS = 25 * 60 * 60 * 1000;
  if (remaining > TWENTY_FIVE_HRS) return null;
  if (remaining === 0) {
    setTimeout(onExpire, 0);
    return null;
  }
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const display = h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const urgent = remaining < 5 * 60 * 1000; // < 5 min
  return (
    <Badge
      variant="outline"
      className={`gap-1 font-mono ${
        urgent
          ? "bg-rose-500/15 text-rose-200 border-rose-500/40 animate-pulse"
          : "bg-white/10 text-white border-white/20"
      }`}
      title={`Session expires at ${new Date(expiresAt).toLocaleString()}`}
    >
      <Clock className="h-3 w-3" /> {display}
    </Badge>
  );
}
