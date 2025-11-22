import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MessagePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepId: string | null;
  channel: "email" | "sms";
  subject?: string;
  body: string;
}

interface SampleInvoiceData {
  debtor_name: string;
  invoice_number: string;
  amount: string;
  due_date: string;
  company_name: string;
}

const MessagePreview = ({ open, onOpenChange, stepId, channel, subject, body }: MessagePreviewProps) => {
  const [sampleData, setSampleData] = useState<SampleInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchSampleInvoiceData();
    }
  }, [open]);

  const fetchSampleInvoiceData = async () => {
    try {
      const { data: invoices } = await supabase
        .from("invoices")
        .select(`
          invoice_number,
          amount,
          due_date,
          debtors!inner(
            name,
            company_name
          )
        `)
        .in('status', ['Open', 'InPaymentPlan'])
        .limit(1)
        .single();

      if (invoices) {
        setSampleData({
          debtor_name: invoices.debtors.name,
          invoice_number: invoices.invoice_number,
          amount: `$${Number(invoices.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          due_date: new Date(invoices.due_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          company_name: invoices.debtors.company_name,
        });
      } else {
        // Fallback sample data
        setSampleData({
          debtor_name: "John Smith",
          invoice_number: "INV-12345",
          amount: "$2,500.00",
          due_date: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          company_name: "Acme Corporation",
        });
      }
    } catch (error) {
      console.error("Error fetching sample data:", error);
      // Use fallback data on error
      setSampleData({
        debtor_name: "John Smith",
        invoice_number: "INV-12345",
        amount: "$2,500.00",
        due_date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        company_name: "Acme Corporation",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = (text: string) => {
    if (!sampleData) return text;

    return text
      .replace(/\{\{debtor_name\}\}/g, sampleData.debtor_name)
      .replace(/\{\{invoice_number\}\}/g, sampleData.invoice_number)
      .replace(/\{\{amount\}\}/g, sampleData.amount)
      .replace(/\{\{due_date\}\}/g, sampleData.due_date)
      .replace(/\{\{company_name\}\}/g, sampleData.company_name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {channel === "email" ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            Message Preview
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Preview with sample data:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><strong>Customer:</strong> {sampleData?.debtor_name}</div>
                <div><strong>Company:</strong> {sampleData?.company_name}</div>
                <div><strong>Invoice:</strong> {sampleData?.invoice_number}</div>
                <div><strong>Amount:</strong> {sampleData?.amount}</div>
                <div className="col-span-2"><strong>Due Date:</strong> {sampleData?.due_date}</div>
              </div>
            </div>

            {channel === "email" ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Subject</CardTitle>
                    <Badge variant="outline">Email</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-accent rounded border">
                      <p className="font-medium">{subject ? renderMessage(subject) : "No subject"}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Body</p>
                      <div className="p-4 bg-background rounded border">
                        <div className="whitespace-pre-wrap text-sm">
                          {renderMessage(body)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">SMS Message</CardTitle>
                    <Badge variant="outline">SMS</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-w-sm mx-auto">
                    <div className="bg-primary text-primary-foreground p-4 rounded-2xl rounded-bl-none">
                      <p className="text-sm whitespace-pre-wrap">
                        {renderMessage(body)}
                      </p>
                      <div className="text-xs opacity-70 mt-2 text-right">
                        {renderMessage(body).length} characters
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MessagePreview;
