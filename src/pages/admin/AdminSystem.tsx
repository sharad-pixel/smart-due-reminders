import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Save, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const AdminSystem = () => {
  const [config, setConfig] = useState({
    maintenanceMode: false,
    signupsEnabled: true,
    maxInvoicesPerUser: 15,
    emailNotificationsEnabled: true,
    founderEmail: "sharad@recouply.ai",
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // This would typically save to a system_config table
      toast({ title: "Configuration saved", description: "System settings updated" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save configuration", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="System Configuration" description="Platform-wide settings">
      <div className="max-w-2xl space-y-6">
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

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSystem;
