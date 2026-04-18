import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  CloudCog,
  Briefcase,
  Lock,
  Crown,
} from "lucide-react";

export const SalesforceSyncSection = () => {
  const queryClient = useQueryClient();

  // Check user's plan type
  const { data: profile } = useQuery({
    queryKey: ["user-profile-plan"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("plan_type")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const isEnterprise = (profile?.plan_type as string) === "enterprise";

  const { data: connection, isLoading } = useQuery({
    queryKey: ["salesforce-connection"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return null;

      const { data, error } = await supabase
        .from("crm_connections_safe" as any)
        .select("id, user_id, crm_type, instance_url, connected_at, last_sync_at, created_at, updated_at")
        .eq("user_id", accountId)
        .eq("crm_type", "salesforce")
        .maybeSingle();

      if (error) throw error;
      return data as unknown as { id: string; user_id: string; crm_type: string; instance_url: string | null; connected_at: string | null; last_sync_at: string | null; created_at: string; updated_at: string } | null;
    },
    enabled: isEnterprise,
  });

  const { data: caseStats } = useQuery({
    queryKey: ["salesforce-case-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return null;

      const { count, error } = await supabase
        .from("cs_cases")
        .select("id", { count: "exact" })
        .eq("user_id", accountId)
        .eq("source_system", "salesforce");

      if (error) throw error;
      return { total: count || 0 };
    },
    enabled: isEnterprise && !!connection,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("salesforce-oauth-start");
      if (error) throw error;
      if (!data?.authUrl) throw new Error("No auth URL returned");
      window.location.href = data.authUrl;
    },
    onError: (err: any) => {
      toast.error(err.message || "Could not start Salesforce connection");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-salesforce-cases");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Salesforce Cases synced", {
        description: `${data.upserted} cases synced, ${data.matched_to_debtors} matched to accounts`,
      });
      queryClient.invalidateQueries({ queryKey: ["salesforce-connection"] });
      queryClient.invalidateQueries({ queryKey: ["salesforce-case-stats"] });
    },
    onError: (err: any) => {
      toast.error("Sync failed", { description: err.message });
    },
  });

  const isConnected = !!connection;

  return (
    <Card className="border-sky-200/50 dark:border-sky-800/50 relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <CloudCog className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Salesforce CRM
                {!isEnterprise ? (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700">
                    <Crown className="h-3 w-3 mr-1" />
                    Enterprise
                  </Badge>
                ) : isConnected ? (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Not connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Sync support cases for customer health & AI risk assessment
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!isEnterprise ? (
          <div className="space-y-3">
            <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Enterprise Feature
                </p>
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
                Salesforce CRM integration is available exclusively on the Enterprise plan. Connect your Salesforce instance to import support cases, enrich customer health signals, and power AI-driven risk assessment.
              </p>
            </div>
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={() => {
                window.location.href = "mailto:sales@recouply.ai?subject=Enterprise%20Plan%20Inquiry%20-%20Salesforce%20Integration";
              }}
            >
              <Crown className="h-4 w-4" />
              Contact Sales for Enterprise Access
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isConnected ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Cases Synced</p>
                <p className="text-lg font-semibold">{caseStats?.total ?? "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Last Synced</p>
                <p className="text-sm font-medium">
                  {connection.last_sync_at
                    ? new Date(connection.last_sync_at).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {syncMutation.isPending ? "Syncing..." : "Sync Cases"}
              </Button>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-sky-600" />
                What's synced
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Cases (subject, status, priority, type)
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Auto-matched to existing accounts
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Used for AI risk assessment
                </li>
              </ul>
            </div>
          </>
        ) : (
          <>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                Connect Salesforce to import support cases and enrich your customer health signals for AI-driven risk assessment.
              </p>
            </div>

            <Button
              className="w-full gap-2 bg-sky-600 hover:bg-sky-700"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {connectMutation.isPending ? "Connecting..." : "Connect Salesforce"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
