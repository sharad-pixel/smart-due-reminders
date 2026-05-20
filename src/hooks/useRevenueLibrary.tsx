import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccountId";
import { toast } from "sonner";

export type RevenueType = "one_time" | "subscription" | "usage" | "milestone" | "professional_services" | "other";
export type RecognitionMethod =
  | "point_in_time"
  | "over_time_straight_line"
  | "over_time_usage"
  | "milestone"
  | "percentage_completion";

export interface RevenueLibraryItem {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  revenue_type: RevenueType;
  performance_obligation: string | null;
  recognition_method: RecognitionMethod;
  standalone_selling_price: number | null;
  currency: string;
  default_term_months: number | null;
  billing_frequency: string | null;
  tax_category: string | null;
  gl_account_code: string | null;
  is_active: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export type RevenueLibraryInput = Partial<
  Omit<RevenueLibraryItem, "id" | "account_id" | "user_id" | "created_at" | "updated_at">
> & { name: string };

export const REVENUE_TYPES: { value: RevenueType; label: string }[] = [
  { value: "one_time", label: "One-time" },
  { value: "subscription", label: "Subscription" },
  { value: "usage", label: "Usage-based" },
  { value: "milestone", label: "Milestone" },
  { value: "professional_services", label: "Professional Services" },
  { value: "other", label: "Other" },
];

export const RECOGNITION_METHODS: { value: RecognitionMethod; label: string }[] = [
  { value: "point_in_time", label: "Point in time" },
  { value: "over_time_straight_line", label: "Over time — straight-line" },
  { value: "over_time_usage", label: "Over time — usage" },
  { value: "milestone", label: "Milestone" },
  { value: "percentage_completion", label: "Percentage completion" },
];

export function useRevenueLibrary() {
  const qc = useQueryClient();
  const { data: acct } = useAccountId();

  const list = useQuery({
    queryKey: ["revenue-library", acct?.accountId],
    enabled: !!acct?.accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_library_items")
        .select("*")
        .eq("account_id", acct!.accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RevenueLibraryItem[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: RevenueLibraryInput & { id?: string }) => {
      if (!acct?.accountId || !acct?.userId) throw new Error("Not authenticated");
      const payload: any = {
        account_id: acct.accountId,
        user_id: acct.userId,
        name: input.name,
        sku: input.sku ?? null,
        description: input.description ?? null,
        revenue_type: input.revenue_type ?? "one_time",
        performance_obligation: input.performance_obligation ?? null,
        recognition_method: input.recognition_method ?? "point_in_time",
        standalone_selling_price: input.standalone_selling_price ?? null,
        currency: input.currency ?? "USD",
        default_term_months: input.default_term_months ?? null,
        billing_frequency: input.billing_frequency ?? null,
        tax_category: input.tax_category ?? null,
        gl_account_code: input.gl_account_code ?? null,
        is_active: input.is_active ?? true,
      };
      if (input.id) {
        const { error } = await supabase
          .from("revenue_library_items")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("revenue_library_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue-library"] });
      toast.success("Revenue item saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save item"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revenue_library_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue-library"] });
      toast.success("Item deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete. It may be attached to a contract."),
  });

  return { list, upsert, remove };
}
