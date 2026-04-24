import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Link2 } from "lucide-react";
import { useAdminIntegrationToggles, ALL_INTEGRATION_KEYS, INTEGRATION_LABELS } from "@/hooks/useIntegrationToggles";
import type { IntegrationKey } from "@/hooks/useIntegrationToggles";
import { toast } from "sonner";

const INTEGRATION_DESCRIPTIONS: Record<IntegrationKey, string> = {
  stripe: "Sync invoices, payments & customers from Stripe",
  quickbooks: "Import AR data & reconcile payments from QuickBooks",
  ai_ingestion: "Google Drive scanning, Google Sheets sync, AI-powered data review",
  salesforce: "Sync CRM accounts & support cases from Salesforce",
  hubspot: "Sync contacts, companies, deals & tickets from HubSpot",
  erp_netsuite: "Connect Oracle NetSuite for full ERP synchronization",
  erp_oracle: "Connect Oracle Fusion Cloud ERP / EBS for enterprise AR sync",
  erp_sage: "Connect Sage Intacct for full ERP synchronization",
  dnb: "Enrich accounts with D&B credit intelligence (D-U-N-S, PAYDEX, risk scores)",
};

interface Props {
  accountId: string | null;
}

export const AdminIntegrationToggles = ({ accountId }: Props) => {
  const { isLoading, isEnabled, toggleMutation } = useAdminIntegrationToggles(accountId);

  if (!accountId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No account found for this user
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Integration Access
        </CardTitle>
        <CardDescription>
          Control which integrations are available for this user's entire account hierarchy (parent & child accounts)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ALL_INTEGRATION_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between py-2 border-b last:border-b-0">
            <div>
              <Label className="text-sm font-medium">{INTEGRATION_LABELS[key]}</Label>
              <p className="text-xs text-muted-foreground">{INTEGRATION_DESCRIPTIONS[key]}</p>
            </div>
            <Switch
              checked={isEnabled(key)}
              disabled={toggleMutation.isPending}
              onCheckedChange={(checked) => {
                toggleMutation.mutate(
                  { key, enabled: checked },
                  {
                    onSuccess: () => {
                      toast.success(`${INTEGRATION_LABELS[key]} ${checked ? "enabled" : "disabled"}`);
                    },
                    onError: () => {
                      toast.error(`Failed to update ${INTEGRATION_LABELS[key]}`);
                    },
                  }
                );
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
