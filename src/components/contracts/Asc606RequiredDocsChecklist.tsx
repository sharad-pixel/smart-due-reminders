import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, FileText, AlertCircle, Info } from "lucide-react";

interface Props {
  contractId: string;
  accountId: string;
}

type Requirement = {
  key: string;
  label: string;
  description: string;
  asc606_step: string;
  satisfied: boolean;
  evidence?: string;
};

/**
 * Displays the ASC 606-required documentation checklist for a contract.
 * Users see, at-a-glance, which evidence has been captured and which is still
 * missing before running a full assessment.
 *
 * Requirements are drawn from PwC's "Revenue from contracts with customers"
 * guide (June 2026 edition) — the same source the AI backend cites.
 */
export function Asc606RequiredDocsChecklist({ contractId, accountId }: Props) {
  const [reqs, setReqs] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      // Fetch contract-linked evidence in parallel
      const [
        { data: contract },
        { data: revenueItems },
        { data: supportingDocs },
        { data: schedules },
        { data: fields },
      ] = await Promise.all([
        supabase
          .from("live_contract_imports")
          .select("id,contract_name,effective_date,term_end_date,contract_value,contract_type")
          .eq("id", contractId)
          .maybeSingle(),
        supabase
          .from("contract_revenue_items")
          .select("id,library_item_id,allocated_price,quantity,revenue_library_items(name,standalone_selling_price,recognition_method,performance_obligation)")
          .eq("import_id", contractId),
        supabase
          .from("live_contract_supporting_docs")
          .select("id,doc_type,file_name")
          .eq("import_id", contractId),
        supabase
          .from("contract_invoice_schedules")
          .select("id,amount,scheduled_date")
          .eq("import_id", contractId)
          .limit(5),
        supabase
          .from("live_contract_extracted_fields")
          .select("field_key,field_value")
          .eq("import_id", contractId),
      ]);

      const fieldMap = new Map<string, string>();
      for (const f of fields ?? []) fieldMap.set(f.field_key, String(f.field_value ?? ""));

      const supportingByType = new Set(
        (supportingDocs ?? []).map((d: any) => String(d.doc_type || "").toLowerCase())
      );

      const revItems = (revenueItems ?? []) as any[];
      const hasSsp = revItems.length > 0 &&
        revItems.every((ri) => Number(ri?.revenue_library_items?.standalone_selling_price ?? 0) > 0);
      const hasPerfObligation = revItems.length > 0 &&
        revItems.every((ri) => !!ri?.revenue_library_items?.performance_obligation);
      const hasRecognition = revItems.length > 0 &&
        revItems.every((ri) => !!ri?.revenue_library_items?.recognition_method);

      const list: Requirement[] = [
        {
          key: "executed_contract",
          label: "Executed contract / order form",
          description: "Signed agreement with enforceable rights and obligations.",
          asc606_step: "Step 1",
          satisfied: !!contract && !!contract.contract_name,
        },
        {
          key: "parties_terms",
          label: "Payment terms & effective dates",
          description: "Effective date, term end, and payment schedule.",
          asc606_step: "Step 1",
          satisfied: !!contract?.effective_date && !!contract?.term_end_date,
        },
        {
          key: "performance_obligations",
          label: "Performance obligations",
          description: "Each distinct good or service the customer will receive.",
          asc606_step: "Step 2",
          satisfied: hasPerfObligation,
          evidence: hasPerfObligation ? undefined : "Add performance_obligation to each linked revenue library item.",
        },
        {
          key: "transaction_price",
          label: "Transaction price",
          description: "Total consideration, including fixed and variable components.",
          asc606_step: "Step 3",
          satisfied: Number(contract?.contract_value ?? 0) > 0,
        },
        {
          key: "variable_consideration",
          label: "Variable consideration documentation",
          description: "Discounts, rebates, refunds, credits, penalties, or usage-based pricing evidence.",
          asc606_step: "Step 3",
          satisfied: supportingByType.has("variable_consideration") ||
            !!fieldMap.get("variable_consideration") ||
            !!fieldMap.get("discounts"),
          evidence: "Upload evidence of any variable pricing or price adjustments.",
        },
        {
          key: "ssp",
          label: "Standalone Selling Price (SSP)",
          description: "SSP per performance obligation. Required to allocate the transaction price.",
          asc606_step: "Step 4",
          satisfied: hasSsp,
          evidence: hasSsp ? undefined : "Set SSP on each attached Revenue Library item.",
        },
        {
          key: "revenue_schedule",
          label: "Revenue recognition schedule",
          description: "Timing of when control transfers to the customer (point in time vs. over time).",
          asc606_step: "Step 5",
          satisfied: hasRecognition && (schedules?.length ?? 0) > 0,
        },
        {
          key: "msa",
          label: "Master Services Agreement (MSA)",
          description: "If this order form references an MSA, upload it as a supporting doc.",
          asc606_step: "Context",
          satisfied: supportingByType.has("msa") || supportingByType.has("master_services_agreement"),
          evidence: "Optional if not applicable.",
        },
        {
          key: "sow",
          label: "Statement of Work (SOW)",
          description: "Scope, deliverables, and milestones for services engagements.",
          asc606_step: "Context",
          satisfied: supportingByType.has("sow") || supportingByType.has("statement_of_work"),
          evidence: "Optional if not applicable.",
        },
        {
          key: "amendments",
          label: "Amendments / change orders",
          description: "Any modification that changes scope, price, or duration.",
          asc606_step: "Context",
          satisfied: supportingByType.has("amendment") || supportingByType.has("change_order"),
          evidence: "Optional if not applicable.",
        },
        {
          key: "renewal_terms",
          label: "Renewal & material rights",
          description: "Options, warranties, or renewal terms that convey a material right.",
          asc606_step: "Step 2",
          satisfied: !!fieldMap.get("renewal_term") || !!fieldMap.get("auto_renewal") ||
            !!fieldMap.get("renewal_frequency"),
        },
      ];

      if (mounted) {
        setReqs(list);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [contractId, accountId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Checking documentation completeness…
        </CardContent>
      </Card>
    );
  }

  const satisfied = reqs.filter((r) => r.satisfied).length;
  const total = reqs.length;
  const missing = total - satisfied;
  const readyPct = Math.round((satisfied / total) * 100);

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Required documentation for a full ASC 606 assessment</span>
          </div>
          <Badge variant={missing === 0 ? "default" : "outline"} className="text-[10px]">
            {satisfied}/{total} captured · {readyPct}% ready
          </Badge>
        </div>

        <div className="rounded-md bg-muted/40 border p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <span>
            Provide these items so the AI can complete Steps 1–5. Missing evidence
            (especially SSP and variable consideration) will produce a partial
            assessment with open issues. The engine cites the{" "}
            <span className="font-medium text-foreground">PwC Revenue from contracts with customers</span>{" "}
            guide (June 2026 edition) for every conclusion.
          </span>
        </div>

        <div className="space-y-2">
          {reqs.map((r) => (
            <div
              key={r.key}
              className="flex items-start justify-between gap-3 py-1.5 border-b last:border-b-0"
            >
              <div className="flex items-start gap-2 min-w-0">
                {r.satisfied ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-snug">{r.label}</div>
                  <div className="text-xs text-muted-foreground leading-snug">{r.description}</div>
                  {!r.satisfied && r.evidence && (
                    <div className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {r.evidence}
                    </div>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {r.asc606_step}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
