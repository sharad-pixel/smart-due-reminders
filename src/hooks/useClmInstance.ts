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
      assigned_approver_email, assigned_approver_name,
    }: {
      id: string; body?: string; title?: string; change_summary?: string;
      submitForApproval?: boolean;
      assigned_approver_email?: string; assigned_approver_name?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");

      // Title-only edits update directly. Body changes go through the
      // SECURITY DEFINER RPC that enforces role and atomically logs a revision.
      if (title !== undefined && body === undefined) {
        const { error } = await supabase.from("clm_instance_sections").update({ title }).eq("id", id);
        if (error) throw error;
      }

      if (body !== undefined) {
        if (submitForApproval) {
          // Submit for approval path keeps the legacy revision insert (pending status)
          const { data: prev } = await supabase
            .from("clm_instance_sections")
            .select("body, section_key, title")
            .eq("id", id).maybeSingle();
          const previous_body = prev?.body ?? null;
          const section_key = prev?.section_key ?? null;
          const section_title = prev?.title ?? null;
          let editorName: string | undefined;
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          editorName = (prof as any)?.full_name ?? user.email ?? undefined;

          if (title !== undefined) {
            await supabase.from("clm_instance_sections").update({ title }).eq("id", id);
          }
          if (previous_body !== body) {
            const { error: rErr } = await (supabase.from("clm_section_revisions" as any) as any).insert({
              instance_id: instanceId, section_id: id,
              section_key, section_title,
              previous_body, new_body: body, change_summary,
              edited_by: user.id, edited_by_name: editorName,
              approval_status: "pending",
              assigned_approver_email: assigned_approver_email || null,
              assigned_approver_name: assigned_approver_name || null,
              assigned_at: assigned_approver_email ? new Date().toISOString() : null,
            });
            if (rErr) throw rErr;
          }
        } else {
          // Draft save: atomic via RPC — bypasses RLS quirks for workspace editors
          const { error } = await (supabase as any).rpc("save_clm_section_draft", {
            p_section_id: id,
            p_body: body,
            p_title: title ?? null,
            p_change_summary: change_summary ?? null,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      toast.success(vars.submitForApproval ? "Submitted for approval — assignee notified" : "Section updated");
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
      revisionId, decision, note, revertOnReject, override_body,
    }: { revisionId: string; decision: "approved" | "rejected"; note?: string; revertOnReject?: boolean; override_body?: string }) => {
      const { error } = await (supabase as any).rpc("review_clm_revision", {
        p_revision_id: revisionId,
        p_decision: decision,
        p_note: note ?? null,
        p_override_body: override_body ?? null,
        p_revert_on_reject: !!revertOnReject,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
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

export const useUpdateInstanceContactRole = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await (supabase.from("clm_instance_contacts" as any) as any)
        .update({ role })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update role"),
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

export const useAddTemplateToInstance = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Ensure not already attached (primary or extra)
      const { data: inst } = await supabase
        .from("clm_template_instances")
        .select("template_id")
        .eq("id", instanceId).maybeSingle();
      if (inst?.template_id === templateId) throw new Error("Template is already the primary template");

      const { data: existing } = await (supabase.from("clm_instance_extra_templates" as any) as any)
        .select("id").eq("instance_id", instanceId).eq("template_id", templateId).maybeSingle();
      if (existing) throw new Error("Template already added to this workspace");

      const { data: tpl, error: tplErr } = await supabase
        .from("clm_templates").select("name").eq("id", templateId).single();
      if (tplErr) throw tplErr;

      const { error: linkErr } = await (supabase.from("clm_instance_extra_templates" as any) as any).insert({
        instance_id: instanceId,
        template_id: templateId,
        template_name_snapshot: tpl?.name,
        added_by: user.id,
      });
      if (linkErr) throw linkErr;

      await snapshotTemplateSections(templateId, instanceId, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      toast.success("Template added to workspace");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add template"),
  });
};

export const useRemoveTemplateFromInstance = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      // Delete sections sourced from this template
      await supabase.from("clm_instance_sections")
        .delete()
        .eq("instance_id", instanceId)
        .eq("source_template_id", templateId);
      const { error } = await (supabase.from("clm_instance_extra_templates" as any) as any)
        .delete()
        .eq("instance_id", instanceId)
        .eq("template_id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      toast.success("Template removed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove template"),
  });
};

// ─────────────────────────────────────────────────────────────────────────
// Drafts → batched review submission
// Editors accumulate "auto" (draft) revisions during a session. They submit
// them all at once for one approver — the owner is alerted once.
// ─────────────────────────────────────────────────────────────────────────

export const useMyUnsubmittedDrafts = (instanceId: string | undefined) => {
  return useQuery({
    queryKey: ["clm-my-drafts", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !instanceId) return [];
      const { data, error } = await (supabase.from("clm_section_revisions" as any) as any)
        .select("id, section_id, section_title, section_key, change_summary, version_number, created_at, new_body, previous_body")
        .eq("instance_id", instanceId)
        .eq("edited_by", user.id)
        .eq("approval_status", "auto")
        .is("submitted_batch_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useSubmitDraftsForReview = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      revisionIds, approverEmail, approverName, message,
    }: { revisionIds: string[]; approverEmail: string; approverName?: string; message?: string }) => {
      if (!revisionIds.length) throw new Error("No drafts to submit");
      const { error } = await (supabase as any).rpc("submit_clm_review_batch", {
        p_instance_id: instanceId,
        p_revision_ids: revisionIds,
        p_approver_email: approverEmail,
        p_approver_name: approverName ?? null,
        p_message: message ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-my-drafts", instanceId] });
      toast.success("Submitted for review — approver will receive a single digest");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit"),
  });
};

// ─────────────────────────────────────────────────────────────────────────
// Granular per-revision review: revert, request reviewers, threaded comments
// ─────────────────────────────────────────────────────────────────────────

export const useRevertRevision = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ revisionId, note }: { revisionId: string; note?: string }) => {
      const { error } = await (supabase as any).rpc("revert_clm_revision", {
        p_revision_id: revisionId,
        p_note: note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
      toast.success("Change reverted — audit trail preserved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Revert failed"),
  });
};

export const useRequestRevisionReview = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ revisionId, emails, message }: { revisionId: string; emails: string[]; message?: string }) => {
      const cleaned = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
      if (!cleaned.length) throw new Error("Add at least one reviewer");
      const { error } = await (supabase as any).rpc("request_clm_revision_review", {
        p_revision_id: revisionId,
        p_emails: cleaned,
      });
      if (error) throw error;
      // fire-and-forget notification
      try {
        await supabase.functions.invoke("clm-notify-revision", {
          body: { event: "review_requested", revision_id: revisionId, emails: cleaned, message: message ?? null },
        });
      } catch (e) {
        console.warn("[clm] notify review_requested failed", e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
      toast.success("Review requested");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to request review"),
  });
};

