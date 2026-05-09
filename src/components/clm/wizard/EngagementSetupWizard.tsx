import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Search, Check, ArrowRight, ArrowLeft, ShieldCheck, FileText,
  Users, Sparkles, X, Plus, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  INDUSTRIES, ENGAGEMENT_TYPES, BUSINESS_MODELS, COMPANY_SIZES, REGIONS, CUSTOMER_TYPES,
  APPROVER_LABELS, IndustryId, EngagementTypeId, BusinessModelId, ApproverRoleId,
  recommendDocuments, recommendCompliance, recommendApprovals, deriveRiskLevel, RISK_BADGE,
  ComplianceFlag,
} from "@/lib/clm/engagementConfig";
import { useCreateClmInstance } from "@/hooks/useClmInstance";
import { useSaveEngagementProfile } from "@/hooks/useEngagementProfile";
import { useClmTemplates } from "@/hooks/useClmTemplates";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

const STEPS = [
  { id: 1, title: "Customer", icon: Building2 },
  { id: 2, title: "Industry", icon: Sparkles },
  { id: 3, title: "Engagement", icon: FileText },
  { id: 4, title: "Business Model", icon: FileText },
  { id: 5, title: "Documents", icon: FileText },
  { id: 6, title: "Compliance", icon: ShieldCheck },
  { id: 7, title: "Approvals", icon: Users },
];

