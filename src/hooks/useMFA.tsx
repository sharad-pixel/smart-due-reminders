import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MFASettings {
  id: string;
  user_id: string;
  mfa_enabled: boolean;
  mfa_method: "email" | "sms" | "totp" | null;
  phone_number: string | null;
  backup_codes: string[] | null;
}

export function useMFA() {
  const queryClient = useQueryClient();

  const { data: mfaSettings, isLoading } = useQuery({
    queryKey: ["mfa-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("mfa_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as MFASettings | null;
    },
  });

  const enableMFA = useMutation({
    mutationFn: async ({ method, phoneNumber }: { method: "email" | "sms" | "totp"; phoneNumber?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );

      const { data, error } = await supabase
        .from("mfa_settings")
        .upsert({
          user_id: user.id,
          mfa_enabled: true,
          mfa_method: method,
          phone_number: phoneNumber || null,
          backup_codes: backupCodes,
        })
        .select()
        .single();

      if (error) throw error;
      return { settings: data, backupCodes };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mfa-settings"] });
      toast.success("MFA enabled successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to enable MFA: ${error.message}`);
    },
  });

  const disableMFA = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("mfa_settings")
        .update({ mfa_enabled: false })
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mfa-settings"] });
      toast.success("MFA disabled successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to disable MFA: ${error.message}`);
    },
  });

  return {
    mfaSettings,
    isLoading,
    enableMFA: enableMFA.mutateAsync,
    disableMFA: disableMFA.mutate,
  };
}
