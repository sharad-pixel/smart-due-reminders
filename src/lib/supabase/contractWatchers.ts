import { supabase } from "@/integrations/supabase/client";

export interface ContractWatcher {
  id: string;
  contract_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
}

export async function fetchContractWatchers(contractId: string) {
  const { data, error } = await supabase
    .from("live_contract_watchers")
    .select("*")
    .eq("contract_id", contractId);
  if (error) throw error;
  return (data || []) as ContractWatcher[];
}

export async function addContractWatcher(params: {
  contractId: string;
  accountId: string;
  userId: string;
  addedBy: string;
}) {
  const { data, error } = await supabase
    .from("live_contract_watchers")
    .insert({
      contract_id: params.contractId,
      account_id: params.accountId,
      user_id: params.userId,
      added_by: params.addedBy,
    })
    .select()
    .single();
  if (error && (error as any).code !== "23505") throw error;
  return data;
}

export async function removeContractWatcher(id: string) {
  const { error } = await supabase
    .from("live_contract_watchers")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
