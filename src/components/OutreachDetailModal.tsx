import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Clock, FileText, Building, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface OutreachRecord {
  id: string;
  channel: string;
  subject: string | null;
  message_body: string;
  sent_at: string | null;
  sent_to: string;
  sent_from: string | null;
  status: string;
  invoice_id: string | null;
  delivery_metadata?: any;
  created_at: string;
  activity_type?: string;
  direction?: string;
  invoices?: {
    invoice_number: string;
    amount: number;
    due_date: string;
  } | null;
}

interface OutreachDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outreach: OutreachRecord | null;
  showInvoiceLink?: boolean;
}

export const OutreachDetailModal = ({ 
  open, 
  onOpenChange, 
  outreach,
  showInvoiceLink = true 
}: OutreachDetailModalProps) => {
  const navigate = useNavigate();

  if (!outreach) return null;

  const isAccountLevel = outreach.activity_type === 'account_level_outreach';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {outreach.channel === 'email' ? (
              <Mail className="h-5 w-5" />
            ) : (
              <MessageSquare className="h-5 w-5" />
            )}
            Outreach Details
            {isAccountLevel && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                Account-Level
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status and Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Channel</Label>
              <p className="font-medium capitalize">{outreach.channel}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    outreach.status === "sent"
                      ? "bg-green-100 text-green-800"
                      : outreach.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {outreach.status}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Sent To</Label>
              <p className="font-medium break-all">{outreach.sent_to}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Sent At</Label>
              <p className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {outreach.sent_at 
                  ? new Date(outreach.sent_at).toLocaleString() 
                  : new Date(outreach.created_at).toLocaleString()}
              </p>
            </div>
            {outreach.sent_from && (
              <div className="col-span-2">
                <Label className="text-sm text-muted-foreground">Sent From</Label>
                <p className="font-medium">{outreach.sent_from}</p>
              </div>
            )}
          </div>

          {/* Linked Invoice */}
          {outreach.invoices && showInvoiceLink && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <Label className="text-sm text-muted-foreground mb-2 block">Linked Invoice</Label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-medium">{outreach.invoices.invoice_number}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium">${outreach.invoices.amount.toLocaleString()}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/invoices/${outreach.invoice_id}`);
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Invoice
                </Button>
              </div>
            </div>
          )}

          {isAccountLevel && !outreach.invoices && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Building className="h-4 w-4" />
                <span className="font-medium">Account Summary Outreach</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                This outreach covered multiple invoices at the account level.
              </p>
            </div>
          )}

          {/* Subject */}
          {outreach.subject && (
            <div>
              <Label className="text-sm text-muted-foreground">Subject</Label>
              <p className="font-medium mt-1 break-words">{outreach.subject}</p>
            </div>
          )}

          {/* Message Body */}
          <div>
            <Label className="text-sm text-muted-foreground">Message</Label>
            <div className="mt-2 p-4 bg-muted rounded-md max-h-64 overflow-y-auto">
              <p className="whitespace-pre-wrap text-sm">{outreach.message_body}</p>
            </div>
          </div>

          {/* Delivery Metadata */}
          {outreach.delivery_metadata && Object.keys(outreach.delivery_metadata).length > 0 && (
            <details className="group">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                Delivery Information
              </summary>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(outreach.delivery_metadata, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
