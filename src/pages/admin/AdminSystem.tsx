import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Save, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminSystem = () => {
  const { config: systemConfig, loading: configLoading, saveAllConfig, refetch } = useSystemConfig();
  
  const [config, setConfig] = useState({
    maintenanceMode: false,
    signupsEnabled: true,
    maxInvoicesPerUser: 5,
    emailNotificationsEnabled: true,
    founderEmail: "sharad@recouply.ai",
  });
  const [saving, setSaving] = useState(false);

  // Sync local state with fetched config
  useEffect(() => {
    if (!configLoading) {
      setConfig(prev => ({
        ...prev,
        maintenanceMode: systemConfig.maintenanceMode,
        signupsEnabled: systemConfig.signupsEnabled,
        maxInvoicesPerUser: systemConfig.maxInvoicesPerFreeUser,
        emailNotificationsEnabled: systemConfig.emailNotificationsEnabled,
      }));
    }
  }, [configLoading, systemConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await saveAllConfig({
        maintenanceMode: config.maintenanceMode,
        signupsEnabled: config.signupsEnabled,
        maxInvoicesPerFreeUser: config.maxInvoicesPerUser,
        emailNotificationsEnabled: config.emailNotificationsEnabled,
      });
      
      if (success) {
        toast({ title: "Configuration saved", description: "System settings updated successfully" });
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save configuration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (configLoading) {
    return (
      <AdminLayout title="System Configuration" description="Platform-wide settings">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="System Configuration" description="Platform-wide settings">
      <div className="max-w-2xl space-y-6">
        {config.maintenanceMode && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Maintenance Mode is ON.</strong> Non-admin users will see a maintenance page and cannot access the platform.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Platform Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Maintenance Mode */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Temporarily disable access to the platform
                </p>
              </div>
              <Switch
                checked={config.maintenanceMode}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, maintenanceMode: checked }))
                }
              />
            </div>

            {/* Signups */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Signups</Label>
                <p className="text-sm text-muted-foreground">
                  Enable new user registrations
                </p>
              </div>
              <Switch
                checked={config.signupsEnabled}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, signupsEnabled: checked }))
                }
              />
            </div>

            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send system emails (digests, alerts)
                </p>
              </div>
              <Switch
                checked={config.emailNotificationsEnabled}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, emailNotificationsEnabled: checked }))
                }
              />
            </div>

            {/* Max Invoices */}
            <div>
              <Label>Max Invoices Per Free User</Label>
              <Input
                type="number"
                value={config.maxInvoicesPerUser}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxInvoicesPerUser: parseInt(e.target.value) || 15,
                  }))
                }
                className="mt-2 w-32"
              />
            </div>

            {/* Founder Email */}
            <div>
              <Label>Founder Email (Admin)</Label>
              <Input
                value={config.founderEmail}
                disabled
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This email has full admin access to the platform
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Supabase Project</span>
              <span className="font-mono text-sm">kguurazunazhhrhasahd</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Environment</span>
              <span className="font-mono text-sm">Production</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono text-sm">1.0.0</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={refetch} disabled={saving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSystem;
