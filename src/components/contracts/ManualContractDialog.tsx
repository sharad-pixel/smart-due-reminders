import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, FileSignature, Building2, ChevronsUpDown, Sparkles, Upload, Paperclip, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { toast } from "sonner";
import { BusinessProfilePicker } from "@/components/clm/BusinessProfilePicker";
import { ProfileMetadataFields } from "@/components/clm/ProfileMetadataFields";
import { BusinessProfileId, getBusinessProfile } from "@/lib/clm/businessProfiles";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtorId?: string;
  debtorName?: string;
}

interface CustomField {
  id: string;
  group: string;
  key: string;
  value: string;
}

const FIELD_GROUPS = [
  { id: "contract", label: "Contract" },
  { id: "customer", label: "Customer & Parties" },
  { id: "commercial", label: "Commercial" },
  { id: "dates", label: "Critical Dates" },
  { id: "legal", label: "Legal Clauses" },
  { id: "poc", label: "POC / Pilot" },
  { id: "custom", label: "Custom" },
];

const slugifyKey = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const groupForProfileField = (key: string): string => {
  if (/date|start|end|term/i.test(key)) return "dates";
  if (/payment|billing|fee|rate|price|frequency|po_|order/i.test(key)) return "commercial";
  return "commercial";
};

export function ManualContractDialog({ open, onOpenChange, debtorId, debtorName }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { effectiveAccountId } = useEffectiveAccount();

  // Basics
  const [contractName, setContractName] = useState("");
  const [contractType, setContractType] = useState("");
  const [industry, setIndustry] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [termEndDate, setTermEndDate] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [notes, setNotes] = useState("");

  // Customer
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(debtorId || null);
  const [selectedDebtorName, setSelectedDebtorName] = useState<string | null>(debtorName || null);
  const [debtorOpen, setDebtorOpen] = useState(false);
  const [debtorSearch, setDebtorSearch] = useState("");

  // Profile metadata
  const [profile, setProfile] = useState<BusinessProfileId>("saas");
  const [profileMeta, setProfileMeta] = useState<Record<string, any>>({});

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Supporting documents (optional)
  const ACCEPT_DOCS = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"];
  const MAX_DOC_BYTES = 25 * 1024 * 1024;
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const addAttachments = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const ok: File[] = [];
    const errors: string[] = [];
    for (const f of arr) {
      const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
      if (!ACCEPT_DOCS.includes(ext)) errors.push(`${f.name}: unsupported type`);
      else if (f.size > MAX_DOC_BYTES) errors.push(`${f.name}: exceeds 25MB`);
      else ok.push(f);
    }
    if (errors.length) toast.error(errors.join(" • "));
    if (ok.length) setAttachments((prev) => [...prev, ...ok]);
  };

  const profileDef = useMemo(() => getBusinessProfile(profile), [profile]);

  const { data: debtors = [] } = useQuery({
    queryKey: ["manual-contract-debtors", debtorSearch],
    enabled: open && debtorOpen,
    queryFn: async () => {
      let q = supabase.from("debtors").select("id, company_name, name, email")
        .order("company_name", { ascending: true }).limit(50);
      if (debtorSearch.trim()) {
        const s = `%${debtorSearch.trim()}%`;
        q = q.or(`company_name.ilike.${s},name.ilike.${s},email.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const reset = () => {
    setContractName(""); setContractType(""); setIndustry("");
    setEffectiveDate(""); setTermEndDate(""); setContractValue("");
    setProductDescription(""); setNotes("");
    setProfile("saas"); setProfileMeta({});
    setCustomFields([]);
    setAttachments([]);
    if (!debtorId) { setSelectedDebtorId(null); setSelectedDebtorName(null); }
  };

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, {
      id: crypto.randomUUID(), group: "custom", key: "", value: "",
    }]);
  };
  const updateCustomField = (id: string, patch: Partial<CustomField>) => {
    setCustomFields((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
  };
  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!effectiveAccountId) throw new Error("No account context");
      if (!contractName.trim()) throw new Error("Contract name is required");

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");

      // 1. Insert live_contract_imports row
      const { data: imp, error: impErr } = await supabase
        .from("live_contract_imports")
        .insert({
          account_id: effectiveAccountId,
          user_id: uid,
          source: "upload",
          file_name: `Manual: ${contractName.trim()}`,
          status: "imported",
          staging_status: "published",
          progress_pct: 100,
          confidence: 100,
          debtor_id: selectedDebtorId,
          contract_name: contractName.trim(),
          contract_type: contractType.trim() || null,
          industry: industry.trim() || null,
          effective_date: effectiveDate || null,
          term_end_date: termEndDate || null,
          contract_value: contractValue ? Number(contractValue) : null,
          product_description: productDescription.trim() || null,
          published_at: new Date().toISOString(),
          staging_completed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (impErr) throw impErr;

      // 2. Insert extraction
      const { data: ext, error: extErr } = await supabase
        .from("live_contract_extractions")
        .insert({
          account_id: effectiveAccountId,
          import_id: imp.id,
          model: "manual-entry",
          raw_text: notes.trim() || null,
          ai_response: { source: "manual_entry", profile },
        })
        .select()
        .single();
      if (extErr) throw extErr;

      // 3. Build extracted_fields rows from standard fields + profile meta + customs
      const rows: any[] = [];
      const push = (group: string, key: string, value: any) => {
        if (value === null || value === undefined || value === "") return;
        rows.push({
          account_id: effectiveAccountId,
          import_id: imp.id,
          extraction_id: ext.id,
          field_group: group,
          field_key: key,
          field_value: String(value),
          confidence: 100,
          edited_by_user: uid,
          approved: true,
        });
      };

      push("contract", "contract_name", contractName);
      push("contract", "contract_type", contractType);
      push("contract", "industry", industry);
      push("contract", "business_profile", profileDef.label);
      push("commercial", "contract_value", contractValue);
      push("commercial", "product_description", productDescription);
      push("dates", "effective_date", effectiveDate);
      push("dates", "term_end_date", termEndDate);

      if (selectedDebtorName) push("customer", "customer_name", selectedDebtorName);

      // Profile metadata
      for (const f of profileDef.fields) {
        const v = profileMeta[f.key];
        if (v === undefined || v === null || v === "") continue;
        push(groupForProfileField(f.key), f.key, typeof v === "boolean" ? (v ? "Yes" : "No") : v);
      }

      // Custom fields
      for (const cf of customFields) {
        const key = slugifyKey(cf.key);
        if (!key) continue;
        push(cf.group || "custom", key, cf.value);
      }

      if (rows.length) {
        const { error: fErr } = await supabase
          .from("live_contract_extracted_fields")
          .insert(rows);
        if (fErr) throw fErr;
      }

      // 4. Audit log (best-effort)
      try {
        await supabase.from("live_contract_audit_log").insert({
          account_id: effectiveAccountId,
          user_id: uid,
          import_id: imp.id,
          event_type: "manual_contract_created",
          event_details: { field_count: rows.length, profile },
        });
      } catch { /* ignore */ }

      // 5. Upload supporting documents (best-effort, non-blocking)
      if (attachments.length) {
        for (const file of attachments) {
          try {
            const path = `${effectiveAccountId}/${imp.id}/supporting/${crypto.randomUUID()}-${file.name}`;
            const { error: upErr } = await supabase.storage
              .from("live-contracts")
              .upload(path, file, { contentType: file.type, upsert: false });
            if (upErr) throw upErr;
            const { error: docErr } = await supabase
              .from("live_contract_supporting_docs")
              .insert({
                account_id: effectiveAccountId,
                import_id: imp.id,
                uploaded_by: uid,
                doc_type: "other",
                file_name: file.name,
                storage_path: path,
                mime_type: file.type,
                file_size: file.size,
              });
            if (docErr) throw docErr;
          } catch (e: any) {
            toast.error(`${file.name}: ${e.message || "upload failed"}`);
          }
        }
      }

      return imp;
    },
    onSuccess: (imp) => {
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
      toast.success("Contract created");
      onOpenChange(false);
      reset();
      navigate(`/ai-ingestion/${imp.id}`);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create contract"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!create.isPending) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Create Contract Manually
          </DialogTitle>
          <DialogDescription>
            Enter contract details using standard fields. Add custom fields to capture anything specific to your business.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basics */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">1</Badge> Basics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium">Contract name *</Label>
                <Input value={contractName} onChange={(e) => setContractName(e.target.value)} placeholder="e.g. Acme MSA 2026" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Contract type</Label>
                <Input value={contractType} onChange={(e) => setContractType(e.target.value)} placeholder="MSA, Order Form, SOW…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Industry</Label>
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS, Healthcare…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Effective date</Label>
                <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Term end date</Label>
                <Input type="date" value={termEndDate} onChange={(e) => setTermEndDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Contract value (TCV)</Label>
                <Input type="number" value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Customer</Label>
                <Popover open={debtorOpen} onOpenChange={setDebtorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="flex items-center gap-2 truncate">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedDebtorName || "Select customer…"}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search customers…" value={debtorSearch} onValueChange={setDebtorSearch} />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {selectedDebtorId && (
                            <CommandItem onSelect={() => { setSelectedDebtorId(null); setSelectedDebtorName(null); setDebtorOpen(false); }}>
                              <span className="text-muted-foreground">Clear selection</span>
                            </CommandItem>
                          )}
                          {debtors.map((d: any) => (
                            <CommandItem
                              key={d.id}
                              onSelect={() => {
                                setSelectedDebtorId(d.id);
                                setSelectedDebtorName(d.company_name || d.name || d.email);
                                setDebtorOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm">{d.company_name || d.name || "Unnamed"}</span>
                                {d.email && <span className="text-xs text-muted-foreground">{d.email}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium">Product / scope description</Label>
                <Textarea rows={2} value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="What's being delivered or licensed?" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Business profile + structured metadata */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">2</Badge> Standard Terms
              <span className="text-xs font-normal text-muted-foreground">— pick the profile that matches this deal</span>
            </h3>
            <BusinessProfilePicker value={profile} onChange={setProfile} compact />
            <div className="rounded-md border p-3 bg-muted/20">
              <ProfileMetadataFields profile={profile} value={profileMeta} onChange={setProfileMeta} />
            </div>
          </section>

          <Separator />

          {/* Custom fields */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">3</Badge> Custom Fields
                <span className="text-xs font-normal text-muted-foreground">— capture anything else that matters</span>
              </h3>
              <Button type="button" size="sm" variant="outline" onClick={addCustomField}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add field
              </Button>
            </div>

            {customFields.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No custom fields yet. Click "Add field" to define your own.</p>
            ) : (
              <div className="space-y-2">
                {customFields.map((cf) => (
                  <div key={cf.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-3">
                      <Select value={cf.group} onValueChange={(v) => updateCustomField(cf.id, { group: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIELD_GROUPS.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="col-span-4 h-9"
                      placeholder="Field name (e.g. data_residency)"
                      value={cf.key}
                      onChange={(e) => updateCustomField(cf.id, { key: e.target.value })}
                    />
                    <Input
                      className="col-span-4 h-9"
                      placeholder="Value"
                      value={cf.value}
                      onChange={(e) => updateCustomField(cf.id, { value: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" className="col-span-1 h-9 w-9 text-destructive" onClick={() => removeCustomField(cf.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-1">
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else to remember about this contract…" />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !contractName.trim()}>
            {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {create.isPending ? "Creating…" : "Create contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ManualContractDialog;
