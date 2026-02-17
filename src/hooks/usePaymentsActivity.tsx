
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentTransaction {
  id: string;
  invoice_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number | null;
  reference_number: string | null;
  payment_method: string | null;
  source_system: string | null;
  reason: string | null;
  notes: string | null;
  transaction_date: string;
  created_at: string;
  metadata: any;
  invoice?: {
    invoice_number: string;
    debtor_id: string;
    currency: string | null;
    debtors?: {
      name: string;
      company_name: string | null;
    };
  };
}

export interface PaymentsSummary {
  totalCollected: number;
  totalCollectedToday: number;
  totalCollectedLast7Days: number;
  totalCollectedLast30Days: number;
  paymentCount: number;
  averagePaymentAmount: number;
  bySource: Record<string, number>;
  byType: Record<string, number>;
}

export interface PaymentsFilters {
  transactionType?: string;
  sourceSystem?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export interface UsePaymentsActivityOptions {
  filters?: PaymentsFilters;
  page?: number;
  pageSize?: number;
}

export const usePaymentsActivity = (options: UsePaymentsActivityOptions = {}) => {
  const { filters = {}, page = 1, pageSize = 15 } = options;

  return useQuery({
    queryKey: ['payments-activity', filters, page, pageSize],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      // Build query
      let query = supabase
        .from('invoice_transactions')
        .select(`
          *,
          invoice:invoices!invoice_transactions_invoice_id_fkey (
            invoice_number,
            debtor_id,
            currency,
            debtors (
              name,
              company_name
            )
          )
        `, { count: 'exact' })
        .eq('user_id', accountId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.transactionType && filters.transactionType !== 'all') {
        query = query.eq('transaction_type', filters.transactionType);
      }

      if (filters.sourceSystem && filters.sourceSystem !== 'all') {
        query = query.eq('source_system', filters.sourceSystem);
      }

      if (filters.dateFrom) {
        query = query.gte('transaction_date', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('transaction_date', filters.dateTo);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        transactions: (data || []) as PaymentTransaction[],
        totalCount: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
  });
};

export const usePaymentsSummary = () => {
  return useQuery({
    queryKey: ['payments-summary'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const last7Days = new Date(today);
      last7Days.setDate(last7Days.getDate() - 7);
      const last7DaysStr = last7Days.toISOString().split('T')[0];
      
      const last30Days = new Date(today);
      last30Days.setDate(last30Days.getDate() - 30);
      const last30DaysStr = last30Days.toISOString().split('T')[0];

      // Fetch all transactions for summary calculations
      const { data: allTransactions, error } = await supabase
        .from('invoice_transactions')
        .select('amount, transaction_type, source_system, transaction_date')
        .eq('user_id', accountId)
        .in('transaction_type', ['payment', 'credit']) // Only count positive settlements
        .gte('transaction_date', last30DaysStr);

      if (error) throw error;

      const transactions = allTransactions || [];

      // Calculate summaries
      const totalCollectedLast30Days = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      const todayTransactions = transactions.filter(t => t.transaction_date >= todayStr);
      const totalCollectedToday = todayTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      const last7DaysTransactions = transactions.filter(t => t.transaction_date >= last7DaysStr);
      const totalCollectedLast7Days = last7DaysTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Group by source
      const bySource: Record<string, number> = {};
      transactions.forEach(t => {
        const source = t.source_system || 'manual';
        bySource[source] = (bySource[source] || 0) + Number(t.amount || 0);
      });

      // Group by type
      const byType: Record<string, number> = {};
      transactions.forEach(t => {
        byType[t.transaction_type] = (byType[t.transaction_type] || 0) + Number(t.amount || 0);
      });

      const summary: PaymentsSummary = {
        totalCollected: totalCollectedLast30Days,
        totalCollectedToday,
        totalCollectedLast7Days,
        totalCollectedLast30Days,
        paymentCount: transactions.length,
        averagePaymentAmount: transactions.length > 0 ? totalCollectedLast30Days / transactions.length : 0,
        bySource,
        byType,
      };

      return summary;
    },
  });
};

export const useTransactionTypes = () => {
  return useQuery({
    queryKey: ['transaction-types'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      const { data, error } = await supabase
        .from('invoice_transactions')
        .select('transaction_type')
        .eq('user_id', accountId);

      if (error) return [];

      const types = [...new Set(data?.map(d => d.transaction_type) || [])];
      return types;
    },
  });
};

export const useSourceSystems = () => {
  return useQuery({
    queryKey: ['source-systems'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      const { data, error } = await supabase
        .from('invoice_transactions')
        .select('source_system')
        .eq('user_id', accountId);

      if (error) return [];

      const sources = [...new Set(data?.map(d => d.source_system).filter(Boolean) || [])];
      return sources as string[];
    },
  });
};
