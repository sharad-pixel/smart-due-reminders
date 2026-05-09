import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ReadinessResult = {
  score: number;
  open_suggestions: number;
  pending_approvals: number;
  total_approvals: number;
  approved_approvals: number;
  high_pending: number;
  blockers: { type: string; count: number; message: string }[];
  by_category: Record<string, { total: number; approved: number; pending: number; rejected: number }>;
};

export const useApprovalReadiness = (instanceId: string | undefined) =>
  useQuery({
    queryKey: ["clm-readiness", instanceId],
    enabled: !!instanceId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ReadinessResult> => {
      const { data, error } = await (supabase as any).rpc("clm_compute_readiness", {
        p_instance_id: instanceId,
      });
      if (error) throw error;
      return (data as ReadinessResult) ?? ({ score: 0, blockers: [], by_category: {} } as any);
    },
  });

export const useFinalization = (instanceId: string | undefined) =>
  useQuery({
    queryKey: ["clm-finalization", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data } = await (supabase.from("clm_instance_finalization" as any) as any)
        .select("*")
        .eq("instance_id", instanceId)
        .maybeSingle();
      return data;
    },
  });

export const useFinalizeInstance = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note?: string) => {
      const { data, error } = await (supabase as any).rpc("clm_finalize_instance", {
        p_instance_id: instanceId,
        p_note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-readiness", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-finalization", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
      toast.success("Final Executable version generated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not finalize"),
  });
};

export const useBulkReviewRevisions = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      revisionIds,
      decision,
      note,
    }: { revisionIds: string[]; decision: "approved" | "rejected"; note?: string }) => {
      for (const id of revisionIds) {
        const { error } = await (supabase as any).rpc("review_clm_revision", {
          p_revision_id: id,
          p_decision: decision,
          p_note: note ?? null,
          p_override_body: null,
          p_revert_on_reject: decision === "rejected",
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-readiness", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
      toast.success(`${vars.revisionIds.length} change(s) ${vars.decision}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk review failed"),
  });
};

export const useResolveRevision = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (revisionId: string) => {
      const { error } = await (supabase.from("clm_section_revisions" as any) as any)
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", revisionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-readiness", instanceId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};
