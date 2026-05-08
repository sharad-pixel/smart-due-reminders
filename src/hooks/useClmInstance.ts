import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "./useClmEntitlement";
import { toast } from "sonner";

export interface ClmInstance {
  id: string;
  template_id: string;
  account_id: string;
  name: string;
  status: "draft" | "in_review" | "approved" | "executed" | "archived";
  notes: string | null;
  created_at: string;
}

export const useClmInstances = () => {
  return useQuery({
    queryKey: ["clm-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clm_template_instances")
        .select("*, clm_templates(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useCreateClmInstance = () => {
  const qc = useQueryClient();
  const { accountId } = useClmEntitlement();
  return useMutation({
    mutationFn: async ({ template_id, name }: { template_id: string; name: string }) => {
      if (!accountId) throw new Error("No account");
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("clm_template_instances")
        .insert({ template_id, account_id: accountId, created_by: user!.id, name } as any)
        .select()
        .single();
      if (error) throw error;
      return data as ClmInstance;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instances"] });
      toast.success("Collaboration workspace created");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useClmInstance = (id: string | undefined) => {
  return useQuery({
    queryKey: ["clm-instance", id],
    enabled: !!id,
    queryFn: async () => {
      const [inst, debtors, comments] = await Promise.all([
        supabase.from("clm_template_instances").select("*, clm_templates(id, name)").eq("id", id!).single(),
        supabase.from("clm_instance_debtors").select("*, debtors(id, company_name, name, email)").eq("instance_id", id!),
        supabase.from("clm_section_comments").select("*").eq("instance_id", id!).order("created_at"),
      ]);
      if (inst.error) throw inst.error;
      return {
        instance: inst.data,
        debtors: debtors.data ?? [],
        comments: comments.data ?? [],
      };
    },
  });
};

export const useAddInstanceDebtor = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ debtor_id, role }: { debtor_id: string; role: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("clm_instance_debtors").insert({
        instance_id: instanceId, debtor_id, added_by: user!.id, role,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useRemoveInstanceDebtor = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("clm_instance_debtors").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] }),
  });
};

export const useAddSectionComment = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ section_key, body }: { section_key: string; body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("clm_section_comments").insert({
        instance_id: instanceId, section_key, body, author_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useUpdateInstanceStatus = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("clm_template_instances").update({ status }).eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-instances"] });
      toast.success("Status updated");
    },
  });
};
