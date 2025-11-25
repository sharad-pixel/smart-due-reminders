import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Mail, Trash2, TestTube, Star } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  display_name: string;
  is_verified: boolean;
  connection_status: string;
  dkim_status: string;
  spf_status: string;
  last_successful_send: string | null;
  is_primary?: boolean;
}

interface EmailHealthDashboardProps {
  accounts: EmailAccount[];
  onRefresh: () => void;
  onDelete: (accountId: string) => void;
  onTest: (accountId: string) => void;
  onSetPrimary: (accountId: string) => void;
}

export const EmailHealthDashboard = ({ accounts, onRefresh, onDelete, onTest, onSetPrimary }: EmailHealthDashboardProps) => {
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
      case "pass":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
      case "fail":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getProviderBadge = (provider: string) => {
    const providerMap: Record<string, string> = {
      gmail: "Gmail",
      outlook: "Outlook",
      yahoo: "Yahoo",
      icloud: "iCloud",
      smtp: "Custom SMTP",
    };
    return providerMap[provider] || provider;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Connected Email Accounts</CardTitle>
            <CardDescription>Monitor your email connection health and deliverability</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">{account.email_address}</div>
                    <div className="text-sm text-muted-foreground">{account.display_name}</div>
                  </div>
                </div>
                <Badge variant="secondary">{getProviderBadge(account.provider)}</Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Connection</div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(account.connection_status)}
                    <span className="text-sm capitalize">{account.connection_status}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Verified</div>
                  <div className="flex items-center gap-2">
                    {account.is_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">{account.is_verified ? "Yes" : "No"}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">DKIM</div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(account.dkim_status)}
                    <span className="text-sm capitalize">{account.dkim_status}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">SPF</div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(account.spf_status)}
                    <span className="text-sm capitalize">{account.spf_status}</span>
                  </div>
                </div>
              </div>

              {account.last_successful_send && (
                <div className="text-xs text-muted-foreground">
                  Last successful send: {new Date(account.last_successful_send).toLocaleString()}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSetPrimary(account.id)}
                  disabled={account.is_primary}
                >
                  <Star className={`h-4 w-4 mr-2 ${account.is_primary ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                  {account.is_primary ? 'Primary' : 'Set as Primary'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTest(account.id)}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteAccountId(account.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <AlertDialog open={!!deleteAccountId} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Email Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently disconnect this email account. You won't be able to send emails from this account until you reconnect it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteAccountId) {
                  onDelete(deleteAccountId);
                  setDeleteAccountId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