export const EngagementSetupWizard = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [customerName, setCustomerName] = useState("");
  const [legalEntity, setLegalEntity] = useState("");
  const [companySize, setCompanySize] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [customerType, setCustomerType] = useState<string>("Prospect");
  const [accountOwner, setAccountOwner] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [debtorId, setDebtorId] = useState<string | null>(null);
  const [debtorLabel, setDebtorLabel] = useState("");
  const [debtorSearch, setDebtorSearch] = useState("");

  // Step 2-4
  const [industries, setIndustries] = useState<IndustryId[]>([]);
  const [engagementType, setEngagementType] = useState<EngagementTypeId | "">("");
  const [businessModel, setBusinessModel] = useState<BusinessModelId | "">("");

  // Step 5
  const [documents, setDocuments] = useState<{ document_type: string; source: "recommended" | "custom" }[]>([]);
  const [docDraft, setDocDraft] = useState("");

  // Step 6
  const [compliance, setCompliance] = useState<ComplianceFlag[]>([]);

  // Step 7
  const [approvals, setApprovals] = useState<{ role: ApproverRoleId; reason: string }[]>([]);

  const createInstance = useCreateClmInstance();
  const saveProfile = useSaveEngagementProfile();
  const { data: templates = [] } = useClmTemplates();

  const { data: debtors = [] } = useQuery({
    queryKey: ["wizard-debtor-search", debtorSearch],
    enabled: open && step === 1,
    queryFn: async () => {
      let q = supabase.from("debtors").select("id, company_name, name, email")
        .eq("is_archived", false).limit(20);
      if (debtorSearch.trim()) {
        q = q.or(`company_name.ilike.%${debtorSearch}%,name.ilike.%${debtorSearch}%,email.ilike.%${debtorSearch}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  // Auto-recommend on relevant step changes
  const recommendedDocs = useMemo(
    () => recommendDocuments(industries, engagementType || undefined, businessModel || undefined),
    [industries, engagementType, businessModel],
  );
  const recommendedCompliance = useMemo(
    () => recommendCompliance(industries, engagementType || undefined),
    [industries, engagementType],
  );
  const recommendedApprovals = useMemo(
    () => recommendApprovals(industries, engagementType || undefined, businessModel || undefined, recommendedCompliance),
    [industries, engagementType, businessModel, recommendedCompliance],
  );
  const riskLevel = useMemo(
    () => deriveRiskLevel(industries, businessModel || undefined, recommendedCompliance),
    [industries, businessModel, recommendedCompliance],
  );

  // Hydrate selections when entering each step
  const enterStep = (n: number) => {
    if (n === 5 && documents.length === 0) {
      setDocuments(recommendedDocs.map((d) => ({ document_type: d, source: "recommended" })));
    }
    if (n === 6 && compliance.length === 0) setCompliance(recommendedCompliance);
    if (n === 7 && approvals.length === 0) setApprovals(recommendedApprovals);
    setStep(n);
  };

  const reset = () => {
    setStep(1); setCustomerName(""); setLegalEntity(""); setCompanySize(""); setRegion("");
    setCustomerType("Prospect"); setAccountOwner(""); setOpportunityId("");
    setDebtorId(null); setDebtorLabel(""); setDebtorSearch("");
    setIndustries([]); setEngagementType(""); setBusinessModel("");
    setDocuments([]); setDocDraft(""); setCompliance([]); setApprovals([]);
  };
  const close = () => { reset(); onOpenChange(false); };

  const canAdvance = (): boolean => {
    if (step === 1) return !!customerName.trim() && !!debtorId;
    if (step === 2) return industries.length > 0;
    if (step === 3) return !!engagementType;
    if (step === 4) return !!businessModel;
    if (step === 5) return documents.length > 0;
    return true;
  };

  const toggleIndustry = (id: IndustryId) =>
    setIndustries((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Try to pick a sensible primary template based on industries.
  const pickTemplate = () => {
    const ready = templates.filter((t: any) => t.status === "ready");
    if (!ready.length) return null;
    const match = ready.find((t: any) => {
      const cat = (t as any).industry_category as string | undefined;
      if (!cat) return false;
      if (industries.includes("healthcare")) return cat === "healthcare";
      if (industries.includes("saas") || industries.includes("ai")) return cat === "saas";
      return false;
    });
    return match ?? ready[0];
  };

  const finish = async () => {
    if (!debtorId) return;
    const template = pickTemplate();
    if (!template) {
      toast.error("No ready templates found. Please add a template first.");
      return;
    }
    try {
      const inst = await createInstance.mutateAsync({
        template_id: template.id,
        name: `${customerName} — ${ENGAGEMENT_TYPES.find((e) => e.id === engagementType)?.label ?? "Engagement"}`,
        debtor_id: debtorId,
      });
      await saveProfile.mutateAsync({
        instance_id: inst.id,
        account_id: inst.account_id,
        customer_info: {
          customer_name: customerName, legal_entity: legalEntity,
          company_size: companySize, region, customer_type: customerType,
          account_owner: accountOwner, opportunity_id: opportunityId,
        },
        industries,
        engagement_type: engagementType as EngagementTypeId,
        business_model: businessModel as BusinessModelId,
        risk_level: riskLevel,
        documents,
        compliance,
        approvals,
      });
      toast.success("Workspace configured");
      close();
      navigate(`/contracts/instances/${inst.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create workspace");
    }
  };

  const progress = (step / STEPS.length) * 100;
  const StepIcon = STEPS[step - 1].icon;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StepIcon className="h-5 w-5 text-primary" />
            Engagement Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Step {step} of {STEPS.length} — {STEPS[step - 1].title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className="flex flex-wrap gap-1.5 text-xs">
            {STEPS.map((s) => (
              <Badge
                key={s.id}
                variant={s.id === step ? "default" : s.id < step ? "secondary" : "outline"}
                className="font-normal"
              >
                {s.id}. {s.title}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {/* STEP 1 — Customer */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Counterparty account</Label>
                {debtorId ? (
                  <div className="mt-2 flex items-center justify-between rounded border bg-muted/40 p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{debtorLabel}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setDebtorId(null); setDebtorLabel(""); }}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative mt-2">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input value={debtorSearch} onChange={(e) => setDebtorSearch(e.target.value)}
                        placeholder="Search accounts…" className="pl-8" />
                    </div>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded border">
                      {debtors.map((d: any) => (
                        <button key={d.id} type="button"
                          onClick={() => {
                            setDebtorId(d.id);
                            const lbl = d.company_name || d.name || d.email;
                            setDebtorLabel(lbl);
                            if (!customerName) setCustomerName(lbl);
                          }}
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {d.company_name || d.name || d.email}
                        </button>
                      ))}
                      {debtors.length === 0 && (
                        <div className="p-3 text-xs text-muted-foreground">No accounts found.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Customer name</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <Label>Legal entity</Label>
                  <Input value={legalEntity} onChange={(e) => setLegalEntity(e.target.value)} placeholder="Acme, Inc." />
                </div>
                <div>
                  <Label>Company size</Label>
                  <Select value={companySize} onValueChange={setCompanySize}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Region</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Customer type</Label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CUSTOMER_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Account owner</Label>
                  <Input value={accountOwner} onChange={(e) => setAccountOwner(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Opportunity ID (CRM)</Label>
                  <Input value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} placeholder="OPP-12345" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — Industry */}
          {step === 2 && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Select all industries that apply. This drives document, compliance, and approval recommendations.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INDUSTRIES.map((i) => {
                  const selected = industries.includes(i.id);
                  return (
                    <button key={i.id} type="button" onClick={() => toggleIndustry(i.id)}
                      className={`flex items-center gap-2 rounded border px-3 py-2 text-sm text-left transition ${
                        selected ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}>
                      <Checkbox checked={selected} />
                      {i.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3 — Engagement */}
          {step === 3 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ENGAGEMENT_TYPES.map((e) => (
                <button key={e.id} type="button" onClick={() => setEngagementType(e.id)}
                  className={`rounded border px-3 py-2 text-sm text-left transition ${
                    engagementType === e.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}>
                  {e.label}
                </button>
              ))}
            </div>
          )}

          {/* STEP 4 — Business model */}
          {step === 4 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BUSINESS_MODELS.map((m) => (
                <button key={m.id} type="button" onClick={() => setBusinessModel(m.id)}
                  className={`rounded border px-3 py-2 text-sm text-left transition ${
                    businessModel === m.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* STEP 5 — Documents */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Recommended for this engagement. Add or remove as needed.
                </p>
                <Badge variant="outline" className={RISK_BADGE[riskLevel].className}>
                  {RISK_BADGE[riskLevel].label}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {documents.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{d.document_type}</span>
                      <Badge variant="outline" className="text-xs capitalize">{d.source}</Badge>
                    </div>
                    <Button size="sm" variant="ghost"
                      onClick={() => setDocuments((p) => p.filter((_, i) => i !== idx))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={docDraft} onChange={(e) => setDocDraft(e.target.value)}
                  placeholder="Add custom document (e.g. NDA)" />
                <Button type="button" variant="outline" onClick={() => {
                  if (!docDraft.trim()) return;
                  setDocuments((p) => [...p, { document_type: docDraft.trim(), source: "custom" }]);
                  setDocDraft("");
                }}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6 — Compliance */}
          {step === 6 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Compliance flags surfaced from your industry and engagement type.
              </p>
              {compliance.length === 0 && (
                <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                  No specific compliance requirements detected. Standard legal review applies.
                </div>
              )}
              {compliance.map((c, idx) => (
                <div key={c.key} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>{c.label}</span>
                  </div>
                  <Button size="sm" variant="ghost"
                    onClick={() => setCompliance((p) => p.filter((_, i) => i !== idx))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* STEP 7 — Approvals */}
          {step === 7 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Suggested approval routing based on engagement risk.
                </p>
                <Badge variant="outline" className={RISK_BADGE[riskLevel].className}>
                  {RISK_BADGE[riskLevel].label}
                </Badge>
              </div>
              {approvals.map((a, idx) => (
                <div key={a.role} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{APPROVER_LABELS[a.role]}</div>
                    <div className="text-xs text-muted-foreground">{a.reason}</div>
                  </div>
                  <Button size="sm" variant="ghost"
                    onClick={() => setApprovals((p) => p.filter((_, i) => i !== idx))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 flex-wrap">
                {(["legal", "finance", "security", "executive", "procurement", "deal_desk"] as ApproverRoleId[])
                  .filter((r) => !approvals.some((a) => a.role === r))
                  .map((r) => (
                    <Button key={r} size="sm" variant="outline"
                      onClick={() => setApprovals((p) => [...p, { role: r, reason: "Added manually" }])}>
                      <Plus className="h-3 w-3 mr-1" /> {APPROVER_LABELS[r]}
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between gap-2 mt-4">
          <Button variant="ghost" onClick={() => (step === 1 ? close() : enterStep(step - 1))}>
            {step === 1 ? "Cancel" : (<><ArrowLeft className="h-4 w-4 mr-1" /> Back</>)}
          </Button>
          {step < STEPS.length ? (
            <Button disabled={!canAdvance()} onClick={() => enterStep(step + 1)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={createInstance.isPending || saveProfile.isPending}>
              {(createInstance.isPending || saveProfile.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create workspace
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
