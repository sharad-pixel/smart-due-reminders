import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PricingModel = "recurring" | "one_off";
export type TaxBehavior = "auto" | "inclusive" | "exclusive";
export type BillingPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface ProductCatalogItem {
  id: string;
  user_id: string;
  description: string;
  product_description?: string | null;
  unit_type: string;
  unit_cost: number;
  currency: string;
  active?: boolean;
  status_effective_date?: string | null;
  source?: string;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  // Stripe-consistent fields
  pricing_model?: PricingModel;
  billing_period?: BillingPeriod | null;
  tax_behavior?: TaxBehavior;
  tax_category?: string | null;
  price_description?: string | null;
  lookup_key?: string | null;
  image_url?: string | null;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  stripe_synced_at?: string | null;
}

export interface SaveProductInput {
  description: string;
  unit_type: string;
  unit_cost: number;
  currency?: string;
}

export function useProductCatalog() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["product-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_catalog")
        .select("*")
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProductCatalogItem[];
    },
  });

  const saveProduct = useMutation({
    mutationFn: async (input: SaveProductInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const desc = input.description.trim();
      const unit = (input.unit_type || "each").trim() || "each";
      if (!desc) throw new Error("Description required");

      const { data: existing } = await supabase
        .from("product_catalog")
        .select("id, times_used")
        .eq("user_id", user.id)
        .ilike("description", desc)
        .eq("unit_type", unit)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("product_catalog")
          .update({
            unit_cost: input.unit_cost,
            currency: input.currency || "USD",
            times_used: (existing.times_used || 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
        return existing.id;
      }

      const { data, error } = await supabase
        .from("product_catalog")
        .insert({
          user_id: user.id,
          description: desc,
          unit_type: unit,
          unit_cost: input.unit_cost,
          currency: input.currency || "USD",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-catalog"] });
      toast.success("Saved to product catalog");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save product"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-catalog"] });
      toast.success("Removed from catalog");
    },
    onError: (e: any) => toast.error(e.message || "Failed to remove"),
  });

  return { list, saveProduct, remove };
}
