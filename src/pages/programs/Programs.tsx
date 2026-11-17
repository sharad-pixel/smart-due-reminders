import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FolderKanban, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Program = { id: string; name: string; description: string | null; status: string; created_at: string };

export default function Programs() {
  const { effectiveAccountId, loading: acctLoading } = useEffectiveAccount();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("programs").select("*").order("created_at", { ascending: false });
    setPrograms((data as Program[]) ?? []);
    const { data: items } = await supabase.from("program_items").select("program_id");
    const c: Record<string, number> = {};
    (items ?? []).forEach((i: any) => (c[i.program_id] = (c[i.program_id] ?? 0) + 1));
    setCounts(c);
    setLoading(false);
  };
  useEffect(() => { if (!acctLoading) load(); }, [acctLoading]);

  const create = async () => {
    if (!name.trim() || !effectiveAccountId) return;
    setSaving(true);
    const { error } = await supabase.from("programs").insert({ name: name.trim(), description: desc.trim() || null, account_id: effectiveAccountId });
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(false); setName(""); setDesc(""); load();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FolderKanban className="h-6 w-6 text-primary" />Program Management</h1>
            <p className="text-muted-foreground">Run transformations by workstream — bring in RAID, RACI and key decisions, and let AI keep watch.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New Program</Button>
        </div>
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : programs.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No programs yet. Create one to start tracking a transformation.</CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => (
              <Link key={p.id} to={`/programs/${p.id}`}>
                <Card className="h-full hover:border-primary transition-colors">
                  <CardHeader className="pb-2"><CardTitle className="text-lg">{p.name}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.description || "No description"}</p>
                    <div className="flex gap-2"><Badge variant="secondary">{p.status}</Badge><Badge variant="outline">{counts[p.id] ?? 0} items</Badge></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Program</DialogTitle></DialogHeader>
          <Input placeholder="Program name, e.g. Q2C Transformation" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="Goal and scope (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <DialogFooter><Button onClick={create} disabled={saving || !name.trim()}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
