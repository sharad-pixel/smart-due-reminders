import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { PersonaConfig } from "@/lib/personaConfig";
import { Mail, CheckCircle, Clock, DollarSign, ChevronDown, ChevronUp, Loader2, Calendar, Hash, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  outstanding_amount: number;
  due_date: string;
  days_past_due?: number;
  status: string;
  bucket_entered_at?: string;
  created_at?: string;
  debtors?: {
    company_name: string;
    email: string;
    id: string;
  };
  draft_count?: number;
  last_outreach_date?: string;
  outreach_sequence?: number;
  next_outreach_date?: string;
}

interface CachedCount {
  count: number;
  totalAmount: number;
  timestamp: number;
}

interface PersonaInvoicesListProps {
  persona: PersonaConfig;
  agingBucket: string;
  workflowId?: string;
  onViewInvoice?: (invoiceId: string) => void;
}

const CACHE_KEY_PREFIX = "persona_invoice_counts_";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const PAGE_SIZE = 25;

// Day offsets for workflow steps
const STEP_DAY_OFFSETS = [3, 7, 14, 21, 30];

const PersonaInvoicesList = ({ persona, agingBucket, workflowId, onViewInvoice }: PersonaInvoicesListProps) => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({});
  const [cachedCount, setCachedCount] = useState<number>(0);
  const [cachedTotalAmount, setCachedTotalAmount] = useState<number>(0);
  const [countLoading, setCountLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Load cached count on mount
  useEffect(() => {
    loadCachedCount();
    fetchInvoiceCount();
  }, [agingBucket]);

  // Fetch full invoices when expanded or page changes
  useEffect(() => {
    if (expanded) {
      fetchInvoices();
    }
  }, [expanded, currentPage]);

  const getCacheKey = useCallback(() => {
    return `${CACHE_KEY_PREFIX}${agingBucket}`;
  }, [agingBucket]);

  const loadCachedCount = useCallback(() => {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (cached) {
        const data: CachedCount = JSON.parse(cached);
        const now = Date.now();
        // Use cache if still valid (within 24 hours)
        if (now - data.timestamp < CACHE_DURATION_MS) {
          setCachedCount(data.count);
          setCachedTotalAmount(data.totalAmount);
          setCountLoading(false);
          return true;
        }
      }
    } catch (e) {
      console.error("Error loading cached count:", e);
    }
    return false;
  }, [getCacheKey]);

  const saveCachedCount = useCallback((count: number, totalAmount: number) => {
    try {
      const data: CachedCount = {
        count,
        totalAmount,
        timestamp: Date.now()
      };
      localStorage.setItem(getCacheKey(), JSON.stringify(data));
    } catch (e) {
      console.error("Error saving cached count:", e);
    }
  }, [getCacheKey]);

  const fetchInvoiceCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch count and total amount for this aging bucket
      const { data: invoiceData, error, count } = await supabase
        .from('invoices')
        .select('amount', { count: 'exact', head: false })
        .eq('user_id', user.id)
        .eq('aging_bucket', agingBucket)
        .in('status', ['Open', 'InPaymentPlan']);

      if (error) throw error;

      const totalAmount = invoiceData?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
      const invoiceCount = count || 0;

      setCachedCount(invoiceCount);
      setCachedTotalAmount(totalAmount);
      setTotalCount(invoiceCount);
      saveCachedCount(invoiceCount, totalAmount);
    } catch (error) {
      console.error("Error fetching invoice count:", error);
    } finally {
      setCountLoading(false);
    }
  };

  const calculateOutreachInfo = (invoice: Invoice) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bucketEnteredDate = new Date(invoice.bucket_entered_at || invoice.created_at || invoice.due_date);
    bucketEnteredDate.setHours(0, 0, 0, 0);
    
    const daysSinceEntered = Math.floor((today.getTime() - bucketEnteredDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine current sequence based on days since entering bucket
    let currentSequence = 1;
    let nextOutreachDayOffset = STEP_DAY_OFFSETS[0];
    
    for (let i = STEP_DAY_OFFSETS.length - 1; i >= 0; i--) {
      if (daysSinceEntered >= STEP_DAY_OFFSETS[i]) {
        currentSequence = i + 2; // Next sequence after the passed one
        nextOutreachDayOffset = STEP_DAY_OFFSETS[Math.min(i + 1, STEP_DAY_OFFSETS.length - 1)];
        break;
      }
    }
    
    // If we haven't passed any step yet
    if (daysSinceEntered < STEP_DAY_OFFSETS[0]) {
      currentSequence = 1;
      nextOutreachDayOffset = STEP_DAY_OFFSETS[0];
    }
    
    // Cap at max sequence
    if (currentSequence > STEP_DAY_OFFSETS.length) {
      currentSequence = STEP_DAY_OFFSETS.length;
    }
    
    // Calculate next outreach date
    const nextOutreachDate = addDays(bucketEnteredDate, nextOutreachDayOffset);
    
    return {
      outreachSequence: currentSequence,
      nextOutreachDate: nextOutreachDate
    };
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Fetch invoices for this aging bucket with pagination
      const { data: invoiceData, error, count } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          status,
          aging_bucket,
          bucket_entered_at,
          created_at,
          debtors(id, company_name, email)
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .eq('aging_bucket', agingBucket)
        .in('status', ['Open', 'InPaymentPlan'])
        .order('due_date', { ascending: true })
        .range(from, to);

      if (error) throw error;

      if (count !== null) {
        setTotalCount(count);
      }

      // Calculate days past due and outreach info
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const enrichedInvoices = (invoiceData || []).map(inv => {
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const outreachInfo = calculateOutreachInfo({
          ...inv,
          outstanding_amount: inv.amount,
          days_past_due: daysPastDue
        } as Invoice);
        
        return { 
          id: inv.id,
          invoice_number: inv.invoice_number,
          amount: inv.amount,
          outstanding_amount: inv.amount,
          due_date: inv.due_date,
          status: inv.status,
          bucket_entered_at: inv.bucket_entered_at,
          created_at: inv.created_at,
          debtors: inv.debtors,
          days_past_due: daysPastDue,
          outreach_sequence: outreachInfo.outreachSequence,
          next_outreach_date: outreachInfo.nextOutreachDate.toISOString()
        } as Invoice;
      });

      setInvoices(enrichedInvoices);

      // Fetch draft counts for these invoices
      if (enrichedInvoices.length > 0) {
        const invoiceIds = enrichedInvoices.map(i => i.id);
        const { data: drafts } = await supabase
          .from('ai_drafts')
          .select('invoice_id')
          .in('invoice_id', invoiceIds)
          .in('status', ['pending_approval', 'approved']);

        const counts: Record<string, number> = {};
        drafts?.forEach(d => {
          counts[d.invoice_id] = (counts[d.invoice_id] || 0) + 1;
        });
        setDraftCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || inv.amount || 0), 0);

  // Use cached count for display, or expanded invoices count
  const displayCount = cachedCount;
  const displayTotal = expanded ? totalOutstanding : cachedTotalAmount;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleRowClick = (invoiceId: string) => {
    navigate(`/invoices/${invoiceId}`);
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: persona.color }}>
      <CardHeader className="pb-2">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => {
            if (!expanded) {
              setCurrentPage(1);
            }
            setExpanded(!expanded);
          }}
        >
          <div className="flex items-center gap-3">
            <PersonaAvatar persona={persona} size="sm" />
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {persona.name}
                <Badge variant="outline" className="text-xs font-normal">
                  {persona.bucketMin}-{persona.bucketMax || "+"} Days
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {persona.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              {countLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-sm font-semibold">{displayCount} invoices</p>
                  {displayTotal > 0 && (
                    <p className="text-xs text-muted-foreground">{formatCurrency(displayTotal)}</p>
                  )}
                </>
              )}
            </div>
            <Button variant="ghost" size="sm">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>No invoices in this aging bucket</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">DPD</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Hash className="h-3 w-3" />
                          Sequence
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Next Outreach
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Drafts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => handleRowClick(invoice.id)}
                      >
                        <TableCell className="font-medium">
                          {invoice.debtors?.company_name || "Unknown Account"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            #{invoice.invoice_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.outstanding_amount || invoice.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              (invoice.days_past_due || 0) > 90 && "bg-destructive/10 text-destructive",
                              (invoice.days_past_due || 0) > 60 && (invoice.days_past_due || 0) <= 90 && "bg-orange-100 text-orange-700",
                              (invoice.days_past_due || 0) > 30 && (invoice.days_past_due || 0) <= 60 && "bg-yellow-100 text-yellow-700"
                            )}
                          >
                            {invoice.days_past_due} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-primary/5"
                          >
                            Step {invoice.outreach_sequence}/{STEP_DAY_OFFSETS.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {invoice.next_outreach_date ? (
                            <span className={cn(
                              new Date(invoice.next_outreach_date) <= new Date() && "text-primary font-medium"
                            )}>
                              {format(new Date(invoice.next_outreach_date), "MMM d, yyyy")}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {draftCounts[invoice.id] > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              {draftCounts[invoice.id]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-2">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex flex-col p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(invoice.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm truncate flex-1">
                        {invoice.debtors?.company_name || "Unknown Account"}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">
                        #{invoice.invoice_number}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(invoice.outstanding_amount || invoice.amount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {invoice.days_past_due} DPD
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Step {invoice.outreach_sequence}/{STEP_DAY_OFFSETS.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {invoice.next_outreach_date 
                          ? format(new Date(invoice.next_outreach_date), "MMM d")
                          : "-"}
                      </span>
                    </div>
                    {draftCounts[invoice.id] > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                          <Mail className="h-3 w-3" />
                          {draftCounts[invoice.id]} draft{draftCounts[invoice.id] > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPage(p => Math.max(1, p - 1));
                      }}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only">Previous</span>
                    </Button>
                    <span className="text-sm px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPage(p => Math.min(totalPages, p + 1));
                      }}
                      disabled={currentPage === totalPages || loading}
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">Next</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default PersonaInvoicesList;
