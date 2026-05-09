import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  IndustryId, EngagementTypeId, BusinessModelId, ApproverRoleId, RiskLevel,
  ComplianceFlag,
} from "@/lib/clm/engagementConfig";

export interface EngagementProfile {
  id: string;
  instance_id: string;
  account_id: string;
  customer_info: Record<string, any>;
  industries: IndustryId[];
  engagement_type: EngagementTypeId | null;
  business_model: BusinessModelId | null;
  risk_level: RiskLevel;
}

export interface RequiredDoc {
  id: string;
  document_type: string;
  source: "recommended" | "custom";
  status: "pending" | "in_progress" | "complete";
}
export interface ComplianceRow { id: string; requirement_key: string; label: string; status: string; }
export interface ApprovalRow { id: string; approver_role: ApproverRoleId; required: boolean; reason: string | null; }

export const useEngagementProfile = (instanceId: string | undefined) =>
  useQuery({
    queryKey: ["clm-engagement-profile", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const [profile, docs, comp, appr] = await Promise.all([
        (supabase.from("clm_engagement_profiles" as any) as any)
          .select("*").eq("instance_id", instanceId!).maybeSingle(),
        (supabase.from("clm_workspace_required_documents" as any) as any)
          .select("*").eq("instance_id", instanceId!).order("created_at"),
        (supabase.from("clm_workspace_compliance_requirements" as any) as any)
          .select("*").eq("instance_id", instanceId!).order("created_at"),
        (supabase.from("clm_workspace_approval_routing" as any) as any)
          .select("*").eq("instance_id", instanceId!).order("created_at"),
      ]);
      return {
        profile: (profile as any).data as EngagementProfile | null,
        documents: ((docs as any).data ?? []) as RequiredDoc[],
        compliance: ((comp as any).data ?? []) as ComplianceRow[],
        approvals: ((appr as any).data ?? []) as ApprovalRow[],
      };
    },
  });

export interface SaveEngagementInput {
  instance_id: string;
  account_id: string;
  customer_info: Record<string, any>;
  industries: IndustryId[];
  engagement_type: EngagementTypeId;
  business_model: BusinessModelId;
  risk_level: RiskLevel;
  documents: { document_type: string; source: "recommended" | "custom" }[];
  compliance: ComplianceFlag[];
  approvals: { role: ApproverRoleId; reason: string }[];
}

export const useSaveEngagementProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveEngagementInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Upsert profile
      const { error: pErr } = await (supabase.from("clm_engagement_profiles" as any) as any).upsert({
        instance_id: input.instance_id,
        account_id: input.account_id,
        customer_info: input.customer_info,
        industries: input.industries,
        engagement_type: input.engagement_type,
        business_model: input.business_model,
        risk_level: input.risk_level,
        created_by: user?.id,
      }, { onConflict: "instance_id" });
      if (pErr) throw pErr;

      // Replace child rows
      await (supabase.from("clm_workspace_required_documents" as any) as any)
        .delete().eq("instance_id", input.instance_id);
      await (supabase.from("clm_workspace_compliance_requirements" as any) as any)
        .delete().eq("instance_id", input.instance_id);
      await (supabase.from("clm_workspace_approval_routing" as any) as any)
        .delete().eq("instance_id", input.instance_id);

      if (input.documents.length) {
        await (supabase.from("clm_workspace_required_documents" as any) as any).insert(
          input.documents.map((d) => ({
            instance_id: input.instance_id, account_id: input.account_id,
            document_type: d.document_type, source: d.source, status: "pending",
          })),
        );
      }
      if (input.compliance.length) {
        await (supabase.from("clm_workspace_compliance_requirements" as any) as any).insert(
          input.compliance.map((c) => ({
            instance_id: input.instance_id, account_id: input.account_id,
            requirement_key: c.key, label: c.label, status: "required",
          })),
        );
      }
      if (input.approvals.length) {
        await (supabase.from("clm_workspace_approval_routing" as any) as any).insert(
          input.approvals.map((a) => ({
            instance_id: input.instance_id, account_id: input.account_id,
            approver_role: a.role, required: true, reason: a.reason,
          })),
        );
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["clm-engagement-profile", vars.instance_id] });
    },
  });
};
