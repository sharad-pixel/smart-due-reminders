import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig, PersonaConfig } from "@/lib/personaConfig";
import { 
  Mail, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Calendar,
  User,
  Building2,
  ExternalLink,
  RefreshCw,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, isToday, isTomorrow, isPast } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import OutreachMessagePreview from "./OutreachMessagePreview";

interface OutreachItem {
  id: string;
  invoice_id: string;
  invoice_number: string;
  debtor_id: string;
  company_name: string;
  amount: number;
  due_date: string;
  days_past_due: number;
  aging_bucket: string;
  bucket_entered_at: string;
  outreach_sequence: number;
  scheduled_date: Date;
  persona_key: string;
  is_account_level: boolean;
  account_outreach_persona?: string;
}

const PAGE_SIZE = 15;

// Day offsets for workflow steps
const STEP_DAY_OFFSETS = [3, 7, 14, 21, 30];

const getPersonaForBucket = (agingBucket: string): { key: string; persona: PersonaConfig } | null => {
  const mapping: Record<string, string> = {
    'dpd_1_30': 'sam',
    'dpd_31_60': 'james',
    'dpd_61_90': 'katy',
    'dpd_91_120': 'troy',
    'dpd_121_150': 'jimmy',
    'dpd_150_plus': 'rocco'
  };
  
  const key = mapping[agingBucket];
  if (key && personaConfig[key]) {
    return { key, persona: personaConfig[key] };
  }
  return null;
};

