import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Brain,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  DollarSign,
  FileText,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface InvoiceReport {
  invoice_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  days_past_due: number;
  status: string;
  aging_bucket: string;
  debtor_name: string;
  debtor_id: string;
  collectability_score: number;
  collectability_tier: string;
  ai_summary: string;
  payment_likelihood: string;
  recommended_action: string;
  risk_factors: string[];
  account_payment_score: number | null;
  account_risk_tier: string | null;
}

interface AggregateStats {
  total_invoices: number;
  total_amount: number;
  avg_collectability_score: number;
  high_collectability_count: number;
  medium_collectability_count: number;
  low_collectability_count: number;
  very_low_collectability_count: number;
  total_at_risk: number;
  avg_days_past_due: number;
}

export function InvoiceCollectabilityReport() {
  const [expanded, setExpanded] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["invoice-collectability-report"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("invoice-collectability-report", {
        body: { limit: 100, generate_ai_summary: false },
      });

      if (error) throw error;
      return data as { reports: InvoiceReport[]; aggregate: AggregateStats };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleGenerateAISummaries = async () => {
    setGeneratingAI(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: result, error } = await supabase.functions.invoke("invoice-collectability-report", {
        body: { limit: 100, generate_ai_summary: true },
      });

      if (error) throw error;
      
      // Manually update the query cache
      refetch();
      toast.success("AI summaries generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI summaries");
    } finally {
      setGeneratingAI(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "High":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">High</Badge>;
      case "Medium":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Medium</Badge>;
      case "Low":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Low</Badge>;
      case "Very Low":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Very Low</Badge>;
      default:
        return <Badge variant="outline">{tier}</Badge>;
    }
  };

  const getLikelihoodIcon = (likelihood: string) => {
    switch (likelihood) {
      case "Very Likely":
      case "Likely":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "Moderate":
        return <Target className="h-4 w-4 text-yellow-500" />;
      default:
        return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Invoice Collectability Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  const reports = data?.reports || [];
  const aggregate = data?.aggregate;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Invoice Collectability Report
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateAISummaries}
              disabled={generatingAI || isFetching}
            >
              {generatingAI ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Generate AI Insights
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aggregate Stats */}
        {aggregate && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <FileText className="h-3 w-3" />
                Total Invoices
              </div>
              <div className="text-xl font-bold">{aggregate.total_invoices}</div>
              <div className="text-xs text-muted-foreground">
                ${aggregate.total_amount.toLocaleString()}
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Target className="h-3 w-3" />
                Avg Collectability
              </div>
              <div className={`text-xl font-bold ${getScoreColor(aggregate.avg_collectability_score)}`}>
                {aggregate.avg_collectability_score}%
              </div>
              <Progress 
                value={aggregate.avg_collectability_score} 
                className="h-1.5 mt-1"
              />
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <AlertTriangle className="h-3 w-3" />
                At Risk Amount
              </div>
              <div className="text-xl font-bold text-red-600">
                ${aggregate.total_at_risk.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {aggregate.low_collectability_count + aggregate.very_low_collectability_count} invoices
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CheckCircle2 className="h-3 w-3" />
                Collectability Breakdown
              </div>
              <div className="flex gap-1 mt-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="h-6 bg-green-500 rounded" style={{ width: `${(aggregate.high_collectability_count / aggregate.total_invoices) * 100}%`, minWidth: aggregate.high_collectability_count ? "8px" : "0" }} />
                    </TooltipTrigger>
                    <TooltipContent>High: {aggregate.high_collectability_count}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="h-6 bg-yellow-500 rounded" style={{ width: `${(aggregate.medium_collectability_count / aggregate.total_invoices) * 100}%`, minWidth: aggregate.medium_collectability_count ? "8px" : "0" }} />
                    </TooltipTrigger>
                    <TooltipContent>Medium: {aggregate.medium_collectability_count}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="h-6 bg-orange-500 rounded" style={{ width: `${(aggregate.low_collectability_count / aggregate.total_invoices) * 100}%`, minWidth: aggregate.low_collectability_count ? "8px" : "0" }} />
                    </TooltipTrigger>
                    <TooltipContent>Low: {aggregate.low_collectability_count}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="h-6 bg-red-500 rounded" style={{ width: `${(aggregate.very_low_collectability_count / aggregate.total_invoices) * 100}%`, minWidth: aggregate.very_low_collectability_count ? "8px" : "0" }} />
                    </TooltipTrigger>
                    <TooltipContent>Very Low: {aggregate.very_low_collectability_count}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Avg {aggregate.avg_days_past_due} days past due
              </div>
            </div>
          </div>
        )}

        {/* Invoice List */}
        <div className="border rounded-lg">
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-sm font-medium">
              Invoice Details ({reports.length})
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
          
          {expanded && (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Likelihood</TableHead>
                    <TableHead>Recommended Action</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.invoice_id}>
                      <TableCell>
                        <div className="font-medium">{report.invoice_number}</div>
                        {report.ai_summary && (
                          <div className="text-xs text-muted-foreground mt-1 max-w-[200px] line-clamp-2">
                            {report.ai_summary}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/debtors/${report.debtor_id}`}
                          className="text-primary hover:underline"
                        >
                          {report.debtor_name}
                        </Link>
                        {report.account_risk_tier && (
                          <div className="text-xs text-muted-foreground">
                            Account: {report.account_risk_tier}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${report.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={report.days_past_due > 60 ? "text-red-600 font-medium" : ""}>
                          {report.days_past_due}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex flex-col items-center gap-1">
                                <span className={`font-bold ${getScoreColor(report.collectability_score)}`}>
                                  {report.collectability_score}
                                </span>
                                {getTierBadge(report.collectability_tier)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium mb-1">Risk Factors:</p>
                              <ul className="text-xs space-y-1">
                                {report.risk_factors.map((factor, i) => (
                                  <li key={i}>• {factor}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getLikelihoodIcon(report.payment_likelihood)}
                          <span className="text-sm">{report.payment_likelihood}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {report.recommended_action}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link to={`/invoices/${report.invoice_id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
