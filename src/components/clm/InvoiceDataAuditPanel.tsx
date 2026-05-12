import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";
import { formatDateShort } from "@/lib/formatters";

interface Props {
  /** Filter audit rows by contract id */
  contractId?: string;
  /** Or filter by single invoice id */
  invoiceId?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  contract_intelligence: "Contract Intelligence",
  ocr_contract: "OCR (Contract)",
  ai_extract: "AI Extract",
  clm: "CLM",
  manual: "Manual",
};

export const InvoiceDataAuditPanel = ({ contractId, invoiceId }: Props) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contractId && !invoiceId) return;
    let cancelled = false;
    setLoading(true);
    let q = supabase
      .from("invoice_data_audit")
      .select("*, invoices:invoice_id(invoice_number)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (contractId) q = q.eq("source_contract_id", contractId);
    if (invoiceId) q = q.eq("invoice_id", invoiceId);
    q.then(({ data }) => {
      if (cancelled) return;
      setRows(data || []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId, invoiceId]);

  const dupCount = rows.filter((r) => r.duplicate_of_invoice_id).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Data Audit & Duplication Check
          {dupCount > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-1" /> {dupCount} possible duplicate{dupCount === 1 ? "" : "s"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading audit trail…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AI-extracted data points recorded yet. Generate an invoice from this contract to start the audit trail.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wide">
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium">When</th>
                  <th className="text-left py-2 px-2 font-medium">Invoice</th>
                  <th className="text-left py-2 px-2 font-medium">Field</th>
                  <th className="text-left py-2 px-2 font-medium">Source value</th>
                  <th className="text-left py-2 px-2 font-medium">Applied</th>
                  <th className="text-left py-2 px-2 font-medium">Source</th>
                  <th className="text-left py-2 pl-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateShort(r.created_at)}
                    </td>
                    <td className="py-2 px-2">
                      {r.invoice_id ? (
                        <Link
                          to={`/invoices/${r.invoice_id}`}
                          className="text-primary underline hover:no-underline inline-flex items-center gap-1"
                        >
                          {r.invoices?.invoice_number || "Open"}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-2 font-medium capitalize">
                      {String(r.field_name).replace(/_/g, " ")}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground break-words max-w-[200px]">
                      {r.source_value || "—"}
                    </td>
                    <td className="py-2 px-2 break-words max-w-[200px]">{r.applied_value || "—"}</td>
                    <td className="py-2 px-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {SOURCE_LABEL[r.source_type] || r.source_type}
                      </Badge>
                    </td>
                    <td className="py-2 pl-2">
                      {r.duplicate_of_invoice_id ? (
                        <Badge className="bg-amber-100 text-amber-800 text-[10px]">Duplicate</Badge>
                      ) : r.is_overridden ? (
                        <Badge className="bg-blue-100 text-blue-800 text-[10px]">Overridden</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceDataAuditPanel;
