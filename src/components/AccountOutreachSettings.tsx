import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Settings, Users, Zap, AlertCircle } from "lucide-react";
import { personaConfig } from "@/lib/personaConfig";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface AccountOutreachSettingsProps {
  debtorId: string;
  debtorName: string;
  initialSettings?: {
    account_outreach_enabled: boolean;
    outreach_frequency: string;
    outreach_frequency_days: number;
    next_outreach_date: string | null;
    last_outreach_date: string | null;
    account_outreach_persona: string;
  };
  onSettingsChange?: () => void;
}

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "biweekly", label: "Bi-weekly", days: 14 },
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "custom", label: "Custom", days: null },
];

export const AccountOutreachSettings = ({
  debtorId,
  debtorName,
  initialSettings,
  onSettingsChange,
}: AccountOutreachSettingsProps) => {
  const [enabled, setEnabled] = useState(initialSettings?.account_outreach_enabled || false);
  const [frequency, setFrequency] = useState(initialSettings?.outreach_frequency || "weekly");
  const [customDays, setCustomDays] = useState(initialSettings?.outreach_frequency_days || 7);
  const [selectedPersona, setSelectedPersona] = useState(initialSettings?.account_outreach_persona || "sam");
  const [nextDate, setNextDate] = useState(initialSettings?.next_outreach_date || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setEnabled(initialSettings.account_outreach_enabled || false);
      setFrequency(initialSettings.outreach_frequency || "weekly");
      setCustomDays(initialSettings.outreach_frequency_days || 7);
      setSelectedPersona(initialSettings.account_outreach_persona || "sam");
      setNextDate(initialSettings.next_outreach_date || "");
    }
  }, [initialSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const frequencyDays = frequency === "custom" 
        ? customDays 
        : FREQUENCY_OPTIONS.find(f => f.value === frequency)?.days || 7;

      // Calculate next outreach date if enabling and no date set
      let calculatedNextDate = nextDate;
      if (enabled && !nextDate) {
        const next = new Date();
        next.setDate(next.getDate() + frequencyDays);
        calculatedNextDate = next.toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from("debtors")
        .update({
          account_outreach_enabled: enabled,
          outreach_frequency: frequency,
          outreach_frequency_days: frequencyDays,
          next_outreach_date: enabled ? calculatedNextDate : null,
          account_outreach_persona: selectedPersona,
        })
        .eq("id", debtorId);

      if (error) throw error;

      toast.success(enabled 
        ? "Account-level outreach enabled. Individual invoice workflows will be bypassed." 
        : "Account-level outreach disabled. Individual invoice workflows will resume."
      );
      onSettingsChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerOutreach = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("send-account-summary", {
        body: { debtorId, generateOnly: false }
      });

      if (error) throw error;

      // Update last outreach date and calculate next
      const frequencyDays = frequency === "custom" 
        ? customDays 
        : FREQUENCY_OPTIONS.find(f => f.value === frequency)?.days || 7;
      
      const nextOutreachDate = new Date();
      nextOutreachDate.setDate(nextOutreachDate.getDate() + frequencyDays);

      await supabase
        .from("debtors")
        .update({
          last_outreach_date: new Date().toISOString().split('T')[0],
          next_outreach_date: nextOutreachDate.toISOString().split('T')[0],
        })
        .eq("id", debtorId);

      toast.success("Account outreach sent successfully");
      onSettingsChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to send outreach");
    } finally {
      setSaving(false);
    }
  };

  const persona = personaConfig[selectedPersona];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Account Outreach Settings
            </CardTitle>
            <CardDescription>
              Manage outreach at the account level instead of individual invoices
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="account-outreach-toggle" className="text-sm">
              Account-Level Outreach
            </Label>
            <Switch
              id="account-outreach-toggle"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {enabled && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Individual invoice workflows will be bypassed</p>
                <p className="text-amber-700">When account-level outreach is enabled, AI persona-based workflows for individual invoices will be excluded. All outreach will be managed at the account level on your schedule.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Frequency Settings */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Outreach Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {frequency === "custom" && (
                  <div className="space-y-2">
                    <Label>Days Between Outreach</Label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={customDays}
                      onChange={(e) => setCustomDays(parseInt(e.target.value) || 7)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Next Scheduled Outreach</Label>
                  <Input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {initialSettings?.last_outreach_date && (
                  <div className="text-sm text-muted-foreground">
                    Last outreach: {new Date(initialSettings.last_outreach_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Persona Selection */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Outreach Persona</Label>
                  <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select persona" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(personaConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span>{config.name}</span>
                            <span className="text-xs text-muted-foreground">({config.tone})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {persona && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Avatar className="h-10 w-10 border-2" style={{ borderColor: persona.color }}>
                      <AvatarImage src={persona.avatar} alt={persona.name} />
                      <AvatarFallback>{persona.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{persona.name}</p>
                      <p className="text-xs text-muted-foreground">{persona.description}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {enabled ? (
              <span className="flex items-center gap-1 text-green-600">
                <Users className="h-4 w-4" />
                Account-level outreach active
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Individual invoice workflows active
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {enabled && (
              <Button 
                variant="outline" 
                onClick={handleTriggerOutreach}
                disabled={saving}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Send Now
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
