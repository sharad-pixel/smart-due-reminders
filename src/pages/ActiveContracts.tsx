import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSignature,
  Search,
  ArrowRight,
  Building2,
  CalendarClock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccountId";
import { formatCurrency, formatDateShort } from "@/lib/formatters";

const PAGE_SIZE = 20;

export default function ActiveContracts({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) : Layout;
  const { accountId } = useAccountId();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [page, setPage] = useState(1);

  const { data: rows, isLoading } = useQuery({
    enabled: !!accountId,
    queryKey: ["active-contracts", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(
          "id,title,status,contract_type,contract_value,currency,effective_date,expiry_date,renewal_date,counterparty_name,created_at",
        )
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (rows ?? []).filter((r: any) => {
      const s = (r.status ?? "").toLowerCase();
      if (statusFilter === "active") return s !== "expired" && s !== "terminated";
      if (statusFilter === "expired") return s === "expired" || s === "terminated";
      return true;
    });
    if (!q) return list;
    return list.filter((r: any) =>
      [r.title, r.counterparty_name, r.contract_type]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q)),
    );
  }, [rows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalValue = filtered.reduce(
    (s: number, r: any) => s + (Number(r.contract_value) || 0),
    0,
  );
  const currency = (filtered[0] as any)?.currency || "USD";

  return (
    <Layout>
      <SEO title="Active Contracts · Recouply" description="Search and browse all active contracts." />
      <div className="container max-w-7xl py-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <FileSignature className="h-6 w-6 text-primary" />
              Contracts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Search, filter, and open every contract in your workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/contract-intelligence/dashboard">Open intelligence dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total contracts" value={String((rows ?? []).length)} />
          <StatCard
            label="Matching filter"
            value={String(filtered.length)}
          />
          <StatCard label="Total value" value={formatCurrency(totalValue, currency)} />
          <StatCard
            label="Renewals ≤ 90d"
            value={String(
              filtered.filter((r: any) => {
                const iso = r.renewal_date || r.expiry_date;
                if (!iso) return false;
                const d = (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
                return d >= 0 && d <= 90;
              }).length,
            )}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">All contracts</CardTitle>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search title, counterparty, type…"
                    className="pl-8 h-9 w-[260px]"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        Loading contracts…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && paged.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        No contracts match your search.
                      </TableCell>
                    </TableRow>
                  )}
                  {paged.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Link
                          to={`/contracts/live/${r.id}`}
                          className="flex items-center gap-2 min-w-0 group"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate group-hover:text-primary">
                              {r.title || "Untitled contract"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {r.counterparty_name || "—"}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.contract_type || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.effective_date ? formatDateShort(r.effective_date) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.expiry_date ? formatDateShort(r.expiry_date) : "Open"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.renewal_date ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3 text-muted-foreground" />
                            {formatDateShort(r.renewal_date)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {r.contract_value
                          ? formatCurrency(Number(r.contract_value), r.currency || "USD")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/contracts/live/${r.id}`}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
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
      </div>
    </Layout>
  );
}

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <Card className="p-4">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
  </Card>
);

const StatusBadge = ({ status }: { status: string | null }) => {
  const s = (status ?? "").toLowerCase();
  if (!s) return <Badge variant="outline">—</Badge>;
  if (s === "expired" || s === "terminated")
    return <Badge variant="outline" className="text-destructive border-destructive/40">{s}</Badge>;
  if (s === "active" || s === "signed")
    return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">{s}</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
};
