import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SignaturePackage {
  id: string;
  instance_id: string;
  status: "draft" | "sent" | "signed" | "void";
  provider: "manual" | "docusign" | "adobe" | "google_docs";
  included_templates: any;
  signers: any;
  external_envelope_id: string | null;
  notes: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export const useSignaturePackages = (instanceId: string | undefined) => {
  return useQuery({
    queryKey: ["clm-sig-packages", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("clm_signature_packages" as any) as any)
        .select("*").eq("instance_id", instanceId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SignaturePackage[];
    },
  });
};

export const useCreateSignaturePackage = (instanceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      provider: SignaturePackage["provider"];
      included_templates: { template_id: string; name: string; version: number }[];
      signers: { email: string; name?: string; role?: string }[];
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: inst, error: iErr } = await supabase
        .from("clm_template_instances")
        .select("account_id")
        .eq("id", instanceId).single();
      if (iErr) throw iErr;

      const { data, error } = await (supabase.from("clm_signature_packages" as any) as any)
        .insert({
          instance_id: instanceId,
          account_id: inst!.account_id,
          created_by: user.id,
          provider: input.provider,
          included_templates: input.included_templates,
          signers: input.signers,
          notes: input.notes ?? null,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;

      // Optionally trigger send
      if (input.provider !== "manual") {
        const { error: fnErr } = await supabase.functions.invoke("clm-send-for-signature", {
          body: { package_id: (data as any).id },
        });
        if (fnErr) {
          // Soft-fail: package created in draft, user is informed
          toast.error(`Package saved as draft — provider send failed: ${fnErr.message}`);
        }
      }

      return data as SignaturePackage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clm-sig-packages", instanceId] });
      toast.success("Signature package prepared");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create package"),
  });
};
