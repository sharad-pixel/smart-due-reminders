import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgingBucketData {
  invoices: any[];
  count: number;
  total_amount: number;
}

export interface AgingBucketsResponse {
  current: AgingBucketData;
  dpd_1_30: AgingBucketData;
  dpd_31_60: AgingBucketData;
  dpd_61_90: AgingBucketData;
  dpd_91_120: AgingBucketData;
  dpd_120_plus: AgingBucketData;
}

export const useAgingBuckets = (debtorId?: string) => {
  return useQuery({
    queryKey: ["aging-buckets", debtorId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-aging-bucket-invoices`);
      if (debtorId) {
        url.searchParams.set('debtor_id', debtorId);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch aging buckets");
      }

      const result = await response.json();
      return result.data as AgingBucketsResponse;
    },
  });
};
