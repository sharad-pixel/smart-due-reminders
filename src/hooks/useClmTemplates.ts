import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "./useClmEntitlement";
import { toast } from "sonner";

export interface ClmTemplate {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  source_file_name: string | null;
  source_storage_path: string | null;
  status: "uploading" | "parsing" | "ready" | "failed";
  parse_error: string | null;
  assessment: any | null;
  assessment_status: "pending" | "running" | "ready" | "failed";
  assessment_error: string | null;
  assessed_at: string | null;
  assessment_model: string | null;
  assessment_ignored_risks?: number[] | null;
  raw_text?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClmTemplateSection {
  id: string;
  template_id: string;
  section_key: string;
  title: string;
  body: string | null;
  order_index: number;
  ai_summary: string | null;
  risk_flags: any;
}

export const useClmTemplates = () => {
  return useQuery({
    queryKey: ["clm-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clm_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClmTemplate[];
    },
  });
};

export const useClmTemplate = (id: string | undefined) => {
  return useQuery({
    queryKey: ["clm-template", id],
    enabled: !!id,
    queryFn: async () => {
      const [tmpl, secs] = await Promise.all([
        supabase.from("clm_templates").select("*").eq("id", id!).single(),
        supabase.from("clm_template_sections").select("*").eq("template_id", id!).order("order_index"),
      ]);
      if (tmpl.error) throw tmpl.error;
      return {
        template: tmpl.data as ClmTemplate,
        sections: (secs.data ?? []) as ClmTemplateSection[],
      };
    },
    refetchInterval: (q) => {
      const t: any = (q.state.data as any)?.template;
      if (!t) return false;
      const stillParsing = t.status === "parsing" || t.status === "uploading";
      const stillAssessing = t.assessment_status === "running" || (t.status === "ready" && t.assessment_status === "pending");
      return stillParsing || stillAssessing ? 3000 : false;
    },
  });
};

export const useReassessTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.functions.invoke("clm-assess-template", {
        body: { template_id: templateId },
      });
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["clm-template", id] });
      qc.invalidateQueries({ queryKey: ["clm-templates"] });
      toast.success("Re-running GPT-5 assessment…");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useUploadClmTemplate = () => {
  const qc = useQueryClient();
  const { accountId } = useClmEntitlement();

  return useMutation({
    mutationFn: async ({
      file, name, description, industry_category, document_type,
    }: {
      file: File;
      name: string;
      description?: string;
      industry_category?: string;
      document_type?: string;
    }) => {
      if (!accountId) throw new Error("No account context");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Insert template row
      const { data: tmpl, error: insErr } = await supabase
        .from("clm_templates")
        .insert({
          account_id: accountId,
          created_by: user.id,
          name,
          description: description || null,
          source_file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          status: "uploading",
          ...(industry_category ? { industry_category } : {}),
          ...(document_type ? { document_type } : {}),
        } as any)
        .select()
        .single();
      if (insErr) throw insErr;

      // 2. Upload file to storage at <auth.uid()>/<template_id>/<filename>
      const path = `${user.id}/${tmpl.id}/${file.name}`;
      const { error: upErr } = await supabase.storage.from("clm-templates").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) {
        await supabase.from("clm_templates").update({ status: "failed", parse_error: upErr.message }).eq("id", tmpl.id);
        throw upErr;
      }

      const { error: pathErr } = await supabase
        .from("clm_templates")
        .update({ source_storage_path: path })
        .eq("id", tmpl.id);
      if (pathErr) throw pathErr;

      // 3. Trigger sectionalize (fire-and-forget — long-running; UI polls for status)
      supabase.functions
        .invoke("clm-sectionalize-template", { body: { template_id: tmpl.id } })
        .then(({ error: fnErr }) => {
          if (fnErr) console.error("sectionalize invoke error", fnErr);
        });

      return tmpl as ClmTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-templates"] });
      toast.success("Template uploaded — AI is sectionalizing now");
    },
    onError: (e: any) => toast.error(e?.message ?? "Upload failed"),
  });
};

export const useResectionalize = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.functions.invoke("clm-sectionalize-template", {
        body: { template_id: templateId },
      });
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["clm-template", id] });
      qc.invalidateQueries({ queryKey: ["clm-templates"] });
      toast.success("Re-sectionalizing…");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useUpdateClmTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name?: string; description?: string | null }) => {
      const patch: any = {};
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      const { error } = await supabase.from("clm_templates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["clm-templates"] });
      qc.invalidateQueries({ queryKey: ["clm-template", vars.id] });
      toast.success("Template updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useUpdateClmTemplateSection = (templateId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, body, ai_summary }: { id: string; title?: string; body?: string; ai_summary?: string | null }) => {
      const patch: any = {};
      if (title !== undefined) patch.title = title;
      if (body !== undefined) patch.body = body;
      if (ai_summary !== undefined) patch.ai_summary = ai_summary;
      const { error } = await supabase.from("clm_template_sections").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-template", templateId] });
      toast.success("Section updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useDeleteClmTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath?: string | null }) => {
      // Existing collaborations keep their snapshot copies (FK is ON DELETE SET NULL)
      if (storagePath) {
        await supabase.storage.from("clm-templates").remove([storagePath]);
      }
      const { error } = await supabase.from("clm_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};

export const useToggleAssessmentRiskIgnored = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, riskIndex, currentIgnored }: { templateId: string; riskIndex: number; currentIgnored: number[] }) => {
      const next = currentIgnored.includes(riskIndex)
        ? currentIgnored.filter((i) => i !== riskIndex)
        : [...currentIgnored, riskIndex];
      const { error } = await supabase
        .from("clm_templates")
        .update({ assessment_ignored_risks: next } as any)
        .eq("id", templateId);
      if (error) throw error;
      return next;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["clm-template", vars.templateId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
};
