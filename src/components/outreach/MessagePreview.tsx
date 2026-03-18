import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mail, MessageSquare, Sparkles, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MessagePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepId: string | null;
  channel: "email" | "sms";
  subject?: string;
  body: string;
  agingBucket?: string;
  dayOffset?: number;
  onContentUpdated?: () => void;
}

interface SampleInvoiceData {
  debtor_name: string;
  invoice_number: string;
  amount: string;
  due_date: string;
  company_name: string;
}

const MessagePreview = ({ open, onOpenChange, stepId, channel, subject, body, agingBucket, dayOffset, onContentUpdated }: MessagePreviewProps) => {
  const [sampleData, setSampleData] = useState<SampleInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedSubject, setEditedSubject] = useState(subject || "");
  const [editedBody, setEditedBody] = useState(body);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSampleInvoiceData();
      setEditedSubject(subject || "");
      setEditedBody(body);
      setIsEditing(false);
    }
  }, [open, subject, body]);

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

  const handleEnhanceWithAI = async () => {
    if (!stepId || !agingBucket || dayOffset === undefined) {
      toast.error("Missing required information for AI generation");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-workflow-content', {
        body: { 
          stepId, 
          agingBucket, 
          tone: 'neutral',
          channel,
          dayOffset 
        }
      });

      if (error) throw error;

      if (data?.content) {
        if (channel === 'email' && data.content.subject) {
          setEditedSubject(data.content.subject);
        }
        setEditedBody(data.content.body);
        toast.success("Content enhanced with AI");
      }
    } catch (error) {
      console.error('Error enhancing with AI:', error);
      toast.error("Failed to enhance content with AI");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!stepId) return;

    setIsSaving(true);
    try {
      const updateData: any = {
        body_template: editedBody,
      };

      if (channel === 'email') {
        updateData.subject_template = editedSubject;
      } else if (channel === 'sms') {
        updateData.sms_template = editedBody;
      }

      const { error } = await supabase
        .from('collection_workflow_steps')
        .update(updateData)
        .eq('id', stepId);

      if (error) throw error;

      toast.success("Changes saved successfully");
      setIsEditing(false);
      onContentUpdated?.();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const renderMessage = (text: string) => {
    if (!sampleData) return text;

    return text
      .replace(/\{\{debtor_name\}\}/g, sampleData.debtor_name)
      .replace(/\{\{customer_name\}\}/g, sampleData.debtor_name)
      .replace(/\{\{invoice_number\}\}/g, sampleData.invoice_number)
      .replace(/\{\{amount\}\}/g, sampleData.amount)
      .replace(/\{\{amount_outstanding\}\}/g, sampleData.amount)
      .replace(/\{\{due_date\}\}/g, sampleData.due_date)
      .replace(/\{\{company_name\}\}/g, sampleData.company_name)
      .replace(/\{\{business_name\}\}/g, "Your Business")
      .replace(/\{\{payment_link\}\}/g, "https://pay.example.com")
      .replace(/\{\{invoice_link\}\}/g, "#")
      .replace(/\{\{integration_url\}\}/g, "#")
      .replace(/\{\{days_past_due\}\}/g, "0")
      .replace(/\{\{currency\}\}/g, "USD");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              {channel === "email" ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
              <span>Message Preview</span>
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="flex-1 sm:flex-none tap-target"
              >
                {isEditing ? "Cancel" : "Edit"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnhanceWithAI}
                disabled={isGenerating}
                className="flex-1 sm:flex-none tap-target"
              >
                <Sparkles className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{isGenerating ? "Enhancing..." : "Enhance with AI"}</span>
                <span className="sm:hidden">{isGenerating ? "..." : "AI"}</span>
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 sm:p-4 bg-muted rounded-lg">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                Preview with sample data:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div><strong>Customer:</strong> {sampleData?.debtor_name}</div>
                <div><strong>Company:</strong> {sampleData?.company_name}</div>
                <div><strong>Invoice:</strong> {sampleData?.invoice_number}</div>
                <div><strong>Amount:</strong> {sampleData?.amount}</div>
                <div className="sm:col-span-2"><strong>Due Date:</strong> {sampleData?.due_date}</div>
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
                    {isEditing ? (
                      <Input
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        placeholder="Email subject"
                        className="font-medium"
                      />
                    ) : (
                      <div className="p-3 bg-accent rounded border">
                        <p className="font-medium">{editedSubject ? renderMessage(editedSubject) : "No subject"}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Body</p>
                      {isEditing ? (
                        <Textarea
                          value={editedBody}
                          onChange={(e) => setEditedBody(e.target.value)}
                          placeholder="Email body"
                          className="min-h-[200px]"
                        />
                      ) : (
                        <div className="p-4 bg-background rounded border">
                          <div className="whitespace-pre-wrap text-sm">
                            {renderMessage(editedBody)}
                          </div>
                        </div>
                      )}
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
                    {isEditing ? (
                      <Textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        placeholder="SMS message"
                        className="min-h-[120px]"
                      />
                    ) : (
                      <div className="bg-primary text-primary-foreground p-4 rounded-2xl rounded-bl-none">
                        <p className="text-sm whitespace-pre-wrap">
                          {renderMessage(editedBody)}
                        </p>
                        <div className="text-xs opacity-70 mt-2 text-right">
                          {renderMessage(editedBody).length} characters
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {isEditing && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="w-full sm:w-auto tap-target"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full sm:w-auto tap-target"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MessagePreview;
