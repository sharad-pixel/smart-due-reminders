import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDropzone } from "react-dropzone";
import { Upload, Plus, Send, Trash2, Mail, Users, FileSpreadsheet, Sparkles, Loader2, RefreshCw, Eye } from "lucide-react";
import * as XLSX from "xlsx";

interface MarketingLead {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  source: string | null;
  tags: string[] | null;
  status: string;
  created_at: string;
}

interface EmailBroadcast {
  id: string;
  subject: string;
  body_html: string;
  status: string;
  total_recipients: number | null;
  sent_count: number | null;
  failed_count: number | null;
  sent_at: string | null;
  created_at: string;
}

export default function AdminLeadOutreach() {
  const queryClient = useQueryClient();
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Form states
  const [newLead, setNewLead] = useState({ email: "", name: "", company: "", source: "manual" });
  const [emailForm, setEmailForm] = useState({ subject: "", body_html: "", body_text: "" });
  const [aiPrompt, setAiPrompt] = useState({ topic: "", tone: "professional", email_type: "product_update" as const });

  // Fetch leads
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ["marketing-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MarketingLead[];
    },
  });

  // Fetch broadcasts
  const { data: broadcasts = [], isLoading: broadcastsLoading } = useQuery({
    queryKey: ["email-broadcasts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as EmailBroadcast[];
    },
  });

  // Add lead mutation
  const addLeadMutation = useMutation({
    mutationFn: async (lead: typeof newLead) => {
      const { error } = await supabase.from("marketing_leads").insert({
        email: lead.email,
        name: lead.name || null,
        company: lead.company || null,
        source: lead.source,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead added successfully");
      setShowAddLead(false);
      setNewLead({ email: "", name: "", company: "", source: "manual" });
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
    },
    onError: (error: Error) => {
      toast.error(error.message.includes("duplicate") ? "This email already exists" : error.message);
    },
  });

  // Delete leads mutation
  const deleteLeadsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("marketing_leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leads deleted");
      setSelectedLeads([]);
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
    },
  });

  // CSV Upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

        // Map columns - look for email, name, company
        const leadsToInsert = jsonData
          .filter((row) => row.email || row.Email || row.EMAIL)
          .map((row) => ({
            email: (row.email || row.Email || row.EMAIL || "").toString().toLowerCase().trim(),
            name: (row.name || row.Name || row.NAME || row["First Name"] || row["Full Name"] || null)?.toString() || null,
            company: (row.company || row.Company || row.COMPANY || row.Organization || null)?.toString() || null,
            source: "csv_upload",
          }));

        if (leadsToInsert.length === 0) {
          toast.error("No valid emails found in file");
          return;
        }

        // Insert in batches
        let inserted = 0;
        let duplicates = 0;
        const batchSize = 100;

        for (let i = 0; i < leadsToInsert.length; i += batchSize) {
          const batch = leadsToInsert.slice(i, i + batchSize);
          const { error, data: insertedData } = await supabase
            .from("marketing_leads")
            .upsert(batch, { onConflict: "email", ignoreDuplicates: true })
            .select();

          if (error) {
            console.error("Batch insert error:", error);
          } else {
            inserted += insertedData?.length || 0;
          }
        }

        duplicates = leadsToInsert.length - inserted;
        toast.success(`Imported ${inserted} leads${duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ""}`);
        queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
      } catch (err) {
        console.error("CSV parse error:", err);
        toast.error("Failed to parse file");
      }
    };
    reader.readAsBinaryString(file);
  }, [queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  // Generate AI email
  const handleGenerateEmail = async () => {
    if (!aiPrompt.topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-marketing-email", {
        body: {
          email_type: aiPrompt.email_type,
          topic: aiPrompt.topic,
          tone: aiPrompt.tone,
        },
      });

      if (error) throw error;
      if (data?.email) {
        setEmailForm({
          subject: data.email.subject || "",
          body_html: data.email.body_html || "",
          body_text: data.email.body_text || "",
        });
        toast.success("Email content generated!");
      }
    } catch (err) {
      console.error("Generate error:", err);
      toast.error("Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  };

  // Send broadcast
  const handleSendBroadcast = async (testMode = false) => {
    if (!emailForm.subject.trim() || !emailForm.body_html.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    const targetEmails = selectedLeads.length > 0
      ? leads.filter((l) => selectedLeads.includes(l.id)).map((l) => l.email)
      : leads.filter((l) => l.status === "active").map((l) => l.email);

    if (!testMode && targetEmails.length === 0) {
      toast.error("No leads selected");
      return;
    }

    setIsSending(true);
    try {
      // Create broadcast record
      const { data: broadcast, error: broadcastError } = await supabase
        .from("email_broadcasts")
        .insert({
          subject: emailForm.subject,
          body_html: emailForm.body_html,
          body_text: emailForm.body_text || null,
          audience: selectedLeads.length > 0 ? "selected_leads" : "all_leads",
          audience_filter: selectedLeads.length > 0 ? { lead_ids: selectedLeads } : null,
          status: testMode ? "draft" : "sending",
          total_recipients: testMode ? 1 : targetEmails.length,
        })
        .select()
        .single();

      if (broadcastError) throw broadcastError;

      // Send via edge function
      const { error: sendError } = await supabase.functions.invoke("send-broadcast-email", {
        body: {
          broadcast_id: broadcast.id,
          subject: emailForm.subject,
          body_html: emailForm.body_html,
          body_text: emailForm.body_text,
          audience: testMode ? "specific_emails" : (selectedLeads.length > 0 ? "specific_emails" : "all_leads"),
          specific_emails: testMode ? undefined : (selectedLeads.length > 0 ? targetEmails : undefined),
          test_mode: testMode,
        },
      });

      if (sendError) throw sendError;

      toast.success(testMode ? "Test email sent to your email" : `Broadcast sent to ${targetEmails.length} leads`);
      setShowCompose(false);
      setEmailForm({ subject: "", body_html: "", body_text: "" });
      setSelectedLeads([]);
      queryClient.invalidateQueries({ queryKey: ["email-broadcasts"] });
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Failed to send broadcast");
    } finally {
      setIsSending(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map((l) => l.id));
    }
  };

  const toggleLead = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <AdminLayout title="Lead Generation & Outreach" description="Manage marketing leads and send email campaigns">
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetchLeads()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={showCompose} onOpenChange={setShowCompose}>
              <DialogTrigger asChild>
                <Button>
                  <Send className="h-4 w-4 mr-2" />
                  Compose Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Compose Email Campaign</DialogTitle>
                  <DialogDescription>
                    {selectedLeads.length > 0
                      ? `Send to ${selectedLeads.length} selected leads`
                      : `Send to all ${leads.filter((l) => l.status === "active").length} active leads`}
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="ai" className="mt-4">
                  <TabsList className="mb-4">
                    <TabsTrigger value="ai">
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Generate
                    </TabsTrigger>
                    <TabsTrigger value="manual">
                      <Mail className="h-4 w-4 mr-2" />
                      Manual
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="ai" className="space-y-4">
                    <div className="grid gap-4">
                      <div>
                        <Label>Email Type</Label>
                        <Select
                          value={aiPrompt.email_type}
                          onValueChange={(v) => setAiPrompt((p) => ({ ...p, email_type: v as typeof aiPrompt.email_type }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="product_update">Product Update</SelectItem>
                            <SelectItem value="feature_announcement">Feature Announcement</SelectItem>
                            <SelectItem value="newsletter">Newsletter</SelectItem>
                            <SelectItem value="promotion">Promotion</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tone</Label>
                        <Select
                          value={aiPrompt.tone}
                          onValueChange={(v) => setAiPrompt((p) => ({ ...p, tone: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="excited">Excited</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Topic / What to announce</Label>
                        <Textarea
                          placeholder="e.g., New AI-powered collection features that help recover 30% more revenue..."
                          value={aiPrompt.topic}
                          onChange={(e) => setAiPrompt((p) => ({ ...p, topic: e.target.value }))}
                          rows={3}
                        />
                      </div>
                      <Button onClick={handleGenerateEmail} disabled={isGenerating}>
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Email
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-4">
                    <p className="text-sm text-muted-foreground">Write your email manually below.</p>
                  </TabsContent>
                </Tabs>

                {/* Email form - shown for both tabs */}
                <div className="space-y-4 mt-4 border-t pt-4">
                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="Email subject line"
                    />
                  </div>
                  <div>
                    <Label>Body (HTML)</Label>
                    <Textarea
                      value={emailForm.body_html}
                      onChange={(e) => setEmailForm((f) => ({ ...f, body_html: e.target.value }))}
                      placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                  {emailForm.body_html && (
                    <div>
                      <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Email
                      </Button>
                    </div>
                  )}
                </div>

                <DialogFooter className="mt-6 gap-2">
                  <Button variant="outline" onClick={() => handleSendBroadcast(true)} disabled={isSending}>
                    Send Test
                  </Button>
                  <Button onClick={() => handleSendBroadcast(false)} disabled={isSending}>
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Campaign
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads">
              <Users className="h-4 w-4 mr-2" />
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Mail className="h-4 w-4 mr-2" />
              Campaigns ({broadcasts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-4">
            {/* Upload and Add buttons */}
            <div className="flex gap-4 flex-wrap">
              <Card className="flex-1 min-w-[250px]">
                <CardContent className="pt-6">
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop CSV/Excel file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex-1 min-w-[250px]">
                <CardContent className="pt-6">
                  <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
                    <DialogTrigger asChild>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                        <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium">Add Lead Manually</p>
                        <p className="text-xs text-muted-foreground mt-1">Enter email and details</p>
                      </div>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Lead</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={newLead.email}
                            onChange={(e) => setNewLead((l) => ({ ...l, email: e.target.value }))}
                            placeholder="lead@example.com"
                          />
                        </div>
                        <div>
                          <Label>Name</Label>
                          <Input
                            value={newLead.name}
                            onChange={(e) => setNewLead((l) => ({ ...l, name: e.target.value }))}
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <Label>Company</Label>
                          <Input
                            value={newLead.company}
                            onChange={(e) => setNewLead((l) => ({ ...l, company: e.target.value }))}
                            placeholder="Acme Corp"
                          />
                        </div>
                        <div>
                          <Label>Source</Label>
                          <Select
                            value={newLead.source}
                            onValueChange={(v) => setNewLead((l) => ({ ...l, source: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual Entry</SelectItem>
                              <SelectItem value="website">Website</SelectItem>
                              <SelectItem value="referral">Referral</SelectItem>
                              <SelectItem value="linkedin">LinkedIn</SelectItem>
                              <SelectItem value="event">Event</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter className="mt-6">
                        <Button
                          onClick={() => addLeadMutation.mutate(newLead)}
                          disabled={!newLead.email || addLeadMutation.isPending}
                        >
                          {addLeadMutation.isPending ? "Adding..." : "Add Lead"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>

            {/* Leads table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Marketing Leads</CardTitle>
                  <CardDescription>
                    {selectedLeads.length > 0 ? `${selectedLeads.length} selected` : `${leads.length} total leads`}
                  </CardDescription>
                </div>
                {selectedLeads.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteLeadsMutation.mutate(selectedLeads)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Selected
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No leads yet. Upload a CSV or add manually.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedLeads.length === leads.length && leads.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Added</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLeads.includes(lead.id)}
                              onCheckedChange={() => toggleLead(lead.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{lead.email}</TableCell>
                          <TableCell>{lead.name || "-"}</TableCell>
                          <TableCell>{lead.company || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.source || "unknown"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={lead.status === "active" ? "default" : "secondary"}>
                              {lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(lead.created_at), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Campaign History</CardTitle>
                <CardDescription>Recent email broadcasts and their performance</CardDescription>
              </CardHeader>
              <CardContent>
                {broadcastsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : broadcasts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No campaigns sent yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Failed</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {broadcasts.map((broadcast) => (
                        <TableRow key={broadcast.id}>
                          <TableCell className="font-medium max-w-[300px] truncate">
                            {broadcast.subject}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                broadcast.status === "completed"
                                  ? "default"
                                  : broadcast.status === "sending"
                                  ? "secondary"
                                  : broadcast.status === "failed"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {broadcast.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{broadcast.total_recipients || 0}</TableCell>
                          <TableCell className="text-green-600">{broadcast.sent_count || 0}</TableCell>
                          <TableCell className="text-red-600">{broadcast.failed_count || 0}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {broadcast.sent_at
                              ? format(new Date(broadcast.sent_at), "MMM d, yyyy h:mm a")
                              : format(new Date(broadcast.created_at), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Email Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>Subject: {emailForm.subject}</DialogDescription>
            </DialogHeader>
            <div
              className="mt-4 p-4 border rounded-lg bg-white"
              dangerouslySetInnerHTML={{ __html: emailForm.body_html }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
