import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Save, Loader2, ChevronDown, ChevronUp, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CustomerAIContextProps {
  debtorId: string;
}

interface AIContextData {
  industry: string;
  employee_count: string;
  annual_revenue: string;
  payment_preferences: string;
  known_issues: string;
  business_relationship: string;
  financial_health_notes: string;
  communication_preference: string;
  decision_maker: string;
  seasonal_patterns: string;
  additional_context: string;
}

const emptyContext: AIContextData = {
  industry: "",
  employee_count: "",
  annual_revenue: "",
  payment_preferences: "",
  known_issues: "",
  business_relationship: "",
  financial_health_notes: "",
  communication_preference: "",
  decision_maker: "",
  seasonal_patterns: "",
  additional_context: "",
};

export function CustomerAIContext({ debtorId }: CustomerAIContextProps) {
  const [data, setData] = useState<AIContextData>(emptyContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [crmLinked, setCrmLinked] = useState(false);

  useEffect(() => {
    loadContext();
    checkCrmLink();
  }, [debtorId]);

  async function checkCrmLink() {
    const { data } = await supabase
      .from("debtors")
      .select("crm_account_id")
      .eq("id", debtorId)
      .maybeSingle();
    setCrmLinked(!!data?.crm_account_id);
  }

  async function loadContext() {
    setLoading(true);
    const { data: ctx } = await supabase
      .from("debtor_ai_context")
      .select("*")
      .eq("debtor_id", debtorId)
      .maybeSingle();

    if (ctx) {
      setData({
        industry: ctx.industry || "",
        employee_count: ctx.employee_count || "",
        annual_revenue: ctx.annual_revenue || "",
        payment_preferences: ctx.payment_preferences || "",
        known_issues: ctx.known_issues || "",
        business_relationship: ctx.business_relationship || "",
        financial_health_notes: ctx.financial_health_notes || "",
        communication_preference: ctx.communication_preference || "",
        decision_maker: ctx.decision_maker || "",
        seasonal_patterns: ctx.seasonal_patterns || "",
        additional_context: ctx.additional_context || "",
      });
      setHasData(true);
    }
    setLoading(false);
  }

  async function handlePullFromCRM() {
    setPulling(true);
    try {
      // Get the debtor's linked CRM account
      const { data: debtor } = await supabase
        .from("debtors")
        .select("crm_account_id")
        .eq("id", debtorId)
        .maybeSingle();

      if (!debtor?.crm_account_id) {
        toast.error("No CRM account linked to this customer");
        setPulling(false);
        return;
      }

      const { data: crm } = await supabase
        .from("crm_accounts")
        .select("*")
        .eq("id", debtor.crm_account_id)
        .maybeSingle();

      if (!crm) {
        toast.error("CRM account data not found");
        setPulling(false);
        return;
      }

      // Map CRM fields to AI context — only fill empty fields
      const updates: Partial<AIContextData> = {};
      if (!data.industry && crm.industry) updates.industry = crm.industry;
      if (!data.decision_maker && crm.owner_name) updates.decision_maker = crm.owner_name;

      // Map MRR/lifetime value to revenue estimate
      if (!data.annual_revenue && crm.mrr) {
        const annual = crm.mrr * 12;
        if (annual < 100000) updates.annual_revenue = "<100K";
        else if (annual < 500000) updates.annual_revenue = "100K-500K";
        else if (annual < 1000000) updates.annual_revenue = "500K-1M";
        else if (annual < 10000000) updates.annual_revenue = "1M-10M";
        else if (annual < 50000000) updates.annual_revenue = "10M-50M";
        else updates.annual_revenue = "50M+";
      }

      // Build relationship notes from CRM data
      const relationshipParts: string[] = [];
      if (crm.segment) relationshipParts.push(`Segment: ${crm.segment}`);
      if (crm.health_score) relationshipParts.push(`CRM Health Score: ${crm.health_score}`);
      if (crm.customer_since) relationshipParts.push(`Customer since: ${crm.customer_since}`);
      if (crm.status) relationshipParts.push(`CRM Status: ${crm.status}`);
      if (crm.lifetime_value) relationshipParts.push(`Lifetime Value: $${crm.lifetime_value.toLocaleString()}`);

      if (!data.business_relationship && relationshipParts.length > 0) {
        updates.business_relationship = relationshipParts.join(". ");
      }

      // Build financial notes from CRM
      const financialParts: string[] = [];
      if (crm.mrr) financialParts.push(`MRR: $${crm.mrr.toLocaleString()}`);
      if (crm.health_score) financialParts.push(`Health: ${crm.health_score}`);
      if (!data.financial_health_notes && financialParts.length > 0) {
        updates.financial_health_notes = `[From ${crm.crm_type}] ${financialParts.join(". ")}`;
      }

      if (Object.keys(updates).length === 0) {
        toast.info("All fields already populated — no CRM data to pull");
      } else {
        setData(prev => ({ ...prev, ...updates }));
        toast.success(`Pulled ${Object.keys(updates).length} field(s) from ${crm.crm_type === "salesforce" ? "Salesforce" : crm.crm_type}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to pull CRM data");
    }
    setPulling(false);
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      debtor_id: debtorId,
      user_id: user.id,
      ...data,
    };

    const { error } = await supabase
      .from("debtor_ai_context")
      .upsert(payload, { onConflict: "debtor_id" });

    if (error) {
      toast.error("Failed to save AI context");
      console.error(error);
    } else {
      toast.success("Customer intelligence data saved — will be used in next AI assessment");
      setHasData(true);
    }
    setSaving(false);
  }

  const filledFieldsCount = Object.values(data).filter(v => v && v.trim()).length;

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Customer Intelligence Data</CardTitle>
            {hasData && (
              <Badge variant="secondary" className="text-xs">
                {filledFieldsCount} fields
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Used by AI for assessments & risk scoring</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Add known customer information to improve AI-powered risk assessments, collection strategies, and intelligence reports.
              </p>

              {/* Structured fields - 2 column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-industry">Industry</Label>
                  <Input
                    id="ai-industry"
                    placeholder="e.g., Manufacturing, SaaS, Healthcare"
                    value={data.industry}
                    onChange={(e) => setData({ ...data, industry: e.target.value })}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-employees">Employee Count</Label>
                  <Select
                    value={data.employee_count || "unknown"}
                    onValueChange={(v) => setData({ ...data, employee_count: v === "unknown" ? "" : v })}
                  >
                    <SelectTrigger id="ai-employees">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Unknown</SelectItem>
                      <SelectItem value="1-10">1-10</SelectItem>
                      <SelectItem value="11-50">11-50</SelectItem>
                      <SelectItem value="51-200">51-200</SelectItem>
                      <SelectItem value="201-1000">201-1,000</SelectItem>
                      <SelectItem value="1001+">1,001+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-revenue">Annual Revenue</Label>
                  <Select
                    value={data.annual_revenue || "unknown"}
                    onValueChange={(v) => setData({ ...data, annual_revenue: v === "unknown" ? "" : v })}
                  >
                    <SelectTrigger id="ai-revenue">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Unknown</SelectItem>
                      <SelectItem value="<100K">Under $100K</SelectItem>
                      <SelectItem value="100K-500K">$100K - $500K</SelectItem>
                      <SelectItem value="500K-1M">$500K - $1M</SelectItem>
                      <SelectItem value="1M-10M">$1M - $10M</SelectItem>
                      <SelectItem value="10M-50M">$10M - $50M</SelectItem>
                      <SelectItem value="50M+">$50M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-comm-pref">Communication Preference</Label>
                  <Select
                    value={data.communication_preference || "unknown"}
                    onValueChange={(v) => setData({ ...data, communication_preference: v === "unknown" ? "" : v })}
                  >
                    <SelectTrigger id="ai-comm-pref">
                      <SelectValue placeholder="Select preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Unknown</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="mail">Physical Mail</SelectItem>
                      <SelectItem value="portal">Customer Portal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-decision-maker">Key Decision Maker</Label>
                  <Input
                    id="ai-decision-maker"
                    placeholder="e.g., Jane Smith, CFO"
                    value={data.decision_maker}
                    onChange={(e) => setData({ ...data, decision_maker: e.target.value })}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-payment-pref">Payment Preferences</Label>
                  <Input
                    id="ai-payment-pref"
                    placeholder="e.g., Net 30, ACH only, pays end of month"
                    value={data.payment_preferences}
                    onChange={(e) => setData({ ...data, payment_preferences: e.target.value })}
                    maxLength={300}
                  />
                </div>
              </div>

              {/* Text area fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-known-issues">Known Issues / Disputes</Label>
                  <Textarea
                    id="ai-known-issues"
                    placeholder="e.g., Disputed invoice #1234 due to delivery issues. Previously complained about billing errors."
                    value={data.known_issues}
                    onChange={(e) => setData({ ...data, known_issues: e.target.value })}
                    rows={2}
                    maxLength={1000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-biz-relationship">Business Relationship Notes</Label>
                  <Textarea
                    id="ai-biz-relationship"
                    placeholder="e.g., Long-term customer since 2019. Key account for western region. Recently acquired by larger company."
                    value={data.business_relationship}
                    onChange={(e) => setData({ ...data, business_relationship: e.target.value })}
                    rows={2}
                    maxLength={1000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-financial-health">Financial Health Notes</Label>
                  <Textarea
                    id="ai-financial-health"
                    placeholder="e.g., Company reported strong Q3 earnings. Recently raised Series B. Cash flow concerns mentioned by AP team."
                    value={data.financial_health_notes}
                    onChange={(e) => setData({ ...data, financial_health_notes: e.target.value })}
                    rows={2}
                    maxLength={1000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-seasonal">Seasonal Patterns</Label>
                  <Input
                    id="ai-seasonal"
                    placeholder="e.g., Slow payments in Q4, budget resets in January"
                    value={data.seasonal_patterns}
                    onChange={(e) => setData({ ...data, seasonal_patterns: e.target.value })}
                    maxLength={300}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-additional">Additional Context for AI</Label>
                  <Textarea
                    id="ai-additional"
                    placeholder="Any other information that would help AI assess this customer's risk, predict payment behavior, or recommend collection strategies..."
                    value={data.additional_context}
                    onChange={(e) => setData({ ...data, additional_context: e.target.value })}
                    rows={3}
                    maxLength={2000}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Intelligence Data
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
