import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Mail, Phone as PhoneIcon, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  outreach_enabled: boolean;
}

interface ContactCardProps {
  contact: Contact;
  onToggleOutreach: (contactId: string, enabled: boolean) => void;
  onDelete: (contactId: string, isPrimary: boolean) => void;
  onUpdate: () => void;
}

export const ContactCard = ({ contact, onToggleOutreach, onDelete, onUpdate }: ContactCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    name: contact.name,
    title: contact.title || "",
    email: contact.email || "",
    phone: contact.phone || "",
    outreach_enabled: contact.outreach_enabled,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editData.name || !editData.email) {
      toast.error("Name and email are required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("debtor_contacts")
        .update({
          name: editData.name,
          title: editData.title || null,
          email: editData.email,
          phone: editData.phone || null,
          outreach_enabled: editData.outreach_enabled,
        })
        .eq("id", contact.id);

      if (error) throw error;
      toast.success("Contact updated");
      setIsEditOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to update contact");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="border rounded-lg p-3 space-y-2 hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{contact.name}</span>
            {contact.is_primary && (
              <Badge variant="secondary" className="text-xs">Primary</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                setEditData({
                  name: contact.name,
                  title: contact.title || "",
                  email: contact.email || "",
                  phone: contact.phone || "",
                  outreach_enabled: contact.outreach_enabled,
                });
                setIsEditOpen(true);
              }}
            >
              <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Outreach</span>
              <Switch
                checked={contact.outreach_enabled}
                onCheckedChange={(checked) => onToggleOutreach(contact.id, checked)}
              />
            </div>
            {!contact.is_primary && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onDelete(contact.id, contact.is_primary)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {contact.title && (
          <p className="text-sm text-muted-foreground">{contact.title}</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          {contact.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <span>{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-1">
              <PhoneIcon className="h-3 w-3 text-muted-foreground" />
              <span>{contact.phone}</span>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-contact-name">Name *</Label>
                <Input
                  id="edit-contact-name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contact-title">Title</Label>
                <Input
                  id="edit-contact-title"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  placeholder="e.g., CFO, AP Manager"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-contact-email">Email *</Label>
                <Input
                  id="edit-contact-email"
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  placeholder="email@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contact-phone">Phone</Label>
                <Input
                  id="edit-contact-phone"
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-contact-outreach"
                checked={editData.outreach_enabled}
                onCheckedChange={(checked) => setEditData({ ...editData, outreach_enabled: checked })}
              />
              <Label htmlFor="edit-contact-outreach">Enable outreach for this contact</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
