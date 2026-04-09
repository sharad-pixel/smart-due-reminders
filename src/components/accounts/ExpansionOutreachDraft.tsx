import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Pencil, Copy, Check, Loader2, UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";

interface DebtorContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  outreach_enabled: boolean;
}

interface ExpansionOutreachDraftProps {
  debtorId: string;
  subject: string;
  body: string;
  onSubjectChange: (val: string) => void;
  onBodyChange: (val: string) => void;
  onRegenerate: () => void;
  regenerateLoading: boolean;
  onClose: () => void;
}

export function ExpansionOutreachDraft({
  debtorId,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onRegenerate,
  regenerateLoading,
  onClose,
}: ExpansionOutreachDraftProps) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState<DebtorContact[]>([]);
  const [selectedContactEmails, setSelectedContactEmails] = useState<string[]>([]);
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);

  useEffect(() => {
    async function fetchContacts() {
      setLoadingContacts(true);
      const { data } = await supabase
        .from("debtor_contacts")
        .select("id, name, email, phone, is_primary, outreach_enabled")
        .eq("debtor_id", debtorId)
        .order("is_primary", { ascending: false });

      if (data) {
        setContacts(data);
        // Auto-select primary / outreach-enabled contacts
        const autoSelected = data
          .filter((c) => c.email && (c.is_primary || c.outreach_enabled))
          .map((c) => c.email!);
        setSelectedContactEmails(autoSelected);
      }
      setLoadingContacts(false);
    }
    fetchContacts();
  }, [debtorId]);

  const toggleContact = (email: string) => {
    setSelectedContactEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const addEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (additionalEmails.includes(trimmed) || selectedContactEmails.includes(trimmed)) {
      toast.error("Email already added");
      return;
    }
    setAdditionalEmails((prev) => [...prev, trimmed]);
    setNewEmail("");
  };

  const removeAdditionalEmail = (email: string) => {
    setAdditionalEmails((prev) => prev.filter((e) => e !== email));
  };

  const allRecipients = [...selectedContactEmails, ...additionalEmails];

  const handleCopy = () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Draft copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    if (allRecipients.length === 0) {
      toast.error("Please select or add at least one recipient");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-ai-draft", {
        body: {
          debtor_id: debtorId,
          subject,
          message_body: body,
          channel: "email",
          context: "expansion_outreach",
          recipient_email: allRecipients[0],
          cc_emails: allRecipients.length > 1 ? allRecipients.slice(1) : undefined,
        },
      });
      if (error) throw error;
      toast.success("Expansion outreach sent successfully");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to send outreach");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 border border-border/60 rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Expansion Outreach Draft
        </h4>
        <Badge variant="outline" className="text-[10px]">Editable</Badge>
      </div>

      {/* Recipients from debtor contacts */}
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Recipients
        </Label>
        {loadingContacts ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading contacts...
          </div>
        ) : contacts.length > 0 ? (
          <div className="space-y-1.5">
            {contacts.filter((c) => c.email).map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedContactEmails.includes(contact.email!)}
                  onCheckedChange={() => toggleContact(contact.email!)}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">
                    {contact.name || contact.email}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {contact.email}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {contact.is_primary && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">Primary</Badge>
                  )}
                  {contact.outreach_enabled && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">Outreach</Badge>
                  )}
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">No contacts found for this account.</p>
        )}

        {/* Additional emails */}
        {additionalEmails.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {additionalEmails.map((email) => (
              <Badge key={email} variant="secondary" className="text-[10px] gap-1 pr-1">
                {email}
                <button onClick={() => removeAdditionalEmail(email)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add new email */}
        <div className="flex items-center gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
            placeholder="Add another email address..."
            className="text-xs h-8 flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addEmail} className="h-8 px-2">
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Subject</Label>
        <Input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Email subject..."
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Message Body</Label>
        <Textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Email body..."
          className="min-h-[200px] text-sm leading-relaxed"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSend} disabled={sending || allRecipients.length === 0} className="flex-1">
          {sending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send to {allRecipients.length} recipient{allRecipients.length !== 1 ? "s" : ""}
        </Button>
        <Button variant="outline" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={regenerateLoading}>
          {regenerateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerate"}
        </Button>
      </div>
    </div>
  );
}
