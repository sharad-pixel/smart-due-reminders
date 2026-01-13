import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar, Settings, Users, Zap, AlertCircle, Brain, Sparkles, Send, Eye, CheckCircle, Volume2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { ToneGauge } from "@/components/ToneGauge";
import { toneIntensityModifiers } from "@/lib/personaTones";

interface AccountOutreachSettingsProps {
  debtorId: string;
  debtorName: string;
  initialSettings?: {
    account_outreach_enabled: boolean;
    outreach_frequency: string;
    outreach_frequency_days: number;
    next_outreach_date: string | null;
    last_outreach_date: string | null;
    auto_send_outreach?: boolean;
    account_outreach_persona?: string | null;
    account_outreach_tone?: number | null;
  };
  onSettingsChange?: () => void;
}

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "biweekly", label: "Bi-weekly", days: 14 },
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "custom", label: "Custom", days: null },
];

const PERSONA_OPTIONS = [
  { value: "sam", label: "Sam", tone: "Warm & Friendly", description: "Gentle reminders, relationship-focused" },
  { value: "james", label: "James", tone: "Direct & Professional", description: "Clear, businesslike communication" },
  { value: "katy", label: "Katy", tone: "Serious & Assertive", description: "Urgent, escalation warnings" },
  { value: "troy", label: "Troy", tone: "Firm & Formal", description: "Final notice, consequential" },
  { value: "jimmy", label: "Jimmy", tone: "Legal & Uncompromising", description: "Pre-litigation pressure" },
  { value: "rocco", label: "Rocco", tone: "Authoritative & Final", description: "Last internal resort" },
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
  const [nextDate, setNextDate] = useState(initialSettings?.next_outreach_date || "");
  const [autoSend, setAutoSend] = useState(initialSettings?.auto_send_outreach || false);
  const [selectedPersona, setSelectedPersona] = useState(initialSettings?.account_outreach_persona || "sam");
  const [toneIntensity, setToneIntensity] = useState(initialSettings?.account_outreach_tone || 3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setEnabled(initialSettings.account_outreach_enabled || false);
      setFrequency(initialSettings.outreach_frequency || "weekly");
      setCustomDays(initialSettings.outreach_frequency_days || 7);
      setNextDate(initialSettings.next_outreach_date || "");
      setAutoSend(initialSettings.auto_send_outreach || false);
      setSelectedPersona(initialSettings.account_outreach_persona || "sam");
      setToneIntensity(initialSettings.account_outreach_tone || 3);
    }
  }, [initialSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const frequencyDays = frequency === "custom" 
        ? customDays 
        : FREQUENCY_OPTIONS.find(f => f.value === frequency)?.days || 7;

      // Use the selected next_outreach_date as the cadence start date
      // If no date is set and enabling, default to today + frequency days
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
          auto_send_outreach: autoSend,
          account_outreach_persona: selectedPersona,
          account_outreach_tone: toneIntensity,
        })
        .eq("id", debtorId);

      if (error) throw error;

      const modeMessage = autoSend 
        ? "Outreach will be sent automatically on the scheduled date."
        : "Outreach drafts will be created for your review before sending.";

      toast.success(enabled 
        ? `Account-level outreach enabled. ${modeMessage}` 
        : "Account-level outreach disabled. Individual invoice workflows will resume."
      );
      onSettingsChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerOutreach = async (generateOnly: boolean = false) => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("send-account-summary", {
        body: { debtorId, generateOnly }
      });

      if (error) throw error;

      // Update last outreach date and calculate next based on the frequency from the current next_outreach_date
      const frequencyDays = frequency === "custom" 
        ? customDays 
        : FREQUENCY_OPTIONS.find(f => f.value === frequency)?.days || 7;
      
      // Calculate next outreach date from current next_outreach_date (cadence start) + frequency
      const baseDate = nextDate ? new Date(nextDate) : new Date();
      const nextOutreachDate = new Date(baseDate);
      nextOutreachDate.setDate(nextOutreachDate.getDate() + frequencyDays);

      await supabase
        .from("debtors")
        .update({
          last_outreach_date: new Date().toISOString().split('T')[0],
          next_outreach_date: nextOutreachDate.toISOString().split('T')[0],
        })
        .eq("id", debtorId);

      if (generateOnly) {
        toast.success("AI draft generated for review");
      } else {
        toast.success("Account outreach sent successfully");
      }
      onSettingsChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to process outreach");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Collection Intelligence Outreach
            </CardTitle>
            <CardDescription>
              AI-generated account summaries based on invoice activity, communication history & risk analysis
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

            {/* Outreach Mode Selection */}
            <div className="bg-muted/30 border rounded-lg p-4 space-y-4">
              <Label className="text-base font-medium">Outreach Mode</Label>
              <RadioGroup 
                value={autoSend ? "auto" : "review"} 
                onValueChange={(value) => setAutoSend(value === "auto")}
                className="grid gap-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="review" id="review-mode" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="review-mode" className="flex items-center gap-2 cursor-pointer font-medium">
                      <Eye className="h-4 w-4 text-blue-600" />
                      Review Before Sending
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI generates drafts for your approval. You review and send manually.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="auto" id="auto-mode" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="auto-mode" className="flex items-center gap-2 cursor-pointer font-medium">
                      <Send className="h-4 w-4 text-green-600" />
                      Auto-Send
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI generates and sends outreach automatically on the scheduled date.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Tone & Persona Selection */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">Outreach Tone & Style</span>
              </div>
              
              {/* Persona Selection */}
              <div className="space-y-3">
                <Label>Select AI Agent Persona</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PERSONA_OPTIONS.map((persona) => {
                    const config = personaConfig[persona.value];
                    const isSelected = selectedPersona === persona.value;
                    return (
                      <button
                        key={persona.value}
                        type="button"
                        onClick={() => setSelectedPersona(persona.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20" 
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <PersonaAvatar persona={persona.value} size="xs" />
                          <span className="font-medium text-sm">{persona.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{persona.tone}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {PERSONA_OPTIONS.find(p => p.value === selectedPersona)?.description}
                </p>
              </div>

              {/* Tone Intensity */}
              <div className="space-y-3 pt-2 border-t">
                <Label>Tone Intensity Adjustment</Label>
                <ToneGauge 
                  value={toneIntensity} 
                  onChange={setToneIntensity}
                />
                <p className="text-xs text-muted-foreground">
                  Adjust the intensity level for the selected persona. Use softer tones for accounts not yet overdue.
                </p>
              </div>
            </div>

            {/* AI Intelligence Features */}
            <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">AI-Powered Intelligence</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-7">
                <li>• Analyzes all open invoices and aging buckets</li>
                <li>• Reviews prior communication history and sentiment</li>
                <li>• Considers payment patterns and risk scores</li>
                <li>• References outstanding tasks (disputes, payment plans)</li>
              </ul>
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
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Cadence Start Date
                  </Label>
                  <Input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-muted-foreground">
                    Outreach will begin on this date and repeat based on frequency.
                  </p>
                </div>

                {initialSettings?.last_outreach_date && (
                  <div className="text-sm text-muted-foreground">
                    Last outreach: {new Date(initialSettings.last_outreach_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Current Settings Summary */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Configuration</Label>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                    {/* Selected Persona */}
                    <div className="flex items-center gap-2">
                      <PersonaAvatar persona={selectedPersona} size="sm" />
                      <div>
                        <p className="font-medium text-sm">
                          {PERSONA_OPTIONS.find(p => p.value === selectedPersona)?.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {PERSONA_OPTIONS.find(p => p.value === selectedPersona)?.tone}
                        </p>
                      </div>
                    </div>
                    
                    {/* Tone Intensity */}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Tone Intensity: </span>
                      <span className="font-medium">{toneIntensityModifiers[toneIntensity]?.label || "Standard"}</span>
                    </div>
                  </div>
                </div>

                {/* Current Mode Summary */}
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 text-sm">
                    {autoSend ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700">Auto-Send Enabled</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-700">Review Mode Enabled</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {autoSend 
                      ? "Outreach will be sent automatically without manual approval."
                      : "Drafts will be created for review in Scheduled Outreach."}
                  </p>
                </div>
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
              <>
                <Button 
                  variant="outline" 
                  onClick={() => handleTriggerOutreach(true)}
                  disabled={saving}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Generate Draft
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleTriggerOutreach(false)}
                  disabled={saving}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Generate & Send Now
                </Button>
              </>
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