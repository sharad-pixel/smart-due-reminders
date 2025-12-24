import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Target, 
  Workflow, 
  Users, 
  Search,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Clock,
  Loader2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Account {
  id: string;
  name: string;
  company_name: string;
  total_open_balance: number;
  max_days_past_due: number;
  collections_risk_score: number;
  outreach_type: string | null;
  assigned_campaign_id: string | null;
  open_invoices_count: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
}

export function AccountAllocationManager() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  // Fetch accounts with allocation info
  const { data: accounts = [], isLoading: loadingAccounts, refetch: refetchAccounts } = useQuery({
    queryKey: ["accounts-allocation"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("debtors")
        .select("id, name, company_name, total_open_balance, max_days_past_due, collections_risk_score, outreach_type, assigned_campaign_id, open_invoices_count")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("collections_risk_score", { ascending: false });

      if (error) throw error;
      return (data || []) as Account[];
    }
  });

  // Fetch active campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-list"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("collection_campaigns")
        .select("id, name, status")
        .eq("user_id", user.id)
        .in("status", ["draft", "active"]);

      if (error) throw error;
      return (data || []) as Campaign[];
    }
  });

  // Assign accounts to workflow
  const assignToWorkflow = useMutation({
    mutationFn: async (accountIds: string[]) => {
      const { error } = await supabase
        .from("debtors")
        .update({ outreach_type: "workflow", assigned_campaign_id: null })
        .in("id", accountIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-allocation"] });
      setSelectedAccounts(new Set());
      toast.success("Accounts assigned to AI Workflow outreach");
    },
    onError: () => toast.error("Failed to assign accounts")
  });

  // Assign accounts to campaign
  const assignToCampaign = useMutation({
    mutationFn: async ({ accountIds, campaignId }: { accountIds: string[]; campaignId: string }) => {
      const { error } = await supabase
        .from("debtors")
        .update({ outreach_type: "campaign", assigned_campaign_id: campaignId })
        .in("id", accountIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-allocation"] });
      setSelectedAccounts(new Set());
      toast.success("Accounts assigned to campaign");
    },
    onError: () => toast.error("Failed to assign accounts")
  });

  // Unassign accounts
  const unassignAccounts = useMutation({
    mutationFn: async (accountIds: string[]) => {
      const { error } = await supabase
        .from("debtors")
        .update({ outreach_type: null, assigned_campaign_id: null })
        .in("id", accountIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-allocation"] });
      setSelectedAccounts(new Set());
      toast.success("Accounts unassigned from outreach");
    },
    onError: () => toast.error("Failed to unassign accounts")
  });

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unassignedAccounts = filteredAccounts.filter(a => !a.outreach_type);
  const workflowAccounts = filteredAccounts.filter(a => a.outreach_type === "workflow");
  const campaignAccounts = filteredAccounts.filter(a => a.outreach_type === "campaign");

  const toggleAccount = (id: string) => {
    const newSet = new Set(selectedAccounts);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedAccounts(newSet);
  };

  const getRiskColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score > 75) return "text-red-600";
    if (score > 55) return "text-orange-600";
    if (score > 30) return "text-yellow-600";
    return "text-green-600";
  };

  const AccountRow = ({ account, showCheckbox = true }: { account: Account; showCheckbox?: boolean }) => (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        selectedAccounts.has(account.id) && "bg-primary/5 border-primary/30",
        showCheckbox && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={() => showCheckbox && toggleAccount(account.id)}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selectedAccounts.has(account.id)}
          onChange={() => toggleAccount(account.id)}
          className="h-4 w-4 rounded border-gray-300"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{account.company_name || account.name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${(account.total_open_balance || 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {account.max_days_past_due || 0}d
          </span>
          <span>{account.open_invoices_count || 0} invoices</span>
        </div>
      </div>
      <Badge className={cn("shrink-0", getRiskColor(account.collections_risk_score))}>
        {account.collections_risk_score || 0}
      </Badge>
    </div>
  );

  const getCampaignName = (id: string | null) => {
    if (!id) return "Unknown";
    return campaigns.find(c => c.id === id)?.name || "Unknown";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Account Outreach Allocation
            </CardTitle>
            <CardDescription>
              Assign accounts to either Campaign or Workflow outreach to prevent duplicate communications
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchAccounts()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold">{unassignedAccounts.length}</p>
            <p className="text-xs text-muted-foreground">Unassigned</p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{workflowAccounts.length}</p>
            <p className="text-xs text-muted-foreground">Workflow</p>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{campaignAccounts.length}</p>
            <p className="text-xs text-muted-foreground">Campaigns</p>
          </div>
        </div>

        {/* Action Buttons */}
        {selectedAccounts.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-primary/5 rounded-lg mb-4">
            <span className="text-sm font-medium">{selectedAccounts.size} selected</span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => assignToWorkflow.mutate(Array.from(selectedAccounts))}
              disabled={assignToWorkflow.isPending}
            >
              <Workflow className="h-4 w-4 mr-1" />
              Assign to Workflow
            </Button>
            {campaigns.length > 0 && (
              <Button
                size="sm"
                onClick={() => assignToCampaign.mutate({ 
                  accountIds: Array.from(selectedAccounts), 
                  campaignId: campaigns[0].id 
                })}
                disabled={assignToCampaign.isPending}
              >
                <Target className="h-4 w-4 mr-1" />
                Assign to Campaign
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => unassignAccounts.mutate(Array.from(selectedAccounts))}
              disabled={unassignAccounts.isPending}
            >
              Unassign
            </Button>
          </div>
        )}

        {/* Tabs for Account Lists */}
        <Tabs defaultValue="unassigned" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="unassigned" className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Unassigned ({unassignedAccounts.length})
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center gap-1.5">
              <Workflow className="h-4 w-4" />
              Workflow ({workflowAccounts.length})
            </TabsTrigger>
            <TabsTrigger value="campaign" className="flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              Campaign ({campaignAccounts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unassigned" className="mt-4">
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : unassignedAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>All accounts have been assigned to an outreach flow</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {unassignedAccounts.map((account) => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="workflow" className="mt-4">
            {workflowAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Workflow className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No accounts assigned to workflow outreach</p>
                <p className="text-sm mt-1">Workflow outreach uses automated aging-based messaging</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {workflowAccounts.map((account) => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="campaign" className="mt-4">
            {campaignAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No accounts assigned to campaign outreach</p>
                <p className="text-sm mt-1">Campaign outreach allows targeted, risk-based strategies</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {campaignAccounts.map((account) => (
                  <div key={account.id} className="space-y-1">
                    <AccountRow account={account} />
                    <p className="text-xs text-muted-foreground ml-7">
                      Campaign: {getCampaignName(account.assigned_campaign_id)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Best Practices Info */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg text-sm space-y-2">
          <p className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            Best Practices for Account Allocation
          </p>
          <ul className="space-y-1 text-muted-foreground ml-6 list-disc">
            <li><strong>Workflow:</strong> Best for ongoing automated outreach based on invoice aging</li>
            <li><strong>Campaign:</strong> Best for targeted risk-based or time-sensitive collections</li>
            <li>Each account should only be in ONE outreach flow to prevent duplicate communications</li>
            <li>High-risk accounts often benefit from campaign-based personalized outreach</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
