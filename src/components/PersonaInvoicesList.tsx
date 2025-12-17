import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { PersonaConfig } from "@/lib/personaConfig";
import { ExternalLink, Mail, AlertCircle, CheckCircle, Clock, DollarSign, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  outstanding_amount: number;
  due_date: string;
  days_past_due?: number;
  status: string;
  debtors?: {
    company_name: string;
    email: string;
    id: string;
  };
  draft_count?: number;
  last_outreach_date?: string;
}

interface PersonaInvoicesListProps {
  persona: PersonaConfig;
  agingBucket: string;
  workflowId?: string;
  onViewInvoice?: (invoiceId: string) => void;
}

const PersonaInvoicesList = ({ persona, agingBucket, workflowId, onViewInvoice }: PersonaInvoicesListProps) => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (expanded) {
      fetchInvoices();
    }
  }, [expanded, agingBucket]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch invoices for this aging bucket
      const { data: invoiceData, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          status,
          aging_bucket,
          debtors(id, company_name, email)
        `)
        .eq('user_id', user.id)
        .eq('aging_bucket', agingBucket)
        .in('status', ['Open', 'InPaymentPlan'])
        .order('due_date', { ascending: true })
        .limit(25);

      if (error) throw error;

      // Calculate days past due
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const enrichedInvoices = (invoiceData || []).map(inv => {
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return { 
          id: inv.id,
          invoice_number: inv.invoice_number,
          amount: inv.amount,
          outstanding_amount: inv.amount, // Using amount as outstanding for now
          due_date: inv.due_date,
          status: inv.status,
          debtors: inv.debtors,
          days_past_due: daysPastDue 
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

  return (
    <Card className="border-l-4" style={{ borderLeftColor: persona.color }}>
      <CardHeader className="pb-2">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
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
              <p className="text-sm font-semibold">{invoices.length} invoices</p>
              {totalOutstanding > 0 && (
                <p className="text-xs text-muted-foreground">{formatCurrency(totalOutstanding)}</p>
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
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">
                          {invoice.debtors?.company_name || "Unknown Account"}
                        </p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          #{invoice.invoice_number}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(invoice.outstanding_amount || invoice.amount)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {invoice.days_past_due} days past due
                        </span>
                        {draftCounts[invoice.id] > 0 && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Mail className="h-3 w-3" />
                            {draftCounts[invoice.id]} draft{draftCounts[invoice.id] > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {invoices.length >= 25 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => navigate(`/invoices?bucket=${agingBucket}`)}
                >
                  View All Invoices in {persona.name}'s Queue
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default PersonaInvoicesList;
