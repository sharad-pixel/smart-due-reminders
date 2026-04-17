import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserCog, Mail, BellRing, Send } from "lucide-react";

interface SalesRepCardProps {
  debtorId: string;
  debtorName: string;
  initial: {
    sales_rep_user_id: string | null;
    sales_rep_name: string | null;
    sales_rep_email: string | null;
    sales_rep_alerts_enabled: boolean;
  };
  onSaved?: () => void;
}

interface TeamMember {
  user_id: string;
  email: string;
  name: string | null;
}

const NONE_VALUE = "__none__";

export const SalesRepCard = ({ debtorId, debtorName, initial, onSaved }: SalesRepCardProps) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(initial.sales_rep_user_id || NONE_VALUE);
  const [name, setName] = useState(initial.sales_rep_name || "");
  const [email, setEmail] = useState(initial.sales_rep_email || "");
  const [alertsEnabled, setAlertsEnabled] = useState(!!initial.sales_rep_alerts_enabled);
  const [saving, setSaving] = useState(false);
  const [sendingNotice, setSendingNotice] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  async function loadTeamMembers() {
    setLoadingMembers(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine the account_id (owner's account) for this user
      const { data: myMembership } = await supabase
        .from("account_users")
        .select("account_id, is_owner")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("is_owner", { ascending: false })
        .limit(1)
        .maybeSingle();

      const accountId = myMembership?.account_id || user.id;

      const { data: rows, error } = await supabase
        .from("account_users")
        .select("user_id, email")
        .eq("account_id", accountId)
        .eq("status", "active")
        .not("user_id", "is", null);

      if (error) throw error;

      // Try to enrich with profile names
      const userIds = (rows || []).map((r) => r.user_id).filter(Boolean) as string[];
      let nameMap = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);
        (profiles || []).forEach((p) => nameMap.set(p.id, p.name || p.email));
      }

      const list: TeamMember[] = (rows || [])
        .filter((r) => r.user_id && r.email)
        .map((r) => ({
          user_id: r.user_id as string,
          email: r.email as string,
          name: nameMap.get(r.user_id as string) || r.email,
        }));

      setMembers(list);
    } catch (err: any) {
      console.error("Failed to load team members", err);
    } finally {
      setLoadingMembers(false);
    }
  }

  function handleMemberChange(value: string) {
    setSelectedUserId(value);
    if (value !== NONE_VALUE) {
      const m = members.find((x) => x.user_id === value);
      if (m) {
        setName(m.name || "");
        setEmail(m.email);
      }
    }
  }

  function handleClear() {
    setSelectedUserId(NONE_VALUE);
    setName("");
    setEmail("");
    setAlertsEnabled(false);
  }

  async function handleSave() {
    if (alertsEnabled && !email.trim()) {
      toast.error("An email is required to enable rep alerts");
      return;
    }
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast.error("Enter a valid email address");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("debtors")
        .update({
          sales_rep_user_id: selectedUserId === NONE_VALUE ? null : selectedUserId,
          sales_rep_name: name.trim() || null,
          sales_rep_email: email.trim() || null,
          sales_rep_alerts_enabled: alertsEnabled,
        })
        .eq("id", debtorId);

      if (error) throw error;
      toast.success("Internal account owner saved");
      onSaved?.();
    } catch (err: any) {
      console.error("Failed to save sales rep", err);
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Internal Account Owner</CardTitle>
              <CardDescription>
                Optional — assign an internal sales rep for {debtorName} and send them a weekly account summary.
              </CardDescription>
            </div>
          </div>
          {alertsEnabled && (
            <Badge variant="secondary" className="gap-1">
              <BellRing className="h-3 w-3" />
              Weekly alerts on
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Team member</Label>
          <Select value={selectedUserId} onValueChange={handleMemberChange} disabled={loadingMembers}>
            <SelectTrigger>
              <SelectValue placeholder={loadingMembers ? "Loading team…" : "Select a team member or enter manually below"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>— None / manual entry —</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.name} ({m.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Linking a team member auto-fills name and email. You can override below if the rep is external.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rep-name">Rep name</Label>
            <Input
              id="rep-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Morgan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rep-email">Rep email</Label>
            <div className="relative">
              <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="rep-email"
                type="email"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rep@company.com"
              />
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <Label htmlFor="rep-alerts" className="cursor-pointer">
              Send weekly account summary to this rep
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              The rep receives a Monday morning email summarizing this account's outstanding balance and health score, alongside any of their other assigned accounts.
            </p>
          </div>
          <Switch id="rep-alerts" checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {initial.sales_rep_email && (
            <Button
              variant="outline"
              onClick={handleSendNoticeNow}
              disabled={saving || sendingNotice}
              className="mr-auto"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendingNotice ? "Sending…" : "Send Notice to Account Owner Now"}
            </Button>
          )}
          <Button variant="ghost" onClick={handleClear} disabled={saving}>
            Clear
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
