import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  fetchInboundEmails as fetchInboundEmailsService,
  updateInboundEmailStatus as updateStatusService,
  updateInboundEmailActionStatus as updateActionService,
  archiveInboundEmail as archiveService,
  unarchiveInboundEmail as unarchiveService,
  type InboundEmailFilters,
} from "@/lib/supabase/inbound-emails";

export interface InboundEmail {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  event_type: string;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[] | null;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  message_id: string;
  debtor_id: string | null;
  invoice_id: string | null;
  status: "received" | "linked" | "processed" | "error";
  error_message: string | null;
  ai_summary: string | null;
  ai_actions: Array<{
    type: string;
    confidence: number;
    details: string;
  }> | null;
  ai_processed_at: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_reason?: string | null;
  ai_category?: string | null;
  ai_priority?: string | null;
  ai_sentiment?: string | null;
  action_status?: string | null;
  debtors?: {
    name: string;
    company_name: string;
    email: string;
    is_active?: boolean;
    is_archived?: boolean;
  };
  invoices?: {
    invoice_number: string;
    amount: number;
    due_date: string;
    status?: string;
  };
}

export type { InboundEmailFilters };

export function useInboundEmails() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchInboundEmails = async (filters: InboundEmailFilters = {}): Promise<InboundEmail[]> => {
    setIsLoading(true);
    try {
      let filteredData = await fetchInboundEmailsService(filters);

      // Client-side filters that can't be done in SQL
      if (filters.action_type && filters.action_type !== "all") {
        filteredData = filteredData.filter((email: any) => {
          if (!email.ai_actions || !Array.isArray(email.ai_actions)) return false;
          return email.ai_actions.some((action: any) => action.type === filters.action_type);
        });
      }

      if (filters.debtor_status && filters.debtor_status !== "all") {
        filteredData = filteredData.filter((email: any) => {
          if (!email.debtors) return false;
          const debtor = email.debtors as any;
          if (filters.debtor_status === "active") {
            return debtor.is_active === true && debtor.is_archived !== true;
          } else if (filters.debtor_status === "archived") {
            return debtor.is_archived === true;
          }
          return true;
        });
      }

      return filteredData as unknown as InboundEmail[];
    } catch (error: any) {
      console.error("Error fetching inbound emails:", error);
      toast({
        title: "Error",
        description: "Failed to fetch inbound emails",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const triggerAIProcessing = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-inbound-ai");
      if (error) throw error;

      toast({
        title: "Success",
        description: `Processed ${data.processed} emails`,
      });
      return data;
    } catch (error: any) {
      console.error("Error triggering AI processing:", error);
      toast({
        title: "Error",
        description: "Failed to process emails",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateEmailStatus = async (emailId: string, status: string) => {
    try {
      await updateStatusService(emailId, status);
      toast({ title: "Success", description: "Email status updated" });
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast({ title: "Error", description: "Failed to update email", variant: "destructive" });
    }
  };

  const updateActionStatus = async (emailId: string, actionStatus: string, notes?: string) => {
    try {
      await updateActionService(emailId, actionStatus, notes);
      toast({ title: "Success", description: `Action marked as ${actionStatus}` });
      return true;
    } catch (error: any) {
      console.error("Error updating action status:", error);
      toast({ title: "Error", description: "Failed to update action status", variant: "destructive" });
      return false;
    }
  };

  const archiveEmail = async (emailId: string, reason?: string) => {
    try {
      await archiveService(emailId, reason);
      toast({ title: "Success", description: "Email archived" });
      return true;
    } catch (error: any) {
      console.error("Error archiving email:", error);
      toast({ title: "Error", description: "Failed to archive email", variant: "destructive" });
      return false;
    }
  };

  const unarchiveEmail = async (emailId: string) => {
    try {
      await unarchiveService(emailId);
      toast({ title: "Success", description: "Email restored" });
      return true;
    } catch (error: any) {
      console.error("Error restoring email:", error);
      toast({ title: "Error", description: "Failed to restore email", variant: "destructive" });
      return false;
    }
  };

  const forwardEmails = async (emailIds: string[], forwardTo: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forward-inbound-email", {
        body: { email_ids: emailIds, forward_to: forwardTo },
      });
      if (error) throw error;

      toast({
        title: "Success",
        description: `Forwarded ${data.forwarded} email(s) to ${forwardTo}`,
      });
      return data;
    } catch (error: any) {
      console.error("Error forwarding emails:", error);
      toast({ title: "Error", description: "Failed to forward emails", variant: "destructive" });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fetchInboundEmails,
    triggerAIProcessing,
    updateEmailStatus,
    updateActionStatus,
    archiveEmail,
    unarchiveEmail,
    forwardEmails,
    isLoading,
  };
}
