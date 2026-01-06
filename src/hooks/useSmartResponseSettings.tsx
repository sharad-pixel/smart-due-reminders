import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SmartResponseSettings {
  id: string;
  user_id: string;
  enabled: boolean;
  w9_request_action: string;
  invoice_request_action: string;
  payment_question_action: string;
  promise_to_pay_action: string;
  payment_plan_request_action: string;
  dispute_action: string;
  callback_request_action: string;
  general_inquiry_action: string;
  already_paid_action: string;
  w9_document_url: string | null;
  ar_portal_url: string | null;
  company_phone: string | null;
  company_address: string | null;
  response_tone: string;
  signature_text: string | null;
  created_at: string;
  updated_at: string;
}

const defaultSettings: Partial<SmartResponseSettings> = {
  enabled: true,
  w9_request_action: "auto_draft",
  invoice_request_action: "auto_draft",
  payment_question_action: "manual",
  promise_to_pay_action: "manual",
  payment_plan_request_action: "manual",
  dispute_action: "manual",
  callback_request_action: "manual",
  general_inquiry_action: "manual",
  already_paid_action: "manual",
  response_tone: "professional",
};

export function useSmartResponseSettings() {
  const [settings, setSettings] = useState<SmartResponseSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("smart_response_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching smart response settings:", error);
      }

      if (data) {
        setSettings(data as SmartResponseSettings);
      } else {
        // Return default settings structure
        setSettings({
          ...defaultSettings,
          id: "",
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as SmartResponseSettings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (updates: Partial<SmartResponseSettings>) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("smart_response_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("smart_response_settings")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("smart_response_settings")
          .insert({
            user_id: user.id,
            ...defaultSettings,
            ...updates,
          });

        if (error) throw error;
      }

      await fetchSettings();
      toast.success("Settings saved");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    refetch: fetchSettings,
  };
}

// Helper to get action setting for a task type
export function getTaskTypeActionKey(taskType: string): keyof SmartResponseSettings | null {
  const mapping: Record<string, keyof SmartResponseSettings> = {
    W9_REQUEST: "w9_request_action",
    INVOICE_COPY_REQUEST: "invoice_request_action",
    PAYMENT_CONFIRMATION: "payment_question_action",
    PROMISE_TO_PAY: "promise_to_pay_action",
    PAYMENT_PLAN_REQUEST: "payment_plan_request_action",
    DISPUTE_CHARGES: "dispute_action",
    DISPUTE_PO: "dispute_action",
    NEEDS_CALLBACK: "callback_request_action",
    GENERAL_INQUIRY: "general_inquiry_action",
    PAYMENT_QUESTION: "already_paid_action",
  };
  return mapping[taskType] || null;
}
