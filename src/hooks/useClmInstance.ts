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

async function snapshotTemplateSections(templateId: string, instanceId: string, includeSourceMeta = false) {
  const { data: tpl } = await supabase.from("clm_templates").select("name").eq("id", templateId).single();
  const { data: tplSections, error: secErr } = await supabase
    .from("clm_template_sections")
    .select("section_key, title, body, order_index, ai_summary, risk_flags")
    .eq("template_id", templateId)
    .order("order_index");
  if (secErr) throw secErr;
  if (!tplSections?.length) return;
  const rows = tplSections.map((s: any) => ({
    ...s,
    instance_id: instanceId,
    ...(includeSourceMeta ? { source_template_id: templateId, source_template_name: tpl?.name } : {}),
  }));
  const { error: copyErr } = await supabase.from("clm_instance_sections").insert(rows as any);
  if (copyErr) throw copyErr;
}

export const useCreateClmInstance = () => {
  const qc = useQueryClient();
  const { accountId } = useClmEntitlement();
  return useMutation({
    mutationFn: async ({
      template_id, name, debtor_id, extra_template_ids = [],
    }: { template_id: string; name: string; debtor_id?: string | null; extra_template_ids?: string[] }) => {
      if (!accountId) throw new Error("No account");
      const { data: { user } } = await supabase.auth.getUser();

      const { data: tpl, error: tplErr } = await supabase
        .from("clm_templates").select("name").eq("id", template_id).single();
      if (tplErr) throw tplErr;

      const { data, error } = await supabase
        .from("clm_template_instances")
        .insert({
          template_id, account_id: accountId, created_by: user!.id, name,
          template_name_snapshot: tpl.name,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Snapshot primary template (also tag with source meta for clarity)
      await snapshotTemplateSections(template_id, data.id, true);

      // Snapshot any additional templates and link them
      for (const extraId of extra_template_ids) {
        if (extraId === template_id) continue;
        const { data: extraTpl } = await supabase.from("clm_templates").select("name").eq("id", extraId).single();
        await (supabase.from("clm_instance_extra_templates" as any) as any).insert({
          instance_id: data.id, template_id: extraId,
          template_name_snapshot: extraTpl?.name, added_by: user!.id,
        });
        await snapshotTemplateSections(extraId, data.id, true);
      }

      // Link initial debtor account if provided
      if (debtor_id) {
        await supabase.from("clm_instance_debtors").insert({
          instance_id: data.id, debtor_id, added_by: user!.id, role: "counterparty",
        } as any);
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
      const [inst, sections, debtors, contacts, comments, extras] = await Promise.all([
        supabase.from("clm_template_instances").select("*, clm_templates(id, name)").eq("id", id!).single(),
        supabase.from("clm_instance_sections").select("*").eq("instance_id", id!).order("order_index"),
        supabase.from("clm_instance_debtors").select("*, debtors(id, company_name, name, email)").eq("instance_id", id!),
        (supabase.from("clm_instance_contacts" as any) as any)
          .select("*, debtor_contacts(id, name, email, title, is_primary)")
          .eq("instance_id", id!),
        supabase.from("clm_section_comments").select("*").eq("instance_id", id!).order("created_at"),
        (supabase.from("clm_instance_extra_templates" as any) as any)
          .select("*, clm_templates(id, name)")
          .eq("instance_id", id!),
      ]);
      if (inst.error) throw inst.error;
      return {
        instance: inst.data,
        sections: sections.data ?? [],
        debtors: debtors.data ?? [],
        contacts: (contacts as any).data ?? [],
        comments: comments.data ?? [],
        extraTemplates: (extras as any).data ?? [],
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
      const { error } = await supabase.from("clm_instance_debtors").upsert(
        { instance_id: instanceId, debtor_id, added_by: user!.id, role } as any,
        { onConflict: "instance_id,debtor_id", ignoreDuplicates: true },
      );
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
    mutationFn: async (input: {
      contact_id?: string | null; debtor_id?: string | null; role: string;
      is_internal?: boolean; name?: string; email?: string; title?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from("clm_instance_contacts" as any) as any).insert({
        instance_id: instanceId, added_by: user!.id, ...input,
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

export const useAddInternalCollaborator = (instanceId: string) => {
  const add = useAddInstanceContact(instanceId);
  return {
    ...add,
    mutateAsync: (input: { name: string; email?: string; title?: string; role: string }) =>
      add.mutateAsync({ ...input, is_internal: true }),
    mutate: (input: { name: string; email?: string; title?: string; role: string }) =>
      add.mutate({ ...input, is_internal: true }),
  };
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
