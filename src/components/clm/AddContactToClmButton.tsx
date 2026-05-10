import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSignature, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";

interface Props {
  contactId: string;
  debtorId: string;
}

export const AddContactToClmButton = ({ contactId, debtorId }: Props) => {
  const [open, setOpen] = useState(false);
  const [instanceId, setInstanceId] = useState<string>("");
  const [role, setRole] = useState("editor_approver");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { isActive } = useClmEntitlement();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["clm-instances-for-contact"],
    enabled: open && isActive,
    queryFn: async () => {
      const { data } = await supabase
        .from("clm_template_instances")
        .select("id, name, status")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: alreadyLinked = [] } = useQuery({
    queryKey: ["clm-contact-links", contactId],
    enabled: open && isActive,
    queryFn: async () => {
      const { data } = await (supabase.from("clm_instance_contacts" as any) as any)
        .select("instance_id")
        .eq("contact_id", contactId);
      return (data ?? []).map((d: any) => d.instance_id);
    },
  });

  if (!isActive) return null;

  const handleAdd = async () => {
    if (!instanceId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("clm_instance_contacts" as any) as any).insert({
      instance_id: instanceId, contact_id: contactId, debtor_id: debtorId, role, added_by: user!.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact added as collaborator");
    qc.invalidateQueries({ queryKey: ["clm-contact-links", contactId] });
    qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
    setInstanceId("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" title="Add to contract workspace">
          <FileSignature className="h-3.5 w-3.5 mr-1" /> CLM
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Add to contract workspace</p>
            <p className="text-xs text-muted-foreground">Make this contact a collaborator on a CLM workspace.</p>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : instances.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active workspaces. Create one from a template.</p>
          ) : (
            <>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose workspace…" /></SelectTrigger>
                <SelectContent>
                  {instances.map((i: any) => {
                    const linked = alreadyLinked.includes(i.id);
                    return (
                      <SelectItem key={i.id} value={i.id} disabled={linked}>
                        <span className="flex items-center gap-2">
                          {linked && <Check className="h-3 w-3 text-primary" />}
                          {i.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor_approver">Editor / Approver</SelectItem>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="signer">Signer (post-finalization)</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" onClick={handleAdd} disabled={!instanceId || saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add as collaborator"}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
