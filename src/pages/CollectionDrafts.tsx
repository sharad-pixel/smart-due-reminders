import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, MessageSquare, Send, Edit2, Trash2, Eye } from "lucide-react";

interface Draft {
  id: string;
  invoice_id: string;
  subject: string | null;
  message_body: string;
  channel: "email" | "sms";
  status: "pending_approval" | "approved" | "discarded";
  created_at: string;
  step_number: number;
  invoices: {
    invoice_number: string;
    amount: number;
    due_date: string;
    debtors: {
      name: string;
      email: string;
      phone: string | null;
    };
  };
}

const CollectionDrafts = () => {
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending_approval" | "approved" | "discarded">("pending_approval");

  useEffect(() => {
    fetchDrafts();
  }, [filterStatus]);

  const fetchDrafts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("ai_drafts")
        .select(`
          *,
          invoices (
            invoice_number,
            amount,
            due_date,
            debtors (
              name,
              email,
              phone
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDrafts(data || []);
    } catch (error: any) {
      toast.error("Failed to load drafts");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openDraft = (draft: Draft) => {
    setSelectedDraft(draft);
    setEditedSubject(draft.subject || "");
    setEditedBody(draft.message_body);
    setEditMode(false);
  };

  const sendDraft = async () => {
    if (!selectedDraft) return;

    setSending(true);
    try {
      // Update draft if edited
      if (editMode) {
        const { error: updateError } = await supabase
          .from("ai_drafts")
          .update({
            subject: editedSubject,
            message_body: editedBody,
          })
          .eq("id", selectedDraft.id);

        if (updateError) throw updateError;
      }

      // Send the draft
      const { error: sendError } = await supabase.functions.invoke("send-ai-draft", {
        body: { draft_id: selectedDraft.id },
      });

      if (sendError) throw sendError;

      toast.success("Message sent successfully!");
      setSelectedDraft(null);
      fetchDrafts();
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const discardDraft = async (draftId: string) => {
    try {
      const { error } = await supabase
        .from("ai_drafts")
        .update({ status: "discarded" })
        .eq("id", draftId);

      if (error) throw error;

      toast.success("Draft discarded");
      setSelectedDraft(null);
      fetchDrafts();
    } catch (error: any) {
      toast.error("Failed to discard draft");
    }
  };

  const getDaysPastDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-primary">Collection Drafts</h1>
            <p className="text-muted-foreground mt-2">
              Review and send AI-generated collection messages
            </p>
          </div>
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drafts</SelectItem>
              <SelectItem value="pending_approval">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="discarded">Discarded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {drafts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No drafts found. Configure AI workflows to start generating collection messages.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {drafts.map((draft) => {
              const daysPastDue = getDaysPastDue(draft.invoices.due_date);
              
              return (
                <Card key={draft.id} className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-6" onClick={() => openDraft(draft)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg">
                            {draft.invoices.debtors.name}
                          </h3>
                          <Badge variant="outline">
                            Invoice #{draft.invoices.invoice_number}
                          </Badge>
                          <Badge variant={daysPastDue > 60 ? "destructive" : "secondary"}>
                            {daysPastDue} days past due
                          </Badge>
                          {draft.channel === "email" ? (
                            <Badge variant="secondary">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              SMS
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Amount: ${draft.invoices.amount.toFixed(2)} • Step {draft.step_number}
                        </p>
                        {draft.subject && (
                          <p className="text-sm mt-2 font-medium">
                            Subject: {draft.subject}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {draft.message_body}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            draft.status === "pending_approval"
                              ? "default"
                              : draft.status === "approved"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {draft.status === "pending_approval"
                            ? "Pending Review"
                            : draft.status === "approved"
                            ? "Approved"
                            : "Discarded"}
                        </Badge>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Draft Review Dialog */}
      <Dialog open={!!selectedDraft} onOpenChange={() => setSelectedDraft(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDraft?.invoices.debtors.name} - Invoice #
              {selectedDraft?.invoices.invoice_number}
            </DialogTitle>
            <DialogDescription>
              Review and edit the AI-generated message before sending
            </DialogDescription>
          </DialogHeader>

          {selectedDraft && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Recipient</Label>
                  <p className="font-medium">{selectedDraft.invoices.debtors.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact</Label>
                  <p className="font-medium">
                    {selectedDraft.channel === "email"
                      ? selectedDraft.invoices.debtors.email
                      : selectedDraft.invoices.debtors.phone || "No phone number"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount Due</Label>
                  <p className="font-medium">${selectedDraft.invoices.amount.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Days Past Due</Label>
                  <p className="font-medium">{getDaysPastDue(selectedDraft.invoices.due_date)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Message Preview</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  {editMode ? "Cancel Edit" : "Edit Message"}
                </Button>
              </div>

              {selectedDraft.channel === "email" && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    disabled={!editMode}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  disabled={!editMode}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="space-x-2">
            <Button
              variant="outline"
              onClick={() => selectedDraft && discardDraft(selectedDraft.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Discard
            </Button>
            <Button onClick={sendDraft} disabled={sending}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default CollectionDrafts;
