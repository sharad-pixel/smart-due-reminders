import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, FileText, Link as LinkIcon, X, Plus, Loader2 } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: string;
}

interface Debtor {
  id: string;
  name: string;
  email: string;
  company_name: string;
  current_balance: number | null;
}

interface AccountSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtor: Debtor;
}

interface AttachedLink {
  id: string;
  label: string;
  url: string;
}

interface AttachedDoc {
  id: string;
  name: string;
  url: string;
}

const AccountSummaryModal = ({ open, onOpenChange, debtor }: AccountSummaryModalProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachedLinks, setAttachedLinks] = useState<AttachedLink[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showAddLink, setShowAddLink] = useState(false);

  useEffect(() => {
    if (open) {
      fetchOpenInvoices();
      setDefaultContent();
    }
  }, [open, debtor]);

  const fetchOpenInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("debtor_id", debtor.id)
        .in("status", ["Open", "InPaymentPlan"])
        .order("due_date", { ascending: true });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const setDefaultContent = () => {
    const totalBalance = debtor.current_balance || 0;
    setSubject(`Account Summary for ${debtor.company_name}`);
    setMessage(
      `Dear ${debtor.name},\n\n` +
      `We are writing to provide you with a summary of your account with us.\n\n` +
      `Current Outstanding Balance: $${totalBalance.toLocaleString()}\n\n` +
      `Below is a detailed list of all open invoices on your account. ` +
      `We kindly request your attention to these outstanding items.\n\n` +
      `If you have any questions or would like to discuss payment arrangements, ` +
      `please don't hesitate to reach out to us.\n\n` +
      `Thank you for your business.\n\n` +
      `Best regards,\nYour Collections Team`
    );
    setAttachedLinks([]);
    setAttachedDocs([]);
  };

  const handleAddLink = () => {
    if (!newLinkLabel || !newLinkUrl) {
      toast.error("Please provide both label and URL");
      return;
    }
    setAttachedLinks([...attachedLinks, { id: Date.now().toString(), label: newLinkLabel, url: newLinkUrl }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
    setShowAddLink(false);
  };

  const handleRemoveLink = (id: string) => {
    setAttachedLinks(attachedLinks.filter(link => link.id !== id));
  };

  const handleSend = async () => {
    if (!subject || !message) {
      toast.error("Please fill in subject and message");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-account-summary", {
        body: {
          debtorId: debtor.id,
          subject,
          message,
          invoices,
          attachedLinks,
          attachedDocs,
        },
      });

      if (error) throw error;

      toast.success("Account summary sent successfully");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending summary:", error);
      toast.error(error.message || "Failed to send account summary");
    } finally {
      setSending(false);
    }
  };

  const getTotalAmount = () => {
    return invoices.reduce((sum, inv) => sum + inv.amount, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Generate Account Summary Outreach
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Email Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="to">To</Label>
                <Input id="to" value={debtor.email} disabled className="bg-muted" />
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Email message"
                  className="min-h-[200px]"
                />
              </div>
            </div>

            {/* Open Invoices Summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Open Invoices ({invoices.length})
                  </h3>
                  <Badge variant="secondary" className="font-semibold">
                    Total: ${getTotalAmount().toLocaleString()}
                  </Badge>
                </div>

                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No open invoices found
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium font-mono text-xs">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(invoice.issue_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(invoice.due_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            ${invoice.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={invoice.status === "Open" ? "default" : "secondary"}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Attached Links */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Attached Links
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddLink(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                </div>

                {showAddLink && (
                  <div className="mb-4 p-4 border rounded-lg space-y-3">
                    <Input
                      placeholder="Link label (e.g., Payment Portal)"
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                    />
                    <Input
                      placeholder="URL (e.g., https://...)"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddLink}>
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddLink(false);
                          setNewLinkLabel("");
                          setNewLinkUrl("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {attachedLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No links attached
                  </p>
                ) : (
                  <div className="space-y-2">
                    {attachedLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{link.label}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-md">
                            {link.url}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLink(link.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || loading}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Summary
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountSummaryModal;
