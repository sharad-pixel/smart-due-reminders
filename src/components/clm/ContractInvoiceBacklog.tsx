import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarRange } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/formatters";

interface Schedule {
  id: string;
  scheduled_date: string;
  amount: number | string | null;
  currency?: string | null;
  description?: string | null;
  product_description?: string | null;
  status?: string | null;
  billing_type?: string | null;
}

interface Props {
  schedules: Schedule[];
  defaultCurrency?: string;
}

export const ContractInvoiceBacklog = ({ schedules, defaultCurrency = "USD" }: Props) => {
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  }, []);

  const backlog = useMemo(
    () =>
      schedules
        .filter((s) => s.scheduled_date && s.scheduled_date > cutoff)
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [schedules, cutoff],
  );

  const total = backlog.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" /> Future Invoice Backlog
          <Badge variant="outline" className="ml-2 text-[10px]">Beyond next 60 days</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {backlog.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No scheduled invoices beyond the next 60 days. The active billing window covers everything in flight.
          </p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-3">
              {backlog.length} scheduled invoice{backlog.length === 1 ? "" : "s"} totaling{" "}
              <strong>{formatCurrency(total, defaultCurrency)}</strong> queued past day 60. Track these so nothing slips
              past your collections window.
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backlog.slice(0, 25).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{formatDateShort(s.scheduled_date)}</TableCell>
                    <TableCell className="text-xs">{s.product_description || s.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {(s.billing_type || "recurring").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(s.amount) || 0, s.currency || defaultCurrency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {(s.status || "forecast").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {backlog.length > 25 && (
              <p className="text-[11px] text-muted-foreground pt-2">
                Showing first 25 of {backlog.length}. View the full schedule below.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractInvoiceBacklog;
