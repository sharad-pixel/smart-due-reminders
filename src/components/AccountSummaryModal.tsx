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
import { Mail, FileText, Link as LinkIcon, X, Plus, Loader2, Brain, Sparkles, CheckCircle2, AlertTriangle, Target } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: string;
}

interface Task {
  id: string;
  summary: string;
  task_type: string;
  status: string;
  priority: string;
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

interface Intelligence {
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
  riskScore: number;
  executiveSummary: string;
  collectionStrategy: string;
  communicationSentiment: string;
}

const AccountSummaryModal = ({ open, onOpenChange, debtor }: AccountSummaryModalProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachedLinks, setAttachedLinks] = useState<AttachedLink[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showAddLink, setShowAddLink] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);

  useEffect(() => {
    if (open) {
      fetchAccountData();
    }
  }, [open, debtor]);

  const fetchAccountData = async () => {
    setLoading(true);
    setAiGenerated(false);
    setIntelligence(null);
    try {
      // Fetch open invoices and tasks in parallel
      const [invoicesRes, tasksRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*")
          .eq("debtor_id", debtor.id)
          .in("status", ["Open", "InPaymentPlan"])
          .order("due_date", { ascending: true }),
        supabase
          .from("collection_tasks")
          .select("id, summary, task_type, status, priority")
          .eq("debtor_id", debtor.id)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false })
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (tasksRes.error) throw tasksRes.error;
      
      setInvoices(invoicesRes.data || []);
      setOpenTasks(tasksRes.data || []);
      
      // Clear previous content
      setSubject("");
      setMessage("");
      setAttachedLinks([]);
      setAttachedDocs([]);
    } catch (error) {
      console.error("Error fetching account data:", error);
      toast.error("Failed to load account data");
    } finally {
      setLoading(false);
    }
  };

  const generateAIOutreach = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-account-summary", {
        body: {
          debtorId: debtor.id,
          generateOnly: true,
          invoices,
          openTasks,
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("AI rate limit reached. Please try again in a moment.");
        } else if (data.error.includes("credits")) {
          toast.error("AI credits exhausted. Please add credits to continue.");
        } else {
          toast.error(data.error);
        }
        return;
      }

      setSubject(data.subject || `Account Outreach - ${debtor.company_name}`);
      setMessage(data.message || "");
      setAiGenerated(true);
      
      // Capture intelligence report if available
      if (data.intelligence) {
        setIntelligence(data.intelligence);
      }
      
      toast.success("AI outreach generated based on Collection Intelligence Report");
    } catch (error: any) {
      console.error("Error generating AI outreach:", error);
      toast.error(error.message || "Failed to generate AI outreach");
    } finally {
      setGenerating(false);
    }
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
      toast.error("Please generate or fill in subject and message");
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
          openTasks,
        },
      });

      if (error) throw error;

      toast.success("AI outreach sent successfully");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending outreach:", error);
      toast.error(error.message || "Failed to send outreach");
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
            <Brain className="h-5 w-5 text-primary" />
            AI Outreach - {debtor.company_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Generate intelligent outreach based on all open activity for this account
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Activity Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Open Invoices</p>
                      <p className="text-2xl font-bold">{invoices.length}</p>
                    </div>
                    <Badge variant="secondary" className="font-semibold">
                      ${getTotalAmount().toLocaleString()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Open Tasks</p>
                      <p className="text-2xl font-bold">{openTasks.length}</p>
                    </div>
                    {openTasks.filter(t => t.priority === "high").length > 0 && (
                      <Badge variant="destructive">
                        {openTasks.filter(t => t.priority === "high").length} High Priority
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Generate Button */}
            {!message && (
              <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold">Generate AI Outreach</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI will analyze {invoices.length} invoices and {openTasks.length} tasks to craft personalized outreach
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2 italic">
                      More account activity = more accurate outreach
                    </p>
                  </div>
                  <Button onClick={generateAIOutreach} disabled={generating} className="gap-2">
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing Activity...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4" />
                        Generate Outreach
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Email Details - Only show after AI generation or if message exists */}
            {message && (
              <div className="space-y-4">
                {aiGenerated && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>AI-generated outreach based on Collection Intelligence Report. You can edit before sending.</span>
                  </div>
                )}
                
                {/* Intelligence Report Summary */}
                {intelligence && (
                  <Card className={`border-2 ${
                    intelligence.riskLevel === "low" ? "border-green-200 bg-green-50/50 dark:bg-green-950/20" :
                    intelligence.riskLevel === "medium" ? "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20" :
                    intelligence.riskLevel === "high" ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20" :
                    intelligence.riskLevel === "critical" ? "border-red-200 bg-red-50/50 dark:bg-red-950/20" :
                    "border-gray-200 bg-gray-50/50 dark:bg-gray-900/20"
                  }`}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">Intelligence-Driven Tone</span>
                        </div>
                        <Badge variant={
                          intelligence.riskLevel === "low" ? "default" :
                          intelligence.riskLevel === "medium" ? "secondary" :
                          "destructive"
                        } className="gap-1">
                          {intelligence.riskLevel === "high" || intelligence.riskLevel === "critical" ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : null}
                          {intelligence.riskLevel.charAt(0).toUpperCase() + intelligence.riskLevel.slice(1)} Risk
                          <span className="opacity-70">({intelligence.riskScore}/100)</span>
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">{intelligence.executiveSummary}</p>
                      
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 bg-background/50 rounded">
                          <span className="font-medium text-muted-foreground">Sentiment:</span>
                          <p className="mt-0.5">{intelligence.communicationSentiment}</p>
                        </div>
                        <div className="p-2 bg-background/50 rounded">
                          <span className="font-medium text-muted-foreground">Strategy:</span>
                          <p className="mt-0.5">{intelligence.collectionStrategy}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
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

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={generateAIOutreach} 
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Brain className="h-4 w-4 mr-2" />
                    )}
                    Regenerate
                  </Button>
                </div>
              </div>
            )}

            {/* Open Invoices Summary */}
            {message && invoices.length > 0 && (
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
                </CardContent>
              </Card>
            )}

            {/* Open Tasks Summary */}
            {message && openTasks.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    Open Tasks ({openTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {openTasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-sm">{task.summary}</span>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">{task.task_type}</Badge>
                          <Badge 
                            variant={task.priority === "high" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {openTasks.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{openTasks.length - 5} more tasks
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attached Links */}
            {message && (
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
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || loading || !message}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Outreach
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountSummaryModal;
