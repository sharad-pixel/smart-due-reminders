import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { RequireClmAccess } from "@/components/clm/RequireClmAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSignature, Plus, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { toast } from "sonner";
import SEO from "@/components/seo/SEO";

interface Contract {
  id: string;
  title: string;
  status: string;
  counterparty_name: string | null;
  contract_value: number | null;
  currency: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

const ContractsInner = () => {
  const { accountId } = useClmEntitlement();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    counterparty_name: "",
    contract_value: "",
    effective_date: "",
    expiry_date: "",
    notes: "",
  });

  const loadContracts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setContracts((data as Contract[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !accountId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("contracts").insert({
      account_id: accountId,
      created_by: user!.id,
      title: form.title.trim(),
      counterparty_name: form.counterparty_name || null,
      contract_value: form.contract_value ? Number(form.contract_value) : null,
      effective_date: form.effective_date || null,
      expiry_date: form.expiry_date || null,
      metadata: form.notes ? { notes: form.notes } : {},
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contract created");
    setOpen(false);
    setForm({ title: "", counterparty_name: "", contract_value: "", effective_date: "", expiry_date: "", notes: "" });
    loadContracts();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title="Contracts | Recouply CLM" description="Contract Lifecycle Management on Recouply.ai" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            Contracts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Repository of executed and in-progress contracts. Foundation for AI-native CLM.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Contract</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Contract</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="MSA — Acme Corp" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Counterparty</Label>
                  <Input value={form.counterparty_name} onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })} />
                </div>
                <div>
                  <Label>Value (USD)</Label>
                  <Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Effective</Label>
                  <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
                </div>
                <div>
                  <Label>Expiry</Label>
                  <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !form.title.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Repository</CardTitle>
          <CardDescription>{contracts.length} contracts</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : contracts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No contracts yet. Create your first one to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.counterparty_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell>{c.contract_value ? `${c.currency ?? "USD"} ${Number(c.contract_value).toLocaleString()}` : "—"}</TableCell>
                    <TableCell>{c.expiry_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function Contracts() {
  return (
    <Layout>
      <RequireClmAccess>
        <ContractsInner />
      </RequireClmAccess>
    </Layout>
  );
}
