import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Schedule {
  id: string;
  amount: number | string | null;
  billing_type?: string | null;
  description?: string | null;
  product_description?: string | null;
  service_period_start?: string | null;
  service_period_end?: string | null;
  currency?: string | null;
}

interface Props {
  schedules: Schedule[];
  defaultCurrency?: string;
}

const toNum = (v: any) => (typeof v === "number" ? v : Number(v) || 0);

const inferRecognition = (billingType?: string | null) => {
  const t = (billingType || "").toLowerCase();
  if (t.includes("one") || t.includes("milestone")) return "Point in time";
  return "Over time";
};

export const ContractPerformanceObligations = ({ schedules, defaultCurrency = "USD" }: Props) => {
  const grouped = useMemo(() => {
    const map: Record<string, { name: string; type: string; total: number; count: number; first?: string; last?: string }> = {};
    for (const s of schedules) {
      const name =
        (s.product_description || s.description || "Unspecified service").toString().trim() || "Unspecified service";
      const type = (s.billing_type || "recurring").toString();
      const key = `${name}::${type}`;
      const amt = toNum(s.amount);
      if (!map[key]) {
        map[key] = { name, type, total: 0, count: 0, first: s.service_period_start || undefined, last: s.service_period_end || undefined };
      }
      map[key].total += amt;
      map[key].count += 1;
      if (s.service_period_start && (!map[key].first || s.service_period_start < (map[key].first || "z"))) {
        map[key].first = s.service_period_start;
      }
      if (s.service_period_end && (!map[key].last || s.service_period_end > (map[key].last || ""))) {
        map[key].last = s.service_period_end;
      }
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [schedules]);

  const tcv = grouped.reduce((a, g) => a + g.total, 0);

  if (grouped.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Performance Obligations by Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            No schedule lines extracted yet — run re-assessment or add lines manually below.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" /> Performance Obligations by Service
          <Badge variant="outline" className="ml-2 text-[10px]">{grouped.length} obligation{grouped.length === 1 ? "" : "s"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Billing Type</TableHead>
              <TableHead>Recognition</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead className="text-right">% of TCV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map((g) => {
              const pct = tcv > 0 ? (g.total / tcv) * 100 : 0;
              return (
                <TableRow key={`${g.name}-${g.type}`}>
                  <TableCell className="font-medium">
                    {g.name}
                    {(g.first || g.last) && (
                      <div className="text-[11px] text-muted-foreground">
                        {g.first || "—"} → {g.last || "—"} · {g.count} line{g.count === 1 ? "" : "s"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">{g.type.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inferRecognition(g.type)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(g.total, defaultCurrency)}
                  </TableCell>
                  <TableCell className="text-right text-xs">{pct.toFixed(1)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ContractPerformanceObligations;
