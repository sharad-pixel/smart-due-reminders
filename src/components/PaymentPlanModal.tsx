import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format, addWeeks, addMonths } from "date-fns";
import { Calendar, Send, Copy, Check, DollarSign, FileText, Mail } from "lucide-react";
import { usePaymentPlans, getPaymentPlanARUrl, CreatePaymentPlanData } from "@/hooks/usePaymentPlans";
import { getPlatformFromAddress, getDebtorReplyTo } from "@/lib/emailSending";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  amount_outstanding?: number;
  currency?: string | null;
  status: string;
  due_date: string;
}

interface DebtorContact {
  id: string;
  name: string;
  email: string | null;
  is_primary: boolean;
  outreach_enabled: boolean;
}

interface PaymentPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtorId: string;
  debtorName: string;
  invoices: Invoice[];
  contacts: DebtorContact[];
  onPlanCreated?: () => void;
}

export function PaymentPlanModal({
  open,
  onOpenChange,
  debtorId,
  debtorName,
  invoices,
  contacts,
  onPlanCreated,
}: PaymentPlanModalProps) {
  const { createPaymentPlan, updatePlanStatus } = usePaymentPlans(debtorId);
  
  const [step, setStep] = useState<"configure" | "preview" | "send">("configure");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [numberOfInstallments, setNumberOfInstallments] = useState(3);
  const [frequency, setFrequency] = useState<"weekly" | "bi-weekly" | "monthly">("monthly");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [planName, setPlanName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Calculate total from selected invoices
  const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.includes(inv.id));
  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + (inv.amount_outstanding || inv.amount), 0);
  const planCurrency = selectedInvoices[0]?.currency || 'USD';
  const cs = (amt: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: planCurrency, minimumFractionDigits: 2 }).format(amt);

  const installmentAmount = totalAmount / numberOfInstallments;

  // Calculate preview installments
  const previewInstallments = Array.from({ length: numberOfInstallments }, (_, i) => {
    const baseDate = new Date(startDate);
    let dueDate: Date;
    switch (frequency) {
      case "weekly":
        dueDate = addWeeks(baseDate, i);
        break;
      case "bi-weekly":
        dueDate = addWeeks(baseDate, i * 2);
        break;
      case "monthly":
      default:
        dueDate = addMonths(baseDate, i);
        break;
    }
    const regularAmount = Number((totalAmount / numberOfInstallments).toFixed(2));
    const regularTotal = regularAmount * (numberOfInstallments - 1);
    const lastAmount = Number((totalAmount - regularTotal).toFixed(2));
    
    return {
      number: i + 1,
      dueDate,
      amount: i === numberOfInstallments - 1 ? lastAmount : regularAmount,
    };
  });

  // Initialize email content
  useEffect(() => {
    if (step === "send" && publicToken) {
      const arUrl = getPaymentPlanARUrl(publicToken);
      const selectedInvoiceNumbers = invoices
        .filter((inv) => selectedInvoiceIds.includes(inv.id))
        .map((inv) => inv.invoice_number)
        .join(", ");

      setEmailSubject(`Payment Plan Proposal for ${debtorName}`);
      setEmailBody(
        `Dear ${debtorName},\n\n` +
        `We have prepared a payment plan proposal to help you manage your outstanding balance.\n\n` +
        `**Payment Plan Details:**\n` +
        `- Total Amount: ${cs(totalAmount)}\n` +
        `- Number of Installments: ${numberOfInstallments}\n` +
        `- Payment Frequency: ${frequency.replace("-", " ")}\n` +
        `- First Payment Due: ${format(new Date(startDate), "MMMM d, yyyy")}\n\n` +
        `**Invoices Included:** ${selectedInvoiceNumbers}\n\n` +
        `To review the full payment schedule and accept this plan, please visit your AR Dashboard:\n` +
        `${arUrl}\n\n` +
        `If you have any questions or would like to discuss alternative arrangements, please reply to this email.\n\n` +
        `Best regards`
      );

      // Pre-select outreach-enabled contacts
      const enabledContacts = contacts.filter((c) => c.outreach_enabled && c.email);
      setSelectedContactIds(enabledContacts.map((c) => c.id));
    }
  }, [step, publicToken, debtorName, totalAmount, numberOfInstallments, frequency, startDate, contacts, invoices, selectedInvoiceIds]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep("configure");
      setSelectedInvoiceIds([]);
      setNumberOfInstallments(3);
      setFrequency("monthly");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setPlanName("");
      setNotes("");
      setSelectedContactIds([]);
      setCreatedPlanId(null);
      setPublicToken(null);
    }
  }, [open]);

  const handleCreatePlan = async () => {
    if (selectedInvoiceIds.length === 0) {
      toast.error("Please select at least one invoice");
      return;
    }
    if (numberOfInstallments < 2) {
      toast.error("Please select at least 2 installments");
      return;
    }

    try {
      const planData: CreatePaymentPlanData = {
        debtorId,
        totalAmount,
        numberOfInstallments,
        frequency,
        startDate: new Date(startDate),
        planName: planName || undefined,
        invoiceIds: selectedInvoiceIds,
        notes: notes || undefined,
        currency: planCurrency,
      };

      const plan = await createPaymentPlan.mutateAsync(planData);
      setCreatedPlanId(plan.id);
      setPublicToken(plan.public_token);
      setStep("send");
    } catch (error) {
      console.error("Error creating payment plan:", error);
    }
  };

  const handleSendOutreach = async () => {
    if (selectedContactIds.length === 0) {
      toast.error("Please select at least one contact to send to");
      return;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Please enter email subject and body");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get selected contact emails
      const selectedEmails = contacts
        .filter((c) => selectedContactIds.includes(c.id) && c.email)
        .map((c) => c.email as string);

      if (selectedEmails.length === 0) {
        toast.error("No valid email addresses found for selected contacts");
        setSending(false);
        return;
      }

      // Get branding settings for from email
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("from_name, from_email, business_name")
        .eq("user_id", user.id)
        .single();

      const fromAddress = getPlatformFromAddress();
      const replyTo = getDebtorReplyTo(debtorId);

      // Convert markdown-style formatting to HTML
      const htmlBody = emailBody
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");

      // Send email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-email", {
        body: {
          to: selectedEmails,
          from: fromAddress,
          reply_to: replyTo,
          subject: emailSubject,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px;">${htmlBody}</div>`,
          text: emailBody,
        },
      });

      if (emailError) throw emailError;

      // Update plan status to proposed
      if (createdPlanId) {
        await updatePlanStatus.mutateAsync({ planId: createdPlanId, status: "proposed" });
      }

      // Log the outreach activity
      await supabase.from("collection_activities").insert({
        user_id: user.id,
        debtor_id: debtorId,
        activity_type: "payment_plan_proposal",
        channel: "email",
        direction: "outbound",
        subject: emailSubject,
        message_body: emailBody,
        sent_at: new Date().toISOString(),
        metadata: {
          payment_plan_id: createdPlanId,
          sent_to: selectedEmails,
          from_email: fromAddress,
        },
      });

      toast.success(`Payment plan sent to ${selectedEmails.length} contact(s)`);
      onPlanCreated?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending payment plan:", error);
      toast.error(error.message || "Failed to send payment plan");
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = () => {
    if (publicToken) {
      navigator.clipboard.writeText(getPaymentPlanARUrl(publicToken));
      setCopiedLink(true);
      toast.success("Payment plan link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const openInvoices = invoices.filter((inv) => 
    inv.status === "Open" || inv.status === "InPaymentPlan" || inv.status === "PartiallyPaid"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {step === "configure" && "Create Payment Plan"}
            {step === "preview" && "Review Payment Schedule"}
            {step === "send" && "Send Payment Plan to Contact"}
          </DialogTitle>
          <DialogDescription>
            {step === "configure" && "Configure the payment terms for this account"}
            {step === "preview" && "Review the installment schedule before creating"}
            {step === "send" && "Send the payment plan proposal to the contact with AR dashboard link"}
          </DialogDescription>
        </DialogHeader>

        {step === "configure" && (
          <div className="space-y-6">
            {/* Invoice Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Select Invoices to Include</Label>
              {openInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open invoices available</p>
              ) : (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {openInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={invoice.id}
                        checked={selectedInvoiceIds.includes(invoice.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedInvoiceIds([...selectedInvoiceIds, invoice.id]);
                          } else {
                            setSelectedInvoiceIds(selectedInvoiceIds.filter((id) => id !== invoice.id));
                          }
                        }}
                      />
                      <label htmlFor={invoice.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{invoice.invoice_number}</span>
                          <span className="font-medium">
                            {cs(invoice.amount_outstanding || invoice.amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}</span>
                          <Badge variant="secondary" className="text-xs">{invoice.status}</Badge>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {selectedInvoiceIds.length > 0 && (
                <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg">
                  <span className="text-sm font-medium">Total Selected:</span>
                  <span className="text-lg font-bold">
                    {cs(totalAmount)}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Terms */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="installments">Number of Installments</Label>
                <Select
                  value={numberOfInstallments.toString()}
                  onValueChange={(value) => setNumberOfInstallments(parseInt(value))}
                >
                  <SelectTrigger id="installments">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 9, 12].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} payments
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Payment Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">First Payment Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan Name (optional)</Label>
                <Input
                  id="plan-name"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder={`Payment Plan - ${format(new Date(startDate), "MMM yyyy")}`}
                />
              </div>
            </div>

            {selectedInvoiceIds.length > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Payment per installment:</span>
                  <span className="font-semibold">
                    ~{cs(installmentAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Payment frequency:</span>
                  <span className="font-semibold capitalize">{frequency.replace("-", " ")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Plan duration:</span>
                  <span className="font-semibold">
                    {format(new Date(startDate), "MMM d")} - {format(previewInstallments[previewInstallments.length - 1]?.dueDate || new Date(), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this payment plan..."
                rows={2}
              />
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payment Schedule Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewInstallments.map((inst) => (
                      <TableRow key={inst.number}>
                        <TableCell className="font-medium">{inst.number}</TableCell>
                        <TableCell>{format(inst.dueDate, "MMMM d, yyyy")}</TableCell>
                        <TableCell className="text-right font-mono">
                          {cs(inst.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-between items-center pt-4 border-t mt-4">
                  <span className="font-medium">Total:</span>
                  <span className="text-lg font-bold">
                    {cs(totalAmount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "send" && (
          <div className="space-y-6">
            {/* AR Dashboard Link */}
            {publicToken && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Payment Plan AR Dashboard Link</Label>
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    {copiedLink ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copiedLink ? "Copied" : "Copy Link"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground break-all font-mono">
                  {getPaymentPlanARUrl(publicToken)}
                </p>
              </div>
            )}

            {/* Contact Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Select Recipients</Label>
              {contacts.filter((c) => c.email).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts with email addresses found. Add a contact first.
                </p>
              ) : (
                <div className="border rounded-lg">
                  {contacts
                    .filter((c) => c.email)
                    .map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`contact-${contact.id}`}
                          checked={selectedContactIds.includes(contact.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedContactIds([...selectedContactIds, contact.id]);
                            } else {
                              setSelectedContactIds(selectedContactIds.filter((id) => id !== contact.id));
                            }
                          }}
                        />
                        <label htmlFor={`contact-${contact.id}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contact.name}</span>
                            {contact.is_primary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">{contact.email}</span>
                        </label>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Email Content */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-subject">Email Subject</Label>
                <Input
                  id="email-subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-body">Email Body</Label>
                <Textarea
                  id="email-body"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use **text** for bold formatting. The AR dashboard link is included automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "configure" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={selectedInvoiceIds.length === 0}
              >
                Preview Schedule
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("configure")}>
                Back
              </Button>
              <Button onClick={handleCreatePlan} disabled={createPaymentPlan.isPending}>
                {createPaymentPlan.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </>
          )}
          {step === "send" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Save & Close
              </Button>
              <Button
                onClick={handleSendOutreach}
                disabled={sending || selectedContactIds.length === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Sending..." : "Send to Contact"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
