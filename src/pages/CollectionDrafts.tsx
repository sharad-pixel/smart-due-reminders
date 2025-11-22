import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, MessageSquare, Search, Loader2, DollarSign, FileText, CheckCircle, Clock, XCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type AgingBucket = 'all' | 'current' | 'dpd_1_30' | 'dpd_31_60' | 'dpd_61_90' | 'dpd_91_120';
type DraftStatus = 'pending_approval' | 'approved' | 'discarded';

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
            <CardTitle>All AI Drafts</CardTitle>
            <CardDescription>
              {filteredDrafts.length} draft{filteredDrafts.length !== 1 ? 's' : ''} found
            </CardDescription>
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

              {/* Draft Cards */}
              {filteredDrafts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No drafts found</p>
                  {(searchTerm || statusFilter !== 'all' || channelFilter !== 'all') && (
                    <p className="text-sm mt-2">Try adjusting your filters</p>
                  )}
                </div>
              ) : (
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
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CollectionDrafts;
