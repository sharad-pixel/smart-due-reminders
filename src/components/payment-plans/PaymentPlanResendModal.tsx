import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Send, Mail, User } from "lucide-react";
import { PaymentPlan, usePaymentPlans, getPaymentPlanARUrl } from "@/hooks/usePaymentPlans";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface DebtorContact {
  id: string;
  name: string;
  email: string | null;
  is_primary: boolean;
  outreach_enabled: boolean;
}

interface PaymentPlanResendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PaymentPlan;
}

export function PaymentPlanResendModal({ open, onOpenChange, plan }: PaymentPlanResendModalProps) {
  const { resendPlanLink } = usePaymentPlans(plan.debtor_id);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  // Fetch debtor contacts
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ["debtor-contacts", plan.debtor_id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtor_contacts")
        .select("id, name, email, is_primary, outreach_enabled")
        .eq("debtor_id", plan.debtor_id)
        .order("is_primary", { ascending: false });
      
      if (error) throw error;
      return data as DebtorContact[];
    },
  });

  // Pre-select contacts with outreach enabled
  useEffect(() => {
    if (contacts && open) {
      const enabledEmails = contacts
        .filter(c => c.outreach_enabled && c.email)
        .map(c => c.email as string);
      setSelectedEmails(enabledEmails);
    }
  }, [contacts, open]);

  const handleToggleEmail = (email: string) => {
    if (selectedEmails.includes(email)) {
      setSelectedEmails(selectedEmails.filter(e => e !== email));
    } else {
      setSelectedEmails([...selectedEmails, email]);
    }
  };

  const handleSend = async () => {
    if (selectedEmails.length === 0) return;
    
    await resendPlanLink.mutateAsync({
      planId: plan.id,
      emails: selectedEmails,
    });
    
    onOpenChange(false);
  };

  const contactsWithEmail = contacts?.filter(c => c.email) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Resend Payment Plan Link
          </DialogTitle>
          <DialogDescription>
            Send a reminder with the payment plan link to selected contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan Summary */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <p className="font-medium text-sm">{plan.plan_name || "Payment Plan"}</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Total: {new Intl.NumberFormat("en-US", { style: "currency", currency: plan.currency || "USD", minimumFractionDigits: 2 }).format(plan.total_amount)}</p>
              <p>{plan.number_of_installments} {plan.frequency} payments</p>
              <p>Started: {format(new Date(plan.start_date), "MMM d, yyyy")}</p>
            </div>
          </div>

          {/* Contact Selection */}
          <div className="space-y-2">
            <Label>Select Recipients</Label>
            {loadingContacts ? (
              <p className="text-sm text-muted-foreground">Loading contacts...</p>
            ) : contactsWithEmail.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contacts with email addresses found for this account.
              </p>
            ) : (
              <div className="border rounded-lg divide-y">
                {contactsWithEmail.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={contact.id}
                      checked={selectedEmails.includes(contact.email!)}
                      onCheckedChange={() => handleToggleEmail(contact.email!)}
                    />
                    <label htmlFor={contact.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{contact.name}</span>
                        {contact.is_primary && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Link */}
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Link to be sent:</p>
            <p className="font-mono bg-muted p-2 rounded truncate">
              {getPaymentPlanARUrl(plan.public_token)}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend}
            disabled={selectedEmails.length === 0 || resendPlanLink.isPending}
          >
            {resendPlanLink.isPending ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                Send to {selectedEmails.length} Contact{selectedEmails.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
