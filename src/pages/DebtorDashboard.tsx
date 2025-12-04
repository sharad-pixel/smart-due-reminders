import { useState } from "react";
import { useDebtorDashboard, usePaymentScore } from "@/hooks/usePaymentScore";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, ExternalLink, Clock } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { AgingBucketBreakdown } from "@/components/AgingBucketBreakdown";

export default function DebtorDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDebtorDashboard();
  const { calculateScore } = usePaymentScore();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");

  const filteredDebtors = data?.debtors.filter(debtor => {
    const matchesSearch = debtor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         debtor.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === "all" || debtor.payment_risk_tier === riskFilter;
    const matchesScore = scoreFilter === "all" || 
      (scoreFilter === "high" && (debtor.payment_score || 50) >= 80) ||
      (scoreFilter === "medium" && (debtor.payment_score || 50) >= 50 && (debtor.payment_score || 50) < 80) ||
      (scoreFilter === "low" && (debtor.payment_score || 50) < 50);
    
    return matchesSearch && matchesRisk && matchesScore;
  });

  const getScoreBadge = (score: number | null) => {
    const s = score || 50;
    if (s >= 80) return <Badge className="bg-green-500">Low Risk</Badge>;
    if (s >= 50) return <Badge className="bg-yellow-500">Medium Risk</Badge>;
    return <Badge className="bg-red-500">High Risk</Badge>;
  };

  const getScoreColor = (score: number | null) => {
    const s = score || 50;
    if (s >= 80) return "text-green-600";
    if (s >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const handleRecalculateAll = () => {
    calculateScore.mutate({ recalculate_all: true });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Account Dashboard</h1>
            <p className="text-muted-foreground">Monitor payment scores and risk indicators</p>
          </div>
          <Button onClick={handleRecalculateAll} disabled={calculateScore.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${calculateScore.isPending ? "animate-spin" : ""}`} />
            Recalculate All Scores
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.summary.totalDebtors || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Days Sales Outstanding</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.summary.dso || 0}</div>
              <p className="text-xs text-muted-foreground">Days average</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Payment Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.summary.avgScore || 50}</div>
              <p className="text-xs text-muted-foreground">Out of 100</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data?.summary.lowRisk || 0}</div>
              <p className="text-xs text-muted-foreground">Score 80-100</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{data?.summary.highRisk || 0}</div>
              <p className="text-xs text-muted-foreground">Score 0-49</p>
            </CardContent>
          </Card>
        </div>

        {/* Aging Bucket Breakdown */}
        <AgingBucketBreakdown />

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Input
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Tiers</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>

            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Score Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="high">80-100 (High)</SelectItem>
                <SelectItem value="medium">50-79 (Medium)</SelectItem>
                <SelectItem value="low">0-49 (Low)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Debtor Table */}
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>Click on an account to view detailed score breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Payment Score</TableHead>
                  <TableHead>Risk Tier</TableHead>
                  <TableHead>Outstanding Balance</TableHead>
                  <TableHead>Open Invoices</TableHead>
                  <TableHead>Avg Days to Pay</TableHead>
                  <TableHead>Max Days Past Due</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDebtors?.map((debtor) => (
                  <TableRow
                    key={debtor.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/debtors/${debtor.id}`)}
                  >
                    <TableCell className="font-medium">{debtor.name}</TableCell>
                    <TableCell>
                      <span className={`text-2xl font-bold ${getScoreColor(debtor.payment_score)}`}>
                        {debtor.payment_score || 50}
                      </span>
                    </TableCell>
                    <TableCell>{getScoreBadge(debtor.payment_score)}</TableCell>
                    <TableCell>
                      ${(debtor.total_open_balance || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/invoices?debtor=${debtor.id}`}
                        className="text-primary hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {debtor.open_invoices_count || 0}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {debtor.avg_days_to_pay 
                        ? `${debtor.avg_days_to_pay.toFixed(1)} days`
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {debtor.max_days_past_due || 0} days
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(debtor.disputed_invoices_count || 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {debtor.disputed_invoices_count} Disputed
                          </Badge>
                        )}
                        {(debtor.in_payment_plan_invoices_count || 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {debtor.in_payment_plan_invoices_count} In Plan
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link
                          to={`/collection-tasks?debtor=${debtor.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="sm" className="h-8">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Tasks
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                
                {filteredDebtors?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No accounts found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
