import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, CalendarClock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AutoSyncSchedulerProps {
  integrationType: 'stripe' | 'quickbooks';
}

const TIME_OPTIONS = [
  { value: '00:00', label: '12:00 AM' },
  { value: '01:00', label: '1:00 AM' },
  { value: '02:00', label: '2:00 AM' },
  { value: '03:00', label: '3:00 AM' },
  { value: '04:00', label: '4:00 AM' },
  { value: '05:00', label: '5:00 AM' },
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '22:00', label: '10:00 PM' },
  { value: '23:00', label: '11:00 PM' },
];

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

// Try to detect user's timezone
function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_OPTIONS.find(t => t.value === tz)) return tz;
    // Map common variations
    if (tz.includes('America')) {
      if (tz.includes('New_York') || tz.includes('Detroit')) return 'America/New_York';
      if (tz.includes('Chicago')) return 'America/Chicago';
      if (tz.includes('Denver') || tz.includes('Phoenix')) return 'America/Denver';
      if (tz.includes('Los_Angeles')) return 'America/Los_Angeles';
    }
    return 'America/Los_Angeles';
  } catch {
    return 'America/Los_Angeles';
  }
}

export const AutoSyncScheduler = ({ integrationType }: AutoSyncSchedulerProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [syncTime, setSyncTime] = useState('06:00');
  const [timezone, setTimezone] = useState(detectTimezone());
  const [lastAutoSync, setLastAutoSync] = useState<string | null>(null);
  const [nextSyncDue, setNextSyncDue] = useState<string | null>(null);
  const [settingId, setSettingId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [integrationType]);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      const { data, error } = await supabase
        .from('integration_sync_settings')
        .select('id, auto_sync_enabled, sync_time, sync_timezone, last_auto_sync_at, next_sync_due_at')
        .eq('user_id', accountId)
        .eq('integration_type', integrationType)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingId(data.id);
        setEnabled(data.auto_sync_enabled || false);
        setSyncTime(data.sync_time || '06:00');
        setTimezone(data.sync_timezone || detectTimezone());
        setLastAutoSync(data.last_auto_sync_at);
        setNextSyncDue(data.next_sync_due_at);
      }
    } catch (err) {
      console.error('Error loading sync settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateNextSyncTimeLocal = (time: string, tz: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Create a rough next sync time (this is approximate for display)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    
    // Simple: set tomorrow at the target hour in UTC-ish 
    const nextSync = new Date(tomorrow);
    nextSync.setHours(hours, minutes, 0, 0);
    return nextSync;
  };

  const saveSettings = async (newEnabled: boolean, newTime: string, newTimezone: string) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      // Calculate next_sync_due_at 
      let nextSyncDueAt: string | null = null;
      if (newEnabled) {
        const nextSync = calculateNextSyncTimeLocal(newTime, newTimezone);
        nextSyncDueAt = nextSync.toISOString();
      }

      const updateData = {
        auto_sync_enabled: newEnabled,
        sync_time: newTime,
        sync_timezone: newTimezone,
        sync_frequency: newEnabled ? 'daily' : 'manual',
        next_sync_due_at: nextSyncDueAt,
      };

      if (settingId) {
        const { error } = await supabase
          .from('integration_sync_settings')
          .update(updateData)
          .eq('id', settingId);
        if (error) throw error;
      } else {
        // Create new settings row
        const { data: inserted, error } = await supabase
          .from('integration_sync_settings')
          .insert({
            user_id: accountId,
            integration_type: integrationType,
            ...updateData,
          })
          .select('id')
          .single();
        if (error) throw error;
        if (inserted) setSettingId(inserted.id);
      }

      setNextSyncDue(nextSyncDueAt);
      toast.success(newEnabled 
        ? `Auto-sync scheduled daily at ${TIME_OPTIONS.find(t => t.value === newTime)?.label || newTime}` 
        : 'Auto-sync disabled'
      );
    } catch (err: any) {
      toast.error('Failed to save sync schedule: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setEnabled(checked);
    await saveSettings(checked, syncTime, timezone);
  };

  const handleTimeChange = async (value: string) => {
    setSyncTime(value);
    if (enabled) {
      await saveSettings(true, value, timezone);
    }
  };

  const handleTimezoneChange = async (value: string) => {
    setTimezone(value);
    if (enabled) {
      await saveSettings(true, syncTime, value);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 border rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading schedule...</span>
      </div>
    );
  }

  const timeLabel = TIME_OPTIONS.find(t => t.value === syncTime)?.label || syncTime;
  const tzLabel = TIMEZONE_OPTIONS.find(t => t.value === timezone)?.label || timezone;

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <div>
            <Label htmlFor={`auto-sync-${integrationType}`} className="text-sm font-medium">
              Daily Auto-Sync
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically sync {integrationType === 'stripe' ? 'Stripe' : 'QuickBooks'} data daily
            </p>
          </div>
        </div>
        <Switch
          id={`auto-sync-${integrationType}`}
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>

      {enabled && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Sync Time</Label>
              <Select value={syncTime} onValueChange={handleTimeChange} disabled={saving}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Timezone</Label>
              <Select value={timezone} onValueChange={handleTimezoneChange} disabled={saving}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>
              Next sync: daily at {timeLabel} {tzLabel}
              {lastAutoSync && (
                <> · Last: {format(new Date(lastAutoSync), 'MMM d, h:mm a')}</>
              )}
            </span>
          </div>

          {saving && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
