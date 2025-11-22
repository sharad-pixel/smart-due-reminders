import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, MessageSquare, Search, Loader2, DollarSign, FileText, CheckCircle, Clock, XCircle, Trash2, Edit, LayoutGrid, List, Table2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type AgingBucket = 'all' | 'current' | 'dpd_1_30' | 'dpd_31_60' | 'dpd_61_90' | 'dpd_91_120';
type DraftStatus = 'pending_approval' | 'approved' | 'discarded';
type ViewMode = 'list' | 'grid' | 'table';

interface AgingBucketData {
  count: number;
  total_amount: number;
}

interface AgingBuckets {
  current: AgingBucketData;
  dpd_1_30: AgingBucketData;
  dpd_31_60: AgingBucketData;
  dpd_61_90: AgingBucketData;
  dpd_91_120: AgingBucketData;
}

interface Draft {
  id: string;
  invoice_id: string;
  channel: 'email' | 'sms';
  subject: string | null;
  message_body: string;
  status: DraftStatus;
  step_number: number;
  created_at: string;
  recommended_send_date: string | null;
  invoices: {
    invoice_number: string;
    amount: number;
    currency: string;
    due_date: string;
    debtors: {
      name: string;
      company_name: string;
      email: string;
    };
  };
}

const agingBucketLabels = {
  all: { label: "All Drafts", description: "All aging buckets", color: "bg-blue-100 text-blue-800 border-blue-300" },
  current: { label: "Current", description: "Not yet overdue", color: "bg-green-100 text-green-800 border-green-300" },
  dpd_1_30: { label: "1-30 Days", description: "Early stage", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  dpd_31_60: { label: "31-60 Days", description: "Mid stage", color: "bg-orange-100 text-orange-800 border-orange-300" },
  dpd_61_90: { label: "61-90 Days", description: "Late stage", color: "bg-red-100 text-red-800 border-red-300" },
  dpd_91_120: { label: "91-120 Days", description: "Critical", color: "bg-purple-100 text-purple-800 border-purple-300" },
};

const CollectionDrafts = () => {
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<AgingBucket>('all');
  const [agingData, setAgingData] = useState<AgingBuckets | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DraftStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'sms'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [regeneratePrompt, setRegeneratePrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to view collection drafts");
        return;
      }

      // Fetch aging bucket data
      const { data: agingResponse, error: agingError } = await supabase.functions.invoke('get-aging-bucket-invoices', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (agingError) throw agingError;
      setAgingData(agingResponse.data);

      // Fetch all drafts
      const { data: draftsData, error: draftsError } = await supabase
        .from('ai_drafts')
        .select(`
          *,
          invoices!inner(
            invoice_number,
            amount,
            currency,
            due_date,
            debtors!inner(
              name,
              company_name,
              email
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (draftsError) throw draftsError;
      setDrafts(draftsData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysPastDue = (dueDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const getAgingBucket = (daysPastDue: number): AgingBucket => {
    if (daysPastDue >= 91) return 'dpd_91_120';
    if (daysPastDue >= 61) return 'dpd_61_90';
    if (daysPastDue >= 31) return 'dpd_31_60';
    if (daysPastDue >= 1) return 'dpd_1_30';
    return 'current';
  };

  const handleUpdateStatus = async (draftId: string, newStatus: DraftStatus) => {
    try {
      const { error } = await supabase
        .from('ai_drafts')
        .update({ status: newStatus })
        .eq('id', draftId);

      if (error) throw error;

      toast.success('Draft status updated');
      fetchData();
    } catch (error: any) {
      console.error('Error updating draft:', error);
      toast.error('Failed to update draft status');
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const { error } = await supabase
        .from('ai_drafts')
        .delete()
        .eq('id', draftId);

      if (error) throw error;

      toast.success('Draft deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      toast.error('Failed to delete draft');
    }
  };

  const handleEditClick = (draft: Draft) => {
    setEditingDraft(draft);
    setEditedSubject(draft.subject || "");
    setEditedBody(draft.message_body);
    setRegeneratePrompt("");
  };

  const handleSaveEdit = async () => {
    if (!editingDraft) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('ai_drafts')
        .update({
          subject: editedSubject,
          message_body: editedBody
        })
        .eq('id', editingDraft.id);

      if (error) throw error;

      toast.success('Draft updated successfully');
      setEditingDraft(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating draft:', error);
      toast.error('Failed to update draft');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseEditModal = () => {
    setEditingDraft(null);
    setEditedSubject("");
    setEditedBody("");
    setRegeneratePrompt("");
  };

  const handleRegenerateWithAI = async () => {
    if (!editingDraft) return;
    
    // Allow empty prompt if called from suggestion chips (they set the prompt)
    const promptToUse = regeneratePrompt.trim();
    if (!promptToUse) {
      toast.error("Please provide context for AI regeneration");
      return;
    }

    setIsRegenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Get branding settings
      const { data: branding } = await supabase
        .from('branding_settings')
        .select('*')
        .maybeSingle();

      const daysPastDue = calculateDaysPastDue(editingDraft.invoices.due_date);
      const agingBucket = getAgingBucket(daysPastDue);
      const businessName = branding?.business_name || 'Your Company';
      const fromName = branding?.from_name || businessName;
      const debtorName = editingDraft.invoices.debtors.name || editingDraft.invoices.debtors.company_name;
      
      const getToneForBucket = (bucket: AgingBucket): string => {
        switch (bucket) {
          case 'current': return 'friendly reminder';
          case 'dpd_1_30': return 'firm but friendly';
          case 'dpd_31_60': return 'firm and direct';
          case 'dpd_61_90': return 'urgent and direct but respectful';
          case 'dpd_91_120': return 'very firm, urgent, and compliant';
          default: return 'professional';
        }
      };

      const systemPrompt = `You are drafting a professional collections message for ${businessName} to send to their customer about an overdue invoice.

CRITICAL RULES:
- Be firm, clear, and professional
- Be respectful and non-threatening
- NEVER claim to be or act as a "collection agency" or legal authority
- NEVER use harassment or intimidation
- Write as if you are ${businessName}, NOT a third party
- Encourage the customer to pay or reply if there is a dispute or issue
- Use a ${getToneForBucket(agingBucket)} tone appropriate for ${daysPastDue} days past due`;

      const userPrompt = `Generate a professional collection message with the following context:

Business: ${businessName}
From: ${fromName}
Debtor: ${debtorName}
Invoice Number: ${editingDraft.invoices.invoice_number}
Amount: $${editingDraft.invoices.amount} ${editingDraft.invoices.currency}
Original Due Date: ${editingDraft.invoices.due_date}
Days Past Due: ${daysPastDue}
Aging Bucket: ${agingBucket}
Channel: ${editingDraft.channel}

ADDITIONAL CONTEXT FROM USER:
${regeneratePrompt}

${branding?.email_signature ? `\nSignature block to include:\n${branding.email_signature}` : ''}

Generate ${editingDraft.channel === 'email' ? 'a complete email message' : 'a concise SMS message (160 characters max)'}.`;

      // Call edge function to regenerate
      const { data, error } = await supabase.functions.invoke('regenerate-draft', {
        body: {
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          channel: editingDraft.channel
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      setEditedBody(data.message_body);
      if (data.subject && editingDraft.channel === 'email') {
        setEditedSubject(data.subject);
      }
      
      toast.success("Message regenerated successfully");
      setRegeneratePrompt("");
    } catch (error: any) {
      console.error('Error regenerating draft:', error);
      toast.error('Failed to regenerate message');
    } finally {
      setIsRegenerating(false);
    }
  };

  const filteredDrafts = drafts.filter(draft => {
    const daysPastDue = calculateDaysPastDue(draft.invoices.due_date);
    const draftBucket = getAgingBucket(daysPastDue);
    
    const matchesBucket = selectedBucket === 'all' || draftBucket === selectedBucket;
    
    const matchesSearch = 
      draft.invoices.debtors.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      draft.invoices.debtors.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      draft.invoices.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || draft.status === statusFilter;
    const matchesChannel = channelFilter === 'all' || draft.channel === channelFilter;
    
    return matchesBucket && matchesSearch && matchesStatus && matchesChannel;
  });

  const getStatusIcon = (status: DraftStatus) => {
    switch (status) {
      case 'pending_approval':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'discarded':
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: DraftStatus) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'discarded':
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const getTotalCount = () => {
    if (!agingData) return 0;
    return agingData.current.count + agingData.dpd_1_30.count + agingData.dpd_31_60.count + agingData.dpd_61_90.count + agingData.dpd_91_120.count;
  };

  const getTotalAmount = () => {
    if (!agingData) return 0;
    return agingData.current.total_amount + agingData.dpd_1_30.total_amount + agingData.dpd_31_60.total_amount + agingData.dpd_61_90.total_amount + agingData.dpd_91_120.total_amount;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-primary">AI Collection Drafts</h1>
            <p className="text-muted-foreground mt-2">
              Review and manage all AI-generated collection drafts organized by aging buckets
            </p>
          </div>
          <Button onClick={fetchData} variant="outline">
            <Loader2 className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Aging Bucket Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <button
            onClick={() => setSelectedBucket('all')}
            className={`text-left p-4 rounded-lg border-2 transition-all ${
              selectedBucket === 'all' ? agingBucketLabels.all.color : "bg-card hover:bg-accent"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">{agingBucketLabels.all.label}</span>
              <FileText className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{getTotalCount()}</p>
              <p className="text-xs text-muted-foreground">{agingBucketLabels.all.description}</p>
              <div className="flex items-center text-xs font-medium mt-2">
                <DollarSign className="h-3 w-3 mr-1" />
                ${getTotalAmount().toLocaleString()}
              </div>
            </div>
          </button>

          {(Object.entries(agingBucketLabels) as Array<[AgingBucket, typeof agingBucketLabels[keyof typeof agingBucketLabels]]>)
            .filter(([key]) => key !== 'all')
            .map(([key, config]) => {
              const bucketData = agingData?.[key as keyof AgingBuckets];
              const isSelected = selectedBucket === key;
              
              return (
                <button
                  key={key}
                  onClick={() => setSelectedBucket(key)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected ? config.color : "bg-card hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{config.label}</span>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">{bucketData?.count || 0}</p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                    <div className="flex items-center text-xs font-medium mt-2">
                      <DollarSign className="h-3 w-3 mr-1" />
                      ${bucketData?.total_amount.toLocaleString() || 0}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>

        {/* Drafts List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All AI Drafts</CardTitle>
                <CardDescription>
                  {filteredDrafts.length} draft{filteredDrafts.length !== 1 ? 's' : ''} found
                </CardDescription>
              </div>
              
              {/* View Mode Selector */}
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  size="sm"
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('grid')}
                  className="h-8 px-3"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Grid
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('table')}
                  className="h-8 px-3"
                >
                  <Table2 className="h-4 w-4 mr-1" />
                  Table
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by debtor or invoice..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DraftStatus | 'all')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="discarded">Discarded</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as 'all' | 'email' | 'sms')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Empty State */}
              {filteredDrafts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No drafts found</p>
                  {(searchTerm || statusFilter !== 'all' || channelFilter !== 'all') && (
                    <p className="text-sm mt-2">Try adjusting your filters</p>
                  )}
                </div>
              ) : (
                <>
                  {/* List View */}
                  {viewMode === 'list' && (
                    <div className="space-y-4">
                      {filteredDrafts.map((draft) => {
                        const daysPastDue = calculateDaysPastDue(draft.invoices.due_date);
                        return (
                          <Card key={draft.id} className="border-l-4 border-l-primary/20 hover:border-l-primary transition-colors">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold">
                                      {draft.invoices.debtors.company_name || draft.invoices.debtors.name}
                                    </h3>
                                    <Badge variant="outline" className="uppercase">
                                      {draft.channel === 'email' ? <Mail className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                                      {draft.channel}
                                    </Badge>
                                    <Badge className={getStatusColor(draft.status)}>
                                      <span className="mr-1">{getStatusIcon(draft.status)}</span>
                                      {draft.status.replace('_', ' ')}
                                    </Badge>
                                    <Badge variant={daysPastDue > 60 ? 'destructive' : daysPastDue > 30 ? 'default' : 'secondary'}>
                                      {daysPastDue} DPD
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    <div>Invoice: {draft.invoices.invoice_number} • ${draft.invoices.amount.toLocaleString()} {draft.invoices.currency}</div>
                                    <div>Created {formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}</div>
                                    {draft.subject && <div className="font-medium text-foreground mt-2">Subject: {draft.subject}</div>}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditClick(draft)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  {draft.status === 'pending_approval' && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleUpdateStatus(draft.id, 'approved')}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUpdateStatus(draft.id, 'discarded')}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Discard
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteDraft(draft.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="bg-muted/30 p-4 rounded-lg">
                                <p className="text-sm whitespace-pre-wrap">{draft.message_body}</p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Grid View */}
                  {viewMode === 'grid' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredDrafts.map((draft) => {
                        const daysPastDue = calculateDaysPastDue(draft.invoices.due_date);
                        return (
                          <Card key={draft.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-base line-clamp-1">
                                    {draft.invoices.debtors.company_name || draft.invoices.debtors.name}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    {draft.invoices.invoice_number}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteDraft(draft.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {draft.channel === 'email' ? <Mail className="h-2 w-2 mr-1" /> : <MessageSquare className="h-2 w-2 mr-1" />}
                                  {draft.channel}
                                </Badge>
                                <Badge className={getStatusColor(draft.status) + " text-xs"}>
                                  {getStatusIcon(draft.status)}
                                </Badge>
                                <Badge variant={daysPastDue > 60 ? 'destructive' : 'secondary'} className="text-xs">
                                  {daysPastDue} DPD
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="bg-muted/30 p-3 rounded text-xs line-clamp-4">
                                {draft.message_body}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ${draft.invoices.amount.toLocaleString()} {draft.invoices.currency}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditClick(draft)}
                                  className="flex-1 text-xs h-8"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                {draft.status === 'pending_approval' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateStatus(draft.id, 'approved')}
                                    className="flex-1 text-xs h-8"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Approve
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Table View */}
                  {viewMode === 'table' && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left text-sm font-medium">Debtor</th>
                            <th className="p-3 text-left text-sm font-medium">Invoice</th>
                            <th className="p-3 text-left text-sm font-medium">Amount</th>
                            <th className="p-3 text-left text-sm font-medium">Channel</th>
                            <th className="p-3 text-left text-sm font-medium">DPD</th>
                            <th className="p-3 text-left text-sm font-medium">Status</th>
                            <th className="p-3 text-left text-sm font-medium">Created</th>
                            <th className="p-3 text-right text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDrafts.map((draft) => {
                            const daysPastDue = calculateDaysPastDue(draft.invoices.due_date);
                            return (
                              <tr key={draft.id} className="border-t hover:bg-accent/50">
                                <td className="p-3">
                                  <div className="font-medium text-sm">
                                    {draft.invoices.debtors.company_name || draft.invoices.debtors.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {draft.invoices.debtors.email}
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-xs">
                                  {draft.invoices.invoice_number}
                                </td>
                                <td className="p-3 text-sm font-medium">
                                  ${draft.invoices.amount.toLocaleString()}
                                </td>
                                <td className="p-3">
                                  <Badge variant="outline" className="text-xs">
                                    {draft.channel === 'email' ? <Mail className="h-2 w-2 mr-1" /> : <MessageSquare className="h-2 w-2 mr-1" />}
                                    {draft.channel}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <Badge variant={daysPastDue > 60 ? 'destructive' : daysPastDue > 30 ? 'default' : 'secondary'} className="text-xs">
                                    {daysPastDue}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <Badge className={getStatusColor(draft.status) + " text-xs"}>
                                    {draft.status.replace('_', ' ')}
                                  </Badge>
                                </td>
                                <td className="p-3 text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}
                                </td>
                                <td className="p-3">
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditClick(draft)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    {draft.status === 'pending_approval' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleUpdateStatus(draft.id, 'approved')}
                                        className="h-8 w-8 p-0"
                                      >
                                        <CheckCircle className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteDraft(draft.id)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Draft Modal */}
        <Dialog open={!!editingDraft} onOpenChange={handleCloseEditModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Draft</DialogTitle>
              <DialogDescription>
                Make changes to the draft message before approving or sending
              </DialogDescription>
            </DialogHeader>

            {editingDraft && (
              <div className="space-y-4">
                {/* Draft Info */}
                <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">Debtor:</span>
                    <span>{editingDraft.invoices.debtors.company_name || editingDraft.invoices.debtors.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">Invoice:</span>
                    <span>{editingDraft.invoices.invoice_number}</span>
                    <Badge variant="outline" className="ml-2">
                      ${editingDraft.invoices.amount.toLocaleString()} {editingDraft.invoices.currency}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">Channel:</span>
                    <Badge variant="outline" className="uppercase">
                      {editingDraft.channel === 'email' ? <Mail className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                      {editingDraft.channel}
                    </Badge>
                    <span className="font-semibold ml-4">Days Past Due:</span>
                    <Badge variant={calculateDaysPastDue(editingDraft.invoices.due_date) > 60 ? 'destructive' : 'secondary'}>
                      {calculateDaysPastDue(editingDraft.invoices.due_date)} days
                    </Badge>
                  </div>
                </div>

                {/* Edit Subject (Email only) */}
                {editingDraft.channel === 'email' && (
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      placeholder="Enter subject line..."
                    />
                  </div>
                )}

                {/* Edit Message Body */}
                <div className="space-y-2">
                  <Label htmlFor="message">Message Body</Label>
                  <Textarea
                    id="message"
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    placeholder="Enter message body..."
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {editedBody.length} characters
                  </p>
                </div>

                {/* AI Regeneration Section */}
                <div className="border-t pt-4 space-y-3">
                  <Label htmlFor="ai-prompt" className="text-base font-semibold">
                    AI Regeneration (Optional)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Quick suggestions or provide custom context to regenerate the message
                  </p>
                  
                  {/* Quick Suggestion Chips */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Quick Suggestions:</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRegeneratePrompt("Make the message more urgent and emphasize the importance of immediate payment");
                          setTimeout(() => handleRegenerateWithAI(), 100);
                        }}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Make More Urgent
                      </Button>
                      
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRegeneratePrompt("Add information about payment plan options and how to set one up");
                          setTimeout(() => handleRegenerateWithAI(), 100);
                        }}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        <DollarSign className="h-3 w-3 mr-1" />
                        Add Payment Plan Option
                      </Button>
                      
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRegeneratePrompt("Soften the tone to be more friendly and understanding while still being clear about the payment need");
                          setTimeout(() => handleRegenerateWithAI(), 100);
                        }}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Soften Tone
                      </Button>
                      
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRegeneratePrompt("Add a reference to previous communication or reminders that were sent");
                          setTimeout(() => handleRegenerateWithAI(), 100);
                        }}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        Reference Previous Contact
                      </Button>
                      
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRegeneratePrompt("Mention potential late fees or interest charges that may apply");
                          setTimeout(() => handleRegenerateWithAI(), 100);
                        }}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Mention Late Fees
                      </Button>
                      
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRegeneratePrompt("Offer a settlement discount for immediate payment in full");
                          setTimeout(() => handleRegenerateWithAI(), 100);
                        }}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Offer Settlement Discount
                      </Button>
                      
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRegeneratePrompt("Make the message shorter and more concise while keeping key information");
                          setTimeout(() => handleRegenerateWithAI(), 100);
                        }}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Make Shorter
                      </Button>
                    </div>
                  </div>

                  {/* Custom Prompt Input */}
                  <div className="space-y-2">
                    <Label htmlFor="ai-prompt" className="text-xs font-medium">
                      Or provide custom instructions:
                    </Label>
                    <Textarea
                      id="ai-prompt"
                      value={regeneratePrompt}
                      onChange={(e) => setRegeneratePrompt(e.target.value)}
                      placeholder="E.g., 'Add a personal note about our long-term business relationship'..."
                      rows={3}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleRegenerateWithAI}
                      disabled={isRegenerating || !regeneratePrompt.trim()}
                      className="w-full"
                    >
                      {isRegenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating with AI...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Regenerate with Custom Prompt
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseEditModal} disabled={isSaving || isRegenerating}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSaving || isRegenerating || !editedBody.trim()}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CollectionDrafts;
