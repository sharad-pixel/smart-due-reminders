import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  debtors?: {
    name: string;
    company_name: string;
    email: string;
  };
  invoices?: {
    invoice_number: string;
    amount: number;
    due_date: string;
  };
}

export interface InboundEmailFilters {
  status?: string;
  action_type?: string;
  debtor_name?: string;
  debtor_status?: "all" | "active" | "archived";
  search?: string;
  start_date?: string;
  end_date?: string;
  hide_processed?: boolean;
  hide_closed?: boolean;
  action_status?: string;
  ai_category?: string;
  ai_priority?: string;
}

export function useInboundEmails() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchInboundEmails = async (filters: InboundEmailFilters = {}): Promise<InboundEmail[]> => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("inbound_emails")
        .select(`
          *,
          debtors (name, company_name, email, is_active, is_archived),
          invoices (invoice_number, amount, due_date)
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      // Hide processed emails if requested
      if (filters.hide_processed) {
        query = query.neq("status", "processed");
      }

      // Hide closed action items if requested
      if (filters.hide_closed) {
        query = query.neq("action_status", "closed");
      }

      // Filter by action status
      if (filters.action_status && filters.action_status !== "all") {
        query = query.eq("action_status", filters.action_status);
      }

      // Filter by AI category
      if (filters.ai_category && filters.ai_category !== "all") {
        query = query.eq("ai_category", filters.ai_category);
      }

      // Filter by AI priority
      if (filters.ai_priority && filters.ai_priority !== "all") {
        query = query.eq("ai_priority", filters.ai_priority);
      }

      if (filters.search) {
        query = query.or(
          `subject.ilike.%${filters.search}%,from_email.ilike.%${filters.search}%,text_body.ilike.%${filters.search}%`
        );
      }

      if (filters.start_date) {
        query = query.gte("created_at", filters.start_date);
      }

      if (filters.end_date) {
        query = query.lte("created_at", filters.end_date);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by action type if specified
      let filteredData = data || [];
      if (filters.action_type && filters.action_type !== "all") {
        filteredData = filteredData.filter((email) => {
          if (!email.ai_actions || !Array.isArray(email.ai_actions)) return false;
          return email.ai_actions.some((action: any) => action.type === filters.action_type);
        });
      }

      // Filter by debtor status if specified
      if (filters.debtor_status && filters.debtor_status !== "all") {
        filteredData = filteredData.filter((email) => {
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
      const { error } = await supabase
        .from("inbound_emails")
        .update({ status })
        .eq("id", emailId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email status updated",
      });
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast({
        title: "Error",
        description: "Failed to update email",
        variant: "destructive",
      });
    }
  };

  const updateActionStatus = async (emailId: string, actionStatus: string, notes?: string) => {
    try {
      const updates: Record<string, any> = {
        action_status: actionStatus,
      };
      
      if (actionStatus === "closed") {
        updates.action_closed_at = new Date().toISOString();
      }
      
      if (notes) {
        updates.action_notes = notes;
      }

      const { error } = await supabase
        .from("inbound_emails")
        .update(updates)
        .eq("id", emailId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Action marked as ${actionStatus}`,
      });
      return true;
    } catch (error: any) {
      console.error("Error updating action status:", error);
      toast({
        title: "Error",
        description: "Failed to update action status",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: "Failed to forward emails",
        variant: "destructive",
      });
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
    forwardEmails,
    isLoading,
  };
}
