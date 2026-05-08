import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSignature, Plus, Loader2, FileText, Upload, AlertCircle, Briefcase, Building2, Users, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { useClmTemplates } from "@/hooks/useClmTemplates";
import { useClmInstances } from "@/hooks/useClmInstance";
import { TemplateUploadDialog } from "@/components/clm/TemplateUploadDialog";
import { TemplateActionsMenu } from "@/components/clm/TemplateActionsMenu";
import { toast } from "sonner";
import SEO from "@/components/seo/SEO";
import { useEffect } from "react";

interface Contract {
  id: string;
  title: string;
  status: string;
  counterparty_name: string | null;
  contract_value: number | null;
  currency: string | null;
  expiry_date: string | null;
  created_at: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const variant = status === "ready" ? "default" : status === "failed" ? "destructive" : "secondary";
  const label = status === "parsing" ? "Sectionalizing…" : status === "uploading" ? "Uploading…" : status;
  return <Badge variant={variant as any} className="capitalize">{label}</Badge>;
};

const ContractsTab = () => {
  const { accountId } = useClmEntitlement();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", counterparty_name: "", contract_value: "", expiry_date: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setContracts((data as Contract[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !accountId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("contracts").insert({
      account_id: accountId, created_by: user!.id, title: form.title.trim(),
      counterparty_name: form.counterparty_name || null,
      contract_value: form.contract_value ? Number(form.contract_value) : null,
      expiry_date: form.expiry_date || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contract created");
    setOpen(false); setForm({ title: "", counterparty_name: "", contract_value: "", expiry_date: "" });
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Contract Repository</CardTitle>
          <CardDescription>{contracts.length} contracts</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Contract</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Contract</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Counterparty</Label><Input value={form.counterparty_name} onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Value</Label><Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} /></div>
                <div><Label>Expiry</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !form.title.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : contracts.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No contracts yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Counterparty</TableHead><TableHead>Status</TableHead><TableHead>Value</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
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
  );
};

const TemplatesTab = () => {
  const { data: templates = [], isLoading } = useClmTemplates();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Contract Templates</CardTitle>
          <CardDescription>Upload an MSA — AI will sectionalize it for legal review</CardDescription>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" />Upload Template</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : templates.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Upload className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No templates uploaded yet. Upload your first MSA to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="relative">
                <Link to={`/contracts/templates/${t.id}`} className="block">
                  <Card className="hover:border-primary/50 transition-colors h-full">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <FileText className="h-8 w-8 text-primary" />
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="font-medium truncate pr-8">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.source_file_name}</p>
                      {t.parse_error && (
                        <p className="text-xs text-destructive mt-2 flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{t.parse_error}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
                <div className="absolute top-3 right-3">
                  <TemplateActionsMenu template={t} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <TemplateUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </Card>
  );
};

const statusTone = (s: string) =>
  s === "executed" ? "default" :
  s === "approved" ? "default" :
  s === "in_review" ? "secondary" :
  s === "archived" ? "outline" : "secondary";

const WorkspacesTab = () => {
  const { data: instances = [], isLoading } = useClmInstances();
  const active = instances.filter((i: any) => !["executed", "archived"].includes(i.status));
  const closed = instances.filter((i: any) => ["executed", "archived"].includes(i.status));

  const totals = {
    active: active.length,
    pendingApprovals: instances.reduce(
      (n: number, i: any) => n + (i.clm_section_revisions?.filter((r: any) => r.approval_status === "pending").length ?? 0),
      0,
    ),
    accountsEngaged: new Set(
      instances.flatMap((i: any) => (i.clm_instance_debtors ?? []).map((d: any) => d.debtors?.id).filter(Boolean)),
    ).size,
  };

  const renderRow = (i: any) => {
    const debtor = i.clm_instance_debtors?.[0]?.debtors;
    const collaborators = i.clm_instance_contacts?.length ?? 0;
    const pending = i.clm_section_revisions?.filter((r: any) => r.approval_status === "pending").length ?? 0;
    return (
      <TableRow key={i.id}>
        <TableCell className="font-medium">
          <Link to={`/contracts/instances/${i.id}`} className="hover:underline flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary shrink-0" /> {i.name}
          </Link>
          <p className="text-xs text-muted-foreground ml-6">Based on {i.clm_templates?.name ?? i.template_name_snapshot ?? "—"}</p>
        </TableCell>
        <TableCell>
          {debtor ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{debtor.company_name ?? debtor.name ?? "—"}</span>
            </div>
          ) : <span className="text-xs text-muted-foreground italic">Unassigned</span>}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-sm">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />{collaborators}
          </div>
        </TableCell>
        <TableCell>
          {pending > 0 ? (
            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{pending} pending</Badge>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> none</span>
          )}
        </TableCell>
        <TableCell><Badge variant={statusTone(i.status) as any} className="capitalize">{i.status.replace("_", " ")}</Badge></TableCell>
        <TableCell className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Active engagements</p>
          <p className="text-2xl font-bold mt-1">{totals.active}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Accounts engaged</p>
          <p className="text-2xl font-bold mt-1">{totals.accountsEngaged}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending approvals</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{totals.pendingApprovals}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Workspaces</CardTitle>
          <CardDescription>Active negotiation engagements with debtor accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : active.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No active workspaces. Open a template and click "Use Template" to spin one up.
            </p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Collaborators</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow></TableHeader>
              <TableBody>{active.map(renderRow)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {closed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Closed engagements</CardTitle>
            <CardDescription>Executed or archived workspaces</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Collaborators</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow></TableHeader>
              <TableBody>{closed.map(renderRow)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ContractsInner = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title="Contracts | Recouply CLM" description="Contract Lifecycle Management on Recouply.ai" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSignature className="h-6 w-6 text-primary" /> Contract Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-native CLM: upload templates, sectionalize, and collaborate with accounts.
        </p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="instances">Collaborations</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="instances"><InstancesTab /></TabsContent>
        <TabsContent value="contracts"><ContractsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default function Contracts() {
  return (
    <Layout><RequireClmAccess><ContractsInner /></RequireClmAccess></Layout>
  );
}
