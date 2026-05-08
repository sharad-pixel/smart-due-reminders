import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, UserPlus, Briefcase } from "lucide-react";
import { useAddInternalCollaborator, useRemoveInstanceContact } from "@/hooks/useClmInstance";

export const InternalCollaboratorsPanel = ({
  instanceId, contacts,
}: { instanceId: string; contacts: any[] }) => {
  const internal = contacts.filter((c) => c.is_internal);
  const add = useAddInternalCollaborator(instanceId);
  const remove = useRemoveInstanceContact(instanceId);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("reviewer");

  const handleAdd = async () => {
    if (!name.trim()) return;
    await add.mutateAsync({ name: name.trim(), email: email.trim() || undefined, title: title.trim() || undefined, role });
    setName(""); setEmail(""); setTitle("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> Internal Collaborators</CardTitle>
        <CardDescription>Add internal team members with their title for approval and review</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {internal.length > 0 && (
          <div className="space-y-1">
            {internal.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {c.name} {c.title && <span className="text-xs text-muted-foreground">· {c.title}</span>}
                  </p>
                  {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{c.role}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded border p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold flex items-center gap-1"><UserPlus className="h-3 w-3" /> Add internal collaborator</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Title (e.g. General Counsel)" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex items-center gap-2">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approver">Approver</SelectItem>
                <SelectItem value="reviewer">Reviewer</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="signer">Signer</SelectItem>
                <SelectItem value="cc">CC</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={!name.trim() || add.isPending} className="ml-auto">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
