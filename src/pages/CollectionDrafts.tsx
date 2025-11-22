import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Mail, MessageSquare, Search, Loader2, DollarSign, FileText } from "lucide-react";

interface AgingBucketData {
  invoices: any[];
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

const agingBucketLabels = {
  current: { label: "Current", description: "Not yet overdue", color: "bg-green-100 text-green-800 border-green-300" },
  dpd_1_30: { label: "1-30 Days", description: "Early stage", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  dpd_31_60: { label: "31-60 Days", description: "Mid stage", color: "bg-orange-100 text-orange-800 border-orange-300" },
  dpd_61_90: { label: "61-90 Days", description: "Late stage", color: "bg-red-100 text-red-800 border-red-300" },
  dpd_91_120: { label: "91-120 Days", description: "Critical", color: "bg-purple-100 text-purple-800 border-purple-300" },
};

const CollectionDrafts = () => {
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<keyof AgingBuckets>("dpd_1_30");
  const [agingData, setAgingData] = useState<AgingBuckets | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchAgingBucketData();
  }, []);

  const fetchAgingBucketData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to view collection drafts");
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-aging-bucket-invoices', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      
      setAgingData(data.data);
    } catch (error: any) {
      console.error('Error fetching aging data:', error);
      toast.error("Failed to load invoice data");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    const newSelection = new Set(selectedInvoices);
    if (checked) {
      newSelection.add(invoiceId);
    } else {
      newSelection.delete(invoiceId);
    }
    setSelectedInvoices(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && agingData) {
      const allIds = new Set(agingData[selectedBucket].invoices.map(inv => inv.id));
      setSelectedInvoices(allIds);
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleGenerateDrafts = async () => {
    if (selectedInvoices.size === 0) {
      toast.error("Please select at least one invoice");
      return;
    }

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('generate-bulk-ai-drafts', {
        body: {
          invoice_ids: Array.from(selectedInvoices)
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success(`Generated ${data.created} AI draft${data.created !== 1 ? 's' : ''}`);
      if (data.errors > 0) {
        toast.warning(`${data.errors} invoice${data.errors !== 1 ? 's' : ''} failed to generate`);
      }
      
      setSelectedInvoices(new Set());
      await fetchAgingBucketData();
    } catch (error: any) {
      console.error('Error generating drafts:', error);
      toast.error("Failed to generate AI drafts");
    } finally {
      setGenerating(false);
    }
  };

  const filteredInvoices = agingData?.[selectedBucket]?.invoices.filter(invoice => {
    const matchesSearch = searchTerm === "" || 
      invoice.debtors.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || invoice.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  }) || [];

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
        <div>
          <h1 className="text-4xl font-bold text-primary">AI Collection Drafts</h1>
          <p className="text-muted-foreground mt-2">
            Select invoices and generate AI-powered collection messages
          </p>
        </div>

        {/* Aging Bucket Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(agingBucketLabels).map(([key, config]) => {
            const bucketData = agingData?.[key as keyof AgingBuckets];
            const isSelected = selectedBucket === key;
            
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedBucket(key as keyof AgingBuckets);
                  setSelectedInvoices(new Set());
                }}
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

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {agingBucketLabels[selectedBucket].label} Invoices
                </CardTitle>
                <CardDescription>
                  {selectedInvoices.size > 0 ? 
                    `${selectedInvoices.size} invoice${selectedInvoices.size !== 1 ? 's' : ''} selected` :
                    `${filteredInvoices.length} invoice${filteredInvoices.length !== 1 ? 's' : ''}`
                  }
                </CardDescription>
              </div>
              
              {selectedInvoices.size > 0 && (
                <Button onClick={handleGenerateDrafts} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Generate AI Drafts ({selectedInvoices.size})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by debtor or invoice number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="InPaymentPlan">In Payment Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Invoice List Table */}
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No invoices in this aging bucket</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">
                        <Checkbox
                          checked={selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="p-3 text-left text-sm font-medium">Debtor</th>
                      <th className="p-3 text-left text-sm font-medium">Invoice #</th>
                      <th className="p-3 text-left text-sm font-medium">Amount</th>
                      <th className="p-3 text-left text-sm font-medium">Due Date</th>
                      <th className="p-3 text-left text-sm font-medium">Days Past Due</th>
                      <th className="p-3 text-left text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-t hover:bg-accent/50">
                        <td className="p-3">
                          <Checkbox
                            checked={selectedInvoices.has(invoice.id)}
                            onCheckedChange={(checked) => handleSelectInvoice(invoice.id, checked as boolean)}
                          />
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{invoice.debtors.company_name || invoice.debtors.name}</p>
                            <p className="text-xs text-muted-foreground">{invoice.debtors.email}</p>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-sm">{invoice.invoice_number}</td>
                        <td className="p-3 font-medium">
                          ${invoice.amount.toLocaleString()} {invoice.currency || 'USD'}
                        </td>
                        <td className="p-3 text-sm">{new Date(invoice.due_date).toLocaleDateString()}</td>
                        <td className="p-3">
                          <Badge variant={invoice.days_past_due > 60 ? "destructive" : "secondary"}>
                            {invoice.days_past_due} days
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{invoice.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CollectionDrafts;
