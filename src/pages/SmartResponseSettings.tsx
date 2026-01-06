import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSmartResponseSettings, SmartResponseSettings } from "@/hooks/useSmartResponseSettings";
import { toast } from "sonner";

const TASK_TYPE_CONFIG = [
  { key: "w9_request_action", label: "W9 Request", recommended: "auto_send" },
  { key: "invoice_request_action", label: "Invoice Copy Request", recommended: "auto_send" },
  { key: "promise_to_pay_action", label: "Promise to Pay", recommended: "auto_draft" },
  { key: "payment_plan_request_action", label: "Payment Plan Request", recommended: "auto_draft" },
  { key: "callback_request_action", label: "Callback Request", recommended: "auto_draft" },
  { key: "dispute_action", label: "Dispute", recommended: "manual", warning: true },
  { key: "already_paid_action", label: "Already Paid Claim", recommended: "manual", warning: true },
  { key: "general_inquiry_action", label: "General Inquiry", recommended: "auto_draft" },
];

export default function SmartResponseSettingsPage() {
  const { settings, isLoading, isSaving, saveSettings } = useSmartResponseSettings();
  const [formData, setFormData] = useState<Partial<SmartResponseSettings>>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await saveSettings(formData);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Smart Response Settings</h1>
            <p className="text-muted-foreground">
              Configure AI-generated responses for inbound tasks
            </p>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enable Smart Response</CardTitle>
            <CardDescription>
              When enabled, AI will generate suggested responses for inbound customer tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Switch
                checked={formData.enabled ?? true}
                onCheckedChange={(checked) => handleChange("enabled", checked)}
              />
              <span className="text-sm font-medium">
                {formData.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Company Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Company Resources</CardTitle>
            <CardDescription>
              These links will be included in relevant responses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="w9_url">W9 Document URL</Label>
                <Input
                  id="w9_url"
                  type="url"
                  placeholder="https://company.com/w9.pdf"
                  value={formData.w9_document_url || ""}
                  onChange={(e) => handleChange("w9_document_url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal_url">AR/Payment Portal URL</Label>
                <Input
                  id="portal_url"
                  type="url"
                  placeholder="https://portal.company.com"
                  value={formData.ar_portal_url || ""}
                  onChange={(e) => handleChange("ar_portal_url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_phone">Company Phone</Label>
                <Input
                  id="company_phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.company_phone || ""}
                  onChange={(e) => handleChange("company_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_address">Company Address</Label>
                <Input
                  id="company_address"
                  placeholder="123 Main St, City, ST 12345"
                  value={formData.company_address || ""}
                  onChange={(e) => handleChange("company_address", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Response Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Auto-Response Rules</CardTitle>
            <CardDescription>
              Configure how each task type is handled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {TASK_TYPE_CONFIG.map((config) => (
                <div
                  key={config.key}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{config.label}</span>
                    {config.warning && (
                      <Badge variant="outline" className="text-xs gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Review
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={(formData as any)[config.key] || "manual"}
                      onValueChange={(value) => handleChange(config.key, value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto_send">Auto Send</SelectItem>
                        <SelectItem value="auto_draft">Draft Only</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                    {(formData as any)[config.key] === config.recommended && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-muted rounded-lg text-sm space-y-1">
              <p className="font-medium">Action Options:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• <strong>Auto Send:</strong> AI responds immediately, task auto-completed</li>
                <li>• <strong>Draft Only:</strong> AI drafts response, you review before sending</li>
                <li>• <strong>Manual:</strong> No AI response generated</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Email Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Signature</CardTitle>
            <CardDescription>
              This signature will be appended to all smart responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              placeholder="Best regards,&#10;The Accounts Receivable Team&#10;Acme Corporation"
              value={formData.signature_text || ""}
              onChange={(e) => handleChange("signature_text", e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