export const useRevisionComments = (revisionId: string | undefined) => {
  return useQuery({
    queryKey: ["clm-revision-comments", revisionId],
    enabled: !!revisionId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("clm_revision_comments" as any) as any)
        .select("*").eq("revision_id", revisionId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const usePostRevisionComment = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      revisionId, body, mentions = [], parentCommentId,
    }: { revisionId: string; body: string; mentions?: string[]; parentCommentId?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");
      let name: string | undefined;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      name = (prof as any)?.full_name ?? user.email ?? undefined;
      const cleanedMentions = Array.from(new Set(mentions.map((m) => m.trim().toLowerCase()).filter(Boolean)));
      const { error } = await (supabase.from("clm_revision_comments" as any) as any).insert({
        revision_id: revisionId,
        instance_id: instanceId,
        parent_comment_id: parentCommentId ?? null,
        author_id: user.id,
        author_email: user.email ?? null,
        author_name: name ?? null,
        body,
        mentions: cleanedMentions,
      });
      if (error) throw error;

      // If mentions exist, also tag them as reviewers and notify
      if (cleanedMentions.length) {
        try {
          await (supabase as any).rpc("request_clm_revision_review", {
            p_revision_id: revisionId,
            p_emails: cleanedMentions,
          });
          await supabase.functions.invoke("clm-notify-revision", {
            body: {
              event: "mention",
              revision_id: revisionId,
              emails: cleanedMentions,
              message: body.slice(0, 280),
              author_name: name,
            },
          });
        } catch (e) {
          console.warn("[clm] mention notify failed", e);
        }
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["clm-revision-comments", vars.revisionId] });
      qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to post comment"),
  });
};

export const useResolveRevisionComment = (instanceId: string, revisionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, resolved }: { commentId: string; resolved: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from("clm_revision_comments" as any) as any)
        .update({ resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? user?.id : null })
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-revision-comments", revisionId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

// ─────────────────────────────────────────────────────────────────────────
// Workspace audit log — every change with timestamp + actor
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// Document Versions — named, role-gated lifecycle (Draft → Pending → Published → Sealed)
// ─────────────────────────────────────────────────────────────────────────

export type ClmDocVersionStatus = "draft" | "pending" | "published" | "sealed" | "superseded";

export const useDocumentVersions = (instanceId: string | undefined) => {
  return useQuery({
    queryKey: ["clm-doc-versions", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("clm_document_versions" as any) as any)
        .select("*").eq("instance_id", instanceId!).order("version_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
};

const versionRpc = (instanceId: string, label: string, fn: () => Promise<any>) => {
  // helper invalidations after any version mutation
  return async () => {
    const res = await fn();
    return res;
  };
};

export const useOpenDraftVersion = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("clm_open_new_draft_version", { p_instance_id: instanceId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-doc-versions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
      toast.success("New draft version opened");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to open draft"),
  });
};

export const useSubmitVersion = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId }: { versionId: string }) => {
      const { error } = await (supabase as any).rpc("clm_submit_version_for_review", { p_version_id: versionId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-doc-versions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
      toast.success("Version submitted for review");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit version"),
  });
};

export const useReviewVersion = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, decision, note }:
      { versionId: string; decision: "approved" | "rejected"; note?: string }) => {
      const { error } = await (supabase as any).rpc("clm_review_version", {
        p_version_id: versionId, p_decision: decision, p_note: note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["clm-doc-versions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
      toast.success(v.decision === "approved" ? "Version published" : "Version sent back to draft");
    },
    onError: (e: any) => toast.error(e?.message ?? "Review failed"),
  });
};

export const useRevertToVersion = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId }: { versionId: string }) => {
      const { error } = await (supabase as any).rpc("clm_revert_to_version", { p_target_version_id: versionId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-doc-versions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
      toast.success("Reverted — a new draft was opened from that version");
    },
    onError: (e: any) => toast.error(e?.message ?? "Revert failed"),
  });
};

export const useSealVersion = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId }: { versionId: string }) => {
      const { error } = await (supabase as any).rpc("clm_seal_version", { p_version_id: versionId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-doc-versions", instanceId] });
      qc.invalidateQueries({ queryKey: ["clm-audit-log", instanceId] });
      toast.success("Version sealed — locked forever");
    },
    onError: (e: any) => toast.error(e?.message ?? "Seal failed"),
  });
};

export const useClmAuditLog = (instanceId: string | undefined) => {
  return useQuery({
    queryKey: ["clm-audit-log", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("clm_audit_log" as any) as any)
        .select("*")
        .eq("instance_id", instanceId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
};

