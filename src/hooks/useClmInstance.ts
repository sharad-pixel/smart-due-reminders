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

      // Snapshot template name + sections so workspace is independent of source template
      const { data: tpl, error: tplErr } = await supabase
        .from("clm_templates").select("name").eq("id", template_id).single();
      if (tplErr) throw tplErr;

      const { data: tplSections, error: secErr } = await supabase
        .from("clm_template_sections")
        .select("section_key, title, body, order_index, ai_summary, risk_flags")
        .eq("template_id", template_id)
        .order("order_index");
      if (secErr) throw secErr;

      const { data, error } = await supabase
        .from("clm_template_instances")
        .insert({
          template_id, account_id: accountId, created_by: user!.id, name,
          template_name_snapshot: tpl.name,
        } as any)
        .select()
        .single();
      if (error) throw error;

      if (tplSections?.length) {
        const rows = tplSections.map((s: any) => ({ ...s, instance_id: data.id }));
        const { error: copyErr } = await supabase.from("clm_instance_sections").insert(rows as any);
        if (copyErr) throw copyErr;
      }

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
      const [inst, sections, debtors, contacts, comments] = await Promise.all([
        supabase.from("clm_template_instances").select("*, clm_templates(id, name)").eq("id", id!).single(),
        supabase.from("clm_instance_sections").select("*").eq("instance_id", id!).order("order_index"),
        supabase.from("clm_instance_debtors").select("*, debtors(id, company_name, name, email)").eq("instance_id", id!),
        (supabase.from("clm_instance_contacts" as any) as any)
          .select("*, debtor_contacts(id, name, email, title, is_primary)")
          .eq("instance_id", id!),
        supabase.from("clm_section_comments").select("*").eq("instance_id", id!).order("created_at"),
      ]);
      if (inst.error) throw inst.error;
      return {
        instance: inst.data,
        sections: sections.data ?? [],
        debtors: debtors.data ?? [],
        contacts: (contacts as any).data ?? [],
        comments: comments.data ?? [],
      };
    },
  });
};

export const useUpdateInstanceSection = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body, title }: { id: string; body?: string; title?: string }) => {
      const patch: any = {};
      if (body !== undefined) patch.body = body;
      if (title !== undefined) patch.title = title;
      const { error } = await supabase.from("clm_instance_sections").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      toast.success("Section updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
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

export const useAddInstanceContact = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contact_id, debtor_id, role }: { contact_id: string; debtor_id: string; role: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from("clm_instance_contacts" as any) as any).insert({
        instance_id: instanceId, contact_id, debtor_id, role, added_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      toast.success("Collaborator added");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useRemoveInstanceContact = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase.from("clm_instance_contacts" as any) as any).delete().eq("id", linkId);
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
