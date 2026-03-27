import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TopRiskAccount } from "@/hooks/useRevenueRisk";

const PAGE_SIZE = 15;

interface Props {
  accounts: TopRiskAccount[];
}

function getTierBadge(score: number) {
  if (score >= 80) return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">High</Badge>;
  if (score >= 60) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">Moderate</Badge>;
  if (score >= 40) return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">At Risk</Badge>;
  return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">High Risk</Badge>;
}

function getEngagementBadge(level: string) {
  switch (level) {
    case "high":
      return <Badge variant="outline" className="border-green-500/30 text-green-600 text-xs">Active</Badge>;
    case "medium":
      return <Badge variant="outline" className="border-yellow-500/30 text-yellow-600 text-xs">Moderate</Badge>;
    default:
      return <Badge variant="outline" className="border-red-500/30 text-red-600 text-xs">No Response</Badge>;
  }
}

export function TopRiskAccounts({ accounts }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
  const paginated = accounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Risk Accounts</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Collectability</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead className="text-right">ECL</TableHead>
                <TableHead className="text-right">Adj. ECL</TableHead>
                <TableHead>Recommended Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No risk data available. Click refresh to calculate.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map(account => (
                  <TableRow key={account.debtor_id}>
                    <TableCell>
                      <Link
                        to={`/debtors/${account.debtor_id}`}
                        className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
                      >
                        {account.debtor_name}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {account.invoice_count} invoice{account.invoice_count !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(account.balance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTierBadge(account.collectability_score)}
                        <span className="text-xs text-muted-foreground">{account.collectability_score}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getEngagementBadge(account.engagement_level)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-red-600">
                      {formatCurrency(account.ecl)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-amber-600">
                      {formatCurrency(account.engagement_adjusted_ecl)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{account.recommended_action}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, accounts.length)} of {accounts.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
