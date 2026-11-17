import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function AdminProgramHubToggle({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    supabase.from("user_feature_overrides").select("value")
      .eq("user_id", userId).eq("feature_key", "program_hub").maybeSingle()
      .then(({ data }) => { setEnabled(data?.value === true); setBusy(false); });
  }, [userId]);

  const toggle = async (value: boolean) => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-update-user", {
      body: value
        ? { userId, action: "set_feature_override", updates: { feature_key: "program_hub", value: true } }
        : { userId, action: "remove_feature_override", updates: { feature_key: "program_hub" } },
    });
    setBusy(false);
    if (error) { toast.error("Could not update Program Hub access"); return; }
    setEnabled(value);
    toast.success(value ? "Program Hub enabled" : "Program Hub disabled");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FolderKanban className="h-5 w-5" />Program Hub</CardTitle>
        <CardDescription>Standalone program management module. Off by default.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="program-hub-toggle">Allow this user to use Program Hub</Label>
        <Switch id="program-hub-toggle" checked={enabled} disabled={busy} onCheckedChange={toggle} />
      </CardContent>
    </Card>
  );
}
