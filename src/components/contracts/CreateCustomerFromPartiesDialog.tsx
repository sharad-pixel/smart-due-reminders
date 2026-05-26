import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAccountId } from "@/hooks/useAccountId";

interface PartyField {
  field_key: string;
  field_value: string | null;
}

interface Props {
  importId: string;
  partyFields: PartyField[];
  disabled?: boolean;
}

const pick = (rows: PartyField[], keys: string[]): string => {
  for (const k of keys) {
    const r = rows.find((x) => x.field_key.toLowerCase() === k);
    if (r?.field_value) return r.field_value;
  }
  // fuzzy
  for (const k of keys) {
    const r = rows.find((x) => x.field_key.toLowerCase().includes(k));
    if (r?.field_value) return r.field_value;
  }
  return "";
};

export function CreateCustomerFromPartiesDialog({ importId, partyFields, disabled }: Props) {
  const qc = useQueryClient();
  const { accountId } = useAccountId();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const prefill = useMemo(
    () => ({
      company_name: pick(partyFields, ["customer_name", "customer_legal_name", "client_name", "buyer", "counterparty"]),
      contact_name: pick(partyFields, ["billing_contact_name", "primary_contact", "contact_name", "signatory_name"]),
      email: pick(partyFields, ["billing_email", "customer_email", "contact_email", "email"]),
      phone: pick(partyFields, ["billing_phone", "customer_phone", "phone"]),
      address: pick(partyFields, ["billing_address", "customer_address", "address"]),
    }),
    [partyFields],
  );

  const [form, setForm] = useState(prefill);

  useEffect(() => {
    if (open) setForm(prefill);
  }, [open, prefill]);

  const create = async () => {
    if (!form.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!accountId) {
      toast.error("Account not ready, please retry");
      return;
    }
    setSaving(true);
    try {
      const referenceId = `RCPLY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const { data: debtor, error } = await supabase
        .from("debtors")
        .insert([{
          company_name: form.company_name.trim(),
          name: form.company_name.trim(),
          reference_id: referenceId,
          type: "B2B" as const,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          user_id: accountId,
        }])
        .select("id")
        .single();
      if (error) throw error;

      if (form.contact_name.trim() || form.email.trim()) {
        await supabase.from("debtor_contacts").insert([{
          debtor_id: debtor.id,
          user_id: accountId,
          name: form.contact_name.trim() || form.company_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          is_primary: true,
          outreach_enabled: true,
        }]);
      }

      const { error: updErr } = await supabase
        .from("live_contract_imports")
        .update({ debtor_id: debtor.id })
        .eq("id", importId);
      if (updErr) throw updErr;

      toast.success("Customer created from contract parties and linked");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
      await qc.invalidateQueries({ queryKey: ["lc-imports"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Sparkles className="h-4 w-4 mr-1" />
        Create customer from parties
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Create customer from contract parties
            </DialogTitle>
            <DialogDescription>
              We pre-filled this from the extracted Customer & Parties fields. Edit anything before creating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cfp-co">Company name *</Label>
              <Input
                id="cfp-co"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Acme Corp"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cfp-contact">Primary contact</Label>
                <Input
                  id="cfp-contact"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cfp-email">Email</Label>
                <Input
                  id="cfp-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ar@acme.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfp-phone">Phone</Label>
              <Input
                id="cfp-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1-555-0100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfp-address">Address</Label>
              <Textarea
                id="cfp-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={create} disabled={saving || !form.company_name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create &amp; link customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CreateCustomerFromPartiesDialog;
