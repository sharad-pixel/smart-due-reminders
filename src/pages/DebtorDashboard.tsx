import { useState } from "react";
import { useDebtorDashboard, usePaymentScore } from "@/hooks/usePaymentScore";
import { useRiskEngine } from "@/hooks/useRiskEngine";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, ExternalLink, Clock, HelpCircle } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { AgingBucketBreakdown } from "@/components/AgingBucketBreakdown";
import { PaymentActivityCard } from "@/components/PaymentActivityCard";

export default function DebtorDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDebtorDashboard();
  const { calculateRisk } = useRiskEngine();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");

  const filteredDebtors = data?.debtors.filter(debtor => {
    const matchesSearch = debtor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         debtor.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const tier = debtor.payment_risk_tier || "Still learning";
    const matchesRisk = riskFilter === "all" || tier === riskFilter;
    const matchesScore = scoreFilter === "all" || 
      (scoreFilter === "high" && (debtor.payment_score || 0) >= 85) ||
      (scoreFilter === "medium" && (debtor.payment_score || 0) >= 70 && (debtor.payment_score || 0) < 85) ||
      (scoreFilter === "low" && (debtor.payment_score || 0) >= 50 && (debtor.payment_score || 0) < 70) ||
      (scoreFilter === "critical" && (debtor.payment_score || 0) < 50) ||
      (scoreFilter === "learning" && (!debtor.payment_risk_tier || debtor.payment_risk_tier === "Still learning"));
    
    return matchesSearch && matchesRisk && matchesScore;
  });

  const getScoreBadge = (tier: string | null, score: number | null) => {
    if (!tier || tier === "Still learning") {
      return <Badge variant="secondary" className="bg-muted text-muted-foreground gap-1"><HelpCircle className="h-3 w-3" />Learning</Badge>;
    }
    if (tier === "Low") return <Badge className="bg-green-500 text-white">Low Risk</Badge>;
    if (tier === "Medium") return <Badge className="bg-yellow-500 text-white">Medium Risk</Badge>;
    if (tier === "High") return <Badge className="bg-orange-500 text-white">High Risk</Badge>;
    if (tier === "Critical") return <Badge className="bg-red-500 text-white">Critical Risk</Badge>;
    return <Badge variant="secondary">Unknown</Badge>;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 50) return "text-orange-500";
    return "text-red-600";
  };

  const handleRecalculateAll = () => {
    calculateRisk.mutate({ recalculate_all: true });
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
          <Button onClick={handleRecalculateAll} disabled={calculateRisk.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${calculateRisk.isPending ? "animate-spin" : ""}`} />
            Recalculate All Scores
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-6">
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
              <CardTitle className="text-sm font-medium">DSO</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.summary.dso || 0}</div>
              <p className="text-xs text-muted-foreground">Days average</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Still Learning</CardTitle>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{data?.summary.stillLearning || 0}</div>
              <p className="text-xs text-muted-foreground">Insufficient history</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data?.summary.lowRisk || 0}</div>
              <p className="text-xs text-muted-foreground">Score 85-100</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{data?.summary.highRisk || 0}</div>
              <p className="text-xs text-muted-foreground">Score 50-69</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Risk</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{data?.summary.criticalRisk || 0}</div>
              <p className="text-xs text-muted-foreground">Score 0-49</p>
            </CardContent>
          </Card>
        </div>

        {/* Aging Bucket Breakdown */}
        <AgingBucketBreakdown />

        {/* Payment Activity */}
        <PaymentActivityCard limit={5} />

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
                <SelectItem value="Still learning">Still Learning</SelectItem>
                <SelectItem value="Low">Low Risk</SelectItem>
                <SelectItem value="Medium">Medium Risk</SelectItem>
                <SelectItem value="High">High Risk</SelectItem>
                <SelectItem value="Critical">Critical Risk</SelectItem>
              </SelectContent>
            </Select>

            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Score Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="learning">Still Learning</SelectItem>
                <SelectItem value="high">85-100 (Low Risk)</SelectItem>
                <SelectItem value="medium">70-84 (Medium)</SelectItem>
                <SelectItem value="low">50-69 (High Risk)</SelectItem>
                <SelectItem value="critical">0-49 (Critical)</SelectItem>
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
                    <TableCell>{getScoreBadge(debtor.payment_risk_tier, debtor.payment_score)}</TableCell>
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
