import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminClmEntitlement } from "@/hooks/useClmEntitlement";

interface Props {
  accountId: string | null;
}

export const AdminClmToggle = ({ accountId }: Props) => {
  const { entitlement, isLoading, toggleMutation } = useAdminClmEntitlement(accountId);
  const [notes, setNotes] = useState("");

  if (!accountId) return null;

  const isActive = entitlement?.status === "active";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Contract Intelligence Add-on
          {isActive && <Badge className="ml-2">Active</Badge>}
        </CardTitle>
        <CardDescription>
          Separately purchased module. Toggle access to AI-native contract lifecycle
          management for this account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <Label className="text-sm font-medium">Enable Contract Intelligence module</Label>
                <p className="text-xs text-muted-foreground">
                  Grants this account access to /contracts and Contract Intelligence features.
                </p>
              </div>
              <Switch
                checked={isActive}
                disabled={toggleMutation.isPending}
                onCheckedChange={(checked) => {
                  toggleMutation.mutate(
                    { enabled: checked, notes: notes || undefined },
                    {
                      onSuccess: () => toast.success(`CLM ${checked ? "enabled" : "disabled"}`),
                      onError: (e: any) => toast.error(e?.message || "Failed to toggle CLM"),
                    },
                  );
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Internal notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Annual contract signed via sales — $12k/yr"
                className="text-sm"
                rows={2}
              />
            </div>

            {entitlement?.enabled_at && (
              <p className="text-xs text-muted-foreground">
                Enabled {new Date(entitlement.enabled_at).toLocaleDateString()}
                {entitlement.notes ? ` · ${entitlement.notes}` : ""}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
