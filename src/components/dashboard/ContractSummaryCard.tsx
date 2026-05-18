import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, ArrowRight, Search, Building2 } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import { computeContractTotals } from "@/lib/clm/financialMetrics";

const PAGE_SIZE = 15;

export const ContractSummaryCard = () => {
  const { isActive, isLoading: clmLoading } = useClmEntitlement();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-contract-summary"],
    enabled: isActive,
    queryFn: async () => {
      const { data: imports } = await supabase
        .from("live_contract_imports")
        .select("id, contract_name, contract_type, effective_date, term_end_date, debtor_id")
        .in("status", ["approved", "imported"])
        .order("updated_at", { ascending: false })
        .limit(200);

      const importIds = (imports ?? []).map((i) => i.id);
      const debtorIds = Array.from(
        new Set((imports ?? []).map((i) => i.debtor_id).filter(Boolean) as string[]),
      );

      if (importIds.length === 0) return { rows: [] };

      const [{ data: fields }, { data: debtors }, { data: schedules }] = await Promise.all([
        supabase
          .from("live_contract_extracted_fields")
          .select("import_id, field_group, field_key, field_value")
          .in("import_id", importIds),
        debtorIds.length
          ? supabase
              .from("debtors")
              .select("id, company_name, name")
              .in("id", debtorIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("contract_invoice_schedules")
          .select("import_id, scheduled_date, amount, currency, billing_type, description, product_category, revenue_type, service_period_start, service_period_end")
          .in("import_id", importIds),
      ]);

      const debtorMap = new Map(
        (debtors ?? []).map((d: any) => [d.id, d.company_name || d.name || "—"]),
      );

      const rows = (imports ?? []).map((imp: any) => {
        const impFields = (fields ?? []).filter((f: any) => f.import_id === imp.id);
        const impSchedules = (schedules ?? []).filter((s: any) => s.import_id === imp.id);
        const t = computeContractTotals(impFields, imp, { schedule: impSchedules });
        return {
          importId: imp.id,
          debtorId: imp.debtor_id as string | null,
          debtorName: imp.debtor_id ? debtorMap.get(imp.debtor_id) || "Unknown" : "Unlinked",
          contractName: imp.contract_name || "Untitled contract",
          termStart: imp.effective_date as string | null,
          termEnd: imp.term_end_date as string | null,
          mrr: t.mrr,
          arr: t.arr,
          acv: t.acv,
          currency: t.currency || "USD",
        };
      });

      return { rows };
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = data?.rows ?? [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.debtorName.toLowerCase().includes(q) ||
        r.contractName.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (clmLoading || !isActive) return null;
  if (isLoading) return null;
  if (!data || data.rows.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Contracts Summary
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/contracts/live")}>
            View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search debtor or contract…"
            className="pl-8 h-9"
          />
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debtor</TableHead>
                <TableHead>Term Start</TableHead>
                <TableHead>Term End</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">ARR</TableHead>
                <TableHead className="text-right">ACV</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => {
                const target = r.debtorId ? `/debtors/${r.debtorId}` : `/contracts/live/${r.importId}`;
                return (
                  <TableRow
                    key={r.importId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(target)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.debtorName}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.contractName}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.termStart ? formatDateShort(r.termStart) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.termEnd ? formatDateShort(r.termEnd) : "Open"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {r.mrr > 0 ? formatCurrency(r.mrr, r.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {r.arr > 0 ? formatCurrency(r.arr, r.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {r.acv > 0 ? formatCurrency(r.acv, r.currency) : "—"}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    No contracts match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
