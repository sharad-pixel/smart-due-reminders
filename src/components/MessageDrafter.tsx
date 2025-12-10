import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  is_primary: boolean;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  debtor_id: string;
  debtors: {
    company_name: string;
    debtor_contacts: Contact[];
  };
}

const MessageDrafter = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [messageType, setMessageType] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          debtors(
            company_name,
            debtor_contacts(id, name, email, is_primary)
          )
        `)
        .in("status", ["Open", "InPaymentPlan"])
        .order("due_date");

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      toast.error("Failed to load invoices");
    }
  };

  const getPrimaryContactName = (invoice: Invoice): string => {
    const contacts = invoice.debtors?.debtor_contacts || [];
    const primaryContact = contacts.find(c => c.is_primary);
    return primaryContact?.name || contacts[0]?.name || invoice.debtors?.company_name || "Customer";
  };

  const generateAIDraft = () => {
    const invoice = invoices.find((inv) => inv.id === selectedInvoice);
    if (!invoice) return;

    const contactName = getPrimaryContactName(invoice);
    const daysOverdue = Math.floor(
      (new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (messageType === "email") {
      setSubject(`Payment Reminder - Invoice ${invoice.invoice_number}`);
      setContent(
        `Dear ${contactName},\n\n` +
        `I hope this message finds you well. I'm reaching out regarding invoice ${invoice.invoice_number} ` +
        `for $${invoice.amount.toLocaleString()}, which was due on ${new Date(invoice.due_date).toLocaleDateString()}.\n\n` +
        (daysOverdue > 0
          ? `This invoice is now ${daysOverdue} days overdue. `
          : `This invoice is due soon. `) +
        `To keep your account in good standing, please arrange payment at your earliest convenience.\n\n` +
        `If payment has already been made, please disregard this message. If you have any questions or need to discuss ` +
        `payment arrangements, don't hesitate to reach out.\n\n` +
        `Thank you for your prompt attention to this matter.\n\n` +
        `Best regards`
      );
    } else {
      setContent(
        `Hi ${contactName}, this is a friendly reminder that invoice ${invoice.invoice_number} ` +
        `($${invoice.amount.toLocaleString()}) ` +
        (daysOverdue > 0
          ? `is ${daysOverdue} days overdue. `
          : `is due on ${new Date(invoice.due_date).toLocaleDateString()}. `) +
        `Please arrange payment soon. Reply if you have questions. Thanks!`
      );
    }
  };

  const handleSave = async () => {
    if (!selectedInvoice || !content) {
      toast.error("Please select an invoice and enter message content");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const invoice = invoices.find((inv) => inv.id === selectedInvoice);
      if (!invoice) throw new Error("Invoice not found");

      const { error } = await supabase.from("outreach_logs").insert([
        {
          invoice_id: selectedInvoice,
          debtor_id: invoice.debtor_id,
          channel: messageType,
          subject: messageType === "email" ? subject : null,
          message_body: content,
          sent_to: messageType === "email" ? invoice.debtors.company_name : "",
          status: "queued",
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      toast.success("Message saved as draft");
      setSelectedInvoice("");
      setSubject("");
      setContent("");
    } catch (error: any) {
      toast.error(error.message || "Failed to save message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Message Drafter</CardTitle>
        <CardDescription>
          Generate AI-powered collection messages for your invoices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Invoice</Label>
          <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
            <SelectTrigger>
              <SelectValue placeholder="Select an invoice" />
            </SelectTrigger>
            <SelectContent>
              {invoices.map((invoice) => (
                <SelectItem key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - {invoice.debtors.company_name} - $
                  {invoice.amount.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Message Type</Label>
          <Select
            value={messageType}
            onValueChange={(value) => setMessageType(value as "email" | "sms")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={generateAIDraft}
          disabled={!selectedInvoice}
          className="w-full"
          variant="outline"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generate AI Draft
        </Button>

        {messageType === "email" && (
          <div className="space-y-2">
            <Label>Subject</Label>
            <Textarea
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              rows={1}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Message Content</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Your message content..."
            rows={messageType === "email" ? 12 : 5}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? "Saving..." : "Save Draft"}
          </Button>
          <Button variant="outline" disabled className="flex-1">
            Review & Send
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Note: Messages are saved as drafts. You'll review and approve before sending through your
          own email/SMS systems.
        </p>
      </CardContent>
    </Card>
  );
};

export default MessageDrafter;
