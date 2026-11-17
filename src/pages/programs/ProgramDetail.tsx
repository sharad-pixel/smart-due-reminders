import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Sparkles, Upload, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Item = Record<string, any>;
const RAID = ["risk", "assumption", "issue", "dependency"];
const TYPE_LABEL: Record<string, string> = { risk: "Risk", assumption: "Assumption", issue: "Issue", dependency: "Dependency", raci: "RACI", decision: "Decision" };

async function invokeAI(body: object) {
  const { data, error } = await supabase.functions.invoke("program-ai", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context.json()).error ?? msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function ProgramDetail() {
  const { id } = useParams();
  const [program, setProgram] = useState<Item | null>(null);
  const [wss, setWss] = useState<Item[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [ws, setWs] = useState("all");
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestText, setIngestText] = useState("");
  const [busy, setBusy] = useState<"" | "ingest" | "summary">("");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Item>({ item_type: "risk" });
  const [newWs, setNewWs] = useState("");

  const load = async () => {
    const [{ data: p }, { data: w }, { data: i }] = await Promise.all([
      supabase.from("programs").select("*").eq("id", id!).maybeSingle(),
      supabase.from("program_workstreams").select("*").eq("program_id", id!).order("name"),
      supabase.from("program_items").select("*").eq("program_id", id!).order("created_at", { ascending: false }),
    ]);
    setProgram(p); setWss(w ?? []); setItems(i ?? []);
  };
  useEffect(() => { load(); }, [id]);

  const wsName = useMemo(() => new Map(wss.map((w) => [w.id, w.name])), [wss]);
  const shown = items.filter((i) => ws === "all" || (ws === "none" ? !i.workstream_id : i.workstream_id === ws));
  const raid = shown.filter((i) => RAID.includes(i.item_type));
  const raci = shown.filter((i) => i.item_type === "raci");
  const kdd = shown.filter((i) => i.item_type === "decision");
  const openRisks = items.filter((i) => RAID.includes(i.item_type) && !/closed|resolved|done|approved/i.test(i.status));
  const today = new Date().toISOString().slice(0, 10);
  const overdue = items.filter((i) => i.due_date && i.due_date < today && !/closed|resolved|done|approved/i.test(i.status));
  const noAccountable = items.filter((i) => i.item_type === "raci" && !i.accountable);

  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("File must be under 5MB");
    setIngestText(await f.text());
  };
  const ingest = async () => {
    setBusy("ingest");
    try { const r = await invokeAI({ action: "ingest", programId: id, text: ingestText }); toast.success(`Added ${r.created} items`); setIngestOpen(false); setIngestText(""); load(); }
    catch (e: any) { toast.error(e.message); }
    setBusy("");
  };
  const summarize = async () => {
    setBusy("summary");
    try { const r = await invokeAI({ action: "summary", programId: id }); setProgram((p) => p && { ...p, ai_summary: r.summary, ai_summary_at: new Date().toISOString() }); }
    catch (e: any) { toast.error(e.message); }
    setBusy("");
  };
  const addWs = async () => {
    if (!newWs.trim()) return;
    const { error } = await supabase.from("program_workstreams").insert({ program_id: id!, name: newWs.trim() });
    if (error) return toast.error(error.message);
    setNewWs(""); load();
  };
  const saveItem = async () => {
    if (!draft.title?.trim()) return;
    const { error } = await supabase.from("program_items").insert({ ...draft, program_id: id!, workstream_id: draft.workstream_id || null, due_date: draft.due_date || null } as any);
    if (error) return toast.error(error.message);
    setAddOpen(false); setDraft({ item_type: "risk" }); load();
  };
  const updateStatus = async (itemId: string, status: string) => {
    await supabase.from("program_items").update({ status, updated_at: new Date().toISOString() }).eq("id", itemId);
    setItems((x) => x.map((i) => (i.id === itemId ? { ...i, status } : i)));
  };
  const del = async (itemId: string) => { await supabase.from("program_items").delete().eq("id", itemId); setItems((x) => x.filter((i) => i.id !== itemId)); };

  if (!program) return <Layout><Loader2 className="h-6 w-6 animate-spin" /></Layout>;

  const statusCell = (i: Item) => (
    <Select value={i.status} onValueChange={(v) => updateStatus(i.id, v)}>
      <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
      <SelectContent>{["open", "in_progress", "pending", "resolved", "closed"].concat(i.status && !["open","in_progress","pending","resolved","closed"].includes(i.status) ? [i.status] : []).map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
    </Select>
  );
  const wsCell = (i: Item) => <TableCell className="text-muted-foreground">{wsName.get(i.workstream_id) ?? "—"}</TableCell>;
  const delCell = (i: Item) => <TableCell><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del(i.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>;
  const empty = (cols: number) => <TableRow><TableCell colSpan={cols} className="text-center text-muted-foreground py-8">Nothing here yet — add items or use AI Ingest.</TableCell></TableRow>;

  return (
    <Layout>
      <div className="space-y-6">
        <Link to="/programs" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />All programs</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-bold">{program.name}</h1><p className="text-muted-foreground">{program.description}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
            <Button variant="outline" onClick={() => setIngestOpen(true)}><Upload className="h-4 w-4 mr-1" />AI Ingest</Button>
            <Button onClick={summarize} disabled={busy === "summary"}>{busy === "summary" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}AI Health Check</Button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[["Workstreams", wss.length], ["Open RAID items", openRisks.length], ["Overdue", overdue.length], ["RACI gaps (no Accountable)", noAccountable.length]].map(([l, v]) => (
            <Card key={l as string}><CardContent className="pt-6"><div className="text-2xl font-bold">{v}</div><div className="text-sm text-muted-foreground">{l}</div></CardContent></Card>
          ))}
        </div>

        {program.ai_summary && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI Program Health {program.ai_summary_at && <span className="text-xs font-normal text-muted-foreground">· {new Date(program.ai_summary_at).toLocaleString()}</span>}</CardTitle></CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{program.ai_summary}</ReactMarkdown></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Workstreams</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={ws === "all" ? "default" : "outline"} onClick={() => setWs("all")}>All</Button>
            {wss.map((w) => <Button key={w.id} size="sm" variant={ws === w.id ? "default" : "outline"} onClick={() => setWs(w.id)}>{w.name} <span className="ml-1 opacity-70">{items.filter((i) => i.workstream_id === w.id).length}</span></Button>)}
            <div className="flex gap-2 ml-auto"><Input className="h-9 w-48" placeholder="New workstream" value={newWs} onChange={(e) => setNewWs(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addWs()} /><Button size="sm" variant="outline" onClick={addWs}>Add</Button></div>
          </CardContent>
        </Card>

        <Tabs defaultValue="raid">
          <TabsList><TabsTrigger value="raid">RAID ({raid.length})</TabsTrigger><TabsTrigger value="raci">RACI ({raci.length})</TabsTrigger><TabsTrigger value="kdd">Key Decisions ({kdd.length})</TabsTrigger></TabsList>
          <TabsContent value="raid"><Card><CardContent className="pt-4 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Title</TableHead><TableHead>Workstream</TableHead><TableHead>Owner</TableHead><TableHead>Severity</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{raid.length ? raid.map((i) => <TableRow key={i.id}><TableCell><Badge variant={i.item_type === "issue" || i.item_type === "risk" ? "destructive" : "secondary"}>{TYPE_LABEL[i.item_type]}</Badge></TableCell><TableCell><div className="font-medium">{i.title}</div>{i.description && <div className="text-xs text-muted-foreground line-clamp-2">{i.description}</div>}</TableCell>{wsCell(i)}<TableCell>{i.owner ?? "—"}</TableCell><TableCell>{i.severity ?? "—"}</TableCell><TableCell className={i.due_date && i.due_date < today ? "text-destructive" : ""}>{i.due_date ?? "—"}</TableCell><TableCell>{statusCell(i)}</TableCell>{delCell(i)}</TableRow>) : empty(8)}</TableBody>
          </Table></CardContent></Card></TabsContent>
          <TabsContent value="raci"><Card><CardContent className="pt-4 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Workstream</TableHead><TableHead>Responsible</TableHead><TableHead>Accountable</TableHead><TableHead>Consulted</TableHead><TableHead>Informed</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{raci.length ? raci.map((i) => <TableRow key={i.id}><TableCell className="font-medium">{i.title}</TableCell>{wsCell(i)}<TableCell>{i.responsible ?? "—"}</TableCell><TableCell>{i.accountable ?? <Badge variant="destructive">Missing</Badge>}</TableCell><TableCell>{i.consulted ?? "—"}</TableCell><TableCell>{i.informed ?? "—"}</TableCell>{delCell(i)}</TableRow>) : empty(7)}</TableBody>
          </Table></CardContent></Card></TabsContent>
          <TabsContent value="kdd"><Card><CardContent className="pt-4 overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Decision</TableHead><TableHead>Workstream</TableHead><TableHead>Owner</TableHead><TableHead>Rationale</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{kdd.length ? kdd.map((i) => <TableRow key={i.id}><TableCell className="font-medium">{i.title}</TableCell>{wsCell(i)}<TableCell>{i.owner ?? "—"}</TableCell><TableCell className="text-sm text-muted-foreground max-w-xs">{i.rationale ?? "—"}</TableCell><TableCell>{i.due_date ?? "—"}</TableCell><TableCell>{statusCell(i)}</TableCell>{delCell(i)}</TableRow>) : empty(7)}</TableBody>
          </Table></CardContent></Card></TabsContent>
        </Tabs>
      </div>

      <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>AI Ingest — RAID, RACI & Key Decisions</DialogTitle>
            <DialogDescription>Upload a CSV or text export, or paste rows from your spreadsheet. AI sorts each row into the right log and workstream; new workstreams are created automatically.</DialogDescription></DialogHeader>
          <Input type="file" accept=".csv,.txt,.tsv,.md" onChange={(e) => onFile(e.target.files?.[0])} />
          <Textarea rows={12} placeholder={"Workstream, Type, Title, Owner, Due, Status\nBilling, Risk, Legacy invoice data quality, Priya, 2026-12-15, Open\nOrder Mgmt, Decision, Adopt single order form, CFO, 2026-11-01, Approved"} value={ingestText} onChange={(e) => setIngestText(e.target.value)} />
          <DialogFooter><Button onClick={ingest} disabled={busy === "ingest" || ingestText.trim().length < 10}>{busy === "ingest" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}Ingest with AI</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Item</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={draft.item_type} onValueChange={(v) => setDraft({ ...draft, item_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
              <Select value={draft.workstream_id ?? ""} onValueChange={(v) => setDraft({ ...draft, workstream_id: v })}><SelectTrigger><SelectValue placeholder="Workstream" /></SelectTrigger><SelectContent>{wss.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <Input placeholder={draft.item_type === "raci" ? "Activity" : draft.item_type === "decision" ? "Decision" : "Title"} value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            {draft.item_type === "raci" ? (
              <div className="grid grid-cols-2 gap-2">{["responsible", "accountable", "consulted", "informed"].map((k) => <Input key={k} placeholder={k[0].toUpperCase() + k.slice(1)} value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />)}</div>
            ) : (
              <>
                <Textarea placeholder={draft.item_type === "decision" ? "Rationale" : "Description"} value={(draft.item_type === "decision" ? draft.rationale : draft.description) ?? ""} onChange={(e) => setDraft({ ...draft, [draft.item_type === "decision" ? "rationale" : "description"]: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Owner" value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
                  <Select value={draft.severity ?? ""} onValueChange={(v) => setDraft({ ...draft, severity: v })}><SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger><SelectContent>{["low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                  <Input type="date" value={draft.due_date ?? ""} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <DialogFooter><Button onClick={saveItem} disabled={!draft.title?.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