const UpcomingOutreachLog = () => {
  const navigate = useNavigate();
  const [outreachItems, setOutreachItems] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [previewItem, setPreviewItem] = useState<OutreachItem | null>(null);

  const fetchUpcomingOutreach = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all open invoices with their debtor info
      const { data: invoices, error, count } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          aging_bucket,
          bucket_entered_at,
          created_at,
          status,
          debtors!inner(
            id,
            company_name,
            account_outreach_enabled,
            account_outreach_persona
          )
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .in('status', ['Open', 'InPaymentPlan'])
        .not('aging_bucket', 'is', null)
        .neq('aging_bucket', 'current')
        .neq('aging_bucket', 'paid')
        .order('due_date', { ascending: true });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate outreach schedule for each invoice
      const outreachList: OutreachItem[] = [];

      invoices?.forEach((invoice: any) => {
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        const bucketEnteredDate = new Date(invoice.bucket_entered_at || invoice.created_at || invoice.due_date);
        bucketEnteredDate.setHours(0, 0, 0, 0);
        const daysSinceEntered = Math.floor((today.getTime() - bucketEnteredDate.getTime()) / (1000 * 60 * 60 * 24));

        // Find current sequence and next outreach date
        let currentSequence = 1;
        let nextOutreachDayOffset = STEP_DAY_OFFSETS[0];

        for (let i = STEP_DAY_OFFSETS.length - 1; i >= 0; i--) {
          if (daysSinceEntered >= STEP_DAY_OFFSETS[i]) {
            currentSequence = i + 2;
            nextOutreachDayOffset = STEP_DAY_OFFSETS[Math.min(i + 1, STEP_DAY_OFFSETS.length - 1)];
            break;
          }
        }

        if (daysSinceEntered < STEP_DAY_OFFSETS[0]) {
          currentSequence = 1;
          nextOutreachDayOffset = STEP_DAY_OFFSETS[0];
        }

        if (currentSequence > STEP_DAY_OFFSETS.length) {
          currentSequence = STEP_DAY_OFFSETS.length;
        }

        const scheduledDate = addDays(bucketEnteredDate, nextOutreachDayOffset);

        // Get persona info
        const personaInfo = getPersonaForBucket(invoice.aging_bucket);
        
        // Check if account-level outreach
        const isAccountLevel = invoice.debtors?.account_outreach_enabled === true;
        const accountPersona = invoice.debtors?.account_outreach_persona;

        outreachList.push({
          id: `${invoice.id}-${currentSequence}`,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          debtor_id: invoice.debtors?.id,
          company_name: invoice.debtors?.company_name || 'Unknown',
          amount: invoice.amount,
          due_date: invoice.due_date,
          days_past_due: daysPastDue,
          aging_bucket: invoice.aging_bucket,
          bucket_entered_at: invoice.bucket_entered_at || invoice.created_at,
          outreach_sequence: currentSequence,
          scheduled_date: scheduledDate,
          persona_key: isAccountLevel && accountPersona ? accountPersona : (personaInfo?.key || 'james'),
          is_account_level: isAccountLevel,
          account_outreach_persona: accountPersona
        });
      });

      // Sort by scheduled date (soonest first)
      outreachList.sort((a, b) => a.scheduled_date.getTime() - b.scheduled_date.getTime());

      setTotalCount(outreachList.length);

      // Apply pagination
      const startIndex = (currentPage - 1) * PAGE_SIZE;
      const paginatedItems = outreachList.slice(startIndex, startIndex + PAGE_SIZE);

      setOutreachItems(paginatedItems);
    } catch (error) {
      console.error("Error fetching outreach schedule:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchUpcomingOutreach();
  }, [fetchUpcomingOutreach]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getScheduleLabel = (date: Date) => {
    if (isPast(date) && !isToday(date)) {
      return { label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    }
    if (isToday(date)) {
      return { label: 'Today', className: 'bg-primary/10 text-primary border-primary/20' };
    }
    if (isTomorrow(date)) {
      return { label: 'Tomorrow', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' };
    }
    return { label: format(date, "MMM d"), className: 'bg-muted text-muted-foreground' };
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleRowClick = (invoiceId: string) => {
    navigate(`/invoices/${invoiceId}`);
  };

  const handleRefresh = () => {
    fetchUpcomingOutreach(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Outreach Schedule
            </CardTitle>
            <CardDescription>
              Real-time log of scheduled collection outreach. Click any row to view invoice details.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : outreachItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No upcoming outreach scheduled</p>
            <p className="text-sm mt-1">All invoices are either current or have completed their outreach sequences.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px]">Scheduled</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">DPD</TableHead>
                    <TableHead className="text-center">Sequence</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                    <TableHead className="w-[100px] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outreachItems.map((item) => {
                    const scheduleInfo = getScheduleLabel(item.scheduled_date);
                    const persona = personaConfig[item.persona_key];
                    
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => handleRowClick(item.invoice_id)}
                      >
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs font-medium", scheduleInfo.className)}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {scheduleInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">
                              {item.company_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">
                            #{item.invoice_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              item.days_past_due > 90 && "bg-destructive/10 text-destructive",
                              item.days_past_due > 60 && item.days_past_due <= 90 && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                              item.days_past_due > 30 && item.days_past_due <= 60 && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            )}
                          >
                            {item.days_past_due}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs bg-primary/5">
                            Step {item.outreach_sequence}/{STEP_DAY_OFFSETS.length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {persona && <PersonaAvatar persona={persona} size="xs" />}
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {persona?.name || 'Unknown'}
                              </span>
                              {item.is_account_level && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 w-fit">
                                  <User className="h-2 w-2 mr-0.5" />
                                  Account Level
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewItem(item);
                              }}
                              title="Preview message"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(item.invoice_id);
                              }}
                              title="View invoice"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-2">
              {outreachItems.map((item) => {
                const scheduleInfo = getScheduleLabel(item.scheduled_date);
                const persona = personaConfig[item.persona_key];
                
                return (
                  <div
                    key={item.id}
                    className="flex flex-col p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs font-medium", scheduleInfo.className)}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {scheduleInfo.label}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setPreviewItem(item)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Badge variant="outline" className="text-xs font-mono">
                          #{item.invoice_number}
                        </Badge>
                      </div>
                    </div>
                    
                    <p 
                      className="font-medium text-sm mb-2 truncate cursor-pointer hover:text-primary"
                      onClick={() => handleRowClick(item.invoice_id)}
                    >
                      {item.company_name}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(item.amount)}</span>
                      <span>{item.days_past_due} DPD</span>
                      <div className="flex items-center gap-1">
                        {persona && <PersonaAvatar persona={persona} size="xs" />}
                        <span>{persona?.name}</span>
                        {item.is_account_level && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            <User className="h-2 w-2" />
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                    <span className="text-sm font-medium">{currentPage}</span>
                    <span className="text-sm text-muted-foreground">of</span>
                    <span className="text-sm font-medium">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Message Preview Modal */}
      {previewItem && (
        <OutreachMessagePreview
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          invoiceId={previewItem.invoice_id}
          invoiceNumber={previewItem.invoice_number}
          companyName={previewItem.company_name}
          amount={previewItem.amount}
          dueDate={previewItem.due_date}
          personaKey={previewItem.persona_key}
          outreachSequence={previewItem.outreach_sequence}
        />
      )}
    </Card>
  );
};

export default UpcomingOutreachLog;
