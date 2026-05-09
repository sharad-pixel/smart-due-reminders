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
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Primary flat query — never blocked by missing relational embeds
      const { data: instances, error } = await supabase
        .from("clm_template_instances")
        .select("*, clm_templates(name)")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[useClmInstances] flat query failed", error);
        throw error;
      }
      const list = instances ?? [];
      const ids = list.map((i: any) => i.id);
      if (ids.length === 0) return list;

      // Load aux data separately so a single failing embed never hides the list
      const [debtors, contacts, revisions] = await Promise.all([
        supabase
          .from("clm_instance_debtors")
          .select("id, instance_id, role, debtor_id, debtors(id, company_name, name, email)")
          .in("instance_id", ids),
        (supabase.from("clm_instance_contacts" as any) as any)
          .select("id, instance_id, is_internal")
          .in("instance_id", ids),
        (supabase.from("clm_section_revisions" as any) as any)
          .select("id, instance_id, approval_status")
          .in("instance_id", ids),
      ]);

      const byInstance = <T extends { instance_id: string }>(rows: T[] | null | undefined) => {
        const map = new Map<string, T[]>();
        (rows ?? []).forEach((r) => {
          const arr = map.get(r.instance_id) ?? [];
          arr.push(r);
          map.set(r.instance_id, arr);
        });
        return map;
      };
      const dMap = byInstance((debtors.data as any) ?? []);
      const cMap = byInstance(((contacts as any).data as any) ?? []);
      const rMap = byInstance(((revisions as any).data as any) ?? []);

      return list.map((i: any) => ({
        ...i,
        clm_instance_debtors: dMap.get(i.id) ?? [],
        clm_instance_contacts: cMap.get(i.id) ?? [],
        clm_section_revisions: rMap.get(i.id) ?? [],
      }));
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
    mutationFn: async ({
      id, body, title, change_summary, submitForApproval,
    }: { id: string; body?: string; title?: string; change_summary?: string; submitForApproval?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Snapshot previous body for revision history if body is being changed
      let previous_body: string | null = null;
      let section_key: string | null = null;
      let section_title: string | null = null;
      if (body !== undefined) {
        const { data: prev } = await supabase
          .from("clm_instance_sections")
          .select("body, section_key, title")
          .eq("id", id).maybeSingle();
        previous_body = prev?.body ?? null;
        section_key = prev?.section_key ?? null;
        section_title = prev?.title ?? null;
      }

      const patch: any = {};
      if (body !== undefined) patch.body = body;
      if (title !== undefined) patch.title = title;
      const { error } = await supabase.from("clm_instance_sections").update(patch).eq("id", id);
      if (error) throw error;

      // Log revision when body changed
      if (body !== undefined && previous_body !== body) {
        let editorName: string | undefined;
        if (user?.id) {
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          editorName = (prof as any)?.full_name ?? user.email ?? undefined;
        }
        await (supabase.from("clm_section_revisions" as any) as any).insert({
          instance_id: instanceId, section_id: id,
          section_key, section_title,
          previous_body, new_body: body, change_summary,
          edited_by: user?.id, edited_by_name: editorName,
          approval_status: submitForApproval ? "pending" : "auto",
        });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      toast.success(vars.submitForApproval ? "Submitted for approval" : "Section updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useInstanceRevisions = (instanceId: string | undefined) => {
  return useQuery({
    queryKey: ["clm-revisions", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("clm_section_revisions" as any) as any)
        .select("*").eq("instance_id", instanceId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useRestoreRevision = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ revisionId }: { revisionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: rev, error } = await (supabase.from("clm_section_revisions" as any) as any)
        .select("section_id, new_body, version_number, section_key, section_title")
        .eq("id", revisionId).single();
      if (error) throw error;
      // capture current body to use as previous_body for the new revision
      const { data: cur } = await supabase
        .from("clm_instance_sections")
        .select("body").eq("id", (rev as any).section_id).maybeSingle();
      // overwrite section with the historical body
      await supabase.from("clm_instance_sections")
        .update({ body: (rev as any).new_body }).eq("id", (rev as any).section_id);
      // log a new revision capturing the restore action
      let editorName: string | undefined;
      if (user?.id) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        editorName = (prof as any)?.full_name ?? user.email ?? undefined;
      }
      await (supabase.from("clm_section_revisions" as any) as any).insert({
        instance_id: instanceId, section_id: (rev as any).section_id,
        section_key: (rev as any).section_key, section_title: (rev as any).section_title,
        previous_body: cur?.body ?? null, new_body: (rev as any).new_body,
        change_summary: `Restored from v${(rev as any).version_number}`,
        edited_by: user?.id, edited_by_name: editorName,
        approval_status: "auto",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      toast.success("Section restored from earlier version");
    },
    onError: (e: any) => toast.error(e?.message ?? "Restore failed"),
  });
};

export const useReviewRevision = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      revisionId, decision, note, revertOnReject,
    }: { revisionId: string; decision: "approved" | "rejected"; note?: string; revertOnReject?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      let reviewerName: string | undefined;
      if (user?.id) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        reviewerName = (prof as any)?.full_name ?? user.email ?? undefined;
      }
      const { data: rev, error: rErr } = await (supabase.from("clm_section_revisions" as any) as any)
        .update({
          approval_status: decision, reviewed_by: user?.id, reviewed_by_name: reviewerName,
          reviewed_at: new Date().toISOString(), review_note: note ?? null,
        })
        .eq("id", revisionId).select("section_id, previous_body").single();
      if (rErr) throw rErr;

      if (decision === "rejected" && revertOnReject && rev) {
        await supabase.from("clm_instance_sections").update({ body: (rev as any).previous_body }).eq("id", (rev as any).section_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      toast.success("Reviewed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useAddInstanceDebtor = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ debtor_id, role }: { debtor_id: string; role: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Pre-check: workspace is 1:1 — block if another debtor is already linked
      const { data: existing } = await supabase
        .from("clm_instance_debtors")
        .select("id, debtor_id")
        .eq("instance_id", instanceId);
      if ((existing ?? []).some((e: any) => e.debtor_id !== debtor_id)) {
        throw new Error("This workspace is already linked to another account. Unlink it first.");
      }
      if ((existing ?? []).some((e: any) => e.debtor_id === debtor_id)) {
        return; // already linked, no-op
      }
      const { error } = await supabase.from("clm_instance_debtors").insert(
        { instance_id: instanceId, debtor_id, added_by: user!.id, role } as any,
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      await qc.invalidateQueries({ queryKey: ["clm-instances"] });
      await qc.refetchQueries({ queryKey: ["clm-instance", instanceId] });
      toast.success("Account linked to workspace");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to link account"),
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
      template_id?: string | null;
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
    mutateAsync: (input: { name: string; email?: string; title?: string; role: string; template_id?: string | null }) =>
      add.mutateAsync({ ...input, is_internal: true }),
    mutate: (input: { name: string; email?: string; title?: string; role: string; template_id?: string | null }) =>
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

export const useArchiveInstance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (instanceId: string) => {
      const { error } = await supabase
        .from("clm_template_instances")
        .update({ status: "archived" })
        .eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instances"] });
      toast.success("Workspace closed and archived");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to archive workspace"),
  });
};

export const useReopenInstance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (instanceId: string) => {
      const { error } = await supabase
        .from("clm_template_instances")
        .update({ status: "draft" })
        .eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instances"] });
      toast.success("Workspace reopened");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to reopen workspace"),
  });
};

export const useDeleteInstance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (instanceId: string) => {
      // Best-effort cleanup of children (FKs are ON DELETE CASCADE, but we
      // also clean explicitly so any custom child tables without cascade are
      // handled before the parent delete).
      await Promise.allSettled([
        (supabase.from("clm_instance_contacts" as any) as any).delete().eq("instance_id", instanceId),
        supabase.from("clm_instance_debtors").delete().eq("instance_id", instanceId),
        (supabase.from("clm_section_revisions" as any) as any).delete().eq("instance_id", instanceId),
        (supabase.from("clm_instance_extra_templates" as any) as any).delete().eq("instance_id", instanceId),
        supabase.from("clm_section_comments").delete().eq("instance_id", instanceId),
        supabase.from("clm_instance_sections").delete().eq("instance_id", instanceId),
      ]);
      const { error } = await supabase
        .from("clm_template_instances")
        .delete()
        .eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clm-instances"] });
      await qc.refetchQueries({ queryKey: ["clm-instances"] });
      toast.success("Workspace deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete workspace"),
  });
};
